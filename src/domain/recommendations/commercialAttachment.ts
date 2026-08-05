import type { CatalogSource } from '../catalog/types';

export type AffiliateRelationship = 'none' | 'affiliate' | 'referral';

export interface CommercialLink {
  productId: string;
  destinationUrl: string;
  affiliateRelationship: AffiliateRelationship;
  disclosure: string | null;
  sourceLinkStatus: 'linked' | 'pending';
  reviewStatus: 'pending' | 'approved' | 'rejected';
}

export interface EligibleProductResult<TProduct extends { id: string }> {
  product: TProduct;
  commercialLink: CommercialLink | null;
}

/**
 * Commercial data is attached only after eligibility and ranking are complete.
 * It cannot change order or make an ineligible product eligible.
 */
export function attachCommercialLinks<TProduct extends { id: string }>(
  rankedProducts: readonly TProduct[],
  links: readonly CommercialLink[],
): EligibleProductResult<TProduct>[] {
  const approvedLinks = links.filter((link) => {
    if (link.sourceLinkStatus !== 'linked' || link.reviewStatus !== 'approved') return false;
    if (!link.destinationUrl.startsWith('https://')) return false;
    if (link.affiliateRelationship !== 'none' && !link.disclosure?.trim()) return false;
    return true;
  });
  const linksByProduct = new Map(approvedLinks.map((link) => [link.productId, link]));
  return rankedProducts.map((product) => ({ product, commercialLink: linksByProduct.get(product.id) ?? null }));
}

export function canAttachCommercialLink(
  product: { catalogSource?: CatalogSource },
  link: CommercialLink,
): boolean {
  if (product.catalogSource === 'synthetic_prototype') return false;
  return attachCommercialLinks([{ id: link.productId }], [link])[0].commercialLink !== null;
}
