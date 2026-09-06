import type { DetectedFaceGeometry, NormalizedRect, Size } from './zoneAlignment';

/**
 * Provider-independent face-detection boundary.
 *
 * Detection runs fully on-device and is used only for face bounds, landmarks,
 * capture alignment, and crop calculations. No identity recognition, identity
 * matching, embeddings, tracking, demographic inference, or emotion
 * classification is requested, computed, or stored, and geometry never leaves
 * the device or gets persisted. When detection cannot be trusted, the outcome
 * says so explicitly — falsely aligned markers are never a fallback.
 */

export type FaceDetectionOutcome =
  | { kind: 'detected'; geometry: DetectedFaceGeometry }
  | { kind: 'no_face' }
  | { kind: 'multiple_faces'; count: number }
  | {
      /** A face was found but its landmarks are unusable for alignment. */
      kind: 'landmarks_missing';
      faceBounds: NormalizedRect | null;
    }
  | {
      kind: 'unavailable';
      reason: 'platform_unsupported' | 'module_missing' | 'detector_error' | 'coordinate_mismatch';
    };

export interface FaceDetectionInput {
  /** Device-local file URI of the ORIGINAL captured photo. */
  uri: string;
  width: number;
  height: number;
}

export interface FaceDetector {
  detect(input: FaceDetectionInput): Promise<FaceDetectionOutcome>;
}

/** Raw wire shape produced by the native module, in detector pixel space. */
export interface RawFacePoint {
  x: number;
  y: number;
}

export interface RawDetectedFace {
  frame: { x: number; y: number; width: number; height: number };
  landmarks: {
    leftEye?: RawFacePoint | null;
    rightEye?: RawFacePoint | null;
    noseBase?: RawFacePoint | null;
    mouthLeft?: RawFacePoint | null;
    mouthRight?: RawFacePoint | null;
    mouthBottom?: RawFacePoint | null;
  };
}

export interface RawDetectionPayload {
  /**
   * Dimensions of the orientation-normalized image the detector measured in.
   * Coordinates are normalized against THESE, never against caller-supplied
   * dimensions, so EXIF handling cannot silently skew placement.
   */
  imageWidth: number;
  imageHeight: number;
  faces: readonly RawDetectedFace[];
}

/** Landmarks may sit slightly outside the reported frame; beyond this the
 * coordinate spaces clearly disagree and alignment must not be trusted. */
const COORDINATE_TOLERANCE = 0.25;

function withinUnitWithTolerance(value: number): boolean {
  return value >= -COORDINATE_TOLERANCE && value <= 1 + COORDINATE_TOLERANCE;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Converts a raw detector payload into a normalized, trustworthy outcome.
 * Anything ambiguous — zero faces, several faces, missing landmarks, or
 * coordinates that do not fit the reported image space — resolves to an
 * explicit non-detected outcome instead of a guess.
 */
export function normalizeDetectionPayload(payload: RawDetectionPayload): FaceDetectionOutcome {
  if (!Number.isFinite(payload.imageWidth) || !Number.isFinite(payload.imageHeight)
    || payload.imageWidth <= 0 || payload.imageHeight <= 0) {
    return { kind: 'unavailable', reason: 'detector_error' };
  }
  if (payload.faces.length === 0) return { kind: 'no_face' };
  if (payload.faces.length > 1) return { kind: 'multiple_faces', count: payload.faces.length };

  const face = payload.faces[0];
  const size: Size = { width: payload.imageWidth, height: payload.imageHeight };
  const normalizePoint = (point: RawFacePoint) => ({
    x: point.x / size.width,
    y: point.y / size.height,
  });

  const frame: NormalizedRect = {
    x: face.frame.x / size.width,
    y: face.frame.y / size.height,
    width: face.frame.width / size.width,
    height: face.frame.height / size.height,
  };

  const { leftEye, rightEye, noseBase, mouthLeft, mouthRight, mouthBottom } = face.landmarks;

  const rawPoints = [leftEye, rightEye, noseBase, mouthLeft, mouthRight, mouthBottom]
    .filter((point): point is RawFacePoint => Boolean(point));
  const normalizedSamples = rawPoints.map(normalizePoint);
  const coordinatesFit = [frame.x, frame.y, frame.x + frame.width, frame.y + frame.height]
    .every(withinUnitWithTolerance)
    && normalizedSamples.every((point) => withinUnitWithTolerance(point.x) && withinUnitWithTolerance(point.y));
  if (!coordinatesFit) {
    return { kind: 'unavailable', reason: 'coordinate_mismatch' };
  }

  const clampedBounds: NormalizedRect = {
    x: clamp01(frame.x),
    y: clamp01(frame.y),
    width: clamp01(frame.x + frame.width) - clamp01(frame.x),
    height: clamp01(frame.y + frame.height) - clamp01(frame.y),
  };

  const mouthAnchor = mouthLeft && mouthRight
    ? { x: (mouthLeft.x + mouthRight.x) / 2, y: (mouthLeft.y + mouthRight.y) / 2 }
    : mouthBottom ?? null;

  if (!leftEye || !rightEye || !noseBase || !mouthAnchor) {
    return { kind: 'landmarks_missing', faceBounds: clampedBounds };
  }

  const eyeA = normalizePoint(leftEye);
  const eyeB = normalizePoint(rightEye);
  // Viewer orientation by x-order — detector left/right labels are
  // subject-relative and irrelevant to geometry.
  const [imageLeftEye, imageRightEye] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];

  const geometry: DetectedFaceGeometry = {
    faceBounds: clampedBounds,
    leftEye: imageLeftEye,
    rightEye: imageRightEye,
    noseTip: normalizePoint(noseBase),
    mouthCenter: normalizePoint(mouthAnchor),
    // Complete landmark sets earn full confidence; structural trust is decided
    // separately by isPlausibleFaceGeometry / resolveZoneAlignment.
    confidence: 1,
  };

  return { kind: 'detected', geometry };
}
