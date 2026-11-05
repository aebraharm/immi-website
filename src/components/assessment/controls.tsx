'use client';

import { Check, Plus } from 'lucide-react';
import { useId } from 'react';

import { Field, inputStyles, selectStyles, textareaStyles } from '@/components/ui/field';
import { cn } from '@/lib/utils/cn';

import type { Choice } from '@/lib/assessment/reference';

/**
 * Form controls for the assessment.
 *
 * These wrap the shared `Field` shell (which owns label/error/hint wiring and
 * `aria-invalid`) so that every control in an eleven-step form is accessible
 * without repeating the same six attributes eighty times.
 *
 * Two rules are visible in this file:
 *
 *  - A required control is marked `required` and gets the visual asterisk; an
 *    optional one says "(Optional)" rather than leaving the visitor guessing.
 *  - Validation errors are rendered *under the field they belong to*, from the
 *    same message the server would return — never in a summary far away.
 */

export type ControlIds = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
};

type BaseProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export function TextInput({
  label,
  error,
  hint,
  required = true,
  className,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  disabled,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'date' | 'month' | 'number' | 'password';
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(ids) => (
        <input
          id={ids.id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={ids.describedBy}
          aria-invalid={ids.invalid || undefined}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          disabled={disabled}
          className={inputStyles()}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  error,
  hint,
  required = true,
  className,
  value,
  onChange,
  rows = 3,
  maxLength,
  placeholder,
  autoComplete,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(ids) => (
        <textarea
          id={ids.id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={ids.describedBy}
          aria-invalid={ids.invalid || undefined}
          required={required}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={textareaStyles()}
        />
      )}
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Selects                                                                    */
/* -------------------------------------------------------------------------- */

export function SelectInput({
  label,
  error,
  hint,
  required = true,
  className,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly Choice[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(ids) => (
        <select
          id={ids.id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={ids.describedBy}
          aria-invalid={ids.invalid || undefined}
          required={required}
          disabled={disabled}
          className={selectStyles()}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Yes / No                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A two-button Yes/No control.
 *
 * A `<select>` would also work, but a radio group is one tap instead of three on
 * a phone, and the two choices are always visible — which matters for the medical
 * and criminal-record questions, where a visitor must be able to see that "No"
 * is a legitimate answer.
 */
export function YesNoInput({
  label,
  error,
  hint,
  required = true,
  className,
  value,
  onChange,
  yesLabel = 'Yes',
  noLabel = 'No',
}: BaseProps & {
  value: string;
  onChange: (value: 'yes' | 'no') => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  const baseId = useId();

  return (
    <fieldset className={cn('space-y-1.5', className)}>
      <legend className="flex items-baseline gap-1.5 text-sm font-medium text-ink">
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className="text-brand-600">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-slate-600">(Optional)</span>
        )}
      </legend>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'yes', text: yesLabel },
            { key: 'no', text: noLabel },
          ] as const
        ).map((option) => {
          const checked = value === option.key;
          const optionId = `${baseId}-${option.key}`;

          return (
            <label
              key={option.key}
              htmlFor={optionId}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors',
                'focus-within:ring-4 focus-within:ring-accent-600/15',
                checked
                  ? 'border-accent-600 bg-accent-50 text-accent-800'
                  : 'border-[var(--border-strong)] bg-white text-ink hover:border-accent-300',
                error && 'border-red-400',
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={baseId}
                value={option.key}
                checked={checked}
                onChange={() => onChange(option.key)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-4 place-items-center rounded-full border',
                  checked ? 'border-accent-600 bg-accent-600' : 'border-slate-300 bg-white',
                )}
              >
                {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
              </span>
              {option.text}
            </label>
          );
        })}
      </div>

      {hint && !error ? (
        <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* Multi-select                                                               */
/* -------------------------------------------------------------------------- */

/** A checkbox rendered as a selectable tile — used for skills and languages. */
export function CheckTile({
  checked,
  onChange,
  children,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  description?: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors',
        'focus-within:ring-4 focus-within:ring-accent-600/15',
        checked
          ? 'border-accent-600 bg-accent-50 text-accent-900'
          : 'border-[var(--border-strong)] bg-white text-ink hover:border-accent-300',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors',
          checked ? 'border-accent-600 bg-accent-600 text-white' : 'border-slate-300 bg-white',
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="leading-snug">
        <span className="font-medium">{children}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Repeatable rows                                                            */
/* -------------------------------------------------------------------------- */

export function AddRowButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-strong)] px-3.5 py-2 text-sm font-medium text-accent-800 transition-colors hover:border-accent-400 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

export function RemoveRowButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-red-600 hover:decoration-red-300"
    >
      {label}
    </button>
  );
}
