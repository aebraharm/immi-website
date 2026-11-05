import { inArray } from 'drizzle-orm';

import type { MediaAsset } from '@/db/schema';
import { mediaAssets } from '@/db/schema';

import type { Database } from '../index';

/**
 * Media URL resolution.
 *
 * Public assets are served through our own `/api/media/<key>` route rather than
 * a raw storage URL. That keeps one origin (so the CSP stays tight), lets us set
 * long-lived cache headers in one place, and means a storage migration never
 * breaks a stored page.
 *
 * Private assets deliberately return `null` here. There is no code path that
 * turns a private media row into a public URL — the guard lives in
 * `lib/storage/index.ts` and this function simply refuses to ask.
 */

export type MediaUrlMap = Map<string, string>;

/** Build the public URL for a media asset, or null if it must not be public. */
export function toPublicMediaUrl(asset: Pick<MediaAsset, 'storageKey' | 'visibility'>): string | null {
  if (asset.visibility !== 'public') return null;
  return `/api/media/${asset.storageKey.replace(/^public\//, '')}`;
}

/**
 * Load public URLs for a set of media ids in one query.
 * Returns a map keyed by media id so callers can join in memory.
 */
export async function resolveMediaUrls(
  db: Database,
  ids: Array<string | null | undefined>,
): Promise<MediaUrlMap> {
  const unique = Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );

  if (unique.length === 0) return new Map();

  const rows = await db
    .select({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      visibility: mediaAssets.visibility,
    })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, unique));

  const map: MediaUrlMap = new Map();
  for (const row of rows) {
    const url = toPublicMediaUrl(row);
    if (url) map.set(row.id, url);
  }
  return map;
}

/** Convenience: resolve a single id to a URL. */
export function urlFor(map: MediaUrlMap, id: string | null | undefined): string | null {
  if (!id) return null;
  return map.get(id) ?? null;
}
