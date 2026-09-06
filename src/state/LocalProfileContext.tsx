import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { emptyLocalProfile, type LocalProfile } from '@/domain/profile/localProfile';
import { clearLocalProfile, loadLocalProfile, saveLocalProfile } from '@/services/localProfileStorage';

export type LocalProfileStatus = 'loading' | 'ready';

interface LocalProfileValue {
  profile: LocalProfile;
  status: LocalProfileStatus;
  /** Applies a pure update and persists the result. */
  updateProfile: (update: (current: LocalProfile, nowIso: string) => LocalProfile) => Promise<void>;
  /** Forgets everything remembered on this device. */
  forgetProfile: () => Promise<void>;
}

const LocalProfileContext = createContext<LocalProfileValue | null>(null);

/**
 * Owns the on-device profile that makes vAIne remember a person between
 * launches. Loads once at startup; every change is written through
 * immediately so a crash or force-quit cannot lose it. Writes are serialized
 * to avoid interleaved saves overwriting each other.
 */
export function LocalProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<LocalProfile>(emptyLocalProfile);
  const [status, setStatus] = useState<LocalProfileStatus>('loading');
  const latest = useRef<LocalProfile>(emptyLocalProfile);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadLocalProfile().then((stored) => {
      if (!active) return;
      latest.current = stored;
      setProfile(stored);
      setStatus('ready');
    });
    return () => { active = false; };
  }, []);

  const updateProfile = useCallback(async (update: (current: LocalProfile, nowIso: string) => LocalProfile) => {
    const run = queue.current.then(async () => {
      const next = update(latest.current, new Date().toISOString());
      latest.current = next;
      setProfile(next);
      try {
        await saveLocalProfile(next);
      } catch {
        // In-memory state still reflects the change for this session; the
        // next successful save writes the full profile again.
      }
    });
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const forgetProfile = useCallback(async () => {
    const run = queue.current.then(async () => {
      latest.current = emptyLocalProfile;
      setProfile(emptyLocalProfile);
      await clearLocalProfile();
    });
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const value = useMemo<LocalProfileValue>(() => ({ profile, status, updateProfile, forgetProfile }), [
    profile,
    status,
    updateProfile,
    forgetProfile,
  ]);

  return <LocalProfileContext.Provider value={value}>{children}</LocalProfileContext.Provider>;
}

export function useLocalProfile(): LocalProfileValue {
  const value = useContext(LocalProfileContext);
  if (!value) throw new Error('useLocalProfile must be used inside LocalProfileProvider');
  return value;
}
