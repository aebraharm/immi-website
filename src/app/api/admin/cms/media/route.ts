import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { mediaAssets } from '@/db/schema';
import type { MediaPurpose } from '@/db/schema/enums';
import { MEDIA_PURPOSES } from '@/db/schema/enums';
import {
  auditMutation,
  errorResponse,
  guardMutation,
  guardRead,
  ok,
  throttleCmsMutation,
} from '@/lib/cms/api';
import { ingestUpload } from '@/lib/cms/media';
import { mediaAltSchema, mediaPurpose } from '@/lib/cms/schemas';

/**
 * /api/admin/cms/media
 *
 * GET  list the public media library (filtered by purpose, searchable)
 * POST upload one file as multipart/form-data
 *
 * Uploads are the one place the CMS accepts something other than JSON, so this
 * route is also the one place a request body is measured rather than parsed.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Hard ceiling for a single CMS upload: the testimonial video limit. */
const MAX_REQUEST_BYTES = 100 * 1024 * 1024;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await guardRead();

    const url = new URL(request.url);
    const purposeParam = url.searchParams.get('purpose');
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? '';
    const includeArchived = url.searchParams.get('includeArchived') === '1';

    const filters = [];
    if (!includeArchived) filters.push(isNull(mediaAssets.archivedAt));
    if (purposeParam && MEDIA_PURPOSES.includes(purposeParam as MediaPurpose)) {
      filters.push(eq(mediaAssets.purpose, purposeParam as MediaPurpose));
    }
    if (search) {
      filters.push(
        sql`(lower(${mediaAssets.originalFilename}) like ${`%${search}%`} or lower(coalesce(${mediaAssets.altText}, '')) like ${`%${search}%`})`,
      );
    }

    const db = getDb();
    const rows = await db
      .select({
        id: mediaAssets.id,
        storageKey: mediaAssets.storageKey,
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
      .where(and(...filters))
      .orderBy(desc(mediaAssets.createdAt))
      .limit(200);

    // Only public assets are ever exposed here; private applicant documents are
    // a different purpose entirely and are not part of the CMS library.
    const publicRows = rows.filter((row) => row.storageKey.startsWith('public/'));

    return ok({
      items: publicRows.map((row) => ({
        ...row,
        url: `/api/media/${row.storageKey.replace(/^public\//, '')}`,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Role: any content-writing role may upload.
    const admin = await guardMutation(request, ['owner', 'admin', 'editor']);
    await throttleCmsMutation(admin.adminId);

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: 'upload_rejected', message: 'That file is larger than the 100 MB limit.' },
        { status: 413 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'The upload could not be read.' },
        { status: 400 },
      );
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'No file was attached.' },
        { status: 400 },
      );
    }

    const purposeResult = mediaPurpose.safeParse(form.get('purpose'));
    if (!purposeResult.success) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Choose what this file is for.' },
        { status: 400 },
      );
    }

    const altResult = mediaAltSchema.partial().safeParse({
      altText: form.get('altText') ?? '',
      caption: form.get('caption') ?? '',
    });

    const result = await ingestUpload({
      file,
      purpose: purposeResult.data,
      adminId: admin.adminId,
      altText: altResult.success ? altResult.data.altText : undefined,
      caption: altResult.success ? altResult.data.caption : undefined,
    });

    await auditMutation({
      request,
      admin,
      action: 'media.uploaded',
      entityType: 'media',
      entityId: result.id,
      summary: `Uploaded ${purposeResult.data.replace(/-/g, ' ')} file`,
      metadata: { bytes: result.sizeBytes, type: result.mimeType },
    });

    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
