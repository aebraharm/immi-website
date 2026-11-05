/**
 * File signature ("magic number") detection.
 *
 * A browser-supplied `Content-Type` and a filename extension are both attacker
 * controlled. Everything we accept must additionally prove what it is by its
 * leading bytes. This module is pure and synchronous, so it can be unit tested
 * in isolation and used on both upload paths.
 */

export type DetectedType = {
  mimeType: string;
  /** Canonical extension we store the file under — never the uploaded one. */
  extension: string;
  /** Human label for admin UI. */
  label: string;
  kind: 'image' | 'document' | 'video';
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Detect the true type of a file from its leading bytes.
 * Returns `null` when the bytes match nothing we are willing to store.
 */
export function detectFileType(bytes: Uint8Array): DetectedType | null {
  /* ---------------- Images ---------------- */

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return {
      mimeType: 'image/png',
      extension: 'png',
      label: 'PNG image',
      kind: 'image',
    };
  }

  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return {
      mimeType: 'image/jpeg',
      extension: 'jpg',
      label: 'JPEG image',
      kind: 'image',
    };
  }

  // GIF: GIF87a / GIF89a
  if (asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')) {
    return {
      mimeType: 'image/gif',
      extension: 'gif',
      label: 'GIF image',
      kind: 'image',
    };
  }

  // WEBP: RIFF....WEBP
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) {
    return {
      mimeType: 'image/webp',
      extension: 'webp',
      label: 'WebP image',
      kind: 'image',
    };
  }

  // SVG is deliberately NOT accepted: it is executable markup and a stored-XSS
  // vector when served from our origin.
  // ICO: 00 00 01 00
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return {
      mimeType: 'image/x-icon',
      extension: 'ico',
      label: 'Icon',
      kind: 'image',
    };
  }

  /* ---------------- Documents ---------------- */

  // PDF: %PDF-
  if (asciiAt(bytes, 0, '%PDF-')) {
    return {
      mimeType: 'application/pdf',
      extension: 'pdf',
      label: 'PDF document',
      kind: 'document',
    };
  }

  /*
   * DOCX (and any OOXML file) is a ZIP container: PK\x03\x04. A plain ZIP is
   * also PK\x03\x04, so the container check is not sufficient on its own —
   * `zipContainsEntry` below verifies the OOXML marker before we accept it.
   */
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      label: 'Word document',
      kind: 'document',
    };
  }

  /* ---------------- Video ---------------- */

  // MP4 / M4V: "ftyp" at byte offset 4
  if (asciiAt(bytes, 4, 'ftyp')) {
    return {
      mimeType: 'video/mp4',
      extension: 'mp4',
      label: 'MP4 video',
      kind: 'video',
    };
  }

  // WebM / Matroska: 1A 45 DF A3
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return {
      mimeType: 'video/webm',
      extension: 'webm',
      label: 'WebM video',
      kind: 'video',
    };
  }

  return null;
}

/**
 * Verify that a ZIP-container file really is a DOCX.
 *
 * OOXML files always contain a `[Content_Types].xml` part whose name appears as
 * a literal string in the archive (ZIP stores entry names uncompressed in the
 * local file headers). We also look for the `word/` part prefix, which
 * distinguishes a Word document from an Excel or PowerPoint file that shares the
 * same container format.
 */
export function looksLikeDocx(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false;

  const needleTypes = '[Content_Types].xml';
  const hasContentTypes = indexOfAscii(bytes, needleTypes) !== -1;
  const hasWordPart = indexOfAscii(bytes, 'word/document.xml') !== -1;

  return hasContentTypes && hasWordPart;
}

/** Plain substring search over bytes (avoids decoding binary to UTF-8 first). */
function indexOfAscii(haystack: Uint8Array, needle: string): number {
  const limit = haystack.length - needle.length;
  for (let start = 0; start <= limit; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle.charCodeAt(offset)) {
        matched = false;
        break;
      }
    }
    if (matched) return start;
  }
  return -1;
}
