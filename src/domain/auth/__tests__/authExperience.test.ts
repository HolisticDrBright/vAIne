import { describe, expect, test } from 'vitest';
import { createMockAuthService } from '../../../services/mockAuthService';
import { describeAuthFailure, type AuthFailureKind } from '../authService';
import {
  canStartCloudAnalysis,
  initialAuthExperienceState,
  reduceAuthExperience,
  type AuthExperienceEvent,
  type AuthExperienceState,
} from '../authExperience';

const account = { userId: 'user-1' };

function run(events: AuthExperienceEvent[], from: AuthExperienceState = initialAuthExperienceState) {
  return events.reduce(reduceAuthExperience, from);
}

describe('auth state machine', () => {
  test('restores a stored session without flashing signed-out', () => {
    const restoring = run([{ type: 'RESTORE_START' }]);
    expect(restoring.status).toBe('restoring');
    const signedIn = run([{ type: 'RESTORE_SIGNED_IN', account }], restoring);
    expect(signedIn).toEqual({ status: 'signed_in', account, errorMessage: null, reauthRequired: false });
  });

  test('settles to signed_out when no session exists or restore fails', () => {
    expect(run([{ type: 'RESTORE_START' }, { type: 'RESTORE_NO_SESSION' }]).status).toBe('signed_out');
    const failed = run([{ type: 'RESTORE_START' }, { type: 'RESTORE_FAILED', message: 'offline copy' }]);
    expect(failed.status).toBe('signed_out');
    expect(failed.errorMessage).toBe('offline copy');
    expect(failed.account).toBeNull();
  });

  test('a cancelled Apple sheet is not an error', () => {
    const state = run([
      { type: 'RESTORE_START' },
      { type: 'RESTORE_NO_SESSION' },
      { type: 'SIGN_IN_START' },
      { type: 'SIGN_IN_CANCELLED' },
    ]);
    expect(state.status).toBe('signed_out');
    expect(state.errorMessage).toBeNull();
  });

  test('sign-in success and sign-out round trip', () => {
    const signedIn = run([
      { type: 'RESTORE_START' },
      { type: 'RESTORE_NO_SESSION' },
      { type: 'SIGN_IN_START' },
      { type: 'SIGN_IN_SUCCESS', account },
    ]);
    expect(signedIn.status).toBe('signed_in');
    const signedOut = run([{ type: 'SIGNED_OUT' }], signedIn);
    expect(signedOut).toEqual({ status: 'signed_out', account: null, errorMessage: null, reauthRequired: false });
  });

  test('account deletion supports success, reauth demand, and failure', () => {
    const signedIn = run([
      { type: 'RESTORE_START' },
      { type: 'RESTORE_SIGNED_IN', account },
    ]);

    const deleted = run([{ type: 'DELETE_START' }, { type: 'DELETE_SUCCESS' }], signedIn);
    expect(deleted.status).toBe('signed_out');
    expect(deleted.account).toBeNull();

    const reauth = run([{ type: 'DELETE_START' }, { type: 'DELETE_REAUTH_REQUIRED' }], signedIn);
    expect(reauth.status).toBe('signed_in');
    expect(reauth.reauthRequired).toBe(true);

    const failed = run([{ type: 'DELETE_START' }, { type: 'DELETE_FAILED', message: 'try again copy' }], signedIn);
    expect(failed.status).toBe('signed_in');
    expect(failed.errorMessage).toBe('try again copy');
  });

  test('a failed sign-out keeps the session and says so', () => {
    const signedIn = run([
      { type: 'RESTORE_START' },
      { type: 'RESTORE_SIGNED_IN', account },
    ]);
    const failed = run([{ type: 'SIGN_OUT_FAILED', message: 'unavailable copy' }], signedIn);
    expect(failed.status).toBe('signed_in');
    expect(failed.account).toEqual(account);
    expect(failed.errorMessage).toBe('unavailable copy');
  });

  test('reauth_required reruns Apple sign-in and then allows deletion', () => {
    const demanded = run([
      { type: 'RESTORE_START' },
      { type: 'RESTORE_SIGNED_IN', account },
      { type: 'DELETE_START' },
      { type: 'DELETE_REAUTH_REQUIRED' },
    ]);
    expect(demanded).toMatchObject({ status: 'signed_in', reauthRequired: true });

    const reauthing = run([{ type: 'REAUTH_START' }], demanded);
    expect(reauthing.status).toBe('reauthenticating');

    // Cancelling keeps the demand pending without an error message.
    const cancelled = run([{ type: 'REAUTH_CANCELLED' }], reauthing);
    expect(cancelled).toMatchObject({ status: 'signed_in', reauthRequired: true, errorMessage: null });

    // Failure keeps the demand pending and shows the generic copy.
    const failed = run([{ type: 'REAUTH_FAILED', message: 'offline copy' }], reauthing);
    expect(failed).toMatchObject({ status: 'signed_in', reauthRequired: true, errorMessage: 'offline copy' });

    // Success clears the demand and deletion can proceed to completion.
    const refreshed = run([{ type: 'REAUTH_SUCCESS', account }], reauthing);
    expect(refreshed).toMatchObject({ status: 'signed_in', reauthRequired: false });
    const deleted = run([{ type: 'DELETE_START' }, { type: 'DELETE_SUCCESS' }], refreshed);
    expect(deleted).toEqual({ status: 'signed_out', account: null, errorMessage: null, reauthRequired: false });
  });

  test('a server-observed session end always wins over a restored session', () => {
    const signedIn = run([
      { type: 'RESTORE_START' },
      { type: 'RESTORE_SIGNED_IN', account },
    ]);

    // Expiry / revocation / deletion-from-elsewhere → signed out, with copy.
    const ended = run([{ type: 'SESSION_ENDED', message: 'session ended copy' }], signedIn);
    expect(ended).toEqual({ status: 'signed_out', account: null, errorMessage: 'session ended copy', reauthRequired: false });

    // Also honored while waiting on the Apple sheet for reauthentication.
    const endedDuringReauth = run(
      [{ type: 'DELETE_START' }, { type: 'DELETE_REAUTH_REQUIRED' }, { type: 'REAUTH_START' }, { type: 'SESSION_ENDED', message: 'session ended copy' }],
      signedIn,
    );
    expect(endedDuringReauth.status).toBe('signed_out');

    // Ignored during deletion: the internal sign-out after a successful
    // delete must not preempt the explicit deletion outcome.
    const duringDeletion = run([{ type: 'DELETE_START' }], signedIn);
    const preserved = run([{ type: 'SESSION_ENDED', message: 'session ended copy' }], duringDeletion);
    expect(preserved.status).toBe('deleting_account');
    expect(run([{ type: 'DELETE_SUCCESS' }], preserved).status).toBe('signed_out');

    // A no-op when already signed out.
    expect(run([{ type: 'SESSION_ENDED', message: 'x' }], ended)).toBe(ended);
  });

  test('out-of-order events cannot conjure a session', () => {
    expect(run([{ type: 'SIGN_IN_SUCCESS', account }])).toBe(initialAuthExperienceState);
    expect(run([{ type: 'DELETE_SUCCESS' }])).toBe(initialAuthExperienceState);
    expect(run([{ type: 'RESTORE_SIGNED_IN', account }])).toBe(initialAuthExperienceState);
    expect(run([{ type: 'REAUTH_SUCCESS', account }])).toBe(initialAuthExperienceState);
    expect(run([{ type: 'REAUTH_START' }])).toBe(initialAuthExperienceState);
  });
});

describe('cloud-analysis gate', () => {
  test('requires a settled signed-in session AND analysis consent', () => {
    expect(canStartCloudAnalysis({ auth: { status: 'signed_in' }, analysisConsent: true })).toBe(true);
    expect(canStartCloudAnalysis({ auth: { status: 'signed_in' }, analysisConsent: false })).toBe(false);
    for (const status of ['unknown', 'restoring', 'signed_out', 'signing_in', 'reauthenticating', 'deleting_account'] as const) {
      expect(canStartCloudAnalysis({ auth: { status }, analysisConsent: true })).toBe(false);
    }
  });
});

describe('failure copy stays enumeration-safe', () => {
  const kinds: readonly AuthFailureKind[] = ['offline', 'service_unavailable', 'invalid_credential', 'unexpected'];

  test.each(kinds.map((kind) => [kind] as const))('%s reveals nothing about account existence', (kind) => {
    const message = describeAuthFailure(kind);
    expect(message.length).toBeGreaterThan(10);
    expect(message.toLowerCase()).not.toMatch(/exist|not found|no account|already|registered|unknown user|wrong (password|email)/);
  });
});

describe('mock auth service honors the contract', () => {
  test('sign in, restore, sign out, delete', async () => {
    const service = createMockAuthService();
    expect(await service.restoreSession()).toEqual({ kind: 'no_session' });
    const signIn = await service.signInWithApple();
    expect(signIn.kind).toBe('signed_in');
    expect(await service.restoreSession()).toMatchObject({ kind: 'signed_in' });
    expect(await service.deleteAccount()).toEqual({ kind: 'deleted' });
    expect(await service.restoreSession()).toEqual({ kind: 'no_session' });
  });

  test('deletion can demand reauthentication before proceeding', async () => {
    const service = createMockAuthService({ startSignedIn: true, requireReauthForDeletion: true });
    expect(await service.deleteAccount()).toEqual({ kind: 'reauth_required' });
    expect(await service.deleteAccount()).toEqual({ kind: 'deleted' });
  });

  test('offline mode surfaces typed failures, never fake sessions', async () => {
    const service = createMockAuthService({ offline: true });
    expect((await service.signInWithApple()).kind).toBe('failed');
    expect((await service.restoreSession()).kind).toBe('failed');
  });

  test('session-end subscription returns a working unsubscriber and never fires', () => {
    const service = createMockAuthService({ startSignedIn: true });
    let calls = 0;
    const unsubscribe = service.onSessionEnded(() => {
      calls += 1;
    });
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(calls).toBe(0);
  });
});
