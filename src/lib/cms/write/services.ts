/**
 * Writing services.
 *
 * A service owns a child list of features. Writing one therefore has to keep the
 * two tables consistent, which is exactly the kind of thing that goes wrong when
 * it is spread across a route handler.
 *
 * The whole write runs in one transaction:
 *   1. validate uniqueness of the slug
 *   2. insert or update the service row
 *   3. reconcile the feature rows by id (update existing, insert new, delete the
 *      removed ones)
 *
 * Reconciliation by id — rather than delete-all-then-reinsert — means a feature's
 * identity survives an edit, so nothing that references one (a future analytics
 * row, say) would be orphaned by a simple wording change.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { services, serviceFeatures } from '@/db/schema';

import { assertSlugFree } from '../resources';
import type { ServiceInput } from '../schemas';

export async function createService(params: {
  input: ServiceInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const { input, adminId } = params;

  return db.transaction(async (tx) => {
    await assertSlugFree({
      db: tx as never,
      table: services,
      slugColumn: services.slug,
      idColumn: services.id,
      slug: input.slug,
    });

    // Append new services to the end of the list rather than the top: an
    // administrator who reordered the site does not want it reshuffled by an
    // unrelated create.
    // Descending: the largest existing order, so a new service is appended
    // rather than jumping to the top of a list the administrator arranged.
    const [last] = await tx
      .select({ displayOrder: services.displayOrder })
      .from(services)
      .orderBy(desc(services.displayOrder))
      .limit(1);

    const [row] = await tx
      .insert(services)
      .values({
        slug: input.slug,
        title: input.title,
        shortDescription: input.shortDescription,
        descriptionMd: input.descriptionMd,
        iconName: input.iconName || 'Briefcase',
        imageAssetId: input.imageAssetId ?? null,
        ctaLabel: input.ctaLabel,
        ctaHref: input.ctaHref,
        status: input.status,
        displayOrder: (last?.displayOrder ?? 0) + 1,
        updatedBy: adminId,
      })
      .returning({ id: services.id });

    const id = row?.id;
    if (!id) throw new Error('Service insert returned no id.');

    if (input.features.length > 0) {
      await tx.insert(serviceFeatures).values(
        input.features.map((feature, index) => ({
          serviceId: id,
          label: feature.label,
          detailMd: feature.detailMd,
          displayOrder: index,
        })),
      );
    }

    return { id };
  });
}

export async function updateService(params: {
  id: string;
  input: ServiceInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();
  const { id, input, adminId } = params;

  await db.transaction(async (tx) => {
    await assertSlugFree({
      db: tx as never,
      table: services,
      slugColumn: services.slug,
      idColumn: services.id,
      slug: input.slug,
      excludeId: id,
    });

    await tx
      .update(services)
      .set({
        slug: input.slug,
        title: input.title,
        shortDescription: input.shortDescription,
        descriptionMd: input.descriptionMd,
        iconName: input.iconName || 'Briefcase',
        imageAssetId: input.imageAssetId ?? null,
        ctaLabel: input.ctaLabel,
        ctaHref: input.ctaHref,
        status: input.status,
        updatedAt: new Date(),
        updatedBy: adminId,
      })
      .where(eq(services.id, id));

    const existing = await tx
      .select({ id: serviceFeatures.id })
      .from(serviceFeatures)
      .where(eq(serviceFeatures.serviceId, id));

    const keepIds = input.features
      .map((feature) => feature.id)
      .filter((value): value is string => typeof value === 'string');

    const toDelete = existing
      .map((row) => row.id)
      .filter((existingId) => !keepIds.includes(existingId));

    if (toDelete.length > 0) {
      await tx
        .delete(serviceFeatures)
        .where(and(eq(serviceFeatures.serviceId, id), inArray(serviceFeatures.id, toDelete)));
    }

    for (const [index, feature] of input.features.entries()) {
      if (feature.id) {
        await tx
          .update(serviceFeatures)
          .set({
            label: feature.label,
            detailMd: feature.detailMd,
            displayOrder: index,
          })
          .where(and(eq(serviceFeatures.id, feature.id), eq(serviceFeatures.serviceId, id)));
      } else {
        await tx.insert(serviceFeatures).values({
          serviceId: id,
          label: feature.label,
          detailMd: feature.detailMd,
          displayOrder: index,
        });
      }
    }
  });
}

/** Deleting a service cascades its features (FK `on delete cascade`). */
export async function deleteService(id: string): Promise<void> {
  const db = getDb();
  await db.delete(services).where(eq(services.id, id));
}
