import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { LocalCapture } from '../state/CaptureSessionContext';
import {
  parseProgressBaseline,
  PROGRESS_BASELINE_VERSION,
  type ProgressBaseline,
} from '../domain/progress/progressBaseline';

const DIRECTORY_NAME = 'vaine-progress-baseline';
const MANIFEST_NAME = 'baseline.json';

function baselineDirectory(): Directory {
  return new Directory(Paths.document, DIRECTORY_NAME);
}

function assertNativeStorage(): void {
  if (Platform.OS === 'web') throw new Error('Local progress baselines are available in the iOS and Android app only.');
}

export async function loadProgressBaseline(): Promise<ProgressBaseline | null> {
  assertNativeStorage();
  const directory = baselineDirectory();
  const manifest = new File(directory, MANIFEST_NAME);
  if (!directory.exists || !manifest.exists) return null;

  try {
    const parsed = parseProgressBaseline(JSON.parse(await manifest.text()));
    if (!parsed) return null;
    const withinDirectory = parsed.captures.every((capture) => capture.uri.startsWith(directory.uri));
    const filesExist = parsed.captures.every((capture) => new File(capture.uri).exists);
    return withinDirectory && filesExist ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveProgressBaseline(sourceSessionId: string, captures: readonly LocalCapture[]): Promise<ProgressBaseline> {
  assertNativeStorage();
  if (!sourceSessionId || captures.length !== 3) throw new Error('A complete three-photo check-in is required.');
  if (new Set(captures.map((capture) => capture.angle)).size !== 3) throw new Error('Front, left, and right photos are required.');

  const directory = baselineDirectory();
  if (directory.exists) directory.delete();
  directory.create({ idempotent: true, intermediates: true });

  try {
    const storedCaptures = [];
    for (const capture of captures) {
      if (!capture.uri.startsWith('file://')) throw new Error('Only device-local photos can be saved.');
      const source = new File(capture.uri);
      if (!source.exists) throw new Error('A temporary photo is no longer available.');
      const destination = new File(directory, `${capture.angle}.jpg`);
      await source.copy(destination, { overwrite: true });
      // Persist only the photo metadata — never in-memory detection geometry.
      storedCaptures.push({
        angle: capture.angle,
        uri: destination.uri,
        width: capture.width,
        height: capture.height,
        capturedAtIso: capture.capturedAtIso,
      });
    }

    const baseline: ProgressBaseline = {
      version: PROGRESS_BASELINE_VERSION,
      sourceSessionId,
      savedAtIso: new Date().toISOString(),
      captures: storedCaptures,
    };
    const manifest = new File(directory, MANIFEST_NAME);
    manifest.create({ overwrite: true, intermediates: true });
    manifest.write(JSON.stringify(baseline));
    return baseline;
  } catch (error) {
    if (directory.exists) directory.delete();
    throw error;
  }
}

export async function deleteProgressBaseline(): Promise<void> {
  if (Platform.OS === 'web') return;
  const directory = baselineDirectory();
  if (directory.exists) directory.delete();
}
