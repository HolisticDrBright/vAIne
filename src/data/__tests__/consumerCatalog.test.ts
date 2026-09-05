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
  test('every imported row satisfies the catalog schema and carries no commercial terms', () => {
    expect(consumerCatalogEntries.length).toBeGreaterThanOrEqual(81);
    for (const row of consumerCatalogEntries) expect(() => catalogEntrySchema.parse(row)).not.toThrow();
    expect(JSON.stringify(consumerCatalogEntries)).not.toMatch(/commission|affiliate potential|my code|BRANDON|cookie/i);
  });

  test('the reviewed list replaces the fictional samples', () => {
    const resolved = resolveRoutineCatalog(consumerCatalogEntries, approvedPrototypeCatalog, NOW);
    expect(resolved.source).toBe('reviewed_catalog');
    expect(resolved.invalid).toHaveLength(0);
    // Rows the sheet marks blocked, out of scope, needing verification, or research-only from the
    // affiliate catalog are held back, each with the reviewer's reason.
    expect(resolved.blocked.length).toBeGreaterThanOrEqual(20);
    expect(resolved.blocked.every(({ reasons }) => reasons.includes('evidence_not_approved'))).toBe(true);
    const bioShield = resolved.blocked.find(({ entry }) => entry.productName === 'BIO-SHIELD SPF 40');
    expect(bioShield?.reasons).toContain('blocked_by_review');
    expect(bioShield?.entry.blocker).toMatch(/Drug Facts/);
    const device = resolved.blocked.find(({ entry }) => entry.brand === 'ZIIP');
    expect(device?.reasons).toContain('out_of_scope');
    // Affiliate research rows are listed with their price but never offered.
    const ordinary = resolved.blocked.find(({ entry }) => entry.brand === 'The Ordinary');
    expect(ordinary?.entry.approximatePriceCents).toBe(600);
    expect(ordinary?.entry.catalogState).toBe('research_only');
    expect(resolved.products.every((product) => product.brandName !== 'The Ordinary')).toBe(true);
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
    // Both sunscreens on the list are blocked pending Drug Facts panels, so protection stays category-level.
    expect(routine.am.find((step) => step.slot === 'protect')?.product).toBeNull();
    expect(routine.am.find((step) => step.slot === 'protect')?.noProductReason).toBe('no_products_in_slot');
    expect(named.every((step) => step.product?.catalogState === 'research_only')).toBe(true);
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
