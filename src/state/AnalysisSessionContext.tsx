import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  initialAnalysisExperienceState,
  reduceAnalysisExperience,
  type AnalysisExperienceState,
} from '@/domain/analysis/analysisExperience';
import {
  buildAnalysisRequest,
  describeAnalysisFailure,
  type AnalysisCaptureInput,
  type AnalysisServiceDescriptor,
  type SkinAnalysisService,
} from '@/domain/analysis/analysisService';
import { withLastCheckIn } from '@/domain/profile/localProfile';
import { syntheticSkinAnalysisService } from '@/services/syntheticAnalysisService';
import { useLocalProfile } from './LocalProfileContext';

interface AnalysisSessionValue {
  analysis: AnalysisExperienceState;
  /** Which implementation is wired: drives honest demo/live labeling. */
  serviceDescriptor: AnalysisServiceDescriptor;
  startAnalysis: (captures: readonly AnalysisCaptureInput[]) => Promise<void>;
  resetAnalysis: () => void;
  /** Forgets the remembered check-in on this device and clears the view. */
  forgetAnalysis: () => void;
}

const AnalysisSessionContext = createContext<AnalysisSessionValue | null>(null);

/**
 * Drives one analysis at a time and remembers the last completed, validated,
 * photo-free record on this device so the snapshot and routine are available
 * the next time the app opens. The remembered record is restored exactly once
 * at startup and only while nothing else is in progress; a new check-in
 * replaces it, and privacy deletion removes it.
 */
export function AnalysisSessionProvider({
  children,
  service = syntheticSkinAnalysisService,
}: PropsWithChildren<{ service?: SkinAnalysisService }>) {
  const [analysis, dispatch] = useReducer(reduceAnalysisExperience, initialAnalysisExperienceState);
  const { profile, status: profileStatus, updateProfile } = useLocalProfile();
  const inFlightRef = useRef<Promise<void> | null>(null);
  const runGenerationRef = useRef(0);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || profileStatus !== 'ready') return;
    restoredRef.current = true;
    if (profile.lastCheckIn) dispatch({ type: 'RESTORE', record: profile.lastCheckIn });
  }, [profile.lastCheckIn, profileStatus]);

  const startAnalysis = useCallback(async (captures: readonly AnalysisCaptureInput[]) => {
    if (inFlightRef.current) return inFlightRef.current;

    const runGeneration = runGenerationRef.current + 1;
    runGenerationRef.current = runGeneration;
    dispatch({ type: 'START' });
    const run = (async () => {
      try {
        const outcome = await service.analyze(buildAnalysisRequest(captures));
        if (runGeneration !== runGenerationRef.current) return;
        if (outcome.kind === 'completed') {
          dispatch({ type: 'COMPLETE', record: outcome.record });
          // Remember the photo-free record; the capture URIs never enter it.
          void updateProfile((current, nowIso) => withLastCheckIn(current, outcome.record, nowIso));
        } else if (outcome.kind === 'retake_required') {
          dispatch({ type: 'RETAKE', instruction: outcome.instruction });
        } else {
          dispatch({ type: 'FAIL', message: outcome.message });
        }
      } catch {
        if (runGeneration !== runGenerationRef.current) return;
        dispatch({ type: 'FAIL', message: describeAnalysisFailure('unexpected_error') });
      } finally {
        if (runGeneration === runGenerationRef.current) inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [service, updateProfile]);

  const resetAnalysis = useCallback(() => {
    runGenerationRef.current += 1;
    inFlightRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const forgetAnalysis = useCallback(() => {
    resetAnalysis();
    void updateProfile((current, nowIso) => withLastCheckIn(current, null, nowIso));
  }, [resetAnalysis, updateProfile]);

  const value = useMemo<AnalysisSessionValue>(() => ({
    analysis,
    serviceDescriptor: service.descriptor,
    startAnalysis,
    resetAnalysis,
    forgetAnalysis,
  }), [analysis, forgetAnalysis, resetAnalysis, service.descriptor, startAnalysis]);

  return <AnalysisSessionContext.Provider value={value}>{children}</AnalysisSessionContext.Provider>;
}

export function useAnalysisSession(): AnalysisSessionValue {
  const value = useContext(AnalysisSessionContext);
  if (!value) throw new Error('useAnalysisSession must be used inside AnalysisSessionProvider');
  return value;
}
