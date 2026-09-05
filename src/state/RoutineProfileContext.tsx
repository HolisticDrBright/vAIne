import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { withRoutineIntake } from '@/domain/profile/localProfile';
import type { RoutineSafetyIntake } from '@/domain/recommendations/routineBuilder';
import { useLocalProfile } from './LocalProfileContext';

interface RoutineProfileValue {
  routineProfile: RoutineSafetyIntake | null;
  /** True until the remembered answers have been read from device storage. */
  loading: boolean;
  saveRoutineProfile: (profile: RoutineSafetyIntake) => void;
  clearRoutineProfile: () => void;
}

const RoutineProfileContext = createContext<RoutineProfileValue | null>(null);

/**
 * Routine safety answers are remembered on this device so a returning person
 * does not repeat the intake for every check-in. They can be changed from the
 * routine screen and deleted from the privacy screen at any time.
 */
export function RoutineProfileProvider({ children }: PropsWithChildren) {
  const { profile, status, updateProfile } = useLocalProfile();
  const saveRoutineProfile = useCallback((intake: RoutineSafetyIntake) => {
    void updateProfile((current, nowIso) => withRoutineIntake(current, {
      ...intake,
      avoidIngredients: intake.avoidIngredients ?? [],
      currentActiveFamilies: intake.currentActiveFamilies ?? [],
    }, nowIso));
  }, [updateProfile]);
  const clearRoutineProfile = useCallback(() => {
    void updateProfile((current, nowIso) => withRoutineIntake(current, null, nowIso));
  }, [updateProfile]);
  const value = useMemo<RoutineProfileValue>(() => ({
    routineProfile: profile.routineIntake,
    loading: status === 'loading',
    saveRoutineProfile,
    clearRoutineProfile,
  }), [clearRoutineProfile, profile.routineIntake, saveRoutineProfile, status]);

  return <RoutineProfileContext.Provider value={value}>{children}</RoutineProfileContext.Provider>;
}

export function useRoutineProfile(): RoutineProfileValue {
  const value = useContext(RoutineProfileContext);
  if (!value) throw new Error('useRoutineProfile must be used inside RoutineProfileProvider');
  return value;
}
