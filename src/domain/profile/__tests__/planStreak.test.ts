import { describe, expect, test } from 'vitest';
import {
  MAX_LOGGED_DAYS,
  computeStreak,
  emptyPlanLog,
  markPlanDayDone,
  planLogSchema,
  previousDateKey,
  toDateKey,
} from '../planStreak';

describe('plan streak', () => {
  test('date keys are local calendar dates and step back across month and year ends', () => {
    expect(toDateKey(new Date(2026, 10, 17, 23, 59))).toBe('2026-11-17');
    expect(toDateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
    expect(previousDateKey('2028-03-01')).toBe('2028-02-29');
  });

  test('marking a day is idempotent, sorted, and capped', () => {
    let log = markPlanDayDone(emptyPlanLog, '2026-11-17');
    log = markPlanDayDone(log, '2026-11-15');
    log = markPlanDayDone(log, '2026-11-17');
    expect(log.completedDays).toEqual(['2026-11-15', '2026-11-17']);
    expect(markPlanDayDone(log, 'not a date')).toEqual(log);

    let long = emptyPlanLog;
    for (let day = 1; day <= 31; day += 1) long = markPlanDayDone(long, `2026-01-${String(day).padStart(2, '0')}`);
    for (let day = 1; day <= 28; day += 1) long = markPlanDayDone(long, `2026-02-${String(day).padStart(2, '0')}`);
    for (let day = 1; day <= 31; day += 1) long = markPlanDayDone(long, `2026-03-${String(day).padStart(2, '0')}`);
    for (let day = 1; day <= 30; day += 1) long = markPlanDayDone(long, `2026-04-${String(day).padStart(2, '0')}`);
    expect(long.completedDays).toHaveLength(MAX_LOGGED_DAYS);
    expect(long.completedDays[long.completedDays.length - 1]).toBe('2026-04-30');
    expect(() => planLogSchema.parse(long)).not.toThrow();
  });

  test('counts consecutive days ending today', () => {
    const log = { completedDays: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'] };
    expect(computeStreak(log, '2026-11-17')).toEqual({ current: 4, longest: 4, doneToday: true, totalDays: 4 });
  });

  test('keeps yesterday’s streak alive until today is done, then resets after a missed day', () => {
    const log = { completedDays: ['2026-11-15', '2026-11-16'] };
    expect(computeStreak(log, '2026-11-17')).toMatchObject({ current: 2, doneToday: false });
    expect(computeStreak(log, '2026-11-18')).toMatchObject({ current: 0, doneToday: false, longest: 2 });
    expect(computeStreak(markPlanDayDone(log, '2026-11-17'), '2026-11-17')).toMatchObject({ current: 3, doneToday: true });
  });

  test('tracks the longest run separately from the current one', () => {
    const log = { completedDays: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-10', '2026-11-17'] };
    expect(computeStreak(log, '2026-11-17')).toEqual({ current: 1, longest: 4, doneToday: true, totalDays: 6 });
    expect(computeStreak(emptyPlanLog, '2026-11-17')).toEqual({ current: 0, longest: 0, doneToday: false, totalDays: 0 });
  });

  test('the log holds calendar dates only', () => {
    expect(planLogSchema.safeParse({ completedDays: ['2026-11-17T20:00:00Z'] }).success).toBe(false);
    expect(planLogSchema.safeParse({ completedDays: ['2026-11-17'], scores: [81] }).success).toBe(false);
  });
});
