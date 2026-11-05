import { and, asc, eq, isNull } from 'drizzle-orm';

import { teamMembers, testimonials } from '@/db/schema';

import { getDb } from '../index';
import { resolveMediaUrls, urlFor } from './media-url';
import { safeQuery } from './safe';
import type {
  QueryResult,
  TeamMemberWithPhoto,
  TestimonialWithMedia,
} from './types';

/**
 * Testimonials and team members.
 *
 * Both are pure editorial content that an administrator types in — there is no
 * client account system anywhere in this product, and no testimonial is ever
 * generated, seeded or inferred. If an administrator has published none, the
 * public page shows a professional empty state instead.
 */

const PUBLISHED = 'published' as const;

/**
 * Testimonials for the public site.
 *
 * `includeDrafts` is used only by the administrator preview and by the
 * acknowledgement after a save; the public page calls this with no argument.
 */
export async function getPublishedTestimonials(
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<TestimonialWithMedia[]>> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(testimonials)
      .where(
        and(
          options.includeDrafts ? undefined : eq(testimonials.status, PUBLISHED),
          isNull(testimonials.archivedAt),
        ),
      )
      .orderBy(asc(testimonials.displayOrder), asc(testimonials.clientDisplayName));

    if (rows.length === 0) return [];

    const urls = await resolveMediaUrls(db, [
      ...rows.map((row) => row.photoAssetId),
      ...rows.map((row) => row.videoAssetId),
    ]);

    return rows.map((row) => ({
      ...row,
      photoUrl: urlFor(urls, row.photoAssetId),
      // `playableVideoUrl` is distinct from the stored `videoUrl` column: an
      // uploaded file wins, otherwise the administrator's external link is used.
      // The database CHECK constraint guarantees at most one of the two exists.
      playableVideoUrl:
        urlFor(urls, row.videoAssetId) ?? (row.videoUrl.trim() || null),
    }));
  });
}

export async function getPublishedTeamMembers(
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<TeamMemberWithPhoto[]>> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          options.includeDrafts ? undefined : eq(teamMembers.status, PUBLISHED),
          isNull(teamMembers.archivedAt),
        ),
      )
      .orderBy(asc(teamMembers.displayOrder), asc(teamMembers.fullName));

    if (rows.length === 0) return [];

    const urls = await resolveMediaUrls(db, rows.map((row) => row.photoAssetId));

    return rows.map((row) => ({
      ...row,
      photoUrl: urlFor(urls, row.photoAssetId),
    }));
  });
}

/**
 * A team member, by slug.
 *
 * Public by default. `includeDrafts` is only used by the administrator preview
 * route, which has already checked the session before calling it.
 */
export async function getTeamMemberBySlug(
  slug: string,
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<TeamMemberWithPhoto | null>> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.slug, slug),
          options.includeDrafts ? undefined : eq(teamMembers.status, PUBLISHED),
          isNull(teamMembers.archivedAt),
        ),
      )
      .limit(1);

    const member = rows[0];
    if (!member) return null;

    const urls = await resolveMediaUrls(db, [member.photoAssetId]);
    return { ...member, photoUrl: urlFor(urls, member.photoAssetId) };
  });
}

export async function getTeamMemberSlugs(): Promise<string[]> {
  const result = await safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select({ slug: teamMembers.slug })
      .from(teamMembers)
      .where(and(eq(teamMembers.status, PUBLISHED), isNull(teamMembers.archivedAt)));
    return rows.map((row) => row.slug);
  });

  return result.ok ? result.data : [];
}
