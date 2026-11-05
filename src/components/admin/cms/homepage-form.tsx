'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MediaPicker } from './media-picker';
import {
  FormAlert,
  FormSection,
  SaveBar,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from './form-kit';
import type { HomepageSectionFormValues } from '@/lib/cms/form-defaults';
import { SECTION_SLOTS } from '@/lib/cms/form-defaults';
import { useSave } from './use-save';

export function HomepageSectionForm({
  sectionId,
  initial,
}: {
  sectionId?: string;
  initial: HomepageSectionFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<HomepageSectionFormValues>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const isNew = !sectionId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useSave({
    url: isNew ? '/api/admin/cms/homepage' : `/api/admin/cms/homepage/${sectionId}`,
    method: isNew ? 'POST' : 'PUT',
    value: values,
    successMessage: isNew ? 'Section created.' : 'Section saved. The homepage is updated.',
    onSuccess: (data) => {
      const created = data as { id?: string } | undefined;
      if (isNew && created?.id) router.replace(`/admin/content/homepage/${created.id}`);
      router.refresh();
    },
  });

  function update<K extends keyof HomepageSectionFormValues>(
    key: K,
    value: HomepageSectionFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const isDirty = JSON.stringify(values) !== snapshot;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {formMessage ? (
        <FormAlert
          tone="error"
          title="The section could not be saved"
          messages={formMessage}
          onDismiss={clearMessages}
        />
      ) : null}
      {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}

      <FormSection
        title="Slot and text"
        description="The slot determines where this appears and how it is laid out."
      >
        <div className="space-y-4">
          <SelectInput
            label="Layout slot"
            value={values.sectionKey}
            onChange={(sectionKey) => update('sectionKey', sectionKey)}
            options={SECTION_SLOTS.map((slot) => ({ value: slot.value, label: slot.label }))}
            error={errorFor('sectionKey')}
            hint="Each slot can only be used once."
            required
          />

          <TextInput
            label="Heading"
            value={values.heading}
            onChange={(heading) => update('heading', heading)}
            maxLength={200}
            error={errorFor('heading')}
          />

          <TextArea
            label="Subheading"
            value={values.subheading}
            onChange={(subheading) => update('subheading', subheading)}
            rows={2}
            maxLength={600}
            error={errorFor('subheading')}
          />

          <TextArea
            label="Body"
            value={values.bodyMd}
            onChange={(bodyMd) => update('bodyMd', bodyMd)}
            rows={5}
            mono
            error={errorFor('bodyMd')}
            hint="Markdown is supported."
          />
        </div>
      </FormSection>

      <FormSection title="Call to action" description="Both buttons are optional.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Primary button label"
            value={values.ctaLabel}
            onChange={(ctaLabel) => update('ctaLabel', ctaLabel)}
            maxLength={60}
            error={errorFor('ctaLabel')}
          />
          <TextInput
            label="Primary button link"
            value={values.ctaHref}
            onChange={(ctaHref) => update('ctaHref', ctaHref)}
            error={errorFor('ctaHref')}
            placeholder="/assessment"
          />
          <TextInput
            label="Secondary button label"
            value={values.secondaryCtaLabel}
            onChange={(secondaryCtaLabel) => update('secondaryCtaLabel', secondaryCtaLabel)}
            maxLength={60}
            error={errorFor('secondaryCtaLabel')}
          />
          <TextInput
            label="Secondary button link"
            value={values.secondaryCtaHref}
            onChange={(secondaryCtaHref) => update('secondaryCtaHref', secondaryCtaHref)}
            error={errorFor('secondaryCtaHref')}
            placeholder="/services"
          />
        </div>
      </FormSection>

      <FormSection title="Image and visibility">
        <div className="space-y-4">
          <MediaPicker
            label="Section image"
            purpose="homepage"
            value={values.imageAssetId}
            onChange={(id) => update('imageAssetId', id)}
            hint="Optional. Used by slots that display artwork."
          />

          <Toggle
            label="Visible"
            description="Hidden sections stay saved but are not rendered on the public homepage."
            checked={values.isVisible}
            onChange={(isVisible) => update('isVisible', isVisible)}
          />
        </div>
      </FormSection>

      <SaveBar
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={() => void save()}
        onCancel={() => router.push('/admin/content/homepage')}
        saveLabel={isNew ? 'Create section' : 'Save changes'}
      />
    </div>
  );
}
