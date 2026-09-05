# Consumer product list

Routines are built from one product list at a time, chosen by
`src/data/routineCatalog.ts`:

1. **Reviewed product list** — `consumerCatalogEntries` in
   `src/data/consumerCatalog.ts`, loaded from
   `src/data/consumerCatalog.generated.json`. Used exclusively as soon as at
   least one entry is consumer-visible.
2. **Fictional sample list** — `approvedPrototypeCatalog` in
   `src/data/prototypeCatalog.ts`. Used only while the reviewed list is empty
   or entirely held back. Every sample is labeled fictional in the interface.

Real and fictional products are never mixed in one routine. If the reviewed
list has a cleanser but no moisturizer, the hydrate step shows category
guidance and says the list has no product for that step yet.

## Importing the product database

The reviewed list is generated from the *Longevity Skincare AI Product
Database* fill-template workbook kept in `data/product-database/`. To update
it, edit the workbook's `Verified_Product_DB` sheet and re-run:

```sh
python3 scripts/import_product_database.py \
  data/product-database/Longevity_Skincare_AI_Product_Database_v2_fill_template.xlsx \
  --affiliate-catalog /path/outside/the/repo/vAIne_Affiliate_Product_Catalog.xlsx
npm test
```

The affiliate research catalog is optional and is **not** kept in this public
repository because it carries commercial terms (program rates, cookie windows,
personal codes). The importer reads only its Products sheet — brand, product,
tier, price, key ingredient, plain-language note, "best for" — and every row
it contributes is `research_only`, so it is listed with its price under "Held
back" and never offered until it is moved into the governed workbook and
approved. Rows that already exist in the governed workbook are skipped.

### Catalog State and the research preview

The governed workbook's `Catalog State` column is the visibility authority:

| Catalog State | In the app |
| --- | --- |
| `catalog_approved` | Offered in routines, badge "From your list". |
| `research_only` | Beta default: rows with an official-page Verification Level and no blocker are offered with the badge "Research preview". Pass `--no-research-preview` to hide them, which is the launch rule. |
| `blocked` | Held back; the `Blocker / Known Issue` text is shown as the reason. |
| `out_of_scope` | Held back (devices, ingestibles). |

### Fill columns

The workbook's "How To Fill" sheet explains the four columns the app needs.
A blank is a fact; the importer never infers a value:

| Column | Effect once filled |
| --- | --- |
| Price (USD) + Price Verified (date) | Shows the price and enables the budget ceiling. A price without a date stays unverified. |
| Fragrance-Free (Yes / No / Unknown) | Enables the "avoid fragrance" preference. Unknown still counts as fragranced. |
| Full INCI | Replaces the listed actives for allergen matching and active-family detection. |
| Pregnancy Flag | Only values beginning with `REVIEWED` are trusted (avoid / practitioner → `reviewed_avoid`; acceptable → `reviewed_acceptable`). Provisional classes stay `not_reviewed` and are shown as a note. |
| Allergen Flags | Adds named allergens to the product's caution list. |

The script needs only the Python standard library. It maps each row as
follows:

| Sheet column | Catalog field |
| --- | --- |
| Brand, Product | `brand`, `productName`, and a stable `productId` slug |
| Product Type, Routine Slot, Category | `productKind` (single, bundle, travel size, body, device, supplement) and `routineSlot`. Only single face-care products get a slot; everything else is listed outside routines. |
| Best Skin Findings From AI Analysis | `skinConcernTags` via keyword rules (for example "dehydration" → hydration look low, "texture" → texture irregular, "sun" → sun-exposure signs). |
| Best Skin Types | `skinTypeCompatibility` |
| Avoid / Caution Logic | `sensitivityCaution` (true when the text warns about sensitive or reactive skin; false when the product is listed for sensitive skin; otherwise null, which the app treats as a caution), `pregnancyNursingStatus` (`reviewed_avoid` only when pregnancy is mentioned, otherwise `not_reviewed`), `allergyCautions`, `fragranceStatus` |
| Known/Listed Actives or Positioning | `keyIngredients` (also drives active-family detection) |
| Verification Level, Catalog State, Blocker | `evidenceReviewStatus`, `catalogState`, `blocker`: see "Catalog State and the research preview" above |
| Source URL | `nonAffiliateFallbackUrl` |
| When to Use, Avoid / Caution, Recommendation Logic, Priority, row number | `sourceNotes` (shown to the person as usage and caution notes; never used for ranking) |
| Affiliate Potential | Not imported. Commercial data stays outside the app's eligibility and ranking. |

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
  productKind: 'single',                     // single | bundle | travel_size | body | device | supplement
  routineSlot: 'cleanse',                    // cleanse | support | hydrate | protect | weekly | null (listed only)
  keyIngredients: ['glycerin', 'niacinamide'],
  skinConcernTags: ['appearance.hydration_look_low'], // allow-listed observation tags
  skinTypeCompatibility: ['dry', 'balanced'],
  sensitivityCaution: false,                 // null = not reviewed (treated as a caution)
  pregnancyNursingStatus: 'reviewed_acceptable', // reviewed_avoid | reviewed_acceptable | not_reviewed
  allergyCautions: [],                       // ingredients people commonly avoid
  fragranceStatus: 'fragrance_free',         // fragrance_free | contains_fragrance | unknown
  crueltyFreeStatus: 'unknown',
  veganStatus: 'unknown',
  approximatePriceCents: 1899,               // or null while unverified
  currencyCode: 'USD',
  priceVerifiedAtIso: '2026-08-20T00:00:00.000Z',   // required with a price; stale after 90 days
  affiliate: null,                           // or { network, url, disclosureText }
  nonAffiliateFallbackUrl: 'https://example.com/product',
  market: 'US',
  availabilityStatus: 'available',
  source: 'reviewed_research',               // reviewed_research | editorial
  lastReviewedAtIso: '2026-08-20T00:00:00.000Z',    // stale after 180 days
  evidenceReviewStatus: 'approved',
  catalogState: 'catalog_approved',         // research_only | catalog_approved | blocked | out_of_scope
  blocker: null,                             // reviewer's reason when held back
  active: true,
  sourceNotes: null,                         // or { whenToUse, caution, findings, … } from the sheet
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
| `approximatePriceCents` | Hard ceiling from the budget answer for verified prices; lower price only breaks ties. An unverified (null) price is never assumed to fit the ceiling and ranks after an equally matched verified one. |
| `affiliate`, `nonAffiliateFallbackUrl` | Dropped before ranking. Links can only attach afterwards through the commercial-attachment boundary. |

Entries that fail the visibility gate (blocked or out-of-scope catalog state,
inactive, evidence not approved, discontinued or unknown availability, stale
review, stale price, affiliate link without a fallback) are listed under
"Held back" on the product-list screen with the reviewer's reason and never
offered.

## Where the list is visible

- **Product list screen** (`/products`): every product with its price, the
  goals it helps with, and — after a check-in and the safety questions — whether
  it matches the person, is over budget, is excluded and why, or is hidden for
  review.
- **Routine screen**: each step shows the chosen product, the goals it matched
  on, and a badge saying whether it came from the reviewed list or is a
  fictional sample. Steps without a product explain why.
