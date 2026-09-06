import type { CatalogEntry } from '../domain/catalog/catalogEntry';

type CommercialCatalogOverride = Pick<CatalogEntry, 'affiliate' | 'nonAffiliateFallbackUrl'>;
type CommercialBrandOverride = Partial<Pick<CatalogEntry, 'affiliate' | 'nonAffiliateFallbackUrl'>>;

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

/**
 * Brand-wide offers apply to every current and future product from that brand.
 * The generated catalog keeps each product's non-affiliate fallback URL.
 */
export const commercialBrandOverrides: Readonly<Record<string, CommercialBrandOverride>> = {
  Alitura: {
    affiliate: {
      network: 'Alitura affiliate program',
      url: 'https://alituranaturals.pxf.io/55ZjBD',
      disclosureText: 'Affiliate link — use code DRBRIGHT for 20% off. vAIne may earn a commission if you buy through this link.',
    },
  },
  'Sky and Sol': {
    affiliate: {
      network: 'Sky and Sol affiliate program',
      url: 'https://skyandsol.co/pages/shop?lc_ambassador_id=Y3VzdG9tZXI6NjUyMjI0OQ',
      disclosureText: 'Affiliate link — use code BRANDON at checkout. vAIne may earn a commission if you buy through this link.',
    },
    nonAffiliateFallbackUrl: 'https://skyandsol.co/pages/shop',
  },
};
