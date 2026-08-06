import { describe, expect, test } from 'vitest';
import {
  computeInviteEmailHash,
  MIN_INVITE_HASH_KEY_LENGTH,
  normalizeInviteEmail,
} from '../inviteHash.ts';

const KEY = 'k'.repeat(MIN_INVITE_HASH_KEY_LENGTH) + '-test-only-not-a-real-secret';
// Known-answer vector: node:crypto createHmac('sha256', KEY) over the message
// 'tester@example.com', computed independently of crypto.subtle.
const KNOWN_DIGEST = '9b333b7f1e6bcb2d9d74e19a9391188af3c6fe14aa9378e41f9a6dc42b21e6d7';

describe('invite email hashing (server-side keyed HMAC)', () => {
  test('produces the HMAC-SHA-256 of the normalized email, hex-encoded', async () => {
    const digest = await computeInviteEmailHash('tester@example.com', KEY);
    expect(digest).toBe(KNOWN_DIGEST);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  test('case and whitespace variants of the same address hash identically', async () => {
    const canonical = await computeInviteEmailHash('tester@example.com', KEY);
    expect(await computeInviteEmailHash('  Tester@EXAMPLE.com ', KEY)).toBe(canonical);
    expect(normalizeInviteEmail(' Tester@EXAMPLE.com\n')).toBe('tester@example.com');
  });

  test('the digest is keyed: a different key yields a different digest', async () => {
    const other = 'z'.repeat(MIN_INVITE_HASH_KEY_LENGTH);
    const a = await computeInviteEmailHash('tester@example.com', KEY);
    const b = await computeInviteEmailHash('tester@example.com', other);
    expect(a).not.toBe(b);
  });

  test('a missing or short key throws instead of degrading to a weak hash', async () => {
    await expect(computeInviteEmailHash('tester@example.com', '')).rejects.toThrow();
    await expect(
      computeInviteEmailHash('tester@example.com', 'short-key'),
    ).rejects.toThrow(/too short/);
  });
});
