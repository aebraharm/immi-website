import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'Countries',
};

export const dynamic = 'force-dynamic';

export default function CountriesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Destination countries</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          The countries shown on the destinations page. Each one holds its own programmes,
          visa categories and requirements. Nothing is listed until you create it.
        </p>
      </header>

      <ContentList
        resourceKey="countries"
        noun="country"
        nounPlural="countries"
        createHref="/admin/content/countries/new"
        editHref="/admin/content/countries"
        publicPrefix="/destinations"
        slugKey="slug"
        orderable
        emptyHint="Add only the countries you actually place clients in."
        columns={[
          { key: 'name', label: 'Country', kind: 'primary', subtitleKey: 'slug', subtitlePrefix: '/destinations/' },
          { key: 'isoCode', label: 'Code', kind: 'code' },
          { key: 'isFeatured', label: 'Featured', kind: 'featured' },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
