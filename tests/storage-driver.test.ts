import assert from 'node:assert/strict';
import test from 'node:test';

import { ConfigurationError } from '../src/lib/env';
import { resolveStorageDriver } from '../src/lib/storage';

test('storage driver defaults to local outside production', () => {
  assert.equal(resolveStorageDriver({ NODE_ENV: 'development' }), 'local');
  assert.equal(resolveStorageDriver({ NODE_ENV: 'test' }), 'local');
});

test('production requires the durable Blobs driver', () => {
  assert.equal(
    resolveStorageDriver({ NODE_ENV: 'production', STORAGE_DRIVER: 'blobs' }),
    'blobs',
  );

  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', STORAGE_DRIVER: 'local' },
  ]) {
    assert.throws(
      () => resolveStorageDriver(env),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.variable === 'STORAGE_DRIVER' &&
        /must be set to "blobs" in production/.test(error.message),
    );
  }
});

test('unknown storage drivers fail closed without echoing the supplied value', () => {
  assert.throws(
    () => resolveStorageDriver({ NODE_ENV: 'development', STORAGE_DRIVER: 'not-a-driver' }),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.variable === 'STORAGE_DRIVER' &&
      !error.message.includes('not-a-driver'),
  );
});
