import type { Metadata } from 'next';

import type { SeoOverride } from '@/db/queries/seo';
import { publicSiteUrl } from '@/lib/env';

import type { SiteIdentity } from '@/db/queries/types';

/**
 * Metadata construction.
 *
 * Rules that keep this honest:
 *  - The agency name is never hardcoded; it comes from `site_settings`.
 *  - A description is only emitted when real text exists. No filler meta
 *    descriptions are invented to satisfy a checklist.
 *  - Admin and receipt routes are always `noindex`.
 */

/**
 * The page's own title.
 *
 * Deliberately does NOT append the agency name: the site layout already sets a
 * metadata template (`%s | Agency`), and a page title that also contained the
 * name would render it twice — "Services | Acme | Acme", which is what a
 * visitor sees in the browser tab and a search result.
 *
 * A page with no title of its own falls back to the agency name, which the
 * template leaves untouched.
 */
function withBrand(title: string, identity: SiteIdentity): string {
  const trimmed = title.trim();
  if (trimmed.length > 0) return trimmed;
  return identity.agencyName.trim();
}

export type PageMetadataInput = {
  route: string;
  /** Page-specific title, derived from real content. */
  title: string;
  /** Description from content; omitted when empty. */
  description?: string;
  identity: SiteIdentity;
  seo?: SeoOverride;
  /** Set for pages that must never be indexed. */
  noIndex?: boolean;
  imageUrl?: string | null;
};

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const { identity, seo, route } = input;

  const title = seo?.title && seo.title.length > 0 ? seo.title : withBrand(input.title, identity);

  const description =
    (seo?.description && seo.description.length > 0
      ? seo.description
      : input.description?.trim()) || undefined;

  const ogTitle =
    (seo?.ogTitle && seo.ogTitle.length > 0 ? seo.ogTitle : title) || undefined;

  const ogDescription =
    (seo?.ogDescription && seo.ogDescription.length > 0
      ? seo.ogDescription
      : description) || undefined;

  const image = seo?.ogImageUrl ?? input.imageUrl ?? identity.ogImageUrl ?? undefined;

  // Search indexing can be switched off globally by the administrator
  // (useful before launch) and per page.
  const indexable =
    identity.privacy.allowSearchIndexing && !seo?.noIndex && !input.noIndex;

  const canonical =
    seo?.canonicalOverride && seo.canonicalOverride.length > 0
      ? seo.canonicalOverride
      : `${publicSiteUrl}${route}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: identity.agencyName || undefined,
      title: ogTitle,
      description: ogDescription,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description: ogDescription,
      images: image ? [image] : undefined,
    },
  };
}
