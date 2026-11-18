import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { VisibilityBlockReason } from '../catalog/catalogEntry';
import {
  evaluateProductEligibility,
  type IneligibilityReason,
  type ProductCandidate,
  type SafetyProfile,
} from './eligibility';

/**
 * The governance layer, made visible.
 *
 * Everything here is already enforced in code. This module only puts it in
 * words and numbers a person can read: how a product is picked, why a
 * listed product was left out of their routine, and why a product on the
 * list is held back from everyone. Nothing in it changes a decision.
 */

export interface HowWePickStep {
  title: string;
  body: string;
}

export const HOW_WE_PICK_STEPS: readonly HowWePickStep[] = [
  {
    title: '1. Your safety answers come first',
    body: 'Pregnancy or nursing, recent procedures, named allergens, a sensitive-skin preference, fragrance, and actives you already use remove products before anything else is considered. A private answer counts as the cautious one.',
  },
  {
    title: '2. Then fit to this check-in',
    body: 'A product is offered for a step only if it is recorded as supporting one of the visible appearance goals in your latest check-in. Products with no goal in common are shown on the list but not placed in the routine.',
  },
  {
    title: '3. Then evidence for the recorded ingredients',
    body: 'Among products that fit, those whose recorded ingredients have stronger human evidence for your goals rank higher. This scores ingredients, not the finished product, and it says nothing about how a product will work on you.',
  },
  {
    title: '4. Then your budget',
    body: 'Products above the per-product price you chose are removed. Among equal matches the lower list price wins; with no price limit a higher price breaks only an otherwise equal tie. Price never improves a match.',
  },
  {
    title: '5. Your shopping list and routine size shape the final plan',
    body: 'Types you said you are shopping for come first when a role is filled, and the plan stops at the number of products you said you would realistically use.',
  },
  {
    title: 'What never influences the pick',
    body: 'Affiliate relationships, commissions, discounts, and merchant placement are not available to the matching code. A purchase link can only be attached after the product has already been chosen, and only when it has been reviewed and disclosed.',
  },
  {
    title: 'What the AI does and does not do',
    body: 'The analysis describes visible skin appearance in a fixed vocabulary and nothing more. It never sees the product list, never names a product, and never recommends a technique, procedure, prescription, or supplement. Matching is done by these rules on this device.',
  },
  {
    title: 'Research preview and held-back products',
    body: 'During the beta, products with an official product page that have not yet completed catalog approval are offered as a labelled research preview; that includes sunscreens still under review, each shown with a reminder to check the Drug Facts panel on the pack. Products with a reviewer’s blocker, out-of-scope items, stale reviews, and missing products are held back from everyone, with the reason shown. A price verified more than 90 days ago is withheld; the product stays listed without it.'
  },
  {
    title: 'Techniques follow the same rules',
    body: 'At-home techniques are matched from the same safety answers plus the technique questions (implanted device, light sensitivity, breakouts, injectables within 4 weeks, fragile skin or blood thinners, seizure history or heart condition, rosacea or broken capillaries, and a cold sore, infection, or sunburn right now) and the tools you own. A suggested professional look pauses every technique. Each entry shows who reviewed it; unreviewed entries are labelled as placeholders. Tools you do not own show only a disclosed placeholder, never a live link.',
  },
];

export const ineligibilityReasonCopy: Record<IneligibilityReason, string> = {
  not_verified: 'Not yet verified',
  catalog_not_approved: 'Catalog review incomplete',
  prescription_only: 'Prescription only',
  pregnancy_exclusion: 'Excluded for pregnancy or trying to conceive',
  nursing_exclusion: 'Excluded while nursing',
  recent_procedure_exclusion: 'Excluded after a recent procedure',
  sensitivity_exclusion: 'Excluded by your sensitivity or fragrance preference',
  allergy_match: 'Contains an ingredient you avoid',
  duplicate_active_family: 'Same active family you already use',
};

export const visibilityReasonCopy: Record<VisibilityBlockReason, string> = {
  inactive: 'Marked inactive on the product list',
  blocked_by_review: 'A reviewer recorded a blocker',
  out_of_scope: 'Outside the scope of daily face care',
  evidence_not_approved: 'Evidence review not yet approved',
  review_stale: 'Review older than the allowed window',
  not_available: 'Availability unknown or discontinued',
  affiliate_without_fallback: 'Affiliate link without a plain product page',
};

export interface ExclusionSummary {
  considered: number;
  eligible: number;
  /** Eligible, goal-matched, and within budget: what the routine could use. */
  usable: number;
  noGoalMatch: number;
  overBudget: number;
  /** Count per safety reason; a product may appear under more than one. */
  bySafetyReason: Partial<Record<IneligibilityReason, number>>;
  safetyExcluded: number;
}

/** Counts why listed products did not make it into a routine, for the "why not here" card. */
export function summarizeExclusions(
  catalog: readonly ProductCandidate[],
  profile: SafetyProfile,
  requestedTags: readonly SkinObservationTag[],
  maxPriceCents: number | null,
): ExclusionSummary {
  const bySafetyReason: Partial<Record<IneligibilityReason, number>> = {};
  let eligible = 0;
  let usable = 0;
  let noGoalMatch = 0;
  let overBudget = 0;
  let safetyExcluded = 0;

  for (const product of catalog) {
    const result = evaluateProductEligibility(product, profile, requestedTags);
    if (!result.eligible) {
      safetyExcluded += 1;
      for (const reason of result.reasons) bySafetyReason[reason] = (bySafetyReason[reason] ?? 0) + 1;
      continue;
    }
    eligible += 1;
    if (!result.matchedTags.length) { noGoalMatch += 1; continue; }
    const priced = product.listPriceCents !== null && product.currencyCode.toUpperCase() === 'USD';
    if (maxPriceCents !== null && (!priced || product.listPriceCents! > maxPriceCents)) { overBudget += 1; continue; }
    usable += 1;
  }

  return { considered: catalog.length, eligible, usable, noGoalMatch, overBudget, bySafetyReason, safetyExcluded };
}

/** One sentence per non-zero bucket, in plain words. */
export function describeExclusions(summary: ExclusionSummary): string[] {
  const lines: string[] = [];
  if (summary.safetyExcluded) {
    const reasons = (Object.entries(summary.bySafetyReason) as [IneligibilityReason, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => `${ineligibilityReasonCopy[reason].toLowerCase()} (${count})`);
    lines.push(`${summary.safetyExcluded} left out by your safety answers: ${reasons.join(', ')}.`);
  }
  if (summary.noGoalMatch) lines.push(`${summary.noGoalMatch} do not address a goal from this check-in.`);
  if (summary.overBudget) lines.push(`${summary.overBudget} are above your per-product budget or priced in another currency.`);
  if (!lines.length) lines.push('Every listed product passed your safety answers, fits a goal, and is within budget.');
  return lines;
}
