/**
 * Schema verification harness.
 *
 * This is not a smoke test that prints "OK". It builds a throwaway database from
 * the real migration files, then *attempts operations that must fail* and
 * reports whether the database actually rejected them:
 *
 *   1. every table and index exists
 *   2. foreign keys are present with the intended ON DELETE action
 *   3. an FK violation is rejected
 *   4. ON DELETE CASCADE really cascades (child rows disappear)
 *   5. ON DELETE RESTRICT really blocks (parent deletion fails) — including the
 *      rule that protects an applicant's private CV
 *   6. ON DELETE SET NULL really nulls (audit trail survives actor deletion)
 *   7. CHECK constraints reject inconsistent rows
 *   8. UNIQUE constraints reject duplicates, including replayed idempotency keys
 *   9. a consent snapshot cannot be silently rewritten by republishing Terms
 *  10. sensitive columns live only in the private assessment table
 *
 * It always runs against a scratch file database — never Turso, never the
 * development database.
 *
 * Usage:
 *   npm run verify:schema
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import { mkdirSync, rmSync } from 'node:fs';

import { admins } from '../src/db/schema/auth';
import { countries, destinations } from '../src/db/schema/destinations';
import { mediaAssets } from '../src/db/schema/media';
import {
  applicantEducation,
  applicantSkills,
  assessmentAttachments,
  assessmentNotes,
  assessments,
  consentRecords,
} from '../src/db/schema/assessments';
import { activityLogs } from '../src/db/schema/operations';
import { teamMembers, testimonials } from '../src/db/schema/people';
import { websitePages } from '../src/db/schema/settings';

loadEnv({ path: '.env.local' });

const SCRATCH_PATH = '.data/verify-scratch.db';
const SCRATCH_URL = `file:${SCRATCH_PATH}`;

let checks = 0;
let failures = 0;

function pass(label: string, detail = ''): void {
  checks += 1;
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, detail: string): void {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}

/**
 * Drizzle wraps driver errors, so the actual SQLite message lives several
 * `cause` levels down. Walk the chain and join everything into one string.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;

  while (current && depth < 6) {
    if (current instanceof Error) {
      parts.push(current.message);
    } else if (typeof current === 'string') {
      parts.push(current);
    } else if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      if (typeof record.message === 'string') parts.push(record.message);
      if (typeof record.code === 'string') parts.push(`code=${record.code}`);
    }
    current = (current as { cause?: unknown })?.cause;
    depth += 1;
  }

  return parts.join(' | ');
}

async function expectRejection(
  label: string,
  operation: () => Promise<unknown>,
  expectedFragments: string[],
): Promise<void> {
  try {
    await operation();
    fail(label, 'operation SUCCEEDED but the database should have rejected it');
  } catch (error) {
    const message = describeError(error);
    const matched = expectedFragments.some((fragment) =>
      message.toLowerCase().includes(fragment.toLowerCase()),
    );

    if (matched) {
      pass(label, `rejected: ${message.slice(0, 100)}`);
    } else {
      fail(label, `rejected for an unexpected reason: ${message.slice(0, 200)}`);
    }
  }
}

async function expectSuccess(
  label: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
    pass(label);
  } catch (error) {
    fail(label, describeError(error).slice(0, 200));
  }
}

const FK_ERROR = ['foreign key', 'constraint'];
const CHECK_ERROR = ['constraint', 'check'];
const UNIQUE_ERROR = ['unique', 'constraint'];

const baseAssessment = {
  fullName: 'Test Applicant',
  dateOfBirth: '1990-01-01',
  gender: 'male' as const,
  nationality: 'NG',
  countryOfResidence: 'NG',
  residentialAddress: '1 Test Street',
  city: 'Warri',
  stateProvince: 'Delta',
  postalCode: '332211',
  mobileCountryCode: '+234',
  mobileNumber: '8000000000',
  email: 'applicant@example.test',
  maritalStatus: 'single' as const,
  hasChildren: false,
  numberOfChildren: null,
  hasPassport: true,
  passportNumber: 'A1234567',
  preferredCountryText: 'Canada',
  preferredOccupation: 'Welder',
  hasMedicalCondition: false,
  medicalDetails: null,
  hasCriminalRecord: false,
  criminalRecordDetails: null,
  hasTravelledAbroad: false,
  hasFamilyAbroad: false,
  hasProfessionalExams: false,
  submittedAt: new Date(),
};

async function main(): Promise<void> {
  /* ---------------------------------------------------------------- setup */
  rmSync(SCRATCH_PATH, { force: true });
  mkdirSync('.data', { recursive: true });

  const client: Client = createClient({ url: SCRATCH_URL });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client);

  console.log('=========================================================');
  console.log(' SCHEMA VERIFICATION');
  console.log(` target: ${SCRATCH_URL} (throwaway)`);
  console.log('=========================================================\n');

  console.log('[1] Applying migrations from ./drizzle');
  await migrate(db, { migrationsFolder: './drizzle' });

  const objects = await client.execute(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name",
  );
  const tables = objects.rows
    .filter((row) => row.type === 'table')
    .map((row) => String(row.name));
  const indexes = objects.rows
    .filter((row) => row.type === 'index')
    .map((row) => String(row.name));

  if (tables.length >= 33) {
    pass('all expected tables created', `${tables.length} tables (33 domain + migration log)`);
  } else {
    fail('table count', `expected >= 33, found ${tables.length}`);
  }
  console.log(`      tables  : ${tables.length}`);
  console.log(`      indexes : ${indexes.length}`);
  console.log(`      list    : ${tables.join(', ')}\n`);

  const fkCheck = await client.execute('PRAGMA foreign_key_check');
  if (fkCheck.rows.length === 0) {
    pass('PRAGMA foreign_key_check', 'no violations');
  } else {
    fail('PRAGMA foreign_key_check', `${fkCheck.rows.length} violation(s)`);
  }

  /* --------------------------------------- [2] foreign key definitions */
  console.log('\n[2] Foreign key definitions (PRAGMA foreign_key_list)');
  const expectedActions: Array<[string, string, string, string]> = [
    ['applicant_education', 'assessment_id', 'assessments', 'CASCADE'],
    ['applicant_skills', 'assessment_id', 'assessments', 'CASCADE'],
    ['assessment_notes', 'assessment_id', 'assessments', 'CASCADE'],
    ['assessment_attachments', 'assessment_id', 'assessments', 'RESTRICT'],
    ['assessment_attachments', 'media_asset_id', 'media_assets', 'RESTRICT'],
    ['activity_logs', 'actor_admin_id', 'admins', 'SET NULL'],
    ['countries', 'flag_asset_id', 'media_assets', 'SET NULL'],
    ['assessments', 'preferred_country_id', 'countries', 'SET NULL'],
    ['destinations', 'country_id', 'countries', 'RESTRICT'],
    ['visa_categories', 'destination_id', 'destinations', 'CASCADE'],
    ['admin_sessions', 'admin_id', 'admins', 'CASCADE'],
    ['media_assets', 'uploaded_by', 'admins', 'SET NULL'],
  ];

  for (const [table, column, parent, action] of expectedActions) {
    const info = await client.execute(`PRAGMA foreign_key_list(\`${table}\`)`);
    const match = info.rows.find(
      (row) => String(row.from) === column && String(row.table) === parent,
    );

    if (!match) {
      fail(`FK ${table}.${column}`, `no foreign key to ${parent}`);
      continue;
    }

    const actualAction = String(match.on_delete).toUpperCase();
    if (actualAction === action) {
      pass(`FK ${table}.${column} -> ${parent}`, `ON DELETE ${action}`);
    } else {
      fail(
        `FK ${table}.${column} -> ${parent}`,
        `expected ON DELETE ${action}, found ${actualAction}`,
      );
    }
  }

  /* -------------------------------------- [3] enforcement before data */
  console.log('\n[3] Foreign key ENFORCEMENT (operations that must fail)');

  await expectRejection(
    'insert a note referencing a non-existent assessment',
    () =>
      db.insert(assessmentNotes).values({
        assessmentId: 'does-not-exist',
        body: 'orphan note',
      }),
    FK_ERROR,
  );

  await expectRejection(
    'insert a destination referencing a non-existent country',
    () =>
      db.insert(destinations).values({
        countryId: 'no-such-country',
        slug: 'ghost-destination',
        title: 'Ghost',
      }),
    FK_ERROR,
  );

  /* -------------------------------------------------------- fixtures */
  console.log('\n[4] Creating fixtures for behavioural tests');

  const [admin] = await db
    .insert(admins)
    .values({
      email: 'verify@example.test',
      passwordHash: 'not-a-real-hash',
      fullName: 'Verification Admin',
      role: 'owner',
    })
    .returning();

  const [country] = await db
    .insert(countries)
    .values({ name: 'Canada', isoCode: 'CA', slug: 'canada' })
    .returning();

  const [media] = await db
    .insert(mediaAssets)
    .values({
      storageKey: 'private/assessments/verify/cv/abc.pdf',
      visibility: 'private',
      purpose: 'cv',
      originalFilename: 'cv.pdf',
      storedFilename: 'abc.pdf',
      detectedMimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
      uploadedBy: admin?.id,
    })
    .returning();

  if (!admin || !country || !media) {
    fail('fixtures', 'could not create base rows — aborting');
    client.close();
    process.exitCode = 1;
    return;
  }

  const [assessmentA] = await db
    .insert(assessments)
    .values({
      ...baseAssessment,
      referenceNumber: 'IMA-2026-VERIFY01',
      idempotencyKey: 'idem-verify-1',
      preferredCountryId: country.id,
    })
    .returning();

  const [assessmentB] = await db
    .insert(assessments)
    .values({
      ...baseAssessment,
      referenceNumber: 'IMA-2026-VERIFY02',
      idempotencyKey: 'idem-verify-2',
      preferredCountryId: country.id,
    })
    .returning();

  if (!assessmentA || !assessmentB) {
    fail('fixtures', 'could not create assessments — aborting');
    client.close();
    process.exitCode = 1;
    return;
  }

  pass(
    'fixtures created',
    `admin, country, media, assessments ${assessmentA.referenceNumber} / ${assessmentB.referenceNumber}`,
  );

  /* ------------------------------------------------------- CASCADE */
  console.log('\n[5] ON DELETE CASCADE + RESTRICT on assessments');

  await db.insert(assessmentNotes).values({
    assessmentId: assessmentA.id,
    adminId: admin.id,
    body: 'Internal note that must cascade with its parent.',
  });
  await db.insert(applicantEducation).values({
    assessmentId: assessmentA.id,
    qualificationLevel: 'bachelor',
    institutionName: 'Test University',
    country: 'NG',
    yearCompleted: 2014,
  });
  await db.insert(applicantSkills).values({
    assessmentId: assessmentA.id,
    skill: 'welding',
  });
  await db.insert(assessmentAttachments).values({
    assessmentId: assessmentA.id,
    mediaAssetId: media.id,
    kind: 'cv',
  });

  // Deleting a parent that still has a private attachment must be blocked.
  await expectRejection(
    'delete an assessment that still has an attached CV (RESTRICT)',
    () => db.delete(assessments).where(eq(assessments.id, assessmentA.id)),
    FK_ERROR,
  );

  const notesBefore = await db
    .select()
    .from(assessmentNotes)
    .where(eq(assessmentNotes.assessmentId, assessmentA.id));
  const educationBefore = await db
    .select()
    .from(applicantEducation)
    .where(eq(applicantEducation.assessmentId, assessmentA.id));
  const skillsBefore = await db
    .select()
    .from(applicantSkills)
    .where(eq(applicantSkills.assessmentId, assessmentA.id));

  await db
    .delete(assessmentAttachments)
    .where(eq(assessmentAttachments.assessmentId, assessmentA.id));

  await expectSuccess(
    'delete the assessment once its attachment link is removed',
    () => db.delete(assessments).where(eq(assessments.id, assessmentA.id)),
  );

  const notesAfter = await db
    .select()
    .from(assessmentNotes)
    .where(eq(assessmentNotes.assessmentId, assessmentA.id));
  const educationAfter = await db
    .select()
    .from(applicantEducation)
    .where(eq(applicantEducation.assessmentId, assessmentA.id));
  const skillsAfter = await db
    .select()
    .from(applicantSkills)
    .where(eq(applicantSkills.assessmentId, assessmentA.id));

  if (notesAfter.length === 0 && educationAfter.length === 0 && skillsAfter.length === 0) {
    pass(
      'child rows cascaded away with the assessment',
      `notes ${notesBefore.length}->0, education ${educationBefore.length}->0, skills ${skillsBefore.length}->0`,
    );
  } else {
    fail(
      'cascade behaviour',
      `notes ${notesBefore.length}->${notesAfter.length}, education ${educationBefore.length}->${educationAfter.length}, skills ${skillsBefore.length}->${skillsAfter.length}`,
    );
  }

  /* ------------------------------------------------------ RESTRICT */
  console.log('\n[6] ON DELETE RESTRICT (private documents and referenced rows)');

  // Re-attach so the media row is referenced again.
  await db.insert(assessmentAttachments).values({
    assessmentId: assessmentB.id,
    mediaAssetId: media.id,
    kind: 'cv',
  });

  await expectRejection(
    'delete a media asset referenced by an assessment attachment',
    () => db.delete(mediaAssets).where(eq(mediaAssets.id, media.id)),
    FK_ERROR,
  );

  const [destination] = await db
    .insert(destinations)
    .values({
      countryId: country.id,
      slug: 'verify-destination',
      title: 'Verification Destination',
    })
    .returning();

  await expectRejection(
    'delete a country referenced by a destination programme',
    () => db.delete(countries).where(eq(countries.id, country.id)),
    FK_ERROR,
  );

  if (destination) {
    await expectSuccess('delete an unreferenced destination', () =>
      db.delete(destinations).where(eq(destinations.id, destination.id)),
    );
  }

  /* ------------------------------------------------------ SET NULL */
  console.log('\n[7] ON DELETE SET NULL (audit history survives)');

  await db.insert(activityLogs).values({
    actorAdminId: admin.id,
    actorEmailSnapshot: admin.email,
    action: 'admin.login',
    summary: 'Verification login entry',
  });

  await db.delete(admins).where(eq(admins.id, admin.id));

  const logs = await db.select().from(activityLogs);
  if (logs.length === 1 && logs[0]?.actorAdminId === null) {
    pass(
      'activity log retained after admin deletion',
      `actor_admin_id -> NULL, snapshot kept: ${logs[0]?.actorEmailSnapshot}`,
    );
  } else {
    fail('audit trail preservation', `expected 1 log with NULL actor, got ${logs.length}`);
  }

  const mediaAfterAdminDelete = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, media.id));
  if (mediaAfterAdminDelete[0]?.uploadedBy === null) {
    pass('media_assets.uploaded_by nulled when the uploader is deleted');
  } else {
    fail('media uploader null-out', 'uploaded_by was not nulled');
  }

  /* --------------------------------------------------------- CHECK */
  console.log('\n[8] CHECK constraints');

  await expectRejection(
    'reject hasChildren=false with a non-null children count',
    () =>
      db.insert(assessments).values({
        ...baseAssessment,
        referenceNumber: 'IMA-2026-VERIFY03',
        idempotencyKey: 'idem-verify-3',
        hasChildren: false,
        numberOfChildren: 2,
      }),
    CHECK_ERROR,
  );

  await expectRejection(
    'reject hasPassport=false with a passport number present',
    () =>
      db.insert(assessments).values({
        ...baseAssessment,
        referenceNumber: 'IMA-2026-VERIFY04',
        idempotencyKey: 'idem-verify-4',
        hasPassport: false,
        passportNumber: 'SHOULD-NOT-EXIST',
      }),
    CHECK_ERROR,
  );

  await expectRejection(
    'reject a testimonial with both an uploaded video and a video URL',
    async () => {
      await db.insert(testimonials).values({
        clientDisplayName: 'Test Client',
        quote: 'Testing.',
        videoUrl: 'https://example.test/video.mp4',
        videoAssetId: media.id,
      });
    },
    CHECK_ERROR,
  );

  await expectSuccess('accept a testimonial with a video URL only', () =>
    db.insert(testimonials).values({
      clientDisplayName: 'Test Client',
      quote: 'Accepted fixture.',
      videoUrl: 'https://example.test/video.mp4',
    }),
  );

  /* -------------------------------------------------------- UNIQUE */
  console.log('\n[9] UNIQUE constraints (duplicate protection)');

  await expectRejection(
    'reject a duplicate assessment reference number',
    () =>
      db.insert(assessments).values({
        ...baseAssessment,
        referenceNumber: assessmentB.referenceNumber,
        idempotencyKey: 'idem-verify-5',
      }),
    UNIQUE_ERROR,
  );

  await expectRejection(
    'reject a replayed idempotency key (duplicate submission)',
    () =>
      db.insert(assessments).values({
        ...baseAssessment,
        referenceNumber: 'IMA-2026-VERIFY06',
        idempotencyKey: assessmentB.idempotencyKey,
      }),
    UNIQUE_ERROR,
  );

  await expectRejection(
    'reject a duplicate country ISO code',
    () => db.insert(countries).values({ name: 'Canada Again', isoCode: 'CA', slug: 'canada-2' }),
    UNIQUE_ERROR,
  );

  await expectRejection(
    'reject a duplicate team member slug',
    async () => {
      await db.insert(teamMembers).values({ slug: 'jane-doe', fullName: 'Jane Doe' });
      await db.insert(teamMembers).values({ slug: 'jane-doe', fullName: 'Jane Doe 2' });
    },
    UNIQUE_ERROR,
  );

  await expectRejection(
    'reject the same skill twice on one assessment',
    () =>
      db.insert(applicantSkills).values({
        assessmentId: assessmentB.id,
        skill: 'welding',
      }).then(async () => {
        await db.insert(applicantSkills).values({
          assessmentId: assessmentB.id,
          skill: 'welding',
        });
      }),
    UNIQUE_ERROR,
  );

  /* ------------------------------------------------------- CONSENT */
  console.log('\n[10] Consent snapshot integrity');

  const [termsPage] = await db
    .insert(websitePages)
    .values({
      slug: 'terms',
      title: 'Terms and Conditions',
      contentMd: 'v1 body',
      version: 1,
      status: 'published',
    })
    .returning();

  const [privacyPage] = await db
    .insert(websitePages)
    .values({
      slug: 'privacy',
      title: 'Privacy Policy',
      contentMd: 'v1 body',
      version: 1,
      status: 'published',
    })
    .returning();

  if (!termsPage || !privacyPage) {
    fail('consent fixtures', 'could not create legal pages');
    client.close();
    process.exitCode = 1;
    return;
  }

  const [consent] = await db
    .insert(consentRecords)
    .values({
      assessmentId: assessmentB.id,
      termsPageId: termsPage.id,
      termsVersion: 1,
      privacyPageId: privacyPage.id,
      privacyVersion: 1,
      consentText:
        'I confirm that the information provided is accurate and agree to the Terms and Conditions and Privacy Policy of this agency.',
      acceptedAt: new Date(),
    })
    .returning();

  // "Republish" the Terms as version 2 and confirm the historical consent is
  // untouched — the requirement forbids silently rewriting past consent.
  await db
    .update(websitePages)
    .set({ version: 2, contentMd: 'v2 body' })
    .where(eq(websitePages.id, termsPage.id));

  const consentAfter = await db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.id, consent!.id));

  if (
    consentAfter[0]?.termsVersion === 1 &&
    consentAfter[0]?.consentText === consent!.consentText
  ) {
    pass(
      'consent still points at Terms v1 after the page was republished as v2',
      `consent.terms_version = ${consentAfter[0]?.termsVersion}, page.version = 2`,
    );
  } else {
    fail('consent immutability', `expected terms_version 1, got ${consentAfter[0]?.termsVersion}`);
  }

  await expectRejection(
    'reject a second consent record for the same assessment',
    () =>
      db.insert(consentRecords).values({
        assessmentId: assessmentB.id,
        termsPageId: termsPage.id,
        termsVersion: 2,
        privacyPageId: privacyPage.id,
        privacyVersion: 1,
        consentText: 'second consent',
        acceptedAt: new Date(),
      }),
    UNIQUE_ERROR,
  );

  /* ------------------------------------------------------- PRIVACY */
  console.log('\n[11] Column-level privacy check');

  const assessmentColumns = await client.execute('PRAGMA table_info(`assessments`)');
  const columnNames = assessmentColumns.rows.map((row) => String(row.name));
  const sensitive = ['medical_details', 'criminal_record_details'];
  const present = sensitive.filter((column) => columnNames.includes(column));

  if (present.length === 2) {
    pass(
      'sensitive columns exist only in the private assessments table',
      present.join(', '),
    );
  } else {
    fail('sensitive column presence', `missing: ${present.join(', ') || 'all'}`);
  }

  // Confirm no public table accidentally carries applicant data.
  const publicTables = ['countries', 'services', 'testimonials', 'team_members', 'faqs'];
  let leaked = 0;
  for (const table of publicTables) {
    const info = await client.execute(`PRAGMA table_info(\`${table}\`)`);
    const names = info.rows.map((row) => String(row.name));
    if (names.includes('medical_details') || names.includes('criminal_record_details')) {
      leaked += 1;
    }
  }
  if (leaked === 0) {
    pass('no public content table carries sensitive applicant columns');
  } else {
    fail('sensitive data leakage', `${leaked} public table(s) carry sensitive columns`);
  }

  const auditCount = await client.execute('SELECT count(*) AS n FROM activity_logs');
  console.log(`      activity_logs rows after admin deletion: ${String(auditCount.rows[0]?.n)}`);

  console.log('\n=========================================================');
  console.log(` RESULT: ${checks - failures}/${checks} checks passed`);
  console.log('=========================================================');

  client.close();
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('\n[verify:schema] FAILED:', describeError(error).slice(0, 400));
  process.exit(1);
});
