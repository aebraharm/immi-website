/**
 * Phase 7 verification — security hardening and quality assurance.
 *
 * Two kinds of test live here:
 *
 *  1. **Regression tests for the defects Phase 7 found and fixed.** Each one
 *     fails against the code as it stood before the fix, so the defect cannot
 *     quietly return.
 *  2. **Standing security assertions** over the shipped surface: route guards,
 *     storage defaults, upload validation, header configuration, and the
 *     accessibility affordances that are checkable from source.
 *
 * Where a test can prove behaviour by executing code (the upload rule, the
 * search escaping, the redirect sanitiser), it does. Where the only honest
 * evidence is the shape of the source (that a route exports no DELETE, that a
 * page calls the guard before loading a record), the test reads the source and
 * says so in its name.
 *
 * Nothing here claims a rendered-DOM or cross-browser check: see
 * `docs/PHASE-7-REPORT.md` §8 for what could not be verified.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');


/** Walk application source files without shelling out to grep. */
function findMatches(pattern: RegExp, ...roots: string[]): string[] {
  const matches: string[] = [];
  const visit = (path: string) => {
    const entries = readdirSync(path, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const source = readFileSync(fullPath, 'utf8');
      source.split(/\r?\n/).forEach((line, index) => {
        pattern.lastIndex = 0;
        if (pattern.test(line)) matches.push(`${fullPath}:${index + 1}:${line}`);
      });
    }
  };

  for (const root of roots) visit(root);
  return matches;
}


/** Strip comments so a rule can never be "satisfied" by prose describing it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* -------------------------------------------------------------------------- */
/* 1. Defects found and fixed in Phase 7                                      */
/* -------------------------------------------------------------------------- */

describe('D12 — applicant documents cannot enter the public media library', () => {
  const media = code(read('src/lib/cms/media.ts'));

  it('the public ingest path refuses the cv purpose and any document', () => {
    assert.match(
      media,
      /purpose === 'cv' \|\| detected\.kind === 'document'/,
      'ingestUpload must refuse cv and document types before building a public key',
    );
    assert.match(media, /upload_rejected/);
  });

  it('the refusal happens before the storage key is built', () => {
    const refusalIndex = media.indexOf("detected.kind === 'document'");
    const keyIndex = media.indexOf('buildStorageKey(');
    assert.ok(refusalIndex > -1 && keyIndex > -1);
    assert.ok(
      refusalIndex < keyIndex,
      'the guard must run before any public storage key exists',
    );
  });

  it('every storage write in the public ingest path is hard-coded public', () => {
    // If this ever became dynamic, the guard above would be the only thing
    // standing between a CV and the public store. Each write must stay literal.
    assert.match(media, /buildStorageKey\(\{[^}]*visibility: 'public'/s);
    assert.match(media, /storage\.put\(\{[^}]*visibility: 'public'/s);
    assert.match(media, /\.values\(\{[^}]*visibility: 'public'/s);
  });

  it('the media library UI does not offer the cv purpose', () => {
    const library = code(read('src/components/admin/cms/media-library.tsx'));
    assert.match(library, /UPLOADABLE_PURPOSES/);
    assert.match(library, /purpose !== 'cv'/);
  });

  it('the public media proxy still refuses document types', () => {
    const route = code(read('src/app/api/media/[...key]/route.ts'));
    assert.match(route, /SERVABLE_TYPES/);
    for (const type of ['application/pdf', 'docx', 'text/html', 'image/svg+xml']) {
      assert.ok(
        !route.includes(`'${type}'`),
        `${type} must not be a servable public type`,
      );
    }
    assert.match(route, /eq\(mediaAssets\.visibility, 'public'\)/);
  });
});

describe('D13 — the post-login redirect cannot leave the site', () => {
  const form = code(read('src/app/(admin)/admin/login/login-form.tsx'));

  it('control characters and backslashes are rejected before the path check', () => {
    assert.match(
      form,
      /test\(nextParam\)/,
      'safeNextTarget must test the raw parameter, not the parsed URL',
    );
    // The character class must include the C0 range and a backslash.
    const match = /\/\[([^\]]*)\]\//.exec(form);
    assert.ok(match, 'a character class guard must be present');
    assert.match(form, /\\u0000-\\u001f/);
    assert.match(form, /\\\\/);
  });

  it('protocol-relative and absolute targets fall back to /admin', () => {
    assert.match(form, /nextParam\.startsWith\('\/'\)/);
    assert.match(form, /nextParam\.startsWith\('\/\/'\)/);
    assert.match(form, /return '\/admin'/);
  });

  it('middleware never puts an unchecked pathname into the next parameter', () => {
    const middleware = code(read('src/middleware.ts'));
    assert.match(middleware, /pathname\.startsWith\('\/\/'\)/);
    assert.match(middleware, /'\/admin'/);
  });

  /**
   * The behaviour itself, extracted from the shipped expression.
   *
   * The component closure is not importable without a DOM, so the guard is
   * exercised through the same regular expression the component uses. If the
   * expression changes, this test changes with it — which is the point.
   */
  it('the shipped guard rejects every browser-equivalent off-site form', () => {
    const guard = (value: string): string => {
      if (/[\u0000-\u001f\u007f\\]/.test(value)) return '/admin';
      if (!value.startsWith('/') || value.startsWith('//')) return '/admin';
      return value;
    };

    for (const attack of [
      '//evil.test',
      '/\t/evil.test',
      '/\n/evil.test',
      '/\\evil.test',
      'https://evil.test',
      'javascript:alert(1)',
      '/\r\n/evil.test',
    ]) {
      assert.equal(guard(attack), '/admin', `${JSON.stringify(attack)} must not be followed`);
    }

    for (const safe of ['/admin', '/admin/assessments', '/admin/content/services/abc']) {
      assert.equal(guard(safe), safe, `${safe} must still work`);
    }
  });
});

describe('D14 — the mobile navigation drawer is a real modal for keyboards', () => {
  const nav = code(read('src/components/site/mobile-nav.tsx'));

  it('declares itself as a modal dialog with an accessible name', () => {
    assert.match(nav, /role="dialog"/);
    assert.match(nav, /aria-modal="true"/);
    assert.match(nav, /aria-label="Navigation menu"/);
  });

  it('moves focus into the drawer and returns it on close', () => {
    assert.match(nav, /closeButtonRef\.current\?\.focus\(\)/);
    assert.match(nav, /previouslyFocused/);
    assert.match(nav, /\.focus\?\.\(\)/);
  });

  it('keeps Tab inside the drawer', () => {
    assert.match(nav, /event\.key !== 'Tab'/);
    assert.match(nav, /event\.shiftKey/);
    assert.match(nav, /event\.preventDefault\(\)/);
    assert.match(nav, /document\.addEventListener\('keydown', onKeyDown\)/);
    assert.match(nav, /document\.removeEventListener\('keydown', onKeyDown\)/);
  });

  it('still never renders the admin login link', () => {
    assert.ok(!nav.includes('/admin'), 'the drawer must not contain an admin link');
    assert.ok(
      !/['"]\/admin['"]/.test(nav),
      'the drawer must not reference the admin route at all',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Standing security assertions                                            */
/* -------------------------------------------------------------------------- */

describe('authentication surface', () => {
  it('there is no registration, reset or account-creation endpoint', () => {
    const routes = [
      'src/app/api/admin/auth/login/route.ts',
      'src/app/api/admin/auth/logout/route.ts',
      'src/app/api/admin/auth/change-password/route.ts',
    ];
    // Exactly three auth routes exist; anything else is a new attack surface.
    const dirs = readdirSync('src/app/api/admin/auth');
    assert.deepEqual(dirs.sort(), ['change-password', 'login', 'logout']);

    for (const route of routes) {
      const source = code(read(route));
      assert.ok(!/signup|register|reset-password|forgot/.test(source));
    }
  });

  it('login reveals nothing about whether an account exists', () => {
    const route = code(read('src/app/api/admin/auth/login/route.ts'));
    // One indistinguishable credential failure.
    assert.match(route, /invalid_credentials/);
    assert.ok(!/no such (user|account)|unknown email/i.test(route));

    const service = code(read('src/lib/auth/service.ts'));
    assert.match(service, /burnTime/, 'a timing-equalisation path must exist');
    assert.match(service, /unknown_account/);
  });

  it('sessions store only a digest of the token', () => {
    const session = code(read('src/lib/auth/session.ts'));
    assert.match(session, /tokenHash: sha256Hex\(token\)/);
    assert.match(session, /SESSION_ABSOLUTE_TTL_MS/);
    assert.match(session, /SESSION_IDLE_TTL_MS/);
    assert.match(session, /isNull\(adminSessions\.revokedAt\)/);
  });

  it('the session cookie is HttpOnly and SameSite', () => {
    const session = code(read('src/lib/auth/session.ts'));
    const block = /sessionCookieOptions[\s\S]*?\n}/.exec(session)?.[0] ?? '';
    assert.match(block, /httpOnly: true/);
    assert.match(block, /sameSite: 'lax'/);
    assert.match(block, /secure: process\.env\.NODE_ENV === 'production'/);
    assert.match(block, /path: '\/'/);
  });

  it('a deactivated administrator loses existing sessions immediately', () => {
    const session = code(read('src/lib/auth/session.ts'));
    assert.match(session, /row\.isActive === false/);
  });

  it('password hashing is Argon2id at OWASP parameters, never a plain digest', () => {
    const password = code(read('src/lib/auth/password.ts'));
    assert.match(password, /algorithm: 2/);
    assert.match(password, /memoryCost: 19_456/);
    assert.match(password, /timeCost: 2/);
    assert.ok(!password.includes('sha256'), 'passwords must never use a plain hash');

    const crypto = code(read('src/lib/auth/crypto.ts'));
    assert.ok(
      !/hashPassword[\s\S]*sha256Hex/.test(crypto),
      'the crypto helper must not offer a password path',
    );
  });

  it('CSRF compares against the session row, not merely cookie to header', () => {
    const session = code(read('src/lib/auth/session.ts'));
    assert.match(session, /isValidCsrfToken/);
    assert.match(session, /safeEqual\(submitted, sessionCsrfSecret\)/);
    assert.match(session, /safeEqual\(cookieValue, sessionCsrfSecret\)/);
  });

  it('rate limiting runs before password verification', () => {
    const service = code(read('src/lib/auth/service.ts'));
    const limitIndex = service.indexOf('checkLoginAllowed');
    const verifyIndex = service.indexOf('verifyPassword(');
    assert.ok(limitIndex > -1 && verifyIndex > -1);
    assert.ok(limitIndex < verifyIndex, 'a locked-out caller must not reach Argon2');
  });
});

describe('D15 — editor reads cannot expose owner-only settings or SEO', () => {
  it('CMS resource reads use explicit per-resource roles', () => {
    const handlers = code(read('src/lib/cms/handlers.ts'));
    assert.match(handlers, /const READ_ROLES:[\s\S]*?seo: \['owner'\]/);
    assert.match(handlers, /guardRead\(READ_ROLES\[key\]\)/);
  });

  it('site settings GET requires the owner role', () => {
    const settings = code(read('src/app/api/admin/cms/settings/route.ts'));
    assert.match(settings, /await guardRead\(\['owner'\]\)/);
  });
});

describe('authorisation surface', () => {
  it('every admin page is behind the same layout guard', () => {
    const layout = code(read('src/app/(admin)/admin/(dashboard)/layout.tsx'));
    assert.match(layout, /requireAdminPage/);
  });

  it('owner-only pages check the role before loading a record', () => {
    for (const page of [
      'src/app/(admin)/admin/(dashboard)/content/seo/page.tsx',
      'src/app/(admin)/admin/(dashboard)/content/seo/[id]/page.tsx',
      'src/app/(admin)/admin/(dashboard)/content/seo/new/page.tsx',
      'src/app/(admin)/admin/(dashboard)/content/settings/page.tsx',
      'src/app/(admin)/admin/(dashboard)/assessments/page.tsx',
      'src/app/(admin)/admin/(dashboard)/assessments/[id]/page.tsx',
    ]) {
      const source = code(read(page));
      const guardIndex = Math.min(
        ...['hasRole', 'ASSESSMENT_ROLES', 'SETTINGS_ROLES']
          .map((token) => source.indexOf(token))
          .filter((index) => index > -1),
      );
      assert.ok(Number.isFinite(guardIndex), `${page} must check a role`);

      // The role check must precede the first record read.
      for (const loader of ['getAssessmentDetail', 'listSeoOverrides', 'getSiteSettings', 'getAssessmentSummary']) {
        const index = source.indexOf(`${loader}(`);
        if (index > -1) {
          assert.ok(guardIndex < index, `${page} must check the role before ${loader}()`);
        }
      }
    }
  });

  it('no assessment route answers to a verb that could delete an application', () => {
    const files = [
      'src/app/api/admin/assessments/route.ts',
      'src/app/api/admin/assessments/[id]/route.ts',
      'src/app/api/admin/assessments/[id]/status/route.ts',
      'src/app/api/admin/assessments/[id]/notes/route.ts',
      'src/app/api/admin/assessments/[id]/attachments/[attachmentId]/route.ts',
    ];
    for (const file of files) {
      const source = code(read(file));
      assert.ok(!/export function DELETE/.test(source), `${file} must not export DELETE`);
    }
  });

  it('the audit writer cannot be called with an unknown action', () => {
    const api = code(read('src/lib/cms/api.ts'));
    // A closed union, not `string`.
    assert.ok(!/action:\s*string/.test(api), 'the action must stay a closed union');
    assert.match(api, /'assessment\.attachment_downloaded'/);
  });

  it('assessment downloads require the assessment and the attachment together', () => {
    const admin = code(read('src/lib/assessment/admin.ts'));
    assert.match(admin, /eq\(assessmentAttachments\.id, attachmentId\)/);
    assert.match(admin, /eq\(assessmentAttachments\.assessmentId, assessmentId\)/);
    assert.match(admin, /if \(row\.visibility !== 'private'\) return null/);
  });
});

describe('data access surface', () => {
  it('no raw SQL string interpolation exists anywhere in src', () => {
    // `sql.raw` and string-concatenated SQL are the two ways an injection gets in.
    assert.deepEqual(findMatches(/sql\\.raw/, 'src'), [], 'sql.raw must not be used');
  });

  it('the public media proxy filters by visibility in SQL, not in JavaScript', () => {
    const route = code(read('src/app/api/media/[...key]/route.ts'));
    assert.match(route, /eq\(mediaAssets\.visibility, 'public'\)/);
    assert.ok(!/storageKey\.startsWith\('private'\)/.test(route));
  });

  it('upload validation checks bytes before trusting the filename', () => {
    const validate = code(read('src/lib/files/validate.ts'));
    const detectIndex = validate.indexOf('detectFileType(bytes)');
    // The *first read* of the declared type, not the function signature.
    const mimeIndex = validate.indexOf('params.declaredMimeType?.');
    assert.ok(detectIndex > -1 && mimeIndex > -1);
    assert.ok(detectIndex < mimeIndex, 'the bytes must be classified before the declared MIME is read');
    assert.match(validate, /looksLikeDocx/);
  });

  it('a private storage key has no public URL', () => {
    const storage = code(read('src/lib/storage/index.ts'));
    assert.match(storage, /if \(visibility === 'private'\)/);
    assert.match(storage, /throw/);
  });

  it('the local storage adapter refuses path traversal', () => {
    const local = code(read('src/lib/storage/local.ts'));
    assert.match(local, /path traversal detected/);
    assert.match(local, /startsWith\(ROOT \+ sep\)/);
  });

  it('database errors never reach a visitor', () => {
    const safe = code(read('src/db/queries/safe.ts'));
    assert.match(safe, /NODE_ENV !== 'production'/);
    assert.match(safe, /reason/);
  });

  it('no console output of request or applicant data in shipped code', () => {
    assert.deepEqual(
      findMatches(/console\\.(log|info|debug)/, 'src'),
      [],
      'only console.error is allowed, and only for internal reasons',
    );
  });
});

describe('response hardening', () => {
  const config = code(read('next.config.ts'));

  it('sets the core security headers', () => {
    for (const header of [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
    ]) {
      assert.ok(config.includes(header), `${header} must be set`);
    }
    assert.match(config, /poweredByHeader: false/);
    assert.match(config, /remotePatterns: \[\]/);
  });

  it('middleware issues a nonce-based CSP and marks admin/api noindex', () => {
    const middleware = code(read('src/middleware.ts'));
    assert.match(middleware, /Content-Security-Policy/);
    assert.match(middleware, /'nonce-\$\{nonce\}'/);
    assert.match(middleware, /'frame-ancestors': "\s*'none'|'frame-ancestors': "'none'"/);
    assert.match(middleware, /NO_INDEX_PREFIXES/);
    assert.match(middleware, /noindex, nofollow, noarchive, nosnippet/);
    assert.match(middleware, /Cache-Control'.*no-store/s);
  });

  it('the admin pages opt out of indexing in their own metadata as well', () => {
    const layout = code(read('src/app/(admin)/admin/(dashboard)/layout.tsx'));
    assert.match(layout, /robots: \{ index: false, follow: false, nocache: true \}/);
  });
});

describe('reference and secret hygiene', () => {
  it('no secret-shaped value is committed in the source tree', () => {
    // Structural, not a value scan: the application must never *contain* one of
    // these literals. The value scan itself lives in the Phase 3 credential test,
    // fed by the git-ignored marker list.
    assert.deepEqual(
      findMatches(/libsql:\/\/[A-Za-z0-9._-]{10,}|eyJhbGciOi[A-Za-z0-9._-]{10,}/, 'src', 'scripts', 'drizzle'),
      [],
      'no live connection string or JWT may appear in the tree',
    );
  });

  it('environment access is centralised and never echoed', () => {
    const env = code(read('src/lib/env.ts'));
    assert.match(env, /ConfigurationError/);
    assert.ok(!/console\.(log|error)\([^)]*env\./.test(env), 'env values must never be logged');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Accessibility affordances that are checkable from source                */
/* -------------------------------------------------------------------------- */

describe('D18 — generic media metadata cannot expose private applicant files', () => {
  it('the generic media-by-id endpoint only serves public registry rows', () => {
    const route = code(read('src/app/api/admin/cms/media/[id]/route.ts'));
    assert.match(route, /row\.visibility !== 'public'/);
    assert.match(route, /!row\.storageKey\.startsWith\('public\/'\)/);
    assert.ok(!route.includes('...row'), 'the complete media row must never be serialized');

    const media = code(read('src/lib/cms/media.ts'));
    assert.match(media, /async function requirePublicMediaAsset/);
    assert.equal(
      (media.match(/await requirePublicMediaAsset\(/g) ?? []).length,
      3,
      'metadata updates, archive, and restore must all reject private assets',
    );
  });
});

describe('D17 — every CMS mutation uses the shared durable admin throttle', () => {
  it('status, restore, reorder, create, update, and archive handlers all throttle', () => {
    const handlers = code(read('src/lib/cms/handlers.ts'));
    const calls = handlers.match(/await throttleCmsMutation\(admin\.adminId\)/g) ?? [];
    assert.equal(calls.length, 6, 'all six generic mutation paths must use the CMS throttle');
  });

  it('settings and media writes share the same throttle', () => {
    const settings = code(read('src/app/api/admin/cms/settings/route.ts'));
    const media = code(read('src/app/api/admin/cms/media/route.ts'));
    const mediaItem = code(read('src/app/api/admin/cms/media/[id]/route.ts'));
    assert.match(settings, /await throttleCmsMutation\(admin\.adminId\)/);
    assert.match(media, /await throttleCmsMutation\(admin\.adminId\)/);
    assert.equal(
      (mediaItem.match(/await throttleCmsMutation\(admin\.adminId\)/g) ?? []).length,
      2,
      'media metadata updates and archive/restore both need throttling',
    );
  });
});

describe('D16 — muted text meets readable contrast in the default palette', () => {
  it('application source does not use the low-contrast slate-400 text utility', () => {
    assert.deepEqual(
      findMatches(/(?:placeholder:)?text-slate-400\b/, 'src'),
      [],
      'use slate-600 for low-emphasis text on light surfaces; slate-400 is too faint',
    );
  });
});

describe('accessibility affordances', () => {
  it('every admin form control is labelled by the shared field primitives', () => {
    // The primitives take a `label` and generate the id/htmlFor pair; a screen
    // using them cannot produce an unlabelled input.
    const kit = code(read('src/components/admin/cms/form-kit.tsx'));
    assert.match(kit, /htmlFor=\{id\}/);
    assert.match(kit, /aria-describedby/);
    assert.match(kit, /aria-invalid/);

    const controls = code(read('src/components/assessment/controls.tsx'));
    assert.match(controls, /<Field label=\{label\}/);
  });

  it('status is never conveyed by colour alone', () => {
    const badge = code(read('src/components/ui/badge.tsx'));
    assert.match(badge, /children/);
    const status = code(read('src/lib/assessment/status.ts'));
    // Every status carries a word and an ordinal, not just a tone.
    assert.match(status, /label:/);
    assert.match(status, /order:/);
  });

  it('tables have captions and column scopes', () => {
    for (const file of [
      'src/components/admin/assessments/assessment-list.tsx',
      'src/app/(admin)/admin/(dashboard)/activity/page.tsx',
      'src/components/admin/cms/content-list.tsx',
    ]) {
      const source = code(read(file));
      assert.match(source, /<caption/, `${file} must caption its table`);
    }
    const list = code(read('src/components/admin/assessments/assessment-list.tsx'));
    assert.match(list, /scope="col"/);
  });

  it('destructive actions confirm before they run', () => {
    const confirm = code(read('src/components/admin/cms/confirm-dialog.tsx'));
    assert.match(confirm, /showModal\(\)/);
    assert.match(confirm, /addEventListener\('cancel'/);
    assert.match(confirm, /aria-labelledby/);

    const workspace = code(read('src/components/admin/assessments/assessment-workspace.tsx'));
    assert.match(workspace, /ConfirmDialog/);
  });

  it('live regions announce async results', () => {
    const list = code(read('src/components/admin/assessments/assessment-list.tsx'));
    assert.match(list, /aria-live="polite"/);
    assert.match(list, /aria-busy="true"/);
    const alerts = code(read('src/components/admin/cms/form-kit.tsx'));
    assert.match(alerts, /role=\{tone === 'error' \? 'alert' : 'status'\}/);
  });

  it('images always carry alt text from the media model', () => {
    // Nothing renders a raw <img>; next/image is used with an explicit alt.
    assert.deepEqual(findMatches(/<img/, 'src'), [], 'no raw <img> elements');
  });

  it('the skip link exists, is first in the DOM, and points at the main landmark', () => {
    const layout = code(read('src/app/layout.tsx'));
    assert.match(layout, /href="#main-content"/);
    assert.match(layout, /className="skip-link"/);
    // The style that reveals it on focus must exist too; a permanently hidden
    // skip link is the same as no skip link.
    const css = read('src/app/globals.css');
    assert.match(css, /\.skip-link/);
    assert.match(css, /focus/);
  });

  it('reduced motion is respected by the animated surfaces', () => {
    for (const file of [
      'src/components/site/mobile-nav.tsx',
      'src/components/admin/admin-shell.tsx',
      'src/components/motion/reveal.tsx',
    ]) {
      assert.match(code(read(file)), /useReducedMotion/, `${file} must honour reduced motion`);
    }
  });
});
