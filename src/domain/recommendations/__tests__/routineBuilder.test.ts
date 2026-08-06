import { describe, expect, test } from 'vitest';
import { approvedPrototypeCatalog } from '../../../data/prototypeCatalog';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  buildSyntheticRoutine,
  type RoutineSafetyIntake,
} from '../routineBuilder';

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
    expect(routine.pm.map((step) => step.slot)).toEqual(['cleanse', 'support', 'hydrate']);
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
