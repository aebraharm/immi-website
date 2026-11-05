'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SlugField } from './slug-field';
import { MediaPicker } from './media-picker';
import {
  FormAlert,
  FormSection,
  SaveBar,
  TextArea,
  TextInput,
  Toggle,
} from './form-kit';
import type {
  FaqFormValues,
  PageFormValues,
  TeamFormValues,
  TestimonialFormValues,
} from '@/lib/cms/form-defaults';
import { useSave } from './use-save';

/**
 * Editors for the content types with no child tables.
 *
 * They share their chrome (sections, save bar, error handling) and differ only in
 * fields, so they live together rather than in four near-identical files. Each is
 * still an independent form component with its own typed value shape.
 */

function EditorShell({
  title,
  description,
  children,
  alert,
  saveBar,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  alert?: React.ReactNode;
  saveBar: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {alert}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
      {saveBar}
    </div>
  );
}

function useEditorSave(params: {
  url: string;
  isNew: boolean;
  value: unknown;
  successMessage: string;
  onCreated?: (id: string) => void;
}) {
  return useSave({
    url: params.url,
    method: params.isNew ? 'POST' : 'PUT',
    value: params.value,
    successMessage: params.successMessage,
    onSuccess: (data) => {
      if (!params.isNew) return;
      const created = data as { id?: string } | undefined;
      if (created?.id) params.onCreated?.(created.id);
    },
  });
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */



export function FaqForm({ faqId, initial }: { faqId?: string; initial: FaqFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const isNew = !faqId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useEditorSave({
    url: isNew ? '/api/admin/cms/faqs' : `/api/admin/cms/faqs/${faqId}`,
    isNew,
    value: values,
    successMessage: isNew ? 'Question added as a draft.' : 'Question saved.',
    onCreated: (id) => router.replace(`/admin/content/faqs/${id}`),
  });

  return (
    <EditorShell
      title={isNew ? 'New question' : 'Edit question'}
      description="Answers are shown on the FAQ page, grouped by category."
      alert={
        <>
          {formMessage ? (
            <FormAlert tone="error" title="The question could not be saved" messages={formMessage} onDismiss={clearMessages} />
          ) : null}
          {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}
        </>
      }
      saveBar={
        <SaveBar
          isSaving={isSaving}
          isDirty={JSON.stringify(values) !== snapshot}
          onSave={() => void save()}
          onCancel={() => router.push('/admin/content/faqs')}
          saveLabel={isNew ? 'Add question' : 'Save changes'}
        />
      }
    >
      <FormSection title="Question and answer">
        <div className="space-y-4">
          <TextInput
            label="Question"
            value={values.question}
            onChange={(question) => setValues((current) => ({ ...current, question }))}
            required
            maxLength={300}
            error={errorFor('question')}
            placeholder="e.g. How long does the process take?"
          />

          <TextArea
            label="Answer"
            value={values.answerMd}
            onChange={(answerMd) => setValues((current) => ({ ...current, answerMd }))}
            rows={8}
            mono
            error={errorFor('answerMd')}
            hint="Markdown is supported. Do not state fees, timelines or eligibility rules you cannot verify."
          />

          <TextInput
            label="Category"
            value={values.category}
            onChange={(category) => setValues((current) => ({ ...current, category }))}
            maxLength={80}
            error={errorFor('category')}
            hint="Groups related questions on the FAQ page. Leave empty to use “General”."
          />
        </div>
      </FormSection>

      <FormSection title="Publishing">
        <Toggle
          label="Published"
          description="Published questions appear on the public FAQ page immediately."
          checked={values.status === 'published'}
          onChange={(checked) =>
            setValues((current) => ({ ...current, status: checked ? 'published' : 'draft' }))
          }
        />
      </FormSection>
    </EditorShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Testimonial                                                                */
/* -------------------------------------------------------------------------- */



export function TestimonialForm({
  testimonialId,
  initial,
}: {
  testimonialId?: string;
  initial: TestimonialFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const [consentChecked, setConsentChecked] = useState(!(!testimonialId));
  const isNew = !testimonialId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useEditorSave({
    url: isNew ? '/api/admin/cms/testimonials' : `/api/admin/cms/testimonials/${testimonialId}`,
    isNew,
    value: values,
    successMessage: isNew ? 'Testimonial added as a draft.' : 'Testimonial saved.',
    onCreated: (id) => router.replace(`/admin/content/testimonials/${id}`),
  });

  return (
    <EditorShell
      title={isNew ? 'New testimonial' : 'Edit testimonial'}
      description="Only add a testimonial you have the client's permission to publish, in their own words."
      alert={
        <>
          {formMessage ? (
            <FormAlert tone="error" title="The testimonial could not be saved" messages={formMessage} onDismiss={clearMessages} />
          ) : null}
          {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}
        </>
      }
      saveBar={
        <SaveBar
          isSaving={isSaving}
          isDirty={JSON.stringify(values) !== snapshot}
          onSave={() => void save()}
          onCancel={() => router.push('/admin/content/testimonials')}
          saveLabel={isNew ? 'Add testimonial' : 'Save changes'}
        />
      }
    >
      <FormSection
        title="Consent"
        description="A testimonial is personal data. Publishing one without permission is a legal risk, not just an editorial one."
      >
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300"
          />
          <span>
            I confirm this client has given permission for their words and image to be
            published on this website.
          </span>
        </label>
      </FormSection>

      <fieldset disabled={!consentChecked} className="space-y-4 disabled:opacity-60">
        <FormSection title="Client">
          <div className="space-y-4">
            <TextInput
              label="Display name"
              value={values.clientDisplayName}
              onChange={(clientDisplayName) =>
                setValues((current) => ({ ...current, clientDisplayName }))
              }
              required
              maxLength={120}
              error={errorFor('clientDisplayName')}
              hint="Use the name the client agreed to publish — initials are fine."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Country"
                value={values.clientCountry}
                onChange={(clientCountry) =>
                  setValues((current) => ({ ...current, clientCountry }))
                }
                maxLength={80}
                error={errorFor('clientCountry')}
              />
              <TextInput
                label="Service category"
                value={values.serviceCategory}
                onChange={(serviceCategory) =>
                  setValues((current) => ({ ...current, serviceCategory }))
                }
                maxLength={120}
                error={errorFor('serviceCategory')}
                placeholder="e.g. Skilled worker"
              />
            </div>

            <TextArea
              label="Quotation"
              value={values.quote}
              onChange={(quote) => setValues((current) => ({ ...current, quote }))}
              required
              rows={5}
              maxLength={4000}
              error={errorFor('quote')}
              hint="Their words, not a paraphrase. Do not edit for effect."
            />
          </div>
        </FormSection>

        <FormSection title="Photo and video">
          <div className="space-y-5">
            <MediaPicker
              label="Client photo"
              purpose="testimonial-photo"
              value={values.photoAssetId}
              onChange={(id) => setValues((current) => ({ ...current, photoAssetId: id }))}
              hint="Optional. A neutral place-holder is shown when no photo is supplied."
            />

            <MediaPicker
              label="Uploaded video"
              purpose="testimonial-video"
              kind="video"
              value={values.videoAssetId}
              onChange={(id) => setValues((current) => ({ ...current, videoAssetId: id }))}
              hint="Optional. MP4 or WebM, up to 100 MB."
            />

            <TextInput
              label="Video link instead of an upload"
              value={values.videoUrl}
              onChange={(videoUrl) => setValues((current) => ({ ...current, videoUrl }))}
              error={errorFor('videoUrl')}
              placeholder="https://…"
              hint="Used only when no video file is uploaded. A full https:// address."
            />
          </div>
        </FormSection>

        <FormSection title="Publishing">
          <Toggle
            label="Published"
            description="Published testimonials appear on the public testimonials page immediately."
            checked={values.status === 'published'}
            onChange={(checked) =>
              setValues((current) => ({ ...current, status: checked ? 'published' : 'draft' }))
            }
          />
        </FormSection>
      </fieldset>
    </EditorShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Team member                                                                */
/* -------------------------------------------------------------------------- */



export function TeamMemberForm({
  memberId,
  initial,
}: {
  memberId?: string;
  initial: TeamFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const isNew = !memberId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useEditorSave({
    url: isNew ? '/api/admin/cms/team' : `/api/admin/cms/team/${memberId}`,
    isNew,
    value: values,
    successMessage: isNew ? 'Team member added as a draft.' : 'Team member saved.',
    onCreated: (id) => router.replace(`/admin/content/team/${id}`),
  });

  return (
    <EditorShell
      title={isNew ? 'New team member' : 'Edit team member'}
      description="Only publish qualifications and titles the person actually holds."
      alert={
        <>
          {formMessage ? (
            <FormAlert tone="error" title="The team member could not be saved" messages={formMessage} onDismiss={clearMessages} />
          ) : null}
          {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}
        </>
      }
      saveBar={
        <SaveBar
          isSaving={isSaving}
          isDirty={JSON.stringify(values) !== snapshot}
          onSave={() => void save()}
          onCancel={() => router.push('/admin/content/team')}
          saveLabel={isNew ? 'Add team member' : 'Save changes'}
        />
      }
    >
      <FormSection title="Profile">
        <div className="space-y-4">
          <TextInput
            label="Full name"
            value={values.fullName}
            onChange={(fullName) => setValues((current) => ({ ...current, fullName }))}
            required
            maxLength={160}
            error={errorFor('fullName')}
          />

          <SlugField
            label="Profile URL slug"
            value={values.slug}
            onChange={(slug) => setValues((current) => ({ ...current, slug }))}
            titleSource={values.fullName}
            error={errorFor('slug')}
            prefix="/team"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Professional title"
              value={values.professionalTitle}
              onChange={(professionalTitle) =>
                setValues((current) => ({ ...current, professionalTitle }))
              }
              maxLength={160}
              error={errorFor('professionalTitle')}
              placeholder="e.g. Registered Migration Adviser"
            />
            <TextInput
              label="Department"
              value={values.department}
              onChange={(department) => setValues((current) => ({ ...current, department }))}
              maxLength={120}
              error={errorFor('department')}
            />
          </div>

          <MediaPicker
            label="Profile photograph"
            purpose="team"
            value={values.photoAssetId}
            onChange={(id) => setValues((current) => ({ ...current, photoAssetId: id }))}
            hint="Optional. A monogram is shown when no photograph is uploaded."
          />
        </div>
      </FormSection>

      <FormSection title="Background">
        <div className="space-y-4">
          <TextArea
            label="Biography"
            value={values.bioMd}
            onChange={(bioMd) => setValues((current) => ({ ...current, bioMd }))}
            rows={8}
            mono
            error={errorFor('bioMd')}
          />

          <TextArea
            label="Qualifications"
            value={values.qualifications}
            onChange={(qualifications) =>
              setValues((current) => ({ ...current, qualifications }))
            }
            rows={3}
            error={errorFor('qualifications')}
            hint="One per line. These are published claims — only list what can be evidenced."
          />

          <TextArea
            label="Areas of expertise"
            value={values.areasOfExpertise}
            onChange={(areasOfExpertise) =>
              setValues((current) => ({ ...current, areasOfExpertise }))
            }
            rows={3}
            error={errorFor('areasOfExpertise')}
            hint="One per line."
          />
        </div>
      </FormSection>

      <FormSection title="Contact and links" description="All optional. Empty links are not rendered.">
        <div className="space-y-4">
          <TextInput
            label="Public email"
            type="email"
            value={values.emailPublic}
            onChange={(emailPublic) => setValues((current) => ({ ...current, emailPublic }))}
            error={errorFor('emailPublic')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="LinkedIn"
              value={values.socialLinkedin}
              onChange={(socialLinkedin) =>
                setValues((current) => ({ ...current, socialLinkedin }))
              }
              error={errorFor('socialLinkedin')}
              placeholder="https://…"
            />
            <TextInput
              label="X (Twitter)"
              value={values.socialX}
              onChange={(socialX) => setValues((current) => ({ ...current, socialX }))}
              error={errorFor('socialX')}
              placeholder="https://…"
            />
            <TextInput
              label="Facebook"
              value={values.socialFacebook}
              onChange={(socialFacebook) =>
                setValues((current) => ({ ...current, socialFacebook }))
              }
              error={errorFor('socialFacebook')}
              placeholder="https://…"
            />
            <TextInput
              label="Instagram"
              value={values.socialInstagram}
              onChange={(socialInstagram) =>
                setValues((current) => ({ ...current, socialInstagram }))
              }
              error={errorFor('socialInstagram')}
              placeholder="https://…"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Publishing">
        <Toggle
          label="Published"
          description="Published profiles appear on the public team page immediately."
          checked={values.status === 'published'}
          onChange={(checked) =>
            setValues((current) => ({ ...current, status: checked ? 'published' : 'draft' }))
          }
        />
      </FormSection>
    </EditorShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Website page (About / Terms / Privacy / custom)                            */
/* -------------------------------------------------------------------------- */



export function PageForm({
  pageId,
  initial,
  version,
}: {
  pageId?: string;
  initial: PageFormValues;
  version?: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const isNew = !pageId;

  const { save, isSaving, errorFor, formMessage, success, clearMessages } = useEditorSave({
    url: isNew ? '/api/admin/cms/pages' : `/api/admin/cms/pages/${pageId}`,
    isNew,
    value: values,
    successMessage: isNew ? 'Page created as a draft.' : 'Page saved.',
    onCreated: (id) => router.replace(`/admin/content/pages/${id}`),
  });

  return (
    <EditorShell
      title={isNew ? 'New page' : values.title || 'Edit page'}
      description={
        version
          ? `Published version ${version}. Publishing again creates version ${version + 1}, which is what new consent records refer to — earlier versions stay on record.`
          : 'Legal pages and long-form content.'
      }
      alert={
        <>
          {formMessage ? (
            <FormAlert tone="error" title="The page could not be saved" messages={formMessage} onDismiss={clearMessages} />
          ) : null}
          {success ? <FormAlert tone="success" title={success} onDismiss={clearMessages} /> : null}
        </>
      }
      saveBar={
        <SaveBar
          isSaving={isSaving}
          isDirty={JSON.stringify(values) !== snapshot}
          onSave={() => void save()}
          onCancel={() => router.push('/admin/content/pages')}
          saveLabel={isNew ? 'Create page' : 'Save changes'}
        />
      }
    >
      <FormSection title="Page">
        <div className="space-y-4">
          <TextInput
            label="Title"
            value={values.title}
            onChange={(title) => setValues((current) => ({ ...current, title }))}
            required
            maxLength={200}
            error={errorFor('title')}
          />

          <SlugField
            label="URL slug"
            value={values.slug}
            onChange={(slug) => setValues((current) => ({ ...current, slug }))}
            titleSource={values.title}
            error={errorFor('slug')}
            hint="Use “terms” for the Terms page and “privacy” for the Privacy Policy — the assessment form links to those exact addresses."
          />

          <TextInput
            label="Subtitle"
            value={values.subtitle}
            onChange={(subtitle) => setValues((current) => ({ ...current, subtitle }))}
            maxLength={400}
            error={errorFor('subtitle')}
          />

          <TextInput
            label="Last reviewed on"
            type="date"
            value={values.lastReviewedOn}
            onChange={(lastReviewedOn) =>
              setValues((current) => ({ ...current, lastReviewedOn }))
            }
            error={errorFor('lastReviewedOn')}
            hint="Shown publicly as a date. Leave empty to hide it rather than guess."
          />
        </div>
      </FormSection>

      <FormSection
        title="Content"
        description="Markdown. For legal pages, use ## headings for each clause."
      >
        <TextArea
          label="Page content"
          value={values.contentMd}
          onChange={(contentMd) => setValues((current) => ({ ...current, contentMd }))}
          rows={20}
          mono
          error={errorFor('contentMd')}
        />
      </FormSection>

      <FormSection title="Publishing">
        <Toggle
          label="Published"
          description="The assessment form requires both Terms and Privacy to be published before it can accept a submission."
          checked={values.status === 'published'}
          onChange={(checked) =>
            setValues((current) => ({ ...current, status: checked ? 'published' : 'draft' }))
          }
        />
      </FormSection>
    </EditorShell>
  );
}
