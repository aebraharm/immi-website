'use client';

import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import { FormAlert } from '@/components/admin/cms/form-kit';
import { apiRequest } from '@/components/admin/cms/client';
import {
  ASSESSMENT_STATUS_ORDER,
  statusMeta,
} from '@/lib/assessment/status';
import type { AssessmentStatus } from '@/db/schema/enums';
import { cn } from '@/lib/utils/cn';

/**
 * The assessment inbox.
 *
 * A table of applications with the four things an administrator actually
 * triages on — applicant, reference, status, submitted date — plus search,
 * status filter, date range, sorting and pagination.
 *
 * Deliberate choices:
 *
 *  - **Filters live in component state and go to the server**, not to a client
 *    array. The database does the filtering and the counting, so the page count
 *    is always truthful and the browser never holds more applicant records than
 *    it is showing.
 *  - **The date inputs are `type="date"`**, because a date range an
 *    administrator cannot pick from a calendar is a date range they will get
 *    wrong. The value is sent as `YYYY-MM-DD` and interpreted as UTC by the
 *    server, which is the same clock the list displays.
 *  - **Every failure is shown in words.** A failed load says what to do next
 *    rather than only colouring the table red.
 */

type Row = {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  nationality: string;
  countryOfResidence: string;
  preferredCountryText: string;
  preferredOccupation: string;
  status: AssessmentStatus;
  submittedAt: string;
  hasCv: boolean;
  noteCount: number;
};

type ListResponse = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type SortKey = 'submitted' | 'applicant' | 'reference' | 'status';

const PAGE_SIZES = [10, 25, 50] as const;

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'submitted', label: 'Submission date' },
  { key: 'applicant', label: 'Applicant name' },
  { key: 'reference', label: 'Reference' },
  { key: 'status', label: 'Status' },
];

/** `2026-02-14T09:31:00.000Z` → `14 Feb 2026` (UTC, matching the server). */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/** Today in `YYYY-MM-DD`, UTC — the same frame the server filters in. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssessmentList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AssessmentStatus | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('submitted');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);

  // Debounce keystrokes only; a filter change should feel immediate.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('sort', sort);
    params.set('direction', direction);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    const result = await apiRequest<ListResponse>(`/api/admin/assessments?${params.toString()}`);

    if (result.ok) {
      setRows(result.data.rows ?? []);
      setTotal(result.data.total ?? 0);
      setPageCount(result.data.pageCount ?? 1);
      // The server clamps the page when a filter shrinks the result set; keep the
      // pager honest rather than showing page 4 of 1.
      if (result.data.page && result.data.page !== page) setPage(result.data.page);
    } else {
      setError(result.message);
      setRows([]);
      setTotal(0);
    }

    setIsLoading(false);
  }, [search, status, from, to, sort, direction, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilters = useMemo(
    () => Boolean(search || status !== 'all' || from || to),
    [search, status, from, to],
  );

  function clearFilters() {
    setSearchDraft('');
    setSearch('');
    setStatus('all');
    setFrom('');
    setTo('');
    setPage(1);
  }

  function toggleDirection() {
    setDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <FormAlert
          tone="error"
          title="Assessments could not be loaded"
          messages={[
            error,
            'Nothing was changed. Check your connection and try again — if it keeps failing, sign out and back in.',
          ]}
          onDismiss={() => setError(null)}
        />
      ) : null}

      {/* Search and primary filters */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-3 shadow-e1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600"
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by name, email or reference (IMA-…)"
              aria-label="Search applications by applicant name, email address or reference number"
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white pl-9 pr-3 text-sm shadow-e1 focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AssessmentStatus | 'all');
              setPage(1);
            }}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-2.5 text-sm shadow-e1"
          >
            <option value="all">All statuses</option>
            {ASSESSMENT_STATUS_ORDER.map((value) => {
              const meta = statusMeta(value);
              return (
                <option key={value} value={value}>
                  {meta.order}. {meta.label}
                </option>
              );
            })}
          </select>

          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-from" className="text-xs text-slate-500">
              From
            </label>
            <input
              id="filter-from"
              type="date"
              value={from}
              max={to || todayIso()}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-2 text-sm shadow-e1"
            />
            <label htmlFor="filter-to" className="text-xs text-slate-500">
              to
            </label>
            <input
              id="filter-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-2 text-sm shadow-e1"
            />
          </div>

          {activeFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <X aria-hidden="true" className="size-3.5" />
              Clear
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2">
          <label htmlFor="sort-by" className="text-xs text-slate-500">
            Sort by
          </label>
          <select
            id="sort-by"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setPage(1);
            }}
            className="h-8 rounded-md border border-[var(--border-subtle)] bg-white px-2 text-xs"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={toggleDirection}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            aria-label={
              direction === 'desc'
                ? 'Descending. Sorted newest first. Switch to oldest first'
                : 'Ascending. Sorted oldest first. Switch to newest first'
            }
          >
            {direction === 'desc' ? (
              <ArrowDownWideNarrow aria-hidden="true" className="size-3.5" />
            ) : (
              <ArrowUpWideNarrow aria-hidden="true" className="size-3.5" />
            )}
            {direction === 'desc' ? 'Descending' : 'Ascending'}
          </button>

          <label htmlFor="page-size" className="ml-auto text-xs text-slate-500">
            Rows per page
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-[var(--border-subtle)] bg-white px-2 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Count line — always says what is being shown out of what exists. */}
      <p className="text-xs text-slate-500" aria-live="polite">
        {isLoading
          ? 'Loading applications…'
          : total === 0
            ? activeFilters
              ? 'No applications match these filters.'
              : 'No applications have been submitted yet.'
            : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} application${total === 1 ? '' : 's'}${activeFilters ? ' matching your filters' : ''}.`}
      </p>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-md bg-slate-100" />
          ))}
          <span className="sr-only">Loading applications…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white/60 p-8 text-center">
          <p className="text-sm font-medium text-ink">
            {activeFilters ? 'Nothing matches those filters' : 'No applications yet'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
            {activeFilters
              ? 'Try a different search term, a wider date range, or clear the status filter.'
              : 'Applications appear here automatically the moment an applicant submits the assessment form. Nothing needs to be switched on.'}
          </p>
          {activeFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className={cn(buttonStyles('outline', 'sm'), 'mt-4')}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Submitted applications, {total} in total
                </caption>
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-2.5 font-medium">Applicant</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Reference</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Submitted</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Documents</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = statusMeta(row.status);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border-subtle)] align-top last:border-0 hover:bg-[var(--surface-muted)]/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/assessments/${row.id}`}
                            className="block font-medium text-ink hover:text-accent-700 hover:underline"
                          >
                            {row.fullName}
                          </Link>
                          <span className="block truncate text-xs text-slate-600">
                            {row.email}
                          </span>
                          <span className="block truncate text-xs text-slate-600">
                            {row.nationality}
                            {row.countryOfResidence ? ` · based in ${row.countryOfResidence}` : ''}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-mono text-xs text-slate-700">
                            {row.referenceNumber}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-slate-600">
                          {formatDate(row.submittedAt)}
                          <span className="block text-slate-600">
                            {formatTime(row.submittedAt)} UTC
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={meta.tone}>
                            {meta.order}. {meta.label}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <FileText aria-hidden="true" className="size-3.5 text-slate-600" />
                            {row.hasCv ? 'CV' : 'No CV'}
                          </span>
                          {row.noteCount > 0 ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-slate-500">
                              <StickyNote aria-hidden="true" className="size-3.5 text-slate-600" />
                              {row.noteCount}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/assessments/${row.id}`}
                            className={buttonStyles('outline', 'sm')}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards — a table is unusable at this width. */}
          <ul className="space-y-2 md:hidden">
            {rows.map((row) => {
              const meta = statusMeta(row.status);
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-white p-4 shadow-e1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/assessments/${row.id}`}
                        className="block truncate font-medium text-ink hover:underline"
                      >
                        {row.fullName}
                      </Link>
                      <p className="truncate text-xs text-slate-600">{row.email}</p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-600">Reference</dt>
                      <dd className="font-mono text-slate-700">{row.referenceNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600">Submitted</dt>
                      <dd className="tabular-nums text-slate-700">
                        {formatDate(row.submittedAt)}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/admin/assessments/${row.id}`}
                    className={cn(buttonStyles('outline', 'sm'), 'mt-3 w-full')}
                  >
                    Open application
                    <Download aria-hidden="true" className="size-3.5 opacity-0" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {pageCount > 1 ? (
            <nav
              aria-label="Application pages"
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 shadow-e1"
            >
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Previous
              </button>

              <span className="text-xs tabular-nums text-slate-500">
                Page {page} of {pageCount}
              </span>

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
