'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { MediaPicker } from './media-picker';
import { SlugField } from './slug-field';
import {
  FormAlert,
  FormSection,
  RepeaterRow,
  SaveBar,
  TextArea,
  TextInput,
  Toggle,
} from './form-kit';
import type { ServiceFeatureForm, ServiceFormValues } from '@/lib/cms/form-defaults';
import { useSave } from './use-save';

/**
 * Service editor.
 *
 * The rule that shapes this form: nothing is pre-filled with invented copy. An
 * empty `shortDescription` produces an honest "details to follow" state on the
 * public page rather than a paragraph we wrote for the agency.
 */
export function ServiceForm({
  serviceId,
  initial,
  publicUrl,
}: {
  serviceId?: string;
  initial: ServiceFormValues;
  publicUrl?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ServiceFormValues>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));

  const isNew = !serviceId;
  const isDirty = JSON.stringify(values) !== snapshot;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useSave({
    url: isNew ? '/api/admin/cms/services' : `/api/admin/cms/services/${serviceId}`,
    method: isNew ? 'POST' : 'PUT',
    value: values,
    successMessage: isNew
      ? 'Service created. It is saved as a draft until you publish it.'
      : 'Service saved.',
    onSuccess: (data) => {
      const created = data as { id?: string } | undefined;
      if (isNew && created?.id) {
        router.replace(`/admin/content/services/${created.id}`);
      }
      router.refresh();
    },
  });

  function update<K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateFeature(index: number, patch: Partial<ServiceFeatureForm>) {
    setValues((current) => ({
      ...current,
      features: current.features.map((feature, i) =>
        i === index ? { ...feature, ...patch } : feature,
      ),
    }));
  }

  function moveFeature(index: number, direction: -1 | 1) {
    setValues((current) => {
      const next = [...current.features];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(target, 0, moved);
      return { ...current, features: next };
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {formMessage ? (
        <FormAlert
          tone="error"
          title="The service could not be saved"
          messages={formMessage}
          onDismiss={clearMessages}
        />
      ) : null}
      {success ? (
        <FormAlert tone="success" title={success} onDismiss={clearMessages} />
      ) : null}

      <FormSection
        title="Basics"
        description="What the service is called and how it appears in lists."
      >
        <div className="space-y-4">
          <TextInput
            label="Service name"
            value={values.title}
            onChange={(value) => {
              update('title', value);
              if (!values.slug) update('slug', '');
            }}
            required
            maxLength={200}
            error={errorFor('title')}
            placeholder="e.g. Skilled Worker Placement"
          />

          <SlugField
            label="URL slug"
            value={values.slug}
            onChange={(slug) => update('slug', slug)}
            titleSource={values.title}
            error={errorFor('slug')}
            prefix="/services"
          />

          <TextArea
            label="Short description"
            value={values.shortDescription}
            onChange={(value) => update('shortDescription', value)}
            error={errorFor('shortDescription')}
            hint="One or two sentences shown on the services list and in search results. Leave empty and the card will say details are to follow."
            rows={2}
            maxLength={600}
          />
        </div>
      </FormSection>

      <FormSection
        title="Detail"
        description="The main body of the service page. Markdown is supported: **bold**, *italic*, lists with - , and [links](https://example.com)."
      >
        <TextArea
          label="Description"
          value={values.descriptionMd}
          onChange={(value) => update('descriptionMd', value)}
          rows={12}
          mono
          error={errorFor('descriptionMd')}
          hint="Do not state fees, processing times or eligibility rules unless they are accurate and current — you are responsible for published claims."
        />
      </FormSection>

      <FormSection
        title="Features"
        description="Optional bullet points shown beneath the description. Drag-free reordering with the arrows."
      >
        {values.features.length === 0 ? (
          <p className="mb-3 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-slate-500">
            No bullet points yet. The page will show only the description.
          </p>
        ) : null}

        <ul className="space-y-2">
          {values.features.map((feature, index) => (
            <RepeaterRow
              key={feature.id ?? `new-${index}`}
              index={index}
              count={values.features.length}
              onMoveUp={() => moveFeature(index, -1)}
              onMoveDown={() => moveFeature(index, 1)}
              onRemove={() =>
                setValues((current) => ({
                  ...current,
                  features: current.features.filter((_, i) => i !== index),
                }))
              }
              removeLabel={`Remove feature ${index + 1}`}
            >
              <TextInput
                label="Label"
                value={feature.label}
                onChange={(value) => updateFeature(index, { label: value })}
                required
                maxLength={200}
                error={errorFor(`features.${index}.label`)}
              />
              <TextArea
                label="Detail (optional)"
                value={feature.detailMd}
                onChange={(value) => updateFeature(index, { detailMd: value })}
                rows={2}
                mono
                error={errorFor(`features.${index}.detailMd`)}
              />
            </RepeaterRow>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            setValues((current) => ({
              ...current,
              features: [...current.features, { label: '', detailMd: '' }],
            }))
          }
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add feature
        </Button>
      </FormSection>

      <FormSection title="Image and call to action">
        <div className="space-y-4">
          <MediaPicker
            label="Service image"
            purpose="service"
            value={values.imageAssetId}
            onChange={(id) => update('imageAssetId', id)}
            hint="Optional. PNG, JPEG or WebP, up to 8 MB."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Button label"
              value={values.ctaLabel}
              onChange={(value) => update('ctaLabel', value)}
              maxLength={60}
              error={errorFor('ctaLabel')}
              placeholder="e.g. Book a Consultation Now"
            />
            <TextInput
              label="Button link"
              value={values.ctaHref}
              onChange={(value) => update('ctaHref', value)}
              error={errorFor('ctaHref')}
              placeholder="/assessment"
              hint="A path on this site, or a full https:// address."
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Publishing">
        <div className="space-y-4">
          <Toggle
            label="Published"
            description="Published services appear on the public website immediately. Drafts are only visible to signed-in administrators."
            checked={values.status === 'published'}
            onChange={(checked) => update('status', checked ? 'published' : 'draft')}
          />

          {publicUrl ? (
            <p className="text-xs text-slate-500">
              Public address:{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer noopener" className="font-mono text-accent-700 hover:underline">
                {publicUrl}
              </a>
              {values.status !== 'published'
                ? ' — this will return “not found” until the service is published.'
                : null}
            </p>
          ) : null}
        </div>
      </FormSection>

      <SaveBar
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={() => void save()}
        onCancel={() => router.push('/admin/content/services')}
        saveLabel={isNew ? 'Create service' : 'Save changes'}
        status={
          <span className={isDirty ? 'font-medium text-amber-700' : 'text-slate-500'}>
            {isDirty ? 'Unsaved changes' : `Status: ${values.status}`}
          </span>
        }
      />
    </div>
  );
}
