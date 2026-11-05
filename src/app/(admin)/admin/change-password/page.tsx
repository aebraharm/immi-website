import type { Metadata } from 'next';
import { KeyRound, ShieldAlert } from 'lucide-react';

import { requireAdminPage } from '@/lib/auth/guard';

import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = {
  title: 'Change password',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * Change-password screen.
 *
 * This page MUST be reachable while `mustChangePassword` is still true, which is
 * why the guard is called with `allowPendingPasswordChange: true`. Every other
 * admin page redirects here until the change is completed, so the forced change
 * cannot be sidestepped by navigating elsewhere.
 */
export default async function ChangePasswordPage() {
  const admin = await requireAdminPage({ allowPendingPasswordChange: true });
  const forced = admin.mustChangePassword;

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-11 place-items-center rounded-lg bg-ink text-white shadow-e2"
          >
            <KeyRound className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            {forced ? 'Set a new password' : 'Change your password'}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {forced
              ? 'Your account was created with a temporary password. Choose your own password to continue.'
              : 'Enter your current password, then choose a new one.'}
          </p>
        </div>

        {forced ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              You cannot use the administration area until this is complete. The
              temporary password should be treated as compromised.
            </span>
          </div>
        ) : null}

        <div className="glass-strong rounded-xl p-6">
          <ChangePasswordForm forced={forced} email={admin.email} />
        </div>
      </div>
    </main>
  );
}
