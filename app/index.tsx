import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FaceIllustration } from '@/components/FaceIllustration';
import { LegalNote, Screen } from '@/components/AppChrome';
import { futureModules } from '@/data/prototype';
import { colors, radius } from '@/theme';

export default function ScanSelectionScreen() {
  return (
    <Screen title="vAIne">
      <Text style={styles.eyebrow}>YOUR VISUAL WELLNESS SPACE</Text>
      <Text style={styles.title}>Skin check-in</Text>
      <Text style={styles.subtitle}>A thoughtful way to notice your skin and build consistent care habits.</Text>

      <Pressable accessibilityRole="button" style={styles.hero} onPress={() => router.push('/consent')}>
        <View style={styles.glow} />
        <View style={styles.heroCopy}>
          <View style={styles.ready}><Text style={styles.readyText}>READY NOW</Text></View>
          <Text style={styles.heroTitle}>Skin Longevity</Text>
          <Text style={styles.heroBody}>Guided photos, visible observations, and a routine built around your goals.</Text>
          <Text style={styles.heroAction}>Start check-in  →</Text>
        </View>
        <FaceIllustration compact />
      </Pressable>

      <Text style={styles.section}>Explore more</Text>
      {futureModules.map((module) => (
        <View key={module.title} style={styles.module}>
          <View style={styles.moduleMark}><Text style={styles.moduleMarkText}>{module.mark}</Text></View>
          <View style={styles.moduleCopy}>
            <Text style={styles.moduleTitle}>{module.title}</Text>
            <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
          </View>
          <View style={styles.coming}><Text style={styles.comingText}>COMING SOON</Text></View>
        </View>
      ))}
      <Pressable accessibilityRole="button" style={styles.privacyLink} onPress={() => router.push('/privacy')}>
        <Text style={styles.privacyLinkText}>Privacy controls and local photo deletion  →</Text>
      </Pressable>
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  hero: { minHeight: 210, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.gold, backgroundColor: '#102746', padding: 20, flexDirection: 'row', alignItems: 'flex-end' },
  glow: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: '#1E5EA8', opacity: 0.36, right: -50, top: -90 },
  heroCopy: { flex: 1, zIndex: 2 },
  ready: { borderRadius: radius.pill, backgroundColor: 'rgba(232,187,105,.18)', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5 },
  readyText: { color: colors.gold, fontWeight: '700', fontSize: 9, letterSpacing: 0.8 },
  heroTitle: { color: colors.text, fontWeight: '700', fontSize: 25, marginTop: 12 },
  heroBody: { color: '#CDD9EB', fontSize: 13, lineHeight: 18, marginTop: 6, maxWidth: 210 },
  heroAction: { color: colors.gold, fontSize: 14, fontWeight: '700', marginTop: 17 },
  section: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 8 },
  module: { backgroundColor: colors.panel, minHeight: 72, borderRadius: radius.medium, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line },
  moduleMark: { height: 42, width: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B3453' },
  moduleMarkText: { color: colors.lilac, fontSize: 20 },
  moduleCopy: { flex: 1 },
  moduleTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  moduleSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  coming: { borderRadius: radius.pill, backgroundColor: '#25344C', paddingHorizontal: 8, paddingVertical: 5 },
  comingText: { color: '#B8C5D7', fontSize: 8, letterSpacing: 0.6, fontWeight: '700' },
  privacyLink: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  privacyLinkText: { color: colors.blue, fontSize: 12, fontWeight: '600' },
});
