import { getDb } from '@/db';
import { activityLogs } from '@/db/schema/operations';
import type { ActivityAction } from '@/db/schema/enums';

/**
 * Audit logging.
 *
 * Every state-changing administrator action writes one row. Two rules make this
 * safe to call from anywhere:
 *
 *  1. It NEVER throws. A failed audit insert must not break the operation the
 *     administrator was performing, and must not leak into an HTTP response.
 *  2. It never records sensitive values. `metadata` is limited to field names,
 *     status transitions and counts — no applicant data, no passwords, no
 *     document contents.
 */

export type AuditEvent = {
  action: ActivityAction;
  actorAdminId?: string | null;
  actorEmail?: string | null;
  entityType?: string;
  entityId?: string;
  summary?: string;
  /** Already-sanitised object. Keep it to non-sensitive primitives. */
  metadata?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
};

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    const db = getDb();
    await db.insert(activityLogs).values({
      action: event.action,
      actorAdminId: event.actorAdminId ?? null,
      actorEmailSnapshot: event.actorEmail ?? null,
      entityType: event.entityType ?? '',
      entityId: event.entityId ?? '',
      summary: event.summary ?? '',
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      ipHash: event.ipHash ?? null,
    });
  } catch (error) {
    // Deliberately swallowed. The audit trail must never break a login or a
    // save. In production only the event name is logged — never the contents.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[audit] failed to write log', event.action, error);
    } else {
      console.error('[audit] failed to write log', { action: event.action });
    }
  }
}
