import type { Metadata } from 'next';

import type { SeoOverride } from '@/db/queries/seo';
import type { SiteIdentity } from '@/db/queries/types';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Kept in its own module so the contact page's metadata generator can be shared
 * with any future contact sub-route without importing the page component (which
 * would pull JSX into a metadata-only context).
 */
export function buildMetadataForContact(
  identity: SiteIdentity,
  seo: SeoOverride,
): Metadata {
  return buildPageMetadata({
    route: '/contact',
    title: 'Contact Us',
    description: identity.contact.email
      ? `Contact ${identity.agencyName || 'our team'} by email or telephone.`
      : 'Contact our team about your immigration enquiry.',
    identity,
    seo,
  });
}
