import { z } from 'zod';
import { SKIN_OBSERVATION_TAGS } from './observationTaxonomy';

export const SKIN_ANALYSIS_PROMPT_VERSION = 'consumer_skin_v1_2026-08-05';
export const SKIN_ANALYSIS_SCHEMA_VERSION = 'skin_analysis_v1';

const observationTagSchema = z.enum(SKIN_OBSERVATION_TAGS);

const zoneObservationSchema = z.object({
  appearanceScore: z.number().min(0).max(100),
  observation: z.string().min(1).max(240),
  confidence: z.number().min(0).max(1),
}).strict();

const imageQualityIssueSchema = z.enum([
  'too_dark',
  'too_bright',
  'blurred',
  'face_not_centered',
  'face_partly_hidden',
  'heavy_makeup_or_filter',
  'inconsistent_angle',
  'possible_photo_of_screen',
]);

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
  promptVersion: z.literal(SKIN_ANALYSIS_PROMPT_VERSION),
}).strict();

export type SkinAnalysis = z.infer<typeof skinAnalysisSchema>;
