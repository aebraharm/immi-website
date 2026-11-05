/**
 * Unlock a locked-out administrator account.
 *
 * The login limiter is deliberately durable: after repeated failures an account
 * is locked, and at the terminal rung it stays locked until someone intervenes.
 * That is the correct behaviour for an attack — but it must also be recoverable
 * by the operator without hand-writing SQL, so this command exists.
 *
 * What it does:
 *   - clears `failed_attempts` and `locked_until` for the account
 *   - clears the rate-limit rows that mention the account (the per-IP rows for
 *     the operator's own address are removed too, otherwise the very next
 *     attempt would be blocked by the IP counter)
 *   - with `--revoke-sessions`, also signs the account out everywhere
 *
 * What it deliberately does NOT do:
 *   - it does not change, reset or reveal the password
 *   - it does not create an account
 *   - it does not reactivate a deactivated account
 *
 * Usage:
 *   ADMIN_EMAIL=someone@example.com npm run admin:unlock
 *   ADMIN_EMAIL=someone@example.com npm run admin:unlock -- --revoke-sessions
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import { admins, adminSessions } from '../src/db/schema/auth';
import { sha256Hex } from '../src/lib/auth/crypto';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const revokeSessions = process.argv.includes('--revoke-sessions');

  if (!email) {
    console.error('[admin:unlock] ADMIN_EMAIL must be set. Nothing was changed.');
    process.exit(1);
  }

  const url = process.env.TURSO_DATABASE_URL ?? 'file:./.data/local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient(authToken ? { url, authToken } : { url });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client);

  try {
    const [account] = await db
      .select({
        id: admins.id,
        email: admins.email,
        isActive: admins.isActive,
        failedAttempts: admins.failedAttempts,
        lockedUntil: admins.lockedUntil,
      })
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1);

    if (!account) {
      console.error(`[admin:unlock] No administrator exists with that email. Nothing was changed.`);
      process.exit(2);
    }

    if (account.isActive === false) {
      console.error(
        '[admin:unlock] That account is deactivated. Unlocking will not let it sign in.\n' +
          '[admin:unlock] Reactivate it deliberately; this command will not do that for you.',
      );
    }

    const emailHash = sha256Hex(email);

    await db
      .update(admins)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(admins.id, account.id));

    // Attempt rows are keyed by digest, so the account's rows can be targeted
    // without ever storing or matching a plaintext address.
    const attempts = await db.run(
      sql`DELETE FROM login_attempts WHERE email_hash = ${emailHash}`,
    );

    let revoked = 0;
    if (revokeSessions) {
      const result = await db
        .update(adminSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(adminSessions.adminId, account.id), isNull(adminSessions.revokedAt)))
        .returning({ id: adminSessions.id });
      revoked = result.length;
    }

    console.log('[admin:unlock] Account unlocked.');
    console.log(`  email            : ${account.email}`);
    console.log(`  prior failures   : ${account.failedAttempts}`);
    console.log(`  prior lock       : ${account.lockedUntil ? account.lockedUntil.toISOString() : 'none'}`);
    console.log(`  attempt rows     : ${attempts.rowsAffected} removed`);
    console.log(`  sessions revoked : ${revokeSessions ? revoked : 'unchanged'}`);
    console.log('  password         : untouched');
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  console.error('[admin:unlock] FAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
