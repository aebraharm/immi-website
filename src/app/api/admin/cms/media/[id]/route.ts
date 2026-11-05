import { eq } from 'drizzle-orm';
import type { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDb } from '@/db';
import { mediaAssets } from '@/db/schema';
import {
  CmsError,
  auditMutation,
  errorResponse,
  guardMutation,
  ok,
  parseBody,
  readJson,
  throttleCmsMutation,
} from '@/lib/cms/api';
import {
  archiveMediaAsset,
  countAssetReferences,
  restoreMediaAsset,
  updateMediaMetadata,
} from '@/lib/cms/media';

/**
 * /api/admin/cms/media/[id]
 *
 * GET    metadata, including how many places currently reference the file
 * PUT    edit alt text and caption
 * DELETE archive it (`?mode=restore` brings it back)
 *
 * There is no endpoint that erases bytes. Archiving hides the file from the
 * public site while keeping the registry row, so any page still pointing at it
 * resolves to "removed" rather than to a broken image.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const metadataSchema = z.object({
  altText: z.string().trim().max(500),
  caption: z.string().trim().max(500),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await (await import('@/lib/cms/api')).guardRead();
    const { id } = await context.params;

    const db = getDb();
    const [row] = await db
      .select({
        id: mediaAssets.id,
        storageKey: mediaAssets.storageKey,
        visibility: mediaAssets.visibility,
        purpose: mediaAssets.purpose,
        originalFilename: mediaAssets.originalFilename,
        detectedMimeType: mediaAssets.detectedMimeType,
        sizeBytes: mediaAssets.sizeBytes,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        caption: mediaAssets.caption,
        createdAt: mediaAssets.createdAt,
        archivedAt: mediaAssets.archivedAt,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);

    // The generic media library is strictly public. Private applicant records
    // are only addressed through the assessment download route, which performs
    // the assessment+attachment authorization checks and never returns a key.
    if (!row || row.visibility !== 'public' || !row.storageKey.startsWith('public/')) {
      throw new CmsError(404, 'not_found', 'That file no longer exists.');
    }

    return ok({
      id: row.id,
      purpose: row.purpose,
      originalFilename: row.originalFilename,
      detectedMimeType: row.detectedMimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      altText: row.altText,
      caption: row.caption,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
      url: `/api/media/${row.storageKey.replace(/^public\//, '')}`,
      referenceCount: await countAssetReferences(id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const admin = await guardMutation(request, ['owner', 'admin', 'editor']);
    await throttleCmsMutation(admin.adminId);
    const { id } = await context.params;

    const input = await parseBody(metadataSchema, await readJson(request));
    await updateMediaMetadata({ id, ...input });

    await auditMutation({
      request,
      admin,
      action: 'media.uploaded',
      entityType: 'media',
      entityId: id,
      summary: 'Updated file description',
    });

    return ok({ id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const admin = await guardMutation(request, ['owner', 'admin', 'editor']);
    await throttleCmsMutation(admin.adminId);
    const { id } = await context.params;

    const mode = new URL(request.url).searchParams.get('mode') ?? 'archive';

    if (mode === 'restore') {
      await restoreMediaAsset(id);
      await auditMutation({
        request,
        admin,
        action: 'media.uploaded',
        entityType: 'media',
        entityId: id,
        summary: 'Restored a file to the library',
      });
      return ok({ id, mode: 'restored' });
    }

    await archiveMediaAsset(id);

    await auditMutation({
      request,
      admin,
      action: 'media.archived',
      entityType: 'media',
      entityId: id,
      summary: 'Archived a file',
    });

    return ok({ id, mode: 'archived' });
  } catch (error) {
    return errorResponse(error);
  }
}
