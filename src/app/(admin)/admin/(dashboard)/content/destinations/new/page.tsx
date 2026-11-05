import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { asc } from 'drizzle-orm';

import { DestinationForm } from '@/components/admin/cms/destination-form';
import { EMPTY_DESTINATION } from '@/lib/cms/form-defaults';
import { getDb } from '@/db';
import { countries } from '@/db/schema';

export const metadata: Metadata = {
  title: 'New destination programme',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewDestinationPage() {
  const db = getDb();
  const countryRows = await db
    .select({ id: countries.id, name: countries.name, isoCode: countries.isoCode })
    .from(countries)
    .orderBy(asc(countries.name));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/destinations"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All programmes
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          New destination programme
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Created as a draft. Requirements and process notes are yours to supply.
        </p>
      </div>

      <DestinationForm initial={{ ...EMPTY_DESTINATION }} countries={countryRows} />
    </div>
  );
}
