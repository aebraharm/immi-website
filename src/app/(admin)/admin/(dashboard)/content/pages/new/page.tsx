import type { Metadata } from 'next';

import { PageForm } from '@/components/admin/cms/simple-forms';
import { EMPTY_PAGE } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New page',
};

export const dynamic = 'force-dynamic';

export default function NewPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">New page</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Start as a draft. Nothing here is visible to the public until you publish it. Use the
          slugs <code className="font-mono text-xs">terms</code> and{' '}
          <code className="font-mono text-xs">privacy</code> for the two legal pages the
          assessment form links to.
        </p>
      </header>

      <PageForm initial={EMPTY_PAGE} />
    </div>
  );
}
