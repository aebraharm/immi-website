import type { Metadata } from 'next';
import Link from 'next/link';

import { getDb } from '@/db';
import { activityLogs } from '@/db/schema/operations';
import { requireAdminPage } from '@/lib/auth/guard';
import { desc } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Activity log',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * Read-only activity log.
 *
 * The log deliberately records the actor's email *as it was at the time* plus a
 * hashed IP — never the raw IP, and never any credential or applicant content.
 * Only non-sensitive metadata is rendered here.
 */
export default async function AdminActivityPage() {
  await requireAdminPage();

  const db = getDb();
  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      actorEmail: activityLogs.actorEmailSnapshot,
      summary: activityLogs.summary,
      entityType: activityLogs.entityType,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(PAGE_SIZE);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Activity log</h1>
          <p className="mt-1 text-sm text-slate-500">
            The most recent {PAGE_SIZE} recorded administration events.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs font-semibold text-accent-700 hover:underline"
        >
          Back to dashboard
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white/60 p-8 text-center">
          <p className="text-sm font-medium text-ink">No events recorded yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Sign-ins, sign-outs and password changes are written here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Administration activity, most recent first
              </caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    When (UTC)
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Summary
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Actor
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-slate-500">
                      {row.createdAt.toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                      {row.action}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{row.summary || '—'}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2.5 text-xs text-slate-500">
                      {row.actorEmail || 'system'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-600">
        IP addresses are stored only as salted hashes. This log is append-only from the
        application&apos;s perspective: entries cannot be edited or deleted in the
        interface.
      </p>
    </div>
  );
}
