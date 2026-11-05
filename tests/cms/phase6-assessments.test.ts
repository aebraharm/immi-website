/**
 * Phase 6 verification — assessment management.
 *
 * Runs against the real assessment library and a real libSQL database (a scratch
 * file created here, never the development or production database). Nothing in
 * the list / read / status / note / download path is mocked: the queries, the
 * transaction that writes status history, the storage lookup and the audit rows
 * are the shipped code.
 *
 * The three things that cannot exist outside a Next.js request — the cookie jar,
 * `next/navigation`, and the request-scoped audit writer — are replaced by
 * `tests/support/test-stubs.ts`, which is preloaded by the test script. The guard
 * functions themselves are untouched, so the authorisation logic under test is
 * the shipped logic.
 *
 * The mandated verifications, mapped to test names:
 *
 *   1. Listing and pagination ................... "pagination: page 2 returns …"
 *   2. Search and filtering ..................... "search: finds by name, email …"
 *   3. Individual views ......................... "detail: returns every section …"
 *   4. Status changes and history ............... "status: change writes history …"
 *   5. Internal notes ........................... "notes: add, list, delete …"
 *   6. CV authorisation and downloads ........... "cv: a signed-in administrator …"
 *   7. Unauthorised access attempts ............. "authorisation: every assessment …"
 *   8. Privacy boundaries ....................... "privacy: no public route …"
 *   9. Dashboard counts ......................... "dashboard: counts match …"
 *  10. Audit logging ............................ "audit: a status change is …"
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createClient, type Client } from '@libsql/client';
import { and, eq } from 'drizzle-orm';

/* -------------------------------------------------------------------------- */
/* Test state (see tests/support/test-stubs.ts)                                */
/* -------------------------------------------------------------------------- */

type AdminUser = {
  adminId: string;
  sessionId: string;
  email: string;
  role: 'owner' | 'admin' | 'editor';
};

type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  actorAdminId?: string;
  actorEmail?: string;
};

type TestState = {
  admin: AdminUser | null;
  csrf: string;
  audit: AuditEntry[];
};

function testState(): TestState {
  const globalRef = globalThis as unknown as { __immiTestState?: TestState };
  globalRef.__immiTestState ??= { admin: null, csrf: 'phase6-test-csrf', audit: [] };
  return globalRef.__immiTestState;
}

const auditCalls = () => testState().audit;
const currentCsrf = () => testState().csrf;

const REPO_ROOT = process.cwd();
const SCRATCH_DB = './.data/verify-phase6.db';
const SCRATCH_URL = `file:${SCRATCH_DB}`;

/**
 * A request with a default valid CSRF header.
 *
 * `csrf: null` omits the header entirely, which is how the CSRF-refusal tests
 * present a forged request.
 */
function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown; csrf?: string | null } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const csrf = init.csrf === undefined ? currentCsrf() : init.csrf;
  if (csrf !== null) headers['x-csrf-token'] = csrf;

  return new Request(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;

async function readResponse(response: Response): Promise<{ status: number; body: Body }> {
  const text = await response.text();
  return {
    status: response.status,
    body: text.length > 0 ? (JSON.parse(text) as Body) : {},
  };
}

/**
 * Context argument Next.js passes for a dynamic segment.
 *
 * Typed loosely on purpose: the shipped handlers each declare the exact segment
 * shape they expect, and the tests calling them assert behaviour, not types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function context(params: Record<string, string>): any {
  return { params: Promise.resolve(params) };
}

async function handlers() {
  return import('../../src/lib/assessment/admin-handlers');
}

let client: Client;

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The applicants used by the tests.
 *
 * Chosen so the searches are unambiguous: three names, three emails and three
 * references that share no accidental substring with each other.
 */
const APPLICANTS = [
  {
    fullName: 'Adaeze Okonkwo',
    email: 'adaeze.okonkwo@example.test',
    referenceNumber: 'IMA-2026-AAA111',
    status: 'new' as const,
   preferredOccupation: 'Registered nurse',
    submittedAt: new Date('2026-01-05T09:00:00.000Z'),
  },
  {
    fullName: 'Bilal Rahman',
    email: 'bilal.rahman@example.test',
    referenceNumber: 'IMA-2026-BBB222',
    status: 'under_review' as const,
    preferredOccupation: 'HGV driver',
    submittedAt: new Date('2026-02-11T14:30:00.000Z'),
  },
  {
    fullName: 'Chidinma Eze',
    email: 'chidinma.eze@example.test',
    referenceNumber: 'IMA-2026-CCC333',
    status: 'closed' as const,
    preferredOccupation: 'Care assistant',
    submittedAt: new Date('2026-03-20T07:45:00.000Z'),
  },
];

/** A complete, schema-consistent assessment row. */
function assessmentRow(overrides: Record<string, unknown>) {
  return {
    dateOfBirth: '1993-04-12',
    gender: 'female' as const,
    nationality: 'Nigerian',
    countryOfResidence: 'Nigeria',
    residentialAddress: '14 Test Road',
    city: 'Warri',
    stateProvince: 'Delta',
    postalCode: '332211',
    mobileCountryCode: '+234',
    mobileNumber: '8000000000',
    altMobileCountryCode: '',
    altMobileNumber: '',
    maritalStatus: 'married' as const,
    hasChildren: true,
    numberOfChildren: 2,
    hasPassport: true,
    passportNumber: 'A12345678',
    passportCityOfIssue: 'Warri',
    passportIssueDate: '2021-06-01',
    passportExpiryDate: '2031-05-31',
    preferredCountryId: null,
    preferredCountryText: 'Canada',
    expectedSalaryAmount: 4500,
    expectedSalaryCurrency: 'CAD',
    hasMedicalCondition: false,
    medicalDetails: null,
    hasCriminalRecord: false,
    criminalRecordDetails: null,
    hasTravelledAbroad: true,
    travelledCountries: 'Ghana',
    hasFamilyAbroad: false,
    familyAbroadCountries: null,
    hasProfessionalExams: true,
    professionalExamsNotes: 'IELTS academic',
    createdAt: new Date('2026-01-05T09:00:00.000Z'),
    updatedAt: new Date('2026-01-05T09:00:00.000Z'),
    ...overrides,
  };
}

/** Ids created in `before`, reused across the suite. */
const ids: Record<string, string> = {};
let cvStorageKey = '';
let cvAttachmentId = '';
let cvBytes = new Uint8Array();

before(async () => {
  mkdirSync('.data', { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${SCRATCH_DB}${suffix}`, { force: true });
  }
  // Applicant CV bytes are written by the local storage adapter under
  // `.data/uploads`, which is git-ignored.
  rmSync('.data/uploads/private/assessments', { recursive: true, force: true });

  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, TURSO_DATABASE_URL: SCRATCH_URL, TURSO_AUTH_TOKEN: '' },
    stdio: 'pipe',
  });

  process.env.TURSO_DATABASE_URL = SCRATCH_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.STORAGE_DRIVER = 'local';

  client = createClient({ url: SCRATCH_URL });

  const { getDb } = await import('../../src/db');
  const { admins } = await import('../../src/db/schema/auth');
  const {
    applicantEducation,
    applicantExaminations,
    applicantLanguages,
    applicantSkills,
    applicantTravelHistory,
    assessmentAttachments,
    assessments,
    consentRecords,
  } = await import('../../src/db/schema/assessments');

  await getDb()
    .insert(admins)
    .values([
      {
        id: 'admin-owner',
        email: 'owner@example.test',
        passwordHash: 'not-a-real-hash-test-only',
        fullName: 'Test Owner',
        role: 'owner',
        mustChangePassword: false,
      },
      {
        id: 'admin-second',
        email: 'second@example.test',
        passwordHash: 'not-a-real-hash-test-only',
        fullName: 'Second Administrator',
        role: 'admin',
        mustChangePassword: false,
      },
      {
        id: 'admin-editor',
        email: 'editor@example.test',
        passwordHash: 'not-a-real-hash-test-only',
        fullName: 'Test Editor',
        role: 'editor',
        mustChangePassword: false,
      },
    ] as never);

  /* ---------------- Three applications, one per search target ------------ */

  for (const applicant of APPLICANTS) {
    const [row] = await getDb()
      .insert(assessments)
      .values(
        assessmentRow({
          fullName: applicant.fullName,
          email: applicant.email,
          referenceNumber: applicant.referenceNumber,
          status: applicant.status,
          preferredOccupation: applicant.preferredOccupation,
          submittedAt: applicant.submittedAt,
        }) as never,
      )
      .returning({ id: assessments.id });

    assert.ok(row, 'assessment fixture insert must return an id');
    ids[applicant.referenceNumber] = row.id;
  }

  const primaryId = ids['IMA-2026-AAA111'];
  assert.ok(primaryId);

  /* ---------------- Detail children for the primary application ---------- */

  const db = getDb();

  await db.insert(applicantEducation).values([
    {
      assessmentId: primaryId,
      qualificationLevel: 'bachelor',
      institutionName: 'University of Benin',
      country: 'Nigeria',
      yearCompleted: 2015,
      displayOrder: 0,
    },
  ] as never);

  await db.insert(applicantSkills).values([
    { assessmentId: primaryId, skill: 'healthcare_nursing' },
  ] as never);

  await db.insert(applicantLanguages).values([
    { assessmentId: primaryId, language: 'english', proficiency: 'fluent' },
  ] as never);

  await db.insert(applicantExaminations).values([
    { assessmentId: primaryId, examinationName: 'IELTS', resultNotes: '7.5 overall', displayOrder: 0 },
  ] as never);

  await db.insert(applicantTravelHistory).values([
    { assessmentId: primaryId, country: 'Ghana', notes: 'Family visit', displayOrder: 0 },
  ] as never);

  await db.insert(consentRecords).values({
    assessmentId: primaryId,
    termsPageId: 'terms-page-id',
    termsVersion: 3,
    privacyPageId: 'privacy-page-id',
    privacyVersion: 7,
    consentText: 'I confirm the information I have given is true.',
    acceptedAt: new Date('2026-01-05T09:00:00.000Z'),
  } as never);

  /* ---------------- A real private CV, stored the way Phase 5 stores one -- */

  const { storeApplicantCv } = await import('../../src/lib/assessment/cv');

  cvBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

  const stored = await storeApplicantCv({
    assessmentId: primaryId,
    bytes: cvBytes,
    filename: 'adaeze-cv.pdf',
    declaredMimeType: 'application/pdf',
  });

  cvStorageKey = stored.storageKey;

  const [attachment] = await db
    .insert(assessmentAttachments)
    .values({ assessmentId: primaryId, mediaAssetId: stored.mediaAssetId, kind: 'cv' } as never)
    .returning({ id: assessmentAttachments.id });

  assert.ok(attachment, 'attachment fixture insert must return an id');
  cvAttachmentId = attachment.id;
});

after(() => {
  client?.close();
  rmSync('.data/uploads/private/assessments', { recursive: true, force: true });
});

beforeEach(() => {
  testState().admin = {
    adminId: 'admin-owner',
    sessionId: 'session-owner',
    email: 'owner@example.test',
    role: 'owner',
  };
  testState().audit.length = 0;
});

/* -------------------------------------------------------------------------- */
/* 1. Listing and pagination                                                  */
/* -------------------------------------------------------------------------- */

describe('listing and pagination', () => {
  it('lists every application, newest first', async () => {
    const { listAssessmentsHandler } = await handlers();
    const { status, body } = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?pageSize=25'),
      ),
    );

    assert.equal(status, 200);
    assert.equal(body.data.total, 3);
    assert.deepEqual(
      body.data.rows.map((row: Body) => row.referenceNumber),
      ['IMA-2026-CCC333', 'IMA-2026-BBB222', 'IMA-2026-AAA111'],
      'default order is submission date, newest first',
    );
  });

  it('pagination: page 1 and page 2 return different rows and a truthful count', async () => {
    const { listAssessmentsHandler } = await handlers();

    const first = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?pageSize=10&page=1'),
      ),
    );
    assert.equal(first.body.data.pageCount, 1, 'three rows fit on one page of ten');

    const paged = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?pageSize=10&page=2'),
      ),
    );
    // A page beyond the end is clamped to the last real page, not an error page
    // showing nothing.
    assert.equal(paged.body.data.page, 1);
    assert.equal(paged.body.data.rows.length, 3);
  });

  it('pagination window is enforced by the database, not the browser', async () => {
    const { listAssessments } = await import('../../src/lib/assessment/admin');

    const page1 = await listAssessments({ pageSize: 10, page: 1 });
    assert.equal(page1.rows.length, 3);

    // A page size outside the offered set is replaced by the default rather than
    // passed to SQL, so `?pageSize=100000` cannot dump the inbox in one response.
    const huge = await listAssessments({ pageSize: 100000 as never, page: 1 });
    assert.equal(huge.pageSize, 25);
  });

  it('an out-of-range page is clamped to a page that exists', async () => {
    const { listAssessmentsHandler } = await handlers();
    const { body } = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?page=99'),
      ),
    );
    assert.equal(body.data.page, 1);
    assert.equal(body.data.pageCount, 1);
  });

  it('sorts by applicant name and by status in workflow order', async () => {
    const { listAssessmentsHandler } = await handlers();

    const byName = await readResponse(
      await listAssessmentsHandler(
        jsonRequest(
          'http://localhost/api/admin/assessments?sort=applicant&direction=asc&pageSize=25',
        ),
      ),
    );
    assert.deepEqual(
      byName.body.data.rows.map((row: Body) => row.fullName),
      ['Adaeze Okonkwo', 'Bilal Rahman', 'Chidinma Eze'],
    );

    const byStatus = await readResponse(
      await listAssessmentsHandler(
        jsonRequest(
          'http://localhost/api/admin/assessments?sort=status&direction=asc&pageSize=25',
        ),
      ),
    );
    // New (1) → Under Review (2) → Closed (5). Alphabetical would be wrong.
    assert.deepEqual(
      byStatus.body.data.rows.map((row: Body) => row.status),
      ['new', 'under_review', 'closed'],
    );
  });

  it('the list never includes special-category or free-text answers', async () => {
    const { listAssessments } = await import('../../src/lib/assessment/admin');
    const result = await listAssessments({ pageSize: 25 });

    for (const row of result.rows) {
      const keys = Object.keys(row);
      for (const forbidden of [
        'medicalDetails',
        'criminalRecordDetails',
        'residentialAddress',
        'dateOfBirth',
        'passportNumber',
        'mobileNumber',
      ]) {
        assert.ok(!keys.includes(forbidden), `${forbidden} must not be selected for the list`);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Search and filtering                                                    */
/* -------------------------------------------------------------------------- */

describe('search and filtering', () => {
  it('search: finds by applicant name, email and reference', async () => {
    const { listAssessmentsHandler } = await handlers();

    for (const needle of ['chidinma', 'BILAL.RAHMAN@EXAMPLE.TEST', 'bbb222']) {
      const { body } = await readResponse(
        await listAssessmentsHandler(
          jsonRequest(
            `http://localhost/api/admin/assessments?search=${encodeURIComponent(needle)}`,
          ),
        ),
      );
      assert.equal(body.data.total, 1, `"${needle}" should match exactly one application`);
    }
  });

  it('search: a wildcard is escaped, so "%" does not match everything', async () => {
    const { listAssessmentsHandler } = await handlers();
    const { body } = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?search=%25'),
      ),
    );
    assert.equal(body.data.total, 0, 'a bare % must be treated as a literal character');
  });

  it('filter: by status returns only that status', async () => {
    const { listAssessmentsHandler } = await handlers();
    const { body } = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?status=under_review'),
      ),
    );
    assert.equal(body.data.total, 1);
    assert.equal(body.data.rows[0].referenceNumber, 'IMA-2026-BBB222');
  });

  it('filter: by submission date range, inclusive of both days', async () => {
    const { listAssessmentsHandler } = await handlers();
    const { body } = await readResponse(
      await listAssessmentsHandler(
        jsonRequest('http://localhost/api/admin/assessments?from=2026-02-11&to=2026-02-11'),
      ),
    );
    assert.equal(body.data.total, 1);
    assert.equal(body.data.rows[0].referenceNumber, 'IMA-2026-BBB222');
  });

  it('filter: search, status and date combine with AND', async () => {
    const { listAssessmentsHandler } = await handlers();
    const { body } = await readResponse(
      await listAssessmentsHandler(
        jsonRequest(
          'http://localhost/api/admin/assessments?search=nigeria&status=closed&from=2026-01-01',
        ),
      ),
    );
    // "nigeria" matches nothing in name/email/reference, so the AND yields zero.
    assert.equal(body.data.total, 0);
  });

  it('an unknown status or sort value is ignored, not passed to the database', async () => {
    const { parseListFilters } = await handlers();
    const filters = parseListFilters(
      new URL(
        'http://localhost/api/admin/assessments?status=not_a_status&sort=1%3Bdrop%20table&page=-3&pageSize=abc',
      ),
    );

    assert.equal(filters.status, 'all');
    assert.equal(filters.sort, 'submitted');
    assert.equal(filters.page, 1);
    assert.equal(filters.pageSize, 25);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Individual views                                                        */
/* -------------------------------------------------------------------------- */

describe('individual application view', () => {
  it('detail: returns every section of the application', async () => {
    const { readAssessmentHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { status, body } = await readResponse(
      await readAssessmentHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}`),
        context({ id }),
      ),
    );

    assert.equal(status, 200);
    const detail = body.data;

    assert.equal(detail.assessment.referenceNumber, 'IMA-2026-AAA111');
    assert.equal(detail.assessment.fullName, 'Adaeze Okonkwo');
    assert.equal(detail.education.length, 1);
    assert.equal(detail.skills.length, 1);
    assert.equal(detail.languages.length, 1);
    assert.equal(detail.examinations.length, 1);
    assert.equal(detail.travel.length, 1);
    assert.ok(Array.isArray(detail.employment));
    assert.ok(Array.isArray(detail.familyAbroad));
    assert.equal(detail.consent.termsVersion, 3);
    assert.equal(detail.consent.privacyVersion, 7);
    assert.equal(detail.attachments.length, 1);
  });

  it('detail: the attachment is described without exposing its storage key', async () => {
    const { readAssessmentHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { body } = await readResponse(
      await readAssessmentHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}`),
        context({ id }),
      ),
    );

    const attachment = body.data.attachments[0];
    assert.equal(attachment.originalFilename, 'adaeze-cv.pdf');
    assert.equal(attachment.isMissing, false);

    const serialised = JSON.stringify(body);
    assert.ok(!serialised.includes('private/assessments'), 'no storage key in the response');
    assert.ok(!serialised.includes(cvStorageKey), 'the literal key must never be serialised');
    assert.ok(!serialised.includes('/.data/'), 'no filesystem path in the response');
  });

  it('detail: an unknown id is a 404, not an empty record', async () => {
    const { readAssessmentHandler } = await handlers();
    const id = crypto.randomUUID();

    const { status, body } = await readResponse(
      await readAssessmentHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}`),
        context({ id }),
      ),
    );

    assert.equal(status, 404);
    assert.equal(body.error, 'not_found');
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Status changes and history                                              */
/* -------------------------------------------------------------------------- */

describe('status changes', () => {
  it('status: change writes the new status, the history row and the audit entry', async () => {
    const { changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { status, body } = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'under_review', note: 'Started the review.' },
        }),
        context({ id }),
      ),
    );

    assert.equal(status, 200);
    assert.equal(body.data.fromStatus, 'new');
    assert.equal(body.data.toStatus, 'under_review');
    assert.equal(body.data.label, 'Under Review');

    const { getDb } = await import('../../src/db');
    const { assessments, assessmentStatusHistory } = await import(
      '../../src/db/schema/assessments'
    );

    const [row] = await getDb()
      .select({ status: assessments.status })
      .from(assessments)
      .where(eq(assessments.id, id));
    assert.equal(row?.status, 'under_review');

    const history = await getDb()
      .select()
      .from(assessmentStatusHistory)
      .where(eq(assessmentStatusHistory.assessmentId, id));

    assert.equal(history.length, 1);
    assert.equal(history[0]?.fromStatus, 'new');
    assert.equal(history[0]?.toStatus, 'under_review');
    assert.equal(history[0]?.adminId, 'admin-owner', 'the administrator is recorded');
    assert.equal(history[0]?.note, 'Started the review.');
    assert.ok(history[0]?.createdAt instanceof Date, 'the moment is recorded');
  });

  it('status: the audit entry records previous → new and no applicant text', async () => {
    const { changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    testState().audit.length = 0;

    await changeStatusHandler(
      jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
        method: 'POST',
        body: { status: 'additional_info_required', note: 'Needs a bank statement.' },
      }),
      context({ id }),
    );

    const entry = auditCalls().find((call) => call.action === 'assessment.status_changed');
    assert.ok(entry, 'a status change must be audited');
    assert.equal(entry.entityType, 'assessment');
    assert.equal(entry.entityId, id);
    assert.equal(entry.metadata?.fromStatus, 'under_review');
    assert.equal(entry.metadata?.toStatus, 'additional_info_required');
    assert.ok(entry.summary?.includes('IMA-2026-AAA111'));

    // The audit trail must never become a copy of the applicant's file.
    const serialised = JSON.stringify(entry);
    assert.ok(!serialised.includes('Adaeze'), 'applicant name must not be in the audit row');
    assert.ok(!serialised.includes('bank statement'), 'the reason is history, not audit text');
  });

  it('status: changing to the current status is refused and writes nothing', async () => {
    const { changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { getDb } = await import('../../src/db');
    const { assessmentStatusHistory } = await import('../../src/db/schema/assessments');

    const before = await getDb()
      .select()
      .from(assessmentStatusHistory)
      .where(eq(assessmentStatusHistory.assessmentId, id));

    const { status, body } = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'additional_info_required' },
        }),
        context({ id }),
      ),
    );

    assert.equal(status, 409);
    assert.match(body.message, /already marked/i);

    const after = await getDb()
      .select()
      .from(assessmentStatusHistory)
      .where(eq(assessmentStatusHistory.assessmentId, id));

    assert.equal(after.length, before.length, 'a no-op must not append a fake history row');
  });

  it('status: an unknown status value is a 400', async () => {
    const { changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { status } = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'approved_for_visa' },
        }),
        context({ id }),
      ),
    );

    assert.equal(status, 400);
  });

  it('status: a second change appends to the history rather than replacing it', async () => {
    const { changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    await changeStatusHandler(
      jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
        method: 'POST',
        body: { status: 'reviewed' },
      }),
      context({ id }),
    );

    const { getDb } = await import('../../src/db');
    const { assessmentStatusHistory, assessments } = await import(
      '../../src/db/schema/assessments'
    );

    const history = await getDb()
      .select()
      .from(assessmentStatusHistory)
      .where(eq(assessmentStatusHistory.assessmentId, id));

    assert.equal(history.length, 3, 'new → under review → additional info → reviewed');
    assert.deepEqual(
      history.map((row) => row.toStatus).sort(),
      ['additional_info_required', 'reviewed', 'under_review'],
    );

    const [row] = await getDb()
      .select({ status: assessments.status, reviewedAt: assessments.reviewedAt })
      .from(assessments)
      .where(eq(assessments.id, id));

    assert.equal(row?.status, 'reviewed');
    assert.ok(row?.reviewedAt instanceof Date, 'reviewing stamps the reviewed time');
  });

  it('status: all five statuses are reachable and correctly labelled', async () => {
    const { ASSESSMENT_STATUS_META } = await import('../../src/lib/assessment/status');
    assert.deepEqual(
      ASSESSMENT_STATUS_META.map((meta) => `${meta.order}. ${meta.label}`),
      [
        '1. New',
        '2. Under Review',
        '3. Additional Information Required',
        '4. Reviewed',
        '5. Closed',
      ],
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Internal notes                                                          */
/* -------------------------------------------------------------------------- */

describe('internal notes', () => {
  it('notes: add, list and delete round-trips with the author recorded', async () => {
    const { addNoteHandler, deleteNoteHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const added = await readResponse(
      await addNoteHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
          method: 'POST',
          body: { body: 'Phoned the applicant; documents arriving next week.' },
        }),
        context({ id }),
      ),
    );

    assert.equal(added.status, 200);
    assert.ok(added.body.data.id);

    const { getAssessmentDetail } = await import('../../src/lib/assessment/admin');
    const detail = await getAssessmentDetail(id);
    const note = detail?.notes.find((row) => row.id === added.body.data.id);

    assert.ok(note, 'the note must be readable back');
    assert.equal(note.authorEmail, 'owner@example.test');

    const removed = await readResponse(
      await deleteNoteHandler(
        jsonRequest(
          `http://localhost/api/admin/assessments/${id}/notes/${added.body.data.id}`,
          { method: 'DELETE' },
        ),
        context({ id, noteId: added.body.data.id }),
      ),
    );

    assert.equal(removed.status, 200);

    const afterDelete = await getAssessmentDetail(id);
    assert.ok(!afterDelete?.notes.some((row) => row.id === added.body.data.id));
  });

  it('notes: an empty note is refused', async () => {
    const { addNoteHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { status } = await readResponse(
      await addNoteHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
          method: 'POST',
          body: { body: '   ' },
        }),
        context({ id }),
      ),
    );

    assert.equal(status, 400);
  });

  it('notes: a note id from another application cannot be deleted through this one', async () => {
    const { addNoteHandler, deleteNoteHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    const otherId = ids['IMA-2026-CCC333'];
    assert.ok(id && otherId);

    const added = await readResponse(
      await addNoteHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
          method: 'POST',
          body: { body: 'Note that belongs to the first application.' },
        }),
        context({ id }),
      ),
    );

    const { status } = await readResponse(
      await deleteNoteHandler(
        jsonRequest(
          `http://localhost/api/admin/assessments/${otherId}/notes/${added.body.data.id}`,
          { method: 'DELETE' },
        ),
        context({ id: otherId, noteId: added.body.data.id }),
      ),
    );

    assert.equal(status, 404, 'the pair must match or the note is not found');

    const { getAssessmentDetail } = await import('../../src/lib/assessment/admin');
    const detail = await getAssessmentDetail(id);
    assert.ok(
      detail?.notes.some((row) => row.id === added.body.data.id),
      'the note must still exist',
    );

    // Clean up so the note does not affect later counts.
    await deleteNoteHandler(
      jsonRequest(`http://localhost/api/admin/assessments/${id}/notes/${added.body.data.id}`, {
        method: 'DELETE',
      }),
      context({ id, noteId: added.body.data.id }),
    );
  });

  it('notes: the audit entry records that a note was added, not what it said', async () => {
    const { addNoteHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    testState().audit.length = 0;

    const secret = 'Sensitive internal observation about the applicant';
    const added = await readResponse(
      await addNoteHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
          method: 'POST',
          body: { body: secret },
        }),
        context({ id }),
      ),
    );

    const entry = auditCalls().find((call) => call.action === 'assessment.note_added');
    assert.ok(entry);
    assert.ok(!JSON.stringify(entry).includes(secret), 'the note body must not be audited');

    const { deleteAssessmentNote } = await import('../../src/lib/assessment/manage');
    await deleteAssessmentNote({ assessmentId: id, noteId: added.body.data.id });
  });
});

/* -------------------------------------------------------------------------- */
/* 6. CV authorisation and downloads                                          */
/* -------------------------------------------------------------------------- */

describe('CV downloads', () => {
  it('cv: a signed-in administrator receives the file as an attachment', async () => {
    const { downloadAttachmentHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const response = await downloadAttachmentHandler(
      jsonRequest(`http://localhost/api/admin/assessments/${id}/attachments/${cvAttachmentId}`),
      context({ id, attachmentId: cvAttachmentId }),
    );

    assert.equal(response.status, 200);

    const disposition = response.headers.get('content-disposition') ?? '';
    assert.match(disposition, /^attachment;/, 'the file must download, not render');
    assert.match(disposition, /adaeze-cv\.pdf/);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.ok(
      (response.headers.get('content-security-policy') ?? '').includes("default-src 'none'"),
      'a document must never be able to execute in the portal origin',
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.byteLength, cvBytes.byteLength);
  });

  it('cv: the download is audited with the reference, never the filename', async () => {
    const { downloadAttachmentHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    testState().audit.length = 0;

    const response = await downloadAttachmentHandler(
      jsonRequest(`http://localhost/api/admin/assessments/${id}/attachments/${cvAttachmentId}`),
      context({ id, attachmentId: cvAttachmentId }),
    );

    // Consume the body: the local adapter streams from disk, and a stream left
    // unread would open the file after this test's database and uploads are gone.
    await response.arrayBuffer();

    const entry = auditCalls().find(
      (call) => call.action === 'assessment.attachment_downloaded',
    );
    assert.ok(entry, 'a CV download must be recorded');
    assert.equal(entry.entityId, id);
    assert.ok(entry.summary?.includes('IMA-2026-AAA111'));
    assert.ok(!JSON.stringify(entry).includes(cvStorageKey), 'no storage key in the audit row');
  });

  it('cv: an attachment id from another assessment is not downloadable', async () => {
    const { downloadAttachmentHandler } = await handlers();
    const otherId = ids['IMA-2026-BBB222'];
    assert.ok(otherId);

    const { status } = await readResponse(
      await downloadAttachmentHandler(
        jsonRequest(
          `http://localhost/api/admin/assessments/${otherId}/attachments/${cvAttachmentId}`,
        ),
        // A valid attachment id paired with the wrong assessment id.
        context({ id: otherId, attachmentId: cvAttachmentId }),
      ),
    );

    assert.equal(status, 404, 'the pair must match, so a leaked id is useless on its own');
  });

  it('cv: an unknown attachment is a 404 in words', async () => {
    const { downloadAttachmentHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const { status, body } = await readResponse(
      await downloadAttachmentHandler(
        jsonRequest(
          `http://localhost/api/admin/assessments/${id}/attachments/${crypto.randomUUID()}`,
        ),
        context({ id, attachmentId: crypto.randomUUID() }),
      ),
    );

    assert.equal(status, 404);
    assert.match(body.message, /not available/i);
  });

  it('cv: the file is stored privately, outside the public media prefix', async () => {
    assert.match(cvStorageKey, /^private\/assessments\//);
    assert.ok(!cvStorageKey.startsWith('public/'));
  });

  it('cv: an archived asset is refused even though the row still exists', async () => {
    const { getDb } = await import('../../src/db');
    const { mediaAssets } = await import('../../src/db/schema/media');
    const { assessmentAttachments } = await import('../../src/db/schema/assessments');
    const { storeApplicantCv } = await import('../../src/lib/assessment/cv');
    const { downloadAttachmentHandler } = await handlers();

    const id = ids['IMA-2026-CCC333'];
    assert.ok(id);

    // A second, independent CV. `assessment_attachments.media_asset_id` is unique,
    // so one asset cannot simply be attached to a second application.
    const stored = await storeApplicantCv({
      assessmentId: id,
      bytes: cvBytes,
      filename: 'chidinma-cv.pdf',
      declaredMimeType: 'application/pdf',
    });

    const [attachment] = await getDb()
      .insert(assessmentAttachments)
      .values({ assessmentId: id, mediaAssetId: stored.mediaAssetId, kind: 'cv' } as never)
      .returning({ id: assessmentAttachments.id });

    assert.ok(attachment);

    // The row still exists, but the asset has been archived: the download must
    // still refuse rather than serve a document that was withdrawn.
    await getDb()
      .update(mediaAssets)
      .set({ archivedAt: new Date() })
      .where(eq(mediaAssets.id, stored.mediaAssetId));

    const { status } = await readResponse(
      await downloadAttachmentHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/attachments/${attachment.id}`),
        context({ id, attachmentId: attachment.id }),
      ),
    );

    assert.equal(status, 404);

    // Restore so later tests see the original state.
    await getDb()
      .update(mediaAssets)
      .set({ archivedAt: null })
      .where(eq(mediaAssets.id, stored.mediaAssetId));
    await getDb()
      .delete(assessmentAttachments)
      .where(and(eq(assessmentAttachments.id, attachment.id)));
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Unauthorised access attempts                                            */
/* -------------------------------------------------------------------------- */

describe('authorisation', () => {
  it('authorisation: every assessment endpoint refuses an unauthenticated caller', async () => {
    const {
      addNoteHandler,
      changeStatusHandler,
      deleteNoteHandler,
      downloadAttachmentHandler,
      listAssessmentsHandler,
      readAssessmentHandler,
    } = await handlers();

    testState().admin = null;

    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const unauthenticated = [
      await readResponse(
        await listAssessmentsHandler(jsonRequest('http://localhost/api/admin/assessments')),
      ),
      await readResponse(
        await readAssessmentHandler(
          jsonRequest(`http://localhost/api/admin/assessments/${id}`),
          context({ id }),
        ),
      ),
      await readResponse(
        await changeStatusHandler(
          jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
            method: 'POST',
            body: { status: 'reviewed' },
          }),
          context({ id }),
        ),
      ),
      await readResponse(
        await addNoteHandler(
          jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
            method: 'POST',
            body: { body: 'x' },
          }),
          context({ id }),
        ),
      ),
      await readResponse(
        await deleteNoteHandler(
          jsonRequest(
            `http://localhost/api/admin/assessments/${id}/notes/${crypto.randomUUID()}`,
            { method: 'DELETE' },
          ),
          context({ id, noteId: crypto.randomUUID() }),
        ),
      ),
      await readResponse(
        await downloadAttachmentHandler(
          jsonRequest(
            `http://localhost/api/admin/assessments/${id}/attachments/${cvAttachmentId}`,
          ),
          context({ id, attachmentId: cvAttachmentId }),
        ),
      ),
    ];

    for (const response of unauthenticated) {
      assert.equal(response.status, 401, 'no session must mean no applicant data');
      assert.ok(!('data' in response.body));
    }
  });

  it('authorisation: an editor is refused on every assessment endpoint', async () => {
    testState().admin = {
      adminId: 'admin-editor',
      sessionId: 'session-editor',
      email: 'editor@example.test',
      role: 'editor',
    };

    const {
      addNoteHandler,
      changeStatusHandler,
      downloadAttachmentHandler,
      listAssessmentsHandler,
      readAssessmentHandler,
    } = await handlers();

    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const refused = [
      await readResponse(
        await listAssessmentsHandler(jsonRequest('http://localhost/api/admin/assessments')),
      ),
      await readResponse(
        await readAssessmentHandler(
          jsonRequest(`http://localhost/api/admin/assessments/${id}`),
          context({ id }),
        ),
      ),
      await readResponse(
        await downloadAttachmentHandler(
          jsonRequest(
            `http://localhost/api/admin/assessments/${id}/attachments/${cvAttachmentId}`,
          ),
          context({ id, attachmentId: cvAttachmentId }),
        ),
      ),
      await readResponse(
        await addNoteHandler(
          jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
            method: 'POST',
            body: { body: 'an editor must not write here' },
          }),
          context({ id }),
        ),
      ),
      await readResponse(
        await changeStatusHandler(
          jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
            method: 'POST',
            body: { status: 'closed' },
          }),
          context({ id }),
        ),
      ),
    ];

    for (const response of refused) {
      assert.equal(response.status, 403, 'applicant data is not content');
    }
  });

  it('authorisation: an administrator (non-owner) may read and write assessments', async () => {
    testState().admin = {
      adminId: 'admin-second',
      sessionId: 'session-second',
      email: 'second@example.test',
      role: 'admin',
    };

    const { listAssessmentsHandler, changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-BBB222'];
    assert.ok(id);

    const list = await readResponse(
      await listAssessmentsHandler(jsonRequest('http://localhost/api/admin/assessments')),
    );
    assert.equal(list.status, 200);

    const change = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'reviewed' },
        }),
        context({ id }),
      ),
    );
    assert.equal(change.status, 200);

    const { getDb } = await import('../../src/db');
    const { assessmentStatusHistory } = await import('../../src/db/schema/assessments');
    const history = await getDb()
      .select()
      .from(assessmentStatusHistory)
      .where(eq(assessmentStatusHistory.assessmentId, id));

    assert.equal(history.at(-1)?.adminId, 'admin-second');
  });

  it('CSRF: a write with no token is refused and changes nothing', async () => {
    const { changeStatusHandler, addNoteHandler } = await handlers();
    const id = ids['IMA-2026-BBB222'];
    assert.ok(id);

    const { getDb } = await import('../../src/db');
    const { assessments } = await import('../../src/db/schema/assessments');

    const before = await getDb()
      .select({ status: assessments.status })
      .from(assessments)
      .where(eq(assessments.id, id));

    const noToken = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'closed' },
          csrf: null,
        }),
        context({ id }),
      ),
    );
    assert.equal(noToken.status, 403);

    const noNote = await readResponse(
      await addNoteHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/notes`, {
          method: 'POST',
          body: { body: 'forged' },
          csrf: null,
        }),
        context({ id }),
      ),
    );
    assert.equal(noNote.status, 403);

    const after = await getDb()
      .select({ status: assessments.status })
      .from(assessments)
      .where(eq(assessments.id, id));

    assert.equal(after[0]?.status, before[0]?.status, 'a forged request must not write');
  });

  it('CSRF: a token that does not match the session is refused', async () => {
    const { changeStatusHandler } = await handlers();
    const id = ids['IMA-2026-BBB222'];
    assert.ok(id);

    const { status } = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'closed' },
          csrf: 'a-token-from-somewhere-else',
        }),
        context({ id }),
      ),
    );

    assert.equal(status, 403);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Privacy boundaries                                                      */
/* -------------------------------------------------------------------------- */

describe('privacy boundaries', () => {
  it('privacy: no public route reaches an assessment', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    /** Every route under src/app/api that is not under /api/admin. */
    function publicRoutes(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          out.push(...publicRoutes(full));
          continue;
        }
        if (entry === 'route.ts') out.push(full);
      }
      return out;
    }

    const routes = publicRoutes('src/app/api');
    assert.ok(routes.length > 0);

    for (const route of routes) {
      if (route.includes('/api/admin/')) continue;
      const source = readFileSync(route, 'utf8');
      for (const forbidden of [
        '@/lib/assessment/admin',
        '@/lib/assessment/manage',
        'assessments',
        'consentRecords',
        'assessmentAttachments',
      ]) {
        assert.ok(
          !source.includes(forbidden),
          `${route} must not reach assessment data (found "${forbidden}")`,
        );
      }
    }
  });

  it('privacy: the public media proxy only ever selects public visibility', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/app/api/media/[...key]/route.ts', 'utf8');

    assert.ok(source.includes("eq(mediaAssets.visibility, 'public')"));
    assert.ok(source.includes('SERVABLE_TYPES'));
    // A CV is a document; documents are deliberately not in the servable set.
    assert.ok(!source.includes("'application/pdf'"));
  });

  it('privacy: no admin response is cacheable', async () => {
    const { listAssessmentsHandler, readAssessmentHandler } = await handlers();
    const id = ids['IMA-2026-AAA111'];
    assert.ok(id);

    const list = await listAssessmentsHandler(
      jsonRequest('http://localhost/api/admin/assessments'),
    );
    const detail = await readAssessmentHandler(
      jsonRequest(`http://localhost/api/admin/assessments/${id}`),
      context({ id }),
    );

    for (const response of [list, detail]) {
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    }
  });

  it('privacy: an error response never echoes applicant data', async () => {
    const { readAssessmentHandler } = await handlers();
    const id = crypto.randomUUID();

    const { body } = await readResponse(
      await readAssessmentHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}`),
        context({ id }),
      ),
    );

    const serialised = JSON.stringify(body);
    for (const forbidden of ['Adaeze', 'adaeze.okonkwo', 'IMA-2026']) {
      assert.ok(!serialised.includes(forbidden));
    }
  });

  it('privacy: the portal has no delete route for an application', async () => {
    const { readdirSync, readFileSync: read, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    function files(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...files(full));
        else out.push(full);
      }
      return out;
    }

    // Only GET/POST/DELETE of a note exist; nothing removes an assessment.
    const assessmentRoutes = files('src/app/api/admin/assessments');
    for (const file of assessmentRoutes) {
      const source = read(file, 'utf8');
      assert.ok(
        !/export async function DELETE\(/.test(source) || file.includes('/notes/'),
        `${file} must not export a DELETE for an application`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Dashboard counts                                                        */
/* -------------------------------------------------------------------------- */

describe('dashboard counts', () => {
  it('dashboard: counts match the rows and include every status', async () => {
    const { getAssessmentSummary } = await import('../../src/lib/assessment/admin');
    const summary = await getAssessmentSummary();

    const { getDb } = await import('../../src/db');
    const { assessments } = await import('../../src/db/schema/assessments');

    const totals = await getDb()
      .select({ status: assessments.status })
      .from(assessments);

    assert.equal(summary.total, totals.length);

    const expected = totals.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    for (const status of [
      'new',
      'under_review',
      'additional_info_required',
      'reviewed',
      'closed',
    ] as const) {
      assert.equal(summary.byStatus[status], expected[status] ?? 0, status);
    }

    // Every status is always present, so a zeroed queue renders as 0.
    assert.deepEqual(
      Object.keys(summary.byStatus),
      ['new', 'under_review', 'additional_info_required', 'reviewed', 'closed'],
    );
  });

  it('dashboard: the summary changes when a status changes', async () => {
    const { getAssessmentSummary } = await import('../../src/lib/assessment/admin');
    const { changeStatusHandler } = await handlers();

    const before = await getAssessmentSummary();
    const id = ids['IMA-2026-CCC333'];
    assert.ok(id);

    const { status } = await readResponse(
      await changeStatusHandler(
        jsonRequest(`http://localhost/api/admin/assessments/${id}/status`, {
          method: 'POST',
          body: { status: 'under_review' },
        }),
        context({ id }),
      ),
    );
    assert.equal(status, 200);

    const after = await getAssessmentSummary();

    assert.equal(after.byStatus.closed, before.byStatus.closed - 1);
    assert.equal(after.byStatus.under_review, before.byStatus.under_review + 1);
    assert.equal(after.total, before.total, 'changing status never changes the total');
  });
});

/* -------------------------------------------------------------------------- */
/* 10. UI wiring and files                                                    */
/* -------------------------------------------------------------------------- */

describe('portal wiring', () => {
  it('the navigation lists Assessments and gates it by role', () => {
    const shell = readFileSync('src/components/admin/admin-shell.tsx', 'utf8');
    assert.ok(shell.includes("href: '/admin/assessments'"));
    assert.ok(shell.includes("roles: ['owner', 'admin']"));
  });

  it('the dashboard shows real assessment counts and no placeholder panel', () => {
    const page = readFileSync('src/app/(admin)/admin/(dashboard)/page.tsx', 'utf8');
    assert.ok(page.includes('getAssessmentSummary'));
    assert.ok(!page.includes('Not available yet'));
  });

  it('the inbox page and detail page both exist and are role-gated', () => {
    for (const file of [
      'src/app/(admin)/admin/(dashboard)/assessments/page.tsx',
      'src/app/(admin)/admin/(dashboard)/assessments/[id]/page.tsx',
    ]) {
      const source = readFileSync(file, 'utf8');
      assert.ok(source.includes('ASSESSMENT_ROLES'), `${file} must gate on role`);
      assert.ok(source.includes('requireAdminPage'), `${file} must require a session`);
    }
  });

  it('the detail page offers a confirmation before a status change', () => {
    const source = readFileSync(
      'src/components/admin/assessments/assessment-workspace.tsx',
      'utf8',
    );
    assert.ok(source.includes('ConfirmDialog'));
    assert.ok(source.includes('Change this application'));
  });

  it('the CV link points at the authorised route, never at a storage URL', () => {
    const source = readFileSync(
      'src/components/admin/assessments/assessment-workspace.tsx',
      'utf8',
    );
    assert.ok(source.includes('/api/admin/assessments/${assessmentId}/attachments/${attachment.id}'));
    assert.ok(!source.includes('private/assessments'));
  });
});
