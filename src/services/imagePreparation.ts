import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { AnalysisCaptureInput } from '@/domain/analysis/analysisService';

/**
 * Prepares one local capture for a single upload: re-encodes it as a JPEG
 * (which drops EXIF, including any location and device metadata), scales it
 * down so the longest side is at most MAX_SIDE, and returns the bytes as
 * base64 together with the photo-free metadata the server keeps.
 *
 * The prepared bytes live only in memory for the duration of the request.
 */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;

export interface PreparedCapture {
  angle: AnalysisCaptureInput['angle'];
  width: number;
  height: number;
  capturedAtIso: string;
  jpegBase64: string;
}

export async function prepareCaptureForUpload(capture: AnalysisCaptureInput): Promise<PreparedCapture> {
  const longest = Math.max(capture.width, capture.height);
  const context = ImageManipulator.manipulate(capture.uri);
  if (longest > MAX_SIDE) {
    if (capture.width >= capture.height) context.resize({ width: MAX_SIDE });
    else context.resize({ height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  try {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
    if (!saved.base64) throw new Error('The photo could not be encoded for upload.');
    return {
      angle: capture.angle,
      width: saved.width,
      height: saved.height,
      capturedAtIso: capture.capturedAtIso,
      jpegBase64: saved.base64,
    };
  } finally {
    image.release();
    context.release();
  }
}
