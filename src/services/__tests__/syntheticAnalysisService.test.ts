import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { buildAnalysisRequest, type AnalysisCaptureInput, type AnalysisOutcome } from '../../domain/analysis/analysisService';
import { skinAnalysisSchema } from '../../domain/analysis/skinAnalysisSchema';
import { syntheticSkinAnalysisService } from '../syntheticAnalysisService';

function capturesWith(uriPrefix: string): readonly AnalysisCaptureInput[] {
  return [
    { angle: 'front', uri: `${uriPrefix}/front.jpg`, width: 1080, height: 1440, capturedAtIso: '2026-08-05T12:00:00.000Z' },
    { angle: 'left_profile', uri: `${uriPrefix}/left.jpg`, width: 1080, height: 1440, capturedAtIso: '2026-08-05T12:00:10.000Z' },
    { angle: 'right_profile', uri: `${uriPrefix}/right.jpg`, width: 1080, height: 1440, capturedAtIso: '2026-08-05T12:00:20.000Z' },
  ];
}

async function analyze(captures: readonly AnalysisCaptureInput[]): Promise<AnalysisOutcome> {
  const pending = syntheticSkinAnalysisService.analyze(buildAnalysisRequest(captures, '2026-08-05T12:01:00.000Z'));
  await vi.advanceTimersByTimeAsync(1000);
  return pending;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('synthetic analysis service', () => {
  test('declares itself as demonstration mode', () => {
    expect(syntheticSkinAnalysisService.descriptor).toEqual({ id: 'synthetic-prototype', mode: 'synthetic_demo' });
  });

  test('returns a schema-valid completed record labeled synthetic', async () => {
    const outcome = await analyze(capturesWith('file:///cache/a'));

    expect(outcome.kind).toBe('completed');
    if (outcome.kind !== 'completed') return;
    expect(outcome.record.mode).toBe('synthetic_demo');
    expect(outcome.record.qualityDecision).toBe('accepted');
    expect(() => skinAnalysisSchema.parse(outcome.record.result)).not.toThrow();
    expect(outcome.record.captures.every((capture) => !('uri' in capture))).toBe(true);
  });

  test('ignores photo content entirely: identical output for different inputs', async () => {
    const first = await analyze(capturesWith('file:///cache/user-one'));
    const second = await analyze(capturesWith('file:///cache/user-two'));

    expect(first.kind).toBe('completed');
    expect(second.kind).toBe('completed');
    if (first.kind !== 'completed' || second.kind !== 'completed') return;
    expect(second.record.result).toEqual(first.record.result);
  });

  test('completes without captures, since it never reads photos', async () => {
    const outcome = await analyze([]);
    expect(outcome.kind).toBe('completed');
  });
});
