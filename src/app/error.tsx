'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Button, buttonStyles } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * In production the visitor sees a neutral message and a retry control — never
 * a stack trace, a database error, or any hint about the data model. `digest`
 * is the only identifier exposed, which is enough to correlate with server logs
 * without disclosing anything.
 *
 * `console.error` here is the one permitted logging call in application code:
 * it is React's documented hook for reporting a caught error to an error
 * reporter, and it receives only the opaque digest plus the generic message.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Intentionally minimal: no user data, no error payload, just the digest.
    console.error('Unhandled route error', { digest: error.digest });
  }, [error]);

  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-mesh-subtle"
      />

      <h1 className="text-display-md font-semibold text-ink">
        Something went wrong
      </h1>

      <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600">
        We could not complete that request. Please try again in a moment. If the
        problem continues, contact the agency directly.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-slate-600">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonStyles('outline', 'md')}>
          Return to the homepage
        </Link>
      </div>
    </main>
  );
}
