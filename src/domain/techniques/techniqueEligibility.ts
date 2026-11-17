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
  photosensitisingMedication: boolean;
  activeBreakouts: boolean;
  recentInjectables: boolean;
  fragileSkinOrBloodThinners: boolean;
}

export type TechniqueIneligibilityReason =
  | 'implanted_device'
  | 'photosensitising_medication'
  | 'active_breakout_area'
  | 'recent_injectables'
  | 'fragile_skin_or_blood_thinners'
  | 'pregnancy_caution'
  | 'recent_procedure'
  | 'sensitive_skin_caution';

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
    case 'photosensitising_medication': return 'Not offered while a light-sensitising medication is in use.';
    case 'active_breakout_area': return 'Not offered while breakouts are active in the area.';
    case 'recent_injectables': return 'Not offered in the weeks after injectables.';
    case 'fragile_skin_or_blood_thinners': return 'Not offered with fragile skin or blood thinners.';
    case 'pregnancy_caution': return 'Paused during pregnancy, trying to conceive, or nursing.';
    case 'recent_procedure': return 'Paused after a recent procedure.';
    case 'sensitive_skin_caution': return 'Paused for a sensitive-skin preference.';
  }
}
