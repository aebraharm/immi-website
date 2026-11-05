import type { Metadata } from 'next';
import { ArrowRight, Globe2 } from 'lucide-react';
import Link from 'next/link';

import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { CountryCard } from '@/components/site/cards';
import { ConfigurationNotice, EmptyState } from '@/components/site/empty-state';
import { Container, PageHeader, Section } from '@/components/site/section';
import { buttonStyles } from '@/components/ui/button';
import { getPublishedCountries, getSeoOverride, getSiteIdentity } from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Destinations listing.
 *
 * Shows the countries an administrator has published. Requirements, fees and
 * processing times are never summarised here — those live on each destination
 * page, entered manually, precisely because they change and must not be guessed.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([
    getSiteIdentity(),
    getSeoOverride('/destinations'),
  ]);

  return buildPageMetadata({
    route: '/destinations',
    title: 'Destinations',
    description: 'Countries where the agency supports international employment applications.',
    identity,
    seo,
  });
}

export default async function DestinationsPage() {
  const result = await getPublishedCountries();
  const countries = result.ok ? result.data : [];
  const notConfigured = !result.ok && result.reason === 'not_configured';

  return (
    <>
      <PageHeader
        eyebrow="Destinations"
        title="Where we support applications"
        description="Explore the countries we work with. Each destination page lists the requirements, documents and process details published by the agency."
      />

      <Section>
        <Container>
          {notConfigured ? <ConfigurationNotice className="mb-8" /> : null}

          {countries.length > 0 ? (
            <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <RevealItem key={country.id}>
                  <CountryCard country={country} headingLevel={2} />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : (
            <EmptyState
              icon={Globe2}
              title={
                notConfigured
                  ? 'Destinations are temporarily unavailable'
                  : 'No destinations have been published yet'
              }
              description={
                notConfigured
                  ? 'This section will return once the website is fully connected.'
                  : 'Destination guides are published one at a time from the administration portal. Nothing is shown until the agency has reviewed and published it.'
              }
              action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
            />
          )}

          {/* Compliance panel — factual, no promises. */}
          <Reveal delay={0.1} className="mt-12">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
              <h2 className="text-sm font-semibold text-ink">
                About the information on these pages
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Immigration rules, eligibility criteria, fees and processing times are
                set by each country&apos;s authorities and change without notice. The
                details published here are entered by the agency as general guidance
                and are not legal advice. Always confirm requirements with the official
                authority before making decisions or payments.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={PRIMARY_CTA_HREF} className={buttonStyles('primary', 'md')}>
              {PRIMARY_CTA_LABEL}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/contact" className={buttonStyles('outline', 'md')}>
              Ask about a country
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
