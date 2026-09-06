import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { ProductCandidate, RoutineSlot } from './eligibility';
import { getAdvancedProductEvidence } from '../../data/advancedProductEvidence';

export type IngredientEvidenceGrade = 'strong' | 'moderate' | 'limited' | 'insufficient';

export interface IngredientEvidenceSource {
  id: string;
  label: string;
  url: string;
  evidenceType: 'randomized_trial' | 'systematic_review' | 'systematic_review_meta_analysis';
}

/**
 * Evidence applies to ingredient families or treatment categories, not to
 * every finished product that contains them. The distinction is deliberate:
 * a marketing claim or ingredient-list presence is not a product-level trial.
 */
export const INGREDIENT_EVIDENCE_SOURCES: readonly IngredientEvidenceSource[] = [
  { id: 'daily_sunscreen_rct', label: 'Daily sunscreen and prevention of skin aging', url: 'https://pubmed.ncbi.nlm.nih.gov/23732711/', evidenceType: 'randomized_trial' },
  { id: 'retinoid_photoaging_review', label: 'Topical retinoids for facial photoaging', url: 'https://pubmed.ncbi.nlm.nih.gov/39348007/', evidenceType: 'systematic_review' },
  { id: 'retinol_photoaging_review', label: 'Topical retinoids in the management of photoaging', url: 'https://pubmed.ncbi.nlm.nih.gov/35620028/', evidenceType: 'systematic_review' },
  { id: 'glycolic_acid_rct', label: 'Glycolic acid treatment of photodamaged skin', url: 'https://pubmed.ncbi.nlm.nih.gov/8651713/', evidenceType: 'randomized_trial' },
  { id: 'salicylic_acid_review', label: 'Salicylic acid evidence for acne', url: 'https://pubmed.ncbi.nlm.nih.gov/33034949/', evidenceType: 'systematic_review' },
  { id: 'niacinamide_split_face_rct', label: 'Topical niacinamide for aging facial skin', url: 'https://pubmed.ncbi.nlm.nih.gov/18492135/', evidenceType: 'randomized_trial' },
  { id: 'azelaic_acid_review', label: 'Azelaic acid for acne, rosacea and pigmentation', url: 'https://pubmed.ncbi.nlm.nih.gov/37550898/', evidenceType: 'systematic_review' },
  { id: 'vitamin_c_review', label: 'Topical vitamin C and wrinkle appearance', url: 'https://pubmed.ncbi.nlm.nih.gov/37683066/', evidenceType: 'systematic_review' },
  { id: 'bakuchiol_retinol_rct', label: 'Bakuchiol compared with retinol for photoaging', url: 'https://pubmed.ncbi.nlm.nih.gov/29947134/', evidenceType: 'randomized_trial' },
  { id: 'ceramide_barrier_rct', label: 'Ceramide-dominant cleanser and moisturizer regimen', url: 'https://pubmed.ncbi.nlm.nih.gov/33984185/', evidenceType: 'randomized_trial' },
  { id: 'topical_ha_review', label: 'Topical hyaluronic acid for hydration and skin aging', url: 'https://pubmed.ncbi.nlm.nih.gov/36200921/', evidenceType: 'systematic_review' },
  { id: 'peptide_meta_analysis', label: 'Peptides for skin aging', url: 'https://pubmed.ncbi.nlm.nih.gov/41924746/', evidenceType: 'systematic_review_meta_analysis' },
  { id: 'growth_factor_review', label: 'Topical growth factors for facial rejuvenation', url: 'https://pubmed.ncbi.nlm.nih.gov/37222303/', evidenceType: 'systematic_review' },
  { id: 'exosome_review', label: 'Extracellular-vesicle therapies for facial rejuvenation', url: 'https://pubmed.ncbi.nlm.nih.gov/42487416/', evidenceType: 'systematic_review' },
  { id: 'tranexamic_acid_review', label: 'Topical tranexamic acid for melasma', url: 'https://pubmed.ncbi.nlm.nih.gov/38843906/', evidenceType: 'systematic_review' },
] as const;

type AppearanceScores = Partial<Record<SkinObservationTag, number>>;

interface EvidenceRule {
  id: string;
  label: string;
  pattern: RegExp;
  scores: AppearanceScores;
  sourceIds: readonly string[];
  routineSlots?: readonly RoutineSlot[];
}

const RULES: readonly EvidenceRule[] = [
  {
    id: 'uv_filters',
    label: 'UV-filter ingredient family in a reviewed protection product',
    pattern: /\b(zinc oxide|titanium dioxide|avobenzone|octocrylene|homosalate|octisalate|octinoxate|bemotrizinol|bisoctrizole|ecamsule)\b/i,
    scores: { 'appearance.sun_exposure_signs_visible': 94 },
    sourceIds: ['daily_sunscreen_rct'],
    routineSlots: ['protect'],
  },
  {
    id: 'retinal',
    label: 'retinal/retinaldehyde',
    pattern: /\bretinal(?:dehyde)?\b/i,
    scores: {
      'appearance.fine_lines_visible': 87,
      'appearance.texture_irregular': 82,
      'appearance.tone_uneven': 72,
      'appearance.sun_exposure_signs_visible': 76,
    },
    sourceIds: ['retinoid_photoaging_review', 'retinol_photoaging_review'],
  },
  {
    id: 'retinol',
    label: 'retinol/retinyl ingredient family',
    pattern: /\bretinol\b|\bretinyl\s+(palmitate|propionate|retinoate)\b/i,
    scores: {
      'appearance.fine_lines_visible': 82,
      'appearance.texture_irregular': 78,
      'appearance.tone_uneven': 68,
      'appearance.sun_exposure_signs_visible': 72,
    },
    sourceIds: ['retinoid_photoaging_review', 'retinol_photoaging_review'],
  },
  {
    id: 'azelaic_acid',
    label: 'azelaic acid',
    pattern: /\bazelaic acid\b/i,
    scores: {
      'appearance.visible_redness': 84,
      'appearance.blemishes_visible': 84,
      'appearance.tone_uneven': 78,
      'appearance.texture_irregular': 64,
    },
    sourceIds: ['azelaic_acid_review'],
  },
  {
    id: 'salicylic_acid',
    label: 'salicylic acid/BHA',
    pattern: /\bsalicylic acid\b|\bbha\b/i,
    scores: {
      'appearance.blemishes_visible': 78,
      'appearance.pore_visibility_high': 72,
      'appearance.oiliness_visible': 72,
      'appearance.texture_irregular': 65,
    },
    sourceIds: ['salicylic_acid_review'],
  },
  {
    id: 'alpha_hydroxy_acids',
    label: 'alpha-hydroxy acid',
    pattern: /\b(glycolic|lactic|mandelic) acid\b|\baha\b/i,
    scores: {
      'appearance.texture_irregular': 76,
      'appearance.dullness_visible': 72,
      'appearance.tone_uneven': 66,
      'appearance.fine_lines_visible': 58,
    },
    sourceIds: ['glycolic_acid_rct'],
  },
  {
    id: 'niacinamide',
    label: 'niacinamide/nicotinamide',
    pattern: /\b(niacinamide|nicotinamide)\b/i,
    scores: {
      'appearance.tone_uneven': 76,
      'appearance.visible_redness': 72,
      'appearance.pore_visibility_high': 68,
      'appearance.oiliness_visible': 66,
      'appearance.hydration_look_low': 64,
      'appearance.fine_lines_visible': 62,
    },
    sourceIds: ['niacinamide_split_face_rct'],
  },
  {
    id: 'ascorbic_acid',
    label: 'ascorbic acid/vitamin C',
    pattern: /\b(ascorbic acid|l-ascorbic acid|vitamin c)\b/i,
    scores: {
      'appearance.dullness_visible': 75,
      'appearance.tone_uneven': 72,
      'appearance.fine_lines_visible': 66,
      'appearance.sun_exposure_signs_visible': 62,
    },
    sourceIds: ['vitamin_c_review'],
  },
  {
    id: 'vitamin_c_derivatives',
    label: 'vitamin C derivative',
    pattern: /\b(ascorbyl|tetrahexyldecyl ascorbate|3-o-ethyl ascorbic acid)\b/i,
    scores: {
      'appearance.dullness_visible': 62,
      'appearance.tone_uneven': 60,
      'appearance.fine_lines_visible': 52,
    },
    sourceIds: ['vitamin_c_review'],
  },
  {
    id: 'bakuchiol',
    label: 'bakuchiol',
    pattern: /\bbakuchiol\b/i,
    scores: {
      'appearance.fine_lines_visible': 70,
      'appearance.tone_uneven': 68,
      'appearance.texture_irregular': 64,
    },
    sourceIds: ['bakuchiol_retinol_rct'],
  },
  {
    id: 'ceramides',
    label: 'ceramide/barrier-lipid family',
    pattern: /\bceramide\b|\bcholesterol\b|\bphytosphingosine\b/i,
    scores: {
      'appearance.hydration_look_low': 78,
      'appearance.visible_redness': 66,
      'appearance.texture_irregular': 58,
    },
    sourceIds: ['ceramide_barrier_rct'],
  },
  {
    id: 'hyaluronic_acid',
    label: 'hyaluronic acid/hyaluronate',
    pattern: /\b(hyaluronic acid|hyaluronate|hyaluronan)\b/i,
    scores: {
      'appearance.hydration_look_low': 68,
      'appearance.fine_lines_visible': 48,
    },
    sourceIds: ['topical_ha_review'],
  },
  {
    id: 'humectant_barrier_support',
    label: 'established humectant/barrier support',
    pattern: /\b(glycerin|glycerol|urea|panthenol|squalane|beta-glucan|colloidal oatmeal)\b/i,
    scores: {
      'appearance.hydration_look_low': 62,
      'appearance.visible_redness': 48,
      'appearance.texture_irregular': 44,
    },
    sourceIds: ['ceramide_barrier_rct'],
  },
  {
    id: 'tranexamic_acid',
    label: 'tranexamic acid',
    pattern: /\btranexamic acid\b/i,
    scores: {
      'appearance.tone_uneven': 70,
      'appearance.dullness_visible': 54,
      'appearance.sun_exposure_signs_visible': 50,
    },
    sourceIds: ['tranexamic_acid_review'],
  },
  {
    id: 'other_pigment_support',
    label: 'other pigment-support ingredient family',
    pattern: /\b(alpha arbutin|arbutin|kojic acid|licorice root|glabridin)\b/i,
    scores: {
      'appearance.tone_uneven': 54,
      'appearance.dullness_visible': 46,
      'appearance.sun_exposure_signs_visible': 38,
    },
    sourceIds: [],
  },
  {
    id: 'peptides',
    label: 'topical peptide family',
    pattern: /\b(peptide|palmitoyl|matrixyl|argireline|ghk-cu|copper tripeptide)\b/i,
    scores: {
      'appearance.fine_lines_visible': 54,
      'appearance.hydration_look_low': 48,
      'appearance.texture_irregular': 46,
    },
    sourceIds: ['peptide_meta_analysis'],
  },
  {
    id: 'growth_factors',
    label: 'topical growth-factor family',
    pattern: /\b(growth factor|conditioned media|cytokine)\b/i,
    scores: {
      'appearance.fine_lines_visible': 48,
      'appearance.texture_irregular': 46,
      'appearance.dullness_visible': 40,
    },
    sourceIds: ['growth_factor_review'],
  },
  {
    id: 'exosomes',
    label: 'topical exosome/extracellular-vesicle family',
    pattern: /\b(exosome|extracellular vesicle)\b/i,
    scores: {
      'appearance.fine_lines_visible': 40,
      'appearance.texture_irregular': 38,
      'appearance.tone_uneven': 34,
    },
    sourceIds: ['exosome_review'],
  },
  {
    id: 'caffeine',
    label: 'caffeine',
    pattern: /\bcaffeine\b/i,
    scores: { 'appearance.dark_circles_visible': 44 },
    sourceIds: [],
  },
  {
    id: 'oil_absorbing',
    label: 'oil-absorbing clay/charcoal',
    pattern: /\b(kaolin|bentonite|charcoal)\b/i,
    scores: {
      'appearance.oiliness_visible': 42,
      'appearance.pore_visibility_high': 34,
      'appearance.blemishes_visible': 30,
    },
    sourceIds: [],
  },
];

export interface EvidenceProductInput {
  id?: string;
  productName: string;
  category?: string | null;
  routineSlot?: RoutineSlot | null;
  ingredients: readonly string[];
  observationTags: readonly SkinObservationTag[];
}

export interface ProductEvidenceAssessment {
  /** 0–100 ingredient-evidence score for the requested appearance goals. */
  effectivenessScore: number;
  grade: IngredientEvidenceGrade;
  perTagScores: Partial<Record<SkinObservationTag, number>>;
  matchedSignals: readonly string[];
  sourceIds: readonly string[];
  basis: 'ingredient_evidence_not_product_trial' | 'ingredient_and_product_specific_review';
}

export const ingredientEvidenceGradeLabels: Record<IngredientEvidenceGrade, string> = {
  strong: 'Strong ingredient evidence',
  moderate: 'Moderate ingredient evidence',
  limited: 'Limited ingredient evidence',
  insufficient: 'Insufficient ingredient evidence',
};

function gradeFor(score: number): IngredientEvidenceGrade {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'moderate';
  if (score >= 35) return 'limited';
  return 'insufficient';
}

export function assessProductEvidence(
  product: EvidenceProductInput | ProductCandidate,
  requestedTags: readonly SkinObservationTag[] = product.observationTags,
): ProductEvidenceAssessment {
  const ingredientText = product.ingredients.join(' ');
  const perTagScores: Partial<Record<SkinObservationTag, number>> = {};
  const matchedSignals: string[] = [];
  const sourceIds = new Set<string>();
  const advancedReview = getAdvancedProductEvidence('id' in product ? product.id : undefined);

  for (const rule of RULES) {
    if (rule.routineSlots && (!product.routineSlot || !rule.routineSlots.includes(product.routineSlot))) continue;
    if (!rule.pattern.test(ingredientText)) continue;
    matchedSignals.push(rule.label);
    for (const [tag, score] of Object.entries(rule.scores) as [SkinObservationTag, number][]) {
      perTagScores[tag] = Math.max(perTagScores[tag] ?? 0, score);
    }
    rule.sourceIds.forEach((sourceId) => sourceIds.add(sourceId));
  }

  const relevantTags = [...new Set(requestedTags.filter((tag) => tag !== 'referral.consider_professional_review'))];
  const rawScores = relevantTags.map((tag) => perTagScores[tag] ?? (product.observationTags.includes(tag) ? 20 : 0));
  let effectivenessScore = rawScores.length
    ? Math.round(rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length)
    : 0;

  // Rinse-off formulas have shorter contact time; do not score an active as if
  // it were delivered by an otherwise comparable leave-on formulation.
  if (product.routineSlot === 'cleanse') effectivenessScore = Math.round(effectivenessScore * 0.75);

  if (advancedReview) {
    for (const tag of relevantTags) {
      const floor = advancedReview.scoreFloorByTag[tag];
      if (floor !== undefined) {
        perTagScores[tag] = Math.max(perTagScores[tag] ?? 0, floor);
      }
    }
    const reviewedScores = relevantTags.map((tag) => perTagScores[tag] ?? (product.observationTags.includes(tag) ? 20 : 0));
    effectivenessScore = reviewedScores.length
      ? Math.round(reviewedScores.reduce((sum, score) => sum + score, 0) / reviewedScores.length)
      : effectivenessScore;
    matchedSignals.push(advancedReview.label);
  }

  return {
    effectivenessScore,
    grade: gradeFor(effectivenessScore),
    perTagScores,
    matchedSignals,
    sourceIds: [...sourceIds],
    basis: advancedReview ? 'ingredient_and_product_specific_review' : 'ingredient_evidence_not_product_trial',
  };
}

export function evidenceSourceById(id: string): IngredientEvidenceSource | null {
  return INGREDIENT_EVIDENCE_SOURCES.find((source) => source.id === id) ?? null;
}
