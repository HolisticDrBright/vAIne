import { describe, expect, test } from 'vitest';
import { resolveBackendConfig } from '../backendConfig';

const URL = 'https://wfahmuxuldivkwzbtdcg.supabase.co';
const PUBLISHABLE = 'sb_publishable_yKp3mM3RhZFZxWq3vT0Q_A';

describe('backend configuration', () => {
  test('absent or partial configuration keeps the app fully local', () => {
    expect(resolveBackendConfig({})).toEqual({ ok: false, problem: 'missing' });
    expect(resolveBackendConfig({ EXPO_PUBLIC_SUPABASE_URL: URL })).toEqual({ ok: false, problem: 'missing' });
    expect(resolveBackendConfig({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE })).toEqual({
      ok: false,
      problem: 'missing',
    });
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: '  ',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    })).toEqual({ ok: false, problem: 'missing' });
  });

  test('rejects non-HTTPS endpoints outright', () => {
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://insecure.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    })).toEqual({ ok: false, problem: 'invalid_url' });
  });

  test('accepts a modern publishable key and trims whitespace', () => {
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: ` ${URL} `,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ` ${PUBLISHABLE} `,
    })).toEqual({ ok: true, config: { url: URL, publishableKey: PUBLISHABLE } });
  });

  test('rejects secret keys no matter which variable carries them', () => {
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_h81m0Q4YvIkgSMYcXdLGXg',
    })).toEqual({ ok: false, problem: 'secret_key_rejected' });
  });

  test('rejects pasted private-key material such as an Apple .p8', () => {
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '-----BEGIN PRIVATE KEY-----\nMIGT…\n-----END PRIVATE KEY-----',
    })).toEqual({ ok: false, problem: 'secret_key_rejected' });
  });

  test('rejects legacy JWT-format keys, including service-role JWTs', () => {
    // Shape-only fixture: header.payload.signature starting with eyJ, the
    // format every legacy Supabase API key (anon and service_role) shares.
    const legacyJwtShapedKey = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig';
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyJwtShapedKey,
    })).toEqual({ ok: false, problem: 'legacy_jwt_key_rejected' });
  });

  test('rejects values that are not publishable keys at all', () => {
    for (const value of ['publishable-key', 'sb_publishable_', 'anon-key-from-old-docs']) {
      expect(resolveBackendConfig({
        EXPO_PUBLIC_SUPABASE_URL: URL,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value,
      })).toEqual({ ok: false, problem: 'not_a_publishable_key' });
    }
  });
});
