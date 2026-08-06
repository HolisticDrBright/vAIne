import { describe, expect, test } from 'vitest';
import type { SkinAnalysis } from '../skinAnalysisSchema';
import {
  getConfidenceBand,
  initialAnalysisExperienceState,
  reduceAnalysisExperience,
} from '../analysisExperience';

const syntheticResult = { modelVersion: 'synthetic-prototype' } as SkinAnalysis;

describe('analysis experience state', () => {
  test('moves through processing to a validated result', () => {
    const processing = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'START' });
    const ready = reduceAnalysisExperience(processing, { type: 'SUCCEED', result: syntheticResult });

    expect(processing.status).toBe('processing');
    expect(ready.status).toBe('ready');
    expect(ready.result?.modelVersion).toBe('synthetic-prototype');
  });

  test('supports failure and retry without retaining an old result', () => {
    const processing = reduceAnalysisExperience(initialAnalysisExperienceState, { type: 'START' });
    const failed = reduceAnalysisExperience(processing, { type: 'FAIL', message: 'Fixture failed validation.' });
    const retrying = reduceAnalysisExperience(failed, { type: 'START' });

    expect(failed).toEqual({ status: 'error', result: null, errorMessage: 'Fixture failed validation.' });
    expect(retrying).toEqual({ status: 'processing', result: null, errorMessage: null });
  });

  test('ignores a result that arrives outside an active processing run', () => {
    expect(reduceAnalysisExperience(initialAnalysisExperienceState, {
      type: 'SUCCEED',
      result: syntheticResult,
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
