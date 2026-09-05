# Product catalog governance

The Product Research Handoff and Phase 9F Research Completion package were inspected read-only. No source product record, evidence artifact, private link, affiliate URL, or identifying material has been copied into vAIne.

## Required progression

Research products enter the app boundary as `research_only`. A product can become consumer-visible only after all of these conditions are independently satisfied:

1. The exact product identity is established.
2. Required physical-label evidence is resolved.
3. Conflicts and practitioner decisions are resolved.
4. Jurisdiction questions are resolved.
5. The product is not discontinued.
6. A practitioner verifies the reviewed facts.
7. A reviewer creates the consumer-safe routine mapping.
8. A catalog reviewer explicitly records `catalog_approved`.
9. Any consumer-visible price has a currency and a verification timestamp.

The source package's `clinically_approved` and `imported` values are preserved as research provenance only. They never grant catalog access.

## Commercial separation

Commercial links remain outside product eligibility and ranking. A link attaches only after the product result exists and only when:

- the research package marks the clean destination `linked`;
- a separate commercial reviewer marks it `approved`;
- the destination uses HTTPS; and
- an affiliate or referral relationship has disclosure text.

Synthetic prototype products never receive real commercial links.

## Budget matching

Budget is a user preference, not evidence of quality or effectiveness. The app applies safety exclusions and appearance-goal matching first, removes products above the user's per-product ceiling, and uses lower list price only to break an otherwise equal match. Affiliate relationships, commissions, discounts, and merchant placement cannot improve a match score.

Prices can change. A future live catalog must retain currency and a recent verification timestamp, refresh stale prices, and show category-level guidance when it cannot confirm a product falls within the selected budget.

## From reviewed entry to routine

Reviewed products reach the app as `CatalogEntry` rows (`src/domain/catalog/catalogEntry.ts`) in `src/data/consumerCatalog.ts`. `src/domain/catalog/catalogAdapter.ts` converts only the rows that pass the runtime visibility gate, maps every unreviewed safety fact to the cautious exclusion, and strips commercial fields before ranking. `src/domain/catalog/catalogResolver.ts` then hands the routine builder either the reviewed list (whenever any row is visible) or the labeled synthetic samples — never a mix. The full format and matching table are in `docs/consumer-catalog.md`.
