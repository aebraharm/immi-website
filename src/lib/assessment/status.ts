/**
 * Assessment status vocabulary.
 *
 * The five statuses are fixed by the specification and **ordered**: New →
 * Under Review → Additional Information Required → Reviewed → Closed. That order
 * is the array order below, and everything that renders a status picker, a
 * dashboard summary or a filter reads it from here, so the portal cannot drift
 * into showing a sixth status or a different sequence.
 *
 * This module deliberately imports nothing. It is shared by server code and by
 * client components, so it must never reach for the database.
 */

import type { BadgeTone } from '@/components/ui/badge';
import type { AssessmentStatus } from '@/db/schema/enums';

export type StatusMeta = {
  value: AssessmentStatus;
  /** Position in the workflow, 1-based. Shown beside the label. */
  order: number;
  label: string;
  /** One sentence an administrator can act on, not a restatement of the label. */
  description: string;
  tone: BadgeTone;
};

export const ASSESSMENT_STATUS_META: readonly StatusMeta[] = [
  {
    value: 'new',
    order: 1,
    label: 'New',
    description: 'Submitted and not yet opened for review.',
    tone: 'info',
  },
  {
    value: 'under_review',
    order: 2,
    label: 'Under Review',
    description: 'An administrator is currently assessing this application.',
    tone: 'warning',
  },
  {
    value: 'additional_info_required',
    order: 3,
    label: 'Additional Information Required',
    description: 'The applicant must supply or clarify something before review can continue.',
    tone: 'danger',
  },
  {
    value: 'reviewed',
    order: 4,
    label: 'Reviewed',
    description: 'Assessment complete; the application is awaiting a final decision.',
    tone: 'success',
  },
  {
    value: 'closed',
    order: 5,
    label: 'Closed',
    description: 'No further action. The record is kept for reference and audit.',
    tone: 'neutral',
  },
] as const;

/** The values in workflow order — the only statuses the portal will ever offer. */
export const ASSESSMENT_STATUS_ORDER: readonly AssessmentStatus[] =
  ASSESSMENT_STATUS_META.map((meta) => meta.value);

const BY_VALUE = new Map<string, StatusMeta>(
  ASSESSMENT_STATUS_META.map((meta) => [meta.value, meta]),
);

/** Metadata for a status value, or a neutral fallback for an unrecognised one. */
export function statusMeta(value: string | null | undefined): StatusMeta {
  return (
    BY_VALUE.get(value ?? '') ?? {
      value: 'new',
      order: 0,
      label: 'Unknown',
      description: 'This record has a status the portal does not recognise.',
      tone: 'neutral',
    }
  );
}

/** Narrow an unvalidated string to a status value. */
export function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return typeof value === 'string' && BY_VALUE.has(value);
}

/** A status label without the ordering prefix, for use inside a sentence. */
export function statusLabel(value: string | null | undefined): string {
  return statusMeta(value).label;
}
