import type { Metadata } from 'next';
import { CalendarCheck, Clock, FileText, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { AssessmentWizard } from '@/components/assessment/wizard';
import { Reveal } from '@/components/motion/reveal';
import { EmptyState } from '@/components/site/empty-state';
import { Logo } from '@/components/site/logo';
import { Container, PageHeader, Section } from '@/components/site/section';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import {
  getDestinationOptions,
  getPublishedPage,
  getSeoOverride,
  getSiteIdentity,
} from '@/db/queries';
import { PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Assessment entry point — the multi-step form.
 *
 * The page decides *whether* the form may be offered, then hands the data it has
 * already loaded to the client wizard. Two conditions are content conditions, not
 * features, and both are checked here on the server:
 *
 *  1. The form cannot open until the Terms and Privacy pages are published —
 *     consent has to reference real documents, and the submission route checks the
 *     same two pages again at the moment of writing.
 *  2. The destination selector needs at least one published country, since that
 *     list is administrator-configured rather than hard-coded.
 *
 * When either is missing the page says so plainly instead of presenting a form
 * that cannot be completed.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([getSiteIdentity(), getSeoOverride('/assessment')]);

  return buildPageMetadata({
    route: '/assessment',
    title: 'Assessment Form',
    description:
      'Complete our assessment form so our team can review your background and discuss the options that may apply to you.',
    identity,
    seo,
  });
}

export default async function AssessmentPage() {
  const [identity, termsResult, privacyResult, destinations] = await Promise.all([
    getSiteIdentity(),
    getPublishedPage('terms'),
    getPublishedPage('privacy'),
    getDestinationOptions(),
  ]);

  const terms = termsResult.ok ? termsResult.data : null;
  const privacy = privacyResult.ok ? privacyResult.data : null;

  const legalReady = Boolean(terms && privacy);
  const destinationsReady = destinations.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Book a Consultation"
        title={PRIMARY_CTA_LABEL}
        description="Tell us about your background and we will review it and contact you to discuss the options that may apply."
      />

      <Section className="py-10 sm:py-14">
        <Container>
          {legalReady && destinationsReady ? (
            <>
              <Reveal>
                <div className="mb-6 flex flex-wrap items-center gap-2.5">
                  <Badge tone="info">
                    <Clock aria-hidden="true" className="size-3" />
                    10–15 minutes
                  </Badge>
                  <Badge tone="neutral">
                    <FileText aria-hidden="true" className="size-3" />
                    Have your CV ready
                  </Badge>
                  <Badge tone="neutral">
                    <Lock aria-hidden="true" className="size-3" />
                    Private and secure
                  </Badge>
                  <Badge tone="success">
                    <ShieldCheck aria-hidden="true" className="size-3" />
                    No account needed
                  </Badge>
                </div>
              </Reveal>

              <Reveal delay={0.05}>
                <AssessmentWizard
                  identity={identity}
                  destinations={destinations.map((destination) => ({
                    id: destination.id,
                    name: destination.name,
                  }))}
                />
              </Reveal>
            </>
          ) : (
            <div className="mx-auto max-w-2xl">
              <div className="glass rounded-xl p-6 sm:p-8">
                <div className="mb-4 border-b border-[var(--border-subtle)] pb-4">
                  <Logo identity={identity} size="sm" href={null} showWordmark />
                </div>

                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <CalendarCheck aria-hidden="true" className="size-4.5 text-accent-700" />
                  The assessment form is not open yet
                </h2>

                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
                  {!legalReady ? (
                    <li className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>
                        Our Terms and Conditions and Privacy Policy must be published before we can
                        ask you to accept them.
                      </span>
                    </li>
                  ) : null}
                  {!destinationsReady ? (
                    <li className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>At least one destination must be published.</span>
                    </li>
                  ) : null}
                </ul>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Link href="/contact" className={buttonStyles('primary', 'md')}>
                    Contact us instead
                  </Link>
                  <Link href="/" className={buttonStyles('ghost', 'md')}>
                    Back to the homepage
                  </Link>
                </div>
              </div>

              {!legalReady ? (
                <div className="mt-6">
                  <EmptyState
                    variant="compact"
                    title="Legal documents pending"
                    description="We will not collect your information until our Terms and Privacy Policy are published."
                    action={{ label: 'Read our Terms', href: '/terms' }}
                  />
                </div>
              ) : null}
            </div>
          )}
        </Container>
      </Section>

      {/* Reassurance strip — claims only about what the site does, never about outcomes. */}
      <Section muted className="py-12">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                title: 'No account required',
                detail:
                  'You do not create a login. The public website and this form are all you need.',
              },
              {
                title: 'Your data stays private',
                detail:
                  'Your CV is stored in private storage and is never published. Only authorised agency staff can open it.',
              },
              {
                title: 'No payment on this site',
                detail:
                  'We never ask for payment through the website. Any fees are discussed and agreed separately in writing.',
              },
            ].map((item) => (
              <div key={item.title}>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-xs leading-relaxed text-slate-500">
            Submitting this form does not mean you are eligible for any visa, and does not guarantee a
            visa, a job or an interview. Our team reviews each enquiry individually and will contact
            you to discuss your circumstances.
          </p>
        </Container>
      </Section>

      {identity.agencyName ? (
        <span className="sr-only">Assessment form for {identity.agencyName}</span>
      ) : null}
    </>
  );
}
