/**
 * Writing countries and destination programmes.
 *
 * A programme owns two child lists — visa categories and process requirements —
 * and belongs to a country. All of it is written in one transaction so the
 * public destination page can never render a half-saved programme.
 *
 * Child rows are reconciled by id, exactly like service features: editing a
 * requirement's wording keeps its identity.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { countries, destinationRequirements, destinations, visaCategories } from '@/db/schema';

import { CmsError, conflict } from '../api';
import { assertSlugFree } from '../resources';
import type { CountryInput, DestinationInput } from '../schemas';

type ZodVisa = DestinationInput['visaCategories'][number];
type ZodRequirement = DestinationInput['requirements'][number];

/* -------------------------------------------------------------------------- */
/* Countries                                                                  */
/* -------------------------------------------------------------------------- */

export async function createCountry(params: {
  input: CountryInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const { input, adminId } = params;

  return db.transaction(async (tx) => {
    const duplicateCode = await tx
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.isoCode, input.isoCode))
      .limit(1);

    if (duplicateCode[0]) {
      throw conflict(`A country with the code ${input.isoCode} already exists.`);
    }

    await assertSlugFree({
      db: tx as never,
      table: countries,
      slugColumn: countries.slug,
      idColumn: countries.id,
      slug: input.slug,
    });

    const [last] = await tx
      .select({ displayOrder: countries.displayOrder })
      .from(countries)
      .orderBy(desc(countries.displayOrder))
      .limit(1);

    const [row] = await tx
      .insert(countries)
      .values({
        name: input.name,
        isoCode: input.isoCode,
        slug: input.slug,
        flagEmoji: input.flagEmoji,
        flagAssetId: input.flagAssetId ?? null,
        heroImageAssetId: input.heroImageAssetId ?? null,
        summary: input.summary,
        descriptionMd: input.descriptionMd,
        isFeatured: input.isFeatured,
        status: input.status,
        displayOrder: (last?.displayOrder ?? 0) + 1,
        updatedBy: adminId,
      })
      .returning({ id: countries.id });

    const id = row?.id;
    if (!id) throw new Error('Country insert returned no id.');
    return { id };
  });
}

export async function updateCountry(params: {
  id: string;
  input: CountryInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();
  const { id, input, adminId } = params;

  await db.transaction(async (tx) => {
    const duplicateCode = await tx
      .select({ id: countries.id })
      .from(countries)
      .where(eq(countries.isoCode, input.isoCode))
      .limit(1);

    if (duplicateCode[0] && duplicateCode[0].id !== id) {
      throw conflict(`A country with the code ${input.isoCode} already exists.`);
    }

    await assertSlugFree({
      db: tx as never,
      table: countries,
      slugColumn: countries.slug,
      idColumn: countries.id,
      slug: input.slug,
      excludeId: id,
    });

    await tx
      .update(countries)
      .set({
        name: input.name,
        isoCode: input.isoCode,
        slug: input.slug,
        flagEmoji: input.flagEmoji,
        flagAssetId: input.flagAssetId ?? null,
        heroImageAssetId: input.heroImageAssetId ?? null,
        summary: input.summary,
        descriptionMd: input.descriptionMd,
        isFeatured: input.isFeatured,
        status: input.status,
        updatedAt: new Date(),
        updatedBy: adminId,
      })
      .where(eq(countries.id, id));
  });
}

/* -------------------------------------------------------------------------- */
/* Destination programmes                                                     */
/* -------------------------------------------------------------------------- */

async function assertCountryExists(countryId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: countries.id })
    .from(countries)
    .where(eq(countries.id, countryId))
    .limit(1);
  if (!rows[0]) throw new CmsError(404, 'not_found', 'That country no longer exists.');
}

export async function createDestination(params: {
  input: DestinationInput;
  adminId: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const { input, adminId } = params;

  await assertCountryExists(input.countryId);

  return db.transaction(async (tx) => {
    await assertSlugFree({
      db: tx as never,
      table: destinations,
      slugColumn: destinations.slug,
      idColumn: destinations.id,
      slug: input.slug,
    });

    const [row] = await tx
      .insert(destinations)
      .values({
        countryId: input.countryId,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        descriptionMd: input.descriptionMd,
        processingInfoMd: input.processingInfoMd,
        importantNoticeMd: input.importantNoticeMd,
        heroImageAssetId: input.heroImageAssetId ?? null,
        isFeatured: input.isFeatured,
        status: input.status,
        updatedBy: adminId,
      })
      .returning({ id: destinations.id });

    const id = row?.id;
    if (!id) throw new Error('Destination insert returned no id.');

    if (input.visaCategories.length > 0) {
      await tx.insert(visaCategories).values(
        input.visaCategories.map((category: ZodVisa, index: number) => ({
          destinationId: id,
          name: category.name,
          code: category.code,
          descriptionMd: category.descriptionMd,
          isActive: category.isActive,
          displayOrder: index,
        })),
      );
    }

    if (input.requirements.length > 0) {
      await tx.insert(destinationRequirements).values(
        input.requirements.map((requirement: ZodRequirement, index: number) => ({
          destinationId: id,
          category: requirement.category,
          label: requirement.label,
          detailMd: requirement.detailMd,
          linkUrl: requirement.linkUrl,
          displayOrder: index,
        })),
      );
    }

    return { id };
  });
}

export async function updateDestination(params: {
  id: string;
  input: DestinationInput;
  adminId: string;
}): Promise<void> {
  const db = getDb();
  const { id, input, adminId } = params;

  await assertCountryExists(input.countryId);

  await db.transaction(async (tx) => {
    await assertSlugFree({
      db: tx as never,
      table: destinations,
      slugColumn: destinations.slug,
      idColumn: destinations.id,
      slug: input.slug,
      excludeId: id,
    });

    await tx
      .update(destinations)
      .set({
        countryId: input.countryId,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        descriptionMd: input.descriptionMd,
        processingInfoMd: input.processingInfoMd,
        importantNoticeMd: input.importantNoticeMd,
        heroImageAssetId: input.heroImageAssetId ?? null,
        isFeatured: input.isFeatured,
        status: input.status,
        updatedAt: new Date(),
        updatedBy: adminId,
      })
      .where(eq(destinations.id, id));

    await reconcileChildren({
      tx,
      destinationId: id,
      visa: input.visaCategories,
      requirements: input.requirements,
    });
  });
}

async function reconcileChildren(params: {
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
  destinationId: string;
  visa: ZodVisa[];
  requirements: ZodRequirement[];
}): Promise<void> {
  const { tx, destinationId } = params;

  /* ------------------------------ visa categories ---------------------- */
  const existingVisa = await tx
    .select({ id: visaCategories.id })
    .from(visaCategories)
    .where(eq(visaCategories.destinationId, destinationId));

  const keepVisa = params.visa
    .map((entry) => entry.id)
    .filter((value): value is string => typeof value === 'string');

  const dropVisa = existingVisa
    .map((row) => row.id)
    .filter((existingId) => !keepVisa.includes(existingId));

  if (dropVisa.length > 0) {
    await tx
      .delete(visaCategories)
      .where(
        and(eq(visaCategories.destinationId, destinationId), inArray(visaCategories.id, dropVisa)),
      );
  }

  for (const [index, entry] of params.visa.entries()) {
    if (entry.id) {
      await tx
        .update(visaCategories)
        .set({
          name: entry.name,
          code: entry.code,
          descriptionMd: entry.descriptionMd,
          isActive: entry.isActive,
          displayOrder: index,
        })
        .where(
          and(eq(visaCategories.id, entry.id), eq(visaCategories.destinationId, destinationId)),
        );
    } else {
      await tx.insert(visaCategories).values({
        destinationId,
        name: entry.name,
        code: entry.code,
        descriptionMd: entry.descriptionMd,
        isActive: entry.isActive,
        displayOrder: index,
      });
    }
  }

  /* ------------------------------ requirements ------------------------- */
  const existingRequirements = await tx
    .select({ id: destinationRequirements.id })
    .from(destinationRequirements)
    .where(eq(destinationRequirements.destinationId, destinationId));

  const keepRequirements = params.requirements
    .map((entry) => entry.id)
    .filter((value): value is string => typeof value === 'string');

  const dropRequirements = existingRequirements
    .map((row) => row.id)
    .filter((existingId) => !keepRequirements.includes(existingId));

  if (dropRequirements.length > 0) {
    await tx
      .delete(destinationRequirements)
      .where(
        and(
          eq(destinationRequirements.destinationId, destinationId),
          inArray(destinationRequirements.id, dropRequirements),
        ),
      );
  }

  for (const [index, entry] of params.requirements.entries()) {
    if (entry.id) {
      await tx
        .update(destinationRequirements)
        .set({
          category: entry.category,
          label: entry.label,
          detailMd: entry.detailMd,
          linkUrl: entry.linkUrl,
          displayOrder: index,
        })
        .where(
          and(
            eq(destinationRequirements.id, entry.id),
            eq(destinationRequirements.destinationId, destinationId),
          ),
        );
    } else {
      await tx.insert(destinationRequirements).values({
        destinationId,
        category: entry.category,
        label: entry.label,
        detailMd: entry.detailMd,
        linkUrl: entry.linkUrl,
        displayOrder: index,
      });
    }
  }
}

export async function deleteDestination(id: string): Promise<void> {
  const db = getDb();
  // Visa categories and requirements cascade; employment opportunities that
  // reference this programme are detached by `on delete set null`.
  await db.delete(destinations).where(eq(destinations.id, id));
}
