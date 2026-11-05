import type { NextResponse } from 'next/server';

import { readAssessmentHandler } from '@/lib/assessment/admin-handlers';

/** GET /api/admin/assessments/[id] — one application, for a signed-in administrator. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return readAssessmentHandler(request, context);
}
