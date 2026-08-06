import type { SkinAnalysis } from './skinAnalysisSchema';

export type AnalysisExperienceStatus = 'idle' | 'processing' | 'ready' | 'error';

export interface AnalysisExperienceState {
  status: AnalysisExperienceStatus;
  result: SkinAnalysis | null;
  errorMessage: string | null;
}

export type AnalysisExperienceEvent =
  | { type: 'START' }
  | { type: 'SUCCEED'; result: SkinAnalysis }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' };

export const initialAnalysisExperienceState: AnalysisExperienceState = {
  status: 'idle',
  result: null,
  errorMessage: null,
};

export function reduceAnalysisExperience(
  state: AnalysisExperienceState,
  event: AnalysisExperienceEvent,
): AnalysisExperienceState {
  switch (event.type) {
    case 'START':
      return { status: 'processing', result: null, errorMessage: null };
    case 'SUCCEED':
      if (state.status !== 'processing') return state;
      return { status: 'ready', result: event.result, errorMessage: null };
    case 'FAIL':
      if (state.status !== 'processing') return state;
      return { status: 'error', result: null, errorMessage: event.message };
    case 'RESET':
      return initialAnalysisExperienceState;
  }
}

export function getConfidenceBand(confidence: number): 'High' | 'Moderate' | 'Limited' {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Moderate';
  return 'Limited';
}
