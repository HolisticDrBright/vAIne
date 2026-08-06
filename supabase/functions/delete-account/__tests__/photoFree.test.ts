import { describe, expect, test } from 'vitest';
import { findPhotoDataViolations, isPhotoFree } from '../photoFree.ts';

function reasons(value: unknown, options?: Parameters<typeof findPhotoDataViolations>[1]) {
  return findPhotoDataViolations(value, options).map((violation) => violation.reason);
}

describe('URI and path detection survives case and encoding bypasses', () => {
  test('lowercase, uppercase, and mixed-case URI schemes are all caught', () => {
    expect(reasons({ note: 'file:///var/photo/x' })).toContain('uri_value');
    expect(reasons({ note: 'FILE:///VAR/PHOTO/X' })).toContain('uri_value');
    expect(reasons({ note: 'FiLe:///Var/Photo/X' })).toContain('uri_value');
    expect(reasons({ note: 'CONTENT://media/1' })).toContain('uri_value');
    expect(reasons({ note: 'Ph://ASSET-ID' })).toContain('uri_value');
    expect(reasons({ note: 'HTTPS://bucket.example/signed?token=x' })).toContain('uri_value');
    expect(reasons({ note: 'blob:null/abc' })).toContain('uri_value');
  });

  test('data URLs are caught in any case, including data:image payloads', () => {
    expect(reasons({ note: 'data:image/png;base64,iVBORw0' }).length).toBeGreaterThan(0);
    expect(reasons({ note: 'DATA:IMAGE/JPEG;BASE64,/9j/4AA' }).length).toBeGreaterThan(0);
    expect(reasons({ note: 'Data:Image/Webp;Base64,UklGR' }).length).toBeGreaterThan(0);
    expect(reasons({ note: 'data:application/octet-stream;base64,QUJD' }).length).toBeGreaterThan(0);
  });

  test('percent-encoded and doubly-encoded schemes are decoded and caught', () => {
    expect(reasons({ note: '%66%69%6C%65%3A%2F%2Fetc' })).toContain('uri_value');
    expect(reasons({ note: 'https%3A%2F%2Fbucket%2Fsigned' })).toContain('uri_value');
    expect(reasons({ note: '%2566%2569%256C%2565%253A%252F%252Fdeep' })).toContain('uri_value');
    expect(reasons({ note: 'data%3Aimage%2Fpng%3Bbase64%2CAAAA' }).length).toBeGreaterThan(0);
  });

  test('whitespace smuggling inside a scheme is collapsed and caught', () => {
    expect(reasons({ note: 'f i l e : / / secret' })).toContain('uri_value');
    expect(reasons({ note: 'https :// bucket/pic' })).toContain('uri_value');
  });

  test('storage-shaped paths and image filenames are caught without a scheme', () => {
    expect(reasons({ note: '/storage/v1/object/sign/analysis-uploads/u/a' })).toContain(
      'storage_path_value',
    );
    expect(reasons({ note: 'analysis-uploads/user/analysis/front' })).toContain(
      'storage_path_value',
    );
    expect(reasons({ note: 'removed front.jpg and left.HEIC' })).toContain('image_filename_value');
    expect(
      reasons({ note: '0a1b2c3d-0000-1111-2222-333344445555/abcd/ef01/' }),
    ).toContain('storage_path_value');
  });
});

describe('base64, token, and email detection', () => {
  test('long base64 runs and explicit base64 markers are caught', () => {
    const run = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo'.repeat(5);
    expect(reasons({ payload: run })).toContain('base64_value');
    expect(reasons({ payload: 'x;base64,shortchunk' })).toContain('base64_value');
  });

  test('JWT-shaped strings and email addresses are caught', () => {
    expect(
      reasons({ note: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig' }),
    ).toContain('token_like_value');
    expect(reasons({ note: 'contact me at Person.Name+tag@Example-Site.com please' })).toContain(
      'email_like_value',
    );
  });

  test('a 64-character hex digest (an HMAC email hash) is allowed', () => {
    expect(isPhotoFree({ digest: 'ab'.repeat(32) })).toBe(true);
  });
});

describe('suspicious keys, including alternate names, nesting, and arrays', () => {
  test('alternate key spellings for photo data are suspicious regardless of value', () => {
    for (const key of [
      'uri',
      'photoUri',
      'img_src',
      'IMAGE',
      'Picture',
      'signedUrl',
      'storagePath',
      'faceGeometry',
      'landmarks',
      'exifData',
      'thumbBase64',
      'accessToken',
      'userEmail',
    ]) {
      expect(reasons({ [key]: 'harmless' }), key).toContain('suspicious_key');
    }
  });

  test('violations are found arbitrarily deep and inside arrays', () => {
    const nested = { a: { b: [{ c: { d: 'https://bucket/pic' } }] } };
    const violations = findPhotoDataViolations(nested);
    expect(violations.map((violation) => violation.reason)).toContain('uri_value');
    expect(violations[0].path).toBe('a.b[0].c.d');
    expect(reasons(['fine', 'file://x'])).toContain('uri_value');
  });

  test('a key that is itself a URL is caught without leaking it into the report', () => {
    const violations = findPhotoDataViolations({ 'https://evil.example/x.jpg': 1 });
    expect(violations.length).toBeGreaterThan(0);
    for (const violation of violations) {
      expect(violation.path).not.toContain('evil');
      expect(violation.path).not.toContain('https');
    }
  });

  test('allowedKeyNames permits an exact legitimate key but still scans its value', () => {
    const options = { allowedKeyNames: ['imageQuality'] };
    expect(reasons({ imageQuality: 'usable' })).toContain('suspicious_key');
    expect(reasons({ imageQuality: 'usable' }, options)).toEqual([]);
    expect(reasons({ imageQuality: 'file://x' }, options)).toContain('uri_value');
  });
});

describe('binary and structural payloads', () => {
  test('typed arrays, ArrayBuffers, and long numeric arrays are rejected', () => {
    expect(reasons({ data: new Uint8Array([1, 2, 3]) })).toContain('binary_buffer');
    expect(reasons({ data: new ArrayBuffer(8) })).toContain('binary_buffer');
    expect(reasons({ data: Array.from({ length: 64 }, (_, index) => index) })).toContain(
      'numeric_buffer',
    );
  });

  test('non-JSON values are rejected: class instances, NaN, cycles, extreme depth', () => {
    expect(reasons({ when: new Date(0) })).toContain('unsupported_type');
    expect(reasons({ n: Number.NaN })).toContain('unsupported_type');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(reasons(cyclic)).toContain('unserializable_value');
    let deep: unknown = 'leaf';
    for (let index = 0; index < 20; index += 1) deep = { next: deep };
    expect(reasons(deep)).toContain('max_depth_exceeded');
  });

  test('oversized strings, arrays, and objects are rejected', () => {
    expect(reasons({ note: 'a '.repeat(600) })).toContain('oversized_text');
    expect(reasons({ list: Array.from({ length: 1001 }, () => 'x') })).toContain(
      'oversized_array',
    );
    const wide: Record<string, number> = {};
    for (let index = 0; index < 201; index += 1) wide[`k${index}`] = index;
    expect(reasons(wide)).toContain('oversized_object');
  });
});

describe('innocent content passes', () => {
  test('ordinary audit shapes and prose produce no violations', () => {
    expect(isPhotoFree({ v: 1, stage: 'completed', objects_removed: 3 })).toBe(true);
    expect(isPhotoFree({ reason: 'The uploaded picture was removed after analysis.' })).toBe(true);
    expect(isPhotoFree({ note: 'Retake in brighter, even lighting — avoid backlight.' })).toBe(
      true,
    );
    expect(isPhotoFree({ summary: 'Deleted 3 objects and 2 rows; deletion completed.' })).toBe(
      true,
    );
    expect(isPhotoFree(['completed', 'retake_required'])).toBe(true);
    expect(isPhotoFree({ count: 0, ratio: 0.25, ok: true, missing: null })).toBe(true);
    expect(isPhotoFree(42)).toBe(true);
    expect(isPhotoFree(null)).toBe(true);
  });

  test('short numeric arrays and hyphenated prose are not flagged', () => {
    expect(isPhotoFree({ scores: [72, 64, 88] })).toBe(true);
    expect(isPhotoFree({ note: 'well-known, low-risk clean-up pass' })).toBe(true);
  });
});
