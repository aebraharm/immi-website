/**
 * Shared, application-wide enumerations.
 *
 * These live in SQLite as CHECK-constrained TEXT columns (Drizzle's
 * `text({ enum: [...] })`), which keeps the database portable across
 * libSQL/Turso while still rejecting invalid values at the storage layer.
 */

/* -------------------------------------------------------------------------- */
/* Administration                                                             */
/* -------------------------------------------------------------------------- */

export const ADMIN_ROLES = ['owner', 'admin', 'editor'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/* -------------------------------------------------------------------------- */
/* Publishing lifecycle (applies to all content tables)                       */
/* -------------------------------------------------------------------------- */

export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

export const STORAGE_PROVIDERS = ['blobs', 'local'] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export const MEDIA_VISIBILITIES = ['public', 'private'] as const;
export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];

/**
 * Groups media by the job it does in the product. Used for admin filtering,
 * for storage path layout, and to decide which MIME types are acceptable.
 */
export const MEDIA_PURPOSES = [
  'logo',
  'favicon',
  'flag',
  'destination',
  'team',
  'testimonial-photo',
  'testimonial-video',
  'service',
  'homepage',
  'page',
  'seo',
  'cv',
  'other',
] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

/* -------------------------------------------------------------------------- */
/* Destinations                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The fixed shape of an immigration-process entry. One row per bullet the
 * administrator enters, grouped by category. Nothing here is pre-populated:
 * every value is typed in by an administrator.
 */
export const DESTINATION_REQUIREMENT_CATEGORIES = [
  'eligibility',
  'documents',
  'language',
  'qualification',
  'procedure',
  'notice',
  'link',
] as const;
export type DestinationRequirementCategory =
  (typeof DESTINATION_REQUIREMENT_CATEGORIES)[number];

/* -------------------------------------------------------------------------- */
/* Assessments                                                                */
/* -------------------------------------------------------------------------- */

export const ASSESSMENT_STATUSES = [
  'new',
  'under_review',
  'additional_info_required',
  'reviewed',
  'closed',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = [
  'single',
  'married',
  'divorced',
  'widowed',
  'separated',
  'other',
] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/** Section C — fixed by the specification, not administrator-editable. */
export const QUALIFICATION_LEVELS = [
  'secondary',
  'diploma',
  'bachelor',
  'master',
  'other',
] as const;
export type QualificationLevel = (typeof QUALIFICATION_LEVELS)[number];

/** Section D */
export const EMPLOYMENT_RECORD_TYPES = ['current', 'previous'] as const;
export type EmploymentRecordType = (typeof EMPLOYMENT_RECORD_TYPES)[number];

/** Section E — the exact list supplied in the requirements. */
export const SKILLS = [
  'accounting',
  'administration',
  'agriculture',
  'caregiving',
  'construction',
  'customer_service',
  'driving',
  'electrical',
  'engineering',
  'factory_worker',
  'healthcare_nursing',
  'hospitality',
  'it',
  'manufacturing',
  'sales',
  'security',
  'teaching',
  'truck_driving',
  'warehouse_operations',
  'welding',
] as const;
export type Skill = (typeof SKILLS)[number];

/** Section F */
export const LANGUAGES = ['english', 'french', 'spanish', 'german'] as const;
export type Language = (typeof LANGUAGES)[number];

export const PROFICIENCY_LEVELS = [
  'basic',
  'intermediate',
  'advanced',
  'fluent',
] as const;
export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

/** Section M — accepted CV formats, enforced by the server. */
export const CV_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ASSESSMENT_ATTACHMENT_KINDS = ['cv'] as const;
export type AssessmentAttachmentKind =
  (typeof ASSESSMENT_ATTACHMENT_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

/** Canonical action verbs for the audit trail. */
export const ACTIVITY_ACTIONS = [
  'admin.login',
  'admin.login_failed',
  'admin.logout',
  'admin.password_changed',
  'admin.sessions_revoked',
  'admin.created',
  'admin.updated',
  'admin.deactivated',
  'content.created',
  'content.updated',
  'content.published',
  'content.unpublished',
  'content.archived',
  'content.deleted',
  'media.uploaded',
  'media.archived',
  'media.deleted',
  'settings.updated',
  'assessment.submitted',
  'assessment.viewed',
  'assessment.status_changed',
  'assessment.note_added',
  'assessment.note_deleted',
  'assessment.attachment_downloaded',
  'assessment.deleted',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
