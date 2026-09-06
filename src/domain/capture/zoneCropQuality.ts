import type { SkinZone } from '../analysis/observationTaxonomy';
import type { NormalizedPoint, NormalizedRect, PixelRect, Size } from '../zones/zoneAlignment';

/**
 * Quality gates for individual zone crops and the adaptive detail-capture
 * policy. Gates only fire on metrics that were actually measured; unmeasured
 * metrics are reported as unmeasured, never silently passed. When a zone
 * lacks real pixel detail the remedy is a closer photo — digital enlargement
 * cannot create missing detail and is never suggested as if it could.
 *
 * Thresholds are provisional pre-validation values, to be tuned with the
 * Phase 5 repeatability work.
 */

/**
 * Zone shapes differ a lot (the under-eye band is a thin strip, cheeks are a
 * wide block), so resolution is gated on BOTH a minimum short side and a
 * minimum pixel area rather than one blanket square size.
 */
export const MIN_ZONE_CROP_SHORT_SIDE_PX = 110;
export const MIN_ZONE_CROP_AREA_PX = 44_000;
export const MIN_SHARPNESS_SCORE = 0.35;
export const MIN_MEAN_LUMA = 60;
export const MAX_MEAN_LUMA = 210;
export const MAX_LIGHTING_UNEVENNESS = 0.45;
export const MAX_OCCLUSION_RATIO = 0.25;

export interface ZoneCropMetrics {
  zone: SkinZone;
  /** Crop rect in original-image pixels; null when the zone could not be located. */
  crop: PixelRect | null;
  /** 0..1 normalized focus proxy. Omit or null when not measured. */
  sharpness?: number | null;
  /** 0..255 mean luminance. Omit or null when not measured. */
  meanLuma?: number | null;
  /** 0..1 left/right or region luminance imbalance. Omit or null when not measured. */
  lightingUnevenness?: number | null;
  /** 0..1 fraction covered by hair, glasses, hands, or other objects. */
  occlusionRatio?: number | null;
}

export type ZoneDeficiency =
  | 'crop_unavailable'
  | 'insufficient_resolution'
  | 'blurred'
  | 'underexposed'
  | 'overexposed'
  | 'uneven_lighting'
  | 'occluded';

export type ZoneMetricName = 'sharpness' | 'exposure' | 'lighting_evenness' | 'occlusion';

export interface ZoneCropAssessment {
  zone: SkinZone;
  /** True when every measured gate passed. Unmeasured gates cannot pass. */
  sufficient: boolean;
  deficiencies: ZoneDeficiency[];
  /** Gates that did not run because their metric was not supplied. */
  unmeasured: ZoneMetricName[];
}

export function assessZoneCrop(metrics: ZoneCropMetrics): ZoneCropAssessment {
  const deficiencies: ZoneDeficiency[] = [];
  const unmeasured: ZoneMetricName[] = [];

  if (!metrics.crop) {
    return {
      zone: metrics.zone,
      sufficient: false,
      deficiencies: ['crop_unavailable'],
      unmeasured: ['sharpness', 'exposure', 'lighting_evenness', 'occlusion'],
    };
  }

  if (
    Math.min(metrics.crop.width, metrics.crop.height) < MIN_ZONE_CROP_SHORT_SIDE_PX ||
    metrics.crop.width * metrics.crop.height < MIN_ZONE_CROP_AREA_PX
  ) {
    deficiencies.push('insufficient_resolution');
  }

  if (metrics.sharpness === null || metrics.sharpness === undefined) {
    unmeasured.push('sharpness');
  } else if (metrics.sharpness < MIN_SHARPNESS_SCORE) {
    deficiencies.push('blurred');
  }

  if (metrics.meanLuma === null || metrics.meanLuma === undefined) {
    unmeasured.push('exposure');
  } else if (metrics.meanLuma < MIN_MEAN_LUMA) {
    deficiencies.push('underexposed');
  } else if (metrics.meanLuma > MAX_MEAN_LUMA) {
    deficiencies.push('overexposed');
  }

  if (metrics.lightingUnevenness === null || metrics.lightingUnevenness === undefined) {
    unmeasured.push('lighting_evenness');
  } else if (metrics.lightingUnevenness > MAX_LIGHTING_UNEVENNESS) {
    deficiencies.push('uneven_lighting');
  }

  if (metrics.occlusionRatio === null || metrics.occlusionRatio === undefined) {
    unmeasured.push('occlusion');
  } else if (metrics.occlusionRatio > MAX_OCCLUSION_RATIO) {
    deficiencies.push('occluded');
  }

  return {
    zone: metrics.zone,
    sufficient: deficiencies.length === 0,
    deficiencies,
    unmeasured,
  };
}

export type DetailCaptureGroup = 'upper_face' | 'center_face' | 'lower_face';

export const DETAIL_GROUP_ORDER: readonly DetailCaptureGroup[] = ['upper_face', 'center_face', 'lower_face'];

export const DETAIL_GROUP_ZONES: Record<DetailCaptureGroup, readonly SkinZone[]> = {
  upper_face: ['forehead', 'under_eyes'],
  center_face: ['cheeks', 'nose_t_zone'],
  lower_face: ['mouth_lips', 'jawline', 'chin'],
};

export const DETAIL_GROUP_GUIDANCE: Record<DetailCaptureGroup, string> = {
  upper_face: 'Move closer so your forehead and under-eye area fill the frame.',
  center_face: 'Move closer so your cheeks and nose fill the frame.',
  lower_face: 'Move closer so your mouth, jawline, and chin fill the frame.',
};

const DEFICIENCY_PHRASES: Record<ZoneDeficiency, string> = {
  crop_unavailable: 'the area could not be located confidently',
  insufficient_resolution: 'there is not enough pixel detail',
  blurred: 'focus looks soft',
  underexposed: 'the area looks too dark',
  overexposed: 'the area looks too bright',
  uneven_lighting: 'lighting or shadow is uneven',
  occluded: 'the area is partly covered',
};

export interface DetailCaptureRequest {
  group: DetailCaptureGroup;
  /** Deficient zones that triggered this request. */
  zones: SkinZone[];
  /** Honest explanation of why more real detail is needed. */
  reason: string;
  /** Capture guidance shown to the user. */
  guidance: string;
}

export type DetailCapturePlan =
  | { kind: 'none' }
  | { kind: 'detail_requests'; requests: DetailCaptureRequest[] }
  | { kind: 'front_retake'; reason: string };

export const FRONT_RETAKE_REASON =
  'Your face could not be located reliably in the front photo, so close-up areas cannot be matched to it. Please retake the front photo in even light with your face inside the guide.';

function describeGroupReason(deficiencies: ReadonlySet<ZoneDeficiency>): string {
  const phrases = [...deficiencies].map((deficiency) => DEFICIENCY_PHRASES[deficiency]);
  return `More real detail is needed: ${phrases.join('; ')}. A closer photo adds detail that digital zoom cannot.`;
}

/**
 * Maps deficient zones to at most three guided detail photos. When landmarks
 * are unreliable, the honest remedy is a better front photo — detail crops
 * cannot be trusted to match zones that were never located.
 */
export function planDetailCapture(input: {
  assessments: readonly ZoneCropAssessment[];
  landmarksReliable: boolean;
}): DetailCapturePlan {
  if (!input.landmarksReliable) {
    return { kind: 'front_retake', reason: FRONT_RETAKE_REASON };
  }

  const requests: DetailCaptureRequest[] = [];
  for (const group of DETAIL_GROUP_ORDER) {
    const groupZones = DETAIL_GROUP_ZONES[group];
    const deficient = input.assessments.filter(
      (assessment) => !assessment.sufficient && groupZones.includes(assessment.zone),
    );
    if (!deficient.length) continue;
    const deficiencies = new Set<ZoneDeficiency>();
    for (const assessment of deficient) {
      for (const deficiency of assessment.deficiencies) deficiencies.add(deficiency);
    }
    requests.push({
      group,
      zones: deficient.map((assessment) => assessment.zone),
      reason: describeGroupReason(deficiencies),
      guidance: DETAIL_GROUP_GUIDANCE[group],
    });
  }

  return requests.length ? { kind: 'detail_requests', requests } : { kind: 'none' };
}

/** Face-framing gates on the full front frame. */
export const MIN_FACE_WIDTH_FRACTION = 0.3;
export const MAX_FACE_CENTER_OFFSET_X = 0.18;
export const MAX_FACE_CENTER_OFFSET_Y = 0.2;
const EDGE_CONTACT_TOLERANCE = 0.01;

export type FaceFramingIssue = 'face_not_found' | 'face_too_small' | 'face_off_center' | 'face_cut_off';

export function assessFaceFraming(faceBounds: NormalizedRect | null): FaceFramingIssue[] {
  if (!faceBounds) return ['face_not_found'];

  const issues: FaceFramingIssue[] = [];
  if (faceBounds.width < MIN_FACE_WIDTH_FRACTION) issues.push('face_too_small');

  const centerX = faceBounds.x + faceBounds.width / 2;
  const centerY = faceBounds.y + faceBounds.height / 2;
  if (
    Math.abs(centerX - 0.5) > MAX_FACE_CENTER_OFFSET_X ||
    Math.abs(centerY - 0.5) > MAX_FACE_CENTER_OFFSET_Y
  ) {
    issues.push('face_off_center');
  }

  if (
    faceBounds.x <= EDGE_CONTACT_TOLERANCE ||
    faceBounds.y <= EDGE_CONTACT_TOLERANCE ||
    faceBounds.x + faceBounds.width >= 1 - EDGE_CONTACT_TOLERANCE ||
    faceBounds.y + faceBounds.height >= 1 - EDGE_CONTACT_TOLERANCE
  ) {
    issues.push('face_cut_off');
  }

  return issues;
}

/** Head roll beyond this makes angle consistency across captures unreliable. */
export const MAX_HEAD_ROLL_DEGREES = 12;

/** Signed roll of the eye line in degrees, computed in source-pixel space. */
export function estimateRollDegrees(
  leftEye: NormalizedPoint,
  rightEye: NormalizedPoint,
  source: Size,
): number {
  const dx = (rightEye.x - leftEye.x) * source.width;
  const dy = (rightEye.y - leftEye.y) * source.height;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
