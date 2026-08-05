import { syntheticSkinAnalysis } from './syntheticAnalysis';
import { approvedPrototypeCatalog } from './prototypeCatalog';

export const appearanceMetrics = [
  { label: 'Hydration look', value: syntheticSkinAnalysis.appearanceScores.hydrationLook },
  { label: 'Tone appearance', value: syntheticSkinAnalysis.appearanceScores.toneEvennessLook },
  { label: 'Texture look', value: syntheticSkinAnalysis.appearanceScores.textureLook },
  { label: 'Radiance', value: syntheticSkinAnalysis.appearanceScores.radianceLook },
  { label: 'Pore visibility', value: syntheticSkinAnalysis.appearanceScores.poreVisibilityLook },
];

const routineLabels = {
  cleanse: 'Cleanse',
  support: 'Support',
  hydrate: 'Hydrate',
  protect: 'Protect',
  weekly: 'Weekly',
} as const;

export const routineSteps = approvedPrototypeCatalog.map((product, index) => ({
  number: String(index + 1).padStart(2, '0'),
  name: routineLabels[product.routineSlot],
  detail: product.productName,
  brand: product.brandName,
  synthetic: product.catalogSource === 'synthetic_prototype',
}));

export const futureModules = [
  { title: 'Nails', subtitle: 'Appearance check-ins', mark: '◌' },
  { title: 'Tongue', subtitle: 'TCM wellness observations', mark: '◒' },
  { title: 'Iris wellness', subtitle: 'Traditional wellness view', mark: '◉' },
];
