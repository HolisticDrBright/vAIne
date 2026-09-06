import { describe, expect, test } from 'vitest';
import {
  areReadinessChecksComplete,
  assessCaptureMetadata,
  EMPTY_READINESS_STATE,
  REQUIRED_CAPTURE_ANGLES,
} from '../captureQuality';

describe('capture quality gate', () => {
  test('requires the full front and profile sequence', () => {
    expect(REQUIRED_CAPTURE_ANGLES).toEqual(['front', 'left_profile', 'right_profile']);
  });

  test('does not enable capture until every readiness check is confirmed', () => {
    expect(areReadinessChecksComplete(EMPTY_READINESS_STATE)).toBe(false);
    expect(areReadinessChecksComplete({
      even_lighting: true,
      face_centered: true,
      lens_clean: true,
      no_filter_or_heavy_makeup: true,
    })).toBe(true);
  });

  test('rejects missing, invalid, or low-resolution captures', () => {
    expect(assessCaptureMetadata({ uri: '', width: 1080, height: 1440 })).toContain('missing_image');
    expect(assessCaptureMetadata({ uri: 'file://capture.jpg', width: 0, height: 1440 })).toContain('invalid_dimensions');
    expect(assessCaptureMetadata({ uri: 'file://capture.jpg', width: 640, height: 960 })).toContain('resolution_too_low');
  });

  test('accepts a local portrait with sufficient dimensions', () => {
    expect(assessCaptureMetadata({ uri: 'file://capture.jpg', width: 1080, height: 1440 })).toEqual([]);
  });
});
