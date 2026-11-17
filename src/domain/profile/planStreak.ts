import { z } from 'zod';

/**
 * A simple streak of completed plan days.
 *
 * A day counts when the person marks today's plan done. The log holds plain
 * local calendar dates (YYYY-MM-DD) and nothing else: no times, no which
 * steps, no scores. The streak is the run of consecutive days ending today
 * or yesterday, so a person who has not yet done today's plan still sees
 * yesterday's streak rather than a zero. Missing a day resets it; there is
 * no penalty beyond the number starting again.
 */

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_LOGGED_DAYS = 90;

export const planLogSchema = z.object({
  /** Ascending, de-duplicated local calendar dates on which the plan was marked done. */
  completedDays: z.array(z.string().regex(DATE_KEY_PATTERN)).max(MAX_LOGGED_DAYS),
}).strict();

export type PlanLog = z.infer<typeof planLogSchema>;

export const emptyPlanLog: PlanLog = { completedDays: [] };

/** Local calendar date for a moment, in the device's time zone. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The calendar date before a key, computed in UTC so DST never skips or repeats a day. */
export function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day) - 86_400_000);
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}-${String(previous.getUTCDate()).padStart(2, '0')}`;
}

export function markPlanDayDone(log: PlanLog, dateKey: string): PlanLog {
  if (!DATE_KEY_PATTERN.test(dateKey)) return log;
  const days = new Set(log.completedDays);
  days.add(dateKey);
  const completedDays = [...days].sort().slice(-MAX_LOGGED_DAYS);
  return { completedDays };
}

export interface StreakSummary {
  /** Consecutive days ending today or yesterday. */
  current: number;
  longest: number;
  doneToday: boolean;
  totalDays: number;
}

export function computeStreak(log: PlanLog, todayKey: string): StreakSummary {
  const days = new Set(log.completedDays);
  const doneToday = days.has(todayKey);

  let current = 0;
  let cursor = doneToday ? todayKey : previousDateKey(todayKey);
  while (days.has(cursor)) {
    current += 1;
    cursor = previousDateKey(cursor);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous !== null && previousDateKey(day) === previous ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest, doneToday, totalDays: days.size };
}
