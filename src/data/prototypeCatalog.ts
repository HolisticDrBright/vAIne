import type { ProductCandidate } from '../domain/recommendations/eligibility';

/**
 * Fictional products for demonstrating the approved-catalog UI. They are not
 * derived from Phase 9F, a real brand, an affiliate feed, or a private label.
 */
export const approvedPrototypeCatalog: readonly ProductCandidate[] = [
  {
    id: 'synthetic-cleanse-01',
    brandName: 'vAIne Demo',
    productName: 'Gentle Cleanse Sample',
    verificationStatus: 'verified',
    catalogReviewState: 'catalog_approved',
    catalogSource: 'synthetic_prototype',
    routineSlot: 'cleanse',
    observationTags: ['appearance.hydration_look_low'],
    activeFamilies: [],
    ingredients: ['synthetic cleanser base'],
    exclusionFlags: [],
  },
  {
    id: 'synthetic-support-01',
    brandName: 'vAIne Demo',
    productName: 'Antioxidant Support Sample',
    verificationStatus: 'verified',
    catalogReviewState: 'catalog_approved',
    catalogSource: 'synthetic_prototype',
    routineSlot: 'support',
    observationTags: ['appearance.dullness_visible', 'appearance.texture_irregular'],
    activeFamilies: ['antioxidant-family'],
    ingredients: ['synthetic antioxidant complex'],
    exclusionFlags: [],
  },
  {
    id: 'synthetic-hydrate-01',
    brandName: 'vAIne Demo',
    productName: 'Barrier Hydration Sample',
    verificationStatus: 'verified',
    catalogReviewState: 'catalog_approved',
    catalogSource: 'synthetic_prototype',
    routineSlot: 'hydrate',
    observationTags: ['appearance.hydration_look_low', 'appearance.texture_irregular'],
    activeFamilies: ['barrier-support-family'],
    ingredients: ['synthetic humectant', 'synthetic barrier lipid'],
    exclusionFlags: [],
  },
  {
    id: 'synthetic-protect-01',
    brandName: 'vAIne Demo',
    productName: 'Daily Protection Sample',
    verificationStatus: 'verified',
    catalogReviewState: 'catalog_approved',
    catalogSource: 'synthetic_prototype',
    routineSlot: 'protect',
    observationTags: ['appearance.sun_exposure_signs_visible'],
    activeFamilies: ['uv-filter-family'],
    ingredients: ['synthetic prototype filters'],
    exclusionFlags: [],
  },
] as const;
