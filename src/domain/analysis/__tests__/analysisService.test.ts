import { describe, expect, test } from 'vitest';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  buildAnalysisAuditEntry,
  buildAnalysisRecord,
  buildAnalysisRequest,
  classifyValidatedResult,
  createAnalysisId,
  DEFAULT_RETAKE_INSTRUCTION,
  describeAnalysisFailure,
  MIN_ACCEPTABLE_OVERALL_CONFIDENCE,
  type AnalysisCaptureInput,
  type AnalysisFailureKind,
} from '../analysisService';

const captures: readonly AnalysisCaptureInput[] = [
  { angle: 'front', uri: 'file:///cache/front.jpg', width: 1080, height: 1440, capturedAtIso: '2026-08-05T12:00:00.000Z' },
  { angle: 'left_profile', uri: 'file:///cache/left.jpg', width: 1080, height: 1440, capturedAtIso: '2026-08-05T12:00:10.000Z' },
  { angle: 'right_profile', uri: 'file:///cache/right.jpg', width: 1080, height: 1440, capturedAtIso: '2026-08-05T12:00:20.000Z' },
];

describe('analysis request', () => {
  test('creates non-identifying unique analysis ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createAnalysisId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^analysis-[a-z0-9]+-[a-z0-9]+$/);
  });

  test('carries captures and a request timestamp', () => {
    const request = buildAnalysisRequest(captures, '2026-08-05T12:01:00.000Z');
    expect(request.captures).toHaveLength(3);
    expect(request.requestedAtIso).toBe('2026-08-05T12:01:00.000Z');
    expect(request.analysisId).toMatch(/^analysis-/);
  });
});

describe('validated-result classification', () => {
  test('accepts a usable, confident result', () => {
    expect(classifyValidatedResult(syntheticSkinAnalysis)).toEqual({ decision: 'accepted' });
  });

  test('requests a retake when the image is unusable, using the provided instruction', () => {
    const decision = classifyValidatedResult({
      ...syntheticSkinAnalysis,
      imageQuality: { usable: false, issues: ['blurred'], retakeInstruction: 'Hold the phone steadier.' },
    });
    expect(decision).toEqual({ decision: 'retake_requested', instruction: 'Hold the phone steadier.' });
  });

  test('falls back to safe default copy when no instruction is supplied', () => {
    const decision = classifyValidatedResult({
      ...syntheticSkinAnalysis,
      imageQuality: { usable: false, issues: ['too_dark'], retakeInstruction: null },
    });
    expect(decision).toEqual({ decision: 'retake_requested', instruction: DEFAULT_RETAKE_INSTRUCTION });
  });

  test('requests a retake instead of presenting a low-confidence result', () => {
    const decision = classifyValidatedResult({
      ...syntheticSkinAnalysis,
      overallConfidence: MIN_ACCEPTABLE_OVERALL_CONFIDENCE - 0.01,
    });
    expect(decision.decision).toBe('retake_requested');
  });
});

describe('analysis record and audit entry', () => {
  const request = buildAnalysisRequest(captures, '2026-08-05T12:01:00.000Z');
  const record = buildAnalysisRecord({
    request,
    result: syntheticSkinAnalysis,
    descriptor: { id: 'synthetic-prototype', mode: 'synthetic_demo' },
    completedAtIso: '2026-08-05T12:01:02.000Z',
    qualityDecision: 'accepted',
  });

  test('captures the required envelope metadata', () => {
    expect(record.analysisId).toBe(request.analysisId);
    expect(record.mode).toBe('synthetic_demo');
    expect(record.providerId).toBe('synthetic-prototype');
    expect(record.modelVersion).toBe('synthetic-prototype');
    expect(record.promptVersion).toBe(syntheticSkinAnalysis.promptVersion);
    expect(record.schemaVersion).toBe('skin_analysis_v1');
    expect(record.qualityDecision).toBe('accepted');
    expect(record.captures.map((capture) => capture.capturedAtIso)).toEqual(
      captures.map((capture) => capture.capturedAtIso),
    );
  });

  test('strips photo references from record captures', () => {
    for (const capture of record.captures) {
      expect(Object.keys(capture).sort()).toEqual(['angle', 'capturedAtIso', 'height', 'width']);
    }
  });

  test('audit entries never contain photo URIs, image data, or free-form user text', () => {
    const entry = buildAnalysisAuditEntry(record);
    const serialized = JSON.stringify(entry);

    expect(serialized).not.toContain('file://');
    expect(serialized).not.toContain('uri');
    expect(serialized).not.toContain(syntheticSkinAnalysis.summary);
    expect(entry.analysisId).toBe(record.analysisId);
    expect(entry.captureTimestamps).toHaveLength(3);
    expect(entry.captureAngles).toEqual(['front', 'left_profile', 'right_profile']);
    expect(entry.qualityDecision).toBe('accepted');
    expect(entry.overallConfidence).toBe(syntheticSkinAnalysis.overallConfidence);
    expect(entry.limitationCount).toBe(syntheticSkinAnalysis.limitations.length);
  });
});

describe('failure copy', () => {
  const kinds: readonly AnalysisFailureKind[] = ['service_unavailable', 'invalid_result', 'unexpected_error'];

  test.each(kinds.map((kind) => [kind] as const))('%s has honest, safe user copy', (kind) => {
    const message = describeAnalysisFailure(kind);
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toMatch(/analysis complete|personalized/i);
  });

  test('validation failures state that no substitute result was shown', () => {
    expect(describeAnalysisFailure('invalid_result')).toContain('No substitute result');
  });
});
