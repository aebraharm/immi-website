/**
 * Assessment validation — the single source of truth for the form.
 *
 * The browser runs these schemas to decide whether "Next" may move on; the
 * server runs the *same* schemas, over the *whole* form, before a single row is
 * written. That is what makes the client-side checks a convenience rather than a
 * security control: nothing reaches the database that this file has not allowed.
 *
 * Three conventions hold throughout:
 *
 *  1. **Every message is written for the applicant** and names the field, so an
 *     error can be shown inline without extra mapping.
 *  2. **Conditional fields are enforced here, not in the UI.** If
 *     `hasPassport = no`, passport details are dropped — the database CHECK
 *     constraint expects exactly that, and a hidden input is not a guarantee.
 *  3. **Nothing is invented.** No default country, no assumed salary, no
 *     pre-ticked consent.
 */

import { z } from 'zod';

import {
  EMPLOYMENT_RECORD_TYPES,
  GENDERS,
  LANGUAGES,
  MARITAL_STATUSES,
  PROFICIENCY_LEVELS,
  QUALIFICATION_LEVELS,
  SKILLS,
} from '@/db/schema/enums';
import { SALARY_CURRENCIES, isValidIsoCountryCode } from '@/lib/data/countries-iso';

import { EARLIEST_YEAR, MAX_SALARY_AMOUNT } from './reference';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A required single-line answer. Trimmed, so " " is empty.
 *
 * The `preprocess` matters: a hand-crafted request that omits the key entirely
 * would otherwise fail with Zod's "expected string, received undefined", which is
 * a message for a developer, not for an applicant. Missing is treated as blank,
 * and blank produces the sentence below.
 */
const asString = (value: unknown) => (typeof value === 'string' ? value : '');

const required = (label: string, max: number) =>
  z.preprocess(
    asString,
    z
      .string()
      .trim()
      .min(1, `${label} is required.`)
      .max(max, `${label} must be ${max} characters or fewer.`),
  );

/**
 * An optional single-line answer. Empty string means "not provided".
 *
 * `.default('')` matters on the server: a request that omits an optional key is
 * treated as "left blank" rather than failing with a message about expected
 * types, which would read like a bug to the applicant.
 */
const optionalText = (max: number) =>
  z.preprocess(asString, z.string().trim().max(max));

const isoCountry = (label: string) =>
  z.preprocess(
    asString,
    z
      .string()
      .trim()
      .min(1, `Select ${label}.`)
      .refine(isValidIsoCountryCode, `Select a country from the list for ${label}.`),
  );

const isoDate = (label: string) =>
  z.preprocess(
    asString,
    z
      .string()
      .trim()
      .min(1, `${label} is required.`)
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date in YYYY-MM-DD form.`)
      .refine(
        (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
        `${label} is not a real date.`,
      ),
  );

const isoMonth = (label: string) =>
  z.preprocess(
    asString,
    z
      .string()
      .trim()
      .min(1, `${label} is required.`)
      .regex(/^\d{4}-\d{2}$/, `${label} must be a month in YYYY-MM form.`)
      .refine((value) => {
        const month = Number(value.slice(5, 7));
        return month >= 1 && month <= 12;
      }, `${label} is not a real month.`),
  );

/**
 * A whole-number money amount.
 *
 * Accepts the digits a visitor types ("1,500" or "1500") and rejects fractions:
 * we do not want to store a half-cent salary, and a decimal point is a reliable
 * sign that currency confusion is about to happen.
 */
const money = (label: string) =>
  z
    .preprocess(asString, z.string())
    .pipe(
      z
        .string()
        .trim()
        .min(1, `${label} is required.`)
        .refine(
          (value) => /^\d[\d,\s]*$/.test(value),
          `${label} must be a whole number, without a currency symbol.`,
        )
        .transform((value) => Number(value.replace(/[,\s]/g, '')))
        .refine(
          (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_SALARY_AMOUNT,
          `${label} must be a whole number between 0 and ${MAX_SALARY_AMOUNT.toLocaleString('en-GB')}.`,
        ),
    );

/**
 * A two-option Yes/No answer, still as a string.
 *
 * The message is built here rather than left to Zod's default because "Invalid
 * input" in a form reads like a bug rather than an instruction, and the label is
 * what tells the visitor which question they missed.
 */
const yesNoAnswer = (label: string) =>
  z.enum(['yes', 'no'], { message: `Choose Yes or No for ${label}.` });

const currentYear = () => new Date().getUTCFullYear();

/* -------------------------------------------------------------------------- */
/* Step 1 — Personal                                                          */
/* -------------------------------------------------------------------------- */

export const personalSchema = z
  .object({
    fullName: required('Full name', 120).refine(
      (value) => value.split(/\s+/).length >= 2,
      'Enter your full name as it appears on your passport.',
    ),
    dateOfBirth: isoDate('Date of birth'),
    gender: z.enum(GENDERS, { message: 'Select a gender option.' }),
    nationality: isoCountry('your nationality'),
    countryOfResidence: isoCountry('your country of residence'),
    residentialAddress: required('Residential address', 300),
    city: required('City', 80),
    stateProvince: required('State or province', 80),
    postalCode: required('Postal code', 20),
    mobileCountryCode: z.preprocess(
      asString,
      z
        .string()
        .trim()
        .min(1, 'Select a country calling code.')
        .regex(/^\+\d{1,4}$/, 'Select a country calling code.'),
    ),
    mobileNumber: z.preprocess(
      asString,
      z
        .string()
        .trim()
        .min(6, 'Enter your mobile number.')
        .max(20, 'Enter a mobile number of 20 digits or fewer.')
        .regex(/^[\d\s-]+$/, 'Enter digits only for your mobile number.'),
    ),
    altMobileCountryCode: optionalText(5).refine(
      (value) => value === '' || /^\+\d{1,4}$/.test(value),
      'Select a country calling code for the second number.',
    ),
    altMobileNumber: z.preprocess(
      asString,
      z
        .string()
        .trim()
        .max(20, 'Enter a mobile number of 20 digits or fewer.')
        .regex(/^[\d\s-]*$/, 'Enter digits only for the second mobile number.'),
    ),
    email: z.preprocess(
      asString,
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1, 'Email address is required.')
        .max(254, 'Email address is too long.')
        .regex(
          /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
          'Enter a valid email address, for example name@example.com.',
        ),
    ),
    maritalStatus: z.enum(MARITAL_STATUSES, { message: 'Select your marital status.' }),
    hasChildren: yesNoAnswer('children'),
    numberOfChildren: optionalText(3),
  })
  .superRefine((value, ctx) => {
    // Date of birth: a real date, in the past, and not a typo like the year 3020.
    const dob = new Date(`${value.dateOfBirth}T00:00:00Z`);
    if (!Number.isNaN(dob.getTime())) {
      const year = dob.getUTCFullYear();
      if (year < currentYear() - 100) {
        ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Check your date of birth — it is more than 100 years ago.' });
      }
      if (dob.getTime() > Date.now()) {
        ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth cannot be in the future.' });
      }
      // The service is for adults in employment; be explicit rather than silently accepting.
      const eighteen = new Date(Date.UTC(year + 18, dob.getUTCMonth(), dob.getUTCDate()));
      if (eighteen.getTime() > Date.now()) {
        ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'You must be at least 18 to use this form.' });
      }
    }

    // Second mobile: either both halves or neither.
    const hasAltCode = value.altMobileCountryCode !== '';
    const hasAltNumber = value.altMobileNumber !== '';
    if (hasAltCode !== hasAltNumber) {
      ctx.addIssue({
        code: 'custom',
        path: [hasAltCode ? 'altMobileNumber' : 'altMobileCountryCode'],
        message: 'Provide both the calling code and the number, or leave both empty.',
      });
    }
    if (hasAltNumber && hasAltCode && value.altMobileNumber === value.mobileNumber) {
      ctx.addIssue({ code: 'custom', path: ['altMobileNumber'], message: 'The second number is the same as your mobile number.' });
    }

    // Children count only exists when there are children — the database CHECK
    // constraint says the same thing, so the two can never drift.
    if (value.hasChildren === 'yes') {
      const count = Number(value.numberOfChildren);
      if (!/^\d{1,2}$/.test(value.numberOfChildren) || !Number.isInteger(count) || count < 1 || count > 20) {
        ctx.addIssue({ code: 'custom', path: ['numberOfChildren'], message: 'Enter how many children, between 1 and 20.' });
      }
    } else if (value.hasChildren === 'no' && value.numberOfChildren !== '') {
      ctx.addIssue({ code: 'custom', path: ['numberOfChildren'], message: 'Remove the number of children, or answer Yes.' });
    }
  })
  /*
   * The database stores these as booleans and a nullable count. Converting here —
   * once, after validation — means `submit.ts` never has to re-interpret a string,
   * and the two CHECK constraints in the schema are satisfied by construction.
   */
  .transform((value) => ({
    ...value,
    hasChildren: value.hasChildren === 'yes',
    numberOfChildren: value.hasChildren === 'yes' ? Number(value.numberOfChildren) : null,
  }));

/* -------------------------------------------------------------------------- */
/* Step 2 — Passport                                                          */
/* -------------------------------------------------------------------------- */

export const passportSchema = z
  .object({
    hasPassport: yesNoAnswer('passport availability'),
    passportNumber: optionalText(20),
    passportCityOfIssue: optionalText(80),
    passportIssueDate: optionalText(10),
    passportExpiryDate: optionalText(10),
  })
  .superRefine((value, ctx) => {
    if (value.hasPassport === 'no') {
      /*
       * When there is no passport the detail fields must be empty. The UI hides
       * them, but a crafted request can still send them, so this is where they
       * are refused rather than rewritten behind the applicant's back.
       */
      for (const field of [
        'passportNumber',
        'passportCityOfIssue',
        'passportIssueDate',
        'passportExpiryDate',
      ] as const) {
        if (value[field] !== '') {
          ctx.addIssue({ code: 'custom', path: [field], message: 'Clear this field, or answer Yes to holding a passport.' });
        }
      }
      return;
    }

    if (value.hasPassport !== 'yes') return;

    if (value.passportNumber === '') {
      ctx.addIssue({ code: 'custom', path: ['passportNumber'], message: 'Passport number is required.' });
    } else if (!/^[A-Za-z0-9]{5,20}$/.test(value.passportNumber)) {
      ctx.addIssue({ code: 'custom', path: ['passportNumber'], message: 'Enter the passport number as printed — letters and digits only.' });
    }

    if (value.passportCityOfIssue === '') {
      ctx.addIssue({ code: 'custom', path: ['passportCityOfIssue'], message: 'City of issue is required.' });
    }

    const issue = isoDate('Passport issue date').safeParse(value.passportIssueDate);
    if (!issue.success) {
      ctx.addIssue({ code: 'custom', path: ['passportIssueDate'], message: 'Enter the issue date as YYYY-MM-DD.' });
    } else {
      const issueDate = new Date(`${value.passportIssueDate}T00:00:00Z`);
      if (issueDate.getTime() > Date.now()) {
        ctx.addIssue({ code: 'custom', path: ['passportIssueDate'], message: 'Issue date cannot be in the future.' });
      }
    }

    const expiry = isoDate('Passport expiry date').safeParse(value.passportExpiryDate);
    if (!expiry.success) {
      ctx.addIssue({ code: 'custom', path: ['passportExpiryDate'], message: 'Enter the expiry date as YYYY-MM-DD.' });
    } else if (issue.success) {
      const issueDate = new Date(`${value.passportIssueDate}T00:00:00Z`);
      const expiryDate = new Date(`${value.passportExpiryDate}T00:00:00Z`);
      if (expiryDate.getTime() <= issueDate.getTime()) {
        ctx.addIssue({ code: 'custom', path: ['passportExpiryDate'], message: 'Expiry date must be after the issue date.' });
      }
    }
  })
  .transform((value) => ({
    ...value,
    hasPassport: value.hasPassport === 'yes',
  }));

/* -------------------------------------------------------------------------- */
/* Step 3 — Education                                                         */
/* -------------------------------------------------------------------------- */

export const educationEntrySchema = z.object({
  qualificationLevel: z.enum(QUALIFICATION_LEVELS, { message: 'Select a qualification level.' }),
  institutionName: required('Institution name', 150),
  country: isoCountry('the country of the institution'),
  yearCompleted: z
    .preprocess(asString, z.string())
    .pipe(
      z
        .string()
        .trim()
        .min(1, 'Enter the year you completed this qualification.')
        .regex(/^\d{4}$/, 'Enter the year you completed this qualification, for example 2019.')
    .transform(Number)
        .refine(
          (year) => year >= EARLIEST_YEAR && year <= currentYear() + 1,
          `Enter a completion year between ${EARLIEST_YEAR} and ${currentYear() + 1}.`,
        ),
    ),
});

/** The repeatable list itself — shared by the step schema and the whole form. */
export const educationListSchema = z
  .array(educationEntrySchema)
  .min(1, 'Add at least one qualification.')
  .max(8, 'You can add up to 8 qualifications.');

export const educationSchema = z.object({ education: educationListSchema });

/* -------------------------------------------------------------------------- */
/* Step 4 — Current employment                                                */
/* -------------------------------------------------------------------------- */

export const EMPLOYMENT_STATUSES = ['employed', 'unemployed'] as const;

export const employmentSchema = z
  .object({
    status: z.enum(EMPLOYMENT_STATUSES, {
      message: 'Tell us whether you are currently employed.',
    }),
    currentEmployer: optionalText(150),
    currentPosition: optionalText(120),
    currentCountry: optionalText(2),
    currentStartDate: optionalText(7),
    currentSalaryAmount: optionalText(20),
    currentSalaryCurrency: optionalText(3),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'unemployed') {
      /*
       * "Unemployed" is a first-class answer, not an error state. The detail
       * fields must be empty so the record cannot claim an employer the
       * applicant just told us they do not have.
       */
      const details = {
        currentEmployer: value.currentEmployer,
        currentPosition: value.currentPosition,
        currentCountry: value.currentCountry,
        currentStartDate: value.currentStartDate,
        currentSalaryAmount: value.currentSalaryAmount,
      };
      for (const [field, fieldValue] of Object.entries(details)) {
        if (fieldValue !== '') {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Clear this field, or change your employment status to employed.',
          });
        }
      }
      return;
    }

    if (value.status !== 'employed') return;

    if (value.currentEmployer === '') {
      ctx.addIssue({ code: 'custom', path: ['currentEmployer'], message: 'Employer name is required.' });
    }
    if (value.currentPosition === '') {
      ctx.addIssue({ code: 'custom', path: ['currentPosition'], message: 'Your position is required.' });
    }
    const country = isoCountry('the country where you work').safeParse(value.currentCountry);
    if (!country.success) {
      ctx.addIssue({ code: 'custom', path: ['currentCountry'], message: 'Select the country where you are employed.' });
    }

    const start = isoMonth('Employment start date').safeParse(value.currentStartDate);
    if (!start.success) {
      ctx.addIssue({ code: 'custom', path: ['currentStartDate'], message: 'Enter when you started, as YYYY-MM.' });
    } else {
      const startDate = new Date(`${value.currentStartDate}-01T00:00:00Z`);
      if (startDate.getTime() > Date.now()) {
        ctx.addIssue({ code: 'custom', path: ['currentStartDate'], message: 'Start date cannot be in the future.' });
      }
    }

    const salary = money('Monthly salary').safeParse(value.currentSalaryAmount);
    if (!salary.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentSalaryAmount'],
        message: salary.error.issues[0]?.message ?? 'Enter your monthly salary.',
      });
    }
    if (!SALARY_CURRENCIES.includes(value.currentSalaryCurrency as never)) {
      ctx.addIssue({ code: 'custom', path: ['currentSalaryCurrency'], message: 'Select the currency of your salary.' });
    }
  });

/* -------------------------------------------------------------------------- */
/* Step 5 — Previous employment                                               */
/* -------------------------------------------------------------------------- */

export const previousEmploymentEntrySchema = z.object({
  employerName: required('Employer name', 150),
  position: required('Position', 120),
  country: isoCountry('the country of employment'),
  yearsWorked: z
    .preprocess(asString, z.string())
    .pipe(
      z
        .string()
        .trim()
        .min(1, 'Enter the number of years you worked there.')
        .regex(/^\d{1,2}$/, 'Enter the number of years you worked there.')
    .transform(Number)
        .refine((years) => years >= 0 && years <= 60, 'Enter a number of years between 0 and 60.'),
    ),
});

/**
 * Previous employment is optional in full, but if the applicant chooses to add a
 * row it must be complete — a half-filled row would put an employer with no
 * position into an administrator's list.
 */
export const previousEmploymentListSchema = z
  .array(previousEmploymentEntrySchema)
  .max(10, 'You can add up to 10 previous roles.');

export const previousEmploymentSchema = z.object({
  previousEmployment: previousEmploymentListSchema,
});

/* -------------------------------------------------------------------------- */
/* Step 6 — Skills                                                            */
/* -------------------------------------------------------------------------- */

export const skillsListSchema = z
  .array(
    // `catchall` keeps an unknown value in the array so the checks below can
    // reject it with a sentence, instead of Zod silently dropping it and leaving
    // an empty list with a misleading "select at least one skill" error.
    z
      .string()
      .refine(
        (value) => (SKILLS as readonly string[]).includes(value),
        'Choose skills from the list.',
      )
      .transform((value) => value as (typeof SKILLS)[number]),
  )
  // Duplicates would break the UNIQUE (assessment, skill) index; rejecting them
  // is friendlier than a database error, and the message names the fix.
  .refine((values) => new Set(values).size === values.length, 'Each skill can only be selected once.')
  .refine((values) => values.length > 0, 'Select at least one skill.')
  .refine((values) => values.length <= SKILLS.length, 'Choose from the list of skills.');

export const skillsSchema = z.object({ skills: skillsListSchema });

/* -------------------------------------------------------------------------- */
/* Step 7 — Languages                                                         */
/* -------------------------------------------------------------------------- */

export const languagesListSchema = z
    .record(z.string(), z.string())
    .superRefine((value, ctx) => {
      const answers = LANGUAGES.filter((language) => (value[language] ?? '') !== '');
      if (answers.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: [],
          message: 'Rate at least one language.',
        });
      }
    })
    .transform((value) => {
      // Keep only real languages with a valid proficiency; anything else is
      // discarded rather than stored, so the table can never hold junk.
      return LANGUAGES.flatMap((language) => {
        const proficiency = value[language] ?? '';
        if (!(PROFICIENCY_LEVELS as readonly string[]).includes(proficiency)) return [];
        return [{ language, proficiency: proficiency as (typeof PROFICIENCY_LEVELS)[number] }];
      });
    });

export const languagesSchema = z.object({ languages: languagesListSchema });

/* -------------------------------------------------------------------------- */
/* Step 8 — Employment preferences                                            */
/* -------------------------------------------------------------------------- */

export const preferencesSchema = z
  .object({
    /** A published destination id, or '' — never a free-text country name. */
    preferredCountryId: optionalText(64),
    preferredOccupation: required('Preferred occupation', 120),
    expectedSalaryAmount: optionalText(20),
    expectedSalaryCurrency: optionalText(3),
  })
  .superRefine((value, ctx) => {
    const hasAmount = value.expectedSalaryAmount !== '';
    if (hasAmount) {
      const amount = money('Expected salary').safeParse(value.expectedSalaryAmount);
      if (!amount.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['expectedSalaryAmount'],
          message: amount.error.issues[0]?.message ?? 'Enter your expected monthly salary.',
        });
      }
      if (!SALARY_CURRENCIES.includes(value.expectedSalaryCurrency as never)) {
        ctx.addIssue({ code: 'custom', path: ['expectedSalaryCurrency'], message: 'Select a currency for the expected salary.' });
      }
    } else if (value.expectedSalaryCurrency !== '' && value.expectedSalaryCurrency !== 'USD') {
      // Currency without an amount is meaningless; USD is the untouched default.
      ctx.addIssue({ code: 'custom', path: ['expectedSalaryAmount'], message: 'Enter an expected salary, or leave the currency at its default.' });
    }
  });

/* -------------------------------------------------------------------------- */
/* Step 9 — Additional information                                            */
/* -------------------------------------------------------------------------- */

/**
 * Repeated shape: a yes/no answer plus conditional detail.
 *
 * `detailRequired` is true for the two questions where a bare "yes" would leave
 * an administrator unable to act (a medical condition, a criminal conviction).
 */
function conditionalDetail(options: {
  answer: string;
  detail: string;
  label: string;
  detailRequired: string;
  maxLength: number;
}) {
  return {
    parse(value: Record<string, unknown>, ctx: z.RefinementCtx) {
      const answer = value[options.answer];
      const detail = String(value[options.detail] ?? '').trim();

      if (answer !== 'yes' && answer !== 'no') {
        ctx.addIssue({ code: 'custom', path: [options.answer], message: `Choose Yes or No for ${options.label}.` });
        return;
      }

      if (answer === 'yes' && detail === '') {
        ctx.addIssue({ code: 'custom', path: [options.detail], message: options.detailRequired });
        return;
      }

      if (answer === 'no' && detail !== '') {
        ctx.addIssue({
          code: 'custom',
          path: [options.detail],
          message: 'Clear these details, or answer Yes.',
        });
        return;
      }

      if (detail.length > options.maxLength) {
        ctx.addIssue({
          code: 'custom',
          path: [options.detail],
          message: `Keep these details to ${options.maxLength} characters or fewer.`,
        });
      }
    },
  };
}

export const additionalSchema = z
  .object({
    hasMedicalCondition: optionalText(3),
    medicalDetails: optionalText(1000),
    hasCriminalRecord: optionalText(3),
    criminalRecordDetails: optionalText(1000),
    hasTravelledAbroad: optionalText(3),
    travelledCountries: optionalText(300),
    hasFamilyAbroad: optionalText(3),
    familyAbroadCountries: optionalText(300),
    hasProfessionalExams: optionalText(3),
    professionalExamsNotes: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    conditionalDetail({
      answer: 'hasMedicalCondition',
      detail: 'medicalDetails',
      label: 'a medical condition',
      detailRequired: 'Describe the condition and any treatment, or answer No.',
      maxLength: 1000,
    }).parse(value, ctx);

    conditionalDetail({
      answer: 'hasCriminalRecord',
      detail: 'criminalRecordDetails',
      label: 'a criminal conviction',
      detailRequired: 'Describe the conviction, or answer No.',
      maxLength: 1000,
    }).parse(value, ctx);

    conditionalDetail({
      answer: 'hasTravelledAbroad',
      detail: 'travelledCountries',
      label: 'previous travel',
      detailRequired: 'List the countries you have visited.',
      maxLength: 300,
    }).parse(value, ctx);

    conditionalDetail({
      answer: 'hasFamilyAbroad',
      detail: 'familyAbroadCountries',
      label: 'family living abroad',
      detailRequired: 'Tell us which countries and who lives there.',
      maxLength: 300,
    }).parse(value, ctx);

    conditionalDetail({
      answer: 'hasProfessionalExams',
      detail: 'professionalExamsNotes',
      label: 'professional examinations',
      detailRequired: 'Name the examination or licence, and the result.',
      maxLength: 1000,
    }).parse(value, ctx);
  })
  /*
   * Five yes/no answers become five booleans. The medical and criminal answers are
   * stored as booleans beside their nullable detail column, which is what makes
   * "no" and "not answered" impossible to confuse in an administrator's view.
   */
  .transform((value) => ({
    ...value,
    hasMedicalCondition: value.hasMedicalCondition === 'yes',
    hasCriminalRecord: value.hasCriminalRecord === 'yes',
    hasTravelledAbroad: value.hasTravelledAbroad === 'yes',
    hasFamilyAbroad: value.hasFamilyAbroad === 'yes',
    hasProfessionalExams: value.hasProfessionalExams === 'yes',
  }));

/* -------------------------------------------------------------------------- */
/* Step 10 — CV                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The CV is validated by bytes on the server, never by this schema.
 *
 * What the schema *can* say is whether a file was chosen at all, and the shape of
 * its name — anything else would be trusting the browser.
 */
export const cvSchema = z.object({
  cvFilename: z
    .string()
    .trim()
    .min(1, 'Attach your CV as a PDF or Word document.')
    .max(200, 'That filename is too long.'),
});

/* -------------------------------------------------------------------------- */
/* Step 11 — Consent and review                                              */
/* -------------------------------------------------------------------------- */

/** The exact wording shown beside the checkboxes. Stored verbatim with consent. */
export const CONSENT_TEXT = {
  terms:
    'I have read and accept the Terms and Conditions, and I agree to be contacted about my assessment.',
  privacy:
    'I have read the Privacy Policy and consent to my personal information and CV being processed for the purpose of assessing my enquiry.',
} as const;

export const consentPairSchema = z.object({
  // Both must be literally `true`. A missing key, a string "false" or a
  // pre-checked box inherited from a template all fail here.
  acceptedTerms: z.literal(true, { message: 'You must accept the Terms and Conditions to submit.' }),
  acceptedPrivacy: z.literal(true, { message: 'You must accept the Privacy Policy to submit.' }),
});

export const consentSchema = z.object({ consent: consentPairSchema });

/* -------------------------------------------------------------------------- */
/* The whole form                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The whole form, in the shape the browser holds it.
 *
 * Each step schema above wraps one of these slices so the browser can validate a
 * single screen; this one validates all of them at once, on the server, before
 * anything is written. The two cannot drift, because they share every component.
 */
/**
 * Section wrappers.
 *
 * A hand-crafted request that omits a whole section would otherwise fail with
 * "expected object, received undefined" — a message for a developer. Coercing a
 * missing section to an empty one makes Zod report the *fields* instead, which is
 * what the applicant needs to see, and loses nothing: an empty section cannot
 * satisfy any required field.
 */
const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const assessmentSchema = z.object({
  personal: z.preprocess(asRecord, personalSchema),
  passport: z.preprocess(asRecord, passportSchema),
  education: z.preprocess(asArray, educationListSchema),
  employment: z.preprocess(asRecord, employmentSchema),
  previousEmployment: z.preprocess(asArray, previousEmploymentListSchema),
  skills: z.preprocess(asArray, skillsListSchema),
  languages: z.preprocess(asRecord, languagesListSchema),
  preferences: z.preprocess(asRecord, preferencesSchema),
  additional: z.preprocess(asRecord, additionalSchema),
  consent: z.preprocess(asRecord, consentPairSchema),
});

export type ValidatedAssessment = z.output<typeof assessmentSchema>;

/* -------------------------------------------------------------------------- */
/* Per-step validation for the browser                                        */
/* -------------------------------------------------------------------------- */

/**
 * The validator for one step, applied to that step's own value.
 *
 * Each entry pairs a selector with the schema that governs it, so the error paths
 * a step produces are *relative* to the step (`fullName`, `0.institutionName`) and
 * `validateStep` can qualify them with the draft key exactly once.
 */
const STEP_VALIDATORS: Record<
  string,
  { select: (draft: Record<string, unknown>) => unknown; schema: z.ZodType }
> = {
  personal: { select: (draft) => draft.personal, schema: personalSchema },
  passport: { select: (draft) => draft.passport, schema: passportSchema },
  education: { select: (draft) => draft.education, schema: educationListSchema },
  employment: { select: (draft) => draft.employment, schema: employmentSchema },
  'previous-employment': {
    select: (draft) => draft.previousEmployment,
    schema: previousEmploymentListSchema,
  },
  skills: { select: (draft) => draft.skills, schema: skillsListSchema },
  languages: { select: (draft) => draft.languages, schema: languagesListSchema },
  preferences: { select: (draft) => draft.preferences, schema: preferencesSchema },
  additional: { select: (draft) => draft.additional, schema: additionalSchema },
  review: { select: (draft) => draft.consent, schema: consentPairSchema },
};

/**
 * The schema for a step, or `null` for the CV step.
 *
 * Exported so a test can assert that every step in the wizard has a validator —
 * a missing entry would silently make a step uncheckable.
 */
export function stepSchemaFor(stepId: string): z.ZodType | null {
  return STEP_VALIDATORS[stepId]?.schema ?? null;
}

export type FieldErrors = Record<string, string>;

/**
 * Flatten a Zod error into `{ 'personal.fullName': '…' }`.
 *
 * The first message per field wins: a field with two problems is still one field
 * to correct, and showing both would push the second line away from the input.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    if (result[key] === undefined) result[key] = issue.message;
  }
  return result;
}

/**
 * Validate one step's data, returning field errors keyed by *fully qualified*
 * path (`personal.fullName`).
 *
 * Fully-qualified keys matter: the same shape is returned by the API route when a
 * submission is refused, so one `errors['personal.fullName']` lookup in a
 * component works whether the message came from the browser or from the server.
 * A step-local key would be invisible to every input that renders its own error.
 */
export function validateStep(stepId: string, draft: Record<string, unknown>): FieldErrors {
  const validator = STEP_VALIDATORS[stepId];
  if (!validator) return {};

  const result = validator.schema.safeParse(validator.select(draft));
  if (result.success) return {};

  return prefixErrors(stepId, toFieldErrors(result.error));
}

/**
 * Qualify a step's relative error paths with the draft key that owns them.
 *
 * `_form` is the exception: an issue with no path is about the step as a whole
 * (skills, languages), so it is reported against the step's own key.
 */
const STEP_ROOT: Record<string, string> = {
  personal: 'personal',
  passport: 'passport',
  education: 'education',
  employment: 'employment',
  'previous-employment': 'previousEmployment',
  skills: 'skills',
  languages: 'languages',
  preferences: 'preferences',
  additional: 'additional',
  review: 'consent',
};

function prefixErrors(stepId: string, errors: FieldErrors): FieldErrors {
  const root = STEP_ROOT[stepId];
  if (!root) return errors;

  const result: FieldErrors = {};
  for (const [key, message] of Object.entries(errors)) {
    result[key === '_form' ? root : `${root}.${key}`] = message;
  }
  return result;
}

/**
 * Which step owns a given dotted field path, so an error can be shown on the right
 * screen — including errors that came back from the server.
 */
export function stepForField(path: string): string {
  const root = path.split('.')[0] ?? '';
  switch (root) {
    case 'personal':
      return 'personal';
    case 'passport':
      return 'passport';
    case 'education':
      return 'education';
    case 'employment':
      return 'employment';
    case 'previousEmployment':
      return 'previous-employment';
    case 'skills':
      return 'skills';
    case 'languages':
      return 'languages';
    case 'preferences':
      return 'preferences';
    case 'additional':
      return 'additional';
    case 'consent':
      return 'review';
    case 'cv':
      return 'cv';
    default:
      return 'review';
  }
}

/** Year list for the education step, newest first. */
export function completionYears(): number[] {
  const years: number[] = [];
  for (let year = currentYear() + 1; year >= EARLIEST_YEAR; year -= 1) years.push(year);
  return years;
}

export { EMPLOYMENT_RECORD_TYPES };
