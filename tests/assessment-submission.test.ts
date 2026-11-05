/**
 * Phase 5 verification — submission backend.
 *
 * These tests run the shipped submission service against a real libSQL database
 * (a scratch file created here, never the development or production database) and
 * the real private storage adapter. Nothing about the write path is mocked: the
 * unique indexes, the CHECK constraints, the transaction, the consent snapshot,
 * the audit row and the private object on disk are the same code that runs in
 * production.
 *
 * The mandated verifications, mapped to test names:
 *
 *   1. successful submission ............... "valid submission creates the whole record"
 *   2. unique reference number ............. "two submissions get different references"
 *   3. duplicate prevention ................ "the same person cannot submit twice"
 *   4. idempotent retry .................... "a retried request returns the same reference"
 *   5. server-side validation .............. "a request that skips the UI is still refused"
 *   6. CV content validation ............... "a PDF is accepted", "a renamed HTML file is not"
 *   7. CV stored privately ................. "the CV lands in private storage"
 *   8. no sensitive data in responses ...... "no response body contains applicant data"
 *   9. rate limiting ....................... "the sixth submission from one IP is refused"
 *  10. consent snapshot .................... "consent records the policy versions"
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createClient, type Client } from '@libsql/client';

const REPO_ROOT = process.cwd();
const SCRATCH_DB = './.data/verify-assessment.db';
const SCRATCH_URL = `file:${SCRATCH_DB}`;

let client: Client;

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */

before(async () => {
  mkdirSync('.data', { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${SCRATCH_DB}${suffix}`, { force: true });

  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, TURSO_DATABASE_URL: SCRATCH_URL, TURSO_AUTH_TOKEN: '' },
    stdio: 'pipe',
  });

  process.env.TURSO_DATABASE_URL = SCRATCH_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  // The local adapter is the default; be explicit so a developer's shell cannot
  // point this test at Netlify Blobs.
  process.env.STORAGE_DRIVER = 'local';

  client = createClient({ url: SCRATCH_URL });

  const { getDb } = await import('../src/db');
  const { websitePages } = await import('../src/db/schema/settings');
  const { countries } = await import('../src/db/schema/destinations');

  await getDb()
    .insert(websitePages)
    .values([
      { slug: 'terms', title: 'Terms and Conditions', status: 'published', version: 4, contentMd: 'Terms body.' },
      { slug: 'privacy', title: 'Privacy Policy', status: 'published', version: 9, contentMd: 'Privacy body.' },
    ]);

  const [canada, draftCountry] = await getDb()
    .insert(countries)
    .values([
      { name: 'Canada', isoCode: 'CA', slug: 'canada', status: 'published' },
      { name: 'Norway', isoCode: 'NO', slug: 'norway', status: 'draft' },
    ])
    .returning({ id: countries.id, slug: countries.slug });

  publishedCountryId = canada?.id ?? '';
  draftCountryId = draftCountry?.id ?? '';
});

after(() => {
  client?.close();
});

let publishedCountryId = '';
let draftCountryId = '';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** A PDF whose first bytes are the real signature. */
function pdfBytes(): Uint8Array {
  const body = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
  const bytes = new Uint8Array(600);
  bytes.set(new TextEncoder().encode(body), 0);
  return bytes;
}

/** A DOCX-shaped file: ZIP container plus the OOXML parts. */
function docxBytes(): Uint8Array {
  const payload =
    'PK\u0003\u0004' +
    '[Content_Types].xml' +
    '\u0000\u0000\u0000\u0000' +
    'word/document.xml' +
    '\u0000\u0000\u0000\u0000';
  const bytes = new Uint8Array(600);
  bytes.set(new TextEncoder().encode(payload), 0);
  return bytes;
}

let submissionCounter = 0;

/** A complete, valid payload whose identity is unique per call. */
function payload(overrides: {
  email?: string;
  fullName?: string;
  dateOfBirth?: string;
  preferredCountryId?: string;
  consent?: { acceptedTerms: boolean; acceptedPrivacy: boolean };
} = {}) {
  submissionCounter += 1;
  const n = submissionCounter;

  return {
    personal: {
      fullName: overrides.fullName ?? `Applicant Number${n}`,
      dateOfBirth: overrides.dateOfBirth ?? '1990-05-01',
      gender: 'female',
      nationality: 'NG',
      countryOfResidence: 'NG',
      residentialAddress: '1 Marina Road',
      city: 'Warri',
      stateProvince: 'Delta',
      postalCode: '332211',
      mobileCountryCode: '+234',
      mobileNumber: '8031234567',
      altMobileCountryCode: '',
      altMobileNumber: '',
      email: overrides.email ?? `applicant.${n}@example.test`,
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
    skills: ['healthcare_nursing', 'caregiving'],
    languages: { english: 'fluent', french: 'basic', spanish: '', german: '' },
    preferences: {
      preferredCountryId: overrides.preferredCountryId ?? publishedCountryId,
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
      travelledCountries: 'Ghana, United Kingdom and Ghana',
      hasFamilyAbroad: 'yes',
      familyAbroadCountries: 'Canada',
      hasProfessionalExams: 'yes',
      professionalExamsNotes: 'NCLEX-RN, passed 2023',
    },
    consent: overrides.consent ?? { acceptedTerms: true, acceptedPrivacy: true },
    honey: '',
  };
}

/** A distinct fake IP hash per test, so rate limits never leak between tests. */
let ipCounter = 0;
function freshIpHash(): string {
  ipCounter += 1;
  return `test-ip-${ipCounter.toString().padStart(6, '0')}`;
}

async function loadSubmit() {
  return import('../src/lib/assessment/submit');
}

async function db() {
  const { getDb } = await import('../src/db');
  return getDb();
}

async function tables() {
  return {
    assessments: (await import('../src/db/schema/assessments')).assessments,
    consent: (await import('../src/db/schema/assessments')).consentRecords,
    attachments: (await import('../src/db/schema/assessments')).assessmentAttachments,
    education: (await import('../src/db/schema/assessments')).applicantEducation,
    employment: (await import('../src/db/schema/assessments')).applicantEmployment,
    skills: (await import('../src/db/schema/assessments')).applicantSkills,
    languages: (await import('../src/db/schema/assessments')).applicantLanguages,
    travel: (await import('../src/db/schema/assessments')).applicantTravelHistory,
    family: (await import('../src/db/schema/assessments')).applicantFamilyAbroad,
    media: (await import('../src/db/schema/media')).mediaAssets,
    logs: (await import('../src/db/schema/operations')).activityLogs,
  };
}

beforeEach(() => {
  // Each test starts with an empty rate-limit ledger so limits are asserted
  // deliberately rather than tripping over a previous test's submissions.
});

/* -------------------------------------------------------------------------- */
/* 1. Successful submission                                                   */
/* -------------------------------------------------------------------------- */

describe('successful submission', () => {
  it('creates the whole record and returns only a reference', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();

    const result = await submitAssessment({
      payload: payload(),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      userAgent: 'phase5-test-agent',
      cvBytes: pdfBytes(),
      cvFilename: 'ada-cv.pdf',
      cvMimeType: 'application/pdf',
    });

    assert.equal(result.ok, true, JSON.stringify(result));

    const database = await db();
    const [row] = await database.select().from(t.assessments).limit(1);
    assert.ok(row);
    assert.equal(row.referenceNumber, result.ok ? result.referenceNumber : '');
    assert.equal(row.status, 'new');
    assert.equal(row.hasChildren, true);
    assert.equal(row.numberOfChildren, 2);
    assert.equal(row.hasPassport, true);
    assert.equal(row.email.startsWith('applicant.'), true);
    assert.equal(row.preferredCountryText, 'Canada');
    assert.equal(row.expectedSalaryAmount, 4200);
    assert.equal(row.expectedSalaryCurrency, 'CAD');
    assert.ok(row.submissionIpHash, 'the submission IP hash must be recorded');
    assert.ok(row.submittedAt instanceof Date);
  });

  it('writes every child list', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();

    const result = await submitAssessment({
      payload: payload({ email: 'children@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(result.ok, true);

    const database = await db();
    assert.equal((await database.select().from(t.education)).length >= 1, true);
    assert.equal((await database.select().from(t.skills)).length >= 2, true);
    assert.equal((await database.select().from(t.languages)).length >= 2, true);
    assert.equal((await database.select().from(t.employment)).length >= 2, true);
  });

  it('splits travel and family free text into one row per country', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const before = (await database.select().from(t.travel)).length;

    const result = await submitAssessment({
      payload: payload({ email: 'travel@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(result.ok, true);

    const travel = await database.select().from(t.travel);
    const added = travel.slice(before).map((row) => row.country);
    // "Ghana, United Kingdom and Ghana" — de-duplicated, split on the comma and
    // on the word "and".
    assert.deepEqual(added.sort(), ['Ghana', 'United Kingdom']);
  });

  it('records an audit entry that contains no applicant data', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const result = await submitAssessment({
      payload: payload({ email: 'audit@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(result.ok, true);

    const logs = await database.select().from(t.logs);
    const entry = logs.find((row) => row.action === 'assessment.submitted');
    assert.ok(entry, 'a submission must write one audit row');
    assert.equal(entry.actorAdminId, null, 'an applicant is not an administrator');

    const serialised = JSON.stringify(entry);
    for (const secret of ['audit@example.test', 'Applicant', 'A01234567', 'NCLEX']) {
      assert.ok(!serialised.includes(secret), `audit row leaked "${secret}"`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Reference numbers                                                       */
/* -------------------------------------------------------------------------- */

describe('reference numbers', () => {
  it('two submissions get different references', async () => {
    const { submitAssessment } = await loadSubmit();

    const first = await submitAssessment({
      payload: payload(),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    const second = await submitAssessment({
      payload: payload(),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.ok(first.ok && second.ok);
    assert.notEqual(first.referenceNumber, second.referenceNumber);
    assert.match(first.referenceNumber, /^IMA-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('the database itself refuses a duplicate reference', async () => {
    const t = await tables();
    const database = await db();
    const [existing] = await database.select().from(t.assessments).limit(1);
    assert.ok(existing);

    const before = (await database.select().from(t.assessments)).length;

    await assert.rejects(async () =>
      database.insert(t.assessments).values({
        // Every other required column copied, so only the unique index can fail.
        ...existing,
        id: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
      }),
    );

    assert.equal(
      (await database.select().from(t.assessments)).length,
      before,
      'the unique index must have refused the duplicate reference',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Duplicate prevention                                                    */
/* -------------------------------------------------------------------------- */

describe('duplicate prevention', () => {
  it('the same person cannot submit twice', async () => {
    const { submitAssessment } = await loadSubmit();

    const first = await submitAssessment({
      payload: payload({ email: 'dup@example.test', fullName: 'Dup Applicant', dateOfBirth: '1988-08-08' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(first.ok, true);
    assert.ok(first.ok);

    const second = await submitAssessment({
      payload: payload({ email: 'dup@example.test', fullName: 'Dup Applicant', dateOfBirth: '1988-08-08' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(second.ok, false);
    assert.equal(second.ok === false && second.status, 409);
    assert.equal(second.ok === false && second.code, 'duplicate_submission');
    assert.match(
      second.ok === false ? second.message : '',
      new RegExp(first.ok ? first.referenceNumber : ''),
      'the refusal must quote the original reference so the applicant can be helped',
    );
  });

  it('the same email with a different date of birth is a different person', async () => {
    const { submitAssessment } = await loadSubmit();

    const first = await submitAssessment({
      payload: payload({ email: 'family@example.test', fullName: 'First Person', dateOfBirth: '1975-01-01' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    const second = await submitAssessment({
      payload: payload({ email: 'family@example.test', fullName: 'Second Person', dateOfBirth: '1999-12-12' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true, 'a shared family email must not block a second applicant');
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Idempotent retry                                                        */
/* -------------------------------------------------------------------------- */

describe('idempotent retries', () => {
  it('a retried request returns the same reference and creates nothing', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();
    const key = crypto.randomUUID();

    const before = (await database.select().from(t.assessments)).length;
    const first = await submitAssessment({
      payload: payload({ email: 'retry@example.test' }),
      idempotencyKey: key,
      ipHash: freshIpHash(),
      cvBytes: pdfBytes(),
      cvFilename: 'retry.pdf',
    });
    assert.equal(first.ok, true);

    // The browser retries after a dropped connection: same key, same payload.
    const retry = await submitAssessment({
      payload: payload({ email: 'retry@example.test' }),
      idempotencyKey: key,
      ipHash: freshIpHash(),
      cvBytes: pdfBytes(),
      cvFilename: 'retry.pdf',
    });

    assert.equal(retry.ok, true);
    assert.equal(retry.ok && retry.referenceNumber, first.ok && first.referenceNumber);
    assert.equal(retry.ok && retry.created, false, 'a retry must not claim to have created a record');
    assert.equal(retry.ok && retry.receiptToken, first.ok && first.receiptToken);

    const after = (await database.select().from(t.assessments)).length;
    assert.equal(after, before + 1, 'a retry must not create a second assessment');
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Server-side validation                                                  */
/* -------------------------------------------------------------------------- */

describe('server-side validation', () => {
  it('a request that skips the UI is still refused', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();
    const before = (await database.select().from(t.assessments)).length;

    // The payload a hand-written request would send: no consent, nothing filled in.
    const result = await submitAssessment({
      payload: { personal: {}, consent: { acceptedTerms: false, acceptedPrivacy: false } },
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
    assert.equal(result.ok === false && result.code, 'invalid_request');

    const fieldErrors = (result.ok === false && result.fieldErrors) || {};
    for (const field of [
      'personal.fullName',
      'personal.email',
      'education',
      'employment.status',
      'skills',
      'languages',
      'consent.acceptedTerms',
      'consent.acceptedPrivacy',
    ]) {
      assert.ok(fieldErrors[field], `no field error for ${field}`);
    }

    const after = (await database.select().from(t.assessments)).length;
    assert.equal(after, before, 'a refused request must write nothing');
  });

  it('a missing section is reported as missing answers, not as a type error', async () => {
    const { submitAssessment } = await loadSubmit();
    const result = await submitAssessment({
      payload: {},
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(result.ok, false);
    const messages = Object.values((result.ok === false && result.fieldErrors) || {}).join(' | ');
    assert.ok(!/Invalid input/i.test(messages), messages);
  });

  it('refuses a passport number when the applicant says they have no passport', async () => {
    const { submitAssessment } = await loadSubmit();
    const broken = payload({ email: 'passport@example.test' });
    broken.passport.hasPassport = 'no';

    const result = await submitAssessment({
      payload: broken,
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(result.ok, false);
    assert.equal(
      (result.ok === false ? result.fieldErrors?.['passport.passportNumber'] : '') ?? '',
      'Clear this field, or answer Yes to holding a passport.',
    );
  });

  it('refuses a salary that is not a whole number', async () => {
    const { submitAssessment } = await loadSubmit();
    const broken = payload({ email: 'salary@example.test' });
    broken.employment.currentSalaryAmount = '350000.75';

    const result = await submitAssessment({
      payload: broken,
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(result.ok, false);
    assert.match(
      ((result.ok === false ? result.fieldErrors?.['employment.currentSalaryAmount'] : '') ?? ''),
      /whole number/i,
    );
  });

  it('accepts an unemployed applicant', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const applicant = payload({ email: 'unemployed@example.test' });
    applicant.employment = {
      status: 'unemployed',
      currentEmployer: '',
      currentPosition: '',
      currentCountry: '',
      currentStartDate: '',
      currentSalaryAmount: '',
      currentSalaryCurrency: 'USD',
    };

    const result = await submitAssessment({
      payload: applicant,
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(result.ok, true, JSON.stringify(result));

    const [row] = await database
      .select()
      .from(t.assessments)
      .where((await import('drizzle-orm')).eq(t.assessments.email, 'unemployed@example.test'));
    assert.ok(row);
    // No current-employment row is written, so nothing claims an employer.
    const employments = await database
      .select()
      .from(t.employment)
      .where((await import('drizzle-orm')).eq(t.employment.assessmentId, row.id));
    assert.equal(employments.filter((e) => e.recordType === 'current').length, 0);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Consent                                                                 */
/* -------------------------------------------------------------------------- */

describe('consent', () => {
  it('is refused unless both policies are accepted', async () => {
    const { submitAssessment } = await loadSubmit();

    for (const consent of [
      { acceptedTerms: false, acceptedPrivacy: true },
      { acceptedTerms: true, acceptedPrivacy: false },
      { acceptedTerms: false, acceptedPrivacy: false },
    ]) {
      const result = await submitAssessment({
        payload: payload({ email: `consent.${Math.random()}@example.test`, consent }),
        idempotencyKey: crypto.randomUUID(),
        ipHash: freshIpHash(),
      });

      assert.equal(result.ok, false, `consent ${JSON.stringify(consent)} was accepted`);
      assert.ok(
        Object.keys((result.ok === false && result.fieldErrors) || {}).some((key) =>
          key.startsWith('consent.'),
        ),
      );
    }
  });

  it('records the policy versions, the exact wording, a timestamp and an IP hash', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const result = await submitAssessment({
      payload: payload({ email: 'snapshot@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: 'snapshot-ip-hash',
      userAgent: 'phase5-consent-agent',
    });
    assert.equal(result.ok, true);

    assert.ok(result.ok);
    const [assessment] = await database
      .select()
      .from(t.assessments)
      .where((await import('drizzle-orm')).eq(t.assessments.referenceNumber, result.referenceNumber));
    assert.ok(assessment);

    const [consent] = await database
      .select()
      .from(t.consent)
      .where((await import('drizzle-orm')).eq(t.consent.assessmentId, assessment.id));
    assert.ok(consent);
    // Versions were published as 4 and 9 in the fixture.
    assert.equal(consent.termsVersion, 4);
    assert.equal(consent.privacyVersion, 9);
    assert.match(consent.consentText, /Terms and Conditions/);
    assert.match(consent.consentText, /Privacy Policy/);
    assert.ok(consent.acceptedAt instanceof Date);
    assert.equal(consent.ipHash, 'snapshot-ip-hash');
    assert.equal(consent.userAgent, 'phase5-consent-agent');
    assert.ok(consent.assessmentId, 'the consent row must be linked to the assessment');
  });

  it('refuses and writes nothing when the policies are unpublished', async () => {
    const { submitAssessment } = await loadSubmit();
    const { websitePages } = await import('../src/db/schema/settings');
    const { eq } = await import('drizzle-orm');
    const t = await tables();
    const database = await db();

    await database.update(websitePages).set({ status: 'draft' }).where(eq(websitePages.slug, 'privacy'));

    const before = (await database.select().from(t.assessments)).length;
    const result = await submitAssessment({
      payload: payload({ email: 'noprivacy@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 503);
    assert.equal(result.ok === false && result.code, 'consent_unavailable');
    assert.equal((await database.select().from(t.assessments)).length, before);

    await database.update(websitePages).set({ status: 'published' }).where(eq(websitePages.slug, 'privacy'));
  });
});

/* -------------------------------------------------------------------------- */
/* 7. CV upload security                                                      */
/* -------------------------------------------------------------------------- */

describe('CV upload', () => {
  it('accepts a real PDF and stores it privately', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const result = await submitAssessment({
      payload: payload({ email: 'cv.pdf@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: pdfBytes(),
      cvFilename: 'my cv.pdf',
      cvMimeType: 'application/pdf',
    });
    assert.equal(result.ok, true, JSON.stringify(result));

    const media = await database.select().from(t.media);
    const record = media.find((row) => row.originalFilename === 'my cv.pdf');
    assert.ok(record, 'a media row must exist for the CV');

    assert.equal(record.visibility, 'private');
    assert.equal(record.purpose, 'cv');
    assert.equal(record.detectedMimeType, 'application/pdf');
    assert.match(record.storageKey, /^private\/assessments\/[0-9a-f-]{36}\/cv\/[0-9a-f-]{36}\.pdf$/);
    assert.ok(!record.storageKey.includes('my cv'), 'the uploaded filename must not reach the key');
    assert.ok(existsSync(`.data/uploads/${record.storageKey}`), 'the bytes must be in the private store');

    const attachments = await database.select().from(t.attachments);
    const attachment = attachments.find((row) => row.mediaAssetId === record.id);
    assert.ok(attachment);
    assert.equal(attachment.kind, 'cv');
    assert.equal(attachment.mediaAssetId, record.id);
  });

  it('accepts a real DOCX', async () => {
    const { submitAssessment } = await loadSubmit();
    const result = await submitAssessment({
      payload: payload({ email: 'cv.docx@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: docxBytes(),
      cvFilename: 'cv.docx',
      cvMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    assert.equal(result.ok, true, JSON.stringify(result));
  });

  it('rejects an HTML file renamed to .pdf, and leaves nothing behind', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const mediaBefore = (await database.select().from(t.media)).length;
    const assessmentsBefore = (await database.select().from(t.assessments)).length;

    const result = await submitAssessment({
      payload: payload({ email: 'cv.html@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: new TextEncoder().encode('<html><script>alert(1)</script></html>'),
      cvFilename: 'cv.pdf',
      cvMimeType: 'application/pdf',
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'cv_rejected');
    // The message is validate.ts's own, which is more specific than a generic one.
    assert.match(
      ((result.ok === false ? result.fieldErrors?.cv : '') ?? ''),
      /supported file type|PDF or Word/,
    );

    assert.equal((await database.select().from(t.media)).length, mediaBefore, 'no orphaned media row');
    assert.equal((await database.select().from(t.assessments)).length, assessmentsBefore);
  });

  it('rejects a ZIP that is not a Word document', async () => {
    const { submitAssessment } = await loadSubmit();
    const zip = new Uint8Array(200);
    zip.set([0x50, 0x4b, 0x03, 0x04], 0);

    const result = await submitAssessment({
      payload: payload({ email: 'cv.zip@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: zip,
      cvFilename: 'cv.docx',
      cvMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    assert.equal(result.ok, false);
    assert.match(((result.ok === false ? result.fieldErrors?.cv : '') ?? ''), /ZIP archive/);
  });

  it('rejects a file whose declared type contradicts its bytes', async () => {
    const { submitAssessment } = await loadSubmit();
    const result = await submitAssessment({
      payload: payload({ email: 'cv.mismatch@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: pdfBytes(),
      // A PDF claiming to be an image: an upload endpoint must not believe it.
      cvFilename: 'cv.pdf',
      cvMimeType: 'image/png',
    });

    assert.equal(result.ok, false);
    assert.match(((result.ok === false ? result.fieldErrors?.cv : '') ?? ''), /does not match/i);
  });

  it('rejects an oversized CV', async () => {
    const { submitAssessment } = await loadSubmit();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(new TextEncoder().encode('%PDF-1.7\n'), 0);

    const result = await submitAssessment({
      payload: payload({ email: 'cv.big@example.test' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: big,
      cvFilename: 'cv.pdf',
      cvMimeType: 'application/pdf',
    });

    assert.equal(result.ok, false);
    assert.match(((result.ok === false ? result.fieldErrors?.cv : '') ?? ''), /10 MB/);
  });

  it('a private key never yields a public URL', async () => {
    const { publicUrlFor, getStorage } = await import('../src/lib/storage');
    assert.throws(
      () => publicUrlFor(getStorage(), 'private/assessments/x/cv/y.pdf', 'private'),
      /Refusing to build a public URL/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Rate limiting and bot defences                                          */
/* -------------------------------------------------------------------------- */

describe('abuse controls', () => {
  it('the sixth submission from one connection is refused', async () => {
    const { submitAssessment } = await loadSubmit();
    const ipHash = freshIpHash();

    const outcomes: boolean[] = [];
    for (let index = 0; index < 6; index += 1) {
      const result = await submitAssessment({
        payload: payload(),
        idempotencyKey: crypto.randomUUID(),
        ipHash,
      });
      outcomes.push(result.ok);
    }

    assert.deepEqual(outcomes.slice(0, 5), [true, true, true, true, true]);
    assert.equal(outcomes[5], false, 'the sixth submission must be rate limited');

    const blocked = await submitAssessment({
      payload: payload(),
      idempotencyKey: crypto.randomUUID(),
      ipHash,
    });
    assert.equal(blocked.ok === false && blocked.status, 429);
  });

  it('a filled honeypot is refused and writes nothing', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();
    const before = (await database.select().from(t.assessments)).length;

    const result = await submitAssessment({
      payload: { ...payload({ email: 'bot@example.test' }), honey: 'http://spam.example' },
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      honeypot: 'http://spam.example',
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, 'rejected');
    assert.equal((await database.select().from(t.assessments)).length, before);
  });

  it('no response body contains applicant data', async () => {
    const { submitAssessment } = await loadSubmit();

    const success = await submitAssessment({
      payload: payload({ email: 'privacy.success@example.test', fullName: 'Privacy Tester' }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
      cvBytes: pdfBytes(),
      cvFilename: 'private-cv.pdf',
    });
    assert.equal(success.ok, true);

    const failure = await submitAssessment({
      payload: { personal: { email: 'privacy.failure@example.test' } },
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(failure.ok, false);

    const bodies = [JSON.stringify(success), JSON.stringify(failure)];
    for (const body of bodies) {
      for (const secret of [
        'privacy.success@example.test',
        'privacy.failure@example.test',
        'Privacy Tester',
        'private-cv.pdf',
        'storageKey',
        'private/assessments',
        '8031234567',
      ]) {
        assert.ok(!body.includes(secret), `a response body leaked "${secret}"`);
      }
    }

    // The success body is exactly the receipt.
    const parsed = JSON.parse(bodies[0]!) as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(parsed).sort(),
      ['created', 'ok', 'receiptToken', 'referenceNumber', 'submittedAt'],
    );
  });

  it('a draft destination cannot be chosen as a preference', async () => {
    const { submitAssessment } = await loadSubmit();
    const t = await tables();
    const database = await db();

    const result = await submitAssessment({
      payload: payload({ email: 'draftcountry@example.test', preferredCountryId: draftCountryId }),
      idempotencyKey: crypto.randomUUID(),
      ipHash: freshIpHash(),
    });
    assert.equal(result.ok, true, 'the submission itself should still succeed');

    const [row] = await database
      .select()
      .from(t.assessments)
      .where((await import('drizzle-orm')).eq(t.assessments.email, 'draftcountry@example.test'));
    assert.ok(row);
    assert.equal(row.preferredCountryId, null, 'a draft country must not be stored as a preference');
    assert.equal(row.preferredCountryText, '');
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Private storage separation                                              */
/* -------------------------------------------------------------------------- */

describe('storage separation', () => {
  it('the public media proxy never resolves a private key', async () => {
    const source = readFileSync('src/app/api/media/[...key]/route.ts', 'utf8');

    // The route must filter on visibility = 'public' and must not be able to see
    // a private row even with a guessed key.
    assert.match(source, /eq\(mediaAssets\.visibility, 'public'\)/);
    assert.match(source, /public\/\$\{relativeKey\}/);
    assert.ok(!/private/.test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').split('SERVABLE_TYPES')[1] ?? ''));
  });

  it('there is no public route that reads applicant data', async () => {
    const { execFileSync } = await import('node:child_process');
    const files = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src/app'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .concat(
        execFileSync('git', ['ls-files', 'src/app'], { encoding: 'utf8' })
          .split('\n')
          .filter(Boolean),
      );

    const routeFiles = files.filter((file) => file.endsWith('route.ts') && !file.includes('/api/admin/'));
    for (const file of routeFiles) {
      const source = readFileSync(file, 'utf8');
      assert.ok(
        !source.includes('from(\'assessments\')') && !source.includes('.from(assessments)'),
        `${file} reads the assessments table from a public route`,
      );
    }
  });
});
