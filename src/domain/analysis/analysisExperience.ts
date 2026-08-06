import type { AnalysisRecord } from './analysisService';
import type { SkinAnalysis } from './skinAnalysisSchema';

export type AnalysisExperienceStatus = 'idle' | 'processing' | 'ready' | 'retake' | 'error';

export interface AnalysisExperienceState {
  status: AnalysisExperienceStatus;
  /** Full envelope for the active analysis, including mode and versions. */
  record: AnalysisRecord | null;
  /** Convenience view of record.result for presentation code. */
  result: SkinAnalysis | null;
  retakeInstruction: string | null;
  errorMessage: string | null;
}

export type AnalysisExperienceEvent =
  | { type: 'START' }
  | { type: 'COMPLETE'; record: AnalysisRecord }
  | { type: 'RETAKE'; instruction: string }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' };

export const initialAnalysisExperienceState: AnalysisExperienceState = {
  status: 'idle',
  record: null,
  result: null,
  retakeInstruction: null,
  errorMessage: null,
};

export function reduceAnalysisExperience(
  state: AnalysisExperienceState,
  event: AnalysisExperienceEvent,
): AnalysisExperienceState {
  switch (event.type) {
    case 'START':
      return { status: 'processing', record: null, result: null, retakeInstruction: null, errorMessage: null };
    case 'COMPLETE':
      if (state.status !== 'processing') return state;
      return {
        status: 'ready',
        record: event.record,
        result: event.record.result,
        retakeInstruction: null,
        errorMessage: null,
      };
    case 'RETAKE':
      if (state.status !== 'processing') return state;
      return {
        status: 'retake',
        record: null,
        result: null,
        retakeInstruction: event.instruction,
        errorMessage: null,
      };
    case 'FAIL':
      if (state.status !== 'processing') return state;
      return {
        status: 'error',
        record: null,
        result: null,
        retakeInstruction: null,
        errorMessage: event.message,
      };
    case 'RESET':
      return initialAnalysisExperienceState;
  }
}

export function getConfidenceBand(confidence: number): 'High' | 'Moderate' | 'Limited' {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Moderate';
  return 'Limited';
}
