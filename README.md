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
6. An interactive facial-zone explorer that uses the local front capture when available: when on-device face detection succeeds, zone markers and magnified crops align to the user's actual face (labeled "aligned on-device"); otherwise a clearly labeled fixed guide or illustration fallback is shown
6b. On-device ML Kit face detection (local Expo module wrapping the official SDKs) used only for face bounds, landmarks, capture framing checks, and crop alignment — accurate still-image mode with contours, classification, and tracking disabled; no identity recognition or embeddings; geometry stays in memory and never leaves the device
6c. An optional close-up stage that suggests at most three guided detail photos when zone crops lack real pixel detail, with honest reasons and a skip path
7. A routine safety intake with a conservative “prefer not to say” path, named allergen and active-family exclusions, and a per-product budget ceiling — remembered on the device so it is not repeated every check-in
8. Deterministic, budget-aware AM/PM routines drawn from the product list imported from the Longevity Skincare AI Product Database (`data/product-database/`, `docs/consumer-catalog.md`). During the beta, official-page products still in `research_only` state are offered as a labelled research preview; blocked and out-of-scope rows are held back with the reviewer's reason. Fictional samples are used only if that list is ever empty. Each step names the product it matched and why, or explains why it stayed category-level
8b. A product-list screen showing every listed product and how it matches the current check-in and safety answers
9. An optional, consent-controlled local baseline with real-photo comparison and no invented progress score
10. A remembered, photo-free local profile: the last validated result and the routine answers survive relaunch, the home screen welcomes the person back with shortcuts, and privacy controls show and delete everything remembered
11. Working privacy status and deletion for temporary photos, saved baseline photos, the remembered result, and routine answers

Signed-in beta testers get a real visible-appearance analysis: the phone re-encodes the three check-in photos, sends them once to the `analyze-skin` Edge Function, which validates them, calls the vision provider with structured output, discards the photos, and returns a schema-validated, photo-free result (`docs/live-analysis-runbook.md`). Without an account, or while the `analysis_enabled` flag is off, the app shows the labelled synthetic sample and uploads nothing; every screen keeps its "sample" labels unless a validated live result is present.

## Safety boundaries

- Cosmetic observations only; not medical diagnosis or treatment.
- No disease, deficiency, organ, or systemic-health conclusions from images.
- Nail, tongue, and iris modules are future concepts and are not enabled.
- Real product recommendations are excluded until a separately governed catalog is verified.
- Affiliate information must never influence eligibility or ranking.

## Privacy boundaries

This prototype has no analytics, advertising trackers, app uploads, or AI analysis. Optional Sign in with Apple exists only to attach future live analyses to an account; it stores nothing about the person beyond an opaque identifier. Camera access is optional and requested only after consent. Captures remain in the app's temporary device cache unless the user separately opts into progress tracking and confirms that the three photos should be copied into one longer-term local baseline. The app discloses that operating-system backups may include app data. Temporary photos and the saved baseline can be deleted independently, and the privacy screen deletes both. Routine safety answers and the last validated, photo-free result are stored in the app's private on-device storage so the app remembers the person between launches; they are never uploaded, are not tied to an account, and are deleted from the privacy screen.

Future implementation must keep separate consent for analysis, storage, progress tracking, and research. Before a secure beta, saved progress photos need a documented encryption, backup-exclusion, retention, and migration policy.

## Standalone analysis foundations

The project now includes consumer-safe, provider-independent contracts for visible skin observations, structured output validation, deterministic product eligibility, quarantined Phase 9F staging, commercial-link approval, and recommendation-copy validation. Their selective provenance and exclusions are documented in `docs/selective-extraction.md` and `docs/product-catalog-governance.md`.

Analysis now flows through a provider-independent service boundary (`src/domain/analysis/analysisService.ts`): every outcome is a validated completed record, an explicit retake request, or an explicit failure — never a silent substitute. Records and audit entries are structurally photo-free. Two implementations are wired: the synthetic demonstration service and the live service backed by the `analyze-skin` Edge Function (`docs/live-analysis-runbook.md`, `docs/live-analysis-plan.md`).

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
