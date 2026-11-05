import { statusHandler } from '@/lib/cms/handlers';

/**
 * /api/admin/cms/destinations/[id]/status
 *
 * The publish / unpublish switch. Kept on its own endpoint so that saving an edit
 * and publishing it are two distinct, separately auditable actions.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = statusHandler('destinations');
