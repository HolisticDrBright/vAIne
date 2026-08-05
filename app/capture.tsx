import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FaceIllustration } from '@/components/FaceIllustration';
import { LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { colors, radius } from '@/theme';

export default function CaptureScreen() {
  const captureSteps = ['Lighting', 'Position', 'Focus', 'Capture'];

  return (
    <Screen title="Camera guide" back>
      <Text style={styles.step}>STEP 1 OF 4</Text>
      <Text style={styles.title}>Face forward</Text>
      <Text style={styles.subtitle}>Center your face and look toward the camera. We’ll check lighting and framing before continuing.</Text>
      <View style={styles.progress}>
        {captureSteps.map((item, index) => (
          <View key={item} style={styles.progressItem}>
            <View style={[styles.dot, index === 0 && styles.dotActive]} />
            <Text style={styles.progressLabel}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.camera}>
        <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
        <FaceIllustration />
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>Good natural light</Text>
          <Text style={styles.hintBody}>Face a window and avoid sharp shadows.</Text>
        </View>
      </View>
      <View style={styles.checks}><Text style={styles.check}>☼  Good light</Text><Text style={styles.check}>⊗  No makeup</Text><Text style={styles.check}>◌  Relax face</Text></View>
      <PrimaryButton label="Simulate capture" onPress={() => router.push('/overview')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.lilac, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textAlign: 'center' },
  title: { color: colors.text, fontSize: 29, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  progress: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  progressItem: { alignItems: 'center', gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#30425C' },
  dotActive: { backgroundColor: colors.gold },
  progressLabel: { fontSize: 9, color: colors.muted },
  camera: { height: 350, backgroundColor: '#192B3E', borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  corner: { position: 'absolute', width: 42, height: 42, borderColor: colors.lilac },
  topLeft: { left: 26, top: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { right: 26, top: 24, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { left: 26, bottom: 38, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { right: 26, bottom: 38, borderBottomWidth: 2, borderRightWidth: 2 },
  hint: { position: 'absolute', bottom: 15, left: 15, right: 15, padding: 12, borderRadius: radius.small, backgroundColor: 'rgba(8,17,31,.76)' },
  hintTitle: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  hintBody: { color: colors.text, fontSize: 11, marginTop: 3 },
  checks: { flexDirection: 'row', justifyContent: 'space-between' },
  check: { color: colors.muted, fontSize: 11 },
});
