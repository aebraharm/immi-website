/**
 * Applicant CV storage.
 *
 * A CV is the most sensitive thing this website receives, so this module is the
 * only route by which one can be written, and it is deliberately narrow:
 *
 *   1. **The bytes decide the type.** `validateUpload({ purpose: 'cv' })` checks
 *      the signature — a `.pdf` full of HTML, or a ZIP that is not a Word
 *      document, is refused. The browser's `File.type` is recorded only as
 *      forensic metadata and is compared against the detected type.
 *   2. **The key is server-generated** from a UUID inside
 *      `private/assessments/<assessmentId>/cv/`, so no applicant-supplied string
 *      ever reaches a filesystem path or a URL.
 *   3. **Visibility is `private`** at the storage layer — not a flag this module
 *      remembers to set. `publicUrlFor()` throws for a private key, and the public
 *      media proxy only ever looks up `visibility = 'public'` rows.
 *   4. **Rows and bytes agree.** If the registry insert fails, the object is
 *      deleted again; a database row is never written for bytes that are not
 *      there, and bytes are never left behind without a row.
 *
 * Nothing here is imported by any public read path.
 */

import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { mediaAssets } from '@/db/schema';
import { validateUpload } from '@/lib/files/validate';
import { buildStorageKey, getStorage } from '@/lib/storage';

export type StoredCv = {
  mediaAssetId: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksumSha256: string;
  originalFilename: string;
};

export class CvRejectedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CvRejectedError';
    this.code = code;
  }
}

/** What a browser may be told went wrong. Never includes paths or storage keys. */
export const CV_REJECTION_MESSAGES = {
  empty: 'That file is empty. Choose your CV again.',
  too_large: 'Your CV must be 10 MB or smaller.',
  bad_extension: 'Attach your CV as a PDF (.pdf) or Word document (.docx).',
  unrecognised_type: 'That file is not a PDF or Word document. Attach your CV in one of those formats.',
  type_not_allowed: 'That file type cannot be attached. Attach your CV as a PDF or Word document.',
  mime_mismatch: 'The file does not match its type. Save your CV again and re-attach it.',
} as const;

/**
 * Validate and store an applicant's CV in private storage.
 *
 * @param params.assessmentId The row the CV belongs to. Used for the storage
 *                            scope so all of one applicant's files live together
 *                            and a deletion can be audited per assessment.
 * @param params.declaredMimeType What the browser claimed — untrusted.
 */
export async function storeApplicantCv(params: {
  assessmentId: string;
  bytes: Uint8Array;
  filename: string;
  declaredMimeType: string | null;
}): Promise<StoredCv> {
  const validation = validateUpload({
    bytes: params.bytes,
    filename: params.filename,
    declaredMimeType: params.declaredMimeType,
    purpose: 'cv',
  });

  if (!validation.ok) {
    /*
     * `validate.ts` already writes applicant-facing sentences, and for
     * `unrecognised_type` its message is more specific than ours can be — it
     * distinguishes "a ZIP archive, not a Word document" from "not a supported
     * file at all". Prefer it where it exists, and keep our map as the fallback
     * for the codes it cannot describe.
     */
    throw new CvRejectedError(
      validation.error.code,
      validation.error.message || CV_REJECTION_MESSAGES[validation.error.code],
    );
  }

  const { detected, originalFilename, sizeBytes } = validation.value;

  const storageKey = buildStorageKey({
    // `private` is not a preference here — it decides both the key prefix and
    // the store the bytes are written to.
    visibility: 'private',
    purpose: 'cv',
    extension: detected.extension,
    scopeId: params.assessmentId,
  });

  const storage = getStorage();

  const stored = await storage.put({
    key: storageKey,
    body: params.bytes,
    contentType: detected.mimeType,
    visibility: 'private',
    originalFilename,
  });

  const db = getDb();

  try {
    const [row] = await db
      .insert(mediaAssets)
      .values({
        storageKey: stored.key,
        storageProvider: storage.provider,
        visibility: 'private',
        purpose: 'cv',
        originalFilename,
        storedFilename: stored.key.split('/').pop() ?? stored.key,
        declaredMimeType: params.declaredMimeType,
        detectedMimeType: detected.mimeType,
        extension: detected.extension,
        sizeBytes,
        checksumSha256: stored.checksumSha256,
        // No `uploadedBy`: an applicant is not an administrator. The relationship
        // is recorded on `assessment_attachments` instead.
        uploadedBy: null,
      })
      .returning({ id: mediaAssets.id });

    if (!row) throw new Error('CV registry insert returned no id.');

    return {
      mediaAssetId: row.id,
      storageKey: stored.key,
      mimeType: detected.mimeType,
      extension: detected.extension,
      sizeBytes,
      checksumSha256: stored.checksumSha256,
      originalFilename,
    };
  } catch (error) {
    // Roll the bytes back so a failed submission cannot leave an orphaned
    // private file in storage.
    await storage.delete(stored.key, 'private').catch(() => undefined);
    throw error;
  }
}

/**
 * Delete a CV's bytes and registry row.
 *
 * Used only to unwind a submission whose database transaction failed. A normal
 * removal is a deliberate, logged, two-step administrator operation (Phase 6) —
 * the `ON DELETE RESTRICT` on `assessment_attachments` exists to force that.
 */
export async function discardCv(cv: { mediaAssetId: string; storageKey: string }): Promise<void> {
  const db = getDb();
  const storage = getStorage();

  await storage.delete(cv.storageKey, 'private').catch(() => undefined);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, cv.mediaAssetId));
}