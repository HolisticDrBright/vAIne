import { describe, expect, test } from 'vitest';
import { catalogEntrySchema } from '../../domain/catalog/catalogEntry';
import { getCatalogCommercialLink } from '../catalogCommercialLinks';
import { consumerCatalogEntries } from '../consumerCatalog';

describe('catalog commercial links', () => {
  test('uses the owner-provided FACEgevity affiliate URL and disclosure', () => {
    expect(getCatalogCommercialLink('healthgevity-facegevity')).toEqual({
      productId: 'healthgevity-facegevity',
      destinationUrl: 'https://healthgev.com/products/facegevity?rfsn=7188917.246a77',
      affiliateRelationship: 'affiliate',
      disclosure: 'Affiliate link — vAIne may earn a commission if you buy through this link.',
      sourceLinkStatus: 'linked',
      reviewStatus: 'approved',
    });
  });

  test('uses the owner-provided Alitura offer for every Alitura product', () => {
    const alituraProducts = consumerCatalogEntries
      .map((row) => catalogEntrySchema.parse(row))
      .filter((entry) => entry.brand === 'Alitura');

    expect(alituraProducts).toHaveLength(21);
    for (const product of alituraProducts) {
      expect(getCatalogCommercialLink(product.productId)).toEqual({
        productId: product.productId,
        destinationUrl: 'https://alituranaturals.pxf.io/55ZjBD',
        affiliateRelationship: 'affiliate',
        disclosure: 'Affiliate link — use code DRBRIGHT for 20% off. vAIne may earn a commission if you buy through this link.',
        sourceLinkStatus: 'linked',
        reviewStatus: 'approved',
      });
    }
  });

  test('uses a non-affiliate catalog URL without inventing a disclosure', () => {
    expect(getCatalogCommercialLink('young-goose-youth-reset')).toMatchObject({
      productId: 'young-goose-youth-reset',
      destinationUrl: 'https://www.younggoose.com/collections/all',
      affiliateRelationship: 'none',
      disclosure: null,
    });
  });

  test('does not attach a link to an unknown or fictional product', () => {
    expect(getCatalogCommercialLink('not-in-the-reviewed-catalog')).toBeNull();
  });
});
