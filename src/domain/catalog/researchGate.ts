import { z } from 'zod';
import type { SkinObservationTag } from '../analysis/observationTaxonomy';
import type { ExclusionFlag, ProductCandidate, RoutineSlot } from '../recommendations/eligibility';
import type { CatalogReviewState, ResearchDisposition } from './types';

const researchDispositionSchema = z.enum([
  'exact_identity_candidate',
  'conflicting_official_sources',
  'probable_identity_needs_review',
  'ambiguous_identity',
  'insufficient_authoritative_evidence',
  'commercial_only',
  'unmatched',
  'discontinued_confirmed',
  'needs_physical_label',
]);

/**
 * Deliberately small Phase 9F boundary schema. Unknown source fields remain in
 * the research package; this app accepts only fields needed to make a gating
 * decision and does not copy the raw record into the consumer catalog.
 */
export const phase9FResearchRecordSchema = z.object({
  product_research_id: z.string().min(1),
  official_manufacturer: z.string().min(1).nullable(),
  official_product_name: z.string().min(1).nullable(),
  research_disposition: researchDispositionSchema,
  physical_label_required: z.boolean(),
  practitioner_decision_required: z.boolean(),
  jurisdiction_review_required: z.boolean(),
  discontinued_confirmed: z.boolean(),
  practitioner_verified: z.boolean(),
  clinically_approved: z.boolean(),
  imported: z.boolean(),
}).passthrough();

export interface ConsumerCatalogMapping {
  routineSlot: RoutineSlot;
  observationTags: readonly SkinObservationTag[];
  activeFamilies: readonly string[];
  ingredients: readonly string[];
  exclusionFlags: readonly ExclusionFlag[];
}

export interface StagedResearchProduct {
  productResearchId: string;
  brandName: string | null;
  productName: string | null;
  researchDisposition: ResearchDisposition;
  physicalLabelRequired: boolean;
  practitionerDecisionRequired: boolean;
  jurisdictionReviewRequired: boolean;
  discontinuedConfirmed: boolean;
  practitionerVerified: boolean;
  sourceClinicallyApproved: boolean;
  sourceImported: boolean;
  reviewState: CatalogReviewState;
  catalogApproved: boolean;
  consumerMapping: ConsumerCatalogMapping | null;
}

export type CatalogBlockReason =
  | 'identity_not_exact'
  | 'physical_label_required'
  | 'practitioner_decision_required'
  | 'jurisdiction_review_required'
  | 'discontinued'
  | 'not_practitioner_verified'
  | 'review_incomplete'
  | 'catalog_not_approved'
  | 'consumer_mapping_missing'
  | 'identity_fields_missing';

export function stagePhase9FResearchRecord(input: unknown): StagedResearchProduct {
  const parsed = phase9FResearchRecordSchema.parse(input);

  return {
    productResearchId: parsed.product_research_id,
    brandName: parsed.official_manufacturer,
    productName: parsed.official_product_name,
    researchDisposition: parsed.research_disposition,
    physicalLabelRequired: parsed.physical_label_required,
    practitionerDecisionRequired: parsed.practitioner_decision_required,
    jurisdictionReviewRequired: parsed.jurisdiction_review_required,
    discontinuedConfirmed: parsed.discontinued_confirmed,
    practitionerVerified: parsed.practitioner_verified,
    sourceClinicallyApproved: parsed.clinically_approved,
    sourceImported: parsed.imported,
    reviewState: 'research_only',
    catalogApproved: false,
    consumerMapping: null,
  };
}

export function assessCatalogPromotion(record: StagedResearchProduct): CatalogBlockReason[] {
  const reasons: CatalogBlockReason[] = [];

  if (record.researchDisposition !== 'exact_identity_candidate') reasons.push('identity_not_exact');
  if (record.physicalLabelRequired) reasons.push('physical_label_required');
  if (record.practitionerDecisionRequired) reasons.push('practitioner_decision_required');
  if (record.jurisdictionReviewRequired) reasons.push('jurisdiction_review_required');
  if (record.discontinuedConfirmed) reasons.push('discontinued');
  if (!record.practitionerVerified) reasons.push('not_practitioner_verified');
  if (record.reviewState !== 'catalog_approved') reasons.push('review_incomplete');
  if (!record.catalogApproved) reasons.push('catalog_not_approved');
  if (!record.consumerMapping) reasons.push('consumer_mapping_missing');
  if (!record.brandName || !record.productName) reasons.push('identity_fields_missing');

  return reasons;
}

export function promoteToConsumerCatalog(record: StagedResearchProduct): ProductCandidate | null {
  if (assessCatalogPromotion(record).length || !record.consumerMapping || !record.brandName || !record.productName) {
    return null;
  }

  return {
    id: record.productResearchId,
    brandName: record.brandName,
    productName: record.productName,
    verificationStatus: 'verified',
    catalogReviewState: 'catalog_approved',
    catalogSource: 'reviewed_research',
    ...record.consumerMapping,
  };
}
