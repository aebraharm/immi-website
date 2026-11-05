import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileText,
  Globe2,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { getDb } from '@/db';
import { admins, adminSessions } from '@/db/schema/auth';
import { services } from '@/db/schema/content';
import { destinations } from '@/db/schema/destinations';
import { teamMembers, testimonials } from '@/db/schema/people';
import { activityLogs } from '@/db/schema/operations';
import { getAssessmentSummary } from '@/lib/assessment/admin';
import { ASSESSMENT_STATUS_META } from '@/lib/assessment/status';
import { ASSESSMENT_ROLES, hasRole, requireAdminPage } from '@/lib/auth/guard';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Administration dashboard.
 *
 * Every number on this page is a real `count()` against the database — there are
 * no placeholder metrics and no fabricated figures. The assessment panel is
 * counted per status, so a queue that has emptied out reads `0` rather than
 * disappearing.
 *
 * Applicant figures are only read for roles that may see applicant data: an
 * editor's dashboard does not query the assessments table at all, so there is no
 * path by which a count of applications could be inferred from a page an editor
 * can open.
 */

type CountQuery = PromiseLike<Array<{ value: number }>>;

async function scalar(query: CountQuery): Promise<number> {
  const rows = await query;
  return rows[0]?.value ?? 0;
}

/** "Live" = published and not archived. Drafts never inflate these totals. */
const LIVE = 'published' as const;

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage();

  const db = getDb();
  const canSeeAssessments = hasRole(admin, ASSESSMENT_ROLES);

  const [
    serviceCount,
    destinationCount,
    teamCount,
    testimonialCount,
    activeSessions,
    adminCount,
    recentActivity,
    assessmentSummary,
  ] = await Promise.all([
      scalar(
        db
          .select({ value: count() })
          .from(services)
          .where(and(eq(services.status, LIVE), isNull(services.archivedAt))),
      ),
      scalar(
        db
          .select({ value: count() })
          .from(destinations)
          .where(and(eq(destinations.status, LIVE), isNull(destinations.archivedAt))),
      ),
      scalar(
        db
          .select({ value: count() })
          .from(teamMembers)
          .where(and(eq(teamMembers.status, LIVE), isNull(teamMembers.archivedAt))),
      ),
      scalar(
        db
          .select({ value: count() })
          .from(testimonials)
          .where(and(eq(testimonials.status, LIVE), isNull(testimonials.archivedAt))),
      ),
      scalar(
        db
          .select({ value: count() })
          .from(adminSessions)
          .where(and(isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, new Date()))),
      ),
      scalar(db.select({ value: count() }).from(admins).where(eq(admins.isActive, true))),
      db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          summary: activityLogs.summary,
          createdAt: activityLogs.createdAt,
        })
        .from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(8),
      // Not a second query for editors: they may not see applicant data at all.
      canSeeAssessments
        ? getAssessmentSummary()
        : Promise.resolve(null),
    ]);

  const greeting = admin.fullName.split(/\s+/)[0] ?? 'there';

  const stats = [
    { label: 'Published services', value: serviceCount, href: null, icon: FileText },
    { label: 'Destination pages', value: destinationCount, href: null, icon: Globe2 },
    { label: 'Team members', value: teamCount, href: null, icon: Users },
    { label: 'Testimonials', value: testimonialCount, href: null, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Welcome back, {greeting}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as <span className="font-medium text-slate-700">{admin.email}</span>
          {' · '}
          <span className="capitalize">{admin.role}</span>
        </p>
      </header>

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">
          Content overview
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <li
                key={stat.label}
                className="rounded-lg border border-[var(--border-subtle)] bg-white p-4 shadow-e1"
              >
                <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <Icon aria-hidden="true" className="size-3.5" />
                  {stat.label}
                </span>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {stat.value}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-600">
          Content totals count live records only; drafts and archived items are excluded.
          Assessment totals count every stored application, because none is ever deleted.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="security-heading"
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1 lg:col-span-1"
        >
          <h2
            id="security-heading"
            className="flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <Lock aria-hidden="true" className="size-4 text-slate-600" />
            Account security
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Active sessions</dt>
              <dd className="font-medium tabular-nums text-ink">{activeSessions}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Administrators</dt>
              <dd className="font-medium tabular-nums text-ink">{adminCount}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Session expires</dt>
              <dd className="text-right text-xs text-slate-600">
                {admin.expiresAt.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })}{' '}
                UTC
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Sessions are signed out automatically after 30 minutes of inactivity, and
            in all cases after 8 hours.
          </p>

          <Link
            href="/admin/settings"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline"
          >
            Account settings
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        </section>

        <section
          aria-labelledby="activity-heading"
          className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1 lg:col-span-2"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="activity-heading"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <Activity aria-hidden="true" className="size-4 text-slate-600" />
              Recent activity
            </h2>
            <Link
              href="/admin/activity"
              className="text-xs font-semibold text-accent-700 hover:underline"
            >
              View all
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No activity recorded yet. Sign-in and account events will appear here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
              {recentActivity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {entry.summary || entry.action}
                    </span>
                    <span className="block text-xs text-slate-600">{entry.action}</span>
                  </span>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    className="shrink-0 text-xs tabular-nums text-slate-600"
                  >
                    {entry.createdAt.toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'UTC',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {assessmentSummary ? (
        <section
          aria-labelledby="assessments-heading"
          className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="assessments-heading"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <ClipboardList aria-hidden="true" className="size-4 text-slate-600" />
              Assessments
            </h2>
            <Link
              href="/admin/assessments"
              className="text-xs font-semibold text-accent-700 hover:underline"
            >
              Open the inbox
            </Link>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Live counts of every application submitted through the assessment form.
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <li className="rounded-md bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                {assessmentSummary.total}
              </p>
            </li>
            {ASSESSMENT_STATUS_META.map((meta) => (
              <li
                key={meta.value}
                className="rounded-md bg-[var(--surface-muted)] p-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {meta.order}. {meta.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {assessmentSummary.byStatus[meta.value]}
                </p>
              </li>
            ))}
          </ul>

          {assessmentSummary.total === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              No applications have been submitted yet. This panel fills in automatically
              when the first one arrives — nothing needs to be configured.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
