import type { NextResponse } from 'next/server';

import { downloadAttachmentHandler } from '@/lib/assessment/admin-handlers';

/**
 * GET /api/admin/assessments/[id]/attachments/[attachmentId]
 *
 * The only route that serves a private applicant document. It is intentionally
 * outside `/api/media/...`, which serves public content only.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
): Promise<NextResponse> {
  return downloadAttachmentHandler(request, context);
}
