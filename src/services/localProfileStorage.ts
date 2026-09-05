import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyLocalProfile,
  parseLocalProfile,
  type LocalProfile,
} from '../domain/profile/localProfile';

/**
 * On-device persistence for the local profile (routine answers, the last
 * photo-free check-in, consent defaults). Uses the app's private key-value
 * storage: on iOS and Android that lives inside the app sandbox; on web it is
 * the browser's origin-scoped storage. Nothing here is uploaded.
 *
 * Reads are fail-safe: a missing, corrupt, or foreign record yields the empty
 * profile rather than an error, so the app always starts.
 */
const STORAGE_KEY = 'vaine.local-profile.v1';

export async function loadLocalProfile(): Promise<LocalProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyLocalProfile;
    return parseLocalProfile(JSON.parse(raw)) ?? emptyLocalProfile;
  } catch {
    return emptyLocalProfile;
  }
}

export async function saveLocalProfile(profile: LocalProfile): Promise<void> {
  // Serialize through the parser so only the allow-listed shape is written.
  const validated = parseLocalProfile(profile);
  if (!validated) throw new Error('The local profile could not be saved in a photo-free form.');
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
}

export async function clearLocalProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Removing an absent key is still a successful deletion.
  }
}
