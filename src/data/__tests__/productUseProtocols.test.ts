import { describe, expect, test } from 'vitest';
import generatedEntries from '../consumerCatalog.generated.json';
import { getProductUseProtocol, protocolSupportsPeriod, verifiedProtocolCount } from '../productUseProtocols';
import { catalogEntrySchema } from '../../domain/catalog/catalogEntry';

describe('product use protocols', () => {
  test('returns honest structured directions for every catalog row', () => {
    for (const rawEntry of generatedEntries) {
      const entry = catalogEntrySchema.parse(rawEntry);
      const protocol = getProductUseProtocol({
        id: entry.productId,
        brandName: entry.brand,
        productName: entry.productName,
        routineSlot: entry.routineSlot,
        whenToUse: entry.sourceNotes?.whenToUse,
        category: entry.category,
      });
      expect(protocol.intendedUse.length).toBeGreaterThan(10);
      expect(protocol.cadence.length).toBeGreaterThan(1);
      expect(protocol.application.length).toBeGreaterThan(10);
      expect(protocol.routineOrder.length).toBeGreaterThan(5);
      expect(protocol.periods.length).toBeGreaterThan(0);
      if (protocol.sourceKind === 'catalog_research') {
        expect(protocol.application).toMatch(/not yet been verified/i);
        expect(protocol.sourceUrl).toBeNull();
      } else {
        expect(protocol.sourceUrl).toMatch(/^https:\/\//);
      }
      expect(JSON.stringify(protocol)).not.toMatch(/affiliate|commission|discount code/i);
    }
  });

  test('has manufacturer-verified protocols for the researched launch set', () => {
    expect(verifiedProtocolCount).toBeGreaterThanOrEqual(50);
  });

  test('covers every catalog company with at least one official manufacturer source', () => {
    const allBrands = new Set<string>();
    const officiallyCoveredBrands = new Set<string>();
    for (const rawEntry of generatedEntries) {
      const entry = catalogEntrySchema.parse(rawEntry);
      allBrands.add(entry.brand);
      const protocol = getProductUseProtocol({
        id: entry.productId,
        brandName: entry.brand,
        productName: entry.productName,
        routineSlot: entry.routineSlot,
        whenToUse: entry.sourceNotes?.whenToUse,
        category: entry.category,
      });
      if (protocol.sourceKind !== 'catalog_research') officiallyCoveredBrands.add(entry.brand);
    }
    expect([...allBrands].filter((brand) => !officiallyCoveredBrands.has(brand))).toEqual([]);
  });

  test('schedules daytime antioxidants and nighttime retinoids in their intended periods', () => {
    const vitaminC = {
      id: 'medik8-c-tetra-vitamin-c-serum',
      brandName: 'Medik8',
      productName: 'C-Tetra Vitamin C Serum',
      routineSlot: 'support' as const,
    };
    const retinal = {
      id: 'medik8-crystal-retinal-3',
      brandName: 'Medik8',
      productName: 'Crystal Retinal 3',
      routineSlot: 'support' as const,
    };
    expect(protocolSupportsPeriod(vitaminC, 'am')).toBe(true);
    expect(protocolSupportsPeriod(vitaminC, 'pm')).toBe(false);
    expect(protocolSupportsPeriod(retinal, 'am')).toBe(false);
    expect(protocolSupportsPeriod(retinal, 'pm')).toBe(true);
    expect(getProductUseProtocol(retinal).safetyAdaptation).toMatch(/different evenings/i);
  });

  test('keeps sunscreen as the final morning step', () => {
    const sunscreen = getProductUseProtocol({
      id: 'oneskin-os-01-shield-spf-30',
      brandName: 'OneSkin',
      productName: 'OS-01 SHIELD SPF 30',
      routineSlot: 'protect',
    });
    expect(sunscreen.periods).toEqual(['am']);
    expect(sunscreen.routineOrder).toMatch(/final/i);
    expect(sunscreen.safetyAdaptation).toMatch(/Drug Facts/i);
  });
});
