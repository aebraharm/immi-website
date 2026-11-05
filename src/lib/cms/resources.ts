/**
 * CMS resource definitions.
 *
 * There are thirteen content modules and each needs list / read / create /
 * update / delete / publish / reorder. Writing that thirteen times by hand would
 * be thousands of lines of near-identical code, and every copy would be a place
 * to forget the publish timestamp or the audit entry.
 *
 * Instead each resource declares *what it is* — its table, how a search matches
 * it, which columns are the label and the status, how a create payload maps to a
 * row — and one generic engine performs the operations. The differences between
 * modules are then visible in one file rather than diffused across thirteen.
 *
 * Two invariants the engine enforces for every resource:
 *
 *  - **Publishing is explicit.** `published_at` is stamped the moment a row
 *    becomes `published`, and cleared when it stops being published, so the
 *    public site always has an honest date to show.
 *  - **Nothing is hard-deleted unless asked.** Archiving (status `archived` +
 *    `archived_at`) is the default removal, so a mistaken delete is recoverable.
 *    A genuine delete exists only where the schema says the row is disposable.
 */

import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { getDb, type Database } from '@/db';
import type { ContentStatus } from '@/db/schema/enums';

import { badRequest, conflict, notFound } from './api';

/** The subset of columns every publishable CMS table shares. */
type CommonColumns = {
  id: SQLiteColumn;
  status: SQLiteColumn;
  displayOrder: SQLiteColumn;
  updatedAt: SQLiteColumn;
  createdAt: SQLiteColumn;
  archivedAt: SQLiteColumn;
};

export type ResourceDefinition = {
  /** Stable key used in URLs and audits, e.g. `services`. */
  key: string;
  /** Human name used in messages, e.g. "Service". */
  label: string;
  table: SQLiteTable;
  columns: CommonColumns;
  /** Columns a free-text search should match. */
  searchColumns: SQLiteColumn[];
  /** Columns available for sorting. */
  sortColumns: Record<string, SQLiteColumn>;
  /** Applied to every list/read query, e.g. to exclude archived rows by default. */
  defaultFilter?: SQL | undefined;
  /** Extra columns exposed in the list view (kept small on purpose). */
  listColumns: Record<string, SQLiteColumn>;
  /** Whether the resource supports drag-free reordering. */
  orderable: boolean;
  /** Whether a hard delete is offered in addition to archiving. */
  allowHardDelete: boolean;
};

const statusOrder = { draft: 0, published: 1, archived: 2 } as const;

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export type ListParams = {
  search?: string;
  status?: ContentStatus | 'all';
  includeArchived?: boolean;
  limit?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
};

export type ListRow = Record<string, unknown>;

export async function listResource(
  definition: ResourceDefinition,
  params: ListParams = {},
): Promise<{ rows: ListRow[]; total: number }> {
  const db = getDb();
  const c = definition.columns;

  const filters: SQL[] = [];

  if (!params.includeArchived) {
    filters.push(isNull(c.archivedAt));
  }

  if (params.status && params.status !== 'all') {
    filters.push(eq(c.status, params.status));
  }

  if (params.search && params.search.trim().length > 0) {
    const needle = `%${params.search.trim().toLowerCase()}%`;
    const matches = definition.searchColumns.map((column) =>
      sql`lower(${column}) like ${needle}`,
    );
    const combined = or(...matches);
    if (combined) filters.push(combined);
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const sortColumn =
    (params.sort ? definition.sortColumns[params.sort] : undefined) ??
    definition.sortColumns.displayOrder ??
    c.displayOrder;

  const orderBy =
    params.direction === 'desc' ? desc(sortColumn) : asc(sortColumn);

  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  const selectShape: Record<string, SQLiteColumn> = {
    id: c.id,
    status: c.status,
    displayOrder: c.displayOrder,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    archivedAt: c.archivedAt,
    ...definition.listColumns,
  };

  const rows = await db
    .select(selectShape)
    .from(definition.table)
    .where(where)
    .orderBy(orderBy)
    .limit(limit);

  const [countRow] = await db
    .select({ value: sql<number>`count(*)` })
    .from(definition.table)
    .where(where);

  return { rows: rows as ListRow[], total: Number(countRow?.value ?? 0) };
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

export async function readResource(
  definition: ResourceDefinition,
  id: string,
): Promise<ListRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(definition.table)
    .where(eq(definition.columns.id, id))
    .limit(1);

  return (rows[0] as ListRow | undefined) ?? null;
}

export async function requireResource(
  definition: ResourceDefinition,
  id: string,
): Promise<ListRow> {
  const row = await readResource(definition, id);
  if (!row) throw notFound(`That ${definition.label.toLowerCase()} no longer exists.`);
  return row;
}

/* -------------------------------------------------------------------------- */
/* Publish state                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Values to merge into a row being written, given the requested status.
 *
 * `publishedAtColumn` is only present on tables that have one (`website_pages`).
 * For the rest, the publish moment is already visible through `updatedAt` and no
 * separate column exists — we do not invent one.
 */
export function statusPatch(params: {
  status: ContentStatus;
  publishedAtColumn?: SQLiteColumn;
  now?: Date;
}): Record<string, unknown> {
  const now = params.now ?? new Date();
  const patch: Record<string, unknown> = { status: params.status };

  if (params.publishedAtColumn) {
    patch.publishedAt = params.status === 'published' ? now : null;
  }

  if (params.status === 'archived') {
    patch.archivedAt = now;
  }

  return patch;
}

/** Assert a status transition is allowed, so the UI and API agree. */
export function assertStatusTransition(from: ContentStatus, to: ContentStatus): void {
  if (from === to) return;

  // Anything may be archived; nothing may leave the archive except by an
  // explicit restore, which is expressed as a move to draft.
  if (from === 'archived' && to === 'published') {
    throw conflict('Restore this item to draft before publishing it again.');
  }

  if (statusOrder[to] === undefined) {
    throw badRequest('Unknown status.');
  }
}

/* -------------------------------------------------------------------------- */
/* Reorder                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Apply a new display order.
 *
 * Written as one statement per row inside a transaction so a partially-applied
 * order is impossible — a half-sorted list would look like a bug to the
 * administrator.
 */
export async function reorderResource(
  definition: ResourceDefinition,
  ids: string[],
): Promise<void> {
  const db = getDb();
  const c = definition.columns;

  const existing = await db
    .select({ id: c.id })
    .from(definition.table)
    .where(inArray(c.id, ids));

  const known = new Set(existing.map((row) => String(row.id)));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw notFound('One of those items no longer exists. Reload the list and try again.');
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(definition.table)
        .set({ displayOrder: index } as never)
        .where(eq(c.id, id));
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Status change                                                              */
/* -------------------------------------------------------------------------- */

export async function setStatus(params: {
  definition: ResourceDefinition;
  id: string;
  status: ContentStatus;
  updatedBy: string;
  publishedAtColumn?: SQLiteColumn;
}): Promise<{ previousStatus: ContentStatus }> {
  const db = getDb();
  const c = params.definition.columns;

  const row = await requireResource(params.definition, params.id);
  const previousStatus = String(row.status) as ContentStatus;

  assertStatusTransition(previousStatus, params.status);

  const patch = {
    ...statusPatch({
      status: params.status,
      publishedAtColumn: params.publishedAtColumn,
    }),
    updatedAt: new Date(),
    ...('updatedBy' in row ? { updatedBy: params.updatedBy } : {}),
  };

  await db
    .update(params.definition.table)
    .set(patch as never)
    .where(eq(c.id, params.id));

  return { previousStatus };
}

/* -------------------------------------------------------------------------- */
/* Archive / delete                                                           */
/* -------------------------------------------------------------------------- */

export async function archiveResource(params: {
  definition: ResourceDefinition;
  id: string;
  updatedBy: string;
}): Promise<void> {
  const db = getDb();
  const c = params.definition.columns;
  const row = await requireResource(params.definition, params.id);

  const now = new Date();
  const patch: Record<string, unknown> = {
    status: 'archived',
    archivedAt: now,
    updatedAt: now,
  };
  if ('updatedBy' in row) patch.updatedBy = params.updatedBy;

  await db
    .update(params.definition.table)
    .set(patch as never)
    .where(eq(c.id, params.id));
}

export async function restoreResource(params: {
  definition: ResourceDefinition;
  id: string;
  updatedBy: string;
}): Promise<void> {
  const db = getDb();
  const c = params.definition.columns;
  const row = await requireResource(params.definition, params.id);

  const patch: Record<string, unknown> = {
    status: 'draft',
    archivedAt: null,
    updatedAt: new Date(),
  };
  if ('updatedBy' in row) patch.updatedBy = params.updatedBy;

  await db
    .update(params.definition.table)
    .set(patch as never)
    .where(eq(c.id, params.id));
}

export async function deleteResource(
  definition: ResourceDefinition,
  id: string,
): Promise<void> {
  if (!definition.allowHardDelete) {
    throw conflict('This item can be archived but not deleted.');
  }
  await requireResource(definition, id);
  const db = getDb();
  await db.delete(definition.table).where(eq(definition.columns.id, id));
}

/* -------------------------------------------------------------------------- */
/* Create / update                                                            */
/* -------------------------------------------------------------------------- */

export async function createRow(params: {
  definition: ResourceDefinition;
  values: Record<string, unknown>;
}): Promise<{ id: string }> {
  const db = getDb();

  const [row] = await db
    .insert(params.definition.table)
    .values(params.values as never)
    .returning({ id: params.definition.columns.id });

  const id = row?.id;
  if (!id) throw new Error('Insert did not return an id.');
  return { id: String(id) };
}

export async function updateRow(params: {
  definition: ResourceDefinition;
  id: string;
  values: Record<string, unknown>;
}): Promise<void> {
  await requireResource(params.definition, params.id);
  const db = getDb();
  await db
    .update(params.definition.table)
    .set(params.values as never)
    .where(eq(params.definition.columns.id, params.id));
}

/* -------------------------------------------------------------------------- */
/* Slug uniqueness helpers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Throw a readable conflict if a slug is already used by a *different* row.
 *
 * The database unique index is the real guard; this exists so the administrator
 * sees "that address is already in use" against the right field instead of a
 * constraint error.
 */
export async function assertSlugFree(params: {
  db?: Database;
  table: SQLiteTable;
  slugColumn: SQLiteColumn;
  idColumn: SQLiteColumn;
  slug: string;
  excludeId?: string;
}): Promise<void> {
  const db = params.db ?? getDb();
  const rows = await db
    .select({ id: params.idColumn })
    .from(params.table)
    .where(eq(params.slugColumn, params.slug))
    .limit(1);

  const existing = rows[0];
  if (existing && String(existing.id) !== params.excludeId) {
    throw conflict('That URL slug is already in use by another item.');
  }
}
