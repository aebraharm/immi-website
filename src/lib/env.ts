import { z } from 'zod';

/**
 * Environment parsing.
 *
 * Two rules make this file worth its weight:
 *
 * 1. Nothing throws at import time. A production build must succeed with zero
 *    credentials present, so validation is split — `serverEnv()` is only called
 *    from code paths that genuinely need the database or a secret at runtime.
 *
 * 2. When something IS missing, the error is specific and actionable, and it
 *    never echoes a secret value back into a log or an HTTP response.
 */

const databaseUrlSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith('libsql://') || value.startsWith('file:'),
    'TURSO_DATABASE_URL must start with libsql:// (Turso) or file: (local)',
  );

const serverEnvSchema = z.object({
  TURSO_DATABASE_URL: databaseUrlSchema,
  TURSO_AUTH_TOKEN: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  STORAGE_DRIVER: z.enum(['local', 'blobs']).default('local'),
  NETLIFY_BLOBS_SITE_ID: z.string().optional(),
  NETLIFY_BLOBS_TOKEN: z.string().optional(),
});

export type ServerEnv = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string | undefined;
  SESSION_SECRET: string | undefined;
  STORAGE_DRIVER: 'local' | 'blobs';
  NETLIFY_BLOBS_SITE_ID: string | undefined;
  NETLIFY_BLOBS_TOKEN: string | undefined;
};

export class ConfigurationError extends Error {
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = 'ConfigurationError';
    this.variable = variable;
  }
}

/** True when a local-file database is configured (development). */
export function isLocalDatabase(url: string): boolean {
  return url.startsWith('file:');
}

/**
 * Resolve runtime server configuration.
 *
 * @throws ConfigurationError when the database is not configured. Callers on
 * public pages should catch `ConfigurationError` and render a neutral
 * "not configured" state rather than a stack trace.
 */
export function serverEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    SESSION_SECRET: process.env.SESSION_SECRET,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? 'local',
    NETLIFY_BLOBS_SITE_ID: process.env.NETLIFY_BLOBS_SITE_ID,
    NETLIFY_BLOBS_TOKEN: process.env.NETLIFY_BLOBS_TOKEN,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const variable = String(issue?.path[0] ?? 'TURSO_DATABASE_URL');
    throw new ConfigurationError(
      variable,
      `Missing or invalid configuration for ${variable}. ` +
        'Copy .env.example to .env.local and fill in the required values.',
    );
  }

  const data = parsed.data;

  // A remote database requires a token; a local file must not send one.
  if (!isLocalDatabase(data.TURSO_DATABASE_URL) && !data.TURSO_AUTH_TOKEN) {
    throw new ConfigurationError(
      'TURSO_AUTH_TOKEN',
      'TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL points at Turso.',
    );
  }

  return {
    TURSO_DATABASE_URL: data.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: data.TURSO_AUTH_TOKEN,
    SESSION_SECRET: data.SESSION_SECRET,
    STORAGE_DRIVER: data.STORAGE_DRIVER,
    NETLIFY_BLOBS_SITE_ID: data.NETLIFY_BLOBS_SITE_ID,
    NETLIFY_BLOBS_TOKEN: data.NETLIFY_BLOBS_TOKEN,
  };
}

/**
 * Session secret, required by any authentication code path.
 * Kept separate from `serverEnv()` so public pages never need it.
 */
export function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConfigurationError(
      'SESSION_SECRET',
      'SESSION_SECRET must be set to at least 32 characters. ' +
        'Generate one with: openssl rand -hex 48',
    );
  }
  return secret;
}

/** True when the database is configured — used to render a graceful UI state. */
export function isDatabaseConfigured(): boolean {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return false;
  if (isLocalDatabase(url)) return true;
  return Boolean(process.env.TURSO_AUTH_TOKEN);
}

export const publicSiteUrl: string =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';
