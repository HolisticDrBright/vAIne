import { z } from 'zod';
import { skinAnalysisSchema } from '../analysis/skinAnalysisSchema';
import type { AnalysisRecord } from '../analysis/analysisService';
import type { ProductDecisions, RoutineSafetyIntake } from '../recommendations/routineBuilder';
import { PRODUCT_TYPE_VALUES } from '../recommendations/productTypes';
import { TECHNIQUE_TOOLS } from '../techniques/technique';
import { reminderPreferenceSchema, type ReminderPreference } from './checkInReminder';
import { markPlanDayDone, planLogSchema, type PlanLog } from './planStreak';

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
  routineProductCount: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]).default(4),
  /** Specific ingredients to avoid; empty when none were named. */
  avoidIngredients: z.array(z.string().min(1).max(80)).max(20).default([]),
  /** Active families already in use; empty when none were named. */
  currentActiveFamilies: z.array(z.string().min(1).max(80)).max(10).default([]),
  /** Product types the person said they are shopping for; empty means no preference. */
  productInterests: z.array(z.enum(PRODUCT_TYPE_VALUES)).max(PRODUCT_TYPE_VALUES.length).default([]),
  /** 'auto' lets vAIne derive the shopping list from each check-in instead. */
  productInterestMode: z.enum(['manual', 'auto']).default('manual'),
  /**
   * Technique safety answers. Optional so profiles saved before they existed
   * still load; an absent answer is treated as the cautious one.
   */
  implantedDevice: safetyAnswerSchema.optional(),
  lightSensitisingMedication: safetyAnswerSchema.optional(),
  activeBreakouts: safetyAnswerSchema.optional(),
  recentInjectables: safetyAnswerSchema.optional(),
  fragileSkinOrBloodThinners: safetyAnswerSchema.optional(),
  seizureOrHeartCondition: safetyAnswerSchema.optional(),
  rosaceaOrBrokenCapillaries: safetyAnswerSchema.optional(),
  facialSkinRightNow: z.enum(['none', 'cold_sore_or_infection', 'sunburn', 'both', 'prefer_not_to_say']).optional(),
  toolsOwned: z.array(z.enum(TECHNIQUE_TOOLS)).max(TECHNIQUE_TOOLS.length).default([]),
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

/**
 * What the person decided about listed products: added to their protocol
 * (scheduled first in its step while it still passes their safety and budget
 * answers) or set aside (never offered). Product ids only; a product can be
 * in one list at a time, and a decision is undone from the routine screen.
 */
export const productDecisionsSchema = z.object({
  inProtocol: z.array(z.string().min(1).max(120)).max(60).default([]),
  notForMe: z.array(z.string().min(1).max(120)).max(200).default([]),
}).strict();

export type ProductDecision = 'in_protocol' | 'not_for_me' | 'clear';

export const consentDefaultsSchema = z.object({
  progressTracking: z.boolean(),
}).strict();

export const localProfileSchema = z.object({
  version: z.literal(LOCAL_PROFILE_VERSION),
  updatedAtIso: z.string(),
  routineIntake: routineSafetyIntakeSchema.nullable(),
  lastCheckIn: rememberedAnalysisRecordSchema.nullable(),
  consentDefaults: consentDefaultsSchema.nullable(),
  /** Daily reminder time and whether it is on; null until the person chooses. */
  reminder: reminderPreferenceSchema.nullable().default(null),
  /** Calendar dates on which today's plan was marked done; null until the first. */
  planLog: planLogSchema.nullable().default(null),
  /** Products added to the protocol or set aside; null until the first decision. */
  productDecisions: productDecisionsSchema.nullable().default(null),
}).strict();

export type LocalProfile = z.infer<typeof localProfileSchema>;

export const emptyLocalProfile: LocalProfile = {
  version: LOCAL_PROFILE_VERSION,
  updatedAtIso: '1970-01-01T00:00:00.000Z',
  routineIntake: null,
  lastCheckIn: null,
  consentDefaults: null,
  reminder: null,
  planLog: null,
  productDecisions: null,
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
  return profile.routineIntake === null
    && profile.lastCheckIn === null
    && profile.consentDefaults === null
    && profile.reminder === null
    && profile.planLog === null
    && profile.productDecisions === null;
}

export const emptyDecisions: ProductDecisions = { inProtocol: [], notForMe: [] };

/** The person's product decisions, empty when none have been made. */
export function productDecisionsOf(profile: LocalProfile): ProductDecisions {
  return profile.productDecisions ?? emptyDecisions;
}

/** Moves a product into one list (removing it from the other) or clears it from both. */
export function withProductDecision(profile: LocalProfile, productId: string, decision: ProductDecision, nowIso: string): LocalProfile {
  const current = productDecisionsOf(profile);
  const inProtocol = current.inProtocol.filter((id) => id !== productId);
  const notForMe = current.notForMe.filter((id) => id !== productId);
  if (decision === 'in_protocol') inProtocol.push(productId);
  if (decision === 'not_for_me') notForMe.push(productId);
  const next = productDecisionsSchema.parse({ inProtocol, notForMe });
  const empty = next.inProtocol.length === 0 && next.notForMe.length === 0;
  return { ...profile, productDecisions: empty ? null : next, updatedAtIso: nowIso };
}

/** Puts `replacementId` into the protocol in place of `replacedId`, which is set aside. */
export function withProductSwap(profile: LocalProfile, replacedId: string | null, replacementId: string, nowIso: string): LocalProfile {
  const withReplacement = withProductDecision(profile, replacementId, 'in_protocol', nowIso);
  return replacedId && replacedId !== replacementId ? withProductDecision(withReplacement, replacedId, 'not_for_me', nowIso) : withReplacement;
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

export function withReminder(
  profile: LocalProfile,
  reminder: ReminderPreference | null,
  nowIso: string,
): LocalProfile {
  return { ...profile, reminder: reminder ? reminderPreferenceSchema.parse(reminder) : null, updatedAtIso: nowIso };
}

/** Records that today's plan was done; `dateKey` is the device-local calendar date. */
export function withPlanDayDone(profile: LocalProfile, dateKey: string, nowIso: string): LocalProfile {
  const current: PlanLog = profile.planLog ?? { completedDays: [] };
  return { ...profile, planLog: markPlanDayDone(current, dateKey), updatedAtIso: nowIso };
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
