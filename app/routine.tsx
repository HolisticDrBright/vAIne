import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { routineSteps } from '@/data/prototype';
import { colors, radius } from '@/theme';

export default function RoutineScreen() {
  return (
    <Screen title="Today’s routine" back>
      <View style={styles.switcher}><Text style={styles.active}>☼  AM routine</Text><Text style={styles.inactive}>☾  PM routine</Text></View>
      <Text style={styles.title}>Personalized for your goals</Text>
      <Text style={styles.subtitle}>Focus: hydration look, texture, and evenness.</Text>
      <View style={styles.list}>
        {routineSteps.map((step) => (
          <View key={step.number} style={styles.row}>
            <View style={styles.number}><Text style={styles.numberText}>{step.number}</Text></View>
            <View style={styles.copy}>
              <View style={styles.nameLine}>
                <Text style={styles.name}>{step.name}</Text>
                {step.synthetic ? <Text style={styles.demoBadge}>SYNTHETIC DEMO</Text> : null}
              </View>
              <Text style={styles.detail}>{step.brand} · {step.detail}</Text>
            </View>
            <Text style={styles.check}>✓</Text>
          </View>
        ))}
      </View>
      <InfoCard title="Introduce one new product at a time" body="Patch test first. Stop if irritation occurs." tone="lilac" />
      <InfoCard title="Prototype routine" body="Every named item above is fictional demonstration content. Real products remain hidden until identity, safety, catalog, and commercial-link reviews are complete." />
      <PrimaryButton label="See progress" onPress={() => router.push('/compare')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { borderRadius: radius.medium, flexDirection: 'row', backgroundColor: colors.panel, padding: 4 },
  active: { flex: 1, textAlign: 'center', borderRadius: radius.small, paddingVertical: 10, backgroundColor: '#33466B', color: colors.text, fontWeight: '700', fontSize: 12 },
  inactive: { flex: 1, textAlign: 'center', paddingVertical: 10, color: colors.muted, fontSize: 12 },
  title: { color: colors.text, fontSize: 23, fontWeight: '700', marginTop: 7 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: -6 },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  row: { minHeight: 76, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  number: { height: 30, width: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.gold },
  numberText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  copy: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  demoBadge: { color: colors.gold, fontSize: 8, fontWeight: '800', letterSpacing: 0.7, borderWidth: 1, borderColor: `${colors.gold}66`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  detail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  check: { color: colors.blue, fontSize: 20 },
});
