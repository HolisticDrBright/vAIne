/**
 * Provider-independent authentication boundary for the secure beta.
 *
 * The live implementation (Sign in with Apple exchanged with the approved
 * backend) arrives only after the Phase 1 approval gate; until then the mock
 * implementation exercises this contract. Design rules encoded here:
 *
 * - No authentication secret is ever held in the client: the contract deals
 *   in opaque outcomes, never tokens, and `AuthAccount` carries only an
 *   opaque user ID.
 * - Failure copy is generic by design — outcomes never reveal whether an
 *   account, email, or Apple ID exists (no user enumeration).
 * - Account deletion is explicit, may demand recent reauthentication, and on
 *   success means every associated result and temporary object is gone.
 * - Live cloud analysis requires a signed-in account; the local synthetic
 *   demonstration never does.
 */

export interface AuthAccount {
  /** Opaque backend identifier. Never an email, name, or Apple identifier. */
  userId: string;
}

export type AuthFailureKind = 'offline' | 'service_unavailable' | 'invalid_credential' | 'unexpected';

export type SignInOutcome =
  | { kind: 'signed_in'; account: AuthAccount }
  | { kind: 'cancelled' }
  | { kind: 'unavailable'; reason: 'platform_unsupported' | 'not_configured' }
  | { kind: 'failed'; failure: AuthFailureKind; message: string };

export type SessionRestoreOutcome =
  | { kind: 'signed_in'; account: AuthAccount }
  | { kind: 'no_session' }
  | { kind: 'failed'; failure: AuthFailureKind; message: string };

export type SignOutOutcome =
  | { kind: 'signed_out' }
  | { kind: 'failed'; failure: AuthFailureKind; message: string };

export type DeleteAccountOutcome =
  | { kind: 'deleted' }
  | { kind: 'reauth_required' }
  | { kind: 'failed'; failure: AuthFailureKind; message: string };

export interface AuthService {
  signInWithApple(): Promise<SignInOutcome>;
  restoreSession(): Promise<SessionRestoreOutcome>;
  signOut(): Promise<SignOutOutcome>;
  /**
   * Deletes the account and everything associated with it. Implementations
   * must require a recent authentication and return `reauth_required` when
   * that freshness cannot be proven.
   */
  deleteAccount(): Promise<DeleteAccountOutcome>;
}

/**
 * Generic, enumeration-safe failure copy. Deliberately never distinguishes
 * "wrong account", "unknown account", or "account exists elsewhere".
 */
const FAILURE_MESSAGES: Record<AuthFailureKind, string> = {
  offline: 'You appear to be offline. Sign-in needs a connection; the local demonstration still works.',
  service_unavailable: 'Sign-in is temporarily unavailable. Please try again shortly.',
  invalid_credential: 'Sign-in could not be completed. Please try again.',
  unexpected: 'Sign-in could not be completed. Please try again.',
};

export function describeAuthFailure(kind: AuthFailureKind): string {
  return FAILURE_MESSAGES[kind];
}
