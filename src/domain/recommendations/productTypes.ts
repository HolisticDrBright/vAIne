import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { SkinAnalysis } from '../analysis/skinAnalysisSchema';
import type { RoutineSlot } from './eligibility';

/**
 * Product types a person can say they are shopping for. The vocabulary is
 * deliberately short and consumer-facing (what someone would type into a
 * store search), and every listed product is tagged with the types it
 * plausibly belongs to, so a checked box can steer which listed products are
 * shown first and add a dedicated pick for that type.
 *
 * Types never override safety: an interest only reorders products that have
 * already passed the eligibility and budget rules.
 */
export type ProductType =
  | 'cleanser'
  | 'exfoliant'
  | 'toner_mist'
  | 'serum'
  | 'wrinkle_treatment'
  | 'brightening'
  | 'eye_care'
  | 'moisturizer'
  | 'face_oil'
  | 'sunscreen'
  | 'mask';

export const PRODUCT_TYPE_VALUES = [
  'cleanser',
  'exfoliant',
  'moisturizer',
  'wrinkle_treatment',
  'serum',
  'brightening',
  'eye_care',
  'sunscreen',
  'mask',
  'toner_mist',
  'face_oil',
] as const satisfies readonly ProductType[];

export interface ProductTypeOption {
  value: ProductType;
  label: string;
  /** One line under the checkbox explaining what the type covers. */
  hint: string;
  /** Plural, lower-case wording for sentences ("no listed cleansers"). */
  plural: string;
}

export const PRODUCT_TYPE_OPTIONS: readonly ProductTypeOption[] = [
  { value: 'cleanser', label: 'Cleanser', hint: 'Face wash, gel, or cleansing balm', plural: 'cleansers' },
  { value: 'exfoliant', label: 'Exfoliant', hint: 'Acid toner, peel, polish, or scrub', plural: 'exfoliants' },
  { value: 'moisturizer', label: 'Moisturizer', hint: 'Day cream, night cream, or lotion', plural: 'moisturizers' },
  { value: 'wrinkle_treatment', label: 'Wrinkle / fine-line treatment', hint: 'Retinoid, retinol alternative, peptide, or regenerative treatment', plural: 'wrinkle treatments' },
  { value: 'serum', label: 'Serum', hint: 'Targeted treatment applied before moisturizer', plural: 'serums' },
  { value: 'brightening', label: 'Dark spots / brightening', hint: 'Vitamin C, niacinamide, or tone-evening products', plural: 'brightening products' },
  { value: 'eye_care', label: 'Eye cream', hint: 'Eye-area creams and serums', plural: 'eye products' },
  { value: 'sunscreen', label: 'Sunscreen', hint: 'Daily SPF for the face', plural: 'sunscreens' },
  { value: 'mask', label: 'Mask', hint: 'Occasional treatment masks', plural: 'masks' },
  { value: 'toner_mist', label: 'Toner / mist / essence', hint: 'Watery hydration layers', plural: 'toners, mists, and essences' },
  { value: 'face_oil', label: 'Face oil', hint: 'Oils and oil-based moisturizers', plural: 'face oils' },
];

const optionByValue = new Map(PRODUCT_TYPE_OPTIONS.map((option) => [option.value, option]));

export function describeProductType(type: ProductType): string {
  return optionByValue.get(type)?.label ?? type.replaceAll('_', ' ');
}

export function pluralProductType(type: ProductType): string {
  return optionByValue.get(type)?.plural ?? `${type.replaceAll('_', ' ')}s`;
}

export function isProductType(value: unknown): value is ProductType {
  return typeof value === 'string' && optionByValue.has(value as ProductType);
}

export interface ProductTypeSource {
  productName: string;
  category?: string | null;
  routineSlot: RoutineSlot;
  /** Active families already derived from reviewed key ingredients. */
  activeFamilies?: readonly string[];
}

const NAME_RULES: readonly [type: ProductType, pattern: RegExp][] = [
  ['cleanser', /cleans|face\s*wash|wash\b/i],
  ['exfoliant', /exfoliat|scrub|polish|resurfac|\bpeel\b|\b[ab]ha\b|\bpha\b|glycolic|lactic|mandelic|salicylic/i],
  ['mask', /\bmasks?\b/i],
  ['toner_mist', /\btoner\b|\bmist\b|\bspray\b|\bessence\b/i],
  ['face_oil', /\boils?\b/i],
  ['eye_care', /\beye|\blash/i],
  ['sunscreen', /\bspf\b|sunscreen|sun\s*screen|\bshield\b|\buv\b/i],
  ['wrinkle_treatment', /retin|bakuchiol|peptide|exosome|\bnad\+?|wrinkle|fine.?line|anti-?ag|\baging\b|\byouth|regenerat|longevity|\bfirm|\bghk|collagen|\bcopper\b|\bage\b|alpharet|os-01/i],
  ['brightening', /vitamin\s*c\b|ascorb|bright|\bglow|radiance|discolor|dark\s*spot|\btone\b|even-?tone|niacinamide|azelaic|tranexamic|arbutin|\bc\s*\+|\bc\d{2}\b|c-tetra|bio-c\b|\bl\.a\.d\.r/i],
  ['moisturizer', /moisturi|\bcreams?\b|cr[eè]me|lotion|\bbalm\b|\bemulsion\b|hydrat/i],
  ['serum', /\bserum|booster|concentrate|ampoule|\bcomplex\b|\bformula\b/i],
];

/**
 * Types implied by a reviewed active family. Only leave-on treatment steps
 * (support, hydrate) take these: a cleanser with a little niacinamide is not
 * a brightening product, and a serum with a trace of lactic acid is not an
 * exfoliant, so exfoliating acids are matched by name only.
 */
const FAMILY_TYPES: Record<string, ProductType> = {
  retinoid: 'wrinkle_treatment',
  peptide: 'wrinkle_treatment',
  'vitamin-c': 'brightening',
  niacinamide: 'brightening',
};

const LIP_PATTERN = /\blips?\b|gloss/i;

/**
 * Tags a product with the consumer types it belongs to. Name and category
 * text are matched against a small keyword vocabulary, reviewed active
 * families add the type they imply, and the routine slot supplies a default
 * so every cleanser, sunscreen, and moisturizer is findable even when its
 * name is a brand coinage. Results are ordered by the vocabulary order.
 */
export function deriveProductTypes(source: ProductTypeSource): ProductType[] {
  const text = `${source.productName} ${source.category ?? ''}`;
  // Lip care is outside the face-care vocabulary entirely.
  if (LIP_PATTERN.test(text)) return [];
  const types = new Set<ProductType>();

  for (const [type, pattern] of NAME_RULES) {
    if (pattern.test(text)) types.add(type);
  }
  if (source.routineSlot === 'support' || source.routineSlot === 'hydrate') {
    for (const family of source.activeFamilies ?? []) {
      const type = FAMILY_TYPES[family];
      if (type) types.add(type);
    }
  }

  // A "toning solution" is an exfoliant, not a toner.
  if (/toning\s+solution/i.test(text)) types.delete('toner_mist');

  switch (source.routineSlot) {
    case 'cleanse':
      types.add('cleanser');
      break;
    case 'protect':
      types.add('sunscreen');
      break;
    case 'hydrate':
      if (!types.has('toner_mist') && !types.has('face_oil') && !types.has('mask')) types.add('moisturizer');
      break;
    case 'support':
      if (!types.has('eye_care') && !types.has('moisturizer')) types.add('serum');
      break;
    case 'weekly':
      if (!types.has('mask')) types.add('exfoliant');
      // Occasional-care products are not daily serums or moisturizers.
      types.delete('serum');
      types.delete('moisturizer');
      break;
  }

  // Cleansers that mention an acid are exfoliating cleansers, but a cleanser
  // never counts as a leave-on serum or moisturizer.
  if (source.routineSlot === 'cleanse') {
    types.delete('serum');
    types.delete('moisturizer');
  }
  // Sunscreens are moisturising by nature; keep the sunscreen type only.
  if (source.routineSlot === 'protect') {
    types.delete('moisturizer');
    types.delete('serum');
  }

  return PRODUCT_TYPE_VALUES.filter((type) => types.has(type));
}

export function matchesInterest(productTypes: readonly ProductType[] | undefined, interests: readonly ProductType[]): ProductType | null {
  if (!productTypes?.length || !interests.length) return null;
  for (const interest of interests) {
    if (productTypes.includes(interest)) return interest;
  }
  return null;
}

/** Who decided the shopping list: the person, or vAIne from the check-in. */
export type ProductInterestMode = 'manual' | 'auto';

export const MAX_SUGGESTED_TYPES = 4;

const TAG_VOTES: Partial<Record<SkinObservationTag, readonly ProductType[]>> = {
  'appearance.hydration_look_low': ['moisturizer', 'toner_mist'],
  'appearance.visible_redness': ['moisturizer'],
  'appearance.tone_uneven': ['brightening'],
  'appearance.texture_irregular': ['exfoliant', 'serum'],
  'appearance.pore_visibility_high': ['exfoliant', 'cleanser'],
  'appearance.fine_lines_visible': ['wrinkle_treatment'],
  'appearance.oiliness_visible': ['cleanser', 'exfoliant'],
  'appearance.dullness_visible': ['brightening', 'exfoliant'],
  'appearance.dark_circles_visible': ['eye_care'],
  'appearance.blemishes_visible': ['cleanser', 'exfoliant'],
  'appearance.sun_exposure_signs_visible': ['sunscreen', 'brightening'],
};

const GOAL_VOTES: Record<SkinAnalysis['routineGoals'][number], readonly ProductType[]> = {
  support_hydration_look: ['moisturizer'],
  support_even_tone_look: ['brightening'],
  support_smoother_texture_look: ['exfoliant', 'serum'],
  support_radiance_look: ['brightening'],
  support_comfort: ['moisturizer'],
  support_sun_protection_habit: ['sunscreen'],
};

/**
 * "Let vAIne pick": turns a validated check-in into a short shopping list.
 * Each observation tag and routine goal votes for the product types that
 * address it (a goal counts double); the most-voted types win, ties keep the vocabulary order, and
 * the list is capped so it stays a focus rather than the whole store.
 * Exfoliants are never suggested when redness is visible. The mapping is a
 * fixed table, so the same check-in always yields the same list.
 */
export function suggestProductTypes(analysis: Pick<SkinAnalysis, 'observationTags' | 'routineGoals'>): ProductType[] {
  const votes = new Map<ProductType, number>();
  const vote = (types: readonly ProductType[] | undefined, weight: number) => {
    for (const type of types ?? []) votes.set(type, (votes.get(type) ?? 0) + weight);
  };
  // Routine goals are the check-in's own priorities, so they count double.
  for (const tag of analysis.observationTags) vote(TAG_VOTES[tag], 1);
  for (const goal of analysis.routineGoals) vote(GOAL_VOTES[goal], 2);
  if (analysis.observationTags.includes('appearance.visible_redness')) votes.delete('exfoliant');

  return PRODUCT_TYPE_VALUES
    .filter((type) => (votes.get(type) ?? 0) > 0)
    .sort((left, right) => (votes.get(right) ?? 0) - (votes.get(left) ?? 0))
    .slice(0, MAX_SUGGESTED_TYPES);
}
