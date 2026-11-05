/**
 * Server-side loaders for the CMS editor pages.
 *
 * Each returns the row in the shape its form expects, or `null` when the id no
 * longer exists (the page then calls `notFound()`). Keeping the mapping here
 * means the "edit" page and the "new" page share one definition of what the form
 * value type actually is.
 */

import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  faqs,
  homepageSections,
  seoSettings,
  teamMembers,
  testimonials,
  websitePages,
} from '@/db/schema';

import type {
  FaqFormValues,
  PageFormValues,
  TeamFormValues,
  TestimonialFormValues,
} from '@/lib/cms/form-defaults';

export async function loadFaq(id: string): Promise<FaqFormValues | null> {
  const db = getDb();
  const [row] = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
  if (!row) return null;

  return {
    question: row.question,
    answerMd: row.answerMd,
    category: row.category,
    status: row.status === 'published' ? 'published' : 'draft',
  };
}

export async function loadTestimonial(id: string): Promise<TestimonialFormValues | null> {
  const db = getDb();
  const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
  if (!row) return null;

  return {
    clientDisplayName: row.clientDisplayName,
    clientCountry: row.clientCountry,
    serviceCategory: row.serviceCategory,
    quote: row.quote,
    photoAssetId: row.photoAssetId,
    videoAssetId: row.videoAssetId,
    videoUrl: row.videoUrl,
    status: row.status === 'published' ? 'published' : 'draft',
  };
}

export async function loadTeamMember(id: string): Promise<TeamFormValues | null> {
  const db = getDb();
  const [row] = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  if (!row) return null;

  return {
    slug: row.slug,
    fullName: row.fullName,
    professionalTitle: row.professionalTitle,
    department: row.department,
    bioMd: row.bioMd,
    qualifications: row.qualifications,
    areasOfExpertise: row.areasOfExpertise,
    photoAssetId: row.photoAssetId,
    emailPublic: row.emailPublic,
    socialLinkedin: row.socialLinkedin,
    socialX: row.socialX,
    socialFacebook: row.socialFacebook,
    socialInstagram: row.socialInstagram,
    status: row.status === 'published' ? 'published' : 'draft',
  };
}

export async function loadPage(
  id: string,
): Promise<{ values: PageFormValues; version: number } | null> {
  const db = getDb();
  const [row] = await db.select().from(websitePages).where(eq(websitePages.id, id)).limit(1);
  if (!row) return null;

  return {
    values: {
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      contentMd: row.contentMd,
      status: row.status === 'published' ? 'published' : 'draft',
      lastReviewedOn: row.lastReviewedOn ?? '',
    },
    version: row.version,
  };
}

export async function loadHomepageSection(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(homepageSections)
    .where(eq(homepageSections.id, id))
    .limit(1);
  return row ?? null;
}

export async function listHomepageSections() {
  const db = getDb();
  return db.select().from(homepageSections).orderBy(asc(homepageSections.displayOrder));
}

export async function loadSeoOverride(id: string) {
  const db = getDb();
  const [row] = await db.select().from(seoSettings).where(eq(seoSettings.id, id)).limit(1);
  return row ?? null;
}

export async function listSeoOverrides() {
  const db = getDb();
  return db.select().from(seoSettings).orderBy(asc(seoSettings.route));
}
