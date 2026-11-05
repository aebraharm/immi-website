import type { NextResponse } from 'next/server';

import { listAssessmentsHandler } from '@/lib/assessment/admin-handlers';

/**
 * GET /api/admin/assessments
 *
 * The assessment inbox. Session + role are checked inside the handler, so this
 * file cannot be the place where a guard is forgotten.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(request: Request): Promise<NextResponse> {
  return listAssessmentsHandler(request);
}
