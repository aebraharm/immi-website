/**
 * Migration runner.
 *
 * Applies the versioned SQL files in `drizzle/` to whatever database
 * `TURSO_DATABASE_URL` points at. Migrations are applied deliberately, by a
 * human or an explicit CI step — never automatically on application start — so
 * a bad migration cannot fire on a cold start in production.
 *
 * Usage:
 *   npm run db:migrate                      # local file db (default)
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run db:migrate
 */

import { config as loadEnv } from 'dotenv';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const DEFAULT_LOCAL_URL = 'file:./.data/local.db';

function redact(url: string): string {
  // Never print a libsql:// URL with any embedded credentials.
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/***`;
  } catch {
    return url;
  }
}

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL ?? DEFAULT_LOCAL_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const isRemote = url.startsWith('libsql://') || url.startsWith('https://');
  if (isRemote && !authToken) {
    throw new Error(
      'TURSO_AUTH_TOKEN is required for a remote database. Refusing to continue.',
    );
  }

  if (url.startsWith('file:')) {
    mkdirSync('.data', { recursive: true });
  }

  console.log(`[migrate] target: ${redact(url)}`);

  const client = createClient(
    authToken ? { url, authToken } : { url },
  );

  // libSQL keeps foreign keys off by default per connection.
  await client.execute('PRAGMA foreign_keys = ON');

  const db = drizzle(client);

  const startedAt = Date.now();
  await migrate(db, { migrationsFolder: './drizzle' });
  const elapsed = Date.now() - startedAt;

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  );

  const foreignKeyCheck = await client.execute('PRAGMA foreign_key_check');
  if (foreignKeyCheck.rows.length > 0) {
    console.error('[migrate] FOREIGN KEY VIOLATIONS FOUND:');
    console.error(foreignKeyCheck.rows);
    process.exitCode = 1;
    return;
  }

  console.log(`[migrate] done in ${elapsed}ms`);
  console.log(`[migrate] tables (${tables.rows.length}):`);
  for (const row of tables.rows) {
    console.log(`  - ${String(row.name)}`);
  }
  console.log('[migrate] PRAGMA foreign_key_check: clean');

  client.close();
}

main().catch((error: unknown) => {
  console.error('[migrate] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
