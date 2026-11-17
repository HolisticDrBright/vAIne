import { z } from 'zod';

/**
 * A once-a-day check-in reminder, scheduled locally on the device.
 *
 * The reminder is a plain local notification: no push token, no server, and
 * nothing about the person's skin, scores, or photos in its text. The system
 * permission prompt is shown only after a warm-up screen has explained what
 * the reminder does and the person has chosen a time, so a "no" is informed
 * and a "yes" is not a reflex.
 */

export const reminderPreferenceSchema = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
}).strict();

export type ReminderPreference = z.infer<typeof reminderPreferenceSchema>;

export interface ReminderPreset {
  id: 'morning' | 'midday' | 'evening';
  label: string;
  hour: number;
  minute: number;
}

export const REMINDER_PRESETS: readonly ReminderPreset[] = [
  { id: 'morning', label: 'Morning', hour: 8, minute: 0 },
  { id: 'midday', label: 'Midday', hour: 12, minute: 30 },
  { id: 'evening', label: 'Evening', hour: 20, minute: 0 },
];

export const DEFAULT_REMINDER: ReminderPreference = { enabled: false, hour: 20, minute: 0 };

/**
 * The only text a reminder ever carries. It names no result, score, product,
 * or photo, so a lock screen reveals nothing about the person's skin.
 */
export const REMINDER_CONTENT = {
  title: 'Time for today’s plan',
  body: 'A couple of minutes for your skin routine. Open vAIne when you are ready.',
} as const;

/** Stable identifier so re-scheduling replaces rather than stacks reminders. */
export const REMINDER_IDENTIFIER = 'vaine-daily-check-in';

export function formatReminderTime(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function presetFor(preference: Pick<ReminderPreference, 'hour' | 'minute'>): ReminderPreset | null {
  return REMINDER_PRESETS.find((preset) => preset.hour === preference.hour && preset.minute === preference.minute) ?? null;
}

/** Moves the hour by one in either direction, wrapping around the day. */
export function shiftHour(hour: number, delta: 1 | -1): number {
  return (hour + delta + 24) % 24;
}
