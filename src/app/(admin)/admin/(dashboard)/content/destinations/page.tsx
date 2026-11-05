import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import Link from 'next/link';

import { ContentList } from '@/components/admin/cms/content-list';
import { getDb } from '@/db';
import { countries } from '@/db/schema';

export const metadata: Metadata = {
  title: 'Destinations',
};

export const dynamic = 'force-dynamic';

export default async function DestinationsPage() {
  const db = getDb();

  // Country names are resolved here, on the server, and passed down as a plain
  // lookup table — the client list only ever receives serialisable data.
  const countryRows = await db
    .select({ id: countries.id, name: countries.name })
    .from(countries)
    .orderBy(asc(countries.name));

  const countryNameById: Record<string, string> = Object.fromEntries(
    countryRows.map((row) => [row.id, row.name]),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Destination programmes
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Individual visa routes and pathways, each belonging to a country. These drive the
          public destination pages, including their requirements and process information.
        </p>

        {countryRows.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-[var(--border-strong)] bg-white/60 px-3 py-2 text-xs text-slate-600">
            A programme needs a country to belong to.{' '}
            <Link href="/admin/content/countries/new" className="font-semibold text-accent-700 hover:underline">
              Create a country first
            </Link>
            .
          </p>
        ) : null}
      </header>

      <ContentList
        resourceKey="destinations"
        noun="programme"
        nounPlural="programmes"
        createHref="/admin/content/destinations/new"
        editHref="/admin/content/destinations"
        publicPrefix="/destinations"
        slugKey="slug"
        orderable
        allowHardDelete
        emptyHint="Create a programme for each route you actually offer. Nothing is pre-filled with fees, timelines or eligibility rules."
        columns={[
          {
            key: 'title',
            label: 'Programme',
            kind: 'primary',
            subtitleKey: 'countryId',
            lookup: countryNameById,
            emptyLabel: 'Untitled',
          },
          { key: 'isFeatured', label: 'Featured', kind: 'featured' },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
