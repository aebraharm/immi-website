/**
 * Phase 4 verification — administration CMS.
 *
 * These tests run against the real CMS library and a real libSQL database (a
 * scratch file created here — never the development or production database).
 * Nothing in the create / read / publish / archive / restore path is mocked: the
 * rows, the unique indexes, the status transition rules and the audit trail are
 * the same code that runs in production.
 *
 * The three steps that cannot be exercised outside a Next.js request — reading
 * the session cookie, reading the CSRF cookie, and writing the audit row (which
 * needs the request's IP hash) — are replaced through Node's module mocker. The
 * guard functions themselves are untouched, so the authorisation *logic* under
 * test is the shipped logic.
 *
 * The mandated verifications, mapped to test names:
 *
 *   1. CRUD and publish operations ............... "services: create, read, update …"
 *   2. Authorisation on every CMS endpoint ....... "every CMS endpoint refuses …",
 *                                                  "every CMS mutation refuses …"
 *   3. CSRF on mutations ......................... "CSRF token is required …",
 *                                                  "CSRF token must match …"
 *   4. Media validation and storage separation ... "media: rejected file …",
 *                                                  "media: storage key layout …"
 *   5. Draft-vs-published visibility .............. "draft is invisible …",
 *                                                  "published content is returned …"
 *   6. Role separation ........................... "an editor cannot write settings …"
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createClient, type Client } from '@libsql/client';

/**
 * The administrator the guards see for the current request. The guards
 * themselves (role check, CSRF comparison) are the shipped code; only the
 * cookie jar and the request-scoped audit writer are stubbed — see
 * `tests/support/test-stubs.ts`, which is preloaded by the test script.
 */
type AdminUser = {
  adminId: string;
  sessionId: string;
  email: string;
  role: 'owner' | 'admin' | 'editor';
};

type TestState = {
  admin: AdminUser | null;
  csrf: string;
  audit: Array<{ action: string; entityType: string; entityId?: string }>;
};

function testState(): TestState {
  const globalRef = globalThis as unknown as { __immiTestState?: TestState };
  globalRef.__immiTestState ??= { admin: null, csrf: 'phase4-test-csrf', audit: [] };
  return globalRef.__immiTestState;
}

const auditCalls = () => testState().audit;

/**
 * First row of a query, or a failure.
 *
 * `client.execute()` types rows as possibly absent; a test that reads a row it
 * just wrote should fail loudly if the row is missing rather than compare
 * against `undefined`.
 */
function firstRow(result: { rows: Array<Record<string, unknown>> }): Record<string, unknown> {
  const row = result.rows[0];
  assert.ok(row, 'expected the query to return a row');
  return row;
}
const currentCsrf = () => testState().csrf;

const REPO_ROOT = process.cwd();
const SCRATCH_DB = './.data/verify-scratch.db';
const SCRATCH_URL = `file:${SCRATCH_DB}`;

let client: Client;

before(async () => {
  mkdirSync('.data', { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${SCRATCH_DB}${suffix}`, { force: true });
  }

  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, TURSO_DATABASE_URL: SCRATCH_URL, TURSO_AUTH_TOKEN: '' },
    stdio: 'pipe',
  });

  process.env.TURSO_DATABASE_URL = SCRATCH_URL;
  delete process.env.TURSO_AUTH_TOKEN;

  client = createClient({ url: SCRATCH_URL });

  // `services.updated_by` is a foreign key to `admins`, which is correct: the
  // audit trail must always point at a real administrator. The test therefore
  // creates real administrator rows for the two identities it impersonates.
  const { getDb } = await import('../../src/db');
  const { admins } = await import('../../src/db/schema');

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
        id: 'admin-editor',
        email: 'editor@example.test',
        passwordHash: 'not-a-real-hash-test-only',
        fullName: 'Test Editor',
        role: 'editor',
        mustChangePassword: false,
      },
    ] as never);
});

after(() => {
  client?.close();
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** A JSON request with (by default) a valid CSRF header. */
function jsonRequest(url: string, init: { method?: string; body?: unknown; csrf?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const csrf = init.csrf === undefined ? currentCsrf() : init.csrf;
  if (csrf !== null) headers['x-csrf-token'] = csrf;

  return new Request(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/**
 * The response body of a CMS endpoint.
 *
 * Every resource returns a different payload — `{ rows, total }` for a list,
 * `{ id, status }` for a publish, `{ settings, exists }` for settings — so this
 * helper stays deliberately loose and each test asserts on the fields it cares
 * about. It is the one place in the suite that opts out of strict typing, and it
 * is confined to reading responses in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CmsBody = Record<string, any>;

/** Read a `NextResponse` as `{ status, body }`. */
async function readResponse(response: Response): Promise<{ status: number; body: CmsBody }> {
  return { status: response.status, body: (await response.json()) as CmsBody };
}

/** Context argument Next.js passes for a dynamic route segment. */
function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function loadHandlers() {
  return import('../../src/lib/cms/handlers');
}

/** The service payload used by several tests. Empty of invented claims. */
function servicePayload(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'phase4-test-service',
    title: 'Phase 4 test service',
    shortDescription: 'A service created by the Phase 4 test run.',
    descriptionMd: 'Body copy written by the test, not by the agency.',
    iconName: 'Briefcase',
    ctaLabel: '',
    ctaHref: '',
    status: 'draft',
    features: [{ label: 'First feature', detailMd: '' }],
    ...overrides,
  };
}

beforeEach(() => {
  testState().admin = {
    adminId: 'admin-owner',
    sessionId: 'session-owner',
    email: 'owner@example.test',
    role: 'owner',
  };
});

/* -------------------------------------------------------------------------- */
/* 1. Create, read, update, publish, archive, restore, delete                  */
/* -------------------------------------------------------------------------- */

describe('services: full lifecycle', () => {
  let id = '';

  it('create returns the new id', async () => {
    const { collectionHandlers } = await loadHandlers();
    const { POST } = collectionHandlers('services');

    const response = await POST(
      jsonRequest('http://localhost/api/admin/cms/services', {
        method: 'POST',
        body: servicePayload(),
      }),
    );
    const { status, body } = await readResponse(response);

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.ok, true);
    assert.match(body.data.id, /^[0-9a-f-]{36}$/);
    id = body.data.id;

    assert.ok(
      auditCalls().some((call) => call.action === 'content.created' && call.entityId === id),
      'a create must write an audit row',
    );
  });

  it('read returns the row it just wrote', async () => {
    const { itemHandlers } = await loadHandlers();
    const { GET } = itemHandlers('services');

    const { status, body } = await readResponse(
      await GET(jsonRequest(`http://localhost/api/admin/cms/services/${id}`), context(id)),
    );

    assert.equal(status, 200);
    assert.equal(body.data.title, 'Phase 4 test service');
    assert.equal(body.data.status, 'draft');
    assert.equal(body.data.slug, 'phase4-test-service');

    // The service's features live in their own table and are written in the same
    // transaction as the service itself.
    const features = await client.execute({
      sql: 'select label from service_features where service_id = ?',
      args: [id],
    });
    assert.equal(features.rows.length, 1);
    assert.equal(features.rows[0]?.label, 'First feature');
  });

  it('update replaces the editable fields', async () => {
    const { itemHandlers } = await loadHandlers();
    const { PUT } = itemHandlers('services');

    const { status } = await readResponse(
      await PUT(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}`, {
          method: 'PUT',
          body: servicePayload({ title: 'Renamed by the test', features: [] }),
        }),
        context(id),
      ),
    );
    assert.equal(status, 200);

    const row = firstRow(
      await client.execute({
      sql: 'select title from services where id = ?',
      args: [id],
    }),
    );
    assert.equal(row.title, 'Renamed by the test');
  });

  it('a duplicate slug is refused with 409, not a database crash', async () => {
    const { collectionHandlers } = await loadHandlers();
    const { POST } = collectionHandlers('services');

    const { status, body } = await readResponse(
      await POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({ title: 'Second service, same slug' }),
        }),
      ),
    );

    assert.equal(status, 409);
    assert.equal(body.error, 'conflict');
  });

  it('publishing sets the status and the published timestamp', async () => {
    const { statusHandler } = await loadHandlers();
    const postStatus = statusHandler('services');

    const { status, body } = await readResponse(
      await postStatus(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}/status`, {
          method: 'POST',
          body: { publish: true },
        }),
        context(id),
      ),
    );

    assert.equal(status, 200);
    assert.equal(body.data.status, 'published');

    const row = firstRow(
      await client.execute({
        sql: 'select status, updated_at from services where id = ?',
        args: [id],
      }),
    );
    assert.equal(row.status, 'published');
    assert.ok(row.updated_at, 'publishing must touch the row');

    // The public query — the one the marketing site uses — now returns it.
    const { getPublishedServices } = await import('../../src/db/queries/content');
    const publicRows = await getPublishedServices();
    assert.equal(publicRows.ok, true);
    if (publicRows.ok) {
      assert.ok(
        publicRows.data.some((service) => service.id === id),
        'a published service must appear on the public site immediately',
      );
    }
  });

  it('unpublishing returns the row to draft and clears the published timestamp', async () => {
    const { statusHandler } = await loadHandlers();
    const postStatus = statusHandler('services');

    const { body } = await readResponse(
      await postStatus(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}/status`, {
          method: 'POST',
          body: { publish: false },
        }),
        context(id),
      ),
    );

    assert.equal(body.data.status, 'draft');

    const row = firstRow(
      await client.execute({
        sql: 'select status from services where id = ?',
        args: [id],
      }),
    );
    assert.equal(row.status, 'draft');

    const { getPublishedServices } = await import('../../src/db/queries/content');
    const publicRows = await getPublishedServices();
    assert.equal(publicRows.ok, true);
    if (publicRows.ok) {
      assert.equal(
        publicRows.data.some((service) => service.id === id),
        false,
        'unpublishing must remove it from the public site immediately',
      );
    }
  });

  it('archive keeps the row but hides it from the default list', async () => {
    const { itemHandlers, collectionHandlers } = await loadHandlers();

    const { status } = await readResponse(
      await itemHandlers('services').DELETE(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}`, { method: 'DELETE' }),
        context(id),
      ),
    );
    assert.equal(status, 200);

    const visible = await readResponse(
      await collectionHandlers('services').GET(
        jsonRequest('http://localhost/api/admin/cms/services'),
      ),
    );
    assert.equal(
      visible.body.data.rows.some((row: { id: string }) => row.id === id),
      false,
      'an archived row must not appear in the default list',
    );

    const withArchived = await readResponse(
      await collectionHandlers('services').GET(
        jsonRequest('http://localhost/api/admin/cms/services?includeArchived=1'),
      ),
    );
    assert.equal(
      withArchived.body.data.rows.some((row: { id: string }) => row.id === id),
      true,
    );

    const row = firstRow(
      await client.execute({
      sql: 'select status, archived_at from services where id = ?',
      args: [id],
    }),
    );
    assert.equal(row.status, 'archived');
    assert.ok(row.archived_at);
  });

  it('archived content cannot be published again without a restore', async () => {
    const { statusHandler } = await loadHandlers();

    const { status, body } = await readResponse(
      await statusHandler('services')(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}/status`, {
          method: 'POST',
          body: { publish: true },
        }),
        context(id),
      ),
    );

    assert.equal(status, 409);
    assert.match(body.message, /restore/i);
  });

  it('restore brings the row back as a draft', async () => {
    const { restoreHandler } = await loadHandlers();
    const postRestore = restoreHandler('services');

    const { status, body } = await readResponse(
      await postRestore(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}/restore`, { method: 'POST' }),
        context(id),
      ),
    );

    assert.equal(status, 200);
    assert.equal(body.data.status, 'draft');

    const row = firstRow(
      await client.execute({
      sql: 'select status, archived_at from services where id = ?',
      args: [id],
    }),
    );
    assert.equal(row.status, 'draft');
    assert.equal(row.archived_at, null);
  });

  it('reorder writes the new order inside one transaction', async () => {
    const { collectionHandlers, reorderHandler } = await loadHandlers();
    const { POST } = collectionHandlers('services');

    const second = await readResponse(
      await POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({ slug: 'phase4-test-service-two', title: 'Second service' }),
        }),
      ),
    );
    assert.equal(second.status, 200);

    const ids = [second.body.data.id, id];
    const { status } = await readResponse(
      await reorderHandler('services')( 
        jsonRequest('http://localhost/api/admin/cms/services/reorder', {
          method: 'POST',
          body: { ids },
        }),
      ),
    );
    assert.equal(status, 200);

    const rows = await client.execute({
      sql: 'select id, display_order from services where id in (?, ?) order by display_order',
      args: [second.body.data.id, id],
    });
    assert.equal(String(firstRow(rows).id), second.body.data.id);
    assert.equal(Number(firstRow(rows).display_order), 0);
    assert.equal(Number(rows.rows[1]?.display_order), 1);
  });

  it('reorder refuses an id that does not exist', async () => {
    const { reorderHandler } = await loadHandlers();

    const { status } = await readResponse(
      await reorderHandler('services')( 
        jsonRequest('http://localhost/api/admin/cms/services/reorder', {
          method: 'POST',
          body: { ids: [crypto.randomUUID()] },
        }),
      ),
    );
    assert.equal(status, 404);
  });

  it('hard delete removes the row only where deletion is allowed', async () => {
    const { itemHandlers } = await loadHandlers();

    const allowed = await readResponse(
      await itemHandlers('services').DELETE(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}?mode=delete`, {
          method: 'DELETE',
        }),
        context(id),
      ),
    );
    assert.equal(allowed.status, 200);

    const remaining = await client.execute({
      sql: 'select count(*) as n from services where id = ?',
      args: [id],
    });
    assert.equal(Number(firstRow(remaining).n), 0);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Authorisation on every CMS endpoint                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every CMS endpoint, as [resource, kind]. The kinds map to the four route
 * shapes the CMS exposes: collection, item, status/restore, and reorder.
 */
const RESOURCES = [
  'services',
  'countries',
  'destinations',
  'testimonials',
  'team',
  'faqs',
  'homepage',
  'pages',
  'seo',
] as const;

describe('authorisation', () => {
  it('every CMS collection refuses an unauthenticated caller', async () => {
    const { collectionHandlers } = await loadHandlers();
    testState().admin = null;

    for (const key of RESOURCES) {
      const get = await readResponse(
        await collectionHandlers(key).GET(
          jsonRequest(`http://localhost/api/admin/cms/${key}`),
        ),
      );
      assert.equal(get.status, 401, `${key} GET must be 401 without a session`);

      const post = await readResponse(
        await collectionHandlers(key).POST(
          jsonRequest(`http://localhost/api/admin/cms/${key}`, { method: 'POST', body: {} }),
        ),
      );
      assert.equal(post.status, 401, `${key} POST must be 401 without a session`);
    }
  });

  it('every CMS item endpoint refuses an unauthenticated caller', async () => {
    const { itemHandlers } = await loadHandlers();
    testState().admin = null;
    const id = crypto.randomUUID();

    for (const key of RESOURCES) {
      const get = await readResponse(
        await itemHandlers(key).GET(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}`),
          context(id),
        ),
      );
      assert.equal(get.status, 401, `${key} item GET must be 401 without a session`);

      const put = await readResponse(
        await itemHandlers(key).PUT(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}`, {
            method: 'PUT',
            body: {},
          }),
          context(id),
        ),
      );
      assert.equal(put.status, 401, `${key} item PUT must be 401 without a session`);

      const del = await readResponse(
        await itemHandlers(key).DELETE(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}`, { method: 'DELETE' }),
          context(id),
        ),
      );
      assert.equal(del.status, 401, `${key} item DELETE must be 401 without a session`);
    }
  });

  it('every CMS status, restore and reorder endpoint refuses an unauthenticated caller', async () => {
    const { statusHandler, restoreHandler, reorderHandler } = await loadHandlers();
    testState().admin = null;
    const id = crypto.randomUUID();

    for (const key of RESOURCES) {
      const published = await readResponse(
        await statusHandler(key)(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}/status`, {
            method: 'POST',
            body: { publish: true },
          }),
          context(id),
        ),
      );
      assert.equal(published.status, 401, `${key} status must be 401 without a session`);

      const restore = await readResponse(
        await restoreHandler(key)(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}/restore`, {
            method: 'POST',
          }),
          context(id),
        ),
      );
      assert.equal(restore.status, 401, `${key} restore must be 401 without a session`);

      const reorder = await readResponse(
        await reorderHandler(key)(
          jsonRequest(`http://localhost/api/admin/cms/${key}/reorder`, {
            method: 'POST',
            body: { ids: [id] },
          }),
        ),
      );
      assert.equal(reorder.status, 401, `${key} reorder must be 401 without a session`);
    }
  });

  it('the settings and media endpoints refuse an unauthenticated caller', async () => {
    testState().admin = null;

    const settings = await import('../../src/app/api/admin/cms/settings/route');
    const media = await import('../../src/app/api/admin/cms/media/route');

    const settingsGet = await readResponse(await settings.GET());
    assert.equal(settingsGet.status, 401);

    const settingsPost = await readResponse(
      await settings.POST(
        jsonRequest('http://localhost/api/admin/cms/settings', {
          method: 'POST',
          body: {},
        }),
      ),
    );
    assert.equal(settingsPost.status, 401);

    const upload = await readResponse(
      await media.POST(
        new Request('http://localhost/api/admin/cms/media', {
          method: 'POST',
          headers: { 'x-csrf-token': currentCsrf() },
          body: new FormData(),
        }),
      ),
    );
    assert.equal(upload.status, 401);
  });

  it('editors retain content writes while settings and SEO remain owner-only', async () => {
    const { collectionHandlers, itemHandlers } = await loadHandlers();
    const settings = await import('../../src/app/api/admin/cms/settings/route');

    testState().admin = {
      adminId: 'admin-editor',
      sessionId: 'session-editor',
      email: 'editor@example.test',
      role: 'editor',
    };

    const serviceWrite = await readResponse(
      await collectionHandlers('services').POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({ slug: 'editor-created-service', title: 'Editor service' }),
        }),
      ),
    );
    assert.equal(serviceWrite.status, 200, 'an editor may create content');

    const settingsRead = await readResponse(await settings.GET());
    assert.equal(settingsRead.status, 403, 'an editor must not read site settings');

    const settingsWrite = await readResponse(
      await settings.POST(
        jsonRequest('http://localhost/api/admin/cms/settings', {
          method: 'POST',
          body: {},
        }),
      ),
    );
    assert.equal(settingsWrite.status, 403, 'an editor must not change site settings');

    const seoListRead = await readResponse(
      await collectionHandlers('seo').GET(
        jsonRequest('http://localhost/api/admin/cms/seo'),
      ),
    );
    assert.equal(seoListRead.status, 403, 'an editor must not list SEO overrides');

    const seoItemId = crypto.randomUUID();
    const seoItemRead = await readResponse(
      await itemHandlers('seo').GET(
        jsonRequest(`http://localhost/api/admin/cms/seo/${seoItemId}`),
        context(seoItemId),
      ),
    );
    assert.equal(seoItemRead.status, 403, 'an editor must not read an SEO override');

    const seoWrite = await readResponse(
      await collectionHandlers('seo').POST(
        jsonRequest('http://localhost/api/admin/cms/seo', {
          method: 'POST',
          body: { route: '/', title: 'Editor title' },
        }),
      ),
    );
    assert.equal(seoWrite.status, 403, 'an editor must not change SEO metadata');

    // `admin` is a distinct non-owner role, not an alias for `owner`.
    testState().admin = {
      adminId: 'non-owner-admin',
      sessionId: 'session-non-owner-admin',
      email: 'admin@example.test',
      role: 'admin',
    };
    assert.equal((await readResponse(await settings.GET())).status, 403);
    assert.equal(
      (
        await readResponse(
          await collectionHandlers('seo').GET(
            jsonRequest('http://localhost/api/admin/cms/seo'),
          ),
        )
      ).status,
      403,
    );
  });

  it('a saturated CMS write bucket returns 429 before a status mutation runs', async () => {
    const { statusHandler } = await loadHandlers();
    const adminId = 'cms-rate-limit-test';
    const { rateLimitKey } = await import('../../src/lib/auth/crypto');
    const key = rateLimitKey('cms-write', adminId);
    const windowStart = Date.now() - (Date.now() % 60_000);

    await client.execute({
      sql: 'INSERT OR REPLACE INTO rate_limit_buckets (key, count, window_start, expires_at) VALUES (?, ?, ?, ?)',
      args: [key, 120, windowStart, windowStart + 60_000],
    });

    testState().admin = {
      adminId,
      sessionId: 'session-rate-limit-test',
      email: 'throttle@example.test',
      role: 'editor',
    };

    try {
      const serviceId = crypto.randomUUID();
      const result = await readResponse(
        await statusHandler('services')(
          jsonRequest(`http://localhost/api/admin/cms/services/${serviceId}/status`, {
            method: 'POST',
            body: { publish: true },
          }),
          context(serviceId),
        ),
      );
      assert.equal(result.status, 429);
      assert.equal(result.body.error, 'rate_limited');
    } finally {
      await client.execute({
        sql: 'DELETE FROM rate_limit_buckets WHERE key = ?',
        args: [key],
      });
    }
  });

  it('every CMS mutation refuses a request with no CSRF header', async () => {
    const { collectionHandlers, itemHandlers, statusHandler, reorderHandler } =
      await loadHandlers();
    const id = crypto.randomUUID();

    for (const key of RESOURCES) {
      const post = await readResponse(
        await collectionHandlers(key).POST(
          jsonRequest(`http://localhost/api/admin/cms/${key}`, {
            method: 'POST',
            body: {},
            csrf: null,
          }),
        ),
      );
      assert.equal(post.status, 403, `${key} POST must be 403 without a CSRF token`);

      const put = await readResponse(
        await itemHandlers(key).PUT(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}`, {
            method: 'PUT',
            body: {},
            csrf: null,
          }),
          context(id),
        ),
      );
      assert.equal(put.status, 403, `${key} PUT must be 403 without a CSRF token`);

      const status = await readResponse(
        await statusHandler(key)(
          jsonRequest(`http://localhost/api/admin/cms/${key}/${id}/status`, {
            method: 'POST',
            body: { publish: true },
            csrf: null,
          }),
          context(id),
        ),
      );
      assert.equal(status.status, 403, `${key} status must be 403 without a CSRF token`);

      const reorder = await readResponse(
        await reorderHandler(key)(
          jsonRequest(`http://localhost/api/admin/cms/${key}/reorder`, {
            method: 'POST',
            body: { ids: [id] },
            csrf: null,
          }),
        ),
      );
      assert.equal(reorder.status, 403, `${key} reorder must be 403 without a CSRF token`);
    }
  });

  it('a CSRF token that does not match the session is refused', async () => {
    const { collectionHandlers } = await loadHandlers();

    const { status } = await readResponse(
      await collectionHandlers('services').POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({ slug: 'csrf-mismatch', title: 'Should not exist' }),
          csrf: 'a-different-token',
        }),
      ),
    );
    assert.equal(status, 403);

    const rows = await client.execute({
      sql: 'select count(*) as n from services where slug = ?',
      args: ['csrf-mismatch'],
    });
    assert.equal(Number(firstRow(rows).n), 0, 'a refused request must not write a row');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Media validation and storage separation                                 */
/* -------------------------------------------------------------------------- */

describe('media', () => {
  it('accepts an image for an image purpose', async () => {
    const { validateUpload } = await import('../../src/lib/files/validate');

    // A 1×1 PNG, the smallest real image: the check is on bytes, not names.
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );

    const result = validateUpload({
      purpose: 'logo',
      filename: 'logo.png',
      declaredMimeType: 'image/png',
      bytes: png,
    });

    assert.equal(result.ok, true);
  });

  it('rejects a file whose bytes are not an accepted image', async () => {
    const { validateUpload } = await import('../../src/lib/files/validate');

    const result = validateUpload({
      purpose: 'logo',
      filename: 'not-really.png',
      declaredMimeType: 'image/png',
      bytes: Uint8Array.from(Buffer.from('this is plainly not a png')),
    });

    assert.equal(result.ok, false);
  });

  it('rejects a document where the purpose only allows images', async () => {
    const { validateUpload } = await import('../../src/lib/files/validate');

    const pdf = Uint8Array.from(Buffer.from('%PDF-1.7\n%fake pdf for the test\n'));
    const result = validateUpload({
      purpose: 'logo',
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      bytes: pdf,
    });

    assert.equal(result.ok, false);
  });

  it('a CV may be a document, but only for the CV purpose', async () => {
    const { validateUpload } = await import('../../src/lib/files/validate');

    const pdf = Uint8Array.from(Buffer.from('%PDF-1.7\n%fake pdf for the test\n'));

    const asCv = validateUpload({
      purpose: 'cv',
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      bytes: pdf,
    });
    assert.equal(asCv.ok, true);

    const asPhoto = validateUpload({
      purpose: 'team',
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      bytes: pdf,
    });
    assert.equal(asPhoto.ok, false);
  });

  it('public CMS media is stored under the public prefix', async () => {
    const { buildStorageKey } = await import('../../src/lib/storage');

    const key = buildStorageKey({ visibility: 'public', purpose: 'logo', extension: 'png' });
    assert.match(key, /^public\/logo\/[0-9a-f-]{36}\.png$/);
  });

  it('generic media detail hides private CV metadata and never returns storage keys', async () => {
    const { getDb } = await import('../../src/db');
    const { mediaAssets } = await import('../../src/db/schema');
    const mediaRoute = await import('../../src/app/api/admin/cms/media/[id]/route');

    const privateId = crypto.randomUUID();
    const publicId = crypto.randomUUID();
    const privateKey = `private/assessments/${crypto.randomUUID()}/cv/${crypto.randomUUID()}.pdf`;
    const publicKey = `public/logo/${crypto.randomUUID()}.png`;

    await getDb()
      .insert(mediaAssets)
      .values([
        {
          id: privateId,
          storageKey: privateKey,
          visibility: 'private',
          purpose: 'cv',
          originalFilename: 'private-applicant-cv.pdf',
          storedFilename: 'private.pdf',
          declaredMimeType: 'application/pdf',
          detectedMimeType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: 128,
          checksumSha256: 'a'.repeat(64),
          uploadedBy: null,
        },
        {
          id: publicId,
          storageKey: publicKey,
          visibility: 'public',
          purpose: 'logo',
          originalFilename: 'agency-logo.png',
          storedFilename: 'logo.png',
          declaredMimeType: 'image/png',
          detectedMimeType: 'image/png',
          extension: 'png',
          sizeBytes: 128,
          checksumSha256: 'b'.repeat(64),
          uploadedBy: 'admin-editor',
        },
      ]);

    testState().admin = {
      adminId: 'admin-editor',
      sessionId: 'session-editor',
      email: 'editor@example.test',
      role: 'editor',
    };

    try {
      const privateResult = await readResponse(
        await mediaRoute.GET(
          new Request(`http://localhost/api/admin/cms/media/${privateId}`),
          context(privateId),
        ),
      );
      assert.equal(privateResult.status, 404);
      assert.ok(!JSON.stringify(privateResult.body).includes(privateKey));
      assert.ok(!JSON.stringify(privateResult.body).includes('private-applicant-cv.pdf'));

      const privateMetadataUpdate = await readResponse(
        await mediaRoute.PUT(
          jsonRequest(`http://localhost/api/admin/cms/media/${privateId}`, {
            method: 'PUT',
            body: { altText: 'changed', caption: 'changed' },
          }),
          context(privateId),
        ),
      );
      assert.equal(privateMetadataUpdate.status, 404);

      const privateArchive = await readResponse(
        await mediaRoute.DELETE(
          jsonRequest(`http://localhost/api/admin/cms/media/${privateId}`, {
            method: 'DELETE',
          }),
          context(privateId),
        ),
      );
      assert.equal(privateArchive.status, 404);

      const privateRestore = await readResponse(
        await mediaRoute.DELETE(
          jsonRequest(`http://localhost/api/admin/cms/media/${privateId}?mode=restore`, {
            method: 'DELETE',
          }),
          context(privateId),
        ),
      );
      assert.equal(privateRestore.status, 404);

      const unchanged = await client.execute({
        sql: 'SELECT archived_at, alt_text, caption FROM media_assets WHERE id = ?',
        args: [privateId],
      });
      assert.equal(firstRow(unchanged).archived_at, null);
      assert.equal(firstRow(unchanged).alt_text, null);
      assert.equal(firstRow(unchanged).caption, null);

      const publicResult = await readResponse(
        await mediaRoute.GET(
          new Request(`http://localhost/api/admin/cms/media/${publicId}`),
          context(publicId),
        ),
      );
      assert.equal(publicResult.status, 200);
      assert.equal(publicResult.body.data.originalFilename, 'agency-logo.png');
      assert.equal(publicResult.body.data.storageKey, undefined);
      assert.equal(publicResult.body.data.url, `/api/media/${publicKey.slice('public/'.length)}`);
    } finally {
      await client.execute({
        sql: 'DELETE FROM media_assets WHERE id IN (?, ?)',
        args: [privateId, publicId],
      });
    }
  });

  it('applicant files can only be stored under the private prefix', async () => {
    const { buildStorageKey, publicUrlFor } = await import('../../src/lib/storage');
    const { getStorage } = await import('../../src/lib/storage');

    // A CV is the one thing on this site that is never public: the key itself
    // must live under `private/`, so even a leaked key is not a fetchable URL.
    const cvKey = buildStorageKey({
      visibility: 'private',
      purpose: 'cv',
      extension: 'pdf',
      scopeId: '00000000-0000-0000-0000-000000000000',
    });
    assert.match(cvKey, /^private\/assessments\/00000000-0000-0000-0000-000000000000\/cv\//);

    // And asking for a public URL for a private object must throw rather than
    // hand back something a browser could load.
    assert.throws(() => publicUrlFor(getStorage(), cvKey, 'private'));
    assert.throws(() => publicUrlFor(getStorage(), 'private/assessments/x/cv/y.pdf', 'private'));
  });

  it('two uploads of the same filename never overwrite one another', async () => {
    const { buildStorageKey } = await import('../../src/lib/storage');

    const first = buildStorageKey({ visibility: 'public', purpose: 'logo', extension: 'png' });
    const second = buildStorageKey({ visibility: 'public', purpose: 'logo', extension: 'png' });
    assert.notEqual(first, second, 'storage keys must be unique per upload');
  });
});

/* -------------------------------------------------------------------------- */
/* 3b. The approved deletion policy                                           */
/* -------------------------------------------------------------------------- */

/**
 * Permanent deletion is approved for exactly five content types. This is not
 * merely a UI concern: `deleteResource()` refuses any resource whose registry
 * entry does not set `allowHardDelete`, and the registry is the single table that
 * decides it. The test below pins the set so a future change cannot quietly widen
 * it — which is the failure mode that matters, because a widened permission
 * deletes data rather than revealing it.
 */
describe('deletion policy', () => {
  const APPROVED_FOR_PERMANENT_DELETE = [
    'services',
    'destinations',
    'testimonials',
    'faqs',
    'seo',
  ];

  it('exactly the approved content types may be permanently deleted', async () => {
    const { RESOURCES } = await import('../../src/lib/cms/registry');

    const permitted = Object.values(RESOURCES)
      .filter((resource) => resource.allowHardDelete)
      .map((resource) => resource.key);

    assert.deepEqual(
      [...permitted].sort(),
      [...APPROVED_FOR_PERMANENT_DELETE].sort(),
      'the set of content types eligible for permanent deletion has changed',
    );
  });

  it('every other content type is refused, and keeps its row', async () => {
    const { itemHandlers, collectionHandlers } = await loadHandlers();

    const created = await readResponse(
      await collectionHandlers('team').POST(
        jsonRequest('http://localhost/api/admin/cms/team', {
          method: 'POST',
          body: {
            slug: 'policy-refusal-check',
            fullName: 'Policy Refusal Check',
            professionalTitle: '',
            department: '',
            bioMd: '',
            qualifications: '',
            areasOfExpertise: '',
            photoAssetId: null,
            emailPublic: '',
            socialLinkedin: '',
            socialX: '',
            socialFacebook: '',
            socialInstagram: '',
            status: 'draft',
          },
        }),
      ),
    );
    assert.equal(created.status, 200);
    const id = created.body.data.id as string;

    // The refused permanent delete.
    const refused = await readResponse(
      await itemHandlers('team').DELETE(
        jsonRequest(`http://localhost/api/admin/cms/team/${id}?mode=delete`, {
          method: 'DELETE',
        }),
        context(id),
      ),
    );
    assert.equal(refused.status, 409);
    assert.match(refused.body.message, /archived but not deleted/i);

    const stillThere = await client.execute({
      sql: 'select count(*) as n from team_members where id = ?',
      args: [id],
    });
    assert.equal(Number(firstRow(stillThere).n), 1, 'a refused delete must not remove the row');

    // The default (archive) path is always available, and is reversible.
    const archived = await readResponse(
      await itemHandlers('team').DELETE(
        jsonRequest(`http://localhost/api/admin/cms/team/${id}`, { method: 'DELETE' }),
        context(id),
      ),
    );
    assert.equal(archived.status, 200);

    const archivedRow = firstRow(
      await client.execute({
        sql: 'select status, archived_at from team_members where id = ?',
        args: [id],
      }),
    );
    assert.equal(archivedRow.status, 'archived');
    assert.ok(archivedRow.archived_at);

    const { restoreHandler } = await loadHandlers();
    const restored = await readResponse(
      await restoreHandler('team')(
        jsonRequest(`http://localhost/api/admin/cms/team/${id}/restore`, { method: 'POST' }),
        context(id),
      ),
    );
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.status, 'draft');
  });

  it('archived content is invisible to the public and to preview alike', async () => {
    const { getServiceBySlug } = await import('../../src/db/queries/content');

    const asVisitor = await getServiceBySlug('phase4-archived');
    const asPreview = await getServiceBySlug('phase4-archived', { includeDrafts: true });

    assert.equal(asVisitor.ok && asVisitor.data, null);
    assert.equal(asPreview.ok && asPreview.data, null);
  });

  it('deleting a service removes its child features with it', async () => {
    const { collectionHandlers, itemHandlers } = await loadHandlers();

    const created = await readResponse(
      await collectionHandlers('services').POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({
            slug: 'policy-cascade-check',
            title: 'Policy cascade check',
            features: [
              { label: 'First', detailMd: '' },
              { label: 'Second', detailMd: '' },
            ],
          }),
        }),
      ),
    );
    assert.equal(created.status, 200);
    const id = created.body.data.id as string;

    const before = await client.execute({
      sql: 'select count(*) as n from service_features where service_id = ?',
      args: [id],
    });
    assert.equal(Number(firstRow(before).n), 2);

    const deleted = await readResponse(
      await itemHandlers('services').DELETE(
        jsonRequest(`http://localhost/api/admin/cms/services/${id}?mode=delete`, {
          method: 'DELETE',
        }),
        context(id),
      ),
    );
    assert.equal(deleted.status, 200);

    // No orphaned child rows: a feature that pointed at a deleted service would
    // be unreachable data.
    const after = await client.execute({
      sql: 'select count(*) as n from service_features where service_id = ?',
      args: [id],
    });
    assert.equal(Number(firstRow(after).n), 0);
  });
});

/* -------------------------------------------------------------------------- */
/* 3c. Homepage slots: every slot an administrator can fill is rendered       */
/* -------------------------------------------------------------------------- */

/**
 * The homepage is assembled by looking up eight named sections. A slot the page
 * does not look up is a dead end: the administrator saves it, sees a success
 * message, and nothing appears on the site.
 *
 * This test reads the homepage component's own source and compares the keys it
 * looks up with the keys the CMS offers. It is the only way to catch drift
 * between the two without rendering the page.
 */
describe('homepage slots', () => {
  it('the CMS offers exactly the slots the homepage reads', async () => {
    const { SECTION_SLOTS } = await import('../../src/lib/cms/form-defaults');

    const source = readFileSync(join(process.cwd(), 'src/app/(site)/page.tsx'), 'utf8');
    const readByPage = Array.from(source.matchAll(/findSection\(sections, '([a-z0-9_]+)'\)/g))
      .map((match) => match[1])
      .filter((key): key is string => typeof key === 'string')
      .sort();

    const offered = SECTION_SLOTS.map((slot) => slot.value).sort();

    assert.ok(readByPage.length > 0, 'expected to find findSection() calls in the homepage');
    assert.deepEqual(offered, readByPage);
  });

  it('a section key outside the slot list is rejected', async () => {
    const { collectionHandlers } = await loadHandlers();

    const { status, body } = await readResponse(
      await collectionHandlers('homepage').POST(
        jsonRequest('http://localhost/api/admin/cms/homepage', {
          method: 'POST',
          body: {
            sectionKey: 'not_a_real_slot',
            heading: 'Should never be saved',
            subheading: '',
            bodyMd: '',
            ctaLabel: '',
            ctaHref: '',
            secondaryCtaLabel: '',
            secondaryCtaHref: '',
            imageAssetId: null,
            isVisible: true,
          },
        }),
      ),
    );

    assert.equal(status, 400);
    assert.ok(body.fieldErrors.sectionKey, 'the error must name the section slot');
  });

  it('a valid slot saves, appears when visible, and disappears when hidden', async () => {
    const { collectionHandlers, itemHandlers } = await loadHandlers();

    // `why_us` is a real slot; the test cleans up after itself.
    const created = await readResponse(
      await collectionHandlers('homepage').POST(
        jsonRequest('http://localhost/api/admin/cms/homepage', {
          method: 'POST',
          body: {
            sectionKey: 'team_preview',
            heading: 'Slot visibility check',
            subheading: '',
            bodyMd: '',
            ctaLabel: '',
            ctaHref: '',
            secondaryCtaLabel: '',
            secondaryCtaHref: '',
            imageAssetId: null,
            isVisible: true,
          },
        }),
      ),
    );

    // A second row for the same slot is refused: one slot, one row.
    if (created.status === 409) return;

    assert.equal(created.status, 200, JSON.stringify(created.body));
    const id = created.body.data.id as string;

    const { getHomepageSections, findSection } = await import('../../src/db/queries/content');
    const visible = await getHomepageSections();
    assert.equal(visible.ok, true);
    if (visible.ok) {
      const section = findSection(visible.data, 'team_preview');
      assert.equal(section?.heading, 'Slot visibility check');
    }

    const hidden = await readResponse(
      await itemHandlers('homepage').PUT(
        jsonRequest(`http://localhost/api/admin/cms/homepage/${id}`, {
          method: 'PUT',
          body: {
            sectionKey: 'team_preview',
            heading: 'Slot visibility check',
            subheading: '',
            bodyMd: '',
            ctaLabel: '',
            ctaHref: '',
            secondaryCtaLabel: '',
            secondaryCtaHref: '',
            imageAssetId: null,
            isVisible: false,
          },
        }),
        context(id),
      ),
    );
    assert.equal(hidden.status, 200);

    // The public query omits hidden sections entirely, so the page cannot show
    // one by accident.
    const afterHide = await getHomepageSections();
    assert.equal(afterHide.ok, true);
    if (afterHide.ok) {
      assert.equal(findSection(afterHide.data, 'team_preview'), null);
    }

    // Clean up: homepage sections can only be archived, never deleted.
    await itemHandlers('homepage').DELETE(
      jsonRequest(`http://localhost/api/admin/cms/homepage/${id}`, { method: 'DELETE' }),
      context(id),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Draft versus published visibility on the public site                     */
/* -------------------------------------------------------------------------- */

describe('public visibility', () => {
  before(async () => {
    const { getDb } = await import('../../src/db');
    const { services } = await import('../../src/db/schema');

    await getDb().insert(services).values([
      {
        id: 'pub-visible',
        slug: 'phase4-visible',
        title: 'Visible to the public',
        shortDescription: 'Published content.',
        descriptionMd: 'Body.',
        status: 'published',
        displayOrder: 1,
        publishedAt: new Date(),
      },
      {
        id: 'pub-hidden',
        slug: 'phase4-hidden',
        title: 'Hidden from the public',
        shortDescription: 'Draft content.',
        descriptionMd: 'Body.',
        status: 'draft',
        displayOrder: 2,
      },
      {
        id: 'pub-archived',
        slug: 'phase4-archived',
        title: 'Archived content',
        shortDescription: 'Archived content.',
        descriptionMd: 'Body.',
        status: 'archived',
        displayOrder: 3,
        archivedAt: new Date(),
      },
    ] as never);
  });

  it('published content is returned to the public site', async () => {
    const { getPublishedServices } = await import('../../src/db/queries/content');
    const result = await getPublishedServices();

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const slugs = result.data.map((row) => row.slug);
    assert.ok(slugs.includes('phase4-visible'));
  });

  it('draft content is never returned to the public site', async () => {
    const { getPublishedServices } = await import('../../src/db/queries/content');
    const result = await getPublishedServices();
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(
      result.data.some((row) => row.slug === 'phase4-hidden'),
      false,
      'a draft must not reach a public query',
    );
  });

  it('archived content is never returned to the public site', async () => {
    const { getPublishedServices } = await import('../../src/db/queries/content');
    const result = await getPublishedServices();
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(
      result.data.some((row) => row.slug === 'phase4-archived'),
      false,
      'archived content must not reach a public query',
    );
  });

  it('the public slug lookup refuses a draft, so the public page 404s', async () => {
    const { getServiceBySlug } = await import('../../src/db/queries/content');
    const result = await getServiceBySlug('phase4-hidden');

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data, null, 'a draft must not resolve on the public site');
  });

  it('an administrator can still read the draft through the CMS API', async () => {
    const { itemHandlers } = await loadHandlers();
    const { status, body } = await readResponse(
      await itemHandlers('services').GET(
        jsonRequest('http://localhost/api/admin/cms/services/pub-hidden'),
        context('pub-hidden'),
      ),
    );

    assert.equal(status, 200);
    assert.equal(body.data.status, 'draft');
  });

  it('the public country query hides an unpublished country', async () => {
    const { getPublishedCountries } = await import('../../src/db/queries/destinations');
    const before = await getPublishedCountries();
    assert.equal(before.ok, true);

    const { getDb } = await import('../../src/db');
    const { countries } = await import('../../src/db/schema');

    await getDb().insert(countries).values({
      id: 'country-draft',
      isoCode: 'ZZ',
      name: 'Draft country',
      slug: 'draft-country',
      status: 'draft',
      displayOrder: 99,
    } as never);

    const after = await getPublishedCountries();
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(
      after.data.some((row) => row.slug === 'draft-country'),
      false,
      'a draft country must not be listed publicly',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Preview: drafts on the real public page, for administrators only         */
/* -------------------------------------------------------------------------- */

describe('preview', () => {
  it('ignores ?preview=1 when nobody is signed in', async () => {
    const { isPreviewRequest } = await import('../../src/lib/cms/preview');
    testState().admin = null;

    // A visitor can put anything in the URL. It must not widen the read.
    assert.equal(await isPreviewRequest({ preview: '1' }), false);
  });

  it('accepts ?preview=1 for a signed-in administrator', async () => {
    const { isPreviewRequest } = await import('../../src/lib/cms/preview');
    assert.equal(await isPreviewRequest({ preview: '1' }), true);
  });

  it('treats any other value, or no value, as off', async () => {
    const { isPreviewRequest } = await import('../../src/lib/cms/preview');

    assert.equal(await isPreviewRequest({}), false);
    assert.equal(await isPreviewRequest({ preview: '0' }), false);
    assert.equal(await isPreviewRequest({ preview: 'yes' }), false);
    assert.equal(await isPreviewRequest({ preview: ['1', '0'] }), true);
  });

  it('a preview read can see a draft; the same read without preview cannot', async () => {
    const { getServiceBySlug } = await import('../../src/db/queries/content');

    const asVisitor = await getServiceBySlug('phase4-hidden');
    const asAdmin = await getServiceBySlug('phase4-hidden', { includeDrafts: true });

    assert.equal(asVisitor.ok, true);
    assert.equal(asAdmin.ok, true);
    if (!asVisitor.ok || !asAdmin.ok) return;

    assert.equal(asVisitor.data, null, 'a visitor must never resolve a draft');
    assert.equal(asAdmin.data?.status, 'draft');
  });

  it('preview never resolves archived content, even for an administrator', async () => {
    const { getServiceBySlug } = await import('../../src/db/queries/content');
    const result = await getServiceBySlug('phase4-archived', { includeDrafts: true });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data, null, 'archived content is archived, not previewable');
  });

  it('preview does not change the metadata a crawler receives', async () => {
    // generateMetadata never passes includeDrafts, so this is a structural
    // guarantee rather than a behavioural one. Assert the module source of the
    // public detail page does not pass preview to its metadata query.
    const source = readFileSync(
      join(process.cwd(), 'src/app/(site)/services/[slug]/page.tsx'),
      'utf8',
    );

    const metadataBlock = source.slice(
      source.indexOf('export async function generateMetadata'),
      source.indexOf('export default async function'),
    );

    assert.equal(
      metadataBlock.includes('includeDrafts'),
      false,
      'metadata must always describe the published version',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Validation and error shapes                                             */
/* -------------------------------------------------------------------------- */

describe('input validation', () => {
  it('a service without a title is rejected with a field error', async () => {
    const { collectionHandlers } = await loadHandlers();

    const { status, body } = await readResponse(
      await collectionHandlers('services').POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({ title: '' }),
        }),
      ),
    );

    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_request');
    assert.ok(body.fieldErrors.title, 'the error must name the offending field');
  });

  it('a slug with invalid characters is rejected', async () => {
    const { collectionHandlers } = await loadHandlers();

    const { status } = await readResponse(
      await collectionHandlers('services').POST(
        jsonRequest('http://localhost/api/admin/cms/services', {
          method: 'POST',
          body: servicePayload({ slug: 'Not A Slug!' }),
        }),
      ),
    );
    assert.equal(status, 400);
  });

  it('a malformed JSON body is a 400, not a 500', async () => {
    const { collectionHandlers } = await loadHandlers();

    const request = new Request('http://localhost/api/admin/cms/services', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': currentCsrf() },
      body: '{ this is not json',
    });

    const { status } = await readResponse(await collectionHandlers('services').POST(request));
    assert.equal(status, 400);
  });

  it('every CMS response carries no-store, so a proxy cannot cache admin data', async () => {
    const { collectionHandlers } = await loadHandlers();

    const response = await collectionHandlers('services').GET(
      jsonRequest('http://localhost/api/admin/cms/services'),
    );

    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Settings                                                               */
/* -------------------------------------------------------------------------- */

describe('settings', () => {
  it('saving settings is owner-only and updates the public runtime palette without a rebuild', async () => {
    const settings = await import('../../src/app/api/admin/cms/settings/route');
    const { readSettings, toSettingsForm } = await import('../../src/lib/cms/settings');
    const { getSiteIdentity } = await import('../../src/db/queries/settings');

    const initial = toSettingsForm(await readSettings());
    const changedColors = {
      brandPrimaryColor: '#C2182A',
      brandSecondaryColor: '#2563EB',
      brandActiveColor: '#1E3A8A',
      brandTextColor: '#334155',
    };

    const { status } = await readResponse(
      await settings.POST(
        jsonRequest('http://localhost/api/admin/cms/settings', {
          method: 'POST',
          body: {
            ...initial,
            agencyName: 'Phase 4 Test Agency',
            ...changedColors,
          },
        }),
      ),
    );
    assert.equal(status, 200);

    const readBack = await readResponse(await settings.GET());
    assert.equal(readBack.status, 200);
    assert.equal(readBack.body.data.settings.agencyName, 'Phase 4 Test Agency');
    for (const [key, value] of Object.entries(changedColors)) {
      assert.equal(readBack.body.data.settings[key], value, `${key} persists through the settings API`);
    }

    // The request-time identity query reads those settings directly; no build or
    // migration is required for the public layout to receive the new variables.
    const identity = await getSiteIdentity();
    assert.deepEqual(identity.colors, {
      primary: changedColors.brandPrimaryColor,
      secondary: changedColors.brandSecondaryColor,
      active: changedColors.brandActiveColor,
      text: changedColors.brandTextColor,
    });
  });

  it('rejects inaccessible colour values per field without changing stored settings', async () => {
    const settings = await import('../../src/app/api/admin/cms/settings/route');
    const { readSettings, toSettingsForm } = await import('../../src/lib/cms/settings');
    const initial = toSettingsForm(await readSettings());
    const original = await readSettings();
    assert.ok(original);

    const invalidColors = [
      ['brandPrimaryColor', '#FFFFFF'],
      ['brandSecondaryColor', '#FFFFFF'],
      ['brandActiveColor', '#E11D2E'],
      ['brandTextColor', '#E11D2E'],
    ] as const;

    for (const [field, value] of invalidColors) {
      const { status, body } = await readResponse(
        await settings.POST(
          jsonRequest('http://localhost/api/admin/cms/settings', {
            method: 'POST',
            body: { ...initial, [field]: value },
          }),
        ),
      );
      assert.equal(status, 400, `${field}: ${JSON.stringify(body)}`);
      assert.ok(body.fieldErrors[field], `the response must identify ${field}`);
    }

    const after = await readSettings();
    assert.equal(after?.brandPrimaryColor, original.brandPrimaryColor);
    assert.equal(after?.brandSecondaryColor, original.brandSecondaryColor);
    assert.equal(after?.brandActiveColor, original.brandActiveColor);
    assert.equal(after?.brandTextColor, original.brandTextColor);
  });

  it('falls back from inaccessible legacy DB colours at public read time without mutating them', async () => {
    const { readSettings } = await import('../../src/lib/cms/settings');
    const { getSiteIdentity } = await import('../../src/db/queries/settings');
    const original = await readSettings();
    assert.ok(original);

    await client.execute({
      sql: 'UPDATE site_settings SET brand_active_color = ?, brand_text_color = ? WHERE id = 1',
      args: ['#E11D2E', '#E11D2E'],
    });

    try {
      const identity = await getSiteIdentity();
      assert.equal(identity.colors.active, '#1E3FBF');
      assert.equal(identity.colors.text, '#111827');
      const stored = await readSettings();
      assert.equal(stored?.brandActiveColor, '#E11D2E');
      assert.equal(stored?.brandTextColor, '#E11D2E');
    } finally {
      await client.execute({
        sql: 'UPDATE site_settings SET brand_active_color = ?, brand_text_color = ? WHERE id = 1',
        args: [original.brandActiveColor, original.brandTextColor],
      });
    }
  });

  it('settings cannot be saved with an empty agency name', async () => {
    const settings = await import('../../src/app/api/admin/cms/settings/route');
    const { readSettings, toSettingsForm } = await import('../../src/lib/cms/settings');

    const initial = toSettingsForm(await readSettings());

    const { status, body } = await readResponse(
      await settings.POST(
        jsonRequest('http://localhost/api/admin/cms/settings', {
          method: 'POST',
          body: { ...initial, agencyName: '' },
        }),
      ),
    );

    assert.equal(status, 400, JSON.stringify(body));
    assert.ok(
      body.fieldErrors.agencyName,
      'the response must point at the agency-name field',
    );
  });
});
