import type { CatalogEntry } from '../domain/catalog/catalogEntry';

type CommercialCatalogOverride = Pick<CatalogEntry, 'affiliate' | 'nonAffiliateFallbackUrl'>;

/**
 * Owner-provided commercial links live outside the research-generated catalog.
 * Product matching never reads this map; consumerCatalog attaches it only
 * after the research rows already exist.
 */
export const commercialCatalogOverrides: Readonly<Record<string, CommercialCatalogOverride>> = {
  'healthgevity-facegevity': {
    affiliate: {
      network: 'Refersion',
      url: 'https://healthgev.com/products/facegevity?rfsn=7188917.246a77',
      disclosureText: 'Affiliate link — vAIne may earn a commission if you buy through this link.',
    },
    nonAffiliateFallbackUrl: 'https://healthgev.com/products/facegevity',
  },
};
