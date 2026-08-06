import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { RoutineSafetyIntake } from '@/domain/recommendations/routineBuilder';

interface RoutineProfileValue {
  routineProfile: RoutineSafetyIntake | null;
  saveRoutineProfile: (profile: RoutineSafetyIntake) => void;
  clearRoutineProfile: () => void;
}

const RoutineProfileContext = createContext<RoutineProfileValue | null>(null);

export function RoutineProfileProvider({ children }: PropsWithChildren) {
  const [routineProfile, setRoutineProfile] = useState<RoutineSafetyIntake | null>(null);
  const saveRoutineProfile = useCallback((profile: RoutineSafetyIntake) => setRoutineProfile(profile), []);
  const clearRoutineProfile = useCallback(() => setRoutineProfile(null), []);
  const value = useMemo<RoutineProfileValue>(() => ({
    routineProfile,
    saveRoutineProfile,
    clearRoutineProfile,
  }), [clearRoutineProfile, routineProfile, saveRoutineProfile]);

  return <RoutineProfileContext.Provider value={value}>{children}</RoutineProfileContext.Provider>;
}

export function useRoutineProfile(): RoutineProfileValue {
  const value = useContext(RoutineProfileContext);
  if (!value) throw new Error('useRoutineProfile must be used inside RoutineProfileProvider');
  return value;
}
