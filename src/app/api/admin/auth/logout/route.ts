import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { writeAuditLog } from '@/lib/auth/audit';
import { getCurrentAdmin } from '@/lib/auth/guard';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  clientIpHash,
  revokeSession,
} from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/auth/logout
 *
 * Revokes the current session row and clears both cookies. Revocation in the
 * database — not just deleting the cookie — is what makes this a real logout: a
 * copied cookie value stops working immediately, everywhere.
 *
 * POST only, so a link or image on another site cannot sign the administrator
 * out (a nuisance CSRF). CSRF is enforced by requiring the session's token, but
 * logout is deliberately tolerant: if the session is already invalid we still
 * clear the cookies and report success.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const store = await cookies();
  const admin = await getCurrentAdmin();

  if (admin) {
    await revokeSession(admin.sessionId);
    await writeAuditLog({
      action: 'admin.logout',
      actorAdminId: admin.adminId,
      actorEmail: admin.email,
      summary: 'Signed out',
      ipHash: clientIpHash(request.headers),
    });
  }

  store.delete(SESSION_COOKIE_NAME);
  store.delete(CSRF_COOKIE_NAME);

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
