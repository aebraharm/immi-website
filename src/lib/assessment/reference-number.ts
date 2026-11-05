/**
 * Assessment reference numbers.
 *
 * Format: `IMA-YYYY-XXXXXXXX` — for example `IMA-2026-7QK3M2XA`.
 *
 *  - `IMA`    — the agency, so a number read down a phone line is obviously ours.
 *  - `YYYY`   — the year of submission, which makes an old reference
 *               self-evidently old.
 *  - `XXXXXXXX` — eight characters from Crockford's Base32 alphabet.
 *
 * The alphabet is the point. Crockford's Base32 omits `I`, `L`, `O` and `U`, so a
 * reference cannot be misread as `1`/`0` when it is copied off a screen onto
 * paper or read aloud. Eight characters from a 32-symbol alphabet is 40 bits of
 * randomness — about a trillion possibilities per year — so collisions are
 * vanishingly unlikely, and the `assessments_reference_unique` index means the
 * database refuses one rather than trusting that reasoning.
 *
 * The generator is deterministic given its inputs, which is what lets a test
 * assert on the format without stubbing the clock.
 */

/** Crockford Base32: no I, L, O or U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const REFERENCE_LENGTH = 8;
export const REFERENCE_PREFIX = 'IMA';

const REFERENCE_PATTERN = new RegExp(
  `^${REFERENCE_PREFIX}-\\d{4}-[${ALPHABET}]{${REFERENCE_LENGTH}}$`,
);

/**
 * Build a reference number.
 *
 * @param options.year      Four-digit year. Defaults to the current UTC year.
 * @param options.random    Source of random bytes. Defaults to the Web Crypto
 *                          CSPRNG; tests pass a fixed source.
 */
export function generateReferenceNumber(options: {
  year?: number;
  random?: (length: number) => Uint8Array;
} = {}): string {
  const year = options.year ?? new Date().getUTCFullYear();
  const random =
    options.random ??
    ((length: number) => {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return bytes;
    });

  const bytes = random(REFERENCE_LENGTH);

  let suffix = '';
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    // 256 is a multiple of 32, so `% 32` introduces no modulo bias.
    suffix += ALPHABET[bytes[index]! % ALPHABET.length];
  }

  return `${REFERENCE_PREFIX}-${year}-${suffix}`;
}

/** True when a string is shaped like a reference number we could have issued. */
export function isValidReferenceNumber(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
