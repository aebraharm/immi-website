import { forwardRef } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Button.
 *
 * Two brand rules from the brief are baked in here rather than left to each
 * call site:
 *
 *  - Primary buttons are red at rest and **blue when pressed/active**.
 *  - Every interactive state (hover, focus, active, disabled) is defined, so a
 *    button can never render in an unstyled state.
 *
 * `active:` styles are what fire on mousedown/click, which is what the brief
 * means by "blue active/clicked state".
 */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-md ' +
  'font-semibold tracking-tight transition-[background-color,color,box-shadow,transform,border-color] ' +
  'duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)] ' +
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-200 ' +
  'disabled:text-slate-700 disabled:border-slate-300 disabled:shadow-none disabled:opacity-100 ' +
  // A restrained press effect; suppressed entirely under reduced motion.
  'motion-safe:active:scale-[0.985]';

const VARIANTS: Record<ButtonVariant, string> = {
  // Red at rest -> blue while pressed, per the brand specification.
  primary:
    'bg-[var(--brand-primary)] text-white shadow-e2 hover:bg-[var(--brand-primary-hover)] ' +
    'active:bg-[var(--brand-active)] active:shadow-accent-700/30',
  secondary:
    'bg-accent-600 text-white shadow-e2 hover:bg-accent-700 active:bg-accent-800',
  outline:
    'border border-[var(--border-strong)] bg-white text-ink hover:border-accent-300 ' +
    'hover:bg-accent-50 active:border-accent-600 active:bg-accent-100 active:text-accent-800',
  ghost:
    'bg-transparent text-ink hover:bg-slate-100 active:bg-accent-50 active:text-accent-800',
  destructive:
    'bg-red-600 text-white shadow-e2 hover:bg-red-700 active:bg-accent-700',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[0.9375rem]',
  lg: 'h-13 px-7 text-base',
};

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      className,
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        // A loading button must not be clickable twice.
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonStyles(variant, size, className)}
        {...rest}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
