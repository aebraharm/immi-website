import type { Metadata } from 'next';
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/motion/reveal';
import { EmptyState } from '@/components/site/empty-state';
import { Container, PageHeader, Section } from '@/components/site/section';
import { buttonStyles } from '@/components/ui/button';
import { getSeoOverride, getSiteIdentity } from '@/db/queries';
import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import { buildMetadataForContact } from './metadata-builder';

/**
 * Contact Us.
 *
 * Contact details are read from `site_settings`; anything not configured is
 * simply not rendered. There is deliberately no contact form here — the site has
 * exactly one intake route (the assessment form), which keeps personal data in a
 * single, consented, auditable pipeline rather than scattered across inboxes.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [identity, seo] = await Promise.all([getSiteIdentity(), getSeoOverride('/contact')]);
  return buildMetadataForContact(identity, seo);
}

export default async function ContactPage() {
  const identity = await getSiteIdentity();
  const { contact } = identity;

  const hasAnyContact =
    contact.email ||
    contact.phonePrimary ||
    contact.phoneSecondary ||
    contact.whatsapp ||
    contact.addressLines.length > 0 ||
    contact.officeHours;

  return (
    <>
      <PageHeader
        eyebrow="Contact Us"
        title="Get in touch"
        description="Speak with our team about your background, your preferred destination, or the assessment process."
      />

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            {/* Contact details */}
            <div className="space-y-4">
              {hasAnyContact ? (
                <>
                  {contact.email ? (
                    <Reveal>
                      <ContactRow
                        icon={Mail}
                        label="Email"
                        value={contact.email}
                        href={`mailto:${contact.email}`}
                      />
                    </Reveal>
                  ) : null}

                  {contact.phonePrimary ? (
                    <Reveal delay={0.04}>
                      <ContactRow
                        icon={Phone}
                        label="Telephone"
                        value={contact.phonePrimary}
                        href={`tel:${contact.phonePrimary.replace(/\s+/g, '')}`}
                      />
                    </Reveal>
                  ) : null}

                  {contact.phoneSecondary ? (
                    <Reveal delay={0.08}>
                      <ContactRow
                        icon={Phone}
                        label="Alternative telephone"
                        value={contact.phoneSecondary}
                        href={`tel:${contact.phoneSecondary.replace(/\s+/g, '')}`}
                      />
                    </Reveal>
                  ) : null}

                  {contact.whatsapp ? (
                    <Reveal delay={0.12}>
                      <ContactRow
                        icon={MessageCircle}
                        label="WhatsApp"
                        value={contact.whatsapp}
                        href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`}
                        external
                      />
                    </Reveal>
                  ) : null}

                  {contact.addressLines.length > 0 ? (
                    <Reveal delay={0.16}>
                      <div className="flex gap-4 rounded-lg border border-[var(--border-subtle)] bg-white p-5">
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-700"
                        >
                          <MapPin className="size-5" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                            Office
                          </p>
                          <address className="mt-1 not-italic text-sm leading-relaxed text-ink">
                            {contact.addressLines.map((line) => (
                              <span key={line} className="block">
                                {line}
                              </span>
                            ))}
                          </address>
                        </div>
                      </div>
                    </Reveal>
                  ) : null}

                  {contact.officeHours ? (
                    <Reveal delay={0.2}>
                      <div className="flex gap-4 rounded-lg border border-[var(--border-subtle)] bg-white p-5">
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600"
                        >
                          <Clock className="size-5" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                            Office hours
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                            {contact.officeHours}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon={Mail}
                  title="Contact details have not been added yet"
                  description="The agency has not published its contact information. Please check back, or use the assessment form to send us your details."
                  action={{ label: PRIMARY_CTA_LABEL, href: PRIMARY_CTA_HREF }}
                />
              )}

              {contact.mapEmbedUrl ? (
                <Reveal delay={0.24}>
                  <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                    {/*
                      Only an administrator-supplied embed URL is used, and the CSP
                      restricts frames to our own origin and Google Maps.
                    */}
                    <iframe
                      src={contact.mapEmbedUrl}
                      title="Office location map"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-72 w-full border-0"
                      allowFullScreen
                    />
                  </div>
                </Reveal>
              ) : null}
            </div>

            {/* Primary route */}
            <Reveal direction="left">
              <div className="glass rounded-xl p-7">
                <h2 className="text-lg font-semibold text-ink">
                  The fastest way to reach the right person
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Complete the assessment form. It tells us about your qualifications,
                  experience, language skills and preferred destination, so our team can
                  respond with something useful instead of asking you to repeat yourself.
                </p>

                <Link
                  href={PRIMARY_CTA_HREF}
                  className={buttonStyles('primary', 'md', 'mt-6 w-full')}
                >
                  {PRIMARY_CTA_LABEL}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>

                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  The form takes around 10–15 minutes. Your information is stored
                  securely and is only accessible to authorised agency staff.
                </p>

                <div className="mt-6 space-y-2 border-t border-[var(--border-subtle)] pt-5 text-sm">
                  <p className="font-medium text-ink">Before you write to us</p>
                  <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                    <li>• We cannot guarantee a visa or a job.</li>
                    <li>• We never ask for payment through this website.</li>
                    <li>
                      • Please do not send passport scans or other documents by email.
                    </li>
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  external = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group flex gap-4 rounded-lg border border-[var(--border-subtle)] bg-white p-5 transition-colors hover:border-accent-200 hover:bg-accent-50/40"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-700 transition-colors group-hover:bg-accent-100"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
          {label}
        </span>
        <span className="mt-1 block break-words text-sm font-medium text-ink">
          {value}
        </span>
      </span>
    </a>
  );
}
