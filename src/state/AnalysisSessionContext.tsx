import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
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
import { syntheticSkinAnalysisService } from '@/services/syntheticAnalysisService';

interface AnalysisSessionValue {
  analysis: AnalysisExperienceState;
  /** Which implementation is wired: drives honest demo/live labeling. */
  serviceDescriptor: AnalysisServiceDescriptor;
  startAnalysis: (captures: readonly AnalysisCaptureInput[]) => Promise<void>;
  resetAnalysis: () => void;
}

const AnalysisSessionContext = createContext<AnalysisSessionValue | null>(null);

export function AnalysisSessionProvider({
  children,
  service = syntheticSkinAnalysisService,
}: PropsWithChildren<{ service?: SkinAnalysisService }>) {
  const [analysis, dispatch] = useReducer(reduceAnalysisExperience, initialAnalysisExperienceState);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const runGenerationRef = useRef(0);

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
  }, [service]);

  const resetAnalysis = useCallback(() => {
    runGenerationRef.current += 1;
    inFlightRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo<AnalysisSessionValue>(() => ({
    analysis,
    serviceDescriptor: service.descriptor,
    startAnalysis,
    resetAnalysis,
  }), [analysis, resetAnalysis, service.descriptor, startAnalysis]);

  return <AnalysisSessionContext.Provider value={value}>{children}</AnalysisSessionContext.Provider>;
}

export function useAnalysisSession(): AnalysisSessionValue {
  const value = useContext(AnalysisSessionContext);
  if (!value) throw new Error('useAnalysisSession must be used inside AnalysisSessionProvider');
  return value;
}
