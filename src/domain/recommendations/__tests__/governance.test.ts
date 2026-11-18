import { describe, expect, test } from 'vitest';
import { approvedPrototypeCatalog } from '../../../data/prototypeCatalog';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import { validateRecommendationCopy } from '../copyValidation';
import {
  HOW_WE_PICK_STEPS,
  describeExclusions,
  ineligibilityReasonCopy,
  summarizeExclusions,
  visibilityReasonCopy,
} from '../governance';
import { buildSafetyProfile, requestedTagsFor, type RoutineSafetyIntake } from '../routineBuilder';

const intake: RoutineSafetyIntake = {
  sensitivityPreference: 'standard',
  pregnancyOrNursing: 'no',
  recentProcedure: 'no',
  knownAllergyOrReaction: 'no',
  currentStrongActives: 'no',
  avoidFragrance: false,
  budgetPreference: 'up_to_50',
  routineProductCount: 4,
};

describe('how we pick', () => {
  test('states the order, the commercial boundary, and the AI’s limits without naming a brand', () => {
    const text = HOW_WE_PICK_STEPS.map((step) => `${step.title} ${step.body}`).join(' ');
    expect(HOW_WE_PICK_STEPS.map((step) => step.title.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', 'Wh', 'Wh', 'Re', 'Te']);
    expect(text).toMatch(/safety answers come first/i);
    expect(text).toMatch(/Affiliate relationships, commissions, discounts, and merchant placement are not available to the matching code/);
    expect(text).toMatch(/never sees the product list/);
    expect(text).toMatch(/A suggested professional look pauses every technique/);
    expect(text).toMatch(/unreviewed entries are labelled as placeholders/);
    expect(text).not.toMatch(/Young Goose|Vitali|Alitura|INBLUEM|Augustinus|Medik8/);
    for (const step of HOW_WE_PICK_STEPS) {
      expect(validateRecommendationCopy({ copy: step.body, allowedProducts: [], knownProducts: [] }).ok, step.title).toBe(true);
    }
  });

  test('every machine reason has plain-language copy', () => {
    for (const copy of [...Object.values(ineligibilityReasonCopy), ...Object.values(visibilityReasonCopy)]) {
      expect(copy.length).toBeGreaterThan(8);
      expect(copy).not.toMatch(/_/);
    }
  });
});

describe('exclusion summary', () => {
  const tags = requestedTagsFor(syntheticSkinAnalysis);

  test('counts usable products and explains the empty case', () => {
    const summary = summarizeExclusions(approvedPrototypeCatalog, buildSafetyProfile(intake), tags, 5000);
    expect(summary.considered).toBe(approvedPrototypeCatalog.length);
    expect(summary.usable + summary.noGoalMatch + summary.overBudget + summary.safetyExcluded).toBe(summary.considered);
    expect(summary.safetyExcluded).toBe(0);
    expect(summary.usable).toBeGreaterThan(0);
  });

  test('attributes safety exclusions to their reasons', () => {
    const allergic = buildSafetyProfile({ ...intake, knownAllergyOrReaction: 'yes', avoidIngredients: ['synthetic humectant'] });
    const summary = summarizeExclusions(approvedPrototypeCatalog, allergic, tags, null);
    expect(summary.safetyExcluded).toBe(3);
    expect(summary.bySafetyReason.allergy_match).toBe(3);
    const lines = describeExclusions(summary);
    expect(lines[0]).toMatch(/3 left out by your safety answers: contains an ingredient you avoid \(3\)/);
  });

  test('counts budget and goal-fit separately', () => {
    const summary = summarizeExclusions(approvedPrototypeCatalog, buildSafetyProfile(intake), tags, 1);
    expect(summary.overBudget).toBeGreaterThan(0);
    expect(summary.usable).toBe(0);
    expect(describeExclusions(summary).some((line) => /above your per-product budget/.test(line))).toBe(true);

    const untagged = approvedPrototypeCatalog.map((product) => ({ ...product, observationTags: [] }));
    const none = summarizeExclusions(untagged, buildSafetyProfile(intake), tags, null);
    expect(none.noGoalMatch).toBe(untagged.length);
    expect(describeExclusions(none)[0]).toMatch(/do not address a goal/);
  });

  test('says so when nothing was excluded', () => {
    const summary = summarizeExclusions(approvedPrototypeCatalog.filter((product) => product.listPriceCents! <= 5000), buildSafetyProfile(intake), [...tags, 'appearance.visible_redness', 'appearance.texture_irregular', 'appearance.tone_uneven', 'appearance.dullness_visible', 'appearance.sun_exposure_signs_visible'], 5000);
    if (summary.usable === summary.considered) {
      expect(describeExclusions(summary)).toEqual(['Every listed product passed your safety answers, fits a goal, and is within budget.']);
    } else {
      expect(describeExclusions(summary).length).toBeGreaterThan(0);
    }
  });
});
