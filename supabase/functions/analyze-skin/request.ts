/**
 * Request validation for analyze-skin. Pure: no I/O, no logging. Every
 * rejection carries only a generic code, never any of the submitted bytes.
 *
 * Photos travel inside the request body as base64 JPEG and exist only in
 * this function's memory for the duration of one provider call. They are
 * never written to storage, a log, a database row, or the response.
 */

import { SKIN_CAPTURE_ANGLES, type SkinCaptureAngle } from '../_shared/skinAnalysisContract.ts';

export const MAX_CAPTURES = 3;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_DIMENSION = 480;
export const MAX_DIMENSION = 6000;
const ANALYSIS_ID = /^analysis-[a-z0-9]{6,20}-[a-z0-9]{6,12}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type RequestRejection =
  | 'invalid_body'
  | 'invalid_analysis_id'
  | 'no_captures'
  | 'too_many_captures'
  | 'duplicate_angle'
  | 'invalid_angle'
  | 'invalid_dimensions'
  | 'invalid_timestamp'
  | 'not_jpeg'
  | 'image_too_large'
  | 'invalid_preferences';

export interface ValidatedCapture {
  angle: SkinCaptureAngle;
  width: number;
  height: number;
  capturedAtIso: string;
  /** Decoded JPEG bytes. Dropped as soon as the provider call returns. */
  bytes: Uint8Array;
  /** Base64 as received, forwarded to the provider without re-encoding. */
  base64: string;
}

export interface ValidatedRequest {
  analysisId: string;
  requestedAtIso: string;
  captures: ValidatedCapture[];
  goals: string[];
  sensitivityPreference: 'standard' | 'sensitive';
}

export type RequestValidation =
  | { ok: true; request: ValidatedRequest }
  | { ok: false; code: RequestRejection };

const ALLOWED_GOALS = new Set([
  'support_hydration_look',
  'support_even_tone_look',
  'support_smoother_texture_look',
  'support_radiance_look',
  'support_comfort',
  'support_sun_protection_habit',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Base64 length → decoded byte count, without decoding. */
export function estimateDecodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function validateRequest(body: unknown, nowIso: string): RequestValidation {
  if (!isRecord(body)) return { ok: false, code: 'invalid_body' };
  const analysisId = body.analysisId;
  if (typeof analysisId !== 'string' || !ANALYSIS_ID.test(analysisId)) return { ok: false, code: 'invalid_analysis_id' };

  const rawCaptures = body.captures;
  if (!Array.isArray(rawCaptures) || rawCaptures.length === 0) return { ok: false, code: 'no_captures' };
  if (rawCaptures.length > MAX_CAPTURES) return { ok: false, code: 'too_many_captures' };

  const seen = new Set<string>();
  const captures: ValidatedCapture[] = [];
  for (const raw of rawCaptures) {
    if (!isRecord(raw)) return { ok: false, code: 'invalid_body' };
    const angle = raw.angle;
    if (typeof angle !== 'string' || !(SKIN_CAPTURE_ANGLES as readonly string[]).includes(angle)) {
      return { ok: false, code: 'invalid_angle' };
    }
    if (seen.has(angle)) return { ok: false, code: 'duplicate_angle' };
    seen.add(angle);
    const width = raw.width;
    const height = raw.height;
    if (
      typeof width !== 'number' || typeof height !== 'number' ||
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width < MIN_DIMENSION || height < MIN_DIMENSION || width > MAX_DIMENSION || height > MAX_DIMENSION
    ) {
      return { ok: false, code: 'invalid_dimensions' };
    }
    const capturedAtIso = raw.capturedAtIso;
    if (typeof capturedAtIso !== 'string' || !ISO_TIMESTAMP.test(capturedAtIso)) return { ok: false, code: 'invalid_timestamp' };
    const base64 = raw.jpegBase64;
    if (typeof base64 !== 'string' || base64.length === 0 || /[^A-Za-z0-9+/=]/.test(base64)) return { ok: false, code: 'not_jpeg' };
    if (estimateDecodedBytes(base64) > MAX_IMAGE_BYTES) return { ok: false, code: 'image_too_large' };
    const bytes = decodeBase64(base64);
    if (!bytes || !isJpeg(bytes)) return { ok: false, code: 'not_jpeg' };
    if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, code: 'image_too_large' };
    captures.push({ angle: angle as SkinCaptureAngle, width, height, capturedAtIso, bytes, base64 });
  }

  const goals = Array.isArray(body.goals) ? body.goals : [];
  if (!goals.every((goal) => typeof goal === 'string' && ALLOWED_GOALS.has(goal))) return { ok: false, code: 'invalid_preferences' };
  const sensitivity = body.sensitivityPreference ?? 'standard';
  if (sensitivity !== 'standard' && sensitivity !== 'sensitive') return { ok: false, code: 'invalid_preferences' };

  return {
    ok: true,
    request: {
      analysisId,
      requestedAtIso: nowIso,
      captures,
      goals: goals as string[],
      sensitivityPreference: sensitivity,
    },
  };
}
