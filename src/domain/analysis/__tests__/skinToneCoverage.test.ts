import { describe, expect, test } from 'vitest';
import { approvedPrototypeCatalog } from '../../../data/prototypeCatalog';
import { FITZPATRICK_BANDS, skinToneFixtures, underexposedRetakeFixture } from '../../../data/skinToneFixtures';
import { buildSyntheticRoutine, type RoutineSafetyIntake } from '../../recommendations/routineBuilder';
import { rememberedAnalysisRecordSchema } from '../../profile/localProfile';
import { buildAnalysisRecord, buildAnalysisRequest } from '../analysisService';
import { LEAD_OBSERVATION_COPY, leadObservations } from '../leadObservations';
import { SKIN_OBSERVATION_TAGS } from '../observationTaxonomy';
import { skinAnalysisSchema } from '../skinAnalysisSchema';

const NOW = '2026-11-17T09:00:00.000Z';

const intake: RoutineSafetyIntake = {
  sensitivityPreference: 'standard',
  pregnancyOrNursing: 'no',
  recentProcedure: 'no',
  knownAllergyOrReaction: 'no',
  currentStrongActives: 'no',
  avoidFragrance: false,
  budgetPreference: 'up_to_50',
  routineProductCount: 4,
};

/**
 * The downstream contract must behave identically for every Fitzpatrick
 * band. These fixtures are synthetic results, so they prove the pipeline is
 * tone-agnostic by construction; they are not evidence of model parity. That
 * comes from the labelled photo set in docs/skin-tone-testing.md.
 */
describe('skin tone coverage of the result contract', () => {
  test('one fixture per Fitzpatrick band, none carrying a tone label inside the result', () => {
    expect(skinToneFixtures.map((item) => item.band)).toEqual([...FITZPATRICK_BANDS]);
    for (const { band, result } of skinToneFixtures) {
      expect(JSON.stringify(result), band).not.toMatch(/fitzpatrick|skin tone|ethnic|ancestry|phototype|\btype [IV]+\b/i);
    }
  });

  test.each(skinToneFixtures.map((item) => [item.band, item] as const))('band %s: validates, leads, builds a routine, and is remembered', (_band, item) => {
    expect(() => skinAnalysisSchema.parse(item.result)).not.toThrow();
    for (const tag of item.result.observationTags) expect(SKIN_OBSERVATION_TAGS).toContain(tag);

    const lead = leadObservations(item.result);
    expect(lead.length).toBeGreaterThanOrEqual(2);
    expect(lead.length).toBeLessThanOrEqual(3);
    for (const line of lead) expect(line.confidence === null || (line.confidence >= 0 && line.confidence <= 1)).toBe(true);

    const routine = buildSyntheticRoutine(item.result, intake, approvedPrototypeCatalog);
    expect(routine.am.length).toBeGreaterThan(0);
    expect(routine.pm.length).toBeGreaterThan(0);

    const record = buildAnalysisRecord({
      request: buildAnalysisRequest([{ angle: 'front', uri: 'file:///cache/front.jpg', width: 1200, height: 1600, capturedAtIso: NOW }], NOW),
      result: item.result,
      descriptor: { id: 'synthetic-prototype', mode: 'synthetic_demo' },
      completedAtIso: NOW,
      qualityDecision: 'accepted',
    });
    expect(() => rememberedAnalysisRecordSchema.parse(record)).not.toThrow();
  });

  test('the same observation yields the same lead sentence whatever the band', () => {
    const sentencesByTag = new Map<string, Set<string>>();
    for (const { result } of skinToneFixtures) {
      for (const line of leadObservations(result)) {
        if (line.source !== 'tag') continue;
        const set = sentencesByTag.get(line.id) ?? new Set<string>();
        set.add(line.text);
        sentencesByTag.set(line.id, set);
      }
    }
    for (const [tag, sentences] of sentencesByTag) expect(sentences.size, tag).toBe(1);
  });

  test('lead-observation wording assumes no particular skin colour', () => {
    for (const text of Object.values(LEAD_OBSERVATION_COPY)) {
      expect(text).not.toMatch(/\b(pale|fair|pink(ish)?|white|dark skin|light skin|olive|tan(ned)?)\b/i);
    }
  });

  test('a poorly exposed deeper-tone photograph is a retake with no scores to show', () => {
    const { result } = underexposedRetakeFixture;
    expect(result.imageQuality.usable).toBe(false);
    expect(result.imageQuality.issues).toContain('exposure_hides_skin_detail');
    expect(result.observationTags).toEqual([]);
    expect(result.imageQuality.retakeInstruction).toMatch(/evenly lit/);
  });

  test('dim light lowers confidence rather than changing the vocabulary', () => {
    const dim = skinToneFixtures.find((item) => item.lighting === 'dim')!;
    const lit = skinToneFixtures.find((item) => item.lighting === 'window_daylight')!;
    expect(dim.result.overallConfidence).toBeLessThan(lit.result.overallConfidence);
    for (const tag of dim.result.observationTags) expect(SKIN_OBSERVATION_TAGS).toContain(tag);
  });
});
