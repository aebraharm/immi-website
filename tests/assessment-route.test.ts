/**
 * Phase 5 verification — public submission route.
 *
 * The service tests prove what happens once a submission reaches the service;
 * this file proves the HTTP edge: what the route accepts, what it refuses before
 * reading a body, and what it is willing to say in a response.
 *
 * It runs the shipped `POST` handler with real `Request` objects, against a
 * scratch database and the local storage adapter — the same wiring the browser
 * uses, minus the network.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import { createClient, type Client } from '@libsql/client';

const REPO_ROOT = process.cwd();
const SCRATCH_DB = './.data/verify-assessment-route.db';
const SCRATCH_URL = `file:${SCRATCH_DB}`;

let client: Client;

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
  process.env.STORAGE_DRIVER = 'local';

  client = createClient({ url: SCRATCH_URL });

  const { getDb } = await import('../src/db');
  const { websitePages } = await import('../src/db/schema/settings');

  await getDb()
    .insert(websitePages)
    .values([
      { slug: 'terms', title: 'Terms', status: 'published', version: 2, contentMd: 'Terms.' },
      { slug: 'privacy', title: 'Privacy', status: 'published', version: 3, contentMd: 'Privacy.' },
    ]);
});

after(() => {
  client?.close();
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

let counter = 0;

function validPayload(): Record<string, unknown> {
  counter += 1;
  const n = counter;

  return {
    personal: {
      fullName: `Route Applicant ${n}`,
      dateOfBirth: '1992-03-04',
      gender: 'male',
      nationality: 'GH',
      countryOfResidence: 'GH',
      residentialAddress: '5 Test Avenue',
      city: 'Accra',
      stateProvince: 'Greater Accra',
      postalCode: 'GA123',
      mobileCountryCode: '+233',
      mobileNumber: '244123456',
      altMobileCountryCode: '',
      altMobileNumber: '',
      email: `route.${n}@example.test`,
      maritalStatus: 'single',
      hasChildren: 'no',
      numberOfChildren: '',
    },
    passport: {
      hasPassport: 'no',
      passportNumber: '',
      passportCityOfIssue: '',
      passportIssueDate: '',
      passportExpiryDate: '',
    },
    education: [
      { qualificationLevel: 'diploma', institutionName: 'Accra Polytechnic', country: 'GH', yearCompleted: '2014' },
    ],
    employment: {
      status: 'unemployed',
      currentEmployer: '',
      currentPosition: '',
      currentCountry: '',
      currentStartDate: '',
      currentSalaryAmount: '',
      currentSalaryCurrency: 'USD',
    },
    previousEmployment: [],
    skills: ['welding'],
    languages: { english: 'fluent', french: '', spanish: '', german: '' },
    preferences: {
      preferredCountryId: '',
      preferredOccupation: 'Welder',
      expectedSalaryAmount: '',
      expectedSalaryCurrency: 'USD',
    },
    additional: {
      hasMedicalCondition: 'no',
      medicalDetails: '',
      hasCriminalRecord: 'no',
      criminalRecordDetails: '',
      hasTravelledAbroad: 'no',
      travelledCountries: '',
      hasFamilyAbroad: 'no',
      familyAbroadCountries: '',
      hasProfessionalExams: 'no',
      professionalExamsNotes: '',
    },
    consent: { acceptedTerms: true, acceptedPrivacy: true },
    honey: '',
  };
}

/**
 * A PDF whose first bytes are the real signature.
 *
 * Returned as an `ArrayBuffer` rather than a `Uint8Array` because `new File()`
 * takes `BlobPart`s, and a `Uint8Array` view is not one under the DOM types.
 */
function pdfBytes(): ArrayBuffer {
  const bytes = new Uint8Array(400);
  bytes.set(new TextEncoder().encode('%PDF-1.7\n%%EOF\n'), 0);
  return bytes.buffer as ArrayBuffer;
}

/** Build a multipart POST the way the browser does. */
function submissionRequest(options: {
  payload?: unknown;
  cv?: { bytes: ArrayBuffer; name: string; type: string } | null;
  idempotencyKey?: string;
  ip?: string;
  contentLength?: number;
}): Request {
  const form = new FormData();
  form.set('payload', JSON.stringify(options.payload ?? validPayload()));

  if (options.cv) {
    form.set('cv', new File([options.cv.bytes], options.cv.name, { type: options.cv.type }));
  }

  const headers = new Headers({
    'x-forwarded-for': options.ip ?? `198.51.100.${(counter % 200) + 1}`,
    'user-agent': 'phase5-route-test',
  });
  if (options.idempotencyKey) headers.set('x-idempotency-key', options.idempotencyKey);
  if (options.contentLength !== undefined) {
    headers.set('content-length', String(options.contentLength));
  }

  return new Request('http://localhost/api/assessment', { method: 'POST', body: form, headers });
}

async function loadRoute() {
  return import('../src/app/api/assessment/route');
}

/* -------------------------------------------------------------------------- */
/* Method and content-type gates                                              */
/* -------------------------------------------------------------------------- */

describe('request gates', () => {
  it('refuses a JSON body without reading it', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new Request('http://localhost/api/assessment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload()),
      }),
    );

    assert.equal(response.status, 415);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.error, 'invalid_request');
  });

  it('answers GET with 405 rather than a page', async () => {
    const { GET } = await loadRoute();
    const response = GET();
    assert.equal(response.status, 405);
  });

  it('refuses a declared oversize body before parsing it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      submissionRequest({ contentLength: 200 * 1024 * 1024 }),
    );

    assert.equal(response.status, 413);
    const body = (await response.json()) as Record<string, unknown>;
    assert.match(String(body.message), /10 MB/);
  });

  it('refuses a request with no answers', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    const response = await POST(
      new Request('http://localhost/api/assessment', {
        method: 'POST',
        body: form,
        headers: { 'x-forwarded-for': '198.51.100.77' },
      }),
    );

    assert.equal(response.status, 400);
  });
});

/* -------------------------------------------------------------------------- */
/* Successful submission                                                      */
/* -------------------------------------------------------------------------- */

describe('successful submission', () => {
  it('returns 201 with a reference number and nothing else about the applicant', async () => {
    const { POST } = await loadRoute();
    const payload = validPayload();
    const response = await POST(
      submissionRequest({
        payload,
        cv: { bytes: pdfBytes(), name: 'route-cv.pdf', type: 'application/pdf' },
        idempotencyKey: crypto.randomUUID(),
        ip: '203.0.113.41',
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.ok, true);
    assert.match(String(body.referenceNumber), /^IMA-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/);

    // The receipt is the whole body: no email, name, phone, CV key or storage path.
    assert.deepEqual(
      Object.keys(body).sort(),
      ['ok', 'receiptToken', 'referenceNumber', 'submittedAt'],
    );

    const serialised = JSON.stringify(body);
    const personal = payload.personal as Record<string, string>;
    for (const secret of [personal.email!, personal.fullName!, personal.mobileNumber!, 'route-cv.pdf']) {
      assert.ok(!serialised.includes(secret), `response leaked "${secret}"`);
    }

    // Cache headers: a receipt must never be stored by a shared cache.
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  });
});

/* -------------------------------------------------------------------------- */
/* Refusals                                                                   */
/* -------------------------------------------------------------------------- */

describe('refusals', () => {
  it('returns field errors for an incomplete submission', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      submissionRequest({ payload: { personal: {} }, ip: '203.0.113.42' }),
    );

    const body = (await response.json()) as {
      ok: boolean;
      error: string;
      fieldErrors: Record<string, string>;
    };

    assert.equal(response.status, 400);
    assert.equal(body.error, 'invalid_request');
    assert.ok(body.fieldErrors['personal.fullName']);
    assert.ok(body.fieldErrors['consent.acceptedTerms']);
    // Never a stack trace or an internal identifier.
    assert.ok(!JSON.stringify(body).includes('    at '));
  });

  it('refuses a disguised file even when the browser claims a PDF', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      submissionRequest({
        cv: {
          bytes: new TextEncoder().encode('<svg onload="alert(1)"></svg>').buffer as ArrayBuffer,
          name: 'cv.pdf',
          type: 'application/pdf',
        },
        ip: '203.0.113.43',
      }),
    );

    const body = (await response.json()) as {
      error: string;
      fieldErrors: Record<string, string>;
    };

    assert.equal(response.status, 400);
    assert.equal(body.error, 'cv_rejected');
    assert.ok(body.fieldErrors.cv);
    assert.ok(!JSON.stringify(body).includes('private/'));
  });

  it('refuses a submission with no consent', async () => {
    const { POST } = await loadRoute();
    const payload = validPayload();
    payload.consent = { acceptedTerms: false, acceptedPrivacy: false };

    const response = await POST(submissionRequest({ payload, ip: '203.0.113.44' }));
    const body = (await response.json()) as { fieldErrors: Record<string, string> };

    assert.equal(response.status, 400);
    assert.ok(body.fieldErrors['consent.acceptedTerms']);
    assert.ok(body.fieldErrors['consent.acceptedPrivacy']);
  });
});
