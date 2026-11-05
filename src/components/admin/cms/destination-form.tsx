'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DESTINATION_REQUIREMENT_CATEGORIES } from '@/db/schema/enums';
import type { DestinationRequirementCategory } from '@/db/schema/enums';

import { MediaPicker } from './media-picker';
import { SlugField } from './slug-field';
import {
  FormAlert,
  FormSection,
  RepeaterRow,
  SaveBar,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from './form-kit';
import type {
  DestinationFormValues,
  RequirementForm,
  VisaCategoryForm,
} from '@/lib/cms/form-defaults';
import { useSave } from './use-save';

const CATEGORY_LABELS: Record<DestinationRequirementCategory, string> = {
  eligibility: 'Eligibility',
  documents: 'Required documents',
  language: 'Language requirements',
  qualification: 'Professional qualifications',
  procedure: 'Application procedure',
  notice: 'Important notice',
  link: 'Official link',
};

/**
 * Destination programme editor.
 *
 * This is the most content-heavy screen: three free-text blocks about the process,
 * an ordered list of visa categories and an ordered list of process entries across
 * seven categories.
 *
 * The empty-state discipline matters most here. Nothing is pre-filled with a fee,
 * a processing time or an eligibility rule, because those are exactly the claims
 * that become misrepresentation when invented. The form instead says what each
 * field is for and leaves it blank.
 */
export function DestinationForm({
  destinationId,
  initial,
  countries,
  publicUrl,
}: {
  destinationId?: string;
  initial: DestinationFormValues;
  countries: Array<{ id: string; name: string; isoCode: string }>;
  publicUrl?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<DestinationFormValues>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const isNew = !destinationId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useSave({
    url: isNew
      ? '/api/admin/cms/destinations'
      : `/api/admin/cms/destinations/${destinationId}`,
    method: isNew ? 'POST' : 'PUT',
    value: values,
    successMessage: isNew ? 'Programme created as a draft.' : 'Programme saved.',
    onSuccess: (data) => {
      const created = data as { id?: string } | undefined;
      if (isNew && created?.id) router.replace(`/admin/content/destinations/${created.id}`);
      router.refresh();
    },
  });

  function update<K extends keyof DestinationFormValues>(
    key: K,
    value: DestinationFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateVisa(index: number, patch: Partial<VisaCategoryForm>) {
    setValues((current) => ({
      ...current,
      visaCategories: current.visaCategories.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function updateRequirement(index: number, patch: Partial<RequirementForm>) {
    setValues((current) => ({
      ...current,
      requirements: current.requirements.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function moveIn<K extends 'visaCategories' | 'requirements'>(
    key: K,
    index: number,
    direction: -1 | 1,
  ) {
    setValues((current) => {
      const list = [...current[key]];
      const target = index + direction;
      if (target < 0 || target >= list.length) return current;
      const [moved] = list.splice(index, 1);
      if (!moved) return current;
      list.splice(target, 0, moved);
      return { ...current, [key]: list } as DestinationFormValues;
    });
  }

  const isDirty = JSON.stringify(values) !== snapshot;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {formMessage ? (
        <FormAlert
          tone="error"
          title="The programme could not be saved"
          messages={formMessage}
          onDismiss={clearMessages}
        />
      ) : null}
      {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}

      <FormSection title="Programme">
        <div className="space-y-4">
          {countries.length === 0 ? (
            <FormAlert
              tone="info"
              title="Add a country first"
              messages={[
                'A destination programme belongs to a country. Create the country, then come back.',
              ]}
            />
          ) : null}

          <SelectInput
            label="Country"
            value={values.countryId}
            onChange={(countryId) => update('countryId', countryId)}
            required
            error={errorFor('countryId')}
            options={[
              { value: '', label: 'Choose a country…' },
              ...countries.map((country) => ({
                value: country.id,
                label: `${country.name} (${country.isoCode})`,
              })),
            ]}
          />

          <TextInput
            label="Programme title"
            value={values.title}
            onChange={(title) => update('title', title)}
            required
            maxLength={200}
            error={errorFor('title')}
            placeholder="e.g. Skilled Worker route"
          />

          <SlugField
            label="URL slug"
            value={values.slug}
            onChange={(slug) => update('slug', slug)}
            titleSource={values.title}
            error={errorFor('slug')}
            prefix="/destinations"
          />

          <TextArea
            label="Summary"
            value={values.summary}
            onChange={(summary) => update('summary', summary)}
            rows={2}
            maxLength={600}
            error={errorFor('summary')}
            hint="Shown on the destinations list. Leave empty and the card says details are to follow."
          />
        </div>
      </FormSection>

      <FormSection
        title="Important notice"
        description="Shown prominently above everything else. Use this for compliance statements, caveats, or “requirements change — verify before applying” wording."
      >
        <TextArea
          label="Notice"
          value={values.importantNoticeMd}
          onChange={(importantNoticeMd) => update('importantNoticeMd', importantNoticeMd)}
          rows={3}
          mono
          error={errorFor('importantNoticeMd')}
          hint="Leave empty to show nothing. We will not insert a disclaimer of our own."
        />
      </FormSection>

      <FormSection
        title="Description and process"
        description="Your own words about this route and how the process works. Markdown is supported."
      >
        <div className="space-y-4">
          <TextArea
            label="Description"
            value={values.descriptionMd}
            onChange={(descriptionMd) => update('descriptionMd', descriptionMd)}
            rows={8}
            mono
            error={errorFor('descriptionMd')}
          />

          <TextArea
            label="Process information"
            value={values.processingInfoMd}
            onChange={(processingInfoMd) => update('processingInfoMd', processingInfoMd)}
            rows={6}
            mono
            error={errorFor('processingInfoMd')}
            hint="Only state processing times or stages you can verify. Nothing here is pre-filled."
          />
        </div>
      </FormSection>

      <FormSection
        title="Visa categories"
        description="The specific visa routes available under this programme. Optional."
      >
        {values.visaCategories.length === 0 ? (
          <p className="mb-3 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-slate-500">
            No visa categories yet. The page will omit this section entirely.
          </p>
        ) : null}

        <ul className="space-y-2">
          {values.visaCategories.map((category, index) => (
            <RepeaterRow
              key={category.id ?? `visa-${index}`}
              index={index}
              count={values.visaCategories.length}
              onMoveUp={() => moveIn('visaCategories', index, -1)}
              onMoveDown={() => moveIn('visaCategories', index, 1)}
              onRemove={() =>
                setValues((current) => ({
                  ...current,
                  visaCategories: current.visaCategories.filter((_, i) => i !== index),
                }))
              }
              removeLabel={`Remove visa category ${index + 1}`}
            >
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <TextInput
                  label="Name"
                  value={category.name}
                  onChange={(name) => updateVisa(index, { name })}
                  required
                  error={errorFor(`visaCategories.${index}.name`)}
                />
                <TextInput
                  label="Official code"
                  value={category.code}
                  onChange={(code) => updateVisa(index, { code })}
                  error={errorFor(`visaCategories.${index}.code`)}
                  hint="Only if you know it."
                />
              </div>
              <TextArea
                label="Description"
                value={category.descriptionMd}
                onChange={(descriptionMd) => updateVisa(index, { descriptionMd })}
                rows={2}
                mono
                error={errorFor(`visaCategories.${index}.descriptionMd`)}
              />
              <Toggle
                label="Active"
                description="Inactive categories are hidden from the public page but not deleted."
                checked={category.isActive}
                onChange={(isActive) => updateVisa(index, { isActive })}
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
              visaCategories: [
                ...current.visaCategories,
                { name: '', code: '', descriptionMd: '', isActive: true },
              ],
            }))
          }
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add visa category
        </Button>
      </FormSection>

      <FormSection
        title="Immigration process and requirements"
        description="One row per bullet, grouped by category. This drives the structured sections on the destination page."
      >
        {values.requirements.length === 0 ? (
          <p className="mb-3 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-slate-500">
            Nothing entered yet. The destination page will show an honest
            &ldquo;requirements have not been published yet&rdquo; state rather than
            generic advice.
          </p>
        ) : null}

        <ul className="space-y-2">
          {values.requirements.map((requirement, index) => (
            <RepeaterRow
              key={requirement.id ?? `req-${index}`}
              index={index}
              count={values.requirements.length}
              onMoveUp={() => moveIn('requirements', index, -1)}
              onMoveDown={() => moveIn('requirements', index, 1)}
              onRemove={() =>
                setValues((current) => ({
                  ...current,
                  requirements: current.requirements.filter((_, i) => i !== index),
                }))
              }
              removeLabel={`Remove requirement ${index + 1}`}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectInput
                  label="Category"
                  value={requirement.category}
                  onChange={(category) => updateRequirement(index, { category })}
                  options={DESTINATION_REQUIREMENT_CATEGORIES.map((value) => ({
                    value,
                    label: CATEGORY_LABELS[value],
                  }))}
                />
                <TextInput
                  label="Label"
                  value={requirement.label}
                  onChange={(label) => updateRequirement(index, { label })}
                  required
                  error={errorFor(`requirements.${index}.label`)}
                />
              </div>

              <TextArea
                label="Detail"
                value={requirement.detailMd}
                onChange={(detailMd) => updateRequirement(index, { detailMd })}
                rows={2}
                mono
                error={errorFor(`requirements.${index}.detailMd`)}
              />

              {requirement.category === 'link' ? (
                <TextInput
                  label="Official link"
                  value={requirement.linkUrl}
                  onChange={(linkUrl) => updateRequirement(index, { linkUrl })}
                  error={errorFor(`requirements.${index}.linkUrl`)}
                  placeholder="https://…"
                  hint="A full https:// address, preferably the official government source."
                  required
                />
              ) : null}
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
              requirements: [
                ...current.requirements,
                { category: 'eligibility', label: '', detailMd: '', linkUrl: '' },
              ],
            }))
          }
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add entry
        </Button>
      </FormSection>

      <FormSection title="Image and visibility">
        <div className="space-y-4">
          <MediaPicker
            label="Hero image"
            purpose="destination"
            value={values.heroImageAssetId}
            onChange={(id) => update('heroImageAssetId', id)}
            hint="Optional. PNG, JPEG or WebP, up to 8 MB."
          />

          <Toggle
            label="Feature this programme"
            description="Featured programmes are highlighted on the destinations page."
            checked={values.isFeatured}
            onChange={(isFeatured) => update('isFeatured', isFeatured)}
          />

          <Toggle
            label="Published"
            description="Published programmes appear on the public website immediately."
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
        onCancel={() => router.push('/admin/content/destinations')}
        saveLabel={isNew ? 'Create programme' : 'Save changes'}
        status={
          <span className={isDirty ? 'font-medium text-amber-700' : 'text-slate-500'}>
            {isDirty ? 'Unsaved changes' : `Status: ${values.status}`}
          </span>
        }
      />
    </div>
  );
}
