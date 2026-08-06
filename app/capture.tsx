import { useCallback, useRef, useState } from 'react';
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
import { deleteLocalPhoto } from '@/services/localPhotoStorage';
import { useCaptureSession } from '@/state/CaptureSessionContext';
import { colors, fonts, radius, shadows } from '@/theme';

const angleCopy = {
  front: { title: 'Face forward', instruction: 'Center your face and look directly toward the camera.' },
  left_profile: { title: 'Turn slightly left', instruction: 'Keep both shoulders level and turn your face gently to the left.' },
  right_profile: { title: 'Turn slightly right', instruction: 'Keep both shoulders level and turn your face gently to the right.' },
} as const;

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

export default function CaptureScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [screenFocused, setScreenFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessState>(EMPTY_READINESS_STATE);
  const [pendingPhoto, setPendingPhoto] = useState<CameraCapturedPicture | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const {
    session,
    acceptCapture,
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
  const readyToShoot = cameraReady && areReadinessChecksComplete(readiness) && !busy;

  const toggleReadiness = (check: ReadinessCheck) => {
    setReadiness((current) => ({ ...current, [check]: !current[check] }));
  };

  const discardPendingPhoto = async () => {
    if (pendingPhoto) await deleteLocalPhoto(pendingPhoto.uri);
    setPendingPhoto(null);
    setLocalError(null);
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !currentAngle || !readyToShoot) return;
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
      setPendingPhoto(photo);
    } catch {
      const message = 'The camera could not complete this capture. No photo was added; please try again.';
      setLocalError(message);
      setSessionError(message);
    } finally {
      setBusy(false);
    }
  };

  const usePendingPhoto = async () => {
    if (!pendingPhoto || !currentAngle) return;
    await acceptCapture({
      angle: currentAngle,
      uri: pendingPhoto.uri,
      width: pendingPhoto.width,
      height: pendingPhoto.height,
      capturedAtIso: new Date().toISOString(),
    });
    setPendingPhoto(null);
    setReadiness(EMPTY_READINESS_STATE);
    setLocalError(null);

    if (session.captures.length + 1 === REQUIRED_CAPTURE_ANGLES.length) markReadyForResults();
  };

  const cancelCheckIn = async () => {
    await discardPendingPhoto();
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

  if (!currentAngle && !pendingPhoto) {
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
        <InfoCard title="No upload occurred" body="The photos remain temporary local files. You can delete them on the next screen or from Privacy controls." tone="green" />
        <PrimaryButton label="View demonstration results" onPress={continueToResults} />
        <SecondaryButton label="Delete and cancel" onPress={() => { void cancelCheckIn(); }} />
        <LegalNote />
      </Screen>
    );
  }

  if (pendingPhoto && currentAngle) {
    return (
      <Screen title="Review photo" back>
        <Text style={styles.step}>{session.captures.length + 1} OF {REQUIRED_CAPTURE_ANGLES.length}</Text>
        <Text style={styles.title}>Use this {angleCopy[currentAngle].title.toLowerCase()} photo?</Text>
        <View style={styles.previewFrame}><Image source={{ uri: pendingPhoto.uri }} style={styles.previewImage} /></View>
        <Text style={styles.subtitle}>Check that the face is clear, evenly lit, and positioned as requested. Automated blur and lighting analysis are not enabled yet.</Text>
        <PrimaryButton label="Use this photo" onPress={() => { void usePendingPhoto(); }} />
        <SecondaryButton label="Retake" onPress={() => { void discardPendingPhoto(); }} />
        <LegalNote />
      </Screen>
    );
  }

  if (!currentAngle) return null;

  return (
      <Screen title="Capture guide" back>
      <Text style={styles.step}>{session.captures.length + 1} OF {REQUIRED_CAPTURE_ANGLES.length}</Text>
      <Text style={styles.title}>{angleCopy[currentAngle].title}</Text>
      <Text style={styles.subtitle}>{angleCopy[currentAngle].instruction} Confirm the visual checks before capture.</Text>

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
          <Text style={styles.cameraHintBody}>Keep your face fully inside the oval.</Text>
        </View>
      </View>

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

      {localError ? <InfoCard title="Retake needed" body={localError} tone="gold" /> : null}
      <PrimaryButton label={busy ? 'Capturing…' : `Capture ${session.captures.length + 1} of ${REQUIRED_CAPTURE_ANGLES.length}`} onPress={() => { void takePhoto(); }} disabled={!readyToShoot} />
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
