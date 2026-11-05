import type { Metadata } from 'next';
import { ArrowRight, Users } from 'lucide-react';
import Link from 'next/link';

import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import { TeamCard } from '@/components/site/cards';
import { ConfigurationNotice, EmptyState } from '@/components/site/empty-state';
import { Container, PageHeader, Section } from '@/components/site/section';
import { PreviewRibbon } from '@/components/site/preview-ribbon';
import { buttonStyles } from '@/components/ui/button';
import { getPublishedTeamMembers, getSeoOverride, getSiteIdentity } from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';
import { isPreviewRequest } from '@/lib/cms/preview';

/**
 * Our Team.
 *
 * Only profiles with `status = 'published'` are selected (enforced in the query).
 * No invented staff, titles, qualifications or photographs are ever shown — an
 * agency with no published profiles sees a clear empty state.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([getSiteIdentity(), getSeoOverride('/team')]);

  return buildPageMetadata({
    route: '/team',
    title: 'Our Team',
    description: 'The people who review assessments and support applicants.',
    identity,
    seo,
  });
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const preview = await isPreviewRequest(await searchParams);
  const result = await getPublishedTeamMembers({ includeDrafts: preview });
  const members = result.ok ? result.data : [];
  const notConfigured = !result.ok && result.reason === 'not_configured';

  return (
    <>
      {preview ? <PreviewRibbon isPublished={false} /> : null}

      <PageHeader
        eyebrow="Our Team"
        title="Who you will work with"
        description="The people who review your assessment and guide you through each stage."
      />

      <Section>
        <Container>
          {notConfigured ? <ConfigurationNotice className="mb-8" /> : null}

          {members.length > 0 ? (
            <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {members.map((member) => (
                <RevealItem key={member.id}>
                  <TeamCard member={member} />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : (
            <EmptyState
              icon={Users}
              title={
                notConfigured
                  ? 'Team profiles are temporarily unavailable'
                  : 'No team profiles have been published yet'
              }
              description={
                notConfigured
                  ? 'This section will return once the website is fully connected.'
                  : 'Team profiles are published from the administration portal. None have been published so far.'
              }
              action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
            />
          )}

          <div className="mt-10">
            <Link href={PRIMARY_CTA_HREF} className={buttonStyles('primary', 'md')}>
              {PRIMARY_CTA_LABEL}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
