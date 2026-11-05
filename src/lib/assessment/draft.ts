/**
 * The assessment draft: the shape of the form's state in the browser.
 *
 * Every value is a string (or a small array/record of strings) because that is
 * what a form input actually produces. Nothing is coerced, formatted or
 * "helpfully" corrected here — coercion happens once, in `schema.ts`, and the
 * server runs the *same* schema, so the browser can never disagree with the
 * server about what a value means.
 *
 * `emptyDraft()` is a pure function with no dates or randomness in it, which is
 * what lets a test assert on the whole object and lets React treat it as a
 * stable initial value.
 */

import { LANGUAGES } from '@/db/schema/enums';

export type YesNo = '' | 'yes' | 'no';

export type EducationEntry = {
  qualificationLevel: string;
  institutionName: string;
  /** ISO 3166-1 alpha-2 code, as selected. */
  country: string;
  yearCompleted: string;
};

export type PreviousEmploymentEntry = {
  employerName: string;
  position: string;
  country: string;
  yearsWorked: string;
};

export type AssessmentDraft = {
  personal: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    /** ISO alpha-2 code. */
    nationality: string;
    /** ISO alpha-2 code. */
    countryOfResidence: string;
    residentialAddress: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    mobileCountryCode: string;
    mobileNumber: string;
    altMobileCountryCode: string;
    altMobileNumber: string;
    email: string;
    maritalStatus: string;
    hasChildren: YesNo;
    numberOfChildren: string;
  };
  passport: {
    hasPassport: YesNo;
    passportNumber: string;
    passportCityOfIssue: string;
    passportIssueDate: string;
    passportExpiryDate: string;
  };
  education: EducationEntry[];
  employment: {
    /** `employed` | `unemployed` | ''. Drives whether the detail fields show. */
    status: string;
    currentEmployer: string;
    currentPosition: string;
    /** ISO alpha-2 code. */
    currentCountry: string;
    /** `YYYY-MM`. */
    currentStartDate: string;
    currentSalaryAmount: string;
    currentSalaryCurrency: string;
  };
  previousEmployment: PreviousEmploymentEntry[];
  skills: string[];
  /** One proficiency per language, or '' when the language was not rated. */
  languages: Record<string, string>;
  preferences: {
    /** Id of a published destination country, or '' to use the free-text field. */
    preferredCountryId: string;
    preferredOccupation: string;
    expectedSalaryAmount: string;
    expectedSalaryCurrency: string;
  };
  additional: {
    hasMedicalCondition: YesNo;
    medicalDetails: string;
    hasCriminalRecord: YesNo;
    criminalRecordDetails: string;
    hasTravelledAbroad: YesNo;
    travelledCountries: string;
    hasFamilyAbroad: YesNo;
    familyAbroadCountries: string;
    hasProfessionalExams: YesNo;
    professionalExamsNotes: string;
  };
  consent: {
    acceptedTerms: boolean;
    acceptedPrivacy: boolean;
  };
  /**
   * Anti-automation trap. Hidden from real visitors; a bot that fills every
   * input will complete it, and the server then refuses the submission.
   */
  honey: string;
};

export const EMPTY_EDUCATION: EducationEntry = {
  qualificationLevel: '',
  institutionName: '',
  country: '',
  yearCompleted: '',
};

export const EMPTY_PREVIOUS_EMPLOYMENT: PreviousEmploymentEntry = {
  employerName: '',
  position: '',
  country: '',
  yearsWorked: '',
};

/** A blank proficiency map: every language unanswered. */
export function emptyLanguages(): Record<string, string> {
  return Object.fromEntries(LANGUAGES.map((language) => [language, '']));
}

export function emptyDraft(): AssessmentDraft {
  return {
    personal: {
      fullName: '',
      dateOfBirth: '',
      gender: '',
      nationality: '',
      countryOfResidence: '',
      residentialAddress: '',
      city: '',
      stateProvince: '',
      postalCode: '',
      mobileCountryCode: '+234',
      mobileNumber: '',
      altMobileCountryCode: '',
      altMobileNumber: '',
      email: '',
      maritalStatus: '',
      hasChildren: '',
      numberOfChildren: '',
    },
    passport: {
      hasPassport: '',
      passportNumber: '',
      passportCityOfIssue: '',
      passportIssueDate: '',
      passportExpiryDate: '',
    },
    // A first row is ready to fill in, so the step is never an empty page.
    education: [{ ...EMPTY_EDUCATION }],
    employment: {
      status: '',
      currentEmployer: '',
      currentPosition: '',
      currentCountry: '',
      currentStartDate: '',
      currentSalaryAmount: '',
      currentSalaryCurrency: 'USD',
    },
    previousEmployment: [],
    skills: [],
    languages: emptyLanguages(),
    preferences: {
      preferredCountryId: '',
      preferredOccupation: '',
      expectedSalaryAmount: '',
      expectedSalaryCurrency: 'USD',
    },
    additional: {
      hasMedicalCondition: '',
      medicalDetails: '',
      hasCriminalRecord: '',
      criminalRecordDetails: '',
      hasTravelledAbroad: '',
      travelledCountries: '',
      hasFamilyAbroad: '',
      familyAbroadCountries: '',
      hasProfessionalExams: '',
      professionalExamsNotes: '',
    },
    consent: { acceptedTerms: false, acceptedPrivacy: false },
    honey: '',
  };
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

export type StepId =
  | 'personal'
  | 'passport'
  | 'education'
  | 'employment'
  | 'previous-employment'
  | 'skills'
  | 'languages'
  | 'preferences'
  | 'additional'
  | 'cv'
  | 'review';

export type StepDefinition = {
  id: StepId;
  /** Short label for the progress indicator. */
  label: string;
  /** Heading shown above the step's fields. */
  title: string;
  /** One sentence on why the agency asks for this. */
  description: string;
};

/**
 * The eleven steps, in order.
 *
 * Order is deliberate: the two hardest fields (passport dates, CV) come after the
 * applicant has already invested a little effort, and the consent gate sits on
 * the final review step where it can be read in context.
 */
export const STEPS: readonly StepDefinition[] = [
  {
    id: 'personal',
    label: 'Personal',
    title: 'Personal information',
    description: 'Who you are and how we can reach you.',
  },
  {
    id: 'passport',
    label: 'Passport',
    title: 'International passport',
    description: 'Whether you hold a passport, and when it expires.',
  },
  {
    id: 'education',
    label: 'Education',
    title: 'Education',
    description: 'Your qualifications and where you completed them.',
  },
  {
    id: 'employment',
    label: 'Employment',
    title: 'Current employment',
    description: 'What you do now — or tell us if you are not currently working.',
  },
  {
    id: 'previous-employment',
    label: 'History',
    title: 'Previous employment',
    description: 'Your recent work history, most recent first.',
  },
  {
    id: 'skills',
    label: 'Skills',
    title: 'Professional skills',
    description: 'The trades and professions you can evidence.',
  },
  {
    id: 'languages',
    label: 'Languages',
    title: 'Languages',
    description: 'How well you speak each language we place workers in.',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    title: 'Employment preferences',
    description: 'Where you would like to work and what you expect to earn.',
  },
  {
    id: 'additional',
    label: 'Additional',
    title: 'Additional information',
    description:
      'Medical, legal and travel questions. Answer honestly — this is confidential.',
  },
  {
    id: 'cv',
    label: 'CV',
    title: 'Your CV',
    description: 'A PDF or Word document, up to 10 MB.',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Review and submit',
    description: 'Check your answers, then accept the Terms and Privacy Policy.',
  },
] as const;

export const LAST_STEP_INDEX = STEPS.length - 1;
