'use client';

/**
 * CMS fetch helper.
 *
 * Every mutation from the browser needs the same three things: the CSRF token
 * from the readable cookie, a same-origin cookie policy, and a typed result. This
 * wraps that once so no page can forget the token — which would otherwise be the
 * most likely way for an "it says forbidden" bug to appear.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message: string; fieldErrors?: Record<string, string[]> };

function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    /** For multipart uploads: pass the FormData and leave `body` undefined. */
    form?: FormData;
  } = {},
): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';

  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const token = readCookie('immi_csrf');
    if (token) headers['x-csrf-token'] = token;
  }

  let payload: BodyInit | undefined;
  if (options.form) {
    payload = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const text = await response.text();
    const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : {};

    if (response.ok) {
      const envelope = parsed as { ok?: boolean; data?: T };
      return { ok: true, data: (envelope.data ?? ({} as T)) as T };
    }

    const failure = parsed as {
      error?: string;
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

    return {
      ok: false,
      error: failure.error ?? 'request_failed',
      message:
        failure.message ??
        (response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : response.status === 403
            ? 'Your session could not be verified. Reload the page and try again.'
            : 'Something went wrong. Please try again.'),
      fieldErrors: failure.fieldErrors,
    };
  } catch {
    return {
      ok: false,
      error: 'network_error',
      message: 'We could not reach the server. Check your connection and try again.',
    };
  }
}

/** Flatten field errors into messages for a summary alert. */
export function summariseFieldErrors(fieldErrors?: Record<string, string[]>): string[] {
  if (!fieldErrors) return [];
  return Object.values(fieldErrors).flat();
}
