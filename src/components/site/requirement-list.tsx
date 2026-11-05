import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  GraduationCap,
  Languages,
  ListChecks,
  ScrollText,
} from 'lucide-react';

import type { DestinationRequirement } from '@/db/queries/types';
import type { DestinationRequirementCategory } from '@/db/schema/enums';

/**
 * Destination requirement rendering.
 *
 * The seven content categories the agency can fill in are presented in a fixed,
 * predictable order with their own headings. A category with no entries is
 * omitted entirely — we never print "Not specified" seven times, and we never
 * invent a requirement to fill space.
 *
 * Markdown is deliberately not rendered here: these entries are short factual
 * lines, and rendering admin Markdown inside a bullet list invites formatting
 * that breaks the layout. Line breaks are preserved instead.
 */

const CATEGORY_ORDER: Array<{
  key: DestinationRequirementCategory;
  title: string;
  icon: typeof FileText;
  description: string;
}> = [
  {
    key: 'eligibility',
    title: 'Eligibility requirements',
    icon: CheckCircle2,
    description: 'Criteria an applicant is generally expected to meet.',
  },
  {
    key: 'documents',
    title: 'Required documents',
    icon: FileText,
    description: 'Paperwork typically requested during the process.',
  },
  {
    key: 'language',
    title: 'Language requirements',
    icon: Languages,
    description: 'Language tests or proficiency evidence that may be requested.',
  },
  {
    key: 'qualification',
    title: 'Professional qualifications',
    icon: GraduationCap,
    description: 'Qualifications, licences or assessments that may be relevant.',
  },
  {
    key: 'procedure',
    title: 'Application procedure',
    icon: ListChecks,
    description: 'The steps in the process, in the order they are usually taken.',
  },
  {
    key: 'notice',
    title: 'Important notices',
    icon: AlertTriangle,
    description: 'Things to be aware of before you proceed.',
  },
  {
    key: 'link',
    title: 'Official links',
    icon: ArrowUpRight,
    description: 'Official sources to verify current requirements.',
  },
];

export function RequirementGroups({
  requirements,
}: {
  requirements: DestinationRequirement[];
}) {
  const groups = CATEGORY_ORDER.map((category) => ({
    ...category,
    items: requirements.filter((requirement) => requirement.category === category.key),
  })).filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-10">
      {groups.map((group) => {
        const Icon = group.icon;

        return (
          <section key={group.key} id={`requirements-${group.key}`}>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-700 ring-1 ring-accent-100"
              >
                <Icon className="size-4.5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">{group.title}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {group.description}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2.5 border-l border-[var(--border-subtle)] pl-5">
              {group.items.map((item) => (
                <li key={item.id} className="text-sm leading-relaxed text-slate-700">
                  {group.key === 'link' && item.linkUrl ? (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:underline"
                    >
                      {item.label}
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : (
                    <span className="font-medium text-ink">{item.label}</span>
                  )}

                  {item.detailMd ? (
                    <span className="mt-1 block whitespace-pre-line text-slate-600">
                      {item.detailMd}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        <ScrollText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          Requirements listed here are general guidance entered by the agency and may
          change. Confirm current criteria, fees and timelines with the official
          authority for the destination before making decisions or payments.
        </span>
      </p>
    </div>
  );
}
