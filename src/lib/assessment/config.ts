/**
 * Public assessment endpoint limits.
 *
 * These are deliberately separate from `lib/auth/config.ts`: administrator limits
 * protect the portal, these protect the agency's database and inbox from an
 * anonymous visitor (or a script) deciding to submit a hundred applications.
 *
 * The submission limit is per *hashed* IP — the raw address is never stored,
 * here or anywhere else in the application.
 */

export const ASSESSMENT_RATE_LIMITS = {
  /**
   * Submissions per IP.
   *
   * A real applicant submits once, occasionally twice after a genuine mistake.
   * Five per hour leaves room for that and still makes scripted abuse pointless.
   */
  submission: { limit: 5, windowMs: 60 * 60 * 1000 },

  /**
   * Validation failures per IP.
   *
   * A visitor correcting typos will trip this a handful of times; a script
   * probing the schema will not. Kept separate from `submission` so that a run of
   * rejected forms cannot lock out the successful submission that follows.
   */
  failedAttempt: { limit: 20, windowMs: 15 * 60 * 1000 },
} as const;

/** Hard ceiling for a whole submission request, before the body is read. */
export const MAX_SUBMISSION_REQUEST_BYTES = 12 * 1024 * 1024;

/** Header carrying the client-generated idempotency key. */
export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

/** How long a duplicate check looks back for an identical submission. */
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
