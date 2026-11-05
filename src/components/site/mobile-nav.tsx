'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { buttonStyles } from '@/components/ui/button';
import {
  FOOTER_LEGAL,
  MAIN_NAV,
  PRIMARY_CTA_HREF,
  PRIMARY_CTA_LABEL,
} from '@/lib/config/site';
import { cn } from '@/lib/utils/cn';
import type { SiteIdentity } from '@/db/queries/types';

import { Logo } from './logo';

/**
 * Mobile navigation drawer.
 *
 * IMPORTANT: the Admin Login link is deliberately absent from this component's
 * imports and markup. The specification requires it to be fully hidden on mobile
 * phones and to never appear in the mobile menu, so there is no code path here
 * that could render it — the requirement is enforced structurally rather than by
 * a CSS media query that could regress.
 *
 * Accessibility: rendered as a modal dialog with `aria-modal`, focus moved to the
 * close button on open, Escape handled by the parent, and the page behind made
 * inert by the body-scroll lock.
 */
export function MobileNav({
  identity,
  onClose,
}: {
  identity: SiteIdentity;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  /*
   * Keyboard behaviour for a modal drawer.
   *
   * `aria-modal="true"` tells a screen reader that the rest of the page is inert,
   * so the keyboard has to agree with it: focus moves into the drawer on open,
   * Tab cannot leave it, and focus returns to the control that opened it on close.
   * Without the trap, Tab walks into the page behind the overlay — which is the
   * classic "invisible focus" failure that makes a drawer unusable without a
   * mouse.
   */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const container = containerRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Return focus where the visitor left it, so the page does not scroll to
      // the top after closing the menu.
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      id="mobile-navigation"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-sm"
      />

      <motion.div
        ref={containerRef}
        initial={prefersReducedMotion ? { x: 0 } : { x: '100%' }}
        animate={{ x: 0 }}
        exit={prefersReducedMotion ? { x: 0 } : { x: '100%' }}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 34,
          duration: prefersReducedMotion ? 0.15 : undefined,
        }}
        className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-white shadow-e3"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <Logo identity={identity} size="sm" showWordmark={false} />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex size-10 items-center justify-center rounded-md text-ink transition-colors hover:bg-slate-100"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {MAIN_NAV.map((item, index) => {
              const active = isActive(item.href);
              return (
                <motion.li
                  key={item.href}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: prefersReducedMotion ? 0 : 0.04 + index * 0.03,
                    duration: 0.25,
                  }}
                >
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-md px-3 py-3 text-[0.9375rem] font-medium transition-colors',
                      active
                        ? 'bg-brand-50 text-[var(--brand-active)]'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-ink',
                    )}
                  >
                    {item.label}
                    <ChevronRight
                      aria-hidden="true"
                      className={cn('size-4', active ? 'opacity-100' : 'opacity-30')}
                    />
                  </Link>
                </motion.li>
              );
            })}
          </ul>

          <div className="my-4 h-px bg-[var(--border-subtle)]" />

          <ul className="space-y-0.5">
            {FOOTER_LEGAL.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3 border-t border-[var(--border-subtle)] p-4">
          <Link
            href={PRIMARY_CTA_HREF}
            onClick={onClose}
            className={buttonStyles('primary', 'md', 'w-full')}
          >
            {PRIMARY_CTA_LABEL}
          </Link>

          {/* Admin Login is intentionally NOT rendered here — see the docblock. */}

          {identity.contact.phonePrimary ? (
            <a
              href={`tel:${identity.contact.phonePrimary.replace(/\s+/g, '')}`}
              className="block text-center text-sm text-slate-600"
            >
              {identity.contact.phonePrimary}
            </a>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
