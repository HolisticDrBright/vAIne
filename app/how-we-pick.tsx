import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { HOW_WE_PICK_STEPS } from '@/domain/recommendations/governance';
import { colors, fonts, radius, shadows } from '@/theme';

/** The matching rules, in the order the code applies them, in plain words. */
export default function HowWePickScreen() {
  return (
    <Screen title="How we pick" back>
      <Text style={styles.eyebrow}>THE RULES, IN ORDER</Text>
      <Text style={styles.title}>How products and techniques are chosen</Text>
      <Text style={styles.subtitle}>Every rule below is enforced in the app’s code and tested. This page only puts it in words. Nothing on it changes a decision.</Text>

      <View style={styles.list}>
        {HOW_WE_PICK_STEPS.map((step) => (
          <View key={step.title} style={styles.row}>
            <Text style={styles.rowTitle}>{step.title}</Text>
            <Text style={styles.rowBody}>{step.body}</Text>
          </View>
        ))}
      </View>

      <InfoCard title="See it applied to you" body="The product list shows, for every listed product, whether it matches you and the exact reason when it does not. The held-back list shows every product kept from everyone and why." tone="green" />
      <PrimaryButton label="Open the product list" onPress={() => router.push('/products')} />
      <SecondaryButton label="See held-back products" onPress={() => router.push('/held-back')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
  row: { padding: 15, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowBody: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
