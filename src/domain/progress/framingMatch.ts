import type { FaceDetectionOutcome } from '../zones/faceDetection';
import { estimateRollDegrees } from '../capture/zoneCropQuality';
import type { NormalizedRect, Size } from '../zones/zoneAlignment';

/**
 * Framing consistency between a saved baseline photo and a new check-in.
 *
 * A before-and-after is only fair when the face sits in the same place, at
 * the same distance, without a different head tilt. This module compares the
 * on-device face geometry of two photos and says whether the framing matched,
 * which part differs, or that it could not be checked. It deliberately covers
 * framing only: lighting is not measured here, so the interface keeps lighting
 * as something the person confirms by eye, and the badge wording says
 * "framing", never "conditions".
 *
 * Geometry is used in memory and never persisted. The baseline's geometry is
 * re-derived on the device from the saved photo each time it is needed.
 */

export interface FramingSnapshot {
  faceBounds: NormalizedRect;
  /** Head roll in degrees, or null when landmarks were not available. */
  rollDegrees: number | null;
}

export type FramingMismatch = 'position' | 'distance' | 'tilt';

export type FramingMatchResult =
  | { kind: 'matched'; centerOffset: number; sizeRatio: number; rollDelta: number | null }
  | { kind: 'not_matched'; mismatches: readonly FramingMismatch[]; centerOffset: number; sizeRatio: number; rollDelta: number | null }
  | { kind: 'unknown'; reason: 'baseline_not_located' | 'current_not_located' };

/** Face centre may drift this fraction of the frame and still count as matched. */
export const MAX_MATCH_CENTER_OFFSET = 0.06;
/** Face width may differ by this proportion (closer or further) and still count. */
export const MAX_MATCH_SIZE_RATIO_DELTA = 0.15;
/** Head roll may differ by this many degrees and still count. */
export const MAX_MATCH_ROLL_DELTA_DEGREES = 6;

export const framingMismatchCopy: Record<FramingMismatch, string> = {
  position: 'Your face sits in a different part of the frame than in the baseline.',
  distance: 'You are closer to or further from the camera than in the baseline.',
  tilt: 'Your head is tilted differently than in the baseline.',
};

/**
 * Reduces a detection outcome to the two facts framing needs. Landmark-less
 * detections still give a usable face box; tilt is then simply not assessed.
 */
export function framingSnapshotFrom(outcome: FaceDetectionOutcome | undefined, source: Size): FramingSnapshot | null {
  if (!outcome) return null;
  switch (outcome.kind) {
    case 'detected':
      return {
        faceBounds: outcome.geometry.faceBounds,
        rollDegrees: estimateRollDegrees(outcome.geometry.leftEye, outcome.geometry.rightEye, source),
      };
    case 'landmarks_missing':
      return outcome.faceBounds ? { faceBounds: outcome.faceBounds, rollDegrees: null } : null;
    default:
      return null;
  }
}

function center(rect: NormalizedRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function assessFramingMatch(baseline: FramingSnapshot | null, current: FramingSnapshot | null): FramingMatchResult {
  if (!baseline) return { kind: 'unknown', reason: 'baseline_not_located' };
  if (!current) return { kind: 'unknown', reason: 'current_not_located' };

  const baseCenter = center(baseline.faceBounds);
  const currentCenter = center(current.faceBounds);
  const centerOffset = Math.hypot(currentCenter.x - baseCenter.x, currentCenter.y - baseCenter.y);
  const sizeRatio = baseline.faceBounds.width > 0 ? current.faceBounds.width / baseline.faceBounds.width : Number.POSITIVE_INFINITY;
  const rollDelta = baseline.rollDegrees !== null && current.rollDegrees !== null
    ? Math.abs(current.rollDegrees - baseline.rollDegrees)
    : null;

  const mismatches: FramingMismatch[] = [];
  if (centerOffset > MAX_MATCH_CENTER_OFFSET) mismatches.push('position');
  if (!Number.isFinite(sizeRatio) || Math.abs(sizeRatio - 1) > MAX_MATCH_SIZE_RATIO_DELTA) mismatches.push('distance');
  if (rollDelta !== null && rollDelta > MAX_MATCH_ROLL_DELTA_DEGREES) mismatches.push('tilt');

  if (mismatches.length) return { kind: 'not_matched', mismatches, centerOffset, sizeRatio, rollDelta };
  return { kind: 'matched', centerOffset, sizeRatio, rollDelta };
}

/** Short badge text for the compare screen. */
export function framingMatchBadge(result: FramingMatchResult): { label: string; tone: 'green' | 'gold' | 'muted' } {
  switch (result.kind) {
    case 'matched': return { label: 'FRAMING MATCHED', tone: 'green' };
    case 'not_matched': return { label: 'FRAMING DIFFERS', tone: 'gold' };
    case 'unknown': return { label: 'FRAMING NOT CHECKED', tone: 'muted' };
  }
}

export function describeFramingMatch(result: FramingMatchResult): string {
  switch (result.kind) {
    case 'matched':
      return 'Face position, distance, and tilt are close to the baseline. Lighting is not measured, so confirm it by eye before reading any difference.';
    case 'not_matched':
      return `${result.mismatches.map((item) => framingMismatchCopy[item]).join(' ')} Differences between the photos may come from framing rather than skin.`;
    case 'unknown':
      return result.reason === 'baseline_not_located'
        ? 'A face could not be located in the baseline photo on this device, so framing was not compared.'
        : 'A face could not be located in the current photo on this device, so framing was not compared.';
  }
}
