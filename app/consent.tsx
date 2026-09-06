import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { useAnalysisRuntime } from '@/state/AnalysisRuntime';
import { withConsentDefaults } from '@/domain/profile/localProfile';
import { colors, fonts, radius, shadows } from '@/theme';

interface ConsentRowProps {
  title: string;
  body: string;
  selected: boolean;
  onPress?: () => void;
  required?: boolean;
  unavailable?: boolean;
}

function ConsentRow({ title, body, selected, onPress, required = false, unavailable = false }: ConsentRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        <Text style={styles.checkboxText}>{selected ? '✓' : ''}</Text>
      </View>
      <View style={styles.consentCopy}>
        <View style={styles.consentHeading}>
          <Text style={styles.consentTitle}>{title}</Text>
          <Text style={styles.consentLabel}>{unavailable ? 'OFF' : required ? 'REQUIRED' : 'OPTIONAL'}</Text>
        </View>
        <Text style={styles.consentBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

export default function ConsentScreen() {
  const [analysis, setAnalysis] = useState(false);
  const [progressTracking, setProgressTracking] = useState(false);
  const [starting, setStarting] = useState(false);
  const { resetAnalysis } = useAnalysisSession();
  const { startSession } = useCaptureSession();
  const { profile, status: profileStatus, updateProfile } = useLocalProfile();
  const { route, demoReason } = useAnalysisRuntime();
  const live = route === 'live';
  const canContinue = analysis && !starting;

  // Only the optional progress choice is remembered as a default. The two
  // required choices are re-confirmed for every check-in.
  useEffect(() => {
    if (profileStatus === 'ready' && profile.consentDefaults) {
      setProgressTracking(profile.consentDefaults.progressTracking);
    }
  }, [profile.consentDefaults, profileStatus]);

  const beginCapture = async () => {
    if (!canContinue) return;
    setStarting(true);
    resetAnalysis();
    void updateProfile((current, nowIso) => withConsentDefaults(current, { progressTracking }, nowIso));
    await startSession({
      analysis,
      temporaryDeviceStorage: true,
      progressTracking,
      researchUse: false,
    });
    router.replace('/capture');
  };

  return (
    <Screen title="Before your check-in" back>
      <Text style={styles.eyebrow}>YOUR IMAGE, YOUR CHOICE</Text>
      <Text style={styles.title}>Choose what happens to your photos</Text>
      <Text style={styles.subtitle}>{live
        ? 'Confirm once, then take three guided photos for your live skin appearance analysis.'
        : 'Confirm once, then take three guided photos to try the check-in flow with a labelled sample result.'}</Text>

      <View style={styles.list}>
        <ConsentRow
          title={live ? 'Analyze these photos' : 'Use photos in this check-in'}
          body={live
            ? 'I agree to send these photos securely for this analysis. vAIne stores the result, not the submitted photos.'
            : 'I agree to use these photos in the local test flow. They are not sent for AI analysis.'}
          selected={analysis}
          required
          onPress={() => setAnalysis((value) => !value)}
        />
        <ConsentRow
          title="Progress tracking"
          body="Makes this check-in eligible to become a local baseline. You will confirm again before any photo is copied into longer-term app storage."
          selected={progressTracking}
          onPress={() => setProgressTracking((value) => !value)}
        />
      </View>

      {!live ? (
        <InfoCard
          title={demoReason === 'signed_out' ? 'Sign in for a live analysis' : 'Sample check-in'}
          body={demoReason === 'signed_out'
            ? 'You are not signed in, so this check-in shows the labelled sample result and uploads nothing. Sign in from the home screen to analyze your own photos.'
            : demoReason === 'analysis_disabled'
              ? 'Live analysis is switched off at the moment, so this check-in shows the labelled sample result and uploads nothing.'
              : 'This build runs fully on the device: the check-in shows the labelled sample result and uploads nothing.'}
          tone="green"
        />
      ) : null}
      <PrimaryButton label={starting ? 'Preparing camera…' : 'Continue to camera'} onPress={beginCapture} disabled={!canContinue} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 1.3, fontWeight: '700' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 29, lineHeight: 35, fontWeight: '400' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadows.card },
  consentRow: { minHeight: 96, flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.panel, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { opacity: 0.78 },
  checkbox: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  checkboxText: { color: '#FFFFFF', fontWeight: '800' },
  consentCopy: { flex: 1 },
  consentHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  consentTitle: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  consentLabel: { color: colors.gold, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  consentBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
});
