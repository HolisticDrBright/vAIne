# Live analysis runbook

The live path is on when three things are true: the app is built with the
vaine-beta publishable configuration, the person is signed in with Apple, and
the `analysis_enabled` flag is true. Everything else shows the labelled
synthetic sample and uploads nothing.

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Edge Function `analyze-skin` | `supabase/functions/analyze-skin/` | Only server-side photo entry point. Photos arrive in the request body, are validated (JPEG signature, size, dimensions, angles), sent once to the vision provider, and released; they are never written to storage, logs, or rows. |
| Contract | `supabase/functions/_shared/skinAnalysisContract.ts` | Server copy of the prompt, tag allow-list, and strict schema. A vitest sync test keeps it identical to `src/domain/analysis`. |
| Client service | `src/services/liveSkinAnalysisService.ts` | Re-encodes each photo on the phone (`expo-image-manipulator`, longest side 1600 px, EXIF dropped), calls the function, re-validates the result. No synthetic fallback. |
| Router | `src/state/AnalysisRuntime.tsx` | Picks live or demo and tells consent, processing, results, and account screens which one applies. |
| Result storage | `public.analysis_results` | Photo-free, owner-readable, service-role written. Removed by account deletion. |
| Audit | `public.analysis_audit` | `analysis_started`, `analysis_completed`, `analysis_retake_requested`, `analysis_failed`, `analysis_rejected`; photo-free details only. |

## Secrets and settings

- `ANTHROPIC_API_KEY` — Edge Function secret (Dashboard → Edge Functions → Secrets, `https://supabase.com/dashboard/project/wfahmuxuldivkwzbtdcg/functions/secrets`). Never in the app or repo.
- `ANTHROPIC_MODEL` — optional secret; defaults to `claude-sonnet-5`, the Sonnet-class budget the plan approved (about $0.05 per analysis inside the $5/day ceiling). Set to `claude-opus-5` for roughly double the cost per analysis.
- `analysis_enabled` in `public.app_flags` — the kill switch. `update public.app_flags set enabled = false where key = 'analysis_enabled';` stops new analyses immediately; the app then shows "live analysis is off" and falls back to the labelled demo.
- `public.beta_limits` — per-user daily (3) and monthly (20), global daily (100), max images (6), max beta users (50). Edit rows to change caps without a release.

## Redeploying the function

Include the two `_shared` files with the function's own files, or use the CLI
from the repository root:

```sh
supabase functions deploy analyze-skin --project-ref wfahmuxuldivkwzbtdcg
```

`verify_jwt` stays on. The function additionally confirms the token with the
Auth server, so revoked sessions cannot analyze.

## Error codes

| Code | Client failure | Meaning |
| --- | --- | --- |
| `unauthorized` | sign in required | No valid session |
| `analysis_disabled` / `provider_not_configured` | analysis unavailable | Flag off, or no API key secret |
| `quota_daily` / `quota_monthly` / `quota_global` / `beta_full` | quota exceeded | Beta caps |
| `not_jpeg`, `image_too_large`, `invalid_dimensions`, … | photos rejected | Request validation |
| `provider_unavailable` | service unavailable | Provider call failed or timed out |
| `provider_refused` | provider refused | Safety refusal; no result produced |
| `invalid_result` | invalid result | Response failed the strict schema or the photo-free scan; discarded |

## What is still not built

- Invite allow-list enforcement (`beta_invites`) — quotas and the user cap apply, but anyone who can sign in can analyze.
- Cloud history screen for past results (rows exist; the app shows only the last check-in it remembers locally).
- The evaluation harness and repeatability validation the plan lists before numeric scores are treated as stable.
