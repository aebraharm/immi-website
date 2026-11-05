import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OwnerOnlyNotice } from '@/components/admin/cms/owner-only-notice';
import { SeoForm } from '@/components/admin/cms/seo-form';
import { hasRole, requireAdminPage, SETTINGS_ROLES } from '@/lib/auth/guard';
import type { SeoFormValues } from '@/lib/cms/form-defaults';
import { loadSeoOverride } from '@/lib/cms/load';

export const metadata: Metadata = {
  title: 'Edit search override',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditSeoPage({ params }: { params: Promise<{ id: string }> }) {
  // Owner-only. Checked before the record is even loaded, so a non-owner cannot
  // learn what overrides exist by requesting an id.
  const admin = await requireAdminPage();
  if (!hasRole(admin, SETTINGS_ROLES)) {
    return (
      <OwnerOnlyNotice
        title="Owner access required"
        description="Search overrides change how pages are presented in search results and social previews. Only an owner can edit them."
      />
    );
  }

  const { id } = await params;

  const row = await loadSeoOverride(id);
  if (!row) notFound();

  const initial: SeoFormValues = {
    route: row.route,
    title: row.title,
    description: row.description,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageAssetId: row.ogImageAssetId,
    canonicalOverride: row.canonicalOverride,
    noIndex: row.noIndex,
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content/seo"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3" />
        Search engine settings
      </Link>

      <SeoForm initial={initial} />
    </div>
  );
}
