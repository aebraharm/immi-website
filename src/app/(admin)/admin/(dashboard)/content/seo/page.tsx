import type { Metadata } from 'next';
import Link from 'next/link';

import { OwnerOnlyNotice } from '@/components/admin/cms/owner-only-notice';
import { Badge } from '@/components/ui/badge';
import { ROUTES_WITH_SEO_HINTS } from '@/lib/cms/seo-hints';
import { requireAdminPage, SETTINGS_ROLES, hasRole } from '@/lib/auth/guard';
import { listSeoOverrides } from '@/lib/cms/load';

export const metadata: Metadata = {
  title: 'Search engine settings',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * SEO overview.
 *
 * Lists every route with an override, and every route that has none. "No override"
 * is a normal, healthy state — the page then derives its own metadata from its
 * content — so the second list is framed as informational, not as a to-do list of
 * missing work.
 */
export default async function SeoPage() {
  const admin = await requireAdminPage();

  if (!hasRole(admin, SETTINGS_ROLES)) {
    return (
      <OwnerOnlyNotice description="Search settings affect how every page of the site is presented publicly, so only an owner can edit them." />
    );
  }

  const overrides = await listSeoOverrides();
  const overriddenRoutes = new Set(overrides.map((row) => row.route));
  const withoutOverride = ROUTES_WITH_SEO_HINTS.filter(
    (entry) => !overriddenRoutes.has(entry.route),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Search engine settings
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
            Optional overrides for page titles, descriptions and social-share images. Pages
            left alone generate their own metadata from their content, which is usually the
            better choice.
          </p>
        </div>
        <Link
          href="/admin/content/seo/new"
          className="inline-flex h-9 items-center rounded-md bg-[var(--brand-primary)] px-3.5 text-sm font-semibold text-white shadow-e2 hover:bg-brand-600 active:bg-accent-700"
        >
          Add an override
        </Link>
      </header>

      <section aria-labelledby="existing-heading">
        <h2 id="existing-heading" className="text-sm font-semibold text-ink">
          Overrides in place ({overrides.length})
        </h2>

        {overrides.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-[var(--border-strong)] bg-white/60 p-6 text-center">
            <p className="text-sm font-medium text-ink">No overrides</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
              Every page is generating its own title and description from its content. That is
              a perfectly good state — add an override only where you want different wording.
            </p>
          </div>
        ) : (
          <div className="mt-2 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Routes with a search-engine override</caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Route</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Indexed</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink">{row.route}</td>
                    <td className="max-w-[20rem] truncate px-4 py-2.5 text-slate-600">
                      {row.title || <span className="text-xs italic text-slate-600">From page</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.noIndex ? (
                        <Badge tone="warning">No-index</Badge>
                      ) : (
                        <Badge tone="success">Indexable</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/content/seo/${row.id}`}
                        className="text-xs font-semibold text-accent-700 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="auto-heading">
        <h2 id="auto-heading" className="text-sm font-semibold text-ink">
          Using generated metadata
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          These routes have no override. Nothing is missing — each page builds its own title
          and description from its content.
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {withoutOverride.map((entry) => (
            <li key={entry.route}>
              <Link
                href={`/admin/content/seo/new?route=${encodeURIComponent(entry.route)}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-white px-2.5 py-1 font-mono text-[0.6875rem] text-slate-600 hover:border-accent-300 hover:text-accent-800"
                title={entry.description}
              >
                {entry.route}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
