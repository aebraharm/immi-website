import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'Team profiles',
};

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Team profiles</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          The people shown on the public Our Team page. Publish only qualifications and titles
          the person actually holds — you are responsible for every claim on their profile.
        </p>
      </header>

      <ContentList
        resourceKey="team"
        noun="team member"
        nounPlural="team members"
        createHref="/admin/content/team/new"
        editHref="/admin/content/team"
        publicPrefix="/team"
        slugKey="slug"
        orderable
        emptyHint="Add the people who actually work with clients."
        columns={[
          {
            key: 'fullName',
            label: 'Name',
            kind: 'primary',
            subtitleKey: 'professionalTitle',
            emptyLabel: 'Untitled',
          },
          { key: 'department', label: 'Department', kind: 'text', className: 'max-w-[14rem]' },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
