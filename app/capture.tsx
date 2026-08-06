import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import {
  areReadinessChecksComplete,
  assessCaptureMetadata,
  EMPTY_READINESS_STATE,
  READINESS_CHECKS,
  REQUIRED_CAPTURE_ANGLES,
  type ReadinessCheck,
  type ReadinessState,
} from '@/domain/capture/captureQuality';
import {
  assessFrontCaptureDetection,
  assessProfileCaptureDetection,
} from '@/domain/capture/captureDetectionPolicy';
import { summarizeCaptureAlignment } from '@/domain/capture/adaptiveCapture';
import { DETAIL_GROUP_GUIDANCE, type DetailCaptureGroup } from '@/domain/capture/zoneCropQuality';
import type { FaceDetectionOutcome } from '@/domain/zones/faceDetection';
import type { SkinCaptureAngle } from '@/domain/analysis/observationTaxonomy';
import { deleteLocalPhoto } from '@/services/localPhotoStorage';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { useFaceDetector } from '@/state/FaceDetectorContext';
import { colors, fonts, radius, shadows } from '@/theme';

const angleCopy = {
  front: { title: 'Face forward', instruction: 'Center your face and look directly toward the camera.' },
  left_profile: { title: 'Turn slightly left', instruction: 'Keep both shoulders level and turn your face gently to the left.' },
  right_profile: { title: 'Turn slightly right', instruction: 'Keep both shoulders level and turn your face gently to the right.' },
} as const;

const detailGroupTitles: Record<DetailCaptureGroup, string> = {
  upper_face: 'Upper-face close-up',
  center_face: 'Center-face close-up',
  lower_face: 'Lower-face close-up',
};

const readinessCopy: Record<ReadinessCheck, string> = {
  even_lighting: 'Even light, no sharp shadows',
  face_centered: 'Face inside the oval guide',
  lens_clean: 'Camera lens is clean',
  no_filter_or_heavy_makeup: 'No beauty filter or heavy makeup',
};

const metadataErrorCopy = {
  missing_image: 'The camera did not return an image. Please try again.',
  resolution_too_low: 'This image is too small for a useful comparison. Try the device camera again.',
  invalid_dimensions: 'The image dimensions could not be read. Please retake it.',
} as const;

type PendingReview =
  | { kind: 'angle'; angle: SkinCaptureAngle; photo: CameraCapturedPicture; detection: FaceDetectionOutcome | null }
  | { kind: 'detail'; group: DetailCaptureGroup; photo: CameraCapturedPicture };

function describeDetectionForReview(detection: FaceDetectionOutcome | null): string {
  if (detection?.kind === 'detected') {
    return 'Face found on this device. Facial-zone views can align to your photo.';
  }
  return 'Face alignment is not available for this photo, so zone views will use the clearly labeled fixed guide.';
}

export default function CaptureScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [screenFocused, setScreenFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessState>(EMPTY_READINESS_STATE);
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const faceDetector = useFaceDetector();
  const {
    session,
    acceptCapture,
    acceptDetailCapture,
    markReadyForResults,
    completeSession,
    setSessionError,
    clearSession,
  } = useCaptureSession();

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));

  const capturedAngles = new Set(session.captures.map((capture) => capture.angle));
  const currentAngle = REQUIRED_CAPTURE_ANGLES.find((angle) => !capturedAngles.has(angle));
  const frontCapture = session.captures.find((capture) => capture.angle === 'front');
  const alignmentSummary = useMemo(() => summarizeCaptureAlignment(frontCapture), [frontCapture]);

  const detailRequests = alignmentSummary.plan?.kind === 'detail_requests'
    ? alignmentSummary.plan.requests
    : [];
  const capturedDetailGroups = new Set(session.detailCaptures.map((capture) => capture.group));
  const nextDetailGroup = detailRequests.find((request) => !capturedDetailGroups.has(request.group));
  const inDetailStage = detailMode && !currentAngle && Boolean(nextDetailGroup);

  const readyToShoot = cameraReady && !busy && (inDetailStage || areReadinessChecksComplete(readiness));

  const toggleReadiness = (check: ReadinessCheck) => {
    setReadiness((current) => ({ ...current, [check]: !current[check] }));
  };

  const discardPending = async () => {
    if (pending) await deleteLocalPhoto(pending.photo.uri);
    setPending(null);
    setLocalError(null);
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !readyToShoot) return;
    const target: { kind: 'angle'; angle: SkinCaptureAngle } | { kind: 'detail'; group: DetailCaptureGroup } | null =
      currentAngle
        ? { kind: 'angle', angle: currentAngle }
        : inDetailStage && nextDetailGroup
          ? { kind: 'detail', group: nextDetailGroup.group }
          : null;
    if (!target) return;
    setBusy(true);
    setLocalError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      const reasons = assessCaptureMetadata(photo);
      if (reasons.length) {
        await deleteLocalPhoto(photo.uri);
        const message = reasons.map((reason) => metadataErrorCopy[reason]).join(' ');
        setLocalError(message);
        setSessionError(message);
        return;
      }

      if (target.kind === 'detail') {
        setPending({ kind: 'detail', group: target.group, photo });
        return;
      }

      // On-device only: face bounds and landmarks for alignment. No identity
      // features run, and neither the photo nor the geometry leaves the phone.
      const detection = await faceDetector.detect({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });
      const decision = target.angle === 'front'
        ? assessFrontCaptureDetection(detection, { width: photo.width, height: photo.height })
        : assessProfileCaptureDetection(detection);

      if (decision.kind === 'retake') {
        await deleteLocalPhoto(photo.uri);
        setLocalError(decision.reasons.join(' '));
        return;
      }

      setPending({ kind: 'angle', angle: target.angle, photo, detection });
    } catch {
      const message = 'The camera could not complete this capture. No photo was added; please try again.';
      setLocalError(message);
      setSessionError(message);
    } finally {
      setBusy(false);
    }
  };

  const usePendingPhoto = async () => {
    if (!pending) return;
    if (pending.kind === 'angle') {
      await acceptCapture({
        angle: pending.angle,
        uri: pending.photo.uri,
        width: pending.photo.width,
        height: pending.photo.height,
        capturedAtIso: new Date().toISOString(),
        faceDetection: pending.detection ?? undefined,
      });
      setReadiness(EMPTY_READINESS_STATE);
      if (session.captures.length + 1 === REQUIRED_CAPTURE_ANGLES.length) markReadyForResults();
    } else {
      await acceptDetailCapture({
        group: pending.group,
        uri: pending.photo.uri,
        width: pending.photo.width,
        height: pending.photo.height,
        capturedAtIso: new Date().toISOString(),
      });
    }
    setPending(null);
    setLocalError(null);
  };

  const cancelCheckIn = async () => {
    await discardPending();
    await clearSession();
    router.replace('/');
  };

  const continueToResults = () => {
    completeSession();
    router.replace('/processing');
  };

  if (!session.consent?.analysis || !session.consent.temporaryDeviceStorage) {
    return (
      <Screen title="Capture guide" back>
        <Text style={styles.title}>Consent comes first</Text>
        <Text style={styles.subtitle}>Start from the privacy choices before granting camera access.</Text>
        <PrimaryButton label="Review privacy choices" onPress={() => router.replace('/consent')} />
        <LegalNote />
      </Screen>
    );
  }

  if (!permission) {
    return <Screen title="Camera guide" back><Text style={styles.subtitle}>Checking camera permission…</Text></Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen title="Camera permission" back>
        <Text style={styles.title}>Use your camera only when you choose</Text>
        <Text style={styles.subtitle}>vAIne needs camera access for this local check-in. It does not request microphone access or upload the photos.</Text>
        <InfoCard title="Permission boundary" body="Your phone controls this permission. Denying it does not affect any other part of the prototype." tone="green" />
        {permission.canAskAgain
          ? <PrimaryButton label="Allow camera access" onPress={() => { void requestPermission(); }} />
          : <PrimaryButton label="Open device settings" onPress={() => { void Linking.openSettings(); }} />}
        <SecondaryButton label="Cancel check-in" onPress={() => { void cancelCheckIn(); }} />
        <LegalNote />
      </Screen>
    );
  }

  if (pending) {
    const title = pending.kind === 'angle'
      ? `Use this ${angleCopy[pending.angle].title.toLowerCase()} photo?`
      : `Use this ${detailGroupTitles[pending.group].toLowerCase()}?`;
    return (
      <Screen title="Review photo" back>
        <Text style={styles.step}>
          {pending.kind === 'angle'
            ? `${session.captures.length + 1} OF ${REQUIRED_CAPTURE_ANGLES.length}`
            : 'OPTIONAL CLOSE-UP'}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.previewFrame}><Image source={{ uri: pending.photo.uri }} style={styles.previewImage} /></View>
        {pending.kind === 'angle' ? (
          <InfoCard
            title={pending.angle === 'front' ? 'On-device face check' : 'Photo check'}
            body={describeDetectionForReview(pending.detection)}
            tone={pending.detection?.kind === 'detected' ? 'green' : 'lilac'}
          />
        ) : (
          <Text style={styles.subtitle}>Check that the area is sharp, evenly lit, and fills the frame.</Text>
        )}
        <PrimaryButton label="Use this photo" onPress={() => { void usePendingPhoto(); }} />
        <SecondaryButton label="Retake" onPress={() => { void discardPending(); }} />
        <LegalNote />
      </Screen>
    );
  }

  if (!currentAngle && !inDetailStage) {
    const showRetakeSuggestion = alignmentSummary.plan?.kind === 'front_retake';
    return (
      <Screen title="Capture complete" back>
        <Text style={styles.step}>3 OF 3 LOCAL PHOTOS</Text>
        <Text style={styles.title}>Your check-in is ready</Text>
        <Text style={styles.subtitle}>All three temporary captures are held on this device. This beta will show synthetic demonstration results—it will not analyze your face.</Text>
        <View style={styles.thumbnailRow}>
          {REQUIRED_CAPTURE_ANGLES.map((angle) => {
            const capture = session.captures.find((item) => item.angle === angle);
            return capture ? <Image key={angle} source={{ uri: capture.uri }} style={styles.thumbnail} /> : null;
          })}
        </View>

        {session.detailCaptures.length ? (
          <View style={styles.thumbnailRow}>
            {session.detailCaptures.map((capture) => (
              <Image key={capture.group} source={{ uri: capture.uri }} style={styles.thumbnail} />
            ))}
          </View>
        ) : null}

        {showRetakeSuggestion ? (
          <InfoCard
            title="Optional: retake the front photo"
            body="Your face could not be located reliably, so zone views will use the labeled fixed guide. You can continue, or retake the front photo in even light for individualized alignment."
            tone="gold"
          />
        ) : null}

        {detailRequests.length ? (
          <>
            <InfoCard
              title={`Optional: ${detailRequests.length} close-up ${detailRequests.length === 1 ? 'photo' : 'photos'} suggested`}
              body={`${detailRequests[0].reason} Close-ups stay on this device like every other capture.`}
              tone="lilac"
            />
            {nextDetailGroup ? (
              <PrimaryButton
                label={`Add close-ups (${capturedDetailGroups.size} of ${detailRequests.length} done)`}
                onPress={() => setDetailMode(true)}
              />
            ) : (
              <InfoCard title="Close-ups captured" body="All suggested close-up areas are covered." tone="green" />
            )}
          </>
        ) : null}

        <InfoCard title="No upload occurred" body="The photos remain temporary local files. You can delete them on the next screen or from Privacy controls." tone="green" />
        <PrimaryButton label="View demonstration results" onPress={continueToResults} />
        <SecondaryButton label="Delete and cancel" onPress={() => { void cancelCheckIn(); }} />
        <LegalNote />
      </Screen>
    );
  }

  const stageTitle = currentAngle ? angleCopy[currentAngle].title : detailGroupTitles[nextDetailGroup!.group];
  const stageInstruction = currentAngle
    ? `${angleCopy[currentAngle].instruction} Confirm the visual checks before capture.`
    : nextDetailGroup!.guidance;

  return (
      <Screen title={currentAngle ? 'Capture guide' : 'Close-up guide'} back>
      <Text style={styles.step}>
        {currentAngle
          ? `${session.captures.length + 1} OF ${REQUIRED_CAPTURE_ANGLES.length}`
          : `OPTIONAL CLOSE-UP · ${capturedDetailGroups.size + 1} OF ${detailRequests.length}`}
      </Text>
      <Text style={styles.title}>{stageTitle}</Text>
      <Text style={styles.subtitle}>{stageInstruction}</Text>

      <View style={styles.cameraStage}>
        {screenFocused ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            mode="picture"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => setLocalError('The camera preview could not start on this device.')}
          />
        ) : null}
        <View pointerEvents="none" style={styles.faceGuide} />
        <View pointerEvents="none" style={styles.cameraHint}>
          <Text style={styles.cameraHintTitle}>{cameraReady ? 'Camera ready' : 'Starting camera…'}</Text>
          <Text style={styles.cameraHintBody}>
            {currentAngle ? 'Keep your face fully inside the oval.' : 'Move closer so the area fills the oval.'}
          </Text>
        </View>
      </View>

      {currentAngle ? (
        <View style={styles.readinessList}>
          {READINESS_CHECKS.map((check) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: readiness[check] }}
              key={check}
              onPress={() => toggleReadiness(check)}
              style={[styles.readinessRow, readiness[check] && styles.readinessRowChecked]}
            >
              <View style={[styles.smallCheckbox, readiness[check] && styles.smallCheckboxChecked]}>
                <Text style={styles.smallCheckboxText}>{readiness[check] ? '✓' : ''}</Text>
              </View>
              <Text style={styles.readinessText}>{readinessCopy[check]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {currentAngle === 'front' ? (
        <InfoCard
          title="On-device face check"
          body="Face detection runs entirely on this phone to check framing and align facial zones. It does not identify you, and neither the photo nor the face geometry is uploaded or stored beyond this check-in."
          tone="green"
        />
      ) : null}

      {localError ? <InfoCard title="Retake needed" body={localError} tone="gold" /> : null}
      <PrimaryButton
        label={busy
          ? 'Checking photo…'
          : currentAngle
            ? `Capture ${session.captures.length + 1} of ${REQUIRED_CAPTURE_ANGLES.length}`
            : 'Capture close-up'}
        onPress={() => { void takePhoto(); }}
        disabled={!readyToShoot}
      />
      {inDetailStage ? (
        <SecondaryButton label="Skip close-ups and continue" onPress={() => setDetailMode(false)} />
      ) : null}
      <SecondaryButton label="Delete and cancel check-in" onPress={() => { void cancelCheckIn(); }} />
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: colors.lilac, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textAlign: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, fontWeight: '400', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cameraStage: { height: 410, backgroundColor: '#D9D8CF', borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadows.card },
  faceGuide: { position: 'absolute', width: 230, height: 310, borderRadius: 116, borderWidth: 2, borderColor: colors.cream, alignSelf: 'center', top: 30 },
  cameraHint: { position: 'absolute', bottom: 14, left: 14, right: 14, padding: 11, borderRadius: radius.small, backgroundColor: 'rgba(46,57,41,.78)' },
  cameraHintTitle: { color: colors.white, fontSize: 11, fontWeight: '700' },
  cameraHintBody: { color: colors.cream, fontSize: 11, marginTop: 3 },
  readinessList: { gap: 8 },
  readinessRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.small, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 12 },
  readinessRowChecked: { borderColor: `${colors.green}66`, backgroundColor: `${colors.green}10` },
  smallCheckbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  smallCheckboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  smallCheckboxText: { color: colors.ink, fontWeight: '800' },
  readinessText: { color: colors.text, fontSize: 12, flex: 1 },
  previewFrame: { height: 430, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, ...shadows.card },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbnailRow: { flexDirection: 'row', gap: 8 },
  thumbnail: { flex: 1, height: 190, borderRadius: radius.medium, backgroundColor: colors.panel },
});
