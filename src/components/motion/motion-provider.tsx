'use client';

import { MotionConfig } from 'framer-motion';

/**
 * Global motion provider.
 *
 * `reducedMotion="user"` makes every Framer Motion animation in the app honour
 * the visitor's operating-system preference automatically: transforms are
 * skipped, but opacity fades still run so content does not vanish. This is the
 * single place reduced-motion accessibility is configured, which is why
 * individual components can describe their intended animation without each one
 * re-implementing the accessibility check.
 *
 * CSS transitions are handled separately by the media query in globals.css.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionConfig>
  );
}
