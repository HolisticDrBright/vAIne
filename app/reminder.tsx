import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { InfoCard, LegalNote, PrimaryButton, Screen, SecondaryButton } from '@/components/AppChrome';
import {
  DEFAULT_REMINDER,
  REMINDER_CONTENT,
  REMINDER_PRESETS,
  formatReminderTime,
  presetFor,
  shiftHour,
  type ReminderPreference,
} from '@/domain/profile/checkInReminder';
import { withReminder } from '@/domain/profile/localProfile';
import { checkInReminderService, type ReminderPermission } from '@/services/checkInReminderService';
import { useLocalProfile } from '@/state/LocalProfileContext';
import { colors, fonts, radius, shadows } from '@/theme';

/**
 * Warm-up screen for the daily reminder. It explains what the reminder is,
 * lets the person choose a time, and only then asks the operating system
 * for permission, so the system prompt never appears cold.
 */
export default function ReminderScreen() {
  const { profile, status, updateProfile } = useLocalProfile();
  const saved = profile.reminder;
  const [time, setTime] = useState<Pick<ReminderPreference, 'hour' | 'minute'>>(() => ({ hour: saved?.hour ?? DEFAULT_REMINDER.hour, minute: saved?.minute ?? DEFAULT_REMINDER.minute }));
  const [permission, setPermission] = useState<{ status: ReminderPermission; canAskAgain: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'ready' && saved) setTime({ hour: saved.hour, minute: saved.minute });
  }, [saved, status]);

  useEffect(() => {
    let active = true;
    checkInReminderService.getPermission().then((result) => { if (active) setPermission(result); });
    return () => { active = false; };
  }, []);

  const persist = (reminder: ReminderPreference | null) => updateProfile((current, nowIso) => withReminder(current, reminder, nowIso));

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let current = permission ?? await checkInReminderService.getPermission();
      if (current.status === 'undetermined') current = await checkInReminderService.requestPermission();
      setPermission(current);
      if (current.status === 'granted') {
        await checkInReminderService.schedule(time);
        await persist({ enabled: true, ...time });
        setMessage(`Reminder set for ${formatReminderTime(time.hour, time.minute)} each day.`);
      } else if (current.status === 'unavailable') {
        setMessage('Reminders are available in the iOS and Android app only.');
      } else {
        await persist({ enabled: false, ...time });
        setMessage('Notifications are off for vAIne in your phone settings. Your chosen time is saved; allow notifications in Settings to turn the reminder on.');
      }
    } catch {
      setMessage('The reminder could not be scheduled. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await checkInReminderService.cancel();
      await persist({ enabled: false, ...time });
      setMessage('Reminder turned off.');
    } finally {
      setBusy(false);
    }
  };

  const enabled = Boolean(saved?.enabled);
  const activePreset = presetFor(time);

  return (
    <Screen title="Daily reminder" back>
      <Text style={styles.eyebrow}>ONE NUDGE A DAY</Text>
      <Text style={styles.title}>{enabled ? 'Your reminder is on' : 'A gentle reminder for today’s plan'}</Text>
      <Text style={styles.subtitle}>One local notification at a time you choose. It never mentions your skin, a score, or a photo, and it never counts down or pressures you. Turn it off here any time.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What the reminder says</Text>
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{REMINDER_CONTENT.title}</Text>
          <Text style={styles.previewBody}>{REMINDER_CONTENT.body}</Text>
        </View>
        <Text style={styles.cardNote}>That is the whole message, every day.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pick a time</Text>
        <View style={styles.presetRow}>
          {REMINDER_PRESETS.map((preset) => {
            const selected = activePreset?.id === preset.id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={preset.id}
                onPress={() => setTime({ hour: preset.hour, minute: preset.minute })}
                style={[styles.preset, selected && styles.presetSelected]}
              >
                <Text style={[styles.presetLabel, selected && styles.presetLabelSelected]}>{preset.label}</Text>
                <Text style={styles.presetTime}>{formatReminderTime(preset.hour, preset.minute)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.customRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="One hour earlier" onPress={() => setTime((current) => ({ ...current, hour: shiftHour(current.hour, -1) }))} style={styles.stepper}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text style={styles.customTime}>{formatReminderTime(time.hour, time.minute)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="One hour later" onPress={() => setTime((current) => ({ ...current, hour: shiftHour(current.hour, 1) }))} style={styles.stepper}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>

      <InfoCard
        title="Your phone will ask next"
        body={permission?.status === 'granted'
          ? 'vAIne already has permission to show notifications. Turning the reminder on schedules it on this phone only.'
          : permission?.status === 'denied'
            ? 'Notifications for vAIne are currently off in your phone settings. You can allow them in Settings and come back.'
            : 'When you turn the reminder on, your phone shows its own permission prompt. Saying no there simply leaves the reminder off.'}
        tone="green"
      />

      {message ? <InfoCard title="Reminder" body={message} tone="lilac" /> : null}

      {permission?.status === 'denied' && !permission.canAskAgain ? (
        <PrimaryButton label="Open phone settings" onPress={() => { void Linking.openSettings(); }} />
      ) : (
        <PrimaryButton label={busy ? 'Working…' : enabled ? `Update to ${formatReminderTime(time.hour, time.minute)}` : 'Turn on the reminder'} onPress={() => { void turnOn(); }} disabled={busy || permission?.status === 'unavailable'} />
      )}
      {enabled ? <SecondaryButton label="Turn the reminder off" onPress={() => { void turnOff(); }} /> : <SecondaryButton label="Not now" onPress={() => router.back()} />}
      <LegalNote />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontWeight: '400', marginTop: -4 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -6 },
  card: { backgroundColor: colors.panel, padding: 15, borderRadius: radius.large, borderWidth: 1, borderColor: colors.line, gap: 10, ...shadows.card },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardNote: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  preview: { backgroundColor: colors.panelSoft, borderRadius: radius.medium, padding: 12, borderWidth: 1, borderColor: colors.line },
  previewTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  previewBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  presetRow: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft },
  presetSelected: { borderColor: colors.blue, backgroundColor: `${colors.blue}14` },
  presetLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  presetLabelSelected: { color: colors.text },
  presetTime: { color: colors.muted, fontSize: 9, marginTop: 2 },
  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepper: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelSoft },
  stepperText: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  customTime: { color: colors.text, fontFamily: fonts.display, fontSize: 24, minWidth: 110, textAlign: 'center' },
});
