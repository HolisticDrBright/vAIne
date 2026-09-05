/**
 * Beta limits and quota decisions. Pure: the caller supplies the counts.
 * Limits come from public.beta_limits so caps can tighten without a release.
 */

export interface BetaLimits {
  perUserDaily: number;
  perUserMonthly: number;
  globalDaily: number;
  maxImagesPerAnalysis: number;
  maxBetaUsers: number;
}

export const DEFAULT_LIMITS: BetaLimits = {
  perUserDaily: 3,
  perUserMonthly: 20,
  globalDaily: 100,
  maxImagesPerAnalysis: 6,
  maxBetaUsers: 50,
};

export function parseLimits(rows: readonly { key: string; value: number }[]): BetaLimits {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: string, fallback: number) => {
    const value = byKey.get(key);
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  return {
    perUserDaily: read('per_user_daily', DEFAULT_LIMITS.perUserDaily),
    perUserMonthly: read('per_user_monthly', DEFAULT_LIMITS.perUserMonthly),
    globalDaily: read('global_daily', DEFAULT_LIMITS.globalDaily),
    maxImagesPerAnalysis: read('max_images_per_analysis', DEFAULT_LIMITS.maxImagesPerAnalysis),
    maxBetaUsers: read('max_beta_users', DEFAULT_LIMITS.maxBetaUsers),
  };
}

export interface UsageSnapshot {
  userDaily: number;
  userMonthly: number;
  globalDaily: number;
  /** Distinct users with any usage this month, excluding the caller. */
  activeBetaUsersExcludingCaller: number;
  callerSeenThisMonth: boolean;
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; code: 'quota_daily' | 'quota_monthly' | 'quota_global' | 'beta_full' | 'too_many_images' };

export function decideQuota(limits: BetaLimits, usage: UsageSnapshot, imageCount: number): QuotaDecision {
  if (imageCount > limits.maxImagesPerAnalysis) return { allowed: false, code: 'too_many_images' };
  if (usage.globalDaily >= limits.globalDaily) return { allowed: false, code: 'quota_global' };
  if (usage.userDaily >= limits.perUserDaily) return { allowed: false, code: 'quota_daily' };
  if (usage.userMonthly >= limits.perUserMonthly) return { allowed: false, code: 'quota_monthly' };
  if (!usage.callerSeenThisMonth && usage.activeBetaUsersExcludingCaller >= limits.maxBetaUsers) {
    return { allowed: false, code: 'beta_full' };
  }
  return { allowed: true };
}

/** UTC period keys used by usage_counters / global_counters. */
export function periodKeys(nowIso: string): { day: string; month: string } {
  const day = nowIso.slice(0, 10);
  return { day, month: day.slice(0, 7) };
}
