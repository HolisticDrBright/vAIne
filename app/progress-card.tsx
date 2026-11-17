import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import { leadObservations } from '@/domain/analysis/leadObservations';
import { computeStreak, emptyPlanLog, toDateKey } from '@/domain/profile/planStreak';
import { assessFramingMatch, framingSnapshotFrom } from '@/domain/progress/framingMatch';
import { buildProgressCard } from '@/domain/progress/progressCard';
import { deleteLocalPhoto } from '@/services/localPhotoStorage';
import { useAnalysisSession } from '@/state/AnalysisSessionContext';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { useProgressBaseline } from '@/state/ProgressBaselineContext';
import { useBaselineFraming } from '@/state/useBaselineFraming';
import { colors, fonts, radius, shadows } from '@/theme';

/**
 * Shareable progress card. The card is rendered on this screen, turned into
 * one image only when the person taps share, handed to the system share
 * sheet, and the temporary file is deleted afterwards. Photos appear only
 * when "Include my photos" is on, and sample content is labelled as such.
 */
export default function ProgressCardScreen() {
  const { analysis } = useAnalysisSession();
  const { session } = useCaptureSession();
  const { baseline } = useProgressBaseline();
  const { profile } = useLocalProfile();
  const cardRef = useRef<View | null>(null);
  const [includeFace, setIncludeFace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentFront = session.captures.find((capture) => capture.angle === 'front');
  const baselineFront = baseline?.captures.find((capture) => capture.angle === 'front');
  const comparing = Boolean(baselineFront && currentFront && baseline?.sourceSessionId !== session.id && session.consent?.progressTracking);
  const baselineFraming = useBaselineFraming(comparing ? baselineFront : undefined);
  const framing = comparing && currentFront && baselineFraming.status === 'ready'
    ? assessFramingMatch(baselineFraming.snapshot, framingSnapshotFrom(currentFront.faceDetection, { width: currentFront.width, height: currentFront.height }))
    : null;

  const todayIso = new Date().toISOString();
  const streak = computeStreak(profile.planLog ?? emptyPlanLog, toDateKey(new Date()));
  const result = analysis.result;
  const card = useMemo(() => buildProgressCard({
    todayIso,
    sinceIso: baseline?.savedAtIso ?? profile.lastCheckIn?.completedAtIso ?? null,
    streak,
    observations: result ? leadObservations(result) : [],
    framing,
    live: analysis.record?.mode === 'live',
    includeFace,
    photos: comparing && baselineFront && currentFront ? { baselineUri: baselineFront.uri, currentUri: currentFront.uri } : null,
  }), [analysis.record?.mode, baseline?.savedAtIso, baselineFront, comparing, currentFront, framing, includeFace, profile.lastCheckIn?.completedAtIso, result, streak, todayIso]);

  const canIncludePhotos = Boolean(comparing && baselineFront && currentFront);

  const share = async () => {
    setBusy(true);
    setMessage(null);
    let uri: string | null = null;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setMessage('Sharing is available in the iOS and Android app.');
        return;
      }
      uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your progress card', UTI: 'public.png' });
    } catch {
      setMessage('The card could not be shared. Nothing was sent.');
    } finally {
      if (uri) await deleteLocalPhoto(uri);
      setBusy(false);
    }
  };

  return (
    <Screen title="Progress card" back>
      <Text style={styles.eyebrow}>SHARE CONSISTENCY, NOT A SCORE</Text>
      <Text style={styles.title}>Your progress card</Text>
      <Text style={styles.subtitle}>A picture of showing up: your streak, the period, and what you are supporting. No score, no rating. Your photos are left out unless you choose to include them.</Text>

      <View ref={cardRef} collapsable={false} style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardEyebrow}>{card.eyebrow}</Text>
          <Text style={styles.cardBrand}>vAIne</Text>
        </View>
        <Text style={styles.cardHeadline}>{card.headline}</Text>
        <Text style={styles.cardPeriod}>{card.periodLabel}</Text>

        {card.photos ? (
          <View style={styles.photoRow}>
            <View style={styles.photoCell}>
              <Image accessibilityLabel="Baseline photo" source={{ uri: card.photos.baselineUri }} style={styles.photo} />
              <Text style={styles.photoLabel}>THEN</Text>
            </View>
            <View style={styles.photoCell}>
              <Image accessibilityLabel="Current photo" source={{ uri: card.photos.currentUri }} style={styles.photo} />
              <Text style={styles.photoLabel}>NOW</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statRow}>
          {card.stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        {card.focus.length ? (
          <View style={styles.focusRow}>
            <Text style={styles.focusLead}>Supporting</Text>
            {card.focus.map((item) => <Text key={item} style={styles.focusPill}>{item}</Text>)}
          </View>
        ) : null}
        {card.framingLabel ? <Text style={styles.framing}>✓ {card.framingLabel}</Text> : null}
        <Text style={styles.cardFooter}>{card.footer}</Text>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: includeFace, disabled: !canIncludePhotos }}
        disabled={!canIncludePhotos}
        onPress={() => setIncludeFace((current) => !current)}
        style={[styles.toggle, includeFace && styles.toggleOn, !canIncludePhotos && styles.toggleDisabled]}
      >
        <View style={[styles.toggleBox, includeFace && styles.toggleBoxOn]}>{includeFace ? <Text style={styles.toggleTick}>✓</Text> : null}</View>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleLabel}>Include my photos</Text>
          <Text style={styles.toggleHint}>
            {canIncludePhotos
              ? 'Adds your baseline and current front photos to the card. Off by default.'
              : 'Available once a follow-up check-in with progress tracking is compared with your baseline.'}
          </Text>
        </View>
      </Pressable>

      <InfoCard
        title="What sharing does"
        body="Sharing turns this card into one image and opens your phone’s share sheet. vAIne does not upload it or keep a copy; the temporary file is deleted after the share sheet closes."
        tone="green"
      />
      {message ? <InfoCard title="Share" body={message} tone="lilac" /> : null}

      <PrimaryButton label={busy ? 'Preparing…' : 'Share this card'} onPress={() => { void share(); }} disabled={busy} />
      <SecondaryButton label="Back to progress" onPress={() => router.back()} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  card: { backgroundColor: colors.cream, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 10, ...shadows.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: colors.gold, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  cardBrand: { color: colors.oliveDark, fontFamily: fonts.display, fontSize: 16 },
  cardHeadline: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 33 },
  cardPeriod: { color: colors.muted, fontSize: 11, marginTop: -4 },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  photoCell: { flex: 1, gap: 4 },
  photo: { width: '100%', aspectRatio: 0.8, borderRadius: radius.medium, backgroundColor: colors.panelSoft },
  photoLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  stat: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', letterSpacing: 0.8, marginTop: 2 },
  focusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  focusLead: { color: colors.muted, fontSize: 11 },
  focusPill: { color: colors.oliveDark, fontSize: 10, fontWeight: '700', borderWidth: 1, borderColor: `${colors.blue}55`, backgroundColor: `${colors.blue}12`, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  framing: { color: colors.green, fontSize: 10, fontWeight: '700' },
  cardFooter: { color: colors.muted, fontSize: 9, letterSpacing: 0.3, marginTop: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 12, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  toggleOn: { borderColor: colors.blue, backgroundColor: `${colors.blue}12` },
  toggleDisabled: { opacity: 0.55 },
  toggleBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft },
  toggleBoxOn: { borderColor: colors.blue, backgroundColor: colors.blue },
  toggleTick: { color: colors.white, fontSize: 13, fontWeight: '800', lineHeight: 15 },
  toggleCopy: { flex: 1 },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  toggleHint: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
});
