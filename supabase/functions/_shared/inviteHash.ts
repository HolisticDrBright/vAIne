/**
 * Beta-invite email hashing: a server-side *keyed* HMAC (SHA-256), never a
 * plain or merely salted hash. A plain hash of an email is reversible by
 * dictionary attack over known addresses; an HMAC with a secret key is not.
 *
 * The key lives exclusively in the Edge Function secret named by
 * `INVITE_HASH_KEY_ENV` (Supabase dashboard → Edge Functions → Secrets).
 * It must never reach the client app, the repository, or any log. Raw email
 * addresses are consumed transiently inside the Edge Function that verifies
 * an invite and are never stored or logged; only the HMAC digest is
 * persisted (beta_invites.email_hash).
 *
 * No invite rows are inserted anywhere yet — this module is the reviewed
 * mechanism for when invites go live.
 */

export const INVITE_HASH_KEY_ENV = 'INVITE_HASH_KEY';
/** Reject weak keys outright; the secret should be ≥ 32 random characters. */
export const MIN_INVITE_HASH_KEY_LENGTH = 32;

/**
 * Canonical form hashed for matching: Unicode-normalized, trimmed,
 * lowercased. `User@Example.com ` and `user@example.com` hash identically.
 */
export function normalizeInviteEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC-SHA-256 hex digest of the normalized email under the server-side key.
 * Throws on a missing or too-short key instead of degrading to a weaker hash.
 */
export async function computeInviteEmailHash(email: string, key: string): Promise<string> {
  if (key.length < MIN_INVITE_HASH_KEY_LENGTH) {
    throw new Error('invite hash key missing or too short');
  }
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(normalizeInviteEmail(email)),
  );
  return toHex(signature);
}
