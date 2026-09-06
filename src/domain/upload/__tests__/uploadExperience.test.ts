import { describe, expect, test } from 'vitest';
import {
  describeUploadFailure,
  initialUploadFlowState,
  isRetryableUploadFailure,
  reduceUploadFlow,
  type UploadFlowEvent,
  type UploadFlowState,
} from '../uploadExperience';

function run(events: UploadFlowEvent[], from: UploadFlowState = initialUploadFlowState) {
  return events.reduce(reduceUploadFlow, from);
}

const toAnalyzing: UploadFlowEvent[] = [
  { type: 'PREPARE' },
  { type: 'SLOT_REQUESTED' },
  { type: 'UPLOAD_STARTED' },
  { type: 'ANALYSIS_STARTED' },
];

describe('upload flow state machine', () => {
  test('walks the happy path to completed with no cleanup owed', () => {
    const state = run([...toAnalyzing, { type: 'COMPLETED' }]);
    expect(state.status).toBe('completed');
    expect(state.cleanupRequested).toBe(false);
  });

  test('tracks bounded upload progress', () => {
    const uploading = run([
      { type: 'PREPARE' },
      { type: 'SLOT_REQUESTED' },
      { type: 'UPLOAD_STARTED' },
      { type: 'UPLOAD_PROGRESS', progress: 0.5 },
    ]);
    expect(uploading.progress).toBe(0.5);
    expect(run([{ type: 'UPLOAD_PROGRESS', progress: 7 }], uploading).progress).toBe(1);
  });

  test('a retake verdict carries its instruction and owes no cleanup', () => {
    const state = run([...toAnalyzing, { type: 'RETAKE_REQUIRED', instruction: 'Retake in even light.' }]);
    expect(state.status).toBe('retake_required');
    expect(state.retakeInstruction).toBe('Retake in even light.');
    expect(state.cleanupRequested).toBe(false);
  });

  test('cancelling mid-upload records the deletion obligation', () => {
    const cancelled = run([
      { type: 'PREPARE' },
      { type: 'SLOT_REQUESTED' },
      { type: 'UPLOAD_STARTED' },
      { type: 'CANCELLED' },
    ]);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cleanupRequested).toBe(true);
    const confirmed = run([{ type: 'CLEANUP_CONFIRMED' }], cancelled);
    expect(confirmed.cleanupRequested).toBe(false);
  });

  test('cancelling before any upload owes no cleanup', () => {
    const cancelled = run([{ type: 'PREPARE' }, { type: 'CANCELLED' }]);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cleanupRequested).toBe(false);
  });

  test('failures classify retryability and cleanup by where they struck', () => {
    const preFlight = run([{ type: 'PREPARE' }, { type: 'FAILED', reason: 'not_authenticated' }]);
    expect(preFlight.status).toBe('failed');
    expect(preFlight.retryable).toBe(false);
    expect(preFlight.cleanupRequested).toBe(false);

    const midAnalysis = run([...toAnalyzing, { type: 'FAILED', reason: 'provider_timeout' }]);
    expect(midAnalysis.retryable).toBe(true);
    expect(midAnalysis.cleanupRequested).toBe(true);

    expect(isRetryableUploadFailure('quota_exceeded')).toBe(false);
    expect(isRetryableUploadFailure('analysis_disabled')).toBe(false);
    expect(isRetryableUploadFailure('slot_expired')).toBe(true);
  });

  test('terminal states cannot be mutated by stray events, and reset works', () => {
    const completed = run([...toAnalyzing, { type: 'COMPLETED' }]);
    expect(run([{ type: 'UPLOAD_PROGRESS', progress: 0.4 }], completed)).toBe(completed);
    expect(run([{ type: 'RESET' }], completed).status).toBe('idle');

    const analyzing = run(toAnalyzing);
    expect(run([{ type: 'RESET' }], analyzing)).toBe(analyzing);
  });
});

describe('failure copy honesty', () => {
  test('provider failures state that no substitute result was shown', () => {
    expect(describeUploadFailure('provider_failed')).toContain('no substitute result');
    expect(describeUploadFailure('invalid_result')).toContain('No substitute result');
  });

  test('the kill switch and quota states are honest and photo-safe', () => {
    expect(describeUploadFailure('analysis_disabled')).toContain('temporarily unavailable');
    expect(describeUploadFailure('quota_exceeded').length).toBeGreaterThan(15);
  });
});
