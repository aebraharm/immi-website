import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ServiceForm } from '@/components/admin/cms/service-form';
import { EMPTY_SERVICE } from '@/lib/cms/form-defaults';

export const metadata: Metadata = {
  title: 'New service',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function NewServicePage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/content/services"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All services
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">New service</h1>
        <p className="mt-1 text-sm text-slate-500">
          Saved as a draft first, so nothing appears publicly until you publish it.
        </p>
      </div>

      <ServiceForm initial={{ ...EMPTY_SERVICE }} />
    </div>
  );
}
