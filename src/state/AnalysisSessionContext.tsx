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
import { runSyntheticAnalysis } from '@/services/syntheticAnalysisService';

interface AnalysisSessionValue {
  analysis: AnalysisExperienceState;
  startSyntheticAnalysis: () => Promise<void>;
  resetAnalysis: () => void;
}

const AnalysisSessionContext = createContext<AnalysisSessionValue | null>(null);

export function AnalysisSessionProvider({ children }: PropsWithChildren) {
  const [analysis, dispatch] = useReducer(reduceAnalysisExperience, initialAnalysisExperienceState);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const runGenerationRef = useRef(0);

  const startSyntheticAnalysis = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const runGeneration = runGenerationRef.current + 1;
    runGenerationRef.current = runGeneration;
    dispatch({ type: 'START' });
    const run = (async () => {
      try {
        const result = await runSyntheticAnalysis();
        if (runGeneration !== runGenerationRef.current) return;
        dispatch({ type: 'SUCCEED', result });
      } catch {
        if (runGeneration !== runGenerationRef.current) return;
        dispatch({
          type: 'FAIL',
          message: 'The demonstration result could not be prepared. Your local photos were not used or uploaded.',
        });
      } finally {
        if (runGeneration === runGenerationRef.current) inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, []);

  const resetAnalysis = useCallback(() => {
    runGenerationRef.current += 1;
    inFlightRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo<AnalysisSessionValue>(() => ({
    analysis,
    startSyntheticAnalysis,
    resetAnalysis,
  }), [analysis, resetAnalysis, startSyntheticAnalysis]);

  return <AnalysisSessionContext.Provider value={value}>{children}</AnalysisSessionContext.Provider>;
}

export function useAnalysisSession(): AnalysisSessionValue {
  const value = useContext(AnalysisSessionContext);
  if (!value) throw new Error('useAnalysisSession must be used inside AnalysisSessionProvider');
  return value;
}
