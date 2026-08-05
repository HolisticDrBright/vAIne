import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';
import { CaptureSessionProvider } from '@/state/CaptureSessionContext';

export default function RootLayout() {
  return (
    <CaptureSessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'slide_from_right' }} />
    </CaptureSessionProvider>
  );
}
