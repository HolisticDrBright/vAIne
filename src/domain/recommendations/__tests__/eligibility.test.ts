import { describe, expect, test } from 'vitest';
import { attachCommercialLinks } from '../commercialAttachment';
import {
  evaluateProductEligibility,
  rankEligibleProducts,
  type ProductCandidate,
  type SafetyProfile,
} from '../eligibility';

const baseProfile: SafetyProfile = {
  pregnantOrTrying: false,
  nursing: false,
  recentProcedure: false,
  sensitivityPreference: 'standard',
  avoidFragrance: false,
  avoidEssentialOils: false,
  allergies: [],
  currentActiveFamilies: [],
};

const baseProduct: ProductCandidate = {
  id: 'synthetic-1',
  brandName: 'Synthetic Lab',
  productName: 'Barrier Example',
  verificationStatus: 'verified',
  catalogReviewState: 'catalog_approved',
  catalogSource: 'synthetic_prototype',
  routineSlot: 'hydrate',
  listPriceCents: 3200,
  currencyCode: 'USD',
  priceVerifiedAtIso: '2026-08-05T12:00:00.000Z',
  observationTags: ['appearance.hydration_look_low'],
  activeFamilies: ['ceramide-family'],
  ingredients: ['water', 'synthetic ceramide'],
  exclusionFlags: [],
};

describe('product eligibility', () => {
  test('rejects catalog candidates before ranking', () => {
    const result = evaluateProductEligibility(
      { ...baseProduct, verificationStatus: 'candidate' },
      baseProfile,
      ['appearance.hydration_look_low'],
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('not_verified');
  });

  test('applies pregnancy exclusion before recommendation copy', () => {
    const result = evaluateProductEligibility(
      { ...baseProduct, exclusionFlags: ['retinoid'] },
      { ...baseProfile, pregnantOrTrying: true },
      ['appearance.hydration_look_low'],
    );
    expect(result.reasons).toContain('pregnancy_exclusion');
  });

  test('rejects products that have not completed catalog review', () => {
    const result = evaluateProductEligibility(
      { ...baseProduct, catalogReviewState: 'safety_reviewed' },
      baseProfile,
      ['appearance.hydration_look_low'],
    );
    expect(result.reasons).toContain('catalog_not_approved');
  });

  test('detects allergy and duplicate-active conflicts', () => {
    const result = evaluateProductEligibility(
      baseProduct,
      { ...baseProfile, allergies: ['synthetic ceramide'], currentActiveFamilies: ['Ceramide Family'] },
      ['appearance.hydration_look_low'],
    );
    expect(result.reasons).toEqual(expect.arrayContaining(['allergy_match', 'duplicate_active_family']));
  });

  test('treats an explicit fragrance preference as a hard filter', () => {
    const result = evaluateProductEligibility(
      { ...baseProduct, exclusionFlags: ['contains_fragrance'] },
      { ...baseProfile, avoidFragrance: true },
      ['appearance.hydration_look_low'],
    );
    expect(result.reasons).toContain('sensitivity_exclusion');
  });

  test('ranks using tag match and verification only', () => {
    const official = { ...baseProduct, id: 'official', productName: 'Official Example', verificationStatus: 'official' as const };
    const verified = { ...baseProduct, id: 'verified', productName: 'Verified Example' };
    const ranked = rankEligibleProducts([verified, official], baseProfile, ['appearance.hydration_look_low']);
    expect(ranked.map((entry) => entry.product.id)).toEqual(['official', 'verified']);
  });

  test('filters above-budget products and uses lower price only as a tie-breaker', () => {
    const value = { ...baseProduct, id: 'value', productName: 'Value Example', listPriceCents: 1800 };
    const expensiveEqualMatch = { ...baseProduct, id: 'expensive', productName: 'Expensive Example', listPriceCents: 7800 };
    const strongerMatch = {
      ...baseProduct,
      id: 'stronger',
      productName: 'Stronger Match Example',
      listPriceCents: 4200,
      observationTags: ['appearance.hydration_look_low', 'appearance.texture_irregular'] as const,
    };
    const requested = ['appearance.hydration_look_low', 'appearance.texture_irregular'] as const;

    expect(rankEligibleProducts([expensiveEqualMatch, value], baseProfile, requested, null)[0].product.id).toBe('value');
    expect(rankEligibleProducts([value, strongerMatch], baseProfile, requested, 2500)[0].product.id).toBe('value');
    expect(rankEligibleProducts([value, strongerMatch], baseProfile, requested, 5000)[0].product.id).toBe('stronger');
  });

  test('attaches commercial links after ranking without changing order', () => {
    const products = [
      { id: 'first', name: 'First' },
      { id: 'second', name: 'Second' },
    ];
    const attached = attachCommercialLinks(products, [{
      productId: 'second',
      destinationUrl: 'https://example.test/synthetic',
      affiliateRelationship: 'affiliate',
      disclosure: 'Synthetic affiliate example.',
      sourceLinkStatus: 'linked',
      reviewStatus: 'approved',
    }]);
    expect(attached.map((entry) => entry.product.id)).toEqual(['first', 'second']);
    expect(attached[0].commercialLink).toBeNull();
    expect(attached[1].commercialLink?.affiliateRelationship).toBe('affiliate');
  });

  test('does not attach pending or undisclosed affiliate links', () => {
    const products = [{ id: 'first' }];
    const baseLink = {
      productId: 'first',
      destinationUrl: 'https://example.test/product',
      affiliateRelationship: 'affiliate' as const,
      disclosure: 'Affiliate link.',
      sourceLinkStatus: 'linked' as const,
      reviewStatus: 'approved' as const,
    };

    expect(attachCommercialLinks(products, [{ ...baseLink, reviewStatus: 'pending' }])[0].commercialLink).toBeNull();
    expect(attachCommercialLinks(products, [{ ...baseLink, disclosure: null }])[0].commercialLink).toBeNull();
  });
});

describe('unverified prices', () => {
  test('an unpriced product passes the ceiling but ranks after an equally matched priced one', () => {
    const priced = { ...baseProduct, id: 'priced', productName: 'Priced', listPriceCents: 4000 };
    const unpriced = { ...baseProduct, id: 'unpriced', productName: 'Unpriced', listPriceCents: null, priceVerifiedAtIso: null };
    const ranked = rankEligibleProducts([unpriced, priced], baseProfile, ['appearance.hydration_look_low'], 5000);
    expect(ranked.map((entry) => entry.product.id)).toEqual(['priced', 'unpriced']);
    const tight = rankEligibleProducts([unpriced, priced], baseProfile, ['appearance.hydration_look_low'], 2500);
    expect(tight.map((entry) => entry.product.id)).toEqual(['unpriced']);
  });
});

describe('ingredient name matching', () => {
  test('matches a named allergen inside a full ingredient name, but not inside another word', () => {
    const product = { ...baseProduct, ingredients: ['Aqua', 'Lavandula Angustifolia (Lavender) Oil', 'Rosmarinus Officinalis Leaf Extract'] };
    expect(evaluateProductEligibility(product, { ...baseProfile, allergies: ['lavender'] }, ['appearance.hydration_look_low']).reasons).toContain('allergy_match');
    expect(evaluateProductEligibility(product, { ...baseProfile, allergies: ['rose'] }, ['appearance.hydration_look_low']).reasons).not.toContain('allergy_match');
    expect(evaluateProductEligibility(product, { ...baseProfile, allergies: ['LAVENDER OIL'] }, ['appearance.hydration_look_low']).reasons).toContain('allergy_match');
  });
});
