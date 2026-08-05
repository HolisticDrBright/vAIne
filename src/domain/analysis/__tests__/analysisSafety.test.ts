import { describe, expect, test } from 'vitest';
import {
  filterSkinObservationTags,
  filterTagConfidence,
  SKIN_OBSERVATION_TAGS,
} from '../observationTaxonomy';
import { CONSUMER_SKIN_SYSTEM_PROMPT } from '../skinPrompt';
import { SKIN_ANALYSIS_PROMPT_VERSION, skinAnalysisSchema } from '../skinAnalysisSchema';

const validResult = {
  imageQuality: { usable: true, issues: [], retakeInstruction: null },
  capturedAtIso: '2026-08-05T12:00:00.000Z',
  summary: 'Skin appears balanced in this photograph.',
  visibleTendencies: ['balanced_appearance'],
  facialZones: {
    cheeks: { appearanceScore: 78, observation: 'Tone looks mostly even.', confidence: 0.82 },
  },
  appearanceScores: {
    overall: 80,
    hydrationLook: 78,
    toneEvennessLook: 79,
    textureLook: 77,
    radianceLook: 82,
    poreVisibilityLook: 74,
  },
  observationTags: ['appearance.hydration_look_low'],
  tagConfidence: { 'appearance.hydration_look_low': 0.71 },
  routineGoals: ['support_hydration_look'],
  professionalReview: { recommended: false, reason: null, urgency: null },
  limitations: ['Lighting and angle can change appearance.'],
  overallConfidence: 0.82,
  modelVersion: 'synthetic-test-model',
  promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
};

describe('consumer skin observation contract', () => {
  test('keeps only allow-listed visible appearance tags', () => {
    expect(filterSkinObservationTags([
      'appearance.visible_redness',
      'nutrient.iron_insufficiency_pattern',
      'system.hormonal_imbalance_appearance',
      'pattern.qi_deficiency',
    ])).toEqual(['appearance.visible_redness']);
  });

  test('clamps confidence and drops unknown keys', () => {
    expect(filterTagConfidence({
      'appearance.visible_redness': 1.7,
      'appearance.texture_irregular': -0.2,
      'system.detox_pathway_burden': 0.8,
    })).toEqual({
      'appearance.visible_redness': 1,
      'appearance.texture_irregular': 0,
    });
  });

  test('accepts the standalone structured result', () => {
    expect(skinAnalysisSchema.safeParse(validResult).success).toBe(true);
  });

  test('rejects legacy skin-age and systemic output fields', () => {
    expect(skinAnalysisSchema.safeParse({ ...validResult, skinAgeDeltaYears: -4 }).success).toBe(false);
    expect(skinAnalysisSchema.safeParse({ ...validResult, systemicCategories: ['hormone support'] }).success).toBe(false);
  });

  test('taxonomy contains no nutrient, organ, systemic, or TCM pattern namespaces', () => {
    expect(SKIN_OBSERVATION_TAGS.some((tag) => /^(nutrient|system|pattern)\./.test(tag))).toBe(false);
  });
});

describe('consumer skin prompt scope', () => {
  test('explicitly limits analysis to visible appearance', () => {
    const lower = CONSUMER_SKIN_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain('visible appearance');
    expect(lower).toContain('only describe characteristics actually visible');
    expect(lower).toContain('do not identify the person');
  });

  test('does not request clinical or AI Longevity Pro patient context', () => {
    const lower = CONSUMER_SKIN_SYSTEM_PROMPT.toLowerCase();
    for (const disallowed of ['lab flags', 'chief complaint', 'active protocols', 'cycle day', 'dr. bright', 'ai longevity pro']) {
      expect(lower).not.toContain(disallowed);
    }
  });

  test('medical-practice terms appear only in negative instructions', () => {
    const lines = CONSUMER_SKIN_SYSTEM_PROMPT.split('\n');
    for (const term of ['diagnose', 'treat', 'cure', 'disease']) {
      const occurrences = lines.filter((line) => line.toLowerCase().includes(term));
      expect(occurrences.length).toBeGreaterThan(0);
      for (const line of occurrences) expect(line.toLowerCase()).toMatch(/do not|not medical|not a/);
    }
  });
});
