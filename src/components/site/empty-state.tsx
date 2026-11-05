import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

/**
 * Professional empty states.
 *
 * These are what the site shows wherever an administrator has not yet added
 * content. They are deliberately explicit — "not published yet", "no
 * opportunities listed" — rather than silent gaps or invented filler. A visitor
 * (and the agency owner reviewing their own site) can tell the difference
 * between "nothing here" and "we made something up".
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-slate-300 bg-[var(--surface-muted)]/60 text-center',
        variant === 'compact' ? 'px-5 py-8' : 'px-6 py-12 sm:py-14',
        variant === 'inline' && 'px-4 py-5 text-left',
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'mx-auto grid place-items-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200',
            variant === 'compact' ? 'size-10' : 'size-12',
            variant === 'inline' && 'mx-0',
          )}
        >
          <Icon className={variant === 'compact' ? 'size-4.5' : 'size-5'} />
        </span>
      ) : null}

      <h3
        className={cn(
          'font-semibold text-ink',
          variant === 'compact' ? 'mt-3 text-sm' : 'mt-4 text-base',
        )}
      >
        {title}
      </h3>

      <p
        className={cn(
          'mx-auto max-w-md leading-relaxed text-slate-600',
          variant === 'compact' ? 'mt-1 text-xs' : 'mt-2 text-sm',
          variant === 'inline' && 'mx-0 text-left',
        )}
      >
        {description}
      </p>

      {action ? (
        <div className={cn('mt-5', variant === 'inline' && 'mt-3 text-left')}>
          <Link href={action.href} className={buttonStyles('outline', 'sm')}>
            {action.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shown when the database itself is not configured or unreachable.
 *
 * This is an operational state, not a content state, so the wording differs: it
 * explains that the site is not finished being set up without exposing any
 * internal detail about why.
 */
export function ConfigurationNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900',
        className,
      )}
      role="status"
    >
      <p className="font-semibold">This website is still being set up.</p>
      <p className="mt-1">
        Content is currently unavailable. If you are the site owner, connect the
        database and publish your content from the administration portal.
      </p>
    </div>
  );
}
