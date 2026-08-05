import type { SkinAnalysis } from '../analysis/skinAnalysisSchema';
import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import {
  rankEligibleProducts,
  type ProductCandidate,
  type RoutineSlot,
  type SafetyProfile,
} from './eligibility';

export type SafetyAnswer = 'yes' | 'no' | 'prefer_not_to_say';
export type RoutinePeriod = 'am' | 'pm';
export type RoutineMode = 'standard' | 'gentle' | 'cautious';

export interface RoutineSafetyIntake {
  sensitivityPreference: 'standard' | 'sensitive';
  pregnancyOrNursing: SafetyAnswer;
  recentProcedure: SafetyAnswer;
  knownAllergyOrReaction: SafetyAnswer;
  currentStrongActives: SafetyAnswer;
  avoidFragrance: boolean;
}

export interface BuiltRoutineStep {
  id: string;
  slot: RoutineSlot;
  title: string;
  purpose: string;
  instruction: string;
  product: ProductCandidate | null;
}

export interface BuiltRoutine {
  mode: RoutineMode;
  am: readonly BuiltRoutineStep[];
  pm: readonly BuiltRoutineStep[];
  notes: readonly string[];
  namedSamplesHidden: boolean;
}

const goalTags: Record<SkinAnalysis['routineGoals'][number], readonly SkinObservationTag[]> = {
  support_hydration_look: ['appearance.hydration_look_low'],
  support_even_tone_look: ['appearance.tone_uneven', 'appearance.visible_redness'],
  support_smoother_texture_look: ['appearance.texture_irregular'],
  support_radiance_look: ['appearance.dullness_visible'],
  support_comfort: ['appearance.visible_redness', 'appearance.hydration_look_low'],
  support_sun_protection_habit: ['appearance.sun_exposure_signs_visible'],
};

const stepCopy: Record<RoutineSlot, Pick<BuiltRoutineStep, 'title' | 'purpose' | 'instruction'>> = {
  cleanse: {
    title: 'Gentle cleanse',
    purpose: 'Remove the day without overcomplicating the routine.',
    instruction: 'Use lukewarm water and avoid aggressive rubbing.',
  },
  support: {
    title: 'Targeted support',
    purpose: 'Support the appearance goals highlighted in this sample.',
    instruction: 'Introduce only one support step at a time and patch test first.',
  },
  hydrate: {
    title: 'Hydrate + support barrier',
    purpose: 'Support a comfortable, hydrated surface appearance.',
    instruction: 'Apply gently while skin is slightly damp.',
  },
  protect: {
    title: 'Daily protection habit',
    purpose: 'Make daytime protection the consistent final morning step.',
    instruction: 'Choose a verified product appropriate for your skin and location.',
  },
  weekly: {
    title: 'Optional weekly care',
    purpose: 'Keep occasional care simple and easy to pause.',
    instruction: 'Skip this step whenever skin feels uncomfortable.',
  },
};

function buildSafetyProfile(intake: RoutineSafetyIntake): SafetyProfile {
  const pregnancyUnknownOrYes = intake.pregnancyOrNursing !== 'no';
  return {
    pregnantOrTrying: pregnancyUnknownOrYes,
    nursing: pregnancyUnknownOrYes,
    recentProcedure: intake.recentProcedure !== 'no',
    sensitivityPreference: intake.sensitivityPreference,
    avoidFragrance: intake.avoidFragrance,
    avoidEssentialOils: intake.sensitivityPreference === 'sensitive',
    allergies: [],
    currentActiveFamilies: [],
  };
}

function requestedTagsFor(analysis: SkinAnalysis): SkinObservationTag[] {
  const tags = new Set<SkinObservationTag>(analysis.observationTags);
  for (const goal of analysis.routineGoals) {
    for (const tag of goalTags[goal]) tags.add(tag);
  }
  return [...tags];
}

function routineModeFor(intake: RoutineSafetyIntake): RoutineMode {
  if (
    intake.pregnancyOrNursing !== 'no' ||
    intake.recentProcedure !== 'no' ||
    intake.knownAllergyOrReaction !== 'no' ||
    intake.currentStrongActives !== 'no'
  ) return 'cautious';
  return intake.sensitivityPreference === 'sensitive' ? 'gentle' : 'standard';
}

function makeStep(slot: RoutineSlot, product: ProductCandidate | null, period: RoutinePeriod): BuiltRoutineStep {
  return {
    id: `${period}-${slot}`,
    slot,
    ...stepCopy[slot],
    product,
  };
}

export function buildSyntheticRoutine(
  analysis: SkinAnalysis,
  intake: RoutineSafetyIntake,
  catalog: readonly ProductCandidate[],
): BuiltRoutine {
  const mode = routineModeFor(intake);
  const namedSamplesHidden = intake.knownAllergyOrReaction !== 'no';
  const holdTargetedSupport =
    intake.pregnancyOrNursing !== 'no' ||
    intake.recentProcedure !== 'no' ||
    intake.currentStrongActives !== 'no';
  const ranked = rankEligibleProducts(catalog, buildSafetyProfile(intake), requestedTagsFor(analysis));
  const productBySlot = new Map<RoutineSlot, ProductCandidate>();

  if (!namedSamplesHidden) {
    for (const entry of ranked) {
      if (!productBySlot.has(entry.product.routineSlot)) {
        productBySlot.set(entry.product.routineSlot, entry.product);
      }
    }
  }

  const coreSlots: RoutineSlot[] = holdTargetedSupport
    ? ['cleanse', 'hydrate']
    : ['cleanse', 'support', 'hydrate'];
  const amSlots: RoutineSlot[] = [...coreSlots, 'protect'];
  const notes: string[] = ['Patch test one new product at a time and stop if irritation occurs.'];

  if (holdTargetedSupport) {
    notes.push('Targeted active support is paused because one or more safety answers call for a conservative routine.');
  }
  if (namedSamplesHidden) {
    notes.push('Named samples are hidden because an allergy or prior reaction needs product-specific review.');
  }
  if (intake.recentProcedure !== 'no') {
    notes.push('Follow the aftercare instructions from the professional who performed the recent procedure.');
  }

  return {
    mode,
    am: amSlots.map((slot) => makeStep(slot, productBySlot.get(slot) ?? null, 'am')),
    pm: coreSlots.map((slot) => makeStep(slot, productBySlot.get(slot) ?? null, 'pm')),
    notes,
    namedSamplesHidden,
  };
}
