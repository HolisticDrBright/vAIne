import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { ScoreRing } from '@/components/ScoreRing';
import { ZoneZoomIllustration } from '@/components/ZoneZoomIllustration';
import { isSkinZone, zonePresentation } from '@/data/zonePresentation';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import { summarizeCaptureAlignment } from '@/domain/capture/adaptiveCapture';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { colors, fonts, radius, shadows } from '@/theme';

function resolveZone(value: string | string[] | undefined): SkinZone {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isSkinZone(candidate) ? candidate : 'under_eyes';
}

export default function ZoneDetailScreen() {
  const params = useLocalSearchParams<{ zone?: string | string[] }>();
  const { analysis } = useAnalysisSession();
  const { session } = useCaptureSession();
  const zone = resolveZone(params.zone);
  const presentation = zonePresentation[zone];
  const observation = analysis.result?.facialZones[zone];
  const frontPhoto = session.captures.find((capture) => capture.angle === 'front');
  const alignment = useMemo(() => summarizeCaptureAlignment(frontPhoto).alignment, [frontPhoto]);
  const zoneRect = alignment.mode === 'landmarks' ? alignment.zones[zone] : null;

  if (analysis.status !== 'ready' || !analysis.result || !observation) {
    return (
      <Screen title="Zone detail" back>
        <Text style={styles.title}>This sample zone is not ready</Text>
        <PrimaryButton label="Return to zone explorer" onPress={() => router.replace('/zones')} />
      </Screen>
    );
  }

  return (
    <Screen title={presentation.label} back>
      <Text style={styles.eyebrow}>
        {frontPhoto
          ? zoneRect ? 'YOUR LOCAL PHOTO · ALIGNED ON-DEVICE' : 'YOUR LOCAL PHOTO · FIXED GUIDE CROP'
          : 'ZOOMED SAMPLE VIEW'}
      </Text>
      <Text style={styles.heading}>{presentation.focus}</Text>
      <Text style={styles.subtitle}>{frontPhoto
        ? `A magnified crop of the ${presentation.label.toLowerCase()} area from your front check-in photo.`
        : 'A closer presentation of the selected fictional facial zone.'}</Text>

      <ZoneZoomIllustration
        zone={zone}
        photoUri={frontPhoto?.uri}
        photoSize={frontPhoto ? { width: frontPhoto.width, height: frontPhoto.height } : undefined}
        zoneRect={zoneRect}
      />

      {frontPhoto ? (
        <InfoCard
          title="Photo crop only"
          body={zoneRect
            ? 'This crop pans and zooms your original photo using on-device face landmarks. No skin analysis occurred, nothing identifies you, and no upload happened.'
            : 'This crop uses a fixed position calibrated to the capture guide—face alignment was not available for this photo. No photo analysis or upload occurred.'}
          tone="green"
        />
      ) : null}

      <View style={styles.scoreCard}>
        <ScoreRing score={observation.appearanceScore} compact />
        <View style={styles.scoreCopy}>
          <Text style={styles.cardEyebrow}>{frontPhoto ? 'FICTIONAL SAMPLE INDEX · NOT FROM PHOTO' : 'ZONE APPEARANCE INDEX'}</Text>
          <Text style={styles.title}>{presentation.label}</Text>
          <Text style={styles.body}>{observation.observation}</Text>
        </View>
      </View>

      <View style={styles.signals}>
        <Text style={styles.signalHeading}>What this sample view considers</Text>
        {presentation.signals.map((signal, index) => (
          <View key={signal} style={styles.signalRow}>
            <Text style={styles.signalNumber}>0{index + 1}</Text>
            <Text style={styles.signalText}>{signal}</Text>
          </View>
        ))}
      </View>

      <InfoCard title="Close-up, same boundary" body="The photo stays local. Demonstration text does not reveal health status or establish a diagnosis." tone="lilac" />
      <PrimaryButton label="Build today’s routine" onPress={() => router.push('/routine-intake')} />
      <SecondaryButton label="Choose another zone" onPress={() => router.back()} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -7 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.panel, padding: 16, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, ...shadows.card },
  scoreCopy: { flex: 1 },
  cardEyebrow: { color: colors.blue, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 18, fontWeight: '400', marginTop: 4 },
  body: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  signals: { backgroundColor: colors.panelSoft, borderRadius: radius.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  signalHeading: { color: colors.text, fontSize: 13, fontWeight: '700', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  signalRow: { minHeight: 48, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  signalNumber: { color: colors.gold, fontSize: 9, fontWeight: '800' },
  signalText: { color: colors.muted, fontSize: 12 },
});
