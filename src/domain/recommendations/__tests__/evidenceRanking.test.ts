import { describe, expect, test } from 'vitest';
import generatedEntries from '../../../data/consumerCatalog.generated.json';
import { catalogEntrySchema } from '../../catalog/catalogEntry';
import { assessProductEvidence, INGREDIENT_EVIDENCE_SOURCES } from '../evidenceRanking';

const makeProduct = (ingredients: readonly string[], routineSlot: 'support' | 'cleanse' = 'support') => ({
  productName: 'Evidence example',
  category: 'Serum',
  routineSlot,
  ingredients,
  observationTags: ['appearance.fine_lines_visible'] as const,
});

describe('ingredient evidence ranking', () => {
  test('scores a leave-on retinoid above a peptide-only formula for fine lines', () => {
    const retinol = assessProductEvidence(makeProduct(['Water', 'Retinol']), ['appearance.fine_lines_visible']);
    const peptide = assessProductEvidence(makeProduct(['Water', 'Palmitoyl Tripeptide-1']), ['appearance.fine_lines_visible']);

    expect(retinol.effectivenessScore).toBeGreaterThan(peptide.effectivenessScore);
    expect(retinol.sourceIds).toContain('retinoid_photoaging_review');
    expect(peptide.sourceIds).toContain('peptide_meta_analysis');
  });

  test('reduces the score for a rinse-off formula with the same active', () => {
    const leaveOn = assessProductEvidence(makeProduct(['Retinol']), ['appearance.fine_lines_visible']);
    const rinseOff = assessProductEvidence(makeProduct(['Retinol'], 'cleanse'), ['appearance.fine_lines_visible']);
    expect(rinseOff.effectivenessScore).toBeLessThan(leaveOn.effectivenessScore);
  });

  test('places FACEgevity high within peptides without calling it an exosome or finished-formula trial', () => {
    const generic = assessProductEvidence({
      ...makeProduct(['GHK-Cu', 'Peptide']),
      id: 'generic-peptide',
    }, ['appearance.fine_lines_visible']);
    const facegevity = assessProductEvidence({
      ...makeProduct(['GHK-Cu (3%)', 'PeptiYouth', 'Acetyl Hexapeptide-8']),
      id: 'healthgevity-facegevity',
    }, ['appearance.fine_lines_visible']);

    expect(facegevity.effectivenessScore).toBeGreaterThan(generic.effectivenessScore);
    expect(facegevity.matchedSignals.join(' ')).toMatch(/premium peptide/i);
    expect(facegevity.matchedSignals.join(' ')).not.toMatch(/exosome/i);
    expect(facegevity.basis).toBe('ingredient_and_product_specific_review');
  });

  test('does not treat a non-sunscreen product as sun protection merely because it lists a UV filter', () => {
    const support = assessProductEvidence({
      productName: 'Night cream example',
      category: 'Night cream',
      routineSlot: 'support',
      ingredients: ['Zinc Oxide'],
      observationTags: ['appearance.sun_exposure_signs_visible'],
    });
    const sunscreen = assessProductEvidence({
      productName: 'Sunscreen example',
      category: 'Sunscreen',
      routineSlot: 'protect',
      ingredients: ['Zinc Oxide'],
      observationTags: ['appearance.sun_exposure_signs_visible'],
    });

    expect(support.effectivenessScore).toBe(20);
    expect(sunscreen.effectivenessScore).toBe(94);
  });

  test('assesses every imported catalog row without inventing product-level proof', () => {
    expect(INGREDIENT_EVIDENCE_SOURCES.length).toBeGreaterThanOrEqual(10);

    for (const row of generatedEntries) {
      const entry = catalogEntrySchema.parse(row);
      const assessment = assessProductEvidence({
        productName: entry.productName,
        category: entry.category,
        routineSlot: entry.routineSlot,
        ingredients: entry.keyIngredients,
        observationTags: entry.skinConcernTags,
      });

      expect(assessment.effectivenessScore).toBeGreaterThanOrEqual(0);
      expect(assessment.effectivenessScore).toBeLessThanOrEqual(100);
      expect(assessment.basis).toBe('ingredient_evidence_not_product_trial');
    }
  });
});
