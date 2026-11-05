import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware — a first line of defence, never the only one.
 *
 * Responsibilities here are deliberately narrow, because middleware cannot
 * reach the database:
 *
 *  1. Force HTTPS in production.
 *  2. Add a per-request nonce and a strict Content-Security-Policy.
 *  3. Block indexing of admin and submission-receipt routes at the edge.
 *  4. Redirect unauthenticated visitors away from /admin **cheaply**.
 *
 * The authoritative session check still happens server-side in every admin
 * layout, page, server action and API route (Phase 3). A request that spoofs
 * past this middleware reaches a page that independently verifies the session
 * against the database, so this is a performance gate, not the security
 * boundary.
 */

const ADMIN_LOGIN_PATH = '/admin/login';

/** Routes that must never be indexed, whatever the page metadata says. */
const NO_INDEX_PREFIXES = ['/admin', '/assessment/success', '/api'];

function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Next.js development uses eval for hot reloading only.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': scriptSrc,
    // Tailwind emits styles at build time; inline styles cover brand-colour
    // CSS variables injected from the database.
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: blob:",
    'font-src': "'self' data:",
    'media-src': "'self' blob:",
    'connect-src': "'self'",
    'frame-src': "'self' https://www.google.com",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
    'object-src': "'none'",
    'base-uri': "'self'",
    'manifest-src': "'self'",
    'upgrade-insecure-requests': '',
  };

  if (!isDev) {
    directives['upgrade-insecure-requests'] = '';
  }

  return Object.entries(directives)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, protocol } = request.nextUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  // 1. Force HTTPS behind Netlify's proxy.
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (!isDev && forwardedProto === 'http') {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 308);
  }

  // 2. Cheap pre-filter: no session cookie at all means no point rendering the
  //    admin app. The real check is server-side.
  const isAdminRoute =
    pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdminRoute && pathname !== ADMIN_LOGIN_PATH) {
    const hasSessionCookie = request.cookies.has(
      process.env.SESSION_COOKIE_NAME ?? 'immi_admin_session',
    );
    if (!hasSessionCookie) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = ADMIN_LOGIN_PATH;
      loginUrl.search = '';
      /*
       * `pathname` normally starts with a single `/`, but middleware must not
       * build a redirect parameter out of a value it has not checked: a path
       * beginning `//` would become a protocol-relative URL once the login form
       * honoured it. Anything that is not a plain same-site path becomes the
       * default destination instead.
       */
      loginUrl.searchParams.set(
        'next',
        pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/admin',
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Attach CSP + no-index headers.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const response = NextResponse.next({
    request: {
      headers: new Headers(
        (() => {
          const headers = new Headers(request.headers);
          headers.set('x-nonce', nonce);
          return headers;
        })(),
      ),
    },
  });

  response.headers.set('Content-Security-Policy', buildCsp(nonce, isDev));

  if (NO_INDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set(
      'X-Robots-Tag',
      'noindex, nofollow, noarchive, nosnippet',
    );
  }

  // Never let a shared cache store an authenticated or receipt response.
  if (isAdminRoute || pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }

  void protocol;

  return response;
}

export const config = {
  /*
   * Run on pages and API routes, but skip Next.js internals and static files so
   * we do not pay middleware cost for images, fonts or the favicon.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
};
