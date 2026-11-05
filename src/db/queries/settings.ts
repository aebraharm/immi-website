import { eq } from 'drizzle-orm';

import { DEFAULT_BRAND_COLORS, resolveBrandColors } from '@/lib/brand-colors';

import { siteSettings } from '@/db/schema';
import type { SiteSettings } from '@/db/schema';

import { getDb } from '../index';
import { resolveMediaUrls, urlFor } from './media-url';
import { safeQuery } from './safe';
import type { QueryResult, SiteIdentity } from './types';

/**
 * Site identity and branding.
 *
 * Everything the header, footer, metadata and assessment form need in order to
 * display "who we are" comes from the single `site_settings` row. No agency name
 * or logo is hardcoded anywhere in the application.
 *
 * The fallbacks below are intentionally neutral placeholders (not a made-up
 * brand): until an administrator saves their details, the site shows a generic
 * label and a settings notice rather than inventing an identity.
 */

export const FALLBACK_IDENTITY: SiteIdentity = {
  agencyName: '',
  tagline: '',
  shortDescription: '',
  longDescription: '',
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  ogImageUrl: null,
  colors: { ...DEFAULT_BRAND_COLORS },
  contact: {
    email: '',
    phonePrimary: '',
    phoneSecondary: '',
    whatsapp: '',
    addressLines: [],
    officeHours: '',
    mapEmbedUrl: '',
  },
  social: [],
  privacy: {
    retentionDays: 0,
    contactEmail: '',
    allowSearchIndexing: true,
  },
  isConfigured: false,
};

/** Read the raw settings row (or null when none has been saved yet). */
export async function getSettingsRow(): Promise<SiteSettings | null> {
  const db = getDb();
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return rows[0] ?? null;
}

function buildAddressLines(row: SiteSettings): string[] {
  return [
    row.addressLine1,
    row.addressLine2,
    [row.addressCity, row.addressState].filter(Boolean).join(', '),
    [row.addressPostalCode, row.addressCountry].filter(Boolean).join(' '),
  ]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildSocialLinks(row: SiteSettings): Array<{ platform: string; url: string }> {
  const candidates: Array<[string, string]> = [
    ['Facebook', row.socialFacebook],
    ['Instagram', row.socialInstagram],
    ['LinkedIn', row.socialLinkedin],
    ['X', row.socialX],
    ['TikTok', row.socialTiktok],
    ['YouTube', row.socialYoutube],
  ];

  return candidates
    .filter(([, url]) => url.trim().length > 0)
    .map(([platform, url]) => ({ platform, url: url.trim() }));
}

/**
 * Site identity, ready to render.
 * Returns a neutral fallback (never an error page) if the database is missing.
 */
export async function getSiteIdentity(): Promise<SiteIdentity> {
  const result = await safeQuery(async () => {
    const row = await getSettingsRow();
    if (!row) return null;

    const db = getDb();
    const urls = await resolveMediaUrls(db, [
      row.logoAssetId,
      row.logoDarkAssetId,
      row.faviconAssetId,
      row.ogImageAssetId,
    ]);

    return { row, urls } as const;
  });

  if (!result.ok || result.data === null) {
    return FALLBACK_IDENTITY;
  }

  const { row, urls } = result.data;

  return {
    agencyName: row.agencyName.trim(),
    tagline: row.tagline.trim(),
    shortDescription: row.shortDescription.trim(),
    longDescription: row.longDescription.trim(),
    logoUrl: urlFor(urls, row.logoAssetId),
    logoDarkUrl: urlFor(urls, row.logoDarkAssetId),
    faviconUrl: urlFor(urls, row.faviconAssetId),
    ogImageUrl: urlFor(urls, row.ogImageAssetId),
    // Older rows may contain a six-digit but inaccessible value from before
    // contrast validation. Normalize it at read time without mutating storage.
    colors: resolveBrandColors({
      primary: row.brandPrimaryColor,
      secondary: row.brandSecondaryColor,
      active: row.brandActiveColor,
      text: row.brandTextColor,
    }),
    contact: {
      email: row.contactEmail.trim(),
      phonePrimary: row.contactPhonePrimary.trim(),
      phoneSecondary: row.contactPhoneSecondary.trim(),
      whatsapp: row.contactWhatsapp.trim(),
      addressLines: buildAddressLines(row),
      officeHours: row.officeHours.trim(),
      mapEmbedUrl: row.mapEmbedUrl.trim(),
    },
    social: buildSocialLinks(row),
    privacy: {
      retentionDays: row.privacyRetentionDays,
      contactEmail: row.privacyContactEmail.trim(),
      allowSearchIndexing: row.allowSearchIndexing,
    },
    isConfigured:
      row.agencyName.trim().length > 0 || row.logoAssetId !== null,
  };
}

/** Full settings row for callers that need the raw columns (e.g. contact page). */
export async function getSiteSettings(): Promise<QueryResult<SiteSettings | null>> {
  return safeQuery(getSettingsRow);
}
