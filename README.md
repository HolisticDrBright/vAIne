# vAIne

vAIne is an early, standalone mobile prototype for visual skin wellness check-ins. It is intentionally separate from AI Longevity Pro and every other existing product repository.

## Current prototype

The local prototype contains a synthetic results journey plus a local-only camera beta:

1. Scan selection
2. Separate consent for analysis, temporary device storage, and future progress tracking
3. Front/left/right camera capture with permission, readiness, review, retake, cancellation, and deletion flows
4. Visible skin-observation overview
5. Facial-zone explorer
6. Morning routine using conspicuously labeled fictional catalog samples
7. Optional progress comparison
8. Working privacy status and current-session deletion

All displayed analysis results, people, scores, observations, dates, and routines are fictional demonstration content. Locally captured photos are never analyzed in this beta.

## Safety boundaries

- Cosmetic observations only; not medical diagnosis or treatment.
- No disease, deficiency, organ, or systemic-health conclusions from images.
- Nail, tongue, and iris modules are future concepts and are not enabled.
- Real product recommendations are excluded until a separately governed catalog is verified.
- Affiliate information must never influence eligibility or ranking.

## Privacy boundaries

This prototype has no backend, accounts, analytics, advertising trackers, uploads, persistent photo history, or AI analysis. Camera access is optional and requested only after consent. Captures remain in the app's temporary device cache and can be deleted from the current session; they are never transmitted.

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
