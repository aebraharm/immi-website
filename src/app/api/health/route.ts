import { NextResponse } from 'next/server';

import { getLibsqlClient } from '@/db/client';
import { isDatabaseConfigured } from '@/lib/env';

/**
 * Health endpoint.
 *
 * Reports whether the deployment is wired up, without ever leaking a secret or
 * an internal error message. Useful as a Netlify deploy check.
 *
 *   GET /api/health
 *   -> { status, database, storage, timestamp }
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  const databaseConfigured = isDatabaseConfigured();
  const storageDriver = process.env.STORAGE_DRIVER ?? 'local';

  let database: 'ok' | 'not_configured' | 'unreachable' = 'not_configured';

  if (databaseConfigured) {
    try {
      // A trivial, read-only round trip that proves credentials work.
      const client = getLibsqlClient();
      await client.execute('SELECT 1 AS ok');
      database = 'ok';
    } catch {
      // Deliberately opaque: an internal database error is never surfaced.
      database = 'unreachable';
    }
  }

  const healthy = database === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      storage: storageDriver,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
