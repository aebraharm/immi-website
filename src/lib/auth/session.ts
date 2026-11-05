import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { adminSessions, admins } from '@/db/schema/auth';
import type { AdminRole } from '@/db/schema/enums';

import {
  CSRF_COOKIE_NAME,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './config';
import { generateToken, hashIp, safeEqual, sha256Hex } from './crypto';

/**
 * Database-backed administrator sessions.
 *
 * Design decisions that matter:
 *
 *  - The cookie holds a 256-bit random token. The database stores only its
 *    SHA-256 digest, so a database leak does not yield usable sessions.
 *  - Expiry is enforced in SQL on every lookup, so a revoked or expired session
 *    fails even if a stale cookie is still presented.
 *  - Two independent timeouts: absolute (8h from login) and idle (30m). Either
 *    one expiring ends the session.
 *  - Revocation is a row update, so it takes effect immediately across every
 *    server instance — no in-memory session cache to go stale.
 *  - CSRF uses double-submit: a random secret is stored on the session row AND
 *    set in a non-HttpOnly cookie. A cross-site request cannot read the cookie,
 *    so it cannot produce a matching header. The value is compared against the
 *    session row, not merely cookie-to-header, so an attacker who can set
 *    cookies still cannot forge it.
 */

export type AuthenticatedAdmin = {
  sessionId: string;
  adminId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  mustChangePassword: boolean;
  expiresAt: Date;
};

export type CreatedSession = {
  /** Opaque token for the HttpOnly cookie. Never persisted in plaintext. */
  token: string;
  /** Double-submit value for the JS-readable cookie. */
  csrfToken: string;
  expiresAt: Date;
  sessionId: string;
};

/* -------------------------------------------------------------------------- */
/* Create / destroy                                                           */
/* -------------------------------------------------------------------------- */

export async function createSession(params: {
  adminId: string;
  ipHash: string | null;
  userAgent: string | null;
}): Promise<CreatedSession> {
  const db = getDb();

  const token = generateToken(32); // 256 bits
  const csrfSecret = generateToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);

  const [row] = await db
    .insert(adminSessions)
    .values({
      adminId: params.adminId,
      tokenHash: sha256Hex(token),
      csrfSecret,
      ipHash: params.ipHash,
      userAgent: params.userAgent?.slice(0, 255) ?? null,
      createdAt: now,
      expiresAt,
      lastSeenAt: now,
    })
    .returning({ id: adminSessions.id });

  if (!row) {
    throw new Error('Failed to create an administrator session.');
  }

  return { token, csrfToken: csrfSecret, expiresAt, sessionId: row.id };
}

/**
 * Resolve a session from its raw cookie token.
 *
 * Returns null for: unknown token, revoked session, past absolute expiry, past
 * idle expiry, or deactivated administrator. Every one of those is a normal,
 * silent failure — the caller redirects to the login page.
 */
export async function resolveSession(
  rawToken: string | undefined,
): Promise<AuthenticatedAdmin | null> {
  if (!rawToken || rawToken.length < 20) return null;

  const db = getDb();
  const now = new Date();

  const rows = await db
    .select({
      sessionId: adminSessions.id,
      expiresAt: adminSessions.expiresAt,
      lastSeenAt: adminSessions.lastSeenAt,
      adminId: admins.id,
      email: admins.email,
      fullName: admins.fullName,
      role: admins.role,
      isActive: admins.isActive,
      mustChangePassword: admins.mustChangePassword,
    })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(
      and(
        eq(adminSessions.tokenHash, sha256Hex(rawToken)),
        isNull(adminSessions.revokedAt),
        sql`${adminSessions.expiresAt} > ${now.getTime()}`,
        sql`${adminSessions.lastSeenAt} > ${now.getTime() - SESSION_IDLE_TTL_MS}`,
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // A deactivated administrator's existing sessions stop working immediately.
  if (row.isActive === false) return null;

  // Sliding idle timer, written at most once per SESSION_TOUCH_INTERVAL_MS.
  const dueForTouch =
    now.getTime() - row.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS;

  if (dueForTouch) {
    await db
      .update(adminSessions)
      .set({ lastSeenAt: now })
      .where(eq(adminSessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    adminId: row.adminId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    mustChangePassword: row.mustChangePassword,
    expiresAt: row.expiresAt,
  };
}

/** Revoke exactly one session (logout). */
export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.id, sessionId));
}

/** Revoke every live session for an administrator (password change, logout-all). */
export async function revokeAllSessions(
  adminId: string,
  exceptSessionId?: string,
): Promise<number> {
  const db = getDb();

  const result = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(
      exceptSessionId
        ? and(
            eq(adminSessions.adminId, adminId),
            isNull(adminSessions.revokedAt),
            sql`${adminSessions.id} <> ${exceptSessionId}`,
          )
        : and(eq(adminSessions.adminId, adminId), isNull(adminSessions.revokedAt)),
    )
    .returning({ id: adminSessions.id });

  return result.length;
}

/**
 * Delete rows that are past their absolute expiry.
 *
 * Kept as an explicit maintenance call rather than a per-request side effect:
 * correctness does not depend on it (expiry is enforced in the query), so it can
 * run on a schedule without adding latency to logins.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(adminSessions)
    .where(
      or(
        lt(adminSessions.expiresAt, new Date()),
        // Retain revoked rows briefly for the audit trail, then drop them.
        lt(adminSessions.revokedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      ),
    )
    .returning({ id: adminSessions.id });

  return result.length;
}

/* -------------------------------------------------------------------------- */
/* CSRF                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Verify a double-submit CSRF token against the session row.
 *
 * Two things must match:
 *  1. the submitted header value must equal the session's stored secret
 *  2. the readable CSRF cookie must equal the same secret
 *
 * The second check is what makes this robust: an attacker on another origin can
 * cause the browser to *send* our cookies, but cannot read the CSRF cookie to put
 * its value in a header, and cannot learn the session's server-side secret.
 */
export function isValidCsrfToken(params: {
  submitted: string | null;
  cookieValue: string | null;
  sessionCsrfSecret: string;
}): boolean {
  const { submitted, cookieValue, sessionCsrfSecret } = params;
  if (!submitted || !cookieValue) return false;

  return safeEqual(submitted, sessionCsrfSecret) && safeEqual(cookieValue, sessionCsrfSecret);
}

/** Read the session's stored CSRF secret (used to re-issue the readable cookie). */
export async function getSessionCsrfSecret(sessionId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ csrfSecret: adminSessions.csrfSecret })
    .from(adminSessions)
    .where(eq(adminSessions.id, sessionId))
    .limit(1);
  return rows[0]?.csrfSecret ?? null;
}

/* -------------------------------------------------------------------------- */
/* Cookie helpers                                                             */
/* -------------------------------------------------------------------------- */

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
};

/** The HttpOnly session cookie. `Secure` is enabled everywhere except local http. */
export function sessionCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * The CSRF cookie must be readable by our own JavaScript, so it is not HttpOnly.
 * It is still SameSite=Lax and scoped to the site root.
 */
export function csrfCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME };

/** Helper used by the login route to normalise forwarded IP headers. */
export function clientIpHash(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  return hashIp(forwarded ?? realIp);
}
