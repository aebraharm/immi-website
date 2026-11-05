import type { NextResponse } from 'next/server';

import { deleteNoteHandler } from '@/lib/assessment/admin-handlers';

/** DELETE /api/admin/assessments/[id]/notes/[noteId] — remove an internal note. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
): Promise<NextResponse> {
  return deleteNoteHandler(request, context);
}
