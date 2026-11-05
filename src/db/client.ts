import { createClient, type Client } from '@libsql/client';

import { serverEnv } from '@/lib/env';

/**
 * libSQL / Turso connection factory.
 *
 * The client is created lazily and memoised per process, so the production
 * build never opens a socket and a missing credential surfaces as a specific
 * ConfigurationError at the moment a page actually needs data — not at import.
 */

declare global {
  var __immiLibsqlClient: Client | undefined;
}

export function getLibsqlClient(): Client {
  if (globalThis.__immiLibsqlClient) {
    return globalThis.__immiLibsqlClient;
  }

  const env = serverEnv();

  const client = createClient(
    env.TURSO_AUTH_TOKEN
      ? { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN }
      : { url: env.TURSO_DATABASE_URL },
  );

  globalThis.__immiLibsqlClient = client;
  return client;
}

/**
 * Turso/libSQL enforces foreign keys off by default per connection, so every
 * connection this app opens enables them explicitly. Called by the migration
 * runner and by the health check.
 */
export async function assertForeignKeyEnforcement(
  client: Client = getLibsqlClient(),
): Promise<void> {
  await client.execute('PRAGMA foreign_keys = ON');
}
