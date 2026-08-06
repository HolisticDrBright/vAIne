/**
 * Backend configuration boundary. The Supabase project URL and modern
 * publishable API key arrive exclusively through EXPO_PUBLIC_* environment
 * variables — set locally in an untracked .env file and as EAS environment
 * variables for builds. The publishable key is designed to ship in clients
 * (every table is guarded by RLS and grants), but repo policy still keeps
 * real values out of source control.
 *
 * Validation is shape-strict and fail-closed: only a modern publishable key
 * (`sb_publishable_…`) is accepted. Secret keys (`sb_secret_…`), private key
 * material (a pasted Apple .p8 or any PEM), and legacy JWT-style keys —
 * including the service-role key, which must never reach a client — are
 * rejected, and the app then runs fully local: mock auth, synthetic
 * analysis, no network. Real services must check `isBackendConfigured()`
 * and never guess endpoints.
 */

export interface BackendConfig {
  url: string;
  publishableKey: string;
}

export type BackendConfigProblem =
  | 'missing'
  | 'invalid_url'
  | 'secret_key_rejected'
  | 'legacy_jwt_key_rejected'
  | 'not_a_publishable_key';

export type BackendConfigResolution =
  | { ok: true; config: BackendConfig }
  | { ok: false; problem: BackendConfigProblem };

const PUBLISHABLE_KEY_PREFIX = 'sb_publishable_';
const SECRET_KEY_PREFIX = 'sb_secret_';

export function resolveBackendConfig(env: {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}): BackendConfigResolution {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (url.length === 0 || key.length === 0) return { ok: false, problem: 'missing' };
  if (!url.startsWith('https://')) return { ok: false, problem: 'invalid_url' };

  // Never accept anything with server-side or signing power, regardless of
  // which variable it was pasted into.
  if (key.startsWith(SECRET_KEY_PREFIX) || key.toUpperCase().includes('-----BEGIN')) {
    return { ok: false, problem: 'secret_key_rejected' };
  }
  // Legacy JWT-format API keys (anon or service_role) are also refused: the
  // client supports only the modern publishable key, and a service-role JWT
  // in a shipped app would bypass RLS entirely.
  if (key.startsWith('eyJ')) return { ok: false, problem: 'legacy_jwt_key_rejected' };
  if (!key.startsWith(PUBLISHABLE_KEY_PREFIX) || key.length <= PUBLISHABLE_KEY_PREFIX.length) {
    return { ok: false, problem: 'not_a_publishable_key' };
  }

  return { ok: true, config: { url, publishableKey: key } };
}

declare const __DEV__: boolean | undefined;

let warnedProblem: BackendConfigProblem | null = null;

export function getBackendConfig(): BackendConfig | null {
  const resolution = resolveBackendConfig({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (resolution.ok) return resolution.config;
  // Absent configuration is the normal local mode; a present-but-rejected
  // value is a build misconfiguration worth one dev-console warning. The
  // value itself is never logged.
  if (
    resolution.problem !== 'missing' &&
    warnedProblem !== resolution.problem &&
    typeof __DEV__ !== 'undefined' &&
    __DEV__
  ) {
    warnedProblem = resolution.problem;
    console.warn(`Supabase configuration rejected (${resolution.problem}); running fully local.`);
  }
  return null;
}

export function isBackendConfigured(): boolean {
  return getBackendConfig() !== null;
}
