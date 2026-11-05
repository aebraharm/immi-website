/**
 * File validation tests.
 *
 * These exercise the security-critical path that decides whether uploaded bytes
 * are stored: browser-declared MIME types are untrusted, so every case here
 * proves what happens when the claim and the actual bytes disagree.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectFileType, looksLikeDocx } from '../src/lib/files/signatures';
import {
  MAX_UPLOAD_BYTES,
  sanitiseFilename,
  validateUpload,
} from '../src/lib/files/validate';

/** Build a byte array with a given signature prefix. */
function bytesOf(prefix: number[], length = 64): Uint8Array {
  const out = new Uint8Array(Math.max(prefix.length, length));
  out.set(prefix, 0);
  return out;
}

const PDF_PREFIX = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // %PDF-1.7
const PNG_PREFIX = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_PREFIX = [0xff, 0xd8, 0xff, 0xe0];
const ZIP_PREFIX = [0x50, 0x4b, 0x03, 0x04];
const GIF_PREFIX = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a

/** Build a minimal but structurally valid DOCX (ZIP) signature block. */
function docxBytes(): Uint8Array {
  const payload =
    'PK\u0003\u0004' +
    '[Content_Types].xml' +
    '\u0000\u0000\u0000\u0000' +
    'word/document.xml' +
    '\u0000'.repeat(40);
  return new Uint8Array([...payload].map((character) => character.charCodeAt(0)));
}

/** Build a plain ZIP that is NOT a Word document. */
function plainZipBytes(): Uint8Array {
  const payload = 'PK\u0003\u0004' + 'archive/file.txt' + '\u0000'.repeat(60);
  return new Uint8Array([...payload].map((character) => character.charCodeAt(0)));
}

describe('detectFileType — magic number detection', () => {
  it('detects PDF', () => {
    const detected = detectFileType(bytesOf(PDF_PREFIX));
    assert.equal(detected?.mimeType, 'application/pdf');
    assert.equal(detected?.extension, 'pdf');
    assert.equal(detected?.kind, 'document');
  });

  it('detects PNG', () => {
    const detected = detectFileType(bytesOf(PNG_PREFIX));
    assert.equal(detected?.mimeType, 'image/png');
    assert.equal(detected?.kind, 'image');
  });

  it('detects JPEG', () => {
    const detected = detectFileType(bytesOf(JPEG_PREFIX));
    assert.equal(detected?.mimeType, 'image/jpeg');
    assert.equal(detected?.extension, 'jpg');
  });

  it('detects GIF', () => {
    assert.equal(detectFileType(bytesOf(GIF_PREFIX))?.mimeType, 'image/gif');
  });

  it('detects WEBP via RIFF....WEBP', () => {
    const bytes = bytesOf([0x52, 0x49, 0x46, 0x46]); // RIFF
    bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    assert.equal(detectFileType(bytes)?.mimeType, 'image/webp');
  });

  it('detects MP4 via ftyp at offset 4', () => {
    const bytes = bytesOf([0x00, 0x00, 0x00, 0x20]);
    bytes.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
    assert.equal(detectFileType(bytes)?.mimeType, 'video/mp4');
  });

  it('rejects an executable', () => {
    // Windows PE header "MZ"
    assert.equal(detectFileType(bytesOf([0x4d, 0x5a, 0x90, 0x00])), null);
  });

  it('detects a ZIP container as a document candidate', () => {
    // A raw ZIP is detected, then disambiguated by looksLikeDocx().
    assert.equal(detectFileType(bytesOf(ZIP_PREFIX, 128))?.extension, 'docx');
  });

  it('rejects a shell script', () => {
    const script = new Uint8Array([...'#!/bin/sh\nrm -rf /'].map((c) => c.charCodeAt(0)));
    assert.equal(detectFileType(script), null);
  });

  it('rejects SVG markup (deliberate: SVG is executable)', () => {
    const svg = new Uint8Array(
      [...'<svg xmlns="http://www.w3.org/2000/svg"></svg>'].map((c) => c.charCodeAt(0)),
    );
    assert.equal(detectFileType(svg), null);
  });

  it('returns null for empty input', () => {
    assert.equal(detectFileType(new Uint8Array(0)), null);
  });
});

describe('looksLikeDocx — container disambiguation', () => {
  it('accepts a real DOCX structure', () => {
    assert.equal(looksLikeDocx(docxBytes()), true);
  });

  it('rejects a plain ZIP archive', () => {
    assert.equal(looksLikeDocx(plainZipBytes()), false);
  });
});

describe('validateUpload — CV uploads', () => {
  it('accepts a genuine PDF named cv.pdf', () => {
    const result = validateUpload({
      bytes: bytesOf(PDF_PREFIX, 2048),
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      purpose: 'cv',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.mimeType, 'application/pdf');
      assert.equal(result.value.originalFilename, 'cv.pdf');
    }
  });

  it('accepts a genuine DOCX named CV.docx', () => {
    const result = validateUpload({
      bytes: docxBytes(),
      filename: 'CV.docx',
      declaredMimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      purpose: 'cv',
    });
    assert.equal(result.ok, true);
  });

  it('rejects a .pdf that is actually a PNG (extension lie)', () => {
    const result = validateUpload({
      bytes: bytesOf(PNG_PREFIX, 2048),
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      purpose: 'cv',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'type_not_allowed');
  });

  it('rejects a .docx that is only a ZIP archive', () => {
    const result = validateUpload({
      bytes: plainZipBytes(),
      filename: 'cv.docx',
      declaredMimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      purpose: 'cv',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'unrecognised_type');
  });

  it('rejects an image upload for a CV', () => {
    const result = validateUpload({
      bytes: bytesOf(JPEG_PREFIX, 1024),
      filename: 'cv.jpg',
      declaredMimeType: 'image/jpeg',
      purpose: 'cv',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'bad_extension');
  });

  it('rejects a mismatched declared MIME type', () => {
    const result = validateUpload({
      bytes: bytesOf(PDF_PREFIX, 2048),
      filename: 'cv.pdf',
      declaredMimeType: 'image/png',
      purpose: 'cv',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'mime_mismatch');
  });

  it('rejects a CV larger than the 10 MB document limit', () => {
    const oversized = bytesOf(PDF_PREFIX, MAX_UPLOAD_BYTES.document + 1);
    const result = validateUpload({
      bytes: oversized,
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      purpose: 'cv',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'too_large');
  });

  it('rejects an empty file', () => {
    const result = validateUpload({
      bytes: new Uint8Array(0),
      filename: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      purpose: 'cv',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'empty');
  });
});

describe('validateUpload — public media', () => {
  it('accepts a PNG logo', () => {
    const result = validateUpload({
      bytes: bytesOf(PNG_PREFIX, 4096),
      filename: 'logo.png',
      declaredMimeType: 'image/png',
      purpose: 'logo',
    });
    assert.equal(result.ok, true);
  });

  it('rejects a PDF uploaded as a logo', () => {
    const result = validateUpload({
      bytes: bytesOf(PDF_PREFIX, 2048),
      filename: 'logo.png',
      declaredMimeType: 'image/png',
      purpose: 'logo',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'type_not_allowed');
  });

  it('rejects an SVG logo', () => {
    const svg = new Uint8Array([...'<svg></svg>'].map((c) => c.charCodeAt(0)));
    const result = validateUpload({
      bytes: svg,
      filename: 'logo.svg',
      declaredMimeType: 'image/svg+xml',
      purpose: 'logo',
    });
    assert.equal(result.ok, false);
  });

  it('tolerates the harmless image/jpg alias for JPEG', () => {
    const result = validateUpload({
      bytes: bytesOf(JPEG_PREFIX, 2048),
      filename: 'photo.jpg',
      declaredMimeType: 'image/jpg',
      purpose: 'team',
    });
    assert.equal(result.ok, true);
  });
});

describe('sanitiseFilename — path traversal defence', () => {
  it('strips directory components', () => {
    assert.equal(sanitiseFilename('../../etc/passwd'), 'passwd');
  });

  it('strips Windows path components', () => {
    assert.equal(sanitiseFilename('C:\\Users\\evil\\cv.pdf'), 'cv.pdf');
  });

  it('removes control characters', () => {
    assert.equal(sanitiseFilename('cv\u0000.pdf'), 'cv.pdf');
  });

  it('falls back to a safe name when empty', () => {
    assert.equal(sanitiseFilename(''), 'file');
  });

  it('truncates absurdly long names', () => {
    assert.equal(sanitiseFilename('a'.repeat(500) + '.pdf').length, 200);
  });
});
