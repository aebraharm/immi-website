/**
 * Cryptography and reference-number tests.
 *
 * These cover the primitives that the rest of the security model rests on:
 * token generation, constant-time comparison, IP hashing, and assessment
 * reference numbers.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateToken,
  hashIp,
  rateLimitKey,
  safeEqual,
  sha256Hex,
} from '../src/lib/auth/crypto';
import {
  generateReferenceNumber,
  generateUniqueReferenceNumber,
  isReferenceNumberShape,
} from '../src/lib/utils/reference';
import { slugify, uniqueSlug } from '../src/lib/utils/slug';
import { validatePasswordStrength } from '../src/lib/auth/password';

describe('generateToken', () => {
  it('produces 256 bits of entropy by default', () => {
    // base64url of 32 bytes is 43 characters, no padding.
    assert.equal(generateToken().length, 43);
  });

  it('never repeats across 1000 calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) seen.add(generateToken());
    assert.equal(seen.size, 1000);
  });

  it('is URL-safe', () => {
    assert.match(generateToken(), /^[A-Za-z0-9_-]+$/);
  });
});

describe('safeEqual — constant-time comparison', () => {
  it('returns true for identical strings', () => {
    assert.equal(safeEqual('abc123', 'abc123'), true);
  });

  it('returns false for different strings of equal length', () => {
    assert.equal(safeEqual('abc123', 'abc124'), false);
  });

  it('returns false for strings of differing length without throwing', () => {
    assert.equal(safeEqual('abc', 'abcdef'), false);
  });

  it('returns true for two empty strings', () => {
    assert.equal(safeEqual('', ''), true);
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', () => {
    assert.equal(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is deterministic', () => {
    assert.equal(sha256Hex('same'), sha256Hex('same'));
  });
});

describe('hashIp — privacy preservation', () => {
  it('returns null for missing input', () => {
    assert.equal(hashIp(null), null);
    assert.equal(hashIp(undefined), null);
    assert.equal(hashIp(''), null);
  });

  it('stores a digest, never the address itself', () => {
    const hashed = hashIp('203.0.113.42');
    assert.ok(hashed);
    assert.equal(hashed.includes('203.0.113.42'), false);
    assert.equal(hashed.length, 64);
  });

  it('is stable for the same address', () => {
    assert.equal(hashIp('203.0.113.42'), hashIp('203.0.113.42'));
  });

  it('uses only the first entry of a forwarded chain', () => {
    assert.equal(hashIp('203.0.113.42, 10.0.0.1'), hashIp('203.0.113.42'));
  });

  it('differs for different addresses', () => {
    assert.notEqual(hashIp('203.0.113.42'), hashIp('203.0.113.43'));
  });
});

describe('rateLimitKey', () => {
  it('namespaces by scope', () => {
    assert.match(rateLimitKey('login', 'a@b.c'), /^login:/);
  });

  it('does not embed the raw identifier', () => {
    assert.equal(rateLimitKey('login', 'a@b.c').includes('a@b.c'), false);
  });
});

describe('generateReferenceNumber', () => {
  it('matches the documented shape', () => {
    const reference = generateReferenceNumber(new Date('2026-03-04T00:00:00Z'));
    assert.match(reference, /^IMA-2026-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('never contains ambiguous characters I, L, O or U', () => {
    for (let i = 0; i < 500; i += 1) {
      const suffix = generateReferenceNumber().split('-')[2] ?? '';
      assert.equal(/[ILOU]/.test(suffix), false, `ambiguous char in ${suffix}`);
    }
  });

  it('has very low collision probability across 5000 draws in one year', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(generateReferenceNumber());
    // 5000 draws from 32^8 ≈ 1.1e12: a collision would indicate a broken RNG.
    assert.equal(seen.size, 5000);
  });

  it('passes its own shape validator', () => {
    assert.equal(isReferenceNumberShape(generateReferenceNumber()), true);
  });
});

describe('generateUniqueReferenceNumber', () => {
  it('retries when a reference is already taken', async () => {
    const taken = new Set<string>();
    let attempts = 0;

    const reference = await generateUniqueReferenceNumber(async (candidate) => {
      attempts += 1;
      // Force the first two candidates to "already exist".
      if (attempts <= 2) {
        taken.add(candidate);
        return true;
      }
      return false;
    });

    assert.equal(attempts, 3);
    assert.equal(taken.has(reference), false);
  });

  it('throws rather than looping forever if every candidate is taken', async () => {
    await assert.rejects(
      () => generateUniqueReferenceNumber(async () => true),
      /Unable to generate a unique assessment reference number/,
    );
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    assert.equal(slugify('Skilled Worker Visa'), 'skilled-worker-visa');
  });

  it('strips diacritics', () => {
    assert.equal(slugify('Türkiye'), 'turkiye');
    assert.equal(slugify('Côte d’Ivoire'), 'cote-divoire');
  });

  it('collapses repeated separators', () => {
    assert.equal(slugify('a   ---   b'), 'a-b');
  });

  it('trims leading and trailing hyphens', () => {
    assert.equal(slugify('--hello--'), 'hello');
  });

  it('caps length', () => {
    assert.ok(slugify('x'.repeat(200)).length <= 80);
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when free', async () => {
    assert.equal(await uniqueSlug('Canada', async () => false), 'canada');
  });

  it('appends a numeric suffix on collision', async () => {
    const taken = new Set(['canada', 'canada-2']);
    assert.equal(
      await uniqueSlug('Canada', async (candidate) => taken.has(candidate)),
      'canada-3',
    );
  });

  it('falls back to "item" for input with no usable characters', async () => {
    assert.equal(await uniqueSlug('!!!', async () => false), 'item');
  });
});

describe('validatePasswordStrength', () => {
  it('accepts a strong password', () => {
    assert.deepEqual(validatePasswordStrength('Str0ng-Passphrase-2026'), []);
  });

  it('rejects anything under 12 characters', () => {
    const problems = validatePasswordStrength('Sh0rt-pass');
    assert.ok(problems.some((p) => p.includes('12 characters')));
  });

  it('requires lowercase, uppercase and a number', () => {
    const problems = validatePasswordStrength('ALLUPPERCASELONG');
    assert.ok(problems.some((p) => p.includes('lowercase')));
    assert.ok(problems.some((p) => p.includes('number')));

    const lower = validatePasswordStrength('alllowercaselong1');
    assert.ok(lower.some((p) => p.includes('uppercase')));
  });

  it('rejects leading or trailing whitespace', () => {
    const problems = validatePasswordStrength(' Str0ng-Passphrase-2026');
    assert.ok(problems.some((p) => p.includes('spaces')));
  });
});
