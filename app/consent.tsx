import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, radius } from '@/theme';

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
  const { clearRoutineProfile } = useRoutineProfile();
  const canContinue = analysis && temporaryStorage && !starting;

  const beginCapture = async () => {
    if (!canContinue) return;
    setStarting(true);
    resetAnalysis();
    clearRoutineProfile();
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
      <Text style={styles.subtitle}>Camera access is requested only after these choices. This beta does not upload a photo or send it to an AI service.</Text>

      <View style={styles.list}>
        <ConsentRow
          title="Use photos in this check-in"
          body="Allows vAIne to hold the three captures in memory while you move between local app screens."
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
          body="Marks this check-in as eligible for a future comparison history. Persistent history is not enabled yet."
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

      <InfoCard title="Local capture beta" body="Your photos stay in the app’s temporary device cache. This build has no upload, analysis, account, advertising, or research pipeline." tone="green" />
      <PrimaryButton label={starting ? 'Preparing camera…' : 'Continue to camera'} onPress={beginCapture} disabled={!canContinue} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 1.3, fontWeight: '700' },
  title: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
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
