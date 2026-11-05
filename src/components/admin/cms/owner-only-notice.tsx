import { ShieldCheck } from 'lucide-react';

/**
 * The refusal an administrator sees when a page is owner-only.
 *
 * Rendered *instead of* the page content, by server code that has already checked
 * the role — never by hiding a link. Navigation hides these pages too, but
 * hiding a link is cosmetic; this is the actual answer to a direct URL.
 *
 * The wording says what the restriction protects, not simply "no": an
 * administrator who understands why will ask the owner rather than assume the
 * portal is broken.
 */
export function OwnerOnlyNotice({
  title = 'Owner access required',
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold">
        <ShieldCheck aria-hidden="true" className="size-4" />
        {title}
      </p>
      <p className="mt-2 leading-relaxed">{description}</p>
    </div>
  );
}
