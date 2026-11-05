'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Menu, Phone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { buttonStyles } from '@/components/ui/button';
import {
  ADMIN_LOGIN_HREF,
  ADMIN_LOGIN_LABEL,
  MAIN_NAV,
  PRIMARY_CTA_HREF,
  PRIMARY_CTA_LABEL,
} from '@/lib/config/site';
import { cn } from '@/lib/utils/cn';
import type { SiteIdentity } from '@/db/queries/types';

import { Logo } from './logo';
import { MobileNav } from './mobile-nav';

/**
 * Public site header.
 *
 * Behaviour required by the specification:
 *  - The **Admin Login link appears on desktop and laptop** and is
 *    **completely hidden on mobile**, including inside the mobile menu.
 *    It is therefore never passed to `MobileNav`. This is a presentational rule
 *    only; access control lives on the server (Phase 3).
 *  - The primary call-to-action reads exactly "Book a Consultation Now".
 *  - Navigation transitions are animated, and the header becomes a glass bar
 *    once the page scrolls.
 */
export function SiteHeader({ identity }: { identity: SiteIdentity }) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Subtle elevation change once the page scrolls past the hero.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  // Escape closes the menu.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-[background-color,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out-expo)]',
        isScrolled
          ? 'border-b border-[var(--border-subtle)] bg-white/85 shadow-e1 backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-white',
      )}
    >
      {/* Utility strip: real contact details from the database, desktop only. */}
      {identity.contact.phonePrimary || identity.contact.email ? (
        <div className="hidden border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] lg:block">
          <div className="mx-auto flex max-w-[var(--width-content)] items-center justify-between px-6 py-1.5 text-xs text-slate-600">
            <p className="font-medium">
              {identity.tagline || 'International employment and immigration guidance'}
            </p>
            <div className="flex items-center gap-5">
              {identity.contact.phonePrimary ? (
                <a
                  href={`tel:${identity.contact.phonePrimary.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-700"
                >
                  <Phone aria-hidden="true" className="size-3.5" />
                  {identity.contact.phonePrimary}
                </a>
              ) : null}
              {identity.contact.email ? (
                <a
                  href={`mailto:${identity.contact.email}`}
                  className="transition-colors hover:text-accent-700"
                >
                  {identity.contact.email}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex h-16 max-w-[var(--width-content)] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem]">
        {/* min-w-0 allows the logo/wordmark to truncate rather than overflow. */}
        <div className="flex min-w-0 flex-1 items-center">
          <Logo identity={identity} size="md" />
        </div>

        {/* Desktop navigation */}
        <nav aria-label="Main navigation" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {MAIN_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                      active
                        ? 'text-[var(--brand-active)]'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-ink',
                    )}
                  >
                    {item.label}
                    {active ? (
                      <motion.span
                        layoutId="nav-active-indicator"
                        aria-hidden="true"
                        className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand-active)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/*
            Admin Login — desktop and laptop only.
            `hidden lg:inline-flex` hides it on tablet and phone. It is never
            rendered inside MobileNav, so it cannot appear in the mobile menu.
          */}
          <Link
            href={ADMIN_LOGIN_HREF}
            className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-accent-700 lg:inline-flex"
          >
            <Lock aria-hidden="true" className="size-3.5" />
            {ADMIN_LOGIN_LABEL}
          </Link>

          <Link
            href={PRIMARY_CTA_HREF}
            className={buttonStyles('primary', 'sm', 'hidden sm:inline-flex')}
          >
            {PRIMARY_CTA_LABEL}
          </Link>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label="Open navigation menu"
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--border-subtle)] text-ink transition-colors hover:bg-slate-50 lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <MobileNav identity={identity} onClose={() => setMobileOpen(false)} />
        ) : null}
      </AnimatePresence>
    </header>
  );
}
