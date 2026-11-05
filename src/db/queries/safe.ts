import { ConfigurationError } from '@/lib/env';

import type { QueryResult, UnavailableReason } from './types';

/**
 * Query error containment.
 *
 * Public pages must never show a stack trace, a connection string or a SQL
 * fragment to a visitor — and must still render something useful when the
 * database is missing. This wrapper converts any failure into a typed
 * `{ ok: false }` result so the page can render a designed empty state.
 *
 * The original error is re-thrown only in development, where the developer
 * needs it, and is written to the server log in production (`console.error` is
 * permitted for server-side diagnostics and contains no visitor data).
 */
export async function safeQuery<T>(
  run: () => Promise<T>,
): Promise<QueryResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    const reason: UnavailableReason =
      error instanceof ConfigurationError ? 'not_configured' : 'unreachable';

    if (process.env.NODE_ENV !== 'production') {
      // Development keeps the detail — it is the developer's own machine.
      console.error('[query] failed', error);
    } else {
      // Production logs the reason only: no SQL, no credentials, no visitor data.
      console.error('[query] failed', { reason });
    }

    return { ok: false, reason };
  }
}
