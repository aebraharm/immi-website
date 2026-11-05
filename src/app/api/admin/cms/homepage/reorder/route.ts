import { reorderHandler } from '@/lib/cms/handlers';

/**
 * /api/admin/cms/homepage/reorder
 *
 * Accepts the complete new order as an array of ids. The whole list is applied in
 * one transaction, so a half-sorted list is impossible.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = reorderHandler('homepage');
