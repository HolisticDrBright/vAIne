import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import { SKIN_OBSERVATION_TAGS } from '../observationTaxonomy';
import { validateRecommendationCopy } from '../../recommendations/copyValidation';
import {
  LEAD_OBSERVATION_COPY,
  MAX_LEAD_OBSERVATIONS,
  MIN_LEAD_OBSERVATIONS,
  formatObservationConfidence,
  leadObservations,
} from '../leadObservations';

describe('lead observations', () => {
  test('every observation tag except the referral has a reviewed sentence', () => {
    for (const tag of SKIN_OBSERVATION_TAGS) {
      if (tag === 'referral.consider_professional_review') continue;
      expect(LEAD_OBSERVATION_COPY[tag], tag).toMatch(/\.$/);
    }
    expect('referral.consider_professional_review' in LEAD_OBSERVATION_COPY).toBe(false);
  });

  test('every sentence uses cosmetic "looks" language and passes copy validation', () => {
    for (const text of Object.values(LEAD_OBSERVATION_COPY)) {
      expect(text).not.toMatch(/diagnos|disease|deficien|treat|cure|age\b|aging|organ|liver|kidney|gut|hormone|vitamin|nutrient/i);
      expect(validateRecommendationCopy({ copy: text.padEnd(20, ' '), allowedProducts: [], knownProducts: [] }).ok).toBe(true);
    }
  });

  test('orders the sample result by tag confidence and stays within two to three lines', () => {
    const lead = leadObservations(syntheticSkinAnalysis);
    expect(lead.length).toBeGreaterThanOrEqual(MIN_LEAD_OBSERVATIONS);
    expect(lead.length).toBeLessThanOrEqual(MAX_LEAD_OBSERVATIONS);
    expect(lead.map((item) => item.id)).toEqual(['appearance.pore_visibility_high', 'appearance.hydration_look_low']);
    expect(lead[0]).toMatchObject({ source: 'tag', confidence: 0.79, text: LEAD_OBSERVATION_COPY['appearance.pore_visibility_high'] });
  });

  test('caps a tag-heavy result at three lines, keeping the most confident', () => {
    const lead = leadObservations({
      ...syntheticSkinAnalysis,
      observationTags: [
        'appearance.visible_redness',
        'appearance.tone_uneven',
        'appearance.fine_lines_visible',
        'appearance.dullness_visible',
        'referral.consider_professional_review',
      ],
      tagConfidence: {
        'appearance.visible_redness': 0.5,
        'appearance.tone_uneven': 0.9,
        'appearance.fine_lines_visible': 0.7,
        'appearance.dullness_visible': 0.8,
      },
    });
    expect(lead.map((item) => item.id)).toEqual(['appearance.tone_uneven', 'appearance.dullness_visible', 'appearance.fine_lines_visible']);
    expect(lead.some((item) => item.id.startsWith('referral'))).toBe(false);
  });

  test('fills from the lowest-scoring zones when a result carries fewer than two tags', () => {
    const lead = leadObservations({ ...syntheticSkinAnalysis, observationTags: ['appearance.lip_dryness_visible'], tagConfidence: { 'appearance.lip_dryness_visible': 0.6 } });
    expect(lead).toHaveLength(MIN_LEAD_OBSERVATIONS);
    expect(lead[0].id).toBe('appearance.lip_dryness_visible');
    expect(lead[1]).toMatchObject({ id: 'zone:nose_t_zone', source: 'zone', confidence: 0.83 });
    expect(lead[1].text).toContain(syntheticSkinAnalysis.facialZones.nose_t_zone!.observation);
  });

  test('says the skin looks balanced when there is nothing else to report', () => {
    const lead = leadObservations({ ...syntheticSkinAnalysis, observationTags: [], tagConfidence: {}, facialZones: {} });
    expect(lead).toEqual([expect.objectContaining({ id: 'tendency:balanced', source: 'tendency', confidence: null })]);
  });

  test('formats confidence as a rounded percentage', () => {
    expect(formatObservationConfidence(0.79)).toBe('79% confidence');
    expect(formatObservationConfidence(1.4)).toBe('100% confidence');
    expect(formatObservationConfidence(null)).toBeNull();
  });
});
