/**
 * Destination seeding.
 *
 * Creates the five destinations named in the requirements as **drafts**
 * containing ONLY the country name and ISO code. Every descriptive field —
 * summary, requirements, visa categories, processing information, opportunities
 * — is left empty, because inventing immigration facts would be both
 * misleading and potentially harmful to applicants.
 *
 * Idempotent: existing countries are skipped, never overwritten.
 *
 * Usage:
 *   npm run seed:destinations
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { mkdirSync } from 'node:fs';

import { countries } from '../src/db/schema/destinations';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const REQUIRED_COUNTRIES = [
  { name: 'United States of America', isoCode: 'US', slug: 'united-states', order: 1 },
  { name: 'Canada', isoCode: 'CA', slug: 'canada', order: 2 },
  { name: 'United Kingdom', isoCode: 'GB', slug: 'united-kingdom', order: 3 },
  { name: 'Luxembourg', isoCode: 'LU', slug: 'luxembourg', order: 4 },
  { name: 'Australia', isoCode: 'AU', slug: 'australia', order: 5 },
] as const;

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL ?? 'file:./.data/local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url.startsWith('file:')) {
    mkdirSync('.data', { recursive: true });
  }

  const client = createClient(authToken ? { url, authToken } : { url });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client);

  const tableCheck = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='countries'",
  );
  if (tableCheck.rows.length === 0) {
    console.error(
      '[seed:destinations] The `countries` table does not exist. Run `npm run db:migrate` first.',
    );
    client.close();
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const country of REQUIRED_COUNTRIES) {
    const existing = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.isoCode, country.isoCode));

    if (existing.length > 0) {
      console.log(`  skip   ${country.name} (already present)`);
      skipped += 1;
      continue;
    }

    await db.insert(countries).values({
      name: country.name,
      isoCode: country.isoCode,
      slug: country.slug,
      displayOrder: country.order,
      // Draft: nothing appears publicly until an administrator publishes it.
      status: 'draft',
      // Intentionally empty — no fabricated content.
      summary: '',
      descriptionMd: '',
      flagEmoji: '',
    });

    console.log(`  create ${country.name} [${country.isoCode}] (draft, content empty)`);
    created += 1;
  }

  console.log(
    `[seed:destinations] done — ${created} created, ${skipped} skipped. ` +
      'All descriptive content must be added from the admin portal.',
  );

  client.close();
}

main().catch((error: unknown) => {
  console.error(
    '[seed:destinations] FAILED:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
