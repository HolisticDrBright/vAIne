import { describe, expect, test } from 'vitest';
import { SKIN_ZONES } from '../../analysis/observationTaxonomy';
import {
  clampNormalizedRect,
  deriveZoneCropRects,
  deriveZoneRects,
  getCoverTransform,
  getZoneZoomLayout,
  isPlausibleFaceGeometry,
  MIN_LANDMARK_CONFIDENCE,
  normalizedRectToSourcePixels,
  projectPointToContainer,
  projectRectToContainer,
  resolveZoneAlignment,
  type DetectedFaceGeometry,
  type Size,
} from '../zoneAlignment';

const portraitSource: Size = { width: 1080, height: 1440 };
const landscapeSource: Size = { width: 1920, height: 1080 };
const faceCanvas: Size = { width: 214, height: 268 };

const centeredFace: DetectedFaceGeometry = {
  faceBounds: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
  leftEye: { x: 0.38, y: 0.42 },
  rightEye: { x: 0.62, y: 0.42 },
  noseTip: { x: 0.5, y: 0.55 },
  mouthCenter: { x: 0.5, y: 0.65 },
  confidence: 0.9,
};

const boundaryFace: DetectedFaceGeometry = {
  faceBounds: { x: 0, y: 0.62, width: 0.55, height: 0.38 },
  leftEye: { x: 0.15, y: 0.72 },
  rightEye: { x: 0.4, y: 0.72 },
  noseTip: { x: 0.275, y: 0.8 },
  mouthCenter: { x: 0.275, y: 0.87 },
  confidence: 0.9,
};

describe('cover transform', () => {
  test('portrait source into the face canvas crops vertically and centers', () => {
    const { scale, offsetX, offsetY } = getCoverTransform(portraitSource, faceCanvas);
    expect(scale).toBeCloseTo(214 / 1080, 5);
    expect(offsetX).toBeCloseTo(0, 5);
    expect(offsetY).toBeLessThan(0);

    const center = projectPointToContainer({ x: 0.5, y: 0.5 }, portraitSource, faceCanvas);
    expect(center.x).toBeCloseTo(faceCanvas.width / 2, 3);
    expect(center.y).toBeCloseTo(faceCanvas.height / 2, 3);
  });

  test('landscape source into the face canvas crops horizontally', () => {
    const { scale, offsetX, offsetY } = getCoverTransform(landscapeSource, faceCanvas);
    expect(scale).toBeCloseTo(268 / 1080, 5);
    expect(offsetY).toBeCloseTo(0, 5);
    expect(offsetX).toBeLessThan(0);

    const croppedAway = projectPointToContainer({ x: 0.05, y: 0.5 }, landscapeSource, faceCanvas);
    expect(croppedAway.visible).toBe(false);
  });

  test.each([
    [{ width: 214, height: 268 }],
    [{ width: 390, height: 844 }],
    [{ width: 320, height: 568 }],
    [{ width: 428, height: 926 }],
  ] as const)('covers container %o completely with uniform scale', (container) => {
    const { scale, offsetX, offsetY } = getCoverTransform(portraitSource, container);
    expect(portraitSource.width * scale).toBeGreaterThanOrEqual(container.width - 0.001);
    expect(portraitSource.height * scale).toBeGreaterThanOrEqual(container.height - 0.001);
    expect(offsetX).toBeLessThanOrEqual(0.001);
    expect(offsetY).toBeLessThanOrEqual(0.001);

    const center = projectPointToContainer({ x: 0.5, y: 0.5 }, portraitSource, container);
    expect(center.x).toBeCloseTo(container.width / 2, 3);
    expect(center.y).toBeCloseTo(container.height / 2, 3);
    expect(center.visible).toBe(true);
  });
});

describe('mirrored front-camera display', () => {
  const square: Size = { width: 1000, height: 1000 };
  const container: Size = { width: 100, height: 100 };

  test('mirrors point x around the display center', () => {
    const plain = projectPointToContainer({ x: 0.2, y: 0.4 }, square, container);
    const mirrored = projectPointToContainer({ x: 0.2, y: 0.4 }, square, container, { mirrored: true });
    expect(plain.x).toBeCloseTo(20, 5);
    expect(mirrored.x).toBeCloseTo(80, 5);
    expect(mirrored.y).toBeCloseTo(plain.y, 5);
  });

  test('mirrors rects so the left edge becomes the reflected right edge', () => {
    const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.2 };
    const plain = projectRectToContainer(rect, square, container);
    const mirrored = projectRectToContainer(rect, square, container, { mirrored: true });
    expect(plain.left).toBeCloseTo(10, 5);
    expect(mirrored.left).toBeCloseTo(container.width - (plain.left + plain.width), 5);
    expect(mirrored.width).toBeCloseTo(plain.width, 5);
    expect(mirrored.top).toBeCloseTo(plain.top, 5);
  });
});

describe('original-pixel crop mapping', () => {
  test('clamps out-of-bounds rects and stays inside the source image', () => {
    const crop = normalizedRectToSourcePixels(
      { x: -0.1, y: 0.9, width: 0.4, height: 0.4 },
      { width: 1000, height: 2000 },
    );
    expect(crop).toEqual({ x: 0, y: 1800, width: 300, height: 200 });
  });

  test('returns null for rects with no visible area', () => {
    expect(normalizedRectToSourcePixels({ x: 1.2, y: 0.5, width: 0.3, height: 0.3 }, portraitSource)).toBeNull();
    expect(normalizedRectToSourcePixels({ x: 0.5, y: 0.5, width: 0, height: 0.2 }, portraitSource)).toBeNull();
    expect(clampNormalizedRect({ x: -0.5, y: 0, width: 0.2, height: 1 })).toBeNull();
  });
});

describe('zone derivation from landmarks', () => {
  const zones = deriveZoneRects(centeredFace);

  test('produces all seven zones inside the unit square', () => {
    for (const zone of SKIN_ZONES) {
      const rect = zones[zone];
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  test('orders zones anatomically for an upright face', () => {
    const eyeY = (centeredFace.leftEye.y + centeredFace.rightEye.y) / 2;
    expect(zones.forehead.y + zones.forehead.height).toBeLessThanOrEqual(eyeY + 0.001);
    expect(zones.under_eyes.y).toBeGreaterThan(eyeY);
    expect(zones.cheeks.y).toBeGreaterThan(zones.under_eyes.y);
    expect(zones.chin.y).toBeGreaterThan(zones.mouth_lips.y);
    expect(zones.jawline.y + zones.jawline.height).toBeLessThanOrEqual(
      centeredFace.faceBounds.y + centeredFace.faceBounds.height + 0.001,
    );
  });

  test('anchors zones to the face landmarks, not fixed screen positions', () => {
    const noseRange = [zones.nose_t_zone.x, zones.nose_t_zone.x + zones.nose_t_zone.width];
    expect(centeredFace.noseTip.x).toBeGreaterThan(noseRange[0]);
    expect(centeredFace.noseTip.x).toBeLessThan(noseRange[1]);

    const mouth = zones.mouth_lips;
    expect(centeredFace.mouthCenter.x).toBeGreaterThan(mouth.x);
    expect(centeredFace.mouthCenter.x).toBeLessThan(mouth.x + mouth.width);
    expect(centeredFace.mouthCenter.y).toBeGreaterThan(mouth.y);
    expect(centeredFace.mouthCenter.y).toBeLessThan(mouth.y + mouth.height);
  });

  test('keeps a boundary-hugging face clamped without leaving the image', () => {
    const zones2 = deriveZoneRects(boundaryFace);
    for (const zone of SKIN_ZONES) {
      const rect = zones2[zone];
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1);
    }
  });

  test('derives full-resolution pixel crops that stay inside the source image', () => {
    for (const source of [portraitSource, landscapeSource]) {
      const crops = deriveZoneCropRects(boundaryFace, source);
      for (const zone of SKIN_ZONES) {
        const crop = crops[zone];
        expect(crop).toBeDefined();
        if (!crop) continue;
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(source.width);
        expect(crop.y + crop.height).toBeLessThanOrEqual(source.height);
      }
    }
  });
});

describe('zone zoom layout', () => {
  const viewport: Size = { width: 300, height: 260 };

  test('centers the zone in the viewport at the viewport aspect ratio', () => {
    const zone = { x: 0.35, y: 0.4, width: 0.3, height: 0.2 };
    const layout = getZoneZoomLayout(zone, portraitSource, viewport);

    const zoneCenterX = (zone.x + zone.width / 2) * layout.imageWidth + layout.offsetX;
    const zoneCenterY = (zone.y + zone.height / 2) * layout.imageHeight + layout.offsetY;
    expect(zoneCenterX).toBeCloseTo(viewport.width / 2, 1);
    expect(zoneCenterY).toBeCloseTo(viewport.height / 2, 1);

    expect(layout.imageWidth / portraitSource.width).toBeCloseTo(
      layout.imageHeight / portraitSource.height,
      5,
    );
  });

  test('never exposes area outside the source image', () => {
    for (const zone of [
      { x: 0.85, y: 0.02, width: 0.14, height: 0.1 },
      { x: 0, y: 0.9, width: 0.2, height: 0.1 },
      { x: 0, y: 0, width: 1, height: 1 },
    ]) {
      for (const source of [portraitSource, landscapeSource]) {
        const layout = getZoneZoomLayout(zone, source, viewport);
        expect(layout.offsetX).toBeLessThanOrEqual(0.001);
        expect(layout.offsetY).toBeLessThanOrEqual(0.001);
        expect(layout.offsetX + layout.imageWidth).toBeGreaterThanOrEqual(viewport.width - 0.001);
        expect(layout.offsetY + layout.imageHeight).toBeGreaterThanOrEqual(viewport.height - 0.001);

        const centerX = (zone.x + zone.width / 2) * layout.imageWidth + layout.offsetX;
        const centerY = (zone.y + zone.height / 2) * layout.imageHeight + layout.offsetY;
        expect(centerX).toBeGreaterThanOrEqual(-0.001);
        expect(centerX).toBeLessThanOrEqual(viewport.width + 0.001);
        expect(centerY).toBeGreaterThanOrEqual(-0.001);
        expect(centerY).toBeLessThanOrEqual(viewport.height + 0.001);
      }
    }
  });
});

describe('geometry plausibility', () => {
  test('accepts the canonical face', () => {
    expect(isPlausibleFaceGeometry(centeredFace)).toBe(true);
    expect(isPlausibleFaceGeometry(boundaryFace)).toBe(true);
  });

  test.each([
    ['swapped eyes', { ...centeredFace, leftEye: centeredFace.rightEye, rightEye: centeredFace.leftEye }],
    ['mouth above nose', { ...centeredFace, mouthCenter: { x: 0.5, y: 0.5 }, noseTip: { x: 0.5, y: 0.6 } }],
    ['landmark outside face bounds', { ...centeredFace, noseTip: { x: 0.95, y: 0.55 } }],
    ['face too small', { ...centeredFace, faceBounds: { x: 0.45, y: 0.45, width: 0.1, height: 0.1 } }],
    [
      'eye span too narrow',
      { ...centeredFace, leftEye: { x: 0.49, y: 0.42 }, rightEye: { x: 0.51, y: 0.42 } },
    ],
  ] as const)('rejects %s', (_label, geometry) => {
    expect(isPlausibleFaceGeometry(geometry)).toBe(false);
  });
});

describe('alignment resolution', () => {
  test('uses landmarks when detection is confident and plausible', () => {
    const resolution = resolveZoneAlignment(centeredFace);
    expect(resolution.mode).toBe('landmarks');
    if (resolution.mode === 'landmarks') {
      expect(Object.keys(resolution.zones).sort()).toEqual([...SKIN_ZONES].sort());
    }
  });

  test('falls back to the labeled fixed guide instead of guessing', () => {
    expect(resolveZoneAlignment(null)).toEqual({ mode: 'fixed_guide', reason: 'no_detection' });
    expect(resolveZoneAlignment({ ...centeredFace, confidence: MIN_LANDMARK_CONFIDENCE - 0.05 })).toEqual({
      mode: 'fixed_guide',
      reason: 'low_confidence',
    });
    expect(
      resolveZoneAlignment({ ...centeredFace, leftEye: centeredFace.rightEye, rightEye: centeredFace.leftEye }),
    ).toEqual({ mode: 'fixed_guide', reason: 'implausible_geometry' });
  });
});
