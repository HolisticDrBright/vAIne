import type { SkinCaptureAngle } from '../analysis/observationTaxonomy';

export const REQUIRED_CAPTURE_ANGLES: readonly SkinCaptureAngle[] = [
  'front',
  'left_profile',
  'right_profile',
];

export const READINESS_CHECKS = [
  'even_lighting',
  'face_centered',
  'lens_clean',
  'no_filter_or_heavy_makeup',
] as const;

export type ReadinessCheck = typeof READINESS_CHECKS[number];
export type ReadinessState = Readonly<Record<ReadinessCheck, boolean>>;

export const EMPTY_READINESS_STATE: ReadinessState = {
  even_lighting: false,
  face_centered: false,
  lens_clean: false,
  no_filter_or_heavy_makeup: false,
};

export type CaptureMetadataBlockReason =
  | 'missing_image'
  | 'resolution_too_low'
  | 'invalid_dimensions';

export function areReadinessChecksComplete(readiness: ReadinessState): boolean {
  return READINESS_CHECKS.every((check) => readiness[check]);
}

export function assessCaptureMetadata(input: {
  uri: string;
  width: number;
  height: number;
}): CaptureMetadataBlockReason[] {
  const reasons: CaptureMetadataBlockReason[] = [];
  if (!input.uri.trim()) reasons.push('missing_image');
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) {
    reasons.push('invalid_dimensions');
    return reasons;
  }
  if (Math.min(input.width, input.height) < 720) reasons.push('resolution_too_low');
  return reasons;
}
