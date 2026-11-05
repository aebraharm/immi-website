import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { mediaAssets } from '@/db/schema';
import { getStorage } from '@/lib/storage';

/**
 * Public media proxy.
 *
 * Serves **public** media only, through our own origin. There are four reasons
 * this exists instead of handing out raw storage URLs:
 *
 *  1. One origin keeps the Content-Security-Policy tight (`img-src 'self'`).
 *  2. Cache headers are controlled centrally.
 *  3. Swapping storage providers never breaks a stored page.
 *  4. — most importantly — it is where an uploaded file's real type is enforced.
 *
 * Security properties:
 *  - Only rows with `visibility = 'public'` are ever looked up, so a private
 *    applicant document cannot be reached even with a guessed key.
 *  - Archived assets return 404.
 *  - The response type comes from the *server-detected* MIME type stored at
 *    upload time, never from a client-supplied header.
 *  - `X-Content-Type-Options: nosniff` plus a `Content-Security-Policy` that
 *    forbids scripts stops a disguised file from executing in a browser.
 */

export const dynamic = 'force-dynamic';

/**
 * Types we are willing to serve. SVG is absent by design: it is executable
 * markup, and an uploaded "logo" must not be able to run script on our origin.
 */
const SERVABLE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/x-icon',
  'video/mp4',
  'video/webm',
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const { key: segments } = await context.params;

  // Reconstruct the storage key. The public prefix is implicit in the route.
  const relativeKey = segments.join('/');

  if (!relativeKey || relativeKey.includes('..') || relativeKey.includes('\\')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const storageKey = `public/${relativeKey}`;

  try {
    const db = getDb();

    const rows = await db
      .select({
        storageKey: mediaAssets.storageKey,
        visibility: mediaAssets.visibility,
        detectedMimeType: mediaAssets.detectedMimeType,
        archivedAt: mediaAssets.archivedAt,
        sizeBytes: mediaAssets.sizeBytes,
      })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.storageKey, storageKey),
          // Hard-coded public filter: a private row can never match.
          eq(mediaAssets.visibility, 'public'),
        ),
      )
      .limit(1);

    const asset = rows[0];

    if (!asset || asset.archivedAt !== null) {
      return new NextResponse('Not found', { status: 404 });
    }

    if (!SERVABLE_TYPES.has(asset.detectedMimeType)) {
      // A type we do not serve publicly (e.g. a document) is treated as absent.
      return new NextResponse('Not found', { status: 404 });
    }

    const storage = getStorage();
    const object = await storage.get(asset.storageKey, 'public');

    if (!object) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Normalise the payload: the local adapter may hand back a stream, the
    // Blobs adapter an array. Either way we send bytes with an explicit
    // Content-Type and an immutable cache header.
    let payload: ArrayBuffer | ReadableStream<Uint8Array>;

    if (object.body instanceof Uint8Array) {
      const copy = new Uint8Array(object.body.byteLength);
      copy.set(object.body);
      payload = copy.buffer;
    } else {
      payload = object.body;
    }

    return new NextResponse(payload as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': asset.detectedMimeType,
        'Content-Length': String(object.size),
        // Immutable: keys are content-unique UUIDs, so a cached copy is always
        // the right copy.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch {
    // Never leak a database or storage error to an anonymous visitor.
    return new NextResponse('Media unavailable', { status: 503 });
  }
}
