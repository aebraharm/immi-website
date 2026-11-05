import { Eye, ExternalLink, AlertTriangle } from 'lucide-react';

/**
 * Preview banner.
 *
 * Tells the administrator, unambiguously, whether what they are looking at is
 * live. This is the difference between "I edited it" and "visitors can see it",
 * and getting that wrong is how draft content leaks or a launch looks broken.
 */
export function PreviewBanner({
  isPublished,
  publicPath,
  note,
  canPreview,
}: {
  isPublished: boolean;
  publicPath: string;
  note?: string;
  /**
   * Whether the public page supports `?preview=1` for this content type.
   * Detail pages (services, destinations, team, legal pages) do; list pages
   * (FAQs, testimonials) do too. Sections with no public page leave this off.
   */
  canPreview?: boolean;
}) {
  // A draft's "open" link has to carry the preview flag, otherwise it would open
  // the published page — which, for a draft, does not exist.
  const href = !isPublished && canPreview ? `${publicPath}?preview=1` : publicPath;
  return (
    <div
      role="status"
      className={
        isPublished
          ? 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900'
          : 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900'
      }
    >
      <span className="flex items-start gap-2">
        {isPublished ? (
          <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}
        <span>
          <strong>{isPublished ? 'This item is live.' : 'This item is a draft.'}</strong>{' '}
          {note ??
            (isPublished
              ? 'Saved changes appear on the public website immediately.'
              : 'Only signed-in administrators can see it. Publish when you are ready.')}
        </span>
      </span>

      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
      >
        Open public page
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
    </div>
  );
}
