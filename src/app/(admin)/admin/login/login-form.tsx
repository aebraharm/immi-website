'use client';

import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, inputStyles } from '@/components/ui/field';

/**
 * Administrator sign-in form.
 *
 * Security decisions visible here:
 *
 *  - The error message is a single generic string whatever went wrong. It must
 *    not reveal whether the email exists, whether the account is locked, or
 *    whether the password was close.
 *  - `autoComplete="username"` / `"current-password"` are correct so password
 *    managers work; `autoComplete="off"` on a login form actively harms security
 *    by pushing users toward memorable, reused passwords.
 *  - The password field is masked by default with an explicit reveal control,
 *    which is more usable than forcing blind typing.
 *  - On success we do a full `router.replace()` to the destination rather than a
 *    client-side state change, so the newly issued session cookie is definitely
 *    in effect before the next page renders.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailId = useId();

  /**
   * Only allow same-site relative redirects — never an absolute URL.
   *
   * `startsWith('//')` alone is not sufficient in a browser: the URL parser
   * strips leading tabs/newlines *and* treats `\` as `/`, so `/<TAB>/evil.test`
   * and `/\\evil.test` both resolve to a protocol-relative URL on another origin.
   * Rejecting backslashes and control characters from the request, rather than
   * from the browser's interpretation of it, closes that class outright.
   */
  function safeNextTarget(): string {
    if (!nextParam) return '/admin';
    if (/[\u0000-\u001f\u007f\\]/.test(nextParam)) return '/admin';
    if (!nextParam.startsWith('/') || nextParam.startsWith('//')) return '/admin';
    return nextParam;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        // Cookies must be sent and stored.
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = (await response.json()) as {
          mustChangePassword?: boolean;
        };

        const destination = data.mustChangePassword
          ? '/admin/change-password'
          : safeNextTarget();

        router.replace(destination);
        router.refresh();
        return;
      }

      if (response.status === 429) {
        const data = (await response.json().catch(() => ({}))) as {
          retryAfterSeconds?: number;
        };
        const wait = data.retryAfterSeconds;
        setError(
          wait && wait > 0
            ? `Too many attempts. Please try again in ${formatWait(wait)}.`
            : 'Too many attempts. Please try again later.',
        );
        return;
      }

      // Every credential-related failure looks identical to the client.
      setError('Invalid email address or password.');
    } catch {
      setError('We could not reach the server. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor={emailId}
          className="block text-sm font-medium text-ink"
        >
          Email address
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600"
          />
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputStyles('pl-10')}
            placeholder="you@example.com"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <Field label="Password" required optionalLabel="">
        {({ id, describedBy }) => (
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600"
            />
            <input
              id={id}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={describedBy}
              className={inputStyles('pl-10 pr-11')}
              placeholder="Your password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded text-slate-600 transition-colors hover:text-ink"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        )}
      </Field>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
