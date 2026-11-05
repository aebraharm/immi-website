/**
 * Applicant-facing reference lists for the assessment form.
 *
 * These are *form vocabulary*, not website content: they must stay identical for
 * every visitor and cannot be broken by an administrator editing or deleting a
 * row. Editable, marketing-facing destinations live in the `countries` table and
 * are read separately (`getDestinationOptions`).
 *
 * Everything here is also imported by the server-side Zod schema, so the list a
 * visitor sees in a `<select>` and the list the server accepts are the same
 * array. A hand-crafted request cannot store a skill, language or qualification
 * that the UI never offered.
 */

import {
  EMPLOYMENT_RECORD_TYPES,
  GENDERS,
  LANGUAGES,
  MARITAL_STATUSES,
  PROFICIENCY_LEVELS,
  QUALIFICATION_LEVELS,
  SKILLS,
} from '@/db/schema/enums';
import { SALARY_CURRENCIES } from '@/lib/data/countries-iso';

export type Choice<Value extends string = string> = {
  value: Value;
  label: string;
};

/** Turn a stored enum value into readable text: `healthcare_nursing` → `Healthcare / nursing`. */
export function labelFor(value: string): string {
  const special: Record<string, string> = {
    customer_service: 'Customer service',
    factory_worker: 'Factory worker',
    healthcare_nursing: 'Healthcare / nursing',
    truck_driving: 'Truck driving',
    warehouse_operations: 'Warehouse operations',
    prefer_not_to_say: 'Prefer not to say',
    additional_info_required: 'Additional information required',
    under_review: 'Under review',
    other: 'Other',
  };

  const direct = special[value];
  if (direct) return direct;

  const words = value.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function choices(values: readonly string[]): Choice[] {
  return values.map((value) => ({ value, label: labelFor(value) }));
}

/* ---------------- Personal ---------------- */

export const GENDER_CHOICES: readonly Choice[] = choices(GENDERS);
export const MARITAL_STATUS_CHOICES: readonly Choice[] = choices(MARITAL_STATUSES);

/* ---------------- Education ---------------- */

export const QUALIFICATION_CHOICES: readonly Choice[] = QUALIFICATION_LEVELS.map(
  (value) => ({
    value,
    label:
      value === 'secondary'
        ? 'Secondary school'
        : value === 'diploma'
          ? 'Diploma / certificate'
          : value === 'bachelor'
            ? "Bachelor's degree"
            : value === 'master'
              ? "Master's degree"
              : 'Other qualification',
  }),
);

/** The earliest year we accept as a completion date. */
export const EARLIEST_YEAR = 1950;

/* ---------------- Employment ---------------- */

export const EMPLOYMENT_RECORD_CHOICES: readonly Choice[] = choices(
  EMPLOYMENT_RECORD_TYPES,
);

/* ---------------- Skills ---------------- */

export const SKILL_CHOICES: readonly Choice[] = choices(SKILLS);

/* ---------------- Languages ---------------- */

export const LANGUAGE_CHOICES: readonly Choice[] = LANGUAGES.map((value) => ({
  value,
  label: labelFor(value),
}));

export const PROFICIENCY_CHOICES: readonly Choice[] = PROFICIENCY_LEVELS.map(
  (value) => ({
    value,
    label:
      value === 'basic'
        ? 'Basic'
        : value === 'intermediate'
          ? 'Intermediate'
          : value === 'advanced'
            ? 'Advanced'
            : 'Fluent',
  }),
);

/** The four languages the specification asks about, in display order. */
export const LANGUAGE_ROWS = LANGUAGE_CHOICES;

/* ---------------- Money ---------------- */

export const CURRENCY_CHOICES: readonly Choice[] = SALARY_CURRENCIES.map(
  (value) => ({ value, label: value }),
);

/**
 * Upper bound for any monetary figure the applicant types.
 *
 * Twelve digits, not twelve million: it is comfortably above any real salary,
 * and it keeps a pasted paragraph or a `1e999` from becoming a database value.
 */
export const MAX_SALARY_AMOUNT = 999_999_999_999;

/**
 * A small, fixed set of country dialling codes for the phone selector.
 *
 * The full ISO list supplies the calling code for every country, so the selector
 * is built from `ISO_COUNTRIES` at render time. This constant only pins the
 * handful we put at the top of the list because they are the applicants we
 * actually serve.
 */
export const PRIORITY_DIAL_CODES = [
  '+234',
  '+233',
  '+254',
  '+27',
  '+44',
  '+1',
  '+971',
] as const;
