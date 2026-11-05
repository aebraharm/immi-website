'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { Button, buttonStyles } from '@/components/ui/button';
import { Logo } from '@/components/site/logo';
import { emptyDraft, STEPS, type AssessmentDraft } from '@/lib/assessment/draft';
import {
  CONSENT_TEXT,
  stepForField,
  validateStep,
  type FieldErrors,
} from '@/lib/assessment/schema';
import type { SiteIdentity } from '@/db/queries/types';
import { cn } from '@/lib/utils/cn';

import {
  AdditionalStep,
  CvStep,
  EducationStep,
  EmploymentStep,
  LanguagesStep,
  PassportStep,
  PersonalStep,
  PreferencesStep,
  PreviousEmploymentStep,
  ReviewStep,
  SkillsStep,
  type StepProps,
} from './steps';

/**
 * The assessment wizard.
 *
 * Three decisions shape this component:
 *
 *  1. **One draft object, held above the steps.** "State is preserved when moving
 *     between steps" is not a feature that can be bolted on — it falls out of the
 *     steps being controlled views over one object rather than eleven independent
 *     forms. Nothing is written to `localStorage`: applicant answers include date
 *     of birth, address and medical details, and a browser-stored copy would
 *     outlive the visit on a shared device. A reload starts clean, and the
 *     confirmation page is the only thing carried forward.
 *  2. **Next validates the current step only.** A visitor is never blocked by a
 *     question four screens ahead; the final submit re-validates everything, and
 *     if something earlier is wrong the wizard jumps to that step and says so.
 *  3. **The submit button cannot be reached by an invalid form.** Consent is a
 *     real gate: unchecked, both boxes are required, and the server checks them
 *     again.
 */

type Phase = 'form' | 'submitting' | 'done';

type Receipt = {
  referenceNumber: string;
  submittedAt: string;
};

export type Destination = { id: string; name: string };

export function AssessmentWizard({
  identity,
  destinations,
}: {
  identity: SiteIdentity;
  destinations: Destination[];
}) {
  const [draft, setDraft] = useState<AssessmentDraft>(() => emptyDraft());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  /**
   * The idempotency key is created once per browser session and reused for every
   * attempt. That is what makes a retry after a dropped connection return the
   * *same* reference instead of creating a duplicate application.
   */
  const idempotencyKey = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const step = STEPS[stepIndex]!;
  const isReview = step.id === 'review';
  const prefersReducedMotion = useReducedMotion();

  const update = useCallback(
    (patch: (current: AssessmentDraft) => AssessmentDraft) => setDraft((current) => patch(current)),
    [],
  );

  /** Clear a step's own errors as soon as the visitor acts again. */
  const clearErrorsFor = useCallback((stepId: string) => {
    setErrors((current) => {
      const next: FieldErrors = {};
      for (const [key, value] of Object.entries(current)) {
        if (stepForField(key) !== stepId) next[key] = value;
      }
      return next;
    });
    setStepError(null);
  }, []);

  const goTo = useCallback((index: number) => {
    setStepIndex(index);
    setStepError(null);
    // Move focus to the step heading so keyboard and screen-reader users land in
    // the right place rather than at the top of the document.
    requestAnimationFrame(() => {
      document.getElementById('assessment-step-heading')?.focus();
    });
  }, []);

  const handleNext = () => {
    const stepErrors = validateStep(step.id, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((current) => ({ ...current, ...stepErrors }));
      setStepError('Please correct the highlighted answers before continuing.');
      return;
    }
    // The CV step is validated by the server against the actual bytes; here we
    // only insist that a file was chosen, since a filename proves nothing.
    if (step.id === 'cv' && !cvFile) {
      setErrors((current) => ({ ...current, cv: 'Attach your CV to continue.' }));
      setStepError('Attach your CV to continue.');
      return;
    }
    setStepError(null);
    goTo(Math.min(stepIndex + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepError(null);
    goTo(stepIndex - 1);
  };

  const handleSubmit = async () => {
    // 1. Whole-form validation, client side, so the visitor is not sent on a
    //    round trip to be told about a typo on step 3.
    const allErrors: FieldErrors = {};
    for (const definition of STEPS) {
      Object.assign(allErrors, validateStep(definition.id, draft));
    }
    if (!cvFile) allErrors.cv = 'Attach your CV before submitting.';

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstKey = Object.keys(allErrors)[0]!;
      const targetStep = firstKey === 'cv' ? 'cv' : stepForField(firstKey);
      const targetIndex = STEPS.findIndex((definition) => definition.id === targetStep);
      setStepError(
        'Some answers need attention. We have taken you to the first one — please check each highlighted field.',
      );
      if (targetIndex >= 0) goTo(targetIndex);
      return;
    }

    setPhase('submitting');
    setErrors({});
    setStepError(null);

    try {
      const body = new FormData();
      body.set('payload', JSON.stringify(draft));
      if (cvFile) body.set('cv', cvFile, cvFile.name);

      const response = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'x-idempotency-key': idempotencyKey.current },
        body,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            referenceNumber?: string;
            submittedAt?: string;
            message?: string;
            fieldErrors?: FieldErrors;
          }
        | null;

      if (response.ok && result?.referenceNumber) {
        setReceipt({
          referenceNumber: result.referenceNumber,
          submittedAt: result.submittedAt ?? new Date().toISOString(),
        });
        setPhase('done');
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }

      // 2. A failure is shown as a message on the form, never as a raw error.
      setPhase('form');

      const serverErrors = result?.fieldErrors ?? {};
      if (Object.keys(serverErrors).length > 0) {
        setErrors(serverErrors);
        const firstKey = Object.keys(serverErrors)[0]!;
        const targetStep = firstKey === 'cv' ? 'cv' : stepForField(firstKey);
        const targetIndex = STEPS.findIndex((definition) => definition.id === targetStep);
        if (targetIndex >= 0) goTo(targetIndex);
      }

      setStepError(
        result?.message ??
          'We could not submit your assessment. Please check your connection and try again.',
      );
    } catch {
      setPhase('form');
      setStepError(
        'We could not reach the server. Check your internet connection and try again — nothing you entered has been lost.',
      );
    }
  };

  const stepProps: StepProps = { draft, errors, update };

  /* ---------------------------------------------------------------------- */
  /* Loading / confirmation                                                */
  /* ---------------------------------------------------------------------- */

  if (phase === 'submitting') {
    return (
      <SubmittingPanel
        reducedMotion={Boolean(prefersReducedMotion)}
        onRetryHint={() => setPhase('form')}
      />
    );
  }

  if (phase === 'done' && receipt) {
    return <ConfirmationPanel receipt={receipt} identity={identity} />;
  }

  /* ---------------------------------------------------------------------- */
  /* Form                                                                  */
  /* ---------------------------------------------------------------------- */

  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
      {/* Progress rail */}
      <nav aria-label="Assessment progress" className="lg:sticky lg:top-24">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 shadow-e1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <p className="text-xs font-semibold text-accent-800">{progress}%</p>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Assessment completion"
            className="h-1.5 overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-[var(--brand-primary)] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ol className="mt-4 hidden gap-1 lg:grid">
            {STEPS.map((definition, index) => {
              const state =
                index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'upcoming';

              return (
                <li key={definition.id}>
                  <button
                    type="button"
                    // Only steps already visited can be reopened, so a visitor
                    // cannot skip ahead past an unanswered step.
                    disabled={index > stepIndex}
                    aria-current={state === 'current' ? 'step' : undefined}
                    onClick={() => index <= stepIndex && goTo(index)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      state === 'current' && 'bg-accent-50 font-semibold text-accent-900',
                      state === 'done' && 'text-slate-600 hover:bg-slate-50',
                      state === 'upcoming' && 'text-slate-600',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold',
                        state === 'current' && 'bg-accent-600 text-white',
                        state === 'done' && 'bg-emerald-100 text-emerald-700',
                        state === 'upcoming' && 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                    </span>
                    {definition.label}
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 text-[0.6875rem] leading-relaxed text-slate-500">
            Your answers stay in this browser until you submit. Nothing is saved to our systems until
            then.
          </p>
        </div>
      </nav>

      {/* Step body */}
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-800">
              {step.label}
            </p>
            <h2
              id="assessment-step-heading"
              tabIndex={-1}
              className="mt-1 text-2xl font-semibold tracking-tight text-ink outline-none"
            >
              {step.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.description}</p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <Logo identity={identity} size="sm" href={null} showWordmark />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (isReview) void handleSubmit();
                else handleNext();
              }}
              onFocusCapture={() => clearErrorsFor(step.id)}
            >
              {stepError ? (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{stepError}</span>
                </div>
              ) : null}

              {step.id === 'personal' ? <PersonalStep {...stepProps} /> : null}
              {step.id === 'passport' ? <PassportStep {...stepProps} /> : null}
              {step.id === 'education' ? <EducationStep {...stepProps} /> : null}
              {step.id === 'employment' ? <EmploymentStep {...stepProps} /> : null}
              {step.id === 'previous-employment' ? <PreviousEmploymentStep {...stepProps} /> : null}
              {step.id === 'skills' ? <SkillsStep {...stepProps} /> : null}
              {step.id === 'languages' ? <LanguagesStep {...stepProps} /> : null}
              {step.id === 'preferences' ? (
                <PreferencesStep {...stepProps} destinations={destinations} />
              ) : null}
              {step.id === 'additional' ? <AdditionalStep {...stepProps} /> : null}
              {step.id === 'cv' ? (
                <CvStep
                  file={cvFile}
                  error={errors.cv}
                  onSelect={(file) => {
                    setCvFile(file);
                    clearErrorsFor('cv');
                  }}
                  onClear={() => setCvFile(null)}
                />
              ) : null}
              {step.id === 'review' ? (
                <>
                  <ReviewStep
                    draft={draft}
                    cvFilename={cvFile?.name ?? null}
                    onEdit={(stepId) => {
                      const index = STEPS.findIndex((definition) => definition.id === stepId);
                      if (index >= 0) goTo(index);
                    }}
                  />
                  <ConsentBlock
                    acceptedTerms={draft.consent.acceptedTerms}
                    acceptedPrivacy={draft.consent.acceptedPrivacy}
                    onChange={(key, value) =>
                      update((current) => ({
                        ...current,
                        consent: { ...current.consent, [key]: value },
                      }))
                    }
                    errors={errors}
                  />
                </>
              ) : null}

              {/* Hidden anti-automation field. Real visitors never see or fill it. */}
              <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="assessment-honey">Leave this field empty</label>
                <input
                  id="assessment-honey"
                  name="honey"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={draft.honey}
                  onChange={(event) =>
                    update((current) => ({ ...current, honey: event.target.value }))
                  }
                />
              </div>

              {/* Navigation */}
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={stepIndex === 0}
                  className="sm:w-auto"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Back
                </Button>

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <p className="text-center text-[0.6875rem] text-slate-500 sm:mr-2 sm:text-right">
                    {isReview ? 'Check your answers, then submit.' : 'You can go back at any time.'}
                  </p>
                  <Button type="submit" size="lg">
                    {isReview ? 'Submit assessment' : 'Next'}
                    {isReview ? null : <ArrowRight aria-hidden="true" className="size-4" />}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Consent                                                                    */
/* -------------------------------------------------------------------------- */

function ConsentBlock({
  acceptedTerms,
  acceptedPrivacy,
  onChange,
  errors,
}: {
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  onChange: (key: 'acceptedTerms' | 'acceptedPrivacy', value: boolean) => void;
  errors: FieldErrors;
}) {
  return (
    <section className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600" />
        Before you submit
      </h3>

      <div className="mt-3 space-y-3">
        <ConsentCheckbox
          checked={acceptedTerms}
          onChange={(value) => onChange('acceptedTerms', value)}
          error={errors['consent.acceptedTerms']}
          label={
            <>
              {CONSENT_TEXT.terms}{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent-800 underline decoration-accent-300 underline-offset-2"
              >
                Read the Terms (opens in a new tab)
              </a>
            </>
          }
        />
        <ConsentCheckbox
          checked={acceptedPrivacy}
          onChange={(value) => onChange('acceptedPrivacy', value)}
          error={errors['consent.acceptedPrivacy']}
          label={
            <>
              {CONSENT_TEXT.privacy}{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent-800 underline decoration-accent-300 underline-offset-2"
              >
                Read the Privacy Policy (opens in a new tab)
              </a>
            </>
          }
        />
      </div>

      <p className="mt-3 text-[0.6875rem] leading-relaxed text-slate-500">
        Neither box is ticked for you. Submitting records the exact wording above, the version of each
        policy you accepted, and the time you accepted it.
      </p>
    </section>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  label,
  error,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error) || undefined}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[var(--brand-primary)]"
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p role="alert" className="ml-6.5 mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Submitting                                                                 */
/* -------------------------------------------------------------------------- */

function SubmittingPanel({
  reducedMotion,
  onRetryHint,
}: {
  reducedMotion: boolean;
  onRetryHint: () => void;
}) {
  const [slow, setSlow] = useState(false);

  // If the request takes unusually long, say so rather than leaving a spinner
  // spinning with no explanation.
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center"
    >
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
        className="grid size-16 place-items-center rounded-full bg-accent-50"
      >
        <Loader2 aria-hidden="true" className="size-7 animate-spin text-accent-700" />
      </motion.div>

      <h2 className="mt-6 text-xl font-semibold text-ink">Submitting your assessment</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        We are validating your answers, storing your CV privately and generating your reference
        number. Please do not close this page.
      </p>

      <p className="mt-4 text-[0.6875rem] text-slate-500">
        Your reference number appears as soon as the submission completes.
      </p>

      {slow ? (
        <button
          type="button"
          onClick={onRetryHint}
          className="mt-6 text-xs font-medium text-accent-800 underline underline-offset-2"
        >
          This is taking longer than usual — go back to the form
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmation                                                               */
/* -------------------------------------------------------------------------- */

function ConfirmationPanel({
  receipt,
  identity,
}: {
  receipt: Receipt;
  identity: SiteIdentity;
}) {
  const submitted = new Date(receipt.submittedAt);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6 shadow-e2 sm:p-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700"
          >
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Your assessment has been received
            </h2>
            <p className="text-xs text-slate-500">Submitted {submitted.toLocaleString('en-GB')}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-800">
            Your reference number
          </p>
          <p className="mt-1 select-all font-mono text-lg font-semibold tracking-wider text-accent-900">
            {receipt.referenceNumber}
          </p>
          <p className="mt-1 text-xs text-accent-900/80">
            Keep this number. Quote it whenever you contact us about this assessment.
          </p>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-ink">What happens next</h3>
        <ol className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
          <li className="flex gap-2">
            <span aria-hidden="true" className="font-mono text-xs text-slate-600">
              01
            </span>
            Our team reviews the information and CV you submitted.
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="font-mono text-xs text-slate-600">
              02
            </span>
            An adviser contacts you at the email address or phone number you gave, to discuss your
            options and any next steps.
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="font-mono text-xs text-slate-600">
              03
            </span>
            If we need more information or documents, we will ask you for them directly.
          </li>
        </ol>

        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <p className="font-semibold">Please note</p>
          <p className="mt-1">
            Submitting this assessment does not mean you are eligible for any visa, and does not
            guarantee a visa, a job or an interview. Any assessment of eligibility, employment or visa
            outcome will be discussed with you by our team based on your individual circumstances.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo identity={identity} size="sm" href={null} showWordmark />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/contact" className={buttonStyles('outline', 'sm')}>
              Contact the agency
            </Link>
            <Link href="/" className={buttonStyles('ghost', 'sm')}>
              Back to the homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
