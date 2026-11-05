/**
 * URL slug generation.
 *
 * Slugs are how the public site addresses services, destinations and team
 * members, so they must be stable, lowercase and safe in a URL. Uniqueness is
 * enforced by a UNIQUE index per table; callers that need a guaranteed-free
 * slug pass an `isTaken` check.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip diacritics so "Türkiye" becomes "turkiye".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Append `-2`, `-3`, … until the slug is free. */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';
  if (!(await isTaken(root))) return root;

  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error('Unable to allocate a unique slug.');
}
