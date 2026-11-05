import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { HomepageSectionForm } from '@/components/admin/cms/homepage-form';
import type { HomepageSectionFormValues } from '@/lib/cms/form-defaults';
import { PreviewBanner } from '@/components/admin/cms/preview-banner';
import { loadHomepageSection } from '@/lib/cms/load';

export const metadata: Metadata = {
  title: 'Edit homepage section',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditHomepageSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  const section = await loadHomepageSection(id);
  if (!section) notFound();

  const initial: HomepageSectionFormValues = {
    sectionKey: section.sectionKey,
    heading: section.heading,
    subheading: section.subheading,
    bodyMd: section.bodyMd,
    ctaLabel: section.ctaLabel,
    ctaHref: section.ctaHref,
    secondaryCtaLabel: section.secondaryCtaLabel,
    secondaryCtaHref: section.secondaryCtaHref,
    imageAssetId: section.imageAssetId,
    isVisible: section.isVisible,
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content/homepage"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3" />
        Homepage sections
      </Link>

      {preview === '1' ? (
        <PreviewBanner
          isPublished={section.isVisible}
          publicPath="/"
          note="Hidden sections do not appear on the public homepage."
        />
      ) : null}

      <HomepageSectionForm sectionId={section.id} initial={initial} />
    </div>
  );
}
