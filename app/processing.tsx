import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { colors, fonts, radius, shadows } from '@/theme';

const demoSteps = [
  'Validate the consumer-safe result format',
  'Assemble the appearance snapshot',
  'Prepare the facial-zone explorer',
] as const;

const liveSteps = [
  'Re-encode photos on this phone (metadata removed)',
  'Send once to the analysis service',
  'Validate the result and delete the photos there',
] as const;

export default function ProcessingScreen() {
  const { analysis, serviceDescriptor, startAnalysis, resetAnalysis } = useAnalysisSession();
  const { session, clearCaptures } = useCaptureSession();
  const isDemo = serviceDescriptor.mode === 'synthetic_demo';
  const preparationSteps = isDemo ? demoSteps : liveSteps;

  useEffect(() => {
    if (analysis.status === 'idle') void startAnalysis(session.captures);
  }, [analysis.status, session.captures, startAnalysis]);

  const retry = () => {
    resetAnalysis();
  };

  const retakePhotos = async () => {
    await clearCaptures();
    resetAnalysis();
    router.replace('/capture');
  };

  return (
    <Screen title="Preparing your view" back>
      <View style={styles.hero}>
        <View style={[styles.orbit, analysis.status === 'ready' && styles.orbitReady]}>
          <Text style={styles.orbitMark}>{analysis.status === 'ready' ? '✓' : 'vAI'}</Text>
        </View>
        <Text style={styles.eyebrow}>{isDemo ? 'SYNTHETIC DEMONSTRATION' : 'ANALYSIS IN PROGRESS'}</Text>
        <Text style={styles.title}>
          {analysis.status === 'ready'
            ? isDemo ? 'Your sample view is ready' : 'Your analysis is ready'
            : analysis.status === 'error'
              ? 'The sample could not be prepared'
              : analysis.status === 'retake'
                ? 'A retake is needed'
                : 'Building Your Skin Today'}
        </Text>
        <Text style={styles.subtitle}>
          {isDemo
            ? 'This milestone validates and presents fictional demonstration data. It does not inspect, transmit, or analyze your photos.'
            : 'Your live skin appearance analysis is running now.'}
        </Text>
      </View>

      <View style={styles.steps}>
        {preparationSteps.map((step, index) => {
          const complete = analysis.status === 'ready';
          return (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepNumber, complete && styles.stepNumberComplete]}>
                <Text style={styles.stepNumberText}>{complete ? '✓' : index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          );
        })}
      </View>

      {isDemo ? (
        <InfoCard
          title={session.captures.length ? `${session.captures.length} photos remain local` : 'No photo input'}
          body="The synthetic preparation service accepts no image input and makes no network request."
          tone="green"
        />
      ) : (
        <InfoCard
          title="Real analysis in progress"
          body="If the photos cannot support a confident result, vAIne will ask you to retake them instead of showing a sample."
          tone="green"
        />
      )}

      {analysis.status === 'ready' ? (
        <PrimaryButton label={isDemo ? 'View the sample snapshot' : 'View Your Skin Today'} onPress={() => router.replace('/overview')} />
      ) : null}
      {analysis.status === 'retake' ? (
        <>
          <InfoCard
            title="Please retake your photos"
            body={analysis.retakeInstruction ?? 'The photos could not support a confident view. Please retake them.'}
            tone="gold"
          />
          <PrimaryButton label="Retake photos" onPress={() => { void retakePhotos(); }} />
          <SecondaryButton label="Return home" onPress={() => router.replace('/')} />
        </>
      ) : null}
      {analysis.status === 'error' ? (
        <>
          <InfoCard title="Preparation error" body={analysis.errorMessage ?? 'Please retry the demonstration.'} />
          <PrimaryButton label={isDemo ? 'Retry demonstration' : 'Try again'} onPress={retry} />
          {!isDemo ? <SecondaryButton label="Retake photos" onPress={() => { void retakePhotos(); }} /> : null}
          <SecondaryButton label="Return home" onPress={() => router.replace('/')} />
        </>
      ) : null}
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  orbit: { width: 94, height: 94, borderRadius: 47, borderWidth: 2, borderColor: colors.blue, backgroundColor: `${colors.blue}12`, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  orbitReady: { borderColor: colors.green, backgroundColor: `${colors.green}12` },
  orbitMark: { color: colors.text, fontSize: 24, fontWeight: '800' },
  eyebrow: { color: colors.lilac, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontWeight: '400', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 330 },
  steps: { backgroundColor: colors.panel, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
  stepRow: { minHeight: 61, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  stepNumber: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  stepNumberComplete: { borderColor: colors.green, backgroundColor: `${colors.green}18` },
  stepNumberText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  stepText: { color: colors.text, fontSize: 13, flex: 1 },
});
