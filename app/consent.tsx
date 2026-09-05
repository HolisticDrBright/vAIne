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
  const [temporaryStorage, setTemporaryStorage] = useState(false);
  const [progressTracking, setProgressTracking] = useState(false);
  const [starting, setStarting] = useState(false);
  const { resetAnalysis } = useAnalysisSession();
  const { startSession } = useCaptureSession();
  const { profile, status: profileStatus, updateProfile } = useLocalProfile();
  const { route, demoReason } = useAnalysisRuntime();
  const live = route === 'live';
  const canContinue = analysis && temporaryStorage && !starting;

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
      temporaryDeviceStorage: temporaryStorage,
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
        ? 'Camera access is requested only after these choices. Because you are signed in, this check-in sends your photos once to vAIne’s analysis service for a real visible-appearance analysis.'
        : 'Camera access is requested only after these choices. This check-in does not upload a photo or send it to an AI service; the result shown is a labelled sample.'}</Text>

      <View style={styles.list}>
        <ConsentRow
          title={live ? 'Analyze these photos' : 'Use photos in this check-in'}
          body={live
            ? 'Sends your three photos, over an encrypted connection, to vAIne’s analysis service, which passes them once to an AI vision provider for visible-appearance observations only. The photos are held in memory during that single request and are not stored by vAIne; only the photo-free result (scores and observations) is kept in your account. On-device face detection still aligns the facial-zone views.'
            : 'Allows vAIne to hold the captures in memory while you move between local app screens, and to run on-device face detection that only aligns the facial-zone views. It does not identify you, and nothing is uploaded.'}
          selected={analysis}
          required
          onPress={() => setAnalysis((value) => !value)}
        />
        <ConsentRow
          title="Temporary device storage"
          body="The camera writes each photo to the app cache. You can delete the complete session at any time."
          selected={temporaryStorage}
          required
          onPress={() => setTemporaryStorage((value) => !value)}
        />
        <ConsentRow
          title="Progress tracking"
          body="Makes this check-in eligible to become a local baseline. You will confirm again before any photo is copied into longer-term app storage."
          selected={progressTracking}
          onPress={() => setProgressTracking((value) => !value)}
        />
        <ConsentRow
          title="Research use"
          body="Unavailable in this beta. A future research choice would be separate and off by default."
          selected={false}
          unavailable
        />
      </View>

      {live ? (
        <InfoCard title="Live analysis" body="The analysis describes visible appearance only: it is not a diagnosis and does not identify you. Photos stay in temporary device cache afterwards unless you separately save a progress baseline. Your routine answers from earlier check-ins stay saved on this device." tone="gold" />
      ) : (
        <InfoCard
          title={demoReason === 'signed_out' ? 'Sign in for a live analysis' : 'Sample check-in'}
          body={demoReason === 'signed_out'
            ? 'You are not signed in, so this check-in shows the labelled sample result and uploads nothing. Sign in from the home screen to analyze your own photos.'
            : demoReason === 'analysis_disabled'
              ? 'Live analysis is switched off at the moment, so this check-in shows the labelled sample result and uploads nothing.'
              : 'This build runs fully on the device: the check-in shows the labelled sample result and uploads nothing.'}
          tone="green"
        />
      )}
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
