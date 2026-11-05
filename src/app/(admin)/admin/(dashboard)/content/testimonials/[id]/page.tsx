import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TestimonialForm } from '@/components/admin/cms/simple-forms';
import { PreviewBanner } from '@/components/admin/cms/preview-banner';
import { loadTestimonial } from '@/lib/cms/load';

export const metadata: Metadata = {
  title: 'Edit testimonial',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditTestimonialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  const loaded = await loadTestimonial(id);
  if (!loaded) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/admin/content/testimonials"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3" />
        All testimonials
      </Link>

      {preview === '1' ? (
        <PreviewBanner
          canPreview
          isPublished={loaded.status === 'published'}
          publicPath="/testimonials"
          note="Draft changes are not visible to visitors until you publish."
        />
      ) : null}

      <TestimonialForm testimonialId={id} initial={loaded} />
    </div>
  );
}
