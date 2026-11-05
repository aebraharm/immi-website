import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { OwnerOnlyNotice } from '@/components/admin/cms/owner-only-notice';
import { SeoForm } from '@/components/admin/cms/seo-form';
import { hasRole, requireAdminPage, SETTINGS_ROLES } from '@/lib/auth/guard';
import { EMPTY_SEO } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New search override',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewSeoPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  // Owner-only, checked on the server before any page code runs. The navigation
  // hides this page from non-owners as well, but that is cosmetic: this is what
  // answers a direct URL. The API is gated independently, so a hand-crafted
  // POST is refused even if this check were ever removed.
  const admin = await requireAdminPage();
  if (!hasRole(admin, SETTINGS_ROLES)) {
    return (
      <OwnerOnlyNotice description="Adding a search override changes how a page is presented in search results and social previews. Only an owner can do that." />
    );
  }

  const { route } = await searchParams;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/seo"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          Search engine settings
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          Search override
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overrides replace what a page generates for itself. Leave a field empty to keep the
          generated value.
        </p>
      </div>

      <SeoForm initial={{ ...EMPTY_SEO, route: route ?? '' }} />
    </div>
  );
}
