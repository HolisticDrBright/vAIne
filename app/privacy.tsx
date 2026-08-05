import { StyleSheet, Text, View } from 'react-native';
import { InfoCard, LegalNote, Screen } from '@/components/AppChrome';
import { colors, radius } from '@/theme';

const controls = [
  ['Analysis consent', 'Required only when a user chooses to run an analysis.'],
  ['Photo storage', 'Off by default. Originals should be deleted after analysis.'],
  ['Progress tracking', 'Separate, optional consent for saving comparison photos.'],
  ['Research use', 'Always separate and off by default.'],
];

export default function PrivacyScreen() {
  return (
    <Screen title="Privacy controls" back>
      <Text style={styles.title}>Your image is personal.</Text>
      <Text style={styles.subtitle}>The product will be designed so analysis, storage, progress tracking, and research each require their own clear choice.</Text>
      <View style={styles.list}>
        {controls.map(([title, body], index) => (
          <View key={title} style={styles.row}>
            <View style={[styles.status, index === 0 && styles.statusRequired]}><Text style={styles.statusText}>{index === 0 ? 'ASK' : 'OFF'}</Text></View>
            <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View>
          </View>
        ))}
      </View>
      <InfoCard title="Prototype only" body="No photos or personal data are currently collected, stored, transmitted, or used for training." tone="green" />
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
  statusRequired: { backgroundColor: 'rgba(232,187,105,.2)' },
  statusText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  copy: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
