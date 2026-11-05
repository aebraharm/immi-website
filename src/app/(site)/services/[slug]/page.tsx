import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Reveal } from '@/components/motion/reveal';
import { EmptyState } from '@/components/site/empty-state';
import { Markdown } from '@/components/site/markdown';
import { PreviewRibbon } from '@/components/site/preview-ribbon';
import { Container, PageHeader, Section } from '@/components/site/section';
import { buttonStyles } from '@/components/ui/button';
import { getSeoOverride, getServiceBySlug, getSiteIdentity } from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { isPreviewRequest } from '@/lib/cms/preview';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Service detail.
 *
 * Content is the administrator's own Markdown plus the repeatable feature list.
 * If a service has been published with only a title, the page renders the title
 * and an honest "details coming soon" state rather than padding it out.
 */

export const dynamic = 'force-dynamic';

type RouteParams = { slug: string };
type RouteSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Metadata is always generated from the published version: a preview must not
  // change what search engines or link unfurls see.
  const [identity, serviceResult, seo] = await Promise.all([
    getSiteIdentity(),
    getServiceBySlug(slug),
    getSeoOverride(`/services/${slug}`),
  ]);

  const service = serviceResult.ok ? serviceResult.data : null;
  if (!service) {
    return { title: 'Service not found', robots: { index: false, follow: false } };
  }

  return buildPageMetadata({
    route: `/services/${service.slug}`,
    title: service.title,
    description: service.shortDescription,
    identity,
    seo,
    imageUrl: service.imageUrl,
  });
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: RouteSearchParams;
}) {
  const { slug } = await params;
  const preview = await isPreviewRequest(await searchParams);

  const result = await getServiceBySlug(slug, { includeDrafts: preview });
  const service = result.ok ? result.data : null;

  if (!service) notFound();

  const hasBody = service.descriptionMd.trim().length > 0;

  return (
    <>
      {preview ? <PreviewRibbon isPublished={service.status === 'published'} /> : null}

      <PageHeader
        eyebrow="Service"
        title={service.title}
        description={service.shortDescription || undefined}
        breadcrumb={
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            All services
          </Link>
        }
      />

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
            <div>
              {hasBody ? (
                <Reveal>
                  <Markdown content={service.descriptionMd} />
                </Reveal>
              ) : (
                <EmptyState
                  title="Full details are being prepared"
                  description="A summary of this service has been published, but the detailed description has not been added yet."
                  action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
                />
              )}

              {service.features.length > 0 ? (
                <div className="mt-10">
                  <h2 className="text-display-sm font-semibold text-ink">
                    What this includes
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {service.features.map((feature) => (
                      <li key={feature.id} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"
                        >
                          <Check className="size-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-ink">{feature.label}</p>
                          {feature.detailMd ? (
                            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                              {feature.detailMd}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <aside>
              <Reveal direction="left">
                <div className="glass rounded-xl p-6">
                  <h2 className="text-base font-semibold text-ink">
                    Discuss this service
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Complete the assessment form and our team will review your
                    background against the options that may apply to you.
                  </p>

                  <Link
                    href={service.ctaHref || PRIMARY_CTA_HREF}
                    className={buttonStyles('primary', 'md', 'mt-5 w-full')}
                  >
                    {service.ctaLabel || PRIMARY_CTA_LABEL}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>

                  <p className="mt-4 text-[0.6875rem] leading-relaxed text-slate-500">
                    Submitting an assessment is free of obligation and does not
                    guarantee eligibility or approval.
                  </p>
                </div>
              </Reveal>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}

