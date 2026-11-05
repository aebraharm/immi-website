import type { NextResponse } from 'next/server';

import { changeStatusHandler } from '@/lib/assessment/admin-handlers';

/**
 * POST /api/admin/assessments/[id]/status
 *
 * Body: `{ status, note? }`. Session → role → CSRF, then the status change and
 * its immutable history row are written in one transaction.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return changeStatusHandler(request, context);
}
