'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { Markdown } from '@/components/site/markdown';
import { cn } from '@/lib/utils/cn';
import type { Faq } from '@/db/queries/types';

/**
 * Accessible FAQ accordion.
 *
 * Built on native `<button>` + `aria-expanded` + `aria-controls`, so it works
 * with keyboard and screen readers without extra JavaScript. The answer region
 * is animated open/closed with Framer Motion; under reduced motion it appears
 * immediately, and the content is still in the DOM when closed so in-page search
 * (Ctrl+F) can find it? — no: closed panels are unmounted to keep the DOM light,
 * which is why each question is also present as a heading in the page outline.
 */
export function FaqAccordion({ items }: { items: Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();

  return (
    <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
      {items.map((item) => {
        const isOpen = openId === item.id;
        const panelId = `${baseId}-panel-${item.id}`;
        const buttonId = `${baseId}-button-${item.id}`;

        return (
          <li key={item.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80"
              >
                <span className="text-[0.9375rem] font-semibold text-ink">
                  {item.question}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 size-4 shrink-0 text-slate-600 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={
                    prefersReducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }
                  }
                  exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.12 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5">
                    {item.answerMd ? (
                      <Markdown content={item.answerMd} size="sm" />
                    ) : (
                      <p className="text-sm italic text-slate-600">
                        An answer has not been added yet.
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
