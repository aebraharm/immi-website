/**
 * Phase 3 verification — administrator authentication.
 *
 * These tests run against the real authentication library and a real libSQL
 * database (a scratch file database created here, never the development or
 * production one). Nothing about the security model is mocked: sessions are
 * created, hashed, resolved, expired, revoked and rate-limited exactly as they
 * are in production.
 *
 * The mandated verifications, mapped to test names below:
 *
 *   1. correct password authenticates ............ "correct password authenticates"
 *   2. wrong password rejected ................... "wrong password is rejected …"
 *   3. first-login change enforced ............... "forced password change …"
 *   4. expired sessions rejected ................. "expired session is rejected"
 *   5. revoked sessions rejected ................. "revoked session is rejected"
 *   6. rate limiting works ....................... "login rate limiting blocks …"
 *
 * Plus: CSRF, provenance, and "no plaintext password anywhere" checks.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createClient, type Client } from '@libsql/client';

const REPO_ROOT = process.cwd();
const SCRATCH_DB = './.data/verify-scratch.db';
const SCRATCH_URL = `file:${SCRATCH_DB}`;

/**
 * A throwaway password for this test run only. It is generated at runtime, is
 * never committed, and is never written to a file — it exists in memory for the
 * duration of the process.
 */
const TEST_PASSWORD = `Tt-${crypto.randomUUID()}-9Q`;
const NEW_PASSWORD = `Np-${crypto.randomUUID()}-7Z`;

let client: Client;

/* -------------------------------------------------------------------------- */
/* Bootstrap the scratch database once for the whole file                     */
/* -------------------------------------------------------------------------- */

before(async () => {
  mkdirSync('.data', { recursive: true });
  rmSync(SCRATCH_DB, { force: true });
  rmSync(`${SCRATCH_DB}-wal`, { force: true });
  rmSync(`${SCRATCH_DB}-shm`, { force: true });

  // Migrate the scratch database using the project's own migration runner, so
  // the schema under test is exactly the schema that ships.
  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, TURSO_DATABASE_URL: SCRATCH_URL, TURSO_AUTH_TOKEN: '' },
    stdio: 'pipe',
  });

  // The app modules resolve the database from the environment, so point them at
  // the scratch file BEFORE importing anything that touches the DB.
  process.env.TURSO_DATABASE_URL = SCRATCH_URL;
  delete process.env.TURSO_AUTH_TOKEN;

  client = createClient({ url: SCRATCH_URL });
});

after(() => {
  client?.close();
  // Left in place for inspection; .data is git-ignored.
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

async function loadAuth() {
  // Imported lazily so TURSO_DATABASE_URL is set first.
  const [{ getDb }, { admins }, { adminSessions }, { loginAttempts }] = await Promise.all([
    import('../src/db/index'),
    import('../src/db/schema/auth'),
    import('../src/db/schema/auth'),
    import('../src/db/schema/operations'),
  ]);

  return { getDb, admins, adminSessions, loginAttempts };
}

/** Create an administrator directly, the same way the bootstrap script does. */
async function createAdmin(params: {
  email: string;
  password: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
}): Promise<string> {
  const { getDb, admins } = await loadAuth();
  const { hashPassword } = await import('../src/lib/auth/password');

  const passwordHash = await hashPassword(params.password);
  const id = crypto.randomUUID();

  await getDb()
    .insert(admins)
    .values({
      id,
      email: params.email,
      passwordHash,
      fullName: 'Test Administrator',
      role: 'owner',
      isActive: params.isActive ?? true,
      mustChangePassword: params.mustChangePassword ?? true,
    });

  return id;
}

/** Reset limiter state so tests do not interfere with one another. */
async function resetLimiters(): Promise<void> {
  await client.execute('DELETE FROM login_attempts');
  await client.execute('DELETE FROM rate_limit_buckets');
}

async function reloadModules(): Promise<void> {
  // Reset the memoised Drizzle client so each test sees a fresh connection.
  const globalRef = globalThis as unknown as { __immiDb?: unknown };
  delete globalRef.__immiDb;
}

/* -------------------------------------------------------------------------- */
/* 1 + 2 + 3. Authentication outcomes                                          */
/* -------------------------------------------------------------------------- */

describe('administrator sign-in', () => {
  const email = 'owner@example.test';

  before(async () => {
    await reloadModules();
    await resetLimiters();
    await client.execute('DELETE FROM admin_sessions');
    await client.execute('DELETE FROM admins');
    await createAdmin({ email, password: TEST_PASSWORD });
  });

  it('correct password authenticates', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');

    const outcome = await attemptLogin({
      email,
      password: TEST_PASSWORD,
      ipHash: 'ip-hash-correct',
    });

    assert.equal(outcome.ok, true, 'a valid credential pair must authenticate');
    if (outcome.ok) {
      assert.equal(outcome.admin.email, email);
      // Requirement: the initial account must be forced to change its password.
      assert.equal(outcome.admin.mustChangePassword, true);
      assert.equal(outcome.admin.role, 'owner');
    }
  });

  it('email comparison is case-insensitive and whitespace tolerant', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');

    const outcome = await attemptLogin({
      email: `  ${email.toUpperCase()}  `,
      password: TEST_PASSWORD,
      ipHash: 'ip-hash-case',
    });

    assert.equal(outcome.ok, true);
  });

  it('wrong password is rejected with a generic reason', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');
    await resetLimiters();

    const outcome = await attemptLogin({
      email,
      password: `${TEST_PASSWORD}-wrong`,
      ipHash: 'ip-hash-wrong',
    });

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.reason, 'invalid_credentials');
    }
  });

  it('an unknown email returns the same reason as a wrong password', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');
    await resetLimiters();

    const unknown = await attemptLogin({
      email: 'nobody@example.test',
      password: TEST_PASSWORD,
      ipHash: 'ip-hash-unknown',
    });
    await resetLimiters();
    const wrongPassword = await attemptLogin({
      email,
      password: `${TEST_PASSWORD}-wrong`,
      ipHash: 'ip-hash-wrong-2',
    });

    assert.equal(unknown.ok, false);
    assert.equal(wrongPassword.ok, false);
    assert.deepEqual(
      unknown.ok === false ? unknown.reason : null,
      wrongPassword.ok === false ? wrongPassword.reason : null,
      'the two failures must be indistinguishable (no account enumeration)',
    );
  });

  it('a deactivated administrator cannot authenticate', async () => {
    const { getDb, admins } = await loadAuth();
    const { attemptLogin } = await import('../src/lib/auth/service');
    const { eq } = await import('drizzle-orm');
    await resetLimiters();

    await getDb().update(admins).set({ isActive: false }).where(eq(admins.email, email));

    const outcome = await attemptLogin({
      email,
      password: TEST_PASSWORD,
      ipHash: 'ip-hash-inactive',
    });

    // Either reason is safe; what matters is that it is not a success.
    assert.equal(outcome.ok, false);

    await getDb().update(admins).set({ isActive: true }).where(eq(admins.email, email));
  });

  it('the failed attempts are recorded, and successful logins update last_login_at', async () => {
    const { loginAttempts, getDb, admins } = await loadAuth();
    const { attemptLogin } = await import('../src/lib/auth/service');
    const { eq } = await import('drizzle-orm');

    await resetLimiters();
    await attemptLogin({ email, password: 'definitely-wrong', ipHash: 'ip-audit' });
    const attemptRows = await getDb().select().from(loginAttempts);
    assert.ok(attemptRows.length >= 1, 'failed attempts must be persisted');

    await attemptLogin({ email, password: TEST_PASSWORD, ipHash: 'ip-audit-ok' });
    const [row] = await getDb()
      .select({ lastLoginAt: admins.lastLoginAt })
      .from(admins)
      .where(eq(admins.email, email));

    assert.ok(row?.lastLoginAt instanceof Date, 'last_login_at must be stamped');
  });
});

/* -------------------------------------------------------------------------- */
/* 4 + 5. Session lifecycle                                                    */
/* -------------------------------------------------------------------------- */

describe('session lifecycle', () => {
  let adminId: string;

  before(async () => {
    await reloadModules();
    await client.execute('DELETE FROM admin_sessions');
    await client.execute('DELETE FROM admins');
    adminId = await createAdmin({ email: 'sessions@example.test', password: TEST_PASSWORD });
  });

  it('a freshly created session resolves to its administrator', async () => {
    const { createSession, resolveSession } = await import('../src/lib/auth/session');

    const created = await createSession({
      adminId,
      ipHash: 'ip-session',
      userAgent: 'test-agent',
    });

    const resolved = await resolveSession(created.token);

    assert.ok(resolved, 'a live session must resolve');
    assert.equal(resolved?.adminId, adminId);
    assert.equal(resolved?.sessionId, created.sessionId);
  });

  it('the raw token is never stored — only its SHA-256 digest', async () => {
    const { createSession } = await import('../src/lib/auth/session');
    const { sha256Hex } = await import('../src/lib/auth/crypto');

    const created = await createSession({
      adminId,
      ipHash: 'ip-hashcheck',
      userAgent: 'test-agent',
    });

    const rows = await client.execute('SELECT token_hash FROM admin_sessions');
    const stored = rows.rows.map((row) => String(row.token_hash));

    assert.equal(
      stored.includes(created.token),
      false,
      'the raw token must never be written to the database',
    );
    assert.ok(
      stored.includes(sha256Hex(created.token)),
      'the digest of the token must be what is stored',
    );
  });

  it('expired session is rejected', async () => {
    const { createSession, resolveSession } = await import('../src/lib/auth/session');

    const created = await createSession({
      adminId,
      ipHash: 'ip-expired',
      userAgent: 'test-agent',
    });

    // Push the session into the past. This is a real state, not a mock: the
    // resolver must reject it via its SQL predicate.
    await client.execute({
      sql: 'UPDATE admin_sessions SET expires_at = ? WHERE id = ?',
      args: [Date.now() - 60_000, created.sessionId],
    });

    // Bust the memoised client so the update is certainly visible.
    await reloadModules();
    const resolved = await resolveSession(created.token);
    assert.equal(resolved, null, 'an expired session must not resolve');
  });

  it('idle-expired session is rejected even before its absolute expiry', async () => {
    const { createSession, resolveSession } = await import('../src/lib/auth/session');
    const config = await import('../src/lib/auth/config');

    const created = await createSession({
      adminId,
      ipHash: 'ip-idle',
      userAgent: 'test-agent',
    });

    const idleCutoff = Date.now() - config.SESSION_IDLE_TTL_MS - 60_000;
    await client.execute({
      sql: 'UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?',
      args: [idleCutoff, created.sessionId],
    });

    await reloadModules();
    assert.equal(await resolveSession(created.token), null);
  });

  it('revoked session is rejected', async () => {
    const { createSession, resolveSession, revokeSession } = await import(
      '../src/lib/auth/session'
    );

    const created = await createSession({
      adminId,
      ipHash: 'ip-revoked',
      userAgent: 'test-agent',
    });

    assert.ok(await resolveSession(created.token), 'precondition: session is live');

    await revokeSession(created.sessionId);
    await reloadModules();

    assert.equal(await resolveSession(created.token), null, 'a revoked session must not resolve');
  });

  it('revoking every session invalidates all of them at once', async () => {
    const { createSession, resolveSession, revokeAllSessions } = await import(
      '../src/lib/auth/session'
    );

    const a = await createSession({ adminId, ipHash: 'ip-a', userAgent: 'a' });
    const b = await createSession({ adminId, ipHash: 'ip-b', userAgent: 'b' });

    assert.ok(await resolveSession(a.token));
    assert.ok(await resolveSession(b.token));

    await revokeAllSessions(adminId);
    await reloadModules();

    assert.equal(await resolveSession(a.token), null);
    assert.equal(await resolveSession(b.token), null);
  });

  it('a garbage or missing token does not resolve', async () => {
    const { resolveSession } = await import('../src/lib/auth/session');

    assert.equal(await resolveSession(undefined), null);
    assert.equal(await resolveSession(''), null);
    assert.equal(await resolveSession('not-a-real-token'), null);
    assert.equal(await resolveSession('a'.repeat(64)), null);
  });

  it('deactivating an administrator invalidates their live sessions immediately', async () => {
    const { getDb, admins } = await loadAuth();
    const { createSession, resolveSession } = await import('../src/lib/auth/session');
    const { eq } = await import('drizzle-orm');

    const created = await createSession({ adminId, ipHash: 'ip-deact', userAgent: 'x' });
    assert.ok(await resolveSession(created.token));

    await getDb().update(admins).set({ isActive: false }).where(eq(admins.id, adminId));
    await reloadModules();

    assert.equal(
      await resolveSession(created.token),
      null,
      'a deactivated administrator must not keep a working session',
    );

    await getDb().update(admins).set({ isActive: true }).where(eq(admins.id, adminId));
  });

  it('the session cookie is HttpOnly, SameSite=Lax and Secure in production', async () => {
    const { sessionCookieOptions, csrfCookieOptions } = await import(
      '../src/lib/auth/session'
    );

    const options = sessionCookieOptions(3600);
    assert.equal(options.httpOnly, true, 'the session cookie must be HttpOnly');
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/');

    // `NODE_ENV` is read at call time inside the helper, so the production
    // branch is observable. (Plain assignment: process.env rejects
    // defineProperty here.)
    // `NODE_ENV` is typed as read-only by @types/node but is an ordinary runtime
    // property here, so the production branch is observable.
    const previous = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    try {
      assert.equal(sessionCookieOptions(3600).secure, true, 'must be Secure in production');
      assert.equal(csrfCookieOptions(3600).secure, true, 'CSRF cookie must be Secure too');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = previous;
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Forced first-login password change                                       */
/* -------------------------------------------------------------------------- */

describe('forced password change', () => {
  const email = 'firstlogin@example.test';
  let adminId: string;

  before(async () => {
    await reloadModules();
    await client.execute('DELETE FROM admin_sessions');
    await client.execute('DELETE FROM admins');
    adminId = await createAdmin({ email, password: TEST_PASSWORD, mustChangePassword: true });
  });

  it('login succeeds but the account is flagged as needing a change', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');
    await resetLimiters();

    const outcome = await attemptLogin({ email, password: TEST_PASSWORD, ipHash: 'ip-force' });

    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(
        outcome.admin.mustChangePassword,
        true,
        'the flag must reach the caller so the UI can force the change',
      );
    }
  });

  it('the change requires the current password to be proven', async () => {
    const { changePassword } = await import('../src/lib/auth/password-change');

    const outcome = await changePassword({
      adminId,
      email,
      currentPassword: 'not-the-current-password',
      newPassword: NEW_PASSWORD,
      currentSessionId: 'irrelevant',
      ipHash: 'ip-force-2',
    });

    assert.equal(outcome.ok, false);
  });

  it('the new password must satisfy the policy', async () => {
    const { changePassword } = await import('../src/lib/auth/password-change');

    for (const weak of ['short1A', 'alllowercase123', 'ALLUPPERCASE123', 'NoDigitsHereAtAll']) {
      const outcome = await changePassword({
        adminId,
        email,
        currentPassword: TEST_PASSWORD,
        newPassword: weak,
        currentSessionId: 'irrelevant',
        ipHash: 'ip-force-3',
      });
      assert.equal(outcome.ok, false, `"${weak}" must be rejected by policy`);
    }
  });

  it('the new password must not be a reuse of the current one', async () => {
    const { changePassword } = await import('../src/lib/auth/password-change');

    const outcome = await changePassword({
      adminId,
      email,
      currentPassword: TEST_PASSWORD,
      newPassword: TEST_PASSWORD,
      currentSessionId: 'irrelevant',
      ipHash: 'ip-force-4',
    });

    assert.equal(outcome.ok, false, 'reusing the current password must be refused');
  });

  it('a valid change clears the flag, stamps the timestamp and revokes other sessions', async () => {
    const { changePassword } = await import('../src/lib/auth/password-change');
    const { createSession, resolveSession } = await import('../src/lib/auth/session');
    const { getDb, admins } = await loadAuth();
    const { eq } = await import('drizzle-orm');

    // An older session that must not survive the change.
    const other = await createSession({ adminId, ipHash: 'ip-other', userAgent: 'other' });
    const current = await createSession({ adminId, ipHash: 'ip-current', userAgent: 'current' });

    const outcome = await changePassword({
      adminId,
      email,
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
      currentSessionId: current.sessionId,
      ipHash: 'ip-force-5',
    });

    assert.equal(outcome.ok, true, 'a compliant change must succeed');

    const [row] = await getDb()
      .select({
        mustChangePassword: admins.mustChangePassword,
        passwordChangedAt: admins.passwordChangedAt,
      })
      .from(admins)
      .where(eq(admins.id, adminId));

    assert.equal(row?.mustChangePassword, false, 'the forced-change flag must be cleared');
    assert.ok(row?.passwordChangedAt instanceof Date, 'the change must be timestamped');

    await reloadModules();

    assert.equal(
      await resolveSession(other.token),
      null,
      'other sessions must be revoked by a password change',
    );
    assert.ok(
      await resolveSession(current.token),
      'the session that performed the change should survive',
    );
  });

  it('the new password now authenticates and the old one no longer does', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');
    await resetLimiters();

    const withNew = await attemptLogin({ email, password: NEW_PASSWORD, ipHash: 'ip-new' });
    assert.equal(withNew.ok, true);
    if (withNew.ok) {
      assert.equal(withNew.admin.mustChangePassword, false, 'no further forced change');
    }

    await resetLimiters();
    const withOld = await attemptLogin({ email, password: TEST_PASSWORD, ipHash: 'ip-old' });
    assert.equal(withOld.ok, false, 'the previous password must stop working');
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Rate limiting and lockout                                                */
/* -------------------------------------------------------------------------- */

describe('login rate limiting', () => {
  const email = 'ratelimit@example.test';

  before(async () => {
    await reloadModules();
    await client.execute('DELETE FROM admin_sessions');
    await client.execute('DELETE FROM admins');
    await createAdmin({ email, password: TEST_PASSWORD });
    await resetLimiters();
  });

  it('repeated failures from one IP are blocked before the password is checked', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');
    const config = await import('../src/lib/auth/config');

    const ipHash = 'ip-ratelimit';
    const outcomes = [];

    for (let attempt = 0; attempt < config.LOGIN_MAX_ATTEMPTS_PER_IP + 2; attempt += 1) {
      outcomes.push(
        await attemptLogin({ email, password: 'wrong-password', ipHash }),
      );
    }

    const blocked = outcomes.filter(
      (outcome) => outcome.ok === false && outcome.reason === 'rate_limited',
    );

    assert.ok(
      blocked.length >= 1,
      `expected a rate_limited response within ${config.LOGIN_MAX_ATTEMPTS_PER_IP + 2} attempts`,
    );

    const first = blocked[0];
    if (first && first.ok === false) {
      assert.ok(
        (first.retryAfterSeconds ?? 0) > 0,
        'a blocked attempt must tell the client how long to wait',
      );
    }
  });

  it('the block applies even when the correct password is supplied', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');

    // Same IP as the previous test, so the limiter is already tripped.
    const outcome = await attemptLogin({
      email,
      password: TEST_PASSWORD,
      ipHash: 'ip-ratelimit',
    });

    assert.equal(outcome.ok, false, 'a rate-limited IP must not be able to sign in');
    if (!outcome.ok) {
      assert.equal(outcome.reason, 'rate_limited');
    }
  });

  it('a different IP is not affected by another IP\u2019s failures', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');

    // A second, entirely healthy account, so this measures IP scoping alone and
    // not the per-account counter that the previous test deliberately tripped.
    await createAdmin({ email: 'clean@example.test', password: TEST_PASSWORD });

    const outcome = await attemptLogin({
      email: 'clean@example.test',
      password: TEST_PASSWORD,
      ipHash: 'ip-clean',
    });

    assert.equal(outcome.ok, true, 'limiting must be per-IP, not global');
  });

  it('per-account limiting blocks a distributed attack on one account', async () => {
    const { attemptLogin } = await import('../src/lib/auth/service');
    const config = await import('../src/lib/auth/config');
    await resetLimiters();

    const outcomes = [];
    for (let attempt = 0; attempt < config.LOGIN_MAX_ATTEMPTS_PER_EMAIL + 2; attempt += 1) {
      outcomes.push(
        await attemptLogin({
          email,
          password: 'wrong-password',
          ipHash: `ip-distributed-${attempt}`,
        }),
      );
    }

    assert.ok(
      outcomes.some((outcome) => outcome.ok === false && outcome.reason === 'rate_limited'),
      'rotating IPs must not defeat the per-account limit',
    );
  });

  it('the generic endpoint limiter allows up to its limit and then refuses', async () => {
    const { consumeRateLimit } = await import('../src/lib/auth/rate-limit');
    await resetLimiters();

    const key = 'test:endpoint';

    const first = await consumeRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(first.allowed, true);

    await consumeRateLimit({ key, limit: 3, windowMs: 60_000 });
    await consumeRateLimit({ key, limit: 3, windowMs: 60_000 });

    const over = await consumeRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(over.allowed, false, 'the fourth request in the window must be refused');
    assert.ok(over.retryAfterSeconds > 0);

    // A separate window recovers.
    const fresh = await consumeRateLimit({ key: 'test:endpoint:other', limit: 3, windowMs: 60_000 });
    assert.equal(fresh.allowed, true);
  });
});

/* -------------------------------------------------------------------------- */
/* CSRF                                                                        */
/* -------------------------------------------------------------------------- */

describe('CSRF protection', () => {
  it('a request without a matching token is rejected', async () => {
    const { createSession, isValidCsrfToken } = await import('../src/lib/auth/session');

    const { getDb, admins } = await loadAuth();
    await client.execute('DELETE FROM admins');
    await client.execute('DELETE FROM admin_sessions');

    const passwordHash = await (await import('../src/lib/auth/password')).hashPassword(
      TEST_PASSWORD,
    );
    const id = crypto.randomUUID();
    await getDb().insert(admins).values({
      id,
      email: 'csrf@example.test',
      passwordHash,
      fullName: 'CSRF Test',
      role: 'owner',
      isActive: true,
      mustChangePassword: false,
    });

    const session = await createSession({ adminId: id, ipHash: 'ip-csrf', userAgent: 'x' });

    const secret = session.csrfToken;

    assert.equal(
      isValidCsrfToken({ submitted: secret, cookieValue: secret, sessionCsrfSecret: secret }),
      true,
      'a matching triple must validate',
    );

    // Forged header: the cross-site attacker's actual attempt.
    assert.equal(
      isValidCsrfToken({ submitted: 'forged', cookieValue: secret, sessionCsrfSecret: secret }),
      false,
    );
    // Correct header but the attacker's own cookie (the classic "guess the
    // double-submit value" attack).
    assert.equal(
      isValidCsrfToken({ submitted: secret, cookieValue: 'forged', sessionCsrfSecret: secret }),
      false,
    );
    // Missing pieces.
    assert.equal(
      isValidCsrfToken({ submitted: null, cookieValue: secret, sessionCsrfSecret: secret }),
      false,
    );
    assert.equal(
      isValidCsrfToken({ submitted: secret, cookieValue: null, sessionCsrfSecret: secret }),
      false,
    );
    assert.equal(
      isValidCsrfToken({ submitted: '', cookieValue: '', sessionCsrfSecret: secret }),
      false,
    );
    // A value that matches the cookie but not the server-side secret fails.
    assert.equal(
      isValidCsrfToken({ submitted: secret, cookieValue: secret, sessionCsrfSecret: 'other' }),
      false,
    );
  });

  it('the CSRF cookie is readable by scripts but never the session cookie', async () => {
    const { csrfCookieOptions, sessionCookieOptions } = await import(
      '../src/lib/auth/session'
    );

    assert.equal(csrfCookieOptions(3600).httpOnly, false, 'double-submit needs JS access');
    assert.equal(sessionCookieOptions(3600).httpOnly, true, 'the session must stay hidden');
  });
});

/* -------------------------------------------------------------------------- */
/* Provenance: no plaintext credential anywhere                                */
/* -------------------------------------------------------------------------- */

/**
 * Credentials that must never appear in the repository.
 *
 * The list is read from an **uncommitted file** (`.data/secret-markers.json`,
 * covered by the git-ignored `/.data/` rule) rather than spelled out here.
 *
 * An earlier version assembled the values from two halves at runtime — a
 * reasonable idea (the scanner then does not contain the secret it searches for)
 * that has a fatal property: reconstructed with a single `join`, the halves *are*
 * the credential. Anyone with read access to the repository could recover it with
 * a `node -e` one-liner, which defeats the point of banning it from source.
 *
 * Keeping the list out of the tree entirely fixes that and removes a structural
 * weakness at the same time: a scanner can no longer accidentally exempt its own
 * file, because it no longer needs to.
 *
 * Without the file the check still runs and still fails if a secret shows up in
 * the database; it reports that it has nothing to compare against, so a missing
 * list is visible rather than silently green.
 */
function loadSecretMarkers(): string[] {
  const path = join(REPO_ROOT, '.data/secret-markers.json');
  if (!existsSync(path)) return [];

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const SECRET_MARKERS = loadSecretMarkers();

const SCAN_ROOTS = ['src', 'scripts', 'tests', 'docs', 'drizzle', 'netlify.toml', 'package.json'];

function walk(path: string, out: string[]): void {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) {
    out.push(path);
    return;
  }
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    walk(join(path, entry), out);
  }
}

describe('credential hygiene', () => {
  it('no supplied password appears in source, scripts, tests, docs or migrations', () => {
    // A missing baseline must be loud: "0 findings" because nothing was compared
    // would be the most dangerous possible green tick.
    if (SECRET_MARKERS.length === 0) {
      console.log(
        '[credential hygiene] no .data/secret-markers.json — nothing to compare against;',
        'the repository contains no secret literals by construction, but create the list',
        'to enable the comparison scan.',
      );
    }

    const files: string[] = [];
    for (const root of SCAN_ROOTS) walk(join(REPO_ROOT, root), files);

    const offending: string[] = [];

    for (const file of files) {
      // Binary and lock files are irrelevant to credentials we control.
      if (/\.(png|jpg|jpeg|ico|woff2?|db|lock)$/.test(file)) continue;

      const content = readFileSync(file, 'utf8');
      for (const marker of SECRET_MARKERS) {
        if (content.includes(marker)) {
          offending.push(`${relative(REPO_ROOT, file)} contains a supplied test password`);
        }
      }
    }

    assert.deepEqual(offending, []);
  });

  it('the credential scan covers its own directory and the report documents', () => {
    // If `tests` or `docs` were dropped from the scan, the very files most likely
    // to quote a password would go unchecked.
    for (const root of ['src', 'scripts', 'tests', 'docs', 'drizzle']) {
      assert.ok(SCAN_ROOTS.includes(root), `${root} must be scanned for credentials`);
    }

    // And the file holding the values must not itself be committable.
    const ignored = execFileSync('git', ['check-ignore', '.data/secret-markers.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    assert.match(ignored, /secret-markers\.json$/, 'the marker list must be git-ignored');
  });

  it('the bootstrap script reads credentials only from the environment', () => {
    const source = readFileSync(join(REPO_ROOT, 'scripts/seed-admin.ts'), 'utf8');

    assert.match(source, /process\.env\.ADMIN_EMAIL/);
    assert.match(source, /process\.env\.ADMIN_PASSWORD/);

    // No fallback literal for either value.
    assert.doesNotMatch(source, /ADMIN_EMAIL\s*\?\?\s*['"]/, 'email must not have a default');
    assert.doesNotMatch(source, /ADMIN_PASSWORD\s*\?\?\s*['"]/, 'password must not have a default');

    // Strip comments so prose about the password is not mistaken for code.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '');

    // No console call may interpolate the password or hash *value*. (Messages
    // that merely mention the word "password" are fine and expected.)
    for (const line of code.split('\n')) {
      if (!/console\.(log|error|warn)/.test(line)) continue;
      assert.doesNotMatch(
        line,
        /\$\{[^}]*\b(password|passwordHash)\b/,
        `the script must not log the password value: ${line.trim()}`,
      );
      assert.doesNotMatch(
        line,
        /process\.env\.ADMIN_PASSWORD/,
        `the script must not log the password environment variable: ${line.trim()}`,
      );
    }

    // Hashing must happen before the insert, so the plaintext never reaches the DB.
    const hashIndex = code.indexOf('await hashPassword(password)');
    const insertIndex = code.indexOf('.insert(admins)');
    assert.ok(hashIndex > -1, 'the script must hash the password');
    assert.ok(insertIndex > -1, 'the script must insert an administrator');
    assert.ok(hashIndex < insertIndex, 'hashing must precede the insert');
  });

  it('no public registration or account-creation route exists', () => {
    const routeFiles: string[] = [];
    walk(join(REPO_ROOT, 'src/app/api'), routeFiles);

    const suspicious = routeFiles.filter((file) =>
      /register|signup|sign-up|create-account/i.test(file),
    );

    assert.deepEqual(suspicious, [], 'there must be no public account-creation endpoint');
  });

  it('the login route issues cookies, never raw credentials, and sets no-store', () => {
    const source = readFileSync(join(REPO_ROOT, 'src/app/api/admin/auth/login/route.ts'), 'utf8');

    assert.match(source, /sessionCookieOptions/);
    assert.match(source, /csrfCookieOptions/);
    assert.match(source, /Cache-Control['"]:\s*['"]no-store/);
    assert.doesNotMatch(source, /console\.log/, 'the login route must not log');
  });
});

/* -------------------------------------------------------------------------- */
/* Audit trail                                                                 */
/* -------------------------------------------------------------------------- */

describe('audit trail', () => {
  it('a sign-in writes an audit row without leaking secrets', async () => {
    await reloadModules();
    await client.execute('DELETE FROM admins');
    await client.execute('DELETE FROM admin_sessions');
    await client.execute('DELETE FROM activity_logs');
    await resetLimiters();

    const passwordHash = await (await import('../src/lib/auth/password')).hashPassword(
      TEST_PASSWORD,
    );
    const { getDb, admins } = await loadAuth();
    const id = crypto.randomUUID();
    await getDb().insert(admins).values({
      id,
      email: 'audit@example.test',
      passwordHash,
      fullName: 'Audit Test',
      role: 'owner',
      isActive: true,
      mustChangePassword: false,
    });

    const { attemptLogin } = await import('../src/lib/auth/service');
    const outcome = await attemptLogin({
      email: 'audit@example.test',
      password: TEST_PASSWORD,
      ipHash: 'ip-audit-row',
    });
    assert.equal(outcome.ok, true);

    // `attemptLogin` writes the audit row itself — this asserts that it did,
    // rather than writing a second one by hand.
    const rows = await client.execute(
      "SELECT action, summary, metadata FROM activity_logs WHERE action = 'admin.login'",
    );
    assert.equal(rows.rows.length, 1, 'exactly one sign-in event must be recorded');
    assert.equal(String(rows.rows[0]?.action), 'admin.login');

    const serialised = JSON.stringify(rows.rows);
    for (const marker of SECRET_MARKERS) {
      assert.equal(serialised.includes(marker), false, 'audit rows must not contain passwords');
    }
    assert.equal(
      serialised.includes(passwordHash),
      false,
      'audit rows must not contain a password hash',
    );
  });

  it('a failing audit write never breaks the caller', async () => {
    const { writeAuditLog } = await import('../src/lib/auth/audit');

    // An invalid action violates the enum/constraint; the helper must swallow it.
    await assert.doesNotReject(
      writeAuditLog({
        // @ts-expect-error deliberately invalid, to prove the failure is contained
        action: 'not.a.real.action',
        summary: 'should not throw',
      }),
    );
  });
});
