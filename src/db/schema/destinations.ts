import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { admins } from './auth';
import { mediaAssets } from './media';
import {
  CONTENT_STATUSES,
  DESTINATION_REQUIREMENT_CATEGORIES,
} from './enums';

/**
 * Destination countries.
 *
 * Seeded as DRAFTS containing only the country name and ISO code supplied in
 * the requirements. Every descriptive field, visa requirement, fee, timeline
 * and opportunity is entered by an administrator — nothing is fabricated.
 *
 * `ON DELETE RESTRICT` protection: assessments reference `countries.id`, so a
 * country with submissions cannot be hard-deleted, only archived.
 */
export const countries = sqliteTable(
  'countries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    name: text('name').notNull(),
    /** ISO 3166-1 alpha-2, uppercase. */
    isoCode: text('iso_code').notNull(),
    slug: text('slug').notNull(),

    /** Optional flag emoji fallback when no flag image is uploaded. */
    flagEmoji: text('flag_emoji').notNull().default(''),
    flagAssetId: text('flag_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    heroImageAssetId: text('hero_image_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    summary: text('summary').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),

    isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
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
    uniqueIndex('countries_iso_code_unique').on(table.isoCode),
    uniqueIndex('countries_slug_unique').on(table.slug),
    index('countries_status_order_idx').on(table.status, table.displayOrder),
  ],
);

/**
 * A destination programme inside a country — e.g. one visa route or
 * employer-sponsored pathway. Kept separate from `countries` because a single
 * country commonly has several distinct routes with their own requirements.
 */
export const destinations = sqliteTable(
  'destinations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    countryId: text('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'restrict' }),

    slug: text('slug').notNull(),
    title: text('title').notNull().default(''),
    summary: text('summary').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),

    /** Free-text process overview entered manually by an administrator. */
    processingInfoMd: text('processing_info_md').notNull().default(''),
    /** Safety/compliance notice shown prominently above the detail blocks. */
    importantNoticeMd: text('important_notice_md').notNull().default(''),

    heroImageAssetId: text('hero_image_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
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
    uniqueIndex('destinations_slug_unique').on(table.slug),
    index('destinations_country_idx').on(table.countryId),
    index('destinations_status_order_idx').on(table.status, table.displayOrder),
  ],
);

/** Visa categories belonging to a destination programme. */
export const visaCategories = sqliteTable(
  'visa_categories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    destinationId: text('destination_id')
      .notNull()
      .references(() => destinations.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** Administrator-entered official code, if any. Never pre-filled. */
    code: text('code').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),

    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('visa_categories_destination_idx').on(
      table.destinationId,
      table.displayOrder,
    ),
  ],
);

/**
 * One ordered list of immigration-process entries per destination, grouped by
 * category. Covers eligibility, required documents, language requirements,
 * professional qualifications, application procedures, notices and links —
 * the specification's seven content types share this exact shape, so they
 * share one table and one repeatable admin editor.
 */
export const destinationRequirements = sqliteTable(
  'destination_requirements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    destinationId: text('destination_id')
      .notNull()
      .references(() => destinations.id, { onDelete: 'cascade' }),

    category: text('category', {
      enum: DESTINATION_REQUIREMENT_CATEGORIES,
    }).notNull(),

    label: text('label').notNull(),
    detailMd: text('detail_md').notNull().default(''),
    /** Only meaningful for `category = 'link'`; validated as a URL on write. */
    linkUrl: text('link_url').notNull().default(''),

    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    index('destination_requirements_destination_idx').on(
      table.destinationId,
      table.category,
      table.displayOrder,
    ),
  ],
);

/**
 * Employment opportunities advertised for a destination. Every field is
 * administrator-entered; there is no seeded or sample vacancy.
 */
export const employmentOpportunities = sqliteTable(
  'employment_opportunities',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    countryId: text('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'restrict' }),

    destinationId: text('destination_id').references(() => destinations.id, {
      onDelete: 'set null',
    }),

    title: text('title').notNull(),
    sector: text('sector').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),

    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('employment_opportunities_country_idx').on(
      table.countryId,
      table.isActive,
    ),
    index('employment_opportunities_destination_idx').on(table.destinationId),
  ],
);

export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;
export type Destination = typeof destinations.$inferSelect;
export type NewDestination = typeof destinations.$inferInsert;
export type VisaCategory = typeof visaCategories.$inferSelect;
export type DestinationRequirement = typeof destinationRequirements.$inferSelect;
export type EmploymentOpportunity = typeof employmentOpportunities.$inferSelect;
