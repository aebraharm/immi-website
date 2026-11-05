/**
 * DEMONSTRATION CONTENT SEEDER — development and staging only.
 *
 * Purpose: prove that every public page renders correctly from the database, and
 * that the publish/unpublish gates work. This script is NOT run automatically and
 * is deliberately excluded from `docs/DEPLOYMENT.md` because production content
 * must be entered by the agency owner through the admin portal.
 *
 * What it writes (all clearly synthetic):
 *   - site_settings identity, branding and contact fields
 *   - homepage sections
 *   - two services with features
 *   - one country + one destination programme with requirements and a visa category
 *   - one testimonial, two team members, three FAQs
 *   - About / Terms / Privacy pages, published with version 1
 *
 * Every string is obviously placeholder material ("Example ...", "DEMO"). Nothing
 * states a real immigration fact, fee, timeline or approval rate.
 *
 * Usage:
 *   npm run seed:demo        # idempotent: skips anything that already exists
 *   npm run seed:demo -- --reset   # deletes demo rows first
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { mkdirSync } from 'node:fs';

import {
  countries,
  destinations,
  destinationRequirements,
  faqs,
  homepageSections,
  services,
  serviceFeatures,
  siteSettings,
  teamMembers,
  testimonials,
  visaCategories,
  websitePages,
} from '../src/db/schema';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const DEMO_AGENCY_NAME = 'Example Immigration Agency';

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL ?? 'file:./.data/local.db';

  if (url.startsWith('libsql://') && !process.argv.includes('--force-remote')) {
    console.error(
      '[seed:demo] Refusing to write demo content to a remote database.\n' +
        '[seed:demo] Pass --force-remote only if you are certain this is a staging database.',
    );
    process.exit(1);
  }

  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url.startsWith('file:')) mkdirSync('.data', { recursive: true });

  const client = createClient(authToken ? { url, authToken } : { url });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client);

  console.log(`[seed:demo] target: ${url.startsWith('file:') ? url : 'remote (staging)'}`);
  console.log('[seed:demo] ALL CONTENT BELOW IS SYNTHETIC DEMO MATERIAL\n');

  /* ------------------------------------------------------------ settings */
  const existingSettings = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));

  if (existingSettings.length === 0) {
    await db.insert(siteSettings).values({
      id: 1,
      agencyName: DEMO_AGENCY_NAME,
      tagline: 'International employment and immigration guidance',
      shortDescription:
        'Demo content: a short agency description shown in the footer and metadata while the site is being built.',
      longDescription:
        'Demo content: a longer agency description used on the About page side panel. Replace this text from the administration portal with your own wording.',
      contactEmail: 'hello@example.com',
      contactPhonePrimary: '+44 20 0000 0000',
      contactPhoneSecondary: '+44 20 0000 0001',
      contactWhatsapp: '+442000000000',
      addressLine1: '1 Example Street',
      addressCity: 'London',
      addressPostalCode: 'EC1A 1AA',
      addressCountry: 'United Kingdom',
      officeHours: 'Monday to Friday, 09:00–17:00 (example hours)',
      socialLinkedin: 'https://www.linkedin.com/',
      socialInstagram: 'https://www.instagram.com/',
      privacyRetentionDays: 365,
      privacyContactEmail: 'privacy@example.com',
      allowSearchIndexing: true,
    });
    console.log('  + site_settings');
  } else {
    console.log('  = site_settings already present (skipped)');
  }

  /* ------------------------------------------------------ homepage rows */
  const sectionRows = [
    {
      sectionKey: 'hero',
      heading: 'Build your career abroad with clear, honest guidance',
      subheading: 'Example headline',
      bodyMd:
        'Demo content: describe your agency here. Explain how you help people understand their options, prepare documents and approach overseas employers — without promising outcomes.',
      ctaLabel: 'Book a Consultation Now',
      ctaHref: '/assessment',
      secondaryCtaLabel: 'Explore destinations',
      secondaryCtaHref: '/destinations',
      displayOrder: 1,
    },
    {
      sectionKey: 'why_us',
      heading: 'Why work with us',
      subheading: 'About the agency',
      bodyMd:
        'Demo content: this block is driven by the homepage_sections table.\nReplace these paragraphs from the administration portal to describe your approach, your team and the standards you hold yourself to.',
      ctaLabel: 'Read more about us',
      ctaHref: '/about',
      displayOrder: 2,
    },
    {
      sectionKey: 'services_preview',
      heading: 'Our services',
      subheading: 'What we do',
      bodyMd: 'Demo content: a short introduction to the services listed below.',
      displayOrder: 3,
    },
    {
      sectionKey: 'destinations_preview',
      heading: 'Destinations',
      subheading: 'Where we work',
      bodyMd: 'Demo content: destinations are managed individually and published only when reviewed.',
      displayOrder: 4,
    },
    {
      sectionKey: 'testimonials_preview',
      heading: 'Client experiences',
      subheading: 'Testimonials',
      bodyMd: 'Demo content: testimonials appear here once the agency publishes them.',
      displayOrder: 5,
    },
    {
      sectionKey: 'cta_band',
      heading: 'Ready to talk about your options?',
      bodyMd:
        'Demo content: complete the assessment and our team will review your details and contact you.',
      ctaLabel: 'Book a Consultation Now',
      ctaHref: '/assessment',
      displayOrder: 6,
    },
  ];

  for (const row of sectionRows) {
    const existing = await db
      .select({ id: homepageSections.id })
      .from(homepageSections)
      .where(eq(homepageSections.sectionKey, row.sectionKey));

    if (existing.length > 0) {
      console.log(`  = homepage section "${row.sectionKey}" (skipped)`);
      continue;
    }

    await db.insert(homepageSections).values({ ...row, isVisible: true });
    console.log(`  + homepage section "${row.sectionKey}"`);
  }

  /* ---------------------------------------------------------- services */
  const serviceSeeds = [
    {
      slug: 'immigration-guidance',
      title: 'Immigration guidance',
      shortDescription:
        'Demo content: help understanding which immigration routes may be relevant to your profile.',
      descriptionMd:
        '## What this involves\n\nDemo content. Replace with your own description from the administration portal.\n\n- An initial review of your background\n- An explanation of the routes that may apply\n- A written summary of the next steps',
      iconName: 'Globe2',
      displayOrder: 1,
      features: ['Profile review', 'Route explanation', 'Written next steps'],
    },
    {
      slug: 'overseas-employment-support',
      title: 'Overseas employment support',
      shortDescription:
        'Demo content: support preparing applications for overseas employers.',
      descriptionMd:
        '## What this involves\n\nDemo content. Replace with your own description from the administration portal.\n\nThis section is intentionally short so the layout can be reviewed with realistic content lengths.',
      iconName: 'Briefcase',
      displayOrder: 2,
      features: ['CV preparation', 'Employer applications', 'Interview preparation'],
    },
  ];

  for (const seed of serviceSeeds) {
    const existing = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.slug, seed.slug));

    if (existing.length > 0) {
      console.log(`  = service "${seed.slug}" (skipped)`);
      continue;
    }

    const [created] = await db
      .insert(services)
      .values({
        slug: seed.slug,
        title: seed.title,
        shortDescription: seed.shortDescription,
        descriptionMd: seed.descriptionMd,
        iconName: seed.iconName,
        displayOrder: seed.displayOrder,
        status: 'published',
      })
      .returning();

    if (created) {
      await db.insert(serviceFeatures).values(
        seed.features.map((label, index) => ({
          serviceId: created.id,
          label,
          displayOrder: index,
        })),
      );
    }
    console.log(`  + service "${seed.slug}"`);
  }

  /* --------------------------------------------- country + programme */
  const [canada] = await db.select().from(countries).where(eq(countries.isoCode, 'CA'));

  if (canada) {
    if (canada.status !== 'published' || canada.summary.length === 0) {
      await db
        .update(countries)
        .set({
          status: 'published',
          summary:
            'Demo content: a one-sentence summary for this destination. Replace it in the administration portal.',
          descriptionMd:
            '## Overview\n\nDemo content. This country guide is stored in the `countries` table and is fully editable from the admin portal.\n\nNothing here describes real immigration requirements.',
          isFeatured: true,
        })
        .where(eq(countries.id, canada.id));
      console.log('  ~ country "Canada" published with demo copy');
    } else {
      console.log('  = country "Canada" already published (skipped)');
    }

    const existingProgramme = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(eq(destinations.slug, 'example-skilled-route'));

    if (existingProgramme.length === 0) {
      const [programme] = await db
        .insert(destinations)
        .values({
          countryId: canada.id,
          slug: 'example-skilled-route',
          title: 'Example skilled worker route',
          summary:
            'Demo content: a short summary of this example programme. Replace in the administration portal.',
          descriptionMd:
            '## About this route\n\nDemo content only. This programme is a structural example so the destination page layout can be reviewed with real database content.\n\nIt does not describe a real visa, and no fee, timeline or eligibility rule here is factual.',
          processingInfoMd:
            'Demo content: describe the process steps here.\n\n1. Submit an assessment\n2. Review your documents\n3. Confirm the route that applies\n4. Prepare and submit the application',
          importantNoticeMd:
            'Demo notice: requirements, fees and processing times are set by the destination authorities and can change. Always verify with the official source.',
          displayOrder: 1,
          status: 'published',
          isFeatured: true,
        })
        .returning();

      if (programme) {
        await db.insert(visaCategories).values({
          destinationId: programme.id,
          name: 'Example category',
          code: 'DEMO-1',
          descriptionMd: 'Demo content: a visa category entered by an administrator.',
          displayOrder: 1,
        });

        await db.insert(destinationRequirements).values([
          {
            destinationId: programme.id,
            category: 'eligibility',
            label: 'Example eligibility criterion',
            detailMd: 'Demo content: replace with a real criterion from the admin portal.',
            displayOrder: 1,
          },
          {
            destinationId: programme.id,
            category: 'eligibility',
            label: 'Second example criterion',
            detailMd: 'Demo content: shown here to demonstrate a multi-item list.',
            displayOrder: 2,
          },
          {
            destinationId: programme.id,
            category: 'documents',
            label: 'Example document',
            detailMd: 'Demo content: e.g. a qualification certificate.',
            displayOrder: 1,
          },
          {
            destinationId: programme.id,
            category: 'language',
            label: 'Example language requirement',
            detailMd: 'Demo content: language evidence details.',
            displayOrder: 1,
          },
          {
            destinationId: programme.id,
            category: 'procedure',
            label: 'Example process step',
            detailMd: 'Demo content: the first step in an application.',
            displayOrder: 1,
          },
          {
            destinationId: programme.id,
            category: 'procedure',
            label: 'Second example step',
            detailMd: 'Demo content: the following step.',
            displayOrder: 2,
          },
          {
            destinationId: programme.id,
            category: 'link',
            label: 'Official authority (example link)',
            linkUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
            displayOrder: 1,
          },
        ]);

        console.log('  + destination programme "example-skilled-route" with categories and requirements');
      }
    } else {
      console.log('  = destination programme (skipped)');
    }
  } else {
    console.log('  ! Canada not found — run `npm run seed:destinations` first');
  }

  /* ------------------------------------------------- testimonials/team */
  const testimonialSeeds = [
    {
      clientDisplayName: 'Demo Client A',
      clientCountry: 'Nigeria',
      serviceCategory: 'Immigration guidance',
      quote:
        'Demo content: this is a placeholder testimonial used to verify the layout. It is not a real client statement and must be replaced or deleted before launch.',
    },
    {
      clientDisplayName: 'Demo Client B',
      clientCountry: 'Ghana',
      serviceCategory: 'Overseas employment support',
      quote:
        'Demo content: a second placeholder testimonial so the grid can be reviewed with more than one card.',
    },
  ];

  for (const [index, seed] of testimonialSeeds.entries()) {
    const existing = await db
      .select({ id: testimonials.id })
      .from(testimonials)
      .where(eq(testimonials.clientDisplayName, seed.clientDisplayName));

    if (existing.length > 0) {
      console.log(`  = testimonial "${seed.clientDisplayName}" (skipped)`);
      continue;
    }

    await db.insert(testimonials).values({
      ...seed,
      displayOrder: index + 1,
      status: 'published',
    });
    console.log(`  + testimonial "${seed.clientDisplayName}"`);
  }

  const teamSeeds = [
    {
      slug: 'demo-team-member-one',
      fullName: 'Demo Team Member One',
      professionalTitle: 'Example Job Title',
      department: 'Case Assessment',
      bioMd:
        'Demo content: a short biography. Replace this from the administration portal with a real team member profile.',
      qualifications: 'Example qualification',
      areasOfExpertise: 'Example area of expertise',
    },
    {
      slug: 'demo-team-member-two',
      fullName: 'Demo Team Member Two',
      professionalTitle: 'Example Job Title',
      department: 'Client Support',
      bioMd: 'Demo content: a second placeholder profile to verify the team grid layout.',
      qualifications: 'Example qualification',
      areasOfExpertise: 'Example area of expertise',
    },
  ];

  for (const [index, seed] of teamSeeds.entries()) {
    const existing = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.slug, seed.slug));

    if (existing.length > 0) {
      console.log(`  = team member "${seed.slug}" (skipped)`);
      continue;
    }

    await db.insert(teamMembers).values({
      ...seed,
      displayOrder: index + 1,
      status: 'published',
    });
    console.log(`  + team member "${seed.slug}"`);
  }

  /* --------------------------------------------------------------- FAQs */
  const faqSeeds = [
    {
      question: 'Demo question: how long does the process take?',
      answerMd:
        'Demo answer. Replace with a real answer from the administration portal. Processing times are set by the relevant authority and vary by route.',
      category: 'Process',
    },
    {
      question: 'Demo question: do I need a job offer before applying?',
      answerMd: 'Demo answer. This placeholder exists so the accordion can be reviewed.',
      category: 'Process',
    },
    {
      question: 'Demo question: what documents will I need?',
      answerMd: 'Demo answer. Document requirements differ by route and destination.',
      category: 'Documents',
    },
  ];

  for (const [index, seed] of faqSeeds.entries()) {
    const existing = await db
      .select({ id: faqs.id })
      .from(faqs)
      .where(eq(faqs.question, seed.question));

    if (existing.length > 0) {
      console.log(`  = FAQ "${seed.question.slice(0, 32)}…" (skipped)`);
      continue;
    }

    await db.insert(faqs).values({
      ...seed,
      displayOrder: index + 1,
      status: 'published',
    });
    console.log(`  + FAQ "${seed.question.slice(0, 32)}…"`);
  }

  /* ------------------------------------------------- legal + about pages */
  const pageSeeds = [
    {
      slug: 'about',
      title: 'About us',
      subtitle: 'Demo content: a subtitle for the About page.',
      contentMd:
        '## Who we are\n\nDemo content. This page is stored in the `website_pages` table and edited from the administration portal.\n\n## How we work\n\nReplace this section with your own description of your process, your team and the standards you apply.\n\n## What we do not do\n\nWe do not sell visas, guarantee employment, or promise that an application will be approved.',
      version: 1,
      status: 'published' as const,
    },
    {
      slug: 'terms',
      title: 'Terms and Conditions',
      subtitle: 'Placeholder legal text for interface testing only.',
      contentMd:
        '> **This is placeholder text, not real legal terms.** Replace it from the administration portal before launch.\n\n## 1. About these terms\n\nDemo content used to verify that the Terms page renders long-form content, and that the consent checkbox on the assessment form can reference a published version.\n\n## 2. Our role\n\nWe provide guidance and application assistance. We do not make visa decisions and cannot guarantee any outcome.\n\n## 3. Fees\n\nAny fees are agreed in writing before work begins. No payment is taken through this website.\n\n## 4. Your responsibilities\n\nYou agree to provide accurate information and genuine documents.',
      version: 1,
      status: 'published' as const,
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      subtitle: 'Placeholder privacy text for interface testing only.',
      contentMd:
        '> **This is placeholder text, not a real privacy policy.** Replace it from the administration portal before launch.\n\n## 1. What we collect\n\nThe assessment form collects identity, contact, education, employment, language and destination preference information, plus an uploaded CV.\n\n## 2. Sensitive information\n\nTwo questions ask about medical conditions and criminal convictions. You may answer them, and the details you give are visible only to authorised agency staff.\n\n## 3. How we store it\n\nInformation is stored in a database and your CV in private storage. Neither is publicly accessible.\n\n## 4. How long we keep it\n\nDemo content: describe your retention period here.',
      version: 1,
      status: 'published' as const,
    },
  ];

  for (const seed of pageSeeds) {
    const existing = await db
      .select({ id: websitePages.id })
      .from(websitePages)
      .where(eq(websitePages.slug, seed.slug));

    if (existing.length > 0) {
      console.log(`  = page "${seed.slug}" (skipped)`);
      continue;
    }

    await db.insert(websitePages).values({
      ...seed,
      publishedAt: new Date(),
      lastReviewedOn: new Date().toISOString().slice(0, 10),
    });
    console.log(`  + page "${seed.slug}" (published, v${seed.version})`);
  }

  console.log('\n[seed:demo] Done. All content above is synthetic and must be replaced before launch.');
  console.log('[seed:demo] Every row is editable — and deletable — from the admin portal (Phase 4).');

  client.close();
}

main().catch((error: unknown) => {
  console.error('[seed:demo] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
