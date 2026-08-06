import { SKIN_ZONES, type SkinZone } from '../analysis/observationTaxonomy';

/**
 * Pure geometry for individualized facial-zone alignment.
 *
 * All landmark coordinates are normalized to the ORIGINAL captured image
 * (x right, y down, 0..1), so zone crops are always defined against the
 * full-resolution source — never against a screenshot or an enlarged preview.
 * Nothing here performs or supports identity recognition; the contract carries
 * only the coarse geometry needed to place cosmetic-appearance zones.
 */

export interface Size {
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverTransform {
  /** Uniform source-pixel to container-pixel scale. */
  scale: number;
  /** Container-space position of the source image origin; <= 0 on the cropped axis. */
  offsetX: number;
  offsetY: number;
}

/** Matches React Native Image `resizeMode: 'cover'`: fill, preserve aspect, center-crop. */
export function getCoverTransform(source: Size, container: Size): CoverTransform {
  const scale = Math.max(container.width / source.width, container.height / source.height);
  return {
    scale,
    offsetX: (container.width - source.width * scale) / 2,
    offsetY: (container.height - source.height * scale) / 2,
  };
}

export interface ProjectedPoint {
  x: number;
  y: number;
  /** False when cover-cropping pushed the point outside the visible container. */
  visible: boolean;
}

export interface ProjectionOptions {
  /**
   * True when the displayed image is horizontally flipped relative to the
   * source pixels the landmarks were measured in (selfie-style preview of an
   * un-mirrored capture, or vice versa).
   */
  mirrored?: boolean;
}

export function projectPointToContainer(
  point: NormalizedPoint,
  source: Size,
  container: Size,
  options: ProjectionOptions = {},
): ProjectedPoint {
  const { scale, offsetX, offsetY } = getCoverTransform(source, container);
  const sourceX = (options.mirrored ? 1 - point.x : point.x) * source.width;
  const sourceY = point.y * source.height;
  const x = sourceX * scale + offsetX;
  const y = sourceY * scale + offsetY;
  return {
    x,
    y,
    visible: x >= 0 && x <= container.width && y >= 0 && y <= container.height,
  };
}

export interface ProjectedRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** True when every edge fits inside the container after cover cropping. */
  fullyVisible: boolean;
}

export function projectRectToContainer(
  rect: NormalizedRect,
  source: Size,
  container: Size,
  options: ProjectionOptions = {},
): ProjectedRect {
  const { scale, offsetX, offsetY } = getCoverTransform(source, container);
  const normalizedLeft = options.mirrored ? 1 - (rect.x + rect.width) : rect.x;
  const left = normalizedLeft * source.width * scale + offsetX;
  const top = rect.y * source.height * scale + offsetY;
  const width = rect.width * source.width * scale;
  const height = rect.height * source.height * scale;
  return {
    left,
    top,
    width,
    height,
    fullyVisible:
      left >= 0 && top >= 0 && left + width <= container.width && top + height <= container.height,
  };
}

/** Clamps to the unit square; returns null when nothing remains. */
export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect | null {
  const x = Math.min(Math.max(rect.x, 0), 1);
  const y = Math.min(Math.max(rect.y, 0), 1);
  const right = Math.min(Math.max(rect.x + rect.width, 0), 1);
  const bottom = Math.min(Math.max(rect.y + rect.height, 0), 1);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export function padNormalizedRect(rect: NormalizedRect, pad: number): NormalizedRect {
  return clampNormalizedRect({
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }) ?? rect;
}

/**
 * Integer crop rect in original-image pixels, for cropping from the
 * full-resolution capture. Returns null when the rect has no visible area.
 */
export function normalizedRectToSourcePixels(rect: NormalizedRect, source: Size): PixelRect | null {
  const clamped = clampNormalizedRect(rect);
  if (!clamped) return null;
  const x = Math.round(clamped.x * source.width);
  const y = Math.round(clamped.y * source.height);
  const width = Math.min(Math.round(clamped.width * source.width), source.width - x);
  const height = Math.min(Math.round(clamped.height * source.height), source.height - y);
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/**
 * Minimal, provider-independent detected-face contract. Points use viewer
 * orientation in image space: `leftEye` is the eye nearer image x = 0.
 */
export interface DetectedFaceGeometry {
  faceBounds: NormalizedRect;
  leftEye: NormalizedPoint;
  rightEye: NormalizedPoint;
  noseTip: NormalizedPoint;
  mouthCenter: NormalizedPoint;
  /** Detector-reported confidence, 0..1. */
  confidence: number;
}

/** Below this detector confidence, individualized placement is not shown. */
export const MIN_LANDMARK_CONFIDENCE = 0.6;

const PLAUSIBILITY_TOLERANCE = 0.05;
/** A face occupying less of the frame than this cannot support zone placement. */
const MIN_FACE_FRACTION = 0.15;

function isWithin(point: NormalizedPoint, rect: NormalizedRect, tolerance: number): boolean {
  return (
    point.x >= rect.x - tolerance &&
    point.x <= rect.x + rect.width + tolerance &&
    point.y >= rect.y - tolerance &&
    point.y <= rect.y + rect.height + tolerance
  );
}

/**
 * Structural sanity check. Rejects geometry that cannot describe an upright
 * front-facing capture, so broken detector output falls back honestly instead
 * of rendering misplaced markers.
 */
export function isPlausibleFaceGeometry(geometry: DetectedFaceGeometry): boolean {
  const { faceBounds, leftEye, rightEye, noseTip, mouthCenter } = geometry;
  if (clampNormalizedRect(faceBounds) === null) return false;
  if (faceBounds.width < MIN_FACE_FRACTION || faceBounds.height < MIN_FACE_FRACTION) return false;

  const points = [leftEye, rightEye, noseTip, mouthCenter];
  if (!points.every((point) => isWithin(point, faceBounds, PLAUSIBILITY_TOLERANCE))) return false;

  if (leftEye.x >= rightEye.x) return false;
  const eyeY = (leftEye.y + rightEye.y) / 2;
  if (!(eyeY < noseTip.y && noseTip.y < mouthCenter.y)) return false;

  const eyeSpan = rightEye.x - leftEye.x;
  if (eyeSpan < faceBounds.width * 0.2) return false;

  return true;
}

/**
 * Derives the seven cosmetic zones from the minimal landmark set. The
 * proportions are placement heuristics for visible-appearance regions; they
 * carry no identity information and are validated structurally in tests.
 */
export function deriveZoneRects(geometry: DetectedFaceGeometry): Record<SkinZone, NormalizedRect> {
  const face = geometry.faceBounds;
  const top = face.y;
  const bottom = face.y + face.height;
  const eyeY = (geometry.leftEye.y + geometry.rightEye.y) / 2;
  const noseY = geometry.noseTip.y;
  const mouthY = geometry.mouthCenter.y;
  const browY = eyeY - 0.35 * (noseY - eyeY);
  const centerX = geometry.noseTip.x;

  const zones: Record<SkinZone, NormalizedRect> = {
    forehead: {
      x: face.x + face.width * 0.12,
      y: top + face.height * 0.04,
      width: face.width * 0.76,
      height: Math.max(browY - (top + face.height * 0.04), face.height * 0.08),
    },
    under_eyes: {
      x: face.x + face.width * 0.1,
      y: eyeY + (noseY - eyeY) * 0.1,
      width: face.width * 0.8,
      height: (noseY - eyeY) * 0.45,
    },
    cheeks: {
      x: face.x + face.width * 0.06,
      y: eyeY + (noseY - eyeY) * 0.45,
      width: face.width * 0.88,
      height: mouthY - (eyeY + (noseY - eyeY) * 0.45),
    },
    nose_t_zone: {
      x: centerX - face.width * 0.15,
      y: browY,
      width: face.width * 0.3,
      height: noseY + (mouthY - noseY) * 0.15 - browY,
    },
    mouth_lips: {
      x: geometry.mouthCenter.x - face.width * 0.21,
      y: mouthY - (mouthY - noseY) * 0.45,
      width: face.width * 0.42,
      height: (mouthY - noseY) * 0.45 + (bottom - mouthY) * 0.35,
    },
    jawline: {
      x: face.x + face.width * 0.05,
      y: mouthY + (bottom - mouthY) * 0.15,
      width: face.width * 0.9,
      height: (bottom - mouthY) * 0.85,
    },
    chin: {
      x: geometry.mouthCenter.x - face.width * 0.18,
      y: mouthY + (bottom - mouthY) * 0.35,
      width: face.width * 0.36,
      height: (bottom - mouthY) * 0.63,
    },
  };

  const clamped = {} as Record<SkinZone, NormalizedRect>;
  for (const zone of SKIN_ZONES) {
    clamped[zone] = clampNormalizedRect(zones[zone]) ?? zones[zone];
  }
  return clamped;
}

/** Extra context kept around each zone when cropping, as a fraction of the image. */
export const ZONE_CROP_PADDING = 0.02;

/**
 * Zone crop rects in original-image pixels. Consumers crop the full-resolution
 * capture with these; digital enlargement of a smaller preview is never a
 * substitute.
 */
export function deriveZoneCropRects(
  geometry: DetectedFaceGeometry,
  source: Size,
): Partial<Record<SkinZone, PixelRect>> {
  const zones = deriveZoneRects(geometry);
  const crops: Partial<Record<SkinZone, PixelRect>> = {};
  for (const zone of SKIN_ZONES) {
    const crop = normalizedRectToSourcePixels(padNormalizedRect(zones[zone], ZONE_CROP_PADDING), source);
    if (crop) crops[zone] = crop;
  }
  return crops;
}

export type ZoneAlignmentResolution =
  | { mode: 'landmarks'; zones: Record<SkinZone, NormalizedRect> }
  | { mode: 'fixed_guide'; reason: 'no_detection' | 'low_confidence' | 'implausible_geometry' };

/**
 * Chooses between individualized placement and the clearly labeled fixed
 * guide. Unreliable detections always fall back — inaccurate markers are never
 * presented as personalized alignment.
 */
export function resolveZoneAlignment(
  detection: DetectedFaceGeometry | null,
  minConfidence: number = MIN_LANDMARK_CONFIDENCE,
): ZoneAlignmentResolution {
  if (!detection) return { mode: 'fixed_guide', reason: 'no_detection' };
  if (detection.confidence < minConfidence) return { mode: 'fixed_guide', reason: 'low_confidence' };
  if (!isPlausibleFaceGeometry(detection)) return { mode: 'fixed_guide', reason: 'implausible_geometry' };
  return { mode: 'landmarks', zones: deriveZoneRects(detection) };
}
