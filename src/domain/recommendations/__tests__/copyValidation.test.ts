import { describe, expect, test } from 'vitest';
import { validateRecommendationCopy } from '../copyValidation';

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
});
