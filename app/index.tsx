import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BotanicalAccent } from '@/components/BotanicalAccent';
import { LegalNote, Screen } from '@/components/AppChrome';
import { futureModules } from '@/data/prototype';
import { colors, fonts, radius, shadows } from '@/theme';

const homePortrait = require('../assets/home-portrait-woman.jpg');

export default function ScanSelectionScreen() {
  return (
    <Screen title="Skin Longevity">
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>YOUR DAILY SKIN RITUAL</Text>
        <Text style={styles.title}>Understand your skin, nourish your future.</Text>
        <Text style={styles.subtitle}>A calm, guided space for visible skin check-ins and consistent care.</Text>
      </View>

      <View style={styles.heroWrap}>
        <View style={styles.botanical}><BotanicalAccent /></View>
        <View style={styles.portraitRing}>
          <View style={styles.portraitInner}>
            <Image
              accessibilityLabel="Synthetic woman portrait"
              source={homePortrait}
              style={styles.portraitImage}
            />
          </View>
        </View>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.startCard, pressed && styles.pressed]} onPress={() => router.push('/consent')}>
          <View>
            <Text style={styles.startTitle}>Skin</Text>
            <Text style={styles.startSubtitle}>Start analysis</Text>
          </View>
          <View style={styles.arrowCircle}><Text style={styles.arrow}>→</Text></View>
        </Pressable>
      </View>

      <View style={styles.moduleRow}>
        {futureModules.map((module) => (
          <View key={module.title} style={styles.moduleItem}>
            <View style={styles.moduleCircle}>
              <Text style={styles.moduleMark}>{module.mark}</Text>
              <View style={styles.lock}><Text style={styles.lockText}>⌑</Text></View>
            </View>
            <Text style={styles.moduleTitle}>{module.title}</Text>
            <Text style={styles.moduleSubtitle}>Coming soon</Text>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" style={styles.privacyLink} onPress={() => router.push('/privacy')}>
        <Text style={styles.privacyText}>Privacy controls and local photo deletion  →</Text>
      </Pressable>
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 7, paddingHorizontal: 20 },
  eyebrow: { color: colors.green, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24, lineHeight: 31, fontWeight: '400', textAlign: 'center', maxWidth: 310 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  heroWrap: { alignItems: 'center', paddingTop: 3, marginTop: 2 },
  botanical: { position: 'absolute', right: -6, top: -5 },
  portraitRing: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, padding: 7, ...shadows.card },
  portraitInner: { flex: 1, borderRadius: 103, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', backgroundColor: colors.sageWash },
  portraitImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  startCard: { width: 190, minHeight: 62, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.cream, marginTop: -16, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadows.card },
  startTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  startSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  arrowCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sageWash },
  arrow: { color: colors.oliveDark, fontSize: 18 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  moduleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  moduleItem: { flex: 1, alignItems: 'center' },
  moduleCircle: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  moduleMark: { color: colors.oliveDark, fontSize: 30 },
  lock: { position: 'absolute', right: -1, bottom: -1, width: 25, height: 25, borderRadius: 13, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  lockText: { color: colors.oliveDark, fontSize: 12 },
  moduleTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 13, marginTop: 9 },
  moduleSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  privacyLink: { minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  privacyText: { color: colors.green, fontSize: 11, fontWeight: '600' },
});
