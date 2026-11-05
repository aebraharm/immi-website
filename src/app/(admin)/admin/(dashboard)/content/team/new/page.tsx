import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { TeamMemberForm } from '@/components/admin/cms/simple-forms';
import { EMPTY_TEAM_MEMBER } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New team member',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function NewTeamMemberPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/team"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All team members
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">New team member</h1>
        <p className="mt-1 text-sm text-slate-500">Added as a draft first, so nothing appears publicly until you publish it.</p>
      </div>

      <TeamMemberForm initial={{ ...EMPTY_TEAM_MEMBER }} />
    </div>
  );
}
