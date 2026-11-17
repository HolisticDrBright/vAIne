import { describe, expect, test } from 'vitest';
import { techniqueLibrary } from '../../../data/techniqueLibrary';
import { SKIN_OBSERVATION_TAGS, SKIN_ZONES } from '../../analysis/observationTaxonomy';
import { validateTechniqueCopy } from '../../recommendations/copyValidation';
import { noTechniqueReasonCopy, pickDailyTechnique } from '../dailyTechnique';
import {
  PLACEHOLDER_REVIEW_LABEL,
  TECHNIQUE_CATEGORIES,
  TECHNIQUE_EXCLUSION_FLAGS,
  isPlaceholderTechnique,
  techniqueExclusionCopy,
  techniqueSchema,
  type Technique,
} from '../technique';
import {
  evaluateTechniqueEligibility,
  rankEligibleTechniques,
  techniqueReasonCopy,
  type TechniqueSafetyProfile,
} from '../techniqueEligibility';

const clear: TechniqueSafetyProfile = {
  pregnantOrTrying: false,
  nursing: false,
  recentProcedure: false,
  sensitivityPreference: 'standard',
  avoidFragrance: false,
  avoidEssentialOils: false,
  allergies: [],
  currentActiveFamilies: [],
  implantedDevice: false,
  photosensitisingMedication: false,
  activeBreakouts: false,
  recentInjectables: false,
  fragileSkinOrBloodThinners: false,
};

const byId = (id: string): Technique => techniqueLibrary.find((item) => item.id === id)!;

describe('technique library', () => {
  test('every entry validates, covers one category each, and is a labelled placeholder', () => {
    expect(techniqueLibrary.map((item) => item.category).sort()).toEqual([...TECHNIQUE_CATEGORIES].sort());
    for (const technique of techniqueLibrary) {
      expect(() => techniqueSchema.parse(technique)).not.toThrow();
      expect(isPlaceholderTechnique(technique)).toBe(true);
      expect(technique.evidenceNote).toMatch(/not been reviewed by a practitioner/);
      for (const zone of technique.zones) expect(SKIN_ZONES).toContain(zone);
      for (const tag of technique.observationTags) expect(SKIN_OBSERVATION_TAGS).toContain(tag);
    }
    expect(PLACEHOLDER_REVIEW_LABEL).toMatch(/AWAITING PRACTITIONER REVIEW/);
  });

  test('all technique copy passes the claim rules and avoids medical wording', () => {
    for (const technique of techniqueLibrary) {
      const texts = [technique.name, technique.evidenceNote, technique.skipNote, ...technique.steps.flatMap((step) => [step.title, step.cue])];
      for (const text of texts) {
        expect(validateTechniqueCopy(text).ok, `${technique.id}: ${text}`).toBe(true);
        expect(text).not.toMatch(/diagnos|disease|heal|collagen production|lymphatic drainage|detox|toxin/i);
      }
    }
  });

  test('the only tool-free technique is facial exercise, and every flag has copy', () => {
    const toolFree = techniqueLibrary.filter((item) => item.requiredTool === null);
    expect(toolFree.map((item) => item.category)).toEqual(['facial_exercise']);
    for (const flag of TECHNIQUE_EXCLUSION_FLAGS) {
      expect(techniqueExclusionCopy[flag].length).toBeGreaterThan(10);
      expect(techniqueReasonCopy(flag).length).toBeGreaterThan(10);
    }
    expect(techniqueSchema.safeParse({ ...byId('gua-sha-gentle-sweep'), durationSeconds: 999 }).success).toBe(false);
  });
});

describe('technique eligibility', () => {
  test('a clear profile is offered every technique', () => {
    for (const technique of techniqueLibrary) {
      expect(evaluateTechniqueEligibility(technique, clear, []).eligible, technique.id).toBe(true);
    }
  });

  test.each([
    ['implantedDevice', 'implanted_device', 'microcurrent-cheek-and-jaw'],
    ['photosensitisingMedication', 'photosensitising_medication', 'red-light-face-session'],
    ['activeBreakouts', 'active_breakout_area', 'gua-sha-gentle-sweep'],
    ['recentInjectables', 'recent_injectables', 'facial-exercise-brow-and-cheek'],
    ['fragileSkinOrBloodThinners', 'fragile_skin_or_blood_thinners', 'cupping-light-glide'],
  ] as const)('%s excludes techniques flagged %s', (field, reason, id) => {
    const result = evaluateTechniqueEligibility(byId(id), { ...clear, [field]: true }, []);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual([reason]);
  });

  test('reuses the pregnancy, procedure, and sensitivity answers', () => {
    expect(evaluateTechniqueEligibility(byId('microcurrent-cheek-and-jaw'), { ...clear, pregnantOrTrying: true }, []).reasons).toEqual(['pregnancy_caution']);
    expect(evaluateTechniqueEligibility(byId('microcurrent-cheek-and-jaw'), { ...clear, nursing: true }, []).reasons).toEqual(['pregnancy_caution']);
    expect(evaluateTechniqueEligibility(byId('red-light-face-session'), { ...clear, recentProcedure: true }, []).reasons).toEqual(['recent_procedure']);
    expect(evaluateTechniqueEligibility(byId('gua-sha-gentle-sweep'), { ...clear, sensitivityPreference: 'sensitive' }, []).reasons).toEqual(['sensitive_skin_caution']);
    // Facial exercise carries no sensitivity flag, so a sensitive person still has one option.
    expect(evaluateTechniqueEligibility(byId('facial-exercise-brow-and-cheek'), { ...clear, sensitivityPreference: 'sensitive' }, []).eligible).toBe(true);
  });

  test('a flag that does not apply to a technique never excludes it, and all reasons are reported', () => {
    expect(evaluateTechniqueEligibility(byId('facial-exercise-brow-and-cheek'), { ...clear, implantedDevice: true, photosensitisingMedication: true }, []).eligible).toBe(true);
    const everything = evaluateTechniqueEligibility(byId('microcurrent-cheek-and-jaw'), { ...clear, implantedDevice: true, activeBreakouts: true, recentProcedure: true }, []);
    expect(everything.reasons).toEqual(['implanted_device', 'active_breakout_area', 'recent_procedure']);
  });

  test('ranks owned-tool techniques first, then goal matches; tools never change eligibility', () => {
    const ranked = rankEligibleTechniques(techniqueLibrary, clear, ['appearance.fine_lines_visible'], ['red_light_device']);
    expect(ranked).toHaveLength(techniqueLibrary.length);
    // Both the owned red-light device and tool-free facial exercise match the goal; ties fall back to name order.
    expect(ranked.slice(0, 2).map((entry) => entry.technique.id)).toEqual(['facial-exercise-brow-and-cheek', 'red-light-face-session']);
    expect(ranked.slice(2).every((entry) => !entry.toolOwned)).toBe(true);
    expect(ranked.find((entry) => entry.technique.id === 'red-light-face-session')?.eligibility.matchedTags).toEqual(['appearance.fine_lines_visible']);
  });
});

describe('daily technique pick', () => {
  test('is deterministic by date, prefers goal matches, and rotates', () => {
    const tools = ['gua_sha_tool', 'facial_cups'] as const;
    const tags = ['appearance.dullness_visible'] as const;
    const a = pickDailyTechnique(techniqueLibrary, clear, tags, tools, '2026-11-17');
    const b = pickDailyTechnique(techniqueLibrary, clear, tags, tools, '2026-11-17');
    expect(a.session?.technique.id).toBe(b.session?.technique.id);
    const week = new Set(['2026-11-17', '2026-11-18', '2026-11-19'].map((day) => pickDailyTechnique(techniqueLibrary, clear, tags, tools, day).session?.technique.id));
    expect(week.size).toBeGreaterThan(1);
    for (const day of ['2026-11-17', '2026-11-18', '2026-11-19']) {
      const pick = pickDailyTechnique(techniqueLibrary, clear, tags, tools, day).session!;
      expect(pick.toolOwned).toBe(true);
      expect(pick.eligibility.matchedTags).toContain('appearance.dullness_visible');
    }
  });

  test('falls back to the tool-free technique when no tool is owned', () => {
    const pick = pickDailyTechnique(techniqueLibrary, clear, [], [], '2026-11-17');
    expect(pick.session?.technique.id).toBe('facial-exercise-brow-and-cheek');
    expect(pick.needsTool.length).toBe(techniqueLibrary.length - 1);
  });

  test('explains when nothing can be offered', () => {
    const cautious = { ...clear, recentInjectables: true, recentProcedure: true };
    const none = pickDailyTechnique(techniqueLibrary, cautious, [], ['gua_sha_tool'], '2026-11-17');
    expect(none).toMatchObject({ session: null, reason: 'no_eligible_technique' });
    const noTool = pickDailyTechnique(techniqueLibrary.filter((item) => item.requiredTool !== null), clear, [], [], '2026-11-17');
    expect(noTool.reason).toBe('no_owned_tool');
    expect(noTool.needsTool.length).toBeGreaterThan(0);
    expect(pickDailyTechnique([], clear, [], [], '2026-11-17').reason).toBe('library_empty');
    for (const copy of Object.values(noTechniqueReasonCopy)) expect(copy.length).toBeGreaterThan(20);
  });
});
