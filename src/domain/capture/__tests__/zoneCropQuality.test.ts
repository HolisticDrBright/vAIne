import { describe, expect, test } from 'vitest';
import {
  assessFaceFraming,
  assessZoneCrop,
  estimateRollDegrees,
  FRONT_RETAKE_REASON,
  MAX_HEAD_ROLL_DEGREES,
  MAX_LIGHTING_UNEVENNESS,
  MAX_MEAN_LUMA,
  MAX_OCCLUSION_RATIO,
  MIN_MEAN_LUMA,
  MIN_SHARPNESS_SCORE,
  MIN_ZONE_CROP_SHORT_SIDE_PX,
  planDetailCapture,
  type ZoneCropAssessment,
  type ZoneCropMetrics,
} from '../zoneCropQuality';

const goodCrop = { x: 100, y: 100, width: 400, height: 300 };

function metrics(overrides: Partial<ZoneCropMetrics> = {}): ZoneCropMetrics {
  return {
    zone: 'forehead',
    crop: goodCrop,
    sharpness: 0.8,
    meanLuma: 128,
    lightingUnevenness: 0.1,
    occlusionRatio: 0,
    ...overrides,
  };
}

describe('zone crop gates', () => {
  test('passes a fully measured, healthy crop', () => {
    expect(assessZoneCrop(metrics())).toEqual({
      zone: 'forehead',
      sufficient: true,
      deficiencies: [],
      unmeasured: [],
    });
  });

  test('a missing crop is unusable and reports every gate as unmeasured', () => {
    const assessment = assessZoneCrop(metrics({ crop: null }));
    expect(assessment.sufficient).toBe(false);
    expect(assessment.deficiencies).toEqual(['crop_unavailable']);
    expect(assessment.unmeasured).toEqual(['sharpness', 'exposure', 'lighting_evenness', 'occlusion']);
  });

  test.each([
    ['insufficient_resolution', { crop: { ...goodCrop, height: MIN_ZONE_CROP_SHORT_SIDE_PX - 1 } }],
    ['blurred', { sharpness: MIN_SHARPNESS_SCORE - 0.01 }],
    ['underexposed', { meanLuma: MIN_MEAN_LUMA - 1 }],
    ['overexposed', { meanLuma: MAX_MEAN_LUMA + 1 }],
    ['uneven_lighting', { lightingUnevenness: MAX_LIGHTING_UNEVENNESS + 0.01 }],
    ['occluded', { occlusionRatio: MAX_OCCLUSION_RATIO + 0.01 }],
  ] as const)('flags %s', (deficiency, overrides) => {
    const assessment = assessZoneCrop(metrics(overrides));
    expect(assessment.sufficient).toBe(false);
    expect(assessment.deficiencies).toEqual([deficiency]);
  });

  test('unmeasured metrics never pass silently and never fail dishonestly', () => {
    const assessment = assessZoneCrop(metrics({ sharpness: null, occlusionRatio: undefined }));
    expect(assessment.sufficient).toBe(true);
    expect(assessment.deficiencies).toEqual([]);
    expect(assessment.unmeasured).toEqual(['sharpness', 'occlusion']);
  });
});

function sufficientZone(zone: ZoneCropAssessment['zone']): ZoneCropAssessment {
  return { zone, sufficient: true, deficiencies: [], unmeasured: [] };
}

function deficientZone(
  zone: ZoneCropAssessment['zone'],
  deficiencies: ZoneCropAssessment['deficiencies'],
): ZoneCropAssessment {
  return { zone, sufficient: false, deficiencies, unmeasured: [] };
}

describe('adaptive detail-capture policy', () => {
  test('requests nothing when every zone is sufficient', () => {
    const plan = planDetailCapture({
      assessments: ['forehead', 'under_eyes', 'cheeks', 'nose_t_zone', 'mouth_lips', 'jawline', 'chin'].map(
        (zone) => sufficientZone(zone as ZoneCropAssessment['zone']),
      ),
      landmarksReliable: true,
    });
    expect(plan).toEqual({ kind: 'none' });
  });

  test('requests only the groups containing deficient zones', () => {
    const plan = planDetailCapture({
      assessments: [
        deficientZone('forehead', ['insufficient_resolution']),
        sufficientZone('under_eyes'),
        sufficientZone('cheeks'),
        sufficientZone('nose_t_zone'),
        sufficientZone('mouth_lips'),
        sufficientZone('jawline'),
        sufficientZone('chin'),
      ],
      landmarksReliable: true,
    });
    expect(plan.kind).toBe('detail_requests');
    if (plan.kind !== 'detail_requests') return;
    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0].group).toBe('upper_face');
    expect(plan.requests[0].zones).toEqual(['forehead']);
    expect(plan.requests[0].reason).toContain('not enough pixel detail');
    expect(plan.requests[0].reason).toContain('digital zoom cannot');
    expect(plan.requests[0].guidance.length).toBeGreaterThan(10);
  });

  test('caps at three ordered group requests even when every zone is deficient', () => {
    const plan = planDetailCapture({
      assessments: [
        deficientZone('forehead', ['blurred']),
        deficientZone('under_eyes', ['underexposed']),
        deficientZone('cheeks', ['uneven_lighting']),
        deficientZone('nose_t_zone', ['overexposed']),
        deficientZone('mouth_lips', ['occluded']),
        deficientZone('jawline', ['insufficient_resolution']),
        deficientZone('chin', ['blurred']),
      ],
      landmarksReliable: true,
    });
    expect(plan.kind).toBe('detail_requests');
    if (plan.kind !== 'detail_requests') return;
    expect(plan.requests.map((request) => request.group)).toEqual(['upper_face', 'center_face', 'lower_face']);
    expect(plan.requests[2].zones).toEqual(['mouth_lips', 'jawline', 'chin']);
  });

  test('unreliable landmarks demand a front retake, not untrusted detail crops', () => {
    const plan = planDetailCapture({
      assessments: [deficientZone('cheeks', ['crop_unavailable'])],
      landmarksReliable: false,
    });
    expect(plan).toEqual({ kind: 'front_retake', reason: FRONT_RETAKE_REASON });
  });
});

describe('face framing gates', () => {
  test('accepts a centered, well-sized face', () => {
    expect(assessFaceFraming({ x: 0.28, y: 0.24, width: 0.44, height: 0.5 })).toEqual([]);
  });

  test('reports a missing face', () => {
    expect(assessFaceFraming(null)).toEqual(['face_not_found']);
  });

  test('flags a face that is too small', () => {
    expect(assessFaceFraming({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 })).toContain('face_too_small');
  });

  test('flags an off-center face', () => {
    expect(assessFaceFraming({ x: 0.02, y: 0.1, width: 0.4, height: 0.4 })).toContain('face_off_center');
  });

  test('flags a face touching the frame edge', () => {
    expect(assessFaceFraming({ x: 0.3, y: 0, width: 0.4, height: 0.5 })).toContain('face_cut_off');
  });
});

describe('head roll estimate', () => {
  const square = { width: 1000, height: 1000 };

  test('level eyes have zero roll', () => {
    expect(estimateRollDegrees({ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, square)).toBeCloseTo(0, 5);
  });

  test('measures roll in pixel space, respecting the image aspect ratio', () => {
    expect(estimateRollDegrees({ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }, square)).toBeCloseTo(45, 5);
    expect(
      estimateRollDegrees({ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }, { width: 1000, height: 500 }),
    ).toBeCloseTo(26.565, 3);
  });

  test('a clearly tilted head exceeds the gate threshold', () => {
    const roll = estimateRollDegrees({ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.48 }, square);
    expect(Math.abs(roll)).toBeGreaterThan(MAX_HEAD_ROLL_DEGREES);
  });
});
