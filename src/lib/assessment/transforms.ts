/**
 * Small, pure transformations used when an assessment is submitted.
 *
 * Kept separate from `submit.ts` — and free of any database import — so they can
 * be unit tested without a database, and so the submission service reads as the
 * sequence of decisions it is rather than a list of string helpers.
 */

/**
 * Split a free-text country answer into one value per country.
 *
 * Deliberately conservative: commas, semicolons, slashes, newlines and the word
 * "and" are the separators; each fragment is trimmed and de-duplicated; the list
 * is capped. Nothing is "corrected" to an ISO code, because a visitor may name a
 * city or a region and silently rewriting that would misrepresent what they said.
 */
export function splitCountries(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/[,;/\n]|\band\b/gi)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter((part) => part.length > 1)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}
