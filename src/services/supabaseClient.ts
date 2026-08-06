import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBackendConfig } from './backendConfig';

/**
 * Lazily constructed Supabase client for the vaine-beta backend. Holds only
 * the publishable configuration; every privileged operation lives in Edge
 * Functions. Returns null when the app runs without a configured backend so
 * callers fall back to local-only behavior instead of guessing.
 */
let client: SupabaseClient | null = null;
let initialized = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (initialized) return client;
  initialized = true;
  const config = getBackendConfig();
  if (!config) return null;
  client = createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
