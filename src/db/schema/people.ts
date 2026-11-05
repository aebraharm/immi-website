import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { admins } from './auth';
import { mediaAssets } from './media';
import { CONTENT_STATUSES } from './enums';

/**
 * Client testimonials.
 *
 * Note the absence of any `clientId` column: there are no client accounts in
 * this product, so a testimonial is pure editorial content that an
 * administrator types in. Nothing is generated or seeded.
 */
export const testimonials = sqliteTable(
  'testimonials',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    clientDisplayName: text('client_display_name').notNull(),
    clientCountry: text('client_country').notNull().default(''),
    serviceCategory: text('service_category').notNull().default(''),
    quote: text('quote').notNull(),

    photoAssetId: text('photo_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    videoAssetId: text('video_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    /** External video URL (e.g. a hosted link). Exactly one of the two is used. */
    videoUrl: text('video_url').notNull().default(''),

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
    index('testimonials_status_order_idx').on(table.status, table.displayOrder),
    // A testimonial may carry an uploaded video or a link, never both.
    check(
      'testimonials_single_video_source',
      sql`NOT (${table.videoAssetId} IS NOT NULL AND length(${table.videoUrl}) > 0)`,
    ),
  ],
);

/**
 * Agency team members / case workers. Only `status = 'published'` rows are
 * ever read by the public site.
 */
export const teamMembers = sqliteTable(
  'team_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    slug: text('slug').notNull(),
    fullName: text('full_name').notNull(),
    professionalTitle: text('professional_title').notNull().default(''),
    department: text('department').notNull().default(''),
    bioMd: text('bio_md').notNull().default(''),
    qualifications: text('qualifications').notNull().default(''),
    areasOfExpertise: text('areas_of_expertise').notNull().default(''),

    photoAssetId: text('photo_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    emailPublic: text('email_public').notNull().default(''),
    socialLinkedin: text('social_linkedin').notNull().default(''),
    socialX: text('social_x').notNull().default(''),
    socialFacebook: text('social_facebook').notNull().default(''),
    socialInstagram: text('social_instagram').notNull().default(''),

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
    uniqueIndex('team_members_slug_unique').on(table.slug),
    index('team_members_status_order_idx').on(table.status, table.displayOrder),
  ],
);

export type Testimonial = typeof testimonials.$inferSelect;
export type NewTestimonial = typeof testimonials.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
