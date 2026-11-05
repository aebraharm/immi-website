import type { Metadata } from 'next';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  FileText,
  GraduationCap,
  Heart,
  History,
  Languages,
  Lock,
  Plane,
  ShieldCheck,
  Sparkles,
  User,
  Briefcase,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  DocumentsPanel,
  NotesPanel,
  StatusHistoryPanel,
  StatusPanel,
} from '@/components/admin/assessments/assessment-workspace';
import { OwnerOnlyNotice } from '@/components/admin/cms/owner-only-notice';
import { Badge } from '@/components/ui/badge';
import { getAssessmentDetail } from '@/lib/assessment/admin';
import { labelFor } from '@/lib/assessment/reference';
import { statusMeta } from '@/lib/assessment/status';
import {
  ASSESSMENT_ROLES,
  hasRole,
  requireAdminPage,
} from '@/lib/auth/guard';

export const metadata: Metadata = {
  title: 'Application',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                       */
/* -------------------------------------------------------------------------- */

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

function orDash(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '—';
}

/** A label/value pair. `wide` spans both columns for long free text. */
function Row({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  description,
  children,
  muted = false,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  description?: string;
  children: React.ReactNode;
  /** Special-category data: gets a visible sensitivity note. */
  muted?: boolean;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1"
    >
      <h2
        id={`${id}-heading`}
        className="flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <Icon aria-hidden="true" className="size-4 text-slate-600" />
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {muted ? (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-relaxed text-amber-900">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          <span>
            Special-category personal data. Handle only for the purpose the applicant
            consented to, and never repeat it in email, chat or a public document.
          </span>
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminPage();

  // The layout already authenticated the session; this is the role gate. An
  // editor reaching the URL directly gets an explanation, not the record.
  if (!hasRole(admin, ASSESSMENT_ROLES)) {
    return (
      <OwnerOnlyNotice
        title="Applicant data is restricted"
        description="Applications contain personal and special-category data, so only owners and administrators can open them. Your role can still manage website content."
      />
    );
  }

  const { id } = await params;
  const detail = await getAssessmentDetail(id);
  if (!detail) notFound();

  const a = detail.assessment;
  const meta = statusMeta(a.status);

  const currentEmployment = detail.employment.filter((row) => row.recordType === 'current');
  const previousEmployment = detail.employment.filter((row) => row.recordType !== 'current');

  const preferredCountry = orDash(detail.preferredCountryName ?? a.preferredCountryText);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/assessments"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          All applications
        </Link>
      </div>

      <header className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 shadow-e1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{a.fullName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="font-mono text-slate-700">{a.referenceNumber}</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock aria-hidden="true" className="size-3.5" />
                Submitted {formatDateTime(a.submittedAt)}
              </span>
              <a
                href={`mailto:${a.email}`}
                className="text-accent-700 hover:underline"
              >
                {a.email}
              </a>
            </p>
          </div>

          <div className="text-right">
            <Badge tone={meta.tone}>
              {meta.order}. {meta.label}
            </Badge>
            <p className="mt-1 text-xs text-slate-600">
              {a.reviewedAt
                ? `Reviewed ${formatDateTime(a.reviewedAt)}`
                : 'Not yet reviewed'}
            </p>
          </div>
        </div>
      </header>

      {/* The three working panels come first: this is what an administrator does. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusPanel
          assessmentId={a.id}
          referenceNumber={a.referenceNumber}
          currentStatus={a.status}
          lastChangedAt={
            detail.statusHistory[0]?.createdAt.toISOString() ?? a.submittedAt.toISOString()
          }
        />

        <DocumentsPanel
          assessmentId={a.id}
          referenceNumber={a.referenceNumber}
          attachments={detail.attachments.map((attachment) => ({
            ...attachment,
            uploadedAt: attachment.uploadedAt.toISOString(),
          }))}
        />
      </div>

      <Section
        id="personal"
        title="Personal information"
        icon={User}
        description="Section A of the applicant's form, as submitted."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Full name" value={a.fullName} />
          <Row label="Date of birth" value={formatDateOnly(a.dateOfBirth)} />
          <Row label="Gender" value={labelFor(a.gender)} />
          <Row label="Marital status" value={labelFor(a.maritalStatus)} />
          <Row label="Nationality" value={a.nationality} />
          <Row label="Country of residence" value={a.countryOfResidence} />
          <Row
            label="Has children"
            value={
              a.hasChildren
                ? `Yes${a.numberOfChildren !== null ? ` — ${a.numberOfChildren}` : ''}`
                : 'No'
            }
          />
          <Row label="Email" value={a.email} />
          <Row label="Mobile" value={`${a.mobileCountryCode} ${a.mobileNumber}`.trim()} />
          <Row
            label="Alternate mobile"
            value={
              a.altMobileNumber
                ? `${a.altMobileCountryCode} ${a.altMobileNumber}`.trim()
                : '—'
            }
          />
          <Row label="Residential address" value={orDash(a.residentialAddress)} wide />
          <Row label="City" value={orDash(a.city)} />
          <Row label="State / province" value={orDash(a.stateProvince)} />
          <Row label="Postal code" value={orDash(a.postalCode)} />
        </dl>
      </Section>

      <Section
        id="passport"
        title="International passport"
        icon={ShieldCheck}
        description="Section B. Shown for verification only — do not copy these numbers elsewhere."
      >
        {a.hasPassport ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label="Passport number" value={orDash(a.passportNumber)} />
            <Row label="City of issue" value={orDash(a.passportCityOfIssue)} />
            <Row label="Issue date" value={formatDateOnly(a.passportIssueDate)} />
            <Row label="Expiry date" value={formatDateOnly(a.passportExpiryDate)} />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">No passport held at the time of submission.</p>
        )}
      </Section>

      <Section
        id="education"
        title={`Education (${detail.education.length})`}
        icon={GraduationCap}
      >
        {detail.education.length === 0 ? (
          <p className="text-sm text-slate-500">No qualifications were listed.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {detail.education.map((entry) => (
              <li key={entry.id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-ink">
                  {labelFor(entry.qualificationLevel)} — {entry.institutionName}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.country} · completed {entry.yearCompleted}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="employment" title="Employment history" icon={Briefcase}>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current employment
            </h3>
            {currentEmployment.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Not currently employed.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {currentEmployment.map((entry) => (
                  <li key={entry.id} className="rounded-md bg-[var(--surface-muted)]/60 p-3">
                    <p className="text-sm font-medium text-ink">
                      {entry.position} — {entry.employerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.country}
                      {entry.startDate ? ` · since ${entry.startDate}` : ''}
                      {entry.monthlySalaryAmount
                        ? ` · ${entry.monthlySalaryCurrency} ${entry.monthlySalaryAmount.toLocaleString('en-GB')} / month`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Previous employment
            </h3>
            {previousEmployment.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No previous roles were listed.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {previousEmployment.map((entry) => (
                  <li key={entry.id} className="rounded-md bg-[var(--surface-muted)]/60 p-3">
                    <p className="text-sm font-medium text-ink">
                      {entry.position} — {entry.employerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.country}
                      {entry.yearsWorked ? ` · ${entry.yearsWorked} year(s)` : ''}
                      {entry.startDate || entry.endDate
                        ? ` · ${entry.startDate ?? '?'} to ${entry.endDate ?? '?'}`
                        : ''}
                      {entry.monthlySalaryAmount
                        ? ` · ${entry.monthlySalaryCurrency} ${entry.monthlySalaryAmount.toLocaleString('en-GB')} / month`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section id="skills" title={`Skills (${detail.skills.length})`} icon={Sparkles}>
          {detail.skills.length === 0 ? (
            <p className="text-sm text-slate-500">No skills were selected.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {detail.skills.map((skill) => (
                <li key={skill.id}>
                  <Badge tone="neutral">{labelFor(skill.skill)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="languages"
          title={`Languages (${detail.languages.length})`}
          icon={Languages}
        >
          {detail.languages.length === 0 ? (
            <p className="text-sm text-slate-500">No languages were listed.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {detail.languages.map((language) => (
                <li
                  key={language.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="text-slate-700">{labelFor(language.language)}</span>
                  <span className="text-xs text-slate-500">
                    {labelFor(language.proficiency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        id="preferences"
        title="Employment preferences"
        icon={Plane}
        description="Section G — where and in what role the applicant wants to work."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Preferred destination" value={preferredCountry} />
          <Row label="Preferred occupation" value={orDash(a.preferredOccupation)} />
          <Row
            label="Expected salary"
            value={
              a.expectedSalaryAmount
                ? `${a.expectedSalaryCurrency} ${a.expectedSalaryAmount.toLocaleString('en-GB')}`
                : 'Not stated'
            }
          />
        </dl>
      </Section>

      <Section
        id="exam"
        title={`Professional examinations (${detail.examinations.length})`}
        icon={FileText}
        description="Section L — IELTS, NCLEX, licensing bodies and similar."
      >
        {a.hasProfessionalExams ? (
          <div className="space-y-3">
            {detail.examinations.length > 0 ? (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {detail.examinations.map((exam) => (
                  <li key={exam.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-ink">{exam.examinationName}</p>
                    {exam.resultNotes ? (
                      <p className="text-xs text-slate-500">{exam.resultNotes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No examination records were listed.</p>
            )}
            {a.professionalExamsNotes ? (
              <Row label="Additional notes" value={a.professionalExamsNotes} wide />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            The applicant stated they have not taken a professional examination.
          </p>
        )}
      </Section>

      <Section
        id="travel"
        title="Travel history"
        icon={Plane}
        description="Section J — countries visited."
      >
        {a.hasTravelledAbroad ? (
          <div className="space-y-3">
            {detail.travel.length > 0 ? (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {detail.travel.map((entry) => (
                  <li key={entry.id} className="py-1.5 text-sm first:pt-0 last:pb-0">
                    <span className="text-slate-800">{entry.country}</span>
                    {entry.notes ? (
                      <span className="text-xs text-slate-500"> — {entry.notes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Row label="Countries visited" value={orDash(a.travelledCountries)} wide />
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            The applicant stated they have not travelled abroad.
          </p>
        )}
      </Section>

      <Section
        id="family"
        title="Family abroad"
        icon={Users}
        description="Section K — relatives who already live overseas."
      >
        {a.hasFamilyAbroad ? (
          detail.familyAbroad.length > 0 ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {detail.familyAbroad.map((entry) => (
                <li key={entry.id} className="py-1.5 text-sm first:pt-0 last:pb-0">
                  <span className="text-slate-800">{entry.country}</span>
                  {entry.relationship ? (
                    <span className="text-xs text-slate-500"> — {entry.relationship}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Row label="Countries" value={orDash(a.familyAbroadCountries)} wide />
          )
        ) : (
          <p className="text-sm text-slate-500">
            The applicant stated they have no family living abroad.
          </p>
        )}
      </Section>

      <Section
        id="declarations"
        title="Additional declarations"
        icon={Heart}
        muted
        description="Sections H and I — medical and criminal-record declarations."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Row label="Medical condition declared" value={yesNo(a.hasMedicalCondition)} />
          <Row label="Criminal record declared" value={yesNo(a.hasCriminalRecord)} />
          {a.hasMedicalCondition ? (
            <Row label="Medical details" value={orDash(a.medicalDetails)} wide />
          ) : null}
          {a.hasCriminalRecord ? (
            <Row
              label="Criminal record details"
              value={orDash(a.criminalRecordDetails)}
              wide
            />
          ) : null}
        </dl>
      </Section>

      <Section
        id="consent"
        title="Consent and accepted policies"
        icon={Lock}
        description="The exact versions the applicant agreed to at the moment of submission. These are immutable snapshots and cannot be rewritten by editing the policies later."
      >
        {detail.consent ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row
              label="Terms & conditions version"
              value={`v${detail.consent.termsVersion}`}
            />
            <Row label="Privacy policy version" value={`v${detail.consent.privacyVersion}`} />
            <Row
              label="Consent accepted at"
              value={formatDateTime(detail.consent.acceptedAt)}
            />
            <Row label="Policy page" value={detail.consent.privacyPageId} />
            <Row label="Wording shown to the applicant" value={detail.consent.consentText} wide />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">
            No consent record was stored with this application. Do not treat it as
            consented — check with the owner before acting on it.
          </p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <NotesPanel
          assessmentId={a.id}
          notes={detail.notes.map((note) => ({
            ...note,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString(),
          }))}
        />

        <StatusHistoryPanel
          history={detail.statusHistory.map((entry) => ({
            ...entry,
            createdAt: entry.createdAt.toISOString(),
          }))}
        />
      </div>

      <Section
        id="activity"
        title="Activity for this application"
        icon={History}
        description="Recorded administration events. Applicant data is never written to the audit trail — only the reference and the kind of event."
      >
        {detail.activity.length === 0 ? (
          <p className="text-sm text-slate-500">No administration activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {detail.activity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-slate-700">
                    {entry.summary || entry.action}
                  </span>
                  <span className="block font-mono text-xs text-slate-600">
                    {entry.action} · {entry.actorEmail ?? 'system'}
                  </span>
                </span>
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="shrink-0 text-xs tabular-nums text-slate-600"
                >
                  {formatDateTime(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-xs leading-relaxed text-slate-600">
        Application <span className="font-mono">{a.referenceNumber}</span> · created{' '}
        {formatDateTime(a.createdAt)} · last updated {formatDateTime(a.updatedAt)}. This
        page is only reachable by a signed-in owner or administrator, and every document
        download is recorded.
      </p>
    </div>
  );
}
