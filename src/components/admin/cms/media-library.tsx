'use client';

import { Loader2, RotateCcw, Search, Trash2, UploadCloud } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MediaPurpose } from '@/db/schema/enums';
import { MEDIA_PURPOSES } from '@/db/schema/enums';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

import { apiRequest } from './client';
import { ConfirmDialog } from './confirm-dialog';
import { FormAlert } from './form-kit';

type MediaRow = {
  id: string;
  url: string;
  purpose: string;
  originalFilename: string;
  detectedMimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: string;
  archivedAt: string | null;
};

const PURPOSE_LABELS: Record<MediaPurpose, string> = {
  logo: 'Logo',
  favicon: 'Favicon',
  flag: 'Flag',
  destination: 'Destination',
  team: 'Team photo',
  'testimonial-photo': 'Testimonial photo',
  'testimonial-video': 'Testimonial video',
  service: 'Service image',
  homepage: 'Homepage image',
  page: 'Page image',
  seo: 'Social image',
  cv: 'Applicant document',
  other: 'Other',
};

/** Purposes an administrator may upload from the library screen. */
const UPLOADABLE_PURPOSES = MEDIA_PURPOSES.filter(
  (purpose) => purpose !== 'cv',
);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Media library.
 *
 * Shows what exists, what uses it, and what would happen if it were removed.
 * Archiving is the default removal because a file may still be referenced by a
 * published page — deleting the bytes would leave a broken image behind.
 */
export function MediaLibrary() {
  const [items, setItems] = useState<MediaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<MediaPurpose>('logo');

  const [pendingArchive, setPendingArchive] = useState<MediaRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (purposeFilter !== 'all') params.set('purpose', purposeFilter);
    if (showArchived) params.set('includeArchived', '1');

    const result = await apiRequest<{ items: MediaRow[] }>(
      `/api/admin/cms/media?${params.toString()}`,
    );

    if (result.ok) setItems(result.data.items ?? []);
    else setError(result.message);

    setIsLoading(false);
  }, [search, purposeFilter, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);

    const form = new FormData();
    form.set('file', file);
    form.set('purpose', uploadPurpose);

    const result = await apiRequest('/api/admin/cms/media', { method: 'POST', form });

    if (result.ok) {
      setNotice(`${file.name} uploaded.`);
      await load();
    } else {
      setError(result.message);
    }

    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function archive(item: MediaRow) {
    const result = await apiRequest(`/api/admin/cms/media/${item.id}?mode=archive`, {
      method: 'DELETE',
    });

    if (result.ok) {
      setNotice('File archived. It is no longer served publicly.');
      await load();
    } else {
      setError(result.message);
    }

    setPendingArchive(null);
  }

  async function restore(item: MediaRow) {
    const result = await apiRequest(`/api/admin/cms/media/${item.id}?mode=restore`, {
      method: 'DELETE',
    });

    if (result.ok) {
      setNotice('File restored.');
      await load();
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <FormAlert
          tone="error"
          title="Something went wrong"
          messages={[error]}
          onDismiss={() => setError(null)}
        />
      ) : null}
      {notice ? (
        <FormAlert tone="success" title={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      {/* Upload */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-4 shadow-e1">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="upload-purpose"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              What is this file for?
            </label>
            <select
              id="upload-purpose"
              value={uploadPurpose}
              onChange={(event) => setUploadPurpose(event.target.value as MediaPurpose)}
              className="mt-1 h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white px-2.5 text-sm"
            >
              {UPLOADABLE_PURPOSES.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {PURPOSE_LABELS[purpose]}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            id="library-upload"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />

          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <UploadCloud aria-hidden="true" className="size-3.5" />
            )}
            {isUploading ? 'Uploading…' : 'Upload a file'}
          </Button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          The file type is checked by inspecting the bytes, not the filename. Images up to 8 MB,
          videos up to 100 MB. SVG is not accepted because it can contain script.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by filename or description…"
            aria-label="Search media"
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white pl-9 pr-3 text-sm shadow-e1 focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
          />
        </div>

        <select
          value={purposeFilter}
          onChange={(event) => setPurposeFilter(event.target.value)}
          aria-label="Filter by purpose"
          className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-2.5 text-sm shadow-e1"
        >
          <option value="all">All purposes</option>
          {UPLOADABLE_PURPOSES.map((purpose) => (
            <option key={purpose} value={purpose}>
              {PURPOSE_LABELS[purpose]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="size-3.5 rounded border-slate-300"
          />
          Show archived
        </label>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((cell) => (
            <div key={cell} className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ))}
          <span className="sr-only">Loading media…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white/60 p-8 text-center">
          <p className="text-sm font-medium text-ink">No files yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
            Upload a logo to start. Individual content editors also let you upload directly
            into the field that needs the file.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const isVideo = item.detectedMimeType.startsWith('video/');
            const archived = item.archivedAt !== null;

            return (
              <li
                key={item.id}
                className={cn(
                  'overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1',
                  archived && 'opacity-60',
                )}
              >
                <div className="relative grid h-28 place-items-center bg-[var(--surface-muted)]">
                  {isVideo ? (
                    <span className="text-xs font-medium text-slate-500">Video</span>
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.altText ?? item.originalFilename}
                      width={200}
                      height={112}
                      className="h-28 w-full object-contain"
                      unoptimized
                    />
                  )}
                </div>

                <div className="space-y-1.5 p-2.5">
                  <p className="truncate text-xs font-medium text-ink" title={item.originalFilename}>
                    {item.originalFilename}
                  </p>
                  <p className="text-[0.6875rem] text-slate-500">
                    {PURPOSE_LABELS[item.purpose as MediaPurpose] ?? item.purpose} ·{' '}
                    {formatBytes(item.sizeBytes)}
                    {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                  </p>

                  {archived ? <Badge tone="danger">Archived</Badge> : null}

                  <div className="flex items-center justify-between gap-1 pt-1">
                    {archived ? (
                      <button
                        type="button"
                        onClick={() => void restore(item)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] font-medium text-accent-700 hover:bg-accent-50"
                      >
                        <RotateCcw aria-hidden="true" className="size-3" />
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingArchive(item)}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 aria-hidden="true" className="size-3" />
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive this file?"
        description={
          <>
            It will stop being served publicly. Any page still pointing at it will show a
            missing image rather than the file. Nothing is erased, so you can restore it.
          </>
        }
        confirmLabel="Archive file"
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => {
          if (pendingArchive) void archive(pendingArchive);
        }}
      />
    </div>
  );
}
