/**
 * Pure client-side policy for the secure analysis-upload pipeline.
 *
 * Mirrors the limits the approved backend will enforce independently —
 * the client validates first so users get instant, specific feedback, and
 * the server re-validates everything because the client is never trusted.
 * Nothing here touches the network, and nothing in this module may ever
 * log or return image bytes, URIs, signed URLs, or facial geometry.
 */

export const UPLOAD_LIMITS = {
  maxQuickScanImages: 3,
  maxImagesWithCloseUps: 6,
  maxBytesPerImage: 8 * 1024 * 1024,
  minDimensionPx: 480,
  maxDimensionPx: 6000,
  allowedMimeTypes: ['image/jpeg', 'image/heic'],
  /** Application-level slot expiry — far below Supabase's two-hour URL ceiling. */
  slotLifetimeMs: 10 * 60 * 1000,
} as const;

export type SniffedImageType = 'image/jpeg' | 'image/heic' | 'unknown';

/**
 * Identifies the actual file type from leading bytes. Filenames and
 * client-reported MIME strings are never trusted — the same rule the
 * backend applies.
 */
export function sniffImageType(prefix: Uint8Array): SniffedImageType {
  if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return 'image/jpeg';
  }
  // ISO-BMFF: [4-byte size]"ftyp"<brand>. HEIC brands: heic/heix/hevc/hevx/mif1/msf1.
  if (prefix.length >= 12) {
    const ascii = (from: number, to: number) => String.fromCharCode(...prefix.slice(from, to));
    if (ascii(4, 8) === 'ftyp') {
      const brand = ascii(8, 12);
      if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
    }
  }
  return 'unknown';
}

export interface UploadCandidate {
  /** Stable label for error reporting: an angle or close-up group name. */
  label: string;
  sniffedType: SniffedImageType;
  bytes: number;
  width: number;
  height: number;
}

export type UploadRejectionReason =
  | 'no_images'
  | 'too_many_images'
  | 'duplicate_label'
  | 'unsupported_type'
  | 'file_too_large'
  | 'dimensions_out_of_range';

export interface UploadRejection {
  label: string | null;
  reason: UploadRejectionReason;
}

export type UploadSetValidation =
  | { ok: true }
  | { ok: false; rejections: readonly UploadRejection[] };

export function validateUploadSet(candidates: readonly UploadCandidate[]): UploadSetValidation {
  const rejections: UploadRejection[] = [];

  if (candidates.length === 0) rejections.push({ label: null, reason: 'no_images' });
  if (candidates.length > UPLOAD_LIMITS.maxImagesWithCloseUps) {
    rejections.push({ label: null, reason: 'too_many_images' });
  }

  const seenLabels = new Set<string>();
  for (const candidate of candidates) {
    if (seenLabels.has(candidate.label)) {
      rejections.push({ label: candidate.label, reason: 'duplicate_label' });
    }
    seenLabels.add(candidate.label);

    if (!(UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(candidate.sniffedType)) {
      rejections.push({ label: candidate.label, reason: 'unsupported_type' });
    }
    if (candidate.bytes > UPLOAD_LIMITS.maxBytesPerImage || candidate.bytes <= 0) {
      rejections.push({ label: candidate.label, reason: 'file_too_large' });
    }
    const { width, height } = candidate;
    if (
      Math.min(width, height) < UPLOAD_LIMITS.minDimensionPx ||
      Math.max(width, height) > UPLOAD_LIMITS.maxDimensionPx
    ) {
      rejections.push({ label: candidate.label, reason: 'dimensions_out_of_range' });
    }
  }

  return rejections.length ? { ok: false, rejections } : { ok: true };
}

export interface UploadSlot {
  analysisId: string;
  issuedAtIso: string;
  /** Server-provided lifetime; defaults to the application policy. */
  lifetimeMs?: number;
}

export function isSlotExpired(slot: UploadSlot, nowIso: string): boolean {
  const issued = Date.parse(slot.issuedAtIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(issued) || !Number.isFinite(now)) return true;
  return now - issued >= (slot.lifetimeMs ?? UPLOAD_LIMITS.slotLifetimeMs);
}

const REJECTION_COPY: Record<UploadRejectionReason, string> = {
  no_images: 'No photos are ready to analyze. Complete a check-in first.',
  too_many_images: 'Too many photos for one analysis. A check-in uses at most six.',
  duplicate_label: 'The same photo position appears twice. Retake the affected photo.',
  unsupported_type: 'This photo format is not supported. Capture with the in-app camera and try again.',
  file_too_large: 'A photo is too large to upload. Retake it with the in-app camera.',
  dimensions_out_of_range: 'A photo is outside the supported size range. Retake it with the in-app camera.',
};

export function describeUploadRejection(reason: UploadRejectionReason): string {
  return REJECTION_COPY[reason];
}
