import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';
import type { SiteIdentity } from '@/db/queries/types';

/**
 * Agency logo.
 *
 * Resolves entirely from `site_settings`: an administrator uploads a logo in the
 * admin portal and it appears here, in the footer and on the assessment form
 * without a code change. Until one is uploaded, a neutral monogram derived from
 * the configured agency name is shown — never an invented brand mark.
 */

type LogoProps = {
  identity: SiteIdentity;
  variant?: 'default' | 'dark';
  className?: string;
  /** Height class for the image; the wordmark scales with it. */
  size?: 'sm' | 'md' | 'lg';
  href?: string | null;
  showWordmark?: boolean;
};

const IMAGE_HEIGHT: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

const WORDMARK_SIZE: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

/** First letter(s) of the agency name, for the fallback monogram. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return `${(words[0] ?? '').charAt(0)}${(words[1] ?? '').charAt(0)}`.toUpperCase();
}

export function Logo({
  identity,
  variant = 'default',
  className,
  size = 'md',
  href = '/',
  showWordmark = true,
}: LogoProps) {
  const logoUrl = variant === 'dark' ? (identity.logoDarkUrl ?? identity.logoUrl) : identity.logoUrl;
  const name = identity.agencyName.trim();

  // The visible wordmark names a linked logo, so its image is decorative when both are present.
  const content = (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={showWordmark ? '' : name ? `${name} logo` : 'Agency logo'}
          height={size === 'sm' ? 32 : size === 'md' ? 40 : 48}
          width={180}
          priority
          // Preserve aspect ratio while constraining height.
          className={cn('w-auto object-contain', IMAGE_HEIGHT[size])}
        />
      ) : name ? (
        // Monogram fallback: no fabricated graphic, just the configured name.
        <span
          aria-hidden="true"
          className={cn(
            'grid place-items-center rounded-md bg-[var(--brand-primary)] font-bold tracking-tight text-white',
            size === 'sm' ? 'size-8 text-xs' : size === 'md' ? 'size-10 text-sm' : 'size-12 text-base',
          )}
        >
          {monogram(name)}
        </span>
      ) : (
        // Nothing configured yet: a neutral placeholder, not a fake brand.
        <span
          aria-hidden="true"
          className={cn(
            'grid place-items-center rounded-md border border-dashed border-slate-300 text-slate-600',
            size === 'sm' ? 'size-8 text-[10px]' : size === 'md' ? 'size-10 text-xs' : 'size-12 text-sm',
          )}
        >
          Logo
        </span>
      )}

      {showWordmark ? (
        // `min-w-0` + `truncate` let a long agency name shrink instead of
        // pushing the navigation and call-to-action off a phone screen.
        <span className={cn('flex min-w-0 flex-col leading-none', WORDMARK_SIZE[size])}>
          {name ? (
            <span className="truncate font-semibold tracking-tight text-ink">{name}</span>
          ) : (
            <span className="font-medium text-slate-600">Agency name not set</span>
          )}
          {identity.tagline ? (
            <span className="mt-1 hidden truncate text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-slate-500 sm:block">
              {identity.tagline}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      aria-label={
        showWordmark
          ? undefined
          : name
            ? `${monogram(name)} — ${name} home`
            : 'Agency logo — home'
      }
      className="rounded-sm transition-opacity duration-[var(--duration-fast)] hover:opacity-80"
    >
      {content}
    </Link>
  );
}
