import type { Metadata } from 'next';
import { KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { getDb } from '@/db';
import { adminSessions, admins } from '@/db/schema/auth';
import { activityLogs } from '@/db/schema/operations';
import { requireAdminPage } from '@/lib/auth/guard';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Account settings',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/** UTC formatting keeps output identical regardless of server locale. */
function formatUtc(value: Date | null): string {
  if (!value) return '—';
  return `${value.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`;
}

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage();
  const db = getDb();

  const [[record], [sessionCount], recentSignIns] = await Promise.all([
    db
      .select({
        email: admins.email,
        fullName: admins.fullName,
        role: admins.role,
        isActive: admins.isActive,
        mustChangePassword: admins.mustChangePassword,
        passwordChangedAt: admins.passwordChangedAt,
        lastLoginAt: admins.lastLoginAt,
        createdAt: admins.createdAt,
      })
      .from(admins)
      .where(eq(admins.id, admin.adminId))
      .limit(1),
    db
      .select({ value: count() })
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.adminId, admin.adminId),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, new Date()),
        ),
      ),
    db
      .select({
        id: activityLogs.id,
        summary: activityLogs.summary,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .where(eq(activityLogs.actorAdminId, admin.adminId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(5),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Account settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your administrator account and security details.
        </p>
      </header>

      <section
        aria-labelledby="identity-heading"
        className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
      >
        <h2 id="identity-heading" className="text-sm font-semibold text-ink">
          Account
        </h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Full name
            </dt>
            <dd className="mt-0.5 text-sm text-ink">{record?.fullName ?? admin.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </dt>
            <dd className="mt-0.5 break-all text-sm text-ink">{record?.email ?? admin.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Role
            </dt>
            <dd className="mt-0.5 text-sm capitalize text-ink">{record?.role ?? admin.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </dt>
            <dd className="mt-0.5 text-sm text-ink">
              {record?.isActive === false ? 'Deactivated' : 'Active'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Account created
            </dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {formatUtc(record?.createdAt ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last sign-in
            </dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {formatUtc(record?.lastLoginAt ?? null)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="security-heading"
        className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
      >
        <h2
          id="security-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <ShieldCheck aria-hidden="true" className="size-4 text-slate-600" />
          Security
        </h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Password last changed
            </dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {formatUtc(record?.passwordChangedAt ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Active sessions
            </dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {sessionCount?.value ?? 0}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Passwords are stored only as Argon2id hashes — the original value cannot be
          recovered, by us or anyone else. Changing your password signs out every other
          device.
        </p>

        <Link
          href="/admin/change-password"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-strong)] bg-white px-3.5 text-sm font-semibold text-ink transition-colors hover:border-accent-300 hover:bg-accent-50"
        >
          <KeyRound aria-hidden="true" className="size-4" />
          Change password
        </Link>
      </section>

      <section
        aria-labelledby="events-heading"
        className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
      >
        <h2 id="events-heading" className="text-sm font-semibold text-ink">
          Your recent account events
        </h2>

        {recentSignIns.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No account events recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
            {recentSignIns.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-slate-700">
                  {entry.summary || 'Account event'}
                </span>
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="shrink-0 text-xs tabular-nums text-slate-600"
                >
                  {formatUtc(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
