import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/**
 * 404 page.
 *
 * Deliberately free of agency branding copy: the agency name is database-driven
 * and is resolved in Phase 2. This keeps the foundation honest — no hardcoded
 * identity, even on an error page.
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-mesh-subtle"
      />

      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
        Error 404
      </p>

      <h1 className="mt-4 text-display-md font-semibold text-ink">
        This page could not be found
      </h1>

      <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600">
        The page you are looking for may have been moved or no longer exists.
      </p>

      <div className="mt-8">
        <Link href="/" className={buttonStyles('primary', 'md')}>
          Return to the homepage
        </Link>
      </div>
    </main>
  );
}
