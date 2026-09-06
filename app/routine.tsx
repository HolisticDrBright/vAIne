import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { catalogSourceLabels, getRoutineCatalog } from '@/data/routineCatalog';
import { betaCatalogTestingEnabled } from '@/data/betaCatalogTesting';
import {
  buildSyntheticRoutine,
  budgetPreferenceLabels,
  noProductReasonCopy,
  type BuiltRoutineStep,
  type RoutinePeriod,
} from '@/domain/recommendations/routineBuilder';
import { describeTag, formatPrice } from '@/domain/recommendations/presentation';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

const modeDescriptions = {
  standard: 'A simple routine matched to the appearance goals in this check-in.',
  gentle: 'A gentler version with fewer assumptions and easy-to-pause steps.',
  cautious: 'A conservative routine that pauses targeted active support.',
} as const;

function RoutineStepCard({ step, index, fictional }: { step: BuiltRoutineStep; index: number; fictional: boolean }) {
  const formattedPrice = step.product
    ? formatPrice(step.product.listPriceCents, step.product.currencyCode)
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text></View>
      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <Text style={styles.name}>{step.title}</Text>
          {step.product ? (
            <Text style={styles.demoBadge}>
              {fictional ? 'FICTIONAL SAMPLE' : step.product.catalogState === 'catalog_approved' ? 'FROM YOUR LIST' : 'RESEARCH PREVIEW'}
            </Text>
          ) : null}
        </View>
        <Text style={styles.purpose}>{step.purpose}</Text>
        <Text style={styles.instruction}>{step.instruction}</Text>
        {step.product ? (
          <View style={styles.productLine}>
            <View style={styles.productMeta}>
              <Text style={styles.productBrand}>{step.product.brandName}</Text>
              <Text style={styles.productPrice}>{formattedPrice}</Text>
            </View>
            <Text style={styles.productName}>{step.product.productName}</Text>
            {step.matchedTags.length ? (
              <Text style={styles.matchReason}>Matched on: {step.matchedTags.map(describeTag).join(', ')}</Text>
            ) : null}
            {step.product.whenToUse ? <Text style={styles.productNote}>When: {step.product.whenToUse}</Text> : null}
            {step.product.cautionNote ? <Text style={styles.productCaution}>Caution: {step.product.cautionNote}</Text> : null}
            {step.product.note ? <Text style={styles.productNote}>Note: {step.product.note}</Text> : null}
          </View>
        ) : (
          <View style={styles.categoryOnly}>
            <Text style={styles.categoryOnlyTitle}>Category guidance only</Text>
            <Text style={styles.categoryOnlyBody}>{step.noProductReason ? noProductReasonCopy[step.noProductReason] : 'No listed product was selected for this step.'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function RoutineScreen() {
  const [period, setPeriod] = useState<RoutinePeriod>('am');
  const { analysis } = useAnalysisSession();
  const { routineProfile, loading } = useRoutineProfile();
  const catalog = useMemo(() => getRoutineCatalog(), []);

  if (analysis.status !== 'ready' || !analysis.result) {
    return (
      <Screen title="Today’s routine" back>
        <Text style={styles.title}>No snapshot is ready</Text>
        <Text style={styles.subtitle}>Complete a check-in first; the routine is built from its appearance goals and the product list.</Text>
        <PrimaryButton label="Start a check-in" onPress={() => router.replace('/consent')} />
        <SecondaryButton label="Browse the product list" onPress={() => router.push('/products')} />
        <LegalNote />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Today’s routine" back>
        <Text style={styles.title}>Loading your saved answers…</Text>
      </Screen>
    );
  }

  if (!routineProfile) {
    return (
      <Screen title="Today’s routine" back>
        <Text style={styles.title}>Set your routine preferences</Text>
        <Text style={styles.subtitle}>A short safety check decides which products from the list can be offered. Your answers are saved on this device for next time.</Text>
        <PrimaryButton label="Review routine preferences" onPress={() => router.replace('/routine-intake')} />
        <LegalNote />
      </Screen>
    );
  }

  const routine = buildSyntheticRoutine(analysis.result, routineProfile, catalog.products);
  const steps = routine[period];
  const modeCopy = modeDescriptions[routine.mode];
  const fictional = catalog.source === 'synthetic_samples';
  const productsOffered = new Set([...routine.am, ...routine.pm].flatMap((step) => (step.product ? [step.product.id] : []))).size;

  return (
    <Screen title="Routine" back>
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
          <Text style={styles.eyebrow}>{routine.mode.toUpperCase()} MODE{analysis.source === 'remembered' ? ' · REMEMBERED CHECK-IN' : ''}</Text>
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

      <Pressable accessibilityRole="button" onPress={() => router.push('/products')} style={({ pressed }) => [styles.catalogCard, pressed && styles.pressed]}>
        <View style={styles.catalogHeading}>
          <Text style={styles.catalogEyebrow}>{catalogSourceLabels[catalog.source].toUpperCase()}</Text>
          <Text style={styles.catalogLink}>View list →</Text>
        </View>
        <Text style={styles.catalogBody}>
          {routine.consideredCount} products considered · {routine.eligibleCount} eligible for you · {productsOffered} in this routine.
          {fictional ? ' The reviewed product list is empty, so fictional samples stand in.' : ''}
        </Text>
      </Pressable>

      <InfoCard
        title="Your price preference"
        body={`${budgetPreferenceLabels[routineProfile.budgetPreference]}. Safety and appearance-goal fit are applied before price, and equally matched options favor the lower list price.`}
        tone="gold"
      />

      <View style={styles.list}>
        {steps.map((step, index) => <RoutineStepCard key={step.id} step={step} index={index} fictional={fictional} />)}
      </View>

      {routine.notes.map((note, index) => (
        <InfoCard key={note} title={index === 0 ? 'Routine safety' : 'Why this routine looks this way'} body={note} tone={index === 0 ? 'lilac' : 'gold'} />
      ))}
      {fictional ? (
        <InfoCard title="Prototype catalog" body="Every named item and displayed price is fictional. Real products, current prices, and links appear only once a reviewed product list is loaded." />
      ) : (
        <InfoCard title="Reviewed product list" body={routine.pricesUnverified
          ? betaCatalogTestingEnabled
            ? 'This TestFlight beta uses research-preview products from your list. Prices that have not been verified are omitted, and commercial links never influence matching.'
            : 'Products come from your reviewed list. Prices that have not been verified are omitted, and commercial links never influence matching.'
          : betaCatalogTestingEnabled
            ? 'This TestFlight beta uses research-preview products from your list. Prices are approximate and can change; safety answers and appearance-goal fit are applied before price, and commercial links never influence matching.'
            : 'Products come from your reviewed list. Prices are approximate and can change; safety answers and appearance-goal fit are applied before price, and commercial links never influence matching.'} tone="green" />
      )}
      <PrimaryButton label="See progress" onPress={() => router.push('/compare')} />
      <SecondaryButton label="Change routine preferences" onPress={() => router.push('/routine-intake')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { borderRadius: radius.medium, flexDirection: 'row', backgroundColor: colors.panel, padding: 4 },
  periodTab: { flex: 1, minHeight: 42, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  periodTabActive: { backgroundColor: colors.blue },
  periodText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  periodTextActive: { color: colors.white },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 26, fontWeight: '400', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  stepCount: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.blue}10` },
  stepCountNumber: { color: colors.text, fontSize: 22, fontWeight: '800' },
  stepCountLabel: { color: colors.blue, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goalPill: { backgroundColor: `${colors.lilac}14`, borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.lilac}3A`, paddingHorizontal: 9, paddingVertical: 6 },
  goalText: { color: colors.lilac, fontSize: 8, fontWeight: '700', textTransform: 'capitalize' },
  catalogCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 5, ...shadows.card },
  catalogHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  catalogEyebrow: { color: colors.green, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  catalogLink: { color: colors.oliveDark, fontSize: 11, fontWeight: '700' },
  catalogBody: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.78 },
  list: { backgroundColor: colors.panel, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadows.card },
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
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  productBrand: { color: colors.blue, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  productPrice: { color: colors.green, fontSize: 10, fontWeight: '800' },
  productName: { color: colors.text, fontSize: 11, fontWeight: '600', marginTop: 2 },
  matchReason: { color: colors.muted, fontSize: 9, marginTop: 4, textTransform: 'capitalize' },
  productNote: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  productCaution: { color: colors.gold, fontSize: 9, lineHeight: 13, marginTop: 3 },
  categoryOnly: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  categoryOnlyTitle: { color: colors.green, fontSize: 9, fontWeight: '700' },
  categoryOnlyBody: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
});
