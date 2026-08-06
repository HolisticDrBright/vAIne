import { describe, expect, test } from 'vitest';
import { assessCatalogPromotion, promoteToConsumerCatalog, stagePhase9FResearchRecord } from '../researchGate';

const phase9FRecord = {
  product_research_id: 'research-synthetic-1',
  official_manufacturer: 'Synthetic Research Brand',
  official_product_name: 'Synthetic Research Product',
  research_disposition: 'exact_identity_candidate',
  physical_label_required: true,
  practitioner_decision_required: true,
  jurisdiction_review_required: false,
  discontinued_confirmed: false,
  practitioner_verified: false,
  clinically_approved: false,
  imported: false,
};

describe('Phase 9F catalog gate', () => {
  test('stages every source record as quarantined research', () => {
    const staged = stagePhase9FResearchRecord(phase9FRecord);
    expect(staged.reviewState).toBe('research_only');
    expect(staged.catalogApproved).toBe(false);
    expect(staged.consumerMapping).toBeNull();
  });

  test('blocks direct promotion of Phase 9F research', () => {
    const staged = stagePhase9FResearchRecord(phase9FRecord);
    expect(assessCatalogPromotion(staged)).toEqual(expect.arrayContaining([
      'physical_label_required',
      'practitioner_decision_required',
      'not_practitioner_verified',
      'review_incomplete',
      'catalog_not_approved',
      'consumer_mapping_missing',
    ]));
    expect(promoteToConsumerCatalog(staged)).toBeNull();
  });

  test('promotes only after every independent review gate is complete', () => {
    const staged = stagePhase9FResearchRecord({
      ...phase9FRecord,
      physical_label_required: false,
      practitioner_decision_required: false,
      practitioner_verified: true,
    });
    const reviewed = {
      ...staged,
      reviewState: 'catalog_approved' as const,
      catalogApproved: true,
      consumerMapping: {
        routineSlot: 'hydrate' as const,
        listPriceCents: 3200,
        currencyCode: 'USD',
        priceVerifiedAtIso: '2026-08-05T12:00:00.000Z',
        observationTags: ['appearance.hydration_look_low'] as const,
        activeFamilies: ['synthetic-family'],
        ingredients: ['synthetic ingredient'],
        exclusionFlags: [],
      },
    };

    expect(assessCatalogPromotion(reviewed)).toEqual([]);
    expect(promoteToConsumerCatalog(reviewed)).toMatchObject({
      id: 'research-synthetic-1',
      catalogReviewState: 'catalog_approved',
      catalogSource: 'reviewed_research',
    });
  });
});
