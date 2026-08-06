import { SKIN_ZONES } from '../analysis/observationTaxonomy';
import type { FaceDetectionOutcome } from '../zones/faceDetection';
import {
  deriveZoneCropRects,
  resolveZoneAlignment,
  type Size,
  type ZoneAlignmentResolution,
} from '../zones/zoneAlignment';
import { assessZoneCrop, planDetailCapture, type DetailCapturePlan } from './zoneCropQuality';

export interface FrontCaptureLike {
  width: number;
  height: number;
  faceDetection?: FaceDetectionOutcome;
}

export interface CaptureAlignmentSummary {
  alignment: ZoneAlignmentResolution;
  /**
   * Null when detection never ran or was unavailable — the quick scan then
   * proceeds with the labeled fixed guide and no close-up stage, because
   * detail crops cannot be matched to zones that were never located.
   */
  plan: DetailCapturePlan | null;
}

/**
 * Single source of truth for what the accepted front capture supports:
 * individualized zone alignment, an optional close-up stage, a front-retake
 * suggestion, or the labeled fixed-guide fallback.
 */
export function summarizeCaptureAlignment(front: FrontCaptureLike | undefined): CaptureAlignmentSummary {
  const detection = front?.faceDetection;
  if (!front || !detection || detection.kind === 'unavailable') {
    return { alignment: { mode: 'fixed_guide', reason: 'no_detection' }, plan: null };
  }

  if (detection.kind !== 'detected') {
    // A face-count or landmark problem is actionable: suggest a better front
    // photo rather than pretending crops can be trusted.
    return {
      alignment: { mode: 'fixed_guide', reason: 'no_detection' },
      plan: planDetailCapture({ assessments: [], landmarksReliable: false }),
    };
  }

  const alignment = resolveZoneAlignment(detection.geometry);
  if (alignment.mode !== 'landmarks') {
    return { alignment, plan: planDetailCapture({ assessments: [], landmarksReliable: false }) };
  }

  const source: Size = { width: front.width, height: front.height };
  const crops = deriveZoneCropRects(detection.geometry, source);
  const assessments = SKIN_ZONES.map((zone) => assessZoneCrop({ zone, crop: crops[zone] ?? null }));
  return { alignment, plan: planDetailCapture({ assessments, landmarksReliable: true }) };
}
