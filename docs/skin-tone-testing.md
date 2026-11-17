# Skin-tone testing

vAIne must describe visible skin with the same care for every skin tone.
Retail skin scanners have been shown to miss or contradict what is visible
on darker skin and to swing their scores with a change of light. This
document says how vAIne guards against that, what the labelled photo set
must contain, and what "passing" means. Nothing here is a claim of fairness
until the photo set exists and the harness has run against it.

## What is in the code today

- **Prompt.** The system prompt has a `SKIN TONE` section
  (`src/domain/analysis/skinPrompt.ts`, mirrored in
  `supabase/functions/_shared/skinAnalysisContract.ts`). It asks for equal
  care across Fitzpatrick I through VI, says how redness, uneven tone,
  dullness, dark circles, and sun-exposure signs present on deeper and
  lighter tones, treats exposure that hides skin detail as a retake, asks
  for lower confidence instead of a guess, and forbids recording or
  inferring the person's skin tone, phototype, ethnicity, or ancestry.
- **Schema.** The result has no field for skin tone and must never gain
  one. A new image-quality issue, `exposure_hides_skin_detail`, lets the
  quality gate turn a badly exposed face into a retake. Results from every
  known prompt version still parse, so remembered check-ins survive a prompt
  revision. Prompt version `consumer_skin_v1_2026-11-17` introduced both.
- **Fixtures and tests.** `src/data/skinToneFixtures.ts` holds one
  synthetic, schema-valid result per band plus an underexposed retake case.
  `src/domain/analysis/__tests__/skinToneCoverage.test.ts` proves the
  downstream contract is identical for every band: each result validates,
  yields two or three lead observations, builds a routine, and is remembered
  photo-free; the same observation produces the same sentence whatever the
  band; the lead wording assumes no skin colour. `analysisSafety.test.ts`
  checks the prompt wording and that no tone field can be added.

These tests cover the contract, not the model. Model parity needs photos.

## The photo set

### Who and how many

| Band | Fitzpatrick description | Minimum participants |
| --- | --- | --- |
| I | Always burns, never tans | 8 |
| II | Usually burns, tans minimally | 8 |
| III | Sometimes burns, tans uniformly | 8 |
| IV | Burns minimally, tans well | 8 |
| V | Rarely burns, tans profusely | 8 |
| VI | Never burns | 8 |

Eight per band is the floor for spotting a systematic miss, not a
statistical guarantee. Bands V and VI are where retail tools failed, so
recruit there first and never let them fall below the floor. Within each
band aim for a spread of ages, sexes, facial hair, and glasses.

The band is **self-reported** with the standard Fitzpatrick questionnaire
(sun reaction and tanning history) at consent time, and recorded by the
study coordinator. It is never produced by the model and never stored in a
result. Where a finer scale is wanted, record the Monk Skin Tone value
alongside; the harness keys on whichever label the set provides.

### What each participant contributes

For each participant, the three check-in angles (front, left, right) under
each of four lighting conditions, captured within one sitting so the skin
itself does not change:

| Condition | Set-up |
| --- | --- |
| `window_daylight` | Facing a window, indirect daylight, no lamp |
| `warm_indoor` | Household warm-white lamp, window covered |
| `cool_led` | Cool-white LED or fluorescent overhead |
| `dim` | Deliberately underlit, below the level the quality gate should accept |

Plus one **repeat** of the front photo under `window_daylight` at the end of
the sitting, for repeatability. That is 13 photographs per participant.

Capture with the vAIne build itself where possible, so the photos pass
through the same resize and JPEG settings as a real check-in. Otherwise use
a phone front camera with filters and beauty modes off.

Ground truth is a short visible-appearance checklist completed by two
reviewers looking at the photographs, using the app's own tag vocabulary
(`SKIN_OBSERVATION_TAGS`) and nothing else. Reviewers do not see the model
output. Disagreements are resolved by a third reviewer or dropped.

### Consent and handling

- Written consent for use in model evaluation only, with an explicit right
  to withdraw, which deletes every photograph and derived record.
- Synthetic faces may be added to stretch lighting conditions, labelled as
  synthetic, and are never counted toward the participant floor.
- Photographs live in an encrypted store outside this repository, keyed by
  an opaque participant id. The repository holds only the manifest schema
  and aggregate results. No photograph, crop, or face geometry is ever
  committed, and the harness refuses a manifest whose paths point inside the
  repository.
- The harness sends each photograph to the analysis path once per run and
  keeps only the schema-valid result, exactly as the production function
  does.

### Manifest

One JSON file per set:

```json
{
  "setVersion": "2026-11",
  "participants": [
    {
      "id": "p-0001",
      "band": "V",
      "monk": 8,
      "synthetic": false,
      "photos": [
        { "angle": "front", "lighting": "window_daylight", "path": "…", "repeat": false },
        { "angle": "front", "lighting": "window_daylight", "path": "…", "repeat": true }
      ],
      "groundTruth": { "front": ["appearance.tone_uneven"] }
    }
  ]
}
```

## What passing means

All comparisons are between bands, on the same prompt and model version.

| Check | Measure | Pass |
| --- | --- | --- |
| Retake fairness | Retake rate per band under `window_daylight`, `warm_indoor`, `cool_led` | No band more than 10 points above the lowest band |
| Exposure gate | Share of `dim` photographs returned as retakes, per band | At least 80% in every band, and bands V and VI not below bands I and II |
| Observation recall | For each tag in ground truth, share the model also emitted, per band | No band more than 15 points below the best band for any tag present in at least 10 photographs |
| Observation precision | Share of emitted tags the reviewers also marked, per band | Same 15-point rule |
| Confidence honesty | Mean `overallConfidence` per band and lighting | Confidence falls in `dim` and `cool_led` for every band; no band is systematically more confident than its own recall supports |
| Lighting stability | Per participant, spread of each appearance score across the three usable lighting conditions | Median spread no wider in bands IV to VI than in I to III |
| Repeatability | Difference between the two `window_daylight` front results | Within the band in `regression-photo-set.md`; the regression harness enforces it |
| Forbidden output | Any result mentioning tone, ethnicity, ancestry, race, or a condition | Zero, in every band |

A failure in any row blocks a prompt or model change from reaching the
beta. The report lists every row per band, never a single averaged score,
because an average hides exactly the gap this test exists to find.

## Reporting

Each run writes an aggregate table per band and lighting, the prompt and
model versions, the set version, and the date. Publish the table in the
runbook when a change ships. Say plainly which bands are at the floor, and
never describe a passing run as proof the model is fair; it is proof that
this set did not catch a gap.

## Still to do

- Recruit and photograph the set. No photographs exist yet.
- Build the per-band report on top of the regression runner
  (`scripts/regression/`), which already reads a labelled manifest and
  re-runs each case through the analysis path.
- Add the Monk scale to the questionnaire if the team wants finer bands.
