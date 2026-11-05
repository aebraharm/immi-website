'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

/**
 * Page transition.
 *
 * Wraps the routed content of a layout and fades/settles it on each navigation.
 * `usePathname` is the key, so a route change replays the entrance.
 *
 * The animation is intentionally a short fade with a 6px rise — long enough to
 * feel intentional, short enough that it never delays reading. Under reduced
 * motion only the fade remains.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0.15 : 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
