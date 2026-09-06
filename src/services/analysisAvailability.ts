import { getSupabaseClient } from './supabaseClient';

/**
 * Reads the analysis kill switch. The flag is readable by every client so the
 * app can say "live analysis is off" honestly instead of guessing. Any error
 * reads as unavailable.
 */
export async function isLiveAnalysisEnabled(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { data, error } = await client.from('app_flags').select('enabled').eq('key', 'analysis_enabled').maybeSingle();
    if (error) return false;
    return Boolean((data as { enabled?: boolean } | null)?.enabled);
  } catch {
    return false;
  }
}
