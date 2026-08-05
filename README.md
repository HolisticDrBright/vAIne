# vAIne

vAIne is an early, standalone mobile prototype for visual skin wellness check-ins. It is intentionally separate from AI Longevity Pro and every other existing product repository.

## Current prototype

The local prototype contains a synthetic, offline journey:

1. Scan selection
2. Guided camera framing
3. Visible skin-observation overview
4. Facial-zone explorer
5. Morning routine using conspicuously labeled fictional catalog samples
6. Optional progress comparison
7. Privacy-control concept

All displayed people, scores, observations, dates, and routines are fictional demonstration content.

## Safety boundaries

- Cosmetic observations only; not medical diagnosis or treatment.
- No disease, deficiency, organ, or systemic-health conclusions from images.
- Nail, tongue, and iris modules are future concepts and are not enabled.
- Real product recommendations are excluded until a separately governed catalog is verified.
- Affiliate information must never influence eligibility or ranking.

## Privacy boundaries

This prototype has no backend, accounts, analytics, advertising trackers, camera access, uploads, storage, or AI analysis. It does not collect or transmit photographs or personal data.

Future implementation must keep separate consent for analysis, storage, progress tracking, and research. Original photographs should be deleted automatically after analysis unless the user explicitly enables progress tracking.

## Standalone analysis foundations

The project now includes consumer-safe, provider-independent contracts for visible skin observations, structured output validation, deterministic product eligibility, quarantined Phase 9F staging, commercial-link approval, and recommendation-copy validation. Their selective provenance and exclusions are documented in `docs/selective-extraction.md` and `docs/product-catalog-governance.md`.

## Local development

```sh
npm install
npm start
```

Quality checks:

```sh
npm run typecheck
npm run build:web
```
