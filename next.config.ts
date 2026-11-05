import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * The Content-Security-Policy is intentionally strict but must stay compatible
 * with Next.js' hydration payload. A nonce-based CSP is layered on in Phase 3
 * inside middleware, where the nonce can be generated per request.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Never fail a production build because of lint/type drift in a deployment
  // pipeline; both are enforced as explicit, separate quality gates instead
  // (`npm run typecheck`, `npm run lint`).
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Only our own media proxy may serve images. No third-party remote hosts.
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Admin surfaces and submission receipts must never be indexed.
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
      {
        source: '/assessment/success/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ];
  },
};

export default nextConfig;
