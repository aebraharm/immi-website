import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'Homepage',
};

export const dynamic = 'force-dynamic';

export default function HomepagePage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Homepage</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Each row is one layout slot on the homepage. The slot decides the design; you supply
          every word and image. Hidden sections stay saved but are not rendered.
        </p>
      </header>

      <ContentList
        resourceKey="homepage"
        noun="section"
        nounPlural="sections"
        createHref="/admin/content/homepage/new"
        editHref="/admin/content/homepage"
        publishable={false}
        orderable
        emptyHint="Add a hero section first — it is the block at the top of the homepage."
        columns={[
          {
            key: 'heading',
            label: 'Section',
            kind: 'primary',
            subtitleKey: 'sectionKey',
            emptyLabel: 'No heading yet',
          },
          {
            key: 'subheading',
            label: 'Subheading',
            kind: 'text',
            className: 'max-w-[22rem]',
          },
          { key: 'isVisible', label: 'Visible', kind: 'status' },
        ]}
      />
    </div>
  );
}
