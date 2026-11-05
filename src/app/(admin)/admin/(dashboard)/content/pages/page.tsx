import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'Pages',
};

export const dynamic = 'force-dynamic';

export default function PagesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Pages</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Terms and Conditions, Privacy Policy, About Us and any other long-form page. The
          assessment form links to the pages at the slugs <code>terms</code> and{' '}
          <code>privacy</code>.
        </p>
      </header>

      <ContentList
        resourceKey="pages"
        noun="page"
        nounPlural="pages"
        createHref="/admin/content/pages/new"
        editHref="/admin/content/pages"
        publicPrefix=""
        slugKey="slug"
        emptyHint="Create “terms” and “privacy” first — the assessment form will not accept a submission without them."
        columns={[
          { key: 'title', label: 'Page', kind: 'primary', subtitleKey: 'slug', subtitlePrefix: '/' },
          { key: 'version', label: 'Version', kind: 'version' },
          {
            key: 'lastReviewedOn',
            label: 'Reviewed',
            kind: 'date',
            emptyLabel: 'Not dated',
          },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
