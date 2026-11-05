import type { MetadataRoute } from 'next';

import { publicSiteUrl } from '@/lib/env';

/**
 * robots.txt
 *
 * The administration portal, submission receipts and all API routes are
 * disallowed. This is a request to well-behaved crawlers only — the real
 * protection is authentication, and `X-Robots-Tag: noindex` is still sent on
 * those routes for crawlers that reach them another way.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/assessment/success'],
      },
    ],
    sitemap: `${publicSiteUrl}/sitemap.xml`,
    host: publicSiteUrl,
  };
}
