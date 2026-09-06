import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isLiveAnalysisEnabled } from '@/services/analysisAvailability';
import { liveSkinAnalysisService } from '@/services/liveSkinAnalysisService';
import { syntheticSkinAnalysisService } from '@/services/syntheticAnalysisService';
import { AnalysisSessionProvider } from './AnalysisSessionContext';
import { useAuth } from './AuthContext';

/**
 * Chooses which analysis implementation the next check-in uses and tells the
 * interface why, so consent and result screens can be honest:
 *
 * - `live`: a signed-in account, a configured backend, and the analysis flag
 *   on. Photos are sent once to the analysis service and deleted after.
 * - `demo`: anything else. The labelled synthetic sample runs on-device and
 *   nothing is uploaded.
 */
export type AnalysisRoute = 'live' | 'demo';
export type DemoReason = 'no_backend' | 'signed_out' | 'analysis_disabled' | 'checking';

interface AnalysisRuntimeValue {
  route: AnalysisRoute;
  demoReason: DemoReason | null;
}

const AnalysisRuntimeContext = createContext<AnalysisRuntimeValue | null>(null);

export function AnalysisRuntime({ children }: PropsWithChildren) {
  const { auth, backendConfigured } = useAuth();
  const [flag, setFlag] = useState<'checking' | 'on' | 'off'>('checking');

  useEffect(() => {
    if (!backendConfigured) {
      setFlag('off');
      return;
    }
    let active = true;
    setFlag('checking');
    isLiveAnalysisEnabled().then((enabled) => {
      if (active) setFlag(enabled ? 'on' : 'off');
    });
    return () => { active = false; };
  }, [backendConfigured, auth.status]);

  const value = useMemo<AnalysisRuntimeValue>(() => {
    if (!backendConfigured) return { route: 'demo', demoReason: 'no_backend' };
    if (flag === 'checking') return { route: 'demo', demoReason: 'checking' };
    if (flag === 'off') return { route: 'demo', demoReason: 'analysis_disabled' };
    if (auth.status !== 'signed_in') return { route: 'demo', demoReason: 'signed_out' };
    return { route: 'live', demoReason: null };
  }, [auth.status, backendConfigured, flag]);

  const service = value.route === 'live' ? liveSkinAnalysisService : syntheticSkinAnalysisService;

  return (
    <AnalysisRuntimeContext.Provider value={value}>
      <AnalysisSessionProvider service={service}>{children}</AnalysisSessionProvider>
    </AnalysisRuntimeContext.Provider>
  );
}

export function useAnalysisRuntime(): AnalysisRuntimeValue {
  const value = useContext(AnalysisRuntimeContext);
  if (!value) throw new Error('useAnalysisRuntime must be used inside AnalysisRuntime');
  return value;
}
