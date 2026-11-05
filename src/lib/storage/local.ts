import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';

import type { MediaVisibility } from '@/db/schema/enums';
import { sha256Buffer } from '@/lib/auth/crypto';

import type {
  GetObjectResult,
  PutObjectInput,
  StorageAdapter,
  StoredObject,
} from './types';

/**
 * Development-only filesystem adapter.
 *
 * Mirrors the Blobs adapter's public/private split under `.data/uploads/`, which
 * is git-ignored. This adapter exists so the whole application can run offline
 * with zero cloud credentials; production always uses Netlify Blobs.
 */

const ROOT = resolve(process.cwd(), '.data', 'uploads');

/**
 * Resolve a key to an absolute path, refusing anything that escapes the root.
 * A storage key is server-generated, but this check means a future bug or a
 * crafted key cannot be used for path traversal.
 */
function resolveKey(key: string): string {
  const cleaned = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const absolute = resolve(ROOT, cleaned);

  if (absolute !== ROOT && !absolute.startsWith(ROOT + sep)) {
    throw new Error('Invalid storage key: path traversal detected.');
  }

  return normalize(absolute);
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local' as const;

  async put(input: PutObjectInput): Promise<StoredObject> {
    const absolute = resolveKey(input.key);
    const bytes =
      input.body instanceof Uint8Array
        ? input.body
        : new Uint8Array(input.body);

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);

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
    _visibility: MediaVisibility,
  ): Promise<GetObjectResult | null> {
    const absolute = resolveKey(key);

    try {
      const info = await stat(absolute);
      if (!info.isFile()) return null;

      return {
        body: createReadStream(absolute) as unknown as ReadableStream<Uint8Array>,
        contentType: 'application/octet-stream',
        size: info.size,
      };
    } catch {
      return null;
    }
  }

  async exists(key: string, _visibility: MediaVisibility): Promise<boolean> {
    try {
      const info = await stat(resolveKey(key));
      return info.isFile();
    } catch {
      return false;
    }
  }

  async delete(key: string, _visibility: MediaVisibility): Promise<void> {
    await rm(resolveKey(key), { force: true });
  }

  publicUrl(key: string): string {
    return `/api/media/${key.replace(/^public\//, '')}`;
  }
}

/** Absolute path helper used by scripts and tests. */
export function localPathForKey(key: string): string {
  return join(ROOT, key);
}
