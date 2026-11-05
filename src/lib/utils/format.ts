/**
 * Formatting helpers shared by the public site and the admin portal.
 *
 * All dates are stored as UTC and rendered in the site's fixed locale so that
 * server-rendered and client-rendered output match exactly (a mismatch would
 * cause React hydration errors).
 */

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatDate(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return DATE_FORMATTER.format(date);
}

export function formatDateTime(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${DATE_TIME_FORMATTER.format(date)} UTC`;
}

/** Human-readable file size, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`;
}

/**
 * Turn an enum value into a display label: `additional_info_required` becomes
 * "Additional Information Required". Used rather than a hardcoded label map so
 * a new enum member can never render as an empty string.
 */
export function humanise(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** "2 days ago" style relative time, for activity feeds. */
export function formatRelative(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days} day${Math.abs(days) === 1 ? '' : 's'} ago`;

  return formatDate(date);
}

/** Format minor currency units (e.g. 250000 cents) as "USD 2,500.00". */
export function formatMinorCurrency(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amountMinor === null || amountMinor === undefined) return '—';
  const code = (currency ?? '').trim().toUpperCase();
  const amount = amountMinor / 100;

  if (!code) return amount.toLocaleString('en-US', { minimumFractionDigits: 2 });

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
}
