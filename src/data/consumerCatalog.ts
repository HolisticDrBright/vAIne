import generatedEntries from './consumerCatalog.generated.json';
import { applyBetaCatalogTestingOverride, betaCatalogTestingEnabled } from './betaCatalogTesting';
import { commercialCatalogOverrides } from './commercialLinks';

/**
 * The reviewed consumer product list.
 *
 * `consumerCatalog.generated.json` is produced from the Longevity Skincare AI
 * Product Database workbook in `data/product-database/` by
 * `scripts/import_product_database.py`; edit the workbook and re-run the
 * script rather than editing the JSON by hand. Every row is validated against
 * `catalogEntrySchema` at runtime and must pass the visibility gate before it
 * can be offered; rows that fail are reported on the product-list screen.
 * Fictional samples cannot enter this list: the schema has no synthetic
 * source value.
 *
 * If this list is ever empty (or fully held back) the app draws routines from
 * the clearly labeled synthetic samples in `prototypeCatalog.ts`. See
 * docs/consumer-catalog.md for the format and the import workflow.
 */
export const consumerCatalogEntries: readonly unknown[] = generatedEntries.map((entry) => {
  const override = commercialCatalogOverrides[entry.productId];
  const withCommercialLink = override ? { ...entry, ...override } : entry;
  return betaCatalogTestingEnabled ? applyBetaCatalogTestingOverride(withCommercialLink) : withCommercialLink;
});
