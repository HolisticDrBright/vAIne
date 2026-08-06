# vAIne

vAIne is an early, standalone mobile prototype for visual skin wellness check-ins. It is intentionally separate from AI Longevity Pro and every other existing product repository.

## Current prototype

The local prototype contains a synthetic results journey plus a local-only camera beta:

The interface uses a warm premium clinical-spa direction with ivory surfaces, botanical olive accents, editorial headings, and soft rounded cards throughout the phone journey.

1. Scan selection
2. Separate consent for check-in use, temporary device storage, and optional progress tracking
3. Front/left/right camera capture with permission, readiness, review, retake, cancellation, and deletion flows
4. A validated synthetic processing flow with ready, failure, and retry states
5. A high-fidelity “Your Skin Today” overview with support-focus cards
6. An interactive facial-zone explorer that uses the local front capture when available, with fixed-guide magnified crops for seven zones and an illustration fallback
7. A minimal in-memory routine safety intake with a conservative “prefer not to say” path and a per-product budget ceiling
8. Deterministic, budget-aware AM/PM routines derived from synthetic goals and conspicuously labeled fictional catalog samples and prices
9. An optional, consent-controlled local baseline with real-photo comparison and no invented progress score
10. Working privacy status and deletion for temporary photos, saved baseline photos, results, and routine answers

All displayed analysis results, people, scores, observations, dates, and routines are fictional demonstration content. Locally captured photos are never analyzed in this beta. The synthetic preparation service accepts no image input and makes no network request.

## Safety boundaries

- Cosmetic observations only; not medical diagnosis or treatment.
- No disease, deficiency, organ, or systemic-health conclusions from images.
- Nail, tongue, and iris modules are future concepts and are not enabled.
- Real product recommendations are excluded until a separately governed catalog is verified.
- Affiliate information must never influence eligibility or ranking.

## Privacy boundaries

This prototype has no backend, accounts, analytics, advertising trackers, app uploads, or AI analysis. Camera access is optional and requested only after consent. Captures remain in the app's temporary device cache unless the user separately opts into progress tracking and confirms that the three photos should be copied into one longer-term local baseline. The app discloses that operating-system backups may include app data. Temporary photos and the saved baseline can be deleted independently, and the privacy screen deletes both. Routine safety answers remain in memory only and are cleared with the check-in.

Future implementation must keep separate consent for analysis, storage, progress tracking, and research. Before a secure beta, saved progress photos need a documented encryption, backup-exclusion, retention, and migration policy.

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
