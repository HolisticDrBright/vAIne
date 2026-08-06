import { syntheticSkinAnalysis } from '../data/syntheticAnalysis';
import {
  buildAnalysisRecord,
  classifyValidatedResult,
  type AnalysisOutcome,
  type AnalysisRequest,
  type SkinAnalysisService,
} from '../domain/analysis/analysisService';
import { skinAnalysisSchema } from '../domain/analysis/skinAnalysisSchema';

const SYNTHETIC_PROCESSING_DELAY_MS = 650;

/**
 * Demonstration implementation of the analysis boundary. It exercises the
 * validation gate and record envelope without reading photo content or making
 * a network request: the request's capture URIs are never opened, so the
 * output is identical for every user. Replace only behind the same interface
 * after the server-side boundary is approved.
 */
export const syntheticSkinAnalysisService: SkinAnalysisService = {
  descriptor: { id: 'synthetic-prototype', mode: 'synthetic_demo' },

  async analyze(request: AnalysisRequest): Promise<AnalysisOutcome> {
    await new Promise((resolve) => setTimeout(resolve, SYNTHETIC_PROCESSING_DELAY_MS));

    const result = skinAnalysisSchema.parse(syntheticSkinAnalysis);
    const classification = classifyValidatedResult(result);
    if (classification.decision === 'retake_requested') {
      return {
        kind: 'retake_required',
        analysisId: request.analysisId,
        imageQuality: result.imageQuality,
        instruction: classification.instruction,
      };
    }

    return {
      kind: 'completed',
      record: buildAnalysisRecord({
        request,
        result,
        descriptor: syntheticSkinAnalysisService.descriptor,
        completedAtIso: new Date().toISOString(),
        qualityDecision: 'accepted',
      }),
    };
  },
};
