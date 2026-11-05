import type { MetadataRoute } from 'next';

import {
  getPublishedCountrySlugs,
  getPublishedDestinationSlugs,
  getPublishedServiceSlugs,
  getTeamMemberSlugs,
} from '@/db/queries';
import { publicSiteUrl } from '@/lib/env';

/**
 * XML sitemap.
 *
 * Combines the fixed page structure with everything an administrator has
 * actually published — services, countries, destination programmes and team
 * profiles. Unpublished and archived rows never appear, because the slug queries
 * filter on `status = 'published'` in the query layer.
 *
 * Admin routes, API routes and submission receipts are never listed.
 */

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/services', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/destinations', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/testimonials', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/team', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/assessment', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  ];

  // Slug lookups fail soft: an unconfigured database yields empty arrays and the
  // sitemap still serves the static structure rather than throwing a 500.
  const [serviceSlugs, countrySlugs, destinationSlugs, teamSlugs] = await Promise.all([
    getPublishedServiceSlugs(),
    getPublishedCountrySlugs(),
    getPublishedDestinationSlugs(),
    getTeamMemberSlugs(),
  ]);

  // Countries and programmes share the /destinations/[slug] namespace.
  const destinationPaths = Array.from(
    new Set([...countrySlugs, ...destinationSlugs]),
  ).map((slug) => ({
    url: `${publicSiteUrl}/destinations/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const servicePaths = serviceSlugs.map((slug) => ({
    url: `${publicSiteUrl}/services/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }));

  // Team profiles are listed on /team; the detail route is reserved for Phase 3
  // expansion, so only the index is advertised for now.
  void teamSlugs;

  return [
    ...staticRoutes.map((route) => ({
      url: `${publicSiteUrl}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...servicePaths,
    ...destinationPaths,
  ];
}
