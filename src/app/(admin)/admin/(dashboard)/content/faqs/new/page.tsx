import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { FaqForm } from '@/components/admin/cms/simple-forms';
import { EMPTY_FAQ } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New question',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function NewFaqPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/faqs"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All questions
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">New question</h1>
        <p className="mt-1 text-sm text-slate-500">Added as a draft first, so nothing appears publicly until you publish it.</p>
      </div>

      <FaqForm initial={{ ...EMPTY_FAQ }} />
    </div>
  );
}
