import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';
import { CaptureSessionProvider } from '@/state/CaptureSessionContext';
import { AnalysisSessionProvider } from '@/state/AnalysisSessionContext';

export default function RootLayout() {
  return (
    <CaptureSessionProvider>
      <AnalysisSessionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'slide_from_right' }} />
      </AnalysisSessionProvider>
    </CaptureSessionProvider>
  );
}
