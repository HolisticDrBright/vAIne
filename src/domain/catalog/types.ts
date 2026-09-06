export type CatalogReviewState =
  | 'research_only'
  | 'identity_reviewed'
  | 'safety_reviewed'
  | 'catalog_approved';

export type CatalogSource = 'synthetic_prototype' | 'reviewed_research' | 'editorial';

export type ResearchDisposition =
  | 'exact_identity_candidate'
  | 'conflicting_official_sources'
  | 'probable_identity_needs_review'
  | 'ambiguous_identity'
  | 'insufficient_authoritative_evidence'
  | 'commercial_only'
  | 'unmatched'
  | 'discontinued_confirmed'
  | 'needs_physical_label';
