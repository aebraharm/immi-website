/**
 * Route handlers for assessment management.
 *
 * Same shape as the CMS handlers, and for the same reason: Next.js needs one
 * file per URL, but the guard order behind them must not be re-typed per file.
 *
 * Every handler below begins with a guard, in this order:
 *
 *   session → role (`ASSESSMENT_ROLES`: owner / admin) → CSRF (writes only)
 *
 * An `editor` is refused on *every* route here, reads included — applicant data
 * is not content. The refusal is a real 403 from the server, not a hidden link.
 *
 * What the handlers never do:
 *
 *  - Return a storage key, a filesystem path or a public URL for a CV.
 *  - Echo an applicant's answers into an error message, a log line or a URL.
 *  - Write applicant text into the audit trail: entries record the reference
 *    number and what kind of event occurred.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { AssessmentStatus } from '@/db/schema/enums';
import { RATE_LIMITS } from '@/lib/auth/config';
import { rateLimitKey } from '@/lib/auth/crypto';
import {
  ASSESSMENT_ROLES,
  hasRole,
  requireAdminApi,
  type AuthenticatedAdmin,
} from '@/lib/auth/guard';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import {
  CmsError,
  auditMutation,
  badRequest,
  errorResponse,
  guardMutation,
  notFound,
  ok,
  parseBody,
  readJson,
} from '@/lib/cms/api';
import { getStorage } from '@/lib/storage';

import {
  ASSESSMENT_DEFAULT_PAGE_SIZE,
  ASSESSMENT_PAGE_SIZES,
  findAttachmentForDownload,
  getAssessmentDetail,
  listAssessments,
  type AssessmentListFilters,
  type AssessmentSortKey,
} from './admin';
import {
  NOTE_MAX_LENGTH,
  addAssessmentNote,
  changeAssessmentStatus,
  deleteAssessmentNote,
  downloadAuditSummary,
} from './manage';
import { isAssessmentStatus, statusLabel } from './status';

/* -------------------------------------------------------------------------- */
/* Guards                                                                     */
/* -------------------------------------------------------------------------- */

/** Any signed-in administrator in a role that may see applicant data. */
async function guardAssessmentRead(): Promise<AuthenticatedAdmin> {
  const admin = await requireAdminApi();
  if (!hasRole(admin, ASSESSMENT_ROLES)) {
    throw new CmsError(
      403,
      'forbidden',
      'Applicant data is restricted to owners and administrators.',
    );
  }
  return admin;
}

/** A write: the same role check, plus the CSRF token. */
function guardAssessmentMutation(request: Request): Promise<AuthenticatedAdmin> {
  return guardMutation(request, ASSESSMENT_ROLES);
}

/** A light per-administrator throttle, matching the CMS write budget. */
async function throttleWrites(adminId: string): Promise<void> {
  const limit = await consumeRateLimit({
    key: rateLimitKey('assessment-write', adminId),
    limit: RATE_LIMITS.adminMutation.limit,
    windowMs: RATE_LIMITS.adminMutation.windowMs,
  });

  if (!limit.allowed) {
    throw new CmsError(
      429,
      'rate_limited',
      'You are saving faster than we can keep up. Please wait a moment.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                    */
/* -------------------------------------------------------------------------- */

const SORTS = new Set<AssessmentSortKey>(['submitted', 'applicant', 'reference', 'status']);

/**
 * Read the inbox filters from the query string.
 *
 * Every value is validated and anything unrecognised is dropped rather than
 * passed through: a `?page=-4` or a `?status=<script>` becomes the default, not a
 * database call.
 */
export function parseListFilters(url: URL): AssessmentListFilters {
  const statusParam = url.searchParams.get('status');
  const status: AssessmentStatus | 'all' =
    statusParam && isAssessmentStatus(statusParam) ? statusParam : 'all';

  const sortParam = url.searchParams.get('sort');
  const sort = sortParam && SORTS.has(sortParam as AssessmentSortKey)
    ? (sortParam as AssessmentSortKey)
    : 'submitted';

  const pageRaw = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(
    url.searchParams.get('pageSize') ?? String(ASSESSMENT_DEFAULT_PAGE_SIZE),
  );
  const pageSize = ASSESSMENT_PAGE_SIZES.includes(
    pageSizeRaw as (typeof ASSESSMENT_PAGE_SIZES)[number],
  )
    ? pageSizeRaw
    : ASSESSMENT_DEFAULT_PAGE_SIZE;

  const direction = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';

  return {
    search: url.searchParams.get('search')?.trim() || undefined,
    status,
    from: url.searchParams.get('from')?.trim() || undefined,
    to: url.searchParams.get('to')?.trim() || undefined,
    sort,
    direction,
    page,
    pageSize,
  };
}

/** GET /api/admin/assessments — one page of the inbox. */
export async function listAssessmentsHandler(request: Request): Promise<NextResponse> {
  try {
    await guardAssessmentRead();
    const result = await listAssessments(parseListFilters(new URL(request.url)));
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

type IdContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/assessments/[id] — one application.
 *
 * The id is a UUID generated by the server; an id that does not exist is a 404.
 * The read is audited as `assessment.viewed` so access to applicant data is
 * itself accountable — the audit row carries the reference number only.
 */
export async function readAssessmentHandler(
  _request: Request,
  context: IdContext,
): Promise<NextResponse> {
  try {
    const admin = await guardAssessmentRead();
    const { id } = await context.params;

    const detail = await getAssessmentDetail(id);
    if (!detail) throw notFound('That application no longer exists.');

    await auditMutation({
      request: _request,
      admin,
      action: 'assessment.viewed',
      entityType: 'assessment',
      entityId: detail.assessment.id,
      summary: `Opened application ${detail.assessment.referenceNumber}`,
    });

    return ok(detail);
  } catch (error) {
    return errorResponse(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

const statusSchema = z.object({
  status: z.string().min(1, 'Choose the new status.'),
  note: z.string().max(500, 'Keep the reason under 500 characters.').optional(),
});

/**
 * POST /api/admin/assessments/[id]/status — change status.
 *
 * The history row is written by `changeAssessmentStatus` in the same
 * transaction as the update; this handler then writes the audit entry. Both
 * record the administrator, the timestamp, and the previous → new status.
 */
export async function changeStatusHandler(
  request: Request,
  context: IdContext,
): Promise<NextResponse> {
  try {
    const admin = await guardAssessmentMutation(request);
    await throttleWrites(admin.adminId);

    const { id } = await context.params;
    const input = await parseBody(statusSchema, await readJson(request));

    if (!isAssessmentStatus(input.status)) {
      throw badRequest('That is not a status this portal recognises.');
    }

    const result = await changeAssessmentStatus({
      assessmentId: id,
      toStatus: input.status,
      adminId: admin.adminId,
      note: input.note,
    });

    await auditMutation({
      request,
      admin,
      action: 'assessment.status_changed',
      entityType: 'assessment',
      entityId: result.id,
      summary: `${result.referenceNumber}: ${statusLabel(result.fromStatus)} → ${statusLabel(result.toStatus)}`,
      // IDs and statuses only — never applicant text.
      metadata: {
        referenceNumber: result.referenceNumber,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
      },
    });

    return ok({
      id: result.id,
      referenceNumber: result.referenceNumber,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      changedAt: result.changedAt.toISOString(),
      label: statusLabel(result.toStatus),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something in the note before saving it.')
    .max(NOTE_MAX_LENGTH, `Keep the note under ${NOTE_MAX_LENGTH} characters.`),
  isPinned: z.boolean().optional(),
});

/** POST /api/admin/assessments/[id]/notes — add an internal note. */
export async function addNoteHandler(
  request: Request,
  context: IdContext,
): Promise<NextResponse> {
  try {
    const admin = await guardAssessmentMutation(request);
    await throttleWrites(admin.adminId);

    const { id } = await context.params;
    const input = await parseBody(noteSchema, await readJson(request));

    const note = await addAssessmentNote({
      assessmentId: id,
      adminId: admin.adminId,
      body: input.body,
      isPinned: input.isPinned,
    });

    await auditMutation({
      request,
      admin,
      action: 'assessment.note_added',
      entityType: 'assessment',
      entityId: id,
      // The note's text is deliberately absent: the audit log must not become a
      // second copy of an applicant's file.
      summary: `Added an internal note to ${note.referenceNumber}`,
      metadata: { referenceNumber: note.referenceNumber, noteId: note.id, pinned: note.isPinned },
    });

    return ok({
      id: note.id,
      body: note.body,
      isPinned: note.isPinned,
      createdAt: note.createdAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

type NoteContext = { params: Promise<{ id: string; noteId: string }> };

/** DELETE /api/admin/assessments/[id]/notes/[noteId] — remove an internal note. */
export async function deleteNoteHandler(
  request: Request,
  context: NoteContext,
): Promise<NextResponse> {
  try {
    const admin = await guardAssessmentMutation(request);
    await throttleWrites(admin.adminId);

    const { id, noteId } = await context.params;
    const { referenceNumber } = await deleteAssessmentNote({ assessmentId: id, noteId });

    await auditMutation({
      request,
      admin,
      action: 'assessment.note_deleted',
      entityType: 'assessment',
      entityId: id,
      summary: `Deleted an internal note on ${referenceNumber}`,
      metadata: { referenceNumber, noteId },
    });

    return ok({ id: noteId });
  } catch (error) {
    return errorResponse(error);
  }
}

/* -------------------------------------------------------------------------- */
/* CV download                                                                */
/* -------------------------------------------------------------------------- */

type AttachmentContext = { params: Promise<{ id: string; attachmentId: string }> };

/** RFC 5987 filename for the download, stripped of anything path-like. */
function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\r\n]/g, ' ')
    .replace(/[/\\]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);

  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * GET /api/admin/assessments/[id]/attachments/[attachmentId] — download a CV.
 *
 * This is the only path by which a private applicant document leaves storage. It
 * is a different route from `/api/media/...` on purpose: that proxy serves public
 * content only, and the two must never be reachable through one another.
 *
 * The order here is the security model:
 *
 *   1. Session, role and (for the audit) the request's identity.
 *   2. Resolve the attachment *by assessment and attachment id together*. A
 *      mismatched pair is a 404 — the same answer as "does not exist" — so the
 *      route cannot be walked to another applicant's file.
 *   3. Refuse anything not stored as private, or archived at the asset level.
 *   4. Write the audit entry, then stream the bytes.
 *
 * The response is `no-store`, `application/octet-stream`-safe, forced as an
 * attachment, and carries a sandboxing CSP so a document can never execute in
 * the portal's origin.
 */
export async function downloadAttachmentHandler(
  request: Request,
  context: AttachmentContext,
): Promise<NextResponse> {
  try {
    const admin = await guardAssessmentRead();
    const { id, attachmentId } = await context.params;

    const attachment = await findAttachmentForDownload(id, attachmentId);
    if (!attachment) throw notFound('That document is not available.');

    if (attachment.isArchived) {
      throw notFound('That document has been archived and is no longer available.');
    }

    const storage = getStorage();
    const object = await storage.get(attachment.storageKey, 'private');

    if (!object) {
      throw notFound(
        'The stored file could not be found. It may have been removed from storage.',
      );
    }

    await auditMutation({
      request,
      admin,
      action: 'assessment.attachment_downloaded',
      entityType: 'assessment',
      entityId: attachment.assessmentId,
      summary: downloadAuditSummary(attachment.referenceNumber, attachment.kind),
      metadata: {
        referenceNumber: attachment.referenceNumber,
        attachmentId: attachment.attachmentId,
        kind: attachment.kind,
      },
    });

    let payload: ArrayBuffer | ReadableStream<Uint8Array>;
    if (object.body instanceof Uint8Array) {
      const copy = new Uint8Array(object.body.byteLength);
      copy.set(object.body);
      payload = copy.buffer;
    } else {
      payload = object.body;
    }

    const filename = safeFilename(
      attachment.originalFilename,
      `${attachment.referenceNumber}-${attachment.kind}.pdf`,
    );

    return new NextResponse(payload as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(object.size),
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        // Applicant documents are never cacheable by a proxy or a shared browser.
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
