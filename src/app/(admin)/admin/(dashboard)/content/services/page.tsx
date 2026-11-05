import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'Services',
};

export const dynamic = 'force-dynamic';

export default function ServicesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Immigration services</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          The services shown on the public services page and linked from the menu. Drafts are
          visible only to signed-in administrators.
        </p>
      </header>

      <ContentList
        resourceKey="services"
        noun="service"
        nounPlural="services"
        createHref="/admin/content/services/new"
        editHref="/admin/content/services"
        publicPrefix="/services"
        slugKey="slug"
        orderable
        allowHardDelete
        columns={[
          { key: 'title', label: 'Name', kind: 'primary', subtitleKey: 'slug', subtitlePrefix: '/services/' },
          {
            key: 'shortDescription',
            label: 'Short description',
            kind: 'text',
            className: 'max-w-[22rem]',
            emptyLabel: 'Not written yet',
          },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
