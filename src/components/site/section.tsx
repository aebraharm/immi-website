import { cn } from '@/lib/utils/cn';

import { Reveal } from '@/components/motion/reveal';

/**
 * Layout primitives shared by every public page.
 *
 * Centralising these guarantees consistent spacing, container width and heading
 * rhythm across eleven pages — the "generous spacing" and "visual hierarchy"
 * requirements are properties of the system, not of each page's discretion.
 */

export function Container({
  className,
  children,
  size = 'default',
}: {
  className?: string;
  children: React.ReactNode;
  size?: 'default' | 'narrow' | 'wide';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-5 sm:px-6',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-[var(--width-content)]',
        size === 'wide' && 'max-w-[90rem]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  className,
  children,
  id,
  muted = false,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { muted?: boolean; id?: string }) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-20 lg:py-24',
        muted && 'bg-[var(--surface-muted)]',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

/** Eyebrow + heading + optional lead paragraph, used at the top of every page. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';

  return (
    <Reveal
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
          {eyebrow}
        </p>
      ) : null}

      <Heading
        className={cn(
          'font-semibold text-ink',
          level === 1 ? 'text-display-lg' : 'text-display-md',
          eyebrow ? 'mt-3' : undefined,
        )}
      >
        {title}
      </Heading>

      {description ? (
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

/**
 * Page header used by every inner page.
 *
 * Renders only the content it is given: if no description has been written in
 * the CMS, the paragraph is omitted rather than filled with invented marketing
 * text.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden border-b border-[var(--border-subtle)] bg-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh-subtle" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-fine [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <Container className="py-14 sm:py-18 lg:py-20">
        {breadcrumb ? <div className="mb-5">{breadcrumb}</div> : null}
        <SectionHeading
          level={1}
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
      </Container>
    </div>
  );
}
