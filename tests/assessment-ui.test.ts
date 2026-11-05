/**
 * Phase 5 verification — the form's behaviour and content rules.
 *
 * **What this file can and cannot do.** Browser automation is unavailable in this
 * environment (no Chromium binary, and the Playwright download host is blocked),
 * so nothing here claims to have clicked a button. These tests read the shipped
 * component source and the shipped step definitions, and assert the properties
 * that a requirements review actually depends on:
 *
 *  - the steps exist, in order, with the right fields;
 *  - conditional fields render on the right condition;
 *  - consent is never pre-selected;
 *  - nothing is persisted to browser storage;
 *  - the required accessibility and responsive affordances are present;
 *  - no claim of guaranteed eligibility, employment or a visa appears anywhere.
 *
 * Rendered-DOM and cross-browser checks are listed as known limitations in
 * `docs/PHASE-5-REPORT.md` and must be repeated manually before launch.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { STEPS, emptyDraft } from '../src/lib/assessment/draft';
import { PRIMARY_CTA_LABEL } from '../src/lib/config/site';

const WIZARD = readFileSync('src/components/assessment/wizard.tsx', 'utf8');
const STEPS_FILE = readFileSync('src/components/assessment/steps.tsx', 'utf8');
const CONTROLS = readFileSync('src/components/assessment/controls.tsx', 'utf8');
const PAGE = readFileSync('src/app/(site)/assessment/page.tsx', 'utf8');
const ROUTE = readFileSync('src/app/api/assessment/route.ts', 'utf8');

/** Strip comments so a rule is not "satisfied" by prose. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const WIZARD_CODE = code(WIZARD);
const STEPS_CODE = code(STEPS_FILE);
const PAGE_CODE = code(PAGE);

/* -------------------------------------------------------------------------- */
/* 1. Step structure                                                          */
/* -------------------------------------------------------------------------- */

describe('step structure', () => {
  it('has the eleven steps the specification asks for, in a deliberate order', () => {
    assert.deepEqual(
      STEPS.map((step) => step.id),
      [
        'personal',
        'passport',
        'education',
        'employment',
        'previous-employment',
        'skills',
        'languages',
        'preferences',
        'additional',
        'cv',
        'review',
      ],
    );
  });

  it('gives every step a label, a heading and a description', () => {
    for (const step of STEPS) {
      assert.ok(step.label.length > 0, `${step.id} has no label`);
      assert.ok(step.title.length > 0, `${step.id} has no title`);
      assert.ok(step.description.length > 0, `${step.id} has no description`);
    }
  });

  it('starts on a blank draft with no pre-selected answers', () => {
    const draft = emptyDraft();

    assert.equal(draft.personal.gender, '');
    assert.equal(draft.personal.nationality, '');
    assert.equal(draft.passport.hasPassport, '');
    assert.equal(draft.employment.status, '');
    assert.equal(draft.skills.length, 0);
    assert.deepEqual(draft.languages, { english: '', french: '', spanish: '', german: '' });
    assert.equal(draft.consent.acceptedTerms, false);
    assert.equal(draft.consent.acceptedPrivacy, false);
    assert.equal(draft.honey, '');
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Progress, navigation and state                                          */
/* -------------------------------------------------------------------------- */

describe('progress and navigation', () => {
  it('shows a step counter and an accessible progress bar', () => {
    assert.match(WIZARD_CODE, /Step \{stepIndex \+ 1\} of \{STEPS\.length\}/);
    assert.match(WIZARD_CODE, /role="progressbar"/);
    assert.match(WIZARD_CODE, /aria-valuenow=\{progress\}/);
    assert.match(WIZARD_CODE, /aria-valuemin=\{0\}/);
    assert.match(WIZARD_CODE, /aria-valuemax=\{100\}/);
  });

  it('has Back and Next controls, with Back disabled on the first step', () => {
    assert.match(WIZARD_CODE, />\s*Back\s*</);
    assert.match(WIZARD_CODE, /isReview \? 'Submit assessment' : 'Next'/);
    assert.match(WIZARD_CODE, /disabled=\{stepIndex === 0\}/);
  });

  it('cannot skip ahead to an unanswered step', () => {
    // Only steps at or before the current index are reachable from the rail.
    assert.match(WIZARD_CODE, /disabled=\{index > stepIndex\}/);
    assert.match(WIZARD_CODE, /onClick=\{\(\) => index <= stepIndex && goTo\(index\)\}/);
  });

  it('holds all answers in one draft above the steps, so state survives navigation', () => {
    // The draft lives in the wizard, not in the step components.
    assert.match(WIZARD_CODE, /useState<AssessmentDraft>\(\(\) => emptyDraft\(\)\)/);
    // A step receives the draft and a single updater; it never owns state.
    for (const stepComponent of [
      'PersonalStep',
      'PassportStep',
      'EducationStep',
      'EmploymentStep',
      'PreviousEmploymentStep',
      'SkillsStep',
      'LanguagesStep',
      'AdditionalStep',
    ]) {
      assert.match(
        STEPS_CODE,
        new RegExp(`function ${stepComponent}\\(\\{ draft, errors, update \\}`),
        `${stepComponent} should be a controlled view over the shared draft`,
      );
    }

    // The preferences step additionally receives the published destinations, so
    // its signature carries one extra prop — still a controlled view.
    assert.match(STEPS_CODE, /function PreferencesStep\(\{\s*draft,\s*errors,\s*update,\s*destinations,/);
  });

  it('never writes applicant answers to browser storage', () => {
    for (const source of [WIZARD_CODE, STEPS_CODE, CONTROLS]) {
      assert.ok(!/localStorage/.test(source), 'applicant data must not be persisted in the browser');
      assert.ok(!/sessionStorage/.test(source), 'applicant data must not be persisted in the browser');
      assert.ok(!/document\.cookie/.test(source), 'applicant data must not be written to a cookie');
    }
  });

  it('validates a step before allowing Next', () => {
    assert.match(WIZARD_CODE, /const stepErrors = validateStep\(step\.id, draft\);/);
    assert.match(WIZARD_CODE, /if \(Object\.keys\(stepErrors\)\.length > 0\)/);
  });

  it('validates the whole form before submitting and jumps to the first bad step', () => {
    assert.match(WIZARD_CODE, /for \(const definition of STEPS\)/);
    assert.match(WIZARD_CODE, /const targetStep = firstKey === 'cv' \? 'cv' : stepForField\(firstKey\)/);
  });

  it('moves focus to the step heading when the step changes', () => {
    assert.match(WIZARD_CODE, /getElementById\('assessment-step-heading'\)\?\.focus\(\)/);
    assert.match(WIZARD_CODE, /id="assessment-step-heading"[\s\S]{0,80}tabIndex=\{-1\}/);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Fields and conditional behaviour                                        */
/* -------------------------------------------------------------------------- */

describe('fields', () => {
  it('asks for every personal detail the specification lists', () => {
    for (const label of [
      'Full name',
      'Date of birth',
      'Gender',
      'Nationality',
      'Country of residence',
      'Residential address',
      'City',
      'State / province',
      'Postal code',
      'Mobile number',
      'Alternative number',
      'Email address',
      'Marital status',
      'Do you have children?',
    ]) {
      assert.ok(STEPS_CODE.includes(label), `the personal step is missing "${label}"`);
    }
  });

  it('shows passport details only when a passport is held', () => {
    assert.match(STEPS_CODE, /\{passport\.hasPassport === 'yes' \? \(/);
    assert.match(STEPS_CODE, /label="Passport number"/);
    assert.match(STEPS_CODE, /label="Expiry date"/);
  });

  it('clears passport details when the answer becomes No', () => {
    assert.match(STEPS_CODE, /if \(value === 'no'\)[\s\S]{0,300}passportNumber: ''/);
  });

  it('renders the children count only when the answer is Yes', () => {
    assert.match(STEPS_CODE, /\{personal\.hasChildren === 'yes' \? \(/);
    assert.match(STEPS_CODE, /How many children\?/);
  });

  it('allows repeatable education entries with add and remove controls', () => {
    assert.match(STEPS_CODE, /Add another qualification/);
    assert.match(STEPS_CODE, /RemoveRowButton/);
    assert.match(STEPS_CODE, /education: \[\.\.\.current\.education, \{ \.\.\.EMPTY_EDUCATION \}\]/);
  });

  it('allows repeatable previous employment and an explicit unemployment state', () => {
    assert.match(STEPS_CODE, /Add a previous role/);
    assert.match(STEPS_CODE, /Not currently employed/);
    assert.match(STEPS_CODE, /does not disqualify you/);
  });

  it('offers all twenty skills and all four languages with four proficiency levels', () => {
    assert.match(STEPS_CODE, /SKILL_CHOICES\.map/);
    assert.match(STEPS_CODE, /LANGUAGE_CHOICES\.map/);
    assert.match(STEPS_CODE, /PROFICIENCY_CHOICES\.map/);
  });

  it('shows a conditional detail box for each yes/no question on the additional step', () => {
    assert.match(STEPS_CODE, /\{answer === 'yes' \? \(/);
    // All five questions are declared once, as data, and rendered from that list.
    for (const key of [
      'hasMedicalCondition',
      'hasCriminalRecord',
      'hasTravelledAbroad',
      'hasFamilyAbroad',
      'hasProfessionalExams',
    ]) {
      assert.ok(STEPS_CODE.includes(`answerKey: '${key}'`), `missing the ${key} question`);
    }
  });

  it('shows a review page with a change control per section', () => {
    assert.match(STEPS_CODE, /export function ReviewStep/);
    assert.match(STEPS_CODE, /onClick=\{\(\) => onEdit\(stepId\)\}/);
    for (const section of [
      'Personal information',
      'Passport',
      'Education',
      'Employment',
      'Previous employment',
      'Skills',
      'Languages',
      'Employment preferences',
      'Additional information',
    ]) {
      assert.ok(STEPS_CODE.includes(`title="${section}"`), `review page is missing ${section}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Consent                                                                 */
/* -------------------------------------------------------------------------- */

describe('consent', () => {
  it('renders two unchecked checkboxes with no default', () => {
    assert.match(WIZARD_CODE, /acceptedTerms=\{draft\.consent\.acceptedTerms\}/);
    assert.match(WIZARD_CODE, /acceptedPrivacy=\{draft\.consent\.acceptedPrivacy\}/);
    assert.ok(!/defaultChecked/.test(WIZARD_CODE), 'a consent box must never be pre-ticked');
    assert.ok(!/checked=\{true\}/.test(WIZARD_CODE));
  });

  it('links to both policies so they can be read before accepting', () => {
    assert.match(WIZARD_CODE, /href="\/terms"/);
    assert.match(WIZARD_CODE, /href="\/privacy"/);
    assert.match(WIZARD_CODE, /opens in a new tab/);
  });

  it('states that nothing is recorded until submission', () => {
    assert.match(WIZARD_CODE, /Nothing is saved to our[\s\S]{0,60}systems until/);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Submission experience                                                   */
/* -------------------------------------------------------------------------- */

describe('submission experience', () => {
  it('posts to the public endpoint with an idempotency key', () => {
    assert.match(WIZARD_CODE, /fetch\('\/api\/assessment'/);
    assert.match(WIZARD_CODE, /'x-idempotency-key': idempotencyKey\.current/);
    assert.match(WIZARD_CODE, /crypto\.randomUUID\(\)/);
  });

  it('shows a loading state while submitting', () => {
    assert.match(WIZARD_CODE, /Submitting your assessment/);
    assert.match(WIZARD_CODE, /role="status"/);
    assert.match(WIZARD_CODE, /aria-live="polite"/);
  });

  it('shows the reference number and says what happens next', () => {
    assert.match(WIZARD_CODE, /Your assessment has been received/);
    assert.match(WIZARD_CODE, /receipt\.referenceNumber/);
    assert.match(WIZARD_CODE, /What happens next/);
    assert.match(WIZARD_CODE, /Our team reviews the information and CV you submitted/);
  });

  it('states that submission does not mean eligibility', () => {
    assert.match(WIZARD_CODE, /does not mean you are eligible for any visa/);
    assert.match(WIZARD_CODE, /does not[\s\S]{0,40}guarantee a visa, a job or an interview/);
  });

  it('reports submission failures in plain language and keeps the answers', () => {
    assert.match(WIZARD_CODE, /We could not reach the server/);
    assert.match(WIZARD_CODE, /nothing you entered has been lost/);
    // On failure the wizard returns to the form rather than losing the draft.
    assert.match(WIZARD_CODE, /setPhase\('form'\)/);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Branding, accessibility and responsiveness                             */
/* -------------------------------------------------------------------------- */

describe('branding and layout', () => {
  it('shows the agency logo on the form and on the confirmation', () => {
    const occurrences = WIZARD_CODE.match(/<Logo identity=\{identity\}/g) ?? [];
    assert.ok(occurrences.length >= 2, 'the logo must appear on the form and the confirmation');
  });

  it('keeps the mandated call-to-action wording', () => {
    assert.equal(PRIMARY_CTA_LABEL, 'Book a Consultation Now');
    assert.match(PAGE_CODE, /PRIMARY_CTA_LABEL/);
  });

  it('uses responsive layouts rather than a fixed-width form', () => {
    assert.match(WIZARD_CODE, /lg:grid-cols-\[minmax\(0,17rem\)_minmax\(0,1fr\)\]/);
    assert.match(STEPS_CODE, /sm:grid-cols-2/);
    assert.match(STEPS_CODE, /lg:grid-cols-3/);
    assert.match(WIZARD_CODE, /sm:flex-row/);
  });

  it('labels every control and marks invalid ones', () => {
    // `Field` owns the label/error wiring; every text input uses it.
    assert.match(CONTROLS, /<Field label=\{label\} error=\{error\} hint=\{hint\} required=\{required\}/);
    assert.match(CONTROLS, /aria-invalid=\{ids\.invalid \|\| undefined\}/);
    assert.match(CONTROLS, /aria-describedby=\{ids\.describedBy\}/);
    // Errors are announced.
    assert.match(CONTROLS, /role="alert"/);
  });

  it('pairs colour with text in the yes/no control', () => {
    // The selected state is not conveyed by colour alone: a filled dot plus the
    // word "Yes"/"No" is always present.
    assert.match(CONTROLS, /yesLabel = 'Yes'/);
    assert.match(CONTROLS, /noLabel = 'No'/);
  });

  it('carries an anti-automation field that is hidden from real visitors', () => {
    assert.match(WIZARD_CODE, /assessment-honey/);
    assert.match(WIZARD_CODE, /left-\[-9999px\]/);
    assert.match(WIZARD_CODE, /tabIndex=\{-1\}/);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Page gates                                                              */
/* -------------------------------------------------------------------------- */

describe('page gates', () => {
  it('refuses to open the form until both policies are published', () => {
    assert.match(PAGE_CODE, /const legalReady = Boolean\(terms && privacy\)/);
    assert.match(PAGE_CODE, /legalReady && destinationsReady \?/);
    assert.match(PAGE_CODE, /The assessment form is not open yet/);
  });

  it('needs at least one published destination', () => {
    assert.match(PAGE_CODE, /const destinationsReady = destinations\.length > 0/);
  });

  it('repeats the eligibility disclaimer on the page, not only on the receipt', () => {
    assert.match(PAGE_CODE, /does not mean you are eligible for any visa/);
    assert.match(PAGE_CODE, /does not guarantee a[\s\S]{0,40}visa, a job or an interview/);
  });

  it('makes no claim about guaranteed outcomes anywhere in the flow', () => {
    for (const source of [PAGE_CODE, WIZARD_CODE, STEPS_CODE]) {
      for (const phrase of [
        'guaranteed visa',
        'guaranteed job',
        'guaranteed approval',
        'we guarantee',
        'you will be approved',
        'eligible for a visa now',
      ]) {
        assert.ok(
          !source.toLowerCase().includes(phrase),
          `the form contains a guarantee claim: "${phrase}"`,
        );
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Route behaviour                                                         */
/* -------------------------------------------------------------------------- */

describe('public route', () => {
  it('is dynamic and has no store', () => {
    assert.match(ROUTE, /export const dynamic = 'force-dynamic'/);
    assert.match(ROUTE, /no-store, max-age=0/);
  });

  it('accepts only multipart bodies and never a session', () => {
    assert.match(ROUTE, /multipart\/form-data/);
    assert.ok(!/requireAdmin|cookies\(|SESSION_COOKIE/.test(code(ROUTE)));
  });

  it('has no GET handler that could read a submission back', () => {
    const getHandler = ROUTE.match(/export function GET[\s\S]{0,200}/)?.[0] ?? '';
    assert.match(getHandler, /method_not_allowed/);
  });
});
