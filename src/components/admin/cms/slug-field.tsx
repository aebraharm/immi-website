'use client';

import { useState } from 'react';

import { slugify } from '@/lib/utils/slug';

import { TextInput } from './form-kit';

/**
 * Slug field with a "use the title" button.
 *
 * The slug is pre-filled from the title while the administrator has not typed one
 * of their own, then left alone — silently rewriting a published URL every time a
 * title is tweaked would break every link to the page.
 */
export function SlugField({
  label,
  value,
  onChange,
  titleSource,
  error,
  hint,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** When the slug is empty, offer to derive it from this. */
  titleSource: string;
  error?: string;
  hint?: string;
  prefix?: string;
}) {
  const [touched, setTouched] = useState(value.length > 0);

  const suggestion = slugify(titleSource);

  return (
    <div className="space-y-1">
      <TextInput
        label={label}
        value={value}
        onChange={(next) => {
          setTouched(true);
          onChange(slugify(next));
        }}
        error={error}
        hint={hint ?? 'Lowercase letters, numbers and hyphens. Changing this changes the public web address.'}
        required
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {prefix ? (
          <span className="font-mono text-[0.6875rem] text-slate-600">
            {prefix}/{value || '…'}
          </span>
        ) : null}
        {suggestion && (!touched || value === '') ? (
          <button
            type="button"
            onClick={() => {
              setTouched(true);
              onChange(suggestion);
            }}
            className="rounded border border-[var(--border-subtle)] bg-white px-2 py-0.5 font-medium text-accent-700 hover:bg-accent-50"
          >
            Use &ldquo;{suggestion}&rdquo;
          </button>
        ) : null}
      </div>
    </div>
  );
}
