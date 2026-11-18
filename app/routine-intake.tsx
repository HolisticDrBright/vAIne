import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { MAX_SUGGESTED_TYPES, PRODUCT_TYPE_OPTIONS, type ProductInterestMode, type ProductType } from '@/domain/recommendations/productTypes';
import { ACTIVE_FAMILY_OPTIONS, parseIngredientList, type BudgetPreference, type FacialSkinRightNow, type RoutineProductCount, type SafetyAnswer } from '@/domain/recommendations/routineBuilder';
import { TECHNIQUE_TOOLS, techniqueToolLabels, type TechniqueTool } from '@/domain/techniques/technique';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

type ChoiceValue = SafetyAnswer | BudgetPreference | RoutineProductCount | FacialSkinRightNow | 'standard' | 'sensitive' | 'avoid' | 'no_preference';

interface ChoiceOption<T extends ChoiceValue> {
  label: string;
  value: T;
}

interface ChoiceQuestionProps<T extends ChoiceValue> {
  title: string;
  body: string;
  value: T | null;
  options: readonly ChoiceOption<T>[];
  onSelect: (value: T) => void;
}

const answerOptions: readonly ChoiceOption<SafetyAnswer>[] = [
  { label: 'No', value: 'no' },
  { label: 'Yes', value: 'yes' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const sensitivityOptions: readonly ChoiceOption<'standard' | 'sensitive'>[] = [
  { label: 'Standard', value: 'standard' },
  { label: 'Sensitive', value: 'sensitive' },
];

const fragranceOptions: readonly ChoiceOption<'avoid' | 'no_preference'>[] = [
  { label: 'No preference', value: 'no_preference' },
  { label: 'Avoid fragrance', value: 'avoid' },
];

const facialSkinOptions: readonly ChoiceOption<FacialSkinRightNow>[] = [
  { label: 'No', value: 'none' },
  { label: 'Cold sore or infection', value: 'cold_sore_or_infection' },
  { label: 'Sunburn', value: 'sunburn' },
  { label: 'Both', value: 'both' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const budgetOptions: readonly ChoiceOption<BudgetPreference>[] = [
  { label: 'Up to $25', value: 'up_to_25' },
  { label: 'Up to $50', value: 'up_to_50' },
  { label: 'Up to $100', value: 'up_to_100' },
  { label: 'No limit', value: 'no_limit' },
];

const routineSizeOptions: readonly ChoiceOption<RoutineProductCount>[] = [
  { label: '2 focused', value: 2 },
  { label: '4 simple', value: 4 },
  { label: '6 complete', value: 6 },
  { label: '8 advanced', value: 8 },
];

function ChoiceQuestion<T extends ChoiceValue>({ title, body, value, options, onSelect }: ChoiceQuestionProps<T>) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionTitle}>{title}</Text>
      <Text style={styles.questionBody}>{body}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function RoutineIntakeScreen() {
  const { routineProfile, loading } = useRoutineProfile();
  if (loading) {
    return (
      <Screen title="Routine preferences" back>
        <Text style={styles.heading}>Loading your saved answers…</Text>
      </Screen>
    );
  }
  // The form seeds its state from the remembered answers once, so it only
  // mounts after they have been read from the device.
  return <RoutineIntakeForm key={routineProfile ? 'saved' : 'new'} />;
}

function RoutineIntakeForm() {
  const { analysis } = useAnalysisSession();
  const { routineProfile, saveRoutineProfile } = useRoutineProfile();
  const [sensitivity, setSensitivity] = useState<'standard' | 'sensitive' | null>(() => routineProfile?.sensitivityPreference ?? null);
  const [pregnancyOrNursing, setPregnancyOrNursing] = useState<SafetyAnswer | null>(() => routineProfile?.pregnancyOrNursing ?? null);
  const [recentProcedure, setRecentProcedure] = useState<SafetyAnswer | null>(() => routineProfile?.recentProcedure ?? null);
  const [knownAllergyOrReaction, setKnownAllergyOrReaction] = useState<SafetyAnswer | null>(() => routineProfile?.knownAllergyOrReaction ?? null);
  const [avoidIngredientsText, setAvoidIngredientsText] = useState(() => (routineProfile?.avoidIngredients ?? []).join(', '));
  const [currentStrongActives, setCurrentStrongActives] = useState<SafetyAnswer | null>(() => routineProfile?.currentStrongActives ?? null);
  const [activeFamilies, setActiveFamilies] = useState<readonly string[]>(() => routineProfile?.currentActiveFamilies ?? []);
  const [fragrancePreference, setFragrancePreference] = useState<'avoid' | 'no_preference' | null>(() => (
    routineProfile ? (routineProfile.avoidFragrance ? 'avoid' : 'no_preference') : null
  ));
  const [budgetPreference, setBudgetPreference] = useState<BudgetPreference | null>(() => routineProfile?.budgetPreference ?? null);
  const [routineProductCount, setRoutineProductCount] = useState<RoutineProductCount | null>(() => routineProfile?.routineProductCount ?? 4);
  const [productInterests, setProductInterests] = useState<readonly ProductType[]>(() => routineProfile?.productInterests ?? []);
  const [productInterestMode, setProductInterestMode] = useState<ProductInterestMode>(() => routineProfile?.productInterestMode ?? 'manual');
  const letAiPick = productInterestMode === 'auto';
  const [implantedDevice, setImplantedDevice] = useState<SafetyAnswer | null>(() => routineProfile?.implantedDevice ?? null);
  const [lightSensitisingMedication, setLightSensitisingMedication] = useState<SafetyAnswer | null>(() => routineProfile?.lightSensitisingMedication ?? null);
  const [activeBreakouts, setActiveBreakouts] = useState<SafetyAnswer | null>(() => routineProfile?.activeBreakouts ?? null);
  const [recentInjectables, setRecentInjectables] = useState<SafetyAnswer | null>(() => routineProfile?.recentInjectables ?? null);
  const [fragileSkinOrBloodThinners, setFragileSkinOrBloodThinners] = useState<SafetyAnswer | null>(() => routineProfile?.fragileSkinOrBloodThinners ?? null);
  const [seizureOrHeartCondition, setSeizureOrHeartCondition] = useState<SafetyAnswer | null>(() => routineProfile?.seizureOrHeartCondition ?? null);
  const [rosaceaOrBrokenCapillaries, setRosaceaOrBrokenCapillaries] = useState<SafetyAnswer | null>(() => routineProfile?.rosaceaOrBrokenCapillaries ?? null);
  const [facialSkinRightNow, setFacialSkinRightNow] = useState<FacialSkinRightNow | null>(() => routineProfile?.facialSkinRightNow ?? null);
  const [toolsOwned, setToolsOwned] = useState<readonly TechniqueTool[]>(() => routineProfile?.toolsOwned ?? []);
  const toggleTool = (tool: TechniqueTool) => {
    setToolsOwned((current) => (current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]));
  };

  const complete = Boolean(
    sensitivity &&
    pregnancyOrNursing &&
    recentProcedure &&
    knownAllergyOrReaction &&
    currentStrongActives &&
    fragrancePreference &&
    budgetPreference && routineProductCount &&
    implantedDevice && lightSensitisingMedication && activeBreakouts && recentInjectables && fragileSkinOrBloodThinners &&
    seizureOrHeartCondition && rosaceaOrBrokenCapillaries && facialSkinRightNow,
  );

  const toggleFamily = (family: string) => {
    setActiveFamilies((current) => (current.includes(family) ? current.filter((item) => item !== family) : [...current, family]));
  };

  const toggleInterest = (type: ProductType) => {
    setProductInterestMode('manual');
    setProductInterests((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  };

  const buildRoutine = () => {
    if (
      !sensitivity ||
      !pregnancyOrNursing ||
      !recentProcedure ||
      !knownAllergyOrReaction ||
      !currentStrongActives ||
      !fragrancePreference ||
      !budgetPreference ||
      !routineProductCount ||
      !implantedDevice ||
      !lightSensitisingMedication ||
      !activeBreakouts ||
      !recentInjectables ||
      !fragileSkinOrBloodThinners ||
      !seizureOrHeartCondition ||
      !rosaceaOrBrokenCapillaries ||
      !facialSkinRightNow
    ) return;

    saveRoutineProfile({
      sensitivityPreference: sensitivity,
      pregnancyOrNursing,
      recentProcedure,
      knownAllergyOrReaction,
      currentStrongActives,
      avoidFragrance: fragrancePreference === 'avoid',
      budgetPreference,
      routineProductCount,
      avoidIngredients: knownAllergyOrReaction === 'yes' ? parseIngredientList(avoidIngredientsText) : [],
      currentActiveFamilies: currentStrongActives === 'yes' ? activeFamilies : [],
      // In auto mode the list is derived per check-in, so nothing stale is kept.
      productInterests: productInterestMode === 'auto' ? [] : productInterests,
      productInterestMode,
      implantedDevice,
      lightSensitisingMedication,
      activeBreakouts,
      recentInjectables,
      fragileSkinOrBloodThinners,
      seizureOrHeartCondition,
      rosaceaOrBrokenCapillaries,
      facialSkinRightNow,
      toolsOwned,
    });
    router.replace('/routine');
  };

  if (analysis.status !== 'ready' || !analysis.result) {
    return (
      <Screen title="Routine preferences" back>
        <Text style={styles.heading}>Prepare the sample snapshot first</Text>
        <PrimaryButton label="Prepare synthetic results" onPress={() => router.replace('/processing')} />
      </Screen>
    );
  }

  return (
    <Screen title="Routine preferences" back>
      <Text style={styles.eyebrow}>A SHORT SAFETY CHECK</Text>
      <Text style={styles.heading}>{routineProfile ? 'Review your saved answers' : 'Keep today’s routine comfortably simple'}</Text>
      <Text style={styles.subtitle}>These answers are saved on this device so you do not repeat them each check-in. They are not uploaded, not tied to an account, and not used for diagnosis. Delete them any time from privacy controls.</Text>

      <View style={styles.question}>
        <Text style={styles.questionTitle}>What are you shopping for?</Text>
        <Text style={styles.questionBody}>Optional. Let vAIne pick from your check-in, or check everything you are interested in. Products of these types are chosen first for your routine and each gets its own pick, as long as they pass the same safety, goal, budget, and routine-size rules.</Text>
        <View style={styles.checklist}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: letAiPick }}
            accessibilityLabel="Let vAIne pick for me"
            onPress={() => setProductInterestMode(letAiPick ? 'manual' : 'auto')}
            style={[styles.checkRow, styles.aiRow, letAiPick && styles.aiRowSelected]}
          >
            <View style={[styles.checkbox, letAiPick && styles.checkboxSelected]}>
              {letAiPick ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <View style={styles.checkCopy}>
              <Text style={[styles.checkLabel, letAiPick && styles.optionTextSelected]}>Let vAIne pick for me</Text>
              <Text style={styles.checkHint}>Chooses up to {MAX_SUGGESTED_TYPES} product types from what each check-in shows, for example fine lines → wrinkle treatment.</Text>
            </View>
          </Pressable>
          {PRODUCT_TYPE_OPTIONS.map((option) => {
            const selected = !letAiPick && productInterests.includes(option.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                key={option.value}
                onPress={() => toggleInterest(option.value)}
                style={[styles.checkRow, selected && styles.checkRowSelected, letAiPick && styles.checkRowDimmed]}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.checkCopy}>
                  <Text style={[styles.checkLabel, selected && styles.optionTextSelected]}>{option.label}</Text>
                  <Text style={styles.checkHint}>{option.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.inputHint}>
          {letAiPick
            ? 'vAIne will choose the types for each check-in. Check a type yourself to take over.'
            : productInterests.length
              ? `${productInterests.length} type${productInterests.length === 1 ? '' : 's'} selected. Leave all unchecked for no preference.`
              : 'Nothing selected, so the routine is built from your check-in goals alone.'}
        </Text>
      </View>

      <ChoiceQuestion
        title="What should each product cost at most?"
        body="We will stay at or below this amount per product. Price does not make a product a better match."
        value={budgetPreference}
        options={budgetOptions}
        onSelect={setBudgetPreference}
      />

      <ChoiceQuestion
        title="How many products will you realistically use?"
        body="Choose the maximum number of unique products in your full morning, evening, and weekly plan. A product used both morning and night counts once."
        value={routineProductCount}
        options={routineSizeOptions}
        onSelect={setRoutineProductCount}
      />

      <ChoiceQuestion
        title="How should we approach sensitivity?"
        body="Choose sensitive if your skin often feels reactive or you prefer a gentler routine."
        value={sensitivity}
        options={sensitivityOptions}
        onSelect={setSensitivity}
      />
      <ChoiceQuestion
        title="Pregnant, trying to conceive, or nursing?"
        body="A yes or private answer pauses targeted active-support steps."
        value={pregnancyOrNursing}
        options={answerOptions}
        onSelect={setPregnancyOrNursing}
      />
      <ChoiceQuestion
        title="Peel, laser, injection, or other procedure in the last 4 weeks?"
        body="A yes or private answer keeps the routine conservative, pauses techniques, and defers to your aftercare instructions."
        value={recentProcedure}
        options={answerOptions}
        onSelect={setRecentProcedure}
      />
      <ChoiceQuestion
        title="Known product allergy or prior reaction?"
        body="Name the ingredients and products containing them are left out of your routine. Without names, or with a private answer, named products are hidden until product-specific review is possible."
        value={knownAllergyOrReaction}
        options={answerOptions}
        onSelect={setKnownAllergyOrReaction}
      />
      {knownAllergyOrReaction === 'yes' ? (
        <View style={styles.question}>
          <Text style={styles.questionTitle}>Ingredients to avoid</Text>
          <Text style={styles.questionBody}>Separate names with commas, for example “lanolin, fragrance, cocamidopropyl betaine”. Products listing any of them are excluded.</Text>
          <TextInput
            accessibilityLabel="Ingredients to avoid"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={setAvoidIngredientsText}
            placeholder="e.g. lanolin, benzoyl peroxide"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={avoidIngredientsText}
          />
          <Text style={styles.inputHint}>
            {parseIngredientList(avoidIngredientsText).length
              ? `${parseIngredientList(avoidIngredientsText).length} ingredient${parseIngredientList(avoidIngredientsText).length === 1 ? '' : 's'} will be excluded.`
              : 'No ingredients named yet, so named products stay hidden.'}
          </Text>
        </View>
      ) : null}
      <ChoiceQuestion
        title="Using a retinoid, exfoliating acid, or other strong active?"
        body="Tell us which families you already use and the routine skips products in the same family instead of pausing support entirely."
        value={currentStrongActives}
        options={answerOptions}
        onSelect={setCurrentStrongActives}
      />
      {currentStrongActives === 'yes' ? (
        <View style={styles.question}>
          <Text style={styles.questionTitle}>Which actives are you already using?</Text>
          <Text style={styles.questionBody}>Select every family that applies. Leaving all unselected pauses targeted support.</Text>
          <View style={styles.options}>
            {ACTIVE_FAMILY_OPTIONS.map((option) => {
              const selected = activeFamilies.includes(option.value);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={option.value}
                  onPress={() => toggleFamily(option.value)}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <Text style={styles.sectionEyebrow}>FOR AT-HOME TECHNIQUES</Text>
      <Text style={styles.sectionBody}>Gua sha, facial exercise, microcurrent, red light, and cupping are offered only when these answers allow. A yes or private answer simply leaves a technique out. The app sets no age limit of its own; device techniques follow each maker’s age guidance.</Text>
      <ChoiceQuestion
        title="Pacemaker or other implanted electrical device?"
        body="Microcurrent is never offered with an implanted device."
        value={implantedDevice}
        options={answerOptions}
        onSelect={setImplantedDevice}
      />
      <ChoiceQuestion
        title="Taking a medication, or living with a condition, that makes your skin more sensitive to light?"
        body="Red light sessions are left out while you are."
        value={lightSensitisingMedication}
        options={answerOptions}
        onSelect={setLightSensitisingMedication}
      />
      <ChoiceQuestion
        title="Active breakouts or broken skin right now?"
        body="Tools that glide over the skin are left out until the area has settled."
        value={activeBreakouts}
        options={answerOptions}
        onSelect={setActiveBreakouts}
      />
      <ChoiceQuestion
        title="Injectables in the last 4 weeks?"
        body="Massage and device techniques are paused for 4 weeks; follow your practitioner’s advice."
        value={recentInjectables}
        options={answerOptions}
        onSelect={setRecentInjectables}
      />
      <ChoiceQuestion
        title="Fragile or thin skin, or taking blood thinners?"
        body="Cupping and firmer tools are left out because they can mark the skin."
        value={fragileSkinOrBloodThinners}
        options={answerOptions}
        onSelect={setFragileSkinOrBloodThinners}
      />
      <ChoiceQuestion
        title="Seizure history or a heart condition?"
        body="Microcurrent is never offered with either."
        value={seizureOrHeartCondition}
        options={answerOptions}
        onSelect={setSeizureOrHeartCondition}
      />
      <ChoiceQuestion
        title="Rosacea, or visible broken capillaries on the face?"
        body="Gua sha and cupping are left out; they can aggravate both."
        value={rosaceaOrBrokenCapillaries}
        options={answerOptions}
        onSelect={setRosaceaOrBrokenCapillaries}
      />
      <ChoiceQuestion
        title="A cold sore, infection, or sunburn on the face right now?"
        body="A cold sore or infection pauses gua sha and cupping. Sunburn also pauses microcurrent. Answers are remembered, so update this when it clears."
        value={facialSkinRightNow}
        options={facialSkinOptions}
        onSelect={setFacialSkinRightNow}
      />
      <View style={styles.question}>
        <Text style={styles.questionTitle}>Which tools do you own?</Text>
        <Text style={styles.questionBody}>Optional. Techniques that need a tool you own come first in your plan. Facial exercise needs no tool at all.</Text>
        <View style={styles.options}>
          {TECHNIQUE_TOOLS.map((tool) => {
            const selected = toolsOwned.includes(tool);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={tool}
                onPress={() => toggleTool(tool)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{techniqueToolLabels[tool]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ChoiceQuestion
        title="Fragrance preference"
        body="Avoiding fragrance excludes products that contain fragrance or whose fragrance status is unknown."
        value={fragrancePreference}
        options={fragranceOptions}
        onSelect={setFragrancePreference}
      />

      <InfoCard title="Prefer not to say is always valid" body="Private answers produce a conservative category-level routine. They never prevent access to the app." tone="green" />
      <InfoCard title="Budget is part of the match" body="The routine first applies safety rules, then appearance-goal fit, then your maximum price. An expensive product never ranks higher just because it costs more." tone="gold" />
      <PrimaryButton label={routineProfile ? 'Save and build today’s routine' : 'Build today’s routine'} onPress={buildRoutine} disabled={!complete} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  question: { backgroundColor: colors.panel, padding: 15, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, ...shadows.card },
  questionTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  questionBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  option: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft },
  optionSelected: { borderColor: colors.blue, backgroundColor: `${colors.blue}20` },
  optionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  optionTextSelected: { color: colors.text },
  input: { marginTop: 11, minHeight: 64, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, color: colors.text, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top' },
  inputHint: { color: colors.green, fontSize: 10, fontWeight: '700', marginTop: 7 },
  sectionEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 6 },
  sectionBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -8 },
  checklist: { marginTop: 11, gap: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft },
  checkRowSelected: { borderColor: colors.blue, backgroundColor: `${colors.blue}14` },
  checkRowDimmed: { opacity: 0.45 },
  aiRow: { borderColor: `${colors.gold}66`, marginBottom: 4 },
  aiRowSelected: { borderColor: colors.gold, backgroundColor: `${colors.gold}14` },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  checkboxSelected: { borderColor: colors.blue, backgroundColor: colors.blue },
  checkmark: { color: colors.white, fontSize: 12, fontWeight: '800', lineHeight: 14 },
  checkCopy: { flex: 1 },
  checkLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  checkHint: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 1 },
});
