import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BotanicalAccent } from '@/components/BotanicalAccent';
import { LegalNote, Screen } from '@/components/AppChrome';
import { futureModules } from '@/data/prototype';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useAnalysisRuntime } from '@/state/AnalysisRuntime';
import { useAuth } from '@/state/AuthContext';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

const homePortrait = require('../assets/home-portrait-woman.jpg');

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'earlier';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function ShortcutButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.shortcutText}>{label}</Text>
      <Text style={styles.shortcutArrow}>→</Text>
    </Pressable>
  );
}

export default function ScanSelectionScreen() {
  const { profile, status } = useLocalProfile();
  const { analysis } = useAnalysisSession();
  const { routineProfile } = useRoutineProfile();
  const { auth } = useAuth();
  const { route: analysisRoute, demoReason } = useAnalysisRuntime();
  const remembered = status === 'ready' && (profile.lastCheckIn !== null || routineProfile !== null);
  const lastCheckIn = profile.lastCheckIn;
  const canOpenResults = analysis.status === 'ready' && analysis.result !== null;

  return (
    <Screen title="Skin Longevity">
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{remembered ? 'WELCOME BACK' : 'YOUR DAILY SKIN RITUAL'}</Text>
        <Text style={styles.title}>{remembered ? 'Pick up where you left off.' : 'Understand your skin, nourish your future.'}</Text>
        <Text style={styles.subtitle}>{remembered
          ? 'Your last check-in and routine answers are remembered on this device only.'
          : 'A calm, guided space for visible skin check-ins and consistent care.'}</Text>
      </View>

      {remembered ? (
        <View style={styles.memoryCard}>
          <View style={styles.memoryHeading}>
            <Text style={styles.memoryEyebrow}>REMEMBERED ON THIS DEVICE</Text>
            {auth.status === 'signed_in' ? <Text style={styles.memoryBadge}>SIGNED IN</Text> : null}
          </View>
          <Text style={styles.memoryTitle}>
            {lastCheckIn ? `Last check-in ${formatDate(lastCheckIn.completedAtIso)}` : 'Routine preferences saved'}
          </Text>
          <Text style={styles.memoryBody}>
            {lastCheckIn
              ? `${lastCheckIn.mode === 'synthetic_demo' ? 'Fictional sample snapshot' : 'Your analysis'} scored ${lastCheckIn.result.appearanceScores.overall}/100. ${routineProfile ? 'Your routine answers are saved, so today’s routine is one tap away.' : 'Answer a short safety check to build today’s routine.'}`
              : 'Your routine answers are saved. Start a check-in to build today’s routine from the product list.'}
          </Text>
          {canOpenResults ? <ShortcutButton label="View last snapshot" onPress={() => router.push('/overview')} /> : null}
          {canOpenResults ? <ShortcutButton label={routineProfile ? 'Today’s routine' : 'Build today’s routine'} onPress={() => router.push(routineProfile ? '/routine' : '/routine-intake')} /> : null}
          <ShortcutButton label="Browse the product list" onPress={() => router.push('/products')} />
        </View>
      ) : null}

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
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.startCard, pressed && styles.pressed]}
          onPress={() => router.push(demoReason === 'signed_out' ? '/account' : '/consent')}
        >
          <View>
            <Text style={styles.startTitle}>Skin</Text>
            <Text style={styles.startSubtitle}>{demoReason === 'signed_out'
              ? 'Sign in for live analysis'
              : analysisRoute === 'live'
                ? 'Start live analysis'
                : remembered ? 'New sample check-in' : 'Try sample check-in'}</Text>
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

      {!remembered ? (
        <Pressable accessibilityRole="button" style={styles.privacyLink} onPress={() => router.push('/products')}>
          <Text style={styles.privacyText}>Browse the product list  →</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" style={styles.privacyLink} onPress={() => router.push('/account')}>
        <Text style={styles.privacyText}>{auth.status === 'signed_in' ? 'Account (signed in)  →' : 'Account and sign-in  →'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.privacyLink} onPress={() => router.push('/privacy')}>
        <Text style={styles.privacyText}>Privacy controls and local data deletion  →</Text>
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
  memoryCard: { borderRadius: radius.large, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.cream, padding: 16, gap: 8, ...shadows.card },
  memoryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  memoryEyebrow: { color: colors.gold, fontSize: 8, letterSpacing: 1.1, fontWeight: '800' },
  memoryBadge: { color: colors.green, fontSize: 8, letterSpacing: 0.6, fontWeight: '800' },
  memoryTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 19 },
  memoryBody: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  shortcut: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  shortcutText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  shortcutArrow: { color: colors.oliveDark, fontSize: 16 },
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
