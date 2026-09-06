import { describe, expect, test } from 'vitest';
import type { DetectedFaceGeometry } from '../../zones/zoneAlignment';
import { deriveZoneCropRects, resolveZoneAlignment } from '../../zones/zoneAlignment';
import { SKIN_ZONES } from '../../analysis/observationTaxonomy';
import { assessZoneCrop, planDetailCapture } from '../zoneCropQuality';
import {
  assessFrontCaptureDetection,
  assessProfileCaptureDetection,
  HEAD_TILT_COPY,
  MULTIPLE_FACES_COPY,
  NO_FACE_COPY,
} from '../captureDetectionPolicy';

const portrait = { width: 1080, height: 1440 };

const centeredGeometry: DetectedFaceGeometry = {
  faceBounds: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
  leftEye: { x: 0.38, y: 0.42 },
  rightEye: { x: 0.62, y: 0.42 },
  noseTip: { x: 0.5, y: 0.55 },
  mouthCenter: { x: 0.5, y: 0.65 },
  confidence: 1,
};

describe('front capture decisions', () => {
  test('accepts a centered, level, single face', () => {
    const decision = assessFrontCaptureDetection({ kind: 'detected', geometry: centeredGeometry }, portrait);
    expect(decision.kind).toBe('accept');
  });

  test('detector unavailability never blocks the user', () => {
    const decision = assessFrontCaptureDetection(
      { kind: 'unavailable', reason: 'platform_unsupported' },
      portrait,
    );
    expect(decision.kind).toBe('accept_with_fallback');
  });

  test('asks for a retake when no face or several faces are found', () => {
    expect(assessFrontCaptureDetection({ kind: 'no_face' }, portrait)).toMatchObject({
      kind: 'retake',
      reasons: [NO_FACE_COPY],
    });
    expect(assessFrontCaptureDetection({ kind: 'multiple_faces', count: 2 }, portrait)).toMatchObject({
      kind: 'retake',
      reasons: [MULTIPLE_FACES_COPY],
    });
  });

  test('asks for a retake when the face is too small', () => {
    const decision = assessFrontCaptureDetection(
      {
        kind: 'detected',
        geometry: {
          ...centeredGeometry,
          faceBounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.22 },
          leftEye: { x: 0.45, y: 0.48 },
          rightEye: { x: 0.55, y: 0.48 },
          noseTip: { x: 0.5, y: 0.53 },
          mouthCenter: { x: 0.5, y: 0.57 },
        },
      },
      portrait,
    );
    expect(decision.kind).toBe('retake');
    if (decision.kind !== 'retake') return;
    expect(decision.reasons.join(' ')).toContain('closer');
  });

  test('asks for a retake when the head is clearly tilted', () => {
    const decision = assessFrontCaptureDetection(
      {
        kind: 'detected',
        geometry: {
          ...centeredGeometry,
          leftEye: { x: 0.38, y: 0.4 },
          rightEye: { x: 0.62, y: 0.475 },
        },
      },
      { width: 1000, height: 1000 },
    );
    expect(decision.kind).toBe('retake');
    if (decision.kind !== 'retake') return;
    expect(decision.reasons).toContain(HEAD_TILT_COPY);
  });

  test('face found without landmarks: fallback when framed well, retake when not', () => {
    expect(
      assessFrontCaptureDetection(
        { kind: 'landmarks_missing', faceBounds: { x: 0.28, y: 0.24, width: 0.44, height: 0.5 } },
        portrait,
      ).kind,
    ).toBe('accept_with_fallback');

    expect(
      assessFrontCaptureDetection(
        { kind: 'landmarks_missing', faceBounds: { x: 0.42, y: 0.42, width: 0.16, height: 0.16 } },
        portrait,
      ).kind,
    ).toBe('retake');
  });
});

describe('profile capture decisions', () => {
  test('blocks only on a positive multi-face finding', () => {
    expect(assessProfileCaptureDetection({ kind: 'multiple_faces', count: 3 }).kind).toBe('retake');
    expect(assessProfileCaptureDetection({ kind: 'detected', geometry: centeredGeometry }).kind).toBe('accept');
    expect(assessProfileCaptureDetection({ kind: 'no_face' }).kind).toBe('accept_with_fallback');
    expect(
      assessProfileCaptureDetection({ kind: 'unavailable', reason: 'detector_error' }).kind,
    ).toBe('accept_with_fallback');
  });
});

describe('low-resolution face to adaptive detail plan', () => {
  function planForSource(source: { width: number; height: number }) {
    const alignment = resolveZoneAlignment(centeredGeometry);
    expect(alignment.mode).toBe('landmarks');
    const crops = deriveZoneCropRects(centeredGeometry, source);
    const assessments = SKIN_ZONES.map((zone) => assessZoneCrop({ zone, crop: crops[zone] ?? null }));
    return planDetailCapture({ assessments, landmarksReliable: alignment.mode === 'landmarks' });
  }

  test('a low-resolution capture triggers close-up requests', () => {
    const plan = planForSource({ width: 720, height: 960 });
    expect(plan.kind).toBe('detail_requests');
    if (plan.kind !== 'detail_requests') return;
    expect(plan.requests.length).toBeGreaterThanOrEqual(1);
    expect(plan.requests.length).toBeLessThanOrEqual(3);
    expect(plan.requests.every((request) => request.reason.includes('digital zoom cannot'))).toBe(true);
  });

  test('a modern high-resolution capture requests no close-ups', () => {
    expect(planForSource({ width: 2320, height: 3088 })).toEqual({ kind: 'none' });
  });
});
