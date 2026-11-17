import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  DEFAULT_REGRESSION_BANDS,
  REGRESSION_BASELINE_VERSION,
  REGRESSION_MANIFEST_VERSION,
  compareCase,
  compareRun,
  formatRegressionReport,
  pathsInsideRepository,
  regressionBaselineSchema,
  regressionManifestSchema,
  tagOverlap,
  toBaselineCase,
  type RegressionBaseline,
  type RegressionBaselineCase,
} from '../regression';

const completed = toBaselineCase('case-a', { kind: 'completed', result: syntheticSkinAnalysis });

function baselineWith(cases: RegressionBaselineCase[]): RegressionBaseline {
  return { version: REGRESSION_BASELINE_VERSION, setVersion: '2026-11', promptVersion: 'p1', modelVersion: 'm1', recordedAtIso: '2026-11-17T00:00:00.000Z', cases };
}

describe('regression manifest', () => {
  test('accepts absolute photo paths and labels, rejects relative paths and duplicate ids', () => {
    const manifest = {
      version: REGRESSION_MANIFEST_VERSION,
      setVersion: '2026-11',
      cases: [
        { id: 'case-a', kind: 'consented', captures: [{ angle: 'front', path: '/secure/photos/a-front.jpg' }], labels: { band: 'V', lighting: 'window_daylight' } },
        { id: 'case-b', kind: 'synthetic', captures: [{ angle: 'front', path: 'C:\\secure\\b.jpg' }] },
      ],
    };
    expect(regressionManifestSchema.safeParse(manifest).success).toBe(true);
    expect(regressionManifestSchema.safeParse({ ...manifest, cases: [{ ...manifest.cases[0], captures: [{ angle: 'front', path: 'photos/a.jpg' }] }] }).success).toBe(false);
    expect(regressionManifestSchema.safeParse({ ...manifest, cases: [manifest.cases[0], manifest.cases[0]] }).success).toBe(false);
    expect(regressionManifestSchema.safeParse({ ...manifest, cases: [{ ...manifest.cases[0], kind: 'scraped' }] }).success).toBe(false);
  });

  test('refuses any photo path inside the repository', () => {
    const manifest = regressionManifestSchema.parse({
      version: REGRESSION_MANIFEST_VERSION,
      setVersion: '2026-11',
      cases: [
        { id: 'inside', kind: 'synthetic', captures: [{ angle: 'front', path: '/home/user/vAIne/assets/face.jpg' }] },
        { id: 'outside', kind: 'synthetic', captures: [{ angle: 'front', path: '/home/user/vAIne-photos/face.jpg' }] },
      ],
    });
    expect(pathsInsideRepository(manifest, '/home/user/vAIne/')).toEqual(['/home/user/vAIne/assets/face.jpg']);
    expect(pathsInsideRepository(manifest, 'C:\\Users\\Brand\\vAIne')).toEqual([]);
  });
});

describe('regression baseline', () => {
  test('keeps scores, tags, and confidence only; never a path or photo', () => {
    expect(completed).toEqual({
      id: 'case-a',
      outcome: 'completed',
      scores: syntheticSkinAnalysis.appearanceScores,
      observationTags: syntheticSkinAnalysis.observationTags,
      overallConfidence: syntheticSkinAnalysis.overallConfidence,
    });
    expect(JSON.stringify(baselineWith([completed]))).not.toMatch(/file:|\.jpg|base64|path/i);
    expect(regressionBaselineSchema.safeParse(baselineWith([completed])).success).toBe(true);
    expect(regressionBaselineSchema.safeParse(baselineWith([{ ...completed, photo: 'x' } as never])).success).toBe(false);
  });

  test('records a retake with its quality issues', () => {
    expect(toBaselineCase('dim', { kind: 'retake', issues: ['too_dark', 'exposure_hides_skin_detail'] })).toEqual({ id: 'dim', outcome: 'retake', qualityIssues: ['too_dark', 'exposure_hides_skin_detail'] });
  });
});

describe('compareCase', () => {
  const scores = completed.outcome === 'completed' ? completed.scores : null!;

  test('is within band for small moves', () => {
    const current: RegressionBaselineCase = { ...completed, outcome: 'completed', scores: { ...scores, hydrationLook: scores.hydrationLook + 3, overall: scores.overall - 2 }, observationTags: completed.outcome === 'completed' ? completed.observationTags : [], overallConfidence: 0.8 };
    const result = compareCase(completed, current);
    expect(result.status).toBe('within');
    expect(result.scoreDeltas.hydrationLook).toBe(3);
    expect(result.maxScoreDelta).toBe(3);
  });

  test('flags an area score outside the band and names it', () => {
    const current = { ...completed, scores: { ...scores, textureLook: scores.textureLook + DEFAULT_REGRESSION_BANDS.scorePoints + 1 } } as RegressionBaselineCase;
    const result = compareCase(completed, current);
    expect(result.status).toBe('score_drift');
    expect(result.notes.join(' ')).toMatch(/textureLook moved \+5 \(band ±4\)/);
  });

  test('holds the overall index to its tighter band', () => {
    const current = { ...completed, scores: { ...scores, overall: scores.overall + DEFAULT_REGRESSION_BANDS.overallPoints + 1 } } as RegressionBaselineCase;
    expect(compareCase(completed, current).status).toBe('score_drift');
    const ok = { ...completed, scores: { ...scores, overall: scores.overall + DEFAULT_REGRESSION_BANDS.overallPoints } } as RegressionBaselineCase;
    expect(compareCase(completed, ok).status).toBe('within');
  });

  test('flags tag drift by overlap', () => {
    expect(tagOverlap(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(tagOverlap([], [])).toBe(1);
    expect(tagOverlap(['a', 'b'], ['a'])).toBe(0.5);
    const current = { ...completed, observationTags: ['appearance.hydration_look_low', 'appearance.visible_redness'] } as RegressionBaselineCase;
    const result = compareCase(completed, current);
    expect(result.status).toBe('tag_drift');
    expect(result.notes.join(' ')).toMatch(/Gained: appearance.visible_redness/);
    expect(result.notes.join(' ')).toMatch(/Lost: appearance.pore_visibility_high/);
  });

  test('flags a confidence swing and a changed outcome', () => {
    const swing = { ...completed, overallConfidence: 0.5 } as RegressionBaselineCase;
    expect(compareCase(completed, swing).status).toBe('confidence_drift');
    const retake: RegressionBaselineCase = { id: 'case-a', outcome: 'retake', qualityIssues: ['blurred'] };
    expect(compareCase(completed, retake).status).toBe('outcome_changed');
    expect(compareCase(retake, retake).status).toBe('within');
    expect(compareCase(completed, undefined).status).toBe('missing');
    expect(compareCase(undefined, completed).status).toBe('missing');
  });
});

describe('compareRun', () => {
  test('passes only when every case is within band on the same prompt and model', () => {
    const baseline = baselineWith([completed, { id: 'dim', outcome: 'retake', qualityIssues: ['too_dark'] }]);
    const same = compareRun(baseline, { promptVersion: 'p1', modelVersion: 'm1', cases: baseline.cases });
    expect(same.summary).toMatchObject({ pass: true, total: 2, within: 2, drifted: 0, outcomeChanged: 0, missing: 0, versionMismatch: null });

    const drifted = compareRun(baseline, {
      promptVersion: 'p1',
      modelVersion: 'm1',
      cases: [{ ...completed, scores: { ...(completed as Extract<RegressionBaselineCase, { outcome: 'completed' }>).scores, radianceLook: 60 } } as RegressionBaselineCase],
    });
    expect(drifted.summary).toMatchObject({ pass: false, drifted: 1, missing: 1 });
    expect(formatRegressionReport(drifted.summary, drifted.results)).toMatch(/^Regression FAIL/);
    expect(formatRegressionReport(drifted.summary, drifted.results)).toMatch(/- dim: missing/);
  });

  test('a run on a different prompt or model is informative, never a pass', () => {
    const baseline = baselineWith([completed]);
    const run = compareRun(baseline, { promptVersion: 'p2', modelVersion: 'm1', cases: baseline.cases });
    expect(run.summary.pass).toBe(false);
    expect(run.summary.within).toBe(1);
    expect(run.summary.versionMismatch).toBe('prompt p1 → p2');
    expect(formatRegressionReport(run.summary, run.results)).toMatch(/Version mismatch/);
  });
});
