import { syntheticSkinAnalysis } from './syntheticAnalysis';

export const appearanceMetrics = [
  { label: 'Hydration look', value: syntheticSkinAnalysis.appearanceScores.hydrationLook },
  { label: 'Tone appearance', value: syntheticSkinAnalysis.appearanceScores.toneEvennessLook },
  { label: 'Texture look', value: syntheticSkinAnalysis.appearanceScores.textureLook },
  { label: 'Radiance', value: syntheticSkinAnalysis.appearanceScores.radianceLook },
  { label: 'Pore visibility', value: syntheticSkinAnalysis.appearanceScores.poreVisibilityLook },
];
