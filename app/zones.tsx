import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FaceIllustration } from '@/components/FaceIllustration';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { ScoreRing } from '@/components/ScoreRing';
import { syntheticSkinAnalysis } from '@/data/syntheticAnalysis';
import { colors, radius } from '@/theme';

export default function ZonesScreen() {
  const underEyes = syntheticSkinAnalysis.facialZones.under_eyes;

  return (
    <Screen title="Zone explorer" back>
      <View style={styles.tabs}>
        {['Forehead', 'Under eyes', 'Cheeks', 'Nose', 'Chin'].map((tab, index) => <Text key={tab} style={[styles.tab, index === 1 && styles.tabActive]}>{tab}</Text>)}
      </View>
      <View style={styles.faceWrap}>
        <FaceIllustration />
        <View style={[styles.overlay, styles.leftEye]} /><View style={[styles.overlay, styles.rightEye]} /><View style={[styles.overlay, styles.center]} />
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>UNDER EYES</Text>
          <Text style={styles.legendLine}>● Hydration look  High</Text>
          <Text style={styles.legendLine}>● Texture look  Medium</Text>
          <Text style={styles.legendLine}>● Fine lines  Low</Text>
        </View>
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryCopy}><Text style={styles.title}>Under-eyes summary</Text><Text style={styles.body}>{underEyes?.observation}</Text></View>
        <ScoreRing score={underEyes?.appearanceScore ?? 0} compact />
      </View>
      <InfoCard title="How to read this" body="Zone markers describe what is visible in this photo—not underlying health or a diagnosis." tone="lilac" />
      <PrimaryButton label="Build my routine" onPress={() => router.push('/routine')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 10 },
  tab: { color: colors.muted, fontSize: 10 },
  tabActive: { color: colors.text, fontWeight: '700', borderBottomWidth: 2, borderBottomColor: colors.lilac, paddingBottom: 10, marginBottom: -12 },
  faceWrap: { height: 360, overflow: 'hidden', borderRadius: 24, backgroundColor: '#17283C', alignItems: 'center', justifyContent: 'flex-end' },
  overlay: { position: 'absolute', borderWidth: 1.5, borderColor: colors.lilac },
  leftEye: { top: 110, left: 79, height: 55, width: 58, borderRadius: 30 },
  rightEye: { top: 110, right: 79, height: 55, width: 58, borderRadius: 30 },
  center: { top: 185, width: 128, height: 66, borderRadius: 42, borderColor: colors.blue },
  legend: { position: 'absolute', left: 15, bottom: 16, backgroundColor: 'rgba(8,17,31,.88)', padding: 12, borderRadius: radius.small, gap: 5 },
  legendTitle: { color: colors.text, fontWeight: '700', fontSize: 10 },
  legendLine: { color: colors.muted, fontSize: 9 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.panel, padding: 16, borderRadius: radius.large, gap: 10 },
  summaryCopy: { flex: 1 },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
});
