import { describe, expect, test } from 'vitest';
import { resolveBackendConfig } from '../backendConfig';

describe('backend configuration', () => {
  test('absent or partial configuration keeps the app fully local', () => {
    expect(resolveBackendConfig({})).toBeNull();
    expect(resolveBackendConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(resolveBackendConfig({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'key' })).toBeNull();
    expect(resolveBackendConfig({ EXPO_PUBLIC_SUPABASE_URL: '  ', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'key' })).toBeNull();
  });

  test('rejects non-HTTPS endpoints outright', () => {
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://insecure.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'key',
    })).toBeNull();
  });

  test('accepts a complete HTTPS configuration', () => {
    expect(resolveBackendConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://wfahmuxuldivkwzbtdcg.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'publishable-key',
    })).toEqual({
      url: 'https://wfahmuxuldivkwzbtdcg.supabase.co',
      anonKey: 'publishable-key',
    });
  });
});
