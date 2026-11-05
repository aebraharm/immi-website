/**
 * Phase 2 requirement tests.
 *
 * These lock in the rules from the brief that are cheap to regress silently:
 * admin-login visibility, the exact call-to-action wording, absence of any client
 * portal, absence of a public URL path for private media, and the publish gating
 * in the query layer.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const SRC = join(process.cwd(), 'src');

function read(path: string): string {
  return readFileSync(join(SRC, path), 'utf8');
}

/** Recursively collect every .ts/.tsx file under src/. */
function allSourceFiles(dir = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...allSourceFiles(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Call to action                                                             */
/* -------------------------------------------------------------------------- */

describe('primary call to action', () => {
  it('is defined with the exact mandated wording', () => {
    const config = read('lib/config/site.ts');
    assert.match(
      config,
      /export const PRIMARY_CTA_LABEL = 'Book a Consultation Now';/,
      'PRIMARY_CTA_LABEL must be exactly "Book a Consultation Now"',
    );
  });

  it('is not misspelled or paraphrased anywhere in the source', () => {
    const forbidden = [
      'Book a consultation now',
      'BOOK A CONSULTATION NOW',
      'Book a Consultation now',
      'Book A Consultation Now',
      'Book your consultation now',
    ];

    for (const file of allSourceFiles()) {
      const content = readFileSync(file, 'utf8');
      for (const phrase of forbidden) {
        assert.equal(
          content.includes(phrase),
          false,
          `${file} contains an incorrect CTA variant: "${phrase}"`,
        );
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Admin login visibility                                                     */
/* -------------------------------------------------------------------------- */

describe('admin login link visibility', () => {
  it('is hidden by default and only shown at the lg breakpoint in the header', () => {
    const header = read('components/site/site-header.tsx');

    // Find the admin login anchor's className.
    const match = header.match(
      /href=\{ADMIN_LOGIN_HREF\}[\s\S]{0,200}?className="([^"]*)"/,
    );

    assert.ok(match, 'admin login link not found in the header');
    const classes = match[1] ?? '';

    assert.ok(classes.includes('hidden'), 'admin link must start hidden');
    assert.ok(
      classes.includes('lg:inline-flex'),
      'admin link must become visible at the lg breakpoint (desktop/laptop)',
    );
    assert.ok(
      !/\b(sm|md):(inline-flex|flex|block)\b/.test(classes),
      'admin link must not be shown at tablet or phone breakpoints',
    );
  });

  it('is not rendered inside the mobile navigation drawer at all', () => {
    // Comments are stripped first: a comment explaining *why* the link is absent
    // must not fail the test, but real markup referencing it must.
    const mobileNav = read('components/site/mobile-nav.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    assert.equal(
      mobileNav.includes('ADMIN_LOGIN'),
      false,
      'MobileNav must not import or reference the admin login route constant',
    );
    assert.equal(
      mobileNav.includes('/admin/login'),
      false,
      'MobileNav must not contain a link to /admin/login',
    );
    assert.equal(
      /Admin Login/i.test(mobileNav),
      false,
      'the string "Admin Login" must not appear in MobileNav markup',
    );
  });

  it('the shared nav config is the single source for both header and drawer', () => {
    const header = read('components/site/site-header.tsx');
    assert.ok(header.includes('ADMIN_LOGIN_LABEL'));
    assert.ok(header.includes('MAIN_NAV'));
  });
});

/* -------------------------------------------------------------------------- */
/* No client portal                                                           */
/* -------------------------------------------------------------------------- */

describe('no client-facing account system', () => {
  const routeGroups = readdirSync(join(SRC, 'app'));

  it('has no client login, register, dashboard or account route', () => {
    const forbidden = [
      'login',
      'signin',
      'sign-in',
      'register',
      'signup',
      'sign-up',
      'dashboard',
      'account',
      'portal',
      'track',
      'forgot-password',
      'reset-password',
    ];

    // Only the public (site) group and the admin group may exist as route groups.
    const unexpected = routeGroups.filter(
      (entry) =>
        entry.startsWith('(') &&
        entry !== '(site)' &&
        entry !== '(admin)',
    );
    assert.deepEqual(unexpected, [], 'unexpected route groups found');

    // Walk the public site group for any forbidden client-account segment.
    const siteDir = join(SRC, 'app', '(site)');
    const publicSegments = readdirSync(siteDir);

    for (const segment of publicSegments) {
      for (const word of forbidden) {
        assert.equal(
          segment.toLowerCase().includes(word),
          false,
          `public route "/${segment}" looks like a client portal segment`,
        );
      }
    }
  });

  it('has no client session or client-account schema table', () => {
    const schemaFiles = readdirSync(join(SRC, 'db', 'schema'));
    const combined = schemaFiles
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(join(SRC, 'db', 'schema', f), 'utf8'))
      .join('\n');

    for (const table of ['clients', 'client_users', 'client_sessions', 'customer_accounts']) {
      assert.equal(
        new RegExp(`sqliteTable\\(\\s*'${table}'`).test(combined),
        false,
        `schema must not define a "${table}" table`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Private media                                                              */
/* -------------------------------------------------------------------------- */

describe('private media cannot be exposed', () => {
  it('publicUrlFor throws for private visibility', () => {
    const storage = read('lib/storage/index.ts');
    assert.match(
      storage,
      /if \(visibility === 'private'\) \{\s*throw new Error\(/,
      'publicUrlFor must refuse private objects',
    );
  });

  it('the public media route filters to visibility = public', () => {
    const route = readFileSync(
      join(SRC, 'app', 'api', 'media', '[...key]', 'route.ts'),
      'utf8',
    );
    assert.ok(
      route.includes("eq(mediaAssets.visibility, 'public')"),
      'the media route must constrain the query to public assets',
    );
  });

  it('media URL resolution refuses to build a URL for a private asset', () => {
    const mediaUrl = read('db/queries/media-url.ts');
    assert.match(
      mediaUrl,
      /if \(asset\.visibility !== 'public'\) return null;/,
      'toPublicMediaUrl must return null for non-public assets',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Publish gating                                                             */
/* -------------------------------------------------------------------------- */

describe('publish gating in the query layer', () => {
  const files = ['db/queries/content.ts', 'db/queries/people.ts', 'db/queries/destinations.ts'];

  it('every public query filters on the published status', () => {
    for (const file of files) {
      const content = read(file);
      assert.ok(
        content.includes("const PUBLISHED = 'published'"),
        `${file} should define the published status constant`,
      );
      assert.ok(
        content.includes('eq(') && content.includes('PUBLISHED'),
        `${file} should filter results by published status`,
      );
    }
  });

  it('content queries also exclude archived rows', () => {
    for (const file of files) {
      assert.ok(
        read(file).includes('isNull('),
        `${file} should exclude archived rows with isNull(...)`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* No hardcoded agency identity                                               */
/* -------------------------------------------------------------------------- */

describe('agency identity is never hardcoded', () => {
  it('the fallback identity contains no invented agency name', () => {
    const settings = read('db/queries/settings.ts');
    const fallback = settings.slice(
      settings.indexOf('export const FALLBACK_IDENTITY'),
      settings.indexOf('/** Read the raw settings row'),
    );

    assert.match(fallback, /agencyName: ''/, 'fallback agency name must be empty');
    assert.match(fallback, /logoUrl: null/, 'fallback logo must be null');
    assert.equal(
      /agencyName: '[^']+'/.test(fallback),
      false,
      'fallback must not invent an agency name',
    );
  });

  it('no component hardcodes a plausible agency name', () => {
    // Names that would look like a real agency and must never be baked in.
    const suspicious = ['Global Visa', 'Immigration Experts Ltd', 'Visa Solutions Inc'];

    for (const file of allSourceFiles()) {
      const content = readFileSync(file, 'utf8');
      for (const name of suspicious) {
        assert.equal(content.includes(name), false, `${file} hardcodes "${name}"`);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Empty-state coverage                                                       */
/* -------------------------------------------------------------------------- */

describe('public pages provide empty states', () => {
  it('every content-driven page renders an EmptyState or notice', () => {
    const pages = [
      'app/(site)/page.tsx',
      'app/(site)/about/page.tsx',
      'app/(site)/services/page.tsx',
      'app/(site)/destinations/page.tsx',
      'app/(site)/testimonials/page.tsx',
      'app/(site)/team/page.tsx',
      'app/(site)/faq/page.tsx',
      'app/(site)/contact/page.tsx',
    ];

    for (const page of pages) {
      const content = read(page);
      assert.ok(
        content.includes('EmptyState') ||
          content.includes('ConfigurationNotice'),
        `${page} must render an empty state when content is missing`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Reduced motion                                                             */
/* -------------------------------------------------------------------------- */

describe('reduced motion is respected globally', () => {
  it('MotionConfig is set to follow the user preference', () => {
    const provider = read('components/motion/motion-provider.tsx');
    assert.match(provider, /reducedMotion="user"/);
  });

  it('the stylesheet disables animation under prefers-reduced-motion', () => {
    const css = read('app/globals.css');
    assert.ok(css.includes('prefers-reduced-motion: reduce'));
  });
});
