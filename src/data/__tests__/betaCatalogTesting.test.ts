import { describe, expect, test } from 'vitest';
import generatedEntries from '../consumerCatalog.generated.json';
import { applyBetaCatalogTestingOverride } from '../betaCatalogTesting';
import { catalogEntrySchema } from '../../domain/catalog/catalogEntry';

const row = (productId: string) => {
  const found = generatedEntries.find((entry) => entry.productId === productId);
  if (!found) throw new Error(`missing fixture ${productId}`);
  return found;
};
const overridden = (productId: string) => catalogEntrySchema.parse(applyBetaCatalogTestingOverride(row(productId)));

describe('TestFlight catalog override', () => {
  test('previews a face sunscreen still under review, with a Drug Facts reminder', () => {
    for (const id of ['oneskin-os-01-shield-spf-30', 'the-inkey-list-polyglutamic-acid-daily-sunscreen-spf-30', 'versed-guards-up-daily-mineral-sunscreen-spf-35']) {
      const entry = overridden(id);
      expect(entry.evidenceReviewStatus, id).toBe('approved');
      expect(entry.catalogState, id).toBe('research_only');
      expect(entry.blocker, id).toBeNull();
      expect(entry.sourceNotes?.notes, id).toMatch(/over-the-counter drug/);
      expect(entry.sourceNotes?.notes, id).toMatch(/Drug Facts panel/);
    }
  });

  test('keeps sunscreens whose review recorded a blocker, body sunscreens, and bundles out', () => {
    expect(overridden('young-goose-bio-shield-spf-40').catalogState).toBe('blocked');
    expect(overridden('revision-skincare-intellishade-truphysical-spf-45').catalogState).toBe('blocked');
    expect(overridden('oneskin-os-01-body-spf').evidenceReviewStatus).toBe('pending');
    expect(overridden('sky-and-sol-face-and-body-sunscreen-spf-50').evidenceReviewStatus).toBe('pending');
    expect(overridden('vitali-copper-peptide-bundle-best-seller').catalogState).toBe('blocked');
  });

  test('does not add the sunscreen reminder to other topicals', () => {
    const serum = overridden('vitali-2-pct-ghk-cu-skin-cell-restorative-serum');
    expect(serum.sourceNotes?.notes ?? '').not.toMatch(/over-the-counter/);
  });
});
