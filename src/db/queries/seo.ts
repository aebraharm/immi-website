import { eq } from 'drizzle-orm';

import { seoSettings } from '@/db/schema';

import { getDb } from '../index';
import { resolveMediaUrls, urlFor } from './media-url';
import { safeQuery } from './safe';

/**
 * Per-route SEO overrides.
 *
 * Pages call this with their route and merge the result over their own
 * database-derived defaults. An administrator can therefore rewrite a title or
 * description without touching code — and when no override exists, nothing is
 * invented: the page falls back to content it already has (a service title, a
 * destination summary) rather than filler copy.
 */

export type SeoOverride = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  canonicalOverride: string;
  noIndex: boolean;
};

export const EMPTY_SEO_OVERRIDE: SeoOverride = {
  title: '',
  description: '',
  ogTitle: '',
  ogDescription: '',
  ogImageUrl: null,
  canonicalOverride: '',
  noIndex: false,
};

export async function getSeoOverride(route: string): Promise<SeoOverride> {
  const result = await safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(seoSettings)
      .where(eq(seoSettings.route, route))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const urls = await resolveMediaUrls(db, [row.ogImageAssetId]);

    return {
      title: row.title.trim(),
      description: row.description.trim(),
      ogTitle: row.ogTitle.trim(),
      ogDescription: row.ogDescription.trim(),
      ogImageUrl: urlFor(urls, row.ogImageAssetId),
      canonicalOverride: row.canonicalOverride.trim(),
      noIndex: row.noIndex,
    } satisfies SeoOverride;
  });

  return result.ok && result.data ? result.data : EMPTY_SEO_OVERRIDE;
}
