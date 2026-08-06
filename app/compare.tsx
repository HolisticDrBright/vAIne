import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { LocalCaptureStrip } from '@/components/LocalCaptureStrip';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { useProgressBaseline } from '@/state/ProgressBaselineContext';
import { colors, radius } from '@/theme';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function ComparisonPhoto({ label, date, uri }: { label: string; date: string; uri: string }) {
  return (
    <View style={styles.photoCard}>
      <View style={styles.photoHeading}>
        <Text style={styles.photoLabel}>{label}</Text>
        <Text style={styles.photoDate}>{date}</Text>
      </View>
      <Image accessibilityLabel={`${label} front photo`} source={{ uri }} style={styles.photo} />
    </View>
  );
}

export default function CompareScreen() {
  const { session } = useCaptureSession();
  const { baseline, status, errorMessage, keepAsBaseline, clearBaseline } = useProgressBaseline();
  const currentFront = session.captures.find((capture) => capture.angle === 'front');
  const baselineFront = baseline?.captures.find((capture) => capture.angle === 'front');
  const currentIsBaseline = Boolean(baseline && baseline.sourceSessionId === session.id);
  const canSave = Boolean(
    session.id
    && session.consent?.progressTracking
    && session.captures.length === 3
    && status !== 'saving',
  );

  const saveCurrentBaseline = async () => {
    if (!session.id || !canSave) return;
    await keepAsBaseline(session.id, session.captures);
  };

  return (
    <Screen title="Progress" back>
      <Text style={styles.eyebrow}>REAL PHOTOS · NO GENERATED SCORE</Text>
      <Text style={styles.title}>Compare consistent check-ins</Text>
      <Text style={styles.subtitle}>Use the same angle, distance, expression, and lighting. This view does not decide whether your skin improved.</Text>

      {status === 'loading' ? <InfoCard title="Checking local storage" body="Looking for a baseline saved in this app." tone="lilac" /> : null}
      {errorMessage ? <InfoCard title="Baseline not saved" body={errorMessage} tone="gold" /> : null}

      {!baseline && status !== 'loading' ? (
        <>
          {session.captures.length ? <LocalCaptureStrip captures={session.captures} title="Current check-in" /> : null}
          {canSave ? (
            <>
              <InfoCard
                title="Save one local baseline?"
                body="This copies all three photos from temporary cache into this app’s longer-term device storage. vAIne does not upload them, but your operating system may include app data in device backups. You can delete the baseline at any time."
                tone="green"
              />
              <PrimaryButton
                label={status === 'saving' ? 'Saving baseline…' : 'Keep this check-in as my baseline'}
                onPress={() => { void saveCurrentBaseline(); }}
                disabled={status === 'saving'}
              />
            </>
          ) : (
            <InfoCard
              title={session.captures.length ? 'Progress tracking was not enabled' : 'A baseline comes first'}
              body={session.captures.length
                ? 'These temporary photos will not be saved for progress. Start a new check-in and choose the optional progress setting if you want a baseline.'
                : 'Complete a three-photo check-in and choose the optional progress setting. Saving a baseline still requires a separate confirmation.'}
              tone="lilac"
            />
          )}
          <PrimaryButton label="Start a new check-in" onPress={() => router.replace('/consent')} />
        </>
      ) : null}

      {baseline && baselineFront && currentIsBaseline ? (
        <>
          <LocalCaptureStrip captures={baseline.captures} title="Saved local baseline" />
          <InfoCard title="Baseline saved" body="This is the same check-in, so there is no follow-up to compare yet. Return later and capture a new, similarly lit check-in." tone="green" />
          <PrimaryButton label="Start a follow-up check-in" onPress={() => router.replace('/consent')} />
        </>
      ) : null}

      {baseline && baselineFront && !currentFront ? (
        <>
          <LocalCaptureStrip captures={baseline.captures} title="Saved local baseline" />
          <InfoCard title="Ready for a follow-up" body="Your baseline is available in this app. Capture a new check-in with progress tracking enabled to view the front photos side by side." tone="green" />
          <PrimaryButton label="Capture follow-up photos" onPress={() => router.replace('/consent')} />
        </>
      ) : null}

      {baseline && baselineFront && currentFront && !currentIsBaseline ? (
        session.consent?.progressTracking ? (
          <>
            <View style={styles.comparison}>
              <ComparisonPhoto label="Baseline" date={formatDate(baseline.savedAtIso)} uri={baselineFront.uri} />
              <Text style={styles.arrow}>→</Text>
              <ComparisonPhoto label="Current" date={formatDate(currentFront.capturedAtIso)} uri={currentFront.uri} />
            </View>
            <View style={styles.checks}>
              <Text style={styles.checksTitle}>Before interpreting visible differences</Text>
              <Text style={styles.check}>□ Lighting looks similar</Text>
              <Text style={styles.check}>□ Face distance and angle look similar</Text>
              <Text style={styles.check}>□ Makeup, filters, and expression are comparable</Text>
            </View>
            <InfoCard title="No automatic conclusion" body="Differences can come from lighting, camera processing, positioning, products, or ordinary day-to-day variation. This beta does not calculate improvement." tone="lilac" />
          </>
        ) : (
          <InfoCard title="Current check-in is not comparison-enabled" body="The saved baseline remains available, but this check-in’s progress setting was off. vAIne will not present it as a follow-up comparison." tone="lilac" />
        )
      ) : null}

      {baseline ? <SecondaryButton label="Delete saved baseline photos" onPress={() => { void clearBaseline(); }} /> : null}
      <SecondaryButton label="Privacy controls" onPress={() => router.push('/privacy')} />
      <SecondaryButton label="Back to home" onPress={() => router.replace('/')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: '700', marginTop: -4 },
  subtitle: { color: colors.muted, lineHeight: 20, fontSize: 13, marginTop: -6 },
  comparison: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  photoCard: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.large, overflow: 'hidden' },
  photoHeading: { padding: 10, gap: 2 },
  photoLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  photoDate: { color: colors.muted, fontSize: 9 },
  photo: { width: '100%', aspectRatio: 0.72, backgroundColor: colors.panelSoft },
  arrow: { color: colors.blue, fontSize: 20, fontWeight: '800' },
  checks: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.medium, padding: 15, gap: 9 },
  checksTitle: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  check: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
