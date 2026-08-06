import { createContext, type PropsWithChildren, useContext } from 'react';
import type { FaceDetector } from '@/domain/zones/faceDetection';
import { mlkitFaceDetector } from '@/services/mlkitFaceDetector';

/**
 * Dependency slot for the on-device detector so tests and development builds
 * can substitute implementations without touching capture code. The default
 * is the ML Kit adapter; on web it resolves to an honest `unavailable`.
 */
const FaceDetectorContext = createContext<FaceDetector>(mlkitFaceDetector);

export function FaceDetectorProvider({
  children,
  detector = mlkitFaceDetector,
}: PropsWithChildren<{ detector?: FaceDetector }>) {
  return <FaceDetectorContext.Provider value={detector}>{children}</FaceDetectorContext.Provider>;
}

export function useFaceDetector(): FaceDetector {
  return useContext(FaceDetectorContext);
}
