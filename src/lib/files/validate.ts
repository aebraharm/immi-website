import type { MediaPurpose } from '@/db/schema/enums';

import { detectFileType, looksLikeDocx, type DetectedType } from './signatures';

/**
 * Server-side upload validation.
 *
 * The rules that matter, in order:
 *  1. Size is checked from the byte length we actually received, not from a
 *     client-declared size.
 *  2. The extension must be on the allowlist for the purpose.
 *  3. The bytes must match a known signature.
 *  4. The signature must be consistent with the declared MIME type *and* with
 *     the purpose (a PDF can never become a team photo).
 *
 * Failures return a structured result rather than throwing, so API routes can
 * map them to specific, non-leaking messages.
 */

export const MAX_UPLOAD_BYTES = {
  image: 8 * 1024 * 1024, // 8 MB
  document: 10 * 1024 * 1024, // 10 MB — applicant CVs
  video: 100 * 1024 * 1024, // 100 MB — testimonial videos
} as const;

type PurposeRule = {
  /** Which detected kinds are acceptable. */
  allow: ReadonlyArray<'image' | 'document' | 'video'>;
  /** Extensions the uploaded filename may claim. */
  extensions: readonly string[];
};

/**
 * Per-purpose allowlist. Adding a new media use means adding a row here — the
 * default is to reject.
 */
export const PURPOSE_RULES: Record<MediaPurpose, PurposeRule> = {
  logo: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  favicon: { allow: ['image'], extensions: ['png', 'ico'] },
  flag: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  destination: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  team: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  'testimonial-photo': {
    allow: ['image'],
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
  },
  'testimonial-video': { allow: ['video'], extensions: ['mp4', 'webm'] },
  service: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  homepage: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  page: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  seo: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
  // Applicant CVs: exactly the formats the specification requires.
  cv: { allow: ['document'], extensions: ['pdf', 'docx'] },
  other: { allow: ['image'], extensions: ['png', 'jpg', 'jpeg', 'webp'] },
};

export type UploadValidationError = {
  code:
    | 'empty'
    | 'too_large'
    | 'bad_extension'
    | 'unrecognised_type'
    | 'type_not_allowed'
    | 'mime_mismatch';
  message: string;
};

export type ValidatedUpload = {
  detected: DetectedType;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
};

function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? (parts.at(-1) ?? '') : '';
}

/** Remove any path components a client may have included in the filename. */
export function sanitiseFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned.length > 0 ? cleaned : 'file').slice(0, 200);
}

export function validateUpload(params: {
  bytes: Uint8Array;
  filename: string;
  declaredMimeType: string | null;
  purpose: MediaPurpose;
}): { ok: true; value: ValidatedUpload } | { ok: false; error: UploadValidationError } {
  const { bytes, purpose } = params;
  const filename = sanitiseFilename(params.filename);
  const rule = PURPOSE_RULES[purpose];

  if (bytes.byteLength === 0) {
    return { ok: false, error: { code: 'empty', message: 'The file is empty.' } };
  }

  // 2. Extension allowlist for this purpose.
  const extension = extensionOf(filename);
  if (!rule.extensions.includes(extension)) {
    return {
      ok: false,
      error: {
        code: 'bad_extension',
        message: `Accepted file types here: ${rule.extensions.join(', ')}.`,
      },
    };
  }

  // 3. What are these bytes, really?
  const detected = detectFileType(bytes);
  if (!detected) {
    return {
      ok: false,
      error: {
        code: 'unrecognised_type',
        message: 'The file contents do not match any supported file type.',
      },
    };
  }

  /*
   * A ZIP container may be a DOCX, an XLSX, or an arbitrary archive. Only accept
   * it as a Word document when the OOXML parts are actually present.
   */
  if (detected.extension === 'docx' && !looksLikeDocx(bytes)) {
    return {
      ok: false,
      error: {
        code: 'unrecognised_type',
        message: 'That file is a ZIP archive, not a Word document.',
      },
    };
  }

  // 4. Does the detected kind suit this purpose?
  if (!rule.allow.includes(detected.kind)) {
    return {
      ok: false,
      error: {
        code: 'type_not_allowed',
        message: `A ${detected.label.toLowerCase()} cannot be used here.`,
      },
    };
  }

  // 5. Declared MIME must not contradict the bytes. A mismatch is a strong
  //    signal of a deliberate attack rather than a harmless browser quirk, so it
  //    is rejected outright.
  const declared = params.declaredMimeType?.toLowerCase().trim() ?? '';
  if (declared.length > 0 && declared !== detected.mimeType) {
    const harmlessJpegAlias =
      detected.mimeType === 'image/jpeg' && declared === 'image/jpg';
    const docxAlias =
      detected.extension === 'docx' &&
      declared === 'application/msword';

    if (!harmlessJpegAlias && !docxAlias) {
      return {
        ok: false,
        error: {
          code: 'mime_mismatch',
          message:
            'The file type reported by your browser does not match the file contents.',
        },
      };
    }
  }

  // 6. Size, measured from the bytes we hold.
  const limit = MAX_UPLOAD_BYTES[detected.kind];
  if (bytes.byteLength > limit) {
    return {
      ok: false,
      error: {
        code: 'too_large',
        message: `Maximum size for this file type is ${Math.round(limit / (1024 * 1024))} MB.`,
      },
    };
  }

  return {
    ok: true,
    value: {
      detected,
      // Store under the *detected* extension, not the claimed one.
      extension: detected.extension,
      mimeType: detected.mimeType,
      sizeBytes: bytes.byteLength,
      originalFilename: filename,
    },
  };
}

/** Quick pre-flight check used before reading a request body. */
export function isWithinHardLimit(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES.video;
}
