'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { inputStyles, selectStyles, textareaStyles } from '@/components/ui/field';
import { cn } from '@/lib/utils/cn';

/**
 * Form primitives for the CMS.
 *
 * The public site's `Field` component is designed for one-shot marketing forms.
 * The CMS needs the same accessibility plus three things a long editing session
 * demands: per-field server errors, a visible save state, and a text control that
 * does not lose the caret while the administrator types.
 *
 * These wrappers keep every admin form consistent without each page having to
 * remember `aria-invalid` or the error id wiring.
 */

/* -------------------------------------------------------------------------- */
/* Labelled control                                                           */
/* -------------------------------------------------------------------------- */

export function CmsField({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Receives the ids the control must wire up. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium text-ink">
        <span>{label}</span>
        {required ? (
          <span className="text-brand-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-xs font-medium text-red-700">
          <AlertCircle aria-hidden="true" className="mt-px size-3 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  placeholder,
  maxLength,
  type = 'text',
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  type?: 'text' | 'email' | 'url' | 'number' | 'date';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <CmsField label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={inputStyles()}
        />
      )}
    </CmsField>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  rows = 4,
  maxLength,
  placeholder,
  mono = false,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  /** Monospace for Markdown bodies, so structure is visible. */
  mono?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <CmsField label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <div>
          <textarea
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            className={cn(textareaStyles(), mono && 'font-mono text-[0.8125rem] leading-6')}
          />
          {maxLength ? <CharacterCount value={value} max={maxLength} /> : null}
        </div>
      )}
    </CmsField>
  );
}

export function CharacterCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  return (
    <p
      className={cn(
        'mt-1 text-right text-[0.6875rem] tabular-nums',
        remaining < 0 ? 'text-red-600' : remaining < 40 ? 'text-amber-600' : 'text-slate-600',
      )}
      aria-hidden="true"
    >
      {value.length} / {max}
    </p>
  );
}

export function SelectInput<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  required,
  disabled,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <CmsField label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={selectStyles()}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </CmsField>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const descId = `${id}-desc`;

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)]',
          checked ? 'bg-accent-600' : 'bg-slate-300',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-1',
          )}
        />
      </button>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p id={descId} className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function FormAlert({
  tone,
  title,
  messages,
  onDismiss,
}: {
  tone: 'error' | 'success' | 'info';
  title: string;
  messages?: string[];
  onDismiss?: () => void;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    info: 'border-accent-200 bg-accent-50 text-accent-900',
  } as const;

  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-3.5 py-3', styles[tone])}>
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{title}</p>
          {messages && messages.length > 0 ? (
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section card                                                               */
/* -------------------------------------------------------------------------- */

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1',
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Repeated-row editor                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Editor for an ordered list of small records (service features, requirements,
 * visa categories).
 *
 * Rows are addressed by index rather than by a stable key so that adding and
 * removing is a simple array operation; the id carried inside each row is what
 * lets the server reconcile rather than recreate them.
 */
export function RepeaterRow({
  index,
  count,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel,
  children,
}: {
  index: number;
  count: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move up"
            className="inline-flex size-7 items-center justify-center rounded border border-[var(--border-subtle)] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === count - 1}
            aria-label="Move down"
            className="inline-flex size-7 items-center justify-center rounded border border-[var(--border-subtle)] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="inline-flex size-7 items-center justify-center rounded border border-red-200 bg-white text-red-700 hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor chrome                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Sticky save bar.
 *
 * Long forms mean the save button is usually off-screen, which is how
 * administrators lose work. This keeps the status and the primary action visible
 * at all times, and states plainly whether there is anything to save.
 */
export function SaveBar({
  isSaving,
  isDirty,
  onSave,
  onCancel,
  saveLabel = 'Save changes',
  status,
  children,
}: {
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-[var(--border-subtle)] bg-white/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          {status ?? (
            <span className={isDirty ? 'font-medium text-amber-700' : 'text-slate-500'}>
              {isDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onSave} disabled={isSaving || !isDirty}>
            {isSaving ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              saveLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dirty tracking.
 *
 * Comparing the serialised form against the snapshot taken at load is cheaper and
 * far less error-prone than marking each field on change, and it means "cancel"
 * can restore exactly what was on screen when the editor opened.
 */
export function useDirtyState<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [snapshot, setSnapshot] = useState<string>(() => JSON.stringify(initial));

  const isDirty = JSON.stringify(value) !== snapshot;

  const markClean = useCallback((next: T) => {
    setValue(next);
    setSnapshot(JSON.stringify(next));
  }, []);

  const reset = useCallback(() => {
    setValue(JSON.parse(snapshot) as T);
  }, [snapshot]);

  return { value, setValue, isDirty, markClean, reset, snapshot };
}
