import type { Metadata } from 'next';

import { ContentList } from '@/components/admin/cms/content-list';

export const metadata: Metadata = {
  title: 'FAQs',
};

export const dynamic = 'force-dynamic';

export default function FaqsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">FAQs</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Questions and answers shown on the public FAQ page, grouped by category.
        </p>
      </header>

      <ContentList
        resourceKey="faqs"
        noun="question"
        nounPlural="questions"
        createHref="/admin/content/faqs/new"
        editHref="/admin/content/faqs"
        orderable
        allowHardDelete
        emptyHint="Add the questions your clients actually ask. Nothing is invented on your behalf."
        columns={[
          { key: 'question', label: 'Question', kind: 'primary', subtitleKey: 'category' },
          {
            key: 'answerMd',
            label: 'Answer',
            kind: 'text',
            className: 'max-w-[20rem]',
            emptyLabel: 'Not answered yet',
          },
          { key: 'status', label: 'Published', kind: 'status' },
        ]}
      />
    </div>
  );
}
