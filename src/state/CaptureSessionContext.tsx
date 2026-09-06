import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { SkinCaptureAngle } from '@/domain/analysis/observationTaxonomy';
import type { DetailCaptureGroup } from '@/domain/capture/zoneCropQuality';
import type { FaceDetectionOutcome } from '@/domain/zones/faceDetection';
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
  /**
   * On-device detection outcome for this capture. Held in memory only —
   * never persisted, logged, or included in saved baselines.
   */
  faceDetection?: FaceDetectionOutcome;
}

/** Optional close-up photo covering one requested detail group. */
export interface DetailCapture {
  group: DetailCaptureGroup;
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
  detailCaptures: readonly DetailCapture[];
  errorMessage: string | null;
}

interface CaptureSessionValue {
  session: CaptureSession;
  startSession: (consent: CaptureConsent) => Promise<void>;
  acceptCapture: (capture: LocalCapture) => Promise<void>;
  removeCapture: (angle: SkinCaptureAngle) => Promise<void>;
  acceptDetailCapture: (capture: DetailCapture) => Promise<void>;
  removeDetailCapture: (group: DetailCaptureGroup) => Promise<void>;
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
  detailCaptures: [],
  errorMessage: null,
};

function allSessionUris(session: CaptureSession): string[] {
  return [
    ...session.captures.map((capture) => capture.uri),
    ...session.detailCaptures.map((capture) => capture.uri),
  ];
}

const CaptureSessionContext = createContext<CaptureSessionValue | null>(null);

export function CaptureSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<CaptureSession>(initialSession);

  const startSession = useCallback(async (consent: CaptureConsent) => {
    await deleteLocalPhotos(allSessionUris(session));
    setSession({
      id: `local-${Date.now()}`,
      status: 'preparing',
      consent,
      captures: [],
      detailCaptures: [],
      errorMessage: null,
    });
  }, [session]);

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

  const acceptDetailCapture = useCallback(async (capture: DetailCapture) => {
    const previous = session.detailCaptures.find((item) => item.group === capture.group);
    if (previous && previous.uri !== capture.uri) await deleteLocalPhoto(previous.uri);
    setSession((current) => ({
      ...current,
      detailCaptures: [
        ...current.detailCaptures.filter((item) => item.group !== capture.group),
        capture,
      ],
      errorMessage: null,
    }));
  }, [session.detailCaptures]);

  const removeDetailCapture = useCallback(async (group: DetailCaptureGroup) => {
    const capture = session.detailCaptures.find((item) => item.group === group);
    if (capture) await deleteLocalPhoto(capture.uri);
    setSession((current) => ({
      ...current,
      detailCaptures: current.detailCaptures.filter((item) => item.group !== group),
    }));
  }, [session.detailCaptures]);

  const markReadyForResults = useCallback(() => {
    setSession((current) => ({ ...current, status: 'ready_for_results', errorMessage: null }));
  }, []);

  const clearCaptures = useCallback(async () => {
    await deleteLocalPhotos(allSessionUris(session));
    setSession((current) => ({
      ...current,
      captures: [],
      detailCaptures: [],
      errorMessage: null,
    }));
  }, [session]);

  const completeSession = useCallback(() => {
    setSession((current) => ({ ...current, status: 'complete', errorMessage: null }));
  }, []);

  const setSessionError = useCallback((message: string) => {
    setSession((current) => ({ ...current, status: 'error', errorMessage: message }));
  }, []);

  const clearSession = useCallback(async () => {
    await deleteLocalPhotos(allSessionUris(session));
    setSession(initialSession);
  }, [session]);

  const value = useMemo<CaptureSessionValue>(() => ({
    session,
    startSession,
    acceptCapture,
    removeCapture,
    acceptDetailCapture,
    removeDetailCapture,
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
    acceptDetailCapture,
    removeDetailCapture,
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
