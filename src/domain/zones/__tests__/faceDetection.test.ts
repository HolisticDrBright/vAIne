import { describe, expect, test } from 'vitest';
import {
  normalizeDetectionPayload,
  type RawDetectedFace,
  type RawDetectionPayload,
} from '../faceDetection';
import { projectPointToContainer, resolveZoneAlignment } from '../zoneAlignment';

function portraitFace(): RawDetectedFace {
  return {
    frame: { x: 270, y: 288, width: 540, height: 792 },
    landmarks: {
      leftEye: { x: 410, y: 605 },
      rightEye: { x: 670, y: 605 },
      noseBase: { x: 540, y: 792 },
      mouthLeft: { x: 480, y: 936 },
      mouthRight: { x: 600, y: 936 },
    },
  };
}

function payload(overrides: Partial<RawDetectionPayload> = {}): RawDetectionPayload {
  return { imageWidth: 1080, imageHeight: 1440, faces: [portraitFace()], ...overrides };
}

describe('detection payload normalization', () => {
  test('normalizes a single portrait face against the detector-reported size', () => {
    const outcome = normalizeDetectionPayload(payload());
    expect(outcome.kind).toBe('detected');
    if (outcome.kind !== 'detected') return;
    expect(outcome.geometry.faceBounds.x).toBeCloseTo(0.25, 3);
    expect(outcome.geometry.faceBounds.height).toBeCloseTo(0.55, 3);
    expect(outcome.geometry.leftEye.x).toBeCloseTo(410 / 1080, 4);
    expect(outcome.geometry.noseTip.y).toBeCloseTo(0.55, 4);
    expect(outcome.geometry.mouthCenter).toEqual({ x: 540 / 1080, y: 936 / 1440 });
  });

  test('normalizes the same face geometry from a landscape image', () => {
    const outcome = normalizeDetectionPayload({
      imageWidth: 1920,
      imageHeight: 1080,
      faces: [{
        frame: { x: 480, y: 216, width: 960, height: 594 },
        landmarks: {
          leftEye: { x: 729.6, y: 453.6 },
          rightEye: { x: 1190.4, y: 453.6 },
          noseBase: { x: 960, y: 594 },
          mouthBottom: { x: 960, y: 702 },
        },
      }],
    });
    expect(outcome.kind).toBe('detected');
    if (outcome.kind !== 'detected') return;
    expect(outcome.geometry.faceBounds).toEqual({ x: 0.25, y: 0.2, width: 0.5, height: 0.55 });
    expect(outcome.geometry.mouthCenter.y).toBeCloseTo(0.65, 4);
  });

  test('reports no face and multiple faces explicitly', () => {
    expect(normalizeDetectionPayload(payload({ faces: [] }))).toEqual({ kind: 'no_face' });
    expect(normalizeDetectionPayload(payload({ faces: [portraitFace(), portraitFace()] }))).toEqual({
      kind: 'multiple_faces',
      count: 2,
    });
  });

  test('rotated or mismatched coordinate spaces are refused, never guessed', () => {
    const face = portraitFace();
    face.landmarks.noseBase = { x: 1400, y: 540 };
    const outcome = normalizeDetectionPayload(payload({ faces: [face] }));
    expect(outcome).toEqual({ kind: 'unavailable', reason: 'coordinate_mismatch' });
  });

  test('missing mouth or eye landmarks degrade to landmarks_missing with bounds', () => {
    const face = portraitFace();
    face.landmarks.mouthLeft = null;
    face.landmarks.mouthRight = null;
    const outcome = normalizeDetectionPayload(payload({ faces: [face] }));
    expect(outcome.kind).toBe('landmarks_missing');
    if (outcome.kind !== 'landmarks_missing') return;
    expect(outcome.faceBounds?.x).toBeCloseTo(0.25, 3);
  });

  test('orders eyes by image position regardless of detector labels', () => {
    const face = portraitFace();
    face.landmarks.leftEye = { x: 670, y: 605 };
    face.landmarks.rightEye = { x: 410, y: 605 };
    const outcome = normalizeDetectionPayload(payload({ faces: [face] }));
    expect(outcome.kind).toBe('detected');
    if (outcome.kind !== 'detected') return;
    expect(outcome.geometry.leftEye.x).toBeLessThan(outcome.geometry.rightEye.x);
  });

  test('clamps a boundary face frame that slightly exceeds the image', () => {
    const face = portraitFace();
    face.frame = { x: -20, y: 288, width: 560, height: 792 };
    const outcome = normalizeDetectionPayload(payload({ faces: [face] }));
    expect(outcome.kind).toBe('detected');
    if (outcome.kind !== 'detected') return;
    expect(outcome.geometry.faceBounds.x).toBe(0);
  });

  test('implausible normalized geometry still resolves to the fixed guide', () => {
    const face = portraitFace();
    // Mouth above the eyes — anatomically impossible for an upright capture.
    face.landmarks.mouthLeft = { x: 480, y: 400 };
    face.landmarks.mouthRight = { x: 600, y: 400 };
    const outcome = normalizeDetectionPayload(payload({ faces: [face] }));
    expect(outcome.kind).toBe('detected');
    if (outcome.kind !== 'detected') return;
    expect(resolveZoneAlignment(outcome.geometry).mode).toBe('fixed_guide');
  });

  test('normalized geometry composes with mirrored display projection', () => {
    const outcome = normalizeDetectionPayload(payload());
    expect(outcome.kind).toBe('detected');
    if (outcome.kind !== 'detected') return;
    const source = { width: 1080, height: 1440 };
    const container = { width: 216, height: 288 };
    const plain = projectPointToContainer(outcome.geometry.leftEye, source, container);
    const mirrored = projectPointToContainer(outcome.geometry.leftEye, source, container, { mirrored: true });
    expect(mirrored.x).toBeCloseTo(container.width - plain.x, 3);
    expect(mirrored.y).toBeCloseTo(plain.y, 3);
  });
});
