import type { SkinZone } from '@/domain/analysis/observationTaxonomy';

export interface ZonePresentation {
  label: string;
  shortLabel: string;
  focus: string;
  signals: readonly string[];
}

export const zoneOrder: readonly SkinZone[] = [
  'forehead',
  'under_eyes',
  'cheeks',
  'nose_t_zone',
  'mouth_lips',
  'jawline',
  'chin',
];

export const zonePresentation: Record<SkinZone, ZonePresentation> = {
  forehead: {
    label: 'Forehead',
    shortLabel: 'Forehead',
    focus: 'Smoothness and surface appearance',
    signals: ['Texture look', 'Tone appearance', 'Surface hydration look'],
  },
  under_eyes: {
    label: 'Under eyes',
    shortLabel: 'Eyes',
    focus: 'Hydration and texture appearance',
    signals: ['Hydration look', 'Texture look', 'Fine-line visibility'],
  },
  cheeks: {
    label: 'Cheeks',
    shortLabel: 'Cheeks',
    focus: 'Tone and radiance appearance',
    signals: ['Tone evenness look', 'Visible redness', 'Radiance look'],
  },
  nose_t_zone: {
    label: 'Nose + T-zone',
    shortLabel: 'T-zone',
    focus: 'Pore and surface-shine appearance',
    signals: ['Pore visibility', 'Surface shine', 'Texture look'],
  },
  mouth_lips: {
    label: 'Mouth + lips',
    shortLabel: 'Lips',
    focus: 'Comfort and surface hydration look',
    signals: ['Lip dryness visibility', 'Texture look', 'Tone appearance'],
  },
  jawline: {
    label: 'Jawline',
    shortLabel: 'Jaw',
    focus: 'Calm and even appearance',
    signals: ['Tone appearance', 'Visible redness', 'Texture look'],
  },
  chin: {
    label: 'Chin',
    shortLabel: 'Chin',
    focus: 'Texture and evenness appearance',
    signals: ['Texture look', 'Pore visibility', 'Tone appearance'],
  },
};

export function isSkinZone(value: string): value is SkinZone {
  return zoneOrder.some((zone) => zone === value);
}
