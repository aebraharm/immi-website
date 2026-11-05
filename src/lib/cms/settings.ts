/**
 * Site settings: read and write.
 *
 * `site_settings` is a single typed row (id = 1). It is created on first save if
 * it does not exist, so a fresh database has no settings row at all — which the
 * public site already handles by rendering its honest "not configured" state.
 *
 * Saving is a full replacement of the editable fields rather than a patch. That
 * is deliberate: an administrator looking at the form sees every value that will
 * be stored, and there is no way for a stale hidden field to survive a save.
 */

import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { siteSettings } from '@/db/schema';
import { DEFAULT_BRAND_COLORS } from '@/lib/brand-colors';

import type { SiteSettingsInput } from './schemas';

export type SettingsRow = typeof siteSettings.$inferSelect;

export async function readSettings(): Promise<SettingsRow | null> {
  const db = getDb();
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return rows[0] ?? null;
}

/** Values the form should show when no row exists yet. */
export const EMPTY_SETTINGS_FORM: SiteSettingsInput = {
  agencyName: '',
  tagline: '',
  shortDescription: '',
  longDescription: '',
  logoAssetId: null,
  logoDarkAssetId: null,
  faviconAssetId: null,
  ogImageAssetId: null,
  brandPrimaryColor: DEFAULT_BRAND_COLORS.primary,
  brandSecondaryColor: DEFAULT_BRAND_COLORS.secondary,
  brandActiveColor: DEFAULT_BRAND_COLORS.active,
  brandTextColor: DEFAULT_BRAND_COLORS.text,
  contactEmail: '',
  contactPhonePrimary: '',
  contactPhoneSecondary: '',
  contactWhatsapp: '',
  addressLine1: '',
  addressLine2: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  addressCountry: '',
  officeHours: '',
  mapEmbedUrl: '',
  socialFacebook: '',
  socialInstagram: '',
  socialLinkedin: '',
  socialX: '',
  socialTiktok: '',
  socialYoutube: '',
  privacyRetentionDays: 0,
  privacyContactEmail: '',
  allowSearchIndexing: true,
};

/** Convert a stored row into the shape the edit form consumes. */
export function toSettingsForm(row: SettingsRow | null): SiteSettingsInput {
  if (!row) return { ...EMPTY_SETTINGS_FORM };

  return {
    agencyName: row.agencyName,
    tagline: row.tagline,
    shortDescription: row.shortDescription,
    longDescription: row.longDescription,
    logoAssetId: row.logoAssetId,
    logoDarkAssetId: row.logoDarkAssetId,
    faviconAssetId: row.faviconAssetId,
    ogImageAssetId: row.ogImageAssetId,
    brandPrimaryColor: row.brandPrimaryColor,
    brandSecondaryColor: row.brandSecondaryColor,
    brandActiveColor: row.brandActiveColor,
    brandTextColor: row.brandTextColor,
    contactEmail: row.contactEmail,
    contactPhonePrimary: row.contactPhonePrimary,
    contactPhoneSecondary: row.contactPhoneSecondary,
    contactWhatsapp: row.contactWhatsapp,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    addressCity: row.addressCity,
    addressState: row.addressState,
    addressPostalCode: row.addressPostalCode,
    addressCountry: row.addressCountry,
    officeHours: row.officeHours,
    mapEmbedUrl: row.mapEmbedUrl,
    socialFacebook: row.socialFacebook,
    socialInstagram: row.socialInstagram,
    socialLinkedin: row.socialLinkedin,
    socialX: row.socialX,
    socialTiktok: row.socialTiktok,
    socialYoutube: row.socialYoutube,
    privacyRetentionDays: row.privacyRetentionDays,
    privacyContactEmail: row.privacyContactEmail,
    allowSearchIndexing: row.allowSearchIndexing,
  };
}

export async function writeSettings(params: {
  input: SiteSettingsInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();
  const values = {
    ...params.input,
    logoAssetId: params.input.logoAssetId ?? null,
    logoDarkAssetId: params.input.logoDarkAssetId ?? null,
    faviconAssetId: params.input.faviconAssetId ?? null,
    ogImageAssetId: params.input.ogImageAssetId ?? null,
    updatedAt: new Date(),
    updatedBy: params.adminId,
  };

  const existing = await readSettings();

  if (existing) {
    await db.update(siteSettings).set(values).where(eq(siteSettings.id, 1));
    return;
  }

  await db.insert(siteSettings).values({ id: 1, ...values });
}
