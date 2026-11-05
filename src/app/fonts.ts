import localFont from 'next/font/local';

/**
 * Self-hosted brand typeface.
 *
 * Inter is loaded from the `@fontsource-variable/inter` package rather than
 * `next/font/google`, for three deliberate reasons:
 *
 *  1. **Credential-free, network-free builds.** Fetching a font from Google at
 *     build time makes the build depend on a third-party network call — which
 *     fails in restricted CI environments and adds a supply-chain dependency on
 *     someone else's CSS.
 *  2. **Privacy.** No visitor's browser ever contacts Google Fonts, which is a
 *     meaningful improvement for a site that handles immigration enquiries.
 *  3. **Performance.** The file is emitted into `/_next/static`, served from our
 *     own origin, and preloaded automatically by Next.js.
 *
 * The variable file covers the full 100–900 weight range, so one download
 * replaces nine static weights.
 */
export const inter = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2',
      // The `opsz` file carries both the weight and optical-size axes.
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  // Only Latin script is used by the interface, so the Latin subset is enough
  // and keeps the payload small.
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
  preload: true,
});
