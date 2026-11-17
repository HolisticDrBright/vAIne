import { describe, expect, test } from 'vitest';
import {
  DEFAULT_REMINDER,
  REMINDER_CONTENT,
  REMINDER_PRESETS,
  formatReminderTime,
  presetFor,
  reminderPreferenceSchema,
  shiftHour,
} from '../checkInReminder';
import { emptyLocalProfile, isProfileEmpty, parseLocalProfile, withPlanDayDone, withReminder } from '../localProfile';

const NOW = '2026-11-17T12:00:00.000Z';

describe('check-in reminder', () => {
  test('the fixed reminder text reveals nothing about the person', () => {
    const text = `${REMINDER_CONTENT.title} ${REMINDER_CONTENT.body}`;
    expect(text).not.toMatch(/score|photo|skin (looks|is)|redness|pore|wrinkle|\d+\/100|streak|hurry|last chance|only today|expires/i);
    expect(text).toMatch(/today’s plan/);
  });

  test('preferences are a time and a switch, nothing more', () => {
    expect(reminderPreferenceSchema.parse({ enabled: true, hour: 20, minute: 0 })).toEqual({ enabled: true, hour: 20, minute: 0 });
    expect(reminderPreferenceSchema.safeParse({ enabled: true, hour: 24, minute: 0 }).success).toBe(false);
    expect(reminderPreferenceSchema.safeParse({ enabled: true, hour: 8, minute: 60 }).success).toBe(false);
    expect(reminderPreferenceSchema.safeParse({ enabled: true, hour: 8, minute: 0, pushToken: 'x' }).success).toBe(false);
    expect(DEFAULT_REMINDER.enabled).toBe(false);
  });

  test('presets, formatting, and hour stepping', () => {
    expect(REMINDER_PRESETS.map((preset) => preset.label)).toEqual(['Morning', 'Midday', 'Evening']);
    expect(presetFor({ hour: 12, minute: 30 })?.id).toBe('midday');
    expect(presetFor({ hour: 13, minute: 30 })).toBeNull();
    expect(formatReminderTime(0, 5)).toBe('12:05 am');
    expect(formatReminderTime(12, 30)).toBe('12:30 pm');
    expect(formatReminderTime(20, 0)).toBe('8:00 pm');
    expect(shiftHour(23, 1)).toBe(0);
    expect(shiftHour(0, -1)).toBe(23);
  });

  test('the profile remembers the reminder and plan days, and forgets them with everything else', () => {
    let profile = withReminder(emptyLocalProfile, { enabled: true, hour: 8, minute: 0 }, NOW);
    expect(isProfileEmpty(profile)).toBe(false);
    profile = withPlanDayDone(profile, '2026-11-17', NOW);
    expect(profile.planLog?.completedDays).toEqual(['2026-11-17']);
    expect(parseLocalProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
    expect(isProfileEmpty(withReminder({ ...profile, planLog: null }, null, NOW))).toBe(true);
  });

  test('profiles saved before reminders existed still load', () => {
    const legacy = { version: 'local_profile_v1', updatedAtIso: NOW, routineIntake: null, lastCheckIn: null, consentDefaults: null };
    expect(parseLocalProfile(legacy)).toMatchObject({ reminder: null, planLog: null });
  });
});
