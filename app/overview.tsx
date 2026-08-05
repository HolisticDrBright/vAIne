import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { MetricBar } from '@/components/MetricBar';
import { ScoreRing } from '@/components/ScoreRing';
import { appearanceMetrics } from '@/data/prototype';
import { syntheticSkinAnalysis } from '@/data/syntheticAnalysis';
import { colors, radius } from '@/theme';
import { useCaptureSession } from '@/state/CaptureSessionContext';

export default function OverviewScreen() {
  const { session } = useCaptureSession();
  const hasLocalCaptures = session.captures.length > 0;

  return (
    <Screen title="Your skin today" back>
      <View style={styles.prototypeNotice}>
        <Text style={styles.prototypeNoticeTitle}>{hasLocalCaptures ? `${session.captures.length} local photos captured` : 'Demonstration mode'}</Text>
        <Text style={styles.prototypeNoticeBody}>The results below are synthetic prototype content and were not produced from your photos. No image was uploaded or analyzed.</Text>
      </View>
      <View style={styles.lead}>
        <ScoreRing score={syntheticSkinAnalysis.appearanceScores.overall} />
        <View style={styles.copy}>
          <Text style={styles.title}>Your snapshot</Text>
          <Text style={styles.body}>{syntheticSkinAnalysis.summary}</Text>
          <View style={styles.confidence}><Text style={styles.confidenceText}>● HIGH CONFIDENCE</Text></View>
        </View>
      </View>
      <View style={styles.metrics}>
        <Text style={styles.cardTitle}>Key areas</Text>
        {appearanceMetrics.map((metric) => <MetricBar key={metric.label} {...metric} />)}
      </View>
      <View style={styles.limitRow}>
        <View style={styles.limitCard}><Text style={styles.limitTitle}>Confidence</Text><Text style={styles.limitBody}>Clear, even lighting supports this snapshot.</Text></View>
        <View style={styles.limitCard}><Text style={styles.limitTitle}>Limitations</Text><Text style={styles.limitBody}>{syntheticSkinAnalysis.limitations[0]}</Text></View>
      </View>
      <PrimaryButton label="Explore facial zones" onPress={() => router.push('/zones')} />
      <SecondaryButton label="See today’s routine" onPress={() => router.push('/routine')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { flexDirection: 'row', alignItems: 'center', gap: 17, backgroundColor: colors.panel, padding: 18, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line },
  copy: { flex: 1 },
  title: { color: colors.text, fontWeight: '700', fontSize: 17 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  confidence: { backgroundColor: 'rgba(125,215,176,.12)', borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 8, marginTop: 10, alignSelf: 'flex-start' },
  confidenceText: { color: colors.green, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  metrics: { backgroundColor: colors.panel, padding: 17, borderRadius: radius.large, gap: 14, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  limitRow: { flexDirection: 'row', gap: 10 },
  limitCard: { flex: 1, backgroundColor: colors.panelSoft, borderRadius: radius.medium, padding: 13 },
  limitTitle: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  limitBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  prototypeNotice: { backgroundColor: `${colors.lilac}12`, borderWidth: 1, borderColor: `${colors.lilac}44`, borderRadius: radius.medium, padding: 14 },
  prototypeNoticeTitle: { color: colors.lilac, fontSize: 12, fontWeight: '700' },
  prototypeNoticeBody: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
