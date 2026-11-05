'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MediaPicker } from './media-picker';
import { SlugField } from './slug-field';
import {
  FormAlert,
  FormSection,
  SaveBar,
  TextArea,
  TextInput,
  Toggle,
} from './form-kit';
import type { CountryFormValues } from '@/lib/cms/form-defaults';
import { useSave } from './use-save';

/**
 * Country editor.
 *
 * A country is a container for destination programmes. Its own descriptive fields
 * are optional: an administrator may want the country listed (so a programme can
 * belong to it) long before there is anything to say about the country itself.
 */
export function CountryForm({
  countryId,
  initial,
  publicUrl,
}: {
  countryId?: string;
  initial: CountryFormValues;
  publicUrl?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CountryFormValues>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const isNew = !countryId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useSave({
    url: isNew ? '/api/admin/cms/countries' : `/api/admin/cms/countries/${countryId}`,
    method: isNew ? 'POST' : 'PUT',
    value: values,
    successMessage: isNew ? 'Country created as a draft.' : 'Country saved.',
    onSuccess: (data) => {
      const created = data as { id?: string } | undefined;
      if (isNew && created?.id) router.replace(`/admin/content/countries/${created.id}`);
      router.refresh();
    },
  });

  function update<K extends keyof CountryFormValues>(key: K, value: CountryFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const isDirty = JSON.stringify(values) !== snapshot;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {formMessage ? (
        <FormAlert
          tone="error"
          title="The country could not be saved"
          messages={formMessage}
          onDismiss={clearMessages}
        />
      ) : null}
      {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}

      <FormSection title="Country">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <TextInput
              label="Country name"
              value={values.name}
              onChange={(name) => update('name', name)}
              required
              maxLength={120}
              error={errorFor('name')}
              placeholder="e.g. Canada"
            />
            <TextInput
              label="ISO code"
              value={values.isoCode}
              onChange={(isoCode) => update('isoCode', isoCode.toUpperCase().slice(0, 2))}
              required
              maxLength={2}
              error={errorFor('isoCode')}
              hint="Two letters, e.g. CA."
            />
          </div>

          <SlugField
            label="URL slug"
            value={values.slug}
            onChange={(slug) => update('slug', slug)}
            titleSource={values.name}
            error={errorFor('slug')}
            prefix="/destinations"
          />

          <TextInput
            label="Flag emoji"
            value={values.flagEmoji}
            onChange={(flagEmoji) => update('flagEmoji', flagEmoji)}
            maxLength={16}
            error={errorFor('flagEmoji')}
            hint="Optional fallback when no flag image is uploaded."
          />
        </div>
      </FormSection>

      <FormSection title="Imagery">
        <div className="space-y-5">
          <MediaPicker
            label="Flag image"
            purpose="flag"
            value={values.flagAssetId}
            onChange={(id) => update('flagAssetId', id)}
            hint="Optional. A PNG or JPEG flag, shown on the destinations list."
          />
          <MediaPicker
            label="Hero image"
            purpose="destination"
            value={values.heroImageAssetId}
            onChange={(id) => update('heroImageAssetId', id)}
            hint="Optional. Shown at the top of the country page."
          />
        </div>
      </FormSection>

      <FormSection title="Description" description="Both fields are optional.">
        <div className="space-y-4">
          <TextArea
            label="Summary"
            value={values.summary}
            onChange={(summary) => update('summary', summary)}
            rows={2}
            maxLength={600}
            error={errorFor('summary')}
          />
          <TextArea
            label="Full description"
            value={values.descriptionMd}
            onChange={(descriptionMd) => update('descriptionMd', descriptionMd)}
            rows={8}
            mono
            error={errorFor('descriptionMd')}
            hint="Markdown is supported."
          />
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <div className="space-y-4">
          <Toggle
            label="Feature this country"
            description="Featured countries are highlighted on the destinations page."
            checked={values.isFeatured}
            onChange={(isFeatured) => update('isFeatured', isFeatured)}
          />
          <Toggle
            label="Published"
            description="A published country appears publicly. Its programmes are published separately."
            checked={values.status === 'published'}
            onChange={(checked) => update('status', checked ? 'published' : 'draft')}
          />

          {publicUrl ? (
            <p className="text-xs text-slate-500">
              Public address:{' '}
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-accent-700 hover:underline"
              >
                {publicUrl}
              </a>
            </p>
          ) : null}
        </div>
      </FormSection>

      <SaveBar
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={() => void save()}
        onCancel={() => router.push('/admin/content/countries')}
        saveLabel={isNew ? 'Create country' : 'Save changes'}
        status={
          <span className={isDirty ? 'font-medium text-amber-700' : 'text-slate-500'}>
            {isDirty ? 'Unsaved changes' : `Status: ${values.status}`}
          </span>
        }
      />
    </div>
  );
}
