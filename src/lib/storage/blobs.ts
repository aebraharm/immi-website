import { getStore } from '@netlify/blobs';

import type { MediaVisibility } from '@/db/schema/enums';
import { sha256Buffer } from '@/lib/auth/crypto';

import type {
  GetObjectResult,
  PutObjectInput,
  StorageAdapter,
  StoredObject,
} from './types';

/**
 * Netlify Blobs adapter (production).
 *
 * Two physically separate stores:
 *
 *   `immi-public`  — logos, flags, destination and team photography. Safe to
 *                    serve to anyone, served through the CDN.
 *   `immi-private` — applicant CVs and any sensitive attachment. Never exposed
 *                    through a public URL; only the authorised download proxy
 *                    reads from it.
 *
 * Splitting at the store level (rather than a prefix inside one store) means a
 * misconfigured public route physically cannot read private bytes.
 */

const PUBLIC_STORE = 'immi-public';
const PRIVATE_STORE = 'immi-private';

function storeFor(visibility: MediaVisibility) {
  const name = visibility === 'private' ? PRIVATE_STORE : PUBLIC_STORE;

  // Netlify injects site ID/token automatically in its runtime. When running
  // outside Netlify (or in a preview) explicit credentials are required.
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  return siteID && token
    ? getStore({ name, siteID, token, consistency: 'strong' })
    : getStore({ name, consistency: 'strong' });
}

export class BlobsStorageAdapter implements StorageAdapter {
  readonly provider = 'blobs' as const;

  async put(input: PutObjectInput): Promise<StoredObject> {
    const store = storeFor(input.visibility);

    // Normalise to a plain ArrayBuffer: Blobs must receive raw bytes, and a
    // SharedArrayBuffer-backed view is not an acceptable BlobInput.
    const source =
      input.body instanceof Uint8Array
        ? input.body
        : new Uint8Array(input.body);
    const bytes = new Uint8Array(source.byteLength);
    bytes.set(source);

    await store.set(input.key, bytes.buffer, {
      metadata: {
        contentType: input.contentType,
        visibility: input.visibility,
        originalFilename: input.originalFilename ?? '',
      },
    });

    return {
      key: input.key,
      visibility: input.visibility,
      size: bytes.byteLength,
      contentType: input.contentType,
      checksumSha256: sha256Buffer(bytes),
    };
  }

  async get(
    key: string,
    visibility: MediaVisibility,
  ): Promise<GetObjectResult | null> {
    const store = storeFor(visibility);
    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });

    if (!result) return null;

    const bytes = new Uint8Array(result.data as ArrayBuffer);
    const metadata = (result.metadata ?? {}) as Record<string, unknown>;

    return {
      body: bytes,
      contentType:
        typeof metadata.contentType === 'string'
          ? metadata.contentType
          : 'application/octet-stream',
      size: bytes.byteLength,
      originalFilename:
        typeof metadata.originalFilename === 'string'
          ? metadata.originalFilename
          : undefined,
    };
  }

  async exists(key: string, visibility: MediaVisibility): Promise<boolean> {
    const store = storeFor(visibility);
    const meta = await store.getMetadata(key);
    return meta !== null;
  }

  async delete(key: string, visibility: MediaVisibility): Promise<void> {
    const store = storeFor(visibility);
    await store.delete(key);
  }

  publicUrl(key: string): string {
    // Public objects are streamed through our own media route, which sets
    // long-lived cache headers and keeps a single origin for CSP purposes.
    return `/api/media/${key.replace(/^public\//, '')}`;
  }
}
