import type { Metadata } from 'next';

import { AssessmentList } from '@/components/admin/assessments/assessment-list';
import { OwnerOnlyNotice } from '@/components/admin/cms/owner-only-notice';
import { getAssessmentSummary } from '@/lib/assessment/admin';
import { ASSESSMENT_STATUS_META } from '@/lib/assessment/status';
import { ASSESSMENT_ROLES, hasRole, requireAdminPage } from '@/lib/auth/guard';

export const metadata: Metadata = {
  title: 'Assessments',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * Assessment inbox.
 *
 * The page itself is a thin shell: the counts are read on the server (so the
 * summary is truthful even before the client list loads), and the table below it
 * is the client component that handles search, filters and pagination.
 */
export default async function AssessmentsPage() {
  const admin = await requireAdminPage();

  if (!hasRole(admin, ASSESSMENT_ROLES)) {
    return (
      <OwnerOnlyNotice
        title="Applicant data is restricted"
        description="Applications contain personal and special-category data, so the inbox is limited to owners and administrators. Your role can still manage website content."
      />
    );
  }

  const summary = await getAssessmentSummary();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Assessments</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Every application submitted through the public assessment form. Search by the
          applicant&apos;s name, email address or the reference they were given, then open
          an application to review it, download the CV, add internal notes or move it
          through the workflow.
        </p>
      </header>

      <section aria-labelledby="status-summary-heading">
        <h2 id="status-summary-heading" className="sr-only">
          Applications by status
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <li className="rounded-lg border border-[var(--border-subtle)] bg-white p-3 shadow-e1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
              {summary.total}
            </p>
          </li>
          {ASSESSMENT_STATUS_META.map((meta) => (
            <li
              key={meta.value}
              className="rounded-lg border border-[var(--border-subtle)] bg-white p-3 shadow-e1"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {meta.order}. {meta.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                {summary.byStatus[meta.value]}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-600">
          Live counts of every stored application. No application is deleted from the
          portal, so these totals only ever grow.
        </p>
      </section>

      <AssessmentList />
    </div>
  );
}
