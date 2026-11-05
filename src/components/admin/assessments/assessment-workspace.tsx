'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileWarning,
  Info,
  Loader2,
  Lock,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiRequest } from '@/components/admin/cms/client';
import { ConfirmDialog } from '@/components/admin/cms/confirm-dialog';
import { FormAlert } from '@/components/admin/cms/form-kit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ASSESSMENT_STATUS_ORDER, statusMeta } from '@/lib/assessment/status';
import type { AssessmentStatus } from '@/db/schema/enums';
import { cn } from '@/lib/utils/cn';

/**
 * The interactive half of an application page.
 *
 * Status changes, internal notes and CV downloads all live here, because they are
 * the three things an administrator does to a record. Everything an applicant
 * wrote is rendered by the server page around this component; nothing here can
 * edit an applicant's answers.
 *
 * Behavioural rules:
 *
 *  - **Status changes need confirmation.** Changing where an application sits in
 *    the workflow is consequential, so the administrator sees the exact
 *    previous → new pair before it is written.
 *  - **The reason is optional, the record is not.** Every change records who made
 *    it and when, whether or not a note was typed.
 *  - **No optimistic status updates.** A status shown on screen is one the server
 *    confirmed. If the save fails, the old status stays and the error explains
 *    why.
 *  - **A CV download is a navigation, not a fetch.** The browser performs it, so
 *    a large file streams and a failure produces the browser's own message; the
 *    route itself answers 404 in words when the file is unavailable.
 */

type Attachment = {
  id: string;
  kind: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  isMissing: boolean;
};

type Note = {
  id: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
  authorEmail: string | null;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'size unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export function StatusPanel({
  assessmentId,
  referenceNumber,
  currentStatus,
  lastChangedAt,
}: {
  assessmentId: string;
  referenceNumber: string;
  currentStatus: AssessmentStatus;
  lastChangedAt: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AssessmentStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = statusMeta(currentStatus);
  const target = statusMeta(selected);
  const isChange = selected !== currentStatus;

  async function save() {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    const result = await apiRequest<{ label: string }>(
      `/api/admin/assessments/${assessmentId}/status`,
      {
        method: 'POST',
        body: { status: selected, note: reason.trim() || undefined },
      },
    );

    setConfirming(false);
    setIsSaving(false);

    if (result.ok) {
      setNotice(
        `Status changed from ${current.label} to ${target.label}. The administrator, the time and both statuses were recorded.`,
      );
      setReason('');
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
    >
      <h2 id="status-heading" className="text-sm font-semibold text-ink">
        Status
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={current.tone}>
          {current.order}. {current.label}
        </Badge>
        <span className="text-xs text-slate-500">
          Last changed {formatDateTime(lastChangedAt)}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">{current.description}</p>

      {notice ? (
        <div className="mt-3">
          <FormAlert
            tone="success"
            title="Status updated"
            messages={[notice]}
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3">
          <FormAlert
            tone="error"
            title="The status was not changed"
            messages={[error, 'The application still shows its previous status. No record was written.']}
            onDismiss={() => setError(null)}
          />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="status-select"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Move this application to
          </label>
          <select
            id="status-select"
            value={selected}
            onChange={(event) => setSelected(event.target.value as AssessmentStatus)}
            className="mt-1 h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white px-2.5 text-sm focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
          >
            {ASSESSMENT_STATUS_ORDER.map((value) => {
              const meta = statusMeta(value);
              return (
                <option key={value} value={value}>
                  {meta.order}. {meta.label}
                  {value === currentStatus ? ' (current)' : ''}
                </option>
              );
            })}
          </select>
          {isChange ? (
            <p className="mt-1 text-xs text-slate-500">{target.description}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="status-reason"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Reason (optional)
          </label>
          <textarea
            id="status-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Requested an updated employment letter."
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
          />
          <p className="mt-1 text-xs text-slate-600">
            Kept with the status history. Never shown to the applicant.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={!isChange || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Change status'
          )}
        </Button>
        {!isChange ? (
          <p className="text-xs text-slate-600">
            Choose a different status to enable this button.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        tone="primary"
        title="Change this application's status?"
        confirmLabel={isSaving ? 'Saving…' : 'Yes, change status'}
        description={
          <div className="space-y-2">
            <p>
              <span className="font-mono text-xs">{referenceNumber}</span> will move from{' '}
              <strong>{current.label}</strong> to <strong>{target.label}</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Your name and the current time are recorded with the change, and the
              previous status is kept in the history. This can be reversed by changing
              the status again.
            </p>
          </div>
        }
        onConfirm={() => void save()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* CV downloads                                                               */
/* -------------------------------------------------------------------------- */

export function DocumentsPanel({
  assessmentId,
  referenceNumber,
  attachments,
}: {
  assessmentId: string;
  referenceNumber: string;
  attachments: Attachment[];
}) {
  return (
    <section
      aria-labelledby="documents-heading"
      className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
    >
      <h2
        id="documents-heading"
        className="flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <Lock aria-hidden="true" className="size-4 text-slate-600" />
        Applicant documents
      </h2>

      {attachments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          This applicant did not attach a CV.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {attachment.kind.toUpperCase()} — {attachment.originalFilename}
                </p>
                <p className="text-xs text-slate-600">
                  {attachment.mimeType} · {formatBytes(attachment.sizeBytes)} · uploaded{' '}
                  {formatDateTime(attachment.uploadedAt)}
                </p>
              </div>

              {attachment.isMissing ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                  <FileWarning aria-hidden="true" className="size-3.5" />
                  File unavailable
                </span>
              ) : (
                <a
                  href={`/api/admin/assessments/${assessmentId}/attachments/${attachment.id}`}
                  // A private document is fetched from the same origin and must
                  // not leak the portal URL to any third party.
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-white px-3 text-sm font-semibold text-ink hover:border-accent-300 hover:bg-accent-50"
                >
                  <Download aria-hidden="true" className="size-3.5" />
                  Download
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
        <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
        <span>
          Downloads are authorised on the server for your signed-in session and are
          recorded against <span className="font-mono">{referenceNumber}</span>. There is
          no public link to these files, and a failed download means the file is no longer
          in storage.
        </span>
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export function NotesPanel({
  assessmentId,
  notes,
}: {
  assessmentId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addNote() {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    const result = await apiRequest(`/api/admin/assessments/${assessmentId}/notes`, {
      method: 'POST',
      body: { body: draft },
    });

    setIsSaving(false);

    if (result.ok) {
      setDraft('');
      setNotice('Note saved. It is visible to administrators only.');
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  async function removeNote(note: Note) {
    setDeletingId(note.id);
    setError(null);

    const result = await apiRequest(
      `/api/admin/assessments/${assessmentId}/notes/${note.id}`,
      { method: 'DELETE' },
    );

    setDeletingId(null);
    setPendingDelete(null);

    if (result.ok) {
      setNotice('Note deleted.');
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <section
      aria-labelledby="notes-heading"
      className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
    >
      <h2 id="notes-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <StickyNote aria-hidden="true" className="size-4 text-slate-600" />
        Internal notes
        <span className="text-xs font-normal text-slate-600">
          ({notes.length})
        </span>
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Private working notes for your team. Never shown to the applicant and never
        included in any public response.
      </p>

      {notice ? (
        <div className="mt-3">
          <FormAlert tone="success" title={notice} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <FormAlert tone="error" title="That note action failed" messages={[error]} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      <div className="mt-4">
        <label htmlFor="note-body" className="sr-only">
          New internal note
        </label>
        <textarea
          id="note-body"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Add a note for the team — e.g. “Called applicant, documents arriving next week.”"
          className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-slate-600">
            {draft.length}/4000
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void addNote()}
            disabled={draft.trim().length === 0 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Add note'
            )}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-sm text-slate-500">
          No notes yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className={cn(
                'rounded-md border px-3 py-2.5',
                note.isPinned
                  ? 'border-accent-200 bg-accent-50/50'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]/40',
              )}
            >
              <p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  {note.authorName ?? 'Former administrator'}
                  {note.authorEmail ? ` · ${note.authorEmail}` : ''} ·{' '}
                  {formatDateTime(note.createdAt)}
                </p>
                <button
                  type="button"
                  onClick={() => setPendingDelete(note)}
                  disabled={deletingId === note.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="Delete this note?"
        confirmLabel="Delete note"
        description={
          <div className="space-y-2">
            <p>This note will be permanently removed. This cannot be undone.</p>
            {pendingDelete ? (
              <p className="rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                {pendingDelete.body.slice(0, 160)}
                {pendingDelete.body.length > 160 ? '…' : ''}
              </p>
            ) : null}
          </div>
        }
        onConfirm={() => {
          if (pendingDelete) void removeNote(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Status history                                                             */
/* -------------------------------------------------------------------------- */

export function StatusHistoryPanel({
  history,
}: {
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string;
    createdAt: string;
    adminName: string | null;
    adminEmail: string | null;
  }>;
}) {
  return (
    <section
      aria-labelledby="history-heading"
      className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
    >
      <h2 id="history-heading" className="text-sm font-semibold text-ink">
        Status history
      </h2>

      {history.length === 0 ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-600" />
          Submitted as <strong className="font-medium text-slate-700">New</strong>. No
          status change has been recorded yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-[var(--border-subtle)] pl-3">
              <p className="text-sm text-ink">
                <span className="text-slate-500">
                  {entry.fromStatus ? statusMeta(entry.fromStatus).label : 'Submitted'}
                </span>
                {' → '}
                <strong className="font-semibold">{statusMeta(entry.toStatus).label}</strong>
              </p>
              <p className="text-xs text-slate-600">
                {entry.adminName ?? 'Former administrator'}
                {entry.adminEmail ? ` · ${entry.adminEmail}` : ''} ·{' '}
                <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
              </p>
              {entry.note ? (
                <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  {entry.note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
        <span>History entries are append-only and cannot be edited or removed.</span>
      </p>
    </section>
  );
}
