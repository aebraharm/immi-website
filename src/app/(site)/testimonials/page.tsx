import type { Metadata } from 'next';
import { ArrowRight, MessageSquareQuote } from 'lucide-react';
import Link from 'next/link';

import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { TestimonialCard } from '@/components/site/cards';
import { ConfigurationNotice, EmptyState } from '@/components/site/empty-state';
import { Container, PageHeader, Section } from '@/components/site/section';
import { PreviewRibbon } from '@/components/site/preview-ribbon';
import { buttonStyles } from '@/components/ui/button';
import { getPublishedTestimonials, getSeoOverride, getSiteIdentity } from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';
import { isPreviewRequest } from '@/lib/cms/preview';

/**
 * Testimonials.
 *
 * Every testimonial is authored by an administrator — there is no client account
 * system in this product, so nothing can be auto-generated. The page states its
 * publication policy openly rather than implying a volume of clients it cannot
 * evidence.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([
    getSiteIdentity(),
    getSeoOverride('/testimonials'),
  ]);

  return buildPageMetadata({
    route: '/testimonials',
    title: 'Testimonials',
    description: 'Experiences shared by clients, published with their permission.',
    identity,
    seo,
  });
}

export default async function TestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const preview = await isPreviewRequest(await searchParams);
  const result = await getPublishedTestimonials({ includeDrafts: preview });
  const testimonials = result.ok ? result.data : [];
  const notConfigured = !result.ok && result.reason === 'not_configured';

  return (
    <>
      {preview ? <PreviewRibbon isPublished={false} /> : null}

      <PageHeader
        eyebrow="Testimonials"
        title="Client experiences"
        description="Stories from people we have supported, published only with their permission."
      />

      <Section>
        <Container>
          {notConfigured ? <ConfigurationNotice className="mb-8" /> : null}

          {testimonials.length > 0 ? (
            <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <RevealItem key={testimonial.id}>
                  <TestimonialCard testimonial={testimonial} />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : (
            <EmptyState
              icon={MessageSquareQuote}
              title={
                notConfigured
                  ? 'Testimonials are temporarily unavailable'
                  : 'No testimonials have been published yet'
              }
              description={
                notConfigured
                  ? 'This section will return once the website is fully connected.'
                  : 'We only publish testimonials that a client has given us permission to share. None have been published so far — we would rather show nothing than write something that did not happen.'
              }
              action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
            />
          )}

          <Reveal delay={0.1} className="mt-12">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
              <h2 className="text-sm font-semibold text-ink">How these are collected</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Testimonials are added by the agency after a client agrees to share
                their experience. Names are displayed as the client chooses, and we do
                not publish details of an individual&apos;s application or its outcome.
                A testimonial reflects one person&apos;s experience and is not a
                prediction of any other outcome.
              </p>
            </div>
          </Reveal>

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
