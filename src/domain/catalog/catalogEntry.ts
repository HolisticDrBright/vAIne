import { z } from 'zod';
import { SKIN_OBSERVATION_TAGS } from '../analysis/observationTaxonomy';

/**
 * Consumer catalog entry with full provenance — the shape a REAL product must
 * satisfy before it can ever replace "FICTIONAL SAMPLE" content.
 *
 * Rules encoded here:
 * - `source` has no synthetic/prototype value: fictional demonstration
 *   products structurally cannot enter this catalog.
 * - Unknown compatibility data stays unknown (`'unknown'` / `null`) — it is
 *   never guessed, and preference filters treat unknown conservatively.
 * - Prices are approximate and time-limited: a listed price carries a
 *   verification timestamp and goes stale after 90 days. A product with no
 *   verified price stays visible but is shown without one and is never
 *   assumed to fit a budget ceiling.
 * - Affiliate URLs are never fabricated: they must be clean HTTPS with no
 *   template placeholders, and every affiliate link requires a non-affiliate
 *   fallback URL and disclosure.
 * - Commercial fields can never improve ranking — selection logic receives
 *   eligibility fields only; links attach after selection (existing
 *   commercialAttachment boundary).
 */

export const CATALOG_ENTRY_SCHEMA_VERSION = 'catalog_entry_v1';

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), 'affiliate and fallback URLs must be HTTPS')
  .refine(
    (value) => !/[{}\s]|%7B|%7D/i.test(value),
    'URLs must be concrete — no template placeholders or whitespace',
  );

const skinTypeSchema = z.enum(['dry', 'oily', 'combination', 'sensitive', 'balanced', 'unknown']);

const isoDateSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'must be an ISO timestamp');

/**
 * Editorial context carried from the source product database. Displayed to
 * the person as-is (usage timing, cautions); never used for ranking.
 */
export const catalogSourceNotesSchema = z.object({
  sourceFile: z.string().min(1).nullable(),
  sourceRow: z.number().int().positive().nullable(),
  priority: z.number().int().positive().nullable(),
  verificationLevel: z.string().nullable(),
  findings: z.string().nullable(),
  bestFor: z.string().nullable(),
  whenToUse: z.string().nullable(),
  caution: z.string().nullable(),
  recommendationLogic: z.string().nullable(),
  notes: z.string().nullable(),
}).strict();

export type CatalogProductKind = 'single' | 'bundle' | 'travel_size' | 'body' | 'device' | 'supplement';

export const catalogEntrySchema = z
  .object({
    schemaVersion: z.literal(CATALOG_ENTRY_SCHEMA_VERSION),
    productId: z.string().min(1),
    brand: z.string().min(1),
    productName: z.string().min(1),
    category: z.string().min(1),
    /** Single face-care products join daily routines; everything else is listed only. */
    productKind: z.enum(['single', 'bundle', 'travel_size', 'body', 'device', 'supplement']).default('single'),
    /** null = listed in the catalog but never placed in a routine step. */
    routineSlot: z.enum(['cleanse', 'support', 'hydrate', 'protect', 'weekly']).nullable(),
    keyIngredients: z.array(z.string().min(1)).min(1),
    skinConcernTags: z.array(z.enum(SKIN_OBSERVATION_TAGS)),
    skinTypeCompatibility: z.array(skinTypeSchema).min(1),
    /** null = not reviewed; never inferred. */
    sensitivityCaution: z.boolean().nullable(),
    pregnancyNursingStatus: z.enum(['reviewed_avoid', 'reviewed_acceptable', 'not_reviewed']),
    allergyCautions: z.array(z.string().min(1)),
    fragranceStatus: z.enum(['fragrance_free', 'contains_fragrance', 'unknown']),
    crueltyFreeStatus: z.enum(['verified', 'not_verified', 'unknown']),
    veganStatus: z.enum(['verified', 'not_verified', 'unknown']),
    /** null = price not yet verified; the product is then shown without a price and never assumed to fit a budget ceiling. */
    approximatePriceCents: z.number().int().positive().nullable(),
    currencyCode: z.string().length(3),
    priceVerifiedAtIso: isoDateSchema.nullable(),
    affiliate: z
      .object({
        network: z.string().min(1),
        url: httpsUrlSchema,
        disclosureText: z.string().min(10),
      })
      .nullable(),
    nonAffiliateFallbackUrl: httpsUrlSchema.nullable(),
    market: z.string().min(2),
    availabilityStatus: z.enum(['available', 'limited', 'discontinued', 'unknown']),
    source: z.enum(['reviewed_research', 'editorial']),
    lastReviewedAtIso: isoDateSchema,
    evidenceReviewStatus: z.enum(['approved', 'pending', 'rejected']),
    active: z.boolean(),
    sourceNotes: catalogSourceNotesSchema.nullable().default(null),
  })
  .strict()
  .refine((entry) => entry.approximatePriceCents === null || entry.priceVerifiedAtIso !== null, {
    message: 'a listed price needs a verification timestamp',
    path: ['priceVerifiedAtIso'],
  });

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

export type BudgetTier = 'affordable' | 'moderate' | 'premium' | 'luxury';

/**
 * Derived, never stored: tiers align with the user's per-product ceilings
 * (Up to $25 / $50 / $100; "flexible" is a user range, not a product trait).
 * A higher tier is never treated as better.
 */
export function deriveBudgetTier(approximatePriceCents: number | null): BudgetTier | null {
  if (approximatePriceCents === null) return null;
  if (approximatePriceCents <= 2_500) return 'affordable';
  if (approximatePriceCents <= 5_000) return 'moderate';
  if (approximatePriceCents <= 10_000) return 'premium';
  return 'luxury';
}

/** Reviews older than this cannot back a visible product. */
export const MAX_REVIEW_AGE_DAYS = 180;
/** Approximate prices older than this stop being shown. */
export const MAX_PRICE_AGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type VisibilityBlockReason =
  | 'inactive'
  | 'evidence_not_approved'
  | 'review_stale'
  | 'price_stale'
  | 'not_available'
  | 'affiliate_without_fallback';

/**
 * Runtime visibility gate over an already schema-valid entry. Blocking is
 * always the safe direction: a blocked product falls back to category-level
 * guidance, never to a guess or an out-of-date claim.
 */
export function assessConsumerVisibility(entry: CatalogEntry, nowIso: string): VisibilityBlockReason[] {
  const reasons: VisibilityBlockReason[] = [];
  const now = Date.parse(nowIso);

  if (!entry.active) reasons.push('inactive');
  if (entry.evidenceReviewStatus !== 'approved') reasons.push('evidence_not_approved');
  if (entry.availabilityStatus === 'discontinued' || entry.availabilityStatus === 'unknown') {
    reasons.push('not_available');
  }
  if (!Number.isFinite(now) || now - Date.parse(entry.lastReviewedAtIso) > MAX_REVIEW_AGE_DAYS * DAY_MS) {
    reasons.push('review_stale');
  }
  if (entry.approximatePriceCents !== null && entry.priceVerifiedAtIso !== null
    && (!Number.isFinite(now) || now - Date.parse(entry.priceVerifiedAtIso) > MAX_PRICE_AGE_DAYS * DAY_MS)) {
    reasons.push('price_stale');
  }
  if (entry.affiliate && !entry.nonAffiliateFallbackUrl) {
    reasons.push('affiliate_without_fallback');
  }

  return reasons;
}

export function isConsumerVisible(entry: CatalogEntry, nowIso: string): boolean {
  return assessConsumerVisibility(entry, nowIso).length === 0;
}
