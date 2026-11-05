import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

import { getLibsqlClient } from './client';
import * as schema from './schema';

export type Database = LibSQLDatabase<typeof schema>;

declare global {
  var __immiDb: Database | undefined;
}

/**
 * Memoised Drizzle client.
 *
 * Constructed on first use only — importing this module during `next build`
 * does not connect to anything, which is what keeps the production build
 * credential-free.
 */
export function getDb(): Database {
  if (globalThis.__immiDb) {
    return globalThis.__immiDb;
  }

  const db = drizzle(getLibsqlClient(), {
    schema,
    casing: 'snake_case',
  });

  globalThis.__immiDb = db;
  return db;
}

export { schema };
