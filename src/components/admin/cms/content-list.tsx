'use client';

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ContentStatus } from '@/db/schema/enums';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

import { apiRequest } from './client';
import { ConfirmDialog } from './confirm-dialog';
import { FormAlert } from './form-kit';

export type ListItem = {
  id: string;
  status?: string | boolean;
  displayOrder?: number;
  updatedAt?: string | Date;
  archivedAt?: string | Date | null;
  [key: string]: unknown;
};

/**
 * A column description.
 *
 * Columns are described with data, not with render functions, because this
 * component is a Client Component and functions cannot cross the server/client
 * boundary. A `kind` selects one of a handful of cell renderers, which keeps the
 * table consistent across every module and means a list page can stay a plain
 * Server Component.
 */
export type ColumnKind =
  | 'primary'
  | 'text'
  | 'status'
  | 'featured'
  | 'version'
  | 'date'
  | 'code'
  | 'mono';

export type Column = {
  key: string;
  label: string;
  kind?: ColumnKind;
  className?: string;
  /** `primary`: the second line under the title, e.g. a slug or a country. */
  subtitleKey?: string;
  subtitlePrefix?: string;
  /** `primary`/`mono`: shown when the value is empty. */
  emptyLabel?: string;
  /** `primary`/`text`: map a stored id to a readable label. */
  lookup?: Record<string, string>;
};

type Props = {
  resourceKey: string;
  /** Singular noun, e.g. "service". */
  noun: string;
  /** Plural noun, e.g. "services". */
  nounPlural: string;
  columns: Column[];
  createHref: string;
  /** Base path for an item's editor, e.g. `/admin/content/services`. */
  editHref: string;
  /** Public path prefix, e.g. `/services`. Only published items link out. */
  publicPrefix?: string;
  /** For slug-less resources (FAQs), the public link is the prefix alone. */
  slugKey?: string;
  orderable?: boolean;
  publishable?: boolean;
  allowHardDelete?: boolean;
  /** Extra explanation shown above the table. */
  intro?: string;
  /** Message shown when there is nothing yet, and what to do about it. */
  emptyHint?: string;
};

/** Human label and tone for a status value. */
export function statusLabel(value: unknown): {
  label: string;
  tone: 'success' | 'warning' | 'neutral' | 'danger';
} {
  if (value === true) return { label: 'Visible', tone: 'success' };
  if (value === false) return { label: 'Hidden', tone: 'neutral' };

  switch (String(value)) {
    case 'published':
      return { label: 'Published', tone: 'success' };
    case 'draft':
      return { label: 'Draft', tone: 'warning' };
    case 'archived':
      return { label: 'Archived', tone: 'danger' };
    default:
      return { label: '—', tone: 'neutral' };
  }
}

/**
 * Render one cell from its descriptor.
 *
 * One function rather than a render prop, so the whole table stays serialisable
 * and every module's list looks the same.
 */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined;
}

function Cell({ column, item }: { column: Column; item: ListItem }) {
  const raw = item[column.key];
  const text = typeof raw === 'string' ? raw : isBlank(raw) ? '' : String(raw);

  switch (column.kind) {
    case 'primary': {
      const subtitleRaw = column.subtitleKey ? item[column.subtitleKey] : undefined;
      const subtitle =
        typeof subtitleRaw === 'string'
          ? subtitleRaw
          : isBlank(subtitleRaw)
            ? ''
            : String(subtitleRaw);

      return (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">
            {text ||
              (column.emptyLabel ? (
                <span className="italic text-slate-600">{column.emptyLabel}</span>
              ) : (
                ''
              ))}
          </p>
          {subtitle || column.subtitlePrefix ? (
            <p className="truncate text-xs text-slate-600">
              {column.subtitlePrefix}
              {subtitle}
            </p>
          ) : null}
        </div>
      );
    }

    case 'status': {
      const status = statusLabel(raw);
      return <Badge tone={status.tone}>{status.label}</Badge>;
    }

    case 'featured':
      return raw ? <Badge tone="brand">Featured</Badge> : <span className="text-xs text-slate-600">—</span>;

    case 'code':
      return (
        <span
          aria-hidden="true"
          className="inline-flex min-w-8 items-center justify-center rounded bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-slate-600"
        >
          {text || '??'}
        </span>
      );

    case 'version':
      return <span className="text-xs tabular-nums text-slate-600">v{text || '1'}</span>;

    case 'date':
      return text ? (
        <span className="text-xs tabular-nums text-slate-600">{text}</span>
      ) : (
        <span className="text-xs italic text-slate-600">{column.emptyLabel ?? 'Not set'}</span>
      );

    case 'mono':
      return text ? (
        <span className="font-mono text-xs text-slate-600">{text}</span>
      ) : (
        <span className="text-xs italic text-slate-600">{column.emptyLabel ?? '—'}</span>
      );

    case 'text':
    default: {
      const display = column.lookup?.[text] ?? text;
      return display ? (
        <span className="line-clamp-2 text-slate-600">{display}</span>
      ) : (
        <span className="text-xs italic text-slate-600">{column.emptyLabel ?? '—'}</span>
      );
    }
  }
}

export function ContentList({
  resourceKey,
  noun,
  nounPlural,
  columns,
  createHref,
  editHref,
  publicPrefix,
  slugKey,
  orderable = false,
  publishable = true,
  allowHardDelete = false,
  intro,
  emptyHint,
}: Props) {
  const router = useRouter();

  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContentStatus>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pendingArchive, setPendingArchive] = useState<ListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ListItem | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (showArchived) params.set('includeArchived', '1');

    const result = await apiRequest<{ rows: ListItem[]; total: number }>(
      `/api/admin/cms/${resourceKey}?${params.toString()}`,
    );

    if (result.ok) {
      setItems(result.data.rows ?? []);
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  }, [resourceKey, search, statusFilter, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounce only the keystrokes, not the filter changes.
  const [searchDraft, setSearchDraft] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft), 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  async function setPublished(item: ListItem, publish: boolean) {
    setBusyId(item.id);
    setNotice(null);

    const result = await apiRequest(`/api/admin/cms/${resourceKey}/${item.id}/status`, {
      method: 'POST',
      body: { publish },
    });

    if (result.ok) {
      setNotice(
        publish
          ? `Published. It is now live on the public website.`
          : `Unpublished. It is no longer visible to visitors.`,
      );
      await load();
      router.refresh();
    } else {
      setError(result.message);
    }

    setBusyId(null);
  }

  async function archive(item: ListItem) {
    setBusyId(item.id);
    setNotice(null);

    const result = await apiRequest(
      `/api/admin/cms/${resourceKey}/${item.id}?mode=archive`,
      { method: 'DELETE' },
    );

    if (result.ok) {
      setNotice(`Archived. You can restore it at any time.`);
      await load();
      router.refresh();
    } else {
      setError(result.message);
    }

    setPendingArchive(null);
    setBusyId(null);
  }

  async function restore(item: ListItem) {
    setBusyId(item.id);
    const result = await apiRequest(`/api/admin/cms/${resourceKey}/${item.id}/restore`, {
      method: 'POST',
    });

    if (result.ok) {
      setNotice('Restored as a draft. Publish it when you are ready.');
      await load();
      router.refresh();
    } else {
      setError(result.message);
    }
    setBusyId(null);
  }

  async function hardDelete(item: ListItem) {
    setBusyId(item.id);
    const result = await apiRequest(
      `/api/admin/cms/${resourceKey}/${item.id}?mode=delete`,
      { method: 'DELETE' },
    );

    if (result.ok) {
      setNotice(`Deleted permanently.`);
      await load();
      router.refresh();
    } else {
      setError(result.message);
    }
    setPendingDelete(null);
    setBusyId(null);
  }

  async function move(item: ListItem, direction: -1 | 1) {
    // The list arrives already sorted by `displayOrder`, so its array order *is*
    // the order the administrator sees.
    const ordered = [...items].sort(
      (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0),
    );

    const index = ordered.findIndex((row) => row.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);

    // Optimistic: reorder is instantly reversible by moving again.
    setItems(next);
    setBusyId(item.id);

    const result = await apiRequest(`/api/admin/cms/${resourceKey}/reorder`, {
      method: 'POST',
      body: { ids: next.map((row) => row.id) },
    });

    if (!result.ok) {
      setError(result.message);
      await load();
    } else {
      setNotice('Order saved.');
      router.refresh();
    }

    setBusyId(null);
  }

  const activeIds = useMemo(() => items.map((item) => item.id), [items]);

  /**
   * The public address of an item, or null.
   *
   * Only ever a path we construct here from a slug — never a URL taken from the
   * database — so a stored value cannot become a link to another origin.
   */
  function publicUrl(item: ListItem): string | null {
    if (!publicPrefix) return null;
    if (item.status !== 'published' && item.status !== true) return null;

    const slug = slugKey ? item[slugKey] : undefined;
    if (!slugKey) return publicPrefix || '/';
    if (typeof slug !== 'string' || slug.length === 0) return null;

    return `${publicPrefix}/${slug}`;
  }

  /**
   * The same page with `?preview=1`, which shows unpublished content to a
   * signed-in administrator. Null when the resource has no public page.
   */
  function previewUrl(item: ListItem): string | null {
    if (!publicPrefix) return null;

    if (!slugKey) return `${publicPrefix || '/'}?preview=1`;

    const slug = item[slugKey];
    if (typeof slug !== 'string' || slug.length === 0) return null;

    return `${publicPrefix}/${slug}?preview=1`;
  }

  const editorUrl = (id: string) => `${editHref}/${id}`;

  return (
    <div className="space-y-4">
      {intro ? <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{intro}</p> : null}

      {error ? (
        <FormAlert tone="error" title="Something went wrong" messages={[error]} onDismiss={() => setError(null)} />
      ) : null}
      {notice ? (
        <FormAlert tone="success" title={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600"
          />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={`Search ${nounPlural}…`}
            aria-label={`Search ${nounPlural}`}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white pl-9 pr-3 text-sm shadow-e1 focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
          />
        </div>

        {publishable ? (
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ContentStatus)}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-2.5 text-sm shadow-e1"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        ) : null}

        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="size-3.5 rounded border-slate-300"
          />
          Include archived
        </label>

        <Link href={createHref} className={buttonStyles('primary', 'sm')}>
          <Plus aria-hidden="true" className="size-3.5" />
          New {noun}
        </Link>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-md bg-slate-100" />
          ))}
          <span className="sr-only">Loading {nounPlural}…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white/60 p-8 text-center">
          <p className="text-sm font-medium text-ink">
            {search || statusFilter !== 'all' ? `No ${nounPlural} match that filter` : `No ${nounPlural} yet`}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
            {search || statusFilter !== 'all'
              ? 'Try a different search term, or clear the status filter.'
              : (emptyHint ??
                `Create the first one. Nothing is invented on your behalf — every word comes from you.`)}
          </p>
          {!search && statusFilter === 'all' ? (
            <Link href={createHref} className={cn(buttonStyles('primary', 'sm'), 'mt-4')}>
              <Plus aria-hidden="true" className="size-3.5" />
              New {noun}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1 md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{nounPlural}</caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-slate-500">
                  {orderable ? <th className="w-16 px-2 py-2.5 font-medium">Order</th> : null}
                  {columns.map((column) => (
                    <th key={column.key} className={cn('px-4 py-2.5 font-medium', column.className)}>
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const archived =
                    Boolean(item.archivedAt) || item.status === 'archived';
                  const status = statusLabel(item.status);
                  const viewUrl = publicUrl(item);
                            const previewLink = previewUrl(item);
                  const published = item.status === 'published' || item.status === true;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'border-b border-[var(--border-subtle)] last:border-0 align-top',
                        archived && 'bg-slate-50/60 text-slate-500',
                      )}
                    >
                      {orderable ? (
                        <td className="px-2 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => void move(item, -1)}
                              disabled={index === 0 || busyId === item.id}
                              aria-label={`Move ${noun} up`}
                              className="inline-flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowUp aria-hidden="true" className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void move(item, 1)}
                              disabled={index === items.length - 1 || busyId === item.id}
                              aria-label={`Move ${noun} down`}
                              className="inline-flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowDown aria-hidden="true" className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      ) : null}

                      {columns.map((column) => (
                        <td key={column.key} className={cn('px-4 py-3', column.className)}>
                          <Cell column={column} item={item} />
                        </td>
                      ))}

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {publishable ? (
                            <Badge tone={status.tone}>{status.label}</Badge>
                          ) : null}

                          {archived ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void restore(item)}
                                disabled={busyId === item.id}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50 disabled:opacity-40"
                              >
                                <RotateCcw aria-hidden="true" className="size-3" />
                                Restore
                              </button>
                              {allowHardDelete ? (
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(item)}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 aria-hidden="true" className="size-3" />
                                  Delete
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {viewUrl ? (
                                <a
                                  href={viewUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  <Eye aria-hidden="true" className="size-3" />
                                  View
                                </a>
                              ) : null}

                              {previewLink ? (
                                <a
                                  href={previewLink}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  title="Open the real page with unpublished changes included"
                                >
                                  <EyeOff aria-hidden="true" className="size-3" />
                                  Preview
                                </a>
                              ) : null}

                              <Link
                                href={editorUrl(item.id)}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-ink hover:bg-slate-100"
                              >
                                <Pencil aria-hidden="true" className="size-3" />
                                Edit
                              </Link>

                              {publishable ? (
                                <button
                                  type="button"
                                  onClick={() => void setPublished(item, !published)}
                                  disabled={busyId === item.id}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold disabled:opacity-40',
                                    published
                                      ? 'text-amber-700 hover:bg-amber-50'
                                      : 'text-emerald-700 hover:bg-emerald-50',
                                  )}
                                >
                                  {published ? 'Unpublish' : 'Publish'}
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => setPendingArchive(item)}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-700"
                              >
                                <MoreHorizontal aria-hidden="true" className="size-3" />
                                Archive
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((item, index) => {
              const archived =
                    Boolean(item.archivedAt) || item.status === 'archived';
              const status = statusLabel(item.status);
              const published = item.status === 'published' || item.status === true;

              return (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-lg border border-[var(--border-subtle)] bg-white p-3 shadow-e1',
                    archived && 'bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {columns.slice(0, 2).map((column) => (
                        <div key={column.key} className="min-w-0">
                          <Cell column={column} item={item} />
                        </div>
                      ))}
                    </div>
                    {publishable ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[var(--border-subtle)] pt-2">
                    {orderable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void move(item, -1)}
                          disabled={index === 0 || busyId === item.id}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp aria-hidden="true" className="size-3" /> Up
                        </button>
                        <button
                          type="button"
                          onClick={() => void move(item, 1)}
                          disabled={index === items.length - 1 || busyId === item.id}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown aria-hidden="true" className="size-3" /> Down
                        </button>
                      </>
                    ) : null}

                    {archived ? (
                      <button
                        type="button"
                        onClick={() => void restore(item)}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50"
                      >
                        <RotateCcw aria-hidden="true" className="size-3" /> Restore
                      </button>
                    ) : (
                      <>
                        <Link
                          href={editorUrl(item.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-ink hover:bg-slate-100"
                        >
                          <Pencil aria-hidden="true" className="size-3" /> Edit
                        </Link>
                        {publishable ? (
                          <button
                            type="button"
                            onClick={() => void setPublished(item, !published)}
                            disabled={busyId === item.id}
                            className={cn(
                              'rounded px-2 py-1 text-xs font-semibold',
                              published ? 'text-amber-700' : 'text-emerald-700',
                            )}
                          >
                            {published ? 'Unpublish' : 'Publish'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setPendingArchive(item)}
                          className="rounded px-2 py-1 text-xs text-slate-500"
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-slate-600" aria-live="polite">
            {items.length} {items.length === 1 ? noun : nounPlural}
            {activeIds.length !== items.length ? '' : ''}
          </p>
        </>
      )}

      <ConfirmDialog
        open={pendingArchive !== null}
        title={`Archive this ${noun}?`}
        description={
          <>
            It will be hidden from the public website immediately. Nothing is deleted, so you
            can restore it later from the archived list.
          </>
        }
        confirmLabel="Archive"
        tone="danger"
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => {
          if (pendingArchive) void archive(pendingArchive);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete this ${noun} permanently?`}
        description={
          <>
            This cannot be undone. The record and everything attached to it will be removed
            from the database.
          </>
        }
        confirmLabel="Delete permanently"
        tone="danger"
        requireTypedWord="delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void hardDelete(pendingDelete);
        }}
      />
    </div>
  );
}
