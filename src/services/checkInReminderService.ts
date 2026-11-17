import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { REMINDER_CONTENT, REMINDER_IDENTIFIER, type ReminderPreference } from '@/domain/profile/checkInReminder';

/**
 * Thin wrapper over expo-notifications for the single daily reminder.
 *
 * Everything is local: no push token is requested, no server is involved,
 * and the notification text is the fixed, content-free copy from the domain
 * module. On web the service reports itself unavailable instead of throwing.
 */

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface CheckInReminderService {
  getPermission(): Promise<{ status: ReminderPermission; canAskAgain: boolean }>;
  /** Shows the system prompt. Call only after the warm-up screen. */
  requestPermission(): Promise<{ status: ReminderPermission; canAskAgain: boolean }>;
  /** Replaces any existing daily reminder with one at the given local time. */
  schedule(preference: Pick<ReminderPreference, 'hour' | 'minute'>): Promise<void>;
  cancel(): Promise<void>;
}

function toPermission(response: Notifications.NotificationPermissionsStatus): { status: ReminderPermission; canAskAgain: boolean } {
  if (response.granted) return { status: 'granted', canAskAgain: response.canAskAgain };
  if (response.status === 'undetermined') return { status: 'undetermined', canAskAgain: true };
  return { status: 'denied', canAskAgain: response.canAskAgain };
}

const nativeService: CheckInReminderService = {
  async getPermission() {
    return toPermission(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    return toPermission(await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    }));
  },
  async schedule(preference) {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: { title: REMINDER_CONTENT.title, body: REMINDER_CONTENT.body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: preference.hour,
        minute: preference.minute,
      },
    });
  },
  async cancel() {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => undefined);
  },
};

const unavailableService: CheckInReminderService = {
  async getPermission() { return { status: 'unavailable', canAskAgain: false }; },
  async requestPermission() { return { status: 'unavailable', canAskAgain: false }; },
  async schedule() { /* no-op on web */ },
  async cancel() { /* no-op on web */ },
};

export const checkInReminderService: CheckInReminderService = Platform.OS === 'web' ? unavailableService : nativeService;

/**
 * Shows the reminder as a quiet banner when the app is already open. It
 * carries no badge count, so nothing accumulates on the icon.
 */
export function installForegroundReminderHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
