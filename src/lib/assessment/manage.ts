/**
 * Assessment management operations.
 *
 * Three writes exist, and each is deliberately narrow:
 *
 *   1. **Change status** — writes the assessment row *and* an immutable
 *      `assessment_status_history` row in one transaction. The history row is
 *      appended, never updated, so "who moved this, when, from what to what" is
 *      answerable for the life of the record. A no-op change is refused rather
 *      than recorded, so the trail never contains a fake event.
 *   2. **Add a note** — internal only. There is no public read path for notes,
 *      and the audit entry records that a note was added without copying its
 *      text.
 *   3. **Delete a note** — the only destructive operation here, and it is
 *      confirmed in the interface before it is called.
 *
 * Neither the audit trail nor the status history ever stores applicant content:
 * they store *that* something happened to a reference number.
 */

import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import type { AssessmentStatus } from '@/db/schema/enums';
import {
  assessmentNotes,
  assessmentStatusHistory,
  assessments,
} from '@/db/schema/assessments';

import { conflict, notFound } from '@/lib/cms/api';

import { isAssessmentStatus, statusLabel } from './status';

export type StatusChangeResult = {
  id: string;
  referenceNumber: string;
  fromStatus: AssessmentStatus;
  toStatus: AssessmentStatus;
  changedAt: Date;
};

/**
 * Move an application to a new status.
 *
 * Returns the previous and new value so the caller can write an accurate audit
 * summary and the interface can confirm exactly what changed.
 *
 * Throws:
 *  - `notFound()` when the assessment does not exist.
 *  - `conflict()` when the requested status is the current one, with a sentence
 *    that tells the administrator nothing happened (rather than a silent no-op
 *    that looks like a successful save).
 */
export async function changeAssessmentStatus(params: {
  assessmentId: string;
  toStatus: string;
  adminId: string;
  note?: string;
}): Promise<StatusChangeResult> {
  const { assessmentId, toStatus, adminId } = params;
  const note = (params.note ?? '').trim().slice(0, 500);

  if (!isAssessmentStatus(toStatus)) {
    throw conflict('That is not a status this portal recognises.');
  }

  const db = getDb();

  const [current] = await db
    .select({
      id: assessments.id,
      referenceNumber: assessments.referenceNumber,
      status: assessments.status,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!current) throw notFound('That application no longer exists.');

  const fromStatus = current.status as AssessmentStatus;

  if (fromStatus === toStatus) {
    throw conflict(
      `This application is already marked ${statusLabel(toStatus)}. Nothing was changed.`,
    );
  }

  const changedAt = new Date();

  // One transaction: the status and its history row land together or not at all,
  // so the trail can never be missing the change it describes.
  await db.transaction(async (tx) => {
    await tx
      .update(assessments)
      .set({
        status: toStatus,
        updatedAt: changedAt,
        // `reviewedAt` marks the first moment a human concluded the assessment.
        // `reviewed` and `closed` both count; moving back to an earlier status
        // deliberately does not erase it.
        ...(toStatus === 'reviewed' || toStatus === 'closed'
          ? { reviewedAt: changedAt, reviewedBy: adminId }
          : {}),
      })
      .where(eq(assessments.id, assessmentId));

    await tx.insert(assessmentStatusHistory).values({
      assessmentId,
      fromStatus,
      toStatus,
      adminId,
      note,
      createdAt: changedAt,
    });
  });

  return {
    id: current.id,
    referenceNumber: current.referenceNumber,
    fromStatus,
    toStatus,
    changedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export const NOTE_MAX_LENGTH = 4000;

export type NoteRecord = {
  id: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
};

/** Confirm an application exists before touching its children. */
async function requireAssessment(assessmentId: string): Promise<{ referenceNumber: string }> {
  const db = getDb();
  const [row] = await db
    .select({ referenceNumber: assessments.referenceNumber })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!row) throw notFound('That application no longer exists.');
  return row;
}

/** Add an internal note. Trimmed, length-capped, and never empty. */
export async function addAssessmentNote(params: {
  assessmentId: string;
  adminId: string;
  body: string;
  isPinned?: boolean;
}): Promise<NoteRecord & { referenceNumber: string }> {
  const body = params.body.trim();

  if (body.length === 0) {
    throw conflict('Write something in the note before saving it.');
  }

  const { referenceNumber } = await requireAssessment(params.assessmentId);

  const [row] = await getDb()
    .insert(assessmentNotes)
    .values({
      assessmentId: params.assessmentId,
      adminId: params.adminId,
      body: body.slice(0, NOTE_MAX_LENGTH),
      isPinned: params.isPinned ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({
      id: assessmentNotes.id,
      body: assessmentNotes.body,
      isPinned: assessmentNotes.isPinned,
      createdAt: assessmentNotes.createdAt,
    });

  if (!row) throw new Error('Note insert returned no row.');

  return { ...row, referenceNumber };
}

/**
 * Delete an internal note.
 *
 * Scoped by assessment *and* note id: a note id from another application cannot
 * be deleted by mixing it into this URL.
 */
export async function deleteAssessmentNote(params: {
  assessmentId: string;
  noteId: string;
}): Promise<{ referenceNumber: string }> {
  const { referenceNumber } = await requireAssessment(params.assessmentId);

  const db = getDb();

  const [existing] = await db
    .select({ id: assessmentNotes.id })
    .from(assessmentNotes)
    .where(
      and(
        eq(assessmentNotes.id, params.noteId),
        eq(assessmentNotes.assessmentId, params.assessmentId),
      ),
    )
    .limit(1);

  if (!existing) throw notFound('That note no longer exists.');

  await db.delete(assessmentNotes).where(eq(assessmentNotes.id, params.noteId));

  return { referenceNumber };
}

/**
 * Record that a CV was downloaded.
 *
 * Written *before* the bytes are streamed, so a download that the client aborts
 * half-way is still accounted for. The audit row names the reference number and
 * the attachment id — never the filename the applicant chose, which can itself
 * contain personal information.
 */
export function downloadAuditSummary(referenceNumber: string, kind: string): string {
  return `Downloaded ${kind.toUpperCase()} for ${referenceNumber}`;
}

/** Unix seconds → ms, for the rare place a driver hands back a number. */
export function asDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value * 1000);
}

/** Total internal notes for an application, used by the list badge. */
export async function countNotes(assessmentId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(assessmentNotes)
    .where(eq(assessmentNotes.assessmentId, assessmentId));
  return Number(row?.value ?? 0);
}
