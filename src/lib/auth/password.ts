import { hash, verify, type Algorithm } from '@node-rs/argon2';

/**
 * Password hashing — Argon2id.
 *
 * Argon2id is the OWASP-recommended default: it is memory-hard (expensive to
 * attack on GPUs) and hybrid (resistant to both side-channel and
 * time-memory trade-off attacks).
 *
 * Parameters below follow OWASP's Argon2id guidance (19 MiB, t=2, p=1). The
 * memory cost is the knob that matters — raising it multiplies attacker cost
 * far more than raising iterations.
 */

const ARGON2_OPTIONS = {
  algorithm: 2 satisfies Algorithm, // Argon2id
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Minimum acceptable password length for administrator accounts. */
export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 *
 * Returns `false` rather than throwing on malformed input so that callers
 * cannot leak hash-parsing details through error responses.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/**
 * Password policy used by the forced-change screen and by the seed script.
 * Deliberately about length and variety, not arbitrary character gymnastics.
 */
export function validatePasswordStrength(password: string): string[] {
  const problems: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) {
    problems.push('Include at least one lowercase letter.');
  }
  if (!/[A-Z]/.test(password)) {
    problems.push('Include at least one uppercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    problems.push('Include at least one number.');
  }
  if (password.trim() !== password) {
    problems.push('Remove leading or trailing spaces.');
  }

  return problems;
}
