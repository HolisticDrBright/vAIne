import type { SkinZone } from '../domain/analysis/observationTaxonomy';

export const FACE_CANVAS = { width: 214, height: 268 } as const;

interface ZoneGeometry {
  highlight: { left: number; top: number; width: number; height: number; borderRadius: number };
  marker: { left: number; top: number };
}

export const zoneGeometry: Record<SkinZone, ZoneGeometry> = {
  forehead: {
    highlight: { left: 56, top: 76, width: 102, height: 42, borderRadius: 24 },
    marker: { left: 107, top: 93 },
  },
  under_eyes: {
    highlight: { left: 47, top: 136, width: 120, height: 27, borderRadius: 16 },
    marker: { left: 65, top: 146 },
  },
  cheeks: {
    highlight: { left: 35, top: 148, width: 144, height: 47, borderRadius: 25 },
    marker: { left: 164, top: 168 },
  },
  nose_t_zone: {
    highlight: { left: 82, top: 116, width: 50, height: 78, borderRadius: 22 },
    marker: { left: 107, top: 168 },
  },
  mouth_lips: {
    highlight: { left: 66, top: 189, width: 82, height: 35, borderRadius: 19 },
    marker: { left: 107, top: 203 },
  },
  jawline: {
    highlight: { left: 37, top: 187, width: 140, height: 67, borderRadius: 34 },
    marker: { left: 49, top: 221 },
  },
  chin: {
    highlight: { left: 72, top: 219, width: 70, height: 40, borderRadius: 21 },
    marker: { left: 107, top: 240 },
  },
};
