import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { InfoCard, LegalNote, Screen, SecondaryButton } from '@/components/AppChrome';
import { useAnalysisRuntime } from '@/state/AnalysisRuntime';
import { useAuth } from '@/state/AuthContext';
import { colors, fonts, radius, shadows } from '@/theme';

/**
 * Account screen for the secure beta. Every state is rendered honestly:
 * restoring, signed out, waiting on the Apple sheet, signed in (showing only
 * the opaque account identifier — vAIne holds no name or email), signing
 * out, deleting with an explicit destructive confirmation, and the
 * reauth_required path that reruns the full Sign in with Apple ceremony.
 * The local demonstration never needs any of this, and live cloud analysis
 * stays disabled during this phase regardless of sign-in state.
 */

function PendingPanel({ label }: { label: string }) {
  return (
    <View style={styles.pendingPanel}>
      <ActivityIndicator color={colors.oliveDark} />
      <Text style={styles.pendingText}>{label}</Text>
    </View>
  );
}

function DangerButton({ label, onPress, solid = false }: { label: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.danger, solid && styles.dangerSolid, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={[styles.dangerText, solid && styles.dangerTextSolid]}>{label}</Text>
    </Pressable>
  );
}

function AppleButton({ variant, onPress }: { variant: 'sign_in' | 'continue'; onPress: () => void }) {
  if (Platform.OS === 'ios') {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          variant === 'sign_in'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
        }
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radius.pill}
        style={styles.appleButton}
        onPress={onPress}
      />
    );
  }
  // Non-iOS surfaces keep the flow reachable; the service answers honestly
  // that Sign in with Apple is iPhone-only in this beta.
  return <SecondaryButton label={variant === 'sign_in' ? 'Sign in with Apple' : 'Continue with Apple'} onPress={onPress} />;
}

export default function AccountScreen() {
  const { auth, backendConfigured, signIn, signOut, deleteAccount, confirmIdentityAndDelete } = useAuth();
  const runtime = useAnalysisRuntime();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reauthDismissed, setReauthDismissed] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const prevStatus = useRef(auth.status);

  useEffect(() => {
    if (prevStatus.current === 'deleting_account' && auth.status === 'signed_out') {
      setDeletedNotice(true);
    }
    if (auth.status !== 'signed_in') setConfirmingDelete(false);
    if (auth.status === 'signed_in' && prevStatus.current !== 'signed_in') {
      setDeletedNotice(false);
      setReauthDismissed(false);
    }
    prevStatus.current = auth.status;
  }, [auth.status]);

  const busyLabel =
    auth.status === 'unknown' || auth.status === 'restoring'
      ? 'Checking for an existing session…'
      : auth.status === 'signing_in' || auth.status === 'reauthenticating'
        ? 'Waiting for Apple…'
        : auth.status === 'deleting_account'
          ? 'Deleting your account and data…'
          : null;

  return (
    <Screen title="Account" back>
      {deletedNotice ? (
        <InfoCard
          tone="green"
          title="Account deleted"
          body="Your account and linked data were deleted — analysis results, usage records, and any temporary uploads. A non-identifying deletion record may remain for security and compliance auditing."
        />
      ) : null}

      {auth.errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{auth.errorMessage}</Text>
        </View>
      ) : null}

      {busyLabel ? (
        <PendingPanel label={busyLabel} />
      ) : auth.status === 'signed_out' ? (
        <>
          <InfoCard
            title="Why sign in?"
            body="Signing in turns on live analysis: your check-in photos are analyzed for visible appearance and the photo-free results are kept in your account so you can erase them. Without an account the app runs fully on this device with the labeled sample result."
          />
          {backendConfigured ? (
            <AppleButton variant="sign_in" onPress={() => void signIn()} />
          ) : (
            <InfoCard
              tone="lilac"
              title="Sign-in is not available in this build"
              body="No backend is configured, so this build runs fully local. Nothing leaves your device."
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.accountCard}>
            <Text style={styles.accountEyebrow}>SIGNED IN</Text>
            <Text style={styles.accountId} numberOfLines={1} ellipsizeMode="middle">
              {auth.account?.userId ?? ''}
            </Text>
            <Text style={styles.accountNote}>
              vAIne does not request your name or use your email for profile features. Supabase
              securely stores the account identifiers required to authenticate you.
            </Text>
          </View>

          {auth.reauthRequired && !reauthDismissed ? (
            <View style={styles.reauthCard}>
              <Text style={styles.reauthTitle}>Confirm it&apos;s you</Text>
              <Text style={styles.reauthBody}>
                Deleting an account needs a sign-in fresher than ten minutes. Confirm with Apple and
                deletion will continue in the same step.
              </Text>
              <AppleButton variant="continue" onPress={() => void confirmIdentityAndDelete()} />
              <SecondaryButton label="Not now" onPress={() => setReauthDismissed(true)} />
            </View>
          ) : confirmingDelete ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete account?</Text>
              <Text style={styles.confirmBody}>
                This permanently deletes your account, analysis results, usage records, and any
                temporary uploads. It cannot be undone.
              </Text>
              <DangerButton
                solid
                label="Delete permanently"
                onPress={() => {
                  setConfirmingDelete(false);
                  setReauthDismissed(false);
                  if (auth.reauthRequired) void confirmIdentityAndDelete();
                  else void deleteAccount();
                }}
              />
              <SecondaryButton label="Cancel" onPress={() => setConfirmingDelete(false)} />
            </View>
          ) : (
            <>
              <SecondaryButton label="Sign out" onPress={() => void signOut()} />
              <DangerButton label="Delete account…" onPress={() => setConfirmingDelete(true)} />
            </>
          )}
        </>
      )}

      <InfoCard
        tone="gold"
        title={runtime.route === 'live' ? 'Live analysis is on' : 'Live analysis is off for you right now'}
        body={runtime.route === 'live'
          ? 'Your next check-in sends its photos once to the analysis service and shows a real visible-appearance result. Photos are not stored by vAIne; only the photo-free result is kept in your account.'
          : runtime.demoReason === 'signed_out'
            ? 'Sign in to analyze your own photos. Until then check-ins show the labeled sample result and upload nothing.'
            : 'Live analysis is switched off at the moment. Check-ins show the labeled sample result and upload nothing.'}
      />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pendingPanel: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: radius.medium, borderWidth: 1, borderColor: `${colors.line}88`, backgroundColor: colors.panel, ...shadows.card },
  pendingText: { color: colors.muted, fontSize: 12 },
  errorCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: `${colors.danger}55`, backgroundColor: `${colors.danger}10`, padding: 15 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  accountCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, padding: 17, gap: 7, ...shadows.card },
  accountEyebrow: { color: colors.green, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  accountId: { color: colors.text, fontSize: 13, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  accountNote: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  reauthCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: `${colors.gold}`, backgroundColor: colors.cream, padding: 17, gap: 12, ...shadows.card },
  reauthTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 17 },
  reauthBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  confirmCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: `${colors.danger}66`, backgroundColor: `${colors.danger}0C`, padding: 17, gap: 12, ...shadows.card },
  confirmTitle: { color: colors.danger, fontFamily: fonts.display, fontSize: 17 },
  confirmBody: { color: colors.text, fontSize: 12, lineHeight: 18 },
  danger: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.danger}88`, backgroundColor: `${colors.white}AA`, justifyContent: 'center', alignItems: 'center' },
  dangerSolid: { backgroundColor: colors.danger, borderColor: colors.danger, ...shadows.card },
  dangerText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  dangerTextSolid: { color: colors.white, fontWeight: '700' },
  appleButton: { height: 54, width: '100%' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
