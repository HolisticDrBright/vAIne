import { z } from 'zod';
import { skinAnalysisSchema } from '../analysis/skinAnalysisSchema';
import type { AnalysisRecord } from '../analysis/analysisService';
import type { RoutineSafetyIntake } from '../recommendations/routineBuilder';

/**
 * The on-device profile that lets vAIne remember a person between launches.
 *
 * Everything here is photo-free by construction: the remembered check-in is
 * the validated analysis record (scores, observations, capture metadata) and
 * never a photo, URI, or face geometry. Routine answers are remembered so the
 * safety intake does not have to be repeated for every check-in; the person
 * can change or delete them at any time from the privacy screen.
 *
 * The profile is stored locally only. It is never uploaded, and it is not
 * tied to an account identifier, so signing out or deleting an account does
 * not by itself reveal or remove it — local deletion is its own explicit
 * control.
 */

export const LOCAL_PROFILE_VERSION = 'local_profile_v1';

const safetyAnswerSchema = z.enum(['yes', 'no', 'prefer_not_to_say']);

export const routineSafetyIntakeSchema = z.object({
  sensitivityPreference: z.enum(['standard', 'sensitive']),
  pregnancyOrNursing: safetyAnswerSchema,
  recentProcedure: safetyAnswerSchema,
  knownAllergyOrReaction: safetyAnswerSchema,
  currentStrongActives: safetyAnswerSchema,
  avoidFragrance: z.boolean(),
  budgetPreference: z.enum(['up_to_25', 'up_to_50', 'up_to_100', 'no_limit']),
  /** Specific ingredients to avoid; empty when none were named. */
  avoidIngredients: z.array(z.string().min(1).max(80)).max(20).default([]),
  /** Active families already in use; empty when none were named. */
  currentActiveFamilies: z.array(z.string().min(1).max(80)).max(10).default([]),
}).strict();

const captureMetaSchema = z.object({
  angle: z.enum(['front', 'left_profile', 'right_profile']),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  capturedAtIso: z.string(),
}).strict();

/** Photo-free analysis record. Any field that could carry an image is absent. */
export const rememberedAnalysisRecordSchema = z.object({
  analysisId: z.string().min(1),
  mode: z.enum(['synthetic_demo', 'live']),
  providerId: z.string().min(1),
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  requestedAtIso: z.string(),
  completedAtIso: z.string(),
  captures: z.array(captureMetaSchema),
  qualityDecision: z.enum(['accepted', 'retake_requested']),
  result: skinAnalysisSchema,
}).strict();

export const consentDefaultsSchema = z.object({
  progressTracking: z.boolean(),
}).strict();

export const localProfileSchema = z.object({
  version: z.literal(LOCAL_PROFILE_VERSION),
  updatedAtIso: z.string(),
  routineIntake: routineSafetyIntakeSchema.nullable(),
  lastCheckIn: rememberedAnalysisRecordSchema.nullable(),
  consentDefaults: consentDefaultsSchema.nullable(),
}).strict();

export type LocalProfile = z.infer<typeof localProfileSchema>;

export const emptyLocalProfile: LocalProfile = {
  version: LOCAL_PROFILE_VERSION,
  updatedAtIso: '1970-01-01T00:00:00.000Z',
  routineIntake: null,
  lastCheckIn: null,
  consentDefaults: null,
};

/** Text that would indicate an image reference leaked into the profile. */
const PHOTO_PATTERNS = [/file:\/\//i, /"uri"/i, /base64/i, /data:image/i, /https?:\/\//i];

/**
 * Parses stored JSON into a profile. Anything malformed, from another
 * version, or carrying image-like content yields null so the app starts
 * fresh instead of trusting a corrupt or unexpected record.
 */
export function parseLocalProfile(input: unknown): LocalProfile | null {
  const parsed = localProfileSchema.safeParse(input);
  if (!parsed.success) return null;
  const serialized = JSON.stringify(parsed.data);
  if (PHOTO_PATTERNS.some((pattern) => pattern.test(serialized))) return null;
  return parsed.data;
}

export function isProfileEmpty(profile: LocalProfile): boolean {
  return profile.routineIntake === null && profile.lastCheckIn === null && profile.consentDefaults === null;
}

export function withRoutineIntake(
  profile: LocalProfile,
  routineIntake: RoutineSafetyIntake | null,
  nowIso: string,
): LocalProfile {
  // Normalize through the schema so optional list fields are always stored.
  return {
    ...profile,
    routineIntake: routineIntake ? routineSafetyIntakeSchema.parse(routineIntake) : null,
    updatedAtIso: nowIso,
  };
}

export function withLastCheckIn(
  profile: LocalProfile,
  record: AnalysisRecord | null,
  nowIso: string,
): LocalProfile {
  // Re-validate through the photo-free schema so a record can only be
  // remembered in the allow-listed shape.
  const lastCheckIn = record ? rememberedAnalysisRecordSchema.parse(record) : null;
  return { ...profile, lastCheckIn, updatedAtIso: nowIso };
}

export function withConsentDefaults(
  profile: LocalProfile,
  consentDefaults: LocalProfile['consentDefaults'],
  nowIso: string,
): LocalProfile {
  return { ...profile, consentDefaults, updatedAtIso: nowIso };
}

export function describeLastCheckIn(profile: LocalProfile): { completedAtIso: string; mode: 'synthetic_demo' | 'live' } | null {
  if (!profile.lastCheckIn) return null;
  return { completedAtIso: profile.lastCheckIn.completedAtIso, mode: profile.lastCheckIn.mode };
}
