import { describe, expect, test } from 'vitest';
import { approvedPrototypeCatalog } from '../../../data/prototypeCatalog';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  buildSyntheticRoutine,
  type RoutineSafetyIntake,
} from '../routineBuilder';
import type { ProductCandidate } from '../eligibility';

const standardIntake: RoutineSafetyIntake = {
  sensitivityPreference: 'standard',
  pregnancyOrNursing: 'no',
  recentProcedure: 'no',
  knownAllergyOrReaction: 'no',
  currentStrongActives: 'no',
  avoidFragrance: false,
  budgetPreference: 'up_to_50',
};

describe('synthetic routine builder', () => {
  test('builds separate morning and evening routines from validated goals', () => {
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, approvedPrototypeCatalog);

    expect(routine.mode).toBe('standard');
    expect(routine.am.map((step) => step.slot)).toEqual(['cleanse', 'support', 'hydrate', 'protect']);
    expect(routine.pm.map((step) => step.slot)).toEqual(['cleanse', 'support', 'hydrate', 'weekly']);
    expect(routine.am.find((step) => step.slot === 'protect')?.product?.listPriceCents).toBeLessThanOrEqual(5000);
  });

  test('uses a gentle mode for a sensitive preference', () => {
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, sensitivityPreference: 'sensitive' },
      approvedPrototypeCatalog,
    );
    expect(routine.mode).toBe('gentle');
  });

  test.each(['pregnancyOrNursing', 'recentProcedure', 'currentStrongActives'] as const)(
    'pauses targeted support when %s calls for caution',
    (field) => {
      const routine = buildSyntheticRoutine(
        syntheticSkinAnalysis,
        { ...standardIntake, [field]: 'prefer_not_to_say' },
        approvedPrototypeCatalog,
      );
      expect(routine.mode).toBe('cautious');
      expect(routine.am.some((step) => step.slot === 'support')).toBe(false);
      expect(routine.pm.some((step) => step.slot === 'support')).toBe(false);
      expect(routine.pm.some((step) => step.slot === 'weekly')).toBe(false);
    },
  );

  test('hides all named samples when an allergy or prior reaction needs review', () => {
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, knownAllergyOrReaction: 'yes' },
      approvedPrototypeCatalog,
    );
    expect(routine.namedSamplesHidden).toBe(true);
    expect([...routine.am, ...routine.pm].every((step) => step.product === null)).toBe(true);
  });

  test('does not expose commercial fields in routine steps', () => {
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, approvedPrototypeCatalog);
    expect(JSON.stringify(routine)).not.toMatch(/affiliate|commission|destinationUrl/i);
  });

  test('changes product samples when the per-product budget changes', () => {
    const valueRoutine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, budgetPreference: 'up_to_25' },
      approvedPrototypeCatalog,
    );
    const premiumRoutine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, budgetPreference: 'up_to_100' },
      approvedPrototypeCatalog,
    );

    expect(valueRoutine.am.find((step) => step.slot === 'hydrate')?.product?.id).toBe('synthetic-hydrate-01');
    expect(premiumRoutine.am.find((step) => step.slot === 'hydrate')?.product?.id).toBe('synthetic-hydrate-03');
  });
});

describe('routine builder product matching', () => {
  test('excludes only products containing a named allergen instead of hiding the list', () => {
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, knownAllergyOrReaction: 'yes', avoidIngredients: ['synthetic humectant'] },
      approvedPrototypeCatalog,
    );
    expect(routine.namedSamplesHidden).toBe(false);
    expect(routine.mode).toBe('cautious');
    const hydrate = routine.am.find((step) => step.slot === 'hydrate');
    expect(hydrate?.product).toBeNull();
    expect(hydrate?.noProductReason).toBe('safety_excluded');
    expect(routine.am.find((step) => step.slot === 'cleanse')?.product).not.toBeNull();
  });

  test('keeps targeted support when the active family in use is named, skipping duplicates', () => {
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, currentStrongActives: 'yes', currentActiveFamilies: ['synthetic-support-family'] },
      approvedPrototypeCatalog,
    );
    const support = routine.am.find((step) => step.slot === 'support');
    expect(support).toBeDefined();
    expect(support?.product).toBeNull();
    expect(support?.noProductReason).toBe('safety_excluded');
    expect(routine.am.find((step) => step.slot === 'hydrate')?.product).not.toBeNull();
  });

  test('pauses support when actives are in use but unnamed', () => {
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, currentStrongActives: 'yes' },
      approvedPrototypeCatalog,
    );
    expect(routine.am.some((step) => step.slot === 'support')).toBe(false);
  });

  test('explains why a step has no product', () => {
    const noProtect = approvedPrototypeCatalog.filter((product) => product.routineSlot !== 'protect');
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, noProtect);
    expect(routine.am.find((step) => step.slot === 'protect')?.noProductReason).toBe('no_products_in_slot');

    const hidden = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, knownAllergyOrReaction: 'prefer_not_to_say' }, approvedPrototypeCatalog);
    expect(hidden.am.every((step) => step.noProductReason === 'hidden_for_review')).toBe(true);

    const pricey = approvedPrototypeCatalog.map((product) => ({ ...product, listPriceCents: 20_000 }));
    const overBudget = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, budgetPreference: 'up_to_25' }, pricey);
    expect(overBudget.am.find((step) => step.slot === 'cleanse')?.noProductReason).toBe('over_budget');
    expect(overBudget.eligibleCount).toBe(0);
  });

  test('reports the tags each chosen product matched on', () => {
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, approvedPrototypeCatalog);
    const hydrate = routine.am.find((step) => step.slot === 'hydrate');
    expect(hydrate?.matchedTags).toContain('appearance.hydration_look_low');
    expect(routine.consideredCount).toBe(approvedPrototypeCatalog.length);
    expect(routine.eligibleCount).toBeGreaterThan(0);
  });
});

describe('routine builder protocol scheduling', () => {
  const candidate = (
    id: string,
    productName: string,
    ingredients: readonly string[],
    routineSlot: ProductCandidate['routineSlot'] = 'support',
  ): ProductCandidate => ({
    id,
    brandName: 'Protocol Test',
    productName,
    verificationStatus: 'official',
    catalogReviewState: 'catalog_approved',
    catalogSource: 'reviewed_research',
    routineSlot,
    listPriceCents: 10_000,
    currencyCode: 'USD',
    priceVerifiedAtIso: '2026-09-01T00:00:00.000Z',
    observationTags: ['appearance.texture_irregular'],
    activeFamilies: ingredients.some((item) => /retinal/i.test(item)) ? ['retinoid'] : [],
    ingredients,
    exclusionFlags: [],
  });

  test('can select different support products for morning and evening', () => {
    const vitaminC = candidate('medik8-c-tetra-vitamin-c-serum', 'C-Tetra Vitamin C Serum', ['vitamin C']);
    const retinal = candidate('medik8-crystal-retinal-3', 'Crystal Retinal 3', ['retinal']);
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, budgetPreference: 'no_limit' },
      [vitaminC, retinal],
    );

    expect(routine.am.find((step) => step.slot === 'support')?.product?.id).toBe(vitaminC.id);
    expect(routine.pm.find((step) => step.slot === 'support')?.product?.id).toBe(retinal.id);
  });

  test('places exfoliation on a separate evening when the PM support is a retinoid', () => {
    const retinal = candidate('medik8-crystal-retinal-3', 'Crystal Retinal 3', ['retinal']);
    const exfoliant = candidate(
      'naturium-bha-liquid-exfoliant-2-pct',
      'BHA Liquid Exfoliant 2%',
      ['salicylic acid'],
      'weekly',
    );
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, budgetPreference: 'no_limit' },
      [retinal, exfoliant],
    );

    const weekly = routine.pm.find((step) => step.slot === 'weekly');
    expect(weekly?.title).toBe('Optional separate treatment night');
    expect(weekly?.instruction).toMatch(/different evening/i);
    expect(routine.notes.join(' ')).toMatch(/separate evening/i);
  });
});
