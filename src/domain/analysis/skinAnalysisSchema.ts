import { z } from 'zod';
import { SKIN_OBSERVATION_TAGS } from './observationTaxonomy';

/**
 * Every prompt version whose results this schema still accepts. Remembered
 * check-ins and stored rows carry the version they were produced with, so a
 * prompt revision must not make older validated results unreadable. The
 * current version is always the last entry.
 */
export const SKIN_ANALYSIS_PROMPT_VERSIONS = [
  'consumer_skin_v1_2026-08-05',
  // 2026-11-17: skin-tone guidance (Fitzpatrick I–VI) and the
  // exposure_hides_skin_detail quality issue.
  'consumer_skin_v1_2026-11-17',
] as const;
export const SKIN_ANALYSIS_PROMPT_VERSION = SKIN_ANALYSIS_PROMPT_VERSIONS[SKIN_ANALYSIS_PROMPT_VERSIONS.length - 1];
export const SKIN_ANALYSIS_SCHEMA_VERSION = 'skin_analysis_v1';

const observationTagSchema = z.enum(SKIN_OBSERVATION_TAGS);

const zoneObservationSchema = z.object({
  appearanceScore: z.number().min(0).max(100),
  observation: z.string().min(1).max(240),
  confidence: z.number().min(0).max(1),
}).strict();

/**
 * Schema notes on skin tone. The result carries no field for the person's
 * skin tone, phototype, ethnicity, or ancestry, and must never gain one:
 * tone coverage is verified with an externally labelled test set
 * (docs/skin-tone-testing.md), not by model output. Every score, tag, and
 * zone observation is defined identically for Fitzpatrick I through VI.
 * `exposure_hides_skin_detail` lets the quality gate reject a photograph whose
 * exposure hides surface detail on a deeper tone or washes out a lighter one,
 * so poor lighting becomes a retake rather than a biased score.
 */
export const IMAGE_QUALITY_ISSUES = [
  'too_dark',
  'too_bright',
  'blurred',
  'face_not_centered',
  'face_partly_hidden',
  'heavy_makeup_or_filter',
  'inconsistent_angle',
  'possible_photo_of_screen',
  'exposure_hides_skin_detail',
] as const;

const imageQualityIssueSchema = z.enum(IMAGE_QUALITY_ISSUES);

export const skinAnalysisSchema = z.object({
  imageQuality: z.object({
    usable: z.boolean(),
    issues: z.array(imageQualityIssueSchema),
    retakeInstruction: z.string().max(240).nullable(),
  }).strict(),
  capturedAtIso: z.string(),
  summary: z.string().min(1).max(500),
  visibleTendencies: z.array(z.enum([
    'balanced_appearance',
    'dry_appearance',
    'oily_appearance',
    'combination_appearance',
    'sensitive_appearance',
  ])),
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
  routineGoals: z.array(z.enum([
    'support_hydration_look',
    'support_even_tone_look',
    'support_smoother_texture_look',
    'support_radiance_look',
    'support_comfort',
    'support_sun_protection_habit',
  ])),
  professionalReview: z.object({
    recommended: z.boolean(),
    reason: z.string().max(240).nullable(),
    urgency: z.enum(['routine', 'prompt']).nullable(),
  }).strict(),
  limitations: z.array(z.string().min(1).max(240)).min(1),
  overallConfidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1),
  promptVersion: z.enum(SKIN_ANALYSIS_PROMPT_VERSIONS),
}).strict();

export type SkinAnalysis = z.infer<typeof skinAnalysisSchema>;
