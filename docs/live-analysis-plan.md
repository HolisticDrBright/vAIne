# Live-analysis implementation plan

This plan covers the transition from the current honest synthetic prototype to
genuinely functional, validated skin-appearance analysis. Local interfaces,
schemas, mocks, and tests are implemented ahead of approval. Every item marked
**requires approval** must receive explicit user sign-off before any external
resource, provider account, or dependency is created.

Approval status as of 2026-08-06:

- On-device ML Kit face detection: **approved** (local only; face bounds,
  landmarks, contours, capture alignment, and crop calculations; no
  recognition, identity matching, embeddings, tracking, demographic inference,
  or emotion classification).
- Supabase Edge Functions + server-side Claude vision: **conditionally
  approved for planning and local interfaces only.** No Supabase project,
  bucket, Edge Function, scheduled job, secret, Anthropic API integration, or
  production resource may be created yet.

## 1. Provider-independent analysis service

Status: local boundary implemented.

- `src/domain/analysis/analysisService.ts` defines the service contract:
  `SkinAnalysisService.analyze(request) -> AnalysisOutcome`.
- An `AnalysisOutcome` is exactly one of `completed`, `retake_required`, or
  `failed`. There is no code path that substitutes synthetic content after a
  live failure; failures surface as failures. This rule is restated below as a
  backend requirement because it must hold on both sides of the network.
- Every completed analysis produces an `AnalysisRecord` envelope carrying:
  analysis ID, capture timestamps, prompt version, model/provider version,
  schema version, overall confidence, limitations, and the image-quality
  decision. The record intentionally has no field for photo URIs, image bytes,
  or tokens, so downstream logging cannot leak them; a unit test enforces this.
- `skinAnalysisSchema` (strict Zod, allow-listed taxonomy) remains the minimum
  validation gate. Unknown fields and out-of-range values are rejected.
- The synthetic implementation (`src/services/syntheticAnalysisService.ts`)
  implements the same interface, accepts no image content influence, and is
  labeled `mode: 'synthetic_demo'` in its records.
- The live implementation will be added only after the backend architecture
  below is fully approved. The client talks to our backend only — never
  directly to an AI vendor — and holds no AI API key.

### Backend architecture (planning approved; build requires separate approval)

| Concern | Specification |
| --- | --- |
| Project isolation | A completely separate Supabase project dedicated to vAIne — no resource shared with any other product. Region selected explicitly at approval time (proposed: `us-east-1` to match the initial US-only beta audience; revisit if the beta includes EU testers, and record the decision) |
| Compute boundary | Edge Functions are the only photo entry point and stay thin: authentication, authorization, signed-URL issuance, provider-call orchestration, response validation, deletion, and cleanup. No computationally heavy image transformation server-side — resizing/cropping happens on the phone, and visual analysis happens at the approved vision provider |
| Authentication | Required before any upload authorization is issued. Recommended: **Sign in with Apple** for the secure beta (matches Phase 8, no passwords, minimal identity data). Documented alternative if faster beta onboarding is wanted: Supabase anonymous sign-ins as a temporary beta identity — each install gets an anonymous user ID; upgradeable in place to Sign in with Apple (`linkIdentity`) preserving history; deletable on request exactly like a full account; orphaned anonymous accounts and their data deleted after 30 days of inactivity. The choice between these is an explicit approval item |
| Storage | One private bucket, public access disabled, no public URLs ever issued. Photos are analysis inputs only |
| Object paths | Random, unguessable paths scoped as `<user_id>/<analysis_id>/<random 128-bit token>/<angle>.jpg` — no sequential IDs, no user-supplied names |
| Upload authorization | Short-lived signed upload URLs issued per analysis by the Edge Function after auth + rate-limit checks. Upload-only: no overwrite/upsert (`upsert: false`), each path single-use. Note: Supabase signed upload URLs are currently valid for two hours — treat that as the platform ceiling, enforce our own shorter freshness window (analysis slot expires server-side after 10 minutes) rather than relying on URL expiry |
| Upload limits | Strict validation server-side: MIME type JPEG or HEIC only; max 8 MB per file; image dimensions within 480–6000 px per side; max 3 images per Quick Scan analysis and 6 with detail photos; count enforced per analysis ID |
| Encryption | TLS in transit; provider-managed encryption at rest; bucket excluded from any backup/export tooling |
| Retention | Photos deleted immediately after the analysis completes — on success **and** on failure. Orphan cleanup job runs every 15 minutes deleting abandoned objects older than one hour. 24 hours is the absolute maximum retention bound (a safety invariant, not the cleanup target) |
| User deletion | Delete-my-data endpoint removes any remaining objects, derived rows, and audit rows for the requesting user |
| Logging | No photo data, image URLs, base64 content, signed URLs, or user-identifying prompt content in application, provider, analytics, crash, or audit logs — enforced by logging only the photo-free `AnalysisAuditEntry` shape and by never constructing log strings from request bodies |
| Schema validation | The structured analysis result is validated against the versioned schema **server-side** (before returning to the client) and **client-side** (`skinAnalysisSchema`). Either failure → typed `failed` outcome |
| No synthetic fallback | A failed live analysis returns a typed failure. Neither the server nor the client ever substitutes synthetic or cached-other-user content |
| Rate limiting & quotas | Per-user and per-IP caps on analysis starts; per-user daily quota during beta; hard org-level daily cap |
| Cost caps & kill switch | Provider spend alarms; a single feature flag that immediately disables live analysis (clients degrade to an honest "analysis unavailable" state, never to fiction); one provider call per analysis; max image sizes enforced before the provider call |
| Monitoring | Failure-rate, latency, quota, and spend dashboards on audit metadata only |

### AI vision provider (planning approved; build requires separate approval)

- Server-side call to the Anthropic API (Claude vision) from the Edge
  Function, using `CONSUMER_SKIN_SYSTEM_PROMPT` and structured output
  validated against the versioned schema.
- **Before any real user photo is transmitted**, review and record: Anthropic
  API data-retention behavior and available retention configurations, the
  default no-training-on-API-inputs position, the current subprocessor list,
  the Data Processing Addendum, and regional/data-residency implications
  (including the `inference_geo` request option) — all verified against
  Anthropic's current commercial terms at approval time, not assumed.
- **Billing reality**: Claude.ai subscriptions and Claude Code credits do
  **not** cover vAIne's production Anthropic API usage. vAIne needs its own
  funded Anthropic API account with its own keys, billing, and limits.

#### Estimated API cost per full analysis (pre-approval estimate)

Assumptions: 3 photos ≈ 1080×1440 (≈ 2,000 image tokens each on current
models), ~800 tokens of system prompt + instructions, ~700–1,500 output tokens
for the structured result. Prices are the published per-MTok rates as of
2026-08 and must be re-verified at implementation approval.

| Model | Input / output $ per MTok | Est. cost per Quick Scan (3 photos) | Est. per Detailed Scan (6 photos) |
| --- | --- | --- | --- |
| Claude Haiku 4.5 | $1 / $5 | ≈ $0.01 | ≈ $0.02 |
| Claude Sonnet 5 | $3 / $15 (intro $2 / $10 through 2026-08-31) | ≈ $0.05 (intro ≈ $0.03) | ≈ $0.07–0.09 |
| Claude Opus 5 | $5 / $25 | ≈ $0.09 | ≈ $0.12–0.15 |

Recommendation: start beta validation with Sonnet-class quality (≈ $0.05 per
analysis; 1,000 beta analyses ≈ $50), and evaluate Haiku-class for cost-down
only if Phase 5 repeatability holds. Prompt caching of the system prompt and
Batch API discounts do not materially apply to this interactive, low-volume
shape. Per-user quotas (above) bound worst-case spend.

## 2. Secure temporary-photo lifecycle

Client side (exists today): captures live in the app cache, deletable
individually and in bulk; the optional progress baseline is a separate
consented copy under the app's documents directory. Face-detection geometry is
held in memory only and is never persisted or logged.

Live-analysis lifecycle (requires build approval together with the backend):

1. User completes capture; quality gates pass locally.
2. Client authenticates, then requests an analysis slot; backend enforces
   rate limits/quotas and returns analysis ID + single-use signed upload URLs
   (one per angle, upload-only, typed and size-limited).
3. Client uploads JPEGs; nothing else (no name, no contact data) accompanies
   the photos.
4. Backend runs the single provider call, validates the structured result
   against the versioned schema, writes the photo-free audit entry, deletes
   the uploaded objects immediately (success or failure), and returns the
   validated result or a typed failure.
5. Client re-validates against `skinAnalysisSchema` and stores the result in
   session state only (until approved history storage exists in Phase 8).
6. The 15-minute orphan cleanup sweeps anything a crashed flow left behind
   (older than one hour; 24 h absolute maximum retention).
7. Local photos remain on-device under the existing deletion controls.

## 3. On-device facial landmarks and accurate zone cropping

Status: approved and in progress on this branch.

- Detector: **local Expo native module** (`modules/vaine-face-detection`)
  wrapping the official Google ML Kit face-detection SDKs directly (iOS
  `GoogleMLKit/FaceDetection` pod, Android `com.google.mlkit:face-detection`).
  Rationale: the two candidate third-party wrappers could not be confidently
  established as Expo SDK 57-compatible (the strongest candidate's latest
  release targets SDK 54 with no release since), which per the approval
  conditions routes to the local-module path. The module is autolinked by
  Expo's CNG/prebuild — no manually maintained ios/android project changes.
- Configuration: accurate still-image mode, landmarks on, contours off,
  classification (smiling/eyes-open) off, tracking off. Face bounds,
  landmarks, alignment, and crop math only — no recognition, identity
  matching, embeddings, demographic inference, or emotion classification, and
  nothing leaves the device.
- Orientation: the native layer normalizes EXIF/UIImage orientation before
  detection and reports the exact oriented pixel dimensions it measured in, so
  JavaScript normalizes against the detector's own coordinate space instead of
  guessing; a plausibility pass rejects implausible geometry.
- Exactly one plausible face is required for individualized alignment; zero,
  multiple, or implausible faces resolve to the labeled fixed-guide fallback
  or an honest retake request — falsely aligned markers are never displayed.
- `src/domain/zones/zoneAlignment.ts` holds the pure geometry (cover-fit
  transforms, mirrored-display projection, original-resolution crop rects,
  zone derivation) with tests for portrait/landscape sources, mirroring, cover
  cropping, aspect ratios, boundary faces, and missing/low-confidence
  landmarks.

## 4. Adaptive close-up capture

- Quick Scan stays three photos (front, slight left, slight right) at full
  resolution.
- Each zone crop is quality-checked (`src/domain/capture/zoneCropQuality.ts`);
  gates only fire on actually measured metrics, and unmeasured metrics are
  reported as unmeasured, never silently passed.
- `planDetailCapture` maps deficient zones to at most three guided detail
  photos (upper / center / lower face) with honest reasons, and recommends a
  front retake instead when landmarks are unreliable. Digital enlargement is
  never presented as a substitute for missing detail.

## 5. Transition from synthetic to real validated results

Gate order, each independently verifiable:

1. Backend + provider build approved and completed; live `SkinAnalysisService`
   implementation passes the same contract tests as the synthetic one.
2. Real capture → upload → validated result works end-to-end on a physical
   iPhone via TestFlight.
3. Zone observations bind to individually derived zone crops (landmarks), with
   the labeled fixed-guide fallback retained for detection failures.
4. Screens backed by a real validated `AnalysisRecord` (mode `live`) drop the
   synthetic labels; a separate, unmistakable demo mode keeps the synthetic
   path for development. Labels are driven by `record.mode`, not hand-edited
   per screen.
5. Repeatability validation (Phase 5 of the handoff) across skin tones, ages,
   devices, lighting, makeup, facial hair, glasses, and repeat captures.
   Numeric scores ship only if repeatable; otherwise qualitative summaries.

Until step 4, every visible result remains labeled demonstration content.
