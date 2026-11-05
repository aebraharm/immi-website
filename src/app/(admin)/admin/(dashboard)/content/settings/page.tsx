import type { Metadata } from 'next';

import { OwnerOnlyNotice } from '@/components/admin/cms/owner-only-notice';
import { SettingsForm } from '@/components/admin/cms/settings-form';
import { requireAdminPage, SETTINGS_ROLES, hasRole } from '@/lib/auth/guard';
import { readSettings, toSettingsForm } from '@/lib/cms/settings';

export const metadata: Metadata = {
  title: 'Agency settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Agency settings page (owner only).
 *
 * Settings affect every public page at once, so the role check happens on the
 * server here as well as in the API. An editor who reaches the URL directly sees
 * an explanation rather than a form whose save would be rejected.
 */
export default async function SettingsPage() {
  const admin = await requireAdminPage();

  if (!hasRole(admin, SETTINGS_ROLES)) {
    return (
      <OwnerOnlyNotice description="Agency settings change the identity, branding and contact details of the entire site, so only an owner can edit them. Ask an owner if something needs changing." />
    );
  }

  const row = await readSettings();

  return (
    <div className="space-y-4">
      <header className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Agency settings</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Branding, contact details, social links and privacy configuration. These apply
          across the whole public website.
        </p>
        {!row ? (
          <p className="mt-2 rounded-md border border-dashed border-[var(--border-strong)] bg-white/60 px-3 py-2 text-xs text-slate-500">
            Nothing has been saved yet, so the public site is showing its neutral placeholder
            state. Fill in at least the agency name and save to change that.
          </p>
        ) : null}
      </header>

      <SettingsForm initial={toSettingsForm(row)} />
    </div>
  );
}
