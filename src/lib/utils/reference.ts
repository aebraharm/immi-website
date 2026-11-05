import { randomInt } from 'node:crypto';

/**
 * Assessment reference numbers.
 *
 * Format: `IMA-<year>-<8 chars>` e.g. `IMA-2026-7QK3M2XA`.
 *
 * The alphabet is Crockford base32 without I, L, O and U, so a reference read
 * over the phone cannot be confused (1/I, 0/O) and cannot accidentally spell
 * something offensive. Generation uses `crypto.randomInt`, not `Math.random`,
 * so references are not predictable from one another.
 *
 * 32^8 ≈ 1.1 × 10^12 combinations per year; collisions are additionally ruled
 * out by the UNIQUE index on `assessments.reference_number` and the retry loop
 * below.
 */

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REFERENCE_LENGTH = 8;
const MAX_ATTEMPTS = 5;

function randomSuffix(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CROCKFORD_ALPHABET[randomInt(0, CROCKFORD_ALPHABET.length)];
  }
  return out;
}

/** Generate a candidate reference for a given date (defaults to now). */
export function generateReferenceNumber(now: Date = new Date()): string {
  return `IMA-${now.getUTCFullYear()}-${randomSuffix(REFERENCE_LENGTH)}`;
}

/**
 * Generate a reference that the database confirms is unused.
 *
 * `isTaken` is supplied by the caller (a cheap indexed lookup) so this module
 * stays free of database imports and remains unit-testable.
 */
export async function generateUniqueReferenceNumber(
  isTaken: (reference: string) => Promise<boolean>,
  now: Date = new Date(),
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = generateReferenceNumber(now);
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new Error(
    'Unable to generate a unique assessment reference number after multiple attempts.',
  );
}

/** Loose shape check used by admin search before hitting the database. */
export function isReferenceNumberShape(value: string): boolean {
  return /^IMA-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/.test(value.trim().toUpperCase());
}
