import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';
import { CaptureSessionProvider } from '@/state/CaptureSessionContext';
import { AnalysisSessionProvider } from '@/state/AnalysisSessionContext';
import { RoutineProfileProvider } from '@/state/RoutineProfileContext';

export default function RootLayout() {
  return (
    <CaptureSessionProvider>
      <AnalysisSessionProvider>
        <RoutineProfileProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'slide_from_right' }} />
        </RoutineProfileProvider>
      </AnalysisSessionProvider>
    </CaptureSessionProvider>
  );
}
