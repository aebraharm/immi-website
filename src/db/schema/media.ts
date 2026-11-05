import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { admins } from './auth';
import { MEDIA_PURPOSES, MEDIA_VISIBILITIES, STORAGE_PROVIDERS } from './enums';

/**
 * Central media registry.
 *
 * Every uploaded file — public imagery and private applicant documents — has
 * exactly one row here. The row is the source of truth for where the bytes
 * live, how big they are, what they really are (signature-detected MIME), and
 * whether they may ever be served to an anonymous visitor.
 *
 * `visibility = 'private'` rows are only ever readable through the authorised
 * download proxy; `storageKey` is never returned to a public client.
 */
export const mediaAssets = sqliteTable(
  'media_assets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** Path inside the store, e.g. `public/logo/<uuid>.png`. Unique. */
    storageKey: text('storage_key').notNull(),

    storageProvider: text('storage_provider', { enum: STORAGE_PROVIDERS })
      .notNull()
      .default('blobs'),

    visibility: text('visibility', { enum: MEDIA_VISIBILITIES })
      .notNull()
      .default('public'),

    purpose: text('purpose', { enum: MEDIA_PURPOSES }).notNull().default('other'),

    /** What the browser claimed. Untrusted — kept for forensics only. */
    originalFilename: text('original_filename').notNull(),
    /** What we actually stored (uuid-based; the original name is never used). */
    storedFilename: text('stored_filename').notNull(),

    /** What the browser claimed. */
    declaredMimeType: text('declared_mime_type'),
    /** What the bytes actually are, per server-side magic-number inspection. */
    detectedMimeType: text('detected_mime_type').notNull(),

    extension: text('extension').notNull(),
    sizeBytes: integer('size_bytes').notNull(),

    width: integer('width'),
    height: integer('height'),

    checksumSha256: text('checksum_sha256').notNull(),

    altText: text('alt_text'),
    caption: text('caption'),

    uploadedBy: text('uploaded_by').references(() => admins.id, {
      onDelete: 'set null',
    }),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),

    /** Soft delete: referenced media is archived, never hard-deleted. */
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('media_assets_storage_key_unique').on(table.storageKey),
    index('media_assets_visibility_purpose_idx').on(
      table.visibility,
      table.purpose,
    ),
    index('media_assets_created_at_idx').on(table.createdAt),
    index('media_assets_checksum_idx').on(table.checksumSha256),
  ],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
