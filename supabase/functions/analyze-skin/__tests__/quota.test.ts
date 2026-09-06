import { describe, expect, test } from 'vitest';
import { DEFAULT_LIMITS, decideQuota, parseLimits, periodKeys } from '../quota.ts';

const idle = { userDaily: 0, userMonthly: 0, globalDaily: 0, activeBetaUsersExcludingCaller: 0, callerSeenThisMonth: false };

describe('analyze-skin quotas', () => {
  test('reads limits from rows and falls back per key', () => {
    const limits = parseLimits([{ key: 'per_user_daily', value: 5 }, { key: 'global_daily', value: -1 }]);
    expect(limits.perUserDaily).toBe(5);
    expect(limits.globalDaily).toBe(DEFAULT_LIMITS.globalDaily);
  });

  test('allows an idle caller and blocks each ceiling', () => {
    expect(decideQuota(DEFAULT_LIMITS, idle, 3)).toEqual({ allowed: true });
    expect(decideQuota(DEFAULT_LIMITS, { ...idle, userDaily: 3 }, 3)).toEqual({ allowed: false, code: 'quota_daily' });
    expect(decideQuota(DEFAULT_LIMITS, { ...idle, userMonthly: 20 }, 3)).toEqual({ allowed: false, code: 'quota_monthly' });
    expect(decideQuota(DEFAULT_LIMITS, { ...idle, globalDaily: 100 }, 3)).toEqual({ allowed: false, code: 'quota_global' });
    expect(decideQuota(DEFAULT_LIMITS, idle, 7)).toEqual({ allowed: false, code: 'too_many_images' });
  });

  test('caps new beta users but never locks out someone already active this month', () => {
    expect(decideQuota(DEFAULT_LIMITS, { ...idle, activeBetaUsersExcludingCaller: 50 }, 3)).toEqual({ allowed: false, code: 'beta_full' });
    expect(decideQuota(DEFAULT_LIMITS, { ...idle, activeBetaUsersExcludingCaller: 50, callerSeenThisMonth: true }, 3)).toEqual({ allowed: true });
  });

  test('derives UTC period keys', () => {
    expect(periodKeys('2026-09-05T23:59:59.000Z')).toEqual({ day: '2026-09-05', month: '2026-09' });
  });
});
