import { cn } from '@/lib/utils/cn';

/**
 * Card surfaces.
 *
 * `Card` is the plain bordered surface used for content; `GlassCard` is the
 * translucent, blurred variant the brief asks for. Both are static components
 * so they can be rendered inside server components — animation is applied by
 * the surrounding motion wrapper, not baked into the surface itself.
 */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassCard({
  className,
  children,
  intensity = 'default',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  intensity?: 'default' | 'strong';
}) {
  return (
    <div
      className={cn(
        'rounded-xl',
        intensity === 'strong' ? 'glass-strong' : 'glass',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-1.5 p-6', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  as: Tag = 'h3',
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as?: 'h2' | 'h3' | 'h4';
}) {
  return (
    <Tag
      className={cn('text-base font-semibold tracking-tight text-ink', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm leading-relaxed text-slate-600', className)} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 pt-0', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...rest}>
      {children}
    </div>
  );
}
