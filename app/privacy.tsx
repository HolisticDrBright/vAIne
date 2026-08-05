import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, Screen, SecondaryButton } from '@/components/AppChrome';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { colors, radius } from '@/theme';

export default function PrivacyScreen() {
  const { session, clearSession } = useCaptureSession();
  const controls = [
    ['Analysis consent', session.consent?.analysis ? 'ON' : 'OFF', 'Required before starting a local capture session.'],
    ['Temporary device storage', session.consent?.temporaryDeviceStorage ? 'ON' : 'OFF', `${session.captures.length} temporary photo${session.captures.length === 1 ? '' : 's'} currently referenced by this session.`],
    ['Progress tracking', session.consent?.progressTracking ? 'ON' : 'OFF', 'Optional intent only; persistent comparison history is not enabled.'],
    ['Research use', 'OFF', 'Unavailable in this beta and always separate.'],
  ] as const;

  const deleteSession = async () => {
    await clearSession();
    router.replace('/');
  };

  return (
    <Screen title="Privacy controls" back>
      <Text style={styles.title}>Your image is personal.</Text>
      <Text style={styles.subtitle}>This beta keeps camera photos in temporary app cache only. It has no upload, account, AI analysis, analytics, advertising, or research pipeline.</Text>
      <View style={styles.list}>
        {controls.map(([title, status, body]) => (
          <View key={title} style={styles.row}>
            <View style={[styles.status, status === 'ON' && styles.statusOn]}><Text style={styles.statusText}>{status}</Text></View>
            <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View>
          </View>
        ))}
      </View>
      <InfoCard title="Deletion is immediate" body="Delete this check-in to remove every local file still referenced by the current session and clear the in-app state." tone="green" />
      <SecondaryButton label={session.captures.length ? 'Delete this check-in' : 'No local check-in to delete'} onPress={() => { if (session.captures.length) void deleteSession(); }} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 29, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  row: { padding: 16, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  status: { width: 42, height: 28, borderRadius: radius.pill, backgroundColor: '#283A52', justifyContent: 'center', alignItems: 'center' },
  statusOn: { backgroundColor: `${colors.green}22` },
  statusText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  copy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
