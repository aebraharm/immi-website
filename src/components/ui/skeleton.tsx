import { cn } from '@/lib/utils/cn';

/**
 * Loading placeholders.
 *
 * Sections of the site that resolve database content render these while data
 * loads, so the layout never jumps. The shimmer animation is defined in
 * globals.css and is disabled under `prefers-reduced-motion`.
 */

export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton rounded-md', className)}
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-6">
      <Skeleton className="h-5 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  );
}
