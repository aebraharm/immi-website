import type { Metadata } from 'next';
import { ArrowRight, Compass, Globe2, MessageSquareQuote, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { CountryCard, ServiceCard, TeamCard, TestimonialCard } from '@/components/site/cards';
import { ConfigurationNotice, EmptyState } from '@/components/site/empty-state';
import { Container, Section, SectionHeading } from '@/components/site/section';
import { buttonStyles } from '@/components/ui/button';
import {
  findSection,
  getHomepageSections,
  getPublishedCountries,
  getPublishedFaqs,
  getPublishedServices,
  getPublishedTeamMembers,
  getPublishedTestimonials,
  getSeoOverride,
  getSiteIdentity,
  type HomepageSectionWithImage,
} from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildPageMetadata } from '@/lib/utils/metadata';

/**
 * Homepage.
 *
 * Every block below is driven by a `homepage_sections` row keyed by `section_key`.
 * The key chooses *which component* renders; the row supplies every word, link
 * and image. An administrator can therefore rewrite, hide or reorder the page
 * without touching this file.
 *
 * Design rule that drives the whole page: a section whose row is missing — or
 * whose row has no text — is simply not rendered. Nothing is fabricated to fill
 * a gap, and an unconfigured homepage shows a clear setup notice instead of a
 * plausible-looking lie.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([getSiteIdentity(), getSeoOverride('/')]);

  return buildPageMetadata({
    route: '/',
    title: identity.tagline || 'International employment and immigration guidance',
    description: identity.shortDescription,
    identity,
    seo,
  });
}

/* ========================================================================== */
/* Hero                                                                       */
/* ========================================================================== */

function Hero({ section }: { section: HomepageSectionWithImage | null }) {
  const heading = section?.heading?.trim() ?? '';
  const subheading = section?.subheading?.trim() ?? '';
  const body = section?.bodyMd?.trim() ?? '';

  // No hero row, or nothing written in it: show nothing rather than a
  // placeholder headline the agency never approved.
  if (!heading && !subheading && !body) return null;

  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border-subtle)] bg-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh-subtle" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fine [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]"
      />
      {/* Subtle background motion: a blurred brand orb that drifts very slowly. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 -z-10 size-[36rem] animate-ambient rounded-full bg-gradient-to-br from-brand-100/60 via-brand-50/30 to-transparent blur-3xl"
      />

      <Container className="py-16 sm:py-24 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            {subheading ? (
              <Reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  {subheading}
                </p>
              </Reveal>
            ) : null}

            {heading ? (
              <Reveal delay={0.06}>
                <h1 className="mt-5 text-display-hero font-semibold text-ink">
                  {heading}
                </h1>
              </Reveal>
            ) : null}

            {body ? (
              <Reveal delay={0.12}>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                  {body}
                </p>
              </Reveal>
            ) : null}

            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href={section?.ctaHref || PRIMARY_CTA_HREF} className={buttonStyles('primary', 'lg')}>
                  {section?.ctaLabel || PRIMARY_CTA_LABEL}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>

                {section?.secondaryCtaLabel && section?.secondaryCtaHref ? (
                  <Link
                    href={section.secondaryCtaHref}
                    className={buttonStyles('outline', 'lg')}
                  >
                    {section.secondaryCtaLabel}
                  </Link>
                ) : (
                  <Link href="/destinations" className={buttonStyles('outline', 'lg')}>
                    Explore destinations
                  </Link>
                )}
              </div>
            </Reveal>
          </div>

          {/* Glass panel: a quiet, premium visual anchor. Contains no claims. */}
          <Reveal delay={0.2} direction="left" className="hidden lg:block">
            <div className="glass rounded-xl p-7">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-md bg-accent-600 text-white"
                >
                  <Compass className="size-5" />
                </span>
                <p className="text-sm font-semibold text-ink">How it works</p>
              </div>

              <ol className="mt-6 space-y-5">
                {[
                  {
                    step: '01',
                    title: 'Complete the assessment',
                    detail:
                      'Tell us about your background, qualifications and preferred destination.',
                  },
                  {
                    step: '02',
                    title: 'Speak with our team',
                    detail:
                      'We review your details and discuss the routes that may apply to you.',
                  },
                  {
                    step: '03',
                    title: 'Prepare your application',
                    detail:
                      'We guide you through the documents and requirements an authority asks for.',
                  },
                ].map((item) => (
                  <li key={item.step} className="flex gap-4">
                    <span className="font-mono text-xs font-semibold text-brand-500">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-[0.6875rem] leading-relaxed text-slate-500">
                Submitting an assessment does not guarantee eligibility or approval.
                Decisions rest with the relevant authorities.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ========================================================================== */
/* Page                                                                       */
/* ========================================================================== */

export default async function HomePage() {
  const [sectionsResult, servicesResult, countriesResult, testimonialsResult, teamResult, faqsResult] =
    await Promise.all([
      getHomepageSections(),
      getPublishedServices(),
      getPublishedCountries(),
      getPublishedTestimonials(),
      getPublishedTeamMembers(),
      getPublishedFaqs(),
    ]);

  const sections = sectionsResult.ok ? sectionsResult.data : [];
  const services = servicesResult.ok ? servicesResult.data : [];
  const countries = countriesResult.ok ? countriesResult.data : [];
  const testimonials = testimonialsResult.ok ? testimonialsResult.data : [];
  const team = teamResult.ok ? teamResult.data : [];
  const faqs = faqsResult.ok ? faqsResult.data : [];

  const heroSection = findSection(sections, 'hero');
  const whySection = findSection(sections, 'why_us');
  const servicesSection = findSection(sections, 'services_preview');
  const destinationsSection = findSection(sections, 'destinations_preview');
  const testimonialsSection = findSection(sections, 'testimonials_preview');
  const teamSection = findSection(sections, 'team_preview');
  const ctaSection = findSection(sections, 'cta_band');
  const faqSection = findSection(sections, 'faq_preview');

  const databaseUnavailable = !sectionsResult.ok && sectionsResult.reason === 'not_configured';
  const hasAnySection = sections.length > 0;

  return (
    <>
      {/* ------------------------------------------------ configuration notice */}
      {databaseUnavailable ? (
        <Container className="pt-8">
          <ConfigurationNotice />
        </Container>
      ) : null}

      {/* ------------------------------------------------------------- hero */}
      <Hero section={heroSection} />

      {/*
        Absolute fallback: the site is connected but the owner has not written a
        single homepage section yet. Rather than show an empty page, explain the
        situation honestly and give visitors somewhere useful to go.
      */}
      {!databaseUnavailable && !hasAnySection ? (
        <Section>
          <Container>
            <EmptyState
              icon={Sparkles}
              title="This homepage has not been published yet"
              description="The site owner is still preparing the homepage content. In the meantime you can read about the agency, browse destinations, or book a consultation."
              action={{ label: 'Book a Consultation Now', href: PRIMARY_CTA_HREF }}
            />
          </Container>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- why us / about */}
      {whySection && (whySection.heading || whySection.bodyMd) ? (
        <Section>
          <Container>
            <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
              <SectionHeading
                eyebrow={whySection.subheading || undefined}
                title={whySection.heading || 'About our agency'}
                className="max-w-none"
              />

              <div className="space-y-6">
                {whySection.bodyMd ? (
                  <Reveal delay={0.1}>
                    <div className="space-y-4 text-base leading-relaxed text-slate-600">
                      {whySection.bodyMd
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                    </div>
                  </Reveal>
                ) : null}

                {whySection.ctaLabel && whySection.ctaHref ? (
                  <Reveal delay={0.16}>
                    <Link href={whySection.ctaHref} className={buttonStyles('outline', 'md')}>
                      {whySection.ctaLabel}
                    </Link>
                  </Reveal>
                ) : null}
              </div>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ services */}
      <Section muted>
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow={servicesSection?.subheading || 'What we do'}
              title={servicesSection?.heading || 'Our services'}
              description={servicesSection?.bodyMd || undefined}
            />
            <Reveal delay={0.08}>
              <Link href="/services" className={buttonStyles('ghost', 'sm')}>
                View all services
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Reveal>
          </div>

          <div className="mt-10">
            {services.length > 0 ? (
              <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {services.slice(0, 6).map((service) => (
                  <RevealItem key={service.id}>
                    <ServiceCard service={service} />
                  </RevealItem>
                ))}
              </RevealGroup>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No services have been published yet"
                description="Service information will appear here once the agency publishes it from the administration portal."
                action={{ label: 'Book a Consultation Now', href: PRIMARY_CTA_HREF }}
              />
            )}
          </div>
        </Container>
      </Section>

      {/* -------------------------------------------------------- destinations */}
      <Section>
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow={destinationsSection?.subheading || 'Where we work'}
              title={destinationsSection?.heading || 'Destinations'}
              description={destinationsSection?.bodyMd || undefined}
            />
            <Reveal delay={0.08}>
              <Link href="/destinations" className={buttonStyles('ghost', 'sm')}>
                All destinations
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Reveal>
          </div>

          <div className="mt-10">
            {countries.length > 0 ? (
              <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {countries.slice(0, 6).map((country) => (
                  <RevealItem key={country.id}>
                    <CountryCard country={country} />
                  </RevealItem>
                ))}
              </RevealGroup>
            ) : (
              <EmptyState
                icon={Globe2}
                title="No destinations have been published yet"
                description="Destination guides, requirements and opportunities appear here once the agency publishes them."
                action={{ label: 'Contact us', href: '/contact' }}
              />
            )}
          </div>
        </Container>
      </Section>

      {/* -------------------------------------------------------- testimonials */}
      <Section muted>
        <Container>
          <SectionHeading
            eyebrow={testimonialsSection?.subheading || 'Client experiences'}
            title={testimonialsSection?.heading || 'Testimonials'}
            description={testimonialsSection?.bodyMd || undefined}
            align="center"
          />

          <div className="mt-10">
            {testimonials.length > 0 ? (
              <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.slice(0, 3).map((testimonial) => (
                  <RevealItem key={testimonial.id}>
                    <TestimonialCard testimonial={testimonial} />
                  </RevealItem>
                ))}
              </RevealGroup>
            ) : (
              <EmptyState
                icon={MessageSquareQuote}
                title="No testimonials have been published yet"
                description="Client testimonials are added by the agency only, and only with each client's permission. None have been published so far."
                action={{ label: 'Read about our services', href: '/services' }}
              />
            )}
          </div>
        </Container>
      </Section>

      {/* ---------------------------------------------------------------- team */}
      {team.length > 0 ? (
        <Section>
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                eyebrow={teamSection?.subheading || 'Who you will work with'}
                title={teamSection?.heading || 'Our team'}
                description={teamSection?.bodyMd || undefined}
              />
              <Reveal delay={0.08}>
                <Link href="/team" className={buttonStyles('ghost', 'sm')}>
                  Meet the team
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Reveal>
            </div>

            <RevealGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {team.slice(0, 4).map((member) => (
                <RevealItem key={member.id}>
                  <TeamCard member={member} />
                </RevealItem>
              ))}
            </RevealGroup>
          </Container>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------------- FAQ */}
      {faqs.length > 0 ? (
        <Section muted>
          <Container size="narrow">
            <SectionHeading
              eyebrow={faqSection?.subheading || 'Answers'}
              title={faqSection?.heading || 'Frequently asked questions'}
              align="center"
            />

            <Reveal delay={0.1} className="mt-8">
              <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
                {faqs.slice(0, 5).map((faq) => (
                  <li key={faq.id} className="px-5 py-4">
                    <p className="text-sm font-semibold text-ink">{faq.question}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {faq.answerMd.replace(/[#*_>`]/g, '')}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-6 text-center">
                <Link href="/faq" className={buttonStyles('outline', 'sm')}>
                  Read all questions
                </Link>
              </div>
            </Reveal>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ CTA band */}
      <section className="relative isolate overflow-hidden bg-ink py-16 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(38rem 24rem at 18% 0%, rgba(225,29,46,0.35), transparent 62%), radial-gradient(32rem 22rem at 88% 100%, rgba(29,78,216,0.35), transparent 60%)',
          }}
        />

        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2 className="text-display-md font-semibold text-white">
                {ctaSection?.heading || PRIMARY_CTA_LABEL}
              </h2>
            </Reveal>

            {ctaSection?.bodyMd ? (
              <Reveal delay={0.08}>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  {ctaSection.bodyMd}
                </p>
              </Reveal>
            ) : (
              <Reveal delay={0.08}>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  Complete our assessment form and our team will review your details
                  and contact you.
                </p>
              </Reveal>
            )}

            <Reveal delay={0.16}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={ctaSection?.ctaHref || PRIMARY_CTA_HREF}
                  className={buttonStyles('primary', 'lg')}
                >
                  {ctaSection?.ctaLabel || PRIMARY_CTA_LABEL}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-13 items-center rounded-md border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10 active:bg-white/15"
                >
                  Contact us
                </Link>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}
