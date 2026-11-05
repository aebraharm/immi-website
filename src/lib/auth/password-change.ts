import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { admins } from '@/db/schema/auth';

import { writeAuditLog } from './audit';
import { COMMON_PASSWORD_DENYLIST } from './config';
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './password';
import { revokeAllSessions } from './session';

/**
 * Administrator password change.
 *
 * Used in two situations:
 *  1. The forced first-login change (`mustChangePassword = true`).
 *  2. A voluntary change from account settings.
 *
 * Both share this implementation so the rules cannot drift apart. On success all
 * *other* sessions are revoked — if a password was changed because it might be
 * compromised, leaving the attacker's session alive would defeat the purpose.
 */

export type PasswordChangeOutcome =
  | { ok: true }
  | { ok: false; error: 'wrong_current_password' | 'weak_password' | 'reused_password'; messages: string[] };

/** Additional policy layered on top of `validatePasswordStrength`. */
export function validateNewPassword(params: {
  password: string;
  email: string;
  previousPassword?: string;
}): string[] {
  const problems = validatePasswordStrength(params.password);

  const lower = params.password.toLowerCase();
  const emailLocal = params.email.split('@')[0]?.toLowerCase() ?? '';

  // Reject passwords containing the account's own local part.
  if (emailLocal.length >= 4 && lower.includes(emailLocal)) {
    problems.push('Do not use your email address as your password.');
  }

  // Reject an exact denylisted password (case-insensitive), and reject any
  // denylisted word appearing as a whole segment of the password.
  if ((COMMON_PASSWORD_DENYLIST as readonly string[]).includes(lower)) {
    problems.push('That password is too common. Choose something unique.');
  }

  // Reject a trivially repeated character run or a straight sequence.
  if (/^(.)\1+$/.test(params.password)) {
    problems.push('Do not repeat a single character.');
  }
  if (/(.)\1{3,}/.test(params.password)) {
    problems.push('Avoid repeating the same character four or more times.');
  }

  if (params.password.length > 128) {
    problems.push('Use 128 characters or fewer.');
  }

  return Array.from(new Set(problems));
}

export async function changePassword(params: {
  adminId: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  /** Kept alive so the user is not bounced out of the session they are using. */
  currentSessionId: string;
  ipHash?: string | null;
}): Promise<PasswordChangeOutcome> {
  const db = getDb();

  const rows = await db
    .select({ passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.id, params.adminId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      error: 'wrong_current_password',
      messages: ['Your account could not be found. Please sign in again.'],
    };
  }

  // 1. The current password must be proven, even on a forced change — otherwise
  //    anyone who reaches an unlocked screen could take over the account.
  const currentValid = await verifyPassword(row.passwordHash, params.currentPassword);

  if (!currentValid) {
    await writeAuditLog({
      action: 'admin.login_failed',
      actorAdminId: params.adminId,
      actorEmail: params.email,
      summary: 'Incorrect current password on password change',
      metadata: { reason: 'wrong_current_password' },
      ipHash: params.ipHash,
    });

    return {
      ok: false,
      error: 'wrong_current_password',
      messages: ['Your current password is incorrect.'],
    };
  }

  // 2. Reject reusing the same password.
  if (params.newPassword === params.currentPassword) {
    return {
      ok: false,
      error: 'reused_password',
      messages: ['Your new password must be different from your current password.'],
    };
  }

  // 3. Policy.
  const problems = validateNewPassword({
    password: params.newPassword,
    email: params.email,
  });

  if (problems.length > 0) {
    return { ok: false, error: 'weak_password', messages: problems };
  }

  // 4. Persist the new hash and clear the forced-change flag.
  const passwordHash = await hashPassword(params.newPassword);

  await db
    .update(admins)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(admins.id, params.adminId));

  // 5. Terminate every other session.
  const revoked = await revokeAllSessions(params.adminId, params.currentSessionId);

  await writeAuditLog({
    action: 'admin.password_changed',
    actorAdminId: params.adminId,
    actorEmail: params.email,
    entityType: 'admin',
    entityId: params.adminId,
    summary: `Password changed; ${revoked} other session(s) revoked`,
    metadata: { revokedSessions: revoked },
    ipHash: params.ipHash,
  });

  return { ok: true };
}

export { MIN_PASSWORD_LENGTH };
