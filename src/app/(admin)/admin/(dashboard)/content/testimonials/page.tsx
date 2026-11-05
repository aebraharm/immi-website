import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'Testimonials',
};

export const dynamic = 'force-dynamic';

export default function TestimonialsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Testimonials</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Client quotes you have permission to publish. An empty testimonials page is better
          than a fabricated one, so nothing is ever seeded here.
        </p>
      </header>

      <ContentList
        resourceKey="testimonials"
        noun="testimonial"
        nounPlural="testimonials"
        createHref="/admin/content/testimonials/new"
        editHref="/admin/content/testimonials"
        publicPrefix="/testimonials"
        orderable
        allowHardDelete
        emptyHint="Add a testimonial only once the client has agreed to it in writing."
        columns={[
          {
            key: 'clientDisplayName',
            label: 'Client',
            kind: 'primary',
            subtitleKey: 'clientCountry',
          },
          {
            key: 'quote',
            label: 'Quotation',
            kind: 'text',
            className: 'max-w-[24rem]',
          },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
