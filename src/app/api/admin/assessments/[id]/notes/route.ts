import type { NextResponse } from 'next/server';

import { addNoteHandler } from '@/lib/assessment/admin-handlers';

/** POST /api/admin/assessments/[id]/notes — add an internal note. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return addNoteHandler(request, context);
}
