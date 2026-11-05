/**
 * Administrator provisioning (bootstrap).
 *
 * Creates the initial administrator account from environment variables. The
 * password is never written into source, never echoed to the terminal, and never
 * stored in plaintext — it is hashed with Argon2id before insert.
 *
 * Usage:
 *   # put ADMIN_EMAIL / ADMIN_PASSWORD in .env.local (git-ignored), then:
 *   npm run seed:admin
 *
 * Safety rules (these are the whole point of the script):
 *
 *   1. **Never overwrites an existing password.** If an account with ADMIN_EMAIL
 *      already exists, the script stops as a successful no-op. It does not touch
 *      the password hash, the role, the name, or the active flag. Re-running it
 *      after an operator has chosen their own password is therefore harmless.
 *   2. **Never creates a duplicate.** The email address is the key. A second row
 *      with the same address is impossible (unique index) and the script checks
 *      first so the failure is a readable message rather than a SQL error.
 *   3. **Refuses to silently add a second, unrelated administrator.** If other
 *      administrators exist but ADMIN_EMAIL is not among them, the script stops.
 *      Adding an account deliberately requires SEED_ADMIN_ALLOW_ADDITIONAL=1.
 *   4. **Forces a password change on first login** (`must_change_password`).
 *   5. **Prints no secret.** Not the password, not the hash, not a prefix.
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';

import { admins } from '../src/db/schema/auth';
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from '../src/lib/auth/password';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const ALLOWED_BOOTSTRAP_ROLES = ['owner', 'admin'] as const;

/** Exit codes, so CI can distinguish "nothing to do" from "refused". */
const EXIT_REFUSED = 2;

function fail(message: string, code = 1): never {
  console.error(`[seed:admin] ${message}`);
  process.exit(code);
}

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || 'Administrator';
  const role = (process.env.ADMIN_ROLE?.trim() || 'owner') as 'owner' | 'admin';
  const allowAdditional = process.env.SEED_ADMIN_ALLOW_ADDITIONAL === '1';

  // ---- 1. Validate the request shape (email/role only; the password is not
  //         needed yet, because an existing account is never re-seeded). -------

  if (!email) {
    fail('ADMIN_EMAIL must be set (see .env.example). Nothing was created.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('ADMIN_EMAIL is not a valid email address. Nothing was created.');
  }

  if (!(ALLOWED_BOOTSTRAP_ROLES as readonly string[]).includes(role)) {
    fail(
      `ADMIN_ROLE must be one of: ${ALLOWED_BOOTSTRAP_ROLES.join(', ')}. ` +
        'Nothing was created.',
    );
  }

  // ---- 2. Connect ----------------------------------------------------------

  const url = process.env.TURSO_DATABASE_URL ?? 'file:./.data/local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const isRemote = !url.startsWith('file:');

  if (!isRemote) {
    mkdirSync('.data', { recursive: true });
  }

  const client = createClient(authToken ? { url, authToken } : { url });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client);

  const close = () => client.close();

  try {
    const tableCheck = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='admins'",
    );
    if (tableCheck.rows.length === 0) {
      fail('The `admins` table does not exist. Run `npm run db:migrate` first.');
    }

    console.log(
      `[seed:admin] Target database: ${isRemote ? 'remote Turso database' : url}`,
    );

    // ---- 3. Is this account already provisioned? ---------------------------

    const existing = await db
      .select({
        id: admins.id,
        email: admins.email,
        role: admins.role,
        isActive: admins.isActive,
        mustChangePassword: admins.mustChangePassword,
        passwordChangedAt: admins.passwordChangedAt,
      })
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1);

    const account = existing[0];

    if (account) {
      // THE critical branch: no writes at all. Not the password, not the role,
      // not `must_change_password`. Re-running this script after an operator has
      // set their own password must be a no-op.
      console.log('[seed:admin] This administrator already exists — no changes made.');
      console.log(`  email              : ${account.email}`);
      console.log(`  role               : ${account.role}`);
      console.log(`  active             : ${account.isActive ? 'yes' : 'NO'}`);
      console.log(
        `  password changed   : ${
          account.passwordChangedAt ? 'yes — existing password preserved' : 'not yet (still the initial password)'
        }`,
      );
      console.log(
        `  pending forced change: ${account.mustChangePassword ? 'yes' : 'no'}`,
      );
      console.log(
        '[seed:admin] The stored password was NOT modified. Use the portal to change it.',
      );
      return;
    }

    // ---- 4. A new account: is adding one permitted? ------------------------

    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(admins);

    if (total > 0 && !allowAdditional) {
      console.error(
        `[seed:admin] Refusing to run: ${total} administrator account(s) already exist, ` +
          'but none uses this email address.',
      );
      console.error(
        '[seed:admin] Re-run with the existing administrator\'s email to check its state, ' +
          'or set SEED_ADMIN_ALLOW_ADDITIONAL=1 to deliberately add another account.',
      );
      console.error('[seed:admin] Nothing was created.');
      close();
      process.exit(EXIT_REFUSED);
    }

    // ---- 5. Validate the password before hashing ---------------------------

    if (!password) {
      fail(
        'ADMIN_PASSWORD must be set to create a new account (see .env.example). ' +
          'Nothing was created.',
      );
    }

    const problems = validatePasswordStrength(password);
    if (problems.length > 0) {
      console.error(
        `[seed:admin] ADMIN_PASSWORD does not meet the policy (min ${MIN_PASSWORD_LENGTH} chars):`,
      );
      for (const problem of problems) console.error(`  - ${problem}`);
      fail('Nothing was created.');
    }

    if (password.toLowerCase() === email) {
      fail(
        'ADMIN_PASSWORD must not be the same as the email address. ' +
          'Nothing was created.',
      );
    }

    const localPart = email.split('@')[0] ?? '';
    if (localPart.length >= 4 && password.toLowerCase().includes(localPart.toLowerCase())) {
      fail(
        'ADMIN_PASSWORD must not contain the email address. Nothing was created.',
      );
    }

    // ---- 6. Create it -----------------------------------------------------

    // Hash before insert — the plaintext never touches the database or a log.
    const passwordHash = await hashPassword(password);

    await db.insert(admins).values({
      email,
      passwordHash,
      fullName,
      role,
      isActive: true,
      // Required by the specification: force a change on first login.
      mustChangePassword: true,
    });

    const [created] = await db
      .select({ email: admins.email, role: admins.role, createdAt: admins.createdAt })
      .from(admins)
      .where(eq(admins.email, email));

    console.log('[seed:admin] Administrator created successfully.');
    console.log(`  email         : ${created?.email ?? email}`);
    console.log(`  role          : ${created?.role ?? role}`);
    console.log('  password      : (hashed with Argon2id — not displayed)');
    console.log('  first login   : a password change will be required');
    console.log(
      '[seed:admin] Remove ADMIN_PASSWORD from your environment once you have signed in.',
    );
  } finally {
    close();
  }
}

main().catch((error: unknown) => {
  // Only the message is printed. A driver error could, in principle, echo a bound
  // parameter, so the error object is never dumped wholesale.
  console.error(
    '[seed:admin] FAILED:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
