import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { approvedPrototypeCatalog } from '@/data/prototypeCatalog';
import {
  buildSyntheticRoutine,
  type BuiltRoutineStep,
  type RoutinePeriod,
} from '@/domain/recommendations/routineBuilder';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, radius } from '@/theme';

const modeDescriptions = {
  standard: 'A simple routine aligned with the fictional appearance goals.',
  gentle: 'A gentler version with fewer assumptions and easy-to-pause steps.',
  cautious: 'A conservative routine that pauses targeted active support.',
} as const;

function RoutineStepCard({ step, index }: { step: BuiltRoutineStep; index: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text></View>
      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{step.title}</Text>
          {step.product ? <Text style={styles.demoBadge}>FICTIONAL SAMPLE</Text> : null}
        </View>
        <Text style={styles.purpose}>{step.purpose}</Text>
        <Text style={styles.instruction}>{step.instruction}</Text>
        {step.product ? (
          <View style={styles.productLine}>
            <Text style={styles.productBrand}>{step.product.brandName}</Text>
            <Text style={styles.productName}>{step.product.productName}</Text>
          </View>
        ) : (
          <Text style={styles.categoryOnly}>Category guidance only—no sample selected</Text>
        )}
      </View>
    </View>
  );
}

export default function RoutineScreen() {
  const [period, setPeriod] = useState<RoutinePeriod>('am');
  const { analysis } = useAnalysisSession();
  const { routineProfile } = useRoutineProfile();

  if (analysis.status !== 'ready' || !analysis.result) {
    return (
      <Screen title="Today’s routine" back>
        <Text style={styles.title}>No sample snapshot is ready</Text>
        <PrimaryButton label="Prepare synthetic results" onPress={() => router.replace('/processing')} />
      </Screen>
    );
  }

  if (!routineProfile) {
    return (
      <Screen title="Today’s routine" back>
        <Text style={styles.title}>Set your routine preferences</Text>
        <Text style={styles.subtitle}>A short safety check helps determine whether the demo should remain category-level and conservative.</Text>
        <PrimaryButton label="Review routine preferences" onPress={() => router.replace('/routine-intake')} />
        <LegalNote />
      </Screen>
    );
  }

  const routine = buildSyntheticRoutine(analysis.result, routineProfile, approvedPrototypeCatalog);
  const steps = routine[period];
  const modeCopy = modeDescriptions[routine.mode];

  return (
    <Screen title="Today’s routine" back>
      <View accessibilityRole="tablist" style={styles.switcher}>
        {(['am', 'pm'] as const).map((value) => {
          const selected = period === value;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={value}
              onPress={() => setPeriod(value)}
              style={[styles.periodTab, selected && styles.periodTabActive]}
            >
              <Text style={[styles.periodText, selected && styles.periodTextActive]}>{value === 'am' ? '☼  Morning' : '☾  Evening'}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{routine.mode.toUpperCase()} MODE</Text>
          <Text style={styles.title}>{period === 'am' ? 'Start protected' : 'Reset gently'}</Text>
          <Text style={styles.subtitle}>{modeCopy}</Text>
        </View>
        <View style={styles.stepCount}><Text style={styles.stepCountNumber}>{steps.length}</Text><Text style={styles.stepCountLabel}>STEPS</Text></View>
      </View>

      <View style={styles.goalRow}>
        {analysis.result.routineGoals.slice(0, 3).map((goal) => (
          <View key={goal} style={styles.goalPill}>
            <Text style={styles.goalText}>{goal.replace(/^support_/, '').replaceAll('_', ' ')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.list}>
        {steps.map((step, index) => <RoutineStepCard key={step.id} step={step} index={index} />)}
      </View>

      {routine.notes.map((note, index) => (
        <InfoCard key={note} title={index === 0 ? 'Routine safety' : 'Why this routine changed'} body={note} tone={index === 0 ? 'lilac' : 'gold'} />
      ))}
      <InfoCard title="Prototype catalog" body="Every named item is fictional. Real products and affiliate links remain hidden until identity, safety, catalog, and commercial reviews are complete." />
      <PrimaryButton label="See progress" onPress={() => router.push('/compare')} />
      <SecondaryButton label="Change routine preferences" onPress={() => router.push('/routine-intake')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { borderRadius: radius.medium, flexDirection: 'row', backgroundColor: colors.panel, padding: 4 },
  periodTab: { flex: 1, minHeight: 42, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  periodTabActive: { backgroundColor: '#33466B' },
  periodText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  periodTextActive: { color: colors.text },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  stepCount: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.blue}10` },
  stepCountNumber: { color: colors.text, fontSize: 22, fontWeight: '800' },
  stepCountLabel: { color: colors.blue, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goalPill: { backgroundColor: `${colors.lilac}14`, borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.lilac}3A`, paddingHorizontal: 9, paddingVertical: 6 },
  goalText: { color: colors.lilac, fontSize: 8, fontWeight: '700', textTransform: 'capitalize' },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  row: { minHeight: 126, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  number: { height: 32, width: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.gold },
  numberText: { color: colors.gold, fontSize: 9, fontWeight: '800' },
  copy: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  demoBadge: { color: colors.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.6, borderWidth: 1, borderColor: `${colors.gold}66`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  purpose: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  instruction: { color: colors.text, fontSize: 10, lineHeight: 15, marginTop: 5 },
  productLine: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  productBrand: { color: colors.blue, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  productName: { color: colors.muted, fontSize: 10, marginTop: 2 },
  categoryOnly: { color: colors.green, fontSize: 9, fontWeight: '700', marginTop: 8 },
});
