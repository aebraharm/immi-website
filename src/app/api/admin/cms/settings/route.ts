import type { NextResponse } from 'next/server';

import {
  auditMutation,
  errorResponse,
  guardMutation,
  guardRead,
  ok,
  parseBody,
  readJson,
  throttleCmsMutation,
} from '@/lib/cms/api';
import { siteSettingsSchema } from '@/lib/cms/schemas';
import { readSettings, toSettingsForm, writeSettings } from '@/lib/cms/settings';

/**
 * /api/admin/cms/settings
 *
 * GET  the stored settings, or the empty form defaults if nothing is saved yet
 * GET/POST are owner-only: the agency name, logo, brand colours, contact details
 *      and privacy configuration apply to every page and may expose internal
 *      configuration, so non-owners cannot read or change them.
 *
 * Saving is a full replacement, so the form is the single source of truth for
 * what gets stored.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    await guardRead(['owner']);
    const row = await readSettings();
    return ok({ settings: toSettingsForm(row), exists: row !== null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const admin = await guardMutation(request, ['owner']);
    await throttleCmsMutation(admin.adminId);

    const input = await parseBody(siteSettingsSchema, await readJson(request));
    await writeSettings({ input, adminId: admin.adminId });

    await auditMutation({
      request,
      admin,
      action: 'settings.updated',
      entityType: 'site_settings',
      entityId: '1',
      summary: 'Updated agency settings',
      // Field names only — never the values, which may include contact details.
      metadata: { changed: Object.keys(input).length },
    });

    const row = await readSettings();
    return ok({ settings: toSettingsForm(row), exists: true });
  } catch (error) {
    return errorResponse(error);
  }
}
