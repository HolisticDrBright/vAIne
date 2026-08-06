import { Platform } from 'react-native';
import {
  normalizeDetectionPayload,
  type FaceDetectionInput,
  type FaceDetectionOutcome,
  type FaceDetector,
} from '../domain/zones/faceDetection';
import { detectFacesNative, isFaceDetectionAvailable } from '../../modules/vaine-face-detection';

/** Detection must never stall the capture flow; beyond this it is treated as unavailable. */
const DETECTION_TIMEOUT_MS = 10_000;

/**
 * On-device ML Kit adapter for the FaceDetector boundary. Every failure mode
 * (web, missing native module, native error, timeout) resolves to an explicit
 * `unavailable` outcome so callers fall back honestly instead of blocking or
 * guessing. The photo never leaves the device and no geometry is logged.
 */
export const mlkitFaceDetector: FaceDetector = {
  async detect(input: FaceDetectionInput): Promise<FaceDetectionOutcome> {
    if (Platform.OS === 'web') return { kind: 'unavailable', reason: 'platform_unsupported' };
    if (!isFaceDetectionAvailable()) return { kind: 'unavailable', reason: 'module_missing' };

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<FaceDetectionOutcome>((resolve) => {
      timeoutHandle = setTimeout(
        () => resolve({ kind: 'unavailable', reason: 'detector_error' }),
        DETECTION_TIMEOUT_MS,
      );
    });

    try {
      const detection = detectFacesNative(input.uri).then(normalizeDetectionPayload);
      return await Promise.race([detection, timeout]);
    } catch {
      return { kind: 'unavailable', reason: 'detector_error' };
    } finally {
      clearTimeout(timeoutHandle);
    }
  },
};
