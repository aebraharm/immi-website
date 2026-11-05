import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { ServiceForm } from '@/components/admin/cms/service-form';
import type { ServiceFormValues } from '@/lib/cms/form-defaults';
import { PreviewBanner } from '@/components/admin/cms/preview-banner';
import { getDb } from '@/db';
import { serviceFeatures, services } from '@/db/schema';

export const metadata: Metadata = {
  title: 'Edit service',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  const db = getDb();

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);

  if (!service) notFound();

  const features = await db
    .select({ id: serviceFeatures.id, label: serviceFeatures.label, detailMd: serviceFeatures.detailMd })
    .from(serviceFeatures)
    .where(eq(serviceFeatures.serviceId, id))
    .orderBy(asc(serviceFeatures.displayOrder));

  const initial: ServiceFormValues = {
    slug: service.slug,
    title: service.title,
    shortDescription: service.shortDescription,
    descriptionMd: service.descriptionMd,
    iconName: service.iconName,
    imageAssetId: service.imageAssetId,
    ctaLabel: service.ctaLabel,
    ctaHref: service.ctaHref,
    status: service.status === 'published' ? 'published' : 'draft',
    features,
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/services"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All services
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
          {service.title || 'Untitled service'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Last updated{' '}
          {service.updatedAt.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          })}{' '}
          UTC
        </p>
      </div>

      {preview === '1' ? (
        <PreviewBanner
          canPreview
          isPublished={service.status === 'published'}
          publicPath={`/services/${service.slug}`}
          note="Draft changes are not visible to visitors until you publish."
        />
      ) : null}

      <ServiceForm
        serviceId={service.id}
        initial={initial}
        publicUrl={`/services/${service.slug}`}
      />
    </div>
  );
}
