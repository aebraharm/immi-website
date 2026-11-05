/**
 * Route handlers for the generic CMS resources.
 *
 * Next.js needs one file per URL, but the behaviour behind those URLs is the same
 * for every collection. Rather than copy forty lines of guard-and-validate into
 * sixteen `route.ts` files (sixteen chances to forget the CSRF check), each route
 * file re-exports a handler from here with its resource key bound.
 *
 * Every export below performs, in order:
 *   session → role → CSRF (for writes) → body parse → schema validation →
 *   transaction → audit row.
 */

import type { NextResponse } from 'next/server';

import type { AdminRole } from '@/db/schema/enums';

import {
  CmsError,
  auditMutation,
  errorResponse,
  guardMutation,
  guardRead,
  notFound,
  ok,
  parseBody,
  readJson,
  throttleCmsMutation,
} from './api';
import {
  archiveResource,
  deleteResource,
  listResource,
  readResource,
  requireResource,
  restoreResource,
  setStatus,
  updateRow,
} from './resources';
import { getResource } from './registry';
import type { ResourceKey } from './registry';
import {
  contentStatus,
  faqSchema,
  homepageSectionSchema,
  publishSchema,
  reorderSchema,
  seoSchema,
  teamMemberSchema,
  testimonialSchema,
  websitePageSchema,
} from './schemas';
import {
  createFaq,
  createHomepageSection,
  createPage,
  createTeamMember,
  createTestimonial,
  updateFaq,
  updateHomepageSection,
  updatePage,
  updateTeamMember,
  updateTestimonial,
  upsertSeo,
} from './write/simple';
import { createService, updateService } from './write/services';
import {
  createCountry,
  createDestination,
  updateCountry,
  updateDestination,
} from './write/destinations';
import { countrySchema as countryCreateSchema, destinationSchema, serviceSchema } from './schemas';

/**
 * Which roles may write to which resource.
 *
 * Editors can write content. Settings and SEO affect the whole site and are
 * restricted to owners, matching the role sets already declared in
 * `lib/auth/guard.ts`.
 */
const WRITE_ROLES: Record<ResourceKey, readonly AdminRole[]> = {
  services: ['owner', 'admin', 'editor'],
  countries: ['owner', 'admin', 'editor'],
  destinations: ['owner', 'admin', 'editor'],
  testimonials: ['owner', 'admin', 'editor'],
  team: ['owner', 'admin', 'editor'],
  faqs: ['owner', 'admin', 'editor'],
  homepage: ['owner', 'admin', 'editor'],
  pages: ['owner', 'admin', 'editor'],
  seo: ['owner'],
};

/** SEO overrides are owner-only for reads as well as writes. */
const READ_ROLES: Record<ResourceKey, readonly AdminRole[]> = {
  services: ['owner', 'admin', 'editor'],
  countries: ['owner', 'admin', 'editor'],
  destinations: ['owner', 'admin', 'editor'],
  testimonials: ['owner', 'admin', 'editor'],
  team: ['owner', 'admin', 'editor'],
  faqs: ['owner', 'admin', 'editor'],
  homepage: ['owner', 'admin', 'editor'],
  pages: ['owner', 'admin', 'editor'],
  seo: ['owner'],
};

/** Resources that support the draft/published lifecycle. */
const PUBLISHABLE: ReadonlySet<ResourceKey> = new Set<ResourceKey>([
  'services',
  'countries',
  'destinations',
  'testimonials',
  'team',
  'faqs',
  'pages',
]);

function asKey(key: string): ResourceKey {
  return key as ResourceKey;
}

/* -------------------------------------------------------------------------- */
/* Collection: GET (list) and POST (create)                                   */
/* -------------------------------------------------------------------------- */

export function collectionHandlers(key: ResourceKey) {
  const definition = getResource(key);

  async function GET(request: Request): Promise<NextResponse> {
    try {
      await guardRead(READ_ROLES[key]);

      const url = new URL(request.url);
      const statusParam = url.searchParams.get('status');
      const status =
        statusParam && ['draft', 'published', 'archived', 'all'].includes(statusParam)
          ? (statusParam as 'draft' | 'published' | 'archived' | 'all')
          : undefined;

      const result = await listResource(definition, {
        search: url.searchParams.get('search') ?? undefined,
        status,
        includeArchived: url.searchParams.get('includeArchived') === '1',
        sort: url.searchParams.get('sort') ?? undefined,
        direction: url.searchParams.get('direction') === 'desc' ? 'desc' : 'asc',
      });

      return ok(result);
    } catch (error) {
      return errorResponse(error);
    }
  }

  async function POST(request: Request): Promise<NextResponse> {
    try {
      const admin = await guardMutation(request, WRITE_ROLES[key]);
      await throttleCmsMutation(admin.adminId);

      const body = await readJson(request);
      const created = await createFor(key, body, admin.adminId);

      await auditMutation({
        request,
        admin,
        action: 'content.created',
        entityType: key,
        entityId: created.id,
        summary: `Created ${definition.label.toLowerCase()}`,
      });

      return ok({ id: created.id });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { GET, POST };
}

/**
 * Create a row for a resource.
 *
 * Only the resources with child tables (services, countries, destinations) get a
 * bespoke writer; the rest fall through to a direct insert of the validated
 * payload.
 */
async function createFor(
  key: ResourceKey,
  body: unknown,
  adminId: string,
): Promise<{ id: string }> {
  switch (key) {
    case 'services': {
      const input = await parseBody(serviceSchema, body);
      return createService({ input, adminId });
    }
    case 'countries': {
      const input = await parseBody(countryCreateSchema, body);
      return createCountry({ input, adminId });
    }
    case 'destinations': {
      const input = await parseBody(destinationSchema, body);
      return createDestination({ input, adminId });
    }
    case 'testimonials': {
      const input = await parseBody(testimonialSchema, body);
      return createTestimonial({ input, adminId });
    }
    case 'team': {
      const input = await parseBody(teamMemberSchema, body);
      return createTeamMember({ input, adminId });
    }
    case 'faqs': {
      const input = await parseBody(faqSchema, body);
      return createFaq({ input, adminId });
    }
    case 'pages': {
      const input = await parseBody(websitePageSchema, body);
      return createPage({ input, adminId });
    }
    case 'homepage': {
      const input = await parseBody(homepageSectionSchema, body);
      return createHomepageSection({ input, adminId });
    }
    case 'seo': {
      const input = await parseBody(seoSchema, body);
      return upsertSeo({ input, adminId });
    }
    default: {
      throw new CmsError(400, 'invalid_request', 'Unknown content type.');
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Item: GET, PUT, DELETE                                                     */
/* -------------------------------------------------------------------------- */

export function itemHandlers(key: ResourceKey) {
  const definition = getResource(key);

  async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<NextResponse> {
    try {
      await guardRead(READ_ROLES[key]);
      const { id } = await context.params;
      await requireResource(definition, id);

      const row = await readResource(definition, id);
      if (!row) throw notFound();

      return ok(row);
    } catch (error) {
      return errorResponse(error);
    }
  }

  async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<NextResponse> {
    try {
      const admin = await guardMutation(request, WRITE_ROLES[key]);
      await throttleCmsMutation(admin.adminId);

      const { id } = await context.params;
      await requireResource(definition, id);

      const body = await readJson(request);
      await updateFor(key, id, body, admin.adminId);

      await auditMutation({
        request,
        admin,
        action: 'content.updated',
        entityType: key,
        entityId: id,
        summary: `Updated ${definition.label.toLowerCase()}`,
      });

      return ok({ id });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /**
   * Deleting is deliberately archive-first.
   *
   * `?mode=archive` (the default, and what the confirmation dialog offers first)
   * keeps the row and hides it from the public site. `?mode=delete` is only
   * honoured for resources where the schema permits a hard delete.
   */
  async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<NextResponse> {
    try {
      const admin = await guardMutation(request, WRITE_ROLES[key]);
      await throttleCmsMutation(admin.adminId);

      const { id } = await context.params;
      await requireResource(definition, id);

      const url = new URL(request.url);
      const mode = url.searchParams.get('mode') ?? 'archive';

      if (mode === 'delete') {
        await deleteResource(definition, id);

        await auditMutation({
          request,
          admin,
          action: 'content.deleted',
          entityType: key,
          entityId: id,
          summary: `Deleted ${definition.label.toLowerCase()}`,
        });

        return ok({ id, mode: 'deleted' });
      }

      await archiveResource({ definition, id, updatedBy: admin.adminId });

      await auditMutation({
        request,
        admin,
        action: 'content.archived',
        entityType: key,
        entityId: id,
        summary: `Archived ${definition.label.toLowerCase()}`,
      });

      return ok({ id, mode: 'archived' });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { GET, PUT, DELETE };
}

async function updateFor(
  key: ResourceKey,
  id: string,
  body: unknown,
  adminId: string,
): Promise<void> {
  switch (key) {
    case 'services': {
      const input = await parseBody(serviceSchema, body);
      await updateService({ id, input, adminId });
      return;
    }
    case 'countries': {
      const input = await parseBody(countryCreateSchema, body);
      await updateCountry({ id, input, adminId });
      return;
    }
    case 'destinations': {
      const input = await parseBody(destinationSchema, body);
      await updateDestination({ id, input, adminId });
      return;
    }
    case 'testimonials': {
      const input = await parseBody(testimonialSchema, body);
      await updateTestimonial({ id, input, adminId });
      return;
    }
    case 'team': {
      const input = await parseBody(teamMemberSchema, body);
      await updateTeamMember({ id, input, adminId });
      return;
    }
    case 'faqs': {
      const input = await parseBody(faqSchema, body);
      await updateFaq({ id, input, adminId });
      return;
    }
    case 'pages': {
      const input = await parseBody(websitePageSchema, body);
      await updatePage({ id, input, adminId });
      return;
    }
    case 'homepage': {
      const input = await parseBody(homepageSectionSchema, body);
      await updateHomepageSection({ id, input, adminId });
      return;
    }
    case 'seo': {
      const input = await parseBody(seoSchema, body);
      await upsertSeo({ input, adminId });
      return;
    }
    default: {
      // A resource with no bespoke writer: update the validated payload directly.
      const parsed = await parseBody(
        (await import('./resource-schema')).schemaFor(key),
        body,
      );
      await updateRow({
        definition: getResource(key),
        id,
        values: {
          ...(parsed as Record<string, unknown>),
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Status (publish / unpublish)                                               */
/* -------------------------------------------------------------------------- */

export function statusHandler(key: ResourceKey) {
  const definition = getResource(key);

  return async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<NextResponse> {
    try {
      const admin = await guardMutation(request, WRITE_ROLES[key]);
      await throttleCmsMutation(admin.adminId);

      if (!PUBLISHABLE.has(key)) {
        throw new CmsError(
          400,
          'invalid_request',
          'This content type is shown or hidden rather than published.',
        );
      }

      const { id } = await context.params;
      const body = await readJson(request);
      const { publish } = await parseBody(publishSchema, body);

      const nextStatus = publish ? 'published' : 'draft';
      const statusValidation = contentStatus.safeParse(nextStatus);
      if (!statusValidation.success) {
        throw new CmsError(400, 'invalid_request', 'Unknown status.');
      }

      const { previousStatus } = await setStatus({
        definition,
        id,
        status: statusValidation.data,
        updatedBy: admin.adminId,
      });

      // A newly published page gets a new version number, which is what the
      // assessment consent record will point at.
      if (key === 'pages' && nextStatus === 'published') {
        const { bumpPageVersion } = await import('./write/simple');
        await bumpPageVersion(id);
      }

      await auditMutation({
        request,
        admin,
        action: publish ? 'content.published' : 'content.unpublished',
        entityType: key,
        entityId: id,
        summary: `${publish ? 'Published' : 'Unpublished'} ${definition.label.toLowerCase()}`,
        metadata: { from: previousStatus, to: nextStatus },
      });

      return ok({ id, status: nextStatus });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Restore                                                                    */
/* -------------------------------------------------------------------------- */

export function restoreHandler(key: ResourceKey) {
  const definition = getResource(key);

  return async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<NextResponse> {
    try {
      const admin = await guardMutation(request, WRITE_ROLES[key]);
      await throttleCmsMutation(admin.adminId);
      const { id } = await context.params;

      await restoreResource({ definition, id, updatedBy: admin.adminId });

      await auditMutation({
        request,
        admin,
        action: 'content.updated',
        entityType: key,
        entityId: id,
        summary: `Restored ${definition.label.toLowerCase()} to draft`,
      });

      return ok({ id, status: 'draft' });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Reorder                                                                    */
/* -------------------------------------------------------------------------- */

export function reorderHandler(key: ResourceKey) {
  const definition = getResource(key);

  return async function POST(request: Request): Promise<NextResponse> {
    try {
      const admin = await guardMutation(request, WRITE_ROLES[key]);
      await throttleCmsMutation(admin.adminId);

      if (!definition.orderable) {
        throw new CmsError(400, 'invalid_request', 'This content type has no manual order.');
      }

      const body = await readJson(request);
      const { ids } = await parseBody(reorderSchema, body);

      await (await import('./resources')).reorderResource(definition, ids);

      await auditMutation({
        request,
        admin,
        action: 'content.updated',
        entityType: key,
        entityId: ids[0] ?? '',
        summary: `Reordered ${definition.label.toLowerCase()} list`,
        metadata: { count: ids.length },
      });

      return ok({ reordered: ids.length });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export { asKey };
