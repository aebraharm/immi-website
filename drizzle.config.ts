import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration.
 *
 * `db:generate` only reads the TypeScript schema and emits SQL — it never
 * connects to a database, so it works with no credentials present.
 *
 * `db:migrate` / `db:studio` DO connect. They are pointed at Turso when the
 * environment provides credentials, and at a local throwaway libSQL file
 * otherwise, so development never requires production secrets.
 */
const url = process.env.TURSO_DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'turso',
  casing: 'snake_case',
  dbCredentials: authToken ? { url, authToken } : { url },
  verbose: true,
  strict: true,
});
