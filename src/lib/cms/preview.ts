import { getCurrentAdmin } from '@/lib/auth/guard';

/**
 * Preview mode for the public pages.
 *
 * An administrator editing a draft needs to see the real page — with the real
 * layout, the real typography and the real components — not a form that
 * approximates it. `?preview=1` on a public detail page does exactly that.
 *
 * Two rules make this safe:
 *
 *  1. Preview is **off unless the session says otherwise**. The query parameter
 *     is a request, not a permission: without a signed-in administrator it is
 *     ignored and the page behaves exactly as it does for the public.
 *  2. Preview only ever *widens a read*. It never exposes applicant data, never
 *     bypasses a role check, and never changes anything in the database.
 */

/** The query parameter that asks for a preview. */
export const PREVIEW_PARAM = 'preview';

/**
 * Should this request render unpublished content?
 *
 * Returns true only when the URL asks for a preview *and* a real administrator
 * session resolves. Any failure is a "no".
 */
export async function isPreviewRequest(searchParams?: {
  [key: string]: string | string[] | undefined;
}): Promise<boolean> {
  const requested = searchParams?.[PREVIEW_PARAM];
  const value = Array.isArray(requested) ? requested[0] : requested;
  if (value !== '1') return false;

  try {
    const admin = await getCurrentAdmin();
    return admin !== null;
  } catch {
    // A failure to resolve the session must never turn into a preview.
    return false;
  }
}
