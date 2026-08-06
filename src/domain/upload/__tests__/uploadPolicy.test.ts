import { describe, expect, test } from 'vitest';
import {
  describeUploadRejection,
  isSlotExpired,
  sniffImageType,
  UPLOAD_LIMITS,
  validateUploadSet,
  type UploadCandidate,
} from '../uploadPolicy';

function jpeg(label: string, overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return { label, sniffedType: 'image/jpeg', bytes: 2_000_000, width: 1080, height: 1440, ...overrides };
}

describe('image type sniffing', () => {
  test('recognizes JPEG magic bytes', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
  });

  test('recognizes HEIC ftyp brands', () => {
    const heic = new Uint8Array(16);
    heic.set([0, 0, 0, 24]);
    heic.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
    heic.set([0x68, 0x65, 0x69, 0x63], 8); // "heic"
    expect(sniffImageType(heic)).toBe('image/heic');
    heic.set([0x6d, 0x69, 0x66, 0x31], 8); // "mif1"
    expect(sniffImageType(heic)).toBe('image/heic');
  });

  test('rejects PNG, WebP, and truncated headers as unknown', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe('unknown');
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
    webp.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
    expect(sniffImageType(webp)).toBe('unknown');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBe('unknown');
  });
});

describe('upload set validation', () => {
  test('accepts a valid quick-scan set', () => {
    expect(validateUploadSet([jpeg('front'), jpeg('left_profile'), jpeg('right_profile')])).toEqual({ ok: true });
  });

  test('rejects an empty set and an oversized set', () => {
    expect(validateUploadSet([])).toEqual({ ok: false, rejections: [{ label: null, reason: 'no_images' }] });
    const seven = Array.from({ length: 7 }, (_, index) => jpeg(`photo-${index}`));
    const result = validateUploadSet(seven);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections).toContainEqual({ label: null, reason: 'too_many_images' });
  });

  test('rejects sniffed non-JPEG/HEIC types regardless of any filename', () => {
    const result = validateUploadSet([jpeg('front', { sniffedType: 'unknown' })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections).toContainEqual({ label: 'front', reason: 'unsupported_type' });
  });

  test('rejects oversized files, zero-byte files, and out-of-range dimensions', () => {
    const result = validateUploadSet([
      jpeg('front', { bytes: UPLOAD_LIMITS.maxBytesPerImage + 1 }),
      jpeg('left_profile', { bytes: 0 }),
      jpeg('right_profile', { width: 200, height: 900 }),
      jpeg('upper_face', { width: 1080, height: 7000 }),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections).toContainEqual({ label: 'front', reason: 'file_too_large' });
    expect(result.rejections).toContainEqual({ label: 'left_profile', reason: 'file_too_large' });
    expect(result.rejections).toContainEqual({ label: 'right_profile', reason: 'dimensions_out_of_range' });
    expect(result.rejections).toContainEqual({ label: 'upper_face', reason: 'dimensions_out_of_range' });
  });

  test('accepts boundary sizes exactly at the limits', () => {
    expect(validateUploadSet([
      jpeg('front', {
        bytes: UPLOAD_LIMITS.maxBytesPerImage,
        width: UPLOAD_LIMITS.minDimensionPx,
        height: UPLOAD_LIMITS.maxDimensionPx,
      }),
    ])).toEqual({ ok: true });
  });

  test('rejects duplicate photo positions', () => {
    const result = validateUploadSet([jpeg('front'), jpeg('front')]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejections).toContainEqual({ label: 'front', reason: 'duplicate_label' });
  });

  test('every rejection reason has user copy that never blames formats vaguely', () => {
    for (const reason of [
      'no_images', 'too_many_images', 'duplicate_label', 'unsupported_type', 'file_too_large', 'dimensions_out_of_range',
    ] as const) {
      expect(describeUploadRejection(reason).length).toBeGreaterThan(15);
    }
  });
});

describe('upload slot expiry', () => {
  const slot = { analysisId: 'analysis-1', issuedAtIso: '2026-08-06T12:00:00.000Z' };

  test('honors the ten-minute application expiry, not the platform ceiling', () => {
    expect(isSlotExpired(slot, '2026-08-06T12:09:59.000Z')).toBe(false);
    expect(isSlotExpired(slot, '2026-08-06T12:10:00.000Z')).toBe(true);
    expect(isSlotExpired(slot, '2026-08-06T13:59:00.000Z')).toBe(true);
  });

  test('a server-provided shorter lifetime wins', () => {
    expect(isSlotExpired({ ...slot, lifetimeMs: 60_000 }, '2026-08-06T12:01:00.000Z')).toBe(true);
  });

  test('unparseable timestamps are treated as expired, never as valid', () => {
    expect(isSlotExpired({ analysisId: 'x', issuedAtIso: 'garbage' }, '2026-08-06T12:00:00.000Z')).toBe(true);
  });
});
