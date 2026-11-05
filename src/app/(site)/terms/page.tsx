import type { Metadata } from 'next';

import { LegalPage } from '@/components/site/legal-page';
import { getPublishedPage, getSeoOverride, getSiteIdentity } from '@/db/queries';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Terms and Conditions.
 *
 * Content, version and dates come from the `website_pages` row with slug
 * `terms`. The assessment form reads the *published* version of this same row to
 * record consent, so what a client agreed to is always the text that was live.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, pageResult, seo] = await Promise.all([
    getSiteIdentity(),
    getPublishedPage('terms'),
    getSeoOverride('/terms'),
  ]);

  const page = pageResult.ok ? pageResult.data : null;

  return buildPageMetadata({
    route: '/terms',
    title: page?.title?.trim() || 'Terms and Conditions',
    description: page?.subtitle?.trim() || undefined,
    identity,
    seo,
  });
}

export default async function TermsPage() {
  const result = await getPublishedPage('terms');
  const page = result.ok ? result.data : null;

  return (
    <LegalPage
      page={page}
      eyebrow="Legal"
      fallbackTitle="Terms and Conditions"
      draftNotice="Our Terms and Conditions are being finalised and have not been published yet. Until they are, the assessment form cannot be submitted, because we will not collect consent against terms that do not exist."
    />
  );
}
