/**
 * Administrator-facing assessment queries.
 *
 * Everything an administrator can see about an applicant passes through this
 * module. It is the single place that knows which columns are applicant data, so
 * the review of "can applicant data leak?" has one file to read.
 *
 * Rules this module keeps:
 *
 *  - **No public caller.** Every exported function is reached only from an admin
 *    API route or an admin page, both of which run the session + role guard
 *    first. Nothing here is imported by a public read path.
 *  - **List rows are thin.** The inbox selects a dozen columns; the long
 *    free-text answers (medical details, criminal-record details, addresses) are
 *    only ever selected for a single record by `getAssessmentDetail`.
 *  - **Search is bounded.** A needle is trimmed, capped and escaped before it
 *    becomes a `LIKE` pattern, and the total row count is computed with the same
 *    filters so the page count cannot disagree with the rows.
 *  - **Sorting is a closed set.** A `?sort=` value is looked up in a table; an
 *    unknown one falls back to newest-first instead of reaching SQL.
 */

import { and, asc, count, desc, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm';

import { getDb } from '@/db';
import type { AssessmentStatus } from '@/db/schema/enums';
import {
  applicantEducation,
  applicantEmployment,
  applicantExaminations,
  applicantFamilyAbroad,
  applicantLanguages,
  applicantSkills,
  applicantTravelHistory,
  assessmentAttachments,
  assessmentNotes,
  assessmentStatusHistory,
  assessments,
  consentRecords,
} from '@/db/schema/assessments';
import { admins } from '@/db/schema/auth';
import { countries } from '@/db/schema/destinations';
import { mediaAssets } from '@/db/schema/media';
import { activityLogs } from '@/db/schema/operations';

import { ASSESSMENT_STATUS_ORDER, isAssessmentStatus } from './status';

/* -------------------------------------------------------------------------- */
/* Listing                                                                    */
/* -------------------------------------------------------------------------- */

export const ASSESSMENT_PAGE_SIZES = [10, 25, 50] as const;
export const ASSESSMENT_DEFAULT_PAGE_SIZE = 25;

export type AssessmentSortKey = 'submitted' | 'applicant' | 'reference' | 'status';

export type AssessmentListFilters = {
  search?: string;
  status?: AssessmentStatus | 'all';
  /** Inclusive lower bound, ISO `YYYY-MM-DD`, matched against the submission date. */
  from?: string;
  /** Inclusive upper bound, ISO `YYYY-MM-DD`. */
  to?: string;
  sort?: AssessmentSortKey;
  direction?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type AssessmentListRow = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  nationality: string;
  countryOfResidence: string;
  preferredCountryText: string;
  preferredOccupation: string;
  status: AssessmentStatus;
  submittedAt: Date;
  hasCv: boolean;
  noteCount: number;
};

export type AssessmentListResult = {
  rows: AssessmentListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** Longest needle we will look for. Anything beyond this is not a search. */
const MAX_SEARCH_LENGTH = 120;

/**
 * Escape a value for a `LIKE` pattern.
 *
 * SQLite treats `%` and `_` as wildcards and `\` as the escape character. Without
 * this an applicant named "100%" — or a probe typed as `%` — would match every
 * row, so the search would quietly stop filtering.
 */
function likePattern(raw: string): string {
  const needle = raw.trim().slice(0, MAX_SEARCH_LENGTH).toLowerCase();
  return `%${needle.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** `YYYY-MM-DD` → the UTC instant at the start of that day, or null. */
function startOfDay(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `YYYY-MM-DD` → the last millisecond of that day (inclusive upper bound). */
function endOfDay(value: string | undefined): Date | null {
  const start = startOfDay(value);
  if (!start) return null;
  return new Date(start.getTime() + 86_400_000 - 1);
}

/**
 * Workflow order for a status column.
 *
 * Sorting by the raw text would put "Closed" before "New" and read as nonsense to
 * an administrator triaging a queue, so the sort follows the numbered workflow.
 */
const STATUS_RANK = sql.join(
  [
    sql`case`,
    ...ASSESSMENT_STATUS_ORDER.map(
      (status, index) => sql`when ${assessments.status} = ${status} then ${index}`,
    ),
    sql`else ${ASSESSMENT_STATUS_ORDER.length} end`,
  ],
  sql` `,
);

function applyFilters(filters: AssessmentListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.status && filters.status !== 'all' && isAssessmentStatus(filters.status)) {
    conditions.push(eq(assessments.status, filters.status));
  }

  const from = startOfDay(filters.from);
  if (from) conditions.push(gte(assessments.submittedAt, from));

  const to = endOfDay(filters.to);
  if (to) conditions.push(lte(assessments.submittedAt, to));

  const raw = filters.search?.trim();
  if (raw && raw.length > 0) {
    const pattern = likePattern(raw);
    // Name, email and reference: the three identifiers an administrator has when
    // an applicant rings the office.
    const matches = or(
      sql`lower(${assessments.fullName}) like ${pattern}`,
      sql`lower(${assessments.email}) like ${pattern}`,
      sql`lower(${assessments.referenceNumber}) like ${pattern}`,
    );
    if (matches) conditions.push(matches);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function applySort(sort: AssessmentSortKey | undefined, direction: 'asc' | 'desc') {
  const dir = direction === 'asc' ? asc : desc;

  switch (sort) {
    case 'applicant':
      return [dir(assessments.fullName), desc(assessments.submittedAt)];
    case 'reference':
      return [dir(assessments.referenceNumber)];
    case 'status':
      return [dir(STATUS_RANK), desc(assessments.submittedAt)];
    case 'submitted':
    default:
      // Tie-break on the reference so two submissions in the same second keep a
      // stable order between pages.
      return [dir(assessments.submittedAt), asc(assessments.referenceNumber)];
  }
}

/**
 * One page of the assessment inbox.
 *
 * The row count and the page of rows are computed from the same filter
 * expression, so a filtered search can never claim more pages than it has.
 */
export async function listAssessments(
  filters: AssessmentListFilters = {},
): Promise<AssessmentListResult> {
  const db = getDb();
  const where = applyFilters(filters);

  const pageSize = ASSESSMENT_PAGE_SIZES.includes(
    (filters.pageSize ?? ASSESSMENT_DEFAULT_PAGE_SIZE) as (typeof ASSESSMENT_PAGE_SIZES)[number],
  )
    ? (filters.pageSize as number)
    : ASSESSMENT_DEFAULT_PAGE_SIZE;

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: count() })
    .from(assessments)
    .where(where);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(filters.page ?? 1) || 1, 1), pageCount);

  // Correlated sub-selects rather than joins: a join to notes or attachments
  // would multiply the assessment rows and break the limit/offset window.
  const rows = await db
    .select({
      id: assessments.id,
      referenceNumber: assessments.referenceNumber,
      fullName: assessments.fullName,
      email: assessments.email,
      nationality: assessments.nationality,
      countryOfResidence: assessments.countryOfResidence,
      preferredCountryText: assessments.preferredCountryText,
      preferredOccupation: assessments.preferredOccupation,
      status: assessments.status,
      submittedAt: assessments.submittedAt,
      hasCv: sql<boolean>`exists (
        select 1 from ${assessmentAttachments}
        where ${assessmentAttachments.assessmentId} = ${assessments.id}
      )`,
      noteCount: sql<number>`(
        select count(*) from ${assessmentNotes}
        where ${assessmentNotes.assessmentId} = ${assessments.id}
      )`,
    })
    .from(assessments)
    .where(where)
    .orderBy(...applySort(filters.sort, filters.direction === 'asc' ? 'asc' : 'desc'))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((row) => ({
      ...row,
      status: row.status as AssessmentStatus,
      hasCv: Boolean(row.hasCv),
      noteCount: Number(row.noteCount ?? 0),
    })),
    total,
    page,
    pageSize,
    pageCount,
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard summary                                                          */
/* -------------------------------------------------------------------------- */

export type AssessmentSummary = {
  total: number;
  /** One entry per status, in workflow order. Every status is always present. */
  byStatus: Record<AssessmentStatus, number>;
};

/**
 * Real `count()` totals for the dashboard.
 *
 * Grouped in one query and then filled out to include zeroes, so a status with no
 * applications still renders as `0` rather than vanishing from the panel.
 */
export async function getAssessmentSummary(): Promise<AssessmentSummary> {
  const db = getDb();

  const [totals, grouped] = await Promise.all([
    db.select({ value: count() }).from(assessments),
    db
      .select({ status: assessments.status, value: count() })
      .from(assessments)
      .groupBy(assessments.status),
  ]);

  const byStatus = Object.fromEntries(
    ASSESSMENT_STATUS_ORDER.map((status) => [status, 0]),
  ) as Record<AssessmentStatus, number>;

  for (const row of grouped) {
    if (isAssessmentStatus(row.status)) byStatus[row.status] = row.value;
  }

  return { total: totals[0]?.value ?? 0, byStatus };
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

export type AssessmentAttachmentFile = {
  id: string;
  mediaAssetId: string;
  kind: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  /** True when the registry row is gone; the download is then unavailable. */
  isMissing: boolean;
};

export type AssessmentDetail = {
  assessment: typeof assessments.$inferSelect;
  consent: typeof consentRecords.$inferSelect | null;
  preferredCountryName: string | null;
  education: Array<typeof applicantEducation.$inferSelect>;
  employment: Array<typeof applicantEmployment.$inferSelect>;
  skills: Array<typeof applicantSkills.$inferSelect>;
  languages: Array<typeof applicantLanguages.$inferSelect>;
  examinations: Array<typeof applicantExaminations.$inferSelect>;
  travel: Array<typeof applicantTravelHistory.$inferSelect>;
  familyAbroad: Array<typeof applicantFamilyAbroad.$inferSelect>;
  attachments: AssessmentAttachmentFile[];
  notes: Array<{
    id: string;
    body: string;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    authorName: string | null;
    authorEmail: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string;
    createdAt: Date;
    adminName: string | null;
    adminEmail: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    summary: string;
    actorEmail: string | null;
    createdAt: Date;
  }>;
};

/**
 * Everything about one application.
 *
 * Returns null when the id does not exist, so the caller can render a 404 rather
 * than an empty page that looks like a record with no data.
 *
 * Attachments are described by *filename, type and size only* — the storage key
 * is deliberately not selected here, so no page, JSON response or client
 * component ever holds the location of a private file. The download route looks
 * the key up itself, at the moment of the download.
 */
export async function getAssessmentDetail(id: string): Promise<AssessmentDetail | null> {
  const db = getDb();

  const [row] = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
  if (!row) return null;

  const [
    consentRows,
    countryRows,
    educationRows,
    employmentRows,
    skillsRows,
    languagesRows,
    examinationRows,
    travelRows,
    familyRows,
    attachmentRows,
    noteRows,
    historyRows,
    activityRows,
  ] = await Promise.all([
    db.select().from(consentRecords).where(eq(consentRecords.assessmentId, id)).limit(1),
    row.preferredCountryId
      ? db
          .select({ name: countries.name })
          .from(countries)
          .where(eq(countries.id, row.preferredCountryId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(applicantEducation)
      .where(eq(applicantEducation.assessmentId, id))
      .orderBy(asc(applicantEducation.displayOrder)),
    db
      .select()
      .from(applicantEmployment)
      .where(eq(applicantEmployment.assessmentId, id))
      .orderBy(asc(applicantEmployment.recordType), asc(applicantEmployment.displayOrder)),
    db
      .select()
      .from(applicantSkills)
      .where(eq(applicantSkills.assessmentId, id))
      .orderBy(asc(applicantSkills.skill)),
    db
      .select()
      .from(applicantLanguages)
      .where(eq(applicantLanguages.assessmentId, id))
      .orderBy(asc(applicantLanguages.language)),
    db
      .select()
      .from(applicantExaminations)
      .where(eq(applicantExaminations.assessmentId, id))
      .orderBy(asc(applicantExaminations.displayOrder)),
    db
      .select()
      .from(applicantTravelHistory)
      .where(eq(applicantTravelHistory.assessmentId, id))
      .orderBy(asc(applicantTravelHistory.displayOrder)),
    db
      .select()
      .from(applicantFamilyAbroad)
      .where(eq(applicantFamilyAbroad.assessmentId, id))
      .orderBy(asc(applicantFamilyAbroad.displayOrder)),
    db
      .select({
        id: assessmentAttachments.id,
        mediaAssetId: assessmentAttachments.mediaAssetId,
        kind: assessmentAttachments.kind,
        createdAt: assessmentAttachments.createdAt,
        originalFilename: mediaAssets.originalFilename,
        detectedMimeType: mediaAssets.detectedMimeType,
        sizeBytes: mediaAssets.sizeBytes,
      })
      .from(assessmentAttachments)
      // LEFT JOIN on purpose: an attachment whose registry row has gone is
      // reported as unavailable in the interface instead of disappearing.
      .leftJoin(mediaAssets, eq(mediaAssets.id, assessmentAttachments.mediaAssetId))
      .where(eq(assessmentAttachments.assessmentId, id))
      .orderBy(asc(assessmentAttachments.createdAt)),
    db
      .select({
        id: assessmentNotes.id,
        body: assessmentNotes.body,
        isPinned: assessmentNotes.isPinned,
        createdAt: assessmentNotes.createdAt,
        updatedAt: assessmentNotes.updatedAt,
        authorName: admins.fullName,
        authorEmail: admins.email,
      })
      .from(assessmentNotes)
      .leftJoin(admins, eq(admins.id, assessmentNotes.adminId))
      .where(eq(assessmentNotes.assessmentId, id))
      .orderBy(desc(assessmentNotes.isPinned), desc(assessmentNotes.createdAt)),
    db
      .select({
        id: assessmentStatusHistory.id,
        fromStatus: assessmentStatusHistory.fromStatus,
        toStatus: assessmentStatusHistory.toStatus,
        note: assessmentStatusHistory.note,
        createdAt: assessmentStatusHistory.createdAt,
        adminName: admins.fullName,
        adminEmail: admins.email,
      })
      .from(assessmentStatusHistory)
      .leftJoin(admins, eq(admins.id, assessmentStatusHistory.adminId))
      .where(eq(assessmentStatusHistory.assessmentId, id))
      .orderBy(desc(assessmentStatusHistory.createdAt)),
    db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        summary: activityLogs.summary,
        actorEmail: activityLogs.actorEmailSnapshot,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .where(and(eq(activityLogs.entityType, 'assessment'), eq(activityLogs.entityId, id)))
      .orderBy(desc(activityLogs.createdAt))
      .limit(25),
  ]);

  return {
    assessment: row,
    consent: consentRows[0] ?? null,
    preferredCountryName: countryRows[0]?.name ?? null,
    education: educationRows,
    employment: employmentRows,
    skills: skillsRows,
    languages: languagesRows,
    examinations: examinationRows,
    travel: travelRows,
    familyAbroad: familyRows,
    attachments: attachmentRows.map((attachment) => ({
      id: attachment.id,
      mediaAssetId: attachment.mediaAssetId,
      kind: attachment.kind,
      originalFilename: attachment.originalFilename ?? 'Attachment unavailable',
      mimeType: attachment.detectedMimeType ?? 'application/octet-stream',
      sizeBytes: attachment.sizeBytes ?? 0,
      uploadedAt: attachment.createdAt,
      isMissing: attachment.originalFilename === null,
    })),
    notes: noteRows,
    statusHistory: historyRows,
    activity: activityRows,
  };
}

/* -------------------------------------------------------------------------- */
/* CV lookup (download authorisation)                                         */
/* -------------------------------------------------------------------------- */

export type DownloadableAttachment = {
  assessmentId: string;
  referenceNumber: string;
  attachmentId: string;
  mediaAssetId: string;
  kind: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  isArchived: boolean;
};

/**
 * Resolve an attachment for a *named assessment*.
 *
 * Both ids are required and both are matched: an attachment that belongs to a
 * different assessment is indistinguishable from one that does not exist. That
 * means a valid attachment id — even one leaked from somewhere — is useless
 * without the assessment it belongs to, and a URL cannot be walked sideways to
 * another applicant's file.
 *
 * This is the only function in the application that returns a private storage
 * key, and its single caller is the download route, after the guard has run.
 */
export async function findAttachmentForDownload(
  assessmentId: string,
  attachmentId: string,
): Promise<DownloadableAttachment | null> {
  const db = getDb();

  const [row] = await db
    .select({
      assessmentId: assessments.id,
      referenceNumber: assessments.referenceNumber,
      attachmentId: assessmentAttachments.id,
      mediaAssetId: assessmentAttachments.mediaAssetId,
      kind: assessmentAttachments.kind,
      storageKey: mediaAssets.storageKey,
      visibility: mediaAssets.visibility,
      purpose: mediaAssets.purpose,
      originalFilename: mediaAssets.originalFilename,
      mimeType: mediaAssets.detectedMimeType,
      sizeBytes: mediaAssets.sizeBytes,
      archivedAt: mediaAssets.archivedAt,
    })
    .from(assessmentAttachments)
    .innerJoin(assessments, eq(assessments.id, assessmentAttachments.assessmentId))
    .innerJoin(mediaAssets, eq(mediaAssets.id, assessmentAttachments.mediaAssetId))
    .where(
      and(
        eq(assessmentAttachments.id, attachmentId),
        eq(assessmentAttachments.assessmentId, assessmentId),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Defence in depth. A private CV that somehow reached the registry with the
  // wrong visibility must never be served — refuse rather than trust the join.
  if (row.visibility !== 'private') return null;

  return {
    assessmentId: row.assessmentId,
    referenceNumber: row.referenceNumber,
    attachmentId: row.attachmentId,
    mediaAssetId: row.mediaAssetId,
    kind: row.kind,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    isArchived: row.archivedAt !== null,
  };
}

/** Count of applications that have never been touched — the "needs attention" figure. */
export async function countUnopenedAssessments(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(assessments)
    .where(and(eq(assessments.status, 'new'), isNull(assessments.reviewedAt)));
  return row?.value ?? 0;
}
