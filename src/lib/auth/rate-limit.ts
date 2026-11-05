import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { loginAttempts, rateLimitBuckets } from '@/db/schema/operations';

import {
  LOGIN_LOCKOUT_LADDER_MS,
  LOGIN_LOCKOUT_STEP,
  LOGIN_MAX_ATTEMPTS_PER_EMAIL,
  LOGIN_MAX_ATTEMPTS_PER_IP,
  LOGIN_RATE_WINDOW_MS,
} from './config';
import { sha256Hex } from './crypto';

/**
 * Rate limiting.
 *
 * Why the database rather than memory: Netlify functions are short-lived and
 * horizontally scaled. An in-process counter resets on every cold start and is
 * invisible to sibling instances, so "5 attempts" would silently mean "5 attempts
 * per instance, reset whenever we feel like it". Counting rows is slower but
 * actually enforces the limit.
 *
 * Two dimensions are tracked for login, because they defend against different
 * attacks:
 *
 *  - **Per IP** stops one machine spraying many accounts (credential stuffing).
 *  - **Per account** stops a distributed attack on one known email address.
 *
 * Only SHA-256 digests of the email and IP are stored, never the raw values.
 */

export type RateLimitDecision = {
  allowed: boolean;
  /** Seconds until the caller may retry. Zero when allowed. */
  retryAfterSeconds: number;
  /** Which dimension tripped, for logging. */
  reason?: 'ip' | 'account';
};

/* -------------------------------------------------------------------------- */
/* Login attempts                                                             */
/* -------------------------------------------------------------------------- */

export async function recordLoginAttempt(params: {
  email: string;
  ipHash: string;
  success: boolean;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(loginAttempts).values({
    emailHash: sha256Hex(params.email.trim().toLowerCase()),
    ipHash: params.ipHash,
    success: params.success,
    reason: params.reason ?? '',
  });
}

async function countRecentFailures(
  column: 'emailHash' | 'ipHash',
  value: string,
  windowMs: number,
): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts[column], value),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, since),
      ),
    );

  return Number(row?.count ?? 0);
}

/**
 * How long to refuse service, given how many failures this identity has
 * accumulated inside the window.
 *
 * The first `LOGIN_LOCKOUT_STEP` failures are the normal case: once the limit is
 * hit the caller waits for the window to roll, which is exactly the friction we
 * want and no more. Deliberate persistence escalates to the longer rungs.
 */
function lockoutDurationFor(failureCount: number): number {
  const rung = Math.max(
    0,
    Math.min(
      Math.floor(failureCount / LOGIN_LOCKOUT_STEP) - 1,
      LOGIN_LOCKOUT_LADDER_MS.length - 1,
    ),
  );
  return LOGIN_LOCKOUT_LADDER_MS[rung] ?? LOGIN_LOCKOUT_LADDER_MS[0];
}

/**
 * Decide whether a login attempt may proceed.
 *
 * Called BEFORE verifying the password so a locked-out attacker never reaches
 * the (expensive) Argon2 verification at all.
 */
export async function checkLoginAllowed(params: {
  email: string;
  ipHash: string;
}): Promise<RateLimitDecision> {
  const emailHash = sha256Hex(params.email.trim().toLowerCase());

  const [ipFailures, emailFailures] = await Promise.all([
    countRecentFailures('ipHash', params.ipHash, LOGIN_RATE_WINDOW_MS),
    countRecentFailures('emailHash', emailHash, LOGIN_RATE_WINDOW_MS),
  ]);

  if (ipFailures >= LOGIN_MAX_ATTEMPTS_PER_IP) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(lockoutDurationFor(ipFailures) / 1000),
      reason: 'ip',
    };
  }

  if (emailFailures >= LOGIN_MAX_ATTEMPTS_PER_EMAIL) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(lockoutDurationFor(emailFailures) / 1000),
      reason: 'account',
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Delete login attempt rows older than the retention window.
 * Called opportunistically; the limiter is correct without it because every
 * query is bounded by a time window.
 */
export async function pruneLoginAttempts(retentionMs = 24 * 60 * 60 * 1000): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(loginAttempts)
    .where(lte(loginAttempts.createdAt, new Date(Date.now() - retentionMs)))
    .returning({ id: loginAttempts.id });
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Generic fixed-window limiter                                               */
/* -------------------------------------------------------------------------- */

export type FixedWindowDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window counter with an atomic upsert.
 *
 * The increment is a single SQL statement (`ON CONFLICT DO UPDATE`), so two
 * concurrent requests cannot both read "4" and both decide they are the fifth.
 */
export async function consumeRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<FixedWindowDecision> {
  const db = getDb();
  const now = Date.now();
  const windowStart = now - (now % params.windowMs);
  const expiresAt = new Date(windowStart + params.windowMs);

  // Reset the counter when the stored window has rolled over, otherwise bump it.
  const rows = await db
    .insert(rateLimitBuckets)
    .values({
      key: params.key,
      count: 1,
      windowStart,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        count: sql`CASE WHEN ${rateLimitBuckets.windowStart} = ${windowStart}
                        THEN ${rateLimitBuckets.count} + 1
                        ELSE 1 END`,
        windowStart: sql`${windowStart}`,
        expiresAt: sql`${expiresAt.getTime()}`,
      },
    })
    .returning({ count: rateLimitBuckets.count });

  const count = Number(rows[0]?.count ?? 1);
  const allowed = count <= params.limit;

  return {
    allowed,
    remaining: Math.max(0, params.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((expiresAt.getTime() - now) / 1000),
  };
}

/**
 * Read a counter without incrementing it.
 *
 * Used by the public assessment endpoint to answer "has this connection already
 * failed too many times?" *before* deciding whether to read a request body at
 * all. Deciding with `consumeRateLimit` would mean a blocked caller could extend
 * their own lockout simply by trying again.
 */
export async function peekRateLimit(params: {
  key: string;
  windowMs: number;
}): Promise<number> {
  const db = getDb();
  const now = Date.now();
  const windowStart = now - (now % params.windowMs);

  const rows = await db
    .select({ count: rateLimitBuckets.count, windowStart: rateLimitBuckets.windowStart })
    .from(rateLimitBuckets)
    .where(eq(rateLimitBuckets.key, params.key))
    .limit(1);

  const row = rows[0];
  if (!row) return 0;

  // A counter from a previous window is not a current count.
  return Number(row.windowStart) === windowStart ? Number(row.count) : 0;
}

/** Remove expired buckets. Purely housekeeping. */
export async function pruneRateLimitBuckets(): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(rateLimitBuckets)
    .where(lte(rateLimitBuckets.expiresAt, new Date()))
    .returning({ key: rateLimitBuckets.key });
  return rows.length;
}
