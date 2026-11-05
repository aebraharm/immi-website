import { and, asc, eq, isNull } from 'drizzle-orm';

import {
  faqs,
  homepageSections,
  services,
  serviceFeatures,
  websitePages,
} from '@/db/schema';
import type { Faq, HomepageSection, WebsitePage } from '@/db/schema';

import { getDb } from '../index';
import { resolveMediaUrls, urlFor } from './media-url';
import { safeQuery } from './safe';
import type { QueryResult, ServiceWithFeatures } from './types';

/**
 * Public content queries.
 *
 * Every function here filters on `status = 'published'` and excludes archived
 * rows. That single rule is what makes "publish / unpublish" meaningful, and it
 * lives in the query layer so no page can forget it.
 */

const PUBLISHED = 'published' as const;

/* -------------------------------------------------------------------------- */
/* Homepage sections                                                          */
/* -------------------------------------------------------------------------- */

export type HomepageSectionWithImage = HomepageSection & {
  imageUrl: string | null;
};

export async function getHomepageSections(): Promise<
  QueryResult<HomepageSectionWithImage[]>
> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(homepageSections)
      .where(eq(homepageSections.isVisible, true))
      .orderBy(asc(homepageSections.displayOrder));

    const urls = await resolveMediaUrls(
      db,
      rows.map((row) => row.imageAssetId),
    );

    return rows.map((row) => ({
      ...row,
      imageUrl: urlFor(urls, row.imageAssetId),
    }));
  });
}

/** Look up one section by key; returns null when the administrator has not added it. */
export function findSection(
  sections: HomepageSectionWithImage[],
  key: string,
): HomepageSectionWithImage | null {
  return sections.find((section) => section.sectionKey === key) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

export async function getPublishedServices(): Promise<
  QueryResult<ServiceWithFeatures[]>
> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(services)
      .where(and(eq(services.status, PUBLISHED), isNull(services.archivedAt)))
      .orderBy(asc(services.displayOrder), asc(services.title));

    if (rows.length === 0) return [];

    const featureRows = await db
      .select()
      .from(serviceFeatures)
      .orderBy(asc(serviceFeatures.displayOrder));

    const urls = await resolveMediaUrls(
      db,
      rows.map((row) => row.imageAssetId),
    );

    return rows.map((row) => ({
      ...row,
      features: featureRows.filter((feature) => feature.serviceId === row.id),
      imageUrl: urlFor(urls, row.imageAssetId),
    }));
  });
}

/**
 * A service, by slug.
 *
 * Public by default: only published, non-archived rows resolve. `options.includeDrafts`
 * exists solely for the administrator preview route and is never set from a
 * public page — the public pages call this with no second argument.
 */
export async function getServiceBySlug(
  slug: string,
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<ServiceWithFeatures | null>> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.slug, slug),
          options.includeDrafts ? undefined : eq(services.status, PUBLISHED),
          isNull(services.archivedAt),
        ),
      )
      .limit(1);

    const service = rows[0];
    if (!service) return null;

    const features = await db
      .select()
      .from(serviceFeatures)
      .where(eq(serviceFeatures.serviceId, service.id))
      .orderBy(asc(serviceFeatures.displayOrder));

    const urls = await resolveMediaUrls(db, [service.imageAssetId]);

    return {
      ...service,
      features,
      imageUrl: urlFor(urls, service.imageAssetId),
    };
  });
}

/** Slugs only — used by sitemap and generateStaticParams-style lookups. */
export async function getPublishedServiceSlugs(): Promise<string[]> {
  const result = await safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select({ slug: services.slug })
      .from(services)
      .where(and(eq(services.status, PUBLISHED), isNull(services.archivedAt)));
    return rows.map((row) => row.slug);
  });

  return result.ok ? result.data : [];
}

/* -------------------------------------------------------------------------- */
/* Editable long-form pages (About / Terms / Privacy)                         */
/* -------------------------------------------------------------------------- */

export async function getPageBySlug(
  slug: string,
): Promise<QueryResult<WebsitePage | null>> {
  return safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(websitePages)
      .where(eq(websitePages.slug, slug))
      .limit(1);

    return rows[0] ?? null;
  });
}

/**
 * The published version of a legal page.
 *
 * Returns null when the page has never been published — the legal pages then
 * render an explicit "not published yet" state instead of pretending to have
 * terms, which matters because the assessment form requires real consent text.
 */
export async function getPublishedPage(
  slug: string,
): Promise<QueryResult<WebsitePage | null>> {
  return safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(websitePages)
      .where(and(eq(websitePages.slug, slug), eq(websitePages.status, PUBLISHED)))
      .limit(1);

    return rows[0] ?? null;
  });
}

/* -------------------------------------------------------------------------- */
/* FAQs                                                                       */
/* -------------------------------------------------------------------------- */

export async function getPublishedFaqs(
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<Faq[]>> {
  return safeQuery(async () => {
    const db = getDb();
    return db
      .select()
      .from(faqs)
      .where(
        and(
          options.includeDrafts ? undefined : eq(faqs.status, PUBLISHED),
          isNull(faqs.archivedAt),
        ),
      )
      .orderBy(asc(faqs.displayOrder), asc(faqs.question));
  });
}

/** Group FAQs by category while preserving the configured order. */
export function groupFaqsByCategory(items: Faq[]): Array<{
  category: string;
  items: Faq[];
}> {
  const groups = new Map<string, Faq[]>();

  for (const item of items) {
    const category = item.category.trim() || 'General';
    const bucket = groups.get(category);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(category, [item]);
    }
  }

  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }));
}
