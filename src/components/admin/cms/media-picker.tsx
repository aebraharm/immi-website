'use client';

import { ImageIcon, Loader2, Trash2, UploadCloud } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { MediaPurpose } from '@/db/schema/enums';
import { Button } from '@/components/ui/button';

import { apiRequest } from './client';
import { FormAlert } from './form-kit';

export type MediaItem = {
  id: string;
  url: string;
  purpose: string;
  originalFilename: string;
  detectedMimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  createdAt: string | Date;
};

/**
 * Upload and choose a single file for a field.
 *
 * Three behaviours worth noting:
 *  - The chosen file is uploaded **immediately**, not on form save. Uploading a
 *    30 MB video inside a form submit is how saves time out and administrators
 *    lose their other edits; doing it up front means the save is always small.
 *  - The field stores a media **id**, so the saved content references a stable
 *    row rather than a filename.
 *  - Removing the image clears the reference but does not delete the file, which
 *    stays in the library and can be reused or archived deliberately.
 */
export function MediaPicker({
  label,
  purpose,
  value,
  onChange,
  hint,
  accept,
  showPreview = true,
  kind = 'image',
}: {
  label: string;
  purpose: MediaPurpose;
  value: string | null;
  onChange: (id: string | null, url: string | null) => void;
  hint?: string;
  accept?: string;
  showPreview?: boolean;
  kind?: 'image' | 'video';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);

  // Resolve an existing reference to a URL so the preview survives a reload.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!value) {
        setCurrentUrl(null);
        setCurrentName(null);
        return;
      }

      const result = await apiRequest<{ url: string | null; originalFilename: string }>(
        `/api/admin/cms/media/${value}`,
      );
      if (cancelled) return;

      if (result.ok) {
        setCurrentUrl(result.data.url);
        setCurrentName(result.data.originalFilename);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [value]);

  async function handleFile(file: File) {
    setIsUploading(true);
    setError(null);

    const form = new FormData();
    form.set('file', file);
    form.set('purpose', purpose);

    const result = await apiRequest<{ id: string; url: string }>('/api/admin/cms/media', {
      method: 'POST',
      form,
    });

    if (result.ok) {
      setCurrentUrl(result.data.url);
      setCurrentName(file.name);
      onChange(result.data.id, result.data.url);
    } else {
      setError(result.message);
    }

    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  const defaultAccept =
    accept ?? (kind === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp');
  const inputId = `file-${purpose}-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const labelId = `${inputId}-label`;

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium text-ink">{label}</p>

      {error ? <FormAlert tone="error" title="Upload failed" messages={[error]} /> : null}

      {showPreview && currentUrl ? (
        <div className="relative inline-block">
          {kind === 'image' ? (
            <Image
              src={currentUrl}
              alt={currentName ?? 'Selected image'}
              width={320}
              height={200}
              className="h-32 w-auto max-w-full rounded-md border border-[var(--border-subtle)] object-contain"
              unoptimized
            />
          ) : (
            <video
              src={currentUrl}
              controls
              className="h-32 w-auto max-w-full rounded-md border border-[var(--border-subtle)]"
            />
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={defaultAccept}
          className="sr-only"
          id={inputId}
          aria-labelledby={labelId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <UploadCloud aria-hidden="true" className="size-3.5" />
          )}
          {isUploading ? 'Uploading…' : currentUrl ? 'Replace file' : 'Upload file'}
        </Button>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null, null);
              setCurrentUrl(null);
              setCurrentName(null);
            }}
            className="text-red-700 hover:bg-red-50"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Remove
          </Button>
        ) : null}

        {currentName ? (
          <span className="max-w-[14rem] truncate text-xs text-slate-500" title={currentName}>
            {currentName}
          </span>
        ) : null}

        {!value && !currentUrl ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <ImageIcon aria-hidden="true" className="size-3" />
            Nothing selected
          </span>
        ) : null}
      </div>

      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}
