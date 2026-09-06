import { describe, expect, test } from 'vitest';
import { approvedPrototypeCatalog } from '../../../data/prototypeCatalog';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import { buildSyntheticRoutine } from '../../recommendations/routineBuilder';
import { CATALOG_ENTRY_SCHEMA_VERSION } from '../catalogEntry';
import { resolveRoutineCatalog } from '../catalogResolver';

const NOW = '2026-08-06T12:00:00.000Z';

const reviewedCleanser = {
  schemaVersion: CATALOG_ENTRY_SCHEMA_VERSION,
  productId: 'reviewed-cleanse-1',
  brand: 'Reviewed Brand',
  productName: 'Reviewed Hydrating Cleanser',
  category: 'cleanser',
  routineSlot: 'cleanse',
  keyIngredients: ['glycerin'],
  skinConcernTags: ['appearance.hydration_look_low'],
  skinTypeCompatibility: ['dry'],
  sensitivityCaution: false,
  pregnancyNursingStatus: 'reviewed_acceptable',
  allergyCautions: [],
  fragranceStatus: 'fragrance_free',
  crueltyFreeStatus: 'unknown',
  veganStatus: 'unknown',
  approximatePriceCents: 1_500,
  currencyCode: 'USD',
  priceVerifiedAtIso: '2026-07-20T00:00:00.000Z',
  affiliate: null,
  nonAffiliateFallbackUrl: 'https://example.com/cleanser',
  market: 'US',
  availabilityStatus: 'available',
  source: 'reviewed_research',
  lastReviewedAtIso: '2026-07-01T00:00:00.000Z',
  evidenceReviewStatus: 'approved',
  active: true,
};

const intake = {
  sensitivityPreference: 'standard' as const,
  pregnancyOrNursing: 'no' as const,
  recentProcedure: 'no' as const,
  knownAllergyOrReaction: 'no' as const,
  currentStrongActives: 'no' as const,
  avoidFragrance: false,
  budgetPreference: 'no_limit' as const,
  routineProductCount: 4 as const,
};

describe('routine catalog resolver', () => {
  test('falls back to labeled samples while the reviewed list is empty', () => {
    const resolved = resolveRoutineCatalog([], approvedPrototypeCatalog, NOW);
    expect(resolved.source).toBe('synthetic_samples');
    expect(resolved.products).toBe(approvedPrototypeCatalog);
  });

  test('uses the reviewed list exclusively once any product is visible', () => {
    const resolved = resolveRoutineCatalog([reviewedCleanser], approvedPrototypeCatalog, NOW);
    expect(resolved.source).toBe('reviewed_catalog');
    expect(resolved.products.map((product) => product.id)).toEqual(['reviewed-cleanse-1']);

    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, intake, resolved.products);
    expect(routine.am.find((step) => step.slot === 'cleanse')?.product?.brandName).toBe('Reviewed Brand');
    // Other slots stay category-level rather than borrowing fictional samples.
    expect(routine.am.find((step) => step.slot === 'hydrate')?.product).toBeNull();
    expect(routine.am.find((step) => step.slot === 'hydrate')?.noProductReason).toBe('no_products_in_slot');
  });

  test('keeps samples when every reviewed row is blocked, and reports the blocks', () => {
    const resolved = resolveRoutineCatalog([{ ...reviewedCleanser, active: false }, { broken: true }], approvedPrototypeCatalog, NOW);
    expect(resolved.source).toBe('synthetic_samples');
    expect(resolved.blocked).toHaveLength(1);
    expect(resolved.invalid).toHaveLength(1);
  });
});
