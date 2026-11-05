'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Confirmation dialog for destructive actions.
 *
 * Deletion and archiving are irreversible from the administrator's point of view,
 * so both are behind an explicit confirmation that names the item and says what
 * will happen. For the genuinely destructive case the administrator types the
 * word "delete", which makes an accidental double-click impossible.
 *
 * Implemented with `<dialog>` so focus trapping, `Escape` and the top layer are
 * the browser's job rather than ours.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  requireTypedWord,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** When set, the administrator must type this word to enable the button. */
  requireTypedWord?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setTyped('');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCancel();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  const blocked = requireTypedWord ? typed.trim() !== requireTypedWord : false;

  return (
    <dialog
      ref={ref}
      className="max-w-md rounded-xl border border-[var(--border-subtle)] bg-white p-0 shadow-e3 backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      aria-labelledby="confirm-title"
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={
              tone === 'danger'
                ? 'grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-700'
                : 'grid size-9 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-700'
            }
          >
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{description}</div>
          </div>
        </div>

        {requireTypedWord ? (
          <div className="mt-4">
            <label
              htmlFor="confirm-typed"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Type {requireTypedWord} to continue
            </label>
            <input
              id="confirm-typed"
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-1 h-10 w-full rounded-md border border-[var(--border-subtle)] px-3 text-sm focus-visible:border-[var(--brand-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] focus-visible:ring-4 focus-visible:ring-accent-600/15"
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tone === 'danger' ? 'destructive' : 'primary'}
            disabled={blocked}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
