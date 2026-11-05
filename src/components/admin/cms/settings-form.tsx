'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { SiteSettingsInput } from '@/lib/cms/schemas';
import {
  brandColorError,
  brandColorSummary,
} from '@/lib/brand-colors';

import { MediaPicker } from './media-picker';
import {
  FormAlert,
  FormSection,
  SaveBar,
  TextArea,
  TextInput,
  Toggle,
} from './form-kit';
import { useSave } from './use-save';

/**
 * Agency settings.
 *
 * These values are consumed by every public page — the logo in the header, the
 * footer, the assessment form, the contact page, the metadata generator and the
 * brand colours. Saving here is the one action that can change the whole site at
 * once, which is why it is owner-only and why the form is grouped by area rather
 * than presented as one long list.
 */
export function SettingsForm({ initial }: { initial: SiteSettingsInput }) {
  const router = useRouter();
  const [values, setValues] = useState<SiteSettingsInput>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useSave({
    url: '/api/admin/cms/settings',
    method: 'POST',
    value: values,
    successMessage: 'Settings saved. The public website has been updated.',
    onSuccess: () => router.refresh(),
  });

  function update<K extends keyof SiteSettingsInput>(key: K, value: SiteSettingsInput[K]) {
    clearMessages();
    setValues((current) => ({ ...current, [key]: value }));
  }

  const isDirty = JSON.stringify(values) !== snapshot;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {formMessage ? (
        <FormAlert
          tone="error"
          title="The settings could not be saved"
          messages={formMessage}
          onDismiss={clearMessages}
        />
      ) : null}
      {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}

      <FormSection
        title="Agency identity"
        description="Your agency name appears in the header, the footer, on the assessment form and in page titles."
      >
        <div className="space-y-4">
          <TextInput
            label="Agency name"
            value={values.agencyName}
            onChange={(value) => update('agencyName', value)}
            maxLength={120}
            error={errorFor('agencyName')}
            hint="Leave empty and the site shows a neutral placeholder rather than an invented name."
          />
          <TextInput
            label="Tagline"
            value={values.tagline}
            onChange={(value) => update('tagline', value)}
            maxLength={160}
            error={errorFor('tagline')}
            hint="A short line under the logo. Optional."
          />
          <TextArea
            label="Short description"
            value={values.shortDescription}
            onChange={(value) => update('shortDescription', value)}
            rows={2}
            maxLength={400}
            error={errorFor('shortDescription')}
            hint="Used in the footer and as a default meta description."
          />
          <TextArea
            label="Long description"
            value={values.longDescription}
            onChange={(value) => update('longDescription', value)}
            rows={5}
            maxLength={4000}
            error={errorFor('longDescription')}
            hint="A paragraph about the agency. Used on the About page when that page has no body of its own."
          />
        </div>
      </FormSection>

      <FormSection
        title="Logo and brand images"
        description="The logo you upload here appears in the header, the footer and on the assessment form."
      >
        <div className="space-y-5">
          <MediaPicker
            label="Primary logo"
            purpose="logo"
            value={values.logoAssetId ?? null}
            onChange={(id) => update('logoAssetId', id)}
            hint="PNG, JPEG or WebP, up to 8 MB. A wide logo works best; the height is fixed and the width scales."
          />
          <MediaPicker
            label="Dark-background logo"
            purpose="logo"
            value={values.logoDarkAssetId ?? null}
            onChange={(id) => update('logoDarkAssetId', id)}
            hint="Optional. Used where the logo sits on a dark surface. Falls back to the primary logo."
          />
          <MediaPicker
            label="Favicon"
            purpose="favicon"
            value={values.faviconAssetId ?? null}
            onChange={(id) => update('faviconAssetId', id)}
            hint="Optional. PNG or ICO, shown in the browser tab."
          />
          <MediaPicker
            label="Default social sharing image"
            purpose="seo"
            value={values.ogImageAssetId ?? null}
            onChange={(id) => update('ogImageAssetId', id)}
            hint="Optional. Shown when a page is shared. 1200×630 works best."
          />
        </div>
      </FormSection>

      <FormSection
        title="Brand colours"
        description="These colours update the public website immediately after saving. Contrast is checked against the actual text, focus, button and navigation surfaces; inaccessible combinations are rejected and shown beside the field."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ColourField
            label="Primary (buttons, links)"
            value={values.brandPrimaryColor}
            onChange={(value) => update('brandPrimaryColor', value)}
            summary={brandColorSummary('primary', values.brandPrimaryColor)}
            error={errorFor('brandPrimaryColor') ?? brandColorError('primary', values.brandPrimaryColor) ?? undefined}
          />
          <ColourField
            label="Secondary"
            value={values.brandSecondaryColor}
            onChange={(value) => update('brandSecondaryColor', value)}
            summary={brandColorSummary('secondary', values.brandSecondaryColor)}
            error={errorFor('brandSecondaryColor') ?? brandColorError('secondary', values.brandSecondaryColor) ?? undefined}
          />
          <ColourField
            label="Active / pressed state"
            value={values.brandActiveColor}
            onChange={(value) => update('brandActiveColor', value)}
            summary={brandColorSummary('active', values.brandActiveColor)}
            error={errorFor('brandActiveColor') ?? brandColorError('active', values.brandActiveColor) ?? undefined}
          />
          <ColourField
            label="Body text"
            value={values.brandTextColor}
            onChange={(value) => update('brandTextColor', value)}
            summary={brandColorSummary('text', values.brandTextColor)}
            error={errorFor('brandTextColor') ?? brandColorError('text', values.brandTextColor) ?? undefined}
          />
        </div>
      </FormSection>

      <FormSection title="Contact details" description="Shown on the contact page, the footer and the assessment form.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Email address"
              type="email"
              value={values.contactEmail}
              onChange={(value) => update('contactEmail', value)}
              error={errorFor('contactEmail')}
            />
            <TextInput
              label="WhatsApp number"
              value={values.contactWhatsapp}
              onChange={(value) => update('contactWhatsapp', value)}
              maxLength={40}
              error={errorFor('contactWhatsapp')}
            />
            <TextInput
              label="Primary phone"
              value={values.contactPhonePrimary}
              onChange={(value) => update('contactPhonePrimary', value)}
              maxLength={40}
              error={errorFor('contactPhonePrimary')}
            />
            <TextInput
              label="Secondary phone"
              value={values.contactPhoneSecondary}
              onChange={(value) => update('contactPhoneSecondary', value)}
              maxLength={40}
              error={errorFor('contactPhoneSecondary')}
            />
          </div>

          <TextInput
            label="Address line 1"
            value={values.addressLine1}
            onChange={(value) => update('addressLine1', value)}
            maxLength={160}
            error={errorFor('addressLine1')}
          />
          <TextInput
            label="Address line 2"
            value={values.addressLine2}
            onChange={(value) => update('addressLine2', value)}
            maxLength={160}
            error={errorFor('addressLine2')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="City"
              value={values.addressCity}
              onChange={(value) => update('addressCity', value)}
              maxLength={80}
              error={errorFor('addressCity')}
            />
            <TextInput
              label="State / region"
              value={values.addressState}
              onChange={(value) => update('addressState', value)}
              maxLength={80}
              error={errorFor('addressState')}
            />
            <TextInput
              label="Postal code"
              value={values.addressPostalCode}
              onChange={(value) => update('addressPostalCode', value)}
              maxLength={20}
              error={errorFor('addressPostalCode')}
            />
            <TextInput
              label="Country"
              value={values.addressCountry}
              onChange={(value) => update('addressCountry', value)}
              maxLength={80}
              error={errorFor('addressCountry')}
            />
          </div>

          <TextInput
            label="Office hours"
            value={values.officeHours}
            onChange={(value) => update('officeHours', value)}
            maxLength={120}
            error={errorFor('officeHours')}
            placeholder="e.g. Monday to Friday, 9am–5pm"
          />

          <TextInput
            label="Map embed address"
            value={values.mapEmbedUrl}
            onChange={(value) => update('mapEmbedUrl', value)}
            error={errorFor('mapEmbedUrl')}
            placeholder="https://www.google.com/maps/embed?…"
            hint="Optional. An https:// address for an embedded map. Leave empty to show no map."
          />
        </div>
      </FormSection>

      <FormSection title="Social media" description="Full web addresses. Empty fields are simply not shown.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Facebook"
            value={values.socialFacebook}
            onChange={(value) => update('socialFacebook', value)}
            error={errorFor('socialFacebook')}
            placeholder="https://…"
          />
          <TextInput
            label="Instagram"
            value={values.socialInstagram}
            onChange={(value) => update('socialInstagram', value)}
            error={errorFor('socialInstagram')}
            placeholder="https://…"
          />
          <TextInput
            label="LinkedIn"
            value={values.socialLinkedin}
            onChange={(value) => update('socialLinkedin', value)}
            error={errorFor('socialLinkedin')}
            placeholder="https://…"
          />
          <TextInput
            label="X (Twitter)"
            value={values.socialX}
            onChange={(value) => update('socialX', value)}
            error={errorFor('socialX')}
            placeholder="https://…"
          />
          <TextInput
            label="TikTok"
            value={values.socialTiktok}
            onChange={(value) => update('socialTiktok', value)}
            error={errorFor('socialTiktok')}
            placeholder="https://…"
          />
          <TextInput
            label="YouTube"
            value={values.socialYoutube}
            onChange={(value) => update('socialYoutube', value)}
            error={errorFor('socialYoutube')}
            placeholder="https://…"
          />
        </div>
      </FormSection>

      <FormSection
        title="Privacy and search"
        description="How long applicant data is kept, and whether search engines may index the site."
      >
        <div className="space-y-4">
          <TextInput
            label="Data retention (days)"
            type="number"
            value={String(values.privacyRetentionDays)}
            onChange={(value) =>
              update('privacyRetentionDays', Math.max(0, Number(value) || 0))
            }
            error={errorFor('privacyRetentionDays')}
            hint="0 means keep indefinitely. Otherwise assessments become eligible for purging after this many days. This does not delete anything by itself."
          />

          <TextInput
            label="Privacy contact email"
            type="email"
            value={values.privacyContactEmail}
            onChange={(value) => update('privacyContactEmail', value)}
            error={errorFor('privacyContactEmail')}
            hint="Who an applicant should contact about their data."
          />

          <Toggle
            label="Allow search engines to index this site"
            description="Turn this off while the site is still being prepared — every page then sends noindex."
            checked={values.allowSearchIndexing}
            onChange={(value) => update('allowSearchIndexing', value)}
          />
        </div>
      </FormSection>

      <SaveBar
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={() => void save()}
        status={
          <span className={isDirty ? 'font-medium text-amber-700' : 'text-slate-500'}>
            {isDirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
        }
      />
    </div>
  );
}

/**
 * Colour field.
 *
 * A native colour picker next to a hex input: the picker is approachable, and the
 * text field is there for anyone pasting a brand value from a style guide.
 */
function ColourField({
  label,
  value,
  onChange,
  summary,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  summary: string;
  error?: string;
}) {
  const id = `colour-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const summaryId = `${id}-contrast`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${summaryId} ${errorId}` : summaryId;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={`${id}-picker`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#E11D2E'}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-9 cursor-pointer rounded border border-[var(--border-subtle)] bg-white p-0.5"
          aria-label={`${label} colour picker`}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
        />
        <input
          id={`${id}-hex`}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={7}
          className={`h-9 w-28 rounded-md border px-2 font-mono text-sm uppercase focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15 ${error ? 'border-red-500' : 'border-[var(--border-subtle)]'}`}
          aria-label={`${label} hex value`}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
        />
      </div>
      <p id={summaryId} aria-live="polite" className="text-xs leading-relaxed text-slate-600">
        {summary}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
