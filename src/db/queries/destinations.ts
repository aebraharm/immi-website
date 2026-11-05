import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import {
  countries,
  destinations,
  destinationRequirements,
  employmentOpportunities,
  visaCategories,
} from '@/db/schema';

import { getDb } from '../index';
import { resolveMediaUrls, urlFor } from './media-url';
import { safeQuery } from './safe';
import type {
  CountrySummary,
  DestinationDetail,
  QueryResult,
} from './types';

/**
 * Destination queries.
 *
 * Public visibility rule: a country is visible only when it is `published`;
 * a destination programme only when it is `published` AND its parent country is
 * published. That prevents publishing a programme under an unpublished country.
 *
 * Nothing here invents immigration facts. Requirements, visa categories,
 * processing notes and opportunities are returned exactly as an administrator
 * entered them — often empty, in which case the UI shows a designed empty state.
 */

const PUBLISHED = 'published' as const;

export async function getPublishedCountries(): Promise<
  QueryResult<CountrySummary[]>
> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(countries)
      .where(and(eq(countries.status, PUBLISHED), isNull(countries.archivedAt)))
      .orderBy(asc(countries.displayOrder), asc(countries.name));

    if (rows.length === 0) return [];

    // Count published programmes per country in a single grouped query.
    const counts = await db
      .select({
        countryId: destinations.countryId,
        count: sql<number>`count(*)`,
      })
      .from(destinations)
      .where(and(eq(destinations.status, PUBLISHED), isNull(destinations.archivedAt)))
      .groupBy(destinations.countryId);

    const countMap = new Map(counts.map((row) => [row.countryId, Number(row.count)]));

    const urls = await resolveMediaUrls(db, [
      ...rows.map((row) => row.flagAssetId),
      ...rows.map((row) => row.heroImageAssetId),
    ]);

    return rows.map((row) => ({
      ...row,
      flagUrl: urlFor(urls, row.flagAssetId),
      heroImageUrl: urlFor(urls, row.heroImageAssetId),
      destinationCount: countMap.get(row.id) ?? 0,
    }));
  });
}

/**
 * All published countries for the assessment form's destination selector.
 * Deliberately lightweight: id, name, slug.
 */
export async function getDestinationOptions(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  const result = await safeQuery(async () => {
    const db = getDb();
    return db
      .select({ id: countries.id, name: countries.name, slug: countries.slug })
      .from(countries)
      .where(and(eq(countries.status, PUBLISHED), isNull(countries.archivedAt)))
      .orderBy(asc(countries.displayOrder), asc(countries.name));
  });

  return result.ok ? result.data : [];
}

/**
 * A country page: the country summary plus its published programmes.
 *
 * Returns null when the country is not published. When the country is published
 * but no programmes exist yet, `programmes` is an empty array — the page shows
 * the country's own description and an honest empty state, rather than being
 * treated as missing.
 */
export type CountryDetail = {
  country: CountrySummary;
  programmes: DestinationDetail[];
};

export async function getCountryDetailBySlug(
  slug: string,
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<CountryDetail | null>> {
  return safeQuery(async () => {
    const db = getDb();

    const countryRows = await db
      .select()
      .from(countries)
      .where(
        and(
          eq(countries.slug, slug),
          options.includeDrafts ? undefined : eq(countries.status, PUBLISHED),
          isNull(countries.archivedAt),
        ),
      )
      .limit(1);

    const country = countryRows[0];
    if (!country) return null;

    const programmes = await db
      .select()
      .from(destinations)
      .where(
        and(
          eq(destinations.countryId, country.id),
          options.includeDrafts ? undefined : eq(destinations.status, PUBLISHED),
          isNull(destinations.archivedAt),
        ),
      )
      .orderBy(asc(destinations.displayOrder), asc(destinations.title));

    const programmeDetails =
      programmes.length > 0 ? await buildDestinationDetails(programmes, country) : [];

    const [urls, programmeCounts] = await Promise.all([
      resolveMediaUrls(db, [country.flagAssetId, country.heroImageAssetId]),
      Promise.resolve(programmeDetails.length),
    ]);

    const summary: CountrySummary = {
      ...country,
      flagUrl: urlFor(urls, country.flagAssetId),
      heroImageUrl: urlFor(urls, country.heroImageAssetId),
      destinationCount: programmeCounts,
    };

    return { country: summary, programmes: programmeDetails };
  });
}

/** Detail for a single destination programme, by slug. */
export async function getDestinationBySlug(
  slug: string,
  options: { includeDrafts?: boolean } = {},
): Promise<QueryResult<DestinationDetail | null>> {
  return safeQuery(async () => {
    const db = getDb();

    const rows = await db
      .select()
      .from(destinations)
      .where(
        and(
          eq(destinations.slug, slug),
          options.includeDrafts ? undefined : eq(destinations.status, PUBLISHED),
          isNull(destinations.archivedAt),
        ),
      )
      .limit(1);

    const destination = rows[0];
    if (!destination) return null;

    const countryRows = await db
      .select()
      .from(countries)
      .where(
        and(
          eq(countries.id, destination.countryId),
          options.includeDrafts ? undefined : eq(countries.status, PUBLISHED),
          isNull(countries.archivedAt),
        ),
      )
      .limit(1);

    const country = countryRows[0];
    // Programme published but its country is not: treat as not found publicly.
    if (!country) return null;

    const [detail] = await buildDestinationDetails([destination], country);
    return detail ?? null;
  });
}

/** Slugs only, for the sitemap. */
export async function getPublishedDestinationSlugs(): Promise<string[]> {
  const result = await safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select({ slug: destinations.slug })
      .from(destinations)
      .where(and(eq(destinations.status, PUBLISHED), isNull(destinations.archivedAt)));
    return rows.map((row) => row.slug);
  });

  return result.ok ? result.data : [];
}

export async function getPublishedCountrySlugs(): Promise<string[]> {
  const result = await safeQuery(async () => {
    const db = getDb();
    const rows = await db
      .select({ slug: countries.slug })
      .from(countries)
      .where(and(eq(countries.status, PUBLISHED), isNull(countries.archivedAt)));
    return rows.map((row) => row.slug);
  });

  return result.ok ? result.data : [];
}

/**
 * Shared assembler: fetches children for a set of programmes and joins them.
 * Kept private so the two public entry points cannot drift apart.
 */
async function buildDestinationDetails(
  programmes: Array<typeof destinations.$inferSelect>,
  country: typeof countries.$inferSelect,
): Promise<DestinationDetail[]> {
  const db = getDb();
  const [visaRows, requirementRows, opportunityRows, urls] = await Promise.all([
    db
      .select()
      .from(visaCategories)
      .orderBy(asc(visaCategories.displayOrder)),
    db
      .select()
      .from(destinationRequirements)
      .orderBy(asc(destinationRequirements.displayOrder)),
    db
      .select()
      .from(employmentOpportunities)
      .where(
        and(
          eq(employmentOpportunities.isActive, true),
          isNull(employmentOpportunities.archivedAt),
        ),
      )
      .orderBy(asc(employmentOpportunities.displayOrder)),
    resolveMediaUrls(db, [
      country.flagAssetId,
      country.heroImageAssetId,
      ...programmes.map((programme) => programme.heroImageAssetId),
    ]),
  ]);

  return programmes.map((programme) => ({
    ...programme,
    country,
    flagUrl: urlFor(urls, country.flagAssetId),
    heroImageUrl: urlFor(urls, programme.heroImageAssetId ?? country.heroImageAssetId),
    visaCategories: visaRows.filter(
      (row) => row.destinationId === programme.id && row.isActive,
    ),
    requirements: requirementRows.filter((row) => row.destinationId === programme.id),
    opportunities: opportunityRows.filter((row) => row.destinationId === programme.id),
  }));
}
