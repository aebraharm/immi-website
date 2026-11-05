'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils/cn';

/**
 * Reveal — an animated section entrance.
 *
 * Used to bring content in as it scrolls into view. The component is
 * deliberately conservative:
 *
 *  - it animates once, then stays put (no re-triggering on scroll back);
 *  - the travel distance is small (12–20px) so it reads as polish, not theatre;
 *  - with reduced motion enabled it renders a plain fade with no movement.
 *
 * Because this is a client component, only the wrapper is shipped to the
 * browser — the content passed as children is still server-rendered.
 */

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Delay in seconds, for staggering a row of cards. */
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Render as a different element, e.g. `li` inside a list. */
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'footer';
};

const OFFSETS = {
  up: { y: 20, x: 0 },
  down: { y: -20, x: 0 },
  // Keep horizontal motion within the mobile container so off-screen content
  // does not widen the page before it enters the viewport.
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
  none: { x: 0, y: 0 },
} as const;

export function Reveal({
  children,
  className,
  delay = 0,
  direction = 'up',
  as = 'div',
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const offset = OFFSETS[direction];

  const MotionTag = motion[as];

  return (
    <MotionTag
      className={cn(className)}
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, ...offset }
      }
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: prefersReducedMotion ? 0.2 : 0.6,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * RevealGroup — staggers its direct children on entry.
 * Use for grids of cards so they arrive in sequence rather than all at once.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Child of `RevealGroup`. */
export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: prefersReducedMotion ? 0.2 : 0.5, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
