import type { CatalogEntry } from '@/domain/catalog/catalogEntry';

/**
 * The reviewed consumer product list.
 *
 * Every row must satisfy `catalogEntrySchema` (src/domain/catalog/catalogEntry.ts)
 * and pass the runtime visibility gate (active, evidence approved, available,
 * review and price verification not stale). Rows that fail are reported on
 * the product-list screen and never offered in a routine. Fictional samples
 * cannot enter this list: the schema has no synthetic source value.
 *
 * While this list is empty the app draws routines from the clearly labeled
 * synthetic samples in `prototypeCatalog.ts`. Add reviewed products here (or
 * load them from the governed catalog export) and the routine builder switches
 * to the real list automatically. See docs/consumer-catalog.md for the format.
 */
export const consumerCatalogEntries: readonly CatalogEntry[] = [];
