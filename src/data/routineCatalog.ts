import { resolveRoutineCatalog, type ResolvedRoutineCatalog } from '@/domain/catalog/catalogResolver';
import { consumerCatalogEntries } from './consumerCatalog';
import { approvedPrototypeCatalog } from './prototypeCatalog';

/**
 * The single place the app picks its product list from. Reviewed consumer
 * products win whenever any are visible; otherwise the labeled synthetic
 * samples keep the interface exercised.
 */
export function getRoutineCatalog(nowIso: string = new Date().toISOString()): ResolvedRoutineCatalog {
  return resolveRoutineCatalog(consumerCatalogEntries, approvedPrototypeCatalog, nowIso);
}

export const catalogSourceLabels = {
  reviewed_catalog: 'Reviewed product list',
  synthetic_samples: 'Fictional sample list',
} as const;
