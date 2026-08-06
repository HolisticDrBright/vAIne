/**
 * Backend configuration boundary. The Supabase project URL and anon
 * (publishable) key arrive exclusively through EXPO_PUBLIC_* environment
 * variables — set locally in an untracked .env file and in EAS environment
 * variables for builds. Nothing here is a secret (the anon key is designed
 * to ship in clients and every table is guarded by RLS), but repo policy
 * keeps all credentials out of source control anyway.
 *
 * When the configuration is absent the app runs fully local: mock auth,
 * synthetic analysis, no network. Real services must check
 * `isBackendConfigured()` and never guess endpoints.
 */

export interface BackendConfig {
  url: string;
  anonKey: string;
}

export function resolveBackendConfig(env: {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
}): BackendConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (!url.startsWith('https://')) return null;
  return { url, anonKey };
}

export function getBackendConfig(): BackendConfig | null {
  return resolveBackendConfig({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function isBackendConfigured(): boolean {
  return getBackendConfig() !== null;
}
