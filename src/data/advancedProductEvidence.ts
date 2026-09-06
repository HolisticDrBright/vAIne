import type { SkinObservationTag } from '@/domain/analysis/observationTaxonomy';

export type AdvancedEvidenceCategory = 'peptide' | 'extracellular_vesicle' | 'conditioned_media';
export type AdvancedEvidenceTier = 'product_human_evidence' | 'characterized_source' | 'source_disclosed' | 'limited_public_detail';

export interface AdvancedProductEvidenceReview {
  productId: string;
  category: AdvancedEvidenceCategory;
  tier: AdvancedEvidenceTier;
  /** A conservative floor, not a claim that products or studies are interchangeable. */
  scoreFloorByTag: Partial<Record<SkinObservationTag, number>>;
  label: string;
  summary: string;
  limitations: string;
  sourceUrls: readonly string[];
  reviewedAtIso: string;
}

const REVIEWED_AT = '2026-09-06T00:00:00.000Z';

/**
 * Product-specific research for newer peptide and extracellular-vesicle
 * products. This is intentionally separate from affiliate links and prices.
 * A higher price, particle-count claim, or brand claim never creates a higher
 * tier by itself.
 */
export const ADVANCED_PRODUCT_EVIDENCE: Readonly<Record<string, AdvancedProductEvidenceReview>> = {
  'healthgevity-facegevity': {
    productId: 'healthgevity-facegevity',
    category: 'peptide',
    tier: 'characterized_source',
    scoreFloorByTag: {
      'appearance.fine_lines_visible': 64,
      'appearance.texture_irregular': 58,
      'appearance.hydration_look_low': 55,
    },
    label: 'Premium peptide option · ingredient-level human evidence',
    summary: 'Discloses 3% GHK-Cu plus PeptiYouth and complementary signal peptides. PeptiYouth has a manufacturer-reported double-blind, placebo-controlled human ingredient study.',
    limitations: 'FACEgevity is not an exosome product. A peer-reviewed trial of the complete FACEgevity formula was not located, and its complete printed INCI and independent safety review remain pending.',
    sourceUrls: [
      'https://healthgev.com/products/facegevity',
      'https://www.nuritas.com/products/peptiyouth/',
    ],
    reviewedAtIso: REVIEWED_AT,
  },
  'plated-skin-science-intense-serum': {
    productId: 'plated-skin-science-intense-serum',
    category: 'extracellular_vesicle',
    tier: 'product_human_evidence',
    scoreFloorByTag: {
      'appearance.fine_lines_visible': 58,
      'appearance.texture_irregular': 55,
      'appearance.tone_uneven': 52,
      'appearance.visible_redness': 50,
      'appearance.dullness_visible': 48,
    },
    label: 'Best documented EV option in this catalog',
    summary: 'Platelet-derived source, quantified product, and a published prospective finished-product human study with objective imaging.',
    limitations: 'The finished-product study was small, single-arm, and non-randomized, with company-affiliated authors. Evidence for topical EV skincare overall remains low-certainty and heterogeneous.',
    sourceUrls: [
      'https://platedskinscience.com/products/intense-serum',
      'https://pubmed.ncbi.nlm.nih.gov/35689936/',
    ],
    reviewedAtIso: REVIEWED_AT,
  },
  'young-goose-vampire-exosomes': {
    productId: 'young-goose-vampire-exosomes',
    category: 'extracellular_vesicle',
    tier: 'characterized_source',
    scoreFloorByTag: {
      'appearance.fine_lines_visible': 48,
      'appearance.texture_irregular': 46,
      'appearance.tone_uneven': 42,
      'appearance.visible_redness': 40,
    },
    label: 'Strong batch disclosure · finished-product evidence unverified',
    summary: 'Discloses a platelet-derived source, NTA particle count and size checks, donor screening, sterility/endotoxin testing, residual DNA/protein checks, and stability testing.',
    limitations: 'The disclosed 3-trillion count cannot be compared directly with another brand without matched methods, dose, purity, stability, and outcome studies. No peer-reviewed finished-product human trial was located.',
    sourceUrls: ['https://www.younggoose.com/products/vampire-exosomes'],
    reviewedAtIso: REVIEWED_AT,
  },
  'vitali-vita-zero-age-exosome-complex': {
    productId: 'vitali-vita-zero-age-exosome-complex',
    category: 'conditioned_media',
    tier: 'source_disclosed',
    scoreFloorByTag: {
      'appearance.fine_lines_visible': 42,
      'appearance.texture_irregular': 40,
      'appearance.hydration_look_low': 40,
    },
    label: 'Conditioned-media formula · limited EV characterization',
    summary: 'Discloses human umbilical mesenchymal stem-cell conditioned-media filtrate alongside peptides, ceramides, vitamin C derivatives, niacinamide, and humectants.',
    limitations: 'A public particle count, size distribution, EV-marker/purity panel, batch certificate, and peer-reviewed finished-product human trial were not located. Conditioned media is a mixture and is not equivalent to a purified EV preparation.',
    sourceUrls: ['https://www.vitaliskincare.com/products/vita-human-stem-cell-derived-exosomes-for-topcial-application'],
    reviewedAtIso: REVIEWED_AT,
  },
  'calecim-professional-serum': {
    productId: 'calecim-professional-serum',
    category: 'conditioned_media',
    tier: 'limited_public_detail',
    scoreFloorByTag: {
      'appearance.fine_lines_visible': 40,
      'appearance.texture_irregular': 38,
    },
    label: 'Growth-factor/conditioned-media blend · limited EV detail',
    summary: 'The PTT-6 blend is described as umbilical-cord-lining stem-cell conditioned material containing proteins, growth factors, cytokines, and exosomes.',
    limitations: 'The public product page does not provide a comparable EV particle count, full characterization/purity panel, or a randomized finished-product daily-use trial. Post-procedure use should follow a treating professional, not an automated routine.',
    sourceUrls: ['https://calecimprofessional.com/products/professional-serum-5ml-us'],
    reviewedAtIso: REVIEWED_AT,
  },
};

export const advancedEvidenceTierLabels: Record<AdvancedEvidenceTier, string> = {
  product_human_evidence: 'Finished-product human evidence',
  characterized_source: 'Characterized source or studied hero ingredient',
  source_disclosed: 'Biological source disclosed',
  limited_public_detail: 'Limited comparable public detail',
};

const tierRank: Record<AdvancedEvidenceTier, number> = {
  product_human_evidence: 0,
  characterized_source: 1,
  source_disclosed: 2,
  limited_public_detail: 3,
};

export function advancedEvidenceTierRank(review: AdvancedProductEvidenceReview | null): number {
  return review ? tierRank[review.tier] : Number.MAX_SAFE_INTEGER;
}

export function advancedEvidenceGroupLabel(review: AdvancedProductEvidenceReview): string {
  return review.category === 'peptide' ? 'peptide' : 'EV / conditioned-media';
}

export function getAdvancedProductEvidence(productId: string | undefined): AdvancedProductEvidenceReview | null {
  return productId ? ADVANCED_PRODUCT_EVIDENCE[productId] ?? null : null;
}
