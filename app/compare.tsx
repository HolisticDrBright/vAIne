import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FaceIllustration } from '@/components/FaceIllustration';
import { LegalNote, Screen, SecondaryButton } from '@/components/AppChrome';
import { MetricBar } from '@/components/MetricBar';
import { colors, radius } from '@/theme';

export default function CompareScreen() {
  return (
    <Screen title="Compare" back>
      <View style={styles.switcher}><Text style={styles.active}>Side by side</Text><Text style={styles.inactive}>Overlay</Text></View>
      <Text style={styles.title}>Consistency matters</Text>
      <Text style={styles.subtitle}>Match lighting and angles for a more useful comparison.</Text>
      <View style={styles.photos}>
        <View style={styles.photo}><Text style={styles.date}>May 1</Text><FaceIllustration compact /></View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.photo}><Text style={styles.date}>Today</Text><FaceIllustration compact /></View>
      </View>
      <View style={styles.score}><Text style={styles.scoreLabel}>Appearance score</Text><Text style={styles.scoreValue}>73  <Text style={styles.arrowInline}>→</Text>  81</Text></View>
      <MetricBar label="Hydration look" value={72} trend />
      <MetricBar label="Tone appearance" value={78} trend />
      <MetricBar label="Texture look" value={66} trend />
      <View style={styles.private}>
        <Text style={styles.privateTitle}>▣ Your photos, your choice</Text>
        <Text style={styles.privateBody}>Progress photos are optional. You can delete them permanently at any time.</Text>
      </View>
      <SecondaryButton label="Privacy controls" onPress={() => router.push('/privacy')} />
      <SecondaryButton label="Back to check-ins" onPress={() => router.replace('/')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', backgroundColor: colors.panel, padding: 4, borderRadius: radius.medium },
  active: { flex: 1, textAlign: 'center', color: colors.text, backgroundColor: '#443D78', paddingVertical: 9, borderRadius: radius.small, fontSize: 12, fontWeight: '700' },
  inactive: { flex: 1, textAlign: 'center', color: colors.muted, paddingVertical: 9, fontSize: 12 },
  title: { color: colors.text, fontSize: 25, fontWeight: '700', marginTop: 8 },
  subtitle: { color: colors.muted, lineHeight: 19, fontSize: 13, marginTop: -6 },
  photos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  photo: { flex: 1, height: 210, backgroundColor: '#1C2A3D', borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  date: { color: colors.text, fontSize: 11, fontWeight: '700', position: 'absolute', top: 12 },
  arrow: { color: colors.blue, fontSize: 25, fontWeight: '700' },
  score: { backgroundColor: colors.panel, borderRadius: radius.medium, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { color: colors.muted, fontSize: 12 },
  scoreValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  arrowInline: { color: colors.blue },
  private: { backgroundColor: 'rgba(125,215,176,.09)', borderWidth: 1, borderColor: 'rgba(125,215,176,.2)', padding: 16, borderRadius: radius.medium },
  privateTitle: { color: colors.green, fontWeight: '700', fontSize: 13 },
  privateBody: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 17 },
});
