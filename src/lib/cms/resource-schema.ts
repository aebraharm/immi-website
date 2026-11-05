/**
 * Last-resort schema lookup for resources with no bespoke writer.
 *
 * Every resource that can be created through the generic engine is mapped here.
 * A resource with a dedicated writer (services, countries, destinations, …) never
 * reaches this map for create, but keeping it exhaustive means a new resource
 * cannot be added with no validation at all.
 */

import type { ZodType } from 'zod';

import type { ResourceKey } from './registry';
import {
  countrySchema,
  destinationSchema,
  faqSchema,
  homepageSectionSchema,
  seoSchema,
  serviceSchema,
  teamMemberSchema,
  testimonialSchema,
  websitePageSchema,
} from './schemas';

const SCHEMAS: Record<ResourceKey, ZodType> = {
  services: serviceSchema,
  countries: countrySchema,
  destinations: destinationSchema,
  testimonials: testimonialSchema,
  team: teamMemberSchema,
  faqs: faqSchema,
  pages: websitePageSchema,
  homepage: homepageSectionSchema,
  seo: seoSchema,
};

export function schemaFor(key: ResourceKey): ZodType {
  return SCHEMAS[key];
}
