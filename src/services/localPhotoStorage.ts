import { File } from 'expo-file-system';

function isDeletableLocalUri(uri: string): boolean {
  return uri.startsWith('file://');
}

export async function deleteLocalPhoto(uri: string): Promise<void> {
  if (!isDeletableLocalUri(uri)) return;

  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A cache file may already have been removed by the OS. Deletion remains idempotent.
  }
}

export async function deleteLocalPhotos(uris: readonly string[]): Promise<void> {
  await Promise.all(uris.map(deleteLocalPhoto));
}
