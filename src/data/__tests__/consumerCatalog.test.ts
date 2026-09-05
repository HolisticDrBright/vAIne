import { describe, expect, test } from 'vitest';
import { consumerCatalogEntries } from '../consumerCatalog';
import { approvedPrototypeCatalog } from '../prototypeCatalog';
import { syntheticSkinAnalysis } from '../syntheticAnalysis';
import { catalogEntrySchema } from '../../domain/catalog/catalogEntry';
import { resolveRoutineCatalog } from '../../domain/catalog/catalogResolver';
import { buildSyntheticRoutine, type RoutineSafetyIntake } from '../../domain/recommendations/routineBuilder';

const NOW = '2026-09-05T12:00:00.000Z';

const standardIntake: RoutineSafetyIntake = {
  sensitivityPreference: 'standard',
  pregnancyOrNursing: 'no',
  recentProcedure: 'no',
  knownAllergyOrReaction: 'no',
  currentStrongActives: 'no',
  avoidFragrance: false,
  budgetPreference: 'up_to_50',
};

describe('imported Longevity Skincare product database', () => {
  test('every imported row satisfies the catalog schema', () => {
    expect(consumerCatalogEntries).toHaveLength(81);
    for (const row of consumerCatalogEntries) expect(() => catalogEntrySchema.parse(row)).not.toThrow();
  });

  test('the reviewed list replaces the fictional samples', () => {
    const resolved = resolveRoutineCatalog(consumerCatalogEntries, approvedPrototypeCatalog, NOW);
    expect(resolved.source).toBe('reviewed_catalog');
    expect(resolved.invalid).toHaveLength(0);
    // Priority-2 rows still need product-page verification and stay held back.
    expect(resolved.blocked).toHaveLength(20);
    expect(resolved.blocked.every(({ reasons }) => reasons.includes('evidence_not_approved'))).toBe(true);
    // Bundles, travel sizes, body care, devices, and supplements are listed but never placed in a step.
    expect(resolved.outsideRoutine.length).toBeGreaterThan(20);
    expect(resolved.products.every((product) => product.catalogSource === 'reviewed_research')).toBe(true);
    expect(resolved.products.some((product) => product.brandName === 'vAIne Demo')).toBe(false);
  });

  test('builds a routine from real products for the sample check-in', () => {
    const resolved = resolveRoutineCatalog(consumerCatalogEntries, approvedPrototypeCatalog, NOW);
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, resolved.products);
    const named = [...routine.am, ...routine.pm].filter((step) => step.product);
    expect(named.length).toBeGreaterThanOrEqual(4);
    expect(routine.am.find((step) => step.slot === 'cleanse')?.product?.brandName).toBeDefined();
    expect(routine.am.find((step) => step.slot === 'protect')?.product?.productName).toBe('BIO-SHIELD SPF 40');
    // Unverified prices are never assumed to fit the $50 ceiling; they are shown as unverified instead.
    expect(routine.pricesUnverified).toBe(true);
    expect(JSON.stringify(routine)).not.toMatch(/affiliate|Affiliate Potential|commission/i);
  });

  test('pregnancy and sensitivity answers stay conservative until the sheet reviews them', () => {
    const resolved = resolveRoutineCatalog(consumerCatalogEntries, approvedPrototypeCatalog, NOW);
    const pregnant = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, pregnancyOrNursing: 'yes' }, resolved.products);
    expect([...pregnant.am, ...pregnant.pm].every((step) => step.product === null)).toBe(true);
    expect(pregnant.am[0].noProductReason).toBe('safety_excluded');
  });
});
