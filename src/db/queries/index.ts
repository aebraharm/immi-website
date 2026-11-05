/**
 * Public query surface.
 *
 * Pages import from here and never from Drizzle directly, so the eventual admin
 * CMS writes and the public reads share one vocabulary and one set of
 * visibility rules (`status = 'published'`, not archived).
 */

export * from './types';
export { safeQuery } from './safe';
export { resolveMediaUrls, urlFor, toPublicMediaUrl } from './media-url';
export {
  FALLBACK_IDENTITY,
  getSiteIdentity,
  getSiteSettings,
  getSettingsRow,
} from './settings';
export {
  getHomepageSections,
  findSection,
  getPublishedServices,
  getServiceBySlug,
  getPublishedServiceSlugs,
  getPageBySlug,
  getPublishedPage,
  getPublishedFaqs,
  groupFaqsByCategory,
} from './content';
export type { HomepageSectionWithImage } from './content';
export {
  getPublishedCountries,
  getDestinationOptions,
  getCountryDetailBySlug,
  getDestinationBySlug,
  getPublishedDestinationSlugs,
  getPublishedCountrySlugs,
} from './destinations';
export {
  getPublishedTestimonials,
  getPublishedTeamMembers,
  getTeamMemberBySlug,
  getTeamMemberSlugs,
} from './people';
export { getSeoOverride, EMPTY_SEO_OVERRIDE } from './seo';
export type { SeoOverride } from './seo';
