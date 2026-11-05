import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { CountryForm } from '@/components/admin/cms/country-form';
import type { CountryFormValues } from '@/lib/cms/form-defaults';
import { PreviewBanner } from '@/components/admin/cms/preview-banner';
import { getDb } from '@/db';
import { countries, destinations } from '@/db/schema';

export const metadata: Metadata = {
  title: 'Edit country',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditCountryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  const db = getDb();

  const [country] = await db.select().from(countries).where(eq(countries.id, id)).limit(1);
  if (!country) notFound();

  // Programmes belonging to this country, so the editor can show what a delete
  // would affect rather than letting the administrator find out afterwards.
  const programmes = await db
    .select({ id: destinations.id, title: destinations.title, status: destinations.status })
    .from(destinations)
    .where(eq(destinations.countryId, id));

  const initial: CountryFormValues = {
    name: country.name,
    isoCode: country.isoCode,
    slug: country.slug,
    flagEmoji: country.flagEmoji,
    flagAssetId: country.flagAssetId,
    heroImageAssetId: country.heroImageAssetId,
    summary: country.summary,
    descriptionMd: country.descriptionMd,
    isFeatured: country.isFeatured,
    status: country.status === 'published' ? 'published' : 'draft',
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content/countries"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3" />
        All countries
      </Link>

      {preview === '1' ? (
        <PreviewBanner
          canPreview
          isPublished={country.status === 'published'}
          publicPath={`/destinations/${country.slug}`}
          note="Draft changes are not visible to visitors until you publish."
        />
      ) : null}

      <CountryForm
        countryId={country.id}
        initial={initial}
        publicUrl={`/destinations/${country.slug}`}
      />

      <section
        aria-labelledby="programmes-heading"
        className="mx-auto max-w-3xl rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
      >
        <h2 id="programmes-heading" className="text-sm font-semibold text-ink">
          Programmes in this country
        </h2>

        {programmes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No programmes yet. Add one from{' '}
            <Link href="/admin/content/destinations/new" className="font-medium text-accent-700 hover:underline">
              Destinations
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
            {programmes.map((programme) => (
              <li key={programme.id} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={`/admin/content/destinations/${programme.id}`}
                  className="min-w-0 truncate text-sm text-ink hover:underline"
                >
                  {programme.title || 'Untitled programme'}
                </Link>
                <span className="shrink-0 text-xs capitalize text-slate-500">
                  {programme.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          A country with programmes cannot be deleted, only archived — deleting it would
          orphan those programmes and any future application that references it.
        </p>
      </section>
    </div>
  );
}
