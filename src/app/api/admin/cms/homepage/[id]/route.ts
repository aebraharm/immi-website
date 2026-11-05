import { itemHandlers } from '@/lib/cms/handlers';

/**
 * /api/admin/cms/homepage/[id]
 *
 * GET reads one item, PUT replaces it, DELETE archives it (or, with
 * `?mode=delete`, removes it where the schema allows a hard delete).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handlers = itemHandlers('homepage');

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
