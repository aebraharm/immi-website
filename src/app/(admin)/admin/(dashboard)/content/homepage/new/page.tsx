import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { HomepageSectionForm } from '@/components/admin/cms/homepage-form';
import { EMPTY_HOMEPAGE_SECTION } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New homepage section',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function NewHomepageSectionPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/homepage"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          Homepage sections
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          New homepage section
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a layout slot, then write the content that fits it.
        </p>
      </div>

      <HomepageSectionForm initial={{ ...EMPTY_HOMEPAGE_SECTION }} />
    </div>
  );
}
