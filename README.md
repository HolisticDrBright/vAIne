# vAIne

vAIne is an early, standalone mobile prototype for visual skin wellness check-ins. It is intentionally separate from AI Longevity Pro and every other existing product repository.

## Current prototype

The local prototype contains a synthetic results journey plus a local-only camera beta:

1. Scan selection
2. Separate consent for analysis, temporary device storage, and future progress tracking
3. Front/left/right camera capture with permission, readiness, review, retake, cancellation, and deletion flows
4. A validated synthetic processing flow with ready, failure, and retry states
5. A high-fidelity “Your Skin Today” overview with support-focus cards
6. An interactive facial-zone explorer with a zoomed detail view for seven zones
7. A minimal in-memory routine safety intake with a conservative “prefer not to say” path
8. Deterministic AM/PM routines derived from synthetic goals and conspicuously labeled fictional catalog samples
9. Optional progress comparison
10. Working privacy status and current-session deletion for photos, results, and routine answers

All displayed analysis results, people, scores, observations, dates, and routines are fictional demonstration content. Locally captured photos are never analyzed in this beta. The synthetic preparation service accepts no image input and makes no network request.

## Safety boundaries

- Cosmetic observations only; not medical diagnosis or treatment.
- No disease, deficiency, organ, or systemic-health conclusions from images.
- Nail, tongue, and iris modules are future concepts and are not enabled.
- Real product recommendations are excluded until a separately governed catalog is verified.
- Affiliate information must never influence eligibility or ranking.

## Privacy boundaries

This prototype has no backend, accounts, analytics, advertising trackers, uploads, persistent photo history, or AI analysis. Camera access is optional and requested only after consent. Captures remain in the app's temporary device cache and can be deleted from the current session; they are never transmitted. Routine safety answers remain in memory only and are cleared with the check-in.

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
