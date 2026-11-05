/**
 * Drizzle schema barrel — the single import surface for the whole database.
 *
 * `drizzle.config.ts` points here, so every table must be re-exported for
 * migrations to see it.
 */

export * from './enums';
export * from './auth';
export * from './media';
export * from './settings';
export * from './content';
export * from './destinations';
export * from './people';
export * from './assessments';
export * from './operations';
