import type { MediaVisibility, MediaPurpose } from '@/db/schema/enums';

import { ConfigurationError } from '@/lib/env';

import { BlobsStorageAdapter } from './blobs';
import { LocalStorageAdapter } from './local';
import type { StorageAdapter } from './types';

export type { StorageAdapter, StoredObject, PutObjectInput } from './types';

/**
 * Choose the storage driver.
 *
 * `STORAGE_DRIVER=blobs` on Netlify; `local` everywhere else. Choosing lazily
 * (inside a function) keeps `@netlify/blobs` out of the import graph during a
 * credential-free build.
 */
export type StorageEnvironment = {
  NODE_ENV?: string;
  STORAGE_DRIVER?: string;
};

/**
 * Resolve and validate the storage driver without reading or echoing secrets.
 *
 * Local filesystem storage is appropriate for development, but is not durable
 * across serverless instances. Fail closed in production rather than silently
 * sending uploads to an ephemeral function filesystem.
 */
export function resolveStorageDriver(
  env: StorageEnvironment = process.env,
): 'local' | 'blobs' {
  const driver = env.STORAGE_DRIVER ?? 'local';

  if (driver !== 'local' && driver !== 'blobs') {
    throw new ConfigurationError(
      'STORAGE_DRIVER',
      'STORAGE_DRIVER must be either "local" or "blobs".',
    );
  }

  if (env.NODE_ENV === 'production' && driver !== 'blobs') {
    throw new ConfigurationError(
      'STORAGE_DRIVER',
      'STORAGE_DRIVER must be set to "blobs" in production; local file storage is not durable on serverless deployments.',
    );
  }

  return driver;
}

export function getStorage(): StorageAdapter {
  const driver = resolveStorageDriver();
  return driver === 'blobs' ? new BlobsStorageAdapter() : new LocalStorageAdapter();
}

/**
 * Build the storage key for a new object.
 *
 * Keys are generated from a fresh UUID — the uploaded filename is never part of
 * a key, so no user-controlled string ever reaches a filesystem path or a URL.
 *
 *   public/logo/9f2c….png
 *   private/assessments/<assessmentId>/cv/9f2c….pdf
 */
export function buildStorageKey(params: {
  visibility: MediaVisibility;
  purpose: MediaPurpose;
  extension: string;
  scopeId?: string;
}): string {
  const id = crypto.randomUUID();
  const ext = params.extension.replace(/^\./, '').toLowerCase();
  const prefix = params.visibility === 'private' ? 'private' : 'public';

  if (params.visibility === 'private') {
    const scope = params.scopeId ?? 'unscoped';
    return `${prefix}/assessments/${scope}/${params.purpose}/${id}.${ext}`;
  }

  return `${prefix}/${params.purpose}/${id}.${ext}`;
}

/**
 * Guard for public URL generation.
 *
 * Private objects have no public URL at all — calling this on a private key
 * throws instead of silently returning something a browser could fetch.
 */
export function publicUrlFor(
  storage: StorageAdapter,
  key: string,
  visibility: MediaVisibility,
): string {
  if (visibility === 'private') {
    throw new Error(
      'Refusing to build a public URL for a private object. Use the authorised download route.',
    );
  }
  return storage.publicUrl(key);
}
