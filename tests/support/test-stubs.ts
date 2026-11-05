/**
 * Test support — impersonating a signed-in administrator.
 *
 * The CMS guards call three things that only exist inside a Next.js request:
 * `cookies()` (to read the session and CSRF cookies), `redirect()` and the
 * request-scoped audit writer. This module replaces exactly those three, and
 * nothing else, so the guard code itself — the role check, the CSRF comparison,
 * the session lookup — is the code under test.
 *
 * It is loaded through `node --import`, before any application module is
 * resolved, which is what makes the replacement visible to every importer.
 *
 * Only ever used by tests. It is switched on by an environment variable that the
 * development and production processes never set.
 */

import { registerHooks } from 'node:module';

type AdminUser = {
  adminId: string;
  sessionId: string;
  email: string;
  role: 'owner' | 'admin' | 'editor';
};

type TestState = {
  admin: AdminUser | null;
  csrf: string;
  audit: Array<{
    action: string;
    entityType: string;
    entityId?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    actorAdminId?: string;
    actorEmail?: string;
  }>;
};

const globalRef = globalThis as unknown as { __immiTestState?: TestState };

/** Initial state, created on first use by the stubbed modules below. */
/** The shared state bag. Created on first use so no caller can see `undefined`. */
export function initialState(): TestState {
  globalRef.__immiTestState ??= { admin: null, csrf: 'test-csrf-token', audit: [] };
  return globalRef.__immiTestState;
}



const STUB_SOURCES: Record<string, string> = {
  // --------------------------------------------------------------------- //
  // next/headers — the cookie jar.                                            //
  // --------------------------------------------------------------------- //
  'next/headers': `
    export async function cookies() {
      const state = globalThis.__immiTestState;
      const value = state.admin
        ? {
            sub: state.admin.adminId,
            admin_name: state.admin.email,
            role: state.admin.role,
          }
        : null;

      return {
        get(name) {
          if (!value) return undefined;
          const map = {
            immi_session: JSON.stringify(value),
            immi_csrf: state.csrf,
          };
          return name in map ? { name, value: map[name] } : undefined;
        },
        getAll() { return []; },
        has(name) { return Boolean(value) && (name === 'immi_session' || name === 'immi_csrf'); },
        set() {},
        delete() {},
      };
    }

    export async function headers() {
      return new Headers({
        'x-forwarded-for': '203.0.113.9',
        'user-agent': 'phase4-test-agent',
      });
    }
  `,

  // --------------------------------------------------------------------- //
  // next/navigation — `redirect()` throws in real Next.js; mirror that so   //
  // a page guard's redirect is observable instead of silently swallowed.    //
  // --------------------------------------------------------------------- //
  'next/navigation': `
    export function redirect(target) {
      const error = new Error('NEXT_REDIRECT: ' + target);
      error.digest = 'NEXT_REDIRECT';
      throw error;
    }
    export function notFound() {
      const error = new Error('NEXT_NOT_FOUND');
      error.digest = 'NEXT_NOT_FOUND';
      throw error;
    }
    export function useRouter() { return { push() {}, replace() {}, refresh() {} }; }
    export function usePathname() { return '/'; }
    export function useSearchParams() { return new URLSearchParams(); }
  `,

  // --------------------------------------------------------------------- //
  // Auth session: resolve the impersonated administrator, and accept the    //
  // CSRF token the test presents.                                           //
  // --------------------------------------------------------------------- //
  '@/lib/auth/session': `
    export const SESSION_COOKIE_NAME = 'immi_session';
    export const CSRF_COOKIE_NAME = 'immi_csrf';

    export async function resolveSession(token) {
      const state = globalThis.__immiTestState;
      if (!token || !state.admin) return null;
      return { ...state.admin, mustChangePassword: false, csrfSecret: state.csrf };
    }

    export async function getSessionCsrfSecret() {
      const state = globalThis.__immiTestState;
      return state.admin ? state.csrf : null;
    }

    export function isValidCsrfToken({ submitted, cookieValue, sessionCsrfSecret }) {
      return Boolean(submitted) && submitted === cookieValue && submitted === sessionCsrfSecret;
    }

    export function clientIpHash() { return 'test-ip-hash'; }
    export async function createSession() { throw new Error('not used in tests'); }
    export async function revokeSession() {}
    export async function revokeAllSessions() { return 0; }
    export async function pruneExpiredSessions() { return 0; }
  `,

  // --------------------------------------------------------------------- //
  // Audit trail: captured in memory instead of written to the database.     //
  // --------------------------------------------------------------------- //
  '@/lib/auth/audit': `
    export async function writeAuditLog(entry) {
      globalThis.__immiTestState.audit.push({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        // Phase 6 assertions need the summary and metadata too (a status change
        // must record previous -> new), so the whole entry is kept. Older tests
        // read only the three fields above and are unaffected.
        summary: entry.summary,
        metadata: entry.metadata,
        actorAdminId: entry.actorAdminId ?? entry.adminId,
        actorEmail: entry.actorEmail,
      });
    }
    export async function listAuditLog() { return []; }
  `,
};

/** Modules stubbed above, keyed by the specifier their importers use. */
const STUBBED = Object.keys(STUB_SOURCES);

/**
 * Turn a project-relative module id (as seen by the app: `@/lib/auth/session`,
 * `next/headers`, an absolute path) into the key used by `STUB_SOURCES`.
 */
function stubFor(url: string): string | undefined {
  for (const specifier of STUBBED) {
    if (specifier.startsWith('@/')) {
      // The app's `@/*` alias maps to `src/*`.
      const suffix = `/src/${specifier.slice(2)}`;
      if (url.endsWith(suffix) || url.endsWith(`${suffix}.ts`)) return specifier;
      continue;
    }
    if (url === specifier || url.endsWith(`/node_modules/${specifier}`)) return specifier;
    if (url.includes(`/node_modules/${specifier}/`)) return specifier;
  }
  return undefined;
}

if (process.env.IMMI_TEST_STUBS !== '1') {
  throw new Error('tests/support/test-stubs.ts must only be loaded by the test runner');
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    const stub = stubFor(resolved.url) ?? stubFor(specifier);
    if (stub) {
      return {
        url: `immi-stub:${stub}`,
        shortCircuit: true,
      };
    }
    return resolved;
  },
  load(url, context, nextLoad) {
    if (url.startsWith('immi-stub:')) {
      const stub = url.slice('immi-stub:'.length);
      return {
        format: 'module',
        source: STUB_SOURCES[stub],
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
