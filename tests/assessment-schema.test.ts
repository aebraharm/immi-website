/**
 * Phase 5 — assessment form validation.
 *
 * These tests exercise the *shipped* schemas, not copies of them: the same
 * `validateStep` and `assessmentSchema` that the browser and the API route call.
 * Every assertion below is therefore a statement about what the server will
 * accept, not about what the UI happens to allow.
 *
 * The mandated verifications, mapped to test names:
 *
 *   1. personal step + required fields ............. "personal: empty step …"
 *   2. passport conditional display ................ "passport: details rejected …"
 *   3. repeatable education ........................ "education: repeatable …"
 *   4. employment, including unemployment .......... "employment: unemployed …"
 *   5. skills and languages ........................ "skills: …", "languages: …"
 *   6. consent enforcement ......................... "consent: both policies …"
 *   7. countries and nationalities ................. "personal: unknown country …"
 *   8. error messages are human .................... "no step reports Zod's raw …"
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ISO_COUNTRIES } from '../src/lib/data/countries-iso';
import { SKILLS } from '../src/db/schema/enums';
import { emptyDraft, STEPS } from '../src/lib/assessment/draft';
import {
  assessmentSchema,
  stepForField,
  validateStep,
  type FieldErrors,
} from '../src/lib/assessment/schema';
import { generateReferenceNumber, isValidReferenceNumber } from '../src/lib/assessment/reference-number';
import { splitCountries } from '../src/lib/assessment/transforms';

/** A complete, valid draft. Individual tests break one thing at a time. */
function validDraft() {
  const draft = emptyDraft();
  return {
    ...draft,
    personal: {
      ...draft.personal,
      fullName: 'Ada Nneka Obi',
      dateOfBirth: '1990-05-01',
      gender: 'female',
      nationality: 'NG',
      countryOfResidence: 'NG',
      residentialAddress: '1 Marina Road',
      city: 'Warri',
      stateProvince: 'Delta',
      postalCode: '332211',
      mobileCountryCode: '+234',
      mobileNumber: '8031234567',
      email: 'ada@example.com',
      maritalStatus: 'married',
      hasChildren: 'yes',
      numberOfChildren: '2',
    },
    passport: {
      hasPassport: 'yes',
      passportNumber: 'A01234567',
      passportCityOfIssue: 'Abuja',
      passportIssueDate: '2020-01-10',
      passportExpiryDate: '2030-01-09',
    },
    education: [
      {
        qualificationLevel: 'bachelor',
        institutionName: 'University of Lagos',
        country: 'NG',
        yearCompleted: '2012',
      },
    ],
    employment: {
      status: 'employed',
      currentEmployer: 'Lagos General Hospital',
      currentPosition: 'Nurse',
      currentCountry: 'NG',
      currentStartDate: '2019-04',
      currentSalaryAmount: '350000',
      currentSalaryCurrency: 'NGN',
    },
    previousEmployment: [
      { employerName: 'Reddington Hospital', position: 'Staff Nurse', country: 'NG', yearsWorked: '3' },
    ],
    skills: ['healthcare_nursing'],
    languages: { english: 'fluent', french: '', spanish: '', german: '' },
    preferences: {
      preferredCountryId: '',
      preferredOccupation: 'Registered nurse',
      expectedSalaryAmount: '4200',
      expectedSalaryCurrency: 'CAD',
    },
    additional: {
      hasMedicalCondition: 'no',
      medicalDetails: '',
      hasCriminalRecord: 'no',
      criminalRecordDetails: '',
      hasTravelledAbroad: 'yes',
      travelledCountries: 'Ghana, United Kingdom',
      hasFamilyAbroad: 'no',
      familyAbroadCountries: '',
      hasProfessionalExams: 'yes',
      professionalExamsNotes: 'NCLEX-RN, passed 2023',
    },
    consent: { acceptedTerms: true, acceptedPrivacy: true },
  };
}

/** Every message a step produces, as a single string, for vocabulary checks. */
function allMessages(errors: FieldErrors): string {
  return Object.values(errors).join(' | ');
}

/* -------------------------------------------------------------------------- */
/* Step coverage                                                              */
/* -------------------------------------------------------------------------- */

describe('every step is validated', () => {
  it('each step id maps to a schema, and every schema rejects the empty draft', () => {
    /*
     * Two steps are exempt, for stated reasons rather than by accident:
     *
     *  - `cv` is validated by the server against the actual bytes, because a
     *    filename proves nothing.
     *  - `previous-employment` is optional in full: an applicant with no previous
     *    role must be able to continue, and the section is enforced per row when
     *    a row exists.
     */
    for (const step of STEPS) {
      if (step.id === 'cv' || step.id === 'previous-employment') continue;
      const errors = validateStep(step.id, emptyDraft());
      assert.ok(
        Object.keys(errors).length > 0,
        `step "${step.id}" accepted an empty draft, so an applicant could skip it`,
      );
    }
  });

  it('the valid draft passes every step and the whole-form schema', () => {
    const draft = validDraft();

    for (const step of STEPS) {
      if (step.id === 'cv') continue;
      assert.deepEqual(validateStep(step.id, draft), {}, `step "${step.id}" rejected a valid draft`);
    }

    const result = assessmentSchema.safeParse(draft);
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  });

  it('no step reports a raw developer message to a visitor', () => {
    const draft = emptyDraft();
    for (const step of STEPS) {
      if (step.id === 'cv') continue;
      const text = allMessages(validateStep(step.id, draft));
      assert.ok(!/Invalid input/i.test(text), `step "${step.id}" leaked a developer message: ${text}`);
    }

    // …and neither does the whole-form schema when a request omits sections.
    const whole = assessmentSchema.safeParse({ personal: {} });
    assert.equal(whole.success, false);
    const messages = (whole.error?.issues ?? []).map((issue) => issue.message).join(' | ');
    assert.ok(!/Invalid input/i.test(messages), messages);
  });
});

/* -------------------------------------------------------------------------- */
/* 1. Personal                                                                */
/* -------------------------------------------------------------------------- */

describe('personal step', () => {
  it('requires every mandatory field, and names each one', () => {
    const errors = validateStep('personal', emptyDraft());

    /*
     * Note: `mobileCountryCode` is absent from this list on purpose — the draft
     * defaults it to +234, so it is never empty in the form, and the schema still
     * validates whatever is sent.
     */
    for (const field of [
      'fullName',
      'dateOfBirth',
      'gender',
      'nationality',
      'countryOfResidence',
      'residentialAddress',
      'city',
      'stateProvince',
      'postalCode',
      'mobileNumber',
      'email',
      'maritalStatus',
      'hasChildren',
    ]) {
      assert.ok(errors[`personal.${field}`], `missing an error for ${field}`);
    }
  });

  it('treats optional fields as optional', () => {
    const draft = validDraft();
    // No alternative number at all.
    const errors = validateStep('personal', draft);
    assert.deepEqual(errors, {});
  });

  it('accepts a second number only as a complete pair', () => {
    const draft = validDraft();
    draft.personal.altMobileCountryCode = '+44';
    const errors = validateStep('personal', draft);
    assert.equal(
      errors['personal.altMobileNumber'],
      'Provide both the calling code and the number, or leave both empty.',
    );
  });

  it('requires a children count when the answer is Yes, and forbids one when it is No', () => {
    const draft = validDraft();

    draft.personal.numberOfChildren = '';
    assert.ok(validateStep('personal', draft)['personal.numberOfChildren']);

    draft.personal.hasChildren = 'no';
    draft.personal.numberOfChildren = '2';
    assert.equal(
      validateStep('personal', draft)['personal.numberOfChildren'],
      'Remove the number of children, or answer Yes.',
    );
  });

  it('rejects a date of birth in the future and an applicant under 18', () => {
    const draft = validDraft();

    draft.personal.dateOfBirth = '2999-01-01';
    assert.match(
      validateStep('personal', draft)['personal.dateOfBirth'] ?? '',
      /future|100 years|18/i,
    );

    const nextYear = new Date();
    nextYear.setUTCFullYear(nextYear.getUTCFullYear() - 10);
    draft.personal.dateOfBirth = nextYear.toISOString().slice(0, 10);
    assert.equal(
      validateStep('personal', draft)['personal.dateOfBirth'],
      'You must be at least 18 to use this form.',
    );
  });

  it('requires a full name of at least two words', () => {
    const draft = validDraft();
    draft.personal.fullName = 'Ada';
    assert.match(validateStep('personal', draft)['personal.fullName'] ?? '', /full name/i);
  });

  it('rejects an unknown country or nationality', () => {
    const draft = validDraft();
    draft.personal.nationality = 'ZZ';
    draft.personal.countryOfResidence = 'Atlantis';
    const errors = validateStep('personal', draft);

    assert.match(errors['personal.nationality'] ?? '', /country from the list/i);
    assert.match(errors['personal.countryOfResidence'] ?? '', /country from the list/i);
  });

  it('accepts every ISO 3166-1 country as a nationality', () => {
    // Guards against a hand-picked subset: the selector offers 202 entries, and
    // the schema must accept all of them, not just the ones in the demo data.
    const draft = validDraft();

    for (const country of ISO_COUNTRIES) {
      draft.personal.nationality = country.code;
      assert.deepEqual(
        validateStep('personal', draft),
        {},
        `nationality ${country.code} (${country.name}) was rejected`,
      );
    }
  });

  it('lowercases the email so the duplicate check is reliable', () => {
    const draft = validDraft();
    draft.personal.email = 'Ada.OBI@Example.COM';
    const parsed = assessmentSchema.safeParse(draft);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.personal.email, 'ada.obi@example.com');
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Passport                                                                */
/* -------------------------------------------------------------------------- */

describe('passport step', () => {
  it('accepts "no" with no details — a passport is not required to apply', () => {
    const draft = validDraft();
    draft.passport = {
      hasPassport: 'no',
      passportNumber: '',
      passportCityOfIssue: '',
      passportIssueDate: '',
      passportExpiryDate: '',
    };
    assert.deepEqual(validateStep('passport', draft), {});
  });

  it('rejects hidden detail fields when the answer is No', () => {
    const draft = validDraft();
    draft.passport.hasPassport = 'no';
    // The UI hides these, but a crafted request can still send them.
    const errors = validateStep('passport', draft);

    assert.equal(
      errors['passport.passportNumber'],
      'Clear this field, or answer Yes to holding a passport.',
    );
    assert.ok(errors['passport.passportExpiryDate']);
  });

  it('requires all four details when the answer is Yes', () => {
    const draft = validDraft();
    draft.passport.passportNumber = '';
    draft.passport.passportCityOfIssue = '';
    draft.passport.passportIssueDate = '';
    draft.passport.passportExpiryDate = '';

    const errors = validateStep('passport', draft);
    assert.ok(errors['passport.passportNumber']);
    assert.ok(errors['passport.passportCityOfIssue']);
    assert.ok(errors['passport.passportIssueDate']);
    assert.ok(errors['passport.passportExpiryDate']);
  });

  it('rejects an expiry date before the issue date', () => {
    const draft = validDraft();
    draft.passport.passportExpiryDate = '2019-01-01';
    assert.equal(
      validateStep('passport', draft)['passport.passportExpiryDate'],
      'Expiry date must be after the issue date.',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Education                                                               */
/* -------------------------------------------------------------------------- */

describe('education step', () => {
  it('requires at least one qualification', () => {
    const draft = validDraft();
    draft.education = [];
    assert.equal(
      validateStep('education', draft).education,
      'Add at least one qualification.',
    );
  });

  it('accepts repeatable entries and reports the failing row by index', () => {
    const draft = validDraft();
    draft.education = [
      draft.education[0]!,
      { qualificationLevel: 'master', institutionName: '', country: 'GB', yearCompleted: '2020' },
    ];

    const errors = validateStep('education', draft);
    assert.equal(errors['education.1.institutionName'], 'Institution name is required.');
    assert.equal(errors['education.0.institutionName'], undefined);
  });

  it('bounds the number of entries and the completion year', () => {
    const draft = validDraft();
    draft.education = Array.from({ length: 9 }, () => ({ ...draft.education[0]! }));
    assert.match(validateStep('education', draft).education ?? '', /up to 8/i);

    const bad = validDraft();
    bad.education[0]!.yearCompleted = '1899';
    assert.match(
      validateStep('education', bad)['education.0.yearCompleted'] ?? '',
      /between 1950/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Employment                                                              */
/* -------------------------------------------------------------------------- */

describe('employment step', () => {
  it('accepts "unemployed" as a complete answer', () => {
    const draft = validDraft();
    draft.employment = {
      status: 'unemployed',
      currentEmployer: '',
      currentPosition: '',
      currentCountry: '',
      currentStartDate: '',
      currentSalaryAmount: '',
      currentSalaryCurrency: 'USD',
    };
    assert.deepEqual(validateStep('employment', draft), {});
  });

  it('rejects employer details while the answer is "unemployed"', () => {
    const draft = validDraft();
    draft.employment.status = 'unemployed';
    const errors = validateStep('employment', draft);

    assert.equal(
      errors['employment.currentEmployer'],
      'Clear this field, or change your employment status to employed.',
    );
    assert.ok(errors['employment.currentSalaryAmount']);
  });

  it('requires employer, position, country, start month and salary when employed', () => {
    const draft = validDraft();
    draft.employment = {
      status: 'employed',
      currentEmployer: '',
      currentPosition: '',
      currentCountry: '',
      currentStartDate: '',
      currentSalaryAmount: '',
      currentSalaryCurrency: 'USD',
    };
    const errors = validateStep('employment', draft);

    assert.ok(errors['employment.currentEmployer']);
    assert.ok(errors['employment.currentPosition']);
    assert.ok(errors['employment.currentCountry']);
    assert.equal(errors['employment.currentStartDate'], 'Enter when you started, as YYYY-MM.');
    assert.ok(errors['employment.currentSalaryAmount']);
  });

  it('accepts thousands separators in a salary but not a currency symbol', () => {
    const draft = validDraft();
    draft.employment.currentSalaryAmount = '1,500';
    assert.deepEqual(validateStep('employment', draft), {});

    draft.employment.currentSalaryAmount = '$1500';
    assert.match(
      validateStep('employment', draft)['employment.currentSalaryAmount'] ?? '',
      /whole number/i,
    );
  });

  it('stops a start date in the future', () => {
    const draft = validDraft();
    draft.employment.currentStartDate = '2999-01';
    assert.equal(
      validateStep('employment', draft)['employment.currentStartDate'],
      'Start date cannot be in the future.',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Previous employment                                                     */
/* -------------------------------------------------------------------------- */

describe('previous employment step', () => {
  it('is optional in full', () => {
    const draft = validDraft();
    draft.previousEmployment = [];
    assert.deepEqual(validateStep('previous-employment', draft), {});
  });

  it('requires a complete row once one is added', () => {
    const draft = validDraft();
    draft.previousEmployment = [
      { employerName: '', position: 'Driver', country: '', yearsWorked: '' },
    ];
    const errors = validateStep('previous-employment', draft);

    assert.ok(errors['previousEmployment.0.employerName']);
    assert.ok(errors['previousEmployment.0.country']);
    assert.ok(errors['previousEmployment.0.yearsWorked']);
    assert.equal(errors['previousEmployment.0.position'], undefined);
  });

  it('bounds the number of previous roles', () => {
    const draft = validDraft();
    draft.previousEmployment = Array.from({ length: 11 }, () => ({
      employerName: 'Employer',
      position: 'Position',
      country: 'NG',
      yearsWorked: '2',
    }));
    assert.match(
      validateStep('previous-employment', draft).previousEmployment ?? '',
      /up to 10/i,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Skills and languages                                                    */
/* -------------------------------------------------------------------------- */

describe('skills step', () => {
  it('requires at least one skill and rejects duplicates', () => {
    const draft = validDraft();

    draft.skills = [];
    assert.equal(validateStep('skills', draft).skills, 'Select at least one skill.');

    draft.skills = ['welding', 'welding'];
    assert.equal(validateStep('skills', draft).skills, 'Each skill can only be selected once.');
  });

  it('rejects a skill outside the fixed list', () => {
    const draft = validDraft();
    draft.skills = ['astronaut'];
    const errors = Object.values(validateStep('skills', draft)).join(' ');
    assert.match(errors, /from the list/i, errors);
  });

  it('accepts every skill in the published list', () => {
    const draft = validDraft();
    draft.skills = [...SKILLS];
    assert.deepEqual(validateStep('skills', draft), {});
  });
});

describe('languages step', () => {
  it('requires at least one language rating', () => {
    const draft = validDraft();
    draft.languages = { english: '', french: '', spanish: '', german: '' };
    assert.equal(validateStep('languages', draft).languages, 'Rate at least one language.');
  });

  it('stores only real languages with a valid proficiency', () => {
    const draft = validDraft();
    draft.languages = { english: 'fluent', french: 'basic', spanish: '', german: 'nonsense' };

    const parsed = assessmentSchema.safeParse(draft);
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data?.languages, [
      { language: 'english', proficiency: 'fluent' },
      { language: 'french', proficiency: 'basic' },
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Preferences                                                             */
/* -------------------------------------------------------------------------- */

describe('preferences step', () => {
  it('requires an occupation but not a destination or salary', () => {
    const draft = validDraft();
    draft.preferences = {
      preferredCountryId: '',
      preferredOccupation: '',
      expectedSalaryAmount: '',
      expectedSalaryCurrency: 'USD',
    };
    const errors = validateStep('preferences', draft);
    assert.equal(errors['preferences.preferredOccupation'], 'Preferred occupation is required.');
    assert.equal(Object.keys(errors).length, 1);
  });

  it('validates the expected salary when one is given', () => {
    const draft = validDraft();
    draft.preferences.expectedSalaryAmount = '12.50';
    assert.ok(validateStep('preferences', draft)['preferences.expectedSalaryAmount']);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Additional information                                                  */
/* -------------------------------------------------------------------------- */

describe('additional information step', () => {
  it('requires an answer to all five questions', () => {
    const errors = validateStep('additional', emptyDraft());
    for (const field of [
      'hasMedicalCondition',
      'hasCriminalRecord',
      'hasTravelledAbroad',
      'hasFamilyAbroad',
      'hasProfessionalExams',
    ]) {
      assert.ok(errors[`additional.${field}`], `no error for ${field}`);
    }
  });

  it('requires detail for a "yes" answer and rejects detail for a "no" answer', () => {
    const draft = validDraft();

    draft.additional.hasMedicalCondition = 'yes';
    draft.additional.medicalDetails = '';
    assert.equal(
      validateStep('additional', draft)['additional.medicalDetails'],
      'Describe the condition and any treatment, or answer No.',
    );

    draft.additional.hasMedicalCondition = 'no';
    draft.additional.medicalDetails = 'Asthma';
    assert.equal(
      validateStep('additional', draft)['additional.medicalDetails'],
      'Clear these details, or answer Yes.',
    );
  });

  it('keeps the medical and criminal answers as booleans for the database', () => {
    const draft = validDraft();
    draft.additional.hasCriminalRecord = 'yes';
    draft.additional.criminalRecordDetails = 'A minor offence in 2011.';

    const parsed = assessmentSchema.safeParse(draft);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.additional.hasCriminalRecord, true);
    assert.equal(parsed.data?.additional.hasMedicalCondition, false);
    assert.equal(parsed.data?.additional.medicalDetails, '');
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Consent                                                                 */
/* -------------------------------------------------------------------------- */

describe('consent', () => {
  it('refuses submission unless both policies are actively accepted', () => {
    for (const consent of [
      { acceptedTerms: false, acceptedPrivacy: false },
      { acceptedTerms: true, acceptedPrivacy: false },
      { acceptedTerms: false, acceptedPrivacy: true },
    ]) {
      const draft = { ...validDraft(), consent };
      const errors = validateStep('review', draft);
      assert.ok(
        Object.keys(errors).length > 0,
        `consent ${JSON.stringify(consent)} was accepted`,
      );
    }
  });

  it('cannot be satisfied by a truthy string', () => {
    const draft = { ...validDraft(), consent: { acceptedTerms: 'yes', acceptedPrivacy: 'true' } };
    const parsed = assessmentSchema.safeParse(draft);
    assert.equal(parsed.success, false);
  });

  it('is required by the whole-form schema as well as the review step', () => {
    const draft = { ...validDraft(), consent: { acceptedTerms: false, acceptedPrivacy: false } };
    const parsed = assessmentSchema.safeParse(draft);
    assert.equal(parsed.success, false);
    const paths = (parsed.error?.issues ?? []).map((issue) => issue.path.join('.'));
    assert.deepEqual(paths.sort(), ['consent.acceptedPrivacy', 'consent.acceptedTerms']);
  });
});

/* -------------------------------------------------------------------------- */
/* Field → step routing                                                       */
/* -------------------------------------------------------------------------- */

describe('error routing', () => {
  it('sends every field error to the step that owns it', () => {
    const cases: Array<[string, string]> = [
      ['personal.fullName', 'personal'],
      ['passport.hasPassport', 'passport'],
      ['education.0.country', 'education'],
      ['employment.status', 'employment'],
      ['previousEmployment.1.position', 'previous-employment'],
      ['skills', 'skills'],
      ['languages', 'languages'],
      ['preferences.preferredOccupation', 'preferences'],
      ['additional.medicalDetails', 'additional'],
      ['consent.acceptedTerms', 'review'],
      // A CV error belongs on the CV step, which is where the file is chosen.
      ['cv', 'cv'],
    ];

    for (const [path, step] of cases) {
      assert.equal(stepForField(path), step, `${path} routed to ${stepForField(path)}`);
    }

    // Every step a field routes to must exist in the wizard.
    const ids = new Set<string>(STEPS.map((step) => step.id));
    for (const [path] of cases) {
      assert.ok(ids.has(stepForField(path)), `${path} routed to an unknown step`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Reference numbers                                                          */
/* -------------------------------------------------------------------------- */

describe('reference numbers', () => {
  it('matches the documented format', () => {
    const reference = generateReferenceNumber({ year: 2026 });
    assert.match(reference, /^IMA-2026-[0-9A-HJKMNP-TV-Z]{8}$/);
    assert.equal(isValidReferenceNumber(reference), true);
  });

  it('uses Crockford base32 — no I, L, O or U', () => {
    for (let index = 0; index < 200; index += 1) {
      const reference = generateReferenceNumber();
      assert.ok(!/[ILOU]/.test(reference.slice(9)), `ambiguous character in ${reference}`);
    }
  });

  it('never repeats across a thousand draws', () => {
    const seen = new Set<string>();
    for (let index = 0; index < 1000; index += 1) seen.add(generateReferenceNumber());
    assert.equal(seen.size, 1000);
  });

  it('rejects a malformed reference', () => {
    for (const value of ['', 'IMA-26-ABCDEFGH', 'ima-2026-ABCDEFGH', 'IMA-2026-ABC', 'IMA-2026-ABCDEFGO']) {
      assert.equal(isValidReferenceNumber(value), false, value);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Free-text helpers                                                          */
/* -------------------------------------------------------------------------- */

describe('country list splitting', () => {
  it('splits on commas, semicolons, slashes and the word "and"', () => {
    assert.deepEqual(splitCountries('Ghana, United Kingdom and UAE'), [
      'Ghana',
      'United Kingdom',
      'UAE',
    ]);
    assert.deepEqual(splitCountries('France;Germany/Spain'), ['France', 'Germany', 'Spain']);
  });

  it('de-duplicates case-insensitively and drops fragments that are not countries', () => {
    assert.deepEqual(splitCountries('Ghana, ghana, , a'), ['Ghana']);
  });

  it('caps the number of rows so one answer cannot create unbounded records', () => {
    const many = Array.from({ length: 40 }, (_, index) => `Country ${index}`).join(', ');
    assert.equal(splitCountries(many).length, 20);
  });
});
