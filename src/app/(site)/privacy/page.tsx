import type { Metadata } from 'next';

import { LegalPage } from '@/components/site/legal-page';
import { getPublishedPage, getSeoOverride, getSiteIdentity } from '@/db/queries';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Privacy Policy.
 *
 * As with Terms, the published version of this page is what the assessment form
 * references when it records consent.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, pageResult, seo] = await Promise.all([
    getSiteIdentity(),
    getPublishedPage('privacy'),
    getSeoOverride('/privacy'),
  ]);

  const page = pageResult.ok ? pageResult.data : null;

  return buildPageMetadata({
    route: '/privacy',
    title: page?.title?.trim() || 'Privacy Policy',
    description: page?.subtitle?.trim() || undefined,
    identity,
    seo,
  });
}

export default async function PrivacyPage() {
  const result = await getPublishedPage('privacy');
  const page = result.ok ? result.data : null;

  return (
    <LegalPage
      page={page}
      eyebrow="Legal"
      fallbackTitle="Privacy Policy"
      draftNotice="Our Privacy Policy is being finalised and has not been published yet. How we handle personal data is described in it, so we will not collect assessment information until it is published."
    />
  );
}
