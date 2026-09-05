# Consumer product list

Routines are built from one product list at a time, chosen by
`src/data/routineCatalog.ts`:

1. **Reviewed product list** — `consumerCatalogEntries` in
   `src/data/consumerCatalog.ts`. Used exclusively as soon as at least one
   entry is consumer-visible.
2. **Fictional sample list** — `approvedPrototypeCatalog` in
   `src/data/prototypeCatalog.ts`. Used only while the reviewed list is empty
   or entirely held back. Every sample is labeled fictional in the interface.

Real and fictional products are never mixed in one routine. If the reviewed
list has a cleanser but no moisturizer, the hydrate step shows category
guidance and says the list has no product for that step yet.

## Entry format

Each row must satisfy `catalogEntrySchema` in
`src/domain/catalog/catalogEntry.ts`. Unknown fields are rejected, and there is
no synthetic source value, so fictional products cannot enter this list.

```ts
{
  schemaVersion: 'catalog_entry_v1',
  productId: 'brand-product-001',            // stable, unique
  brand: 'Brand Name',
  productName: 'Product Name',
  category: 'cleanser',
  routineSlot: 'cleanse',                    // cleanse | support | hydrate | protect | weekly
  keyIngredients: ['glycerin', 'niacinamide'],
  skinConcernTags: ['appearance.hydration_look_low'], // allow-listed observation tags
  skinTypeCompatibility: ['dry', 'balanced'],
  sensitivityCaution: false,                 // null = not reviewed (treated as a caution)
  pregnancyNursingStatus: 'reviewed_acceptable', // reviewed_avoid | reviewed_acceptable | not_reviewed
  allergyCautions: [],                       // ingredients people commonly avoid
  fragranceStatus: 'fragrance_free',         // fragrance_free | contains_fragrance | unknown
  crueltyFreeStatus: 'unknown',
  veganStatus: 'unknown',
  approximatePriceCents: 1899,
  currencyCode: 'USD',
  priceVerifiedAtIso: '2026-08-20T00:00:00.000Z',   // stale after 90 days
  affiliate: null,                           // or { network, url, disclosureText }
  nonAffiliateFallbackUrl: 'https://example.com/product',
  market: 'US',
  availabilityStatus: 'available',
  source: 'reviewed_research',               // reviewed_research | editorial
  lastReviewedAtIso: '2026-08-20T00:00:00.000Z',    // stale after 180 days
  evidenceReviewStatus: 'approved',
  active: true,
}
```

## How an entry becomes a routine step

`src/domain/catalog/catalogAdapter.ts` converts each visible entry into the
eligibility engine's `ProductCandidate`:

| Catalog fact | Effect on matching |
| --- | --- |
| `skinConcernTags` | The appearance goals the product can be matched on. A product with no tag in common with the check-in is never offered. |
| `pregnancyNursingStatus` other than `reviewed_acceptable` | Excluded for anyone pregnant, trying, or nursing (or who kept that private). |
| `sensitivityCaution` `true` or `null` | Excluded for a sensitive preference. |
| `fragranceStatus` other than `fragrance_free` | Excluded when fragrance is avoided. |
| `keyIngredients` + `allergyCautions` | Compared against the ingredients a person named as allergens. |
| `keyIngredients` | Mapped to active families (retinoid, exfoliating acid, vitamin C, niacinamide, peptide, UV filter, hydroquinone) so a family already in use is not doubled. |
| `approximatePriceCents` | Hard ceiling from the budget answer; lower price only breaks ties. |
| `affiliate`, `nonAffiliateFallbackUrl` | Dropped before ranking. Links can only attach afterwards through the commercial-attachment boundary. |

Entries that fail the visibility gate (inactive, evidence not approved,
discontinued or unknown availability, stale review, stale price, affiliate
link without a fallback) are listed under "Held back" on the product-list
screen with their reasons and never offered.

## Where the list is visible

- **Product list screen** (`/products`): every product with its price, the
  goals it helps with, and — after a check-in and the safety questions — whether
  it matches the person, is over budget, is excluded and why, or is hidden for
  review.
- **Routine screen**: each step shows the chosen product, the goals it matched
  on, and a badge saying whether it came from the reviewed list or is a
  fictional sample. Steps without a product explain why.
