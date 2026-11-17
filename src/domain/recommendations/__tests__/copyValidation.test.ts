import { describe, expect, test } from 'vitest';
import { validateRecommendationCopy, validateTechniqueCopy } from '../copyValidation';

const catalog = [
  { brandName: 'Synthetic One', productName: 'Hydration Example' },
  { brandName: 'Synthetic Two', productName: 'Texture Example' },
];

describe('recommendation copy validation', () => {
  test('accepts an allow-listed synthetic product', () => {
    const result = validateRecommendationCopy({
      copy: 'Synthetic One Hydration Example can be introduced gradually after patch testing. Stop if irritation occurs.',
      allowedProducts: [catalog[0]],
      knownProducts: catalog,
    });
    expect(result).toEqual({ ok: true, violations: [] });
  });

  test('rejects a known product outside the allowed list', () => {
    const result = validateRecommendationCopy({
      copy: 'Add Synthetic Two Texture Example to the evening routine.',
      allowedProducts: [catalog[0]],
      knownProducts: catalog,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('disallowed product');
  });

  test('rejects prohibited medical or guaranteed claims', () => {
    const result = validateRecommendationCopy({
      copy: 'This product cures disease and is guaranteed to reverse visible changes.',
      allowedProducts: [],
      knownProducts: catalog,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  test('allows generic guidance when no products are eligible', () => {
    const result = validateRecommendationCopy({
      copy: 'Use a gentle hydration step, introduce one item at a time, patch test first, and stop if irritation occurs.',
      allowedProducts: [],
      knownProducts: catalog,
    });
    expect(result).toEqual({ ok: true, violations: [] });
  });

  test('technique copy may use cautious looks language', () => {
    for (const copy of [
      'Gentle gua sha may help skin look less puffy for a short while.',
      'Facial exercise may support a more rested look when done daily; results vary and fade when you stop.',
      'Red light may help fine lines look softer over weeks of steady use.',
      'Treat your skin gently and stop if anything feels uncomfortable.',
    ]) {
      expect(validateTechniqueCopy(copy), copy).toEqual({ ok: true, violations: [] });
    }
  });

  test('technique copy may not claim reshaping, permanence, treatment, cure, or guaranteed results', () => {
    for (const copy of [
      'Gua sha reshapes your jawline.',
      'This sculpts the jaw and defines the cheekbones.',
      'Microcurrent lifts the face permanently.',
      'A permanent lift after four weeks.',
      'Cupping treats rosacea.',
      'Red light cures acne.',
      'Results are guaranteed in 30 days.',
      'Proven to erase wrinkles.',
      'Leaves you wrinkle-free.',
    ]) {
      expect(validateTechniqueCopy(copy).ok, copy).toBe(false);
    }
  });

  test('the same technique rules apply to product copy', () => {
    const result = validateRecommendationCopy({ copy: 'This serum reshapes the jawline and lifts the face permanently.', allowedProducts: [], knownProducts: catalog });
    expect(result.ok).toBe(false);
  });
});

