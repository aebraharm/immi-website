import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { admins } from './auth';
import { countries } from './destinations';
import { mediaAssets } from './media';
import {
  ASSESSMENT_ATTACHMENT_KINDS,
  ASSESSMENT_STATUSES,
  EMPLOYMENT_RECORD_TYPES,
  GENDERS,
  LANGUAGES,
  MARITAL_STATUSES,
  PROFICIENCY_LEVELS,
  QUALIFICATION_LEVELS,
  SKILLS,
} from './enums';

/* -------------------------------------------------------------------------- */
/* Consent                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Immutable record of what an applicant agreed to, and to which version.
 *
 * `termsVersion` / `privacyVersion` and `consentText` are SNAPSHOTS taken at the
 * moment of submission. Editing or republishing the Terms later increments
 * `website_pages.version` but can never rewrite these rows — which is exactly
 * the "do not silently change the terms version associated with an existing
 * submission" requirement.
 */
export const consentRecords = sqliteTable(
  'consent_records',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** NULL until the assessment row exists; back-linked in the same tx. */
    assessmentId: text('assessment_id'),

    termsPageId: text('terms_page_id').notNull(),
    termsVersion: integer('terms_version').notNull(),
    privacyPageId: text('privacy_page_id').notNull(),
    privacyVersion: integer('privacy_version').notNull(),

    /** The literal wording displayed next to the checkbox. */
    consentText: text('consent_text').notNull(),

    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }).notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
  },
  (table) => [
    uniqueIndex('consent_records_assessment_unique').on(table.assessmentId),
    index('consent_records_accepted_at_idx').on(table.acceptedAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Assessment (root record)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A submitted client assessment.
 *
 * This table holds personal data and, in `medicalDetails` and
 * `criminalRecordDetails`, special-category data. Every read path must pass an
 * authenticated administrator check; no public route or API ever selects these
 * columns. Detail lists (education, employment, skills, …) live in child
 * tables so the record stays normalised and queryable.
 */
export const assessments = sqliteTable(
  'assessments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** Human-facing, e.g. IMA-2026-7QK3M2XA. Unique, generated server-side. */
    referenceNumber: text('reference_number').notNull(),

    /**
     * Client-generated UUID sent with the submission. A UNIQUE constraint on it
     * makes retries after a network failure return the existing reference
     * instead of creating a duplicate record.
     */
    idempotencyKey: text('idempotency_key'),

    /* ---------------- Section A — Personal information ---------------- */
    fullName: text('full_name').notNull(),
    /** ISO `YYYY-MM-DD` string: avoids timezone drift for date-only values. */
    dateOfBirth: text('date_of_birth').notNull(),
    gender: text('gender', { enum: GENDERS }).notNull(),
    nationality: text('nationality').notNull(),
    countryOfResidence: text('country_of_residence').notNull(),

    residentialAddress: text('residential_address').notNull(),
    city: text('city').notNull(),
    stateProvince: text('state_province').notNull(),
    postalCode: text('postal_code').notNull(),

    mobileCountryCode: text('mobile_country_code').notNull(),
    mobileNumber: text('mobile_number').notNull(),
    altMobileCountryCode: text('alt_mobile_country_code').notNull().default(''),
    altMobileNumber: text('alt_mobile_number').notNull().default(''),

    /** Stored lowercased for consistent searching. */
    email: text('email').notNull(),

    maritalStatus: text('marital_status', { enum: MARITAL_STATUSES }).notNull(),
    hasChildren: integer('has_children', { mode: 'boolean' }).notNull(),
    numberOfChildren: integer('number_of_children'),

    /* ---------------- Section B — International passport ---------------- */
    hasPassport: integer('has_passport', { mode: 'boolean' }).notNull(),
    passportNumber: text('passport_number'),
    passportCityOfIssue: text('passport_city_of_issue'),
    passportIssueDate: text('passport_issue_date'),
    passportExpiryDate: text('passport_expiry_date'),

    /* ---------------- Section G — Preferred employment ---------------- */
    preferredCountryId: text('preferred_country_id').references(
      () => countries.id,
      { onDelete: 'set null' },
    ),
    /** Denormalised fallback so the record survives a country being archived. */
    preferredCountryText: text('preferred_country_text').notNull().default(''),
    preferredOccupation: text('preferred_occupation').notNull(),
    expectedSalaryAmount: integer('expected_salary_amount'),
    expectedSalaryCurrency: text('expected_salary_currency').notNull().default(''),

    /* ---------------- Section H — Medical (SENSITIVE) ---------------- */
    hasMedicalCondition: integer('has_medical_condition', {
      mode: 'boolean',
    }).notNull(),
    medicalDetails: text('medical_details'),

    /* ---------------- Section I — Criminal record (SENSITIVE) --------- */
    hasCriminalRecord: integer('has_criminal_record', { mode: 'boolean' })
      .notNull(),
    criminalRecordDetails: text('criminal_record_details'),

    /* ---------------- Section J — Travel history ---------------- */
    hasTravelledAbroad: integer('has_travelled_abroad', { mode: 'boolean' })
      .notNull(),
    travelledCountries: text('travelled_countries'),

    /* ---------------- Section K — Family abroad ---------------- */
    hasFamilyAbroad: integer('has_family_abroad', { mode: 'boolean' }).notNull(),
    familyAbroadCountries: text('family_abroad_countries'),

    /* ---------------- Section L — Examinations ---------------- */
    hasProfessionalExams: integer('has_professional_exams', {
      mode: 'boolean',
    }).notNull(),
    professionalExamsNotes: text('professional_exams_notes'),

    /* ---------------- Lifecycle ---------------- */
    status: text('status', { enum: ASSESSMENT_STATUSES }).notNull().default('new'),

    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }).notNull(),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    reviewedBy: text('reviewed_by').references(() => admins.id, {
      onDelete: 'set null',
    }),

    /** SHA-256 of the submission IP — abuse correlation without storing IPs. */
    submissionIpHash: text('submission_ip_hash'),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('assessments_reference_unique').on(table.referenceNumber),
    uniqueIndex('assessments_idempotency_unique').on(table.idempotencyKey),
    index('assessments_email_idx').on(table.email),
    index('assessments_submitted_at_idx').on(table.submittedAt),
    index('assessments_status_idx').on(table.status),
    index('assessments_preferred_country_idx').on(table.preferredCountryId),
    index('assessments_full_name_idx').on(table.fullName),
    // Children count only makes sense when the applicant has children.
    check(
      'assessments_children_consistency',
      sql`(${table.hasChildren} = 1 AND ${table.numberOfChildren} IS NOT NULL)
          OR (${table.hasChildren} = 0 AND ${table.numberOfChildren} IS NULL)`,
    ),
    // Passport fields are present only when the applicant holds a passport.
    check(
      'assessments_passport_consistency',
      sql`(${table.hasPassport} = 1 AND ${table.passportNumber} IS NOT NULL)
          OR (${table.hasPassport} = 0 AND ${table.passportNumber} IS NULL)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Assessment child records                                                   */
/* -------------------------------------------------------------------------- */

/** Section C — multiple qualifications per applicant. */
export const applicantEducation = sqliteTable(
  'applicant_education',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    qualificationLevel: text('qualification_level', {
      enum: QUALIFICATION_LEVELS,
    }).notNull(),
    institutionName: text('institution_name').notNull(),
    country: text('country').notNull(),
    yearCompleted: integer('year_completed').notNull(),

    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('applicant_education_assessment_idx').on(
      table.assessmentId,
      table.displayOrder,
    ),
  ],
);

/**
 * Section D — employment history.
 *
 * `record_type` separates the single current-employment entry from the
 * repeatable previous-employment entries. Both are the same shape, so they
 * share one table and one list editor.
 */
export const applicantEmployment = sqliteTable(
  'applicant_employment',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    recordType: text('record_type', { enum: EMPLOYMENT_RECORD_TYPES }).notNull(),

    employerName: text('employer_name').notNull(),
    position: text('position').notNull(),
    country: text('country').notNull(),

    /** ISO month `YYYY-MM` for current employment. */
    startDate: text('start_date'),
    /** ISO month `YYYY-MM`, previous employment only. */
    endDate: text('end_date'),
    /** Years worked — the unit the specification asks for on previous roles. */
    yearsWorked: integer('years_worked'),

    monthlySalaryAmount: integer('monthly_salary_amount'),
    monthlySalaryCurrency: text('monthly_salary_currency').notNull().default(''),

    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('applicant_employment_assessment_idx').on(
      table.assessmentId,
      table.recordType,
      table.displayOrder,
    ),
  ],
);

/** Section E — multi-select skills, validated against the fixed allowlist. */
export const applicantSkills = sqliteTable(
  'applicant_skills',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    skill: text('skill', { enum: SKILLS }).notNull(),
  },
  (table) => [
    uniqueIndex('applicant_skills_unique').on(table.assessmentId, table.skill),
  ],
);

/** Section F — one proficiency level per language. */
export const applicantLanguages = sqliteTable(
  'applicant_languages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    language: text('language', { enum: LANGUAGES }).notNull(),
    proficiency: text('proficiency', { enum: PROFICIENCY_LEVELS }).notNull(),
  },
  (table) => [
    uniqueIndex('applicant_languages_unique').on(
      table.assessmentId,
      table.language,
    ),
  ],
);

/** Section L — professional examinations / licences (IELTS, NCLEX, AHPRA, …). */
export const applicantExaminations = sqliteTable(
  'applicant_examinations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    examinationName: text('examination_name').notNull(),
    /** Result, score, or free-form notes — administrator/applicant supplied. */
    resultNotes: text('result_notes').notNull().default(''),

    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('applicant_examinations_assessment_idx').on(
      table.assessmentId,
      table.displayOrder,
    ),
  ],
);

/** Section J — structured travel history (one row per country visited). */
export const applicantTravelHistory = sqliteTable(
  'applicant_travel_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    country: text('country').notNull(),
    notes: text('notes').notNull().default(''),

    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('applicant_travel_history_assessment_idx').on(
      table.assessmentId,
      table.displayOrder,
    ),
  ],
);

/** Section K — family members living abroad. */
export const applicantFamilyAbroad = sqliteTable(
  'applicant_family_abroad',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    country: text('country').notNull(),
    relationship: text('relationship').notNull().default(''),

    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('applicant_family_abroad_assessment_idx').on(
      table.assessmentId,
      table.displayOrder,
    ),
  ],
);

/**
 * Section M — uploaded CV (and any future attachment kind).
 *
 * `ON DELETE RESTRICT` on both sides is deliberate: deleting an assessment or a
 * media row must never silently orphan or destroy a private applicant document.
 * Removal is an explicit, logged operation.
 */
export const assessmentAttachments = sqliteTable(
  'assessment_attachments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'restrict' }),

    mediaAssetId: text('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),

    kind: text('kind', { enum: ASSESSMENT_ATTACHMENT_KINDS })
      .notNull()
      .default('cv'),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('assessment_attachments_assessment_idx').on(table.assessmentId),
    uniqueIndex('assessment_attachments_media_unique').on(table.mediaAssetId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Assessment management                                                      */
/* -------------------------------------------------------------------------- */

/** Internal, administrator-only notes. Never exposed publicly. */
export const assessmentNotes = sqliteTable(
  'assessment_notes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    adminId: text('admin_id').references(() => admins.id, {
      onDelete: 'set null',
    }),

    body: text('body').notNull(),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('assessment_notes_assessment_idx').on(table.assessmentId, table.createdAt),
  ],
);

/** Append-only status trail: every change is attributable and timestamped. */
export const assessmentStatusHistory = sqliteTable(
  'assessment_status_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),

    fromStatus: text('from_status', { enum: ASSESSMENT_STATUSES }),
    toStatus: text('to_status', { enum: ASSESSMENT_STATUSES }).notNull(),

    adminId: text('admin_id').references(() => admins.id, {
      onDelete: 'set null',
    }),
    note: text('note').notNull().default(''),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('assessment_status_history_assessment_idx').on(
      table.assessmentId,
      table.createdAt,
    ),
  ],
);

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type NewConsentRecord = typeof consentRecords.$inferInsert;
export type ApplicantEducation = typeof applicantEducation.$inferSelect;
export type ApplicantEmployment = typeof applicantEmployment.$inferSelect;
export type ApplicantSkill = typeof applicantSkills.$inferSelect;
export type ApplicantLanguage = typeof applicantLanguages.$inferSelect;
export type ApplicantExamination = typeof applicantExaminations.$inferSelect;
export type ApplicantTravelHistory = typeof applicantTravelHistory.$inferSelect;
export type ApplicantFamilyAbroad = typeof applicantFamilyAbroad.$inferSelect;
export type AssessmentAttachment = typeof assessmentAttachments.$inferSelect;
export type AssessmentNote = typeof assessmentNotes.$inferSelect;
export type AssessmentStatusHistory = typeof assessmentStatusHistory.$inferSelect;
