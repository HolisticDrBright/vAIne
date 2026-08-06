import type { AuthAccount } from './authService';

/**
 * Client-side authentication state machine. Pure and exhaustively testable;
 * a context provider will drive it once the approved backend exists.
 *
 * `unknown` exists so the UI can distinguish "we have not checked storage
 * yet" from "definitely signed out" — no flash of the wrong state, and no
 * cloud call is ever attempted before restoration settles.
 */

export type AuthExperienceStatus =
  | 'unknown'
  | 'restoring'
  | 'signed_out'
  | 'signing_in'
  | 'signed_in'
  | 'reauthenticating'
  | 'deleting_account';

export interface AuthExperienceState {
  status: AuthExperienceStatus;
  account: AuthAccount | null;
  /** Generic, enumeration-safe copy; null when there is nothing to show. */
  errorMessage: string | null;
  /** Set when account deletion demanded a fresh sign-in first. */
  reauthRequired: boolean;
}

export type AuthExperienceEvent =
  | { type: 'RESTORE_START' }
  | { type: 'RESTORE_SIGNED_IN'; account: AuthAccount }
  | { type: 'RESTORE_NO_SESSION' }
  | { type: 'RESTORE_FAILED'; message: string }
  | { type: 'SIGN_IN_START' }
  | { type: 'SIGN_IN_SUCCESS'; account: AuthAccount }
  | { type: 'SIGN_IN_CANCELLED' }
  | { type: 'SIGN_IN_FAILED'; message: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'SIGN_OUT_FAILED'; message: string }
  | { type: 'SESSION_ENDED'; message: string }
  | { type: 'REAUTH_START' }
  | { type: 'REAUTH_SUCCESS'; account: AuthAccount }
  | { type: 'REAUTH_CANCELLED' }
  | { type: 'REAUTH_FAILED'; message: string }
  | { type: 'DELETE_START' }
  | { type: 'DELETE_SUCCESS' }
  | { type: 'DELETE_REAUTH_REQUIRED' }
  | { type: 'DELETE_FAILED'; message: string };

export const initialAuthExperienceState: AuthExperienceState = {
  status: 'unknown',
  account: null,
  errorMessage: null,
  reauthRequired: false,
};

export function reduceAuthExperience(
  state: AuthExperienceState,
  event: AuthExperienceEvent,
): AuthExperienceState {
  switch (event.type) {
    case 'RESTORE_START':
      if (state.status !== 'unknown') return state;
      return { ...state, status: 'restoring', errorMessage: null };
    case 'RESTORE_SIGNED_IN':
      if (state.status !== 'restoring') return state;
      return { status: 'signed_in', account: event.account, errorMessage: null, reauthRequired: false };
    case 'RESTORE_NO_SESSION':
      if (state.status !== 'restoring') return state;
      return { status: 'signed_out', account: null, errorMessage: null, reauthRequired: false };
    case 'RESTORE_FAILED':
      if (state.status !== 'restoring') return state;
      // A failed restore is treated as signed out with a visible reason;
      // it must never leave the app pretending a session exists.
      return { status: 'signed_out', account: null, errorMessage: event.message, reauthRequired: false };
    case 'SIGN_IN_START':
      if (state.status !== 'signed_out') return state;
      return { ...state, status: 'signing_in', errorMessage: null };
    case 'SIGN_IN_SUCCESS':
      if (state.status !== 'signing_in') return state;
      return { status: 'signed_in', account: event.account, errorMessage: null, reauthRequired: false };
    case 'SIGN_IN_CANCELLED':
      if (state.status !== 'signing_in') return state;
      // The user changing their mind is not an error and shows no message.
      return { ...state, status: 'signed_out', errorMessage: null };
    case 'SIGN_IN_FAILED':
      if (state.status !== 'signing_in') return state;
      return { ...state, status: 'signed_out', errorMessage: event.message };
    case 'SIGNED_OUT':
      if (state.status !== 'signed_in' && state.status !== 'deleting_account') return state;
      return { status: 'signed_out', account: null, errorMessage: null, reauthRequired: false };
    case 'SIGN_OUT_FAILED':
      if (state.status !== 'signed_in') return state;
      // The session still exists; pretending otherwise would strand it.
      return { ...state, errorMessage: event.message };
    case 'SESSION_ENDED':
      // The server says the session is gone (expiry, revocation, deletion,
      // failed refresh) — a restored session is never trusted over this.
      // Explicit in-flight operations keep their own outcomes: an ordinary
      // sign-out dispatches SIGNED_OUT, and deletion's internal sign-out
      // arrives while deleting_account, which this deliberately ignores.
      if (state.status !== 'signed_in' && state.status !== 'reauthenticating') return state;
      return { status: 'signed_out', account: null, errorMessage: event.message, reauthRequired: false };
    case 'REAUTH_START':
      if (state.status !== 'signed_in') return state;
      return { ...state, status: 'reauthenticating', errorMessage: null };
    case 'REAUTH_SUCCESS':
      if (state.status !== 'reauthenticating') return state;
      return { status: 'signed_in', account: event.account, errorMessage: null, reauthRequired: false };
    case 'REAUTH_CANCELLED':
      if (state.status !== 'reauthenticating') return state;
      // Changing their mind keeps the demand pending but shows no error.
      return { ...state, status: 'signed_in', errorMessage: null };
    case 'REAUTH_FAILED':
      if (state.status !== 'reauthenticating') return state;
      return { ...state, status: 'signed_in', errorMessage: event.message };
    case 'DELETE_START':
      if (state.status !== 'signed_in') return state;
      return { ...state, status: 'deleting_account', errorMessage: null };
    case 'DELETE_SUCCESS':
      if (state.status !== 'deleting_account') return state;
      return { status: 'signed_out', account: null, errorMessage: null, reauthRequired: false };
    case 'DELETE_REAUTH_REQUIRED':
      if (state.status !== 'deleting_account') return state;
      return { ...state, status: 'signed_in', reauthRequired: true, errorMessage: null };
    case 'DELETE_FAILED':
      if (state.status !== 'deleting_account') return state;
      return { ...state, status: 'signed_in', errorMessage: event.message };
  }
}

/**
 * Gate for live cloud analysis: a settled, signed-in session AND explicit
 * analysis consent. The local synthetic demonstration is intentionally not
 * gated on authentication.
 */
export function canStartCloudAnalysis(input: {
  auth: Pick<AuthExperienceState, 'status'>;
  analysisConsent: boolean;
}): boolean {
  return input.auth.status === 'signed_in' && input.analysisConsent;
}
