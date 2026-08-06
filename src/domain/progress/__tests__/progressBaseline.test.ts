import { describe, expect, it } from 'vitest';
import { parseProgressBaseline } from '../progressBaseline';

const validBaseline = {
  version: 1,
  sourceSessionId: 'local-123',
  savedAtIso: '2026-08-05T10:00:00.000Z',
  captures: [
    { angle: 'front', uri: 'file:///baseline/front.jpg', width: 1200, height: 1600, capturedAtIso: '2026-08-05T09:59:00.000Z' },
    { angle: 'left_profile', uri: 'file:///baseline/left.jpg', width: 1200, height: 1600, capturedAtIso: '2026-08-05T09:59:10.000Z' },
    { angle: 'right_profile', uri: 'file:///baseline/right.jpg', width: 1200, height: 1600, capturedAtIso: '2026-08-05T09:59:20.000Z' },
  ],
};

describe('parseProgressBaseline', () => {
  it('accepts one complete three-angle local baseline', () => {
    expect(parseProgressBaseline(validBaseline)).toEqual(validBaseline);
  });

  it('rejects duplicate or missing angles', () => {
    const duplicate = {
      ...validBaseline,
      captures: [validBaseline.captures[0], validBaseline.captures[0], validBaseline.captures[2]],
    };
    expect(parseProgressBaseline(duplicate)).toBeNull();
  });

  it('rejects non-local image references', () => {
    const remote = {
      ...validBaseline,
      captures: validBaseline.captures.map((capture, index) => index === 0 ? { ...capture, uri: 'https://example.com/face.jpg' } : capture),
    };
    expect(parseProgressBaseline(remote)).toBeNull();
  });
});
