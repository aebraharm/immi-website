import { collectionHandlers } from '@/lib/cms/handlers';

/**
 * /api/admin/cms/team
 *
 * Authentication, role and CSRF checks live in `lib/cms/handlers.ts`, which is
 * the single place those three steps are performed. This file only binds the
 * handlers to the resource.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handlers = collectionHandlers('team');

export const GET = handlers.GET;
export const POST = handlers.POST;
