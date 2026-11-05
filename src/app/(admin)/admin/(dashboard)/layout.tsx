import type { Metadata } from 'next';

import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * Layout for authenticated administration pages.
 *
 * The guard runs here, so every page nested below inherits the same gate: a
 * visitor without a valid session is redirected before any page code executes.
 * Note that this is a *server-side* check performed on every request — the
 * middleware only performs a cheap cookie-presence pre-check and is never the
 * security boundary.
 */
export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();

  return (
    <AdminShell
      admin={{
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
