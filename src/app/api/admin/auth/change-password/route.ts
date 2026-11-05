import { NextResponse } from 'next/server';
import { z } from 'zod';

import { changePassword } from '@/lib/auth/password-change';
import {
  CsrfError,
  assertCsrf,
  requireAdminApi,
  UnauthorizedError,
} from '@/lib/auth/guard';
import { RATE_LIMITS } from '@/lib/auth/config';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { clientIpHash } from '@/lib/auth/session';
import { rateLimitKey } from '@/lib/auth/crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/auth/change-password
 *
 * Requires: a valid session, a valid CSRF token, the correct current password,
 * and a new password that passes policy. On success every *other* session is
 * revoked and the forced-change flag is cleared.
 */

const schema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

export async function POST(request: Request): Promise<NextResponse> {
  let admin;
  try {
    admin = await requireAdminApi();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw error;
  }

  // CSRF first: never touch business logic for a cross-site request.
  try {
    await assertCsrf(request, admin);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: 'csrf_failed' }, { status: 403 });
    }
    throw error;
  }

  // Throttle: this endpoint verifies a password, so it is an oracle.
  const limit = await consumeRateLimit({
    key: rateLimitKey('password-change', admin.adminId),
    limit: RATE_LIMITS.passwordChange.limit,
    windowMs: RATE_LIMITS.passwordChange.windowMs,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const outcome = await changePassword({
    adminId: admin.adminId,
    email: admin.email,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    currentSessionId: admin.sessionId,
    ipHash: clientIpHash(request.headers),
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, messages: outcome.messages },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
