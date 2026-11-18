import { describe, expect, test } from 'vitest';
import { techniqueLibrary } from '../../../data/techniqueLibrary';
import { SKIN_OBSERVATION_TAGS, SKIN_ZONES } from '../../analysis/observationTaxonomy';
import { validateTechniqueCopy } from '../../recommendations/copyValidation';
import { noTechniqueReasonCopy, pickDailyTechnique } from '../dailyTechnique';
import {
  DEVICE_AGE_GUIDANCE,
  PLACEHOLDER_REVIEW_LABEL,
  RECENT_WEEKS,
  TECHNIQUE_CATEGORIES,
  TECHNIQUE_EXCLUSION_FLAGS,
  UNIVERSAL_STOP_RULE,
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
  seizureOrHeartCondition: false,
  rosaceaOrBrokenCapillaries: false,
  activeInfection: false,
  sunburn: false,
  professionalReviewRecommended: false,
};

const byId = (id: string): Technique => techniqueLibrary.find((item) => item.id === id)!;
const ids = (results: readonly { eligible: boolean }[], techniques: readonly Technique[]) => techniques.filter((_, index) => !results[index].eligible).map((item) => item.id).sort();

describe('technique library', () => {
  test('every entry validates, covers one category each, and records the practitioner review', () => {
    expect(techniqueLibrary.map((item) => item.category).sort()).toEqual([...TECHNIQUE_CATEGORIES].sort());
    for (const technique of techniqueLibrary) {
      expect(() => techniqueSchema.parse(technique)).not.toThrow();
      expect(isPlaceholderTechnique(technique)).toBe(false);
      expect(technique).toMatchObject({ reviewStatus: 'practitioner_approved', reviewedBy: 'Dr. Bright', reviewedAtIso: '2026-11-17T00:00:00.000Z' });
      expect(technique.evidenceNote).not.toMatch(/placeholder|not been reviewed/i);
      for (const zone of technique.zones) expect(SKIN_ZONES).toContain(zone);
      for (const tag of technique.observationTags) expect(SKIN_OBSERVATION_TAGS).toContain(tag);
    }
  });

  test('an approved entry must say who reviewed it and when; placeholders stay possible', () => {
    const base = byId('gua-sha-gentle-sweep');
    expect(techniqueSchema.safeParse({ ...base, reviewedBy: null }).success).toBe(false);
    expect(techniqueSchema.safeParse({ ...base, reviewedAtIso: 'yesterday' }).success).toBe(false);
    const placeholder = techniqueSchema.parse({ ...base, id: 'new-entry', reviewStatus: 'placeholder_awaiting_practitioner_review', reviewedBy: null, reviewedAtIso: null });
    expect(isPlaceholderTechnique(placeholder)).toBe(true);
    expect(PLACEHOLDER_REVIEW_LABEL).toMatch(/AWAITING PRACTITIONER REVIEW/);
  });

  test('all technique copy passes the claim rules, avoids medical wording, and never promises safety for all ages', () => {
    const everything: string[] = [UNIVERSAL_STOP_RULE, DEVICE_AGE_GUIDANCE, ...Object.values(techniqueExclusionCopy), ...Object.values(noTechniqueReasonCopy)];
    for (const technique of techniqueLibrary) {
      everything.push(technique.name, technique.evidenceNote, technique.skipNote, ...technique.steps.flatMap((step) => [step.title, step.cue]));
    }
    for (const flag of TECHNIQUE_EXCLUSION_FLAGS) everything.push(techniqueReasonCopy(flag));
    everything.push(techniqueReasonCopy('professional_review_pending'));
    for (const text of everything) {
      expect(validateTechniqueCopy(text).ok, text).toBe(true);
      expect(text).not.toMatch(/diagnos|disease|heal|collagen production|lymphatic drainage|detox|toxin|safe for all ages|suitable for all ages|any age/i);
      expect(text).not.toMatch(/helps? (an? )?infection|clears? (a )?cold sore|eye (health|sight|benefit)/i);
    }
  });

  test('device techniques defer to the maker for age and red light keeps the eye-protection direction', () => {
    for (const technique of techniqueLibrary) {
      if (technique.category === 'microcurrent' || technique.category === 'red_light') {
        expect(technique.skipNote, technique.id).toContain(DEVICE_AGE_GUIDANCE);
      }
    }
    const redLight = byId('red-light-face-session');
    expect(`${redLight.skipNote} ${redLight.steps.map((step) => step.cue).join(' ')}`).toMatch(/eye protection directions/);
  });

  test('"recent" means four weeks in the question copy and the skip notes', () => {
    expect(RECENT_WEEKS).toBe(4);
    expect(techniqueExclusionCopy.recent_injectables).toMatch(/4 weeks/);
    expect(techniqueExclusionCopy.recent_procedure).toMatch(/4 weeks/);
    for (const technique of techniqueLibrary) {
      if (technique.exclusionFlags.includes('recent_injectables')) expect(technique.skipNote, technique.id).toMatch(/4 weeks/);
    }
  });

  test('skip notes match what is enforced', () => {
    const expectations: Record<string, RegExp[]> = {
      'gua-sha-gentle-sweep': [/cold sore/, /sunburn/, /rosacea/, /injectables/, /blood thinners/],
      'cupping-light-glide': [/cold sore/, /sunburn/, /rosacea/, /injectables/, /blood thinners/],
      'microcurrent-cheek-and-jaw': [/pacemaker/, /seizure/, /heart condition/, /sunburn/, /pregnancy/],
      'red-light-face-session': [/sensitive to light/, /procedure/],
      'facial-exercise-brow-and-cheek': [/injectables/, /procedure/],
    };
    for (const [id, patterns] of Object.entries(expectations)) {
      for (const pattern of patterns) expect(byId(id).skipNote, `${id} ${pattern}`).toMatch(pattern);
    }
    // Microcurrent is deliberately not blocked by a cold sore or infection, and its note makes no claim about them.
    expect(byId('microcurrent-cheek-and-jaw').exclusionFlags).not.toContain('active_infection_area');
    expect(byId('microcurrent-cheek-and-jaw').skipNote).not.toMatch(/cold sore|infection/);
  });
});

describe('technique eligibility', () => {
  test('a clear profile is offered every technique', () => {
    for (const technique of techniqueLibrary) {
      expect(evaluateTechniqueEligibility(technique, clear, []).eligible, technique.id).toBe(true);
    }
  });

  test.each([
    ['implantedDevice', 'implanted_device', ['microcurrent-cheek-and-jaw']],
    ['photosensitisingMedication', 'photosensitising_medication', ['red-light-face-session']],
    ['activeBreakouts', 'active_breakout_area', ['cupping-light-glide', 'gua-sha-gentle-sweep', 'microcurrent-cheek-and-jaw']],
    ['recentInjectables', 'recent_injectables', ['cupping-light-glide', 'facial-exercise-brow-and-cheek', 'gua-sha-gentle-sweep', 'microcurrent-cheek-and-jaw']],
    ['fragileSkinOrBloodThinners', 'fragile_skin_or_blood_thinners', ['cupping-light-glide', 'gua-sha-gentle-sweep']],
    ['seizureOrHeartCondition', 'seizure_or_heart_condition', ['microcurrent-cheek-and-jaw']],
    ['rosaceaOrBrokenCapillaries', 'rosacea_or_broken_capillaries', ['cupping-light-glide', 'gua-sha-gentle-sweep']],
    ['activeInfection', 'active_infection_area', ['cupping-light-glide', 'gua-sha-gentle-sweep']],
    ['sunburn', 'sunburn', ['cupping-light-glide', 'gua-sha-gentle-sweep', 'microcurrent-cheek-and-jaw']],
  ] as const)('%s blocks exactly the techniques flagged %s', (field, reason, blocked) => {
    const profile = { ...clear, [field]: true };
    const results = techniqueLibrary.map((technique) => evaluateTechniqueEligibility(technique, profile, []));
    expect(ids(results, techniqueLibrary)).toEqual([...blocked]);
    for (const [index, technique] of techniqueLibrary.entries()) {
      if (blocked.includes(technique.id as never)) expect(results[index].reasons).toEqual([reason]);
    }
  });

  test('a cold sore or infection leaves microcurrent available; sunburn does not', () => {
    const micro = byId('microcurrent-cheek-and-jaw');
    expect(evaluateTechniqueEligibility(micro, { ...clear, activeInfection: true }, []).eligible).toBe(true);
    expect(evaluateTechniqueEligibility(micro, { ...clear, sunburn: true }, []).reasons).toEqual(['sunburn']);
  });

  test('reuses the pregnancy, procedure, and sensitivity answers', () => {
    expect(evaluateTechniqueEligibility(byId('microcurrent-cheek-and-jaw'), { ...clear, pregnantOrTrying: true }, []).reasons).toEqual(['pregnancy_caution']);
    expect(evaluateTechniqueEligibility(byId('microcurrent-cheek-and-jaw'), { ...clear, nursing: true }, []).reasons).toEqual(['pregnancy_caution']);
    expect(evaluateTechniqueEligibility(byId('red-light-face-session'), { ...clear, recentProcedure: true }, []).reasons).toEqual(['recent_procedure']);
    expect(evaluateTechniqueEligibility(byId('gua-sha-gentle-sweep'), { ...clear, sensitivityPreference: 'sensitive' }, []).reasons).toEqual(['sensitive_skin_caution']);
    expect(evaluateTechniqueEligibility(byId('facial-exercise-brow-and-cheek'), { ...clear, sensitivityPreference: 'sensitive' }, []).eligible).toBe(true);
  });

  test('a suggested professional look pauses every technique and says why', () => {
    const paused = { ...clear, professionalReviewRecommended: true };
    for (const technique of techniqueLibrary) {
      const result = evaluateTechniqueEligibility(technique, paused, []);
      expect(result.eligible, technique.id).toBe(false);
      expect(result.reasons[0]).toBe('professional_review_pending');
    }
    expect(techniqueReasonCopy('professional_review_pending')).toMatch(/professional look/);
    expect(pickDailyTechnique(techniqueLibrary, paused, [], ['gua_sha_tool'], '2026-11-17')).toMatchObject({ session: null, reason: 'professional_review_pending' });
    expect(noTechniqueReasonCopy.professional_review_pending).toMatch(/paused/);
  });

  test('all reasons are reported together, and tools never change eligibility', () => {
    const everything = evaluateTechniqueEligibility(byId('microcurrent-cheek-and-jaw'), { ...clear, implantedDevice: true, seizureOrHeartCondition: true, sunburn: true }, []);
    expect(everything.reasons).toEqual(['implanted_device', 'seizure_or_heart_condition', 'sunburn']);
    const ranked = rankEligibleTechniques(techniqueLibrary, clear, ['appearance.fine_lines_visible'], ['red_light_device']);
    expect(ranked).toHaveLength(techniqueLibrary.length);
    expect(ranked.slice(0, 2).map((entry) => entry.technique.id)).toEqual(['facial-exercise-brow-and-cheek', 'red-light-face-session']);
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
  });

  test('falls back to the tool-free technique when no tool is owned, and explains an empty day', () => {
    expect(pickDailyTechnique(techniqueLibrary, clear, [], [], '2026-11-17').session?.technique.id).toBe('facial-exercise-brow-and-cheek');
    const cautious = { ...clear, recentInjectables: true, recentProcedure: true };
    expect(pickDailyTechnique(techniqueLibrary, cautious, [], ['gua_sha_tool'], '2026-11-17')).toMatchObject({ session: null, reason: 'no_eligible_technique' });
    expect(pickDailyTechnique([], clear, [], [], '2026-11-17').reason).toBe('library_empty');
  });
});
