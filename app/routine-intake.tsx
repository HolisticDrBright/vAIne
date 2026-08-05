import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen } from '@/components/AppChrome';
import type { SafetyAnswer } from '@/domain/recommendations/routineBuilder';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, radius } from '@/theme';

type ChoiceValue = SafetyAnswer | 'standard' | 'sensitive' | 'avoid' | 'no_preference';

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
  const { saveRoutineProfile } = useRoutineProfile();
  const [sensitivity, setSensitivity] = useState<'standard' | 'sensitive' | null>(null);
  const [pregnancyOrNursing, setPregnancyOrNursing] = useState<SafetyAnswer | null>(null);
  const [recentProcedure, setRecentProcedure] = useState<SafetyAnswer | null>(null);
  const [knownAllergyOrReaction, setKnownAllergyOrReaction] = useState<SafetyAnswer | null>(null);
  const [currentStrongActives, setCurrentStrongActives] = useState<SafetyAnswer | null>(null);
  const [fragrancePreference, setFragrancePreference] = useState<'avoid' | 'no_preference' | null>(null);

  const complete = Boolean(
    sensitivity &&
    pregnancyOrNursing &&
    recentProcedure &&
    knownAllergyOrReaction &&
    currentStrongActives &&
    fragrancePreference,
  );

  const buildRoutine = () => {
    if (
      !sensitivity ||
      !pregnancyOrNursing ||
      !recentProcedure ||
      !knownAllergyOrReaction ||
      !currentStrongActives ||
      !fragrancePreference
    ) return;

    saveRoutineProfile({
      sensitivityPreference: sensitivity,
      pregnancyOrNursing,
      recentProcedure,
      knownAllergyOrReaction,
      currentStrongActives,
      avoidFragrance: fragrancePreference === 'avoid',
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
      <Text style={styles.heading}>Keep today’s routine comfortably simple</Text>
      <Text style={styles.subtitle}>These answers stay in memory for this app session. They are not uploaded, saved to an account, or used for diagnosis.</Text>

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
        body="A yes or private answer hides all named samples until product-specific review is possible."
        value={knownAllergyOrReaction}
        options={answerOptions}
        onSelect={setKnownAllergyOrReaction}
      />
      <ChoiceQuestion
        title="Using a retinoid, exfoliating acid, or other strong active?"
        body="A yes or private answer avoids adding another targeted support step."
        value={currentStrongActives}
        options={answerOptions}
        onSelect={setCurrentStrongActives}
      />
      <ChoiceQuestion
        title="Fragrance preference"
        body="This preference becomes a hard filter when a future verified catalog is enabled."
        value={fragrancePreference}
        options={fragranceOptions}
        onSelect={setFragrancePreference}
      />

      <InfoCard title="Prefer not to say is always valid" body="Private answers produce a conservative category-level routine. They never prevent access to the app." tone="green" />
      <PrimaryButton label="Build today’s routine" onPress={buildRoutine} disabled={!complete} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  question: { backgroundColor: colors.panel, padding: 15, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line },
  questionTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  questionBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  option: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft },
  optionSelected: { borderColor: colors.blue, backgroundColor: `${colors.blue}20` },
  optionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  optionTextSelected: { color: colors.text },
});
