import { catalogEntrySchema } from '../domain/catalog/catalogEntry';
import {
  attachCommercialLinks,
  type CommercialLink,
} from '../domain/recommendations/commercialAttachment';
import { consumerCatalogEntries } from './consumerCatalog';

/**
 * Builds the post-ranking purchase-link index from validated catalog rows.
 * Recommendation and eligibility code never receives these URLs, so an
 * affiliate relationship cannot affect which product is selected or its rank.
 */
const catalogCommercialLinks: readonly CommercialLink[] = consumerCatalogEntries.flatMap((row) => {
  const parsed = catalogEntrySchema.safeParse(row);
  if (!parsed.success) return [];

  const entry = parsed.data;
  const destinationUrl = entry.affiliate?.url ?? entry.nonAffiliateFallbackUrl;
  if (!destinationUrl) return [];

  return [{
    productId: entry.productId,
    destinationUrl,
    affiliateRelationship: entry.affiliate ? 'affiliate' : 'none',
    disclosure: entry.affiliate?.disclosureText ?? null,
    sourceLinkStatus: 'linked',
    reviewStatus: 'approved',
  } satisfies CommercialLink];
});

export function getCatalogCommercialLink(productId: string): CommercialLink | null {
  return attachCommercialLinks([{ id: productId }], catalogCommercialLinks)[0]?.commercialLink ?? null;
}
