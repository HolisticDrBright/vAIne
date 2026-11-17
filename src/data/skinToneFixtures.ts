import { SKIN_ANALYSIS_PROMPT_VERSION, skinAnalysisSchema, type SkinAnalysis } from '../domain/analysis/skinAnalysisSchema';

/**
 * Skin-tone coverage fixtures.
 *
 * Six synthetic, schema-valid results, one per Fitzpatrick band. The band is
 * a label on the fixture, exactly as it will be a label on each consented
 * photograph in the real test set (docs/skin-tone-testing.md): it never
 * appears inside the result, because the analysis contract has no field for
 * it. These fixtures prove the downstream contract (lead observations,
 * routine building, remembering) is identical for every band. They are not
 * evidence that the model performs equally across tones; only the labelled
 * photo set can show that.
 */

export type FitzpatrickBand = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export const FITZPATRICK_BANDS: readonly FitzpatrickBand[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export interface SkinToneFixture {
  band: FitzpatrickBand;
  /** Which lighting the synthetic case stands in for; mirrors the photo-set conditions. */
  lighting: 'window_daylight' | 'warm_indoor' | 'cool_led' | 'dim';
  result: SkinAnalysis;
}

const base = {
  imageQuality: { usable: true, issues: [], retakeInstruction: null },
  capturedAtIso: '2026-11-17T09:00:00.000Z',
  visibleTendencies: ['balanced_appearance'],
  professionalReview: { recommended: false, reason: null, urgency: null },
  limitations: ['Lighting, angle, camera processing, and normal daily variation can change visible appearance.'],
  modelVersion: 'synthetic-skin-tone-fixture',
  promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
} as const;

const zones = (scores: Record<'forehead' | 'cheeks' | 'nose_t_zone', number>) => ({
  forehead: { appearanceScore: scores.forehead, observation: 'Texture looks mostly smooth in this photograph.', confidence: 0.8 },
  cheeks: { appearanceScore: scores.cheeks, observation: 'Tone looks mostly even in this photograph.', confidence: 0.8 },
  nose_t_zone: { appearanceScore: scores.nose_t_zone, observation: 'Some pore visibility is visible in this photograph.', confidence: 0.8 },
});

const fixture = (
  band: FitzpatrickBand,
  lighting: SkinToneFixture['lighting'],
  overrides: Partial<Pick<SkinAnalysis, 'summary' | 'observationTags' | 'tagConfidence' | 'routineGoals' | 'appearanceScores' | 'facialZones' | 'overallConfidence'>>,
): SkinToneFixture => ({
  band,
  lighting,
  result: skinAnalysisSchema.parse({
    ...base,
    summary: 'A balanced-looking baseline in this photograph.',
    facialZones: zones({ forehead: 80, cheeks: 78, nose_t_zone: 74 }),
    appearanceScores: { overall: 79, hydrationLook: 80, toneEvennessLook: 78, textureLook: 77, radianceLook: 80, poreVisibilityLook: 72 },
    observationTags: ['appearance.hydration_look_low'],
    tagConfidence: { 'appearance.hydration_look_low': 0.7 },
    routineGoals: ['support_hydration_look', 'support_sun_protection_habit'],
    overallConfidence: 0.8,
    ...overrides,
  }),
});

export const skinToneFixtures: readonly SkinToneFixture[] = [
  fixture('I', 'window_daylight', {
    observationTags: ['appearance.visible_redness', 'appearance.sun_exposure_signs_visible'],
    tagConfidence: { 'appearance.visible_redness': 0.74, 'appearance.sun_exposure_signs_visible': 0.66 },
    routineGoals: ['support_comfort', 'support_sun_protection_habit'],
  }),
  fixture('II', 'warm_indoor', {
    observationTags: ['appearance.hydration_look_low', 'appearance.fine_lines_visible'],
    tagConfidence: { 'appearance.hydration_look_low': 0.72, 'appearance.fine_lines_visible': 0.61 },
  }),
  fixture('III', 'cool_led', {
    observationTags: ['appearance.pore_visibility_high', 'appearance.oiliness_visible'],
    tagConfidence: { 'appearance.pore_visibility_high': 0.78, 'appearance.oiliness_visible': 0.7 },
    routineGoals: ['support_smoother_texture_look', 'support_sun_protection_habit'],
  }),
  fixture('IV', 'window_daylight', {
    observationTags: ['appearance.tone_uneven', 'appearance.dullness_visible'],
    tagConfidence: { 'appearance.tone_uneven': 0.75, 'appearance.dullness_visible': 0.63 },
    routineGoals: ['support_even_tone_look', 'support_radiance_look', 'support_sun_protection_habit'],
  }),
  fixture('V', 'dim', {
    observationTags: ['appearance.tone_uneven', 'appearance.dark_circles_visible'],
    tagConfidence: { 'appearance.tone_uneven': 0.69, 'appearance.dark_circles_visible': 0.64 },
    routineGoals: ['support_even_tone_look', 'support_hydration_look'],
    // Dim light lowers confidence rather than changing the verdict.
    overallConfidence: 0.64,
  }),
  fixture('VI', 'warm_indoor', {
    observationTags: ['appearance.dullness_visible', 'appearance.hydration_look_low'],
    tagConfidence: { 'appearance.dullness_visible': 0.73, 'appearance.hydration_look_low': 0.7 },
    routineGoals: ['support_radiance_look', 'support_hydration_look', 'support_sun_protection_habit'],
  }),
];

/** A poorly exposed deeper-tone photograph must become a retake, never a score. */
export const underexposedRetakeFixture: SkinToneFixture = {
  band: 'VI',
  lighting: 'dim',
  result: skinAnalysisSchema.parse({
    ...base,
    imageQuality: {
      usable: false,
      issues: ['too_dark', 'exposure_hides_skin_detail'],
      retakeInstruction: 'Face a window or a lamp so your skin is evenly lit, then try again.',
    },
    summary: 'The photograph is too dark to describe visible skin appearance.',
    visibleTendencies: [],
    facialZones: {},
    appearanceScores: { overall: 0, hydrationLook: 0, toneEvennessLook: 0, textureLook: 0, radianceLook: 0, poreVisibilityLook: 0 },
    observationTags: [],
    tagConfidence: {},
    routineGoals: [],
    overallConfidence: 0.1,
  }),
};
