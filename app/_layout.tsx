import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';
import { AuthProvider } from '@/state/AuthContext';
import { LocalProfileProvider } from '@/state/LocalProfileContext';
import { CaptureSessionProvider } from '@/state/CaptureSessionContext';
import { AnalysisRuntime } from '@/state/AnalysisRuntime';
import { FaceDetectorProvider } from '@/state/FaceDetectorContext';
import { RoutineProfileProvider } from '@/state/RoutineProfileContext';
import { ProgressBaselineProvider } from '@/state/ProgressBaselineContext';

export default function RootLayout() {
  return (
    <AuthProvider>
    <LocalProfileProvider>
    <FaceDetectorProvider>
    <CaptureSessionProvider>
      <ProgressBaselineProvider>
        <AnalysisRuntime>
          <RoutineProfileProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'slide_from_right' }} />
          </RoutineProfileProvider>
        </AnalysisRuntime>
      </ProgressBaselineProvider>
    </CaptureSessionProvider>
    </FaceDetectorProvider>
    </LocalProfileProvider>
    </AuthProvider>
  );
}
