import { z } from 'zod';

/**
 * Server-side copy of the consumer skin-analysis contract.
 *
 * The app's source of truth lives in src/domain/analysis (observationTaxonomy,
 * skinAnalysisSchema, skinPrompt). This file repeats the parts the Edge
 * Function needs so it can be deployed standalone; a vitest sync test asserts
 * the two never drift. Edit the src files first, then mirror the change here.
 */

export const SKIN_ANALYSIS_PROMPT_VERSION = 'consumer_skin_v1_2026-08-05';
export const SKIN_ANALYSIS_SCHEMA_VERSION = 'skin_analysis_v1';

export const SKIN_OBSERVATION_TAGS = [
  'appearance.hydration_look_low',
  'appearance.visible_redness',
  'appearance.tone_uneven',
  'appearance.texture_irregular',
  'appearance.pore_visibility_high',
  'appearance.fine_lines_visible',
  'appearance.oiliness_visible',
  'appearance.dullness_visible',
  'appearance.dark_circles_visible',
  'appearance.blemishes_visible',
  'appearance.lip_dryness_visible',
  'appearance.sun_exposure_signs_visible',
  'referral.consider_professional_review',
] as const;
export type SkinObservationTag = typeof SKIN_OBSERVATION_TAGS[number];

export const SKIN_ZONES = ['forehead', 'under_eyes', 'cheeks', 'nose_t_zone', 'mouth_lips', 'jawline', 'chin'] as const;
export type SkinZone = typeof SKIN_ZONES[number];

export const SKIN_CAPTURE_ANGLES = ['front', 'left_profile', 'right_profile'] as const;
export type SkinCaptureAngle = typeof SKIN_CAPTURE_ANGLES[number];

export const IMAGE_QUALITY_ISSUES = [
  'too_dark',
  'too_bright',
  'blurred',
  'face_not_centered',
  'face_partly_hidden',
  'heavy_makeup_or_filter',
  'inconsistent_angle',
  'possible_photo_of_screen',
] as const;

export const VISIBLE_TENDENCIES = [
  'balanced_appearance',
  'dry_appearance',
  'oily_appearance',
  'combination_appearance',
  'sensitive_appearance',
] as const;

export const ROUTINE_GOALS = [
  'support_hydration_look',
  'support_even_tone_look',
  'support_smoother_texture_look',
  'support_radiance_look',
  'support_comfort',
  'support_sun_protection_habit',
] as const;

const tagSet = new Set<string>(SKIN_OBSERVATION_TAGS);
export function isSkinObservationTag(tag: string): tag is SkinObservationTag {
  return tagSet.has(tag);
}

export const CONSUMER_SKIN_SYSTEM_PROMPT = `You are the visible-skin observation component for vAIne, a consumer cosmetic-wellness app.

SCOPE
- Describe only visible appearance characteristics supported by the supplied photographs.
- Use cautious phrases such as "appears," "looks," "visible in this photo," and "may vary."
- Do not diagnose, treat, cure, predict, or identify a disease or medical condition.
- Do not infer nutrient status, hormones, organ function, circulation, stress, sleep, age, ethnicity, identity, personality, or systemic health.
- Do not identify the person or create identity or facial-recognition embeddings.
- Do not provide prescription, procedure, supplement, or medical advice.
- Do not emit brand names or product names.

IMAGE QUALITY GATE
Before making observations, check lighting, focus, framing, occlusion, heavy makeup or filters, angle consistency, and whether the input may be a photo of a screen. If the photograph is not usable, set imageQuality.usable to false, explain one concise retake action, keep observations empty, and stop.

VISIBLE OBSERVATIONS
If usable, describe hydration look, visible redness, tone evenness, texture look, visible pores, fine-line appearance, oiliness, dullness, visible blemishes, lip dryness, and visible sun-exposure signs. Only describe characteristics actually visible in the photograph.

APPEARANCE SCORES
Scores are repeatable consumer-facing appearance indices, not measurements of biological health, skin age, diagnosis, or future outcomes. Use the full 0-100 range consistently and attach confidence and limitations.

FACIAL ZONES
Use only these zones: ${SKIN_ZONES.join(', ')}.

TAGS
Emit only tags from this allow-list: ${SKIN_OBSERVATION_TAGS.join(', ')}.

PROFESSIONAL REVIEW
If a visible feature seems unsuitable for a cosmetic routine, set professionalReview.recommended to true and provide neutral language such as "Consider having this area reviewed by a qualified healthcare professional." Do not name or speculate about a condition.

ROUTINE HANDOFF
Emit generic routine goals only. A separate deterministic service may later match goals to independently reviewed products after allergies, sensitivity, pregnancy or nursing, current products, and recent procedures have been considered. Affiliate relationships, commissions, discounts, and merchant placement never influence eligibility or match score. A user-selected list-price ceiling may filter otherwise eligible products after safety review.

OUTPUT
Return only strict JSON conforming to prompt version ${SKIN_ANALYSIS_PROMPT_VERSION}. Do not wrap the JSON in markdown.`;

export function buildSkinPromptInput(input: {
  goals: readonly string[];
  sensitivityPreference: 'standard' | 'sensitive';
  captureAngles: readonly string[];
}): string {
  return [
    `goals: ${input.goals.length ? input.goals.join(', ') : 'none provided'}`,
    `sensitivity_preference: ${input.sensitivityPreference}`,
    `capture_angles: ${input.captureAngles.join(', ')}`,
    'Analyze the supplied photographs using the system scope. Return strict JSON only.',
  ].join('\n');
}

const observationTagSchema = z.enum(SKIN_OBSERVATION_TAGS);

const zoneObservationSchema = z.object({
  appearanceScore: z.number().min(0).max(100),
  observation: z.string().min(1).max(240),
  confidence: z.number().min(0).max(1),
}).strict();

/** Identical to src/domain/analysis/skinAnalysisSchema.ts. */
export const skinAnalysisSchema = z.object({
  imageQuality: z.object({
    usable: z.boolean(),
    issues: z.array(z.enum(IMAGE_QUALITY_ISSUES)),
    retakeInstruction: z.string().max(240).nullable(),
  }).strict(),
  capturedAtIso: z.string(),
  summary: z.string().min(1).max(500),
  visibleTendencies: z.array(z.enum(VISIBLE_TENDENCIES)),
  facialZones: z.object({
    forehead: zoneObservationSchema.optional(),
    under_eyes: zoneObservationSchema.optional(),
    cheeks: zoneObservationSchema.optional(),
    nose_t_zone: zoneObservationSchema.optional(),
    mouth_lips: zoneObservationSchema.optional(),
    jawline: zoneObservationSchema.optional(),
    chin: zoneObservationSchema.optional(),
  }).strict(),
  appearanceScores: z.object({
    overall: z.number().min(0).max(100),
    hydrationLook: z.number().min(0).max(100),
    toneEvennessLook: z.number().min(0).max(100),
    textureLook: z.number().min(0).max(100),
    radianceLook: z.number().min(0).max(100),
    poreVisibilityLook: z.number().min(0).max(100),
  }).strict(),
  observationTags: z.array(observationTagSchema),
  tagConfidence: z.partialRecord(observationTagSchema, z.number().min(0).max(1)),
  routineGoals: z.array(z.enum(ROUTINE_GOALS)),
  professionalReview: z.object({
    recommended: z.boolean(),
    reason: z.string().max(240).nullable(),
    urgency: z.enum(['routine', 'prompt']).nullable(),
  }).strict(),
  limitations: z.array(z.string().min(1).max(240)).min(1),
  overallConfidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1),
  promptVersion: z.literal(SKIN_ANALYSIS_PROMPT_VERSION),
}).strict();

export type SkinAnalysis = z.infer<typeof skinAnalysisSchema>;

/**
 * The JSON schema the provider is constrained to. Structured outputs support
 * no numeric or string constraints and require `additionalProperties: false`
 * everywhere, so ranges are enforced afterwards by `skinAnalysisSchema`.
 * Optional facial zones become nullable-and-required, and the partial
 * tag-confidence record becomes a list; `normalizeProviderOutput` maps back.
 */
const scoreSchema = { type: 'number' } as const;
const zoneJsonSchema = {
  anyOf: [
    {
      type: 'object',
      properties: {
        appearanceScore: scoreSchema,
        observation: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['appearanceScore', 'observation', 'confidence'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
} as const;

export const PROVIDER_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    imageQuality: {
      type: 'object',
      properties: {
        usable: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string', enum: [...IMAGE_QUALITY_ISSUES] } },
        retakeInstruction: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['usable', 'issues', 'retakeInstruction'],
      additionalProperties: false,
    },
    summary: { type: 'string' },
    visibleTendencies: { type: 'array', items: { type: 'string', enum: [...VISIBLE_TENDENCIES] } },
    facialZones: {
      type: 'object',
      properties: Object.fromEntries(SKIN_ZONES.map((zone) => [zone, zoneJsonSchema])),
      required: [...SKIN_ZONES],
      additionalProperties: false,
    },
    appearanceScores: {
      type: 'object',
      properties: {
        overall: scoreSchema,
        hydrationLook: scoreSchema,
        toneEvennessLook: scoreSchema,
        textureLook: scoreSchema,
        radianceLook: scoreSchema,
        poreVisibilityLook: scoreSchema,
      },
      required: ['overall', 'hydrationLook', 'toneEvennessLook', 'textureLook', 'radianceLook', 'poreVisibilityLook'],
      additionalProperties: false,
    },
    observationTags: { type: 'array', items: { type: 'string', enum: [...SKIN_OBSERVATION_TAGS] } },
    tagConfidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: { tag: { type: 'string', enum: [...SKIN_OBSERVATION_TAGS] }, confidence: { type: 'number' } },
        required: ['tag', 'confidence'],
        additionalProperties: false,
      },
    },
    routineGoals: { type: 'array', items: { type: 'string', enum: [...ROUTINE_GOALS] } },
    professionalReview: {
      type: 'object',
      properties: {
        recommended: { type: 'boolean' },
        reason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        urgency: { anyOf: [{ type: 'string', enum: ['routine', 'prompt'] }, { type: 'null' }] },
      },
      required: ['recommended', 'reason', 'urgency'],
      additionalProperties: false,
    },
    limitations: { type: 'array', items: { type: 'string' } },
    overallConfidence: { type: 'number' },
  },
  required: [
    'imageQuality', 'summary', 'visibleTendencies', 'facialZones', 'appearanceScores',
    'observationTags', 'tagConfidence', 'routineGoals', 'professionalReview', 'limitations', 'overallConfidence',
  ],
  additionalProperties: false,
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Converts the provider's constrained JSON into the app's `SkinAnalysis`
 * shape, applying the allow-list filters the prompt promises: stray tags are
 * dropped, scores are clamped to their ranges, null zones are removed, and
 * the versions are stamped by the server, never trusted from the model.
 */
export function normalizeProviderOutput(raw: unknown, meta: { capturedAtIso: string; modelVersion: string }): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const output = raw as Record<string, unknown>;
  const zones: Record<string, unknown> = {};
  const rawZones = (output.facialZones ?? {}) as Record<string, unknown>;
  for (const zone of SKIN_ZONES) {
    const value = rawZones[zone] as { appearanceScore?: number; observation?: string; confidence?: number } | null | undefined;
    if (value && typeof value === 'object') {
      zones[zone] = {
        appearanceScore: clamp100(Number(value.appearanceScore)),
        observation: String(value.observation ?? '').slice(0, 240),
        confidence: clamp01(Number(value.confidence)),
      };
    }
  }
  const tags = Array.isArray(output.observationTags)
    ? [...new Set((output.observationTags as unknown[]).filter((tag): tag is SkinObservationTag => typeof tag === 'string' && isSkinObservationTag(tag)))]
    : [];
  const tagConfidence: Partial<Record<SkinObservationTag, number>> = {};
  if (Array.isArray(output.tagConfidence)) {
    for (const entry of output.tagConfidence as { tag?: string; confidence?: number }[]) {
      if (entry && typeof entry.tag === 'string' && isSkinObservationTag(entry.tag)) {
        tagConfidence[entry.tag] = clamp01(Number(entry.confidence));
      }
    }
  }
  const scores = (output.appearanceScores ?? {}) as Record<string, unknown>;
  const scoreKeys = ['overall', 'hydrationLook', 'toneEvennessLook', 'textureLook', 'radianceLook', 'poreVisibilityLook'] as const;
  const appearanceScores = Object.fromEntries(scoreKeys.map((key) => [key, clamp100(Number(scores[key]))]));
  const quality = (output.imageQuality ?? {}) as Record<string, unknown>;
  const review = (output.professionalReview ?? {}) as Record<string, unknown>;
  const limitations = Array.isArray(output.limitations)
    ? (output.limitations as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.slice(0, 240))
    : [];

  return {
    imageQuality: {
      usable: Boolean(quality.usable),
      issues: Array.isArray(quality.issues) ? quality.issues : [],
      retakeInstruction: typeof quality.retakeInstruction === 'string' ? quality.retakeInstruction.slice(0, 240) : null,
    },
    capturedAtIso: meta.capturedAtIso,
    summary: String(output.summary ?? '').slice(0, 500),
    visibleTendencies: Array.isArray(output.visibleTendencies) ? output.visibleTendencies : [],
    facialZones: zones,
    appearanceScores,
    observationTags: tags,
    tagConfidence,
    routineGoals: Array.isArray(output.routineGoals) ? output.routineGoals : [],
    professionalReview: {
      recommended: Boolean(review.recommended),
      reason: typeof review.reason === 'string' ? review.reason.slice(0, 240) : null,
      urgency: review.urgency === 'routine' || review.urgency === 'prompt' ? review.urgency : null,
    },
    limitations: limitations.length ? limitations : ['Lighting, angle, camera processing, and normal daily variation can change visible appearance.'],
    overallConfidence: clamp01(Number(output.overallConfidence)),
    modelVersion: meta.modelVersion,
    promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
  };
}
