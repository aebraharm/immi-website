/**
 * Preview ribbon.
 *
 * Shown at the top of a public page when an administrator is looking at
 * unpublished content with `?preview=1`. It exists so that nobody ever mistakes
 * a preview for the live site — the difference between the two is the whole
 * point of a draft.
 *
 * Visitors never see this: the page only renders it when a real administrator
 * session asked for the preview.
 */
export function PreviewRibbon({ isPublished }: { isPublished: boolean }) {
  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-sm sm:px-8">
        <span className="rounded bg-amber-950 px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-amber-50">
          Preview
        </span>

        <span>
          {isPublished
            ? 'You are previewing a published page as an administrator.'
            : 'This is unpublished content. Visitors do not see it.'}
        </span>
      </div>
    </div>
  );
}
