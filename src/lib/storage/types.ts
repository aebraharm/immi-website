/**
 * Storage abstraction.
 *
 * The application never talks to Netlify Blobs or the filesystem directly — it
 * talks to this interface. That gives us three things:
 *
 *  1. Local development with no cloud credentials.
 *  2. A hard, type-level distinction between public and private bytes, so a
 *     private CV can never be served by a public code path.
 *  3. One place to enforce size limits and content checks.
 */

import type { MediaVisibility, StorageProvider } from '@/db/schema/enums';

export type StoredObject = {
  /** Path within the store, e.g. `public/logo/<uuid>.png`. */
  key: string;
  visibility: MediaVisibility;
  size: number;
  contentType: string;
  checksumSha256: string;
};

export type PutObjectInput = {
  key: string;
  body: ArrayBuffer | Uint8Array;
  contentType: string;
  visibility: MediaVisibility;
  /** Stored as object metadata for diagnostics; never used for trust. */
  originalFilename?: string;
};

export type GetObjectResult = {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
  size: number;
  /** Populated for private downloads so responses can force an attachment. */
  originalFilename?: string;
};

export interface StorageAdapter {
  readonly provider: StorageProvider;

  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string, visibility: MediaVisibility): Promise<GetObjectResult | null>;
  exists(key: string, visibility: MediaVisibility): Promise<boolean>;
  delete(key: string, visibility: MediaVisibility): Promise<void>;

  /**
   * Public URL for a public object only.
   * Implementations MUST throw if `visibility === 'private'` — this is the
   * compile-and-run-time guard against leaking an applicant document.
   */
  publicUrl(key: string): string;
}
