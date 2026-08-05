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

  test('ranks using tag match and verification only', () => {
    const official = { ...baseProduct, id: 'official', productName: 'Official Example', verificationStatus: 'official' as const };
    const verified = { ...baseProduct, id: 'verified', productName: 'Verified Example' };
    const ranked = rankEligibleProducts([verified, official], baseProfile, ['appearance.hydration_look_low']);
    expect(ranked.map((entry) => entry.product.id)).toEqual(['official', 'verified']);
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
