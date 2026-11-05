import { useId } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Form field shell.
 *
 * Accessibility is handled once here rather than repeated at every call site:
 * the control is linked to its label, hint and error via `aria-describedby`,
 * and invalid controls get `aria-invalid`. Because `Field` owns the ids, the
 * assessment form can stay readable while remaining fully accessible.
 */

const CONTROL_BASE =
  'w-full rounded-md border bg-white px-3.5 text-[0.9375rem] text-ink ' +
  'placeholder:text-slate-600 shadow-e1 ' +
  'transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ' +
  'ease-[var(--ease-out-expo)] ' +
  'focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] ' +
  'focus-visible:ring-4 focus-visible:ring-accent-600/15 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/15';

export function inputStyles(className?: string): string {
  return cn(CONTROL_BASE, 'h-11', className);
}

export function textareaStyles(className?: string): string {
  return cn(CONTROL_BASE, 'min-h-28 resize-y py-2.5 leading-relaxed', className);
}

export function selectStyles(className?: string): string {
  return cn(
    CONTROL_BASE,
    'h-11 cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10',
    // Inline chevron so no external asset or icon font is required.
    "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")]",
    className,
  );
}

export type FieldProps = {
  label: string;
  /** Rendered when the field is invalid; also announced to screen readers. */
  error?: string;
  hint?: string;
  required?: boolean;
  optionalLabel?: string;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
  className?: string;
};

export function Field({
  label,
  error,
  hint,
  required = false,
  optionalLabel = 'Optional',
  children,
  className,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // The hint is intentionally hidden while an error is shown; only reference
  // IDs that are present in the rendered field markup.
  const describedBy =
    [hint && !error ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="flex items-baseline gap-1.5 text-sm font-medium text-ink"
      >
        <span>{label}</span>
        {required ? (
          <span className="text-brand-600" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-slate-600">
            ({optionalLabel})
          </span>
        )}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint && !error ? (
        <p id={hintId} className="text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          // `role=alert` makes the message spoken the moment it appears.
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-red-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
