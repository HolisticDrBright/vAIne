import { describe, expect, test } from 'vitest';
import { getCatalogCommercialLink } from '../catalogCommercialLinks';

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
