import { z } from 'zod';
import { SKIN_OBSERVATION_TAGS, SKIN_ZONES } from '../analysis/observationTaxonomy';

/**
 * At-home cosmetic techniques, modelled like products.
 *
 * A technique has the zones it is used on, the observation tags it may
 * support, a required tool, exclusion flags, and an evidence note. It is
 * matched by rules in `techniqueEligibility.ts`, never by the AI, which stays
 * a skin-observation component. Every technique in the library carries a
 * review status; until a practitioner has approved it, it is placeholder
 * content and the interface says so wherever it appears.
 *
 * Copy rules: techniques are described in cautious appearance language
 * ("may help skin look less puffy for a while"). They never claim to reshape
 * bone, lift permanently, treat, cure, or guarantee anything.
 */

export const TECHNIQUE_CATEGORIES = ['gua_sha', 'facial_exercise', 'microcurrent', 'red_light', 'cupping'] as const;
export type TechniqueCategory = typeof TECHNIQUE_CATEGORIES[number];

export const TECHNIQUE_TOOLS = ['gua_sha_tool', 'facial_cups', 'microcurrent_device', 'red_light_device'] as const;
export type TechniqueTool = typeof TECHNIQUE_TOOLS[number];

export const techniqueToolLabels: Record<TechniqueTool, string> = {
  gua_sha_tool: 'Gua sha tool',
  facial_cups: 'Facial cupping set',
  microcurrent_device: 'Microcurrent device',
  red_light_device: 'Red light mask or panel',
};

export const techniqueCategoryLabels: Record<TechniqueCategory, string> = {
  gua_sha: 'Gua sha',
  facial_exercise: 'Facial exercise',
  microcurrent: 'Microcurrent',
  red_light: 'Red light',
  cupping: 'Facial cupping',
};

/**
 * Why a technique is withheld. The first five are new to techniques; the
 * rest reuse the product safety answers already in the intake.
 */
export const TECHNIQUE_EXCLUSION_FLAGS = [
  'implanted_device',
  'photosensitising_medication',
  'active_breakout_area',
  'recent_injectables',
  'fragile_skin_or_blood_thinners',
  'pregnancy_caution',
  'recent_procedure',
  'sensitive_skin_caution',
] as const;
export type TechniqueExclusionFlag = typeof TECHNIQUE_EXCLUSION_FLAGS[number];

export const techniqueExclusionCopy: Record<TechniqueExclusionFlag, string> = {
  implanted_device: 'Not for anyone with a pacemaker or other implanted electrical device.',
  photosensitising_medication: 'Not while taking a medication that makes skin more sensitive to light.',
  active_breakout_area: 'Skip over areas with active breakouts or broken skin.',
  recent_injectables: 'Not in the weeks after injectables; follow the practitioner’s advice.',
  fragile_skin_or_blood_thinners: 'Not for fragile or thin skin, or while taking blood thinners.',
  pregnancy_caution: 'Paused during pregnancy or nursing until reviewed with a professional.',
  recent_procedure: 'Paused after a recent peel, laser, or other procedure; follow your aftercare.',
  sensitive_skin_caution: 'Paused for a sensitive-skin preference until a gentler version is reviewed.',
};

export const techniqueStepSchema = z.object({
  title: z.string().min(1).max(60),
  /** Pressure and direction cue read aloud or shown during the timer. */
  cue: z.string().min(1).max(200),
  seconds: z.number().int().min(5).max(600),
}).strict();

export const techniqueSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(60),
  category: z.enum(TECHNIQUE_CATEGORIES),
  zones: z.array(z.enum(SKIN_ZONES)).min(1),
  observationTags: z.array(z.enum(SKIN_OBSERVATION_TAGS)),
  durationSeconds: z.number().int().min(30).max(1800),
  steps: z.array(techniqueStepSchema).min(1).max(12),
  requiredTool: z.enum(TECHNIQUE_TOOLS).nullable(),
  exclusionFlags: z.array(z.enum(TECHNIQUE_EXCLUSION_FLAGS)),
  /** Cautious, appearance-only statement of what is and is not known. */
  evidenceNote: z.string().min(20).max(400),
  /** "Who should skip this", shown before every session. */
  skipNote: z.string().min(10).max(400),
  reviewStatus: z.enum(['placeholder_awaiting_practitioner_review', 'practitioner_approved']),
}).strict().refine((technique) => technique.steps.reduce((total, step) => total + step.seconds, 0) === technique.durationSeconds, 'durationSeconds must equal the sum of step seconds');

export type Technique = z.infer<typeof techniqueSchema>;
export type TechniqueStep = z.infer<typeof techniqueStepSchema>;

export function isPlaceholderTechnique(technique: Pick<Technique, 'reviewStatus'>): boolean {
  return technique.reviewStatus !== 'practitioner_approved';
}

export const PLACEHOLDER_REVIEW_LABEL = 'PLACEHOLDER · AWAITING PRACTITIONER REVIEW';
