import { describe, expect, test } from 'vitest';
import {
  assessConsumerVisibility,
  CATALOG_ENTRY_SCHEMA_VERSION,
  catalogEntrySchema,
  deriveBudgetTier,
  isConsumerVisible,
  MAX_PRICE_AGE_DAYS,
  MAX_REVIEW_AGE_DAYS,
  type CatalogEntry,
} from '../catalogEntry';

const NOW = '2026-08-06T12:00:00.000Z';

function validEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
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

describe('catalog entry schema', () => {
  test('accepts a fully reviewed real entry', () => {
    expect(isConsumerVisible(validEntry(), NOW)).toBe(true);
  });

  test('has no synthetic source value, so fictional products cannot enter', () => {
    expect(() => validEntry({ source: 'synthetic_prototype' as never })).toThrow();
  });

  test('rejects unknown fields outright', () => {
    expect(() =>
      catalogEntrySchema.parse({ ...validEntry(), commissionRate: 0.2 }),
    ).toThrow();
  });

  test('rejects fabricated or non-HTTPS commercial URLs', () => {
    expect(() =>
      validEntry({
        affiliate: {
          network: 'examplenet',
          url: 'http://insecure.example.com/x',
          disclosureText: 'vAIne may earn a commission from this link.',
        },
      }),
    ).toThrow();
    expect(() =>
      validEntry({
        affiliate: {
          network: 'examplenet',
          url: 'https://track.example.com/?id={CLICK_ID}',
          disclosureText: 'vAIne may earn a commission from this link.',
        },
      }),
    ).toThrow();
    expect(() => validEntry({ nonAffiliateFallbackUrl: 'https://a.example.com/%7Btemplate%7D' })).toThrow();
  });

  test('affiliate entries require disclosure text', () => {
    expect(() =>
      validEntry({
        affiliate: { network: 'examplenet', url: 'https://track.example.com/p/1', disclosureText: 'short' as never },
      }),
    ).toThrow();
  });

  test('unknown compatibility stays representable rather than guessed', () => {
    const entry = validEntry({
      sensitivityCaution: null,
      fragranceStatus: 'unknown',
      skinTypeCompatibility: ['unknown'],
      pregnancyNursingStatus: 'not_reviewed',
    });
    expect(entry.sensitivityCaution).toBeNull();
    expect(entry.pregnancyNursingStatus).toBe('not_reviewed');
  });
});

describe('budget tiers', () => {
  test.each([
    [1_500, 'affordable'],
    [2_500, 'affordable'],
    [2_501, 'moderate'],
    [5_000, 'moderate'],
    [7_500, 'premium'],
    [10_001, 'luxury'],
  ] as const)('%s cents derives %s', (cents, tier) => {
    expect(deriveBudgetTier(cents)).toBe(tier);
  });
});

describe('consumer visibility gate', () => {
  test('blocks pending or rejected evidence review', () => {
    expect(assessConsumerVisibility(validEntry({ evidenceReviewStatus: 'pending' }), NOW)).toContain(
      'evidence_not_approved',
    );
    expect(assessConsumerVisibility(validEntry({ evidenceReviewStatus: 'rejected' }), NOW)).toContain(
      'evidence_not_approved',
    );
  });

  test('blocks inactive, discontinued, and unknown-availability products', () => {
    expect(assessConsumerVisibility(validEntry({ active: false }), NOW)).toContain('inactive');
    expect(assessConsumerVisibility(validEntry({ availabilityStatus: 'discontinued' }), NOW)).toContain('not_available');
    expect(assessConsumerVisibility(validEntry({ availabilityStatus: 'unknown' }), NOW)).toContain('not_available');
    expect(assessConsumerVisibility(validEntry({ availabilityStatus: 'limited' }), NOW)).toEqual([]);
  });

  test('blocks stale reviews and stale prices at their exact boundaries', () => {
    const reviewStale = new Date(Date.parse(NOW) - (MAX_REVIEW_AGE_DAYS + 1) * 24 * 3600 * 1000).toISOString();
    expect(assessConsumerVisibility(validEntry({ lastReviewedAtIso: reviewStale }), NOW)).toContain('review_stale');

    const priceStale = new Date(Date.parse(NOW) - (MAX_PRICE_AGE_DAYS + 1) * 24 * 3600 * 1000).toISOString();
    expect(assessConsumerVisibility(validEntry({ priceVerifiedAtIso: priceStale }), NOW)).toContain('price_stale');

    expect(isConsumerVisible(validEntry(), NOW)).toBe(true);
  });

  test('an affiliate link without a non-affiliate fallback is not visible', () => {
    const entry = validEntry({
      affiliate: {
        network: 'examplenet',
        url: 'https://track.example.com/p/1',
        disclosureText: 'vAIne may earn a commission from this link.',
      },
      nonAffiliateFallbackUrl: null,
    });
    expect(assessConsumerVisibility(entry, NOW)).toContain('affiliate_without_fallback');
  });
});
