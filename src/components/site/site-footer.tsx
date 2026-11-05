import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

import { PRIMARY_CTA_HREF, PRIMARY_CTA_LABEL } from '@/lib/config/site';
import type { SiteIdentity } from '@/db/queries/types';

import { Logo } from './logo';
import { NewsletterNote } from './newsletter-note';
import { SocialIcon } from './social-icons';

/**
 * Public site footer.
 *
 * Every value — agency name, logo, description, contact details, social links —
 * is read from `site_settings`. Sections with no data are omitted rather than
 * filled with placeholder text, so an unconfigured site looks unfinished in an
 * obviously intentional way rather than making claims the agency never made.
 */

const FOOTER_LINKS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'About Us', href: '/about' },
      { label: 'Services', href: '/services' },
      { label: 'Destinations', href: '/destinations' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Our Team', href: '/team' },
      { label: 'Testimonials', href: '/testimonials' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
];

export function SiteFooter({ identity }: { identity: SiteIdentity }) {
  const year = new Date().getUTCFullYear();
  const name = identity.agencyName.trim();

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]">
      <div className="mx-auto max-w-[var(--width-content)] px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          {/* Identity + description */}
          <div className="space-y-4">
            <Logo identity={identity} size="md" />
            {identity.shortDescription ? (
              <p className="max-w-sm text-sm leading-relaxed text-slate-600">
                {identity.shortDescription}
              </p>
            ) : null}

            {identity.social.length > 0 ? (
              <ul className="flex items-center gap-2 pt-1">
                {identity.social.map((item) => {
                  return (
                    <li key={item.platform}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${name || 'Agency'} on ${item.platform}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700"
                      >
                        <SocialIcon platform={item.platform} className="size-4" />
                        <span className="sr-only">{item.platform}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-[var(--brand-primary)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Contact — only rendered rows that exist */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Contact
            </h2>

            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {identity.contact.addressLines.length > 0 ? (
                <li className="flex gap-2.5">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-600" />
                  <address className="not-italic leading-relaxed">
                    {identity.contact.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </li>
              ) : null}

              {identity.contact.phonePrimary ? (
                <li className="flex gap-2.5">
                  <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-600" />
                  <a
                    href={`tel:${identity.contact.phonePrimary.replace(/\s+/g, '')}`}
                    className="transition-colors hover:text-accent-700"
                  >
                    {identity.contact.phonePrimary}
                  </a>
                </li>
              ) : null}

              {identity.contact.email ? (
                <li className="flex gap-2.5">
                  <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-600" />
                  <a
                    href={`mailto:${identity.contact.email}`}
                    className="break-all transition-colors hover:text-accent-700"
                  >
                    {identity.contact.email}
                  </a>
                </li>
              ) : null}
            </ul>

            {identity.contact.officeHours ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                {identity.contact.officeHours}
              </p>
            ) : null}

            <div className="mt-5">
              <Link
                href={PRIMARY_CTA_HREF}
                className="inline-flex text-sm font-semibold text-[var(--brand-primary)] underline-offset-4 hover:underline"
              >
                {PRIMARY_CTA_LABEL}
              </Link>
            </div>
          </div>
        </div>

        <NewsletterNote />

        <div className="mt-10 flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © {year} {name || 'This website'}. All rights reserved.
          </p>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <li>
              <Link
                href="/terms"
                className="text-xs text-slate-500 transition-colors hover:text-ink"
              >
                Terms and Conditions
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-xs text-slate-500 transition-colors hover:text-ink"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/assessment"
                className="text-xs text-slate-500 transition-colors hover:text-ink"
              >
                Book a Consultation
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
