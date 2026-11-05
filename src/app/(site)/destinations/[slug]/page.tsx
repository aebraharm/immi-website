import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BadgeCheck, Briefcase, Globe2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Reveal } from '@/components/motion/reveal';
import { EmptyState } from '@/components/site/empty-state';
import { Markdown } from '@/components/site/markdown';
import { RequirementGroups } from '@/components/site/requirement-list';
import { PreviewRibbon } from '@/components/site/preview-ribbon';
import { Container, PageHeader, Section } from '@/components/site/section';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import {
  getCountryDetailBySlug,
  getDestinationBySlug,
  getSeoOverride,
  getSiteIdentity,
  type CountryDetail,
  type DestinationDetail,
} from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { isPreviewRequest } from '@/lib/cms/preview';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Destination detail.
 *
 * A slug resolves to one of two page shapes:
 *
 *  1. A **programme** (`/destinations/skilled-worker-route`) — a single visa route
 *     with its categories, requirements, notices and opportunities.
 *  2. A **country** (`/destinations/canada`) — the country summary plus the list
 *     of its published programmes, or its own description when none exist yet.
 *
 * Programme is checked first because it is the more specific match. Every fact
 * displayed is administrator-entered; empty categories are omitted rather than
 * filled with invented eligibility criteria.
 */

export const dynamic = 'force-dynamic';

type RouteParams = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;

  const [identity, programmeResult, countryResult] = await Promise.all([
    getSiteIdentity(),
    getDestinationBySlug(slug),
    getCountryDetailBySlug(slug),
  ]);

  const seo = await getSeoOverride(`/destinations/${slug}`);
  const programme = programmeResult.ok ? programmeResult.data : null;
  const countryDetail = countryResult.ok ? countryResult.data : null;

  if (programme) {
    return buildPageMetadata({
      route: `/destinations/${programme.slug}`,
      title: programme.title,
      description: programme.summary,
      identity,
      seo,
      imageUrl: programme.heroImageUrl,
    });
  }

  if (countryDetail) {
    return buildPageMetadata({
      route: `/destinations/${countryDetail.country.slug}`,
      title: countryDetail.country.name,
      description: countryDetail.country.summary,
      identity,
      seo,
      imageUrl: countryDetail.country.heroImageUrl,
    });
  }

  return { title: 'Destination not found', robots: { index: false, follow: false } };
}

export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;

  // `?preview=1` widens the read to unpublished rows, but only for a signed-in
  // administrator. `programme.status`/`country.status` decide the ribbon.
  const preview = await isPreviewRequest(await searchParams);

  const programmeResult = await getDestinationBySlug(slug, { includeDrafts: preview });
  if (programmeResult.ok && programmeResult.data) {
    return (
      <>
        {preview ? (
          <PreviewRibbon isPublished={programmeResult.data.status === 'published'} />
        ) : null}
        <ProgrammeView programme={programmeResult.data} />
      </>
    );
  }

  const countryResult = await getCountryDetailBySlug(slug, { includeDrafts: preview });
  if (countryResult.ok && countryResult.data) {
    return (
      <>
        {preview ? (
          <PreviewRibbon isPublished={countryResult.data.country.status === 'published'} />
        ) : null}
        <CountryView detail={countryResult.data} />
      </>
    );
  }

  notFound();
}

/* ========================================================================== */
/* Country view                                                               */
/* ========================================================================== */

function CountryView({ detail }: { detail: CountryDetail }) {
  const { country, programmes } = detail;
  const heroImage = country.heroImageUrl ?? programmes[0]?.heroImageUrl ?? null;
  const hasDescription = country.descriptionMd.trim().length > 0;

  return (
    <>
      <div className="relative isolate overflow-hidden border-b border-[var(--border-subtle)]">
        {heroImage ? (
          <>
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="-z-20 object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-white/90 backdrop-blur-sm"
            />
          </>
        ) : (
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-mesh-subtle" />
        )}

        <Container className="py-14 sm:py-18 lg:py-20">
          <Link
            href="/destinations"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            All destinations
          </Link>

          <div className="mt-5 flex items-center gap-3">
            {country.flagUrl ? (
              <Image
                src={country.flagUrl}
                alt={`Flag of ${country.name}`}
                width={36}
                height={24}
                className="h-6 w-9 rounded-sm object-cover ring-1 ring-black/10"
              />
            ) : (
              <span aria-hidden="true" className="text-slate-300">
                <MapPin className="size-5" />
              </span>
            )}
            <Badge tone="neutral">{country.isoCode}</Badge>
          </div>

          <h1 className="mt-3 text-display-lg font-semibold text-ink">{country.name}</h1>

          {country.summary ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              {country.summary}
            </p>
          ) : null}
        </Container>
      </div>

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
            <div>
              {hasDescription ? (
                <Reveal>
                  <Markdown content={country.descriptionMd} />
                </Reveal>
              ) : (
                <EmptyState
                  icon={Globe2}
                  title="Destination details are being prepared"
                  description="The agency has published this country but has not added its guide yet. Check back soon, or contact us to ask about current options."
                  action={{ label: 'Contact us', href: '/contact' }}
                />
              )}

              {programmes.length > 0 ? (
                <div className="mt-12">
                  <h2 className="text-display-sm font-semibold text-ink">
                    Programmes for {country.name}
                  </h2>

                  <ul className="mt-5 space-y-3">
                    {programmes.map((programme) => (
                      <li key={programme.id}>
                        <Link
                          href={`/destinations/${programme.slug}`}
                          className="group flex items-start justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-white p-5 transition-colors hover:border-accent-200 hover:bg-accent-50/40"
                        >
                          <div>
                            <p className="font-semibold text-ink group-hover:text-accent-800">
                              {programme.title}
                            </p>
                            {programme.summary ? (
                              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                {programme.summary}
                              </p>
                            ) : null}
                            {programme.visaCategories.length > 0 ? (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {programme.visaCategories.slice(0, 4).map((category) => (
                                  <Badge key={category.id} tone="info">
                                    {category.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <ArrowRight
                            aria-hidden="true"
                            className="mt-1 size-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700 motion-reduce:group-hover:translate-x-0"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-10">
                  <EmptyState
                    variant="compact"
                    icon={BadgeCheck}
                    title="No programmes published for this country yet"
                    description="Immigration routes for this destination have not been published. Contact us to ask about current options."
                    action={{ label: 'Contact us', href: '/contact' }}
                  />
                </div>
              )}
            </div>

            <aside className="lg:sticky lg:top-24">
              <Reveal direction="left">
                <div className="glass rounded-xl p-6">
                  <h2 className="text-base font-semibold text-ink">
                    Interested in {country.name}?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Submit an assessment and our team will discuss which routes may
                    apply to your profile.
                  </p>
                  <Link
                    href={PRIMARY_CTA_HREF}
                    className={buttonStyles('primary', 'md', 'mt-5 w-full')}
                  >
                    {PRIMARY_CTA_LABEL}
                  </Link>
                </div>
              </Reveal>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}

/* ========================================================================== */
/* Programme view                                                             */
/* ========================================================================== */

function ProgrammeView({ programme }: { programme: DestinationDetail }) {
  const hasBody = programme.descriptionMd.trim().length > 0;
  const hasProcessing = programme.processingInfoMd.trim().length > 0;
  const hasRequirements = programme.requirements.length > 0;
  const hasOpportunities = programme.opportunities.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={programme.country.name}
        title={programme.title}
        description={programme.summary || undefined}
        breadcrumb={
          <Link
            href={`/destinations/${programme.country.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            All {programme.country.name} programmes
          </Link>
        }
      />

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <div className="space-y-10">
              {/* The administrator's notice is shown above everything else. */}
              {programme.importantNoticeMd ? (
                <Reveal>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
                    <h2 className="text-sm font-semibold text-amber-900">Important notice</h2>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-amber-900">
                      {programme.importantNoticeMd}
                    </p>
                  </div>
                </Reveal>
              ) : null}

              {hasBody ? (
                <Reveal delay={0.06}>
                  <Markdown content={programme.descriptionMd} />
                </Reveal>
              ) : (
                <EmptyState
                  title="Programme details are being prepared"
                  description="This programme has been published with a summary only. The detailed guide is still being written."
                  action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
                />
              )}

              {hasProcessing ? (
                <div>
                  <h2 className="text-display-sm font-semibold text-ink">
                    How the process works
                  </h2>
                  <div className="mt-4">
                    <Markdown content={programme.processingInfoMd} />
                  </div>
                </div>
              ) : null}

              {hasRequirements ? (
                <div>
                  <h2 className="text-display-sm font-semibold text-ink">
                    Requirements and documents
                  </h2>
                  <div className="mt-6">
                    <RequirementGroups requirements={programme.requirements} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={BadgeCheck}
                  title="No requirements have been published for this programme"
                  description="Eligibility criteria, documents and language requirements have not been added yet. We do not display generic requirements, because they differ by route and change frequently."
                  action={{ label: 'Ask about this programme', href: '/contact' }}
                />
              )}

              {programme.visaCategories.length > 0 ? (
                <div>
                  <h2 className="text-display-sm font-semibold text-ink">Visa categories</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {programme.visaCategories.map((category) => (
                      <li
                        key={category.id}
                        className="rounded-lg border border-[var(--border-subtle)] bg-white p-4"
                      >
                        <p className="text-sm font-semibold text-ink">{category.name}</p>
                        {category.code ? (
                          <p className="mt-0.5 font-mono text-xs text-slate-600">
                            {category.code}
                          </p>
                        ) : null}
                        {category.descriptionMd ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                            {category.descriptionMd}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {hasOpportunities ? (
                <div>
                  <h2 className="text-display-sm font-semibold text-ink">
                    Employment opportunities
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {programme.opportunities.map((opportunity) => (
                      <li
                        key={opportunity.id}
                        className="rounded-lg border border-[var(--border-subtle)] bg-white p-5"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"
                          >
                            <Briefcase className="size-4.5" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {opportunity.title}
                            </p>
                            {opportunity.sector ? (
                              <p className="mt-0.5 text-xs uppercase tracking-[0.08em] text-slate-600">
                                {opportunity.sector}
                              </p>
                            ) : null}
                            {opportunity.descriptionMd ? (
                              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                                {opportunity.descriptionMd}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    Opportunities are listed for information only and are subject to
                    change or withdrawal by the employer. Listing does not constitute a
                    job offer.
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <Reveal direction="left">
                <div className="glass rounded-xl p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                    Destination
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {programme.country.name}
                  </p>

                  <Link
                    href={PRIMARY_CTA_HREF}
                    className={buttonStyles('primary', 'md', 'mt-5 w-full')}
                  >
                    {PRIMARY_CTA_LABEL}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>

                  <Link href="/contact" className={buttonStyles('outline', 'md', 'mt-2 w-full')}>
                    Ask a question
                  </Link>
                </div>
              </Reveal>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
                <p className="text-xs leading-relaxed text-slate-600">
                  Requirements, fees and processing times are set by the destination
                  authorities and can change at any time. Always verify with the official
                  source before acting on this information.
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}

