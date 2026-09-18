import { describe, expect, test } from 'vitest';
import { approvedPrototypeCatalog } from '../../../data/prototypeCatalog';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  buildSyntheticRoutine,
  type RoutineSafetyIntake,
} from '../routineBuilder';
import type { ProductCandidate } from '../eligibility';
import { suggestProductTypes } from '../productTypes';

const standardIntake: RoutineSafetyIntake = {
  sensitivityPreference: 'standard',
  pregnancyOrNursing: 'no',
  recentProcedure: 'no',
  knownAllergyOrReaction: 'no',
  currentStrongActives: 'no',
  avoidFragrance: false,
  budgetPreference: 'up_to_50',
  routineProductCount: 4,
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
    expect(weekly?.title).toMatch(/separate night/i);
    expect(weekly?.instruction).toMatch(/different evening/i);
    expect(routine.notes.join(' ')).toMatch(/separate evening/i);
  });

  test('caps a focused routine at two unique products', () => {
    const products = [
      candidate('test-spf', 'Daily SPF', ['zinc oxide'], 'protect'),
      candidate('test-retinal', 'Retinal Serum', ['retinal']),
      candidate('test-moisturizer', 'Barrier Moisturizer', ['hyaluronic acid'], 'hydrate'),
      candidate('test-cleanser', 'Gentle Cleanser', ['glycerin'], 'cleanse'),
    ];
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, budgetPreference: 'no_limit', routineProductCount: 2 },
      products,
    );
    const ids = new Set([...routine.am, ...routine.pm].flatMap((step) => step.product ? [step.product.id] : []));

    expect(ids.size).toBe(2);
    expect(ids).toContain('test-spf');
    expect(ids).toContain('test-retinal');
    expect(routine.notes.join(' ')).toMatch(/up to 2 unique products/i);
  });

  test('builds an eight-product plan with distinct peptide, EV, and weekly mask roles', () => {
    const products = [
      candidate('test-spf', 'Daily SPF', ['zinc oxide'], 'protect'),
      candidate('test-retinal', 'Retinal Serum', ['retinal']),
      candidate('test-moisturizer', 'Barrier Moisturizer', ['hyaluronic acid'], 'hydrate'),
      candidate('test-cleanser', 'Gentle Cleanser', ['glycerin'], 'cleanse'),
      candidate('healthgevity-facegevity', 'FACEgevity', ['GHK-Cu (3%)', 'PeptiYouth', 'peptide']),
      candidate('plated-skin-science-intense-serum', 'INTENSE Serum', ['platelet-derived extracellular vesicles']),
      candidate('test-toner', 'Hydrating Toner', ['glycerin'], 'hydrate'),
      candidate('alitura-the-clay-mask', 'The Clay Mask', ['kaolin clay'], 'weekly'),
    ];
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, budgetPreference: 'no_limit', routineProductCount: 8 },
      products,
    );
    const ids = new Set([...routine.am, ...routine.pm].flatMap((step) => step.product ? [step.product.id] : []));

    expect(ids.size).toBe(8);
    expect(routine.am.some((step) => step.product?.id === 'healthgevity-facegevity' && step.title === 'Peptide support')).toBe(true);
    expect(routine.pm.some((step) => step.product?.id === 'plated-skin-science-intense-serum' && step.title === 'Advanced EV support')).toBe(true);
    expect(routine.pm.some((step) => step.product?.id === 'alitura-the-clay-mask' && /Weekly clay mask/.test(step.title))).toBe(true);
  });
});

describe('routine builder shopping interests', () => {
  const hydrateOil = {
    ...approvedPrototypeCatalog.find((product) => product.id === 'synthetic-hydrate-02')!,
    id: 'synthetic-hydrate-oil',
    productName: 'Comfort Face Oil Sample',
    productTypes: ['face_oil'] as const,
  };
  const withOil = [...approvedPrototypeCatalog, hydrateOil];

  test('no interests leaves the routine unchanged and adds no picks', () => {
    const plain = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, approvedPrototypeCatalog);
    const empty = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, productInterests: [] }, approvedPrototypeCatalog);
    expect(empty.am.map((step) => step.product?.id)).toEqual(plain.am.map((step) => step.product?.id));
    expect(empty.interestPicks).toEqual([]);
    expect(plain.am.every((step) => step.interest === null)).toBe(true);
  });

  test('prefers an eligible product of a wanted type within a slot', () => {
    const plain = buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, withOil);
    expect(plain.am.find((step) => step.slot === 'hydrate')?.product?.id).not.toBe('synthetic-hydrate-oil');

    const wantsOil = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, productInterests: ['face_oil'] }, withOil);
    const hydrate = wantsOil.am.find((step) => step.slot === 'hydrate');
    expect(hydrate?.product?.id).toBe('synthetic-hydrate-oil');
    expect(hydrate?.interest).toBe('face_oil');
    expect(wantsOil.pm.find((step) => step.slot === 'hydrate')?.product?.id).toBe('synthetic-hydrate-oil');
  });

  test('an interest never overrides safety or budget', () => {
    const pricyOil = [...approvedPrototypeCatalog, { ...hydrateOil, listPriceCents: 9_000 }];
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, budgetPreference: 'up_to_25', productInterests: ['face_oil'] }, pricyOil);
    expect(routine.am.find((step) => step.slot === 'hydrate')?.product?.id).toBe('synthetic-hydrate-01');
    expect(routine.interestPicks).toEqual([
      expect.objectContaining({ interest: 'face_oil', product: null, noProductReason: 'over_budget' }),
    ]);

    const allergic = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, knownAllergyOrReaction: 'yes', avoidIngredients: ['synthetic barrier lipid'], productInterests: ['face_oil'] },
      withOil,
    );
    expect(allergic.interestPicks[0]).toEqual(expect.objectContaining({ product: null, noProductReason: 'safety_excluded' }));
  });

  test('adds one pick per wanted type, in the order chosen, and flags ones already in the routine', () => {
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, productInterests: ['sunscreen', 'cleanser', 'mask'] },
      approvedPrototypeCatalog,
    );
    expect(routine.interestPicks.map((pick) => pick.interest)).toEqual(['sunscreen', 'cleanser', 'mask']);
    expect(routine.interestPicks[0].product?.routineSlot).toBe('protect');
    expect(routine.interestPicks[0].inRoutine).toBe(true);
    expect(routine.interestPicks[1].product?.routineSlot).toBe('cleanse');
    expect(routine.interestPicks[2]).toEqual(expect.objectContaining({ product: null, noProductReason: 'no_products_of_type' }));
    expect(routine.notes.some((note) => /shopping for/.test(note))).toBe(true);
  });

  test('two checked types yield two different products when the list allows', () => {
    const exfoliatingCleanser = {
      ...approvedPrototypeCatalog.find((product) => product.id === 'synthetic-cleanse-01')!,
      id: 'synthetic-cleanse-exfoliating',
      productName: 'Exfoliating Cleanse Sample',
      productTypes: ['cleanser', 'exfoliant'] as const,
      observationTags: ['appearance.texture_irregular', 'appearance.hydration_look_low', 'appearance.dullness_visible'] as const,
    };
    const routine = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, productInterests: ['cleanser', 'exfoliant'] },
      [...approvedPrototypeCatalog, exfoliatingCleanser],
    );
    const [cleanser, exfoliant] = routine.interestPicks;
    expect(cleanser.product?.id).toBe('synthetic-cleanse-exfoliating');
    expect(exfoliant.product?.id).toBe('synthetic-cleanse-exfoliating');

    const withPolish = [...approvedPrototypeCatalog, exfoliatingCleanser, {
      ...exfoliatingCleanser,
      id: 'synthetic-weekly-polish',
      productName: 'Weekly Polish Sample',
      routineSlot: 'weekly' as const,
      productTypes: ['exfoliant'] as const,
      observationTags: ['appearance.texture_irregular'] as const,
    }];
    const distinct = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, productInterests: ['cleanser', 'exfoliant'] },
      withPolish,
    );
    expect(distinct.interestPicks[0].product?.id).toBe('synthetic-cleanse-exfoliating');
    expect(distinct.interestPicks[1].product?.id).toBe('synthetic-weekly-polish');
  });

  test('a pick may lack a goal match but still passes safety and budget', () => {
    const untagged = approvedPrototypeCatalog.map((product) => (
      product.routineSlot === 'cleanse' ? { ...product, observationTags: [] } : product
    ));
    const routine = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, productInterests: ['cleanser'] }, untagged);
    expect(routine.am.find((step) => step.slot === 'cleanse')?.noProductReason).toBe('no_goal_match');
    expect(routine.interestPicks[0].product?.routineSlot).toBe('cleanse');
    expect(routine.interestPicks[0].matchedTags).toEqual([]);
    expect(routine.interestPicks[0].inRoutine).toBe(false);
  });

  test('picks respect a paused routine and hidden products', () => {
    const paused = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, pregnancyOrNursing: 'yes', productInterests: ['serum', 'cleanser'] },
      approvedPrototypeCatalog,
    );
    expect(paused.interestPicks[0]).toEqual(expect.objectContaining({ interest: 'serum', product: null, noProductReason: 'support_paused' }));
    expect(paused.interestPicks[1].product).not.toBeNull();

    const hidden = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, knownAllergyOrReaction: 'prefer_not_to_say', productInterests: ['cleanser'] },
      approvedPrototypeCatalog,
    );
    expect(hidden.interestPicks[0]).toEqual(expect.objectContaining({ product: null, noProductReason: 'hidden_for_review' }));
  });

  test('let vAIne pick derives the shopping list from the check-in and ignores checked types', () => {
    const auto = buildSyntheticRoutine(
      syntheticSkinAnalysis,
      { ...standardIntake, productInterestMode: 'auto', productInterests: ['mask'] },
      approvedPrototypeCatalog,
    );
    expect(auto.interestSource).toBe('suggested');
    expect(auto.interests).toEqual(suggestProductTypes(syntheticSkinAnalysis));
    expect(auto.interests).not.toContain('mask');
    expect(auto.interestPicks.map((pick) => pick.interest)).toEqual(auto.interests);
    expect(auto.interestPicks.find((pick) => pick.interest === 'moisturizer')?.product?.routineSlot).toBe('hydrate');
    expect(auto.notes.some((note) => /vAIne picked the product types/.test(note))).toBe(true);

    const manual = buildSyntheticRoutine(syntheticSkinAnalysis, { ...standardIntake, productInterests: ['mask'] }, approvedPrototypeCatalog);
    expect(manual.interestSource).toBe('chosen');
    expect(manual.interests).toEqual(['mask']);
    expect(buildSyntheticRoutine(syntheticSkinAnalysis, standardIntake, approvedPrototypeCatalog).interestSource).toBeNull();
  });
});
