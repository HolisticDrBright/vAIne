import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { SkinCaptureAngle } from '@/domain/analysis/observationTaxonomy';
import { deleteLocalPhoto, deleteLocalPhotos } from '@/services/localPhotoStorage';

export interface CaptureConsent {
  analysis: boolean;
  temporaryDeviceStorage: boolean;
  progressTracking: boolean;
  researchUse: false;
}

export interface LocalCapture {
  angle: SkinCaptureAngle;
  uri: string;
  width: number;
  height: number;
  capturedAtIso: string;
}

export type CaptureSessionStatus =
  | 'idle'
  | 'preparing'
  | 'capturing'
  | 'ready_for_results'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface CaptureSession {
  id: string | null;
  status: CaptureSessionStatus;
  consent: CaptureConsent | null;
  captures: readonly LocalCapture[];
  errorMessage: string | null;
}

interface CaptureSessionValue {
  session: CaptureSession;
  startSession: (consent: CaptureConsent) => Promise<void>;
  acceptCapture: (capture: LocalCapture) => Promise<void>;
  removeCapture: (angle: SkinCaptureAngle) => Promise<void>;
  clearCaptures: () => Promise<void>;
  markReadyForResults: () => void;
  completeSession: () => void;
  setSessionError: (message: string) => void;
  clearSession: () => Promise<void>;
}

const initialSession: CaptureSession = {
  id: null,
  status: 'idle',
  consent: null,
  captures: [],
  errorMessage: null,
};

const CaptureSessionContext = createContext<CaptureSessionValue | null>(null);

export function CaptureSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<CaptureSession>(initialSession);

  const startSession = useCallback(async (consent: CaptureConsent) => {
    await deleteLocalPhotos(session.captures.map((capture) => capture.uri));
    setSession({
      id: `local-${Date.now()}`,
      status: 'preparing',
      consent,
      captures: [],
      errorMessage: null,
    });
  }, [session.captures]);

  const acceptCapture = useCallback(async (capture: LocalCapture) => {
    const previous = session.captures.find((item) => item.angle === capture.angle);
    if (previous && previous.uri !== capture.uri) await deleteLocalPhoto(previous.uri);
    setSession((current) => ({
      ...current,
      status: 'capturing',
      captures: [...current.captures.filter((item) => item.angle !== capture.angle), capture],
      errorMessage: null,
    }));
  }, [session.captures]);

  const removeCapture = useCallback(async (angle: SkinCaptureAngle) => {
    const capture = session.captures.find((item) => item.angle === angle);
    if (capture) await deleteLocalPhoto(capture.uri);
    setSession((current) => ({
      ...current,
      status: 'capturing',
      captures: current.captures.filter((item) => item.angle !== angle),
    }));
  }, [session.captures]);

  const markReadyForResults = useCallback(() => {
    setSession((current) => ({ ...current, status: 'ready_for_results', errorMessage: null }));
  }, []);

  const clearCaptures = useCallback(async () => {
    await deleteLocalPhotos(session.captures.map((capture) => capture.uri));
    setSession((current) => ({
      ...current,
      captures: [],
      errorMessage: null,
    }));
  }, [session.captures]);

  const completeSession = useCallback(() => {
    setSession((current) => ({ ...current, status: 'complete', errorMessage: null }));
  }, []);

  const setSessionError = useCallback((message: string) => {
    setSession((current) => ({ ...current, status: 'error', errorMessage: message }));
  }, []);

  const clearSession = useCallback(async () => {
    await deleteLocalPhotos(session.captures.map((capture) => capture.uri));
    setSession(initialSession);
  }, [session.captures]);

  const value = useMemo<CaptureSessionValue>(() => ({
    session,
    startSession,
    acceptCapture,
    removeCapture,
    clearCaptures,
    markReadyForResults,
    completeSession,
    setSessionError,
    clearSession,
  }), [
    session,
    startSession,
    acceptCapture,
    removeCapture,
    clearCaptures,
    markReadyForResults,
    completeSession,
    setSessionError,
    clearSession,
  ]);

  return <CaptureSessionContext.Provider value={value}>{children}</CaptureSessionContext.Provider>;
}

export function useCaptureSession(): CaptureSessionValue {
  const value = useContext(CaptureSessionContext);
  if (!value) throw new Error('useCaptureSession must be used inside CaptureSessionProvider');
  return value;
}
