import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ProgressBaseline } from '../domain/progress/progressBaseline';
import { deleteProgressBaseline, loadProgressBaseline, saveProgressBaseline } from '../services/progressBaselineStorage';
import type { LocalCapture } from './CaptureSessionContext';

type ProgressBaselineStatus = 'loading' | 'ready' | 'saving' | 'error';

interface ProgressBaselineValue {
  baseline: ProgressBaseline | null;
  status: ProgressBaselineStatus;
  errorMessage: string | null;
  keepAsBaseline: (sourceSessionId: string, captures: readonly LocalCapture[]) => Promise<boolean>;
  clearBaseline: () => Promise<void>;
}

const ProgressBaselineContext = createContext<ProgressBaselineValue | null>(null);

export function ProgressBaselineProvider({ children }: PropsWithChildren) {
  const [baseline, setBaseline] = useState<ProgressBaseline | null>(null);
  const [status, setStatus] = useState<ProgressBaselineStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadProgressBaseline()
      .then((stored) => {
        if (!active) return;
        setBaseline(stored);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('ready');
      });
    return () => { active = false; };
  }, []);

  const keepAsBaseline = useCallback(async (sourceSessionId: string, captures: readonly LocalCapture[]) => {
    setStatus('saving');
    setErrorMessage(null);
    try {
      const stored = await saveProgressBaseline(sourceSessionId, captures);
      setBaseline(stored);
      setStatus('ready');
      return true;
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'The local baseline could not be saved.');
      return false;
    }
  }, []);

  const clearBaseline = useCallback(async () => {
    await deleteProgressBaseline();
    setBaseline(null);
    setStatus('ready');
    setErrorMessage(null);
  }, []);

  const value = useMemo<ProgressBaselineValue>(() => ({
    baseline,
    status,
    errorMessage,
    keepAsBaseline,
    clearBaseline,
  }), [baseline, status, errorMessage, keepAsBaseline, clearBaseline]);

  return <ProgressBaselineContext.Provider value={value}>{children}</ProgressBaselineContext.Provider>;
}

export function useProgressBaseline(): ProgressBaselineValue {
  const value = useContext(ProgressBaselineContext);
  if (!value) throw new Error('useProgressBaseline must be used inside ProgressBaselineProvider');
  return value;
}
