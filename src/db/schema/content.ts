import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { admins } from './auth';
import { mediaAssets } from './media';
import { CONTENT_STATUSES } from './enums';

/**
 * Services offered by the agency.
 *
 * `iconName` is restricted to an allowlist of Lucide icon keys at validation
 * time, so an administrator can pick an icon without being able to inject
 * arbitrary markup.
 */
export const services = sqliteTable(
  'services',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    slug: text('slug').notNull(),
    title: text('title').notNull().default(''),
    shortDescription: text('short_description').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),

    iconName: text('icon_name').notNull().default('Briefcase'),
    imageAssetId: text('image_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    ctaLabel: text('cta_label').notNull().default(''),
    ctaHref: text('cta_href').notNull().default(''),

    displayOrder: integer('display_order').notNull().default(0),
    status: text('status', { enum: CONTENT_STATUSES }).notNull().default('draft'),

    updatedBy: text('updated_by').references(() => admins.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('services_slug_unique').on(table.slug),
    index('services_status_order_idx').on(table.status, table.displayOrder),
  ],
);

/**
 * Repeatable bullet list for a service. A separate table (rather than a JSON
 * column) keeps the data queryable, indexed and referentially sound.
 */
export const serviceFeatures = sqliteTable(
  'service_features',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),

    label: text('label').notNull(),
    detailMd: text('detail_md').notNull().default(''),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('service_features_service_idx').on(table.serviceId, table.displayOrder),
  ],
);

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServiceFeature = typeof serviceFeatures.$inferSelect;
