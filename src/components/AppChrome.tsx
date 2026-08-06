import { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius, shadows } from '@/theme';

type ScreenProps = PropsWithChildren<{
  title: string;
  back?: boolean;
  scroll?: boolean;
}>;

export function Screen({ title, back = false, scroll = true, children }: ScreenProps) {
  const body = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={back ? 'Go back' : 'Open menu'}
          style={styles.headerButton}
          onPress={back ? () => router.back() : undefined}
        >
          <Text style={styles.headerIcon}>{back ? '‹' : '☰'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerButton}><Text style={styles.headerIcon}>♧</Text></View>
      </View>
      {scroll ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function LegalNote() {
  return <Text style={styles.legal}>♢  Cosmetic observations, not a diagnosis</Text>;
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [styles.primary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.primaryText}>{label}  →</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function InfoCard({ title, body, tone = 'gold' }: { title: string; body: string; tone?: 'gold' | 'green' | 'lilac' }) {
  const toneColor = tone === 'green' ? colors.green : tone === 'lilac' ? colors.lilac : colors.gold;
  return (
    <View style={[styles.info, { borderColor: `${toneColor}44`, backgroundColor: `${toneColor}12` }]}>
      <Text style={[styles.infoTitle, { color: toneColor }]}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  header: { height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: `${colors.line}55`, backgroundColor: colors.cream },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { color: colors.oliveDark, fontSize: 22 },
  headerTitle: { color: colors.text, fontSize: 19, fontFamily: fonts.display, fontWeight: '400' },
  scroll: { paddingBottom: 34 },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 480, alignSelf: 'center' },
  legal: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 4, backgroundColor: `${colors.white}99`, borderWidth: 1, borderColor: `${colors.line}88`, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'center', overflow: 'hidden' },
  primary: { backgroundColor: colors.blue, minHeight: 54, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, marginTop: 4, ...shadows.card },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  secondary: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold, backgroundColor: `${colors.white}AA`, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.42 },
  info: { padding: 15, borderRadius: radius.medium, borderWidth: 1, ...shadows.card },
  infoTitle: { fontWeight: '700', fontSize: 12 },
  infoBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
});
