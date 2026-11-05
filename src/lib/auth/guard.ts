import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { AdminRole } from '@/db/schema/enums';

import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  getSessionCsrfSecret,
  isValidCsrfToken,
  resolveSession,
  type AuthenticatedAdmin,
} from './session';

/**
 * Server-side authorisation guards.
 *
 * These are the real security boundary. Middleware only checks that a cookie
 * *exists*, which is trivially spoofable — every admin page, server action and
 * API route must call one of these, and each one re-verifies the session against
 * the database on every request.
 */

/** Re-exported so callers can type a guard result without reaching past this module. */
export type { AuthenticatedAdmin };

export class UnauthorizedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Not permitted') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class CsrfError extends Error {
  constructor() {
    super('Invalid or missing CSRF token');
    this.name = 'CsrfError';
  }
}

/** Resolve the current administrator, or null. Never throws. */
export async function getCurrentAdmin(): Promise<AuthenticatedAdmin | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return resolveSession(token);
}

/**
 * Page guard: redirect to the login page when unauthenticated.
 *
 * If the administrator still has a forced password change pending, they are sent
 * to the change-password screen — EXCEPT when they are already on it, which the
 * caller signals with `allowPendingPasswordChange`.
 */
export async function requireAdminPage(options?: {
  /** Route the user was trying to reach, preserved through login. */
  returnTo?: string;
  allowPendingPasswordChange?: boolean;
}): Promise<AuthenticatedAdmin> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    const target = options?.returnTo
      ? `/admin/login?next=${encodeURIComponent(options.returnTo)}`
      : '/admin/login';
    redirect(target);
  }

  if (admin.mustChangePassword && !options?.allowPendingPasswordChange) {
    redirect('/admin/change-password');
  }

  return admin;
}

/** API guard: throws instead of redirecting, so routes can return a status code. */
export async function requireAdminApi(): Promise<AuthenticatedAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}

/**
 * Role check.
 *
 * Sensitive capabilities are gated on role even though Phase 3 only creates an
 * owner: an `editor` must never reach assessment data, and building that into the
 * guard now means Phase 6 cannot accidentally widen access.
 */
export function hasRole(admin: AuthenticatedAdmin, allowed: readonly AdminRole[]): boolean {
  return allowed.includes(admin.role);
}

export function requireRole(
  admin: AuthenticatedAdmin,
  allowed: readonly AdminRole[],
): void {
  if (!hasRole(admin, allowed)) throw new ForbiddenError();
}

/** Roles permitted to read applicant data. */
export const ASSESSMENT_ROLES = ['owner', 'admin'] as const;
/** Roles permitted to change site-wide settings and administrators. */
export const SETTINGS_ROLES = ['owner'] as const;
/** Roles permitted to author content. */
export const CONTENT_ROLES = ['owner', 'admin', 'editor'] as const;

/* -------------------------------------------------------------------------- */
/* CSRF                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Verify the CSRF token for a state-changing request.
 *
 * The token is accepted from a request header (`x-csrf-token`), which is the
 * mechanism used by fetch-based calls. A form-posted `_csrf` field is accepted as
 * a fallback for no-JS submissions.
 *
 * Both the submitted value and the readable cookie must equal the secret stored
 * on the session row.
 */
export async function assertCsrf(request: Request, admin: AuthenticatedAdmin): Promise<void> {
  const store = await cookies();

  // Header only here; the form-body path is `assertCsrfWithFormValue`.
  const submitted = request.headers.get('x-csrf-token');

  const cookieValue = store.get(CSRF_COOKIE_NAME)?.value ?? null;
  const secret = await getSessionCsrfSecret(admin.sessionId);

  if (!secret) throw new CsrfError();

  const valid = isValidCsrfToken({
    submitted,
    cookieValue,
    sessionCsrfSecret: secret,
  });

  if (!valid) throw new CsrfError();
}

/**
 * Variant that additionally accepts a form-body token. Server actions that are
 * invoked from a plain <form> pass the token here.
 */
export async function assertCsrfWithFormValue(
  request: Request,
  admin: AuthenticatedAdmin,
  formValue: string | null,
): Promise<void> {
  const store = await cookies();
  const headerValue = request.headers.get('x-csrf-token');
  const cookieValue = store.get(CSRF_COOKIE_NAME)?.value ?? null;
  const secret = await getSessionCsrfSecret(admin.sessionId);

  if (!secret) throw new CsrfError();

  const valid = isValidCsrfToken({
    submitted: headerValue ?? formValue,
    cookieValue,
    sessionCsrfSecret: secret,
  });

  if (!valid) throw new CsrfError();
}
