import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PreviewBanner } from '@/components/admin/cms/preview-banner';
import { PageForm } from '@/components/admin/cms/simple-forms';
import { loadPage } from '@/lib/cms/load';

export const metadata: Metadata = {
  title: 'Edit page',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  const loaded = await loadPage(id);
  if (!loaded) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content/pages"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3" />
        All pages
      </Link>

      {preview === '1' ? (
        <PreviewBanner
          isPublished={loaded.values.status === 'published'}
          publicPath={`/${loaded.values.slug}`}
          canPreview
          note="Draft changes are not visible to visitors until you publish."
        />
      ) : null}

      <PageForm pageId={id} initial={loaded.values} version={loaded.version} />
    </div>
  );
}
