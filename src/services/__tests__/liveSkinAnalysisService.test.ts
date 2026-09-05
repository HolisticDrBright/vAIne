import { describe, expect, test, vi } from 'vitest';
import { syntheticSkinAnalysis } from '../../data/syntheticAnalysis';
import { buildAnalysisRequest, type AnalysisCaptureInput } from '../../domain/analysis/analysisService';
import { createLiveSkinAnalysisService, mapFunctionError, type LiveAnalysisInvokeResult } from '../liveSkinAnalysisService';

vi.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: vi.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('../supabaseClient', () => ({ getSupabaseClient: () => null }));

const captures: readonly AnalysisCaptureInput[] = [
  { angle: 'front', uri: 'file:///cache/front.jpg', width: 3000, height: 4000, capturedAtIso: '2026-09-05T09:59:00.000Z' },
];

function service(invoke: (body: Record<string, unknown>) => Promise<LiveAnalysisInvokeResult>, hasSession = true) {
  return createLiveSkinAnalysisService({
    hasSession: async () => hasSession,
    prepareCapture: async (capture) => ({ angle: capture.angle, width: 1200, height: 1600, capturedAtIso: capture.capturedAtIso, jpegBase64: 'AAAA' }),
    invoke,
  });
}

const completedPayload = {
  kind: 'completed',
  record: { result: syntheticSkinAnalysis, completedAtIso: '2026-09-05T10:00:05.000Z', modelVersion: 'claude-sonnet-5' },
};

describe('live skin analysis service', () => {
  test('sends prepared photos once and returns a validated live record without photo references', async () => {
    const invoke = vi.fn(async () => ({ data: completedPayload, error: null }));
    const outcome = await service(invoke).analyze(buildAnalysisRequest(captures, '2026-09-05T10:00:00.000Z'));
    expect(outcome.kind).toBe('completed');
    if (outcome.kind !== 'completed') return;
    expect(outcome.record.mode).toBe('live');
    expect(outcome.record.captures[0]).toEqual({ angle: 'front', width: 3000, height: 4000, capturedAtIso: '2026-09-05T09:59:00.000Z' });
    expect(JSON.stringify(outcome.record)).not.toMatch(/file:|uri|AAAA/);
    const body = (invoke.mock.calls as unknown[][])[0]?.[0] as { captures: { jpegBase64: string }[] };
    expect(body.captures).toHaveLength(1);
  });

  test('requires a session and never substitutes a synthetic result on failure', async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { code: 'provider_unavailable', status: 502 } }));
    const signedOut = await service(invoke, false).analyze(buildAnalysisRequest(captures));
    expect(signedOut).toMatchObject({ kind: 'failed', failure: 'sign_in_required' });
    expect(invoke).not.toHaveBeenCalled();
    const failed = await service(invoke).analyze(buildAnalysisRequest(captures));
    expect(failed).toMatchObject({ kind: 'failed', failure: 'service_unavailable' });
  });

  test('maps function error codes to honest failure kinds', () => {
    expect(mapFunctionError('quota_daily')).toBe('quota_exceeded');
    expect(mapFunctionError('analysis_disabled')).toBe('analysis_unavailable');
    expect(mapFunctionError('provider_not_configured')).toBe('analysis_unavailable');
    expect(mapFunctionError('not_jpeg')).toBe('photos_rejected');
    expect(mapFunctionError('provider_refused')).toBe('provider_refused');
    expect(mapFunctionError('something_new')).toBe('service_unavailable');
  });

  test('rejects a result that fails the strict schema and passes retakes through', async () => {
    const bad = await service(async () => ({ data: { kind: 'completed', record: { result: { summary: 'x' } } }, error: null })).analyze(buildAnalysisRequest(captures));
    expect(bad).toMatchObject({ kind: 'failed', failure: 'invalid_result' });
    const retake = await service(async () => ({ data: { kind: 'retake_required', instruction: 'Face the window.', imageQuality: { usable: false, issues: ['too_dark'], retakeInstruction: 'Face the window.' } }, error: null })).analyze(buildAnalysisRequest(captures));
    expect(retake).toMatchObject({ kind: 'retake_required', instruction: 'Face the window.' });
  });
});
