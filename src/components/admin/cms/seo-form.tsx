'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MediaPicker } from './media-picker';
import { FormAlert, FormSection, SaveBar, TextArea, TextInput, Toggle } from './form-kit';
import type { SeoFormValues } from '@/lib/cms/form-defaults';
import { useSave } from './use-save';

export function SeoForm({ initial }: { initial: SeoFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<SeoFormValues>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useSave({
    url: '/api/admin/cms/seo',
    method: 'POST',
    value: values,
    successMessage: 'Search settings saved. They apply the next time the page is requested.',
    onSuccess: () => router.refresh(),
  });

  function update<K extends keyof SeoFormValues>(key: K, value: SeoFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const isDirty = JSON.stringify(values) !== snapshot;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {formMessage ? (
        <FormAlert
          tone="error"
          title="The search settings could not be saved"
          messages={formMessage}
          onDismiss={clearMessages}
        />
      ) : null}
      {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}

      <FormSection
        title="Page"
        description="The route this override applies to, for example /about or /services/skilled-worker."
      >
        <TextInput
          label="Route"
          value={values.route}
          onChange={(route) => update('route', route)}
          required
          error={errorFor('route')}
          placeholder="/about"
          hint="Must start with a slash. Changing this creates a separate override."
        />
      </FormSection>

      <FormSection
        title="Search result preview"
        description="What appears in a search engine result. Leave a field empty to use the page's own content instead."
      >
        <div className="space-y-4">
          <TextInput
            label="Title tag"
            value={values.title}
            onChange={(title) => update('title', title)}
            maxLength={120}
            error={errorFor('title')}
            hint="Around 60 characters displays fully in most search results."
          />

          <TextArea
            label="Meta description"
            value={values.description}
            onChange={(description) => update('description', description)}
            rows={3}
            maxLength={400}
            error={errorFor('description')}
            hint="Around 160 characters displays fully."
          />
        </div>

        <div className="mt-4 rounded-md border border-[var(--border-subtle)] bg-white p-3">
          <p className="truncate text-base text-accent-700">
            {values.title || 'Page title will come from the page itself'}
          </p>
          <p className="mt-0.5 truncate text-xs text-emerald-700">
            {values.canonicalOverride || `https://your-domain${values.route || '/'}`}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
            {values.description || 'No meta description — the page’s own summary is used.'}
          </p>
        </div>
      </FormSection>

      <FormSection title="Social sharing">
        <div className="space-y-4">
          <TextInput
            label="Social title"
            value={values.ogTitle}
            onChange={(ogTitle) => update('ogTitle', ogTitle)}
            maxLength={120}
            error={errorFor('ogTitle')}
            hint="Falls back to the title tag when empty."
          />
          <TextArea
            label="Social description"
            value={values.ogDescription}
            onChange={(ogDescription) => update('ogDescription', ogDescription)}
            rows={2}
            maxLength={400}
            error={errorFor('ogDescription')}
          />
          <MediaPicker
            label="Social image"
            purpose="seo"
            value={values.ogImageAssetId}
            onChange={(id) => update('ogImageAssetId', id)}
            hint="Optional. Falls back to the site-wide social image in Agency settings."
          />
        </div>
      </FormSection>

      <FormSection title="Advanced">
        <div className="space-y-4">
          <TextInput
            label="Canonical address"
            value={values.canonicalOverride}
            onChange={(canonicalOverride) => update('canonicalOverride', canonicalOverride)}
            error={errorFor('canonicalOverride')}
            placeholder="https://…"
            hint="Only set this if this page duplicates another address. Otherwise leave it empty."
          />

          <Toggle
            label="Hide this page from search engines"
            description="Adds noindex. The page stays publicly reachable, but search engines are asked not to list it."
            checked={values.noIndex}
            onChange={(noIndex) => update('noIndex', noIndex)}
          />
        </div>
      </FormSection>

      <SaveBar
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={() => void save()}
        onCancel={() => router.push('/admin/content/seo')}
        saveLabel="Save search settings"
      />
    </div>
  );
}
