import type { Metadata } from 'next';
import { Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentAdmin } from '@/lib/auth/guard';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Administrator sign in',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * Administrator sign-in page.
 *
 * There is no self-registration: no "create account" link, no signup endpoint,
 * no password self-reset. Administrators are provisioned only by the offline
 * `scripts/seed-admin.ts` command, so this page cannot be used to obtain access.
 *
 * An already-authenticated visitor is bounced straight into the portal rather
 * than being asked to sign in again.
 */
export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect(admin.mustChangePassword ? '/admin/change-password' : '/admin');
  }

  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-mesh-subtle"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fine [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-11 place-items-center rounded-lg bg-ink text-white shadow-e2"
          >
            <Lock className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            Administrator sign in
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            This area is restricted to authorised agency staff.
          </p>
        </div>

        <div className="glass-strong rounded-xl p-6">
          <LoginForm />

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-slate-600"
              />
              <span>
                Sessions expire automatically. Repeated failed attempts are rate
                limited and recorded.
              </span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          <Link href="/" className="hover:text-slate-600 hover:underline">
            Return to the public website
          </Link>
        </p>
      </div>
    </main>
  );
}
