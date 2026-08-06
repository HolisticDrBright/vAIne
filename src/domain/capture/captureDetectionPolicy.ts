import type { FaceDetectionOutcome } from '../zones/faceDetection';
import type { Size } from '../zones/zoneAlignment';
import {
  assessFaceFraming,
  estimateRollDegrees,
  MAX_HEAD_ROLL_DEGREES,
  type FaceFramingIssue,
} from './zoneCropQuality';

/**
 * Turns an on-device detection outcome into an honest capture decision.
 *
 * The safety posture is asymmetric on purpose: detection being unavailable or
 * incomplete never blocks the user (the labeled fixed-guide fallback covers
 * presentation), while a positive detector finding that the photo cannot
 * support alignment (no face, several faces, bad framing, strong tilt on the
 * front photo) asks for a retake with specific guidance.
 */

export type CaptureDetectionDecision =
  | { kind: 'accept'; outcome: FaceDetectionOutcome }
  | { kind: 'accept_with_fallback'; outcome: FaceDetectionOutcome }
  | { kind: 'retake'; reasons: readonly string[]; outcome: FaceDetectionOutcome };

const FRAMING_COPY: Record<Exclude<FaceFramingIssue, 'face_not_found'>, string> = {
  face_too_small: 'Move a little closer so your face fills more of the oval guide.',
  face_off_center: 'Center your face inside the oval guide.',
  face_cut_off: 'Keep your whole face inside the frame, away from the edges.',
};

export const NO_FACE_COPY =
  'We could not find a face in this photo. Face the camera directly in even light and try again.';
export const MULTIPLE_FACES_COPY =
  'More than one face was found. Only you should be in the frame for a check-in.';
export const HEAD_TILT_COPY = 'Keep your head level, without tilting, and try again.';

export function assessFrontCaptureDetection(
  outcome: FaceDetectionOutcome,
  source: Size,
): CaptureDetectionDecision {
  switch (outcome.kind) {
    case 'unavailable':
      return { kind: 'accept_with_fallback', outcome };
    case 'no_face':
      return { kind: 'retake', reasons: [NO_FACE_COPY], outcome };
    case 'multiple_faces':
      return { kind: 'retake', reasons: [MULTIPLE_FACES_COPY], outcome };
    case 'landmarks_missing': {
      const issues = assessFaceFraming(outcome.faceBounds);
      const reasons = issues
        .filter((issue): issue is Exclude<FaceFramingIssue, 'face_not_found'> => issue !== 'face_not_found')
        .map((issue) => FRAMING_COPY[issue]);
      if (reasons.length) return { kind: 'retake', reasons, outcome };
      return { kind: 'accept_with_fallback', outcome };
    }
    case 'detected': {
      const reasons: string[] = [];
      for (const issue of assessFaceFraming(outcome.geometry.faceBounds)) {
        if (issue !== 'face_not_found') reasons.push(FRAMING_COPY[issue]);
      }
      const roll = estimateRollDegrees(outcome.geometry.leftEye, outcome.geometry.rightEye, source);
      if (Math.abs(roll) > MAX_HEAD_ROLL_DEGREES) reasons.push(HEAD_TILT_COPY);
      if (reasons.length) return { kind: 'retake', reasons, outcome };
      return { kind: 'accept', outcome };
    }
  }
}

/**
 * Profile photos are deliberately gated more loosely: detectors are less
 * reliable on turned faces, so only a positive multi-face finding blocks.
 */
export function assessProfileCaptureDetection(outcome: FaceDetectionOutcome): CaptureDetectionDecision {
  if (outcome.kind === 'multiple_faces') {
    return { kind: 'retake', reasons: [MULTIPLE_FACES_COPY], outcome };
  }
  if (outcome.kind === 'detected') return { kind: 'accept', outcome };
  return { kind: 'accept_with_fallback', outcome };
}
