import type { SkinCaptureAngle } from '../analysis/observationTaxonomy';

export const PROGRESS_BASELINE_VERSION = 1 as const;

export interface ProgressBaselineCapture {
  angle: SkinCaptureAngle;
  uri: string;
  width: number;
  height: number;
  capturedAtIso: string;
}

export interface ProgressBaseline {
  version: typeof PROGRESS_BASELINE_VERSION;
  sourceSessionId: string;
  savedAtIso: string;
  captures: readonly ProgressBaselineCapture[];
}

const angles: readonly SkinCaptureAngle[] = ['front', 'left_profile', 'right_profile'];

function isCapture(value: unknown): value is ProgressBaselineCapture {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return angles.includes(candidate.angle as SkinCaptureAngle)
    && typeof candidate.uri === 'string'
    && candidate.uri.startsWith('file://')
    && typeof candidate.width === 'number'
    && candidate.width > 0
    && typeof candidate.height === 'number'
    && candidate.height > 0
    && typeof candidate.capturedAtIso === 'string'
    && Number.isFinite(Date.parse(candidate.capturedAtIso));
}

export function parseProgressBaseline(value: unknown): ProgressBaseline | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== PROGRESS_BASELINE_VERSION
    || typeof candidate.sourceSessionId !== 'string'
    || typeof candidate.savedAtIso !== 'string'
    || !Number.isFinite(Date.parse(candidate.savedAtIso))
    || !Array.isArray(candidate.captures)
    || candidate.captures.length !== angles.length
    || !candidate.captures.every(isCapture)) return null;

  const uniqueAngles = new Set(candidate.captures.map((capture) => capture.angle));
  return uniqueAngles.size === angles.length ? candidate as unknown as ProgressBaseline : null;
}
