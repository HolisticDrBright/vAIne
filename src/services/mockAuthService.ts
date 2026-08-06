import {
  describeAuthFailure,
  type AuthService,
  type DeleteAccountOutcome,
  type SessionRestoreOutcome,
  type SignInOutcome,
  type SignOutOutcome,
} from '../domain/auth/authService';

/**
 * In-memory development implementation of the auth boundary. It exists so
 * the contract and state machine stay exercised before the approved backend
 * is built. It stores nothing on disk, talks to no network, and is never
 * wired into a build that claims real accounts exist.
 */
export function createMockAuthService(options?: {
  /** Simulate a stored session being present at startup. */
  startSignedIn?: boolean;
  /** Force deleteAccount to demand reauthentication once. */
  requireReauthForDeletion?: boolean;
  /** Make every network-touching call fail, to exercise failure states. */
  offline?: boolean;
}): AuthService {
  let account = options?.startSignedIn ? { userId: 'mock-user-1' } : null;
  let needsReauth = options?.requireReauthForDeletion ?? false;

  return {
    async signInWithApple(): Promise<SignInOutcome> {
      if (options?.offline) {
        return { kind: 'failed', failure: 'offline', message: describeAuthFailure('offline') };
      }
      account = { userId: 'mock-user-1' };
      needsReauth = false;
      return { kind: 'signed_in', account };
    },

    async restoreSession(): Promise<SessionRestoreOutcome> {
      if (options?.offline) {
        return { kind: 'failed', failure: 'offline', message: describeAuthFailure('offline') };
      }
      return account ? { kind: 'signed_in', account } : { kind: 'no_session' };
    },

    async signOut(): Promise<SignOutOutcome> {
      account = null;
      return { kind: 'signed_out' };
    },

    onSessionEnded(): () => void {
      // The mock has no server that could end a session behind the app's
      // back, so the listener is never called.
      return () => {};
    },

    async deleteAccount(): Promise<DeleteAccountOutcome> {
      if (options?.offline) {
        return { kind: 'failed', failure: 'offline', message: describeAuthFailure('offline') };
      }
      if (!account) {
        return { kind: 'failed', failure: 'unexpected', message: describeAuthFailure('unexpected') };
      }
      if (needsReauth) {
        needsReauth = false;
        return { kind: 'reauth_required' };
      }
      account = null;
      return { kind: 'deleted' };
    },
  };
}
