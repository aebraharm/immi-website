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
import { CONTENT_STATUSES } from './enums';

/**
 * Single-row global site settings: agency identity, branding, contact details,
 * social links and privacy configuration.
 *
 * A single typed row (enforced by a CHECK on `id = 1`) is used instead of a
 * key/value table so that every setting is type-checked by Drizzle and by the
 * database, and so "missing setting" is impossible — the row either exists or
 * the admin portal creates it on first save.
 */
export const siteSettings = sqliteTable(
  'site_settings',
  {
    /** Always 1. */
    id: integer('id').primaryKey().default(1),

    /* ---- Agency identity ---- */
    agencyName: text('agency_name').notNull().default(''),
    tagline: text('tagline').notNull().default(''),
    shortDescription: text('short_description').notNull().default(''),
    longDescription: text('long_description').notNull().default(''),

    /* ---- Branding assets ---- */
    logoAssetId: text('logo_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    logoDarkAssetId: text('logo_dark_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    faviconAssetId: text('favicon_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    ogImageAssetId: text('og_image_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    /* ---- Brand colours (hex strings, validated by Zod on write) ---- */
    brandPrimaryColor: text('brand_primary_color').notNull().default('#E11D2E'),
    brandSecondaryColor: text('brand_secondary_color')
      .notNull()
      .default('#1D4ED8'),
    brandActiveColor: text('brand_active_color').notNull().default('#1E3FBF'),
    brandTextColor: text('brand_text_color').notNull().default('#111827'),

    /* ---- Contact details ---- */
    contactEmail: text('contact_email').notNull().default(''),
    contactPhonePrimary: text('contact_phone_primary').notNull().default(''),
    contactPhoneSecondary: text('contact_phone_secondary').notNull().default(''),
    contactWhatsapp: text('contact_whatsapp').notNull().default(''),

    addressLine1: text('address_line1').notNull().default(''),
    addressLine2: text('address_line2').notNull().default(''),
    addressCity: text('address_city').notNull().default(''),
    addressState: text('address_state').notNull().default(''),
    addressPostalCode: text('address_postal_code').notNull().default(''),
    addressCountry: text('address_country').notNull().default(''),

    officeHours: text('office_hours').notNull().default(''),
    mapEmbedUrl: text('map_embed_url').notNull().default(''),

    /* ---- Social links (full URLs, empty = not shown) ---- */
    socialFacebook: text('social_facebook').notNull().default(''),
    socialInstagram: text('social_instagram').notNull().default(''),
    socialLinkedin: text('social_linkedin').notNull().default(''),
    socialX: text('social_x').notNull().default(''),
    socialTiktok: text('social_tiktok').notNull().default(''),
    socialYoutube: text('social_youtube').notNull().default(''),

    /* ---- Privacy & retention (administrator configurable) ---- */
    /** 0 = keep indefinitely. Otherwise assessments are eligible for purge. */
    privacyRetentionDays: integer('privacy_retention_days').notNull().default(0),
    privacyContactEmail: text('privacy_contact_email').notNull().default(''),
    /** When false the whole site sends `noindex` (e.g. pre-launch). */
    allowSearchIndexing: integer('allow_search_indexing', { mode: 'boolean' })
      .notNull()
      .default(true),

    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedBy: text('updated_by').references(() => admins.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('site_settings_updated_at_idx').on(table.updatedAt)],
);

/**
 * Per-route SEO overrides. When a row is absent, sensible database-derived
 * defaults apply — no hardcoded marketing copy is ever injected.
 */
export const seoSettings = sqliteTable(
  'seo_settings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** Route path without host, e.g. `/`, `/about`, `/destinations/canada`. */
    route: text('route').notNull(),

    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),

    ogTitle: text('og_title').notNull().default(''),
    ogDescription: text('og_description').notNull().default(''),
    ogImageAssetId: text('og_image_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    canonicalOverride: text('canonical_override').notNull().default(''),
    noIndex: integer('no_index', { mode: 'boolean' }).notNull().default(false),

    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [uniqueIndex('seo_settings_route_unique').on(table.route)],
);

/**
 * Long-form editable pages (About Us narrative, Terms, Privacy, and any future
 * legal/static page). `version` increments on every publish and is copied into
 * consent records so historical consent can never be rewritten.
 */
export const websitePages = sqliteTable(
  'website_pages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    slug: text('slug').notNull(),
    title: text('title').notNull().default(''),
    subtitle: text('subtitle').notNull().default(''),
    /** Markdown. Sanitised at render time. */
    contentMd: text('content_md').notNull().default(''),

    version: integer('version').notNull().default(1),
    status: text('status', { enum: CONTENT_STATUSES }).notNull().default('draft'),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),

    /** Shown publicly as "Last updated". */
    lastReviewedOn: text('last_reviewed_on'),

    updatedBy: text('updated_by').references(() => admins.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('website_pages_slug_unique').on(table.slug),
    index('website_pages_status_idx').on(table.status),
  ],
);

/**
 * Homepage sections.
 *
 * A row exists per *layout slot* (`hero`, `cta_band`, …). The slot determines
 * which React component renders it; the row supplies every word and image. An
 * administrator can therefore rewrite, reorder, hide and re-image the homepage
 * without touching code, while the design system stays intact.
 */
export const homepageSections = sqliteTable(
  'homepage_sections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    sectionKey: text('section_key').notNull(),

    heading: text('heading').notNull().default(''),
    subheading: text('subheading').notNull().default(''),
    bodyMd: text('body_md').notNull().default(''),

    ctaLabel: text('cta_label').notNull().default(''),
    ctaHref: text('cta_href').notNull().default(''),
    secondaryCtaLabel: text('secondary_cta_label').notNull().default(''),
    secondaryCtaHref: text('secondary_cta_href').notNull().default(''),

    imageAssetId: text('image_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),

    updatedBy: text('updated_by').references(() => admins.id, {
      onDelete: 'set null',
    }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex('homepage_sections_key_unique').on(table.sectionKey),
    index('homepage_sections_order_idx').on(table.displayOrder),
  ],
);

/** Frequently asked questions, grouped by a free-text category. */
export const faqs = sqliteTable(
  'faqs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    question: text('question').notNull(),
    answerMd: text('answer_md').notNull().default(''),
    category: text('category').notNull().default('General'),

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
    index('faqs_status_order_idx').on(table.status, table.displayOrder),
  ],
);

export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;
export type SeoSetting = typeof seoSettings.$inferSelect;
export type WebsitePage = typeof websitePages.$inferSelect;
export type NewWebsitePage = typeof websitePages.$inferInsert;
export type HomepageSection = typeof homepageSections.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;
