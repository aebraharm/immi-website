import Link from 'next/link';

/**
 * Compliance note in the footer.
 *
 * Deliberately factual and free of promises: it states what the agency does and
 * does not do, and it is the only place the site makes a claim about outcomes —
 * namely that no outcome is guaranteed. Visa decisions belong to governments.
 */
export function NewsletterNote() {
  return (
    <div className="mt-10 rounded-lg border border-[var(--border-subtle)] bg-white p-5">
      <p className="text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-ink">Important:</span> visa and
        immigration decisions are made solely by the relevant government
        authorities. Information published on this website is general guidance and
        does not constitute legal advice or a guarantee of eligibility, approval or
        employment. Requirements, fees and processing times change and must always
        be confirmed with the official authority. See our{' '}
        <Link href="/terms" className="font-medium text-accent-700 hover:underline">
          Terms and Conditions
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="font-medium text-accent-700 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
