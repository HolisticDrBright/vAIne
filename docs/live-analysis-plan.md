# Live-analysis production plan

This plan covers the transition from the current honest synthetic prototype to
a secure, genuinely functional consumer launch. Local interfaces, schemas,
mocks, and tests are implemented ahead of approval. Every item marked
**requires approval** must receive explicit user sign-off before any external
resource, provider account, paid service, or dependency is created.

Status as of 2026-08-06:

- On-device ML Kit face detection: **approved and shipped** in TestFlight
  1.0.0 Build 7 (commit `64ecc7d`). The Swift module, ML Kit pod, Expo
  autolinking, and archive compiled successfully. Physical-iPhone validation
  of Build 7 is the open Phase 0 gate.
- Backend (Supabase + server-side Anthropic vision): **conditionally approved
  for planning and local interfaces only.** Nothing external exists yet; the
  Phase 1 approval checkpoint below is the gate to create it.
- Authentication decision: **Sign in with Apple** for the secure beta
  (recommended and assumed below; the anonymous-beta alternative from earlier
  drafts is retired unless the user asks for it).

## Environments

Three strictly separated environments; no resource is shared between them and
none belongs to any other product.

| Environment | Client | Backend | Purpose |
| --- | --- | --- | --- |
| Local development | Expo dev build / web export | None — synthetic service, mock auth, mock upload | All UI and domain work; tests |
| Secure beta | TestFlight builds | Supabase project `vaine-beta` (new, dedicated) | Real accounts, real uploads, live analysis for invited testers |
| Production | App Store build | Supabase project `vaine-prod` (created only at launch approval) | Paying users |

Client selects the environment at build time via EAS environment variables
(publishable URL + anon key only — never service keys). Demo mode (synthetic,
no upload, no account) remains reachable in every environment and clearly
labeled.

## 1. Architecture (per approved direction)

- Expo/React Native client; on-device ML Kit for framing and facial-zone
  geometry (shipped).
- A completely separate vAIne Supabase project per environment; **never** a
  project shared with any other product.
- Sign in with Apple for the secure beta; authentication required before any
  cloud analysis; local-only demo requires no account and uploads nothing.
- Private temporary photo storage (no public access, random per-analysis
  paths, upload-only, immediate post-analysis deletion).
- Supabase Edge Functions limited to authentication, authorization,
  orchestration, schema validation, deletion, rate limiting, and cleanup —
  no heavy image transformation server-side (that stays on the phone or at
  the vision provider).
- Server-side Anthropic vision analysis behind the existing
  provider-independent `SkinAnalysisService` interface; versioned prompt and
  schema; validated structured results; **no synthetic fallback, ever**.
- Photo-free analysis results stored in the account (cloud) for history and
  progress; progress photographs stay local by default. Any future cloud
  photo baseline is a separate explicit approval and opt-in design.

### Backend specification (unchanged commitments)

| Concern | Specification |
| --- | --- |
| Compute boundary | Edge Functions are the only photo entry point and stay thin: auth, authorization, signed-URL issuance, provider-call orchestration, response validation, deletion, cleanup |
| Storage | One private bucket, public access disabled, no public URLs ever issued |
| Object paths | Random, unguessable: `<user_id>/<analysis_id>/<128-bit random>/<angle>.jpg`; no sequential IDs or user-supplied names |
| Upload authorization | Single-use signed upload URLs issued per analysis after auth + quota + rate-limit checks; upload-only, `upsert: false`; server validates MIME by file signature, not filename |
| Upload limits | JPEG/HEIC only; ≤ 8 MB per file; 480–6000 px per side; ≤ 3 images per Quick Scan, ≤ 6 with close-ups; count enforced per analysis ID |
| Slot expiry | Supabase signed upload URLs currently allow up to two hours — treated as a platform ceiling only; the application expires each analysis slot after 10 minutes |
| Retention | Photos deleted immediately after analysis completes, success **and** failure (finally-style cleanup); orphan sweep every 15 minutes deletes objects older than one hour; 24 hours is an absolute emergency maximum, never routine retention |
| User deletion | Delete-my-data endpoint removes remaining objects, derived rows, and audit rows; account deletion removes everything associated with the account |
| Logging | No photo data, image URLs, base64, signed URLs, facial geometry, or user-identifying prompt content in any application, provider, analytics, crash, or audit log — only the photo-free `AnalysisAuditEntry` shape is loggable |
| Validation | Structured results validated server-side and client-side against the versioned schema; malformed or out-of-policy responses rejected as typed failures |
| Rate limiting & quotas | Per-user and per-IP caps on analysis starts; per-user daily/monthly quotas; org-level daily cap |
| Cost caps & kill switch | Provider spend alarms; a feature flag that immediately disables new analysis uploads; clients then show an honest "analysis temporarily unavailable" state — never fiction |
| Monitoring | Failure-rate, latency, quota, and spend dashboards over photo-free audit metadata only |
| Security testing | Automated tests for unauthorized access, cross-user object access, replayed uploads, invalid MIME, oversized images, excessive counts, expired slots, provider timeouts, deletion failure, and orphan cleanup |

### Anthropic provider commitments

- Credentials exist only server-side (Edge Function secrets), never in the
  client or repo.
- Current official Anthropic API documentation is consulted at implementation
  time; no remembered model names or behavior.
- Output is visual appearance analysis only — never diagnosis, identity,
  ethnicity, health conditions, hormones, age, or emotional state; concerning
  appearances route to neutral professional-review language.
- Before the first real user photo is transmitted: review and record
  Anthropic's retention behavior and configurations, no-training default,
  subprocessor list, DPA, and regional options (including `inference_geo`).
- Claude.ai subscriptions and Claude Code credits do **not** cover production
  API usage; vAIne needs its own funded API account.

## 2. Approval checkpoint — Phase 1 gate (decision required)

No external resource is created until each line is explicitly approved.

| # | Item | Proposal |
| --- | --- | --- |
| 1 | Supabase project name | `vaine-beta` (fresh project; `vaine-prod` deferred to launch approval) |
| 2 | Supabase region | `us-east-1` — closest major region to the initial US beta audience and to the US-served Anthropic API; revisit only if EU testers join the beta (decision recorded here either way) |
| 3 | Sign in with Apple configuration | Apple Developer portal: enable the Sign in with Apple capability on App ID `com.holisticdrbright.vaine`; create a Services ID (proposed `com.holisticdrbright.vaine.auth`) and a Sign in with Apple private key (`.p8`); enter Team ID, Key ID, Services ID, and the `.p8` into Supabase Auth's Apple provider settings (dashboard — never chat or repo). Client uses the native Apple flow and exchanges the identity token with Supabase |
| 4 | Anthropic API billing | Dedicated vAIne workspace + API key in the user's Anthropic Console, funded separately (suggest $50–100 initial credit). Estimated ≈ $0.05 per Quick Scan (Sonnet-class; ≈ $0.01 Haiku-class, ≈ $0.09 Opus-class). Key stored only as a Supabase Edge Function secret |
| 5 | Beta limits | 50 invited testers max; 3 analyses/day and 20/month per user; org-wide cap 100 analyses/day (≈ $5/day ceiling); ≤ 6 images per analysis; kill switch defaults to available |
| 6 | New paid services | None expected for the beta: Supabase free tier suffices initially (flag: Supabase Pro at $25/mo becomes advisable for backups/log retention before production); Apple Developer membership already active; Anthropic prepaid credit above |
| 7 | Credentials / manual user actions | (a) approve creation of `vaine-beta` (can be provisioned via the connected Supabase account after approval); (b) Apple portal steps in item 3; (c) create the Anthropic key and place it in Supabase Edge Function secrets; (d) optional, for builds from this cloud session: add `EXPO_TOKEN` to the environment and allow `api.expo.dev`/`expo.dev` in its network policy. No secret value is ever pasted into chat or committed |

## 3. Secure photo lifecycle (client work queued behind the gate)

1. Reuse the existing consent and camera flow; on-device validation before
   upload; strip EXIF/metadata and normalize orientation via re-encode;
   resize only when skin detail is preserved.
2. Authenticated user + explicit analysis consent → request analysis slot →
   backend enforces quota/rate limits → single-use signed upload URLs.
3. Upload JPEGs only — no names, contacts, or identifiers accompany photos.
4. Backend runs one provider call, validates, writes the photo-free audit
   entry and the photo-free result row, deletes uploads immediately, returns
   the validated result or a typed failure.
5. Client re-validates and shows upload, analysis, deletion, retake,
   cancellation, offline, and failure states; leaving the flow cancels
   safely; deleted photos never leave broken-image UI.
6. Orphan cleanup as specified above.

## 4. On-device landmarks (shipped) and evaluation harness

Detector integration is complete (see Status). Remaining: the versioned
evaluation harness using only synthetic, licensed, or expressly consented
images — covering orientation/mirroring, lighting, blur/exposure, devices,
diverse visible skin tones, makeup/facial hair, glasses/occlusion, no-face,
multi-face, overconfidence, unsupported medical claims, repeatability,
schema failures, and retake behavior. Synthetic testing is never described
as proof of fairness or clinical validity.

## 5. Transition from synthetic to real validated results

1. Phase 0: physical-iPhone validation of Build 7; merge PR #2 only after
   user confirmation.
2. Phase 1 approval → create `vaine-beta` only.
3. Phases 2–3: auth + secure photo lifecycle against `vaine-beta`.
4. Phase 4: live provider through `SkinAnalysisService`; contract tests
   identical to the synthetic implementation's.
5. Screens drop synthetic labels only when backed by a real validated
   `AnalysisRecord` (mode `live`); demo mode stays clearly labeled.
6. Phase 5 repeatability validation before numeric scores ship; qualitative
   summaries otherwise.

Until step 5, every visible result remains labeled demonstration content.
