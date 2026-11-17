import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { ProductPurchaseLink } from '@/components/ProductPurchaseLink';
import { ProductProtocolDetails } from '@/components/ProductProtocolDetails';
import { AdvancedProductEvidenceDetails } from '@/components/AdvancedProductEvidenceDetails';
import { catalogSourceLabels, getRoutineCatalog } from '@/data/routineCatalog';
import { betaCatalogTestingEnabled } from '@/data/betaCatalogTesting';
import { assessProductEvidence, ingredientEvidenceGradeLabels } from '@/domain/recommendations/evidenceRanking';
import {
  buildSyntheticRoutine,
  budgetPreferenceLabels,
  interestReasonCopy,
  noProductReasonCopy,
  routineProductCountLabels,
  type BuiltRoutineStep,
  type InterestPick,
  type RoutinePeriod,
} from '@/domain/recommendations/routineBuilder';
import { describeProductType } from '@/domain/recommendations/productTypes';
import { formatReminderTime } from '@/domain/profile/checkInReminder';
import { withPlanDayDone } from '@/domain/profile/localProfile';
import { computeStreak, emptyPlanLog, toDateKey } from '@/domain/profile/planStreak';
import { techniqueLibrary } from '@/data/techniqueLibrary';
import { noTechniqueReasonCopy } from '@/domain/techniques/dailyTechnique';
import { PLACEHOLDER_REVIEW_LABEL, techniqueToolLabels } from '@/domain/techniques/technique';
import { budgetMaximumCents, buildSafetyProfile, requestedTagsFor, techniqueQuestionsAnswered } from '@/domain/recommendations/routineBuilder';
import { describeExclusions, summarizeExclusions } from '@/domain/recommendations/governance';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { describeTag, formatPrice } from '@/domain/recommendations/presentation';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

const modeDescriptions = {
  standard: 'A simple routine matched to the appearance goals in this check-in.',
  gentle: 'A gentler version with fewer assumptions and easy-to-pause steps.',
  cautious: 'A conservative routine that pauses targeted active support.',
} as const;

function RoutineStepCard({ step, index, fictional, suggested }: { step: BuiltRoutineStep; index: number; fictional: boolean; suggested: boolean }) {
  const formattedPrice = step.product
    ? formatPrice(step.product.listPriceCents, step.product.currencyCode)
    : null;
  const evidence = step.product ? assessProductEvidence(step.product, step.matchedTags) : null;

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
            {step.interest ? (
              <Text style={styles.interestReason}>
                {suggested
                  ? `Chosen first because vAIne picked ${describeProductType(step.interest).toLowerCase()} for this check-in.`
                  : `Chosen first because you are shopping for a ${describeProductType(step.interest).toLowerCase()}.`}
              </Text>
            ) : null}
            {evidence && !fictional ? (
              <Text style={styles.evidence}>{ingredientEvidenceGradeLabels[evidence.grade]} · {evidence.effectivenessScore}/100</Text>
            ) : null}
            {evidence && !fictional && evidence.matchedSignals.length ? (
              <Text style={styles.productNote}>Evidence signals: {evidence.matchedSignals.join(', ')}. See the product-specific limits below where available.</Text>
            ) : null}
            {step.product.cautionNote ? <Text style={styles.productCaution}>Caution: {step.product.cautionNote}</Text> : null}
            {step.product.note ? <Text style={styles.productNote}>Note: {step.product.note}</Text> : null}
            {!fictional ? <AdvancedProductEvidenceDetails productId={step.product.id} /> : null}
            {!fictional ? <ProductProtocolDetails product={step.product} /> : null}
            <ProductPurchaseLink productId={step.product.id} productName={step.product.productName} />
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

function InterestPickCard({ pick, fictional }: { pick: InterestPick; fictional: boolean }) {
  const label = describeProductType(pick.interest);
  return (
    <View style={styles.pickRow}>
      <View style={styles.nameLine}>
        <Text style={styles.pickTitle}>{label}</Text>
        {pick.product ? (
          <Text style={styles.demoBadge}>
            {fictional ? 'FICTIONAL SAMPLE' : pick.product.catalogState === 'catalog_approved' ? 'FROM YOUR LIST' : 'RESEARCH PREVIEW'}
          </Text>
        ) : null}
      </View>
      {pick.product ? (
        <View style={styles.pickBody}>
          <View style={styles.productMeta}>
            <Text style={styles.productBrand}>{pick.product.brandName}</Text>
            <Text style={styles.productPrice}>{formatPrice(pick.product.listPriceCents, pick.product.currencyCode)}</Text>
          </View>
          <Text style={styles.productName}>{pick.product.productName}</Text>
          <Text style={styles.matchReason}>
            {pick.matchedTags.length
              ? `Matched on: ${pick.matchedTags.map(describeTag).join(', ')}`
              : 'Passes your safety and budget rules; no direct match to a goal from this check-in.'}
          </Text>
          {pick.inRoutine ? <Text style={styles.productNote}>Already a step in today’s routine.</Text> : null}
          {pick.product.cautionNote ? <Text style={styles.productCaution}>Caution: {pick.product.cautionNote}</Text> : null}
          {!fictional ? <ProductProtocolDetails product={pick.product} /> : null}
          <ProductPurchaseLink productId={pick.product.id} productName={pick.product.productName} />
        </View>
      ) : (
        <Text style={styles.categoryOnlyBody}>{pick.noProductReason ? interestReasonCopy(pick.interest, pick.noProductReason) : 'No listed product was selected.'}</Text>
      )}
    </View>
  );
}

export default function RoutineScreen() {
  const [period, setPeriod] = useState<RoutinePeriod>('am');
  const { analysis } = useAnalysisSession();
  const { routineProfile, loading } = useRoutineProfile();
  const { profile, updateProfile } = useLocalProfile();
  const catalog = useMemo(() => getRoutineCatalog(), []);
  const todayKey = toDateKey(new Date());
  const streak = computeStreak(profile.planLog ?? emptyPlanLog, todayKey);
  const markTodayDone = () => { void updateProfile((current, nowIso) => withPlanDayDone(current, todayKey, nowIso)); };

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

  const routine = buildSyntheticRoutine(analysis.result, routineProfile, catalog.products, { techniques: techniqueLibrary, dateKey: todayKey });
  const techniqueAnswered = techniqueQuestionsAnswered(routineProfile);
  const session = routine.technique.session;
  const steps = routine[period];
  const modeCopy = modeDescriptions[routine.mode];
  const fictional = catalog.source === 'synthetic_samples';
  const productsOffered = new Set([...routine.am, ...routine.pm].flatMap((step) => (step.product ? [step.product.id] : []))).size;
  const exclusions = summarizeExclusions(catalog.products, buildSafetyProfile(routineProfile), requestedTagsFor(analysis.result), budgetMaximumCents[routineProfile.budgetPreference]);
  const exclusionLines = describeExclusions(exclusions);

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

      <View style={styles.planCard}>
        <View style={styles.planHeading}>
          <View style={styles.planCopy}>
            <Text style={styles.planEyebrow}>TODAY’S PLAN</Text>
            <Text style={styles.planTitle}>{streak.doneToday ? 'Done for today' : 'Mark it done when you finish'}</Text>
            <Text style={styles.planBody}>
              {streak.current > 0
                ? `${streak.current}-day streak${streak.longest > streak.current ? ` · best ${streak.longest}` : ''}. Missing a day just starts the count again.`
                : 'Finish the morning or evening steps and tap done to start a streak. Missing a day just starts the count again.'}
            </Text>
          </View>
          <View style={styles.streakRing}>
            <Text style={styles.streakNumber}>{streak.current}</Text>
            <Text style={styles.streakLabel}>{streak.current === 1 ? 'DAY' : 'DAYS'}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: streak.doneToday }}
          disabled={streak.doneToday}
          onPress={markTodayDone}
          style={[styles.planButton, streak.doneToday && styles.planButtonDone]}
        >
          <Text style={[styles.planButtonText, streak.doneToday && styles.planButtonTextDone]}>{streak.doneToday ? '✓ Today’s plan done' : 'Mark today’s plan done'}</Text>
        </Pressable>
        <View style={styles.techniqueBlock}>
          <View style={styles.techniqueHeading}>
            <Text style={styles.planEyebrow}>TODAY’S TECHNIQUE</Text>
            {session ? <Text style={styles.placeholderBadge}>{PLACEHOLDER_REVIEW_LABEL}</Text> : null}
          </View>
          {session ? (
            <>
              <Text style={styles.techniqueName}>{session.technique.name}</Text>
              <Text style={styles.planBody}>
                {Math.round(session.technique.durationSeconds / 60)} min · {session.technique.requiredTool ? techniqueToolLabels[session.technique.requiredTool] : 'No tool needed'}
                {session.eligibility.matchedTags.length ? ` · supports ${session.eligibility.matchedTags.map(describeTag).join(', ')}` : ''}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/technique-session', params: { id: session.technique.id } })} style={styles.techniqueButton}>
                <Text style={styles.techniqueButtonText}>Start guided session</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.planBody}>
              {!techniqueAnswered
                ? 'Answer the five technique safety questions in routine preferences to add a technique step.'
                : routine.technique.reason ? noTechniqueReasonCopy[routine.technique.reason] : 'No technique today.'}
            </Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => router.push('/techniques')} style={styles.planLink}>
            <Text style={styles.planLinkText}>Browse all techniques →</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/reminder')} style={styles.planLink}>
          <Text style={styles.planLinkText}>
            {profile.reminder?.enabled ? `Daily reminder at ${formatReminderTime(profile.reminder.hour, profile.reminder.minute)} · change` : 'Set a daily reminder →'}
          </Text>
        </Pressable>
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

      <View style={styles.governanceCard}>
        <Text style={styles.catalogEyebrow}>WHY SOME PRODUCTS ARE NOT HERE</Text>
        {exclusionLines.map((line) => <Text key={line} style={styles.governanceLine}>• {line}</Text>)}
        {catalog.blocked.length ? <Text style={styles.governanceLine}>• {catalog.blocked.length} on the list are held back from everyone, each with the reviewer’s reason.</Text> : null}
        <View style={styles.governanceLinks}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/how-we-pick')} style={styles.governanceLink}><Text style={styles.catalogLink}>How we pick →</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/products')} style={styles.governanceLink}><Text style={styles.catalogLink}>Reasons per product →</Text></Pressable>
          {catalog.blocked.length ? <Pressable accessibilityRole="button" onPress={() => router.push('/held-back')} style={styles.governanceLink}><Text style={styles.catalogLink}>Held-back list →</Text></Pressable> : null}
        </View>
      </View>

      <InfoCard
        title="Your price preference"
        body={routineProfile.budgetPreference === 'no_limit'
          ? 'No price limit. Safety, appearance-goal fit, and ingredient evidence rank first; higher price breaks only an otherwise equal tie.'
          : `${budgetPreferenceLabels[routineProfile.budgetPreference]}. Safety, appearance-goal fit, and ingredient evidence rank before price; equally ranked options favor the lower list price.`}
        tone="gold"
      />

      <InfoCard title="Your routine size" body={`${routineProductCountLabels[routineProfile.routineProductCount]}. This is a maximum across the entire plan, not the number applied at one time.`} tone="lilac" />

      <InfoCard title="Evidence-based order" body="Scores compare the recorded ingredients with human clinical evidence for the goals in this check-in. They do not mean the finished product itself was clinically proven." tone="green" />

      <View style={styles.list}>
        {steps.map((step, index) => <RoutineStepCard key={step.id} step={step} index={index} fictional={fictional} suggested={routine.interestSource === 'suggested'} />)}
      </View>

      {routine.interestPicks.length ? (
        <>
          <Text style={styles.sectionTitle}>{routine.interestSource === 'suggested' ? 'Picks vAIne chose for you' : 'Picks for what you’re shopping for'}</Text>
          <Text style={styles.sectionBody}>
            {routine.interestSource === 'suggested'
              ? `From this check-in, vAIne is shopping for: ${routine.interests.map((type) => describeProductType(type).toLowerCase()).join(', ')}. One product per type, chosen with the same safety, goal, and budget rules as the routine. Pick your own types any time from routine preferences.`
              : 'One product per type you checked, chosen with the same safety, goal, and budget rules as the routine. Change the list any time from routine preferences.'}
          </Text>
          <View style={styles.list}>
            {routine.interestPicks.map((pick) => <InterestPickCard key={pick.interest} pick={pick} fictional={fictional} />)}
          </View>
        </>
      ) : null}

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
  planCard: { borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 15, gap: 11, ...shadows.card },
  planHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planCopy: { flex: 1 },
  planEyebrow: { color: colors.gold, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  planTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  planBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  streakRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.gold}10` },
  streakNumber: { color: colors.text, fontSize: 20, fontWeight: '800' },
  streakLabel: { color: colors.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  planButton: { minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue },
  planButtonDone: { backgroundColor: `${colors.green}18`, borderWidth: 1, borderColor: `${colors.green}66` },
  planButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  planButtonTextDone: { color: colors.green },
  techniqueBlock: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11, gap: 6 },
  techniqueHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  placeholderBadge: { color: colors.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.6, borderWidth: 1, borderColor: `${colors.gold}66`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  techniqueName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  techniqueButton: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  techniqueButtonText: { color: colors.oliveDark, fontSize: 12, fontWeight: '700' },
  planLink: { minHeight: 36, justifyContent: 'center', alignItems: 'center' },
  planLinkText: { color: colors.oliveDark, fontSize: 11, fontWeight: '700' },
  catalogCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 5, ...shadows.card },
  governanceCard: { borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 6, ...shadows.card },
  governanceLine: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  governanceLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  governanceLink: { minHeight: 32, justifyContent: 'center' },
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
  interestReason: { color: colors.blue, fontSize: 9, lineHeight: 13, marginTop: 4 },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 20, marginTop: 6 },
  sectionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -8 },
  pickRow: { padding: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  pickTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pickBody: { marginTop: 8 },
  evidence: { color: colors.blue, fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 4 },
  productNote: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  productCaution: { color: colors.gold, fontSize: 9, lineHeight: 13, marginTop: 3 },
  categoryOnly: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  categoryOnlyTitle: { color: colors.green, fontSize: 9, fontWeight: '700' },
  categoryOnlyBody: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
});
