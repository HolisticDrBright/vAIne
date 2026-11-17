/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { skinAnalysisSchema } from '../../src/domain/analysis/skinAnalysisSchema';
import { classifyValidatedResult } from '../../src/domain/analysis/analysisService';
import {
  DEFAULT_REGRESSION_BANDS,
  REGRESSION_BASELINE_VERSION,
  compareRun,
  formatRegressionReport,
  pathsInsideRepository,
  regressionBaselineSchema,
  regressionManifestSchema,
  toBaselineCase,
  type RegressionBaseline,
  type RegressionBaselineCase,
} from '../../src/domain/analysis/regression';

/**
 * Regression photo-set runner.
 *
 * Runs only when VAINE_REGRESSION_MANIFEST points at a manifest; `npm test`
 * skips it. Each case's photographs are read from outside the repository,
 * sent once to the analyze-skin Edge Function exactly as the app sends them,
 * and reduced to scores, tags, and the quality decision. The run fails when
 * any case leaves the band in docs/regression-photo-set.md.
 *
 * Environment:
 *   VAINE_REGRESSION_MANIFEST   absolute path to the manifest JSON (required)
 *   VAINE_REGRESSION_BASELINE   baseline JSON path (default: baseline.json beside the manifest)
 *   VAINE_REGRESSION_RECORD=1   write a new baseline instead of comparing
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   VAINE_REGRESSION_JWT        access token of a consenting beta tester account
 *
 * Photo bytes exist only inside one request body and are never logged.
 */

const manifestPath = process.env.VAINE_REGRESSION_MANIFEST;
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Reads width and height from JPEG start-of-frame markers without decoding. */
export function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}

async function analyzeCase(
  item: { id: string; captures: readonly { angle: string; path: string }[] },
  env: { url: string; apikey: string; jwt: string },
): Promise<{ result: ReturnType<typeof skinAnalysisSchema.parse>; modelVersion: string; promptVersion: string } | { retake: string[] }> {
  const nowIso = new Date().toISOString();
  const captures = item.captures.map((capture) => {
    const bytes = new Uint8Array(readFileSync(capture.path));
    const dimensions = readJpegDimensions(bytes);
    if (!dimensions) throw new Error(`${item.id}: ${capture.angle} is not a readable JPEG`);
    return { angle: capture.angle, ...dimensions, capturedAtIso: nowIso, jpegBase64: Buffer.from(bytes).toString('base64') };
  });
  const analysisId = `analysis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const response = await fetch(`${env.url}/functions/v1/analyze-skin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.apikey, Authorization: `Bearer ${env.jwt}` },
    body: JSON.stringify({ analysisId, captures, goals: [], sensitivityPreference: 'standard' }),
  });
  const payload = await response.json() as { kind?: string; error?: string; imageQuality?: { issues?: string[] }; record?: { result?: unknown; modelVersion?: string; promptVersion?: string } };
  if (!response.ok) throw new Error(`${item.id}: analyze-skin returned ${response.status} ${payload.error ?? ''}`.trim());
  if (payload.kind === 'retake_required') return { retake: payload.imageQuality?.issues ?? [] };
  if (payload.kind !== 'completed' || !payload.record) throw new Error(`${item.id}: unexpected response kind ${payload.kind}`);
  const result = skinAnalysisSchema.parse(payload.record.result);
  const decision = classifyValidatedResult(result);
  if (decision.decision === 'retake_requested') return { retake: result.imageQuality.issues };
  return { result, modelVersion: String(payload.record.modelVersion ?? ''), promptVersion: String(payload.record.promptVersion ?? '') };
}

describe.skipIf(!manifestPath)('regression photo set', () => {
  test('every case stays within the repeatability band', async () => {
    const manifest = regressionManifestSchema.parse(JSON.parse(readFileSync(manifestPath!, 'utf8')));
    const inside = pathsInsideRepository(manifest, repoRoot);
    expect(inside, 'photo paths inside the repository are refused').toEqual([]);

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const jwt = process.env.VAINE_REGRESSION_JWT;
    if (!url || !apikey || !jwt) throw new Error('EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and VAINE_REGRESSION_JWT are required.');

    const cases: RegressionBaselineCase[] = [];
    let promptVersion = '';
    let modelVersion = '';
    for (const item of manifest.cases) {
      const outcome = await analyzeCase(item, { url, apikey, jwt });
      if ('retake' in outcome) {
        cases.push(toBaselineCase(item.id, { kind: 'retake', issues: outcome.retake }));
      } else {
        cases.push(toBaselineCase(item.id, { kind: 'completed', result: outcome.result }));
        promptVersion = outcome.promptVersion;
        modelVersion = outcome.modelVersion;
      }
    }

    const baselinePath = process.env.VAINE_REGRESSION_BASELINE ?? path.join(path.dirname(manifestPath!), 'baseline.json');
    if (process.env.VAINE_REGRESSION_RECORD === '1') {
      const baseline: RegressionBaseline = {
        version: REGRESSION_BASELINE_VERSION,
        setVersion: manifest.setVersion,
        promptVersion,
        modelVersion,
        recordedAtIso: new Date().toISOString(),
        cases,
      };
      writeFileSync(baselinePath, `${JSON.stringify(regressionBaselineSchema.parse(baseline), null, 2)}\n`);
      console.log(`Recorded baseline for ${cases.length} cases at ${baselinePath}`);
      return;
    }

    const baseline = regressionBaselineSchema.parse(JSON.parse(readFileSync(baselinePath, 'utf8')));
    expect(baseline.setVersion, 'baseline was recorded for a different photo set').toBe(manifest.setVersion);
    const { summary, results } = compareRun(baseline, { promptVersion, modelVersion, cases }, DEFAULT_REGRESSION_BANDS);
    console.log(formatRegressionReport(summary, results));
    expect(summary.pass, formatRegressionReport(summary, results)).toBe(true);
  }, 20 * 60_000);
});
