import type { ExclusionFlag, ProductCandidate } from '../recommendations/eligibility';
import { assessConsumerVisibility, catalogEntrySchema, type CatalogEntry } from './catalogEntry';

/**
 * Bridges the reviewed consumer catalog (`CatalogEntry`, the shape a real
 * product must satisfy) into the deterministic eligibility engine
 * (`ProductCandidate`). The conversion is conservative in every direction:
 *
 * - Only entries that pass the runtime visibility gate are converted; blocked
 *   entries never reach ranking, and the block reasons are reported so the
 *   catalog screen can explain why a listed product is not offered.
 * - Unknown safety facts map to the cautious exclusion flag. A product whose
 *   pregnancy status was not reviewed is excluded for anyone who may be
 *   pregnant or nursing; an unreviewed sensitivity caution counts as a caution.
 * - Allergy cautions and key ingredients both feed the ingredient list so a
 *   named allergen excludes the product whichever field it was recorded in.
 * - Commercial fields (affiliate, fallback URL) are dropped here. They can
 *   only re-attach after ranking, through the commercial-attachment boundary.
 */

export interface CatalogConversion {
  candidates: ProductCandidate[];
  /** Visible entries with no routine slot (bundles, travel sizes, body, devices, supplements). */
  outsideRoutine: CatalogEntry[];
  blocked: { entry: CatalogEntry; reasons: ReturnType<typeof assessConsumerVisibility> }[];
  invalid: { index: number; message: string }[];
}

export function toProductCandidate(entry: CatalogEntry): ProductCandidate | null {
  if (entry.routineSlot === null) return null;
  const flags = new Set<ExclusionFlag>();
  if (entry.pregnancyNursingStatus !== 'reviewed_acceptable') {
    flags.add('pregnancy_exclude');
    flags.add('nursing_exclude');
  }
  if (entry.sensitivityCaution !== false) flags.add('sensitivity_exclude');
  if (entry.fragranceStatus !== 'fragrance_free') flags.add('contains_fragrance');

  return {
    id: entry.productId,
    brandName: entry.brand,
    productName: entry.productName,
    verificationStatus: 'verified',
    catalogReviewState: 'catalog_approved',
    catalogSource: entry.source,
    routineSlot: entry.routineSlot,
    listPriceCents: entry.approximatePriceCents,
    currencyCode: entry.currencyCode,
    priceVerifiedAtIso: entry.priceVerifiedAtIso,
    whenToUse: entry.sourceNotes?.whenToUse ?? null,
    cautionNote: entry.sourceNotes?.caution ?? null,
    category: entry.category,
    observationTags: entry.skinConcernTags,
    activeFamilies: deriveActiveFamilies(entry),
    ingredients: [...new Set([...entry.keyIngredients, ...entry.allergyCautions])],
    exclusionFlags: [...flags],
  };
}

/**
 * Active families are derived from key ingredients using a small, reviewed
 * vocabulary so "already using a retinoid" can exclude another retinoid.
 * Ingredients outside the vocabulary contribute no family (never a guess).
 */
const ACTIVE_FAMILY_KEYWORDS: readonly [family: string, pattern: RegExp][] = [
  ['retinoid', /\bretin(ol|al|aldehyde|oate|yl)\b|\bretinoid\b|\btretinoin\b|\badapalene\b|\bbakuchiol\b/i],
  ['exfoliating-acid', /\b(glycolic|lactic|mandelic|salicylic|azelaic|malic|tartaric|citric)\s+acid\b|\b[ab]ha\b|\bpha\b|\bgluconolactone\b/i],
  ['vitamin-c', /\bascorb(ic|yl)\b|\bvitamin\s*c\b|\btetrahexyldecyl\b/i],
  ['niacinamide', /\bniacinamide\b|\bnicotinamide\b/i],
  ['peptide', /\bpeptide\b|\bpalmitoyl\b|\bmatrixyl\b|\bargireline\b/i],
  ['uv-filter', /\bzinc oxide\b|\btitanium dioxide\b|\bavobenzone\b|\boctocrylene\b|\bhomosalate\b|\boctisalate\b|\boctinoxate\b|\bmexoryl\b|\btinosorb\b|\bspf\b/i],
  ['hydroquinone', /\bhydroquinone\b/i],
];

export function deriveActiveFamilies(entry: Pick<CatalogEntry, 'keyIngredients'>): string[] {
  const families = new Set<string>();
  for (const ingredient of entry.keyIngredients) {
    for (const [family, pattern] of ACTIVE_FAMILY_KEYWORDS) {
      if (pattern.test(ingredient)) families.add(family);
    }
  }
  return [...families];
}

/**
 * Validates raw catalog rows (for example a JSON list) and converts the
 * consumer-visible ones. Invalid rows are reported, never silently dropped
 * or partially trusted.
 */
export function convertCatalogEntries(rows: readonly unknown[], nowIso: string): CatalogConversion {
  const conversion: CatalogConversion = { candidates: [], outsideRoutine: [], blocked: [], invalid: [] };

  rows.forEach((row, index) => {
    const parsed = catalogEntrySchema.safeParse(row);
    if (!parsed.success) {
      conversion.invalid.push({ index, message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') });
      return;
    }
    const reasons = assessConsumerVisibility(parsed.data, nowIso);
    if (reasons.length) {
      conversion.blocked.push({ entry: parsed.data, reasons });
      return;
    }
    const candidate = toProductCandidate(parsed.data);
    if (candidate) conversion.candidates.push(candidate);
    else conversion.outsideRoutine.push(parsed.data);
  });

  return conversion;
}
