/**
 * Social platform marks.
 *
 * Drawn inline as minimal SVG paths rather than pulled from an icon library:
 * Lucide v1 removed brand icons (they are trademarks), and adding a paid icon
 * pack for six glyphs is disproportionate. These are simple geometric marks
 * used at 16px, satisfying the same recognition purpose.
 *
 * Each icon is decorative — the accessible name comes from the link's
 * `aria-label` in the footer, so `aria-hidden` is set here.
 */

type IconProps = { className?: string };

const PATHS: Record<string, React.ReactNode> = {
  Facebook: (
    <path d="M14.5 8.5h2.2V5.6h-2.2c-2.2 0-3.6 1.4-3.6 3.6v1.6H8.8v2.9h2.1V21h3.1v-7.3h2.2l.3-2.9h-2.5V9.6c0-.7.2-1.1 1.5-1.1Z" />
  ),
  Instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" fill="none" strokeWidth="1.8" />
      <circle cx="16.6" cy="7.4" r="1.1" stroke="none" />
    </>
  ),
  LinkedIn: (
    <path d="M6.2 9.4H3.6V21h2.6V9.4ZM4.9 3.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20.4 21h-2.6v-6.1c0-1.6-.6-2.4-1.8-2.4-1 0-1.6.7-1.8 1.4-.1.2-.1.6-.1.9V21H11.5s.1-9.8 0-11.6h2.6v1.6c.4-.8 1.4-1.9 3.1-1.9 2.2 0 3.2 1.4 3.2 4.4V21Z" />
  ),
  X: (
    <path d="M17.2 3.5h2.9l-6.3 7.2 7.4 9.8h-5.8l-4.5-5.9-5.2 5.9H2.8l6.7-7.7L2.4 3.5h5.9l4.1 5.4 4.8-5.4Zm-1 15.2h1.6L8 5.1H6.3l9.9 13.6Z" />
  ),
  TikTok: (
    <path d="M16.2 3.2c.3 1.9 1.6 3.3 3.5 3.6v2.6c-1.3.1-2.6-.3-3.6-1.1v5.9a5.3 5.3 0 1 1-5.3-5.3c.3 0 .6 0 .9.1v2.7a2.7 2.7 0 1 0 1.9 2.5V3.2h2.6Z" />
  ),
  YouTube: (
    <>
      <rect x="2.6" y="6" width="18.8" height="12" rx="3.4" fill="none" strokeWidth="1.8" />
      <path d="M10.6 9.6l4.6 2.6-4.6 2.6V9.6Z" stroke="none" />
    </>
  ),
};

export function SocialIcon({
  platform,
  className,
}: IconProps & { platform: string }): React.ReactElement | null {
  const content = PATHS[platform];
  if (!content) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Strokes are only used by the outlined marks; solid marks set stroke=none.
    >
      {content}
    </svg>
  );
}

export const SOCIAL_PLATFORMS = Object.keys(PATHS);
