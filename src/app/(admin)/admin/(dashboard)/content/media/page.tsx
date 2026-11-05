import type { Metadata } from 'next';

import { MediaLibrary } from '@/components/admin/cms/media-library';

export const metadata: Metadata = {
  title: 'Media library',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function MediaPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Media library</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Every image and video uploaded through the admin portal. Files are content-addressed,
          so replacing one keeps the old version available rather than silently breaking a page
          that still uses it.
        </p>
      </header>

      <MediaLibrary />
    </div>
  );
}
