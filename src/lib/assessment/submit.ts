/**
 * Assessment submission.
 *
 * One function does the whole write, in an order that is the security model:
 *
 *   1. **Do not trust the client's shape.** The payload is re-validated here with
 *      the same Zod schema the browser used, over the *whole* form. A request
 *      that skipped a step in the UI still has to satisfy every rule.
 *   2. **Refuse before writing.** Consent, honeypot, rate-limit and duplicate
 *      checks all run before any bytes or rows are created, so a rejected request
 *      leaves nothing behind to clean up.
 *   3. **Server-owned identity.** The reference number, timestamps and IP hash are
 *      generated or derived here. None is taken from the request body.
 *   4. **One transaction.** The assessment, its consent snapshot, its child lists
 *      and its CV attachment are written together. A failure part-way leaves no
 *      half-submitted application for an administrator to puzzle over.
 *   5. **Only the reference comes back.** The success response contains a
 *      reference number and a receipt token — never the submitted data.
 *
 * There is no applicant account anywhere in this flow: an applicant proves
 * nothing, owns nothing and can read nothing afterwards. That is the requirement,
 * and it is enforced by there being no login path at all.
 */

import { and, eq, gte, isNull } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  applicantEducation,
  applicantEmployment,
  applicantFamilyAbroad,
  applicantLanguages,
  applicantSkills,
  applicantTravelHistory,
  assessmentAttachments,
  assessments,
  consentRecords,
  countries,
} from '@/db/schema';
import { getPublishedPage } from '@/db/queries';
import { writeAuditLog } from '@/lib/auth/audit';
import { rateLimitKey, sha256Hex } from '@/lib/auth/crypto';
import { consumeRateLimit, peekRateLimit } from '@/lib/auth/rate-limit';

import { ASSESSMENT_RATE_LIMITS, DUPLICATE_WINDOW_MS } from './config';
import { discardCv, storeApplicantCv, type StoredCv } from './cv';
import { generateReferenceNumber } from './reference-number';
import { CONSENT_TEXT, assessmentSchema, toFieldErrors, type FieldErrors } from './schema';
import { splitCountries } from './transforms';

export type SubmissionResult =
  | {
      ok: true;
      referenceNumber: string;
      /**
       * Opaque token proving *this browser* made *this* submission. Not an
       * account and not a session: it is used once, to render a confirmation
       * page that says "we received it", and it grants no access to the record.
       */
      receiptToken: string;
      submittedAt: string;
      /** False when an idempotent retry returned the original submission. */
      created: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      fieldErrors?: FieldErrors;
    };

export type SubmissionInput = {
  /** The whole form, as parsed JSON from the request body. */
  payload: unknown;
  /** Client-generated UUID. Makes a retried POST return the original reference. */
  idempotencyKey: string | null;
  /** SHA-256 of the client IP — hashed by the caller, never the raw address. */
  ipHash: string | null;
  /** Optional: a retry from a script legitimately has no user agent. */
  userAgent?: string | null;
  /** Hidden anti-automation field. A real visitor never fills it in. */
  honeypot?: string;
  /** The CV bytes, already read from the request by the route. */
  cvBytes?: Uint8Array | null;
  cvFilename?: string;
  cvMimeType?: string | null;
};

const failure = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
): SubmissionResult => ({ ok: false, status, code, message, fieldErrors });

/** Count a rejected attempt so repeated abuse trips the failed-attempt limiter. */
async function countFailure(ipHash: string | null): Promise<void> {
  if (!ipHash) return;
  await consumeRateLimit({
    key: rateLimitKey('assessment:failed', ipHash),
    limit: ASSESSMENT_RATE_LIMITS.failedAttempt.limit,
    windowMs: ASSESSMENT_RATE_LIMITS.failedAttempt.windowMs,
  }).catch(() => undefined);
}

export async function submitAssessment(input: SubmissionInput): Promise<SubmissionResult> {
  const ipHash = input.ipHash;

  /* ---------------------------------------------------------------------- */
  /* 1. Cheap abuse controls                                                */
  /* ---------------------------------------------------------------------- */

  if (ipHash) {
    // Too many rejected attempts in the last window: stop reading bodies.
    const failed = await peekRateLimit({
      key: rateLimitKey('assessment:failed', ipHash),
      windowMs: ASSESSMENT_RATE_LIMITS.failedAttempt.windowMs,
    }).catch(() => 0);

    if (failed >= ASSESSMENT_RATE_LIMITS.failedAttempt.limit) {
      return failure(
        429,
        'rate_limited',
        'Too many attempts were made from this connection. Please wait a short while before trying again.',
      );
    }
  }

  if (input.honeypot && input.honeypot.trim() !== '') {
    // A real visitor never sees this field. A flat refusal is honest and cheap;
    // pretending to succeed would reward the bot.
    await countFailure(ipHash);
    return failure(400, 'rejected', 'This submission could not be processed.');
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Re-validate the whole form                                          */
  /* ---------------------------------------------------------------------- */

  const parsed = assessmentSchema.safeParse(input.payload);
  if (!parsed.success) {
    await countFailure(ipHash);
    return failure(
      400,
      'invalid_request',
      'Some answers need attention. Please check the highlighted fields.',
      toFieldErrors(parsed.error),
    );
  }

  const data = parsed.data;

  /* ---------------------------------------------------------------------- */
  /* 3. Idempotency: the same key must return the same reference            */
  /* ---------------------------------------------------------------------- */

  const idempotencyKey = input.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(idempotencyKey);
    if (existing) {
      // A genuine retry of a request that already succeeded. Return the original
      // reference rather than creating a second application.
      return {
        ok: true,
        referenceNumber: existing.referenceNumber,
        receiptToken: receiptTokenFor(idempotencyKey),
        submittedAt: existing.submittedAt.toISOString(),
        created: false,
      };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 4. Consent must reference published documents, right now               */
  /* ---------------------------------------------------------------------- */

  const [terms, privacy] = await Promise.all([
    getPublishedPage('terms'),
    getPublishedPage('privacy'),
  ]);

  const termsPage = terms.ok ? terms.data : null;
  const privacyPage = privacy.ok ? privacy.data : null;

  if (!termsPage || !privacyPage) {
    /*
     * The form is not offered until both documents are published (the assessment
     * page refuses to start without them), so this can only happen if a document
     * was unpublished while a visitor had the form open. Refusing is the only
     * honest answer: we cannot record consent to a document we can no longer show.
     */
    return failure(
      503,
      'consent_unavailable',
      'Our Terms and Privacy Policy are being updated. Please try again shortly.',
    );
  }

  /* ---------------------------------------------------------------------- */
  /* 5. Duplicate prevention                                                */
  /* ---------------------------------------------------------------------- */

  const duplicate = await findRecentDuplicate({
    email: data.personal.email,
    dateOfBirth: data.personal.dateOfBirth,
    fullName: data.personal.fullName,
  });

  if (duplicate) {
    await countFailure(ipHash);
    return failure(
      409,
      'duplicate_submission',
      `We already have an assessment from you (reference ${duplicate}). If you need to change something, contact the agency and quote that reference.`,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* 6. Rate limit the submission itself                                    */
  /* ---------------------------------------------------------------------- */

  /*
   * Counted *after* validation on purpose. A visitor correcting typos should
   * never spend their submission allowance on rejections — `failedAttempt`
   * covers that case — and this way a genuine applicant is only ever counted for
   * an application that is actually about to be written.
   */
  if (ipHash) {
    const limit = await consumeRateLimit({
      key: rateLimitKey('assessment:submit', ipHash),
      windowMs: ASSESSMENT_RATE_LIMITS.submission.windowMs,
      limit: ASSESSMENT_RATE_LIMITS.submission.limit,
    });

    if (!limit.allowed) {
      return failure(
        429,
        'rate_limited',
        'You have submitted several assessments recently. Please contact the agency directly if you need to send another.',
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 7. Prepare server-owned values, then write in one transaction          */
  /* ---------------------------------------------------------------------- */

  const assessmentId = crypto.randomUUID();
  const now = new Date();
  const referenceNumber = generateReferenceNumber();
  // Always present, so a retry is recognisable even when the client sent none.
  const storedKey = idempotencyKey ?? `srv:${assessmentId}`;

  const preferredCountry = await resolvePreferredCountry(data.preferences.preferredCountryId);

  let cv: StoredCv | null = null;
  if (input.cvBytes && input.cvBytes.byteLength > 0) {
    try {
      cv = await storeApplicantCv({
        assessmentId,
        bytes: input.cvBytes,
        filename: input.cvFilename ?? 'cv',
        declaredMimeType: input.cvMimeType ?? null,
      });
    } catch (error) {
      await countFailure(ipHash);
      const message =
        error instanceof Error
          ? error.message
          : 'Your CV could not be accepted. Attach a PDF or Word document.';
      return failure(400, 'cv_rejected', message, { cv: message });
    }
  }

  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [consentRow] = await tx
        .insert(consentRecords)
        .values({
          // Back-linked in the same transaction, once the assessment id exists.
          assessmentId: null,
          termsPageId: termsPage.id,
          // Snapshots: republishing the Terms later cannot rewrite this row.
          termsVersion: termsPage.version,
          privacyPageId: privacyPage.id,
          privacyVersion: privacyPage.version,
          consentText: `${CONSENT_TEXT.terms}\n\n${CONSENT_TEXT.privacy}`,
          acceptedAt: now,
          ipHash,
          userAgent: input.userAgent?.slice(0, 400) ?? null,
        })
        .returning({ id: consentRecords.id });

      if (!consentRow) throw new Error('Consent insert returned no id.');

      const assessmentInsert: typeof assessments.$inferInsert = {
        id: assessmentId,
        referenceNumber,
        idempotencyKey: storedKey,

        fullName: data.personal.fullName,
        dateOfBirth: data.personal.dateOfBirth,
        gender: data.personal.gender,
        nationality: data.personal.nationality,
        countryOfResidence: data.personal.countryOfResidence,
        residentialAddress: data.personal.residentialAddress,
        city: data.personal.city,
        stateProvince: data.personal.stateProvince,
        postalCode: data.personal.postalCode,
        mobileCountryCode: data.personal.mobileCountryCode,
        mobileNumber: data.personal.mobileNumber,
        altMobileCountryCode: data.personal.altMobileCountryCode,
        altMobileNumber: data.personal.altMobileNumber,
        email: data.personal.email,
        maritalStatus: data.personal.maritalStatus,
        hasChildren: data.personal.hasChildren,
        // Already a number or null — the schema normalises it, and the CHECK
        // constraint on `assessments` requires exactly this pairing.
        numberOfChildren: data.personal.numberOfChildren,

        hasPassport: data.passport.hasPassport,
        // The CHECK constraint requires NULL — not "" — when there is no passport.
        passportNumber: data.passport.hasPassport ? data.passport.passportNumber : null,
        passportCityOfIssue: data.passport.hasPassport
          ? data.passport.passportCityOfIssue
          : null,
        passportIssueDate: data.passport.hasPassport ? data.passport.passportIssueDate : null,
        passportExpiryDate: data.passport.hasPassport ? data.passport.passportExpiryDate : null,

        preferredCountryId: preferredCountry?.id ?? null,
        preferredCountryText: preferredCountry?.name ?? '',
        preferredOccupation: data.preferences.preferredOccupation,
        expectedSalaryAmount:
          data.preferences.expectedSalaryAmount === ''
            ? null
            : Number(data.preferences.expectedSalaryAmount.replace(/[,\s]/g, '')),
        expectedSalaryCurrency:
          data.preferences.expectedSalaryAmount === ''
            ? ''
            : data.preferences.expectedSalaryCurrency,

        hasMedicalCondition: data.additional.hasMedicalCondition,
        medicalDetails: data.additional.hasMedicalCondition
          ? data.additional.medicalDetails
          : null,
        hasCriminalRecord: data.additional.hasCriminalRecord,
        criminalRecordDetails: data.additional.hasCriminalRecord
          ? data.additional.criminalRecordDetails
          : null,
        hasTravelledAbroad: data.additional.hasTravelledAbroad,
        travelledCountries: data.additional.hasTravelledAbroad
          ? data.additional.travelledCountries
          : null,
        hasFamilyAbroad: data.additional.hasFamilyAbroad,
        familyAbroadCountries: data.additional.hasFamilyAbroad
          ? data.additional.familyAbroadCountries
          : null,
        hasProfessionalExams: data.additional.hasProfessionalExams,
        professionalExamsNotes: data.additional.hasProfessionalExams
          ? data.additional.professionalExamsNotes
          : null,

        status: 'new',
        submittedAt: now,
        submissionIpHash: ipHash,
        createdAt: now,
        updatedAt: now,
      };

      await tx.insert(assessments).values(assessmentInsert);

      // Back-link the consent row now that the assessment exists.
      await tx
        .update(consentRecords)
        .set({ assessmentId })
        .where(eq(consentRecords.id, consentRow.id));

      /* ---- Child lists ---- */

      if (data.education.length > 0) {
        await tx.insert(applicantEducation).values(
          data.education.map((entry, index) => ({
            assessmentId,
            qualificationLevel: entry.qualificationLevel,
            institutionName: entry.institutionName,
            country: entry.country,
            yearCompleted: entry.yearCompleted,
            displayOrder: index,
          })),
        );
      }

      const employmentRows: Array<typeof applicantEmployment.$inferInsert> = [];

      if (data.employment.status === 'employed') {
        employmentRows.push({
          assessmentId,
          recordType: 'current',
          employerName: data.employment.currentEmployer,
          position: data.employment.currentPosition,
          country: data.employment.currentCountry,
          startDate: data.employment.currentStartDate,
          endDate: null,
          yearsWorked: null,
          monthlySalaryAmount: Number(
            data.employment.currentSalaryAmount.replace(/[,\s]/g, ''),
          ),
          monthlySalaryCurrency: data.employment.currentSalaryCurrency,
          displayOrder: 0,
        });
      }

      data.previousEmployment.forEach((entry, index) => {
        employmentRows.push({
          assessmentId,
          recordType: 'previous',
          employerName: entry.employerName,
          position: entry.position,
          country: entry.country,
          startDate: null,
          endDate: null,
          yearsWorked: entry.yearsWorked,
          monthlySalaryAmount: null,
          monthlySalaryCurrency: '',
          displayOrder: index,
        });
      });

      if (employmentRows.length > 0) {
        await tx.insert(applicantEmployment).values(employmentRows);
      }

      await tx
        .insert(applicantSkills)
        .values(data.skills.map((skill) => ({ assessmentId, skill })));

      if (data.languages.length > 0) {
        await tx.insert(applicantLanguages).values(
          data.languages.map((entry) => ({
            assessmentId,
            language: entry.language,
            proficiency: entry.proficiency,
          })),
        );
      }

      /*
       * Travel and family answers arrive as free text ("Ghana, UK, UAE"). They are
       * split into one row per country so an administrator can filter by country
       * later, without the form demanding a repeatable list for something a
       * visitor can type in one line.
       */
      if (data.additional.hasTravelledAbroad) {
        const list = splitCountries(data.additional.travelledCountries);
        if (list.length > 0) {
          await tx.insert(applicantTravelHistory).values(
            list.map((country, index) => ({
              assessmentId,
              country,
              notes: '',
              displayOrder: index,
            })),
          );
        }
      }

      if (data.additional.hasFamilyAbroad) {
        const list = splitCountries(data.additional.familyAbroadCountries);
        if (list.length > 0) {
          await tx.insert(applicantFamilyAbroad).values(
            list.map((country, index) => ({
              assessmentId,
              country,
              relationship: '',
              displayOrder: index,
            })),
          );
        }
      }

      if (cv) {
        await tx.insert(assessmentAttachments).values({
          assessmentId,
          mediaAssetId: cv.mediaAssetId,
          kind: 'cv',
          createdAt: now,
        });
      }
    });
  } catch (error) {
    // Unwind the private file so a failed transaction cannot leave a CV with no
    // owner. Log the reason without any applicant data.
    if (cv) await discardCv(cv).catch(() => undefined);

    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[assessment] submission failed',
        error instanceof Error ? error.message : error,
      );
    }

    // A concurrent retry with the same key lost the race. Return its reference.
    if (idempotencyKey) {
      const raced = await findByIdempotencyKey(idempotencyKey);
      if (raced) {
        return {
          ok: true,
          referenceNumber: raced.referenceNumber,
          receiptToken: receiptTokenFor(idempotencyKey),
          submittedAt: raced.submittedAt.toISOString(),
          created: false,
        };
      }
    }

    return failure(
      500,
      'submission_failed',
      'We could not save your assessment. Please try again, or contact the agency directly.',
    );
  }

  /* ---------------------------------------------------------------------- */
  /* 8. Audit — attribution without applicant data                          */
  /* ---------------------------------------------------------------------- */

  await writeAuditLog({
    action: 'assessment.submitted',
    actorAdminId: null,
    actorEmail: null,
    entityType: 'assessment',
    entityId: assessmentId,
    summary: `Assessment ${referenceNumber} submitted`,
    metadata: {
      hasCv: cv !== null,
      cvBytes: cv?.sizeBytes ?? 0,
      educationEntries: data.education.length,
      skills: data.skills.length,
      termsVersion: termsPage.version,
      privacyVersion: privacyPage.version,
    },
    ipHash,
  });

  return {
    ok: true,
    referenceNumber,
    receiptToken: receiptTokenFor(storedKey),
    submittedAt: now.toISOString(),
    created: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a preferred destination id.
 *
 * Only a *published* destination is accepted: otherwise an arbitrary string would
 * become a foreign key pointing at a draft or archived country. Returns null when
 * the id is empty or not offerable, and the record then simply has no preference.
 */
async function resolvePreferredCountry(
  preferredCountryId: string,
): Promise<{ id: string; name: string } | null> {
  if (!preferredCountryId) return null;

  const db = getDb();
  const rows = await db
    .select({ id: countries.id, name: countries.name })
    .from(countries)
    .where(
      and(
        eq(countries.id, preferredCountryId),
        eq(countries.status, 'published'),
        isNull(countries.archivedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, name: row.name };
}

/**
 * The receipt token for a submission.
 *
 * Derived from the idempotency key rather than stored, so a retry produces the
 * same value without a column to keep in step — and it is still opaque: it proves
 * nothing except "the browser that held this key submitted this form".
 */
function receiptTokenFor(idempotencyKey: string): string {
  return sha256Hex(`receipt:${idempotencyKey}`).slice(0, 32);
}

/**
 * An existing submission with this idempotency key, if any.
 *
 * Only the reference and timestamp are selected — a retry must not be able to
 * read back any of the applicant's data.
 */
async function findByIdempotencyKey(
  key: string,
): Promise<{ referenceNumber: string; submittedAt: Date } | null> {
  if (!key) return null;

  const db = getDb();
  const rows = await db
    .select({
      referenceNumber: assessments.referenceNumber,
      submittedAt: assessments.submittedAt,
    })
    .from(assessments)
    .where(eq(assessments.idempotencyKey, key))
    .limit(1);

  const row = rows[0];
  return row ? { referenceNumber: row.referenceNumber, submittedAt: row.submittedAt } : null;
}

/**
 * Has this person already submitted recently?
 *
 * Keyed on email *and* date of birth *and* full name. Any one of those alone
 * would either catch too little (a shared family email) or too much (two
 * applicants who happen to share a name).
 */
async function findRecentDuplicate(input: {
  email: string;
  dateOfBirth: string;
  fullName: string;
}): Promise<string | null> {
  const db = getDb();
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const rows = await db
    .select({ referenceNumber: assessments.referenceNumber })
    .from(assessments)
    .where(
      and(
        eq(assessments.email, input.email),
        eq(assessments.dateOfBirth, input.dateOfBirth),
        eq(assessments.fullName, input.fullName),
        gte(assessments.submittedAt, since),
      ),
    )
    .limit(1);

  return rows[0]?.referenceNumber ?? null;
}
