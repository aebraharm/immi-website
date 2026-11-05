import { restoreHandler } from '@/lib/cms/handlers';

/**
 * /api/admin/cms/team/[id]/restore
 *
 * Brings an archived item back as a draft. Archived items are never published
 * directly, so a restored row cannot reappear on the public site by accident.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = restoreHandler('team');
