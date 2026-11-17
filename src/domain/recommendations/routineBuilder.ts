import type { SkinAnalysis } from '../analysis/skinAnalysisSchema';
import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import { protocolSupportsPeriod } from '../../data/productUseProtocols';
import { advancedEvidenceTierRank, getAdvancedProductEvidence } from '../../data/advancedProductEvidence';
import {
  evaluateProductEligibility,
  rankEligibleProducts,
  type ProductCandidate,
  type RankedEligibleProduct,
  type RoutineSlot,
  type SafetyProfile,
} from './eligibility';
import { matchesInterest, pluralProductType, suggestProductTypes, type ProductInterestMode, type ProductType } from './productTypes';
import type { Technique, TechniqueTool } from '../techniques/technique';
import type { TechniqueSafetyProfile } from '../techniques/techniqueEligibility';
import { pickDailyTechnique, type DailyTechniquePick } from '../techniques/dailyTechnique';

export type SafetyAnswer = 'yes' | 'no' | 'prefer_not_to_say';
export type RoutinePeriod = 'am' | 'pm';
export type RoutineMode = 'standard' | 'gentle' | 'cautious';
export type BudgetPreference = 'up_to_25' | 'up_to_50' | 'up_to_100' | 'no_limit';
export type RoutineProductCount = 2 | 4 | 6 | 8;

export const budgetMaximumCents: Record<BudgetPreference, number | null> = {
  up_to_25: 2500,
  up_to_50: 5000,
  up_to_100: 10000,
  no_limit: null,
};

export const budgetPreferenceLabels: Record<BudgetPreference, string> = {
  up_to_25: 'Up to $25 per product',
  up_to_50: 'Up to $50 per product',
  up_to_100: 'Up to $100 per product',
  no_limit: 'No price limit',
};

export const routineProductCountLabels: Record<RoutineProductCount, string> = {
  2: '2 products · focused essentials',
  4: '4 products · simple routine',
  6: '6 products · complete routine',
  8: '8 products · advanced routine',
};

/**
 * Active families a person can say they already use. The vocabulary matches
 * what the catalog adapter derives from reviewed key ingredients, so "I use a
 * retinoid" excludes another retinoid rather than pausing every support step.
 */
export const ACTIVE_FAMILY_OPTIONS = [
  { value: 'retinoid', label: 'Retinoid / retinol' },
  { value: 'exfoliating-acid', label: 'Exfoliating acid (AHA/BHA/PHA)' },
  { value: 'vitamin-c', label: 'Vitamin C' },
  { value: 'niacinamide', label: 'Niacinamide' },
  { value: 'peptide', label: 'Peptides' },
  { value: 'hydroquinone', label: 'Hydroquinone' },
] as const;

export interface RoutineSafetyIntake {
  sensitivityPreference: 'standard' | 'sensitive';
  pregnancyOrNursing: SafetyAnswer;
  recentProcedure: SafetyAnswer;
  knownAllergyOrReaction: SafetyAnswer;
  currentStrongActives: SafetyAnswer;
  avoidFragrance: boolean;
  budgetPreference: BudgetPreference;
  /** Maximum number of unique named products across AM, PM, and weekly care. */
  routineProductCount: RoutineProductCount;
  /**
   * Ingredients the person named as allergens. When present alongside a
   * "yes" allergy answer, products containing them are excluded and the rest
   * of the list stays available; with no names, every named product is
   * hidden until product-specific review is possible.
   */
  avoidIngredients?: readonly string[];
  /** Active families already in use; a matching family is excluded. */
  currentActiveFamilies?: readonly string[];
  /**
   * Product types the person is shopping for (cleanser, moisturizer, ...).
   * When a routine role is filled, an eligible product of a wanted type is
   * preferred over an equally acceptable one that is not, and each wanted
   * type gets its own pick. Empty means no preference. Never relaxes a
   * safety, goal, budget, or routine-size rule.
   */
  productInterests?: readonly ProductType[];
  /** 'auto' ignores `productInterests` and lets vAIne suggest types from the check-in. */
  productInterestMode?: ProductInterestMode;
  /**
   * Technique safety answers. Each defaults to the cautious answer when a
   * profile saved before these questions existed is loaded, so techniques
   * stay paused until the person has answered.
   */
  implantedDevice?: SafetyAnswer;
  lightSensitisingMedication?: SafetyAnswer;
  activeBreakouts?: SafetyAnswer;
  recentInjectables?: SafetyAnswer;
  fragileSkinOrBloodThinners?: SafetyAnswer;
  /** Tools the person owns; only affects which techniques are doable today. */
  toolsOwned?: readonly TechniqueTool[];
}

/** True once every technique safety question has an answer other than the default. */
export function techniqueQuestionsAnswered(intake: RoutineSafetyIntake): boolean {
  return [intake.implantedDevice, intake.lightSensitisingMedication, intake.activeBreakouts, intake.recentInjectables, intake.fragileSkinOrBloodThinners]
    .every((answer) => answer !== undefined);
}

export function buildTechniqueSafetyProfile(intake: RoutineSafetyIntake): TechniqueSafetyProfile {
  // An unanswered question is treated like "prefer not to say": cautious.
  const cautious = (answer: SafetyAnswer | undefined) => answer !== 'no';
  return {
    ...buildSafetyProfile(intake),
    implantedDevice: cautious(intake.implantedDevice),
    photosensitisingMedication: cautious(intake.lightSensitisingMedication),
    activeBreakouts: cautious(intake.activeBreakouts),
    recentInjectables: cautious(intake.recentInjectables),
    fragileSkinOrBloodThinners: cautious(intake.fragileSkinOrBloodThinners),
  };
}

/** The shopping list in force for a check-in: chosen by the person, or suggested by vAIne. */
export function resolveProductInterests(
  intake: Pick<RoutineSafetyIntake, 'productInterests' | 'productInterestMode'>,
  analysis: Pick<SkinAnalysis, 'observationTags' | 'routineGoals'>,
): { interests: readonly ProductType[]; source: 'chosen' | 'suggested' | null } {
  if (intake.productInterestMode === 'auto') return { interests: suggestProductTypes(analysis), source: 'suggested' };
  const interests = intake.productInterests ?? [];
  return { interests, source: interests.length ? 'chosen' : null };
}

/** Why a routine step shows category guidance instead of a listed product. */
export type NoProductReason =
  | 'hidden_for_review'
  | 'support_paused'
  | 'no_products_in_slot'
  | 'no_goal_match'
  | 'safety_excluded'
  | 'over_budget'
  | 'routine_size_limit'
  | 'scheduled_elsewhere'
  | 'no_products_of_type';

export interface BuiltRoutineStep {
  id: string;
  slot: RoutineSlot;
  title: string;
  purpose: string;
  instruction: string;
  product: ProductCandidate | null;
  /** Observation tags that made this product a match; empty without a product. */
  matchedTags: readonly SkinObservationTag[];
  /** The shopping interest this product satisfies, when one decided the choice. */
  interest: ProductType | null;
  noProductReason: NoProductReason | null;
}

/** The best safe, in-budget listed product for a type the person is shopping for. */
export interface InterestPick {
  interest: ProductType;
  product: ProductCandidate | null;
  matchedTags: readonly SkinObservationTag[];
  /** True when the same product already appears as a routine step. */
  inRoutine: boolean;
  noProductReason: NoProductReason | null;
}

export interface BuiltRoutine {
  mode: RoutineMode;
  am: readonly BuiltRoutineStep[];
  pm: readonly BuiltRoutineStep[];
  notes: readonly string[];
  namedSamplesHidden: boolean;
  /** How many listed products were considered and how many were eligible. */
  consideredCount: number;
  eligibleCount: number;
  /** True when an offered product has no verified price. */
  pricesUnverified: boolean;
  /** One pick per product type on the shopping list, in list order. */
  interestPicks: readonly InterestPick[];
  /** The shopping list this routine used and who decided it. */
  interests: readonly ProductType[];
  interestSource: 'chosen' | 'suggested' | null;
  /** Today's technique session, chosen by rules from the technique library; null with a reason when none fits. */
  technique: DailyTechniquePick;
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
    purpose: 'Support the appearance goals highlighted in this check-in.',
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

export const noProductReasonCopy: Record<NoProductReason, string> = {
  hidden_for_review: 'Named products are hidden until your allergy or reaction can be reviewed product by product.',
  support_paused: 'Targeted support is paused for this routine because of a safety answer.',
  no_products_in_slot: 'The product list has no product for this step yet.',
  no_goal_match: 'No listed product for this step matches the appearance goals in this check-in.',
  safety_excluded: 'Listed products for this step were excluded by your safety answers.',
  over_budget: 'Matching products for this step are above your per-product budget.',
  routine_size_limit: 'A matching product was left out to honor the routine size you chose.',
  scheduled_elsewhere: 'Your selected product for this category is scheduled at another time of day.',
  no_products_of_type: 'The product list has no product of this type yet.',
};

/** Explains a missing interest pick in words that name the type. */
export function interestReasonCopy(interest: ProductType, reason: NoProductReason): string {
  const plural = pluralProductType(interest);
  switch (reason) {
    case 'no_products_of_type':
    case 'no_products_in_slot':
      return `The product list has no ${plural} yet.`;
    case 'support_paused': return `Listed ${plural} are paused for this routine because of a safety answer.`;
    case 'safety_excluded': return `Listed ${plural} were excluded by your safety answers.`;
    case 'over_budget': return `Listed ${plural} that fit you are above your per-product budget.`;
    case 'no_goal_match': return `No listed ${plural} match the appearance goals in this check-in.`;
    case 'hidden_for_review': return noProductReasonCopy.hidden_for_review;
    case 'routine_size_limit': return noProductReasonCopy.routine_size_limit;
    case 'scheduled_elsewhere': return noProductReasonCopy.scheduled_elsewhere;
  }
}

/** Splits a comma, semicolon, or newline separated list into trimmed, de-duplicated names. */
export function parseIngredientList(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of text.split(/[,\n;]+/)) {
    const name = raw.trim().slice(0, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.slice(0, 20);
}

export function buildSafetyProfile(intake: RoutineSafetyIntake): SafetyProfile {
  const pregnancyUnknownOrYes = intake.pregnancyOrNursing !== 'no';
  return {
    pregnantOrTrying: pregnancyUnknownOrYes,
    nursing: pregnancyUnknownOrYes,
    recentProcedure: intake.recentProcedure !== 'no',
    sensitivityPreference: intake.sensitivityPreference,
    avoidFragrance: intake.avoidFragrance,
    avoidEssentialOils: intake.sensitivityPreference === 'sensitive',
    allergies: intake.knownAllergyOrReaction === 'yes' ? intake.avoidIngredients ?? [] : [],
    currentActiveFamilies: intake.currentStrongActives === 'yes' ? intake.currentActiveFamilies ?? [] : [],
  };
}

export function requestedTagsFor(analysis: SkinAnalysis): SkinObservationTag[] {
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

/** Allergy answered "yes" without naming anything, or kept private. */
export function namedProductsHiddenFor(intake: RoutineSafetyIntake): boolean {
  if (intake.knownAllergyOrReaction === 'prefer_not_to_say') return true;
  return intake.knownAllergyOrReaction === 'yes' && (intake.avoidIngredients ?? []).length === 0;
}

/** Strong actives answered "yes" without naming a family, or kept private. */
function activesUnspecifiedFor(intake: RoutineSafetyIntake): boolean {
  if (intake.currentStrongActives === 'prefer_not_to_say') return true;
  return intake.currentStrongActives === 'yes' && (intake.currentActiveFamilies ?? []).length === 0;
}

function explainMissingProduct(
  slot: RoutineSlot,
  catalog: readonly ProductCandidate[],
  profile: SafetyProfile,
  requestedTags: readonly SkinObservationTag[],
  maxPriceCents: number | null,
): NoProductReason {
  const inSlot = catalog.filter((product) => product.routineSlot === slot);
  if (!inSlot.length) return 'no_products_in_slot';
  const evaluated = inSlot.map((product) => evaluateProductEligibility(product, profile, requestedTags));
  const matching = evaluated.filter((result) => result.matchedTags.length > 0);
  if (!matching.length) return 'no_goal_match';
  const eligible = inSlot.filter((product, index) => evaluated[index].eligible && evaluated[index].matchedTags.length > 0);
  if (!eligible.length) return 'safety_excluded';
  return 'over_budget';
}

function makeStep(
  slot: RoutineSlot,
  period: RoutinePeriod,
  product: ProductCandidate | null,
  matchedTags: readonly SkinObservationTag[],
  interest: ProductType | null,
  noProductReason: NoProductReason | null,
  sequence = 0,
  titleOverride?: string,
): BuiltRoutineStep {
  return {
    id: `${period}-${slot}-${product?.id ?? 'guidance'}-${sequence}`,
    slot,
    ...stepCopy[slot],
    ...(titleOverride ? { title: titleOverride } : {}),
    product,
    matchedTags,
    interest,
    noProductReason,
  };
}

function explainMissingInterest(
  interest: ProductType,
  catalog: readonly ProductCandidate[],
  allowedSlots: ReadonlySet<RoutineSlot>,
  profile: SafetyProfile,
  requestedTags: readonly SkinObservationTag[],
): NoProductReason {
  const ofType = catalog.filter((product) => product.productTypes?.includes(interest));
  if (!ofType.length) return 'no_products_of_type';
  const allowed = ofType.filter((product) => allowedSlots.has(product.routineSlot));
  if (!allowed.length) return 'support_paused';
  const eligible = allowed.filter((product) => evaluateProductEligibility(product, profile, requestedTags).eligible);
  if (!eligible.length) return 'safety_excluded';
  return 'over_budget';
}

export interface RoutineBuildOptions {
  /** Technique library to draw today's session from; empty means no technique step. */
  techniques?: readonly Technique[];
  /** Device-local calendar date (YYYY-MM-DD) used to rotate the technique session. */
  dateKey?: string;
}

export function buildSyntheticRoutine(
  analysis: SkinAnalysis,
  intake: RoutineSafetyIntake,
  catalog: readonly ProductCandidate[],
  options: RoutineBuildOptions = {},
): BuiltRoutine {
  const mode = routineModeFor(intake);
  const namedSamplesHidden = namedProductsHiddenFor(intake);
  const holdTargetedSupport =
    intake.pregnancyOrNursing !== 'no' ||
    intake.recentProcedure !== 'no' ||
    activesUnspecifiedFor(intake);
  const profile = buildSafetyProfile(intake);
  const requestedTags = requestedTagsFor(analysis);
  const maxPriceCents = budgetMaximumCents[intake.budgetPreference];
  const priceTieBreaker = intake.budgetPreference === 'no_limit' ? 'higher' : 'lower';
  const ranked = rankEligibleProducts(catalog, profile, requestedTags, maxPriceCents, priceTieBreaker);
  const productCount = intake.routineProductCount ?? 4;
  const { interests, source: interestSource } = resolveProductInterests(intake, analysis);
  const allowedSlots = new Set<RoutineSlot>(holdTargetedSupport
    ? ['cleanse', 'hydrate', 'protect']
    : ['cleanse', 'support', 'hydrate', 'protect', 'weekly']);
  const selectable = ranked.filter(({ product }) => allowedSlots.has(product.routineSlot));
  const selected = namedSamplesHidden ? [] : selectRoutineProducts(selectable, productCount, interests);

  const coreSlots: RoutineSlot[] = holdTargetedSupport
    ? ['cleanse', 'hydrate']
    : ['cleanse', 'support', 'hydrate'];
  const amSlots: RoutineSlot[] = [...coreSlots, 'protect'];
  // Occasional care (masks, exfoliation) is an evening-only option and is
  // withheld entirely whenever the routine is conservative.
  const pmSlots: RoutineSlot[] = holdTargetedSupport ? coreSlots : [...coreSlots, 'weekly'];
  const notes: string[] = ['Patch test one new product at a time and stop if irritation occurs.'];

  notes.push(intake.budgetPreference === 'no_limit'
    ? 'Price does not limit this routine. Ingredient evidence and fit rank first; a higher list price breaks only an otherwise equal tie.'
    : `Budget applied: ${budgetPreferenceLabels[intake.budgetPreference]}. Price never increases a product's evidence or match score.`);
  notes.push(`Routine size: up to ${productCount} unique products across morning, evening, and weekly care. A product used twice counts once.`);

  if (holdTargetedSupport) {
    notes.push('Targeted active support is paused because one or more safety answers call for a conservative routine.');
  } else if (intake.currentStrongActives === 'yes') {
    notes.push('Products in the active families you already use are excluded so nothing is doubled up.');
  }
  if (namedSamplesHidden) {
    notes.push('Named products are hidden because an allergy or prior reaction needs product-specific review.');
  } else if (intake.knownAllergyOrReaction === 'yes') {
    notes.push(`Products listing ${(intake.avoidIngredients ?? []).join(', ')} are excluded from this routine.`);
  }
  if (intake.recentProcedure !== 'no') {
    notes.push('Follow the aftercare instructions from the professional who performed the recent procedure.');
  }

  const stepsFor = (slot: RoutineSlot, period: RoutinePeriod): BuiltRoutineStep[] => {
    const picks = selected.filter((selection) => (
      selection.entry.product.routineSlot === slot && periodsForSelection(selection).includes(period)
    ));
    if (picks.length) return picks.map((pick, index) => makeStep(
      slot,
      period,
      pick.entry.product,
      pick.entry.eligibility.matchedTags,
      pick.interest,
      null,
      index,
      titleForSelection(pick),
    ));
    const selectedInOtherPeriod = selected.some((selection) => selection.entry.product.routineSlot === slot);
    const matchingButCapped = ranked.some((entry) => entry.product.routineSlot === slot);
    const reason: NoProductReason = namedSamplesHidden
      ? 'hidden_for_review'
      : selectedInOtherPeriod
        ? 'scheduled_elsewhere'
        : matchingButCapped && selected.length >= productCount
          ? 'routine_size_limit'
          : explainMissingProduct(slot, catalog, profile, requestedTags, maxPriceCents);
    return [makeStep(slot, period, null, [], null, reason)];
  };

  const am = amSlots.flatMap((slot) => stepsFor(slot, 'am'));
  let pm = pmSlots.flatMap((slot) => stepsFor(slot, 'pm'));
  const pmSupports = pm.filter((step) => step.slot === 'support' && step.product);
  const needsSeparateTreatmentNight = pmSupports.some((step) => step.product?.activeFamilies.some((family) => (
    family === 'retinoid' || family === 'exfoliating-acid'
  )) ?? false);
  if (needsSeparateTreatmentNight) {
    pm = pm.map((step) => step.slot === 'weekly'
      ? {
        ...step,
        title: step.product && /\b(clay|mask)\b/i.test(productText(step.product))
          ? 'Weekly clay mask · separate night'
          : 'Weekly exfoliation · separate night',
        instruction: 'Use this on a different evening from the targeted support step; do not stack a retinoid with an exfoliating acid.',
      }
      : step);
    notes.push('The optional weekly treatment belongs on a separate evening from the selected retinoid or exfoliating support step.');
  }

  // A pick per wanted type: the best safe, in-budget product of that type
  // from the steps this routine allows. A goal match ranks first but is not
  // required, because the person asked for the type explicitly. Two checked
  // types yield two different products whenever the list has them.
  const inRoutineIds = new Set(selected.map(({ entry }) => entry.product.id));
  const rankedForPicks = namedSamplesHidden
    ? []
    : rankEligibleProducts(catalog, profile, requestedTags, maxPriceCents, priceTieBreaker, 'USD', { requireGoalMatch: false });
  const pickedIds = new Set<string>();
  const interestPicks: InterestPick[] = interests.map((interest) => {
    const candidates = rankedForPicks.filter((entry) => (
      allowedSlots.has(entry.product.routineSlot) && entry.product.productTypes?.includes(interest)
    ));
    const best = candidates.find((entry) => !pickedIds.has(entry.product.id)) ?? candidates[0];
    if (best) {
      pickedIds.add(best.product.id);
      return {
        interest,
        product: best.product,
        matchedTags: best.eligibility.matchedTags,
        inRoutine: inRoutineIds.has(best.product.id),
        noProductReason: null,
      };
    }
    const reason: NoProductReason = namedSamplesHidden
      ? 'hidden_for_review'
      : explainMissingInterest(interest, catalog, allowedSlots, profile, requestedTags);
    return { interest, product: null, matchedTags: [], inRoutine: false, noProductReason: reason };
  });
  if (interestSource === 'suggested') {
    notes.push(`vAIne picked the product types to shop for from this check-in: ${interests.map(pluralProductType).join(', ')}. They are chosen first whenever they pass the same safety, goal, budget, and routine-size rules.`);
  } else if (interests.length) {
    notes.push('Products of the types you are shopping for are chosen first whenever they pass the same safety, goal, budget, and routine-size rules.');
  }

  const offered = [
    ...selected.map(({ entry }) => entry.product),
    ...interestPicks.flatMap((pick) => (pick.product ? [pick.product] : [])),
  ];

  const technique = pickDailyTechnique(
    options.techniques ?? [],
    buildTechniqueSafetyProfile(intake),
    requestedTags,
    intake.toolsOwned ?? [],
    options.dateKey ?? '1970-01-01',
  );
  if (technique.session) {
    notes.push(`Today’s technique is ${technique.session.technique.name.toLowerCase()}, chosen by the same safety answers as the products. It is placeholder content awaiting practitioner review and describes temporary appearance effects only.`);
  }

  return {
    mode,
    am,
    pm,
    notes,
    namedSamplesHidden,
    consideredCount: catalog.length,
    eligibleCount: ranked.length,
    pricesUnverified: offered.some((product) => product.listPriceCents === null),
    interestPicks,
    interests,
    interestSource,
    technique,
  };
}

type SelectionRole = 'protect' | 'targeted' | 'hydrate' | 'cleanse' | 'peptide' | 'exosome' | 'weekly' | 'toner';
type RankedProduct = ReturnType<typeof rankEligibleProducts>[number];

interface SelectedProduct {
  entry: RankedProduct;
  role: SelectionRole;
  /** The shopping interest that put this product ahead of others for its role. */
  interest: ProductType | null;
}

/**
 * Stable partition: candidates of a type the person is shopping for come
 * first, in their existing rank order, followed by the rest. Ranking has
 * already applied safety, goal fit, and budget, so this only reorders
 * products that are all acceptable.
 */
function preferInterests(candidates: readonly RankedProduct[], interests: readonly ProductType[]): RankedProduct[] {
  if (!interests.length) return [...candidates];
  const wanted = candidates.filter((entry) => matchesInterest(entry.product.productTypes, interests) !== null);
  const rest = candidates.filter((entry) => matchesInterest(entry.product.productTypes, interests) === null);
  return [...wanted, ...rest];
}

const rolePlans: Record<RoutineProductCount, readonly SelectionRole[]> = {
  2: ['protect', 'targeted'],
  4: ['protect', 'targeted', 'hydrate', 'cleanse'],
  6: ['protect', 'targeted', 'hydrate', 'cleanse', 'peptide', 'weekly'],
  8: ['protect', 'targeted', 'hydrate', 'cleanse', 'peptide', 'exosome', 'toner', 'weekly'],
};

function productText(product: ProductCandidate): string {
  return `${product.productName} ${product.category ?? ''} ${product.ingredients.join(' ')}`;
}

function matchesRole(product: ProductCandidate, role: SelectionRole): boolean {
  const text = productText(product);
  const advanced = getAdvancedProductEvidence(product.id);
  switch (role) {
    case 'protect': return product.routineSlot === 'protect';
    case 'cleanse': return product.routineSlot === 'cleanse';
    case 'hydrate': return product.routineSlot === 'hydrate' && !/\b(toner|essence|mist)\b/i.test(text);
    case 'toner': return product.routineSlot === 'hydrate' && /\b(toner|essence|mist)\b/i.test(text) && !product.activeFamilies.includes('exfoliating-acid');
    case 'peptide': return product.routineSlot === 'support' && (advanced?.category === 'peptide' || product.activeFamilies.includes('peptide'));
    case 'exosome': return product.routineSlot === 'support' && Boolean(advanced && advanced.category !== 'peptide');
    case 'weekly': return product.routineSlot === 'weekly';
    case 'targeted': return product.routineSlot === 'support';
  }
}

function roleCandidates(ranked: readonly RankedProduct[], role: SelectionRole): RankedProduct[] {
  const matches = ranked.filter(({ product }) => matchesRole(product, role));
  if (role === 'weekly') {
    return [...matches].sort((left, right) => {
      const leftMask = /\b(clay|mask)\b/i.test(productText(left.product)) ? 0 : 1;
      const rightMask = /\b(clay|mask)\b/i.test(productText(right.product)) ? 0 : 1;
      return leftMask - rightMask || right.rankScore - left.rankScore;
    });
  }
  if (role === 'exosome') {
    return [...matches].sort((left, right) => {
      const leftReview = getAdvancedProductEvidence(left.product.id);
      const rightReview = getAdvancedProductEvidence(right.product.id);
      const leftTier = advancedEvidenceTierRank(leftReview);
      const rightTier = advancedEvidenceTierRank(rightReview);
      return leftTier - rightTier || right.rankScore - left.rankScore;
    });
  }
  return matches;
}

function selectRoutineProducts(
  ranked: readonly RankedProduct[],
  count: RoutineProductCount,
  interests: readonly ProductType[] = [],
): SelectedProduct[] {
  const selected: SelectedProduct[] = [];
  const used = new Set<string>();
  const take = (candidate: RankedProduct, role: SelectionRole) => {
    selected.push({ entry: candidate, role, interest: matchesInterest(candidate.product.productTypes, interests) });
    used.add(candidate.product.id);
  };
  const tryRole = (role: SelectionRole) => {
    // A targeted pick may already fill a later specialty role. Do not spend a
    // second routine slot on the same type of treatment just to fill the plan.
    if ((role === 'peptide' || role === 'exosome')
      && selected.some(({ entry }) => matchesRole(entry.product, role))) return;
    const candidate = preferInterests(roleCandidates(ranked, role), interests).find(({ product }) => !used.has(product.id));
    if (!candidate) return;
    take(candidate, role);
  };

  rolePlans[count].forEach(tryRole);
  const fallbackRoles: readonly SelectionRole[] = ['hydrate', 'cleanse', 'peptide', 'exosome', 'toner', 'weekly', 'targeted', 'protect'];
  for (const role of fallbackRoles) {
    if (selected.length >= count) break;
    for (const candidate of preferInterests(roleCandidates(ranked, role), interests)) {
      if (selected.length >= count) break;
      if (used.has(candidate.product.id)) continue;
      take(candidate, role);
    }
  }
  return selected;
}

function titleForSelection(selection: SelectedProduct): string {
  switch (selection.role) {
    case 'peptide': return 'Peptide support';
    case 'exosome': return 'Advanced EV support';
    case 'toner': return 'Toner or essence';
    case 'weekly': return /\b(clay|mask)\b/i.test(productText(selection.entry.product)) ? 'Weekly clay mask' : 'Weekly exfoliation';
    default: return stepCopy[selection.entry.product.routineSlot].title;
  }
}

function periodsForSelection(selection: SelectedProduct): readonly RoutinePeriod[] {
  const product = selection.entry.product;
  const supportsAm = protocolSupportsPeriod(product, 'am');
  const supportsPm = protocolSupportsPeriod(product, 'pm');
  if (!supportsAm) return supportsPm ? ['pm'] : [];
  if (!supportsPm) return ['am'];
  if (product.routineSlot === 'cleanse' || product.routineSlot === 'hydrate') return ['am', 'pm'];
  if (selection.role === 'peptide') return ['am'];
  if (selection.role === 'exosome') return ['pm'];
  if (product.activeFamilies.includes('retinoid') || product.activeFamilies.includes('exfoliating-acid')) return ['pm'];
  if (product.activeFamilies.includes('vitamin-c')) return ['am'];
  return ['am'];
}
