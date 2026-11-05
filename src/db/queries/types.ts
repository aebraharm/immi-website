/**
 * Shared result shapes for public content queries.
 *
 * Every public page reads through a function that returns one of these, so the
 * "database is not configured yet" and "no content has been added yet" cases are
 * explicit types rather than scattered try/catch blocks. That is what makes a
 * professional empty state possible on every page.
 */

import type {
  Country,
  Destination,
  DestinationRequirement,
  EmploymentOpportunity,
  Faq,
  HomepageSection,
  Service,
  ServiceFeature,
  SiteSettings,
  TeamMember,
  Testimonial,
  VisaCategory,
  WebsitePage,
} from '@/db/schema';

/** Why a query could not return data. */
export type UnavailableReason = 'not_configured' | 'unreachable';

export type QueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: UnavailableReason };

/** Site identity as consumed by the header, footer and metadata generators. */
export type SiteIdentity = {
  agencyName: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  colors: {
    primary: string;
    secondary: string;
    active: string;
    text: string;
  };
  contact: {
    email: string;
    phonePrimary: string;
    phoneSecondary: string;
    whatsapp: string;
    addressLines: string[];
    officeHours: string;
    mapEmbedUrl: string;
  };
  social: Array<{ platform: string; url: string }>;
  privacy: {
    retentionDays: number;
    contactEmail: string;
    allowSearchIndexing: boolean;
  };
  /** True when an administrator has actually configured a name. */
  isConfigured: boolean;
};

export type ServiceWithFeatures = Service & {
  features: ServiceFeature[];
  imageUrl: string | null;
  iconName: string;
};

export type CountrySummary = Country & {
  flagUrl: string | null;
  heroImageUrl: string | null;
  destinationCount: number;
};

export type DestinationDetail = Destination & {
  country: Country;
  flagUrl: string | null;
  heroImageUrl: string | null;
  visaCategories: VisaCategory[];
  requirements: DestinationRequirement[];
  opportunities: EmploymentOpportunity[];
};

export type CountryDetail = {
  country: CountrySummary;
  programmes: DestinationDetail[];
};

export type TestimonialWithMedia = Testimonial & {
  photoUrl: string | null;
  /** Uploaded video if present, otherwise the external link; null if neither. */
  playableVideoUrl: string | null;
};

export type TeamMemberWithPhoto = TeamMember & {
  photoUrl: string | null;
};

export type {
  Country,
  Destination,
  DestinationRequirement,
  EmploymentOpportunity,
  Faq,
  HomepageSection,
  Service,
  ServiceFeature,
  SiteSettings,
  TeamMember,
  Testimonial,
  VisaCategory,
  WebsitePage,
};
