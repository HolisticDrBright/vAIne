import { describe, expect, test } from 'vitest';
import type { AnalysisRecord } from '../analysisService';
import { syntheticSkinAnalysis } from '../../../data/syntheticAnalysis';
import {
  getConfidenceBand,
  initialAnalysisExperienceState,
  reduceAnalysisExperience,
} from '../analysisExperience';

const syntheticRecord = {
  analysisId: 'analysis-test',
  mode: 'synthetic_demo',
  result: { modelVersion: 'synthetic-prototype' },
} as AnalysisRecord;

describe('analysis experience state', () => {
  test('moves through processing to a validated record', () => {
    const processing = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'START' });
    const ready = reduceAnalysisExperience(processing, { type: 'COMPLETE', record: syntheticRecord });

    expect(processing.status).toBe('processing');
    expect(ready.status).toBe('ready');
    expect(ready.record?.mode).toBe('synthetic_demo');
    expect(ready.result?.modelVersion).toBe('synthetic-prototype');
  });

  test('supports failure and retry without retaining an old result', () => {
    const processing = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'START' });
    const failed = reduceAnalysisExperience(processing, { type: 'FAIL', message: 'Fixture failed validation.' });
    const retrying = reduceAnalysisExperience(failed, { type: 'START' });

    expect(failed).toEqual({
      status: 'error',
      source: null,
      record: null,
      result: null,
      retakeInstruction: null,
      errorMessage: 'Fixture failed validation.',
    });
    expect(retrying).toEqual({
      status: 'processing',
      source: null,
      record: null,
      result: null,
      retakeInstruction: null,
      errorMessage: null,
    });
  });

  test('holds a retake request without any result to display', () => {
    const processing = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'START' });
    const retake = reduceAnalysisExperience(processing, {
      type: 'RETAKE',
      instruction: 'Retake in even light.',
    });

    expect(retake.status).toBe('retake');
    expect(retake.result).toBeNull();
    expect(retake.record).toBeNull();
    expect(retake.retakeInstruction).toBe('Retake in even light.');
  });

  test('ignores outcomes that arrive outside an active processing run', () => {
    expect(reduceAnalysisExperience(initialAnalysisExperienceState, {
      type: 'COMPLETE',
      record: syntheticRecord,
    })).toBe(initialAnalysisExperienceState);
    expect(reduceAnalysisExperience(initialAnalysisExperienceState, {
      type: 'RETAKE',
      instruction: 'Too late.',
    })).toBe(initialAnalysisExperienceState);
  });
});

describe('confidence presentation', () => {
  test.each([
    [0.91, 'High'],
    [0.8, 'High'],
    [0.6, 'Moderate'],
    [0.59, 'Limited'],
  ] as const)('maps %s to %s', (confidence, expected) => {
    expect(getConfidenceBand(confidence)).toBe(expected);
  });
});

describe('remembered check-in restoration', () => {
  test('restores a remembered record only while idle and marks its source', () => {
    const record = {
      analysisId: 'analysis-remembered',
      mode: 'synthetic_demo' as const,
      providerId: 'synthetic-prototype',
      modelVersion: 'synthetic-prototype',
      promptVersion: syntheticSkinAnalysis.promptVersion,
      schemaVersion: 'consumer_skin_schema_v1',
      requestedAtIso: '2026-09-01T00:00:00.000Z',
      completedAtIso: '2026-09-01T00:00:01.000Z',
      captures: [],
      qualityDecision: 'accepted' as const,
      result: syntheticSkinAnalysis,
    };
    const restored = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'RESTORE', record });
    expect(restored.status).toBe('ready');
    expect(restored.source).toBe('remembered');
    expect(restored.result).toBe(syntheticSkinAnalysis);

    const processing = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'START' });
    expect(reduceAnalysisExperience(processing, { type: 'RESTORE', record })).toBe(processing);
    expect(reduceAnalysisExperience(restored, { type: 'RESTORE', record })).toBe(restored);
    expect(reduceAnalysisExperience(restored, { type: 'RESET' })).toBe(initialAnalysisExperienceState);
  });
});
