import type { Metadata } from 'next';
import { ArrowRight, Building2, Info } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { EmptyState } from '@/components/site/empty-state';
import { Markdown } from '@/components/site/markdown';
import { PageHeader, Container, Section, SectionHeading } from '@/components/site/section';
import { buttonStyles } from '@/components/ui/button';
import {
  getPublishedPage,
  getSeoOverride,
  getSiteIdentity,
  getSiteSettings,
} from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * About Us.
 *
 * The narrative, subtitle and title all live in the `website_pages` row with
 * slug `about`, so the agency writes this page in the admin portal. When it has
 * not been published, the page says so and offers alternatives instead of
 * inventing a company history, founding year, or mission statement.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, page, seo] = await Promise.all([
    getSiteIdentity(),
    getPublishedPage('about'),
    getSeoOverride('/about'),
  ]);

  const row = page.ok ? page.data : null;

  return buildPageMetadata({
    route: '/about',
    title: row?.title || 'About Us',
    description: row?.subtitle || identity.shortDescription,
    identity,
    seo,
  });
}

export default async function AboutPage() {
  const [identity, pageResult, settingsResult] = await Promise.all([
    getSiteIdentity(),
    getPublishedPage('about'),
    getSiteSettings(),
  ]);

  const page = pageResult.ok ? pageResult.data : null;
  const settings = settingsResult.ok ? settingsResult.data : null;

  const hasContent = Boolean(page && (page.contentMd.trim() || page.title.trim()));

  return (
    <>
      <PageHeader
        eyebrow="About Us"
        title={page?.title?.trim() || 'About the agency'}
        description={page?.subtitle?.trim() || undefined}
      />

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
            <div>
              {hasContent && page ? (
                <Reveal>
                  <Markdown content={page.contentMd} />
                </Reveal>
              ) : (
                <EmptyState
                  icon={Info}
                  title="The About page has not been published yet"
                  description="The agency is still preparing this page. Once published from the administration portal, the full story will appear here."
                  action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
                />
              )}

              {page?.lastReviewedOn ? (
                <p className="mt-10 text-xs text-slate-600">
                  Last reviewed: {page.lastReviewedOn}
                </p>
              ) : null}
            </div>

            {/* Factual side panel: only shows values that actually exist. */}
            <aside className="space-y-4">
              <Reveal direction="left">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Building2 aria-hidden="true" className="size-4 text-slate-600" />
                    Agency details
                  </h2>

                  <dl className="mt-4 space-y-3 text-sm">
                    {identity.agencyName ? (
                      <div>
                        <dt className="text-xs uppercase tracking-[0.1em] text-slate-600">
                          Agency
                        </dt>
                        <dd className="mt-0.5 font-medium text-ink">
                          {identity.agencyName}
                        </dd>
                      </div>
                    ) : null}

                    {identity.contact.addressLines.length > 0 ? (
                      <div>
                        <dt className="text-xs uppercase tracking-[0.1em] text-slate-600">
                          Address
                        </dt>
                        <dd className="mt-0.5 leading-relaxed text-slate-700">
                          {identity.contact.addressLines.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}

                    {identity.contact.officeHours ? (
                      <div>
                        <dt className="text-xs uppercase tracking-[0.1em] text-slate-600">
                          Office hours
                        </dt>
                        <dd className="mt-0.5 text-slate-700">{identity.contact.officeHours}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {!identity.agencyName && identity.contact.addressLines.length === 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      Agency details have not been added yet.
                    </p>
                  ) : null}
                </div>
              </Reveal>

              {settings?.longDescription ? (
                <Reveal direction="left" delay={0.08}>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-6">
                    <h2 className="text-sm font-semibold text-ink">In brief</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {settings.longDescription}
                    </p>
                  </div>
                </Reveal>
              ) : null}

              <Reveal direction="left" delay={0.12}>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-6">
                  <h2 className="text-sm font-semibold text-ink">Where to next</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li>
                      <Link
                        href="/services"
                        className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:underline"
                      >
                        Our services <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/team"
                        className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:underline"
                      >
                        Meet the team <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/destinations"
                        className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:underline"
                      >
                        Destinations <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  </ul>
                </div>
              </Reveal>
            </aside>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section muted className="py-14 sm:py-16">
        <Container>
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-[var(--border-subtle)] bg-white p-8 sm:flex-row sm:items-center">
            <SectionHeading
              title="Ready to discuss your options?"
              description="Complete a short assessment and our team will review your background."
              className="max-w-lg"
            />
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
