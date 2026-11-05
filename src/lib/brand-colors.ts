/**
 * Accessible runtime brand colours.
 *
 * These checks are deliberately shared by the CMS API, the public identity
 * reader, and the settings-form preview so a six-digit hex value can never be
 * mistaken for an accessible value. The surface colours below are the fixed
 * public surfaces on which each brand token is rendered.
 */
export const DEFAULT_BRAND_COLORS = {
  primary: '#E11D2E',
  secondary: '#1D4ED8',
  active: '#1E3FBF',
  text: '#111827',
} as const;

export type BrandColorKey = keyof typeof DEFAULT_BRAND_COLORS;
export type BrandColors = Record<BrandColorKey, string>;

export const BRAND_COLOR_REQUIREMENTS: Record<
  BrandColorKey,
  ReadonlyArray<{ background: string; minimum: number; purpose: string }>
> = {
  primary: [
    {
      background: '#FFFFFF',
      minimum: 4.5,
      purpose: 'normal text on white and white text on primary buttons',
    },
    {
      background: '#F8FAFC',
      minimum: 4.5,
      purpose: 'primary link text on the muted footer surface',
    },
    {
      background: '#FFF1F2',
      minimum: 3,
      purpose: 'the decorative primary icon tile on pale red',
    },
  ],
  secondary: [
    { background: '#FFFFFF', minimum: 3, purpose: 'visible focus indicators on white' },
    { background: '#F8FAFC', minimum: 3, purpose: 'visible focus indicators on muted surfaces' },
    { background: '#F1F5F9', minimum: 3, purpose: 'visible focus indicators on sunken surfaces' },
    {
      background: '#FFF1F2',
      minimum: 3,
      purpose: 'visible focus indicators on active mobile-navigation surfaces',
    },
  ],
  active: [
    {
      background: '#FFFFFF',
      minimum: 4.5,
      purpose: 'white text on pressed buttons and active text on white',
    },
    {
      background: '#FFF1F2',
      minimum: 4.5,
      purpose: 'active mobile-navigation text on pale red',
    },
  ],
  text: [
    { background: '#FFFFFF', minimum: 4.5, purpose: 'body text on white' },
    { background: '#F8FAFC', minimum: 4.5, purpose: 'body text on muted surfaces' },
    { background: '#F1F5F9', minimum: 4.5, purpose: 'body text on sunken surfaces' },
    { background: '#FFF1F2', minimum: 4.5, purpose: 'body text on pale-red surfaces' },
  ],
};

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-fA-F]{6}$/.test(value);
}

function linearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  if (!isHexColor(color)) return Number.NaN;
  const channels = color.slice(1).match(/.{2}/g);
  if (!channels || channels.length !== 3) return Number.NaN;
  const [red, green, blue] = channels.map((channel) =>
    linearChannel(Number.parseInt(channel, 16)),
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** WCAG 2.x relative-luminance contrast ratio, from 1:1 to 21:1. */
export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  if (!Number.isFinite(foregroundLuminance) || !Number.isFinite(backgroundLuminance)) {
    return 0;
  }
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatContrastRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

/** Returns a readable field error, or null when this value meets every use. */
export function brandColorError(key: BrandColorKey, value: unknown): string | null {
  if (!isHexColor(value)) return 'Use a six-digit hex colour, for example #1D4ED8.';

  const failures = BRAND_COLOR_REQUIREMENTS[key].filter(
    ({ background, minimum }) => contrastRatio(value, background) < minimum,
  );
  if (failures.length === 0) return null;

  return failures
    .map(({ background, minimum, purpose }) => {
      const actual = formatContrastRatio(contrastRatio(value, background));
      return `Needs at least ${minimum.toFixed(1)}:1 against ${background} for ${purpose} (currently ${actual}).`;
    })
    .join(' ');
}

/** Contrast summary shown beside each live colour control in the CMS. */
export function brandColorSummary(key: BrandColorKey, value: unknown): string {
  if (!isHexColor(value)) return 'Enter a six-digit hex colour to preview contrast.';
  return BRAND_COLOR_REQUIREMENTS[key]
    .map(({ background, minimum, purpose }) => {
      const ratio = contrastRatio(value, background);
      const result = ratio >= minimum ? 'passes' : 'fails';
      return `${purpose}: ${formatContrastRatio(ratio)} (${result}; needs at least ${minimum.toFixed(1)}:1)`;
    })
    .join('; ');
}

/**
 * Defensive read-time guard for pre-existing rows written before contrast checks
 * existed. Inaccessible stored values are replaced individually with the known
 * accessible defaults before they reach the public CSS, without changing the DB.
 */
export function resolveBrandColors(input: Partial<Record<BrandColorKey, unknown>>): BrandColors {
  const result = {} as BrandColors;
  for (const key of Object.keys(DEFAULT_BRAND_COLORS) as BrandColorKey[]) {
    const value = input[key];
    result[key] = brandColorError(key, value) === null
      ? (value as string)
      : DEFAULT_BRAND_COLORS[key];
  }
  return result;
}

/** Darken a validated hex colour; darker hover pixels keep white text contrast. */
export function darkenHex(color: string, amount = 0.12): string {
  if (!isHexColor(color)) return '#C2182A';
  const factor = 1 - Math.min(1, Math.max(0, amount));
  const channels = color.slice(1).match(/.{2}/g);
  if (!channels) return '#C2182A';
  return `#${channels
    .map((channel) =>
      Math.round(Number.parseInt(channel, 16) * factor)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}
