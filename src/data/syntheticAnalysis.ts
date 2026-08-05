import { SKIN_ANALYSIS_PROMPT_VERSION, skinAnalysisSchema } from '@/domain/analysis/skinAnalysisSchema';

/** Synthetic fixture used by the prototype UI. No photograph or AI call is involved. */
export const syntheticSkinAnalysis = skinAnalysisSchema.parse({
  imageQuality: { usable: true, issues: [], retakeInstruction: null },
  capturedAtIso: '2026-08-05T12:00:00.000Z',
  summary: 'A balanced-looking baseline with room to support hydration and evenness.',
  visibleTendencies: ['balanced_appearance'],
  facialZones: {
    forehead: { appearanceScore: 81, observation: 'Texture looks mostly smooth in this photograph.', confidence: 0.84 },
    under_eyes: { appearanceScore: 82, observation: 'A well-rested appearance with a small opportunity to support hydration.', confidence: 0.8 },
    cheeks: { appearanceScore: 78, observation: 'Tone looks mostly even with mild visible redness.', confidence: 0.81 },
    nose_t_zone: { appearanceScore: 76, observation: 'Some pore visibility and light surface shine are visible.', confidence: 0.83 },
  },
  appearanceScores: {
    overall: 81,
    hydrationLook: 84,
    toneEvennessLook: 78,
    textureLook: 76,
    radianceLook: 82,
    poreVisibilityLook: 66,
  },
  observationTags: ['appearance.hydration_look_low', 'appearance.pore_visibility_high'],
  tagConfidence: {
    'appearance.hydration_look_low': 0.71,
    'appearance.pore_visibility_high': 0.79,
  },
  routineGoals: ['support_hydration_look', 'support_smoother_texture_look', 'support_sun_protection_habit'],
  professionalReview: { recommended: false, reason: null, urgency: null },
  limitations: ['Lighting, angle, camera processing, and normal daily variation can change visible appearance.'],
  overallConfidence: 0.82,
  modelVersion: 'synthetic-prototype',
  promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
});
