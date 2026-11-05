import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Administration',
    template: '%s | Administration',
  },
  // Belt and braces: the middleware and netlify.toml also send X-Robots-Tag.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111827',
};

/**
 * Admin route-group layout.
 *
 * Deliberately minimal and chrome-free: the login page and the authenticated
 * shell each provide their own structure, and neither should inherit marketing
 * navigation. Rendering is dynamic — an admin page must never be cached or
 * prerendered, since its content depends on the caller's session.
 *
 * There is intentionally NO `<Suspense>` boundary here. A guard redirect thrown
 * inside a Suspense boundary is streamed to the client as a script payload, so
 * the response is a 200 and the redirect only happens once JavaScript runs. An
 * unauthenticated visitor would then receive admin HTML. Without the boundary the
 * redirect is a real HTTP 307 issued before any body is sent.
 */
export const dynamic = 'force-dynamic';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--surface-muted)]">{children}</div>
  );
}
