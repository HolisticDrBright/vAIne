import { z } from 'zod';
import { SKIN_CAPTURE_ANGLES, SKIN_OBSERVATION_TAGS } from './observationTaxonomy';
import type { SkinAnalysis } from './skinAnalysisSchema';

/**
 * Regression photo set: the contract and the comparison.
 *
 * A fixed set of photographs is run through the analysis path, and each
 * result is compared with a recorded baseline. The run fails when any
 * appearance score moves outside a narrow band, when the observation tags
 * drift, or when a photograph that used to be accepted becomes a retake (or
 * the reverse). Repeatability is a claim the app makes to people, so it is
 * enforced here rather than assumed.
 *
 * This module is pure. The runner that reads photographs and calls the
 * analysis path lives in `scripts/regression/`. Photographs are never part
 * of the repository: the manifest points at files that must live outside
 * it, and only synthetic or expressly consented photographs may be used.
 */

export const REGRESSION_MANIFEST_VERSION = 'regression_manifest_v1';
export const REGRESSION_BASELINE_VERSION = 'regression_baseline_v1';

const absolutePath = z.string().min(2).refine((value) => value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value), 'absolute path required');

export const regressionCaptureSchema = z.object({
  angle: z.enum(SKIN_CAPTURE_ANGLES),
  /** Absolute path to a JPEG outside the repository. */
  path: absolutePath,
}).strict();

export const regressionCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  kind: z.enum(['synthetic', 'consented']),
  captures: z.array(regressionCaptureSchema).min(1).max(3),
  /** Optional labels carried from the photo set; never sent to the analysis. */
  labels: z.object({
    band: z.enum(['I', 'II', 'III', 'IV', 'V', 'VI']).optional(),
    lighting: z.enum(['window_daylight', 'warm_indoor', 'cool_led', 'dim']).optional(),
  }).strict().optional(),
}).strict();

export const regressionManifestSchema = z.object({
  version: z.literal(REGRESSION_MANIFEST_VERSION),
  setVersion: z.string().min(1).max(40),
  cases: z.array(regressionCaseSchema).min(1).max(200),
}).strict().refine((manifest) => new Set(manifest.cases.map((item) => item.id)).size === manifest.cases.length, 'case ids must be unique');

export type RegressionManifest = z.infer<typeof regressionManifestSchema>;
export type RegressionCase = z.infer<typeof regressionCaseSchema>;

const scoresSchema = z.object({
  overall: z.number().min(0).max(100),
  hydrationLook: z.number().min(0).max(100),
  toneEvennessLook: z.number().min(0).max(100),
  textureLook: z.number().min(0).max(100),
  radianceLook: z.number().min(0).max(100),
  poreVisibilityLook: z.number().min(0).max(100),
}).strict();

export type AppearanceScores = z.infer<typeof scoresSchema>;
export const SCORE_KEYS = ['overall', 'hydrationLook', 'toneEvennessLook', 'textureLook', 'radianceLook', 'poreVisibilityLook'] as const satisfies readonly (keyof AppearanceScores)[];

/** What is kept per case: scores, tags, quality decision. Never a photo or a path. */
export const regressionBaselineCaseSchema = z.discriminatedUnion('outcome', [
  z.object({
    id: z.string(),
    outcome: z.literal('completed'),
    scores: scoresSchema,
    observationTags: z.array(z.enum(SKIN_OBSERVATION_TAGS)),
    overallConfidence: z.number().min(0).max(1),
  }).strict(),
  z.object({
    id: z.string(),
    outcome: z.literal('retake'),
    qualityIssues: z.array(z.string()),
  }).strict(),
]);

export const regressionBaselineSchema = z.object({
  version: z.literal(REGRESSION_BASELINE_VERSION),
  setVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  recordedAtIso: z.string(),
  cases: z.array(regressionBaselineCaseSchema),
}).strict();

export type RegressionBaseline = z.infer<typeof regressionBaselineSchema>;
export type RegressionBaselineCase = z.infer<typeof regressionBaselineCaseSchema>;

/** The narrow band. Points are on the 0–100 appearance indices. */
export interface RegressionBands {
  /** Maximum allowed move for any of the five area scores. */
  scorePoints: number;
  /** Maximum allowed move for the overall index. */
  overallPoints: number;
  /** Minimum Jaccard overlap between baseline and current observation tags. */
  tagOverlapMin: number;
  /** Maximum allowed move in overall confidence. */
  confidenceDelta: number;
}

export const DEFAULT_REGRESSION_BANDS: RegressionBands = {
  scorePoints: 4,
  overallPoints: 3,
  tagOverlapMin: 0.75,
  confidenceDelta: 0.15,
};

/** Reduces a validated result to the baseline shape. */
export function toBaselineCase(id: string, outcome: { kind: 'completed'; result: SkinAnalysis } | { kind: 'retake'; issues: readonly string[] }): RegressionBaselineCase {
  if (outcome.kind === 'retake') return { id, outcome: 'retake', qualityIssues: [...outcome.issues] };
  return {
    id,
    outcome: 'completed',
    scores: { ...outcome.result.appearanceScores },
    observationTags: [...outcome.result.observationTags],
    overallConfidence: outcome.result.overallConfidence,
  };
}

/**
 * Paths that point inside the repository are refused outright: a photo
 * committed by mistake is the one leak this harness must never cause.
 */
export function pathsInsideRepository(manifest: RegressionManifest, repoRoot: string): string[] {
  const normalizedRoot = repoRoot.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
  return manifest.cases
    .flatMap((item) => item.captures.map((capture) => capture.path))
    .filter((path) => {
      const normalized = path.replace(/\\/g, '/').toLowerCase();
      return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
    });
}

export function tagOverlap(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const tag of a) if (b.has(tag)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export type RegressionCaseStatus = 'within' | 'score_drift' | 'tag_drift' | 'confidence_drift' | 'outcome_changed' | 'missing';

export interface RegressionCaseResult {
  id: string;
  status: RegressionCaseStatus;
  /** Signed deltas (current − baseline) per score; empty unless both completed. */
  scoreDeltas: Partial<Record<keyof AppearanceScores, number>>;
  maxScoreDelta: number;
  tagOverlap: number | null;
  confidenceDelta: number | null;
  notes: string[];
}

export function compareCase(
  baseline: RegressionBaselineCase | undefined,
  current: RegressionBaselineCase | undefined,
  bands: RegressionBands = DEFAULT_REGRESSION_BANDS,
): RegressionCaseResult {
  const id = baseline?.id ?? current?.id ?? 'unknown';
  const empty: RegressionCaseResult = { id, status: 'within', scoreDeltas: {}, maxScoreDelta: 0, tagOverlap: null, confidenceDelta: null, notes: [] };

  if (!baseline || !current) {
    return { ...empty, status: 'missing', notes: [!baseline ? 'No baseline recorded for this case.' : 'The current run produced no result for this case.'] };
  }
  if (baseline.outcome !== current.outcome) {
    return {
      ...empty,
      status: 'outcome_changed',
      notes: [`Baseline was ${baseline.outcome === 'completed' ? 'accepted' : 'a retake'}; the current run was ${current.outcome === 'completed' ? 'accepted' : 'a retake'}.`],
    };
  }
  if (baseline.outcome === 'retake' || current.outcome === 'retake') {
    return { ...empty, notes: ['Both runs asked for a retake.'] };
  }

  const scoreDeltas: Partial<Record<keyof AppearanceScores, number>> = {};
  let maxScoreDelta = 0;
  const notes: string[] = [];
  let status: RegressionCaseStatus = 'within';
  for (const key of SCORE_KEYS) {
    const delta = current.scores[key] - baseline.scores[key];
    scoreDeltas[key] = delta;
    maxScoreDelta = Math.max(maxScoreDelta, Math.abs(delta));
    const limit = key === 'overall' ? bands.overallPoints : bands.scorePoints;
    if (Math.abs(delta) > limit) {
      status = 'score_drift';
      notes.push(`${key} moved ${delta > 0 ? '+' : ''}${delta} (band ±${limit}).`);
    }
  }

  const overlap = tagOverlap(baseline.observationTags, current.observationTags);
  if (status === 'within' && overlap < bands.tagOverlapMin) {
    status = 'tag_drift';
  }
  if (overlap < bands.tagOverlapMin) {
    const gained = current.observationTags.filter((tag) => !baseline.observationTags.includes(tag));
    const lost = baseline.observationTags.filter((tag) => !current.observationTags.includes(tag));
    notes.push(`Tag overlap ${overlap.toFixed(2)} (minimum ${bands.tagOverlapMin}).${gained.length ? ` Gained: ${gained.join(', ')}.` : ''}${lost.length ? ` Lost: ${lost.join(', ')}.` : ''}`);
  }

  const confidenceDelta = current.overallConfidence - baseline.overallConfidence;
  if (Math.abs(confidenceDelta) > bands.confidenceDelta) {
    if (status === 'within') status = 'confidence_drift';
    notes.push(`Overall confidence moved ${confidenceDelta > 0 ? '+' : ''}${confidenceDelta.toFixed(2)} (band ±${bands.confidenceDelta}).`);
  }

  return { id, status, scoreDeltas, maxScoreDelta, tagOverlap: overlap, confidenceDelta, notes };
}

export interface RegressionSummary {
  pass: boolean;
  total: number;
  within: number;
  drifted: number;
  outcomeChanged: number;
  missing: number;
  maxScoreDelta: number;
  /** Set when baseline and run disagree on prompt or model; a run across versions is informative, not a pass. */
  versionMismatch: string | null;
}

export function compareRun(
  baseline: RegressionBaseline,
  run: { promptVersion: string; modelVersion: string; cases: readonly RegressionBaselineCase[] },
  bands: RegressionBands = DEFAULT_REGRESSION_BANDS,
): { summary: RegressionSummary; results: RegressionCaseResult[] } {
  const currentById = new Map(run.cases.map((item) => [item.id, item]));
  const baselineById = new Map(baseline.cases.map((item) => [item.id, item]));
  const ids = [...new Set([...baselineById.keys(), ...currentById.keys()])];
  const results = ids.map((id) => compareCase(baselineById.get(id), currentById.get(id), bands));

  const within = results.filter((item) => item.status === 'within').length;
  const outcomeChanged = results.filter((item) => item.status === 'outcome_changed').length;
  const missing = results.filter((item) => item.status === 'missing').length;
  const drifted = results.length - within - outcomeChanged - missing;
  const mismatches: string[] = [];
  if (baseline.promptVersion !== run.promptVersion) mismatches.push(`prompt ${baseline.promptVersion} → ${run.promptVersion}`);
  if (baseline.modelVersion !== run.modelVersion) mismatches.push(`model ${baseline.modelVersion} → ${run.modelVersion}`);

  return {
    summary: {
      pass: results.length > 0 && within === results.length && mismatches.length === 0,
      total: results.length,
      within,
      drifted,
      outcomeChanged,
      missing,
      maxScoreDelta: Math.max(0, ...results.map((item) => item.maxScoreDelta)),
      versionMismatch: mismatches.length ? mismatches.join('; ') : null,
    },
    results,
  };
}

export function formatRegressionReport(summary: RegressionSummary, results: readonly RegressionCaseResult[]): string {
  const lines = [
    `Regression ${summary.pass ? 'PASS' : 'FAIL'}: ${summary.within}/${summary.total} within band, ${summary.drifted} drifted, ${summary.outcomeChanged} outcome changed, ${summary.missing} missing. Largest score move ${summary.maxScoreDelta}.`,
  ];
  if (summary.versionMismatch) lines.push(`Version mismatch (informative run, not a pass): ${summary.versionMismatch}`);
  for (const item of results) {
    if (item.status === 'within' && item.notes.length === 0) continue;
    lines.push(`- ${item.id}: ${item.status}${item.notes.length ? ` — ${item.notes.join(' ')}` : ''}`);
  }
  return lines.join('\n');
}
