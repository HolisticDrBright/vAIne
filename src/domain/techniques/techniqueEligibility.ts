import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { SafetyProfile } from '../recommendations/eligibility';
import type { Technique, TechniqueExclusionFlag, TechniqueTool } from './technique';

/**
 * Deterministic technique eligibility, mirroring product eligibility.
 *
 * The profile extends the product safety profile with the five technique
 * questions. Every "yes" and every "prefer not to say" counts as the cautious
 * answer, exactly as it does for products. Tools the person owns only affect
 * ordering, never eligibility: a technique that needs a tool the person does
 * not own is still shown, with a disclosed placeholder for getting the tool.
 */

export interface TechniqueSafetyProfile extends SafetyProfile {
  implantedDevice: boolean;
  /** A medication or a condition that makes skin more sensitive to light. */
  photosensitisingMedication: boolean;
  activeBreakouts: boolean;
  recentInjectables: boolean;
  fragileSkinOrBloodThinners: boolean;
  seizureOrHeartCondition: boolean;
  rosaceaOrBrokenCapillaries: boolean;
  /** A cold sore or other skin infection on the face right now. */
  activeInfection: boolean;
  sunburn: boolean;
  /**
   * The latest result suggested a professional look. The result carries no
   * zone, so every technique is paused until it has been reviewed.
   */
  professionalReviewRecommended: boolean;
}

export type TechniqueIneligibilityReason =
  | TechniqueExclusionFlag
  | 'professional_review_pending';

export interface TechniqueEligibilityResult {
  eligible: boolean;
  reasons: TechniqueIneligibilityReason[];
  matchedTags: SkinObservationTag[];
}

const FLAG_CHECKS: readonly [flag: TechniqueExclusionFlag, applies: (profile: TechniqueSafetyProfile) => boolean][] = [
  ['implanted_device', (profile) => profile.implantedDevice],
  ['photosensitising_medication', (profile) => profile.photosensitisingMedication],
  ['active_breakout_area', (profile) => profile.activeBreakouts],
  ['recent_injectables', (profile) => profile.recentInjectables],
  ['fragile_skin_or_blood_thinners', (profile) => profile.fragileSkinOrBloodThinners],
  ['seizure_or_heart_condition', (profile) => profile.seizureOrHeartCondition],
  ['rosacea_or_broken_capillaries', (profile) => profile.rosaceaOrBrokenCapillaries],
  ['active_infection_area', (profile) => profile.activeInfection],
  ['sunburn', (profile) => profile.sunburn],
  ['pregnancy_caution', (profile) => profile.pregnantOrTrying || profile.nursing],
  ['recent_procedure', (profile) => profile.recentProcedure],
  ['sensitive_skin_caution', (profile) => profile.sensitivityPreference === 'sensitive'],
];

export function evaluateTechniqueEligibility(
  technique: Technique,
  profile: TechniqueSafetyProfile,
  requestedTags: readonly SkinObservationTag[],
): TechniqueEligibilityResult {
  const flags = new Set(technique.exclusionFlags);
  const reasons: TechniqueIneligibilityReason[] = [];
  // A suggested professional look pauses every technique, whatever its flags.
  if (profile.professionalReviewRecommended) reasons.push('professional_review_pending');
  for (const [flag, applies] of FLAG_CHECKS) {
    if (flags.has(flag) && applies(profile)) reasons.push(flag);
  }
  const requested = new Set(requestedTags);
  const matchedTags = technique.observationTags.filter((tag) => requested.has(tag));
  return { eligible: reasons.length === 0, reasons, matchedTags };
}

export interface RankedTechnique {
  technique: Technique;
  eligibility: TechniqueEligibilityResult;
  toolOwned: boolean;
}

/**
 * Eligible techniques, those with an owned tool (or none needed) first, then
 * by goal matches, then by name. Nothing commercial is consulted.
 */
export function rankEligibleTechniques(
  techniques: readonly Technique[],
  profile: TechniqueSafetyProfile,
  requestedTags: readonly SkinObservationTag[],
  toolsOwned: readonly TechniqueTool[],
): RankedTechnique[] {
  const owned = new Set(toolsOwned);
  return techniques
    .map((technique) => ({
      technique,
      eligibility: evaluateTechniqueEligibility(technique, profile, requestedTags),
      toolOwned: technique.requiredTool === null || owned.has(technique.requiredTool),
    }))
    .filter((entry) => entry.eligibility.eligible)
    .sort((a, b) => (
      Number(b.toolOwned) - Number(a.toolOwned)
      || b.eligibility.matchedTags.length - a.eligibility.matchedTags.length
      || a.technique.name.localeCompare(b.technique.name)
    ));
}

export function techniqueReasonCopy(reason: TechniqueIneligibilityReason): string {
  switch (reason) {
    case 'implanted_device': return 'Not offered because of an implanted electrical device.';
    case 'photosensitising_medication': return 'Not offered while a medication or condition makes your skin more sensitive to light.';
    case 'active_breakout_area': return 'Not offered while breakouts are active in the area.';
    case 'recent_injectables': return 'Not offered within 4 weeks of injectables.';
    case 'fragile_skin_or_blood_thinners': return 'Not offered with fragile skin or blood thinners.';
    case 'seizure_or_heart_condition': return 'Not offered with a seizure history or a heart condition.';
    case 'rosacea_or_broken_capillaries': return 'Not offered with rosacea or visible broken capillaries.';
    case 'active_infection_area': return 'Not offered while a cold sore or skin infection is present.';
    case 'sunburn': return 'Not offered on sunburned skin.';
    case 'pregnancy_caution': return 'Paused during pregnancy, trying to conceive, or nursing.';
    case 'recent_procedure': return 'Paused for 4 weeks after a peel, laser, or other procedure.';
    case 'sensitive_skin_caution': return 'Paused for a sensitive-skin preference.';
    case 'professional_review_pending': return 'Paused because your latest check-in suggested a professional look. Techniques resume once that has been reviewed.';
  }
}
