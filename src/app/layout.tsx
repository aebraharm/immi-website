import type { Metadata, Viewport } from 'next';

import { inter } from './fonts';
import './globals.css';

/**
 * Root layout — the minimum shell shared by the public site and the admin
 * portal. Each route group supplies its own chrome (header/footer vs sidebar).
 *
 * Metadata is intentionally generic here: the real agency name, description and
 * favicon are resolved from the database in Phase 2, because none of that may
 * be hardcoded.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: {
    default: 'Immigration Services',
    template: '%s',
  },
  description: 'Professional immigration guidance and international employment support.',
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-white text-ink antialiased">
        {/*
          The skip link is the first focusable element on every page, so
          keyboard and screen-reader users can jump past the navigation.
        */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
