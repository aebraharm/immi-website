/**
 * Media ingest.
 *
 * One function handles every upload — logo, favicon, team photo, service image,
 * testimonial video, OG image. It does five things in a fixed order, and the
 * order is the security model:
 *
 *   1. **Read the bytes ourselves.** The declared size and MIME type are ignored;
 *      nothing is trusted until it has been measured.
 *   2. **Validate the bytes** with `lib/files/validate.ts` — size ceiling,
 *      extension allowlist *for this purpose*, and magic-number detection. A
 *      `.png` full of HTML is rejected here.
 *   3. **Generate the storage key from a fresh UUID.** The uploaded filename
 *      never reaches a path or a URL, so `../../` is not expressible.
 *   4. **Store the bytes**, then insert the registry row. If the row insert fails
 *      the object is removed again, so an orphan cannot accumulate.
 *   5. **Archive, never overwrite.** Replacing a logo archives the old asset
 *      (the row survives, so the audit trail and any page still pointing at it
 *      remain coherent) and the new one gets a new key. Media URLs are therefore
 *      immutable and can be cached for a year.
 *
 * Public and private live in different storage prefixes and are enforced at the
 * storage layer; a CMS upload is always `public`.
 */

import { eq, sql } from 'drizzle-orm';

import { getDb } from '@/db';
import { mediaAssets } from '@/db/schema';
import type { MediaPurpose } from '@/db/schema/enums';
import { validateUpload } from '@/lib/files/validate';
import { buildStorageKey, getStorage } from '@/lib/storage';

import { CmsError } from './api';

export type UploadResult = {
  id: string;
  url: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  purpose: MediaPurpose;
  originalFilename: string;
};

/** Extract pixel dimensions for the formats we accept. Best-effort only. */
function imageDimensions(
  bytes: Uint8Array,
  mime: string,
): { width: number | null; height: number | null } {
  try {
    if (mime === 'image/png' && bytes.length > 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }

    if (mime === 'image/webp' && bytes.length > 30) {
      // Lossy WebP: "VP8 " then two 14-bit sizes. Lossless: "VP8L".
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const fourCC = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
      if (fourCC === 'VP8 ' && bytes.length > 30) {
        return {
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff,
        };
      }
      if (fourCC === 'VP8L' && bytes.length > 25) {
        const b = bytes;
        const bits =
          (b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)) >>> 0;
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return { width: null, height: null };
    }

    if ((mime === 'image/jpeg' || mime === 'image/jpg') && bytes.length > 4) {
      // Walk the JPEG segments looking for a Start-Of-Frame marker.
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1]!;
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) {
          const height = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
          const width = (bytes[offset + 7]! << 8) | bytes[offset + 8]!;
          return { width, height };
        }
        const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
        if (length < 2) break;
        offset += 2 + length;
      }
      return { width: null, height: null };
    }

    return { width: null, height: null };
  } catch {
    return { width: null, height: null };
  }
}

export async function ingestUpload(params: {
  file: File;
  purpose: MediaPurpose;
  adminId: string;
  altText?: string;
  caption?: string;
}): Promise<UploadResult> {
  const { file, purpose, adminId } = params;

  const buffer = new Uint8Array(await file.arrayBuffer());

  if (buffer.byteLength === 0) {
    throw new CmsError(400, 'upload_empty', 'That file is empty.');
  }

  const validation = validateUpload({
    purpose,
    bytes: buffer,
    declaredMimeType: file.type || null,
    filename: file.name || 'upload',
  });

  if (!validation.ok) {
    throw new CmsError(400, 'upload_rejected', validation.error.message);
  }

  const { detected } = validation.value;

  /*
   * A CV is the one purpose whose bytes belong in private storage. `validateUpload`
   * happily accepts a PDF for `purpose: 'cv'`, and `MediaPurpose` includes `cv`
   * because applicant attachments reuse the same enum — so without this check the
   * public library endpoint would accept an applicant document and write it under
   * `public/`, storing real personal data in the public media store.
   *
   * This is defence in depth rather than the only control: the public media proxy
   * refuses to serve documents at all, and the UI excludes `cv` from its purpose
   * list. Both of those are the kind of thing a future change can quietly undo.
   */
  if (purpose === 'cv' || detected.kind === 'document') {
    throw new CmsError(
      400,
      'upload_rejected',
      'Applicant documents cannot be uploaded to the public media library. They are stored privately, with the application they belong to.',
    );
  }

  const storageKey = buildStorageKey({
    visibility: 'public',
    purpose,
    extension: detected.extension,
  });

  const storage = getStorage();
  const stored = await storage.put({
    key: storageKey,
    body: buffer,
    contentType: detected.mimeType,
    visibility: 'public',
    originalFilename: file.name,
  });

  const db = getDb();
  const { width, height } = imageDimensions(buffer, detected.mimeType);

  try {
    const [row] = await db
      .insert(mediaAssets)
      .values({
        storageKey: stored.key,
        storageProvider: storage.provider,
        visibility: 'public',
        purpose,
        originalFilename: validation.value.originalFilename,
        storedFilename: stored.key.split('/').pop() ?? stored.key,
        declaredMimeType: file.type || null,
        detectedMimeType: detected.mimeType,
        extension: detected.extension,
        sizeBytes: stored.size,
        width,
        height,
        checksumSha256: stored.checksumSha256,
        altText: params.altText?.slice(0, 500) || null,
        caption: params.caption?.slice(0, 500) || null,
        uploadedBy: adminId,
      })
      .returning({ id: mediaAssets.id });

    if (!row) throw new Error('Media insert returned no id.');

    return {
      id: row.id,
      url: storage.publicUrl(stored.key),
      storageKey: stored.key,
      mimeType: detected.mimeType,
      sizeBytes: stored.size,
      width,
      height,
      purpose,
      originalFilename: file.name,
    };
  } catch (error) {
    // Never leave bytes behind that no row points at.
    await storage.delete(stored.key, 'public').catch(() => undefined);
    throw error;
  }
}

/**
 * Archive an asset and forget where it lives.
 *
 * The row stays so that audit entries and any historical reference still resolve
 * to "this file was removed on <date>" rather than to nothing at all. The public
 * media route already treats an archived asset as absent.
 */
async function requirePublicMediaAsset(id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      visibility: mediaAssets.visibility,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);

  if (!row || row.visibility !== 'public' || !row.storageKey.startsWith('public/')) {
    throw new CmsError(404, 'not_found', 'That file no longer exists.');
  }

  return { db, storageKey: row.storageKey };
}

export async function archiveMediaAsset(id: string): Promise<{ storageKey: string }> {
  const { db, storageKey } = await requirePublicMediaAsset(id);

  await db
    .update(mediaAssets)
    .set({ archivedAt: new Date() })
    .where(eq(mediaAssets.id, id));

  return { storageKey };
}

/** Restore an archived public asset so it can be referenced again. */
export async function restoreMediaAsset(id: string): Promise<void> {
  const { db } = await requirePublicMediaAsset(id);
  await db.update(mediaAssets).set({ archivedAt: null }).where(eq(mediaAssets.id, id));
}

export async function updateMediaMetadata(params: {
  id: string;
  altText: string;
  caption: string;
}): Promise<void> {
  const { db } = await requirePublicMediaAsset(params.id);

  await db
    .update(mediaAssets)
    .set({
      altText: params.altText.slice(0, 500) || null,
      caption: params.caption.slice(0, 500) || null,
    })
    .where(eq(mediaAssets.id, params.id));
}

/**
 * How many places still point at this asset.
 *
 * Deleting a logo that the header is using would leave the site with a broken
 * image, so the UI asks before archiving and this makes the consequence concrete.
 */
export async function countAssetReferences(id: string): Promise<number> {
  const db = getDb();
  // A single count across every column that can hold a media id. Written as raw
  // SQL because the columns live in eight different tables.
  const result = await db.run(sql`
      SELECT
        (SELECT count(*) FROM site_settings WHERE logo_asset_id = ${id}
           OR logo_dark_asset_id = ${id} OR favicon_asset_id = ${id} OR og_image_asset_id = ${id})
      + (SELECT count(*) FROM services WHERE image_asset_id = ${id})
      + (SELECT count(*) FROM homepage_sections WHERE image_asset_id = ${id})
      + (SELECT count(*) FROM countries WHERE flag_asset_id = ${id} OR hero_image_asset_id = ${id})
      + (SELECT count(*) FROM destinations WHERE hero_image_asset_id = ${id})
      + (SELECT count(*) FROM testimonials WHERE photo_asset_id = ${id} OR video_asset_id = ${id})
      + (SELECT count(*) FROM team_members WHERE photo_asset_id = ${id})
      + (SELECT count(*) FROM seo_settings WHERE og_image_asset_id = ${id})
      AS total
  `);

  const row = result.rows[0] as { total?: number } | undefined;
  return Number(row?.total ?? 0);
}
