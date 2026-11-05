import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { CountryForm } from '@/components/admin/cms/country-form';
import { EMPTY_COUNTRY } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New country',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function NewCountryPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/countries"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All countries
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">New country</h1>
        <p className="mt-1 text-sm text-slate-500">
          Created as a draft. Add its programmes once the country exists.
        </p>
      </div>

      <CountryForm initial={{ ...EMPTY_COUNTRY }} />
    </div>
  );
}
