import { describe, expect, test } from 'vitest';
import { MAX_IMAGE_BYTES, estimateDecodedBytes, validateRequest } from '../request.ts';

const NOW = '2026-09-05T10:00:00.000Z';
const JPEG = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46));
const PNG = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00));

function capture(overrides: Record<string, unknown> = {}) {
  return { angle: 'front', width: 1200, height: 1600, capturedAtIso: '2026-09-05T09:59:00.000Z', jpegBase64: JPEG, ...overrides };
}

function body(overrides: Record<string, unknown> = {}) {
  return { analysisId: 'analysis-m0abc123-x9y8z7w6', captures: [capture()], goals: [], sensitivityPreference: 'standard', ...overrides };
}

describe('analyze-skin request validation', () => {
  test('accepts a well-formed request and decodes the JPEG', () => {
    const validation = validateRequest(body(), NOW);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.request.captures[0].bytes[0]).toBe(0xff);
    expect(validation.request.requestedAtIso).toBe(NOW);
  });

  test.each([
    ['invalid_body', null],
    ['invalid_analysis_id', body({ analysisId: 'drop table' })],
    ['no_captures', body({ captures: [] })],
    ['too_many_captures', body({ captures: [capture(), capture({ angle: 'left_profile' }), capture({ angle: 'right_profile' }), capture()] })],
    ['duplicate_angle', body({ captures: [capture(), capture()] })],
    ['invalid_angle', body({ captures: [capture({ angle: 'selfie' })] })],
    ['invalid_dimensions', body({ captures: [capture({ width: 100 })] })],
    ['invalid_timestamp', body({ captures: [capture({ capturedAtIso: 'yesterday' })] })],
    ['not_jpeg', body({ captures: [capture({ jpegBase64: PNG })] })],
    ['not_jpeg', body({ captures: [capture({ jpegBase64: 'not base64!!' })] })],
    ['invalid_preferences', body({ goals: ['cure_acne'] })],
    ['invalid_preferences', body({ sensitivityPreference: 'very' })],
  ] as const)('rejects %s', (code, input) => {
    const validation = validateRequest(input, NOW);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.code).toBe(code);
  });

  test('rejects oversized images before decoding them', () => {
    const huge = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1024) * 4 / 3));
    expect(estimateDecodedBytes(huge)).toBeGreaterThan(MAX_IMAGE_BYTES);
    const validation = validateRequest(body({ captures: [capture({ jpegBase64: huge })] }), NOW);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.code).toBe('image_too_large');
  });
});
