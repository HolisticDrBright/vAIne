import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { CatalogReviewState, CatalogSource } from '../catalog/types';
import { assessProductEvidence, type IngredientEvidenceGrade } from './evidenceRanking';

export type VerificationStatus = 'candidate' | 'verified' | 'official';
export type RoutineSlot = 'cleanse' | 'support' | 'hydrate' | 'protect' | 'weekly';

export type ExclusionFlag =
  | 'pregnancy_exclude'
  | 'nursing_exclude'
  | 'retinoid'
  | 'hydroquinone'
  | 'salicylic_acid_over_2_percent'
  | 'recent_procedure_exclude'
  | 'sensitivity_exclude'
  | 'contains_fragrance'
  | 'contains_essential_oils'
  | 'prescription_only';

export interface ProductCandidate {
  id: string;
  brandName: string;
  productName: string;
  verificationStatus: VerificationStatus;
  catalogReviewState: CatalogReviewState;
  catalogSource: CatalogSource;
  routineSlot: RoutineSlot;
  /** null = price not yet verified. Never assumed to fit a budget ceiling. */
  listPriceCents: number | null;
  currencyCode: string;
  priceVerifiedAtIso: string | null;
  /** Governance state of the source row; 'research_only' shows as a research preview. Never ranked on. */
  catalogState?: 'research_only' | 'catalog_approved' | 'blocked' | 'out_of_scope';
  /** Optional editorial context shown with the product; never ranked on. */
  whenToUse?: string | null;
  cautionNote?: string | null;
  /** Reviewer's capture note (sizes, list quality, delisting) shown as-is. */
  note?: string | null;
  category?: string | null;
  observationTags: readonly SkinObservationTag[];
  activeFamilies: readonly string[];
  ingredients: readonly string[];
  exclusionFlags: readonly ExclusionFlag[];
}

export interface SafetyProfile {
  pregnantOrTrying: boolean;
  nursing: boolean;
  recentProcedure: boolean;
  sensitivityPreference: 'standard' | 'sensitive';
  avoidFragrance: boolean;
  avoidEssentialOils: boolean;
  allergies: readonly string[];
  currentActiveFamilies: readonly string[];
}

export type IneligibilityReason =
  | 'not_verified'
  | 'catalog_not_approved'
  | 'prescription_only'
  | 'pregnancy_exclusion'
  | 'nursing_exclusion'
  | 'recent_procedure_exclusion'
  | 'sensitivity_exclusion'
  | 'allergy_match'
  | 'duplicate_active_family';

export interface EligibilityResult {
  eligible: boolean;
  reasons: IneligibilityReason[];
  matchedTags: SkinObservationTag[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * True when any name on the left appears in any name on the right as a whole
 * word or word sequence: "lavender" matches "Lavandula (Lavender) Oil" and
 * "lavender extract", while "rose" does not match "rosemary". Comparison is
 * case- and punctuation-insensitive.
 */
export function overlaps(left: readonly string[], right: readonly string[]): boolean {
  const rightWords = right.map((value) => ` ${normalize(value)} `).filter((value) => value.trim().length > 0);
  return left.some((value) => {
    const needle = normalize(value);
    if (!needle) return false;
    return rightWords.some((haystack) => haystack.includes(` ${needle} `));
  });
}

export function evaluateProductEligibility(
  product: ProductCandidate,
  profile: SafetyProfile,
  requestedTags: readonly SkinObservationTag[],
): EligibilityResult {
  const reasons: IneligibilityReason[] = [];
  const flags = new Set(product.exclusionFlags);

  if (!['verified', 'official'].includes(product.verificationStatus)) reasons.push('not_verified');
  if (product.catalogReviewState !== 'catalog_approved') reasons.push('catalog_not_approved');
  if (flags.has('prescription_only')) reasons.push('prescription_only');

  if (
    profile.pregnantOrTrying &&
    ['pregnancy_exclude', 'retinoid', 'hydroquinone', 'salicylic_acid_over_2_percent'].some((flag) => flags.has(flag as ExclusionFlag))
  ) {
    reasons.push('pregnancy_exclusion');
  }

  if (profile.nursing && flags.has('nursing_exclude')) reasons.push('nursing_exclusion');
  if (profile.recentProcedure && flags.has('recent_procedure_exclude')) reasons.push('recent_procedure_exclusion');

  const sensitivityConflict =
    (profile.sensitivityPreference === 'sensitive' && flags.has('sensitivity_exclude')) ||
    (profile.avoidFragrance && flags.has('contains_fragrance')) ||
    (profile.avoidEssentialOils && flags.has('contains_essential_oils'));
  if (sensitivityConflict) reasons.push('sensitivity_exclusion');

  if (overlaps(profile.allergies, product.ingredients)) reasons.push('allergy_match');
  if (overlaps(profile.currentActiveFamilies, product.activeFamilies)) reasons.push('duplicate_active_family');

  const requested = new Set(requestedTags);
  const matchedTags = product.observationTags.filter((tag) => requested.has(tag));

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], matchedTags };
}

function comparePrice(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function comparePriceDescending(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

export interface RankedEligibleProduct {
  product: ProductCandidate;
  eligibility: EligibilityResult;
  rankScore: number;
  effectivenessScore: number;
  evidenceGrade: IngredientEvidenceGrade;
}

/**
 * Ranks eligible products using reviewed match characteristics first. A user's
 * list-price ceiling is a hard filter for products with a verified price, and
 * lower price is only a tie-breaker. A product with no verified price is not
 * excluded by the ceiling (its price is unknown, not over) but ranks after an
 * equally matched product whose price is known.
 * Commercial links, commission, discounts, and availability are absent.
 */
export function rankEligibleProducts(
  products: readonly ProductCandidate[],
  profile: SafetyProfile,
  requestedTags: readonly SkinObservationTag[],
  maxPriceCents: number | null = null,
  priceTieBreaker: 'lower' | 'higher' = 'lower',
): RankedEligibleProduct[] {
  return products
    .map((product) => {
      const eligibility = evaluateProductEligibility(product, profile, requestedTags);
      const evidence = assessProductEvidence(product, eligibility.matchedTags);
      const verificationBonus = product.verificationStatus === 'official' ? 1 : 0;
      const rankScore = evidence.effectivenessScore * Math.max(1, eligibility.matchedTags.length) * 100
        + eligibility.matchedTags.length * 10
        + verificationBonus;
      return {
        product,
        eligibility,
        rankScore,
        effectivenessScore: evidence.effectivenessScore,
        evidenceGrade: evidence.grade,
      };
    })
    .filter((entry) => (
      entry.eligibility.eligible &&
      entry.eligibility.matchedTags.length > 0 &&
      (maxPriceCents === null || entry.product.listPriceCents === null || entry.product.listPriceCents <= maxPriceCents)
    ))
    .sort((a, b) => (
      b.rankScore - a.rankScore ||
      (priceTieBreaker === 'higher'
        ? comparePriceDescending(a.product.listPriceCents, b.product.listPriceCents)
        : comparePrice(a.product.listPriceCents, b.product.listPriceCents)) ||
      a.product.productName.localeCompare(b.product.productName)
    ));
}
