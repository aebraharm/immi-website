import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import { admins } from './auth';
import { ACTIVITY_ACTIONS } from './enums';

/**
 * Administrative audit trail.
 *
 * Every state-changing administrator operation writes one row. `metadata` holds
 * a small, sanitised JSON object (field names that changed, old/new status) and
 * must never contain applicant content, passwords or document contents.
 *
 * `actorEmailSnapshot` preserves attribution even if the administrator account
 * is later deleted (`actorAdminId` becomes NULL).
 */
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    actorAdminId: text('actor_admin_id').references(() => admins.id, {
      onDelete: 'set null',
    }),
    actorEmailSnapshot: text('actor_email_snapshot'),

    action: text('action', { enum: ACTIVITY_ACTIONS }).notNull(),

    entityType: text('entity_type').notNull().default(''),
    entityId: text('entity_id').notNull().default(''),

    /** Short human-readable summary — contains no sensitive field values. */
    summary: text('summary').notNull().default(''),

    /** Sanitised JSON: changed field names, status transitions, file sizes. */
    metadata: text('metadata'),

    /** SHA-256 of the actor IP. */
    ipHash: text('ip_hash'),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('activity_logs_created_at_idx').on(table.createdAt),
    index('activity_logs_entity_idx').on(table.entityType, table.entityId),
    index('activity_logs_actor_idx').on(table.actorAdminId),
    index('activity_logs_action_idx').on(table.action),
  ],
);

/**
 * Login attempt ledger — the durable half of login rate limiting.
 *
 * Netlify functions are short-lived and horizontally scaled, so an in-memory
 * counter alone would be trivially bypassed. Every attempt is recorded here and
 * the limiter counts rows in a rolling window.
 */
export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** SHA-256 of the submitted email — never the raw address. */
    emailHash: text('email_hash').notNull(),
    ipHash: text('ip_hash').notNull(),

    success: integer('success', { mode: 'boolean' }).notNull(),
    /** Machine-readable reason for a rejection, e.g. `bad_password`. */
    reason: text('reason').notNull().default(''),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index('login_attempts_ip_created_idx').on(table.ipHash, table.createdAt),
    index('login_attempts_email_created_idx').on(table.emailHash, table.createdAt),
  ],
);

/**
 * Generic fixed-window rate limiter.
 *
 * Used for public endpoints (assessment submission, uploads) where a lost count
 * would mean lost protection. One row per (key, window).
 */
export const rateLimitBuckets = sqliteTable(
  'rate_limit_buckets',
  {
    /** e.g. `assessment:ip:<sha256>` — composite so one upsert covers all. */
    key: text('key').primaryKey(),

    count: integer('count').notNull().default(0),

    /** Start of the current window, unix ms. */
    windowStart: integer('window_start').notNull(),

    /** After this instant the row may be deleted by the sweeper. */
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('rate_limit_buckets_expires_idx').on(table.expiresAt)],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
