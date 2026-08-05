import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { MetricBar } from '@/components/MetricBar';
import { ScoreRing } from '@/components/ScoreRing';
import { getConfidenceBand } from '@/domain/analysis/analysisExperience';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { colors, radius } from '@/theme';

export default function OverviewScreen() {
  const { analysis } = useAnalysisSession();
  const { session } = useCaptureSession();

  if (analysis.status !== 'ready' || !analysis.result) {
    return (
      <Screen title="Your skin today" back>
        <Text style={styles.title}>Prepare the demonstration first</Text>
        <Text style={styles.subtitle}>The consumer-safe result must pass validation before this screen can display it.</Text>
        <PrimaryButton label="Prepare synthetic results" onPress={() => router.replace('/processing')} />
        <LegalNote />
      </Screen>
    );
  }

  const result = analysis.result;
  const confidenceBand = getConfidenceBand(result.overallConfidence);
  const metrics = [
    { label: 'Hydration look', value: result.appearanceScores.hydrationLook },
    { label: 'Tone appearance', value: result.appearanceScores.toneEvennessLook },
    { label: 'Texture look', value: result.appearanceScores.textureLook },
    { label: 'Radiance look', value: result.appearanceScores.radianceLook },
    { label: 'Pore visibility', value: result.appearanceScores.poreVisibilityLook },
  ];
  const supportFocus = [...metrics].sort((left, right) => left.value - right.value).slice(0, 2);

  return (
    <Screen title="Your skin today" back>
      <View style={styles.prototypeNotice}>
        <View style={styles.noticeHeading}>
          <Text style={styles.prototypeNoticeTitle}>SYNTHETIC SAMPLE</Text>
          <Text style={styles.localBadge}>{session.captures.length} LOCAL PHOTOS</Text>
        </View>
        <Text style={styles.prototypeNoticeBody}>This fictional snapshot was not produced from your photos. No image was uploaded or analyzed.</Text>
      </View>

      <View style={styles.lead}>
        <ScoreRing score={result.appearanceScores.overall} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>APPEARANCE SNAPSHOT</Text>
          <Text style={styles.snapshotTitle}>Balanced, with two support opportunities</Text>
          <Text style={styles.body}>{result.summary}</Text>
          <View style={styles.confidence}>
            <Text style={styles.confidenceText}>● {confidenceBand.toUpperCase()} PRESENTATION CONFIDENCE</Text>
          </View>
        </View>
      </View>

      <View style={styles.focusRow}>
        {supportFocus.map((metric, index) => (
          <View key={metric.label} style={styles.focusCard}>
            <Text style={styles.focusNumber}>0{index + 1}</Text>
            <Text style={styles.focusLabel}>{metric.label}</Text>
            <Text style={styles.focusValue}>{metric.value}<Text style={styles.focusUnit}> /100</Text></Text>
            <Text style={styles.focusBody}>A gentle routine focus—not a health measurement.</Text>
          </View>
        ))}
      </View>

      <View style={styles.metrics}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle}>Visible appearance areas</Text>
          <Text style={styles.cardCaption}>SAMPLE INDICES</Text>
        </View>
        {metrics.map((metric) => <MetricBar key={metric.label} {...metric} />)}
      </View>

      <InfoCard title="What can change this view" body={result.limitations[0]} tone="lilac" />
      <PrimaryButton label="Explore facial zones" onPress={() => router.push('/zones')} />
      <SecondaryButton label="See today’s routine" onPress={() => router.push('/routine')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  prototypeNotice: { backgroundColor: `${colors.lilac}12`, borderWidth: 1, borderColor: `${colors.lilac}44`, borderRadius: radius.medium, padding: 14 },
  noticeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  prototypeNoticeTitle: { color: colors.lilac, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  localBadge: { color: colors.green, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  prototypeNoticeBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  lead: { flexDirection: 'row', alignItems: 'center', gap: 17, backgroundColor: colors.panel, padding: 18, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line },
  copy: { flex: 1 },
  eyebrow: { color: colors.gold, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  snapshotTitle: { color: colors.text, fontWeight: '700', fontSize: 17, lineHeight: 21, marginTop: 5 },
  body: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  confidence: { backgroundColor: `${colors.green}14`, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 8, marginTop: 10, alignSelf: 'flex-start' },
  confidenceText: { color: colors.green, fontSize: 7, fontWeight: '800', letterSpacing: 0.4 },
  focusRow: { flexDirection: 'row', gap: 10 },
  focusCard: { flex: 1, minHeight: 148, backgroundColor: colors.panelSoft, borderRadius: radius.large, padding: 14, borderWidth: 1, borderColor: colors.line },
  focusNumber: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  focusLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 9 },
  focusValue: { color: colors.blue, fontSize: 25, fontWeight: '800', marginTop: 5 },
  focusUnit: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  focusBody: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 5 },
  metrics: { backgroundColor: colors.panel, padding: 17, borderRadius: radius.large, gap: 14, borderWidth: 1, borderColor: colors.line },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  cardCaption: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
});
