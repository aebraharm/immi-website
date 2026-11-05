import { cn } from '@/lib/utils/cn';

/**
 * Status badge.
 *
 * Assessment and content statuses map to a fixed tone palette so the same
 * status always looks the same across the dashboard, tables and detail views.
 * Colours are paired with text labels — never colour alone — for accessibility.
 */

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-accent-50 text-accent-800 ring-accent-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
