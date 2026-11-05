/**
 * Simple content writers: testimonials, team members, FAQs, pages, homepage
 * sections and SEO overrides.
 *
 * These resources have no child tables, so each writer is a short mapping from
 * validated input to a row. They live together in one file precisely because
 * they are trivial — the interesting ones (services, destinations) have their own.
 */

import { eq, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  faqs,
  homepageSections,
  seoSettings,
  teamMembers,
  testimonials,
  websitePages,
} from '@/db/schema';

import { CmsError, conflict } from '../api';
import { assertSlugFree } from '../resources';
import type {
  FaqInput,
  HomepageSectionInput,
  SeoInput,
  TeamMemberInput,
  TestimonialInput,
  WebsitePageInput,
} from '../schemas';

/* -------------------------------------------------------------------------- */
/* Ordering helper                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The next display order for a table.
 *
 * New items are appended, never prepended: an administrator who has arranged
 * their site does not want it reshuffled by an unrelated create.
 */
async function nextOrder(table: {
  displayOrder: unknown;
}): Promise<number> {
  const db = getDb();
  const column = table.displayOrder as never;
  const [row] = await db
    .select({ displayOrder: column })
    .from(table as never)
    // Descending, so this is the *largest* existing order. Ascending would read
    // the first item and put every new entry at the top of the list.
    .orderBy(sql`${column} desc`)
    .limit(1);
  const current = (row as { displayOrder?: number } | undefined)?.displayOrder ?? 0;
  return current + 1;
}

/* -------------------------------------------------------------------------- */
/* Testimonials                                                               */
/* -------------------------------------------------------------------------- */

export async function createTestimonial(params: {
  input: TestimonialInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const { input, adminId } = params;

  const [row] = await db
    .insert(testimonials)
    .values({
      clientDisplayName: input.clientDisplayName,
      clientCountry: input.clientCountry,
      serviceCategory: input.serviceCategory,
      quote: input.quote,
      photoAssetId: input.photoAssetId ?? null,
      videoAssetId: input.videoAssetId ?? null,
      videoUrl: input.videoUrl,
      status: input.status,
      displayOrder: await nextOrder(testimonials),
      updatedBy: adminId,
    })
    .returning({ id: testimonials.id });

  if (!row) throw new Error('Testimonial insert returned no id.');
  return { id: row.id };
}

export async function updateTestimonial(params: {
  id: string;
  input: TestimonialInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(testimonials)
    .set({
      clientDisplayName: params.input.clientDisplayName,
      clientCountry: params.input.clientCountry,
      serviceCategory: params.input.serviceCategory,
      quote: params.input.quote,
      photoAssetId: params.input.photoAssetId ?? null,
      videoAssetId: params.input.videoAssetId ?? null,
      videoUrl: params.input.videoUrl,
      status: params.input.status,
      updatedAt: new Date(),
      updatedBy: params.adminId,
    })
    .where(eq(testimonials.id, params.id));
}

/* -------------------------------------------------------------------------- */
/* Team members                                                               */
/* -------------------------------------------------------------------------- */

export async function createTeamMember(params: {
  input: TeamMemberInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const { input, adminId } = params;

  await assertSlugFree({
    table: teamMembers,
    slugColumn: teamMembers.slug,
    idColumn: teamMembers.id,
    slug: input.slug,
  });

  const [row] = await db
    .insert(teamMembers)
    .values({
      slug: input.slug,
      fullName: input.fullName,
      professionalTitle: input.professionalTitle,
      department: input.department,
      bioMd: input.bioMd,
      qualifications: input.qualifications,
      areasOfExpertise: input.areasOfExpertise,
      photoAssetId: input.photoAssetId ?? null,
      emailPublic: input.emailPublic,
      socialLinkedin: input.socialLinkedin,
      socialX: input.socialX,
      socialFacebook: input.socialFacebook,
      socialInstagram: input.socialInstagram,
      status: input.status,
      displayOrder: await nextOrder(teamMembers),
      updatedBy: adminId,
    })
    .returning({ id: teamMembers.id });

  if (!row) throw new Error('Team member insert returned no id.');
  return { id: row.id };
}

export async function updateTeamMember(params: {
  id: string;
  input: TeamMemberInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();

  await assertSlugFree({
    table: teamMembers,
    slugColumn: teamMembers.slug,
    idColumn: teamMembers.id,
    slug: params.input.slug,
    excludeId: params.id,
  });

  await db
    .update(teamMembers)
    .set({
      slug: params.input.slug,
      fullName: params.input.fullName,
      professionalTitle: params.input.professionalTitle,
      department: params.input.department,
      bioMd: params.input.bioMd,
      qualifications: params.input.qualifications,
      areasOfExpertise: params.input.areasOfExpertise,
      photoAssetId: params.input.photoAssetId ?? null,
      emailPublic: params.input.emailPublic,
      socialLinkedin: params.input.socialLinkedin,
      socialX: params.input.socialX,
      socialFacebook: params.input.socialFacebook,
      socialInstagram: params.input.socialInstagram,
      status: params.input.status,
      updatedAt: new Date(),
      updatedBy: params.adminId,
    })
    .where(eq(teamMembers.id, params.id));
}

/* -------------------------------------------------------------------------- */
/* FAQs                                                                       */
/* -------------------------------------------------------------------------- */

export async function createFaq(params: {
  input: FaqInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();

  const [row] = await db
    .insert(faqs)
    .values({
      question: params.input.question,
      answerMd: params.input.answerMd,
      category: params.input.category || 'General',
      status: params.input.status,
      displayOrder: await nextOrder(faqs),
      updatedBy: params.adminId,
    })
    .returning({ id: faqs.id });

  if (!row) throw new Error('FAQ insert returned no id.');
  return { id: row.id };
}

export async function updateFaq(params: {
  id: string;
  input: FaqInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(faqs)
    .set({
      question: params.input.question,
      answerMd: params.input.answerMd,
      category: params.input.category || 'General',
      status: params.input.status,
      updatedAt: new Date(),
      updatedBy: params.adminId,
    })
    .where(eq(faqs.id, params.id));
}

/* -------------------------------------------------------------------------- */
/* Website pages                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Creating a page starts it at version 1. Publishing increments the version,
 * which is what consent records on the assessment form point at — so an
 * administrator editing the Terms does not silently rewrite what a past
 * applicant agreed to.
 */
export async function createPage(params: {
  input: WebsitePageInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();

  await assertSlugFree({
    table: websitePages,
    slugColumn: websitePages.slug,
    idColumn: websitePages.id,
    slug: params.input.slug,
  });

  const [row] = await db
    .insert(websitePages)
    .values({
      slug: params.input.slug,
      title: params.input.title,
      subtitle: params.input.subtitle,
      contentMd: params.input.contentMd,
      status: params.input.status,
      publishedAt: params.input.status === 'published' ? new Date() : null,
      lastReviewedOn: params.input.lastReviewedOn || null,
      version: 1,
      updatedBy: params.adminId,
    })
    .returning({ id: websitePages.id });

  if (!row) throw new Error('Page insert returned no id.');
  return { id: row.id };
}

export async function updatePage(params: {
  id: string;
  input: WebsitePageInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();

  await assertSlugFree({
    table: websitePages,
    slugColumn: websitePages.slug,
    idColumn: websitePages.id,
    slug: params.input.slug,
    excludeId: params.id,
  });

  const [existing] = await db
    .select({ status: websitePages.status, publishedAt: websitePages.publishedAt })
    .from(websitePages)
    .where(eq(websitePages.id, params.id))
    .limit(1);

  if (!existing) {
    throw new CmsError(404, 'not_found', 'That page no longer exists.');
  }

  const becomingPublished = params.input.status === 'published' && existing.status !== 'published';
  const leavingPublished = params.input.status !== 'published' && existing.status === 'published';

  await db
    .update(websitePages)
    .set({
      slug: params.input.slug,
      title: params.input.title,
      subtitle: params.input.subtitle,
      contentMd: params.input.contentMd,
      status: params.input.status,
      // A new publish stamps a date; leaving published clears it. Editing a
      // page that is already published keeps its original date.
      publishedAt: becomingPublished
        ? new Date()
        : leavingPublished
          ? null
          : existing.publishedAt,
      lastReviewedOn: params.input.lastReviewedOn || null,
      updatedAt: new Date(),
      updatedBy: params.adminId,
    })
    .where(eq(websitePages.id, params.id));
}

/**
 * Publishing a page bumps its version.
 *
 * Called by the publish action rather than by the edit form, so an administrator
 * can save text without changing the version an applicant's consent refers to.
 */
export async function bumpPageVersion(id: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .update(websitePages)
    .set({ version: sql`${websitePages.version} + 1`, updatedAt: new Date() })
    .where(eq(websitePages.id, id))
    .returning({ version: websitePages.version });

  if (!row) throw new CmsError(404, 'not_found', 'That page no longer exists.');
  return row.version;
}

/* -------------------------------------------------------------------------- */
/* Homepage sections                                                          */
/* -------------------------------------------------------------------------- */

const RESERVED_SECTION_KEYS = [
  'hero',
  'intro',
  'services',
  'destinations',
  'process',
  'testimonials',
  'team',
  'faq',
  'cta_band',
] as const;

export { RESERVED_SECTION_KEYS };

export async function createHomepageSection(params: {
  input: HomepageSectionInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();

  const duplicate = await db
    .select({ id: homepageSections.id })
    .from(homepageSections)
    .where(eq(homepageSections.sectionKey, params.input.sectionKey))
    .limit(1);

  if (duplicate[0]) {
    throw conflict(
      `A section with the key "${params.input.sectionKey}" already exists. Each slot can only be used once.`,
    );
  }

  const [row] = await db
    .insert(homepageSections)
    .values({
      sectionKey: params.input.sectionKey,
      heading: params.input.heading,
      subheading: params.input.subheading,
      bodyMd: params.input.bodyMd,
      ctaLabel: params.input.ctaLabel,
      ctaHref: params.input.ctaHref,
      secondaryCtaLabel: params.input.secondaryCtaLabel,
      secondaryCtaHref: params.input.secondaryCtaHref,
      imageAssetId: params.input.imageAssetId ?? null,
      isVisible: params.input.isVisible,
      displayOrder: await nextOrder(homepageSections),
      updatedBy: params.adminId,
    })
    .returning({ id: homepageSections.id });

  if (!row) throw new Error('Homepage section insert returned no id.');
  return { id: row.id };
}

export async function updateHomepageSection(params: {
  id: string;
  input: HomepageSectionInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();

  const duplicate = await db
    .select({ id: homepageSections.id })
    .from(homepageSections)
    .where(eq(homepageSections.sectionKey, params.input.sectionKey))
    .limit(1);

  if (duplicate[0] && duplicate[0].id !== params.id) {
    throw conflict(
      `A section with the key "${params.input.sectionKey}" already exists. Each slot can only be used once.`,
    );
  }

  await db
    .update(homepageSections)
    .set({
      sectionKey: params.input.sectionKey,
      heading: params.input.heading,
      subheading: params.input.subheading,
      bodyMd: params.input.bodyMd,
      ctaLabel: params.input.ctaLabel,
      ctaHref: params.input.ctaHref,
      secondaryCtaLabel: params.input.secondaryCtaLabel,
      secondaryCtaHref: params.input.secondaryCtaHref,
      imageAssetId: params.input.imageAssetId ?? null,
      isVisible: params.input.isVisible,
      updatedAt: new Date(),
      updatedBy: params.adminId,
    })
    .where(eq(homepageSections.id, params.id));
}

/* -------------------------------------------------------------------------- */
/* SEO overrides                                                              */
/* -------------------------------------------------------------------------- */

export async function upsertSeo(params: {
  input: SeoInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();

  const existing = await db
    .select({ id: seoSettings.id })
    .from(seoSettings)
    .where(eq(seoSettings.route, params.input.route))
    .limit(1);

  const values = {
    title: params.input.title,
    description: params.input.description,
    ogTitle: params.input.ogTitle,
    ogDescription: params.input.ogDescription,
    ogImageAssetId: params.input.ogImageAssetId ?? null,
    canonicalOverride: params.input.canonicalOverride,
    noIndex: params.input.noIndex,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db.update(seoSettings).set(values).where(eq(seoSettings.id, existing[0].id));
    return { id: existing[0].id };
  }

  const [row] = await db
    .insert(seoSettings)
    .values({ route: params.input.route, ...values })
    .returning({ id: seoSettings.id });

  if (!row) throw new Error('SEO insert returned no id.');
  return { id: row.id };
}
