import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  MAX_SUGGESTED_TYPES,
  PRODUCT_TYPE_OPTIONS,
  PRODUCT_TYPE_VALUES,
  deriveProductTypes,
  describeProductType,
  matchesInterest,
  suggestProductTypes,
} from '../productTypes';

describe('product type vocabulary', () => {
  test('every type has one option with consumer wording', () => {
    expect(PRODUCT_TYPE_OPTIONS.map((option) => option.value)).toEqual([...PRODUCT_TYPE_VALUES]);
    for (const option of PRODUCT_TYPE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(2);
      expect(option.hint.length).toBeGreaterThan(5);
    }
    expect(describeProductType('wrinkle_treatment')).toBe('Wrinkle / fine-line treatment');
  });
});

describe('deriveProductTypes', () => {
  test('tags the everyday categories from the reviewed list', () => {
    expect(deriveProductTypes({ productName: 'The Pearl Cleanser', category: 'Cleanser', routineSlot: 'cleanse' })).toEqual(['cleanser']);
    expect(deriveProductTypes({ productName: 'Gentle Exfoliating Cleanser', category: 'Cleanser', routineSlot: 'cleanse' })).toEqual(['cleanser', 'exfoliant']);
    expect(deriveProductTypes({ productName: 'The Night Cream', category: 'Moisturizer / Repair', routineSlot: 'hydrate' })).toEqual(['moisturizer']);
    expect(deriveProductTypes({ productName: 'BIO-SHIELD SPF 40', category: 'Sunscreen', routineSlot: 'protect' })).toEqual(['sunscreen']);
    expect(deriveProductTypes({ productName: 'HYPERBARIC MASK', category: 'Mask / Treatment', routineSlot: 'weekly' })).toEqual(['mask']);
    expect(deriveProductTypes({ productName: 'The Meteorite Facial Scrub', category: 'Physical/Chemical Exfoliant', routineSlot: 'weekly' })).toEqual(['exfoliant']);
    expect(deriveProductTypes({ productName: "Angel's Mist Facial Toner", category: 'Toner', routineSlot: 'hydrate' })).toEqual(['toner_mist']);
    expect(deriveProductTypes({ productName: '2% Bakuchiol Facial Oil', category: 'Retinol Alternative / Oil', routineSlot: 'hydrate' })).toEqual(['wrinkle_treatment', 'face_oil']);
  });

  test('recognises wrinkle, brightening, and eye treatments by name and active family', () => {
    expect(deriveProductTypes({ productName: 'Clinical 1% Retinol Treatment', category: 'Mid tier', routineSlot: 'support' })).toEqual(['wrinkle_treatment', 'serum']);
    expect(deriveProductTypes({ productName: 'Glow Maker Vitamin C Serum', category: 'Mid tier', routineSlot: 'support' })).toEqual(['serum', 'brightening']);
    expect(deriveProductTypes({ productName: 'EYEC.A.R.E.', category: 'Eye Care', routineSlot: 'support' })).toContain('eye_care');
    expect(deriveProductTypes({ productName: 'OS-01 EYE', category: 'Other Verified / To Expand', routineSlot: 'support' })).toEqual(['wrinkle_treatment', 'eye_care']);
    expect(deriveProductTypes({ productName: 'Ceramide Barrier Serum', category: 'Budget tier', routineSlot: 'support', activeFamilies: ['peptide'] })).toEqual(['wrinkle_treatment', 'serum']);
  });

  test('a routine slot supplies a default so brand coinages stay findable', () => {
    expect(deriveProductTypes({ productName: 'Cleansing Complex', routineSlot: 'cleanse' })).toEqual(['cleanser']);
    expect(deriveProductTypes({ productName: 'OS-01 FACE', category: 'Other Verified / To Expand', routineSlot: 'hydrate' })).toEqual(['moisturizer', 'wrinkle_treatment']);
    expect(deriveProductTypes({ productName: 'Everyday Gentle Cleanse Sample', routineSlot: 'cleanse' })).toEqual(['cleanser']);
    expect(deriveProductTypes({ productName: 'Daily Protection Sample', routineSlot: 'protect' })).toEqual(['sunscreen']);
  });

  test('ingredient families only count for leave-on treatment steps', () => {
    expect(deriveProductTypes({ productName: 'Foaming Wash', routineSlot: 'cleanse', activeFamilies: ['niacinamide', 'peptide'] })).toEqual(['cleanser']);
    expect(deriveProductTypes({ productName: 'Overnight Cream', routineSlot: 'hydrate', activeFamilies: ['niacinamide'] })).toEqual(['moisturizer', 'brightening']);
  });

  test('keeps a toning solution an exfoliant and leaves lip care untyped', () => {
    expect(deriveProductTypes({ productName: 'Glycolic Acid 7% Toning Solution', category: 'Budget tier', routineSlot: 'weekly' })).toEqual(['exfoliant']);
    expect(deriveProductTypes({ productName: 'ADAPTOGLOSS', category: 'Lip Treatment', routineSlot: 'support', activeFamilies: ['peptide', 'uv-filter'] })).toEqual([]);
  });
});

describe('matchesInterest', () => {
  test('returns the first wanted type the product carries', () => {
    expect(matchesInterest(['cleanser', 'exfoliant'], ['exfoliant', 'cleanser'])).toBe('exfoliant');
    expect(matchesInterest(['serum'], ['cleanser'])).toBeNull();
    expect(matchesInterest(undefined, ['cleanser'])).toBeNull();
    expect(matchesInterest(['cleanser'], [])).toBeNull();
  });
});

describe('suggestProductTypes (let vAIne pick)', () => {
  test('turns the sample check-in into a short, deterministic shopping list', () => {
    const suggested = suggestProductTypes(syntheticSkinAnalysis);
    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.length).toBeLessThanOrEqual(MAX_SUGGESTED_TYPES);
    expect(suggested).toContain('moisturizer');
    expect(suggested).toContain('exfoliant');
    expect(suggested).toContain('sunscreen');
    expect(suggestProductTypes(syntheticSkinAnalysis)).toEqual(suggested);
  });

  test('ranks the most-supported types first and never exceeds the cap', () => {
    const suggested = suggestProductTypes({
      observationTags: [
        'appearance.fine_lines_visible',
        'appearance.dark_circles_visible',
        'appearance.tone_uneven',
        'appearance.dullness_visible',
        'appearance.sun_exposure_signs_visible',
        'appearance.hydration_look_low',
      ],
      routineGoals: ['support_even_tone_look', 'support_radiance_look', 'support_hydration_look'],
    });
    expect(suggested).toHaveLength(MAX_SUGGESTED_TYPES);
    expect(suggested[0]).toBe('brightening');
    expect(suggested).toContain('moisturizer');
  });

  test('never suggests an exfoliant when redness is visible', () => {
    const suggested = suggestProductTypes({
      observationTags: ['appearance.visible_redness', 'appearance.texture_irregular'],
      routineGoals: ['support_smoother_texture_look', 'support_comfort'],
    });
    expect(suggested).not.toContain('exfoliant');
    expect(suggested).toContain('moisturizer');
    expect(suggestProductTypes({ observationTags: [], routineGoals: [] })).toEqual([]);
  });
});
