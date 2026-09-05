import type { ProductCandidate } from '../recommendations/eligibility';
import { convertCatalogEntries, type CatalogConversion } from './catalogAdapter';

export type RoutineCatalogSource = 'reviewed_catalog' | 'synthetic_samples';

export interface ResolvedRoutineCatalog {
  source: RoutineCatalogSource;
  products: readonly ProductCandidate[];
  /** Visible reviewed products that never enter a routine step (bundles, body, devices…). */
  outsideRoutine: CatalogConversion['outsideRoutine'];
  /** Reviewed rows that failed the visibility gate, for the catalog screen. */
  blocked: CatalogConversion['blocked'];
  /** Rows that did not match the catalog schema at all. */
  invalid: CatalogConversion['invalid'];
}

/**
 * Chooses the product list a routine draws from. Whenever at least one
 * reviewed, consumer-visible product exists it is used exclusively — real
 * and fictional products are never mixed in one routine. Only an empty (or
 * fully blocked) reviewed list falls back to the labeled synthetic samples.
 */
export function resolveRoutineCatalog(
  reviewedRows: readonly unknown[],
  syntheticSamples: readonly ProductCandidate[],
  nowIso: string,
): ResolvedRoutineCatalog {
  const conversion = convertCatalogEntries(reviewedRows, nowIso);
  const shared = { outsideRoutine: conversion.outsideRoutine, blocked: conversion.blocked, invalid: conversion.invalid };
  if (conversion.candidates.length) {
    return { source: 'reviewed_catalog', products: conversion.candidates, ...shared };
  }
  return { source: 'synthetic_samples', products: syntheticSamples, ...shared };
}
