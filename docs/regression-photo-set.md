# Regression photo set

"Same photo, same result" is a promise vAIne makes to people. This harness
holds the analysis to it: a fixed set of photographs is run through the
real analysis path and every result must land inside a narrow band of the
recorded baseline. A prompt or model change that moves scores more than the
band, changes which observations appear, or turns an accepted photograph
into a retake fails the run.

## What exists

- **Contract and comparison**: `src/domain/analysis/regression.ts`. The
  manifest schema, the baseline schema (scores, tags, confidence, quality
  decision, never a path or a photo), the bands, and the comparison. Unit
  tests in `src/domain/analysis/__tests__/regression.test.ts`.
- **Runner**: `scripts/regression/regression.harness.test.ts`. Reads the
  manifest, refuses any photo path inside the repository, sends each case
  to the `analyze-skin` Edge Function exactly as the app does (JPEG bytes in
  one request body, nothing stored), reduces each result to the baseline
  shape, and compares. `npm test` skips it; it runs only when
  `VAINE_REGRESSION_MANIFEST` is set.

## The band

| Measure | Allowed move between baseline and re-run |
| --- | --- |
| Each of the five area scores | ±4 points on 0–100 |
| Overall index | ±3 points |
| Observation tags | Jaccard overlap at least 0.75 |
| Overall confidence | ±0.15 |
| Quality decision | Must not change (accepted ↔ retake) |

A run on a different prompt or model version than the baseline is reported
in full but never counts as a pass: it is how a change is evaluated, after
which a new baseline is recorded deliberately.

## The photographs

Only synthetic photographs or photographs from people who gave written
consent for model evaluation. No photograph is ever committed; the runner
refuses a manifest whose paths resolve inside the repository. Keep the set
in an encrypted location outside the repository, keyed by opaque case ids.

Resize photographs to at most 1600 px on the longest side and save as JPEG
before adding them, so the runner sends what the app would send. The
runner reads dimensions from the JPEG header and does not resize.

A useful first set, about 30 cases:

- Six to twelve clearly usable front photographs across Fitzpatrick I to
  VI (the skin-tone set in `skin-tone-testing.md` can supply them).
- The same faces under warm indoor and cool LED light.
- Three deliberately dim photographs that must stay retakes.
- Two blurred and one filtered photograph that must stay retakes.
- One three-angle case (front, left, right) to exercise the full request.

## Manifest

```json
{
  "version": "regression_manifest_v1",
  "setVersion": "2026-11",
  "cases": [
    {
      "id": "p0001-window-front",
      "kind": "consented",
      "captures": [{ "angle": "front", "path": "/secure/vaine-regression/p0001/window-front.jpg" }],
      "labels": { "band": "V", "lighting": "window_daylight" }
    },
    {
      "id": "dim-01",
      "kind": "synthetic",
      "captures": [{ "angle": "front", "path": "/secure/vaine-regression/synthetic/dim-01.jpg" }],
      "labels": { "lighting": "dim" }
    }
  ]
}
```

Labels are carried for the report only. They are never sent to the
analysis.

## Running

Set the environment, then record a baseline once and compare on every
change:

```sh
export VAINE_REGRESSION_MANIFEST=/secure/vaine-regression/manifest.json
export EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
export VAINE_REGRESSION_JWT=<access token of a consenting beta tester account>

VAINE_REGRESSION_RECORD=1 npm run regression   # writes baseline.json beside the manifest
npm run regression                              # compares and fails outside the band
```

The access token must belong to an account whose owner has consented to
evaluation runs, because each case counts against that account's quota and
its photo-free results are stored under it like any other check-in.

When to re-record: only after a deliberate prompt or model change, once the
comparison run has been read and the movement understood. Record the
reason in the commit that updates the baseline's `promptVersion`.

## What a failure means

- **score_drift** or **confidence_drift** on the same prompt and model: the
  path is not repeatable enough. Check for randomness in the provider call,
  a changed resize or JPEG setting, or a provider-side model update.
- **tag_drift**: the observations themselves changed. Read the gained and
  lost tags per case before deciding whether the band or the prompt is
  wrong.
- **outcome_changed**: the quality gate moved. This is the most visible
  change to a person and needs a reason before it ships.
- **missing**: the manifest and baseline disagree. Re-record only if a case
  was intentionally added or removed.

## Still to do

- Assemble the photo set. No photographs exist yet.
- The sandbox used for development cannot reach the Edge Function, so the
  first real run happens from a machine with network access and a
  consenting tester's token.
