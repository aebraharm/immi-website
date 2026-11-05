import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { ADMIN_ROLES } from './enums';

/**
 * Administrator accounts.
 *
 * There is deliberately NO client/user account table anywhere in this schema:
 * the product has no client portal. The only principals in the system are
 * agency administrators, and every private read path is gated on this table.
 */
export const admins = sqliteTable(
  'admins',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** Stored lowercased + trimmed. Unique so the bootstrap script is idempotent. */
    email: text('email').notNull(),

    /** Argon2id hash. This column is never selected by any list/report query. */
    passwordHash: text('password_hash').notNull(),

    fullName: text('full_name').notNull(),
    role: text('role', { enum: ADMIN_ROLES }).notNull().default('admin'),

    /** Deactivate instead of delete, so audit history keeps its actor. */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    /** Forced password change on first login (required by spec). */
    mustChangePassword: integer('must_change_password', { mode: 'boolean' })
      .notNull()
      .default(true),
    passwordChangedAt: integer('password_changed_at', { mode: 'timestamp_ms' }),

    /** Brute-force protection. */
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp_ms' }),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('admins_email_unique').on(table.email),
    index('admins_is_active_idx').on(table.isActive),
  ],
);

/**
 * Database-backed admin sessions.
 *
 * The cookie carries an opaque random token; only its SHA-256 digest is stored
 * here. A database leak therefore does not hand an attacker a usable session.
 * Revocation is a row update, so it takes effect immediately everywhere.
 */
export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    adminId: text('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),

    /** SHA-256 hex of the cookie token. Unique + indexed for O(1) lookup. */
    tokenHash: text('token_hash').notNull(),

    /** Per-session CSRF material; the browser never sees this value. */
    csrfSecret: text('csrf_secret').notNull(),

    /** SHA-256 of the client IP — enough to correlate abuse, not to identify. */
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),

    /** Absolute expiry. */
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),

    /** Sliding idle timeout bookkeeping. */
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),

    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('admin_sessions_token_hash_unique').on(table.tokenHash),
    index('admin_sessions_admin_id_idx').on(table.adminId),
    index('admin_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * Admin-only password reset tokens. (No client password recovery exists.)
 */
export const adminPasswordResets = sqliteTable(
  'admin_password_resets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    adminId: text('admin_id')
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),

    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('admin_password_resets_token_hash_unique').on(table.tokenHash),
    index('admin_password_resets_admin_id_idx').on(table.adminId),
  ],
);

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
