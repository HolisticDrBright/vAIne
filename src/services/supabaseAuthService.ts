import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  describeAuthFailure,
  type AuthService,
  type DeleteAccountOutcome,
  type SessionRestoreOutcome,
  type SignInOutcome,
  type SignOutOutcome,
} from '../domain/auth/authService';
import { getSupabaseClient } from './supabaseClient';

/**
 * Live AuthService: native Sign in with Apple exchanged with the vaine-beta
 * backend via the identity-token flow. A fresh random nonce binds each Apple
 * credential to exactly one exchange. No token, email, or Apple identifier
 * is logged, stored by this module, or surfaced in copy; session persistence
 * belongs to the Supabase client, and account deletion happens entirely in
 * the delete-account Edge Function (which may demand a recent sign-in).
 */

function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|socket|offline/i.test(message);
}

export const supabaseAuthService: AuthService = {
  async signInWithApple(): Promise<SignInOutcome> {
    const client = getSupabaseClient();
    if (!client) return { kind: 'unavailable', reason: 'not_configured' };
    if (Platform.OS !== 'ios') return { kind: 'unavailable', reason: 'platform_unsupported' };

    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        return { kind: 'unavailable', reason: 'platform_unsupported' };
      }

      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      // No name/email scopes: the account needs only an opaque identity.
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        return { kind: 'failed', failure: 'invalid_credential', message: describeAuthFailure('invalid_credential') };
      }

      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error || !data.user) {
        const failure = isOfflineError(error) ? 'offline' : 'service_unavailable';
        return { kind: 'failed', failure, message: describeAuthFailure(failure) };
      }
      return { kind: 'signed_in', account: { userId: data.user.id } };
    } catch (error) {
      if ((error as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return { kind: 'cancelled' };
      }
      const failure = isOfflineError(error) ? 'offline' : 'unexpected';
      return { kind: 'failed', failure, message: describeAuthFailure(failure) };
    }
  },

  async restoreSession(): Promise<SessionRestoreOutcome> {
    const client = getSupabaseClient();
    if (!client) return { kind: 'no_session' };
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        const failure = isOfflineError(error) ? 'offline' : 'service_unavailable';
        return { kind: 'failed', failure, message: describeAuthFailure(failure) };
      }
      if (!data.session?.user) return { kind: 'no_session' };
      return { kind: 'signed_in', account: { userId: data.session.user.id } };
    } catch (error) {
      const failure = isOfflineError(error) ? 'offline' : 'unexpected';
      return { kind: 'failed', failure, message: describeAuthFailure(failure) };
    }
  },

  async signOut(): Promise<SignOutOutcome> {
    const client = getSupabaseClient();
    if (!client) return { kind: 'signed_out' };
    try {
      await client.auth.signOut();
    } catch {
      // Server-side revocation can fail offline; local clearing decides below.
    }
    const { data } = await client.auth.getSession();
    if (data.session) {
      return {
        kind: 'failed',
        failure: 'service_unavailable',
        message: describeAuthFailure('service_unavailable'),
      };
    }
    return { kind: 'signed_out' };
  },

  async deleteAccount(): Promise<DeleteAccountOutcome> {
    const client = getSupabaseClient();
    if (!client) return { kind: 'failed', failure: 'unexpected', message: describeAuthFailure('unexpected') };
    try {
      const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
      if (!error) {
        await client.auth.signOut().catch(() => undefined);
        return { kind: 'deleted' };
      }
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null) as { error?: string } | null;
        if (body?.error === 'reauth_required') return { kind: 'reauth_required' };
      }
      const failure = isOfflineError(error) ? 'offline' : 'service_unavailable';
      return { kind: 'failed', failure, message: describeAuthFailure(failure) };
    } catch (error) {
      const failure = isOfflineError(error) ? 'offline' : 'unexpected';
      return { kind: 'failed', failure, message: describeAuthFailure(failure) };
    }
  },
};
