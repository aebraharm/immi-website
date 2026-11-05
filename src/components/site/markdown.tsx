import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils/cn';

/**
 * Markdown renderer for administrator-authored content.
 *
 * Security posture: content is written by trusted administrators, but the
 * renderer is still locked down, because a compromised admin session must not
 * become stored XSS for every visitor.
 *
 *  - Raw HTML is never rendered (`skipHtml`).
 *  - `rehype-sanitize` runs with an allowlist that excludes scripts, iframes,
 *    event handlers, inline styles and `javascript:` URLs.
 *  - Links are forced to `rel="noopener noreferrer nofollow"` when external.
 *
 * The permitted tag set is deliberately small: headings, paragraphs, lists,
 * tables, emphasis, code and links — everything a content editor needs on a
 * legal or descriptive page, and nothing that can execute.
 */

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      // Keep target/rel so external links open safely; sanitize still validates
      // the href protocol against the default allowlist.
      ['target', '_blank'],
      ['rel', 'noopener', 'noreferrer', 'nofollow'],
    ],
  },
  tagNames: [
    'p', 'br', 'strong', 'em', 'del', 'blockquote', 'code', 'pre',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'hr',
  ],
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto', 'tel'],
  },
};

export function Markdown({
  content,
  className,
  size = 'default',
}: {
  content: string;
  className?: string;
  size?: 'default' | 'sm';
}) {
  if (!content || content.trim().length === 0) return null;

  return (
    <div
      className={cn(
        'text-slate-700',
        size === 'sm' ? 'text-sm' : 'text-[0.9375rem] sm:text-base',
        // Typographic rhythm for long-form CMS content.
        '[&_a]:font-medium [&_a]:text-accent-700 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-800',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--brand-primary)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600',
        '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.875em]',
        '[&_h2]:mt-10 [&_h2]:text-display-sm [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:first:mt-0',
        '[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:first:mt-0',
        '[&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-ink',
        '[&_hr]:my-8 [&_hr]:border-[var(--border-subtle)]',
        '[&_li]:mt-1.5 [&_li]:leading-relaxed',
        '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6',
        '[&_p]:mt-4 [&_p]:leading-relaxed [&_p]:first:mt-0',
        '[&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-slate-100',
        '[&_strong]:font-semibold [&_strong]:text-ink',
        '[&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
        '[&_td]:border [&_td]:border-[var(--border-subtle)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-left',
        '[&_th]:border [&_th]:border-[var(--border-subtle)] [&_th]:bg-[var(--surface-muted)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold',
        '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        skipHtml
        components={{
          a: ({ href, children, ...props }) => {
            const external = typeof href === 'string' && /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...(external
                  ? { target: '_blank', rel: 'noopener noreferrer nofollow' }
                  : {})}
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
