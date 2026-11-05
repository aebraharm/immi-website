/**
 * Default (empty) values for every CMS editor form, plus the form value types.
 *
 * These live outside the `'use client'` form components on purpose. A value
 * imported from a Client Component module into a Server Component is replaced by
 * a client reference — a placeholder, not the object — so `EMPTY_SERVICE` exported
 * from a `'use client'` file arrives at the "new service" page as `undefined` and
 * the form crashes on first render.
 *
 * Keeping the shapes here means the server page and the client form share one
 * definition without crossing that boundary.
 *
 * Every default is empty. Nothing is pre-filled with agency copy, a fee, a
 * processing time or an eligibility rule.
 */

import type { DestinationRequirementCategory } from '@/db/schema/enums';

export type ContentFormStatus = 'draft' | 'published';

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

export type ServiceFeatureForm = {
  id?: string;
  label: string;
  detailMd: string;
};

export type ServiceFormValues = {
  slug: string;
  title: string;
  shortDescription: string;
  descriptionMd: string;
  iconName: string;
  imageAssetId: string | null;
  ctaLabel: string;
  ctaHref: string;
  status: ContentFormStatus;
  features: ServiceFeatureForm[];
};

export const EMPTY_SERVICE: ServiceFormValues = {
  slug: '',
  title: '',
  shortDescription: '',
  descriptionMd: '',
  iconName: '',
  imageAssetId: null,
  ctaLabel: '',
  ctaHref: '',
  status: 'draft',
  features: [],
};

/* -------------------------------------------------------------------------- */
/* Countries and destinations                                                 */
/* -------------------------------------------------------------------------- */

export type CountryFormValues = {
  name: string;
  isoCode: string;
  slug: string;
  flagEmoji: string;
  flagAssetId: string | null;
  heroImageAssetId: string | null;
  summary: string;
  descriptionMd: string;
  isFeatured: boolean;
  status: ContentFormStatus;
};

export const EMPTY_COUNTRY: CountryFormValues = {
  name: '',
  isoCode: '',
  slug: '',
  flagEmoji: '',
  flagAssetId: null,
  heroImageAssetId: null,
  summary: '',
  descriptionMd: '',
  isFeatured: false,
  status: 'draft',
};

export type VisaCategoryForm = {
  id?: string;
  name: string;
  code: string;
  descriptionMd: string;
  isActive: boolean;
};

export type RequirementForm = {
  id?: string;
  category: DestinationRequirementCategory;
  label: string;
  detailMd: string;
  linkUrl: string;
};

export type DestinationFormValues = {
  countryId: string;
  slug: string;
  title: string;
  summary: string;
  descriptionMd: string;
  processingInfoMd: string;
  importantNoticeMd: string;
  heroImageAssetId: string | null;
  isFeatured: boolean;
  status: ContentFormStatus;
  visaCategories: VisaCategoryForm[];
  requirements: RequirementForm[];
};

export const EMPTY_DESTINATION: DestinationFormValues = {
  countryId: '',
  slug: '',
  title: '',
  summary: '',
  descriptionMd: '',
  processingInfoMd: '',
  importantNoticeMd: '',
  heroImageAssetId: null,
  isFeatured: false,
  status: 'draft',
  visaCategories: [],
  requirements: [],
};

/* -------------------------------------------------------------------------- */
/* Testimonials, team, FAQs, pages                                            */
/* -------------------------------------------------------------------------- */

export type TestimonialFormValues = {
  clientDisplayName: string;
  clientCountry: string;
  serviceCategory: string;
  quote: string;
  photoAssetId: string | null;
  videoAssetId: string | null;
  videoUrl: string;
  status: ContentFormStatus;
};

export const EMPTY_TESTIMONIAL: TestimonialFormValues = {
  clientDisplayName: '',
  clientCountry: '',
  serviceCategory: '',
  quote: '',
  photoAssetId: null,
  videoAssetId: null,
  videoUrl: '',
  status: 'draft',
};

export type TeamFormValues = {
  slug: string;
  fullName: string;
  professionalTitle: string;
  department: string;
  bioMd: string;
  qualifications: string;
  areasOfExpertise: string;
  photoAssetId: string | null;
  emailPublic: string;
  socialLinkedin: string;
  socialX: string;
  socialFacebook: string;
  socialInstagram: string;
  status: ContentFormStatus;
};

export const EMPTY_TEAM_MEMBER: TeamFormValues = {
  slug: '',
  fullName: '',
  professionalTitle: '',
  department: '',
  bioMd: '',
  qualifications: '',
  areasOfExpertise: '',
  photoAssetId: null,
  emailPublic: '',
  socialLinkedin: '',
  socialX: '',
  socialFacebook: '',
  socialInstagram: '',
  status: 'draft',
};

export type FaqFormValues = {
  question: string;
  answerMd: string;
  category: string;
  status: ContentFormStatus;
};

export const EMPTY_FAQ: FaqFormValues = {
  question: '',
  answerMd: '',
  category: 'General',
  status: 'draft',
};

export type PageFormValues = {
  slug: string;
  title: string;
  subtitle: string;
  contentMd: string;
  status: ContentFormStatus;
  lastReviewedOn: string;
};

export const EMPTY_PAGE: PageFormValues = {
  slug: '',
  title: '',
  subtitle: '',
  contentMd: '',
  status: 'draft',
  lastReviewedOn: '',
};

/* -------------------------------------------------------------------------- */
/* Homepage sections                                                          */
/* -------------------------------------------------------------------------- */

export type HomepageSectionFormValues = {
  sectionKey: string;
  heading: string;
  subheading: string;
  bodyMd: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  imageAssetId: string | null;
  isVisible: boolean;
};

export const EMPTY_HOMEPAGE_SECTION: HomepageSectionFormValues = {
  sectionKey: 'hero',
  heading: '',
  subheading: '',
  bodyMd: '',
  ctaLabel: '',
  ctaHref: '',
  secondaryCtaLabel: '',
  secondaryCtaHref: '',
  imageAssetId: null,
  isVisible: true,
};

/**
 * The layout slots the homepage understands.
 *
 * These keys are not a free choice: `src/app/(site)/page.tsx` looks each one up
 * by name, and a key it does not look up renders nothing at all. The list is
 * therefore copied from that file, and `tests/cms/phase4-cms.test.ts` parses the
 * homepage to prove the two still agree — otherwise an administrator could
 * "successfully" save a section that never appears.
 *
 * `website_pages` and `homepage_sections.section_key` are both free text with a
 * uniqueness constraint, so this list is the only thing preventing a dead slot.
 */
export const SECTION_SLOTS = [
  { value: 'hero', label: 'Hero — the block at the top of the page' },
  { value: 'why_us', label: 'Why choose us — agency introduction' },
  { value: 'services_preview', label: 'Services — heading above the services list' },
  { value: 'destinations_preview', label: 'Destinations — heading above the country list' },
  { value: 'testimonials_preview', label: 'Testimonials — heading above the client quotes' },
  { value: 'team_preview', label: 'Team — heading above the team profiles' },
  { value: 'faq_preview', label: 'FAQs — heading above the questions' },
  { value: 'cta_band', label: 'Closing call to action — the band near the foot of the page' },
] as const;

/** The slot keys, for validation. Typed as `string[]` so a caller can test any input. */
export const SECTION_SLOT_KEYS: readonly string[] = SECTION_SLOTS.map((slot) => slot.value);

export type SectionSlotKey = (typeof SECTION_SLOTS)[number]['value'];

/* -------------------------------------------------------------------------- */
/* SEO overrides                                                              */
/* -------------------------------------------------------------------------- */

export type SeoFormValues = {
  route: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImageAssetId: string | null;
  canonicalOverride: string;
  noIndex: boolean;
};

export const EMPTY_SEO: SeoFormValues = {
  route: '',
  title: '',
  description: '',
  ogTitle: '',
  ogDescription: '',
  ogImageAssetId: null,
  canonicalOverride: '',
  noIndex: false,
};
