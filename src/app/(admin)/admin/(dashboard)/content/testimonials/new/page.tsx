import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { TestimonialForm } from '@/components/admin/cms/simple-forms';
import { EMPTY_TESTIMONIAL } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New testimonial',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function NewTestimonialPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/testimonials"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All testimonials
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">New testimonial</h1>
        <p className="mt-1 text-sm text-slate-500">Only publish a testimonial you have the client’s permission to use.</p>
      </div>

      <TestimonialForm initial={{ ...EMPTY_TESTIMONIAL }} />
    </div>
  );
}
