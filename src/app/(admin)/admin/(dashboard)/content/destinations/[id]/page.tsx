import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { DestinationForm } from '@/components/admin/cms/destination-form';
import type { DestinationFormValues } from '@/lib/cms/form-defaults';
import { PreviewBanner } from '@/components/admin/cms/preview-banner';
import { getDb } from '@/db';
import { countries, destinationRequirements, destinations, visaCategories } from '@/db/schema';
import type { DestinationRequirementCategory } from '@/db/schema/enums';

export const metadata: Metadata = {
  title: 'Edit destination programme',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditDestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  const db = getDb();

  const [destination] = await db
    .select()
    .from(destinations)
    .where(eq(destinations.id, id))
    .limit(1);

  if (!destination) notFound();

  const [countryRows, visaRows, requirementRows] = await Promise.all([
    db
      .select({ id: countries.id, name: countries.name, isoCode: countries.isoCode })
      .from(countries)
      .orderBy(asc(countries.name)),
    db
      .select()
      .from(visaCategories)
      .where(eq(visaCategories.destinationId, id))
      .orderBy(asc(visaCategories.displayOrder)),
    db
      .select()
      .from(destinationRequirements)
      .where(eq(destinationRequirements.destinationId, id))
      .orderBy(asc(destinationRequirements.displayOrder)),
  ]);

  const initial: DestinationFormValues = {
    countryId: destination.countryId,
    slug: destination.slug,
    title: destination.title,
    summary: destination.summary,
    descriptionMd: destination.descriptionMd,
    processingInfoMd: destination.processingInfoMd,
    importantNoticeMd: destination.importantNoticeMd,
    heroImageAssetId: destination.heroImageAssetId,
    isFeatured: destination.isFeatured,
    status: destination.status === 'published' ? 'published' : 'draft',
    visaCategories: visaRows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      descriptionMd: row.descriptionMd,
      isActive: row.isActive,
    })),
    requirements: requirementRows.map((row) => ({
      id: row.id,
      category: row.category as DestinationRequirementCategory,
      label: row.label,
      detailMd: row.detailMd,
      linkUrl: row.linkUrl,
    })),
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content/destinations"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3" />
        All programmes
      </Link>

      {preview === '1' ? (
        <PreviewBanner
          canPreview
          isPublished={destination.status === 'published'}
          publicPath={`/destinations/${destination.slug}`}
          note="Draft changes are not visible to visitors until you publish."
        />
      ) : null}

      <DestinationForm
        destinationId={destination.id}
        initial={initial}
        countries={countryRows}
        publicUrl={`/destinations/${destination.slug}`}
      />
    </div>
  );
}
