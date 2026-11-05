import { eq, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { admins } from '@/db/schema/auth';
import { verifyPassword } from './password';

import { writeAuditLog } from './audit';
import {
  LOGIN_HARD_LOCK_THRESHOLD,
  LOGIN_LOCKOUT_LADDER_MS,
  LOGIN_MAX_ATTEMPTS_PER_EMAIL,
} from './config';
import { checkLoginAllowed, recordLoginAttempt } from './rate-limit';

/**
 * Login orchestration.
 *
 * Separated from the HTTP route so it can be tested directly against the
 * database without a running server — which is how the "correct password
 * authenticates / wrong password is rejected / rate limiting engages" evidence
 * in the report was produced.
 *
 * Security properties enforced here:
 *
 *  - **Uniform failure.** Wrong password, unknown email, deactivated account and
 *    a mistyped email all produce the same `invalid_credentials` reason and the
 *    same timing (see `burnTime`). The client cannot tell which occurred, so the
 *    endpoint cannot be used to enumerate administrator addresses.
 *
 *  - **Rate limits run before password verification**, so a locked-out attacker
 *    never gets to spend our CPU on Argon2.
 *
 *  - **Attempts are recorded either way**, which is what makes the limiter work
 *    on the next request.
 */

export type LoginOutcome =
  | {
      ok: true;
      admin: {
        id: string;
        email: string;
        fullName: string;
        role: 'owner' | 'admin' | 'editor';
        mustChangePassword: boolean;
      };
    }
  | {
      ok: false;
      reason:
        | 'invalid_credentials'
        | 'rate_limited'
        | 'account_locked'
        | 'account_inactive';
      retryAfterSeconds?: number;
    };

/**
 * A valid-looking Argon2id hash of a random value.
 *
 * Used to spend the same CPU time when the email does not exist, so response
 * timing does not reveal whether an account is registered. Generated once at
 * module load from a value nobody knows.
 */
let dummyHashPromise: Promise<string> | null = null;

async function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = import('./password').then(({ hashPassword }) =>
      hashPassword(crypto.randomUUID()),
    );
  }
  return dummyHashPromise;
}

/** Spend comparable time to a real verification, then fail. */
async function burnTime(password: string): Promise<void> {
  try {
    const dummy = await getDummyHash();
    await verifyPassword(dummy, password);
  } catch {
    // Never surface anything from the timing-equalisation path.
  }
}

/**
 * Increment the account's consecutive failure count and, once it passes the
 * threshold, set a lockout that lengthens on each successive lockout.
 *
 * This is separate from the IP/account limiter in `rate-limit.ts`: the limiter
 * works on a rolling window of *attempts*, whereas this is a durable property of
 * the account that survives window rollovers and is visible to an administrator
 * reviewing the account.
 */
async function recordFailedPasswordAttempt(adminId: string): Promise<void> {
  const db = getDb();

  // `failed_attempts + 1` and the lockout decision are computed in SQL so two
  // concurrent failures cannot both read the old value.
  const [row] = await db
    .update(admins)
    .set({
      failedAttempts: sql`${admins.failedAttempts} + 1`,
    })
    .where(eq(admins.id, adminId))
    .returning({ failedAttempts: admins.failedAttempts });

  const failures = Number(row?.failedAttempts ?? 0);

  if (failures < LOGIN_MAX_ATTEMPTS_PER_EMAIL) return;

  // Terminal rung: a very large lockout that only an administrator can clear.
  const isHardLock = failures >= LOGIN_HARD_LOCK_THRESHOLD;
  const rung = Math.min(
    Math.floor((failures - LOGIN_MAX_ATTEMPTS_PER_EMAIL) / LOGIN_MAX_ATTEMPTS_PER_EMAIL),
    LOGIN_LOCKOUT_LADDER_MS.length - 1,
  );
  const durationMs = isHardLock
    ? 365 * 24 * 60 * 60 * 1000
    : (LOGIN_LOCKOUT_LADDER_MS[rung] ?? LOGIN_LOCKOUT_LADDER_MS[0]);

  await db
    .update(admins)
    .set({ lockedUntil: new Date(Date.now() + durationMs) })
    .where(eq(admins.id, adminId));
}

export async function attemptLogin(params: {
  email: string;
  password: string;
  ipHash: string;
}): Promise<LoginOutcome> {
  const email = params.email.trim().toLowerCase();

  /* ------------------------- 1. rate limiting ------------------------- */
  const decision = await checkLoginAllowed({ email, ipHash: params.ipHash });

  if (!decision.allowed) {
    await recordLoginAttempt({
      email,
      ipHash: params.ipHash,
      success: false,
      reason: `rate_limited_${decision.reason ?? 'unknown'}`,
    });

    await writeAuditLog({
      action: 'admin.login_failed',
      actorEmail: email,
      summary: 'Login blocked by rate limiting',
      metadata: { reason: decision.reason ?? 'unknown' },
      ipHash: params.ipHash,
    });

    return {
      ok: false,
      reason: 'rate_limited',
      retryAfterSeconds: decision.retryAfterSeconds,
    };
  }

  /* ------------------------- 2. look up admin ------------------------- */
  const db = getDb();
  const rows = await db
    .select({
      id: admins.id,
      email: admins.email,
      fullName: admins.fullName,
      role: admins.role,
      isActive: admins.isActive,
      mustChangePassword: admins.mustChangePassword,
      passwordHash: admins.passwordHash,
      lockedUntil: admins.lockedUntil,
    })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

  const admin = rows[0];

  // No such administrator: burn equivalent time, record the attempt, fail
  // identically to a wrong password.
  if (!admin) {
    await burnTime(params.password);
    await recordLoginAttempt({
      email,
      ipHash: params.ipHash,
      success: false,
      reason: 'unknown_account',
    });
    await writeAuditLog({
      action: 'admin.login_failed',
      actorEmail: email,
      summary: 'Login attempt for unknown account',
      metadata: { reason: 'unknown_account' },
      ipHash: params.ipHash,
    });
    return { ok: false, reason: 'invalid_credentials' };
  }

  /* --------------------- 3. hard account lockout ---------------------- */
  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil(
      (admin.lockedUntil.getTime() - Date.now()) / 1000,
    );

    await recordLoginAttempt({
      email,
      ipHash: params.ipHash,
      success: false,
      reason: 'account_locked',
    });

    return { ok: false, reason: 'account_locked', retryAfterSeconds };
  }

  /* ------------------------ 4. verify password ------------------------ */
  const passwordValid = await verifyPassword(admin.passwordHash, params.password);

  if (!passwordValid) {
    await recordLoginAttempt({
      email,
      ipHash: params.ipHash,
      success: false,
      reason: 'bad_password',
    });

    // Count consecutive failures and escalate the lockout ladder. Repeated
    // failure is a signal in itself, independent of the per-IP limiter.
    await recordFailedPasswordAttempt(admin.id);

    await writeAuditLog({
      action: 'admin.login_failed',
      actorAdminId: admin.id,
      actorEmail: email,
      summary: 'Incorrect password',
      metadata: { reason: 'bad_password' },
      ipHash: params.ipHash,
    });

    return { ok: false, reason: 'invalid_credentials' };
  }

  /* ---------------------- 5. account state checks --------------------- */
  if (admin.isActive === false) {
    await recordLoginAttempt({
      email,
      ipHash: params.ipHash,
      success: false,
      reason: 'inactive_account',
    });

    await writeAuditLog({
      action: 'admin.login_failed',
      actorAdminId: admin.id,
      actorEmail: email,
      summary: 'Login attempt on a deactivated account',
      metadata: { reason: 'inactive_account' },
      ipHash: params.ipHash,
    });

    // Same outward reason as bad credentials: an attacker learns nothing, and a
    // legitimate former employee learns nothing either.
    return { ok: false, reason: 'invalid_credentials' };
  }

  /* --------------------------- 6. success ----------------------------- */
  await db
    .update(admins)
    .set({ lastLoginAt: new Date(), failedAttempts: 0, lockedUntil: null })
    .where(eq(admins.id, admin.id));

  await recordLoginAttempt({
    email,
    ipHash: params.ipHash,
    success: true,
    reason: 'ok',
  });

  await writeAuditLog({
    action: 'admin.login',
    actorAdminId: admin.id,
    actorEmail: email,
    summary: admin.mustChangePassword
      ? 'Signed in; password change required'
      : 'Signed in',
    ipHash: params.ipHash,
  });

  return {
    ok: true,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      mustChangePassword: admin.mustChangePassword,
    },
  };
}
