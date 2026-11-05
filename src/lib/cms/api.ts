/**
 * CMS request plumbing.
 *
 * Every CMS endpoint goes through the same three steps, in this order:
 *
 *   1. **Session** — `requireAdminApi()` resolves the session against the
 *      database. Unauthenticated → 401.
 *   2. **Role** — the caller's role is checked against what the resource
 *      requires. SEO overrides and site settings are restricted to owners for
 *      reads as well as writes.
 *   3. **CSRF** — the double-submit token is verified against the session row
 *      before any write happens. Failure → 403.
 *
 * Only then is the body parsed. Doing it in this order means an unauthenticated
 * or cross-site request never reaches validation code, so there is no path where
 * a forged request can learn anything about the schema.
 *
 * The helpers below exist so a route file is short enough to read in one screen
 * and cannot accidentally forget one of the three steps.
 */

import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

import type { AdminRole } from '@/db/schema/enums';
import { RATE_LIMITS } from '@/lib/auth/config';
import { rateLimitKey } from '@/lib/auth/crypto';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { writeAuditLog } from '@/lib/auth/audit';
import {
  CsrfError,
  ForbiddenError,
  UnauthorizedError,
  assertCsrf,
  requireAdminApi,
  requireRole,
  type AuthenticatedAdmin,
} from '@/lib/auth/guard';
import { clientIpHash } from '@/lib/auth/session';

/** A failure the caller should see, with a message written for a human. */
export class CmsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'CmsError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function badRequest(message: string, fieldErrors?: Record<string, string[]>) {
  return new CmsError(400, 'invalid_request', message, fieldErrors);
}

export function notFound(message = 'That item no longer exists.') {
  return new CmsError(404, 'not_found', message);
}

export function conflict(message: string) {
  return new CmsError(409, 'conflict', message);
}

/** Turn a Zod failure into per-field messages the form can place inline. */
function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_form';
    const bucket = result[path] ?? [];
    if (!bucket.includes(issue.message)) bucket.push(issue.message);
    result[path] = bucket;
  }
  return result;
}

/** Map any thrown value to an HTTP response without leaking internals. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof CmsError) {
    return NextResponse.json(
      { error: error.code, message: error.message, fieldErrors: error.fieldErrors },
      { status: error.status, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Your role does not allow this action.' },
      { status: 403 },
    );
  }

  if (error instanceof CsrfError) {
    return NextResponse.json(
      {
        error: 'csrf_failed',
        message: 'Your session could not be verified. Reload the page and try again.',
      },
      { status: 403 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        message: 'Please correct the highlighted fields.',
        fieldErrors: zodFieldErrors(error),
      },
      { status: 400 },
    );
  }

  // Anything else is ours to fix, not the administrator's to read.
  console.error('[cms] unhandled error', error instanceof Error ? error.message : 'unknown');
  return NextResponse.json(
    { error: 'server_error', message: 'Something went wrong on our side. Please try again.' },
    { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export function ok<T>(data: T): NextResponse {
  return NextResponse.json(
    { ok: true, data },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

/**
 * Guard a mutating CMS endpoint.
 *
 * `roles` is the set permitted to perform this particular write. Read guards
 * have their own per-resource role sets; SEO and site settings are owner-only.
 */
export async function guardMutation(
  request: Request,
  roles: readonly AdminRole[],
): Promise<AuthenticatedAdmin> {
  const admin = await requireAdminApi();
  requireRole(admin, roles);
  await assertCsrf(request, admin);
  return admin;
}

/** Guard a read endpoint; callers may narrow the default CMS reader roles. */
export async function guardRead(
  roles: readonly AdminRole[] = ['owner', 'admin', 'editor'],
): Promise<AuthenticatedAdmin> {
  const admin = await requireAdminApi();
  requireRole(admin, roles);
  return admin;
}

/** Apply the shared durable throttle to every authenticated CMS mutation. */
export async function throttleCmsMutation(adminId: string): Promise<void> {
  const limit = await consumeRateLimit({
    key: rateLimitKey('cms-write', adminId),
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

/** Parse a JSON body, mapping malformed JSON to a 400 rather than a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest('The request body could not be read.');
  }
}

/** Parse and validate in one step, with a consistent error shape. */
export async function parseBody<T>(schema: ZodType<T>, body: unknown): Promise<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new CmsError(
      400,
      'invalid_request',
      'Please correct the highlighted fields.',
      zodFieldErrors(result.error),
    );
  }
  return result.data;
}

/**
 * Write an audit row for a CMS change.
 *
 * Deliberately records *what kind of thing changed and its id*, never the
 * content that was edited: the audit trail must not become a second, easier
 * copy of unpublished or applicant data.
 */
export async function auditMutation(params: {
  request: Request;
  admin: AuthenticatedAdmin;
  action:
    | 'content.created'
    | 'content.updated'
    | 'content.published'
    | 'content.unpublished'
    | 'content.archived'
    | 'content.deleted'
    | 'media.uploaded'
    | 'media.archived'
    | 'media.deleted'
    | 'settings.updated'
    // Phase 6 — assessment management. These verbs already exist in
    // `ACTIVITY_ACTIONS` (and therefore in the database's type vocabulary), so
    // enabling them here is a code change only; there is no CHECK constraint on
    // `activity_logs.action` and no migration is involved.
    //
    // `assessment.deleted` is deliberately *not* enabled: the portal has no way
    // to delete an application, and "Closed" is how a record leaves the working
    // queue. An unused verb in this union would imply a capability that does not
    // exist.
    | 'assessment.viewed'
    | 'assessment.status_changed'
    | 'assessment.note_added'
    | 'assessment.note_deleted'
    | 'assessment.attachment_downloaded';
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await writeAuditLog({
    action: params.action,
    actorAdminId: params.admin.adminId,
    actorEmail: params.admin.email,
    entityType: params.entityType,
    entityId: params.entityId,
    summary: params.summary,
    metadata: params.metadata,
    ipHash: clientIpHash(params.request.headers),
  });
}
