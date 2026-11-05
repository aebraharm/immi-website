import { FileWarning } from 'lucide-react';

import { Markdown } from '@/components/site/markdown';
import { Container, PageHeader, Section } from '@/components/site/section';
import { EmptyState } from '@/components/site/empty-state';
import type { WebsitePage } from '@/db/queries/types';
import { formatDate } from '@/lib/utils/format';

/**
 * Shared renderer for Terms and Privacy.
 *
 * Both pages share one implementation so the version and date information shown
 * to visitors is always consistent — which matters because the assessment form
 * records the version a client agreed to, and that number must match what was on
 * screen at the time.
 *
 * A page that exists but has never been published renders an explicit notice
 * instead of draft text: publishing unfinished legal terms would be worse than
 * publishing nothing.
 */
export function LegalPage({
  page,
  fallbackTitle,
  eyebrow,
  draftNotice,
}: {
  page: WebsitePage | null;
  fallbackTitle: string;
  eyebrow: string;
  draftNotice?: string;
}) {
  const isPublished = page !== null && page.status === 'published';
  const hasContent = Boolean(page?.contentMd.trim());

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={page?.title?.trim() || fallbackTitle}
        description={page?.subtitle?.trim() || undefined}
      />

      <Section>
        <Container size="narrow">
          {isPublished && hasContent && page ? (
            <>
              <div className="mb-8 flex flex-wrap gap-x-6 gap-y-1 border-b border-[var(--border-subtle)] pb-4 text-xs text-slate-500">
                <span>
                  Version <strong className="font-semibold text-slate-700">{page.version}</strong>
                </span>
                {page.publishedAt ? (
                  <span>
                    Published{' '}
                    <strong className="font-semibold text-slate-700">
                      {formatDate(page.publishedAt)}
                    </strong>
                  </span>
                ) : null}
                {page.lastReviewedOn ? (
                  <span>
                    Last reviewed{' '}
                    <strong className="font-semibold text-slate-700">
                      {page.lastReviewedOn}
                    </strong>
                  </span>
                ) : null}
              </div>

              <Markdown content={page.contentMd} />
            </>
          ) : (
            <EmptyState
              icon={FileWarning}
              title={`${fallbackTitle} has not been published yet`}
              description={
                draftNotice ??
                'This document is being prepared and has not been published. It will appear here once the agency has finalised and published it.'
              }
            />
          )}
        </Container>
      </Section>
    </>
  );
}
