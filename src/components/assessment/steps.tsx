'use client';

import { FileText, Info, Paperclip, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { ISO_COUNTRIES, getIsoCountry } from '@/lib/data/countries-iso';
import {
  CURRENCY_CHOICES,
  GENDER_CHOICES,
  MARITAL_STATUS_CHOICES,
  MAX_SALARY_AMOUNT,
  PROFICIENCY_CHOICES,
  QUALIFICATION_CHOICES,
  SKILL_CHOICES,
  LANGUAGE_CHOICES,
} from '@/lib/assessment/reference';
import {
  EMPTY_EDUCATION,
  EMPTY_PREVIOUS_EMPLOYMENT,
  type AssessmentDraft,
  type EducationEntry,
  type PreviousEmploymentEntry,
} from '@/lib/assessment/draft';
import { completionYears } from '@/lib/assessment/schema';
import type { FieldErrors } from '@/lib/assessment/schema';
import { cn } from '@/lib/utils/cn';

import {
  AddRowButton,
  CheckTile,
  RemoveRowButton,
  SelectInput,
  TextArea,
  TextInput,
  YesNoInput,
} from './controls';

/**
 * The eleven steps of the form, rendered from one draft.
 *
 * Every step is a controlled view over the same `AssessmentDraft` object, which
 * is what makes state survive Back/Next: nothing is unmounted-and-forgotten, the
 * data lives one level above. The parent owns the draft; these components only
 * report changes.
 *
 * Country lists come from the static ISO 3166-1 reference (202 entries), not from
 * the editable `countries` table, so an administrator cannot accidentally remove
 * a nationality from the form by archiving a destination.
 */

export type StepProps = {
  draft: AssessmentDraft;
  errors: FieldErrors;
  update: (patch: (draft: AssessmentDraft) => AssessmentDraft) => void;
};

/** Country options, computed once for the whole page. */
const COUNTRY_OPTIONS = ISO_COUNTRIES.map((country) => ({
  value: country.code,
  label: country.name,
}));

const DIAL_CODE_OPTIONS = ISO_COUNTRIES.map((country) => ({
  value: country.dialCode,
  label: `${country.dialCode} — ${country.name}`,
})).filter(
  // Each dialling code appears once, at its first (alphabetical) country.
  (() => {
    const seen = new Set<string>();
    return (option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    };
  })(),
);

/* -------------------------------------------------------------------------- */
/* 1. Personal                                                                */
/* -------------------------------------------------------------------------- */

export function PersonalStep({ draft, errors, update }: StepProps) {
  const personal = draft.personal;
  const set = <K extends keyof typeof personal>(key: K, value: (typeof personal)[K]) =>
    update((current) => ({
      ...current,
      personal: { ...current.personal, [key]: value },
    }));

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Full name"
          required
          value={personal.fullName}
          onChange={(value) => set('fullName', value)}
          error={errors['personal.fullName']}
          hint="As printed on your passport, including any middle names."
          autoComplete="name"
          className="sm:col-span-2"
        />
        <TextInput
          label="Date of birth"
          type="date"
          required
          value={personal.dateOfBirth}
          onChange={(value) => set('dateOfBirth', value)}
          error={errors['personal.dateOfBirth']}
          autoComplete="bday"
        />
        <SelectInput
          label="Gender"
          required
          value={personal.gender}
          onChange={(value) => set('gender', value)}
          options={GENDER_CHOICES}
          error={errors['personal.gender']}
        />
        <SelectInput
          label="Nationality"
          required
          value={personal.nationality}
          onChange={(value) => set('nationality', value)}
          options={COUNTRY_OPTIONS}
          error={errors['personal.nationality']}
        />
        <SelectInput
          label="Country of residence"
          required
          value={personal.countryOfResidence}
          onChange={(value) => set('countryOfResidence', value)}
          options={COUNTRY_OPTIONS}
          error={errors['personal.countryOfResidence']}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextArea
          label="Residential address"
          required
          rows={2}
          value={personal.residentialAddress}
          onChange={(value) => set('residentialAddress', value)}
          error={errors['personal.residentialAddress']}
          autoComplete="street-address"
        />
        <div className="grid gap-5">
          <TextInput
            label="City"
            required
            value={personal.city}
            onChange={(value) => set('city', value)}
            error={errors['personal.city']}
            autoComplete="address-level2"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              label="State / province"
              required
              value={personal.stateProvince}
              onChange={(value) => set('stateProvince', value)}
              error={errors['personal.stateProvince']}
              autoComplete="address-level1"
            />
            <TextInput
              label="Postal code"
              required
              value={personal.postalCode}
              onChange={(value) => set('postalCode', value)}
              error={errors['personal.postalCode']}
              autoComplete="postal-code"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3">
          <SelectInput
            label="Code"
            required
            value={personal.mobileCountryCode}
            onChange={(value) => set('mobileCountryCode', value)}
            options={DIAL_CODE_OPTIONS}
            error={errors['personal.mobileCountryCode']}
            placeholder="+"
          />
          <TextInput
            label="Mobile number"
            required
            type="tel"
            inputMode="tel"
            value={personal.mobileNumber}
            onChange={(value) => set('mobileNumber', value)}
            error={errors['personal.mobileNumber']}
            autoComplete="tel-national"
          />
        </div>

        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3">
          <SelectInput
            label="Alt. code"
            required={false}
            value={personal.altMobileCountryCode}
            onChange={(value) => set('altMobileCountryCode', value)}
            options={DIAL_CODE_OPTIONS}
            error={errors['personal.altMobileCountryCode']}
            placeholder="Not set"
          />
          <TextInput
            label="Alternative number"
            required={false}
            type="tel"
            inputMode="tel"
            value={personal.altMobileNumber}
            onChange={(value) => set('altMobileNumber', value)}
            error={errors['personal.altMobileNumber']}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Email address"
          type="email"
          inputMode="email"
          required
          value={personal.email}
          onChange={(value) => set('email', value)}
          error={errors['personal.email']}
          hint="We reply to this address. Use one you check regularly."
          autoComplete="email"
        />
        <SelectInput
          label="Marital status"
          required
          value={personal.maritalStatus}
          onChange={(value) => set('maritalStatus', value)}
          options={MARITAL_STATUS_CHOICES}
          error={errors['personal.maritalStatus']}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <YesNoInput
          label="Do you have children?"
          value={personal.hasChildren}
          onChange={(value) => set('hasChildren', value)}
          error={errors['personal.hasChildren']}
        />
        {personal.hasChildren === 'yes' ? (
          <TextInput
            label="How many children?"
            required
            inputMode="numeric"
            value={personal.numberOfChildren}
            onChange={(value) => set('numberOfChildren', value.replace(/[^\d]/g, ''))}
            error={errors['personal.numberOfChildren']}
            maxLength={2}
          />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Passport                                                                */
/* -------------------------------------------------------------------------- */

export function PassportStep({ draft, errors, update }: StepProps) {
  const passport = draft.passport;
  const set = <K extends keyof typeof passport>(key: K, value: (typeof passport)[K]) =>
    update((current) => ({
      ...current,
      passport: { ...current.passport, [key]: value },
    }));

  return (
    <div className="space-y-6">
      <YesNoInput
        label="Do you currently hold a valid international passport?"
        value={passport.hasPassport}
        onChange={(value) => {
          // Choosing "No" clears the details rather than leaving them hidden and
          // still attached to the record.
          if (value === 'no') {
            update((current) => ({
              ...current,
              passport: {
                hasPassport: 'no',
                passportNumber: '',
                passportCityOfIssue: '',
                passportIssueDate: '',
                passportExpiryDate: '',
              },
            }));
            return;
          }
          set('hasPassport', value);
        }}
        error={errors['passport.hasPassport']}
        hint="If you do not have one yet, say No — it will not stop us assessing your enquiry."
      />

      {passport.hasPassport === 'yes' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="Passport number"
            required
            value={passport.passportNumber}
            onChange={(value) => set('passportNumber', value.toUpperCase())}
            error={errors['passport.passportNumber']}
            maxLength={20}
          />
          <TextInput
            label="City of issue"
            required
            value={passport.passportCityOfIssue}
            onChange={(value) => set('passportCityOfIssue', value)}
            error={errors['passport.passportCityOfIssue']}
          />
          <TextInput
            label="Issue date"
            type="date"
            required
            value={passport.passportIssueDate}
            onChange={(value) => set('passportIssueDate', value)}
            error={errors['passport.passportIssueDate']}
          />
          <TextInput
            label="Expiry date"
            type="date"
            required
            value={passport.passportExpiryDate}
            onChange={(value) => set('passportExpiryDate', value)}
            error={errors['passport.passportExpiryDate']}
          />
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Education                                                               */
/* -------------------------------------------------------------------------- */

export function EducationStep({ draft, errors, update }: StepProps) {
  const years = useMemo(() => completionYears(), []);

  const updateEntry = (index: number, patch: Partial<EducationEntry>) =>
    update((current) => ({
      ...current,
      education: current.education.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    }));

  return (
    <div className="space-y-5">
      {draft.education.map((entry, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-full bg-white font-mono text-[0.6875rem] font-semibold text-slate-500 ring-1 ring-[var(--border-subtle)]"
              >
                {index + 1}
              </span>
              Qualification {index + 1}
            </p>
            {draft.education.length > 1 ? (
              <RemoveRowButton
                label="Remove"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    education: current.education.filter((_, position) => position !== index),
                  }))
                }
              />
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput
              label="Qualification level"
              required
              value={entry.qualificationLevel}
              onChange={(value) => updateEntry(index, { qualificationLevel: value })}
              options={QUALIFICATION_CHOICES}
              error={errors[`education.${index}.qualificationLevel`]}
            />
            <TextInput
              label="Institution"
              required
              value={entry.institutionName}
              onChange={(value) => updateEntry(index, { institutionName: value })}
              error={errors[`education.${index}.institutionName`]}
            />
            <SelectInput
              label="Country"
              required
              value={entry.country}
              onChange={(value) => updateEntry(index, { country: value })}
              options={COUNTRY_OPTIONS}
              error={errors[`education.${index}.country`]}
            />
            <SelectInput
              label="Year completed"
              required
              value={entry.yearCompleted}
              onChange={(value) => updateEntry(index, { yearCompleted: value })}
              options={years.map((year) => ({ value: String(year), label: String(year) }))}
              error={errors[`education.${index}.yearCompleted`]}
            />
          </div>
        </div>
      ))}

      {errors.education ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {errors.education}
        </p>
      ) : null}

      <AddRowButton
        label="Add another qualification"
        disabled={draft.education.length >= 8}
        onClick={() =>
          update((current) => ({
            ...current,
            education: [...current.education, { ...EMPTY_EDUCATION }],
          }))
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Current employment                                                      */
/* -------------------------------------------------------------------------- */

export function EmploymentStep({ draft, errors, update }: StepProps) {
  const employment = draft.employment;
  const set = <K extends keyof typeof employment>(key: K, value: (typeof employment)[K]) =>
    update((current) => ({
      ...current,
      employment: { ...current.employment, [key]: value },
    }));

  const setStatus = (status: 'employed' | 'unemployed') => {
    if (status === 'unemployed') {
      update((current) => ({
        ...current,
        employment: {
          status: 'unemployed',
          currentEmployer: '',
          currentPosition: '',
          currentCountry: '',
          currentStartDate: '',
          currentSalaryAmount: '',
          currentSalaryCurrency: current.employment.currentSalaryCurrency,
        },
      }));
      return;
    }
    set('status', status);
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-1.5">
        <legend className="flex items-baseline gap-1.5 text-sm font-medium text-ink">
          <span>What is your current employment status?</span>
          <span aria-hidden="true" className="text-brand-600">
            *
          </span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { key: 'employed', title: 'Employed', detail: 'I am working now.' },
              {
                key: 'unemployed',
                title: 'Not currently employed',
                detail: 'I am looking for work, or between roles.',
              },
            ] as const
          ).map((option) => {
            const checked = employment.status === option.key;
            return (
              <label
                key={option.key}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm transition-colors',
                  'focus-within:ring-4 focus-within:ring-accent-600/15',
                  checked
                    ? 'border-accent-600 bg-accent-50'
                    : 'border-[var(--border-strong)] bg-white hover:border-accent-300',
                  errors['employment.status'] && 'border-red-400',
                )}
              >
                <input
                  type="radio"
                  name="employment-status"
                  value={option.key}
                  checked={checked}
                  onChange={() => setStatus(option.key)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                    checked ? 'border-accent-600 bg-accent-600' : 'border-slate-300 bg-white',
                  )}
                >
                  {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
                </span>
                <span>
                  <span className="font-medium text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors['employment.status'] ? (
          <p role="alert" className="text-xs font-medium text-red-600">
            {errors['employment.status']}
          </p>
        ) : null}
      </fieldset>

      {employment.status === 'unemployed' ? (
        <p className="flex items-start gap-2 rounded-md bg-accent-50 px-4 py-3 text-sm leading-relaxed text-accent-900">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Not being employed now does not disqualify you. We will review your skills, qualifications
          and previous roles.
        </p>
      ) : null}

      {employment.status === 'employed' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="Employer"
            required
            value={employment.currentEmployer}
            onChange={(value) => set('currentEmployer', value)}
            error={errors['employment.currentEmployer']}
          />
          <TextInput
            label="Position"
            required
            value={employment.currentPosition}
            onChange={(value) => set('currentPosition', value)}
            error={errors['employment.currentPosition']}
          />
          <SelectInput
            label="Country of employment"
            required
            value={employment.currentCountry}
            onChange={(value) => set('currentCountry', value)}
            options={COUNTRY_OPTIONS}
            error={errors['employment.currentCountry']}
          />
          <TextInput
            label="Start date"
            type="month"
            required
            value={employment.currentStartDate}
            onChange={(value) => set('currentStartDate', value)}
            error={errors['employment.currentStartDate']}
            hint="The month you started in this role."
          />
          <TextInput
            label="Monthly salary"
            required
            inputMode="numeric"
            value={employment.currentSalaryAmount}
            onChange={(value) => set('currentSalaryAmount', value.replace(/[^\d,\s]/g, ''))}
            error={errors['employment.currentSalaryAmount']}
            hint={`Whole number only, up to ${MAX_SALARY_AMOUNT.toLocaleString('en-GB')}.`}
          />
          <SelectInput
            label="Salary currency"
            required
            value={employment.currentSalaryCurrency}
            onChange={(value) => set('currentSalaryCurrency', value)}
            options={CURRENCY_CHOICES}
            error={errors['employment.currentSalaryCurrency']}
          />
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Previous employment                                                     */
/* -------------------------------------------------------------------------- */

export function PreviousEmploymentStep({ draft, errors, update }: StepProps) {
  const updateEntry = (index: number, patch: Partial<PreviousEmploymentEntry>) =>
    update((current) => ({
      ...current,
      previousEmployment: current.previousEmployment.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    }));

  return (
    <div className="space-y-5">
      {draft.previousEmployment.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-sm text-slate-500">
          No previous roles added. This section is optional — add a role if you have one.
        </p>
      ) : null}

      {draft.previousEmployment.map((entry, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-full bg-white font-mono text-[0.6875rem] font-semibold text-slate-500 ring-1 ring-[var(--border-subtle)]"
              >
                {index + 1}
              </span>
              Previous role {index + 1}
            </p>
            <RemoveRowButton
              label="Remove"
              onClick={() =>
                update((current) => ({
                  ...current,
                  previousEmployment: current.previousEmployment.filter(
                    (_, position) => position !== index,
                  ),
                }))
              }
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              label="Employer"
              required
              value={entry.employerName}
              onChange={(value) => updateEntry(index, { employerName: value })}
              error={errors[`previousEmployment.${index}.employerName`]}
            />
            <TextInput
              label="Position"
              required
              value={entry.position}
              onChange={(value) => updateEntry(index, { position: value })}
              error={errors[`previousEmployment.${index}.position`]}
            />
            <SelectInput
              label="Country"
              required
              value={entry.country}
              onChange={(value) => updateEntry(index, { country: value })}
              options={COUNTRY_OPTIONS}
              error={errors[`previousEmployment.${index}.country`]}
            />
            <TextInput
              label="Years worked"
              required
              inputMode="numeric"
              value={entry.yearsWorked}
              onChange={(value) => updateEntry(index, { yearsWorked: value.replace(/[^\d]/g, '') })}
              error={errors[`previousEmployment.${index}.yearsWorked`]}
              maxLength={2}
            />
          </div>
        </div>
      ))}

      <AddRowButton
        label="Add a previous role"
        disabled={draft.previousEmployment.length >= 10}
        onClick={() =>
          update((current) => ({
            ...current,
            previousEmployment: [...current.previousEmployment, { ...EMPTY_PREVIOUS_EMPLOYMENT }],
          }))
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Skills                                                                  */
/* -------------------------------------------------------------------------- */

export function SkillsStep({ draft, errors, update }: StepProps) {
  const toggle = (skill: string, checked: boolean) =>
    update((current) => ({
      ...current,
      skills: checked
        ? [...current.skills, skill]
        : current.skills.filter((existing) => existing !== skill),
    }));

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        Select every skill you can evidence with work history, training or certification.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SKILL_CHOICES.map((skill) => (
          <CheckTile
            key={skill.value}
            checked={draft.skills.includes(skill.value)}
            onChange={(checked) => toggle(skill.value, checked)}
          >
            {skill.label}
          </CheckTile>
        ))}
      </div>

      {errors['skills.skills'] || errors.skills ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {errors['skills.skills'] ?? errors.skills}
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          {draft.skills.length === 0
            ? 'At least one skill is required.'
            : `${draft.skills.length} selected.`}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Languages                                                               */
/* -------------------------------------------------------------------------- */

export function LanguagesStep({ draft, errors, update }: StepProps) {
  const set = (language: string, proficiency: string) =>
    update((current) => ({
      ...current,
      languages: { ...current.languages, [language]: proficiency },
    }));

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        Rate your spoken and written ability in each language. Leave a row blank if you do not speak
        it.
      </p>

      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,10rem)_repeat(4,1fr)] gap-2 bg-[var(--surface-muted)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid"
        >
          <span>Language</span>
          {PROFICIENCY_CHOICES.map((level) => (
            <span key={level.value} className="text-center">
              {level.label}
            </span>
          ))}
        </div>

        {LANGUAGE_CHOICES.map((language, rowIndex) => (
          <fieldset
            key={language.value}
            className={cn(
              'grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,10rem)_repeat(4,1fr)] sm:items-center',
              rowIndex > 0 && 'border-t border-[var(--border-subtle)]',
            )}
          >
            <legend className="text-sm font-medium text-ink">{language.label}</legend>
            {PROFICIENCY_CHOICES.map((level) => {
              const checked = draft.languages[language.value] === level.value;
              return (
                <label
                  key={level.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors sm:justify-center',
                    checked
                      ? 'border-accent-600 bg-accent-50 font-semibold text-accent-800'
                      : 'border-[var(--border-subtle)] text-slate-600 hover:border-accent-300',
                  )}
                >
                  <input
                    type="radio"
                    name={`language-${language.value}`}
                    value={level.value}
                    checked={checked}
                    onChange={() => set(language.value, level.value)}
                    className="sr-only"
                  />
                  <span className="sm:hidden">{level.label}</span>
                  <span aria-hidden="true" className="hidden sm:block">
                    {checked ? (
                      <span className="size-2 rounded-full bg-accent-600" />
                    ) : (
                      <span className="size-2 rounded-full border border-slate-300" />
                    )}
                  </span>
                  <span className="sr-only sm:hidden">{level.label}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>

      {/* Both keys are legitimate: the step validator reports `languages.languages`,
          while a refused submission reports the whole-form path `languages`. */}
      {errors['languages.languages'] ?? errors.languages ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {errors['languages.languages'] ?? errors.languages}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. Preferences                                                             */
/* -------------------------------------------------------------------------- */

export function PreferencesStep({
  draft,
  errors,
  update,
  destinations,
}: StepProps & { destinations: ReadonlyArray<{ id: string; name: string }> }) {
  const preferences = draft.preferences;
  const set = <K extends keyof typeof preferences>(key: K, value: (typeof preferences)[K]) =>
    update((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));

  return (
    <div className="space-y-6">
      <SelectInput
        label="Preferred destination"
        required={false}
        value={preferences.preferredCountryId}
        onChange={(value) => set('preferredCountryId', value)}
        options={destinations.map((destination) => ({
          value: destination.id,
          label: destination.name,
        }))}
        error={errors['preferences.preferredCountryId']}
        placeholder="No preference"
        hint="Only destinations the agency currently publishes appear here."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Preferred occupation"
          required
          value={preferences.preferredOccupation}
          onChange={(value) => set('preferredOccupation', value)}
          error={errors['preferences.preferredOccupation']}
          hint="For example: registered nurse, welder, HGV driver."
        />
        <div className="grid grid-cols-[1fr_minmax(0,7rem)] gap-3">
          <TextInput
            label="Expected monthly salary"
            required={false}
            inputMode="numeric"
            value={preferences.expectedSalaryAmount}
            onChange={(value) => set('expectedSalaryAmount', value.replace(/[^\d,\s]/g, ''))}
            error={errors['preferences.expectedSalaryAmount']}
          />
          <SelectInput
            label="Currency"
            required={false}
            value={preferences.expectedSalaryCurrency}
            onChange={(value) => set('expectedSalaryCurrency', value)}
            options={CURRENCY_CHOICES}
            error={errors['preferences.expectedSalaryCurrency']}
          />
        </div>
      </div>

      <p className="rounded-md bg-[var(--surface-muted)] px-4 py-3 text-xs leading-relaxed text-slate-600">
        A salary expectation helps us discuss realistic options. It is not a quotation, and it does
        not commit you or the agency to anything.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. Additional information                                                  */
/* -------------------------------------------------------------------------- */

export function AdditionalStep({ draft, errors, update }: StepProps) {
  const additional = draft.additional;
  const set = <K extends keyof typeof additional>(key: K, value: (typeof additional)[K]) =>
    update((current) => ({
      ...current,
      additional: { ...current.additional, [key]: value },
    }));

  /**
   * Five yes/no questions, each with a conditional detail box.
   *
   * Declared as data rather than five copy-pasted blocks, so the "clear the
   * detail when the answer is No" rule exists once and cannot be implemented
   * four times correctly and once incorrectly.
   */
  const questions = [
    {
      answerKey: 'hasMedicalCondition',
      detailKey: 'medicalDetails',
      label: 'Do you have a medical condition that affects your work?',
      detailLabel: 'Please describe the condition and any treatment',
      hint: 'This is confidential and is considered only where a destination requires a medical check.',
    },
    {
      answerKey: 'hasCriminalRecord',
      detailKey: 'criminalRecordDetails',
      label: 'Have you ever been convicted of a criminal offence?',
      detailLabel: 'Please give brief details, including the year and country',
      hint: 'Many countries still grant visas to people with past convictions. Answering honestly is better than discovering the issue later.',
    },
    {
      answerKey: 'hasTravelledAbroad',
      detailKey: 'travelledCountries',
      label: 'Have you travelled outside your country of residence?',
      detailLabel: 'Which countries have you visited?',
      hint: 'Separate countries with commas.',
    },
    {
      answerKey: 'hasFamilyAbroad',
      detailKey: 'familyAbroadCountries',
      label: 'Do you have family living abroad?',
      detailLabel: 'Which countries, and who lives there?',
      hint: 'Separate countries with commas.',
    },
    {
      answerKey: 'hasProfessionalExams',
      detailKey: 'professionalExamsNotes',
      label: 'Have you taken a professional or licensing examination?',
      detailLabel: 'Which examination or licence, and the result',
      hint: 'For example IELTS, NCLEX, AHPRA, or a trade certification.',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-xs leading-relaxed text-slate-600">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        These answers are stored privately and are read only by authorised agency staff reviewing
        your assessment.
      </p>

      {questions.map((question) => {
        const answer = additional[question.answerKey];
        const detail = additional[question.detailKey];

        return (
          <div key={question.answerKey} className="space-y-3">
            <YesNoInput
              label={question.label}
              value={answer}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  additional: {
                    ...current.additional,
                    [question.answerKey]: value,
                    // Clearing on "No" keeps the stored record consistent with
                    // the answer, and matches the server's rule exactly.
                    ...(value === 'no' ? { [question.detailKey]: '' } : {}),
                  },
                }))
              }
              error={errors[`additional.${question.answerKey}`]}
              hint={question.hint}
            />

            {answer === 'yes' ? (
              <TextArea
                label={question.detailLabel}
                required
                rows={3}
                value={detail}
                onChange={(value) => set(question.detailKey, value)}
                error={errors[`additional.${question.detailKey}`]}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 10. CV                                                                     */
/* -------------------------------------------------------------------------- */

export function CvStep({
  file,
  error,
  onSelect,
  onClear,
}: {
  file: File | null;
  error?: string;
  onSelect: (file: File | null) => void;
  onClear: () => void;
}) {
  const sizeLabel = file
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : null;

  return (
    <div className="space-y-4">
      <Field
        label="Attach your CV"
        required
        error={error}
        hint="PDF or Word (.docx), up to 10 MB. We check the file itself, not just its name."
      >
        {(ids) => (
          <div
            className={cn(
              'rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
              error ? 'border-red-400 bg-red-50/40' : 'border-[var(--border-strong)] bg-white',
            )}
          >
            {file ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <FileText aria-hidden="true" className="size-5 text-accent-700" />
                <div className="text-left">
                  <p className="text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-slate-500">{sizeLabel} · ready to upload</p>
                </div>
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  Remove
                </button>
              </div>
            ) : (
              <label
                htmlFor={ids.id}
                className="inline-flex cursor-pointer flex-col items-center gap-2 text-sm text-slate-600"
              >
                <Paperclip aria-hidden="true" className="size-5 text-accent-700" />
                <span className="font-medium text-accent-800 underline decoration-accent-300 underline-offset-2">
                  Choose a file
                </span>
                <span className="text-xs text-slate-500">or drag it onto this box</span>
              </label>
            )}

            <input
              id={ids.id}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-describedby={ids.describedBy}
              aria-invalid={ids.invalid || undefined}
              onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
              className={file ? 'sr-only' : 'sr-only'}
            />
          </div>
        )}
      </Field>

      <p className="text-xs leading-relaxed text-slate-500">
        Your CV is stored privately and is never published. Only authorised agency staff can open it.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 11. Review                                                                 */
/* -------------------------------------------------------------------------- */

const GENDER_LABEL = new Map(GENDER_CHOICES.map((choice) => [choice.value, choice.label]));
const MARITAL_LABEL = new Map(MARITAL_STATUS_CHOICES.map((choice) => [choice.value, choice.label]));
const QUALIFICATION_LABEL = new Map(
  QUALIFICATION_CHOICES.map((choice) => [choice.value, choice.label]),
);
const SKILL_LABEL = new Map(SKILL_CHOICES.map((choice) => [choice.value, choice.label]));
const PROFICIENCY_LABEL = new Map(
  PROFICIENCY_CHOICES.map((choice) => [choice.value, choice.label]),
);

function countryName(code: string): string {
  return getIsoCountry(code)?.name ?? code;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 py-1.5 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-ink">{value || <span className="text-slate-600">Not provided</span>}</dd>
    </div>
  );
}

function SummaryGroup({
  title,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  stepId: string;
  onEdit: (stepId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(stepId)}
          className="text-xs font-medium text-accent-800 underline decoration-accent-300 underline-offset-2 hover:decoration-accent-600"
        >
          Change
        </button>
      </div>
      <dl className="divide-y divide-[var(--border-subtle)]">{children}</dl>
    </section>
  );
}

export function ReviewStep({
  draft,
  onEdit,
  cvFilename,
}: {
  draft: AssessmentDraft;
  onEdit: (stepId: string) => void;
  cvFilename: string | null;
}) {
  const { personal, passport, employment, preferences, additional } = draft;

  return (
    <div className="space-y-4">
      <SummaryGroup title="Personal information" stepId="personal" onEdit={onEdit}>
        <SummaryRow label="Full name" value={personal.fullName} />
        <SummaryRow label="Date of birth" value={personal.dateOfBirth} />
        <SummaryRow label="Gender" value={GENDER_LABEL.get(personal.gender) ?? ''} />
        <SummaryRow label="Nationality" value={countryName(personal.nationality)} />
        <SummaryRow label="Country of residence" value={countryName(personal.countryOfResidence)} />
        <SummaryRow
          label="Address"
          value={[personal.residentialAddress, personal.city, personal.stateProvince, personal.postalCode]
            .filter(Boolean)
            .join(', ')}
        />
        <SummaryRow
          label="Mobile"
          value={personal.mobileNumber ? `${personal.mobileCountryCode} ${personal.mobileNumber}` : ''}
        />
        <SummaryRow
          label="Alternative number"
          value={
            personal.altMobileNumber
              ? `${personal.altMobileCountryCode} ${personal.altMobileNumber}`
              : ''
          }
        />
        <SummaryRow label="Email" value={personal.email} />
        <SummaryRow label="Marital status" value={MARITAL_LABEL.get(personal.maritalStatus) ?? ''} />
        <SummaryRow
          label="Children"
          value={
            personal.hasChildren === 'yes'
              ? `Yes — ${personal.numberOfChildren}`
              : personal.hasChildren === 'no'
                ? 'No'
                : ''
          }
        />
      </SummaryGroup>

      <SummaryGroup title="Passport" stepId="passport" onEdit={onEdit}>
        <SummaryRow
          label="Holds a passport"
          value={passport.hasPassport === 'yes' ? 'Yes' : passport.hasPassport === 'no' ? 'No' : ''}
        />
        {passport.hasPassport === 'yes' ? (
          <>
            <SummaryRow label="Passport number" value={passport.passportNumber} />
            <SummaryRow label="City of issue" value={passport.passportCityOfIssue} />
            <SummaryRow label="Issued" value={passport.passportIssueDate} />
            <SummaryRow label="Expires" value={passport.passportExpiryDate} />
          </>
        ) : null}
      </SummaryGroup>

      <SummaryGroup title="Education" stepId="education" onEdit={onEdit}>
        {draft.education.map((entry, index) => (
          <SummaryRow
            key={index}
            label={`Qualification ${index + 1}`}
            value={[
              QUALIFICATION_LABEL.get(entry.qualificationLevel),
              entry.institutionName,
              countryName(entry.country),
              entry.yearCompleted,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </SummaryGroup>

      <SummaryGroup title="Employment" stepId="employment" onEdit={onEdit}>
        <SummaryRow
          label="Current status"
          value={
            employment.status === 'unemployed'
              ? 'Not currently employed'
              : employment.status === 'employed'
                ? 'Employed'
                : ''
          }
        />
        {employment.status === 'employed' ? (
          <>
            <SummaryRow label="Employer" value={employment.currentEmployer} />
            <SummaryRow label="Position" value={employment.currentPosition} />
            <SummaryRow label="Country" value={countryName(employment.currentCountry)} />
            <SummaryRow label="Since" value={employment.currentStartDate} />
            <SummaryRow
              label="Monthly salary"
              value={
                employment.currentSalaryAmount
                  ? `${employment.currentSalaryCurrency} ${employment.currentSalaryAmount}`
                  : ''
              }
            />
          </>
        ) : null}
      </SummaryGroup>

      <SummaryGroup title="Previous employment" stepId="previous-employment" onEdit={onEdit}>
        {draft.previousEmployment.length === 0 ? (
          <SummaryRow label="Roles" value="None added" />
        ) : (
          draft.previousEmployment.map((entry, index) => (
            <SummaryRow
              key={index}
              label={`Role ${index + 1}`}
              value={[entry.position, entry.employerName, countryName(entry.country), `${entry.yearsWorked} yrs`]
                .filter(Boolean)
                .join(' · ')}
            />
          ))
        )}
      </SummaryGroup>

      <SummaryGroup title="Skills" stepId="skills" onEdit={onEdit}>
        <SummaryRow
          label="Selected"
          value={draft.skills.map((skill) => SKILL_LABEL.get(skill) ?? skill).join(', ')}
        />
      </SummaryGroup>

      <SummaryGroup title="Languages" stepId="languages" onEdit={onEdit}>
        {LANGUAGE_CHOICES.map((language) => (
          <SummaryRow
            key={language.value}
            label={language.label}
            value={
              draft.languages[language.value]
                ? (PROFICIENCY_LABEL.get(draft.languages[language.value] ?? '') ?? '')
                : ''
            }
          />
        ))}
      </SummaryGroup>

      <SummaryGroup title="Employment preferences" stepId="preferences" onEdit={onEdit}>
        <SummaryRow label="Preferred occupation" value={preferences.preferredOccupation} />
        <SummaryRow
          label="Expected salary"
          value={
            preferences.expectedSalaryAmount
              ? `${preferences.expectedSalaryCurrency} ${preferences.expectedSalaryAmount}`
              : ''
          }
        />
      </SummaryGroup>

      <SummaryGroup title="Additional information" stepId="additional" onEdit={onEdit}>
        <SummaryRow
          label="Medical condition"
          value={additional.hasMedicalCondition === 'yes' ? `Yes — ${additional.medicalDetails}` : additional.hasMedicalCondition === 'no' ? 'No' : ''}
        />
        <SummaryRow
          label="Criminal record"
          value={additional.hasCriminalRecord === 'yes' ? `Yes — ${additional.criminalRecordDetails}` : additional.hasCriminalRecord === 'no' ? 'No' : ''}
        />
        <SummaryRow
          label="Travelled abroad"
          value={additional.hasTravelledAbroad === 'yes' ? `Yes — ${additional.travelledCountries}` : additional.hasTravelledAbroad === 'no' ? 'No' : ''}
        />
        <SummaryRow
          label="Family abroad"
          value={additional.hasFamilyAbroad === 'yes' ? `Yes — ${additional.familyAbroadCountries}` : additional.hasFamilyAbroad === 'no' ? 'No' : ''}
        />
        <SummaryRow
          label="Professional exams"
          value={additional.hasProfessionalExams === 'yes' ? `Yes — ${additional.professionalExamsNotes}` : additional.hasProfessionalExams === 'no' ? 'No' : ''}
        />
      </SummaryGroup>

      <SummaryGroup title="CV" stepId="cv" onEdit={onEdit}>
        <SummaryRow label="Attached file" value={cvFilename ?? ''} />
      </SummaryGroup>

      <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        <Badge tone="warning" className="shrink-0">
          Note
        </Badge>
        <span>
          Submitting this form does not mean you are eligible for any visa, and does not guarantee a
          visa, a job or an interview. Our team will review your information and contact you about your
          assessment.
        </span>
      </p>
    </div>
  );
}
