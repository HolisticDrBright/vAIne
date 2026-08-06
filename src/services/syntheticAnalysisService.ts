import { syntheticSkinAnalysis } from '@/data/syntheticAnalysis';
import { skinAnalysisSchema, type SkinAnalysis } from '@/domain/analysis/skinAnalysisSchema';

const SYNTHETIC_PROCESSING_DELAY_MS = 650;

/**
 * Exercises the result-validation boundary without accepting photos or making a
 * network request. Replace only after a separately reviewed image service exists.
 */
export async function runSyntheticAnalysis(): Promise<SkinAnalysis> {
  await new Promise((resolve) => setTimeout(resolve, SYNTHETIC_PROCESSING_DELAY_MS));
  return skinAnalysisSchema.parse(syntheticSkinAnalysis);
}
