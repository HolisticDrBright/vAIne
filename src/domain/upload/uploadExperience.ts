/**
 * State machine for the live-analysis upload flow.
 *
 * Invariants encoded here, matching the approved plan:
 * - Leaving or cancelling mid-flow is always safe: cancellation from any
 *   in-flight state lands in `cancelled` and records that server-side
 *   cleanup of already-uploaded objects must be requested.
 * - Failures carry a typed reason and whether retrying makes sense; no
 *   failure path may ever be answered with synthetic results.
 * - Whether analysis succeeded or failed, uploaded photos are deleted
 *   server-side; `cleanupRequested` reflects the client's obligation to ask
 *   for that deletion whenever the flow ends before the server confirmed it.
 */

export type UploadFlowStatus =
  | 'idle'
  | 'preparing'
  | 'requesting_slot'
  | 'uploading'
  | 'analyzing'
  | 'completed'
  | 'retake_required'
  | 'failed'
  | 'cancelled';

export type UploadFailureReason =
  | 'offline'
  | 'not_authenticated'
  | 'quota_exceeded'
  | 'analysis_disabled'
  | 'slot_expired'
  | 'upload_rejected'
  | 'provider_timeout'
  | 'provider_failed'
  | 'invalid_result'
  | 'unexpected';

/** Failures where an immediate retry is a reasonable next step. */
const RETRYABLE: ReadonlySet<UploadFailureReason> = new Set([
  'offline',
  'slot_expired',
  'provider_timeout',
  'provider_failed',
  'unexpected',
]);

export function isRetryableUploadFailure(reason: UploadFailureReason): boolean {
  return RETRYABLE.has(reason);
}

export interface UploadFlowState {
  status: UploadFlowStatus;
  /** 0..1 while uploading; null otherwise. */
  progress: number | null;
  failure: UploadFailureReason | null;
  retryable: boolean;
  /** True when the flow ended before server-confirmed photo deletion. */
  cleanupRequested: boolean;
  retakeInstruction: string | null;
}

export type UploadFlowEvent =
  | { type: 'PREPARE' }
  | { type: 'SLOT_REQUESTED' }
  | { type: 'UPLOAD_STARTED' }
  | { type: 'UPLOAD_PROGRESS'; progress: number }
  | { type: 'ANALYSIS_STARTED' }
  | { type: 'COMPLETED' }
  | { type: 'RETAKE_REQUIRED'; instruction: string }
  | { type: 'FAILED'; reason: UploadFailureReason }
  | { type: 'CANCELLED' }
  | { type: 'CLEANUP_CONFIRMED' }
  | { type: 'RESET' };

export const initialUploadFlowState: UploadFlowState = {
  status: 'idle',
  progress: null,
  failure: null,
  retryable: false,
  cleanupRequested: false,
  retakeInstruction: null,
};

const IN_FLIGHT: ReadonlySet<UploadFlowStatus> = new Set([
  'preparing',
  'requesting_slot',
  'uploading',
  'analyzing',
]);

/** States in which server-side objects may already exist. */
const MAY_HAVE_UPLOADED: ReadonlySet<UploadFlowStatus> = new Set(['uploading', 'analyzing']);

export function reduceUploadFlow(state: UploadFlowState, event: UploadFlowEvent): UploadFlowState {
  switch (event.type) {
    case 'PREPARE':
      if (state.status !== 'idle') return state;
      return { ...initialUploadFlowState, status: 'preparing' };
    case 'SLOT_REQUESTED':
      if (state.status !== 'preparing') return state;
      return { ...state, status: 'requesting_slot' };
    case 'UPLOAD_STARTED':
      if (state.status !== 'requesting_slot') return state;
      return { ...state, status: 'uploading', progress: 0 };
    case 'UPLOAD_PROGRESS':
      if (state.status !== 'uploading') return state;
      return { ...state, progress: Math.min(Math.max(event.progress, 0), 1) };
    case 'ANALYSIS_STARTED':
      if (state.status !== 'uploading') return state;
      return { ...state, status: 'analyzing', progress: null };
    case 'COMPLETED':
      if (state.status !== 'analyzing') return state;
      // Server deletes photos as part of completing; no cleanup owed.
      return { ...initialUploadFlowState, status: 'completed' };
    case 'RETAKE_REQUIRED':
      if (state.status !== 'analyzing') return state;
      return {
        ...initialUploadFlowState,
        status: 'retake_required',
        retakeInstruction: event.instruction,
      };
    case 'FAILED':
      if (!IN_FLIGHT.has(state.status)) return state;
      return {
        ...initialUploadFlowState,
        status: 'failed',
        failure: event.reason,
        retryable: isRetryableUploadFailure(event.reason),
        cleanupRequested: MAY_HAVE_UPLOADED.has(state.status),
      };
    case 'CANCELLED':
      if (!IN_FLIGHT.has(state.status)) return state;
      return {
        ...initialUploadFlowState,
        status: 'cancelled',
        cleanupRequested: MAY_HAVE_UPLOADED.has(state.status),
      };
    case 'CLEANUP_CONFIRMED':
      if (!state.cleanupRequested) return state;
      return { ...state, cleanupRequested: false };
    case 'RESET':
      if (IN_FLIGHT.has(state.status)) return state;
      return initialUploadFlowState;
  }
}

const FAILURE_COPY: Record<UploadFailureReason, string> = {
  offline: 'You appear to be offline. Your photos stay on this device; try again when connected.',
  not_authenticated: 'Sign in to use cloud analysis. The local demonstration works without an account.',
  quota_exceeded: 'You have reached the analysis limit for now. Please try again later.',
  analysis_disabled: 'Analysis is temporarily unavailable. Your photos stay on this device; please try again later.',
  slot_expired: 'The upload window expired. Please start the analysis again.',
  upload_rejected: 'A photo could not be accepted. Please retake it with the in-app camera.',
  provider_timeout: 'The analysis took too long and was stopped. Your uploaded photos are deleted; please try again.',
  provider_failed: 'The analysis could not be completed. Your uploaded photos are deleted; no substitute result was shown.',
  invalid_result: 'The analysis response did not pass validation and was discarded. No substitute result was shown.',
  unexpected: 'Something went wrong. Your photos stay on this device; please try again.',
};

export function describeUploadFailure(reason: UploadFailureReason): string {
  return FAILURE_COPY[reason];
}
