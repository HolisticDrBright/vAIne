# Live-analysis implementation plan

This plan covers the transition from the current honest synthetic prototype to
genuinely functional, validated skin-appearance analysis. Local interfaces,
schemas, mocks, and tests are implemented ahead of approval. Every item marked
**requires approval** must receive explicit user sign-off before any external
resource, provider account, or dependency is created.

## 1. Provider-independent analysis service

Status: local boundary implemented (this branch).

- `src/domain/analysis/analysisService.ts` defines the service contract:
  `SkinAnalysisService.analyze(request) -> AnalysisOutcome`.
- An `AnalysisOutcome` is exactly one of `completed`, `retake_required`, or
  `failed`. There is no code path that substitutes synthetic content after a
  live failure; failures surface as failures.
- Every completed analysis produces an `AnalysisRecord` envelope carrying:
  analysis ID, capture timestamps, prompt version, model/provider version,
  schema version, overall confidence, limitations, and the image-quality
  decision. The record intentionally has no field for photo URIs, image bytes,
  or tokens, so downstream logging cannot leak them; a unit test enforces this.
- `skinAnalysisSchema` (strict Zod, allow-listed taxonomy) remains the minimum
  validation gate. Unknown fields and out-of-range values are rejected.
- The synthetic implementation (`src/services/syntheticAnalysisService.ts`)
  now implements the same interface, accepts no image content influence, and is
  labeled `mode: 'synthetic_demo'` in its records. UI demo labels key off the
  record mode, so screens cannot silently present demo data as live.
- The live implementation will be added only after the backend architecture
  below is approved. The client will talk to our backend only — never directly
  to an AI vendor — and will hold no AI API key.

### Backend architecture proposal (requires approval)

Recommended stack, pending user decision:

| Concern | Proposal |
| --- | --- |
| Backend | Supabase project (new, dedicated to vAIne) with Edge Functions as the only photo entry point |
| AI vision provider | Anthropic Claude vision via server-side call from the Edge Function; prompt = `CONSUMER_SKIN_SYSTEM_PROMPT`, structured output validated server-side against the same versioned schema |
| Upload authorization | Short-lived signed upload URL issued per analysis by the Edge Function after auth + rate-limit checks; direct-to-bucket upload |
| Temporary object storage | Private bucket, per-analysis prefix, no public access; photos are inputs only |
| Encryption | TLS in transit; provider-managed encryption at rest; bucket excluded from any backup export |
| Retention | Photos auto-deleted immediately after the analysis response is produced, with a scheduled sweep deleting any object older than 24 h as a safety net |
| User deletion | Delete-my-data endpoint removes any remaining objects and audit rows on request |
| Rate limiting | Per-user and per-IP caps on analysis starts; hard daily cap while in beta |
| Failure handling | Provider error, timeout, or schema-validation failure returns a typed failure to the client; the client shows the failure and offers retry/retake. No fictional fallback |
| Cost controls | Request budget alarms, per-user caps, max image size, one provider call per analysis |
| Audit logging | Analysis ID, timestamps, versions, quality decision, confidence band, failure kind. Never image bytes, URLs, or prompt content containing user data |

Nothing above is created yet. Alternatives (e.g., a small dedicated API service
instead of Supabase) can be swapped without touching the client because of the
service interface.

## 2. Secure temporary-photo lifecycle

Client side (exists today): captures live in the app cache, deletable
individually and in bulk; the optional progress baseline is a separate
consented copy under the app's documents directory.

Live-analysis lifecycle (requires approval together with the backend):

1. User completes capture; quality gates pass locally.
2. Client requests an analysis slot; backend returns analysis ID + signed
   upload URLs (one per angle).
3. Client uploads JPEGs; nothing else (no name, no contact data) accompanies
   the photos.
4. Backend runs the provider call, validates the structured result, writes the
   audit entry (no image content), deletes the uploaded objects, returns the
   validated result.
5. Client re-validates against `skinAnalysisSchema` and stores the result in
   session state only (until approved history storage exists in Phase 8).
6. Local photos remain on-device under the existing deletion controls.

## 3. On-device facial landmarks and accurate zone cropping

Status: transform math and contracts implemented (this branch); detector
integration pending one approval item.

- `src/domain/zones/zoneAlignment.ts` holds pure geometry: cover-fit
  source-to-display transforms, mirrored-display projection, normalized-rect to
  original-pixel crop mapping, plausibility checks for detected geometry, and
  derivation of the seven zone rects from a minimal landmark set (eyes, nose,
  mouth, face bounds). Tests cover portrait/landscape sources, mirrored images,
  cover cropping, multiple aspect ratios, boundary faces, and
  missing/low-confidence landmarks.
- Zone crops are defined in original-image pixel space so detail crops come
  from the full-resolution capture, never from a screenshot or an enlarged
  preview.
- Detector (requires approval as a new native dependency, local-only): Google
  ML Kit face detection via a maintained React Native wrapper, running fully
  on-device in the EAS dev/production build. No identity recognition, no
  embeddings stored, images never leave the device for landmark detection.
  If detection fails or is implausible, the UI keeps the clearly labeled
  fixed-guide fallback and capture guidance asks for a better front photo.

## 4. Adaptive close-up capture

Status: decision policy implemented as pure domain logic (this branch); camera
UI wiring follows once landmarks land.

- Quick Scan stays three photos (front, slight left, slight right) at full
  resolution.
- Each zone crop is quality-checked (`src/domain/capture/zoneCropQuality.ts`):
  minimum crop resolution, blur proxy, exposure, uneven lighting, occlusion —
  each gate only fires when its metric was actually measured; unmeasured
  metrics are reported as unmeasured, never silently passed.
- `planDetailCapture` maps deficient zones to at most three guided detail
  photos (upper / center / lower face) with human-readable reasons, and
  recommends a front retake instead when landmarks are unreliable. Digital
  enlargement is never presented as a substitute for missing detail.

## 5. Transition from synthetic to real validated results

Gate order, each independently verifiable:

1. Backend + provider approved and built; live `SkinAnalysisService`
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
