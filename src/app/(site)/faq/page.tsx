import type { Metadata } from 'next';
import { ArrowRight, HelpCircle } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { FaqAccordion } from '@/components/site/faq-accordion';
import { ConfigurationNotice, EmptyState } from '@/components/site/empty-state';
import { Container, PageHeader, Section } from '@/components/site/section';
import { PreviewRibbon } from '@/components/site/preview-ribbon';
import { buttonStyles } from '@/components/ui/button';
import {
  getPublishedFaqs,
  getSeoOverride,
  getSiteIdentity,
  groupFaqsByCategory,
} from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';
import { isPreviewRequest } from '@/lib/cms/preview';

/**
 * Frequently Asked Questions.
 *
 * Questions and answers are administrator-authored. The page also emits
 * `FAQPage` structured data — but only from real questions in the database, so
 * search engines never index an invented Q&A pair.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([getSiteIdentity(), getSeoOverride('/faq')]);

  return buildPageMetadata({
    route: '/faq',
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about assessments, destinations and the process.',
    identity,
    seo,
  });
}

/** Strip markdown punctuation so structured data contains plain text. */
function plainText(markdown: string): string {
  return markdown
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const preview = await isPreviewRequest(await searchParams);
  const result = await getPublishedFaqs({ includeDrafts: preview });
  const faqs = result.ok ? result.data : [];
  const notConfigured = !result.ok && result.reason === 'not_configured';
  const groups = groupFaqsByCategory(faqs);

  // Structured data from real content only.
  const jsonLd =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs
            .filter((faq) => plainText(faq.answerMd).length > 0)
            .map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: plainText(faq.answerMd),
              },
            })),
        }
      : null;

  return (
    <>
      {preview ? <PreviewRibbon isPublished={false} /> : null}

      <PageHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        description="Answers to the questions we are asked most often. If yours is not here, please get in touch."
      />

      <Section>
        <Container size="narrow">
          {notConfigured ? <ConfigurationNotice className="mb-8" /> : null}

          {groups.length > 0 ? (
            <div className="space-y-10">
              {groups.map((group) => (
                <div key={group.category}>
                  {groups.length > 1 ? (
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {group.category}
                    </h2>
                  ) : null}
                  <Reveal>
                    <FaqAccordion items={group.items} />
                  </Reveal>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={HelpCircle}
              title={
                notConfigured
                  ? 'Questions are temporarily unavailable'
                  : 'No questions have been published yet'
              }
              description={
                notConfigured
                  ? 'This section will return once the website is fully connected.'
                  : 'The agency has not published any frequently asked questions yet.'
              }
              action={{ label: 'Contact us instead', href: '/contact' }}
            />
          )}

          <Reveal delay={0.1} className="mt-12">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-7 text-center">
              <h2 className="text-lg font-semibold text-ink">Still have a question?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                Complete the assessment and tell us about your situation — our team can
                answer specific questions about your background.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href={PRIMARY_CTA_HREF} className={buttonStyles('primary', 'md')}>
                  {PRIMARY_CTA_LABEL}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link href="/contact" className={buttonStyles('outline', 'md')}>
                  Contact us
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {jsonLd ? (
        <script
          type="application/ld+json"
          // Content is our own database text, serialised by JSON.stringify —
          // not user input. Angle brackets are escaped defensively anyway.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      ) : null}
    </>
  );
}
