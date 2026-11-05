import { NextResponse } from 'next/server';

import { IDEMPOTENCY_HEADER, MAX_SUBMISSION_REQUEST_BYTES } from '@/lib/assessment/config';
import { submitAssessment } from '@/lib/assessment/submit';
import { clientIpHash } from '@/lib/auth/session';

/**
 * POST /api/assessment — the only public write endpoint on the site.
 *
 * The order of operations is the security model, and it is deliberate:
 *
 *   1. **Content type.** Only `multipart/form-data` is accepted, because a
 *      submission carries a CV. A JSON POST is refused before any body is read.
 *   2. **Size.** `content-length` is checked against a hard ceiling *before*
 *      `formData()` buffers anything. A body that lies about its length is caught
 *      again once parsed.
 *   3. **Everything else happens in `submitAssessment`** — honeypot, rate limits,
 *      whole-form Zod validation, consent against published policy versions,
 *      duplicate detection, then one transaction.
 *
 * What this route never does:
 *
 *  - It never returns applicant data. The success body is a reference number, a
 *    timestamp and a receipt token; the error body is a message and per-field
 *    messages.
 *  - It never echoes an exception. Unexpected failures become one generic 500.
 *  - It never accepts a session, because applicants have no account. There is no
 *    identity to check and nothing to authorise — the record is write-only.
 *
 * There is deliberately no GET handler: a reference number is not a read key, and
 * an applicant cannot retrieve a submission afterwards.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/**
 * Ceiling for the JSON answers alone.
 *
 * Sixty kilobytes is far more than eleven steps of text can produce; it exists so
 * that a crafted request cannot make the server JSON-parse a multi-megabyte
 * string before validation gets a chance to reject it.
 */
const MAX_ANSWERS_BYTES = 60 * 1024;

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return json(
        { error: 'invalid_request', message: 'This form must be submitted as a file upload.' },
        415,
      );
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SUBMISSION_REQUEST_BYTES) {
      return json(
        {
          error: 'too_large',
          message: 'Your CV is too large. The maximum size is 10 MB.',
        },
        413,
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'invalid_request', message: 'The submission could not be read.' }, 400);
    }

    const payloadRaw = form.get('payload');
    if (typeof payloadRaw !== 'string' || payloadRaw.length === 0) {
      return json(
        { error: 'invalid_request', message: 'No assessment answers were received.' },
        400,
      );
    }

    /*
     * `content-length` is a claim, so the answers are measured again from what we
     * actually parsed. The CV has its own byte-level ceiling inside
     * `validateUpload` (10 MB for a document), applied to the bytes rather than to
     * any header.
     */
    if (payloadRaw.length > MAX_ANSWERS_BYTES) {
      return json(
        { error: 'too_large', message: 'That submission is larger than we can accept.' },
        413,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return json({ error: 'invalid_request', message: 'The submission could not be read.' }, 400);
    }

    const cv = form.get('cv');
    let cvBytes: Uint8Array | null = null;
    let cvFilename = '';
    let cvMimeType: string | null = null;

    if (cv instanceof File && cv.size > 0) {
      // Read the bytes ourselves; `cv.type` and `cv.name` are only ever advisory.
      cvBytes = new Uint8Array(await cv.arrayBuffer());
      cvFilename = cv.name || 'cv';
      cvMimeType = cv.type || null;
    }

    const result = await submitAssessment({
      payload,
      idempotencyKey: request.headers.get(IDEMPOTENCY_HEADER),
      ipHash: clientIpHash(request.headers),
      userAgent: request.headers.get('user-agent'),
      cvBytes,
      cvFilename,
      cvMimeType,
    });

    if (!result.ok) {
      return json(
        {
          ok: false,
          error: result.code,
          message: result.message,
          fieldErrors: result.fieldErrors,
        },
        result.status,
      );
    }

    return json(
      {
        ok: true,
        referenceNumber: result.referenceNumber,
        submittedAt: result.submittedAt,
        receiptToken: result.receiptToken,
      },
      201,
    );
  } catch (error) {
    /*
     * A single, generic response. The applicant is told what to do; nothing about
     * the failure — table names, stack frames, storage paths — reaches them. The
     * detail goes to the server log only, and without applicant data.
     */
    console.error(
      '[assessment] unhandled submission error',
      error instanceof Error ? error.message : 'unknown',
    );

    return json(
      {
        error: 'submission_failed',
        message:
          'We could not save your assessment just now. Please try again in a moment, or contact the agency directly.',
      },
      500,
    );
  }
}

/** Any other method is refused explicitly rather than falling through to a 405 page. */
export function GET(): NextResponse {
  return json({ error: 'method_not_allowed' }, 405);
}
