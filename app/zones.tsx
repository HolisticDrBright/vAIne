import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FacialZoneMap } from '@/components/FacialZoneMap';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { ScoreRing } from '@/components/ScoreRing';
import { zoneOrder, zonePresentation } from '@/data/zonePresentation';
import type { SkinZone } from '@/domain/analysis/observationTaxonomy';
import { summarizeCaptureAlignment } from '@/domain/capture/adaptiveCapture';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { colors, fonts, radius, shadows } from '@/theme';

export default function ZonesScreen() {
  const { analysis } = useAnalysisSession();
  const { session } = useCaptureSession();
  const [selectedZone, setSelectedZone] = useState<SkinZone>('under_eyes');

  if (analysis.status !== 'ready' || !analysis.result) {
    return (
      <Screen title="Zone explorer" back>
        <Text style={styles.title}>No validated result is ready</Text>
        <PrimaryButton label="Start a check-in" onPress={() => router.replace('/consent')} />
      </Screen>
    );
  }

  const live = analysis.record?.mode === 'live';
  const presentation = zonePresentation[selectedZone];
  const observation = analysis.result.facialZones[selectedZone];
  const frontPhoto = session.captures.find((capture) => capture.angle === 'front');
  const alignment = useMemo(() => summarizeCaptureAlignment(frontPhoto).alignment, [frontPhoto]);
  const alignedZones = alignment.mode === 'landmarks' ? alignment.zones : null;

  return (
    <Screen title="Facial-zone view" back>
      <Text style={styles.eyebrow}>VISIBLE APPEARANCE ONLY</Text>
      <Text style={styles.heading}>{frontPhoto || live ? 'Explore your check-in by zone' : 'Explore the sample by zone'}</Text>
      <Text style={styles.subtitle}>{frontPhoto
        ? alignedZones
          ? 'Tap your front photo or a label. Markers are aligned to your face by on-device detection.'
          : 'Tap your front photo or a label. The overlays use the clearly labeled fixed positioning guide.'
        : live ? 'Tap the face or a label to move through the observation areas.' : 'Tap the face or a label to move through the fictional observation areas.'}</Text>

      <View style={styles.tabs}>
        {zoneOrder.map((zone) => {
          const selected = zone === selectedZone;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={zone}
              onPress={() => setSelectedZone(zone)}
              style={[styles.tab, selected && styles.tabActive]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{zonePresentation[zone].shortLabel}</Text>
            </Pressable>
          );
        })}
      </View>

      <FacialZoneMap
        selectedZone={selectedZone}
        onSelectZone={setSelectedZone}
        photoUri={frontPhoto?.uri}
        photoSize={frontPhoto ? { width: frontPhoto.width, height: frontPhoto.height } : undefined}
        alignedZones={alignedZones}
      />

      <View style={styles.summary}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryEyebrow}>{frontPhoto ? 'FICTIONAL SAMPLE · NOT CALCULATED FROM PHOTO' : presentation.focus.toUpperCase()}</Text>
          <Text style={styles.title}>{presentation.label}</Text>
          <Text style={styles.body}>{observation?.observation ?? (live ? 'No observation was recorded for this zone.' : 'No sample observation is available for this zone.')}</Text>
          <Text style={styles.confidence}>Presentation confidence {Math.round((observation?.confidence ?? 0) * 100)}%</Text>
        </View>
        <ScoreRing score={observation?.appearanceScore ?? 0} compact />
      </View>

      <InfoCard
        title={frontPhoto ? 'Your photo, demonstration observations' : 'How to read this'}
        body={frontPhoto
          ? alignedZones
            ? live
              ? 'The background is your local front capture with markers aligned to your face by on-device detection. Scores and observations describe visible appearance in your photos, not underlying health.'
              : 'The background is your local front capture with markers aligned to your face by on-device detection. The scores and observations remain fictional demonstration data, not an analysis of your skin.'
            : live
              ? 'The background is your local front capture. Marker placement uses a fixed guide—face alignment was not available for this photo. Scores and observations describe visible appearance, not underlying health.'
              : 'The background is your local front capture. Marker placement uses a fixed guide—face alignment was not available for this photo—and the score and observation remain fictional demonstration data.'
          : live
            ? 'Zone markers describe what is visible in your photos—not underlying health, identity, age, or a diagnosis.'
            : 'Zone markers describe what is visible in fictional sample data—not underlying health, identity, age, or a diagnosis.'}
        tone="lilac"
      />
      <PrimaryButton
        label={`Zoom into ${presentation.label}`}
        onPress={() => router.push({ pathname: '/zone-detail', params: { zone: selectedZone } })}
      />
      <SecondaryButton label="Build today’s routine" onPress={() => router.push('/routine-intake')} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33, fontWeight: '400', marginTop: -5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -7 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tab: { minHeight: 34, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  tabActive: { borderColor: colors.gold, backgroundColor: `${colors.gold}1C` },
  tabText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.panel, padding: 16, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, gap: 10, ...shadows.card },
  summaryCopy: { flex: 1 },
  summaryEyebrow: { color: colors.lilac, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: colors.text, fontFamily: fonts.display, fontWeight: '400', fontSize: 19, marginTop: 5 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  confidence: { color: colors.green, fontSize: 9, fontWeight: '700', marginTop: 8 },
});
