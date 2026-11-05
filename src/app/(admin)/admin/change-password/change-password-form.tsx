'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, inputStyles } from '@/components/ui/field';

/**
 * Change-password form.
 *
 * Two contexts, one component:
 *  - **Forced** (`forced=true`): shown immediately after the first sign-in. No
 *    cancel control is offered, and the user is redirected to the dashboard on
 *    success.
 *  - **Voluntary**: reached from account settings; the copy is calmer and the
 *    user returns to settings.
 *
 * The CSRF token is read from the readable `immi_csrf` cookie and sent as a
 * header. The server compares it against the secret stored on the session row, so
 * a cross-site request cannot forge it.
 */
export function ChangePasswordForm({
  forced,
  email,
}: {
  forced: boolean;
  email: string;
}) {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  function readCookie(name: string): string | null {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1] ?? '') : null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages([]);

    // Client-side check only; the server validates everything again.
    if (newPassword !== confirmPassword) {
      setMessages(['The new passwords do not match.']);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': readCookie('immi_csrf') ?? '',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        messages?: string[];
        retryAfterSeconds?: number;
      };

      if (response.ok) {
        setSucceeded(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        // Give the success state a beat, then move on.
        setTimeout(() => {
          router.replace(forced ? '/admin' : '/admin/settings');
          router.refresh();
        }, 900);
        return;
      }

      if (response.status === 429) {
        setMessages([
          `Too many attempts. Please wait ${data.retryAfterSeconds ?? 900} seconds and try again.`,
        ]);
        return;
      }

      if (response.status === 403) {
        setMessages([
          'Your session could not be verified. Please sign in again.',
        ]);
        return;
      }

      setMessages(
        data.messages && data.messages.length > 0
          ? data.messages
          : ['We could not update your password. Please try again.'],
      );
    } catch {
      setMessages(['We could not reach the server. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        <p className="font-semibold">Your password has been updated.</p>
        <p className="mt-1">
          Other sessions signed in with your previous password have been signed out.
          Taking you to your dashboard…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {messages.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <ul className="list-inside list-disc space-y-1">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field label="Current password" required>
        {({ id }) => (
          <input
            id={id}
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputStyles()}
            disabled={isSubmitting}
          />
        )}
      </Field>

      <Field
        label="New password"
        required
        hint="At least 12 characters, with upper and lower case letters and a number. Avoid your name, your email address and common words."
      >
        {({ id, describedBy }) => (
          <input
            id={id}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            aria-describedby={describedBy}
            className={inputStyles()}
            disabled={isSubmitting}
          />
        )}
      </Field>

      <Field label="Confirm new password" required>
        {({ id }) => (
          <input
            id={id}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={inputStyles()}
            disabled={isSubmitting}
          />
        )}
      </Field>

      <p className="text-xs text-slate-500">
        Changing your password signs out every other device. You are signing in as{' '}
        <span className="font-medium text-slate-700">{email}</span>.
      </p>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        {isSubmitting ? 'Updating…' : forced ? 'Set new password and continue' : 'Update password'}
      </Button>
    </form>
  );
}
