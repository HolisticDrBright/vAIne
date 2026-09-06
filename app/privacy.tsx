import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, Screen, SecondaryButton } from '@/components/AppChrome';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { useProgressBaseline } from '@/state/ProgressBaselineContext';
import { colors, fonts, radius, shadows } from '@/theme';

export default function PrivacyScreen() {
  const { analysis, resetAnalysis } = useAnalysisSession();
  const { session, clearSession } = useCaptureSession();
  const { routineProfile } = useRoutineProfile();
  const { profile, forgetProfile } = useLocalProfile();
  const { baseline, clearBaseline } = useProgressBaseline();
  const hasLocalData = Boolean(session.captures.length || baseline || analysis.result || routineProfile || profile.lastCheckIn || profile.consentDefaults);
  const controls = [
    ['Analysis consent', session.consent?.analysis ? 'ON' : 'OFF', 'Required before starting a local capture session.'],
    ['Temporary device storage', session.consent?.temporaryDeviceStorage ? 'ON' : 'OFF', `${session.captures.length} temporary photo${session.captures.length === 1 ? '' : 's'} currently referenced by this session.`],
    ['Progress tracking', baseline ? 'SAVED' : session.consent?.progressTracking ? 'ON' : 'OFF', baseline ? 'One three-photo baseline is stored in this app until you delete or replace it.' : 'No longer-term progress baseline is stored.'],
    ['Research use', 'OFF', 'Unavailable in this beta and always separate.'],
    ['Routine answers', routineProfile ? 'SAVED' : 'OFF', routineProfile ? 'Your safety and budget answers are saved on this device so you do not repeat them each check-in.' : 'No routine answers are saved on this device.'],
    ['Last check-in', profile.lastCheckIn ? 'SAVED' : 'OFF', profile.lastCheckIn ? 'The last validated, photo-free result (scores and observations only) is saved on this device.' : 'No check-in result is saved on this device.'],
  ] as const;

  const deleteSession = async () => {
    await clearSession();
    await clearBaseline();
    resetAnalysis();
    await forgetProfile();
    router.replace('/');
  };

  return (
    <Screen title="Privacy controls" back>
      <Text style={styles.title}>Your image is personal.</Text>
      <Text style={styles.subtitle}>This beta keeps check-in photos in temporary app cache. A progress baseline is copied into longer-term app storage only after optional consent and a second confirmation. On-device face detection may run to align facial-zone views: it does not identify you, its geometry stays in memory only, and it is deleted with the check-in. Routine answers and the last photo-free result are remembered on this device and deleted below. When you are signed in, a check-in sends its photos once to the analysis service, which holds them in memory only for that request; the photo-free result is kept in your account and removed with account deletion. The beta has no analytics, advertising, or research pipeline.</Text>
      <View style={styles.list}>
        {controls.map(([title, status, body]) => (
          <View key={title} style={styles.row}>
            <View style={[styles.status, status !== 'OFF' && styles.statusOn]}><Text style={styles.statusText}>{status}</Text></View>
            <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View>
          </View>
        ))}
      </View>
      <InfoCard title="Deletion is immediate" body="Delete all local vAIne data to remove temporary check-in photos (including optional close-ups), any saved baseline photos, in-memory face-alignment geometry, the remembered check-in result, and your saved routine answers. An account, if you have one, is separate and is deleted from the account screen." tone="green" />
      <SecondaryButton
        label={hasLocalData ? 'Delete all local vAIne data' : 'No local vAIne data to delete'}
        onPress={() => { if (hasLocalData) void deleteSession(); }}
      />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 29, fontWeight: '400' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadows.card },
  row: { padding: 16, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  status: { width: 42, height: 28, borderRadius: radius.pill, backgroundColor: colors.panelSoft, justifyContent: 'center', alignItems: 'center' },
  statusOn: { backgroundColor: `${colors.green}22` },
  statusText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  copy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
