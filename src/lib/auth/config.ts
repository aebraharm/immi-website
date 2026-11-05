/**
 * Authentication configuration.
 *
 * All tunables in one place so the session and rate-limiting policies are
 * auditable at a glance rather than scattered as magic numbers through the code.
 */

/** Cookie carrying the opaque session token. */
export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? 'immi_admin_session';

/** CSRF cookie: readable by JS so the client can echo it back as a header. */
export const CSRF_COOKIE_NAME = 'immi_csrf';

/**
 * Absolute session lifetime — a session dies this long after login regardless of
 * activity. 8 hours covers a working day without leaving a session valid
 * overnight.
 */
export const SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Idle timeout — a session also dies after this long with no request. 30 minutes
 * bounds the damage from an unattended browser.
 */
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;

/**
 * How often the sliding idle timer is written back to the database. Updating
 * `last_seen_at` on every single request would add a write per page view for no
 * security benefit.
 */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Login rate limiting                                                        */
/* -------------------------------------------------------------------------- */

/** Attempts allowed per IP within the window before lockout. */
export const LOGIN_MAX_ATTEMPTS_PER_IP = 5;

/** Attempts allowed per account within the window before lockout. */
export const LOGIN_MAX_ATTEMPTS_PER_EMAIL = 5;

/** Rolling window for counting failed attempts. */
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Progressive lockout.
 *
 * `LOGIN_LOCKOUT_LADDER_MS[0]` is the ordinary handling time once the window limit
 * is reached: the caller waits for the *sliding window* to move on, so five failed
 * attempts cost an attacker a quarter of an hour, and a genuine user who mistyped
 * gets back in shortly after. Only *deliberate* continuation beyond the limit
 * escalates to the longer rungs, and a single success clears the record.
 *
 * Laddering on the raw failure count instead would have made this harsher than
 * intended: the count includes the blocked attempts themselves, so an automated
 * client would jump to the 4-hour rung within seconds.
 */
export const LOGIN_LOCKOUT_LADDER_MS = [
  15 * 60 * 1000, // 15 minutes — the normal window, not a penalty box
  30 * 60 * 1000, // 30 minutes — after 10 failures in the window
  60 * 60 * 1000, // 1 hour   — after 15
  4 * 60 * 60 * 1000, // 4 hours — after 20 (see LOGIN_HARD_LOCK_THRESHOLD)
] as const;

/** Failures tolerated at each ladder rung before moving to the next. */
export const LOGIN_LOCKOUT_STEP = 5;

/**
 * After this many failed attempts the account is locked outright until an
 * administrator intervenes — this is the terminal rung of the ladder.
 */
export const LOGIN_HARD_LOCK_THRESHOLD = 20;

/* -------------------------------------------------------------------------- */
/* Generic endpoint rate limiting                                             */
/* -------------------------------------------------------------------------- */

export const RATE_LIMITS = {
  /** Password change while signed in. */
  passwordChange: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Any other authenticated mutation. */
  adminMutation: { limit: 120, windowMs: 60 * 1000 },
} as const;

/* -------------------------------------------------------------------------- */
/* Password policy additions for authenticated self-service                  */
/* -------------------------------------------------------------------------- */

/**
 * Salts checked against new passwords. Deliberately short: a full breach corpus
 * would be megabytes and belongs in a service, not a repository. These catch the
 * passwords an operator actually types when testing.
 */
export const COMMON_PASSWORD_DENYLIST = [
  'password',
  'password1',
  'password123',
  'passw0rd',
  'admin',
  'administrator',
  'letmein',
  'welcome',
  'welcome1',
  'qwerty',
  'qwerty123',
  'iloveyou',
  'monkey',
  'dragon',
  'changeme',
  'test1234',
  'abc12345',
  '123456789',
  '1234567890',
] as const;
