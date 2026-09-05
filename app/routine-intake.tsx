import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import { ACTIVE_FAMILY_OPTIONS, parseIngredientList, type BudgetPreference, type SafetyAnswer } from '@/domain/recommendations/routineBuilder';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

type ChoiceValue = SafetyAnswer | BudgetPreference | 'standard' | 'sensitive' | 'avoid' | 'no_preference';

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

const budgetOptions: readonly ChoiceOption<BudgetPreference>[] = [
  { label: 'Up to $25', value: 'up_to_25' },
  { label: 'Up to $50', value: 'up_to_50' },
  { label: 'Up to $100', value: 'up_to_100' },
  { label: 'No limit', value: 'no_limit' },
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

  const complete = Boolean(
    sensitivity &&
    pregnancyOrNursing &&
    recentProcedure &&
    knownAllergyOrReaction &&
    currentStrongActives &&
    fragrancePreference &&
    budgetPreference,
  );

  const toggleFamily = (family: string) => {
    setActiveFamilies((current) => (current.includes(family) ? current.filter((item) => item !== family) : [...current, family]));
  };

  const buildRoutine = () => {
    if (
      !sensitivity ||
      !pregnancyOrNursing ||
      !recentProcedure ||
      !knownAllergyOrReaction ||
      !currentStrongActives ||
      !fragrancePreference ||
      !budgetPreference
    ) return;

    saveRoutineProfile({
      sensitivityPreference: sensitivity,
      pregnancyOrNursing,
      recentProcedure,
      knownAllergyOrReaction,
      currentStrongActives,
      avoidFragrance: fragrancePreference === 'avoid',
      budgetPreference,
      avoidIngredients: knownAllergyOrReaction === 'yes' ? parseIngredientList(avoidIngredientsText) : [],
      currentActiveFamilies: currentStrongActives === 'yes' ? activeFamilies : [],
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

      <ChoiceQuestion
        title="What should each product cost at most?"
        body="We will stay at or below this amount per product. Price does not make a product a better match."
        value={budgetPreference}
        options={budgetOptions}
        onSelect={setBudgetPreference}
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
        title="Recent peel, laser, injection, or other procedure?"
        body="A yes or private answer keeps the routine conservative and defers to your aftercare instructions."
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
});
