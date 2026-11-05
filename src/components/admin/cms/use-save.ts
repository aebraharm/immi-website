'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { apiRequest, summariseFieldErrors } from './client';

/**
 * Shared save behaviour for every CMS editor.
 *
 * Each editor had the same five requirements — track dirty state, send the right
 * verb, surface field errors next to the right input, announce success without
 * stealing focus, and refresh the server-rendered shell — so this hook owns them
 * once.
 *
 * `fieldErrors` is keyed by dotted path (`features.0.label`) which matches the
 * Zod issue paths the API returns, so a repeated-row editor can highlight the
 * exact row that failed.
 */
export function useSave<T>(params: {
  /** Endpoint to PUT/POST to. */
  url: string;
  method?: 'POST' | 'PUT';
  /** Current form values. */
  value: T;
  /** Called after a successful save, e.g. to navigate to the new item. */
  onSuccess?: (data: unknown) => void;
  successMessage?: string;
}) {
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formMessage, setFormMessage] = useState<string[] | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setFieldErrors({});
    setFormMessage(null);
    setSuccess(null);
  }, []);

  const save = useCallback(
    async (payload?: unknown) => {
      setIsSaving(true);
      clearMessages();

      const result = await apiRequest<unknown>(params.url, {
        method: params.method ?? 'PUT',
        body: payload ?? params.value,
      });

      if (result.ok) {
        setSuccess(params.successMessage ?? 'Saved.');
        params.onSuccess?.(result.data);
        // The public site is server-rendered, so a refresh is what makes the
        // change visible there without a new deployment.
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        const summary = summariseFieldErrors(result.fieldErrors);
        setFormMessage(summary.length > 0 ? summary : [result.message]);
      }

      setIsSaving(false);
      return result;
    },
    [clearMessages, params, router],
  );

  /** First error message for a given field path. */
  const errorFor = useCallback(
    (path: string): string | undefined => fieldErrors[path]?.[0],
    [fieldErrors],
  );

  return {
    save,
    isSaving,
    fieldErrors,
    errorFor,
    formMessage,
    success,
    clearMessages,
  };
}
