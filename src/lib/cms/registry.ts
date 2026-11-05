/**
 * The CMS resource registry.
 *
 * One entry per manageable content type. The generic engine in `resources.ts`
 * uses these to list, search, publish, archive, restore, reorder and delete;
 * dedicated writers in `src/lib/cms/write/` handle the resources that own child
 * rows (a service's features, a destination's requirements and visa categories).
 *
 * `site_settings` is deliberately absent: it is a single typed row rather than a
 * collection, so it has its own read/write pair in `src/lib/cms/settings.ts`.
 */

import {
  countries,
  destinations,
  faqs,
  homepageSections,
  seoSettings,
  services,
  teamMembers,
  testimonials,
  websitePages,
} from '@/db/schema';

import type { ResourceDefinition } from './resources';

export const RESOURCES = {
  services: {
    key: 'services',
    label: 'Service',
    table: services,
    columns: {
      id: services.id,
      status: services.status,
      displayOrder: services.displayOrder,
      updatedAt: services.updatedAt,
      createdAt: services.createdAt,
      archivedAt: services.archivedAt,
    },
    searchColumns: [services.title, services.slug, services.shortDescription],
    sortColumns: {
      displayOrder: services.displayOrder,
      title: services.title,
      updatedAt: services.updatedAt,
      status: services.status,
    },
    listColumns: {
      slug: services.slug,
      title: services.title,
      shortDescription: services.shortDescription,
    },
    orderable: true,
    allowHardDelete: true,
  },

  countries: {
    key: 'countries',
    label: 'Country',
    table: countries,
    columns: {
      id: countries.id,
      status: countries.status,
      displayOrder: countries.displayOrder,
      updatedAt: countries.updatedAt,
      createdAt: countries.createdAt,
      archivedAt: countries.archivedAt,
    },
    searchColumns: [countries.name, countries.slug, countries.isoCode],
    sortColumns: {
      displayOrder: countries.displayOrder,
      name: countries.name,
      updatedAt: countries.updatedAt,
    },
    listColumns: {
      name: countries.name,
      isoCode: countries.isoCode,
      slug: countries.slug,
      isFeatured: countries.isFeatured,
    },
    orderable: true,
    allowHardDelete: false,
  },

  destinations: {
    key: 'destinations',
    label: 'Destination programme',
    table: destinations,
    columns: {
      id: destinations.id,
      status: destinations.status,
      displayOrder: destinations.displayOrder,
      updatedAt: destinations.updatedAt,
      createdAt: destinations.createdAt,
      archivedAt: destinations.archivedAt,
    },
    searchColumns: [destinations.title, destinations.slug, destinations.summary],
    sortColumns: {
      displayOrder: destinations.displayOrder,
      title: destinations.title,
      updatedAt: destinations.updatedAt,
    },
    listColumns: {
      title: destinations.title,
      slug: destinations.slug,
      countryId: destinations.countryId,
      isFeatured: destinations.isFeatured,
    },
    orderable: true,
    allowHardDelete: true,
  },

  testimonials: {
    key: 'testimonials',
    label: 'Testimonial',
    table: testimonials,
    columns: {
      id: testimonials.id,
      status: testimonials.status,
      displayOrder: testimonials.displayOrder,
      updatedAt: testimonials.updatedAt,
      createdAt: testimonials.createdAt,
      archivedAt: testimonials.archivedAt,
    },
    searchColumns: [
      testimonials.clientDisplayName,
      testimonials.clientCountry,
      testimonials.quote,
    ],
    sortColumns: {
      displayOrder: testimonials.displayOrder,
      clientDisplayName: testimonials.clientDisplayName,
      updatedAt: testimonials.updatedAt,
    },
    listColumns: {
      clientDisplayName: testimonials.clientDisplayName,
      clientCountry: testimonials.clientCountry,
      quote: testimonials.quote,
      photoAssetId: testimonials.photoAssetId,
      videoAssetId: testimonials.videoAssetId,
      videoUrl: testimonials.videoUrl,
    },
    orderable: true,
    allowHardDelete: true,
  },

  team: {
    key: 'team',
    label: 'Team member',
    table: teamMembers,
    columns: {
      id: teamMembers.id,
      status: teamMembers.status,
      displayOrder: teamMembers.displayOrder,
      updatedAt: teamMembers.updatedAt,
      createdAt: teamMembers.createdAt,
      archivedAt: teamMembers.archivedAt,
    },
    searchColumns: [
      teamMembers.fullName,
      teamMembers.slug,
      teamMembers.professionalTitle,
    ],
    sortColumns: {
      displayOrder: teamMembers.displayOrder,
      fullName: teamMembers.fullName,
      updatedAt: teamMembers.updatedAt,
    },
    listColumns: {
      slug: teamMembers.slug,
      fullName: teamMembers.fullName,
      professionalTitle: teamMembers.professionalTitle,
      department: teamMembers.department,
      photoAssetId: teamMembers.photoAssetId,
    },
    orderable: true,
    allowHardDelete: false,
  },

  faqs: {
    key: 'faqs',
    label: 'FAQ',
    table: faqs,
    columns: {
      id: faqs.id,
      status: faqs.status,
      displayOrder: faqs.displayOrder,
      updatedAt: faqs.updatedAt,
      createdAt: faqs.createdAt,
      archivedAt: faqs.archivedAt,
    },
    searchColumns: [faqs.question, faqs.category, faqs.answerMd],
    sortColumns: {
      displayOrder: faqs.displayOrder,
      question: faqs.question,
      updatedAt: faqs.updatedAt,
    },
    listColumns: {
      question: faqs.question,
      category: faqs.category,
      answerMd: faqs.answerMd,
    },
    orderable: true,
    allowHardDelete: true,
  },

  homepage: {
    key: 'homepage',
    label: 'Homepage section',
    table: homepageSections,
    columns: {
      id: homepageSections.id,
      // Homepage sections are not drafts: visibility is a boolean, so `status`
      // and `archivedAt` are derived constants for the generic engine.
      status: homepageSections.isVisible,
      displayOrder: homepageSections.displayOrder,
      updatedAt: homepageSections.updatedAt,
      createdAt: homepageSections.updatedAt,
      archivedAt: homepageSections.updatedAt,
    },
    searchColumns: [homepageSections.sectionKey, homepageSections.heading],
    sortColumns: {
      displayOrder: homepageSections.displayOrder,
      sectionKey: homepageSections.sectionKey,
      updatedAt: homepageSections.updatedAt,
    },
    listColumns: {
      sectionKey: homepageSections.sectionKey,
      heading: homepageSections.heading,
      subheading: homepageSections.subheading,
      isVisible: homepageSections.isVisible,
    },
    orderable: true,
    allowHardDelete: false,
  },

  pages: {
    key: 'pages',
    label: 'Page',
    table: websitePages,
    columns: {
      id: websitePages.id,
      status: websitePages.status,
      displayOrder: websitePages.createdAt,
      updatedAt: websitePages.updatedAt,
      createdAt: websitePages.createdAt,
      // `website_pages` has no archive column; archiving is expressed by status.
      archivedAt: websitePages.createdAt,
    },
    searchColumns: [websitePages.title, websitePages.slug, websitePages.subtitle],
    sortColumns: {
      title: websitePages.title,
      updatedAt: websitePages.updatedAt,
    },
    listColumns: {
      slug: websitePages.slug,
      title: websitePages.title,
      subtitle: websitePages.subtitle,
      publishedAt: websitePages.publishedAt,
      version: websitePages.version,
      lastReviewedOn: websitePages.lastReviewedOn,
    },
    orderable: false,
    allowHardDelete: false,
  },

  seo: {
    key: 'seo',
    label: 'SEO override',
    table: seoSettings,
    columns: {
      id: seoSettings.id,
      status: seoSettings.noIndex,
      displayOrder: seoSettings.route,
      updatedAt: seoSettings.updatedAt,
      createdAt: seoSettings.updatedAt,
      archivedAt: seoSettings.updatedAt,
    },
    searchColumns: [seoSettings.route, seoSettings.title, seoSettings.description],
    sortColumns: {
      route: seoSettings.route,
      updatedAt: seoSettings.updatedAt,
    },
    listColumns: {
      route: seoSettings.route,
      title: seoSettings.title,
      description: seoSettings.description,
      noIndex: seoSettings.noIndex,
    },
    orderable: false,
    allowHardDelete: true,
  },
} satisfies Record<string, ResourceDefinition>;

export type ResourceKey = keyof typeof RESOURCES;

export function getResource(key: string): ResourceDefinition {
  const definition = (RESOURCES as Record<string, ResourceDefinition | undefined>)[key];
  if (!definition) {
    throw new Error(`Unknown CMS resource: ${key}`);
  }
  return definition;
}

export function isResourceKey(key: string): key is ResourceKey {
  return key in RESOURCES;
}
