import type { Metadata } from 'next';

import { MotionProvider } from '@/components/motion/motion-provider';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { getSiteIdentity } from '@/db/queries';
import { darkenHex } from '@/lib/brand-colors';

/**
 * Public site layout.
 *
 * Three responsibilities:
 *
 *  1. Load site identity once per request and feed both header and footer, so
 *     the uploaded logo and agency name appear everywhere automatically.
 *  2. Inject the administrator's brand colours as CSS custom properties. Because
 *     `globals.css` reads `--brand-primary` etc., changing a colour in the admin
 *     portal re-themes the entire public site with no rebuild.
 *  3. Provide the shared chrome: header, main landmark, footer.
 *
 * Rendering is dynamic (see the Phase 1 decision): the build never touches the
 * database, and an administrator's edit is visible on the next request.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getSiteIdentity();

  // Nothing is invented here: when the agency has not set a name or description,
  // the title simply omits them rather than filling in placeholder marketing.
  return {
    title: identity.agencyName
      ? { default: identity.agencyName, template: `%s | ${identity.agencyName}` }
      : { default: 'Immigration Agency', template: '%s' },
    description: identity.shortDescription || undefined,
    icons: identity.faviconUrl ? { icon: identity.faviconUrl } : undefined,
    openGraph: identity.agencyName ? { siteName: identity.agencyName } : undefined,
  };
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getSiteIdentity();

  // Brand tokens as inline custom properties. These are the only inline styles
  // on the site, and they carry no user-controlled markup — just hex colours
  // validated by Zod when the administrator saves them.
  const brandStyle = {
    '--brand-primary': identity.colors.primary,
    '--brand-primary-hover': darkenHex(identity.colors.primary),
    '--brand-secondary': identity.colors.secondary,
    '--brand-active': identity.colors.active,
    '--brand-text': identity.colors.text,
    // `text-ink` and inherited public copy both consume the configured body text.
    '--color-ink': identity.colors.text,
    color: identity.colors.text,
  } as React.CSSProperties;

  return (
    <MotionProvider>
      <div style={brandStyle} className="flex min-h-dvh flex-col bg-white">
        <SiteHeader identity={identity} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter identity={identity} />
      </div>
    </MotionProvider>
  );
}
