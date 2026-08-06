import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { AuthService } from '@/domain/auth/authService';
import {
  canStartCloudAnalysis,
  initialAuthExperienceState,
  reduceAuthExperience,
  type AuthExperienceState,
} from '@/domain/auth/authExperience';
import { isBackendConfigured } from '@/services/backendConfig';
import { createMockAuthService } from '@/services/mockAuthService';
import { supabaseAuthService } from '@/services/supabaseAuthService';

/**
 * Session state for the secure beta. When no backend is configured the mock
 * service keeps the machine exercised and the app fully local; the real
 * service activates purely through environment configuration. No screen
 * depends on this yet — wiring UI waits until the Apple provider is
 * configured in the Supabase dashboard, so a sign-in button can actually
 * succeed the first time it appears.
 */

interface AuthContextValue {
  auth: AuthExperienceState;
  /** True when the real backend (not the mock) is wired. */
  backendConfigured: boolean;
  canUseCloudAnalysis: (analysisConsent: boolean) => boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  service,
}: PropsWithChildren<{ service?: AuthService }>) {
  const backendConfigured = isBackendConfigured();
  const authService = useMemo<AuthService>(
    () => service ?? (backendConfigured ? supabaseAuthService : createMockAuthService()),
    [service, backendConfigured],
  );
  const [auth, dispatch] = useReducer(reduceAuthExperience, initialAuthExperienceState);

  useEffect(() => {
    let active = true;
    dispatch({ type: 'RESTORE_START' });
    void authService.restoreSession().then((outcome) => {
      if (!active) return;
      if (outcome.kind === 'signed_in') dispatch({ type: 'RESTORE_SIGNED_IN', account: outcome.account });
      else if (outcome.kind === 'no_session') dispatch({ type: 'RESTORE_NO_SESSION' });
      else dispatch({ type: 'RESTORE_FAILED', message: outcome.message });
    });
    return () => {
      active = false;
    };
  }, [authService]);

  const signIn = useCallback(async () => {
    dispatch({ type: 'SIGN_IN_START' });
    const outcome = await authService.signInWithApple();
    if (outcome.kind === 'signed_in') dispatch({ type: 'SIGN_IN_SUCCESS', account: outcome.account });
    else if (outcome.kind === 'cancelled') dispatch({ type: 'SIGN_IN_CANCELLED' });
    else if (outcome.kind === 'unavailable') {
      dispatch({
        type: 'SIGN_IN_FAILED',
        message: outcome.reason === 'platform_unsupported'
          ? 'Sign in with Apple is available on iPhone in this beta.'
          : 'Sign-in is not configured in this build.',
      });
    } else dispatch({ type: 'SIGN_IN_FAILED', message: outcome.message });
  }, [authService]);

  const signOut = useCallback(async () => {
    const outcome = await authService.signOut();
    if (outcome.kind === 'signed_out') dispatch({ type: 'SIGNED_OUT' });
  }, [authService]);

  const deleteAccount = useCallback(async () => {
    dispatch({ type: 'DELETE_START' });
    const outcome = await authService.deleteAccount();
    if (outcome.kind === 'deleted') dispatch({ type: 'DELETE_SUCCESS' });
    else if (outcome.kind === 'reauth_required') dispatch({ type: 'DELETE_REAUTH_REQUIRED' });
    else dispatch({ type: 'DELETE_FAILED', message: outcome.message });
  }, [authService]);

  const value = useMemo<AuthContextValue>(() => ({
    auth,
    backendConfigured,
    canUseCloudAnalysis: (analysisConsent: boolean) => canStartCloudAnalysis({ auth, analysisConsent }),
    signIn,
    signOut,
    deleteAccount,
  }), [auth, backendConfigured, deleteAccount, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
