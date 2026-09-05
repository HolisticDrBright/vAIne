import { describe, expect, test } from 'vitest';
import { evaluateProductEligibility, type SafetyProfile } from '../../recommendations/eligibility';
import { convertCatalogEntries, deriveActiveFamilies, toProductCandidate } from '../catalogAdapter';
import { CATALOG_ENTRY_SCHEMA_VERSION, catalogEntrySchema, type CatalogEntry } from '../catalogEntry';

const NOW = '2026-08-06T12:00:00.000Z';

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return catalogEntrySchema.parse({
    schemaVersion: CATALOG_ENTRY_SCHEMA_VERSION,
    productId: 'prod-001',
    brand: 'Example Brand',
    productName: 'Daily Gentle Cleanser',
    category: 'cleanser',
    routineSlot: 'cleanse',
    keyIngredients: ['glycerin', 'niacinamide'],
    skinConcernTags: ['appearance.hydration_look_low'],
    skinTypeCompatibility: ['dry', 'balanced'],
    sensitivityCaution: false,
    pregnancyNursingStatus: 'reviewed_acceptable',
    allergyCautions: [],
    fragranceStatus: 'fragrance_free',
    crueltyFreeStatus: 'unknown',
    veganStatus: 'unknown',
    approximatePriceCents: 1_899,
    currencyCode: 'USD',
    priceVerifiedAtIso: '2026-07-20T00:00:00.000Z',
    affiliate: null,
    nonAffiliateFallbackUrl: 'https://example.com/products/daily-gentle-cleanser',
    market: 'US',
    availabilityStatus: 'available',
    source: 'reviewed_research',
    lastReviewedAtIso: '2026-07-01T00:00:00.000Z',
    evidenceReviewStatus: 'approved',
    active: true,
    ...overrides,
  });
}

const candidateOf = (item: CatalogEntry) => toProductCandidate(item)!;

const profile: SafetyProfile = {
  pregnantOrTrying: false,
  nursing: false,
  recentProcedure: false,
  sensitivityPreference: 'standard',
  avoidFragrance: false,
  avoidEssentialOils: false,
  allergies: [],
  currentActiveFamilies: [],
};

describe('catalog adapter', () => {
  test('converts a reviewed entry into an eligible candidate without commercial fields', () => {
    const candidate = candidateOf(entry());
    expect(candidate).toMatchObject({
      id: 'prod-001',
      brandName: 'Example Brand',
      catalogSource: 'reviewed_research',
      listPriceCents: 1_899,
      exclusionFlags: [],
      activeFamilies: ['niacinamide'],
    });
    expect(JSON.stringify(candidate)).not.toMatch(/affiliate|https:|fallback/i);
    expect(evaluateProductEligibility(candidate, profile, ['appearance.hydration_look_low']).eligible).toBe(true);
  });

  test('maps unknown safety facts to cautious exclusions', () => {
    const candidate = candidateOf(entry({
      pregnancyNursingStatus: 'not_reviewed',
      sensitivityCaution: null,
      fragranceStatus: 'unknown',
    }));
    expect(candidate.exclusionFlags).toEqual(expect.arrayContaining(['pregnancy_exclude', 'nursing_exclude', 'sensitivity_exclude', 'contains_fragrance']));

    const pregnant = evaluateProductEligibility(candidate, { ...profile, pregnantOrTrying: true }, ['appearance.hydration_look_low']);
    expect(pregnant.reasons).toContain('pregnancy_exclusion');
    const fragranceAverse = evaluateProductEligibility(candidate, { ...profile, avoidFragrance: true }, ['appearance.hydration_look_low']);
    expect(fragranceAverse.reasons).toContain('sensitivity_exclusion');
  });

  test('lets a named allergen exclude a product through allergy cautions', () => {
    const candidate = candidateOf(entry({ allergyCautions: ['Lanolin'] }));
    const result = evaluateProductEligibility(candidate, { ...profile, allergies: ['lanolin'] }, ['appearance.hydration_look_low']);
    expect(result.reasons).toContain('allergy_match');
  });

  test('derives active families from a reviewed vocabulary only', () => {
    expect(deriveActiveFamilies({ keyIngredients: ['Retinol 0.3%', 'Glycolic Acid', 'squalane'] })).toEqual(['retinoid', 'exfoliating-acid']);
    expect(deriveActiveFamilies({ keyIngredients: ['shea butter'] })).toEqual([]);
  });

  test('reports invalid and blocked rows instead of dropping them silently', () => {
    const conversion = convertCatalogEntries([
      entry(),
      entry({ productId: 'prod-002', active: false }),
      { productId: 'broken' },
    ], NOW);
    expect(conversion.candidates.map((candidate) => candidate.id)).toEqual(['prod-001']);
    expect(conversion.blocked[0]).toMatchObject({ reasons: ['inactive'] });
    expect(conversion.invalid[0]?.index).toBe(2);
  });
});

describe('catalog adapter: unpriced and non-routine entries', () => {
  test('keeps an unpriced product visible and eligible without a budget claim', () => {
    const candidate = candidateOf(entry({ approximatePriceCents: null, priceVerifiedAtIso: null }));
    expect(candidate?.listPriceCents).toBeNull();
    expect(convertCatalogEntries([entry({ approximatePriceCents: null, priceVerifiedAtIso: null })], NOW).candidates).toHaveLength(1);
  });

  test('a listed price without a verification date is rejected', () => {
    expect(() => entry({ priceVerifiedAtIso: null })).toThrow();
  });

  test('routes slot-less products outside the routine instead of dropping them', () => {
    const conversion = convertCatalogEntries([entry({ productId: 'bundle-1', productKind: 'bundle', routineSlot: null })], NOW);
    expect(conversion.candidates).toHaveLength(0);
    expect(conversion.outsideRoutine.map((item) => item.productId)).toEqual(['bundle-1']);
  });
});
