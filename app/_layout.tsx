import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';
import { AuthProvider } from '@/state/AuthContext';
import { CaptureSessionProvider } from '@/state/CaptureSessionContext';
import { AnalysisSessionProvider } from '@/state/AnalysisSessionContext';
import { FaceDetectorProvider } from '@/state/FaceDetectorContext';
import { RoutineProfileProvider } from '@/state/RoutineProfileContext';
import { ProgressBaselineProvider } from '@/state/ProgressBaselineContext';

export default function RootLayout() {
  return (
    <AuthProvider>
    <FaceDetectorProvider>
    <CaptureSessionProvider>
      <ProgressBaselineProvider>
        <AnalysisSessionProvider>
          <RoutineProfileProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'slide_from_right' }} />
          </RoutineProfileProvider>
        </AnalysisSessionProvider>
      </ProgressBaselineProvider>
    </CaptureSessionProvider>
    </FaceDetectorProvider>
    </AuthProvider>
  );
}
