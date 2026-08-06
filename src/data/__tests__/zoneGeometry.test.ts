import { describe, expect, it } from 'vitest';
import { FACE_CANVAS, zoneGeometry } from '../zoneGeometry';
import { zoneOrder } from '../zonePresentation';

describe('zoneGeometry', () => {
  it('defines a highlight and marker for every presented zone', () => {
    expect(Object.keys(zoneGeometry).sort()).toEqual([...zoneOrder].sort());
  });

  it('keeps every highlight and marker inside the illustration canvas', () => {
    for (const geometry of Object.values(zoneGeometry)) {
      expect(geometry.highlight.left).toBeGreaterThanOrEqual(0);
      expect(geometry.highlight.top).toBeGreaterThanOrEqual(0);
      expect(geometry.highlight.left + geometry.highlight.width).toBeLessThanOrEqual(FACE_CANVAS.width);
      expect(geometry.highlight.top + geometry.highlight.height).toBeLessThanOrEqual(FACE_CANVAS.height);
      expect(geometry.marker.left).toBeGreaterThanOrEqual(0);
      expect(geometry.marker.left).toBeLessThanOrEqual(FACE_CANVAS.width);
      expect(geometry.marker.top).toBeGreaterThanOrEqual(0);
      expect(geometry.marker.top).toBeLessThanOrEqual(FACE_CANVAS.height);
    }
  });
});
