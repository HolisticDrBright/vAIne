import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { techniqueLibrary } from '@/data/techniqueLibrary';
import { withPlanDayDone } from '@/domain/profile/localProfile';
import { toDateKey } from '@/domain/profile/planStreak';
import { buildTechniqueSafetyProfile, techniqueQuestionsAnswered } from '@/domain/recommendations/routineBuilder';
import { PLACEHOLDER_REVIEW_LABEL, techniqueCategoryLabels, techniqueToolLabels } from '@/domain/techniques/technique';
import { evaluateTechniqueEligibility, techniqueReasonCopy } from '@/domain/techniques/techniqueEligibility';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { useRoutineProfile } from '@/state/RoutineProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Guided technique session: the step list, a countdown per step with its
 * pressure and direction cue, and the "who should skip this" note shown
 * before anything starts. The session is placeholder content and is
 * labelled as such on screen.
 */
export default function TechniqueSessionScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const technique = techniqueLibrary.find((item) => item.id === id) ?? null;
  const { routineProfile } = useRoutineProfile();
  const { updateProfile } = useLocalProfile();

  const [phase, setPhase] = useState<'ready' | 'running' | 'paused' | 'done'>('ready');
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(technique?.steps[0]?.seconds ?? 0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const eligibility = useMemo(() => {
    if (!technique || !routineProfile || !techniqueQuestionsAnswered(routineProfile)) return null;
    return evaluateTechniqueEligibility(technique, buildTechniqueSafetyProfile(routineProfile), []);
  }, [routineProfile, technique]);

  useEffect(() => {
    if (phase !== 'running' || !technique) return;
    timer.current = setInterval(() => {
      setRemaining((current) => {
        if (current > 1) return current - 1;
        // Step finished: advance or complete.
        setStepIndex((index) => {
          const next = index + 1;
          if (next >= technique.steps.length) {
            setPhase('done');
            return index;
          }
          setRemaining(technique.steps[next].seconds);
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [phase, technique]);

  if (!technique) {
    return (
      <Screen title="Technique" back>
        <Text style={styles.title}>This technique is not available</Text>
        <PrimaryButton label="Browse techniques" onPress={() => router.replace('/techniques')} />
      </Screen>
    );
  }

  const step = technique.steps[stepIndex];
  const blocked = eligibility ? !eligibility.eligible : false;
  const toolOwned = technique.requiredTool === null || (routineProfile?.toolsOwned ?? []).includes(technique.requiredTool);
  const elapsedBefore = technique.steps.slice(0, stepIndex).reduce((total, item) => total + item.seconds, 0);
  const progress = technique.durationSeconds ? Math.min(1, (elapsedBefore + (step.seconds - remaining)) / technique.durationSeconds) : 0;

  const start = () => { setStepIndex(0); setRemaining(technique.steps[0].seconds); setPhase('running'); };
  const finish = () => {
    setPhase('done');
    void updateProfile((current, nowIso) => withPlanDayDone(current, toDateKey(new Date()), nowIso));
  };

  return (
    <Screen title={technique.name} back>
      <View style={styles.headingRow}>
        <Text style={styles.eyebrow}>{techniqueCategoryLabels[technique.category].toUpperCase()}</Text>
        <Text style={styles.placeholderBadge}>{PLACEHOLDER_REVIEW_LABEL}</Text>
      </View>
      <Text style={styles.title}>{technique.name}</Text>
      <Text style={styles.subtitle}>
        {Math.round(technique.durationSeconds / 60)} minutes · {technique.requiredTool ? techniqueToolLabels[technique.requiredTool] : 'No tool needed'}. Placeholder steps in cautious appearance language; a practitioner has not reviewed them yet.
      </Text>

      <InfoCard title="Who should skip this" body={technique.skipNote} tone="gold" />
      {blocked ? <InfoCard title="Not offered to you right now" body={eligibility!.reasons.map(techniqueReasonCopy).join(' ')} tone="gold" /> : null}
      {!toolOwned && technique.requiredTool ? <InfoCard title="Preview only" body={`This session needs a ${techniqueToolLabels[technique.requiredTool].toLowerCase()}, which you have not marked as owned. You can read the steps; the timer still runs if you want to follow along.`} tone="lilac" /> : null}

      <View style={styles.timerCard}>
        <Text style={styles.stepCount}>STEP {Math.min(stepIndex + 1, technique.steps.length)} OF {technique.steps.length}</Text>
        <Text style={styles.stepTitle}>{phase === 'done' ? 'Session complete' : step.title}</Text>
        <Text style={styles.clock}>{phase === 'done' ? formatClock(0) : formatClock(remaining)}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((phase === 'done' ? 1 : progress) * 100)}%` }]} /></View>
        <Text style={styles.cue}>{phase === 'done' ? 'Stop any time skin feels uncomfortable. Nothing here is a treatment.' : step.cue}</Text>
        <View style={styles.controls}>
          {phase === 'ready' ? <PrimaryButton label="Start" onPress={start} disabled={blocked} /> : null}
          {phase === 'running' ? <PrimaryButton label="Pause" onPress={() => setPhase('paused')} /> : null}
          {phase === 'paused' ? <PrimaryButton label="Resume" onPress={() => setPhase('running')} /> : null}
          {phase === 'running' || phase === 'paused' ? (
            <Pressable accessibilityRole="button" onPress={() => {
              const next = stepIndex + 1;
              if (next >= technique.steps.length) { setPhase('done'); return; }
              setStepIndex(next); setRemaining(technique.steps[next].seconds);
            }} style={styles.skipStep}>
              <Text style={styles.skipStepText}>Skip step</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.steps}>
        {technique.steps.map((item, index) => (
          <View key={item.title} style={[styles.stepRow, index === stepIndex && phase !== 'done' && styles.stepRowActive]}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <View style={styles.stepCopy}>
              <Text style={styles.stepRowTitle}>{item.title} · {formatClock(item.seconds)}</Text>
              <Text style={styles.stepRowCue}>{item.cue}</Text>
            </View>
          </View>
        ))}
      </View>

      <InfoCard title="What is known" body={technique.evidenceNote} tone="lilac" />

      {phase === 'done' ? (
        <PrimaryButton label="Mark today’s plan done" onPress={finish} />
      ) : null}
      <SecondaryButton label="Back" onPress={() => router.back()} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  placeholderBadge: { color: colors.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.6, borderWidth: 1, borderColor: `${colors.gold}66`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  timerCard: { backgroundColor: colors.panel, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, padding: 18, alignItems: 'center', gap: 8, ...shadows.card },
  stepCount: { color: colors.gold, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  stepTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  clock: { color: colors.text, fontFamily: fonts.display, fontSize: 52, lineHeight: 58 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.panelSoft, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.blue },
  cue: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  controls: { width: '100%', gap: 8, marginTop: 4 },
  skipStep: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  skipStepText: { color: colors.oliveDark, fontSize: 12, fontWeight: '700' },
  steps: { backgroundColor: colors.panel, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
  stepRow: { flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  stepRowActive: { backgroundColor: `${colors.blue}10` },
  stepNumber: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.gold, color: colors.gold, fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 24, overflow: 'hidden' },
  stepCopy: { flex: 1 },
  stepRowTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  stepRowCue: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
