import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSiteIdentity } from '@/db/queries';
import { attemptLogin } from '@/lib/auth/service';
import { SESSION_ABSOLUTE_TTL_MS } from '@/lib/auth/config';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  clientIpHash,
  createSession,
  csrfCookieOptions,
  sessionCookieOptions,
} from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/auth/login
 *
 * The only way to obtain an administrator session. There is deliberately no
 * registration endpoint and no way to create an account over HTTP — accounts
 * exist only because an operator ran the offline bootstrap script.
 *
 * Response discipline:
 *  - 401 for every credential problem, with an identical body, so the response
 *    cannot be used to distinguish "no such account" from "wrong password".
 *  - 429 only when rate limited, because the client needs to know to stop.
 *  - 400 for a malformed body, which reveals nothing about accounts.
 */

const loginSchema = z.object({
  email: z.string().trim().min(1).max(254).email(),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Parse and validate. A malformed body cannot reach the database.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // 2. Rate-limit headers are derived from the proxy, never trusted blindly for
  //    anything except counting (we hash rather than store the address).
  const ipHash = clientIpHash(request.headers);

  if (!ipHash) {
    // Without an identifier the limiter cannot work. Refuse rather than allow an
    // unlimited login surface.
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  // 3. Attempt authentication.
  const outcome = await attemptLogin({ email, password, ipHash });

  if (!outcome.ok) {
    if (outcome.reason === 'rate_limited' || outcome.reason === 'account_locked') {
      const retryAfter = outcome.retryAfterSeconds ?? 900;
      return NextResponse.json(
        { error: 'rate_limited', retryAfterSeconds: retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'Cache-Control': 'no-store, max-age=0',
          },
        },
      );
    }

    // invalid_credentials / account_inactive → one indistinguishable response.
    return NextResponse.json(
      { error: 'invalid_credentials' },
      { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  // 4. Issue the session.
  const session = await createSession({
    adminId: outcome.admin.id,
    ipHash,
    userAgent: request.headers.get('user-agent'),
  });

  const store = await cookies();
  const maxAgeSeconds = Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000);

  store.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(maxAgeSeconds));
  store.set(CSRF_COOKIE_NAME, session.csrfToken, csrfCookieOptions(maxAgeSeconds));

  // 5. Warm the identity cache for the shell (non-blocking for correctness).
  void getSiteIdentity();

  return NextResponse.json(
    {
      ok: true,
      mustChangePassword: outcome.admin.mustChangePassword,
      admin: {
        fullName: outcome.admin.fullName,
        role: outcome.admin.role,
      },
    },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

/** Explicitly reject the other verbs so the surface is unambiguous. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
