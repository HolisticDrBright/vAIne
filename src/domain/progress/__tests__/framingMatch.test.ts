import { describe, expect, test } from 'vitest';
import type { DetectedFaceGeometry } from '../../zones/zoneAlignment';
import {
  MAX_MATCH_CENTER_OFFSET,
  MAX_MATCH_ROLL_DELTA_DEGREES,
  MAX_MATCH_SIZE_RATIO_DELTA,
  assessFramingMatch,
  describeFramingMatch,
  framingMatchBadge,
  framingSnapshotFrom,
  type FramingSnapshot,
} from '../framingMatch';

const portrait = { width: 1080, height: 1440 };

const geometry: DetectedFaceGeometry = {
  faceBounds: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
  leftEye: { x: 0.38, y: 0.42 },
  rightEye: { x: 0.62, y: 0.42 },
  noseTip: { x: 0.5, y: 0.55 },
  mouthCenter: { x: 0.5, y: 0.65 },
  confidence: 1,
};

const baseline: FramingSnapshot = { faceBounds: geometry.faceBounds, rollDegrees: 0 };

describe('framing snapshots', () => {
  test('derives bounds and roll from a full detection', () => {
    const snapshot = framingSnapshotFrom({ kind: 'detected', geometry }, portrait);
    expect(snapshot).toEqual({ faceBounds: geometry.faceBounds, rollDegrees: 0 });
  });

  test('keeps the face box when landmarks are missing and assesses no tilt', () => {
    expect(framingSnapshotFrom({ kind: 'landmarks_missing', faceBounds: geometry.faceBounds }, portrait)).toEqual({ faceBounds: geometry.faceBounds, rollDegrees: null });
    expect(framingSnapshotFrom({ kind: 'landmarks_missing', faceBounds: null }, portrait)).toBeNull();
  });

  test('is null when detection found no usable face or did not run', () => {
    expect(framingSnapshotFrom({ kind: 'no_face' }, portrait)).toBeNull();
    expect(framingSnapshotFrom({ kind: 'multiple_faces', count: 2 }, portrait)).toBeNull();
    expect(framingSnapshotFrom({ kind: 'unavailable', reason: 'platform_unsupported' }, portrait)).toBeNull();
    expect(framingSnapshotFrom(undefined, portrait)).toBeNull();
  });
});

describe('framing match', () => {
  test('matches a near-identical framing', () => {
    const current: FramingSnapshot = { faceBounds: { x: 0.26, y: 0.21, width: 0.52, height: 0.56 }, rollDegrees: 2 };
    const result = assessFramingMatch(baseline, current);
    expect(result.kind).toBe('matched');
    expect(framingMatchBadge(result)).toEqual({ label: 'FRAMING MATCHED', tone: 'green' });
    expect(describeFramingMatch(result)).toMatch(/Lighting is not measured/);
  });

  test('flags a face that moved across the frame', () => {
    const shift = MAX_MATCH_CENTER_OFFSET + 0.02;
    const result = assessFramingMatch(baseline, { faceBounds: { ...geometry.faceBounds, x: geometry.faceBounds.x + shift }, rollDegrees: 0 });
    expect(result).toMatchObject({ kind: 'not_matched', mismatches: ['position'] });
    expect(describeFramingMatch(result)).toMatch(/different part of the frame/);
  });

  test('flags a different distance from the camera in either direction', () => {
    const grow = 1 + MAX_MATCH_SIZE_RATIO_DELTA + 0.05;
    const closer = assessFramingMatch(baseline, { faceBounds: { x: 0.25 - (0.5 * (grow - 1)) / 2, y: 0.2, width: 0.5 * grow, height: 0.55 }, rollDegrees: 0 });
    expect(closer).toMatchObject({ kind: 'not_matched', mismatches: ['distance'] });
    const further = assessFramingMatch(baseline, { faceBounds: { x: 0.3, y: 0.25, width: 0.4, height: 0.45 }, rollDegrees: 0 });
    expect(further).toMatchObject({ kind: 'not_matched', mismatches: ['distance'] });
  });

  test('flags a different head tilt only when both photos have landmarks', () => {
    const tilted = assessFramingMatch(baseline, { faceBounds: geometry.faceBounds, rollDegrees: MAX_MATCH_ROLL_DELTA_DEGREES + 1 });
    expect(tilted).toMatchObject({ kind: 'not_matched', mismatches: ['tilt'] });
    const noLandmarks = assessFramingMatch(baseline, { faceBounds: geometry.faceBounds, rollDegrees: null });
    expect(noLandmarks).toMatchObject({ kind: 'matched', rollDelta: null });
  });

  test('reports every mismatch at once', () => {
    const result = assessFramingMatch(baseline, { faceBounds: { x: 0.05, y: 0.05, width: 0.3, height: 0.33 }, rollDegrees: 20 });
    expect(result).toMatchObject({ kind: 'not_matched', mismatches: ['position', 'distance', 'tilt'] });
  });

  test('says when it could not check rather than guessing', () => {
    expect(assessFramingMatch(null, baseline)).toEqual({ kind: 'unknown', reason: 'baseline_not_located' });
    expect(assessFramingMatch(baseline, null)).toEqual({ kind: 'unknown', reason: 'current_not_located' });
    expect(framingMatchBadge({ kind: 'unknown', reason: 'current_not_located' })).toEqual({ label: 'FRAMING NOT CHECKED', tone: 'muted' });
    expect(describeFramingMatch({ kind: 'unknown', reason: 'baseline_not_located' })).toMatch(/baseline photo/);
  });

  test('never claims to have judged lighting or skin', () => {
    for (const result of [
      assessFramingMatch(baseline, baseline),
      assessFramingMatch(baseline, { faceBounds: { x: 0.05, y: 0.05, width: 0.3, height: 0.33 }, rollDegrees: 20 }),
      assessFramingMatch(null, null),
    ]) {
      expect(describeFramingMatch(result)).not.toMatch(/improv|better|worse|lighting matched|skin (looks|has)/i);
    }
  });
});
