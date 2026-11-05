import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Low-level cryptographic helpers shared by authentication, rate limiting and
 * media integrity checks.
 *
 * Design rules enforced here:
 *  - Secrets that are compared or stored (session tokens, reset tokens) are
 *    only ever persisted as SHA-256 digests.
 *  - Password hashing lives in `password.ts` (Argon2id) because passwords need
 *    a slow, salted KDF — never a plain hash.
 */

/** Hex-encoded SHA-256 digest. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Hex-encoded SHA-256 digest of raw bytes (used for uploaded file integrity). */
export function sha256Buffer(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Cryptographically random URL-safe token.
 * 32 bytes = 256 bits of entropy by default.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Constant-time string comparison.
 *
 * Ordinary `===` leaks the length of the matching prefix through timing, which
 * is enough to recover a token byte by byte. Lengths are normalised first so
 * the comparison itself does not throw.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    // Still perform a comparison to keep timing consistent.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Privacy-preserving hash for network identifiers.
 *
 * We keep an HMAC-free digest of the IP rather than the address itself: it is
 * stable enough to correlate repeated abuse, but it is not a stored IP address.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const normalised = ip.split(',')[0]?.trim();
  if (!normalised) return null;
  return sha256Hex(`ip:${normalised}`);
}

/** Deterministic key for rate-limit buckets and login attempt lookups. */
export function rateLimitKey(scope: string, identifier: string): string {
  return `${scope}:${sha256Hex(identifier).slice(0, 40)}`;
}
