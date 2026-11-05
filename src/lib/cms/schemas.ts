/**
 * CMS validation schemas.
 *
 * Every write that reaches a CMS endpoint is parsed by one of these before it
 * touches the database. Two rules hold throughout:
 *
 *  1. **Nothing is invented.** There are no defaults containing agency copy,
 *     visa facts, fees or testimonials. An omitted field becomes an empty
 *     string, which the public site renders as an honest empty state.
 *  2. **Lengths, formats and enumerations are enforced here**, not in the UI,
 *     so a hand-crafted request cannot store a 40,000-character "title" or an
 *     `href` of `javascript:`.
 *
 * Shared primitives live at the top; each resource then composes them.
 */

import { z } from 'zod';

import { brandColorError, isHexColor, type BrandColorKey } from '@/lib/brand-colors';

import { SECTION_SLOT_KEYS } from './form-defaults';

import {
  CONTENT_STATUSES,
  DESTINATION_REQUIREMENT_CATEGORIES,
  MEDIA_PURPOSES,
} from '@/db/schema/enums';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** A short single-line string. Trimmed; empty allowed and means "not set". */
export const shortText = (max: number) => z.string().trim().max(max);

/** A required single-line string. */
export const requiredText = (max: number, label = 'This field') =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/** Markdown body. Generous limit, still bounded. */
export const markdown = z.string().max(60_000, 'This text is too long.');

/**
 * A site-relative path or an https URL.
 *
 * Rejecting `javascript:` and protocol-relative URLs here is what keeps an
 * administrator-supplied CTA from becoming a script execution vector.
 */
export const safeHref = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (value === '') return true;
    if (value.startsWith('/')) return !value.startsWith('//');
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use a site path starting with "/" or a full https:// address.');

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Enter a valid email address, or leave it empty.',
  );

export const slugField = z
  .string()
  .trim()
  .min(1, 'A URL slug is required.')
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers and single hyphens only.',
  );

export const hexColour = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour, e.g. #E11D2E.');

/** Hex syntax alone is insufficient for a public brand colour. */
function accessibleBrandColour(key: BrandColorKey) {
  return hexColour.superRefine((value, context) => {
    // The base regex already reports malformed values; avoid a duplicate error.
    if (!isHexColor(value)) return;
    const error = brandColorError(key, value);
    if (error) context.addIssue({ code: 'custom', message: error });
  });
}

export const contentStatus = z.enum(CONTENT_STATUSES);

/** Ordering is a non-negative integer; the UI sends the whole sequence. */
export const displayOrder = z.number().int().min(0).max(100_000);

/** ISO date (YYYY-MM-DD) or empty. */
export const isoDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Use the date picker, or leave the field empty.',
  );

/** A media id, or null to clear the reference. */
export const mediaId = z.string().uuid().nullable().optional();

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export const mediaPurpose = z.enum(MEDIA_PURPOSES);

export const mediaAltSchema = z.object({
  altText: z.string().trim().max(500),
  caption: z.string().trim().max(500),
});

/* -------------------------------------------------------------------------- */
/* Site settings                                                              */
/* -------------------------------------------------------------------------- */

export const siteSettingsSchema = z.object({
  /**
   * The agency name is the one setting that must never be blank: it is the
   * fallback text in the header, the footer, the assessment form, the browser
   * title and the organisation metadata. An empty value here would silently
   * blank the brand across the whole site.
   *
   * Everything else may legitimately be empty while the site is being set up,
   * and renders as an honest empty state.
   */
  agencyName: requiredText(120, 'Your agency name'),
  tagline: shortText(160),
  shortDescription: z.string().trim().max(400),
  longDescription: z.string().trim().max(4000),

  logoAssetId: mediaId,
  logoDarkAssetId: mediaId,
  faviconAssetId: mediaId,
  ogImageAssetId: mediaId,

  brandPrimaryColor: accessibleBrandColour('primary'),
  brandSecondaryColor: accessibleBrandColour('secondary'),
  brandActiveColor: accessibleBrandColour('active'),
  brandTextColor: accessibleBrandColour('text'),

  contactEmail: optionalEmail,
  contactPhonePrimary: shortText(40),
  contactPhoneSecondary: shortText(40),
  contactWhatsapp: shortText(40),

  addressLine1: shortText(160),
  addressLine2: shortText(160),
  addressCity: shortText(80),
  addressState: shortText(80),
  addressPostalCode: shortText(20),
  addressCountry: shortText(80),

  officeHours: shortText(120),
  mapEmbedUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => {
      if (value === '') return true;
      try {
        const url = new URL(value);
        return url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Use a full https:// address for the map embed.'),

  socialFacebook: safeHref,
  socialInstagram: safeHref,
  socialLinkedin: safeHref,
  socialX: safeHref,
  socialTiktok: safeHref,
  socialYoutube: safeHref,

  privacyRetentionDays: z.number().int().min(0).max(3650),
  privacyContactEmail: optionalEmail,
  allowSearchIndexing: z.boolean(),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

/* -------------------------------------------------------------------------- */
/* Homepage sections                                                          */
/* -------------------------------------------------------------------------- */

export const homepageSectionSchema = z.object({
  /**
   * Which layout slot this row fills.
   *
   * Restricted to the slots the homepage component actually renders. Without
   * this, a section could be saved under a key nothing looks up and would be
   * silently invisible — the worst kind of CMS bug, because the administrator
   * sees "saved" and the site shows nothing.
   */
  sectionKey: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores.')
    .refine((value) => SECTION_SLOT_KEYS.includes(value), {
      message: 'That section slot does not exist on the homepage.',
    }),
  heading: shortText(200),
  subheading: z.string().trim().max(600),
  bodyMd: markdown,
  ctaLabel: shortText(60),
  ctaHref: safeHref,
  secondaryCtaLabel: shortText(60),
  secondaryCtaHref: safeHref,
  imageAssetId: mediaId,
  isVisible: z.boolean(),
});

export type HomepageSectionInput = z.infer<typeof homepageSectionSchema>;

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

export const serviceFeatureSchema = z.object({
  id: z.string().uuid().optional(),
  label: requiredText(200, 'A feature label'),
  detailMd: markdown,
});

export const serviceSchema = z.object({
  slug: slugField,
  title: requiredText(200, 'A service name'),
  shortDescription: z.string().trim().max(600),
  descriptionMd: markdown,
  iconName: shortText(60),
  imageAssetId: mediaId,
  ctaLabel: shortText(60),
  ctaHref: safeHref,
  status: contentStatus,
  features: z.array(serviceFeatureSchema).max(60).default([]),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

/* -------------------------------------------------------------------------- */
/* Countries and destinations                                                 */
/* -------------------------------------------------------------------------- */

export const countrySchema = z.object({
  name: requiredText(120, 'A country name'),
  isoCode: z
    .string()
    .trim()
    .length(2, 'Use the two-letter ISO country code.')
    .regex(/^[A-Za-z]{2}$/, 'Use the two-letter ISO country code.')
    .transform((value) => value.toUpperCase()),
  slug: slugField,
  flagEmoji: shortText(16),
  flagAssetId: mediaId,
  heroImageAssetId: mediaId,
  summary: z.string().trim().max(600),
  descriptionMd: markdown,
  isFeatured: z.boolean(),
  status: contentStatus,
});

export type CountryInput = z.infer<typeof countrySchema>;

export const visaCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: requiredText(160, 'A visa category name'),
  code: shortText(40),
  descriptionMd: markdown,
  isActive: z.boolean(),
});

export const requirementSchema = z
  .object({
    id: z.string().uuid().optional(),
    category: z.enum(DESTINATION_REQUIREMENT_CATEGORIES),
    label: requiredText(200, 'A requirement label'),
    detailMd: markdown,
    linkUrl: z
      .string()
      .trim()
      .max(1000)
      .refine((value) => {
        if (value === '') return true;
        try {
          return new URL(value).protocol === 'https:';
        } catch {
          return false;
        }
      }, 'Use a full https:// address, or leave it empty.'),
  })
  .refine(
    (value) => value.category !== 'link' || value.linkUrl !== '',
    'A link entry needs an https:// address.',
  );

export const destinationSchema = z.object({
  countryId: z.string().uuid(),
  slug: slugField,
  title: requiredText(200, 'A programme title'),
  summary: z.string().trim().max(600),
  descriptionMd: markdown,
  processingInfoMd: markdown,
  importantNoticeMd: markdown,
  heroImageAssetId: mediaId,
  isFeatured: z.boolean(),
  status: contentStatus,
  visaCategories: z.array(visaCategorySchema).max(60).default([]),
  requirements: z.array(requirementSchema).max(200).default([]),
});

export type DestinationInput = z.infer<typeof destinationSchema>;

/* -------------------------------------------------------------------------- */
/* Testimonials and team                                                      */
/* -------------------------------------------------------------------------- */

export const testimonialSchema = z.object({
  clientDisplayName: requiredText(120, 'A display name'),
  clientCountry: shortText(80),
  serviceCategory: shortText(120),
  quote: requiredText(4000, 'A quotation'),
  photoAssetId: mediaId,
  videoAssetId: mediaId,
  videoUrl: safeHref,
  status: contentStatus,
});

export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const teamMemberSchema = z.object({
  slug: slugField,
  fullName: requiredText(160, 'A full name'),
  professionalTitle: shortText(160),
  department: shortText(120),
  bioMd: markdown,
  qualifications: z.string().trim().max(2000),
  areasOfExpertise: z.string().trim().max(2000),
  photoAssetId: mediaId,
  emailPublic: optionalEmail,
  socialLinkedin: safeHref,
  socialX: safeHref,
  socialFacebook: safeHref,
  socialInstagram: safeHref,
  status: contentStatus,
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

/* -------------------------------------------------------------------------- */
/* FAQs                                                                       */
/* -------------------------------------------------------------------------- */

export const faqSchema = z.object({
  question: requiredText(300, 'A question'),
  answerMd: markdown,
  category: shortText(80),
  status: contentStatus,
});

export type FaqInput = z.infer<typeof faqSchema>;

/* -------------------------------------------------------------------------- */
/* Website pages (About / Terms / Privacy / anything else)                    */
/* -------------------------------------------------------------------------- */

export const websitePageSchema = z.object({
  slug: slugField,
  title: requiredText(200, 'A page title'),
  subtitle: z.string().trim().max(400),
  contentMd: markdown,
  status: contentStatus,
  lastReviewedOn: isoDate,
});

export type WebsitePageInput = z.infer<typeof websitePageSchema>;

/* -------------------------------------------------------------------------- */
/* SEO overrides                                                              */
/* -------------------------------------------------------------------------- */

export const seoSchema = z.object({
  route: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^\//, 'The route must start with "/".'),
  title: shortText(120),
  description: z.string().trim().max(400),
  ogTitle: shortText(120),
  ogDescription: z.string().trim().max(400),
  ogImageAssetId: mediaId,
  canonicalOverride: safeHref,
  noIndex: z.boolean(),
});

export type SeoInput = z.infer<typeof seoSchema>;

/* -------------------------------------------------------------------------- */
/* Reordering                                                                 */
/* -------------------------------------------------------------------------- */

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
});

/* -------------------------------------------------------------------------- */
/* Publishing                                                                 */
/* -------------------------------------------------------------------------- */

export const publishSchema = z.object({
  publish: z.boolean(),
});
