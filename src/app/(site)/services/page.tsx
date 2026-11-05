import type { Metadata } from 'next';
import { ArrowRight, Briefcase } from 'lucide-react';
import Link from 'next/link';

import { RevealGroup, RevealItem, Reveal } from '@/components/motion/reveal';
import { ServiceCard } from '@/components/site/cards';
import { EmptyState } from '@/components/site/empty-state';
import { PageHeader, Container, Section } from '@/components/site/section';
import { buttonStyles } from '@/components/ui/button';
import { getPublishedServices, getSeoOverride, getSiteIdentity } from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Services listing.
 *
 * Titles, descriptions, features, icons and images all come from the `services`
 * table. Only `status = 'published'` rows appear (enforced in the query layer).
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([getSiteIdentity(), getSeoOverride('/services')]);

  return buildPageMetadata({
    route: '/services',
    title: 'Services',
    description:
      'Immigration guidance, overseas employment support and application assistance.',
    identity,
    seo,
  });
}

export default async function ServicesPage() {
  const result = await getPublishedServices();
  const services = result.ok ? result.data : [];
  const notConfigured = !result.ok && result.reason === 'not_configured';

  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="How we can help"
        description="Practical support at every stage — from assessing your options to preparing the documents an authority asks for."
      />

      <Section>
        <Container>
          {services.length > 0 ? (
            <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <RevealItem key={service.id}>
                  <ServiceCard service={service} headingLevel={2} />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : (
            <EmptyState
              icon={Briefcase}
              title={
                notConfigured
                  ? 'Services are temporarily unavailable'
                  : 'No services have been published yet'
              }
              description={
                notConfigured
                  ? 'This section will return once the website is fully connected.'
                  : 'The agency has not published any services yet. Once they are added in the administration portal they will appear here.'
              }
              action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
            />
          )}

          <Reveal delay={0.1} className="mt-12">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
              <p className="text-sm leading-relaxed text-slate-600">
                <span className="font-semibold text-ink">Please note:</span> we do not
                sell visas, guarantee employment, or promise approval. Any fees,
                requirements and processing times are set by the relevant authorities
                and by individual employers, and are confirmed in writing before you
                commit to anything.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={PRIMARY_CTA_HREF} className={buttonStyles('primary', 'md')}>
              {PRIMARY_CTA_LABEL}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/contact" className={buttonStyles('outline', 'md')}>
              Ask a question
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
