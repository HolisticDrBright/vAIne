import { describe, expect, test } from 'vitest';
import type { DetectedFaceGeometry } from '../../zones/zoneAlignment';
import { summarizeCaptureAlignment } from '../adaptiveCapture';

const geometry: DetectedFaceGeometry = {
  faceBounds: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
  leftEye: { x: 0.38, y: 0.42 },
  rightEye: { x: 0.62, y: 0.42 },
  noseTip: { x: 0.5, y: 0.55 },
  mouthCenter: { x: 0.5, y: 0.65 },
  confidence: 1,
};

describe('capture alignment summary', () => {
  test('no capture or unavailable detection: fixed guide, no close-up stage', () => {
    expect(summarizeCaptureAlignment(undefined)).toEqual({
      alignment: { mode: 'fixed_guide', reason: 'no_detection' },
      plan: null,
    });
    expect(
      summarizeCaptureAlignment({
        width: 1080,
        height: 1440,
        faceDetection: { kind: 'unavailable', reason: 'platform_unsupported' },
      }),
    ).toEqual({ alignment: { mode: 'fixed_guide', reason: 'no_detection' }, plan: null });
  });

  test('face found without usable landmarks: fixed guide plus front-retake suggestion', () => {
    const summary = summarizeCaptureAlignment({
      width: 1080,
      height: 1440,
      faceDetection: { kind: 'landmarks_missing', faceBounds: { x: 0.3, y: 0.25, width: 0.4, height: 0.45 } },
    });
    expect(summary.alignment.mode).toBe('fixed_guide');
    expect(summary.plan?.kind).toBe('front_retake');
  });

  test('implausible detected geometry falls back and suggests a front retake', () => {
    const summary = summarizeCaptureAlignment({
      width: 1080,
      height: 1440,
      faceDetection: {
        kind: 'detected',
        geometry: { ...geometry, leftEye: geometry.rightEye, rightEye: geometry.leftEye },
      },
    });
    expect(summary.alignment).toEqual({ mode: 'fixed_guide', reason: 'implausible_geometry' });
    expect(summary.plan?.kind).toBe('front_retake');
  });

  test('a confident high-resolution capture aligns with no close-ups needed', () => {
    const summary = summarizeCaptureAlignment({
      width: 2320,
      height: 3088,
      faceDetection: { kind: 'detected', geometry },
    });
    expect(summary.alignment.mode).toBe('landmarks');
    expect(summary.plan).toEqual({ kind: 'none' });
  });

  test('a confident low-resolution capture aligns and requests close-ups', () => {
    const summary = summarizeCaptureAlignment({
      width: 720,
      height: 960,
      faceDetection: { kind: 'detected', geometry },
    });
    expect(summary.alignment.mode).toBe('landmarks');
    expect(summary.plan?.kind).toBe('detail_requests');
  });
});
