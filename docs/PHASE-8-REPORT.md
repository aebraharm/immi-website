# Phase 8 — Production Deployment and Infrastructure Integration

**Status:** Pre-deployment infrastructure audit and narrowly scoped preparation are complete. This is a readiness report, **not a deployment report**. No Netlify or Turso account or production database was accessed. Only disposable local `/tmp` databases were used for schema/tests and a read-only PRAGMA probe; no remote migration, seed, production administrator, hosted storage write, deployment, commit, or push was performed. Stop point: prepare configuration and local checks only, then wait at the production deployment approval gate.

- **Date:** 5 November 2026 (Africa/Lagos)
- **Branch:** `arena/cdcb43ad-immi-website`
- **Repository state:** work remains uncommitted. Protected local files `.data/local.db` and `.data/secret-markers.json` were not modified.
- **Phase boundary:** Phase 8 infrastructure preparation only. No feature redesign or Phase 9 work.

## 1. Audit scope and evidence

Reviewed `docs/DEPLOYMENT.md`, the Phase 1–7 reports, `package.json`/lockfile, `netlify.toml`, Next.js configuration and middleware, Drizzle configuration and migration files, database client/schema, runtime environment parsing, authentication/session code, Netlify Blobs and local storage adapters, upload validation, private attachment delivery, seed/migration scripts, health route, and all environment-variable references. No secret values were printed or included here.

The prior Phase 7 report records 409 automated tests, typecheck/lint, schema verification (38/38), Drizzle checks, audits, and a credential-free build as passing. Those are Phase 7 results, not proof of a Netlify deploy or access to the current production database. Phase 8 reran local checks in isolated scratch copies after the preparation changes; results and the partial adapter check are recorded in §5.

## 2. Infrastructure audit findings

| Area | Audit result | Status / action |
|---|---|---|
| Next.js and Netlify adapter | Next.js `15.5.29`, App Router. `netlify.toml` specifies `npm run build`, `.next`, Node 22, and `@netlify/plugin-nextjs`. The official plugin README in registry package `5.16.6` says Netlify auto-installs the runtime, supports Next.js 13.5+ and Node 18+, and can be pinned as a dev dependency. The initial audit found the plugin unpinned; after the audit it was pinned to exact `5.16.6`. A local `netlify build --offline` used runtime v5.16.6; Next build and Node function bundling passed, but edge bundling stopped with `fetch failed` (details below). | Source/configuration are aligned with the official adapter. Hosted runtime remains unverified; the offline edge-bundling failure is an environment limitation, not proof of adapter incompatibility. |
| Server routes / rendering | 58 App Router API route files were found; 56 explicitly declare `runtime='nodejs'` and the other two inherit Next.js's Node runtime. The middleware uses the Web APIs/Next middleware contract and performs no database access. Public/admin pages and API routes requiring data are marked dynamic. | No Edge-only database/auth route was found. Adapter support is plausible, not confirmed in an actual Netlify site. Test the native Argon2 package, SSR, middleware, and all critical route classes in staging. |
| Node runtime | Local audit runtime is Node `22.22.3`. `netlify.toml` selects Node 22; preparation changed `package.json` to require `>=22.12.0 <23`, matching `@netlify/blobs@11.1.7`'s declared minimum. | Configuration now expresses the SDK minimum. The effective hosted Netlify Node patch is still unknown; confirm it in a staging build/function log. |
| Build / startup | Build command is `npm run build` (`next build`). There are no `prebuild`, `postinstall`, or seed hooks. Migrations and seeders are explicit CLI commands, not part of the Netlify build. A fresh credential-free Phase 8 build passed in an isolated scratch copy. | Suitable in principle. Keep production DB/storage credentials out of build logs and do not add migrations/seeds to the build. Hosted adapter packaging remains unverified because the offline local Netlify build could not complete edge bundling. |
| Next config / headers / routing | `next.config.ts` provides security headers and self-hosted image behavior. `netlify.toml` adds HSTS and security headers, no-store on `/admin/*`, assessment receipts, and `/api/*`. No custom Netlify rewrite/redirect rules are present; Next routes and the official adapter handle them. | No obvious missing route mapping found. Check duplicate/overridden response headers and redirects in a staging deploy; production headers have not been observed. |
| Turso/libSQL | The lazy server-side client uses `@libsql/client` and Drizzle. Remote URLs require `TURSO_AUTH_TOKEN`; configuration errors avoid echoing values. `GET /api/health` makes a read-only `SELECT 1` and returns only `ok`, `not_configured`, or `unreachable`. The single repository migration is `drizzle/0000_init.sql` (33 domain tables plus the migration ledger); build does not apply it. | Secure pattern in source. **Current production URL, token, permissions, schema state, backups, and connectivity are unverified.** No production database inspection was possible; do not run `db:migrate` until a non-destructive schema comparison is available and migration approval is explicit. |
| Foreign-key setting | `src/db/client.ts` exports `assertForeignKeyEnforcement()`, but a source search found no application call site; migration/seed scripts set the PRAGMA themselves. A throwaway local libSQL connection reported `PRAGMA foreign_keys=1` by default. | Local behavior is observed; remote Turso behavior is unknown. Include a read-only/constraint check on the actual staging database before production. Do not infer production enforcement from the local file test. |
| Netlify Blobs | `src/lib/storage/blobs.ts` uses separate site-level stores `immi-public` and `immi-private`. The installed SDK reads Netlify's automatically injected `NETLIFY_BLOBS_CONTEXT`; `.env.example` documents that it is platform-injected. The code also supports explicit server-only site ID/token values. The public media proxy selects only `visibility='public'`, validates MIME, and sets a one-year immutable cache header. Private CV download is a separate authenticated/role-guarded, audited route with `no-store`, attachment disposition, and a sandboxing CSP. | Separation and response controls are present in source. Production storage selection now fails closed unless `STORAGE_DRIVER=blobs`; hosted permissions/configuration remain untested. Blobs stores default to site scope and are shared across deploy contexts; use a **separate staging Netlify site** (and separate staging database) rather than a branch deploy sharing the production site's stores. |
| Upload ceilings | Image limit 8 MB, CV/document 10 MB, testimonial video 100 MB. Phase 5 records a 16 MB Netlify function payload ceiling and states CV plus form fields fit within it. | The 100 MB video allowance exceeds the documented platform request ceiling; large media upload through the current server route is a deployment risk. Confirm the current limit and test in isolated staging. Do not silently lower the feature limit or redesign uploads; if incompatible, return with options and request approval before changing behavior. |
| Environment configuration | Runtime names identified in §3. Local `.env.local` exists, but its values were not printed or used and cannot establish Netlify configuration. The Netlify connector is unsupported in this session; native `netlify` and `turso` CLIs are absent. A temporary Netlify CLI package was used only for an offline local build with no authentication or site access. | No production/staging variables or account settings could be inspected or configured. Configure secrets through the Netlify site’s secure environment-variable UI (or another authorized secret manager), never in chat or source. |
| Staging / production access | No staging site ID/domain, staging Turso database, or deploy credentials were available. Netlify and Turso connector lookups report `unsupported`; native CLIs are absent. No secure staging secret interface is available here. | **No staging deployment or staging test is complete; no staging URL exists.** Do not use production resources as a substitute. Provide an authorized secure staging integration/runner before hosted checks. |
| Costs | No Netlify/Turso account or billing view was available. No service, database, site, store, or paid resource was created. | Plan/usage costs are unknown; confirm account plan and any potential usage charges before creating staging resources. |

### Compatibility conclusion

The source is **compatible in principle** with Netlify's officially supported Next.js runtime: it uses supported App Router/Node route handlers, dynamic SSR, server-side auth, lazy Turso access, and an explicit plugin declaration. Preparation pinned `@netlify/plugin-nextjs@5.16.6`, aligned the declared Node engine with the Blobs SDK minimum, and made production storage selection fail closed. A clean credential-free Next.js production build passed. The local offline Netlify build used runtime v5.16.6 and completed the Next.js build and Node-function bundling, but edge-function packaging failed with `fetch failed`; this does not establish hosted compatibility. The 100 MB video allowance may still exceed the documented 16 MB function payload ceiling and requires an isolated staging test or an explicit approved plan.

No production schema comparison, database-permission test, hosted Blobs read/write test, secure-cookie observation, staging browser flow, or resolved hosted-runtime check was performed. A successful local production build is not equivalent to any of those checks.

## 3. Environment-variable checklist

Secret values are intentionally omitted. Configure applicable values in the **separate staging site's** or production site's **Netlify environment-variable UI**, scoped to the correct deploy context. Do not paste secret values into chat or commit them. No production administrator variables should be configured at this stage.

| Exact variable | Required? / purpose | Scope and exposure |
|---|---|---|
| `TURSO_DATABASE_URL` | Required at runtime for database-backed routes; `libsql://…` in the target deployment. | Netlify site environment; server-only. It identifies the database and is not a public client variable. Production value not verified. |
| `TURSO_AUTH_TOKEN` | Required secret when the URL is remote. | Netlify secret environment; server-only. Never log or expose. No production token was used or inspected. |
| `SESSION_SECRET` | Required for authentication; source requires at least 32 characters. Deployment guide recommends 48 random bytes encoded as hex. | Netlify secret environment; server-only. Never expose. Production presence/quality not checked. |
| `STORAGE_DRIVER` | Production must explicitly select `blobs`; local/non-production environments default to `local`. Production now fails closed if the value is missing or unrecognized. | Netlify site environment; server-only, non-secret. Set and verify for each deploy context. Do not add credentials or echo unrecognized values in logs. |
| `NETLIFY_BLOBS_CONTEXT` | Runtime context used by the SDK; Netlify documents it as automatically populated in serverless/edge execution. | Platform-injected; server-only and sensitive. Do not set manually or log. Confirm availability with a synthetic staging read/write. |
| `NETLIFY_BLOBS_SITE_ID` / `NETLIFY_BLOBS_TOKEN` | Optional explicit credentials supported by the adapter when running outside the auto-configured Netlify context. | Server-only; token is secret. Prefer the platform context in Netlify; if explicit credentials are ever needed, configure only through a secret manager. |
| `NEXT_PUBLIC_SITE_URL` | Required for canonical URLs, sitemap, Open Graph, and absolute links; source otherwise falls back to localhost. | Set for the site/build context. `NEXT_PUBLIC_` means it is intentionally public and may be embedded in client output. |
| `NODE_ENV` | Netlify-managed; must be `production` for the production deploy. | Platform/runtime variable. Not a secret. Do not override casually. |
| `NODE_VERSION` | Configured as Node 22 by `netlify.toml`; effective runtime must be at least 22.12.0 for `@netlify/blobs@11.1.7`. | Build/runtime selection in Netlify configuration. Not a secret. Confirm actual resolved patch version. |
| `NEXT_TELEMETRY_DISABLED` | Already set to `1` for the Netlify build. | Build-only, non-secret. |
| `SESSION_COOKIE_NAME` | Optional; defaults to `immi_admin_session`. | Server-only, non-secret. Leave unset unless there is an approved reason to change it. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`, `ADMIN_ROLE`, `SEED_ADMIN_ALLOW_ADDITIONAL` | One-time CLI bootstrap inputs only; not required for site runtime. | Never add as persistent Netlify site variables. Production admin provisioning is a separate approval checkpoint and has **not** been performed. Do not reuse any previously shared password. |

## 4. Safety and deployment plan

1. Completed only narrow reproducibility/safety updates: pinned `@netlify/plugin-nextjs` to exact version `5.16.6`; aligned the Node engine with the Blobs package; clarified automatically injected Blobs context, isolated staging, migration and bootstrap gates in the deployment guide; updated `.env.example` and `netlify.toml`; and made production storage selection fail closed instead of silently falling back to local files. No schema or application-data change was made. The Phase 7 esbuild override and caveat remain documented.
2. Completed local checks in isolated scratch copies: typecheck, lint, full tests, schema verification, Drizzle checks, dependency audits, storage-driver unit tests, and a credential-free production build passed. A local Netlify CLI build was attempted offline: Next.js build and Node-function bundling passed; edge-function bundling did not, with `fetch failed`. Exact counts and details are in §5.
3. Staging requires a **separate Netlify site and isolated Turso database** because Blobs are site-scoped across deploy contexts. No such resources are currently available. Creating new or paid infrastructure is not authorized without confirmation of plan/cost; no staging resources will be created unilaterally.
4. Do not inspect or modify the existing production database until secure connection access is provided and a read-only comparison method is agreed. No migration may be applied without a separate explicit approval after documenting its exact impact and rollback.
5. Do not seed content, provision `[REDACTED-EMAIL]`, or use any previously shared password. Admin provisioning remains pending its separate explicit authorization.
6. Production deployment remains **blocked** until a deployment readiness report is presented and the user explicitly approves the production deploy. This Phase 8 start authorization is not production-deploy approval.

## 5. Post-audit preparation and verification

### Preparation completed

- Pinned `@netlify/plugin-nextjs` to exact version `5.16.6` and updated the lockfile.
- Set the package Node engine to `>=22.12.0 <23`, matching the installed `@netlify/blobs@11.1.7` minimum; `netlify.toml` remains on Node 22 and documents the minimum patch requirement.
- Changed production storage selection so it fails closed unless `STORAGE_DRIVER=blobs`; non-production defaults to local storage. Unknown values are rejected without echoing the value. Added focused storage-driver tests.
- Updated `.env.example` and `docs/DEPLOYMENT.md` for platform-injected `NETLIFY_BLOBS_CONTEXT`, separate-site staging, Blobs' deploy-context sharing, environment-variable handling, upload-size caveat, existing-database preservation, and migration/admin approval gates.
- No application schema or migration was changed. `drizzle/0000_init.sql` remains the only repository migration. The Phase 7 esbuild compatibility caveat and override remain in place.

### Verification performed in isolated scratch copies

| Check | Result |
|---|---|
| `npm run typecheck` | **Passed.** |
| `npm run lint` | **Passed.** |
| `npm test` | **Passed:** core 309/309 and CMS 103/103 (412 total). The new storage-driver test is also covered by the core glob; the focused file was separately run and passed 3/3. |
| `npm run verify:schema` | **Passed:** 38/38 checks. |
| `npm run db:check` | **Passed:** “Everything’s fine.” |
| `npm run db:generate` | **Passed:** no schema changes and nothing to migrate; the migration file was unchanged. |
| `npm audit --json` and `npm audit --omit=dev --json` | **Passed:** zero reported vulnerabilities in both full and production dependency trees. |
| Clean credential-free `npm run build` | **Passed** in a fresh scratch copy. No production credentials or production database were used. |
| Local storage-driver tests | **Passed:** 3/3. Production selection rejects missing/invalid configuration; no invalid value is printed. |
| Package/runtime inspection | **Confirmed:** `@netlify/plugin-nextjs@5.16.6`, `@netlify/blobs@11.1.7`, and `next@15.5.29` are installed; the existing esbuild override remains. |

### Local Netlify adapter check — partial, hosted validation still required

Ran temporary `netlify-cli@27.16.2` with `netlify build --offline --context deploy-preview` in an isolated scratch copy, with a temporary clean `HOME`, no Netlify authentication, and no site access. It selected Next.js Runtime `v5.16.6`; the application build completed and server-function bundling completed. Edge-function bundling for `___netlify-edge-handler-src-middleware` then failed with the exact error `fetch failed`. The CLI also warned, “could not fetch latest plugins list,” followed by `fetch failed`. No failing URL was reported. Because this check was explicitly offline and network access is restricted, the root cause of the edge-bundling fetch was not conclusively identified; it is an **incomplete local verification**, not evidence that hosted staging will fail or succeed. Recommended next step: run a hosted build on an isolated staging Netlify site and verify middleware/edge packaging there; do not claim Netlify compatibility from this local attempt.

One follow-up `next build` in the same symlink-backed scratch directory after the failed adapter packaging returned `Module not found` for Next.js relative imports (`../shared/lib/utils`, `../shared/lib/constants`, `../server/get-page-files`, `../shared/lib/htmlescape`, and `../lib/is-error`) under a generated `home/user/immi-website/node_modules/next/...` path. A separate fresh scratch copy built successfully. The incomplete generated path suggests scratch/worktree contamination from reusing the adapter build directory, but the exact cause was not confirmed. This is recorded as a scratch-only dead end, not a clean-build failure; use a fresh worktree for any repeat local build.

No hosted Netlify/Turso endpoint was contacted. No production or applicant data was read or changed. Isolated local test databases and a disposable local libSQL PRAGMA probe were the only database activity. The final SHA-256 hashes of `.data/local.db` and `.data/secret-markers.json` match the values recorded at audit start. No hosted Blobs read/write, deploy, migration, seed, admin provisioning, commit, or push occurred.

### Edge-function failure investigation (offline evidence)

The failed generated function is `___netlify-edge-handler-src-middleware`, identified by the adapter manifest as **Next.js Middleware Handler**, generated by `@netlify/plugin-nextjs@5.16.6` from `src/middleware.ts`. That middleware currently provides the production HTTPS redirect, per-request CSP nonce, no-index/cache headers, and an inexpensive unauthenticated-admin redirect. These behaviors are part of the existing application contract; they were not removed or bypassed.

The generated `edge-runtime/vendor.ts` seeds remote Deno dependencies from `deno.land/std@0.175.0`, `deno.land/x/path_to_regexp@v6.2.1`, `deno.land/x/htmlrewriter@v1.0.0`, and `v1-7-0--edge-utils.netlify.app/logger/mod.ts`. The offline bundler reports only `fetch failed` and does not identify which import/URL failed. This makes restricted/offline network access the likely cause; the exact failed dependency cannot be established from available logs. No unsupported Node feature or application import was reported. The `Next.js Middleware Handler` is expected to be an edge function under this adapter; do not delete middleware functionality to suppress the packaging error. Verify these dependencies and behavior in hosted isolated staging. Plugin compatibility is partial, not fully proven: v5.16.6 metadata supports Next 13.5+ and Node >=18; this app's Next 15.5.29 build and server-function bundle passed. Local Node `22.22.3` satisfies the package engine `>=22.12.0 <23` and `netlify.toml` selects Node 22, but Netlify's resolved staging patch remains unverified.

### Video upload architecture assessment (read-only)

The current CMS upload path is `POST /api/admin/cms/media` → authenticated role/CSRF guard → `request.formData()` → `File` → `ingestUpload()`/`file.arrayBuffer()` → `storage.put()` → `@netlify/blobs` `store.set()`. The code buffers the request and copies the upload bytes before storage. The video limit is 100 MiB at both request and signature-validator level. Thus the entire multipart request still traverses a Netlify Function and cannot be assumed to fit the documented 16 MB function payload limit; direct use of `store.set()` does not bypass ingress limits.

The installed `@netlify/blobs@11.1.7` public types expose server-side `Store.set(key, string | ArrayBuffer | Blob)` and no supported public browser presigned-upload URL helper. The SDK's internal signed-URL mechanism is used by its server client to transmit the supplied body; it does not provide this application a safe client upload URL. The current architecture therefore has **no verified direct-to-Blobs upload path**. Do not expose Blobs tokens or use undocumented internal APIs. Existing MIME, extension, magic-byte, size, role, and public/private checks must not be weakened.

If direct upload is pursued later, it needs a supported scoped short-lived one-use authorization, server-generated key and byte ceiling, an untrusted/quarantine stage, server-side size/MIME/magic-byte verification before publication, private/public separation, replay/unauthorized-write controls, and expiry/orphan cleanup. No such flow is implemented or staging-tested. If Netlify Blobs does not offer a supported mechanism, options are (a) approve a feature-level size reduction to a ceiling safely below the function request limit including multipart overhead, or (b) approve a separately evaluated object-storage/direct-upload service with any cost/security tradeoffs. No limit or architecture was changed here.

### Hosted staging gate status

No staging Netlify site name or URL, staging Turso identity/URL/token, environment-variable scope, schema status, Netlify runtime, function/edge behavior, or hosted Blobs read/write has been verified. No staging variables were configured and no synthetic upload was made. The public-media, private synthetic-CV, denial-path, storage-failure, browser, admin, session, and accessibility staging tests are all **not run**. Netlify and Turso connector lookups returned `unsupported`; no native CLI or authenticated secure runner/site identifiers were available. Staging is blocked until an authorized secure integration/runner is provided. The required repository audit is complete, but a Git-connected deploy is not safe from this checkout: HEAD tracks only `README.md`; the application/configuration remain untracked. A local manual deploy path is unverified. No commit/push or workaround was attempted.

## 6. Completion matrix (current state)

| Item | Status |
|---|---|
| Source/configuration audit | **Complete.** |
| Narrow Phase 8 preparation | **Complete.** Deployment documentation and fail-closed storage/runtime safeguards are updated; no schema/data changes. |
| Local typecheck, lint, tests, schema/Drizzle checks, audits, and clean build | **Passed** as listed in §5. |
| Local Netlify adapter verification | **Partial / blocked offline.** Next.js build and server-function bundling passed; edge bundling returned `fetch failed`. Hosted compatibility remains unverified. |
| Effective hosted Node version / Netlify environment variables | **Not verified.** No site configuration was accessed. |
| Turso production state/schema/permissions | **Not inspected.** No production connection or query; no migration run. |
| Hosted Netlify Blobs | **Not verified.** No hosted reads/writes. Local simulator or unit-test results are not hosted evidence. |
| Staging deployment and tests | **Not completed.** No isolated staging site/database were available. |
| Production deployment / verification | **Not completed; separate explicit approval required.** |
| Production administrator | **Not provisioned; separate explicit approval required.** |
| Commit / push | **Not performed; separate explicit approval required.** |

## 7. Stop point

Phase 8 remains **pre-deployment**. Stop before any production deployment, production migration, production storage write, production admin provisioning, or creation of paid staging infrastructure. In this session the Netlify and Turso connectors are reported unsupported, native `netlify`/`turso` CLIs and staging identifiers are unavailable, and no authorized secure secret interface is accessible. Therefore no staging site/database was created or configured. To continue, make an isolated staging Netlify site and separate staging Turso database available through an authorized secure integration/runner; confirm costs first. Then perform hosted adapter, runtime, database, Blobs, upload-limit, auth/session, and critical browser-flow checks with synthetic data. Present an updated readiness report and wait for separate explicit production deployment approval. No production success should be claimed before actual production verification.


## 8. Repository audit checkpoint — before staging

**Audit timestamp:** 5 November 2026. This checkpoint was completed before any staging-site setup or deployment attempt.

| Repository fact | Result |
|---|---|
| Branch / HEAD | `arena/cdcb43ad-immi-website` / `bc53028b18b4ad9f8f2391b816a872973cbae457`. |
| `git status --short` | 283 lines, all `??` untracked paths; no tracked-file modifications. |
| Tracked / untracked | 1 tracked path (`README.md`); 283 untracked paths. The current Git HEAD contains only the README. |
| Complete inventory | All 283 paths are listed by category in Appendix A below. No path from `git status --short` is omitted. |

### Classification and deployment relevance

| User category | Count / findings |
|---|---|
| 1. Required application source | **239** `src/**` paths (App Router pages and APIs, components, database/schema/query code, auth, storage, validation, middleware), plus **6** operational TypeScript scripts. These are required source/tooling; migration/seed scripts are not build hooks and must not run against production. |
| 2. Required configuration and deployment files | **13** paths: `.env.example`, `.gitignore`, `drizzle.config.ts`, `drizzle/0000_init.sql`, `drizzle/meta/0000_snapshot.json`, `drizzle/meta/_journal.json`, `eslint.config.mjs`, `netlify.toml`, `next.config.ts`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `tsconfig.json`. The package files, Next/Netlify config, application source, and required build configuration are necessary for a deploy from this workspace. The migration files are needed for controlled staging schema work only; they are not applied by deployment. |
| 3. Documentation | **10** `docs/**` files (Phase 1 proposal, Phase 1–8 reports, and `DEPLOYMENT.md`). These are not runtime bundles; they are required audit/deployment documentation and must remain in the repository workspace. |
| 4. Tests and fixtures | **15** `tests/**` files. Required for regression and staging QA, but not the production runtime bundle. Test fixtures are synthetic; no real assessment was submitted. |
| 5. Generated files/build artifacts | **0** among the 283 untracked paths. Ignored local artifacts are present: `.next` (337 MB), `node_modules` (790 MB), `tsconfig.tsbuildinfo`, and `next-env.d.ts`; all must stay out of deployment source archives except platform-built outputs. |
| 6. Local databases/application data | **0** among the 283 untracked paths. Ignored `.data/` (about 2.9 MB) contains `.data/local.db`, `.data/phase7-browser.db`, `.data/verify-assessment-route.db`, `.data/verify-assessment.db`, `.data/verify-phase6.db`, and `.data/secret-markers.json`. These are local-only; contents were not inspected in this audit and they must not be deployed. The two explicitly protected files' SHA-256 hashes still match audit start. |
| 7. Temporary files/QA artifacts | **0** among the 283 paths. No root `.netlify`, `coverage`, `dist`, `build`, `.turbo`, or `.cache` directory was present. Isolated QA scratch copies/logs are under `/tmp/phase8-*`, outside the repository; local verification databases under `.data/` remain protected/local. |
| 8. Sensitive files / possible secrets | No high-confidence literal credential pattern was found in the 283 untracked text files or scanned generated Next text. `.env.example` contains the safe template/placeholders. Ignored `.env.local` (254 bytes) contains local-only configuration including a local-file database URL and a configured local session secret; values were suppressed and not used for builds. Ignored `.data/secret-markers.json` is treated as sensitive by name and was not read. No production URL/token was accessed or used. |
| 9. Uncertain files | No unclassified untracked path remains. Local database contents are intentionally uninspected and must be treated as potentially sensitive applicant/application data. |

### File types and directory distribution

The 283 untracked paths break down by directory: `src/` 239; `tests/` 15; `docs/` 10; `scripts/` 6; `drizzle/` 3; and 10 root-level files (the config/deployment files listed above). By extension: `.ts` 161, `.tsx` 100, `.md` 10, `.json` 5, `.mjs` 2, `.css` 1, `.example` 1, `.sql` 1, `.toml` 1, and one extensionless `.gitignore`.

### Ignore rules and repository safety

`.gitignore` already excludes root `node_modules`, Next/build outputs (`.next`, `/out`, `/build`, `/dist`), `.data`, `.netlify`, TypeScript build info, local `.env`/`.env.local`/`*.local` environment files, logs, coverage, and common tool directories. The initial audit identified that plain `.env.production`, `.env.development`, `.env.test`, and `.env.staging` were not covered; I added only those four exact patterns while retaining `!.env.example`. No broad source-hiding ignore rule was added. Generic `.cache` and arbitrary temp files are not globally ignored, but none were present in the repository; no rule was added for them.

### Can this checkout deploy without a Git commit or push?

**Not safely verified or deployable through the Git-connected branch as it stands.** All application/configuration files are untracked, while the branch HEAD tracks only `README.md`; a Git-backed Netlify build from this branch would not contain the application. A manual Netlify CLI deploy from the local working tree may be possible without commit/push, but no authenticated staging site or approved site ID is available and the previous offline adapter packaging did not complete. Do not deploy until an authorized non-Git staging path is confirmed. If Netlify requires a Git commit/push or repository restructuring, stop; no commit, push, staging, or production operation was performed at this checkpoint.

### Appendix A — complete list of all 283 untracked paths

The entries below are exactly the 283 paths returned by `git ls-files --others --exclude-standard` / `git status --short` at the checkpoint. Prefix `??` applies to every entry.

#### Required application source — `src/` (239)

```text
src/app/(admin)/admin/(dashboard)/activity/page.tsx
src/app/(admin)/admin/(dashboard)/assessments/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/assessments/page.tsx
src/app/(admin)/admin/(dashboard)/content/countries/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/countries/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/countries/page.tsx
src/app/(admin)/admin/(dashboard)/content/destinations/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/destinations/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/destinations/page.tsx
src/app/(admin)/admin/(dashboard)/content/faqs/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/faqs/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/faqs/page.tsx
src/app/(admin)/admin/(dashboard)/content/homepage/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/homepage/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/homepage/page.tsx
src/app/(admin)/admin/(dashboard)/content/media/page.tsx
src/app/(admin)/admin/(dashboard)/content/pages/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/pages/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/pages/page.tsx
src/app/(admin)/admin/(dashboard)/content/seo/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/seo/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/seo/page.tsx
src/app/(admin)/admin/(dashboard)/content/services/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/services/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/services/page.tsx
src/app/(admin)/admin/(dashboard)/content/settings/page.tsx
src/app/(admin)/admin/(dashboard)/content/team/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/team/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/team/page.tsx
src/app/(admin)/admin/(dashboard)/content/testimonials/[id]/page.tsx
src/app/(admin)/admin/(dashboard)/content/testimonials/new/page.tsx
src/app/(admin)/admin/(dashboard)/content/testimonials/page.tsx
src/app/(admin)/admin/(dashboard)/layout.tsx
src/app/(admin)/admin/(dashboard)/page.tsx
src/app/(admin)/admin/(dashboard)/settings/page.tsx
src/app/(admin)/admin/change-password/change-password-form.tsx
src/app/(admin)/admin/change-password/page.tsx
src/app/(admin)/admin/login/login-form.tsx
src/app/(admin)/admin/login/page.tsx
src/app/(admin)/layout.tsx
src/app/(site)/about/page.tsx
src/app/(site)/assessment/page.tsx
src/app/(site)/contact/metadata-builder.ts
src/app/(site)/contact/page.tsx
src/app/(site)/destinations/[slug]/page.tsx
src/app/(site)/destinations/page.tsx
src/app/(site)/faq/page.tsx
src/app/(site)/layout.tsx
src/app/(site)/page.tsx
src/app/(site)/privacy/page.tsx
src/app/(site)/services/[slug]/page.tsx
src/app/(site)/services/page.tsx
src/app/(site)/team/page.tsx
src/app/(site)/terms/page.tsx
src/app/(site)/testimonials/page.tsx
src/app/api/admin/assessments/[id]/attachments/[attachmentId]/route.ts
src/app/api/admin/assessments/[id]/notes/[noteId]/route.ts
src/app/api/admin/assessments/[id]/notes/route.ts
src/app/api/admin/assessments/[id]/route.ts
src/app/api/admin/assessments/[id]/status/route.ts
src/app/api/admin/assessments/route.ts
src/app/api/admin/auth/change-password/route.ts
src/app/api/admin/auth/login/route.ts
src/app/api/admin/auth/logout/route.ts
src/app/api/admin/cms/countries/[id]/restore/route.ts
src/app/api/admin/cms/countries/[id]/route.ts
src/app/api/admin/cms/countries/[id]/status/route.ts
src/app/api/admin/cms/countries/reorder/route.ts
src/app/api/admin/cms/countries/route.ts
src/app/api/admin/cms/destinations/[id]/restore/route.ts
src/app/api/admin/cms/destinations/[id]/route.ts
src/app/api/admin/cms/destinations/[id]/status/route.ts
src/app/api/admin/cms/destinations/reorder/route.ts
src/app/api/admin/cms/destinations/route.ts
src/app/api/admin/cms/faqs/[id]/restore/route.ts
src/app/api/admin/cms/faqs/[id]/route.ts
src/app/api/admin/cms/faqs/[id]/status/route.ts
src/app/api/admin/cms/faqs/reorder/route.ts
src/app/api/admin/cms/faqs/route.ts
src/app/api/admin/cms/homepage/[id]/restore/route.ts
src/app/api/admin/cms/homepage/[id]/route.ts
src/app/api/admin/cms/homepage/[id]/status/route.ts
src/app/api/admin/cms/homepage/reorder/route.ts
src/app/api/admin/cms/homepage/route.ts
src/app/api/admin/cms/media/[id]/route.ts
src/app/api/admin/cms/media/route.ts
src/app/api/admin/cms/pages/[id]/restore/route.ts
src/app/api/admin/cms/pages/[id]/route.ts
src/app/api/admin/cms/pages/[id]/status/route.ts
src/app/api/admin/cms/pages/route.ts
src/app/api/admin/cms/seo/[id]/restore/route.ts
src/app/api/admin/cms/seo/[id]/route.ts
src/app/api/admin/cms/seo/[id]/status/route.ts
src/app/api/admin/cms/seo/route.ts
src/app/api/admin/cms/services/[id]/restore/route.ts
src/app/api/admin/cms/services/[id]/route.ts
src/app/api/admin/cms/services/[id]/status/route.ts
src/app/api/admin/cms/services/reorder/route.ts
src/app/api/admin/cms/services/route.ts
src/app/api/admin/cms/settings/route.ts
src/app/api/admin/cms/team/[id]/restore/route.ts
src/app/api/admin/cms/team/[id]/route.ts
src/app/api/admin/cms/team/[id]/status/route.ts
src/app/api/admin/cms/team/reorder/route.ts
src/app/api/admin/cms/team/route.ts
src/app/api/admin/cms/testimonials/[id]/restore/route.ts
src/app/api/admin/cms/testimonials/[id]/route.ts
src/app/api/admin/cms/testimonials/[id]/status/route.ts
src/app/api/admin/cms/testimonials/reorder/route.ts
src/app/api/admin/cms/testimonials/route.ts
src/app/api/assessment/route.ts
src/app/api/health/route.ts
src/app/api/media/[...key]/route.ts
src/app/error.tsx
src/app/fonts.ts
src/app/globals.css
src/app/layout.tsx
src/app/not-found.tsx
src/app/robots.ts
src/app/sitemap.ts
src/components/admin/admin-shell.tsx
src/components/admin/assessments/assessment-list.tsx
src/components/admin/assessments/assessment-workspace.tsx
src/components/admin/cms/client.ts
src/components/admin/cms/confirm-dialog.tsx
src/components/admin/cms/content-list.tsx
src/components/admin/cms/country-form.tsx
src/components/admin/cms/destination-form.tsx
src/components/admin/cms/form-kit.tsx
src/components/admin/cms/homepage-form.tsx
src/components/admin/cms/media-library.tsx
src/components/admin/cms/media-picker.tsx
src/components/admin/cms/owner-only-notice.tsx
src/components/admin/cms/preview-banner.tsx
src/components/admin/cms/seo-form.tsx
src/components/admin/cms/service-form.tsx
src/components/admin/cms/settings-form.tsx
src/components/admin/cms/simple-forms.tsx
src/components/admin/cms/slug-field.tsx
src/components/admin/cms/use-save.ts
src/components/assessment/controls.tsx
src/components/assessment/steps.tsx
src/components/assessment/wizard.tsx
src/components/motion/motion-provider.tsx
src/components/motion/page-transition.tsx
src/components/motion/reveal.tsx
src/components/site/cards.tsx
src/components/site/empty-state.tsx
src/components/site/faq-accordion.tsx
src/components/site/legal-page.tsx
src/components/site/logo.tsx
src/components/site/markdown.tsx
src/components/site/mobile-nav.tsx
src/components/site/newsletter-note.tsx
src/components/site/preview-ribbon.tsx
src/components/site/requirement-list.tsx
src/components/site/section.tsx
src/components/site/site-footer.tsx
src/components/site/site-header.tsx
src/components/site/social-icons.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/field.tsx
src/components/ui/skeleton.tsx
src/db/client.ts
src/db/index.ts
src/db/queries/content.ts
src/db/queries/destinations.ts
src/db/queries/index.ts
src/db/queries/media-url.ts
src/db/queries/people.ts
src/db/queries/safe.ts
src/db/queries/seo.ts
src/db/queries/settings.ts
src/db/queries/types.ts
src/db/schema/assessments.ts
src/db/schema/auth.ts
src/db/schema/content.ts
src/db/schema/destinations.ts
src/db/schema/enums.ts
src/db/schema/index.ts
src/db/schema/media.ts
src/db/schema/operations.ts
src/db/schema/people.ts
src/db/schema/settings.ts
src/lib/assessment/admin-handlers.ts
src/lib/assessment/admin.ts
src/lib/assessment/config.ts
src/lib/assessment/cv.ts
src/lib/assessment/draft.ts
src/lib/assessment/manage.ts
src/lib/assessment/reference-number.ts
src/lib/assessment/reference.ts
src/lib/assessment/schema.ts
src/lib/assessment/status.ts
src/lib/assessment/submit.ts
src/lib/assessment/transforms.ts
src/lib/auth/audit.ts
src/lib/auth/config.ts
src/lib/auth/crypto.ts
src/lib/auth/guard.ts
src/lib/auth/password-change.ts
src/lib/auth/password.ts
src/lib/auth/rate-limit.ts
src/lib/auth/service.ts
src/lib/auth/session.ts
src/lib/brand-colors.ts
src/lib/cms/api.ts
src/lib/cms/form-defaults.ts
src/lib/cms/handlers.ts
src/lib/cms/load.ts
src/lib/cms/media.ts
src/lib/cms/preview.ts
src/lib/cms/registry.ts
src/lib/cms/resource-schema.ts
src/lib/cms/resources.ts
src/lib/cms/schemas.ts
src/lib/cms/seo-hints.ts
src/lib/cms/settings.ts
src/lib/cms/write/destinations.ts
src/lib/cms/write/services.ts
src/lib/cms/write/simple.ts
src/lib/config/icons.ts
src/lib/config/site.ts
src/lib/data/countries-iso.ts
src/lib/env.ts
src/lib/files/signatures.ts
src/lib/files/validate.ts
src/lib/storage/blobs.ts
src/lib/storage/index.ts
src/lib/storage/local.ts
src/lib/storage/types.ts
src/lib/utils/cn.ts
src/lib/utils/format.ts
src/lib/utils/metadata.ts
src/lib/utils/reference.ts
src/lib/utils/slug.ts
src/middleware.ts
```

#### Operational source and deployment/verification scripts — `scripts/` (6)

```text
scripts/migrate.ts
scripts/seed-admin.ts
scripts/seed-demo-content.ts
scripts/seed-destinations.ts
scripts/unlock-admin.ts
scripts/verify-schema.ts
```

#### Required configuration and deployment files (13)

```text
.env.example
.gitignore
drizzle.config.ts
drizzle/0000_init.sql
drizzle/meta/0000_snapshot.json
drizzle/meta/_journal.json
eslint.config.mjs
netlify.toml
next.config.ts
package-lock.json
package.json
postcss.config.mjs
tsconfig.json
```

#### Documentation — `docs/` (10)

```text
docs/DEPLOYMENT.md
docs/PHASE-1-PROPOSAL.md
docs/PHASE-1-REPORT.md
docs/PHASE-2-REPORT.md
docs/PHASE-3-REPORT.md
docs/PHASE-4-REPORT.md
docs/PHASE-5-REPORT.md
docs/PHASE-6-REPORT.md
docs/PHASE-7-REPORT.md
docs/PHASE-8-REPORT.md
```

#### Tests and synthetic fixtures — `tests/` (15)

```text
tests/assessment-route.test.ts
tests/assessment-schema.test.ts
tests/assessment-submission.test.ts
tests/assessment-ui.test.ts
tests/brand-colors.test.ts
tests/cms/phase4-cms.test.ts
tests/cms/phase6-assessments.test.ts
tests/files.test.ts
tests/phase2-requirements.test.ts
tests/phase3-auth.test.ts
tests/phase7-audit.test.ts
tests/security.test.ts
tests/storage-driver.test.ts
tests/support/test-stubs.ts
tests/ui-accessibility.test.ts
```

## 9. Authorized access, no-Git workflow, and cost readiness

### Supported access paths investigated

- Arena connector lookups for both **Netlify** and **Turso** returned `unsupported` in this session. The environment exposes local shell/file tools, not a remote deployment runner or secure account console. Native `netlify` and `turso` executables are absent. No staging credentials, site IDs, or URLs were supplied through a secure channel.
- A temporary `netlify-cli@27.16.2` package was run **only for `netlify deploy --help`**, with no authentication and no deployment. Its help confirms that Netlify CLI supports a local build-and-upload workflow, can target a named site via `--site`, can build remotely with `--remote`, and creates a draft deploy by default; `--prod` is a separate option. This is a potential no-Git route in principle, but it needs authorized Netlify authentication, the confirmed separate staging site ID, Netlify API connectivity, and a successful build. The local sandbox is not an authorized remote runner and its network restrictions prevent using this workflow. `--site-name` creates a site and `--allow-anonymous` creates a claimable site; neither was used.
- For Turso, the application needs the staging-only `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` supplied to the staging runtime through a secure secret interface. A separate staging database and token must be created by an authorized Turso organization member using the secure Turso console/CLI workflow. The Turso connector is unsupported here and the CLI is absent, so database identity, permissions, schema, and billing cannot be checked. Do not send credentials in chat.
- No authenticated secure runner is currently available in Arena for either service. Enabling a supported connector or providing a separately authorized runner with staging-only secret injection and permitted network egress is a prerequisite. A GitHub Actions workflow would still need a commit/push and configured secrets; it is not a workaround for the current Git restriction.

### Minimum repository/Git work eventually needed

A **Git-connected** Netlify build requires the application/configuration to be present in a pushed commit. Today the branch HEAD tracks only `README.md`; all 283 project paths in Appendix A are untracked. At minimum, a Git-based deploy requires committing the app source, package manifest/lockfile, Next/Netlify/build configuration, and any required schema/runtime files to the authorized branch, then pushing that branch. The complete project baseline (including tests and docs) should be reviewed before choosing the exact add set. Exclude `.env.local`, `.data/`, `.next/`, `node_modules/`, build caches, local DBs, and secret-bearing files. This would require explicit later approval for staging/add/commit/push; none was performed.

A **local CLI** deploy could avoid Git operations in principle by building from the working tree and uploading to a confirmed staging site with the CLI's local deploy flow. Whether its uploaded input contains every needed untracked path and whether the Netlify edge build succeeds is not verified here. Do not run it without the secure site ID/auth context and explicit cost review. Current Netlify CLI help is not proof that this particular app can be deployed without Git.

### Required access, permissions, and cost review

| Resource | Minimum staging-only access/permissions to request | Cost/plan items not verified |
|---|---|---|
| Netlify | Authorized team/site access to create or use a **separate staging site**, create a draft deploy, view build/function/edge logs, and configure staging-scoped environment variables and Blobs. Prefer the least-privileged site/deploy role available; do not grant production access. | Site/team limits, build minutes, function/edge invocations, bandwidth, and Blobs storage/operations/egress depend on the account plan and usage. No billing view was available. |
| Turso | Authorized access to a **separate staging database**, read-only schema inspection, and a staging-only authentication token with only the access needed for synthetic test writes. | Database plan, storage, compute, read/write usage, and any organization limits are unknown. No billing view was available. |
| Direct-upload storage, if selected | A separate bucket/account and narrowly scoped signing credentials; no storage credential may be exposed to the browser. | This would be an additional service with possible storage, request, transfer, and cleanup-job costs. It has not been selected or approved. |

No staging resources were created because account plans, charges, and required permissions cannot be inspected here and the user requires a cost checkpoint first. The current explicit **no migrations** boundary also means a staging DB must be supplied with the matching schema already present; if it is empty, stop and request separate authorization before any staging migration. No production migration is authorized.

### Readiness decision / stop

**Staging remains blocked before resource creation.** No staging site name/URL, Turso database identity, hosted environment variables, or secure runner is available. The candidate no-Git Netlify CLI workflow is supported by CLI help but cannot be executed in this Arena session. The Git-connected alternative requires Git operations that are expressly prohibited. No costs have been incurred and no production or staging resource was touched. Present the staging plan and cost requirements; wait for approval and secure staging access before proceeding.

---

## 10. Isolated staging deployment and verification attempt (5 November 2026)

> **This section is appended after, and preserves in full, the readiness audit, the completion matrix, and the 283-path Appendix A above.** It records the authorized attempt to perform isolated staging deployment and verification. Headline: **staging verification is BLOCKED before deployment.** No staging or production resource was created, connected, configured, or modified; no deployment, migration, hosted test, admin provisioning, resource cost, Git operation, or production access occurred. No security control was weakened. Nothing in §§1–9 or Appendix A is superseded except where this section explicitly updates a factual finding.

### 10.1 Repository baseline re-verified before any action

Verified on the working branch before touching anything (read-only Git/file checks):

| Check | Result |
|---|---|
| Branch | `arena/cdcb43ad-immi-website` (unchanged; no branch switch) |
| HEAD | `bc53028b18b4ad9f8f2391b816a872973cbae457` (unchanged) |
| Tracked files | 1 (`README.md` only) |
| Untracked paths | 283 (unchanged) |
| Staged changes | none (the 283 files were **not** staged) |
| Modified tracked files | none |
| Protected hashes | `.data/local.db` = `7c16…ff3`, `.data/secret-markers.json` = `2e56…47d0` — both unchanged |
| Appendix A vs. working tree | **Exact match 283/283**; zero paths missing, zero extra |
| Git operations performed | none (no add/commit/push/reset/history rewrite) |

The 283-path audit and Appendix A remain intact and unmodified. Protected local database and secret-marker files were not opened, moved, or overwritten. No source file was hidden or removed.

### 10.2 Staging configuration gate — required information and its availability

The authorization requires separate staging resources and staging-only secrets. §2 of the instruction is a hard gate: establish availability first, guess nothing, substitute nothing. Verified presence of every required item (values were never printed; only variable *names* and *presence* were checked):

| Required staging-only item | Available here? |
|---|---|
| Netlify staging site ID | **No.** No site ID in env, no `.netlify/state.json`, no linked-site config (CLI `config.json` contains only `cliId`, `telemetryDisabled`). |
| Netlify staging site URL | **No.** No staging hostname provided. |
| Netlify staging deployment authentication | **No.** Environment contains only GitHub tokens (`GH_TOKEN`, `GITHUB_TOKEN`) and E2B sandbox variables; no Netlify auth token or deploy credential exists. |
| Turso staging database URL | **No.** No `libsql://…` staging URL in env/config. |
| Turso staging database authentication token | **No.** |
| Required staging environment variables | **No.** None of `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `STORAGE_DRIVER`, `NEXT_PUBLIC_SITE_URL`, or any staging-scoped variable is set. |
| Confirmation resources are separate from production | **No.** No staging or production resource was identified or supplied, so separation cannot be confirmed. |

Supporting checks:
- Arena connector lookups for **Netlify** and **Turso** both returned `unsupported`.
- **No secure environment-variable / secret interface is exposed in this session.** The full environment-variable name list is only `E2B_*`, `GH_TOKEN`, `GITHUB_TOKEN`, `GIT_TERMINAL_PROMPT`, and standard shell variables. No `/run/secrets` mount, no secret manager, no Netlify/Turso CLI auth state.
- **All deploy-target hosts are egress-blocked.** From this sandbox, `api.netlify.com`, `app.netlify.com`, `api.turso.tech`, `turso.io`, `edge.netlify.com`, `dl.deno.land`, `deno.land`, and `v1-7-0--edge-utils.netlify.app` all fail (TLS connect error, curl rc 35 / ECONNRESET), while allowlisted hosts (`registry.npmjs.org`, `api.github.com`) return HTTP 200. The sandbox permits egress only to `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`.

**Conclusion:** none of the seven required staging items is available, there is no channel to inject them securely, and deploy commands could not reach Netlify/Turso even with credentials. Deployment and all staging verification are therefore **blocked**; no identifier was guessed and no production value was substituted.

### 10.3 Cost / approval checkpoint (no cost incurred)

No potentially billable resource was created, so no cost was triggered and no cost approval was needed for this attempt. Before any future resource creation, the following remain **unverified and require owner confirmation** (no billing view is accessible here): Netlify site/team limits, build minutes, Functions compute (credit-based GB-hour or legacy per-request), Edge invocations, bandwidth, and Blobs storage/operations/egress; Turso database plan, storage, compute, and read/write limits; and any separate object-storage or scheduled-cleanup cost if a direct-upload service is approved. Functions region is a Pro/Enterprise feature on Netlify. Creating staging resources, and any architecture change that adds a paid service, requires separate approval.

### 10.4 Netlify edge-function build issue — RESOLVED (verified locally)

Previously reported: offline `netlify build --offline` failed packaging `___netlify-edge-handler-src-middleware` with `fetch failed`; the failing URL was unknown. Investigation now establishes the exact cause.

- **What the failing function is.** `___netlify-edge-handler-src-middleware` is the **Next.js Middleware Handler** edge function generated by `@netlify/plugin-nextjs@5.16.6` using `@netlify/edge-bundler@16.2.0` from `src/middleware.ts`.
- **The remote Deno URLs are NOT the failing fetch.** The generated `edge-runtime/vendor.ts` lists 16 remote imports (`deno.land/std@0.175.0`, `deno.land/x/path_to_regexp@v6.2.1`, `deno.land/x/htmlrewriter@v1.0.0`, `v1-7-0--edge-utils.netlify.app/logger/mod.ts`). These are a *seed* for a **pre-vendored** `vendor/` directory that is shipped with the runtime: the generated `edge-runtime/README.md` states these dependencies are "pulled in ahead of time to avoid a build time dependency on any package registry." The generated edge runtime contains a populated `vendor/` tree (149 files), and the emitted handler `.js` contains **zero** remote `https://` imports. These modules are resolved from local vendored copies via an import map, so they do not require network access at build time.
- **The exact failing dependency/URL.** `@netlify/edge-bundler@16.2.0` needs a **Deno CLI binary** to bundle edge functions. With `useGlobal` on and no global/cached Deno present (the `deno-cli` cache is empty; no `deno` binary exists), `DenoBridge.getRemoteBinary()` calls `downloader.js`: `getLatestVersion()` fetches `https://dl.deno.land/release-latest.txt` (its failure is swallowed, so it falls back to the minimum satisfying version for range `^2.4.2`, i.e. 2.4.2), then `downloadVersion()` executes `fetch('https://dl.deno.land/release/v2.4.2/deno-x86_64-unknown-linux-gnu.zip')`. **That fetch is the `fetch failed`.** I reproduced it directly by invoking the edge-bundler downloader: it produced the identical `TypeError: fetch failed` with `cause: ECONNRESET` and the same 4-attempt `p-retry` pattern ("Deno download with retry failed"). The CLI's separate "could not fetch latest plugins list" warning is the same egress restriction on a different Netlify host, and is benign.
- **Restricted network vs. compatibility — restricted network.** Every `dl.deno.land`, `deno.land`, `edge.netlify.com`, `api.netlify.com`, and `edge-utils.netlify.app` URL fails with ECONNRESET / TLS error 35, while allowlisted hosts succeed. This is a sandbox egress restriction, **not** an application, middleware, Next.js, or plugin incompatibility and **not** a Deno-module resolution problem.
- **Hosted compatibility — compatible in principle; hosted build still not verified.** The edge-bundler source comments that the Deno version must match the one on Netlify's `netlify/buildbot` build image, i.e. hosted Netlify **pre-installs a compatible global Deno**. `getGlobalBinary()` therefore finds a satisfying global `deno` and **skips the download entirely** on the hosted build; combined with the pre-vendored modules, the network fetches that fail here do not occur on Netlify. Local Next.js build and Node-function bundling already passed. This is strong evidence of compatibility, but a hosted build has not been run, so hosted packaging/behavior remains **Not verified** rather than confirmed.
- **Middleware security intact.** Read-only inspection of `src/middleware.ts` confirms all controls present and unmodified: production HTTPS redirect (`x-forwarded-proto` → 308), per-request CSP nonce with `strict-dynamic` and `frame-ancestors 'none'`, `X-Robots-Tag noindex…` for `/admin`, `/assessment/success`, `/api`, `Cache-Control: no-store` for admin/API, the cheap admin session-cookie pre-filter, and the protocol-relative redirect guard. `netlify.toml` also retains HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy`. **No security behavior was removed or weakened.** Status: documented as a **local environment limitation, not a deployment blocker**; confirm with one hosted staging build + edge-function log when resources exist.

### 10.5 Video-upload risk — RESOLVED as a documented blocker (verified locally; resolution requires approval)

- **Actual platform constraint (corrected).** Official Netlify Functions configuration docs state a **6 MB buffered request/response payload** limit that is **not configurable** (streamed *response* is 20 MB; that does not raise request-body ingress). Binary payloads such as uploads are Base64-encoded, adding ~30% overhead, so the **effective binary request ceiling is ≈4.5 MB**. This is *lower* than the "16 MB function payload ceiling" recorded in Phase 5 (§9 of that report); the 16 MB figure is outdated. Sources: Netlify "Configuration for functions" and "Functions usage and billing" (docs.netlify.com/build/functions/configuration, /usage-and-billing), the Netlify support answer on the 6 MB limit (answers.netlify.com/t/what-is-the-maximum-file-size-upload-limit-in-a-netlify-form-submission/108419), and the Netlify knowledge-base Blobs article.
- **Installed SDK capability.** `@netlify/blobs@11.1.7` exposes server-side `getStore(...).set(key, ArrayBuffer | Blob | string, …)`, `get*`, `getMetadata`, `delete`, `list`. Its internal `application/json;type=signed-url` mechanism (`SIGNED_URL_ACCEPT_HEADER`) is used by the *server client* to transmit a body the Function **already holds in memory**; it is a server-to-Blobs transport detail, **not** a browser presigned-upload primitive. Official Netlify Blobs docs describe CRUD only from Functions/Edge/Build Plugins/CLI and describe an "endpoint to receive an upload, validate, and persist" — i.e. bytes pass through the Function. Independent references confirm Netlify Blobs has **no native client/presigned or resumable upload** ("signedUploadUrl ❌ no presigned upload primitive"). Blobs' 5 GB per-object ceiling is irrelevant because the ingress ceiling is the Function request body.
- **Current code path (unchanged).** `POST /api/admin/cms/media` → role/CSRF guard → `request.formData()` → `File.arrayBuffer()` → `validateUpload()` → `storage.put()` → Blobs `store.set()`. The route's own `MAX_REQUEST_BYTES` is 100 MiB; `MAX_UPLOAD_BYTES.video` is 100 MiB, `image` 8 MB, `document` 10 MB. The whole multipart request is buffered inside a Netlify Function before any Blobs call. Therefore a 100 MiB video **cannot** be accepted under the documented ingress ceiling; uploads between ~4.5–6 MB and the app's own 8/10/100 MB limits would be rejected by the platform with an opaque error before the app's clear validation message. `store.set()` does not bypass ingress limits.
- **Secure, supported resolution — not implementable without approval.** No limit or architecture was changed. Two viable paths, both **requiring separate approval**:
  - **(a) Reduce the accepted limits** to a ceiling safely below the effective binary request ceiling, accounting for multipart + Base64 overhead (this changes the 100 MiB feature and the 8/10 MB tiers, so it needs product approval; it does not add cost).
  - **(b) Add a separately evaluated object-storage/direct-upload service** (e.g. an S3-compatible store with genuinely supported short-lived scoped presigned uploads) so bytes bypass the Function. Requires cost/security approval and a reviewed design: server-issued single-use scoped authorization bound to a generated key and byte ceiling, a private quarantine/untrusted stage, trusted server-side size + MIME + magic-byte validation *before* publication, strict `immi-public`/`immi-private` separation, replay/unauthorized-write prevention, expiry/orphan cleanup on failure or abandonment, and no storage credential ever exposed to the browser. This must **not** be an unsupported/hand-rolled presigned scheme against Blobs.
  - Netlify's own "prepare_upload → PUT → finalize_upload" pattern still routes the PUT through a Netlify Function/endpoint and so does **not** bypass the ingress ceiling; it is not a fix on its own.
- Preserved in the current code and to be preserved in any redesign: server-side validation, MIME + magic-byte verification, size enforcement measured from received bytes, public/private store separation, role/CSRF/access restrictions, and orphan cleanup on DB-row failure. **No upload limit was increased and no presigned implementation was introduced.**

### 10.6 Staging database preparation — BLOCKED

No separate Turso staging database was supplied, so no staging schema could be inspected and no comparison could be made. No migration was run against staging or production (production migration is prohibited; a staging migration would require the §6 inspection + non-destructive confirmation + separate approval). Recorded locally as the **expected-schema baseline** for a future comparison (read-only, from repository files): `drizzle/0000_init.sql` defines **33 tables, 61 indexes, 47 foreign keys**; the Drizzle journal (`drizzle/meta/_journal.json`) has a single entry `0000_init` (version 7, dialect `sqlite`); `drizzle.config.ts` targets Turso when credentials exist and a local throwaway file otherwise; `db:migrate` is an explicit CLI command, not a build hook. Expected tables include `admins`, `admin_sessions`, `admin_password_resets`, `media_assets`, `assessments`, `assessment_attachments`, `assessment_notes`, `assessment_status_history`, `consent_records`, `activity_logs`, `login_attempts`, `rate_limit_buckets`, the applicant child tables, and the CMS/content tables. **Migration conflicts, missing columns/tables/indexes, migration history, and "will not overwrite existing staging data" are Not verified** until a staging DB is provided for a read-only comparison. If a supplied staging DB is empty or drifted, stop and request explicit approval for a non-destructive staging migration before executing anything.

### 10.7 Deployment method — not executed

- Intended method: a **no-Git** Netlify CLI local/draft deploy that explicitly targets a **separate staging site** (`--site <staging-site-id>`, draft by default; `--prod` never used), with staging-only variables injected through the site's secure environment-variable UI, pointing at the separate staging Turso DB. A Git-connected deploy would require committing/pushing the 283 untracked files, which is prohibited; it was not used.
- Why it could not run: no staging site ID/URL, no deploy auth, no Turso staging URL/token, no staging variables, no confirmation of production separation, connectors `unsupported`, no secret interface, and blocked egress to every Netlify/Turso host. Per the instruction, because the safe no-Git method cannot deploy the existing working tree here, **stop and report** rather than improvise. No workaround, no commit/push, no restructuring was attempted.

### 10.8 Verification results — five-way status classification

Legend: **(1) Verified locally**, **(2) Verified on staging**, **(3) Not verified**, **(4) Blocked** (cannot be attempted: missing resources/access), **(5) Requires further approval** (before it may be done).

| Area / check | Status | Note |
|---|---|---|
| Branch, HEAD, 283-path audit, protected hashes | **(1) Verified locally** | Exact 283/283 match; no Git ops. |
| Edge-function root cause (Deno binary download, ECONNRESET) | **(1) Verified locally** | Reproduced directly; see §10.4. |
| Middleware/header security controls intact | **(1) Verified locally** | Source read-only; unchanged. |
| Official Function payload ceiling (6 MB / ≈4.5 MB binary) & Blobs no-direct-upload | **(1) Verified locally** | Official docs + installed SDK source. |
| Expected schema baseline (33 tables / 61 indexes / 47 FKs / 1 migration) | **(1) Verified locally** | Repository files only. |
| Local typecheck/lint/tests/schema/Drizzle/audits/credential-free build | **(1) Verified locally (prior Phase 8 §5)** | Source unchanged since; not re-run this attempt. |
| Hosted Netlify build + edge packaging + function/edge logs | **(3) Not verified** / **(4) Blocked** | No staging site. |
| Staging Netlify site ID & URL | **(4) Blocked** | Recorded as **not provided**; no secrets recorded. |
| Staging Turso database identifier | **(4) Blocked** | Recorded as **not provided**; no credentials recorded. |
| Deployment method executed / build result on staging | **(4) Blocked** | None executed; no staging build result exists. |
| Staging schema inspection, comparison, migration conflicts, non-destructive confirmation | **(4) Blocked**; any migration **(5) Requires approval** | No staging DB. |
| Homepage & navigation; services & destination pages; contact; assessment wizard; responsive layouts; mobile nav; logo/media rendering | **(4) Blocked** | No hosted site. |
| Synthetic assessment submission, validation, unique reference, confirmation page, consent version + timestamp, private CV storage & access restrictions | **(4) Blocked** | No hosted site/storage. |
| Admin login/logout, session & CSRF, dashboard & CMS, assessment inbox/detail, status updates & internal notes, secure CV download, activity logging, draft-preview restrictions | **(4) Blocked** | No hosted site; no staging admin provisioned. |
| Staging DB connectivity; staging storage connectivity; env var configuration; function/edge logs; no production references; error handling & security headers | **(4) Blocked** | No hosted environment. |
| Video-upload 100 MiB workflow | **(4) Blocked** and **(5) Requires approval** | Incompatible with documented ingress ceiling; architecture/limit decision pending. |
| Creating staging resources (cost) | **(5) Requires approval** | Cost categories in §10.3; no cost incurred. |
| Staging DB migration, if DB is empty/drifted | **(5) Requires approval** | Non-destructive plan + comparison first. |
| Production deploy / migration / admin / Git commit / push | **Prohibited** | Not attempted. |

### 10.9 Security verification results

- **Verified locally:** middleware HTTPS/CSP/no-index/no-store/admin-redirect controls present; `netlify.toml` edge headers present; separate `immi-public`/`immi-private` Blobs stores in source; server-side size + MIME + magic-byte validation; public media proxy filters `visibility='public'`; private CV route is session/role-guarded, audited, `no-store`, attachment disposition, sandbox CSP; production storage selection fails closed unless `STORAGE_DRIVER=blobs`; no secret values printed, logged, or stored in these reports; `.data/local.db` and `.data/secret-markers.json` hashes unchanged.
- **Not verified / Blocked on staging:** secure-cookie/HTTPS behavior in a real deploy, effective merged response headers, CSRF/session in hosted runtime, hosted Blobs public/private separation and private-download denial paths, storage-failure handling, and function/edge log review. No production resource was accessed; no production administrator was provisioned; no real applicant data was used.

### 10.10 Completion conditions and final verdict

Phase 8 is **not complete.** §9 requires staging deployment, database, storage, public site, admin portal, assessment workflow, security controls, and outstanding deployment risks to be *tested and documented*. None of the hosted tests were possible. A build or deploy alone would not satisfy this. **Staging is NOT safe for further testing yet** because no isolated staging environment exists, no staging-only credentials or secure secret channel are available, secure separation from production cannot be confirmed, deploy egress is blocked, and the video-upload path is incompatible with the documented platform ceiling.

**What succeeded:** repository baseline re-verified intact (283/283, hashes unchanged, no Git/protected-file changes); edge-function failure root-caused definitively as a sandbox egress restriction (Deno CLI binary download) with hosted compatibility indicated and middleware security confirmed intact; video-upload risk quantified against current official limits and the installed Blobs SDK; expected-schema baseline documented; both required docs updated; no cost incurred; no prohibited action taken.
**What failed:** nothing failed at runtime — no deploy was attempted because the prerequisites are absent.
**What remains blocked:** every hosted/staging activity (site/URL/ID, DB identity, deployment, all browser/admin/assessment/infrastructure verification, hosted build and logs) plus staging schema comparison.
**What requires approval / exactly what is needed:**
1. A supported, authorized **secure staging integration/runner** (supported Netlify & Turso connectors, or an external runner with CLI + permitted egress) that can inject **staging-only** secrets through a secure environment-variable interface — never in chat. Specifically needed, non-secret identifiers may be recorded in docs, secrets must not: separate Netlify **staging site ID + URL**, staging deploy auth, separate Turso **staging database URL/identifier** + staging auth token, staging-scoped `SESSION_SECRET`, `STORAGE_DRIVER=blobs`, `NEXT_PUBLIC_SITE_URL`, and written confirmation that these resources are separate from production.
2. **Cost** confirmation for the account plan items in §10.3 before creating any billable staging resource.
3. A decision on the **video-upload** path — approve (a) a reduced, platform-safe size ceiling, or (b) a separately evaluated direct-upload storage service with the security design in §10.5 — before any architecture change or new paid service.
4. **Staging migration** approval only if the supplied staging DB is empty/drifted, after a read-only schema comparison and a documented non-destructive plan.
5. Separate approval for any **staging admin** provisioning (staging-only account, fresh staging-only credentials), if required.

**Stop point:** after this report. No production deployment, production migration, production administrator provisioning, Git commit, or Git push was performed or attempted. Await secure staging access and the approvals above, then repeat §10.4's single hosted build/edge-log check and the §10.8 staged verification with synthetic data only.

## 11. Controlled next steps — storage evaluation and staging readiness (5 November 2026)

### 11.0 Scope, authorization, and status of this section

The active authorization for this turn is **investigation, documentation, planning, and staging-readiness preparation only**. This section replaces the earlier authorization that had permitted a staging deployment attempt: **no staging deployment is authorized now**. Option B (a separate object-storage service with secure, short-lived, scoped upload authorization) is authorized **for evaluation only**.

Status at the end of this section:

- **No provider has been selected, approved, or implemented.** No storage account, bucket, object, API token, subscription, or billable resource was created. No new paid service was introduced. No source file, upload limit, storage driver, dependency, or configuration was changed.
- **No staging or production resource was accessed, modified, deployed, or verified.** No database migration was run. No Git staging, commit, push, or branch operation was performed.
- Staging remains **unverified**. Phase 8 remains **not complete**. The stop point in §10.10 still applies: every hosted activity is blocked.
- GitHub commit and push remain gated on **successful staging verification plus a separate explicit approval**.
- All prices below are **published list prices from official provider pages read on 5 November 2026**, converted where needed; they are estimates, not quotes. **No provider is assumed to be free**: every "free tier" is a capped, conditional monthly allowance attached to a billing account, and no billing relationship was established during this evaluation.

### 11.1 Workstream A — object-storage provider evaluation

Five options were evaluated against the required security architecture. Three are technically suitable; two are marked **unsuitable** with documented reasons.

#### 11.1.1 Suitability verdicts

| # | Provider | Verdict | One-line reason |
|---|---|---|---|
| 1 | **Amazon S3** (S3 Standard) | **Technically suitable — recommended** | Only evaluated provider with a documented, server-enforced size ceiling inside the upload authorization (`content-length-range` presigned POST policy), plus native malware scanning, lifecycle cleanup, conditional writes, and mature access controls. |
| 2 | **Cloudflare R2** | **Technically suitable, conditionally** | S3-compatible presigned PUT and very short-lived scoped temporary credentials; zero egress; lifecycle rules. **No presigned POST and no documented `content-length-range`** → the size bound at authorization time must be verified in staging; malware scanning must come from an external service. |
| 3 | **Backblaze B2** | **Technically suitable, conditionally** | S3-compatible presigned PUT, strong least-privilege application keys (bucket / prefix / capability / expiry), lifecycle rules. **No presigned POST** → same size-bound verification gate and external scanning requirement as R2. |
| 4 | **Wasabi Hot Cloud Storage** | **Unsuitable for this project** | S3-compatible, but pay-as-you-go has a **1 TB minimum monthly charge** and a **90-day minimum storage duration**: deleted/expired quarantine objects still incur "timed deleted storage" charges. That directly conflicts with the required "failed, expired and abandoned uploads are cleaned up safely" step and with a small staging footprint. Only a time/volume-limited trial exists; there is no standing free tier. |
| 5 | **Netlify Blobs** (current implementation) | **Unsuitable** | Already established in §10.5: `@netlify/blobs@11.1.7` exposes **no supported browser presigned-upload primitive**; official docs describe receiving the upload in a Function/Edge, validating, then persisting. That keeps the file inside the 6 MB buffered Function ceiling, which is the problem Option B must solve. Its internal `SIGNED_URL_ACCEPT_HEADER` is server-side transport after body receipt, not a browser upload grant. |

A sixth option, **Vercel Blob**, was considered and excluded at the shortlist stage: it is a competing-platform managed blob service rather than an S3-compatible object store, and its client-upload token model does not provide the required size-scoped presigned policy. It was not taken forward to full comparison.

#### 11.1.2 Comparison matrix

| Dimension | Amazon S3 | Cloudflare R2 | Backblaze B2 | Wasabi |
|---|---|---|---|---|
| **Netlify integration** | None first-party. Connect from a Netlify Function with `@aws-sdk/client-s3` + presign helpers; credentials as Netlify environment variables with **Functions** scope. Requires a new dependency, CORS rules, and CSP `connect-src` change. | Same pattern; `endpoint` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `region: "auto"`. Presigned URLs work on the S3 API domain, **not** custom domains. | Same pattern; `endpoint` derived from the bucket's cluster code, e.g. `https://s3.<region>.backblazeb2.com`. | Same pattern, but minimum billing makes a Netlify staging site uneconomic. |
| **S3-compatible API** | Native S3 API (the reference implementation); full SDK support. | Yes (SigV4); documented gaps include no POST policy and no bucket versioning. | Yes (SigV4); also a B2 Native API with its own upload URLs. | Yes (SigV4). |
| **Short-lived scoped upload authorization** | **Presigned POST** with an exact `key`, `bucket`, `Content-Type`, `success_action_status`, SSE field and **`content-length-range`**; expiry is embedded in the policy (e.g. 300–900 s). Also presigned PUT (up to 7 days with IAM-user credentials) and SigV4 signed headers/checksums. `s3:signatureAge` bucket-policy condition can deny stale signatures. | **Presigned PUT** for `GET/HEAD/PUT/DELETE` only; expiry **1 s – 7 days**; `Content-Type` can be signed into the signature (mismatch → `403 SignatureDoesNotMatch`); CORS required for browser use. **Temporary credentials** scoped to one bucket, a set of actions (`PutObject`, multipart actions), and exact object paths/prefixes with a short TTL. `POST` is explicitly unsupported. | **Presigned PUT** with a short expiry; B2 Native `b2_get_upload_url` returns an upload URL/token (documented as bucket-scoped, up to 24 h) — too broad for the grant, so the S3-compatible presigned PUT is the correct mechanism. Application keys support `validDurationSeconds`, `namePrefix`, bucket restriction and capability sets. Presigned POST is unsupported. | Presigned URLs available; no documented size-scoped policy. |
| **Maximum object size / multipart** | Single PUT **5 GiB**; multipart **5 MiB – 5 TB**, up to 10,000 parts; AWS recommends multipart ≥ 100 MB; `If-None-Match` conditional writes prevent overwriting an existing key; incomplete multipart parts are billed until aborted. | Single upload **5 GiB**; max object **5 TiB**; multipart up to **4.995 TiB** / 10,000 parts. | Single upload **5 GB**; larger files split into **5 MB – 5 GB** parts via S3 multipart or B2 Native large-file API; unfinished large files are listable and deletable. | S3-compatible multipart; per-object 90-day minimum retention applies even to parts/quarantine objects. |
| **Storage price (list)** | **$0.023 / GB-month** (S3 Standard, first 50 TB, us-east-1). | **$0.015 / GB-month** (Standard); $0.01 / GB-month (Infrequent Access, 30-day minimum, $0.01/GB retrieval). | **$6.95 / TB-month** = **$0.00695 / GB-month**; B2 Overdrive $15 / TB-month with a multi-PB commitment. | **$7.99 / TB-month** but billed at a **1 TB minimum**. |
| **Egress / bandwidth price (list)** | **$0.09 / GB** after 100 GB/month free (region-dependent); CloudFront adds its own pricing. | **$0** — no egress fees (across S3 API, `r2.dev` and Workers). `r2.dev` is rate-limited and not for production; custom domains recommended. | **Free up to 3× monthly average storage**, then **$0.01 / GB**; ingress is free. | No egress fee while monthly egress ≤ active storage (fair-use policy); ingress free. |
| **API request price (list)** | **$0.005 / 1,000** PUT/COPY/POST/LIST; **$0.0004 / 1,000** GET; lifecycle transitions billed. | **$4.50 / million Class A** (writes, multipart, list); **$0.36 / million Class B** (reads). `DeleteObject`, `DeleteBucket`, `AbortMultipartUpload` are **free** — favourable for cleanup. | **Class A (PutObject, multipart, deletes), Class B (GetObject, HeadObject) and Class C (list, copy) are free**; Class D (event notifications) 2,500/day free then **$0.004 / 10,000**. | No API request fees. |
| **Free allowances & billing conditions** | 12-month free tier: 5 GB Standard storage, 20,000 GET, 2,000 PUT, 100 GB egress/month; conditional on account age and region. Not a free service. | Monthly allowance: **10 GB-month storage, 1 M Class A, 10 M Class B**, free egress; Infrequent Access has **no free tier**. Allowance is per account/month, not unlimited. | **First 10 GB always free**, free ingest, free Class A/B/C, 2,500 free Class D/day; storage above 10 GB and egress above 3× storage are billed. Data caps and alerts are configurable. | No standing free tier; a limited trial (100 GB / 30 days for a company-domain account, 10 GB / 14 days for free-mail). **1 TB minimum monthly charge regardless of usage.** |
| **Geographic availability** | Many commercial AWS Regions worldwide; region is chosen at bucket creation (data residency). | Global "automatic" placement with location hints; **immutable jurisdictions `eu`, `us`, `fedramp`** via a jurisdiction-specific endpoint, for data-residency requirements. | Region chosen at bucket creation: **US West, US East, EU Central** (cluster codes e.g. `us-west-002`, `us-east-005`, `eu-central-003`). | Multiple regions (secondary sources report 12–16; not independently verified here). |
| **Data protection / access control** | Block Public Access, SSE-S3 / SSE-KMS, Object Lock + legal hold, versioning, IAM policies, STS scoped temporary credentials, `s3:signatureAge` denial, checksums, **GuardDuty Malware Protection for S3** (native managed scanning), bucket policies/access points, CloudFront OAC for private-origin delivery. | Private buckets by default; server-side encryption; **jurisdictional restrictions**; R2 API tokens with permission groups; **temporary credentials** scoped to bucket + actions + exact object paths; CORS; public buckets via custom domain; WAF HMAC validation for custom-domain auth (Pro plan+). | **Application keys** with `writeFiles` / `deleteFiles` / `readFiles` / `shareFiles` capabilities, single-bucket and `namePrefix` restrictions and `validDurationSeconds` expiry; Object Lock/legal hold; **SSE-B2 / SSE-C**; CORS rules; bucket access logs; data caps/alerts. | Object Lock/WORM, SSE, immutability; 90-day minimum retention. |
| **Server-side validation workflow** | **Best fit**: the POST policy enforces an upper byte bound *before* S3 accepts the body; presigned PUT can additionally sign `Content-Length` and checksum headers. Finalization still re-measures `Content-Length` via `HeadObject` and inspects the bytes. | Presigned PUT can sign headers (`Content-Type` documented; `Content-Length` via SigV4 signed headers is **not** documented by Cloudflare for size enforcement → staging verification gate). Finalization must measure and validate. | Same as R2. B2 Native `b2_get_upload_url` + one-time upload tokens are an alternative but are bucket-scoped, so S3-compatible presigned PUT is preferred. | Same as R2, plus 90-day retention makes rejected quarantine objects billable. |
| **Cleanup of abandoned uploads** | Lifecycle `Expiration` on a `quarantine/` prefix + `AbortIncompleteMultipartUpload` (e.g. 1 day); explicit delete on rejection/finalization; CloudWatch/EventBridge reconciliation. | Official lifecycle rules: prefix-scoped `Expiration` and `AbortIncompleteMultipartUpload` (default 7 days, can be set to 1 day); deletions typically within 24 h; **delete/abort operations free**. | Lifecycle rules by `fileNamePrefix` (`daysFromUploadingToHiding`, `daysFromHidingToDeleting`); unfinished large files can be listed and deleted; deletes are free Class A. | Lifecycle deletion does **not** stop billing for 90 days — unsuitable for churn-heavy quarantine. |
| **Operational complexity / maintenance** | **Highest**: IAM roles/policies, bucket policies, CORS, lifecycle, KMS keys, CloudFront/OAC, GuardDuty, cost alerts, SDK version updates, key rotation. Strongest documentation and broadest tooling. | **Lowest**: single dashboard/API token, no egress bill, free deletes, lifecycle rules. But requires an external malware scanner and a CDN/custom domain for public delivery; jurisdiction is immutable, so it must be decided at creation. | **Low–medium**: application keys and lifecycle rules are simple; region code must be wired into the endpoint; external scanner and CDN needed; version-hiding semantics must be understood. | **High for this use case**: minimum commitments, retention accounting, and fair-use egress policy to monitor. |

#### 11.1.3 Critical documented limitation: size-scoped authorization

The required architecture states that the authorization must be "short-lived and restricted to the specific object, permitted method **and size**". Two distinct enforcement layers exist:

1. **At the storage provider, before any bytes are accepted.** Only **Amazon S3** documents this: a presigned **POST** policy carrying `["content-length-range", min, max]` is evaluated by S3 itself, so an oversized upload is rejected before it consumes storage. A plain presigned **PUT** does not constrain size — `ContentType` passed to `getSignedUrl` is advisory and a client can override it unless the header is explicitly signed; `Content-Length` signing is a SigV4 technique with documented behaviour on S3.
2. **At the application, on finalization.** Every candidate supports this: the finalization endpoint re-measures actual bytes with `HeadObject`/`GetObject`, applies `MAX_UPLOAD_BYTES`, and deletes anything out of bounds. This is mandatory regardless of provider (step 6–8 below).

**R2 and B2 do not support presigned POST** (Cloudflare's official page states "`POST` (multipart form uploads via HTML forms) is not currently supported"; Backblaze's S3-compatible API likewise has no POST policy). They are therefore **conditionally suitable**: they satisfy short-lived, object-scoped, method-scoped authorization and all finalization/cleanup requirements, but the *authorization-layer* size bound would have to be implemented via SigV4-signed `Content-Length` headers and **verified in a real hosted staging test** before approval. If that verification fails, or if the strict reading of "size-scoped authorization" is mandatory, **R2 and B2 must be marked unsuitable and Amazon S3 becomes the sole suitable option**. This is recorded as an open uncertainty in §11.4 and an explicit approval item in §11.5. No unsupported presigned-upload workaround was introduced or is proposed.

#### 11.1.4 Official documentation references

All URLs below are provider/platform official documentation or official pricing pages read during this evaluation (5 November 2026).

| Provider | Official references |
|---|---|
| Netlify (platform constraints) | `https://docs.netlify.com/build/functions/configuration.md` (6 MB buffered request/response, 20 MB streamed response, 60 s synchronous / 15 min background, 1024 MB memory, limits not configurable); `https://docs.netlify.com/build/functions/overview/`; `https://docs.netlify.com/build/data-and-storage/netlify-blobs/`; `https://docs.netlify.com/build/functions/environment-variables/` (Functions scope, secrets, `netlify.toml` variables not available to functions); `https://docs.netlify.com/build/edge-functions/environment-variables/`; `https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/` (`env:set --context --scope`, deploy contexts). |
| Amazon S3 | `https://aws.amazon.com/s3/pricing/` ("Pay only for what you use. There is no minimum charge."; storage/request/data-transfer components; minimum-duration notes); `https://aws.amazon.com/s3/faqs/` (object 0–50 TB, 5 GB single PUT, multipart ≥100 MB, lifecycle policy to expire incomplete multipart uploads); `https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html` (5 GB single PUT, 5 TB multipart, conditional writes to prevent identical-key overwrites); `https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.md` (multipart process, 10,000 parts, parts billed until complete/abort, checksums); `https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.md` (presigned URLs are bearer tokens, 7-day max with IAM-user credentials, `s3:signatureAge` policy condition, SigV4 checksums); `https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html` (POST policy conditions incl. `content-length-range` — the HTML page returned a cookie/consent interstitial on fetch; the condition is also documented in the AWS SDK `@aws-sdk/s3-presigned-post` API and AWS repost answers, so verify the page directly before implementation); `https://aws.amazon.com/guardduty/pricing/` (Malware Protection for S3 — see uncertainty in §11.4). |
| Cloudflare R2 | `https://developers.cloudflare.com/r2/pricing/`; `https://developers.cloudflare.com/r2/platform/limits/` (5 TiB object, 5 GiB single upload, 4.995 TiB multipart, 10,000 parts, `r2.dev` not for production); `https://developers.cloudflare.com/r2/api/s3/presigned-urls/` (GET/HEAD/PUT/DELETE, 1 s – 7 d expiry, Content-Type signing, CORS, POST unsupported, bearer-token warning, custom-domain limitation); `https://developers.cloudflare.com/r2/api/s3/temporary-credentials/` (bucket + action + exact-object-path scoping, short TTL, parent-token revocation, "never ship your parent secret access key to a client"); `https://developers.cloudflare.com/r2/buckets/object-lifecycles/` (prefix rules, `Expiration`, `AbortIncompleteMultipartUpload` default 7 days/1 day example, deletes within ~24 h); `https://developers.cloudflare.com/r2/reference/data-location/` (jurisdictions `eu`/`us`/`fedramp`, immutable after bucket creation). |
| Backblaze B2 | `https://www.backblaze.com/cloud-storage/pricing` ($6.95/TB-month, 10 GB free, 3× free egress, no minimum file size/duration); `https://www.backblaze.com/cloud-storage/transaction-pricing` (Class A/B/C free, Class D 2,500/day free then $0.004/10,000, `$0.00695/GB/month` above 10 GB, free ingress); `https://www.backblaze.com/docs/cloud-storage-application-keys` and `.../cloud-storage-application-key-capabilities` (capabilities, `bucketIds`, `namePrefix`, `validDurationSeconds`, 24 h auth tokens); `https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys`; `https://www.backblaze.com/docs/cloud-storage-lifecycle-rules` (`daysFromUploadingToHiding`, `daysFromHidingToDeleting`, `fileNamePrefix`); `https://www.backblaze.com/docs/cloud-storage-large-files` and `.../view-and-delete-unfinished-large-files`; `https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules`; `https://www.backblaze.com/docs/cloud-storage-object-lock`; `https://www.backblaze.com/docs/cloud-storage-server-side-encryption`; `https://www.backblaze.com/docs/cloud-storage-data-regions`; `https://www.backblaze.com/docs/cloud-storage-data-caps-and-alerts`; `https://www.backblaze.com/docs/cloud-storage-s3-compatible-api`; `https://github.com/backblaze-b2-samples/b2-browser-upload` (Backblaze's own sample: S3 presigned PUT preferred for short expiry, 5 GB single / multipart for larger, native URL bucket-scoped 24 h, presigned POST unsupported). |
| Wasabi | `https://wasabi.com/pricing` (Pay as You Go $7.99/TB-month, 1 TB minimum, 90-day minimum retention, no egress/API fees); `https://wasabi.com/pricing/faq` (deleted objects incur a "Timed Deleted Storage" charge for the remaining days); `https://wasabi.com/product-terms` (90-day minimum, 1 TB minimum, egress fair-use condition). |

Secondary/current-pricing cross-checks used only where an official page was not directly retrievable: AWS S3 Standard $0.023/GB-month, $0.005/1,000 PUT, $0.0004/1,000 GET, $0.09/GB egress after 100 GB/month, 12-month free tier; GuardDuty Malware Protection for S3 pricing. These are flagged as unverified in §11.4 and must be confirmed on the official pricing pages before any purchase.

#### 11.1.5 Expected cost scenarios

**Assumptions.** List prices as published on 5 November 2026, USD, excluding tax, support plans, CDN (CloudFront/custom domain), Netlify plan/build minutes/functions/bandwidth, Turso, DNS, malware scanning, and data-transfer from Netlify Functions to storage. Egress is public testimonial video playback. "Ops A/B" map to each provider's write/read request classes. Abandoned-upload quota assumed ≤5% of uploads and removed by a 1-day lifecycle rule. No free-tier credit is assumed beyond the explicit allowance noted in each row, and **no account or billing relationship was created**.

| Scenario | Volume | Amazon S3 | Cloudflare R2 | Backblaze B2 | Wasabi |
|---|---|---|---|---|---|
| **A — staging / pilot (synthetic only)** | 2 GB stored, 10 GB egress, 200 uploads/mo, ~2,000 Class A, ~10,000 Class B | Storage $0.05 + PUT $0.01 + GET $0.004 + egress within 100 GB free ≈ **$0.06/mo** (≈ **$0.00/mo** inside the 12-month free tier) | Storage, 1 M Class A, 10 M Class B and egress all inside the monthly allowance ≈ **$0.00/mo** (allowance, not a free service; overage billed) | Storage free (<10 GB); egress free up to 3×2 GB = 6 GB, 4 GB × $0.01 = $0.04; transactions free ≈ **$0.04/mo** | **$7.99/mo minimum** regardless of usage, plus 90-day retention charges on deleted quarantine objects |
| **B — small production** | 25 GB stored (~250 × 100 MiB videos), 200 GB egress, 500 uploads/mo, ~5,000 Class A, ~100,000 Class B | Storage $0.58 + PUT $0.03 + GET $0.04 + (200−100) GB × $0.09 = $9.00 ≈ **$9.65/mo** | Storage (25−10) × $0.015 = $0.23; Class A/B inside allowance; egress $0 ≈ **$0.23/mo** | Storage (25−10) × $0.00695 = $0.10; egress (200 − 3×25 = 125 GB) × $0.01 = $1.25 ≈ **$1.35/mo** | **$7.99/mo** (1 TB minimum) + retention charges |
| **C — growth** | 250 GB stored, 2,000 GB egress, 2,000 uploads/mo, ~20,000 Class A, ~1,000,000 Class B | Storage $5.75 + PUT $0.10 + GET $0.40 + (2,000−100) × $0.09 = $171.00 ≈ **$177.25/mo** | Storage (250−10) × $0.015 = $3.60; Class A/B inside allowance; egress $0 ≈ **$3.60/mo** | Storage (250−10) × $0.00695 = $1.67; egress (2,000 − 750) × $0.01 = $12.50 ≈ **$14.17/mo** | **$7.99/mo** storage floor; egress 2,000 GB ≫ 250 GB active storage → fair-use policy review required |

**Reading the numbers.** S3 egress dominates at scale (scenario C ≈ $171/mo of $177). R2's zero-egress model is the cheapest at every scale and its free deletes make quarantine cleanup cost-free; B2 is cheapest storage per GB but its 3× egress allowance converts to $0.01/GB overage on a video-heavy site. **GuardDuty Malware Protection for S3** would add roughly $0.09–$0.60 per GB scanned plus ~$0.215 per 1,000 objects (published figures conflict; see §11.4) — e.g. scanning 25 GB/mo could add ~$2–$15/mo. An equivalent external scanner for R2/B2 has its own compute/egress/subscription cost that has not been quoted. **These are planning estimates only; no cost has been incurred and no billable resource exists.**

#### 11.1.6 Recommended provider and rationale

**Recommendation (for approval, not implemented): Amazon S3 (S3 Standard) as the primary candidate, with Cloudflare R2 as the cost-optimized alternative if the size-bound verification gate is passed.**

Rationale for S3 as primary:

1. It is the **only** evaluated provider that documents a **size bound enforced by the storage service inside the upload authorization** (`content-length-range` in a presigned POST policy), which is precisely the requirement in step 4 of the mandated architecture. R2 and B2 explicitly do not support presigned POST.
2. It offers the most complete documented security stack for the other required steps: **GuardDuty Malware Protection for S3** for the malware-scanning requirement, lifecycle `Expiration` + `AbortIncompleteMultipartUpload` for abandoned-upload cleanup, `If-None-Match` conditional writes to stop overwrite of a server-generated key, `s3:signatureAge` policy conditions, Block Public Access, SSE-KMS, Object Lock, IAM/STS scoped credentials, and CloudFront OAC for private-origin public delivery.
3. Region selection at bucket creation gives an explicit data-residency decision, which matters for applicant documents (see §11.4).
4. The AWS SDK is the reference S3 client, so the architecture is portable: switching to R2/B2 later is mostly an `endpoint`/credentials change rather than a rewrite.

Trade-offs, stated plainly: S3 is the **most expensive under video egress** and the **most operationally complex** (IAM, bucket policy, KMS, CloudFront, GuardDuty, cost alerts, key rotation). **Cloudflare R2** is the better economic fit for public video (zero egress, free deletes/abort, simple token model, EU/US/FedRAMP jurisdictions) and would be recommended on cost — but only after a hosted staging test confirms that a SigV4-signed `Content-Length` on a presigned PUT is actually enforced by R2, and after an external malware-scanning service is chosen and costed. **Backblaze B2** is the cheapest raw storage with the strongest application-key scoping, but shares the POST-policy gap and carries egress overage on a video-heavy site.

**No provider is being selected or purchased here.** Provider choice, account creation, and bucket creation require the exact approvals in §11.5.

### 11.2 Proposed upload, validation, promotion, and cleanup architecture (evaluation only)

This is a **design proposal for approval**. Nothing below has been implemented; no endpoint, table, dependency, environment variable, bucket, or limit was added or changed. It is written so that the existing server-side validation (`src/lib/files/validate.ts`, `src/lib/files/signatures.ts`), the existing `mediaAssets` registry, the separate `immi-public` / `immi-private` Blobs stores, and all middleware security controls can be reused rather than weakened.

**Step 1 — Authenticated administrator requests upload authorization.**
A new admin-only endpoint (e.g. `POST /api/admin/cms/media/uploads/authorize`) accepts only metadata: `purpose` (e.g. `testimonial-video`), declared size, declared MIME. It accepts **no file bytes**. Route through the existing admin route guards used by `src/app/api/admin/cms/media/route.ts`: session/role `guardMutation`, CSRF/Origin checks, CMS mutation throttling, and `no-store` responses. Reject non-admin, unauthenticated, cross-origin, and rate-exceeded requests before any storage call.

**Step 2 — Server validates session, role, and CSRF.**
Repeat the authorization checks server-side (never trust middleware alone). Bind the request to the authenticated admin identity and record it in an audit entry. Do not accept a client-supplied storage key, bucket, prefix, or URL.

**Step 3 — Server generates a random object key.**
Generate an unguessable key with `crypto.randomUUID()` (or equivalent CSPRNG) under a dedicated **private quarantine prefix**, e.g. `quarantine/<uploadId>/<uuid>.bin`. Never derive the key from the filename, MIME, admin identity, or timestamp. Persist a pending-upload record (key, purpose, declared size, admin id, expiry, status `pending`) in the database. The key is an **internal object identifier**: it must never be returned in a public response, page payload, log line, or error message to an unauthorized user. Use `If-None-Match` conditional writes (S3) or equivalent to prevent overwrite/replay of an existing key.

**Step 4 — Issue a short-lived, narrowly scoped upload authorization.**
Server-side only, using credentials from a secure environment-variable interface (Functions scope):
- **Amazon S3:** `createPresignedPost` with a policy containing exact `bucket`, exact `key`, `["content-length-range", 1, MAX_UPLOAD_BYTES.video]`, `starts-with $Content-Type` constrained to the allowed video types, `x-amz-server-side-encryption`, `success_action_status`, and a short `expiration` (e.g. 300–900 s). The POST policy is evaluated by S3 before the body is accepted.
- **R2 / B2 (if approved after verification):** presigned **PUT** with `expiresIn` in the low minutes, exact key, and SigV4-signed `Content-Type`; the size bound must be enforced by a signed `Content-Length` header and **verified in staging**, plus mandatory re-measurement in step 6. Do **not** ship long-lived API tokens or temporary credentials to the browser.
- For files above the single-upload ceiling or for resumability, issue **per-part presigned PUT URLs** for an S3 multipart upload; each part URL is short-lived and bound to one part number of one upload id. The server, not the browser, initiates and completes the multipart upload.

The authorization response must be `Cache-Control: no-store`, must not be logged, and must be treated as a **bearer token** (Cloudflare's docs say exactly this; AWS calls presigned URLs bearer tokens). It grants **one method on one object for minutes** — no list, no delete, no read, no wildcard key. CORS on the bucket must allow only the staging/production origin, only the permitted method and headers. Netlify's `connect-src` CSP directive currently `'self'` would need a **narrow, host-specific addition** for the storage origin; `form-action: 'self'` means the browser must use a programmatic `fetch`/`FormData` upload rather than an HTML form navigation. Any CSP change is a security-control change requiring the approval in §11.5 and must not broaden other directives.

**Step 5 — Browser uploads directly to the private quarantine bucket.**
The bytes go from the browser to the object store, **never through the Netlify Function**, which is what avoids the documented 6 MB buffered / ≈4.5 MB effective binary request ceiling. The quarantine bucket/prefix is private (Block Public Access / no public bucket), server-side encrypted, and has no public read policy. A failed/expired authorization is simply re-requested through step 1; nothing is retried blindly.

**Step 6 — Finalization endpoint verifies the object and its actual contents.**
A new admin-only endpoint (e.g. `POST /api/admin/cms/media/uploads/:id/finalize`) re-checks session/role/CSRF, loads the pending record, checks it is `pending` and unexpired, and verifies the object in storage with `HeadObject`/`GetObject`: existence, **measured** `Content-Length`, server-stored metadata, checksum/ETag where available, and that the object is in the quarantine prefix. Reject and delete on any mismatch. This step is what makes filename and browser-supplied MIME irrelevant: `cv.type`, `cv.name`, and any declared `Content-Type` are **advisory only**.

**Step 7 — Server-side MIME / magic-byte verification on the actual bytes.**
Reuse `src/lib/files/signatures.ts` `detectFileType()` (already recognises MP4 via `ftyp` at byte offset 4 and WebM via the EBML magic `1A 45 DF A3`) and `src/lib/files/validate.ts` `validateUpload()` with `purpose: 'testimonial-video'` (allow `video`, extensions `mp4`/`webm`). Because a 100 MiB object cannot be pulled into a Function body, stream or range-read the smallest sufficient prefix for signature detection, enforce size from `HeadObject`, and compute/extend checksum verification. Store the **detected** MIME type and extension, not the client's. Reject mismatches between declared and detected type, polyglots, disallowed kinds, and zero-byte/oversize objects.

**Step 8 — Size limits, allowed formats, and malware-scanning requirement (evaluated, not implemented).**
- **Size:** enforce `MAX_UPLOAD_BYTES` from the *measured* object size, not the declared size; reject anything over the approved ceiling. The existing 100 MiB video constant must **not** be silently raised or lowered — any change is a separate approval.
- **Formats:** allow only the existing `mp4`/`webm` allowlist for testimonial videos; keep `SERVABLE_TYPES` in `src/app/api/media/[...key]/route.ts` as the public-serving allowlist.
- **Malware scanning:** **required by the architecture, not implemented and not yet costed.** Options evaluated: (a) AWS GuardDuty Malware Protection for S3 (native, scans on upload, published pricing figures conflict — §11.4); (b) a ClamAV/scan worker reading the quarantine object (adds compute, egress, a scheduled/background job, and a new service); (c) a third-party scanning API (adds a paid service and an external data processor, which has data-protection implications for applicant documents). Any option adds cost and requires disclosure + approval before it is enabled. **No object may be promoted before a passing scan result.**
- **Public delivery path must be re-evaluated too:** the current public media proxy `src/app/api/media/[...key]/route.ts` materialises the whole object into a `NextResponse`, so a 100 MiB video served through it would also hit the Netlify buffered/streamed **response** ceiling. A direct-upload design is incomplete without a delivery decision (a provider CDN/custom domain plus a narrowly scoped `media-src` CSP addition, or short-lived presigned GETs). This is an open design item, not a change made here.

**Step 9 — Promote only validated files to the correct public or private storage location.**
A server-side copy/put writes the validated object to its final destination:
- **Public testimonial media** → the public store (`immi-public` Blobs or the provider's public bucket/prefix) with the server-detected MIME, immutable cache headers, and a `mediaAssets` row with `visibility = 'public'`.
- **Private applicant CVs** → the private store (`immi-private` Blobs or a strictly separate private bucket) with `visibility = 'private'`, accessible only through the existing session/role-guarded, audited, `no-store`, attachment-disposition private download route. **Never** a public bucket, never a public URL, never a browser-readable object key.
- **Strict separation:** separate buckets/prefixes, separate credentials/permissions, separate lifecycle rules, and a hard-coded `visibility='public'` filter in the public proxy (already present). Public testimonial media and private applicant CVs must never share a bucket, prefix, key namespace, credential, or URL pattern. The private download path must remain server-mediated (short-lived server-issued grants only), never a raw storage URL handed to a browser.
Mark the pending record `finalized` and write the audit entry atomically with the registry insert; a failed insert leaves no publicly reachable object.

**Step 10 — Clean up failed, expired, and abandoned uploads safely.**
- On any rejection (steps 6–8), **delete the quarantine object immediately** and mark the pending record `rejected`.
- On successful promotion, delete the quarantine object and mark `finalized`.
- Configure a bucket lifecycle rule on the **quarantine prefix only**: expire objects after ~1 day and `AbortIncompleteMultipartUpload` after ~1 day (R2's default is 7 days; docs show a 1-day override). On S3/B2 use the equivalent `Expiration` / `daysFromHidingToDeleting` rules. Deletes and abort-multipart operations are free on R2; Class A deletes are free on B2.
- Add a scheduled reconciliation job that expires `pending` records past their TTL, deletes their quarantine objects, and aborts stale multipart uploads — this covers abandoned uploads where the browser never calls finalize.
- Apply per-admin concurrency/rate limits, a global quarantine storage cap, and billing alerts/data caps so an attacker with a valid session cannot create unbounded cost. Cleanup must be idempotent and must never touch production or private-CV objects.

### 11.3 Security considerations (must not be weakened)

- **Never trust filename or browser MIME.** Detected type from magic bytes wins; `Content-Type` on the wire is advisory. Public responses use the server-detected MIME stored in the registry; `X-Content-Type-Options: nosniff`, sandbox CSP and `default-src 'none'` on the media proxy stay in place.
- **Bearer-token discipline.** Presigned URLs/policies are bearer tokens: short expiry, single object, single method, `no-store`, never logged, never placed in page HTML/URLs, never exposed to unauthorized users. Never ship parent/long-lived credentials or private storage keys to a browser or to logs. With R2 temporary credentials, Cloudflare explicitly warns "Never ship your parent secret access key to a client".
- **No exposure of internal identifiers.** Private storage keys, CV URLs, upload tokens, bucket names where avoidable, and quarantine object keys must not appear in client responses, error messages, or public logs. Use the opaque upload id in client-facing responses.
- **Strict public/private separation.** Separate buckets/prefixes/credentials/lifecycle rules; hard-coded `visibility='public'` filter; private downloads remain session/role-guarded, audited, `no-store`, attachment disposition, sandbox CSP. Applicant CVs must never become public objects.
- **Preserve middleware security.** HTTPS enforcement, per-request nonce CSP, `no-index`/`no-store`, cache controls, admin route restrictions, security headers and the `upgrade-insecure-requests` behaviour in `src/middleware.ts` remain unchanged. Any CSP addition is host-specific and narrowly scoped; no wildcard, no `'unsafe-inline'` broadening, no relaxation of `connect-src`/`media-src` beyond the single required origin.
- **Integrity and replay.** `If-None-Match` conditional writes, SigV4 checksums, one-time pending records, CSRF/session/role re-checks at both authorize and finalize, rate limiting, and short TTLs.
- **Data protection.** Server-side encryption at rest, TLS in transit, private quarantine, Object Lock/retention where appropriate, least-privilege scoped credentials with rotation, bucket/CORS restrictions, audit logging, and an explicit data-residency choice. Region/jurisdiction is **immutable after bucket creation** on R2 and B2 — it must be decided before any resource is created, with applicant-data compliance in mind (see §11.4).
- **Cost as an attack surface.** Lifecycle cleanup, quarantine caps, concurrency limits, and billing alerts prevent a valid-but-abusive session from generating unbounded storage charges.
- **Secrets handling.** All credentials via supported secure configuration interfaces (Netlify environment variables with Functions scope / deploy-context scoping, or the provider's secret store). Document only non-secret identifiers. No secrets in chat, docs, terminal output, source, or logs. Never ask for passwords/tokens/private credentials in chat or documentation.

### 11.4 Remaining uncertainties (open; none resolve without a hosted staging build or a user decision)

1. **R2/B2 size-scoped authorization.** Neither supports presigned POST / `content-length-range`. Whether a SigV4-signed `Content-Length` on a presigned PUT is reliably enforced by R2/B2 must be **tested in a real hosted staging environment**. Until then, only Amazon S3 fully satisfies step 4 as written.
2. **Exact official AWS POST-policy page.** `sigv4-HTTPPOSTConstructPolicy.html` returned a cookie/consent interstitial on fetch; the `content-length-range` condition is corroborated by the AWS SDK's `@aws-sdk/s3-presigned-post` API and AWS repost answers, but the official page must be read directly before implementation.
3. **AWS S3 request/egress list prices** ($0.023/GB-month, $0.005/1,000 PUT, $0.0004/1,000 GET, $0.09/GB after 100 GB free, 12-month free tier) and **GuardDuty Malware Protection for S3** pricing came from current secondary transcriptions; published figures conflict ($0.09 vs $0.60 per GB scanned, plus ~$0.215/1,000 objects). Verify on `aws.amazon.com/s3/pricing/` and `aws.amazon.com/guardduty/pricing/` before any purchase.
4. **Free-tier and billing conditions.** Whether each provider requires a payment method/verified billing account to activate its allowance was not verified. No provider is assumed free; all allowances are capped and conditional.
5. **Malware-scanning approach and cost.** No scanner chosen, no quote obtained. A native service (GuardDuty) vs a self-hosted worker vs a third-party API differs in cost, latency, and in whether applicant data leaves the chosen jurisdiction.
6. **Public delivery architecture.** The existing media proxy buffers the whole object and would also exceed the Netlify **response** ceiling for a 100 MiB video. A CDN/custom domain plus narrow CSP change, or short-lived presigned GETs, must be designed and approved. CSP currently pins `media-src 'self' blob:` and `connect-src 'self'`.
7. **Data residency / compliance.** Applicant CVs are personal data; the site and users are in Nigeria (Minna, Niger State). No legal determination was made about whether applicant data must remain in a specific jurisdiction (e.g. NDPA/GDPR considerations), or which provider region/jurisdiction satisfies it. R2 jurisdictions and B2 regions are immutable after bucket creation. This is a user/legal decision.
8. **Hosted edge compatibility.** The local edge-bundler failure is root-caused (Deno CLI binary download blocked by sandbox egress, §10.4), but compatibility of the hosted Netlify build image is **unverified until an actual hosted build**. Deno availability in the build image, effective plugin/runtime versions, and merged response headers remain unverified.
9. **Staging/production resource state.** Netlify site/team plan, build minutes, Functions/Edge usage, bandwidth, Blobs operations/storage/egress, Turso storage/compute, and any existing production DB schema state are unknown. No account was inspected.
10. **Storage topology decision.** Whether public media stays in Netlify Blobs with only large videos offloaded, or all media moves to the new object store, is unresolved. `STORAGE_DRIVER=blobs` must remain where appropriate for the existing Netlify implementation; private CVs must remain strictly separated. A hybrid design must not introduce a second source of truth for `mediaAssets`.
11. **Multipart browser ergonomics.** Per-part presigned URLs, abort/retry behaviour, and the finalize/cleanup logic for incomplete multipart uploads need a hosted test; none exists.

### 11.5 Exact approvals required before implementation

Each item is a **separate, explicit, written approval**. None has been granted by this evaluation.

1. **Provider selection** — approve a specific provider and storage class/region/jurisdiction (recommendation in §11.1.6), including the cost/complexity trade-off and the R2/B2 size-bound caveat in §11.1.3.
2. **Cost disclosure and billing approval** — approve the expected monthly cost range from §11.1.5, a budget cap and billing alerts, and the creation of a billing account. **Before** any account, bucket, subscription, or paid service is created. Stop if cost or access is unclear.
3. **Storage architecture approval** — approve the ten-step design in §11.2, including new admin endpoints, a pending-uploads table (a **schema change requiring its own migration approval**), lifecycle rules, CORS, quarantine TTL, malware-scanning option, the public delivery path, and any CSP change. No unapproved storage architecture may be implemented.
4. **Upload-limit decision** — any change to `MAX_UPLOAD_BYTES` (currently image 8 MiB / document 10 MiB / video 100 MiB) requires evidence that every layer supports it and separate approval. No limit was changed in this evaluation.
5. **New environment variables / credentials** — approve the exact variable names and their injection through a supported secure interface; secrets must never be pasted into chat or docs. Include newly approved object-storage variables **only after** provider selection.
6. **Staging resource creation and deployment** — approve creating separate staging storage resources (or using a staging-only bucket) and a staging deploy. This is **not** authorized by the current task.
7. **Staging database migration (if needed)** — after a read-only schema inspection and comparison with `drizzle/0000_init.sql`, approve a documented non-destructive migration that preserves staging data; report conflicts and stop on any conflict. No migration was run.
8. **Staging administrator provisioning (if needed)** — staging-only account with fresh staging-only credentials, synthetic data only; no real applicant submissions/documents and no production administrator provisioning.
9. **Hosted verification** — approve the single hosted build + function/edge log review and the staged verification matrix (§11.7) before any claim that staging works.
10. **GitHub commit and push** — **only after successful staging verification and a separate explicit approval**, as the standing decision states. No Git operation is authorized now.
11. **Production** — all production deployment, production database access/migration, production resource modification, production administrator provisioning and production credentials remain prohibited. No production action was taken or is requested.

### 11.6 Workstream B — concise staging-access checklist

Full operational checklist is in `docs/DEPLOYMENT.md` §13. This is the access-gate summary. **All secrets must be supplied through supported secure configuration interfaces only; document only non-secret identifiers.** Do not ask for or write down passwords, tokens, or private credentials in chat or documentation. Confirm every resource is **separate from production** before any use; do not guess identifiers or substitute production values.

| Gate | Required item (identifier only, never the secret) | Secret channel | Status |
|---|---|---|---|
| **Netlify — separate staging site** | Staging **site ID** (non-secret) and staging **URL**; written confirmation it is a distinct site from production | Netlify UI/CLI/API | Not provided — blocked |
| | Staging-only **deploy authorization** for that site, scoped to non-production deploys; never `--prod` | Netlify secure auth | Not provided — blocked |
| | Staging **environment variables** set with **Functions** scope and the correct deploy context (`branch:staging`/deploy-preview); `netlify.toml` variables do not reach functions | Netlify env UI / `env:set --context --scope` (secret values entered there, not here) | Not provided — blocked |
| | **Function and Edge log access** for the staging site (build logs, function logs, edge logs) | Netlify UI/CLI | Not provided — blocked |
| **Turso — separate staging database** | Staging **database identifier / URL** (non-secret) and written confirmation it is distinct from production | Turso secure config | Not provided — blocked |
| | Staging-only **auth token** | Turso/Netlify secret interface | Not provided — blocked |
| | **Read-only schema inspection** access (tables, columns, indexes, FKs, migration ledger) | Turso read-only query | Not provided — blocked |
| | **Staging-only migration/write access — only if separately approved** after the read-only comparison; non-destructive, preserves staging data | Turso secure auth | Not authorized |
| **Application config (staging-only)** | Staging-only `SESSION_SECRET` | Netlify secret env | Not provided — blocked |
| | `STORAGE_DRIVER=blobs` where appropriate for the existing Netlify Blobs implementation (production fails closed unless set) | Netlify env | Not provided — blocked |
| | `NEXT_PUBLIC_SITE_URL` = the staging URL (not production) | Netlify env | Not provided — blocked |
| | **Newly approved object-storage variables — only after provider selection and approval** (endpoint/region/jurisdiction, bucket identifiers, scoped credentials, quarantine prefix, lifecycle TTL) | Netlify secret env, Functions scope | Not applicable yet — no provider selected |
| **Separation confirmation** | Written confirmation that Netlify site, Turso DB, storage buckets, credentials, and DNS are all separate from production, plus a check that no production identifier appears in staging config | Human confirmation + config review | Not provided — blocked |

All twelve checked staging-related environment names were `not set` in the earlier audit (§10.2); connectors are `unsupported`; no secret mounts or native CLIs are available. `GH_TOKEN` / `GITHUB_TOKEN` are GitHub credentials, **not** staging credentials, and must not be reused as such.

### 11.7 Workstream C — re-confirmation of Phase 8 findings and precise staging deployment checklist

**Re-confirmed at the end of this evaluation:**

| Finding | Status |
|---|---|
| 283-path audit intact | Appendix A remains exact **283/283** (regex vs `git ls-files --others --exclude-standard`); 1 tracked file, 283 untracked, 0 staged, 0 modified tracked changes |
| Local edge-function diagnosis documented | §10.4: generated `vendor.ts` has 16 remote seed URLs but 149 pre-vendored files in `edge-runtime/vendor/` and zero remote imports in generated `.js`; root cause is the edge-bundler's Deno CLI binary download from `dl.deno.land` (`DENO_VERSION_RANGE='^2.4.2'`), which failed with `TypeError "fetch failed"` / `ECONNRESET` after four retries |
| Hosted edge compatibility | **Unverified until an actual hosted build**; no application/plugin compatibility defect found |
| 6 MB buffered Netlify payload ceiling | Reflected accurately: buffered request/response 6 MB, streamed response 20 MB, binary/base64 overhead → ≈4.5 MB effective binary request ceiling; §11.2 routes file bytes around the Function entirely. Note the **response** ceiling also affects the existing buffered media proxy for large video (§11.2 step 8) |
| Existing 100 MiB upload path | **Remains incompatible.** `POST /api/admin/cms/media` → `request.formData()` → `File.arrayBuffer()` → `validateUpload()` → `store.set()` buffers multipart bytes in a Function. Also confirmed `/api/assessment` uses `request.formData()` + `cv.arrayBuffer()` with `MAX_SUBMISSION_REQUEST_BYTES = 12 MiB` and a 10 MiB document ceiling — also above the documented binary ingress ceiling. Both need hosted verification; neither was changed |
| Unsupported presigned-upload workaround | **None introduced.** `@netlify/blobs@11.1.7` has no supported browser presigned helper; the internal `SIGNED_URL_ACCEPT_HEADER` is server-side transport after body receipt and remains unused. R2/B2 POST-policy gaps are flagged, not worked around |
| No database migration run | Confirmed; no staging/production DB connection |
| No staging/production resources modified | Confirmed; no account, bucket, object, deploy, or secret created |
| No Git operation | Confirmed; no staging, commit, push, or branch change |
| Protected local data | `.data/local.db` and `.data/secret-markers.json` untouched (hashes in §11.8) |
| Security controls | Middleware HTTPS/CSP/no-index/no-store/admin restrictions, `netlify.toml` edge headers, separate `immi-public`/`immi-private` stores, server-side size/MIME/magic-byte validation, public proxy `visibility='public'` filter, private CV route guards, and production fail-closed storage selection all unchanged |

**Precise staging deployment checklist — executable only once all staging resources and the approvals in §11.5 exist.** Every step is a gate; stop and report on any failure. Do not execute any step now.

1. **Re-verify repository baseline:** branch `arena/cdcb43ad-immi-website`, HEAD `bc53028b18b4ad9f8f2391b816a872973cbae457`, 1 tracked, 283 untracked, 0 staged/0 modified, Appendix A 283/283, protected hashes unchanged. No Git staging/commit/push.
2. **Confirm separation:** separate Netlify staging site ID + URL, separate Turso staging DB identifier, separate storage buckets/credentials, no production identifier in staging config. Obtain written confirmation.
3. **Inject staging-only secrets** through the secure interface with Functions scope and correct deploy context: staging `SESSION_SECRET`, staging Turso URL/token, `STORAGE_DRIVER=blobs`, `NEXT_PUBLIC_SITE_URL` = staging URL, and object-storage variables only if a provider has been approved. Verify **presence** (never print values). Confirm `NETLIFY_BLOBS_CONTEXT` is injected by Netlify and is not set/printed manually.
4. **Read-only staging schema inspection:** list tables, columns, indexes, FKs and migration ledger; compare to `drizzle/0000_init.sql` (33 tables, 61 indexes, 47 FKs) and `drizzle/meta/_journal.json` (one `0000_init` entry). Report drift. **Stop** on any conflict. No migration without separate approval; any approved migration must be non-destructive and preserve staging data.
5. **Deploy to staging only:** use a non-production/draft deploy targeting the staging **site ID**; never `--prod`, never a Git-connected build from this branch (only `README.md` is tracked). Use the authorized no-Git local CLI path from §9/§10.7 only if the secure runner is provided. Do not stage/commit/push.
6. **Single hosted build + edge check:** confirm build log plugin/runtime versions, Node patch, and that the middleware edge handler bundles without the Deno-download failure; review Function **and** Edge logs for errors. This is the first and only way to verify hosted edge compatibility.
7. **Verify effective headers and middleware:** HTTPS/secure-cookie behaviour, merged CSP (nonce, `media-src`/`connect-src` exactly as approved), `no-index`/`no-store`, cache headers, admin redirects, CSRF and session in the hosted runtime.
8. **Verify storage public/private separation:** Blobs `immi-public` / `immi-private` stores, private-download denial for anonymous users, storage-failure handling, and the public proxy's `visibility='public'` filter with `nosniff`/sandbox CSP.
9. **Verify upload ceilings honestly:** test uploads within the documented 6 MB / ≈4.5 MB effective binary ceiling; explicitly record that the 100 MiB video path and the 12 MiB assessment request path remain incompatible. **Do not** change limits or claim support. If Option B has been implemented and approved in a later turn, run the authorize → direct upload → quarantine → finalize → promote → cleanup flow with synthetic files only, including rejection of wrong-MIME, oversize, expired-token and abandoned-upload cases.
10. **Synthetic-data functional verification:** public site, admin portal (staging-only account), assessment workflow, and CMS media — synthetic data only, no real applicant submissions/documents.
11. **Log review and evidence:** collect build/function/edge logs, record results, and report. Do not print secrets, tokens, CV URLs, or internal object keys.
12. **Only then:** request the separate approval for GitHub commit/push **after successful staging verification**. Production remains out of scope.

### 11.8 Repository preservation verification

Baseline was verified **before** and **after** this documentation work on 5 November 2026:

| Check | Before | After |
|---|---|---|
| Branch / HEAD | `arena/cdcb43ad-immi-website` / `bc53028b18b4ad9f8f2391b816a872973cbae457` | unchanged |
| Tracked / untracked / staged / modified tracked | 1 / 283 / 0 / 0 | unchanged |
| Appendix A path audit | exact 283/283 | exact 283/283 (unchanged, not edited) |
| `.data/local.db` SHA-256 | `7c16c81cc383ae5832c16e02e364f1ed2a15debdcb8edce5bf331aa4df548ff3` | unchanged |
| `.data/secret-markers.json` SHA-256 | `2e5688ef56d38b4cb1932fe9980ed600041fa415addeccb7800baca5bdee47d0` | unchanged |
| Documentation files | `docs/PHASE-8-REPORT.md` 642 lines, `docs/DEPLOYMENT.md` 204 lines | `docs/PHASE-8-REPORT.md` **914 lines** (§11 appended) and `docs/DEPLOYMENT.md` **266 lines** (§13 appended + header status note updated); both are already among the 283 untracked paths — **no new paths, no deletions, no audit change** |
| Application source / config / limits / dependencies | unchanged | unchanged |
| Git operations | none | none |

Documentation changes are recorded accurately: this turn appended **§11** to `docs/PHASE-8-REPORT.md` and **§13** (plus a header status update) to `docs/DEPLOYMENT.md`. No secret value was printed, logged, or stored. §§1–10 and Appendix A are preserved verbatim.

### 11.9 Final verdict and stop point

Phase 8 is **not complete** and **staging is not verified**. §10.10's five-way status is unchanged: the isolated staging attempt was blocked before deployment; there is no hosted build, no staging site/DB identifier, no staging credentials or secure channel, no function/edge log, no migration, no cost incurred, and no production or Git action.

**What this turn accomplished:** evaluated five object-storage options against all requested dimensions using official documentation and current published pricing; recommended a provider with rationale and three cost scenarios; documented a ten-step secure upload/validation/promotion/cleanup architecture with security considerations and eleven open uncertainties; listed the exact approvals required; produced concise staging-access and precise staging-deployment checklists; re-confirmed the 283-path audit, the 6 MB ceiling, the incompatible 100 MiB path, the local edge diagnosis, and the absence of any unsupported workaround; and verified repository preservation before and after.

**What remains blocked:** every hosted/staging activity, provider selection and billing approval, storage architecture approval, malware-scanning choice, public-delivery design, data-residency decision, staging migration/admin approvals, and hosted verification.

**Stop point:** after these two documentation updates. **Await explicit approval** before implementing the selected storage architecture, selecting/purchasing a provider, creating any account/bucket/paid resource, deploying staging, running any migration, or performing any Git operation. No production deployment, production database access/migration, production resource modification, production administrator provisioning, or production credential use occurred or is authorized.

---

## 12. Amazon S3 Europe — architecture, malware scanning and cost evaluation (5 November 2026)

> **This section is appended after, and preserves in full, §§1–11 and the 283-path Appendix A.** It is an **evaluation and documentation only** deliverable. Nothing here implements, enables, purchases, deploys, migrates, or verifies anything. No AWS account, bucket, IAM role, policy, key, subscription, or paid service was created; no live AWS integration test was run; no application source, configuration, dependency, upload limit, schema, migration, middleware, CSP, or media access control was changed; no staging resource, administrator, or deployment was created; no production resource was accessed or modified; no Git operation was performed; no secret value was printed or stored.

### 12.0 Scope, confirmed decisions, labels and status

**Confirmed decisions (from the user):** the object-storage implementation target is **Amazon S3** (no provider re-selection); data residency is **Europe**, with suitable European AWS Regions compared and **no specific Region assumed approved**; malware-scanning services, capabilities and costs must be **evaluated before selection**, with a recommendation made only for approval; GitHub push is permitted only after successful staging verification **and** a separate explicit approval.

**Authorization boundary:** research, technical evaluation, cost estimation, architecture planning, and documentation only. Explicitly excluded: creating AWS accounts/buckets/IAM roles or other cloud resources; purchasing subscriptions or enabling paid services; implementing the S3 architecture; modifying application source; adding/updating dependencies; changing upload limits; modifying database schemas or creating migrations; deploying anything; accessing or modifying production resources; provisioning administrators; staging, committing, pushing, or any other Git operation; exposing secrets or asking for credentials in chat.

**Evidence labels used throughout:**

- **documented** — stated by an official AWS, Netlify, ClamAV, or vendor-published source cited in §12.9.
- **estimated** — an arithmetic illustration built on documented rates plus **explicit illustrative workload assumptions**; not a quote, not a bill, and not a verified price for any specific account.
- **unverified** — a factual/price/availability question that cannot be resolved from this sandbox without account access, a hosted staging build, a vendor quote, or a live AWS test (all prohibited/out of scope).
- **requires approval** — an action or decision that must not proceed without a separate, explicit, written user approval.

**Standing cautions:** a European Region alone does **not** guarantee GDPR compliance; free allowances do **not** make a production service free; budget alerts do **not** necessarily prevent charges; commercial pricing that is not published requires a **vendor quote**, not an invented figure; scanning costs are kept separate from S3/requests/transfer/Netlify/Turso/CDN; estimates avoid unsupported precision and are rounded.

**Status:** Phase 8 is **not complete** and **staging is not verified**. The staging-access checklist (§11.6 / `docs/DEPLOYMENT.md` §13.2) and precise staging-deployment checklist (§13.3) are **preserved unchanged** and remain blocked.

### 12.1 Workstream 1 — European Amazon S3 Region comparison

#### 12.1.1 Candidate Regions and geographic/residency position

**documented** — The official AWS Region billing-code reference lists eight European Regions: `eu-west-1` Europe (Ireland), `eu-central-1` Europe (Frankfurt), `eu-west-2` Europe (London), `eu-west-3` Europe (Paris), `eu-north-1` Europe (Stockholm), `eu-south-1` Europe (Milan), `eu-south-2` Europe (Spain), `eu-central-2` Europe (Zurich) [R1]. AWS's EU data-protection page states that EU Regions exist in **France, Germany, Ireland, Italy, Spain, and Sweden**, and that Switzerland and the United Kingdom are also selectable European Regions with **current GDPR adequacy decisions** [R2]. AWS's HDS page enumerates the six **EEA** Regions as Frankfurt, Ireland, Milan, Paris, Spain, Stockholm [R3]. Therefore:

| Region | Location | EU / EEA member state? | Note |
|---|---|---|---|
| `eu-west-1` | Ireland | Yes (EU/EEA) | Long-established; deepest service catalogue [R2] |
| `eu-central-1` | Frankfurt, Germany | Yes (EU/EEA) | Central European connectivity [R2] |
| `eu-west-3` | Paris, France | Yes (EU/EEA) | French residency [R2] |
| `eu-north-1` | Stockholm, Sweden | Yes (EU/EEA) | Nordic [R2] |
| `eu-south-1` | Milan, Italy | Yes (EU/EEA) | Opt-in Region [R4] |
| `eu-south-2` | Spain (Aragón) | Yes (EU/EEA) | Opt-in Region [R4] |
| `eu-west-2` | London, UK | **No** (Europe, adequacy decision) | Post-Brexit; not EU/EEA [R2] |
| `eu-central-2` | Zurich, Switzerland | **No** (Europe, adequacy decision) | Opt-in Region; not EU/EEA [R2], [R4] |

**documented** — A Lagos, Nigeria AWS **Local Zone** exists (`af-south-1-los-1a`) but its parent Region is `af-south-1` (Africa, Cape Town), i.e. **not Europe** [R5]. An AWS Africa Region would be closer to likely West African users but would contradict the confirmed Europe residency decision; it is therefore **excluded** from this comparison. AWS lists a **Lagos, Nigeria CloudFront edge PoP** and an Africa price group that explicitly includes Nigeria [R6], [R7] — relevant to delivery latency and cost (§12.1.4, §12.6).

#### 12.1.2 S3, upload-mechanism and malware-scanning availability

**documented** — Amazon S3 is a regional service; a bucket is created in one Region and GuardDuty Malware Protection for S3 can only protect buckets in the **same Region and same account** as the protection plan — cross-Region buckets are not supported [R8], [R9]. All four S3 Block Public Access settings are enabled by default for new buckets, and Object Ownership defaults to `Bucket owner enforced` (ACLs disabled) [R10]. S3 presigned URLs are documented for time-limited uploads; SigV4 presigned uploads support checksums (CRC64NVME, CRC32/CRC32C, SHA-1/256/512, MD5, XXHash variants) [R11]. S3 POST policies document `content-length-range`, exact-match, and `starts-with` conditions over `bucket`, `key`, `Content-Type`, `Content-Disposition`, `Cache-Control`, `Content-Encoding`, `Expires`, `success_action_status`, `success_action_redirect`, `x-amz-meta-*`, and signing fields [R12]. Multipart upload supports 1–10,000 parts, checksums/ETags, and S3 recommends `AbortIncompleteMultipartUpload` lifecycle rules; parts are billed until completed or aborted [R13], [R14].

**documented** — GuardDuty endpoints exist in **all eight** European Regions [R15]. GuardDuty's pricing page says pricing **varies by AWS Region** and directs readers to the Region-specific feature-availability table [R16]. AWS Config's `guardduty-malware-protection-enabled` managed rule is listed for Frankfurt, Ireland, Milan, Paris, Spain, Stockholm and Zurich [R17].

**unverified** — The **feature-level** availability of *GuardDuty Malware Protection for S3* in each specific European Region (as opposed to GuardDuty endpoints generally), and the Region-specific rate table on the S3 pricing page (the fetched page is a cookie shell with a non-rendering Region selector), were **not** verifiable from this sandbox. Both must be confirmed in the AWS console / Pricing Calculator before a Region is approved. Opt-in Regions (`eu-south-1`, `eu-south-2`, `eu-central-2`) also require explicit account enablement [R4].

#### 12.1.3 Storage, request, data-transfer and retrieval pricing by Region

**documented** — AWS S3 pricing is composed of storage, requests/data retrieval, data transfer, management/insights, replication, and transform/query; there is no minimum charge; `DELETE` and `CANCEL` requests are free; `LIST` is charged at the PUT/COPY/POST rate; S3 Standard-IA / One Zone-IA have a 30-day minimum and Glacier classes 90/180-day minimums plus retrieval fees [R18]. The official S3 pricing page gives an example of **$0.09/GB** data transfer out to the internet from S3 in Europe (Ireland) [R18]. AWS's registration/Free Tier pages list an S3 allowance of 5 GB Standard storage, 20,000 GET and 2,000 PUT requests [R19]; the Free Tier FAQ describes a **changed, credit-based** programme for new accounts since October 2026, so the applicability and expiry of any allowance is account-specific [R20].

**documented** — Amazon CloudFront pay-as-you-go pricing: 1 TB/month data transfer out and 10,000,000 HTTP/HTTPS requests are in the Always Free Tier; origin fetches from AWS origins are free; first 1 TB is free then **$0.085/GB** (Europe/Israel/Türkiye) or **$0.110/GB** (South Africa/Kenya/**Nigeria**/Egypt/Middle East) for the next 9 TB; HTTPS requests are **$0.0120 per 10,000** in both of those groups; first 10M requests are free; the first 1,000 invalidation paths/month are free then **$0.005/path** [R7], [R21]. CloudFront also offers flat-rate plans (Free $0, Pro $15, Business $200, Premium $1,000/month, "no overage charges" within published usage allowances) [R22].

**estimated (secondary sources, not an official Region table)** — S3 Standard storage is widely published at **$0.023/GB-month** for `eu-west-1` / `eu-north-1` and **$0.0245/GB-month** for `eu-central-1`, with PUT/COPY/POST/LIST **$0.005/1,000** and GET **$0.0004/1,000** [R23]. These are **unverified** for any specific account and are used below only as an **illustrative rate basis**; the official Region-specific tables must be checked before approval. GuardDuty Malware Protection for S3 is published at **$0.09/GB scanned + $0.215/1,000 objects evaluated** in US East (N. Virginia), after an 85% reduction effective 1 February 2025 [R16], [R24] — Region-specific rates are **unverified**.

#### 12.1.4 Likely-user latency (no measurement performed)

**documented** — CloudFront maintains a **Lagos, Nigeria** PoP among 750+ PoPs / 15 regional edge caches, and advertises country-level geolocation of viewers [R6]. Origin fetches are served over the AWS backbone; CloudFront supports Range GETs for large objects and begins streaming to the viewer as soon as the first byte arrives from the origin [R25], [R26]. Netlify Functions default to `cmh` (US East, Ohio) and can be moved to `dub` (Ireland), `fra` (Frankfurt), `lhr` (London), `cdg` (Paris), `mxp` (Milan) — but region configuration is a **Pro/Enterprise** feature, and for framework adapters (Next.js) it can only be set **project-wide via the UI**, not per generated function [R27].

**estimated / unverified** — The site serves an immigration agency; the user's location (Minna, Niger State, Nigeria) suggests a likely West African audience, but the actual audience distribution is **unverified**. For that audience: (a) public video **delivery** is best served from the Lagos edge, so the S3 origin Region mostly affects cache-miss latency; (b) **direct browser uploads** to an EU bucket from West Africa will have materially higher round-trip times than a nearby Region, so resumable multipart / retry behaviour matters; (c) `eu-south-2`/`eu-south-1`/`eu-west-3` are geographically somewhat closer to West Africa than `eu-north-1`, but no measurement was run and no claim of a latency ranking is made. **No latency test, no live AWS call, and no third-party benchmark is treated as verified.**

#### 12.1.5 GDPR and operational considerations (compliance is NOT automatic)

**documented** — AWS's GDPR Center states that customers choose where data is stored and the secured state of that data, that AWS may use **sub-processors**, that EEA→non-EEA transfers can still be made in compliance with GDPR, and that **"the GDPR does not change the AWS shared responsibility model"** [R28]. AWS's EU data-protection page says customer data is processed only under documented instructions, that the AWS GDPR DPA (with SCCs) applies automatically, that customers can select EU-only services, and that "Privacy Features of AWS Services" resources help determine whether a service may transfer data outside the chosen Region [R2]. The AWS sub-processors page lists processing entities by service/Region [R29]. AWS's HDS page notes that even with certification, "it is the customer's responsibility to evaluate their own compliance requirements" [R3].

**Operational consequences — documented / requires approval:** choosing an EU S3 Region addresses **storage at rest** only. It does **not** by itself guarantee GDPR compliance. The following remain open and need explicit decisions:

1. **Processing location of server-side code** — Netlify Functions default to US East (Ohio); moving them to an EU Region is a paid-plan, project-wide configuration change [R27]. **requires approval**, **unverified** plan eligibility.
2. **Turso database residency** — the existing Turso database Region is **unverified**; applicant personal data (§12.4) may reside outside Europe. A European S3 bucket does not fix that.
3. **CloudFront is a global service** — caching public testimonial videos at edges outside the EEA (including Lagos) is a cross-border distribution by design; a transfer-impact assessment and privacy-notice update are needed [R28], [R2]. Private CVs and quarantine objects must **never** be attached to any CDN distribution.
4. **Sub-processors / DPAs** — GuardDuty, a commercial scanner vendor, Netlify, Turso and AWS Marketplace sellers each need sub-processor/DPA review [R28], [R29]. An external scanning API that exports file bytes outside the EEA is a separate transfer requiring its own legal basis and assessment (§12.2).
5. **Lawful basis, consent and rights** — assessment consent is already snapshotted immutably (`consent_records` with `terms_version`, `privacy_version`, `consent_text`, `accepted_at`, `ip_hash`, `user_agent`) [R30]. **Publishing a testimonial photo/video is a separate purpose** (likeness/voice/personal data) needing its own documented consent and a workable erasure path; Object Lock/WORM retention can conflict with erasure rights and needs review.
6. **Backups, replicas, versions and deletion** — versioning, replication, backups and CDN caches all create additional copies; deletion/erasure must cover the object, all versions, replicas, quarantine leftovers, CDN caches and DB rows. Retention schedules and deletion runbooks must be written and approved.
7. **Encryption, access control, audit** — SSE-S3/SSE-KMS (not SSE-C, which GuardDuty cannot scan [R31]), TLS in transit, least-privilege IAM, Block Public Access, TBAC (§12.2.1), CloudTrail/CloudWatch, and the existing `activity_logs` audit trail.
8. **Records of processing, DPIA (if applicable), breach process, data-subject request handling** — organisational tasks, not solved by a Region choice.

#### 12.1.6 Region recommendation — **requires approval** (no Region is approved)

**Recommendation for further approval: `eu-west-1` (Europe, Ireland).** Rationale, all **documented** unless noted: an EU/EEA member-state Region [R2], [R3]; the most established European Region with the deepest service catalogue [R2]; GuardDuty endpoint present [R15]; a matching Netlify Functions EU region (`dub`) exists [R27]; the official S3 pricing page uses Ireland for its published $0.09/GB egress example [R18]; **estimated** lowest/equal-lowest S3 Standard storage rate among EU Regions ($0.023/GB-month, **unverified**) [R23]; not an opt-in Region [R4]; CloudFront's Lagos PoP mitigates West-African delivery latency regardless of origin [R6].

**Alternative for further approval: `eu-central-1` (Frankfurt)** — EU/EEA, GuardDuty endpoint present, matching Netlify `fra` region, but **estimated** slightly higher storage ($0.0245/GB-month, **unverified**) [R23]. `eu-west-3` (Paris) is a third EU/EEA candidate. `eu-west-2` (London) and `eu-central-2` (Zurich) are **not EU/EEA** and would need adequacy/transfer documentation [R2]; the three opt-in Regions add enablement steps [R4].

**requires approval / unverified** — Before any Region is selected: confirm Region-specific S3 and GuardDuty rate tables, confirm GuardDuty Malware Protection for S3 feature availability in that exact Region, confirm the AWS account's Free Tier status, confirm Netlify plan/function-region eligibility, confirm Turso DB residency, and complete the GDPR/DPA/sub-processor review. **No Region is approved by this section.**

### 12.2 Workstream 2 — malware-scanning approaches evaluated BEFORE selection

Three technically credible approaches are evaluated. All are **evaluation only**; **no scanner was selected or enabled**.

#### 12.2.1 Option 1 — Amazon GuardDuty Malware Protection for S3 (managed)

**documented** — On a newly uploaded object (`PutObject`, `POST Object`, `CopyObject`, `CompleteMultipartUpload`) GuardDuty automatically starts a scan, downloading the object via AWS PrivateLink into an **isolated, no-internet VPC in the same Region**, and publishing results to the **default EventBridge event bus** and CloudWatch metrics [R9], [R32]. It can be enabled as an **independent feature without enabling the GuardDuty detector** (in that case no findings are generated; EventBridge results are the signal) [R8]. Protection can be scoped to the whole bucket or up to **5 prefixes**; a dedicated IAM role is required; up to **25 protected buckets per account per Region** [R9], [R33].

**File types / size:** "supports all file formats that you can upload to an S3 bucket"; max object size **100 GB**; password-protected files, archives with >100,000 extracted files, >100 nesting levels, excessive extraction ratio/size produce `UNSUPPORTED` [R34], [R35]. S3 feature support: SSE-S3/SSE-KMS/DSSE-KMS, versioning, Object Lock, replication (if destination protected), lifecycle and TBAC are supported; **SSE-C, client-side encryption, Glacier Flexible/Deep Archive, S3 Express One Zone directory buckets, and Outposts are not** [R31]. Our 100 MiB video / 10 MiB CV ceiling is far below 100 GB [R35].

**Sync/async, results, failure:** asynchronous; scan status values include `COMPLETED`, `SKIPPED`, `FAILED`; result values `NO_THREATS_FOUND`, `THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED` with status reasons (e.g. `UNAUTHORIZED_TO_GET_OBJECT`, `OBJECT_ETAG_CHANGED`, `SSE_C_ENCRYPTED_OBJECT`) [R36]. Optional post-scan object tag `GuardDutyMalwareScanStatus` must be enabled **before** objects are uploaded, has an associated S3 tagging cost, and is limited by the 10-tag-per-object cap [R9], [R37]. A **tag-based access control (TBAC)** bucket policy can deny `GetObject` unless the tag equals `NO_THREATS_FOUND` and prevent anyone except the GuardDuty role from setting that tag — this is the documented primitive for "private quarantine until success" [R38]. Failed/unavailable scans must be treated as **not clean** (fail closed), with alerts, reconciliation and a bounded quarantine retention, followed by manual review.

**False positives / manual review:** `THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED` all route to a manual-review queue; objects stay private. **unverified** — whether scan-result events can be suppressed/allow-listed without a detector must be confirmed; treat as a manual process.

**Complexity/maintenance:** low infrastructure burden (no scanner hosts/signature DB), but requires IAM role, prefix scoping, EventBridge rule/consumer, tagging + TBAC policy, a pending-upload state machine, reconciliation, and alerting — still a significant application/architecture change.

**Published fees and allowances:** **$0.09/GB scanned + $0.215 per 1,000 objects evaluated** (US East N. Virginia; reduced 85% on 1 Feb 2025 from $0.60/GB; **Region-specific rates unverified**) [R16], [R24]. Monthly **Free Tier: 1,000 requests + 1 GB scanned per account per Region**, with no 30-day trial; **on-demand scan API is excluded**, and **S3 Object Tagging, S3 API calls (GET/PUT), and the EventBridge managed rule are NOT included in the Free Tier** [R16], [R39]. **Do not assume the Free Tier makes production free.**

**Regional availability / data processing:** GuardDuty endpoints exist in all eight European Regions [R15]; per-feature availability is **unverified** (§12.1.2). Scanning happens in an isolated environment **in the same Region**, which is the strongest data-residency posture of the three options [R32].

#### 12.2.2 Option 2 — self-managed, maintained ClamAV engine

**documented** — ClamAV is an open-source (GPLv2) anti-virus toolkit with a multi-threaded daemon (`clamd`), CLI scanner, signed signature databases maintained by Cisco Talos, and `freshclam`/`clamconf` for updates and configuration [R40], [R41], [R42]. It supports PE/ELF/Mach-O executables, a wide range of archives (Zip, RAR, 7z, Tar, ISO, CAB, DMG, …) and documents (MS Office, RTF, PDF, HTML) [R42]. `clamd.conf` limits: `MaxFileSize` (default ~100 MB, files above are **not scanned**), `MaxScanSize` (default ~400 MB), `MaxRecursion` (default ~17), `MaxFiles` (default 10,000), `MaxScanTime` (default 120,000 ms), `StreamMaxLength`; a technical ceiling of **2 GB per file** is documented [R43], [R44]. **A 100 MiB video exceeds the default `MaxFileSize`**, so limits must be deliberately raised and tested; otherwise a skipped scan can be mistaken for "clean" [R43]. `bucketAV powered by ClamAV` documents a **2 GB** maximum file size versus 5 TB for its Sophos engine [R45].

**Architecture / sync-async / results:** S3 Event Notification → SQS/EventBridge → worker (ECS/Fargate or EC2/`t3`/`m6i`) → `GetObject` → scan → publish result to a queue/callback/DB → promote or delete. Asynchronous, at-least-once delivery; use a DLQ, idempotency by object key + versionId + ETag, and bounded retries. Failed/unavailable scans (worker down, stale signatures, timeout, OOM) must remain private and fail closed with alerts. False positives require a manual-review queue and hash allow-list. **Note:** ClamAV detects malware, it does **not** validate that a file is a well-formed MP4/WebM — MIME/magic-byte validation remains the application's job (§12.3).

**Complexity/maintenance: high** — container image/build, signature-database freshness (multi-hundred-MB initial sync, frequent updates), CVE patching, autoscaling, EBS/CloudWatch/SQS/SNS costs, EICAR/health smoke tests, and 24×7 operational ownership. Signature updates also generate outbound data transfer.

**Published fees / compute / allowances:** **no licence fee** (GPLv2) [R40], [R41]; cost is compute + storage + queues + logs + data transfer. **estimated (secondary/vendor-published, unverified):** vendor comparisons put a small always-on ClamAV scanner at roughly **$19–$47/month of AWS infrastructure** (EC2 spot + EBS + SQS/SNS + CloudWatch) plus a software metering charge of **$0.025 per vCPU-hour** for the packaged `bucketAV powered by ClamAV` Marketplace product [R46], [R47]. SQS offers 1M free requests/month [R48]; Lambda $0.20/1M requests with 1M free [R49]; EventBridge $1.00/million events with AWS-service events free [R50], [R51]. **A reliable figure requires an AWS Pricing Calculator / vendor quote and a sizing test — requires approval.**

**Regional availability / data processing:** runs on compute **inside the chosen European Region and own AWS account**, so file bytes stay in the Region; but `freshclam` reaches external mirrors (metadata egress), and any vendor Marketplace telemetry/sub-processor relationship needs DPA review. **unverified**.

#### 12.2.3 Option 3 — separately operated commercial scanner compatible with S3

Two deployment models exist; both are **requires approval** and neither was purchased or enabled.

**documented (AWS Marketplace / vendor published pricing):**

- **In-account commercial engine — `bucketAV powered by Sophos` (widdix GmbH):** **$0.20/GB scanned + $0.025 per vCPU-hour** (2× vCPU rate for multi-engine), Sophos licence included, max file size **5 TB**, runs on EC2 Spot instances **inside the customer's AWS account**, with real-time/scheduled/on-demand/on-access/API scans, SNS/SQS/EventBridge integration and automatic tag/delete/quarantine [R45], [R46], [R47]. Vendor states data never leaves the customer's AWS account [R46]. A 30-day free trial is advertised [R47].
- **In-account multi-engine — Cloud Storage Security "Antivirus for Amazon S3, EBS, EFS, FSx" PAYG:** **$99/month subscription including 100 GB premium-engine scanning**, then **$0.80/GB** for scan tiers, **$0.10/GB** Sophos premium add-on, **$0.05/file** cloud detonation; 30-day trial with 100 GB free [R52].
- **External API scanners** (e.g. OPSWAT MetaDefender, Cloudmersive Virus Scan API): **no authoritative public commercial price was found** — **vendor quote required**; do not invent a figure. Public comparison pages give only rough/secondary estimates (e.g. ~$500–$1,200/month, annual contracts) [R53]. Cloudmersive publishes a **32 MB per-file cap** and per-call plan pricing [R53], which makes it **unsuitable for 100 MiB testimonial videos**; MetaDefender Cloud's free tier is for non-commercial research use [R53].

**Capabilities / workflow:** commercial products generally provide S3 event-driven real-time scanning, on-demand/scheduled rescans, tagging/quarantine/deletion, SNS/SQS/EventBridge or webhook callbacks, and some offer multi-engine detection and CDR. Async by default; failed/unavailable scans require DLQ + fail-closed quarantine; false positives need a manual-review path. Supported file types are broad (up to 5 TB for Sophos); password-protected/encrypted archives remain a general limitation.

**Complexity/maintenance:** medium — lower than self-managed ClamAV (vendor maintains signatures/engine), higher than GuardDuty (CloudFormation deployment, EC2/ECS in-account fleet or external API integration, vendor account, licence metering).

**Costs beyond the scanner fee:** EC2/EBS/SNS/SQS/CloudWatch, S3 GET/tagging/API calls, and Marketplace metering are billed separately [R46], [R47]. A **$99/month minimum** (CSS) or a **$0.20/GB + vCPU-hour** combination can exceed GuardDuty at low volumes; compare in §12.2.5.

**Regional availability / data processing:** Marketplace availability in the chosen European Region, vendor DPA/sub-processor status, and whether telemetry/scanning leaves the EEA are **unverified — vendor quote + DPA required**. An **external API** scanner exports applicant CV bytes and testimonial bytes to a third party, potentially outside the EEA → separate transfer assessment and explicit lawful basis needed [R28], [R2]; this makes the in-account model preferable for private CVs.

#### 12.2.4 Scan-result integration, quarantine and cross-cutting requirements (all options)

**documented** — S3 Event Notifications can be delivered to EventBridge (advanced filtering on key/size), SQS, SNS or Lambda [R50], [R51]. GuardDuty creates an EventBridge **managed rule** (`DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*`) and publishes `GuardDuty Malware Protection Object Scan Result` events containing `bucketName`, `objectKey`, `eTag`, `versionId`, `scanStatus`, `scanResultStatus`, `statusReasons` [R32], [R54]. SQS provides DLQs and at-least-once delivery; 1M requests/month free [R48]. All three options therefore need: (1) an upload-event trigger; (2) an async result handler that correlates on bucket + key + versionId/ETag; (3) a pending-upload state machine; (4) a private quarantine with TBAC/deny-by-default [R38], [R10]; (5) fail-closed handling of `FAILED`/`UNSUPPORTED`/`ACCESS_DENIED`/timeouts; (6) manual review for threats/false positives; (7) promotion **only** after a clean result **and** application validation; (8) rejection/deletion + audit; (9) lifecycle cleanup [R13], [R14].

#### 12.2.5 Three cost scenarios — explicit illustrative assumptions

**Scenario definitions are given by the user.** Uploaded-object counts and average file sizes below are **explicit illustrative assumptions** (not measurements): a mix of testimonial photos, testimonial videos and CVs. "Stored" is steady-state stored GB; "transferred" is monthly public-media delivery to viewers via CDN; a small separate allowance models private/admin-download egress directly from S3.

| Assumption | A — staging | B — small production | C — growth |
|---|---|---|---|
| Stored (GB/month) — given | 2 | 25 | 250 |
| Transferred to viewers (GB/month) — given | 10 | 200 | 2,000 |
| **Illustrative uploaded objects/month** | **40** | **500** | **5,000** |
| **Illustrative average uploaded file size** | **5 MB** | **8 MB** | **10 MB** |
| → bytes scanned/month (estimated) | 0.20 GB | 3.91 GB | 48.83 GB |
| Illustrative private/admin download egress | 0.1 GB | 2 GB | 20 GB |
| Illustrative S3 requests | 120 writes / 360 reads | 1,500 / 6,000 | 15,000 / 60,000 |

**Scanning cost only (separated from all storage/request/transfer/CDN/Netlify/Turso lines), estimated on documented US-East rates applied illustratively:**

| Scanning approach | A — staging | B — small production | C — growth | Basis |
|---|---|---|---|---|
| **GuardDuty (full published rate)** | ~$0.03 | ~$0.46 | ~$5.47 | 0.09/GB + 0.215/1k objects [R16], [R24] |
| GuardDuty **if** Free Tier applies | ~$0.00 | ~$0.26 | ~$5.16 | 1 GB + 1,000 objects/month/account/Region; **tagging, S3 API and EventBridge rule still billed** [R39] |
| **Self-managed ClamAV** | no licence fee; compute **estimated** tens of $/month | same order | higher, scaling-dependent | ~$19–$47/mo infra + $0.025/vCPU-hour software (secondary) [R46], [R47] — **unverified**, quote/sizing required |
| **Commercial in-account (bucketAV Sophos)** | ~$0.04/GB + vCPU-hours + infra | ~$0.78/GB + vCPU-hours + infra | ~$9.77/GB + vCPU-hours + infra | $0.20/GB + $0.025/vCPU-hour [R46] |
| **Commercial PAYG (CSS)** | ~$99/month minimum | ~$99/month | ~$99/month (48.83 GB < 100 GB included) | $99 incl. 100 GB [R52] |
| **External API / OPSWAT** | **vendor quote required** | **vendor quote required** | **vendor quote required** | no published commercial price [R53] |

**Free allowances do not make production free:** GuardDuty's 1 GB/1,000-object allowance is per account per Region and excludes on-demand scans, tagging, S3 API calls and the EventBridge managed rule [R39]; S3's 5 GB/20k GET/2k PUT allowance is account/plan-dependent under the changed Free Tier [R19], [R20]; CloudFront's 1 TB/10M-request allowance is an Always Free Tier subject to change [R7]. At scenario C, none of these materially offsets the delivery bill.

#### 12.2.6 Scanning recommendation — **requires approval** (no scanner selected)

**Recommendation for further approval: Amazon GuardDuty Malware Protection for S3**, scoped to a **quarantine-only prefix**, enabled as an independent feature (no detector needed), with **post-scan tagging enabled before first upload**, a **TBAC deny-by-default bucket policy**, and an EventBridge consumer for scan-result reconciliation. Rationale: lowest operational burden; documented in-Region, isolated, no-internet scanning (best GDPR posture) [R32]; documented TBAC primitive for quarantine-until-clean [R38]; 100 GB object ceiling far above the app's 100 MiB limit [R35]; per-GB/per-object pricing that is modest at all three illustrative scenarios; no scanner hosts or signature DB to maintain; can be enabled without the full GuardDuty detector [R8].

**Caveats / unverified:** exact Region-specific rates and feature availability; Free Tier applicability; behaviour when GuardDuty is unavailable (must fail closed); `UNSUPPORTED` (password-protected PDF/DOCX CVs) must never be treated as clean; SSE-C/client-side encryption are unsupported [R31]; tag limit 10/object [R37]; scanning of promoted copies if the public prefix is also protected (double billing); availability of allow-listing.

**Alternatives:** self-managed ClamAV if full engine/signature control and no per-GB fee are required — at the cost of high maintenance and a 2 GB ceiling [R43], [R44]; commercial in-account scanner (bucketAV Sophos / CSS) if multi-engine detection or vendor support is required — at a materially higher fixed/variable cost; **external API scanners are not recommended for private CVs** without a DPA and transfer assessment. **No scanner was enabled or purchased.**

### 12.3 Workstream 3 — administrator testimonial photo/video upload design (evaluation only)

**Design status:** a **paper design**, not implemented. **No new endpoint, source file, environment variable, dependency, upload limit, middleware/CSP change, or media access-control change was created.** The existing `POST /api/admin/cms/media` route uses `guardMutation(request, ['owner','admin','editor'])` + `throttleCmsMutation` and buffers the file via `request.formData()`/`arrayBuffer()`; `MAX_UPLOAD_BYTES.video` is 100 MiB, while Netlify's buffered request/response ceiling is **6 MB** (≈4.5 MB effective for binary) and is not configurable [R27], [R55]. That mismatch is why direct-to-S3 upload is proposed — but **implementing it requires the separate approvals in §12.9**.

#### 12.3.1 The 15 required controls, mapped to the design

| # | Required control | Proposed design (evaluation only) | Evidence / status |
|---|---|---|---|
| 1 | **Admin session / role / CSRF** | Keep the existing `guardMutation` session+role check and CSRF protection on the **authorize** and **finalize** requests; these are server-side JSON calls carrying no file bytes, so they fit inside the 6 MB ceiling. Never accept an authorize/finalize call from an anonymous client. | **documented** (existing route); **requires approval** to add endpoints |
| 2 | **Server-authorized upload request** | Browser first calls an admin-only authorize endpoint with the intended media type (`testimonial-photo` / `testimonial-video`) and a client-declared size/type. Server validates intent, session, role, CSRF, rate limit and quota, and returns a short-lived, scoped authorization. The browser never receives AWS credentials — only the signed POST fields or signed per-part URLs. | **documented** mechanism [R11], [R12]; **requires approval** |
| 3 | **CSPRNG server-generated keys** | Server generates the object key with a CSPRNG (e.g. `crypto.randomUUID()`), e.g. `quarantine/<uuid>` for the pending object and `public/testimonial-video/<uuid>.mp4` on promotion. The browser-supplied filename is never used as a key; it is retained only as untrusted `original_filename` metadata, as the existing `mediaAssets` schema already does [R30]. Deterministic `key` conditions in the POST policy prevent overwriting any other key. | **documented** (POST policy `key` exact match / `starts-with` [R12]) |
| 4 | **Short-lived restricted authorization** | Presigned POST policy with a short `expiration` (illustrative 60–300 s; **estimated**, decide at approval), exact `bucket`, exact `key`, `success_action_status`, required `x-amz-server-side-encryption`, and checksum field. Presigned URLs/POSTs are **bearer tokens**; IAM-user credentials allow up to 7 days, but temporary role credentials expire when the session expires (≈1 h for AssumeRole, ≈6 h for instance profiles) — use short TTLs and, optionally, an `s3:signatureAge` bucket-policy deny and network-path restriction [R11]. | **documented** [R11], [R12]; short TTL **estimated** |
| 5 | **Server-enforced size / permitted fields** | Use the POST policy condition **`content-length-range`** with a strict min>0 and max equal to the approved per-type ceiling (photo 8 MiB, video 100 MiB **as currently configured — no limit change is approved**), plus exact/prefix conditions on `Content-Type`, `Content-Disposition`, `Cache-Control`, `Content-Encoding`, `x-amz-meta-*` and signing fields. All other form fields are rejected by the policy. | **documented** [R12]; **requires approval** for any limit change |
| 6 | **Direct browser upload to private quarantine** | Browser POSTs the file **directly** to a private S3 quarantine bucket/prefix; the Netlify Function never receives the bytes. All four Block Public Access settings on, `Bucket owner enforced` (ACLs disabled), SSE-KMS or SSE-S3 (**not SSE-C**, which GuardDuty cannot scan [R31]), bucket policy denying all principals except the signing role and GuardDuty, and a scoped CORS rule allowing only the site origin and required headers/methods. | **documented** [R10], [R31], [R38] |
| 7 | **Pending-upload record linked to admin / intended media type** | A new `pending_uploads` row stores: random id, quarantine key, admin id, intended `purpose`, declared size/type, checksum, `status` (`initiated`/`uploaded`/`scanning`/`clean`/`promoted`/`rejected`/`expired`), `created_at`, `expires_at`. This is a **schema change with its own migration approval** (§12.4.6). | **requires approval**; **documented** need for state machine [R9], [R54] |
| 8 | **Server verification of existence / measured size / checksum / actual contents** | Finalize handler calls `HeadObject`/`GetObject`: confirm the object exists at the exact key, read **measured** `ContentLength` (not the client's claim), compare the server-computed SHA-256 (or an S3-stored SigV4 checksum — CRC64NVME/CRC32C/SHA-256 [R11], [R13]) against the pending record, verify ETag/versionId, and read the leading bytes for magic-byte inspection. Reject on any mismatch. | **documented** [R11], [R13]; **requires approval** |
| 9 | **MIME and magic-byte validation** | Reuse the existing server-side detection: `src/lib/files/signatures.ts` (MP4 `ftyp` at offset 4, WebM `1A 45 DF A3`), `validate.ts` (`testimonial-video` → mp4/webm; `cv` → pdf/docx), and store `detectedMimeType` vs untrusted `declaredMimeType` as `mediaAssets` already does [R30]. Declared `Content-Type` is only a policy hint, never proof. | **documented** (code + [R12]) |
| 10 | **Malware-scan workflow / result handling** | GuardDuty (recommended, §12.2.6) protects **only** the quarantine prefix; an EventBridge rule consumes `GuardDuty Malware Protection Object Scan Result` and correlates on `bucketName`/`objectKey`/`versionId`/`eTag`, updating `pending_uploads.status`. `COMPLETED` + `NO_THREATS_FOUND` → clean; `THREATS_FOUND`/`UNSUPPORTED`/`ACCESS_DENIED`/`FAILED`/timeout → fail closed, alert, manual review. TBAC denies all reads until the clean tag [R38]. | **documented** [R32], [R36], [R38], [R54] |
| 11 | **Promotion only after validation AND successful scan** | Only when measured size + checksum + magic bytes + declared/detected MIME **and** a clean scan result all match does the server `CopyObject` the quarantine object to the public-media prefix/bucket (new CSPRNG key), create the `mediaAssets` row with `visibility='public'` and the correct `purpose`, and mark the pending row `promoted`. Promotion is the **only** path into the public origin. | **documented** [R9], [R38]; **requires approval** |
| 12 | **Rejection / deletion** | On any failed check: delete the quarantine object (S3 `DELETE`/`CANCEL` requests are free [R18]), mark pending `rejected`, write an `activity_logs` entry, and surface a generic admin error. Never fall back to serving an unverified object. | **documented** [R18] |
| 13 | **Abandoned / incomplete multipart expiry** | Configure a bucket lifecycle rule with **`AbortIncompleteMultipartUpload`** (AWS's own example uses 7 days) plus a quarantine-prefix expiration rule; a reconciliation job expires pending rows whose `expires_at` has passed and deletes orphan objects. Incomplete multipart **parts are billed until aborted** [R13], [R14], so this is also a cost control. | **documented** [R13], [R14] |
| 14 | **Rate limits / quotas / audit / cost controls** | Keep `throttleCmsMutation`; add per-admin and per-site quotas on authorize calls, pending uploads, bytes/month and object counts; log every authorize/finalize/promote/reject/download to `activity_logs`; tag objects/buckets for cost allocation; set AWS Budgets + Cost Anomaly Detection + CloudWatch alarms and a monthly usage review. **Budget alerts do not necessarily prevent charges** — AWS Budgets data is refreshed only up to three times a day, typically 8–12 hours apart, and alerts are notifications/actions, not a hard spend cap [R56]. | **documented** [R48], [R56]; **requires approval** |
| 15 | **Strict public-media vs private-applicant-document separation** | Three distinct buckets (or, at minimum, three disjoint prefixes with distinct IAM policies): **quarantine**, **public-media**, **private-CV**. Only `public-media` is attached to CloudFront via OAC. Quarantine and private-CV are never public, never CDN origins, never enumerable, and never reachable through `/api/media/[...key]` (which already filters `visibility='public'` [R30]). Preserve the existing `immi-public` / `immi-private` Blobs separation semantics for any residual assets. | **documented** [R10], [R30], [R57] |

#### 12.3.2 Presigned POST policy vs presigned PUT — official-document evaluation

**documented** — A presigned **POST** carries a base64-encoded, signed JSON policy with `expiration` + `conditions`; conditions support exact match, `starts-with`, and **`content-length-range`** (minimum and maximum uploaded size) and apply to `bucket`, `key`, `Content-Type`, `Content-Disposition`, `Cache-Control`, `Content-Encoding`, `Expires`, `success_action_status`, `success_action_redirect`, `x-amz-algorithm`, `x-amz-credential`, `x-amz-date`, `x-amz-security-token`, and `x-amz-meta-*` [R12]. AWS's SDK ships `@aws-sdk/s3-presigned-post` / `createPresignedPost` with `Conditions`, `Fields` and `Expires` [R58].

**documented** — A presigned **PUT** URL grants time-limited access to one object/key; it is a **bearer token**, limited by the signer's permissions, expires with the underlying credentials, and **replaces an existing object with the same key**; SigV4 presigned uploads can carry checksum headers [R11]. AWS documents `s3:signatureAge` and IP/VPC network-path restrictions for presigned URLs [R11].

**documented / unverified** — The official POST-policy page is the source that documents `content-length-range` [R12]; the fetched API-reference pages for `POST Object` returned an S3 "Welcome" redirect from this sandbox, so **no official numeric maximum for POST Object was verified**; the general 5 GB single-PUT/5 TB multipart limits are documented elsewhere [R13]. A plain presigned PUT **does not provide a POST-policy `content-length-range`**; signed `Content-Length` (exact value) is possible but strict and awkward for browser multipart, and the practical size-safety gap is widely reported in secondary material [R59]. **unverified** — exact `Content-Length` enforcement behaviour for presigned PUT in this scenario; must be confirmed in a staging test before reliance.

**Recommendation (requires approval):** prefer **presigned POST with `content-length-range`** for single-part uploads up to the currently approved ceilings, because size, key, bucket, type and field restrictions are enforced by S3 before the object is written. Use **presigned PUT per part** only for multipart/resumable uploads of large videos (100 MiB), with server-side part-count/part-size validation and `CompleteMultipartUpload` guarded by the same pending-upload state machine; multipart completion itself triggers a scan [R9]. **Regardless of mechanism, the server's own measured size/checksum/magic-byte verification (item 8) is mandatory** — a signed policy is a constraint, not proof of content. For 100 MiB videos, note that `MAX_UPLOAD_BYTES.video` is 100 MiB and **no upload-limit change is approved** [R30].

**CSP / CORS caveat (documented, requires approval):** the current CSP is `media-src 'self' blob:`, `connect-src 'self'`, `form-action 'self'` [R30]. A direct browser POST/PUT to an external S3 hostname requires narrowly scoped CSP additions and matching S3 CORS rules; **the user explicitly prohibited middleware/CSP/media-access-control changes in this task**. These are listed as **requires approval** items in §12.9 and were **not** made.

### 12.4 Workstream 4 — separate secure CV-upload workflow (evaluation only)

#### 12.4.1 Preserved invariants from the existing code (documented)

- `POST /api/assessment` is the site's **only public write endpoint**; applicants have no account/session. It enforces `multipart/form-data`, a `MAX_SUBMISSION_REQUEST_BYTES = 12 MiB` ceiling **before** `formData()`, a 60 KiB answers ceiling, honeypot, rate limits, whole-form Zod validation, consent against published policy versions, duplicate detection and idempotency, then **one transaction** [R30].
- That transaction inserts `consent_records` (immutable snapshot: `termsPageId`/`termsVersion`, `privacyPageId`/`privacyVersion`, `consentText`, `acceptedAt`, `ipHash`, `userAgent`), `assessments` (`referenceNumber`, `idempotencyKey`, `submittedAt`, …), child lists, and — only if a CV is present — `media_assets` + `assessment_attachments`; the consent row is back-linked inside the same transaction, and a failed transaction unwinds the private file [R30].
- `assessment_attachments` uses `onDelete: 'restrict'` on both FKs and a unique `media_asset_id`, so deleting an assessment/media row cannot silently orphan or destroy a private applicant document [R30].
- The **only** route serving a private applicant document is `GET /api/admin/assessments/[id]/attachments/[attachmentId]`, which calls `guardAssessmentRead()`, checks `isArchived`, reads from the `'private'` store, writes an `assessment.attachment_downloaded` audit entry, and returns `Content-Disposition: attachment`, `Cache-Control: no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, `nosniff`, a sandbox CSP, `same-origin` CORP and `no-referrer` [R30].
- `media_assets` stores `storageKey`, `visibility`, `purpose`, `originalFilename` (untrusted), `storedFilename`, `declaredMimeType` vs `detectedMimeType`, `sizeBytes`, `checksumSha256`, `uploadedBy`, `createdAt`, `archivedAt`; `visibility='private'` rows are only ever readable through the authorized download proxy and `storageKey` is never returned to a public client [R30].
- The public media proxy filters `visibility='public'`, uses server-detected MIME, `nosniff`, sandbox CSP, and buffers `Uint8Array` → `ArrayBuffer` [R30].

#### 12.4.2 Proposed two-phase CV design (no implementation)

1. **Authorize (public, heavily rate-limited):** the applicant's browser requests a short-lived scoped upload authorization bound to a **server-generated random draft/submission token** and to the intended `purpose='cv'`. The server records a `pending_uploads` row with the quarantine key, token hash, expiry and declared size/type. No applicant PII is stored at this phase beyond the existing hashed IP/rate-limit bucket.
2. **Direct upload to private quarantine:** presigned POST (or per-part PUT) restricted by `content-length-range` to the **existing 10 MiB document ceiling** (no limit change), exact key/bucket, permitted `Content-Type` (PDF/DOCX), SSE, and a short TTL. The file lands in the **private-CV quarantine**, never in a public bucket, never attached to a CDN.
3. **Verify + scan:** the server's finalize step confirms existence, measured size, checksum and actual bytes; `src/lib/files/validate.ts` restricts `cv` to pdf/docx with magic-byte inspection; GuardDuty (or the approved scanner) returns a clean result; TBAC denies all reads until clean [R38].
4. **Submission integrity:** `POST /api/assessment` then submits the **full validated assessment payload** together with the pending-upload token (not the file bytes). The existing single transaction is preserved: consent snapshot → assessment → child rows → `media_assets` (private, `purpose='cv'`) → `assessment_attachments` → `activity_logs`. **An unverified, unscanned, mismatched or expired CV must never produce a valid attachment.** If the CV is not clean at submission time, the submission is rejected with a generic error and the applicant is asked to retry; the assessment row is **not** created (preserving the current all-or-nothing behaviour). **requires approval** — this is a UX/behaviour decision.
5. **Consent records / timestamps:** unchanged — the consent snapshot and `submittedAt` are written at submission time inside the same transaction; policy versions are never silently rewritten; `acceptedAt`, `ipHash`, `userAgent` remain [R30].
6. **Incomplete / abandoned assessments:** quarantine lifecycle expiration + `AbortIncompleteMultipartUpload` + a reconciliation job that deletes orphan objects and expires `pending_uploads` rows whose token was never consumed; tokens are single-use and short-lived; no PII is retained for abandoned drafts beyond the existing rate-limit buckets [R13], [R14].
7. **Admin-only downloads:** keep the existing admin route and its `guardAssessmentRead`, archived check, audit entry and security headers. For S3, the handler would generate a **short-lived presigned GET** (or stream server-side) **only after** verifying the attachment's scan status is clean; the URL/key is never logged or exposed publicly. `Content-Disposition: attachment`, `no-store`, `nosniff`, sandbox CSP and CORP remain [R11], [R30].
8. **Audit / retention / deletion:** every authorize, finalize, rejection, promotion, download and deletion writes to `activity_logs`; a retention schedule and deletion runbook must cover the S3 object, all versions, replicas, quarantine leftovers, CDN caches (none for CVs) and DB rows; `archivedAt` soft-delete and `onDelete: restrict` semantics are preserved; deletion is an explicit, logged operation [R30].

#### 12.4.3 Explicit non-goals / prohibitions (documented)

No public media endpoint exposure for CVs; no weakening of assessment submission validation (Zod, honeypot, rate limits, duplicate detection, idempotency, consent checks all remain); **no unverified CV treated as a valid attachment**; no `storageKey` returned to a public client; no public-read ACL, no public bucket policy, no CDN origin for private CVs or quarantine; no new endpoint, migration, or source change in this task.

#### 12.4.4 Proposed changes needing **separate approval** (identification only, not performed)

- **Assessment API:** a new public authorize endpoint and a new finalize/confirm path, plus changes to `POST /api/assessment` to accept a pending-upload token instead of a multipart file; the 12 MiB request ceiling and 6 MB Netlify ceiling would need re-verification (the new payload is small, but **no limit change is approved**).
- **Pending-upload model:** new `pending_uploads` table (id, token hash, quarantine key, bucket, purpose, admin/draft linkage, declared size/type, checksum, status, scan result/status reasons, created/expires/consumed timestamps), plus scan-status columns on `media_assets` (`scanStatus`, `scanResultAt`, `scannerVersion`/provider, object version/ETag) and possibly a `cv_scan_results`/`review_queue` table for manual review.
- **Schema/migration:** a new Drizzle migration (`0001_*`) and `_journal.json` entry, new indexes/FKs, and any enum additions (e.g. a `s3` storage provider value for `media_assets.storageProvider`, which currently only has `blobs`/`local`) [R30]. Baseline is 33 tables / 61 indexes / 47 FKs / one `0000_init` [R30]. **No DB connection, inspection, or migration was performed.**
- **Configuration/dependencies:** AWS SDK client (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, presigner), new environment variables for Region/bucket/role/KMS/quarantine TTL/allowed origins, Netlify secret injection with Functions scope [R27], S3 CORS/lifecycle/bucket policies, EventBridge rule + consumer, and narrowly scoped CSP/CORS additions. **None was added.**

### 12.5 Workstream 5 — secure delivery of validated public testimonial videos (evaluation only)

**documented** — CloudFront **Origin Access Control (OAC)** is AWS's recommended way to keep an S3 origin private while serving through a CDN; OAC supports all S3 buckets in all Regions (including newer opt-in Regions), SSE-KMS, and dynamic PUT/DELETE; it requires `Bucket owner enforced` and cannot be combined with an S3 website endpoint or Lambda@Edge origin redirect [R57]. CloudFront **Range GET** support serves byte ranges from cache and forwards to the origin when not cached; S3 supports Range GETs, so `<video>` seeking/partial-content works; CloudFront begins streaming as soon as the first byte arrives from the origin; with caching enabled, objects >50 GB are not cached (range requests can work around that) [R25], [R26]. CloudFront supports `Content-Type`/`Content-Disposition` via origin headers or response-header policies; invalidation pricing is 1,000 free paths/month then $0.005/path [R21], [R7].

#### 12.5.1 Proposed delivery architecture

1. **Dedicated public-media origin.** A separate S3 bucket/prefix containing **only** objects promoted in §12.3 item 11 (validated + clean + published). All four Block Public Access settings remain on; the bucket is private and reachable **only** via the CloudFront OAC principal [R10], [R57]. Quarantine and private-CV buckets/prefixes are **never** attached to any distribution, never granted to the OAC principal, and never reachable via a wildcard path pattern.
2. **Only validated published objects served.** The DB `mediaAssets` row (`visibility='public'`, `archivedAt IS NULL`, server-detected `video/mp4` or `video/webm`) is the publication gate; promotion is the only writer to the public prefix. Objects are addressed by CSPRNG keys, so no listing/enumeration is possible; the CDN path is derived from a validated DB lookup, not from user input.
3. **Range / seeking.** Enable Range GET support on the distribution's cache behaviour; keep default CloudFront caching so a viewer seeking into a 100 MiB video gets `206 Partial Content` from cache/origin. **estimated** — many Range requests per play session increase the request count (still far below the 10M/month free tier at the illustrative scenarios [R7]).
4. **Cache / invalidation.** Use long `Cache-Control: public, max-age=31536000, immutable` on **immutable content-addressed keys** so invalidation is rarely needed; prefer publishing a new key over overwriting. When a testimonial is removed, create an explicit invalidation for that exact path (first 1,000/month free [R21]) and set short TTL/`no-store` on any unpublish response. **Safe removal:** mark `archivedAt`, invalidate the CDN path, delete the promoted object (and its versions), audit the action, and verify no cached copy remains reachable; **cached copies at edges persist until TTL/invalidation completes** — this is a GDPR erasure caveat.
5. **Content-Type / Content-Disposition.** Serve the **server-detected** MIME (`video/mp4`, `video/webm`), never the browser's declared type; use `inline` for playback or `attachment; filename=…` for downloads; set `X-Content-Type-Options: nosniff`, a restrictive response CSP (`default-src 'none'; sandbox`), and CORS only if the player needs it. Avoid serving any object with a content type that could be interpreted as HTML.
6. **CSP requirements (documented, requires approval).** Current CSP `media-src 'self' blob:` / `connect-src 'self'` blocks an external CDN origin [R30]. A narrow, explicitly approved `media-src` addition for the specific CloudFront hostname (and `connect-src` only if the player uses fetch/Range via JS) is needed. **No middleware or CSP change was made in this task**, per the user's instruction.
7. **Existing proxy for small assets.** **Recommendation (requires approval):** keep `/api/media/[...key]` for small public assets (logos, flags, photos) because it already enforces `visibility='public'`, server-detected MIME, `nosniff`, sandbox CSP and immutable caching [R30]. It is **not** suitable for large videos: it buffers `Uint8Array` → `ArrayBuffer` inside a `NextResponse` and is constrained by the 6 MB buffered / 20 MB streamed response ceiling [R27], so a 100 MiB video must use the CDN path. Any eventual proxy removal/invalidation must be staged, with header and access-control equivalence verified, and separately approved.
8. **Consequences of intentionally public testimonial videos (documented / requires approval).** A published testimonial video is deliberately world-readable: anyone with the URL can view/download it, search engines and third parties may cache/copy it, erasure cannot be guaranteed once distributed, and the content contains personal data (likeness/voice) requiring its **own documented consent** separate from assessment consent. Bandwidth is billable and hotlinking/bots can amplify cost; use CDN WAF/bot controls, signed URLs only if the decision changes (it would no longer be "public"), monitoring, and rate limits. Quarantine objects, pending uploads and private CVs must **never** become reachable through this path.

### 12.6 Workstream 6 — consolidated monthly cost table, hidden charges and cost controls

#### 12.6.1 Assumptions and rate basis

**estimated** — All figures are USD/month, rounded, built on the §12.2.5 illustrative workload and the **documented/estimated** rates in §12.1.3. They are **not** a quote, not a bill, and not verified for any account. Region-specific S3/GuardDuty rate tables were **not** extractable from the official pricing pages in this sandbox (**unverified**) [R18], [R16]. "Transferred" is public-media delivery to viewers via CloudFront; it is **not** S3 internet egress, because CloudFront origin fetches from AWS are free [R7]. Netlify plan, Turso plan, AWS Support plan, taxes, Marketplace subscriptions, and optional backup/replication are **excluded** from the totals (no plan visibility).

| Rate used | Value | Label |
|---|---|---|
| S3 Standard storage | $0.023/GB-month | **estimated** (secondary; Ireland/Stockholm) [R23] |
| S3 PUT/COPY/POST/LIST | $0.005/1,000 | **estimated** (secondary) [R23] |
| S3 GET/other | $0.0004/1,000 | **estimated** (secondary) [R23] |
| S3 internet egress (Ireland) | $0.09/GB | **documented** [R18] |
| S3 → CloudFront origin fetch | $0 | **documented** [R7] |
| GuardDuty scan | $0.09/GB + $0.215/1,000 objects | **documented** (US East; Region-specific rate **unverified**) [R16], [R24] |
| EventBridge | $1.00/million events; AWS-service events free | **documented** [R50], [R51] |
| SQS | 1M requests/month free, then metered | **documented** [R48] |
| CloudFront egress | 1 TB free, then $0.085/GB (Europe) or $0.110/GB (Nigeria/Africa group) | **documented** [R7] |
| CloudFront HTTPS requests | 10M free, then $0.0120/10,000 | **documented** [R7] |
| CloudFront invalidation | 1,000 paths free, then $0.005/path | **documented** [R21] |

#### 12.6.2 Consolidated table — three scenarios (estimated; scanning shown separately)

| Cost line | A — staging (2 GB / 10 GB) | B — small production (25 GB / 200 GB) | C — growth (250 GB / 2,000 GB) |
|---|---|---|---|
| **S3 storage** | ~$0.05 | ~$0.58 | ~$5.75 |
| **S3 PUT/POST/COPY/LIST requests** (~3 writes/object) | ~$0.001 | ~$0.01 | ~$0.08 |
| **S3 GET/other requests** (~4 reads/object + 20/GB delivered) | <~$0.001 | ~$0.002 | ~$0.02 |
| **S3 data transfer — CloudFront origin fetch** | $0 | $0 | $0 |
| **S3 data transfer — direct private/admin downloads** (0.1 / 2 / 20 GB illustrative) | ~$0.01 | ~$0.18 | ~$1.80 |
| **S3 data transfer — replication/backup to a second Region** | $0 (not modelled) | $0 (not modelled) | $0 (not modelled) |
| **S3 retrieval / lifecycle transition / tagging fees** | small, **unverified** | small, **unverified** | small, **unverified** (tagging is **not** in GuardDuty Free Tier [R39]) |
| **Malware scanning — GuardDuty (separate line)** | **~$0.03** (or ~$0.00 if Free Tier applies) | **~$0.46** (or ~$0.26) | **~$5.47** (or ~$5.16) |
| **Malware scanning — alternative: ClamAV self-managed** (separate line) | **$0 licence + estimated tens of $/month compute** | same order | higher, scaling-dependent (**unverified**) |
| **Malware scanning — alternative: commercial in-account** (separate line) | **~$0.04/GB + vCPU-hours + infra** | **~$0.78/GB + vCPU-hours + infra** | **~$9.77/GB + vCPU-hours + infra** |
| **Malware scanning — alternative: commercial PAYG / external API** (separate line) | **~$99/month minimum** or **vendor quote required** | same | same |
| **EventBridge / SQS / Lambda orchestration** | <~$0.01 | <~$0.01 | ~$0.02 (plus any managed-rule cost, **unverified**) |
| **CloudFront egress (Europe group)** | $0 (under 1 TB free) | $0 (under 1 TB free) | ~$85 (1,000 GB × $0.085) |
| **CloudFront egress (Nigeria/Africa group)** | $0 | $0 | ~$110 (1,000 GB × $0.110) |
| **CloudFront HTTPS requests** | $0 (under 10M free) | $0 | $0 (under 10M free at assumed request rate) |
| **CloudFront invalidation** | $0 | $0 | $0 if ≤1,000 paths/month; **~$20 in the illustrative 5,000-path case, which is the case included in the totals below** [R21] |
| **Separately operated scanning infrastructure** (EC2/EBS/SNS/SQS/CloudWatch) | not in GuardDuty variant; **estimated** tens of $/month for ClamAV/commercial | same | higher (**unverified**) |
| **Optional backup / replication** | not modelled: duplicates storage + cross-Region transfer + requests [R18] | not modelled | not modelled |
| **Netlify plan / Turso plan / AWS Support / tax** | **excluded — unverified** | **excluded — unverified** | **excluded — unverified** |
| **Illustrative total (GuardDuty + CloudFront, EU edge)** | **~$0.08/month** | **~$1.2/month** | **~$118/month** |
| **Illustrative total (GuardDuty + CloudFront, Nigeria/Africa edge)** | **~$0.08/month** | **~$1.2/month** | **~$143/month** |

**Arithmetic note (estimated):** scenario C totals include the illustrative 5,000-path invalidation case (~$20) and 1,000 GB of egress above the 1 TB free tier; **without** the invalidation case the corresponding totals are **~$98/month (EU edge)** and **~$123/month (Nigeria/Africa edge)**. Totals are rounded and should be read as order-of-magnitude illustrations, not precise bills.

**Interpretation (estimated):** at staging/small-production scale the dominant costs are storage, scanning and direct-download egress — all small; delivery is inside the free allowance. At growth scale, **CDN egress dominates** (~$85–$110), followed by storage (~$6) and scanning (~$5.5). Choosing a European Region does **not** change the CDN price group — that is set by the **viewer's** location, and a West-African audience is billed in the higher Nigeria/Africa group [R7]. Using a CloudFront flat-rate plan (Free/Pro/Business) is an alternative cost model with published monthly prices and usage allowances [R22]; **requires approval** and verification of allowance terms. **Free allowances do not eliminate costs at production scale** [R39], [R19], [R20], [R7].

#### 12.6.3 Unexpected-charge sources (documented / estimated)

1. **Incomplete multipart uploads** — parts are billed until completed or aborted; use `AbortIncompleteMultipartUpload` [R13], [R14].
2. **Double scanning / re-scanning** — protecting both quarantine **and** public prefixes, or `CopyObject` promotion into a protected prefix, triggers another scan; versioning scans every new version [R9], [R31]. On-demand/rescan APIs are excluded from the GuardDuty Free Tier [R39].
3. **S3 Object Tagging, S3 GET/PUT API calls, EventBridge managed rule** — explicitly **not** in the GuardDuty Free Tier [R39].
4. **Abandoned quarantine objects** without lifecycle expiry accumulate storage; `DELETE`/`CANCEL` are free but the storage is not [R18].
5. **Presigned URL abuse / overwrite** — a presigned URL is a bearer token usable repeatedly until expiry and can replace an existing same-key object [R11]; abandoned uploads still consume storage/requests.
6. **CDN**: Range/seeking multiplies requests; cache misses cause origin fetches; invalidations beyond 1,000 paths/month cost $0.005 each [R21]; hotlinking/bots inflate egress; the Nigeria/Africa price group is higher than Europe [R7].
7. **Versioning / replication / backups** — noncurrent versions, cross-Region transfer, replicated storage and replication requests are separate charges; replication can also trigger duplicate scans [R18], [R31].
8. **Storage-class minimums and retrieval fees** — S3 Standard-IA/One Zone-IA 30-day, Glacier 90/180-day minimums plus retrieval fees [R18].
9. **KMS, CloudWatch, CloudTrail data events, Lambda/Step Functions, WAF** — metered separately; not modelled.
10. **Free Tier / credit expiry** — the changed AWS Free Tier is credit-based for new accounts and credits expire [R20]; allowances do not roll over [R48].

#### 12.6.4 Recommended cost controls (requires approval; none configured)

- **AWS Budgets** actual + forecast alerts per service/account, **Cost Anomaly Detection**, CloudWatch usage alarms, cost-allocation tags, and a monthly usage review [R56].
- **Upload quotas** — per-admin and per-applicant authorize limits, max object size enforced by `content-length-range`, pending-upload counts, bytes/month caps, and rate limits (§12.3 item 14).
- **Lifecycle cleanup** — quarantine TTL, `AbortIncompleteMultipartUpload`, noncurrent-version expiration, and a reconciliation job [R13], [R14].
- **Delivery** — immutable keys + long cache TTL, minimal invalidations, scoped OAC, WAF/bot controls, and CDN request/egress monitoring.
- **Explicit statement (documented):** **budget alerts do not necessarily prevent charges.** AWS Budgets information is updated up to three times daily, typically 8–12 hours apart; budgets provide tracking, notifications and configurable actions, not a real-time hard spend cap, and cannot undo charges already incurred [R56]. Budget actions can apply IAM/SCP policies but are not instantaneous and are not a substitute for quotas and lifecycle cleanup.

### 12.7 Workstream 7 — staging-access checklist preserved, staging blockers unchanged

**Preserved unchanged:** the concise staging-access checklist in **§11.6** (and `docs/DEPLOYMENT.md` **§13.2**) and the precise staging-deployment checklist in **§13.3**. They are not rewritten or weakened here. All secrets must be supplied through supported secure configuration interfaces only; document only non-secret identifiers; never ask for or write down passwords/tokens in chat or docs.

**Historical-note clarification:** the §11.6 cell reading "Not applicable yet — no provider selected" records the state at the time §11 was written. Since then the user confirmed **Amazon S3** as the implementation target. That cell is **historical**, not a reopening of provider selection: no Region, scanner, architecture, credential, bucket, or environment variable has been approved, so the checklist's practical gate ("only after provider selection and approval") is still **not satisfied** — approval is now needed at the finer granularity listed in §12.9. §11.6 is deliberately left intact.

**Staging gate — still blocked (documented from earlier audits, re-confirmed in §12.11):** all twelve checked staging-related environment names were `not set` (`NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `NETLIFY_STAGING_SITE_ID`, `NETLIFY_SITE_URL`, `NETLIFY_STAGING_SITE_URL`, `NETLIFY_STAGING_URL`, `STAGING_NETLIFY_SITE_ID`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `TURSO_STAGING_DATABASE_URL`, `TURSO_STAGING_AUTH_TOKEN`, `STAGING_DATABASE_URL`); Netlify/Turso connectors are `unsupported`; no AWS/Netlify/Turso access, staging site/DB IDs, deploy authorization, staging-only secrets, secure secret-injection channel, separation-from-production confirmation, function/edge logs, hosted build, migration, or admin provisioning. `GH_TOKEN`/`GITHUB_TOKEN` are GitHub credentials, **not** staging credentials. Deploy/build hosts are unreachable from this sandbox while npm/GitHub are reachable. **No assumption of AWS, Netlify, Turso, or secure secret-injection access is made.**

**No staging deploy until** staging-only access via a supported secure interface **and** written separation-from-production confirmation exist. **No staging resources, migrations, administrator, deployment, or Git operation occurred.** Production actions remain prohibited.

### 12.8 Remaining uncertainties (unverified; none resolved by this evaluation)

1. Region-specific **S3** and **GuardDuty** rate tables (Region selector did not render) [R18], [R16].
2. **Feature-level** GuardDuty Malware Protection for S3 availability in each specific European Region, and opt-in Region enablement [R15], [R4], [R17].
3. The AWS account's **Free Tier / credit** status under the changed programme [R20], [R19].
4. Whether **presigned PUT** with signed `Content-Length` reliably enforces exact size in the browser; the official POST-policy page documents `content-length-range` [R12], [R59]. No official numeric POST Object maximum was verified from this sandbox.
5. **Netlify plan** eligibility for EU function regions, project-wide region behaviour for generated Next.js functions, and the hosted build's Deno/edge behaviour [R27]; the 6 MB / ≈4.5 MB and 20 MB ceilings remain [R55].
6. **Turso database residency**, current production state, and billing plan.
7. Actual **audience geography and latency** to each European Region; no measurement performed.
8. Commercial scanner **vendor quote**, Marketplace availability per European Region, DPA/sub-processor terms, and whether any telemetry or scan data leaves the EEA [R45], [R46], [R52], [R53].
9. Scanning behaviour on **password-protected / `UNSUPPORTED`** CVs, allow-listing of scan-result false positives, and GuardDuty unavailability semantics [R36], [R35].
10. CloudFront flat-rate plan **usage-allowance terms** and behaviour on excess [R22].
11. Effective **CSP/CORS** behaviour for direct browser uploads and CDN playback in the hosted runtime; no middleware/CSP change is permitted in this task.
12. Exact **object counts, average sizes, request amplification and cache-miss ratios** — all illustrative; real values require production telemetry.
13. Whether the existing `/api/media/[...key]` proxy can safely remain for small assets once the CDN path exists; no media access-control change was made.
14. **Hosted/staging behaviour of everything above** — no live AWS integration test or hosted build was run (explicitly prohibited).
15. `POST /api/assessment` behaviour under a token-based CV flow, and the exact migration shape for `pending_uploads` / scan-status columns — **no schema or migration work performed**.

### 12.9 Exact approvals required (each separate, explicit, written; none granted)

1. **European Region selection** — approve one specific Region from §12.1.6 after confirming Region-specific pricing, GuardDuty feature availability, Netlify function region, Turso residency and DPA/sub-processor review. **No Region is approved.**
2. **Malware-scanning approach and cost** — approve one of §12.2.1–12.2.3 (recommendation: GuardDuty Malware Protection for S3, §12.2.6), including the spend, free-tier assumptions, tagging/API/EventBridge costs, and manual-review process. **No scanner selected or enabled.**
3. **Cost disclosure and billing approval before any spend** — approve the §12.6 estimates/ranges, a budget, alerts (with the §12.6.4 caveat), the creation of an AWS billing account and any Marketplace subscription. **Before** any account, bucket, subscription or paid service.
4. **S3 storage architecture approval** — the §12.3 design (bucket/prefix topology, IAM roles, KMS/SSE, Block Public Access, CORS, lifecycle, quarantine TTL, TBAC, EventBridge consumer, pending-upload state machine), plus **new endpoints**, the **`pending_uploads` table and its own migration approval**, and any new dependencies.
5. **Assessment API / CV workflow changes (§12.4)** — approve the token-based two-phase flow, the changed `POST /api/assessment` contract, the rejection-on-unclean-CV behaviour, unchanged consent/timestamp semantics, admin-only download changes, audit/retention/deletion runbooks, and the associated schema/migration.
6. **Public-media origin / CDN / CSP / proxy design (§12.5)** — approve CloudFront distribution + OAC, Range/seeking, cache/invalidation, `Content-Type`/`Content-Disposition` policy, the narrow `media-src`/`connect-src` CSP additions, retention of the small-asset proxy, safe unpublish/removal, and the **explicit acknowledgement that published testimonial videos are intentionally public** (separate consent + erasure caveats).
7. **New environment variables / credentials** — approve exact variable names and injection through supported secure interfaces with Functions scope; **secrets never in chat or docs**.
8. **Upload-limit decision** — any change to `MAX_UPLOAD_BYTES` or `MAX_SUBMISSION_REQUEST_BYTES` needs evidence that every layer supports it plus separate approval. **No limit was changed.**
9. **Cost/billing controls** — approve budgets, alerts, quotas, lifecycle rules, tagging and monitoring, acknowledging alerts do not prevent charges.
10. **GDPR / data-protection package** — approve DPA/sub-processor review, transfer-impact assessment, privacy-notice updates, testimonial-publication consent, retention/deletion schedules, and records-of-processing/DPIA work; acknowledge a European Region alone does not guarantee compliance.
11. **Staging resource creation and deployment** — separate approval for separate staging buckets/credentials/site/DB, written separation-from-production confirmation, and a non-production deploy; not authorized now.
12. **Staging read-only schema inspection, then a separate non-destructive migration approval** — after comparing with `drizzle/0000_init.sql` (33 tables / 61 indexes / 47 FKs) and `drizzle/meta/_journal.json` (one `0000_init`), stop on conflict. **No migration run.**
13. **Staging administrator provisioning** (if needed) — staging-only account, synthetic data only, no real applicant documents, no production admin.
14. **Hosted verification** — approve a single hosted build + function/edge log review and staged verification matrix before any claim that staging works.
15. **GitHub commit and push** — **only after successful staging verification AND a separate explicit approval**. No Git operation is authorized now.
16. **Production** — all production deployment, database access/migration, resource modification, administrator provisioning and credentials remain prohibited. No production action was taken or is requested.

### 12.10 Official references used

| Ref | Source | What it establishes |
|---|---|---|
| R1 | `https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-region-billing-codes.html` | Eight European Region codes/names |
| R2 | `https://aws.amazon.com/compliance/eu-data-protection/` | EU Regions (FR/DE/IE/IT/ES/SE), UK/CH adequacy, customer data stays in chosen Region, DPA/SCCs, EU-only service selection |
| R3 | `https://aws.amazon.com/compliance/hds/` | Six EEA Regions; customer's own compliance responsibility |
| R4 | `https://docs.aws.amazon.com/guardduty/latest/ug/gdu-service-account-region-list.html` | Spain/Zurich/Milan marked opt-in |
| R5 | `https://aws.amazon.com/about-aws/global-infrastructure/localzones/locations/`, `https://docs.aws.amazon.com/local-zones/latest/ug/available-local-zones.html` | Lagos Local Zone parent = `af-south-1` (Africa, Cape Town) |
| R6 | `https://aws.amazon.com/cloudfront/features/` | Lagos, Nigeria PoP; 750+ PoPs / 15 RECs; geolocation |
| R7 | `https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/` | 1 TB / 10M free; $0.085/GB EU, $0.110/GB Nigeria/Africa group; $0.0120/10k HTTPS; $0.020/GB EU data transfer out to origin; free AWS-origin fetch |
| R8 | `https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html` | Independent-feature mode; same-Region/same-account only; no cross-Region protection |
| R9 | `https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html` | Prefix scoping (≤5), IAM role, tagging values, managed rule, in-Region isolated VPC scan, EventBridge/CloudWatch results, PUT/POST/Copy/CompleteMultipart triggers |
| R10 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/GettingStartedS3CLI.html`, `.../troubleshoot-403-errors.md`, `.../about-object-ownership.html`, `https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_s3_syntax.html` | Four Block Public Access settings (default on), Bucket owner enforced |
| R11 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.md` | Presigned URL mechanics, bearer-token nature, credential expiry, same-key overwrite, SigV4 checksums, `s3:signatureAge`, network restrictions |
| R12 | `https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html` | POST policy conditions: `content-length-range`, exact/starts-with, `key`, `bucket`, `Content-Type`, `x-amz-meta-*`, signing fields |
| R13 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.md` | Multipart 1–10,000 parts, checksums/ETags, parts billed until complete/abort, conditional writes |
| R14 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html` | `AbortIncompleteMultipartUpload` 7-day example; no early-delete charge |
| R15 | `https://docs.aws.amazon.com/general/latest/gr/guardduty.html` | GuardDuty endpoints in all eight European Regions |
| R16 | `https://aws.amazon.com/guardduty/pricing/` | $0.09/GB + $0.215/1k objects example; 85% reduction; pricing varies by Region; 1,000-request/1 GB Free Tier; on-demand excluded |
| R17 | `https://docs.aws.amazon.com/config/latest/developerguide/managing-rules-by-region-availability.html` | `guardduty-malware-protection-enabled` Config rule by European Region |
| R18 | `https://aws.amazon.com/s3/pricing/` | Cost components, no minimum charge, DELETE/CANCEL free, LIST at PUT rate, storage-class minimums/retrieval, Ireland $0.09/GB egress example, replication pricing components |
| R19 | `https://aws.amazon.com/free/complete-registration/`, `https://aws.amazon.com/free/storage/s3/` | S3 5 GB / 20k GET / 2k PUT allowance listing |
| R20 | `https://aws.amazon.com/free/free-tier-faqs/`, `https://aws.amazon.com/free/terms/` | Changed credit-based Free Tier; credit expiry; legacy 12-month terms |
| R21 | `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html` | 1,000 free invalidation paths/month, $0.005 thereafter |
| R22 | `https://aws.amazon.com/cloudfront/pricing/` | Flat-rate plans Free/Pro/Business/Premium with monthly prices and usage allowances |
| R23 | `https://upstash.com/blog/aws-s3-pricing-explained-2026`, `https://cloudburn.io/blog/amazon-s3-pricing`, `https://costgoat.com/pricing/amazon-s3` | **Secondary/estimated** EU S3 storage/request rates ($0.023 Ireland/Stockholm, $0.0245 Frankfurt, $0.005/1k PUT, $0.0004/1k GET) |
| R24 | `https://aws.amazon.com/about-aws/whats-new/2025/02/amazon-guardduty-malware-protection-s3-price-reduction/` | 1 Feb 2025 price reduction $0.60 → $0.09/GB; objects-evaluated price unchanged |
| R25 | `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RangeGETs.html` | Range GET caching, S3 Range support, 50 GB caching limit, streaming after first byte |
| R26 | `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowCloudFrontWorks.html` | Edge/regional caches; first-byte streaming |
| R27 | `https://docs.netlify.com/build/functions/configuration.md` | 6 MB buffered / 20 MB streamed / 256 KB background; ≈4.5 MB binary; 60 s sync / 15 min background; 1024 MB; function regions incl. `dub`/`fra`/`lhr`/`cdg`/`mxp`; Pro/Enterprise; project-wide UI setting for framework adapters |
| R28 | `https://aws.amazon.com/compliance/gdpr-center/` | Customer control, sub-processors, EEA transfers, shared responsibility unchanged under GDPR |
| R29 | `https://aws.amazon.com/compliance/sub-processors/` | Sub-processor entities and processing locations |
| R30 | Repository code (read-only, unchanged): `src/app/api/assessment/route.ts`, `src/lib/assessment/submit.ts`, `src/lib/assessment/config.ts`, `src/lib/assessment/admin-handlers.ts`, `src/app/api/admin/assessments/[id]/attachments/[attachmentId]/route.ts`, `src/app/api/admin/cms/media/route.ts`, `src/app/api/media/[...key]/route.ts`, `src/lib/files/validate.ts`, `src/lib/files/signatures.ts`, `src/db/schema/{assessments,media,enums}.ts`, `src/lib/storage/index.ts`, `src/middleware.ts`, `drizzle/0000_init.sql`, `drizzle/meta/_journal.json` | Existing limits, transaction/consent model, private/public separation, CSP, magic bytes, schema baseline |
| R31 | `https://docs.aws.amazon.com/guardduty/latest/ug/supported-s3-features-malware-protection-s3.html` | SSE-S3/KMS/DSSE-KMS, versioning, Object Lock, TBAC supported; SSE-C, client-side encryption, Glacier Flexible/Deep Archive, directory buckets unsupported |
| R32 | `https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html`, `https://docs.aws.amazon.com/guardduty/latest/ug/monitor-with-eventbridge-s3-malware-protection.html` | PrivateLink in-Region isolated scan; EventBridge scan-result schema |
| R33 | `https://docs.aws.amazon.com/guardduty/latest/ug/malware-protection-s3-quotas-guardduty.html` | 100 GB max object, 100,000 extracted files, 100 levels, 25 protected buckets/account/Region |
| R34 | `https://docs.aws.amazon.com/guardduty/latest/ug/s3-malware-protection-capability.html` | All file formats supported; password-protected handling; on-demand scans |
| R35 | `https://docs.aws.amazon.com/guardduty/latest/ug/monitoring-malware-protection-s3-scans-gdu.html` | `NO_THREATS_FOUND`, `THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED`, statuses and reasons |
| R36 | `https://docs.aws.amazon.com/guardduty/latest/ug/monitoring-malware-protection-s3-scans-gdu.html` | Scan status/result values and reasons (see R35) |
| R37 | `https://docs.aws.amazon.com/guardduty/latest/ug/monitor-enable-s3-object-tagging-malware-protection.html` | Tagging cost, 10-tag limit, enable before upload |
| R38 | `https://docs.aws.amazon.com/guardduty/latest/ug/tag-based-access-s3-malware-protection.html` | TBAC policy denying reads unless `NO_THREATS_FOUND`, restricting tag writes |
| R39 | `https://docs.aws.amazon.com/guardduty/latest/ug/pricing-malware-protection-for-s3-guardduty.html` | 1,000 requests + 1 GB/month/account/Region Free Tier; on-demand, tagging, S3 API and EventBridge managed rule excluded |
| R40 | `https://docs.clamav.net/` | ClamAV GPLv2, daemon/CLI/freshclam, Cisco Talos signatures |
| R41 | `https://docs.clamav.net/manual/Development/libclamav.html` | GPLv2 and supported formats |
| R42 | `https://docs.clamav.net/manual/Signatures.html` | Signed CVD databases, freshclam, YARA support |
| R43 | `https://manpages.debian.org/unstable/clamav-daemon/clamd.conf.5.en.html` | `MaxFileSize` 100M, `MaxScanSize` 400M, `MaxRecursion` 17, `MaxFiles` 10,000, `MaxScanTime`, 2 GB technical ceiling |
| R44 | `https://docs.clamav.net/manual/Usage/Configuration.html` | freshclam/clamd config, hourly updates |
| R45 | `https://bucketav.com/help/setup-guide/amazon-s3-step-2.html` | ClamAV 2 GB / Sophos 5 TB max file, engine pricing summary |
| R46 | `https://bucketav.com/pricing/`, `https://bucketav.com/blog/amazon-guardduty-malware-protection-for-s3-versus-bucketav/` | $0.025/vCPU-hour, $0.20/GB Sophos, EC2/EBS/SNS/SQS/CloudWatch cost components |
| R47 | `https://aws.amazon.com/marketplace/pp/prodview-qvwln7edc6khw`, `https://aws.amazon.com/marketplace/pp/prodview-sykoblbsdgw2o` | AWS Marketplace published usage dimensions |
| R48 | `https://aws.amazon.com/sqs/pricing/`, `https://aws.amazon.com/compare/eventbridge-and-sqs/` | SQS 1M free requests/month; standard queue pricing model |
| R49 | `https://aws.amazon.com/lambda/pricing/` | $0.20/1M requests, 1M free |
| R50 | `https://aws.amazon.com/blogs/aws/new-use-amazon-s3-event-notifications-with-amazon-eventbridge/` | S3 Event Notifications → EventBridge, $1/million matching events |
| R51 | `https://aws.amazon.com/compare/eventbridge-and-sqs/`, `https://aws.amazon.com/blogs/compute/choosing-between-messaging-services-for-serverless-applications/` | EventBridge $1/million events; AWS-service events free; SQS/Lambda integration |
| R52 | `https://aws.amazon.com/marketplace/pp/prodview-q7oc4shdnpc4w` | CSS PAYG $99/month incl. 100 GB, $0.80/GB tiers, $0.10/GB Sophos add-on, $0.05/file detonation |
| R53 | `https://sed.sh/compare/cloudmersive`, `https://sed.sh/compare/metadefender`, `https://www.attachmentscanner.com/blog/best_antivirus_api_for_developers_in_2026`, `https://www.vendr.com/marketplace/opswat` | **Secondary** — Cloudmersive 32 MB cap / per-call plans; MetaDefender no public commercial price → **vendor quote required** |
| R54 | `https://docs.aws.amazon.com/guardduty/latest/ug/monitor-with-eventbridge-s3-malware-protection.html` | `GuardDuty Malware Protection Object Scan Result` event schema (bucket, key, ETag, versionId, status, reasons) |
| R55 | `https://docs.netlify.com/build/functions/configuration.md` | 6 MB buffered / ≈4.5 MB binary / 20 MB streamed ceilings, non-configurable |
| R56 | `https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html`, `https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_cloud_financial_management_proactive_process.html` | Budgets updated up to 3×/day, 8–12 h lag; alerts/actions, not a hard real-time cap; proactive monitoring guidance |
| R57 | `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html` | OAC recommended, all Regions incl. opt-in, SSE-KMS, dynamic PUT/DELETE, Bucket owner enforced, website-endpoint limitation |
| R58 | `https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_s3_presigned_post.html`, `https://vercel.com/kb/guide/how-can-i-use-aws-s3-with-vercel` | `createPresignedPost` with `Conditions`/`Fields`/`Expires`; `content-length-range` example |
| R59 | `https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/`, `https://advancedweb.hu/differences-between-put-and-post-s3-signed-urls/`, `https://dev.to/urios/your-presigned-put-url-for-a-200-kb-avatar-also-accepts-3-gb-1ige` | **Secondary** — PUT lacks a size range; POST policy `content-length-range` is the documented fix |

### 12.11 Repository preservation verification — before and after

Both checks were run from `/home/user/immi-website`; no Git operation, staging action, or production action occurred in between. "Before" is the baseline re-verified at the start of this Amazon S3 Europe task; "after" is the verification run after the §12 / §14 appends and the two consistency edits.

| Check | Before | After |
|---|---|---|
| Branch | `arena/cdcb43ad-immi-website` | `arena/cdcb43ad-immi-website` (unchanged) |
| HEAD | `bc53028b18b4ad9f8f2391b816a872973cbae457` | same (unchanged) |
| Tracked paths | **1** (`README.md`) | **1** (`README.md`) |
| Untracked paths (exact, `git ls-files --others --exclude-standard`) | **283** | **283** |
| `git status --porcelain` entries | 15 (collapsed untracked directories — not the exact count) | 15 (same) |
| Staged paths | **0** | **0** |
| Modified tracked paths | **0** | **0** |
| `.data/local.db` SHA-256 | `7c16c81cc383ae5832c16e02e364f1ed2a15debdcb8edce5bf331aa4df548ff3` | identical |
| `.data/secret-markers.json` SHA-256 | `2e5688ef56d38b4cb1932fe9980ed600041fa415addeccb7800baca5bdee47d0` | identical |
| `docs/PHASE-8-REPORT.md` lines | **914** (§§11.0–11.9) | **1394** (§§11.0–11.9 preserved + §§12.0–12.12) |
| `docs/DEPLOYMENT.md` lines | **266** (§§13.1–13.5 + header note) | **449** (§§13.1–13.5 preserved + header §14 note + §§14.0–14.11) |
| Appendix A exact inventory | **283/283** | **283/283** — 5 fenced `text` blocks, 283 listed, 283 unique, 0 missing, 0 extra, 0 duplicates |
| Trailing whitespace / tabs / control characters | 0 / 0 / 0 | 0 / 0 / 0 |
| High-confidence secret-value patterns in the two docs | 0 | 0 |
| Files modified in the last 25 minutes | — | **exactly 2**: `docs/PHASE-8-REPORT.md`, `docs/DEPLOYMENT.md` |
| Cross-reference integrity | §§11.6, 13.2, 13.3 present | §§11.6, 13.2, 13.3, 12.8, 12.9, 12.10, 14.10 present; **R1–R59: 59 defined, 59 used, 0 undefined, 0 unused** |
| §12 / §14 evaluation sections | absent | present in `docs/PHASE-8-REPORT.md` / `docs/DEPLOYMENT.md` |
| Staging verification | **not verified** | **not verified** |
| Phase 8 completion | not complete | **not complete** |

**Parser caution recorded for future checks:** the exact untracked baseline must come from `git ls-files --others --exclude-standard` (283 paths), not `git status --porcelain` (15 collapsed directory entries). Appendix A consists of **five** fenced `text` blocks — a parser that reads only the first block returns 239 paths and falsely reports 44 "missing"; a parser that filters lines not containing `/` drops 10 root config paths. The verified parser reads every plain line inside every fenced block within Appendix A.

**No change to:** any AWS account, bucket, IAM role, policy, key, subscription or paid service; any application source, configuration, dependency, upload limit, database schema, migration ledger, middleware, CSP, media access control, or environment variable; any staging resource, administrator, deployment, function/edge log, hosted build, or separation confirmation; any production resource; any Git state (no stage, commit, push, branch change); any secret value (none printed, stored, or requested). **No live AWS integration test was performed.** No cost was incurred.

### 12.12 Final verdict and stop point

**Delivered:** a documentation-only evaluation covering (1) a European Region comparison with a recommendation for approval, (2) three malware-scanning approaches evaluated before selection with a recommendation for approval, (3) three illustrative monthly cost scenarios with explicit uploaded-object counts and average file sizes, (4) a 15-control administrator testimonial upload design, (5) a separate CV-upload design preserving assessment association, consent, timestamps, private keys, scan-before-staff, admin-only downloads, audit and retention, (6) a large-video CDN/delivery design, (7) a consolidated cost table with scanning and CDN separated and unexpected-charge sources plus controls, (8) official references R1–R59, (9) remaining uncertainties, (10) the preserved staging-access/deployment checklists and exact approvals.

**documented:** AWS/Netlify/ClamAV/vendor claims and rates cited to R1–R59, including the 6 MB Netlify ceiling, GuardDuty's $0.09/GB + $0.215/1,000 objects (US East example), CloudFront's 1 TB free tier and $0.085/$0.110 per GB, the Lagos PoP, POST-policy `content-length-range`, TBAC, and the fact that budget alerts are not a hard spend cap. **estimated:** all three scenario totals (~$0.08 / ~$1.2 / ~$118 EU-edge or ~$143 Nigeria-edge) and the secondary S3 storage/request rates. **unverified:** Region-specific S3/GuardDuty rates, Malware Protection for S3 per-Region feature availability, Free Tier status, Netlify/Turso plan and residency, actual audience latency, commercial vendor quotes/DPAs, and all hosted behaviour. **requires approval:** every item in §12.9, including Region, scanner, cost/billing, architecture, CV workflow, CDN/CSP, env vars, quotas, staging, migration, hosted verification, and GitHub push.

**Stop here.** Do **not** claim the architecture is implemented, that malware scanning is enabled, that AWS was tested, that staging is verified, that Phase 8 is complete, or that any cost was incurred. **No Region, scanner, architecture, credential, bucket, paid service, source/config/dependency/upload-limit/schema/migration/deployment/Git operation, or production action has been approved or performed.** Await separate explicit approvals before any implementation. The staging gate remains blocked; production remains prohibited.

---

## 13. Final technical design refinement — testimonial video uploads (5 November 2026)

> **DESIGN AND DOCUMENTATION ONLY.** This section is appended after, and preserves in full, §§1–12 — including §12 (the Amazon S3 Europe evaluation), its official references R1–R59, the §11.6 staging-access checklist, and Appendix A. **No implementation code was written or modified; no upload limit was changed; no AWS account, bucket, IAM role, policy, key, subscription, or other infrastructure was created; no service was purchased or enabled; malware scanning was not enabled; no database schema or migration was created or modified; no Netlify or Turso resource was changed; no staging or production deployment occurred; no Git operation, commit or push was performed; no administrator was provisioned; no production resource was modified.** No secret value was printed, stored, or requested. No live AWS integration test was run. All existing repository files and protected data are preserved.

### 13.0 Confirmed decisions, recommendations, labels and supersession

**CONFIRMED DECISION (user):** testimonial videos uploaded by administrators through the CMS will **normally not exceed 100 MB per video**; the architecture must be designed around this limit and **must not introduce multipart-upload complexity unless technically necessary**. The enforceable ceiling used here is **100 MiB = 104,857,600 bytes**, matching the existing `MAX_UPLOAD_BYTES.video = 100 * 1024 * 1024` in `src/lib/files/validate.ts` (whose inline comment reads "100 MB — testimonial videos") and the explicit restriction "Maximum testimonial video size: 100 MiB" [R30], [F1]. **unresolved question:** if a decimal 100 MB (100,000,000 bytes) was intended instead of 100 MiB, that is a different, narrower ceiling and requires confirmation; no limit was changed.

**CONFIRMED DECISIONS carried forward:** implementation target **Amazon S3**; data residency **Europe** with **no European Region approved**; malware scanning **evaluated before selection** with a recommendation made only for approval; GitHub push only after successful staging verification **and** a separate explicit approval; **CV uploads remain separate** from testimonial-video uploads; the CloudFront delivery architecture from §12.5 is retained; the staging checklists remain blocked.

**RECOMMENDATION (requires approval, not approved):** a **single-request, direct-browser-to-S3 presigned POST** workflow with a private quarantine, server-side verification, GuardDuty Malware Protection for S3, and promotion only after a clean scan. **Multipart upload is eliminated** for this path (§13.10). No Region, scanner, architecture, endpoint, credential, bucket, paid service, schema, or migration is approved.

**Labels used throughout:** **confirmed** (user decision), **recommended / requires approval** (design proposal not yet approved), **documented** (official source cited in §13.16 or §12.10), **estimated** (illustrative arithmetic, not a quote), **unverified** (cannot be resolved without account access, a hosted build, a staging test, or a vendor quote), **unresolved question** (needs a user decision). Standing cautions retained from §12: a European Region alone does **not** guarantee GDPR compliance; free allowances do **not** make production free; **budget alerts do not necessarily prevent charges** [R56]; scanning cost is kept separate; estimates avoid unsupported precision.

**Supersession note (no rewrite of §12):** §12.3.2 and §14.3 previously suggested **presigned PUT per part for resumable multipart of 100 MiB videos**. The user's confirmed decision and the evidence in §13.10 **supersede that suggestion for testimonial videos ≤100 MiB**: the recommended path is now **single-request presigned POST only**. §12 is deliberately preserved verbatim as the historical evaluation record; this §13 is the refined design. `AbortIncompleteMultipartUpload` remains available as defence-in-depth for any other multipart path, but is **not required** for the recommended single-request video path (§13.9).

### 13.1 Final recommended architecture and endpoint sequence

**recommended / requires approval** — nine-step state machine. All new endpoints are **proposals only**; none exists in the repository. The browser never receives AWS credentials, only a signed POST policy and its form fields.

| Step | Actor → endpoint / service | Request | Server action / S3 action | State transition |
|---|---|---|---|---|
| 1 | Authenticated administrator → CMS UI → `POST /api/admin/cms/media/upload-authorize` (proposed) | Small JSON: intended `purpose: 'testimonial-video'`, declared MIME/size hint, optional client SHA-256 digest | Reuse existing `guardMutation(request, ['owner','admin','editor'])`, CSRF protection and `throttleCmsMutation`; validate intent against the approved format list; check quotas; **ignore the browser size hint as trust** (it is advisory only) | `—` → `initiated` |
| 2 | Same handler (server-side) | — | Generate a **CSPRNG** object key (e.g. `crypto.randomUUID()`), e.g. `quarantine/testimonial-video/<uuid>.bin`; create a `pending_uploads` row (id, key, bucket, admin id, purpose, declared values, expected digest, `expires_at`, `status='initiated'`, `consumed_at=NULL`) — **schema change with its own migration approval** | `initiated` |
| 3 | Same handler → response | — | Sign a **short-lived presigned POST policy** with the exact §13.3 conditions; return `{ uploadId, url, fields }` only. **No AWS secret, access key, or permanent credential is returned.** Log `uploadId` + expiry, never the signed policy or fields | `initiated` |
| 4 | Browser → S3 quarantine bucket (direct `fetch`/`FormData` POST) | `multipart/form-data`: all returned fields, `Content-Type`, checksum fields, `file` **as the last field** [F2] | S3 validates the signed policy (`expiration`, exact `bucket`/`key`, `content-length-range`, `Content-Type`, checksum, SSE) **before accepting the object**; rejects with `EntityTooLarge` / `AccessDenied` otherwise. **Bytes never pass through a Netlify Function** | `initiated` → (S3 object created) |
| 5 | Browser → `POST /api/admin/cms/media/upload-finalize` (proposed) | Small JSON: `uploadId` only | Single-use compare-and-set on the pending row; `HeadObject` on the exact key (existence, **measured** `ContentLength`, ETag, VersionId, `ContentType`, SSE, checksum mode); a small `Range GET` for the first bytes; compare to expected digest; run `detectFileType()` + the `testimonial-video` policy from `src/lib/files/validate.ts` | `initiated` → `uploaded` → `validating` → `verified` or `rejected` |
| 6 | S3 → GuardDuty Malware Protection for S3 (quarantine prefix only) | Automatic on **POST Object** [R9], [F3] | In-Region isolated scan; result published to the default EventBridge bus; optional `GuardDutyMalwareScanStatus` tag (enabled before first upload) [R9], [F3] | `verified` → `scanning` |
| 7 | EventBridge consumer (proposed) → pending row | `GuardDuty Malware Protection Object Scan Result` | Correlate on bucket + key + `versionId` + `eTag`; deduplicate (GuardDuty uses **at-least-once** delivery [F3]); only `Completed` + `NO_THREATS_FOUND` → `clean`; all other outcomes → `rejected` and manual-review queue (§13.8) | `scanning` → `clean` / `rejected` |
| 8 | Server → S3 → `mediaAssets` (proposed promotion handler) | — | Only when `verified AND clean`: `CopyObject` from the **specific verified versionId** to a new CSPRNG key in the **public-media** bucket/prefix; create `mediaAssets` (`visibility='public'`, `purpose`, detected MIME, size, checksum); mark `promoted`; write `activity_logs`. **Promotion is the only writer to the public origin** | `clean` → `promoted` |
| 9 | Browser → published CDN | — | CloudFront OAC serves the promoted object only (§13.12). Quarantine and private-CV remain private and are never CDN origins | `promoted` → published |

**documented** — Netlify Functions cannot buffer a 100 MiB body (6 MB buffered / ≈4.5 MB effective for binary, 20 MB streamed response, non-configurable) [R27], [R55]; the existing `POST /api/admin/cms/media` uses `request.formData()` → `File.arrayBuffer()` and is therefore unsuitable [R30]. Steps 1, 3, 5 and 8 carry only small JSON bodies, so they fit within the ceiling. **requires approval** — every proposed endpoint, the pending-upload model, the EventBridge consumer, the promotion handler, and the associated schema/migration.

### 13.2 Strict upload restrictions — enforcement layers

**recommended / requires approval** — each restriction is enforced at **two or more** independent layers; browser-side validation is never a security control.

| Restriction | Layer 1 — S3 signed POST policy | Layer 2 — server (post-upload) | Layer 3 — bucket / platform |
|---|---|---|---|
| **Max 100 MiB (104,857,600 bytes)** | `["content-length-range", 1, 104857600]` — S3 rejects oversize **before** the object is written (`EntityTooLarge`) [R12], [F4] | `HeadObject.ContentLength <= 104857600`; reject and delete otherwise [F5] | Existing `MAX_UPLOAD_BYTES.video` unchanged [R30]; no limit change approved |
| Exact object key / no arbitrary keys | `{"key": "<server CSPRNG key>"}` **exact match**, plus `{"bucket": "<quarantine bucket>"}` exact match; `${filename}` is **never** used [R12], [F2], [F6] | Finalize looks up the key from `pending_uploads` by `uploadId`; the client never supplies a key | Bucket policy denies writes outside the quarantine prefix; IAM signing role scoped to that prefix |
| Approved formats only | Exact `Content-Type` in `{video/mp4, video/webm}` (one exact condition per authorization) [R12] | `detectFileType()` magic bytes: MP4 `ftyp` at offset 4, WebM `1A 45 DF A3`; `validate.ts` `testimonial-video` allows only `mp4`/`webm`; reject if declared ≠ detected [R30] | Store only the canonical `.mp4`/`.webm` extension derived from detected bytes, never the uploaded filename |
| Actual file signatures | — (POST policy cannot inspect bytes) | `Range GET` of the leading bytes into the finalize handler (small, within the 6 MB ceiling); independent of extension/MIME [R30] | `nosniff` on delivery; server-detected `Content-Type` |
| Integrity | `x-amz-checksum-algorithm: SHA256` + exact `x-amz-checksum-sha256` condition in the policy; S3 validates the received bytes and rejects `BadDigest` [F7], [F8] | `HeadObject` with `x-amz-checksum-mode: ENABLED` returns `ChecksumSHA256`; compare to the stored expected digest [F9]; reject on mismatch | Optional server-side streaming hash as an extra independent check (§13.6) |
| No unauthorized overwrites | Exact `key` condition; **no** `${filename}`; one key per authorization | Single-use pending-upload state; reject if `ListObjectVersions` shows >1 version for the key; bind ETag/VersionId; promotion copies only that version [F10], [F11] | Bucket versioning; `s3:signatureAge` deny; deny `PutObject`/`DeleteObject` to all principals except the signing role and GuardDuty; `If-None-Match: *` available for **PutObject only**, not POST [F10] |
| Short-lived authorization | `expiration` (ISO8601 UTC) — illustrative 300–600 s; SIGV4 signing fields bound by exact conditions [R12], [R11] | Finalize rejects if `expires_at` passed; reconciliation expires stale rows | Optional `s3:signatureAge` bucket-policy deny (official example uses 600,000 ms) [R11]; applicability to POST policies **unverified** |
| Private quarantine | `acl` absent / `private`; `x-amz-server-side-encryption` exact (`AES256` or `aws:kms`, **not SSE-C**) [R12], [R31] | No `mediaAssets` row and no public path until promotion | All four Block Public Access settings on; `Bucket owner enforced`; bucket policy deny-by-default; TBAC denies reads until clean [R10], [R38] |
| No credentials in browser | Only `url` + `fields` returned [F12] | Signing uses a server-side role credential injected through a secure interface; **no secret in chat/docs** | Temporary credentials expire with the session [R11] |
| No unscanned/rejected video public | — | Promotion gated on `verified AND clean` (§13.8) | CloudFront OAC restricted to the public-media prefix only; TBAC deny-until-clean [R57], [R38] |
| Cross-origin upload / playback | S3 CORS `AllowedOrigins` = site origin only, `AllowedMethods` = POST, restricted `AllowedHeaders` [F13] | — | Current CSP `connect-src 'self'` / `form-action 'self'` blocks external POST [R30]; **narrow CSP additions require approval and were NOT made** |

**documented** — non-file form fields and multipart boundaries are limited to **20 KB** and the `file` field must be last [F2]; only one file can be uploaded per POST. **unverified** — whether S3's `content-length-range` measures the file bytes alone or the whole form body. The design is safe under either reading: the policy maximum is set to **exactly 104,857,600 bytes**, so if form overhead is included the only consequence is a conservative rejection of a file at the exact ceiling (fail-closed); the server's independent `HeadObject.ContentLength` check still guarantees no object above 100 MiB is accepted. Confirm the exact semantics in staging (§13.14).

### 13.3 Technical question 1 — does presigned POST support all required restrictions?

**documented — YES.** The official POST Policy reference states that a POST policy always contains `expiration` and `conditions`, and documents these condition types [R12], [F4]:

- **Exact object key:** `{"key": "<exact key>"}` (exact-match condition; `key` supports exact and `starts-with`; use **exact**, never a prefix and never `${filename}`).
- **Size:** `["content-length-range", min, max]` in **bytes** — the official example is `["content-length-range", 1048576, 10485760]` (1–10 MiB) [R12], [F4].
- **Content type:** `Content-Type` is a "REST-specific header" condition supporting exact and `starts-with`; a comma-separated `starts-with` value is interpreted as a list in which **every** value must match [F4]. Use an exact `video/mp4` or `video/webm` condition.
- **Expiry:** `expiration` is an ISO8601 GMT/UTC date-time; every form field except `x-amz-signature`, `file`, `policy` and `x-ignore-*` must have at least one condition [F4], [F14].
- **Other bound fields:** `bucket` (**exact only**), `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Expires`, `success_action_status`/`success_action_redirect`, `x-amz-algorithm`, `x-amz-credential`, `x-amz-date`, `x-amz-security-token`, `x-amz-meta-*`, and `x-amz-*` (exact) [R12], [F4].

**Illustrative policy (documentation only — not code, not deployed):**

```json
{
  "expiration": "<ISO8601 UTC, illustrative now + 300 s>",
  "conditions": [
    {"bucket": "<quarantine-bucket>"},
    {"key": "quarantine/testimonial-video/<CSPRNG-uuid>.bin"},
    ["content-length-range", 1, 104857600],
    {"Content-Type": "video/mp4"},
    {"success_action_status": "204"},
    {"x-amz-server-side-encryption": "AES256"},
    {"x-amz-checksum-algorithm": "SHA256"},
    {"x-amz-checksum-sha256": "<base64 SHA-256 of the file>"},
    {"x-amz-algorithm": "AWS4-HMAC-SHA256"},
    {"x-amz-credential": "<access-key>/<date>/<region>/s3/aws4_request"},
    {"x-amz-date": "<ISO8601 basic UTC>"},
    {"x-amz-security-token": "<session token>"}
  ]
}
```

`success_action_status: 204` avoids an S3 redirect that would append the bucket/key/ETag to a URL [F2]. `createPresignedPost` in `@aws-sdk/s3-presigned-post` supports `Conditions`, `Fields` and `Expires` [R58], [F15]; adding any SDK dependency **requires approval**.

**documented — the 5 GB question from §12.8 is now resolved:** the official Amazon S3 FAQ states "The largest object that can be uploaded in a single PUT is 5 GB" and individual objects can be up to 50 TB; a secondary S3-compatible provider documents the POST ceiling as 5 GB as well [F16], [F17]. 100 MiB is ~1.95% of the 5 GiB single-request ceiling, so a single POST is far inside the service limit. This removes the "no official numeric POST maximum verified" caveat recorded in §12.8 item 4 for the *service ceiling*; the **exact `content-length-range` byte semantics** remain **unverified** (§13.2).

### 13.4 Technical question 2 — is the 100 MiB limit reliably enforceable?

**documented / recommended — YES, with two independent enforcement points plus a platform reason they work together:**

1. **Storage-authorization level:** `content-length-range` with maximum **104,857,600 bytes** is enforced by S3 *before* the object is written; oversize uploads are rejected with `EntityTooLarge` and never become objects [R12], [F4], [F18].
2. **Server-side level:** the finalize handler reads the **measured** `HeadObject.ContentLength` (not any client claim) and rejects/deletes anything > 104,857,600 bytes [F5]. S3 provides **strong read-after-write consistency** for PUTs and object metadata (HEAD) in all Regions, so a successful upload is immediately visible to verification [F19].
3. **Platform reason:** with direct browser→S3 upload, the 100 MiB body never enters a Netlify Function, so the 6 MB buffered ceiling cannot truncate or bypass the check [R27], [R55]. The existing `MAX_UPLOAD_BYTES.video` remains the application-level ceiling and is **unchanged** [R30].
4. **Failure mode is fail-closed:** if S3's range includes multipart form overhead (up to 20 KB), a file at exactly 100 MiB may be conservatively rejected — no oversized object is ever stored. If the client lies about size in the authorize request, it is ignored as untrusted.

**Do not rely on browser-side validation alone** — the browser size hint is used only for UX/quotas; enforcement is entirely in the signed policy and the server. **unverified** — the exact boundary behaviour (100 MiB accepted vs 100 MiB + 1 byte rejected, with and without form overhead) must be tested in staging (§13.14, tests V1–V3). **No upload limit was changed.**

### 13.5 Technical question 3 — presigned PUT vs presigned POST

**documented** — comparison, resolving the §12.8 item 4 caveat:

| Dimension | Presigned **POST** (recommended) | Presigned **PUT** (rejected for this path) |
|---|---|---|
| Size enforcement | **`content-length-range` min/max in bytes**, enforced by S3 before write [R12], [F4] | **No size range.** A plain PUT places no limit on the request body up to the 5 GB service ceiling; at best an **exact** signed `Content-Length` value can be pinned, which requires knowing the exact byte count in advance and is awkward for browsers [F18], [F20]. Exact enforcement behaviour is **unverified** |
| Content type | Exact or `starts-with` conditions [F4] | Only an exact signed `Content-Type` header [F20] |
| Arbitrary key / overwrite | Exact `key` + `bucket` conditions; **no** `${filename}` [F4], [F2] | Key is fixed in the URL, but an existing object with the same key is **replaced** [F11] |
| Conditional-write overwrite protection | `If-None-Match: *` is documented for **PutObject, CompleteMultipartUpload, CopyObject only — not POST Object** [F10] | **`If-None-Match: *` is available** for PutObject [F10]; bucket policies can enforce `s3:if-none-match` [F21] |
| Reuse | Bearer token, reusable until expiry [F11] | Bearer token, reusable until expiry; repeated use overwrites the same key [F11] |
| Integrity | `x-amz-checksum-algorithm` + `x-amz-checksum-sha256` **form fields** supported by POST Object; exact policy condition possible [F7], [F8] | SigV4 checksum headers (CRC64NVME, SHA-256, …) supported [R11], [F9] |
| Multipart complexity | None — single request | None for single PUT; multipart would need per-part URLs |

**Conclusion (recommended / requires approval):** presigned **PUT is weaker on size enforcement** and equally reusable/overwriting; its only advantage is native `If-None-Match` overwrite protection. That advantage is **not needed** because the POST design compensates with (a) a fresh CSPRNG key per authorization, (b) an exact `key` condition, (c) bucket versioning plus a single-version check, (d) a single-use pending-upload state machine, (e) ETag/VersionId binding at finalize, and (f) a deny-by-default private quarantine with TBAC so a reused POST can at worst create another **private** object. **Presigned POST is the recommended single-request mechanism; presigned PUT is not used for testimonial video uploads.**

### 13.6 Technical question 4 — completion verification and authorization-token reuse

**documented — the problem:** S3 explicitly states "You can use the presigned URL multiple times, up to the expiration date and time" and "If an object with the same key already exists … Amazon S3 replaces the existing object with the uploaded object"; presigned URLs/policies are **bearer tokens** with **no built-in single-use enforcement** [F11], [R11]. AWS's security guidance therefore recommends short expiries, `s3:signatureAge`, network-path restrictions and application-level state [R11], [F22].

**recommended / requires approval — layered controls:**

| Control | Mechanism |
|---|---|
| **Upload completion** | Browser calls finalize with **only** `uploadId`. Server performs `HeadObject` on the pending row's exact key and confirms: existence, `ContentLength ≤ 104857600`, ETag, VersionId, `ContentType`, SSE, `StorageClass`, and `ChecksumSHA256` (via `x-amz-checksum-mode: ENABLED`) [F5], [F9]. S3 strong read-after-write consistency makes this immediate [F19]. A small `Range GET` supplies the magic-byte signature check [R30] |
| **Atomic single-use state** | `pending_uploads.status` compare-and-set `initiated → uploaded → validating → verified/scanning → clean → promoted` (or `rejected`/`expired`), plus `consumed_at`. A second finalize for the same `uploadId` is rejected; the authorization is spent on first use |
| **Replay / overwrite detection** | Bucket versioning enabled; if `ListObjectVersions` returns >1 version for the key, reject (token was reused). Promotion uses `CopyObject` with the **specific verified `versionId`**; ETag change after verification invalidates the pending row |
| **Short expiry** | POST policy `expiration` illustrative 300–600 s; pending row `expires_at` mirrors it. Optional bucket-policy deny on `s3:signatureAge > 600000` ms (official example) [R11]; **unverified** whether `s3:signatureAge` applies to POST policies — staging test required |
| **No key reuse / no client keys** | One CSPRNG key per authorization; exact `key` condition; `${filename}` forbidden [F4], [F2] |
| **No credential exposure** | Only `url` + `fields` returned [F12]; signing uses a server-side short-lived role credential; temporary-credential expiry bounds the policy [R11] |
| **No leakage via logs/response** | Log `uploadId` and expiry only, never the signed policy, fields or URL query strings; `success_action_status: 204` (no redirect carrying key/ETag) [F2], [F22] |
| **Duplicate scan results** | GuardDuty uses **at-least-once** EventBridge delivery, so results can arrive more than once; correlate and deduplicate on bucket + key + versionId + ETag, billed once per scanned object [F3] |
| **Last-resort revocation** | Rotate/deactivate the signing credential to invalidate all outstanding policies (blunt, affects all links) [R11] |

**Integrity detail (documented):** POST Object supports `x-amz-checksum-algorithm` (CRC32, CRC32C, SHA1, SHA256) and the matching `x-amz-checksum-sha256` form field (base64-encoded 256-bit digest); S3 returns `x-amz-checksum-sha256` and `x-amz-version-id` in the response, and `HeadObject` exposes the stored checksum when checksum mode is enabled [F7], [F8], [F9]. Binding the digest in the POST policy as an exact condition makes S3 reject a byte mismatch. **unresolved question / requires approval:** computing SHA-256 of a 100 MiB file in the browser requires either a ~100 MiB `ArrayBuffer` (`crypto.subtle.digest`) or an incremental hashing library (new dependency). Options: (a) client-computed SHA-256 bound in the policy + server comparison (browser memory cost); (b) server-side **streaming** hash via `GetObject` with chunked hashing (no full buffering, but adds S3→function egress and time); (c) rely on S3's stored full-object checksum plus ETag/VersionId binding. Choose in a separate approval; **no code or dependency was added**.

### 13.7 Technical question 5 — GuardDuty Malware Protection for S3 integration

**documented** — GuardDuty's own how-it-works page confirms that **POST Object is one of the default "Object Created" event types that initiates a Malware Protection for S3 scan**, alongside `PutObject`, `CopyObject` and `CompleteMultipartUpload` [R9], [F3]. Therefore a single-request presigned POST into the protected quarantine prefix triggers a scan; multipart is **not** needed to make scanning work.

**recommended / requires approval** — integration design:

1. **Scope:** enable Malware Protection for S3 as an **independent feature** (no detector ID needed; rely on EventBridge scan-result events, not findings) [R8], [F3]. Protect **only the quarantine prefix** (up to 5 prefixes allowed) [R9]. Scoping to the quarantine avoids a second scan when the clean object is `CopyObject`-promoted into the public-media prefix, avoids version scans on published objects, and avoids double billing [R9], [R31].
2. **Same Region/account:** the plan and bucket must be in the same Region and account [R8]. The chosen European Region is **not approved**; per-Region feature availability remains **unverified** (§12.8).
3. **IAM & encryption:** dedicated GuardDuty IAM role with least-privilege read/tag permissions; SSE-S3 or SSE-KMS (bucket key optional). **SSE-C and client-side encryption are unsupported** and produce `ACCESS_DENIED` [R31], [F23]. 100 MiB is far below the 100 GB object limit [R33].
4. **Tagging:** enable post-scan `GuardDutyMalwareScanStatus` tagging **before the first object is uploaded** (otherwise tags are not applied); note the S3 Object Tagging cost and the 10-tag limit [R9], [R37], [F3].
5. **Quarantine gate:** TBAC bucket policy denies `GetObject` unless the tag equals `NO_THREATS_FOUND` and restricts who can set that tag [R38]. This is the "private quarantine until success" primitive.
6. **Result channel:** EventBridge default bus, `GuardDuty Malware Protection Object Scan Result` detail-type, source `aws.guardduty`; correlate on `bucketName`, `objectKey`, `eTag`, `versionId`; handle **at-least-once duplicates** (billed once per object) [R32], [R54], [F3]. CloudWatch metrics for scan counts/bytes [R9].
7. **Reconciliation:** a periodic job finds pending rows in `scanning` older than a bounded timeout with no result, marks them `rejected`/`expired`, alerts, and keeps the object private. GuardDuty unavailability is treated as **not clean**.
8. **Cost separation:** GuardDuty is billed per GB scanned and per 1,000 objects evaluated; S3 Object Tagging, S3 API calls and the EventBridge managed rule are **excluded** from its Free Tier [R16], [R39]. Scanner chosen? **No — recommendation only for approval.**

### 13.8 Failure handling — all outcomes fail closed

**recommended / requires approval** — no failed, rejected, expired or suspicious object ever becomes publicly accessible. Every branch keeps the object in the private quarantine, writes an `activity_logs` entry, and shows a generic admin error.

| Outcome | Detection | Action | Retention / cleanup |
|---|---|---|---|
| **`THREATS_FOUND`** (`Completed`) | EventBridge result [F23] | `rejected`; alert security; manual-review queue; **never promote**; never serve | Retain in quarantine only for the **approved** investigation window, then delete via approved retention policy; hash/IOC recorded without exposing the object |
| **`UNSUPPORTED`** (`Skipped`) | Result + `statusReasons`: `PASSWORD_PROTECTED`, `OBJECT_SIZE_LIMIT_EXCEEDED`, `UNSUPPORTED_STORAGE_CLASS`, `EXTRACTED_FILE_LIMIT_EXCEEDED`, `EXTRACTED_LEVEL_LIMIT_EXCEEDED`, `EXTRACTED_BYTE_LIMIT_EXCEEDED`, `EXTRACTION_RATIO_LIMIT_EXCEEDED` [F23] | `rejected`; **never treated as clean**; admin told the file could not be scanned; manual review | Delete per approved retention; no automatic promotion |
| **`ACCESS_DENIED`** (`Skipped`) | Reasons: `UNAUTHORIZED_TO_GET_OBJECT`, `UNAUTHORIZED_TO_ASSUME_ROLE`, `SSE_C_ENCRYPTED_OBJECT`, `OBJECT_E_TAG_CHANGED`, `BUCKET_NOT_FOUND` [F23] | `rejected`; alert operations to fix IAM role / KMS / encryption config; **never treat as clean**. `OBJECT_E_TAG_CHANGED` means the object was overwritten → also triggers the replay check in §13.6 | Retain short for diagnosis; delete per policy; verify role before re-enabling uploads |
| **`FAILED`** (`Failed`) | Internal scan error [F23] | `rejected`; alert; fail closed; optional manual on-demand rescan (**on-demand scans are excluded from the Free Tier** [R39]) | Delete per approved retention after review |
| **No result / timeout / GuardDuty unavailable** | Reconciliation timeout, missing EventBridge event | `expired`/`rejected`; alert; keep private; no promotion | Delete per approved retention |
| **Oversize** (>100 MiB) | S3 `EntityTooLarge` at POST, or server `HeadObject` | `rejected`; delete any object that was created | Immediate delete |
| **Wrong type / signature / extension** | `detectFileType()` magic bytes; declared ≠ detected; `testimonial-video` policy [R30] | `rejected`; delete | Immediate delete |
| **Checksum mismatch / ETag or version changed** | `BadDigest` at POST, or `HeadObject` checksum/ETag/VersionId comparison | `rejected`; delete; treat as tamper/replay | Immediate delete |
| **Expired POST policy / expired pending row** | S3 rejects at POST; finalize checks `expires_at` | `expired`; no object or orphan object | Reconciliation deletes orphans |
| **Duplicate/replayed authorization** | Second finalize for same `uploadId`; >1 version for key | `rejected`; delete extra versions; alert | Immediate |
| **CORS / CSP / network failure at upload** | Browser error; no object | `initiated` → reconciliation `expired` | No object to clean; row expires |
| **Rejected admin retry** | Admin re-initiates | **New** `uploadId`, **new** CSPRNG key, **new** policy; never reuse | Old object deleted per policy |

**documented** — `Skipped` covers both `UNSUPPORTED` and `ACCESS_DENIED`; `Completed` covers `NO_THREATS_FOUND` and `THREATS_FOUND`; `Failed` maps to `FAILED` [F23]. **requires approval** — the exact quarantine retention window (investigation vs. erasure), the manual-review workflow, alert routing, and who may approve deletion. **No retention policy is approved yet**; §13.9's lifecycle rules are proposals.

### 13.9 Abandoned uploads and incomplete objects

**recommended / requires approval** — because the design uses **single-request POST**, there are **no multipart parts** to leak: a POST either creates a complete object or creates nothing. Therefore `AbortIncompleteMultipartUpload` is **not required** for this path (retain it only as defence-in-depth if any other multipart path is later approved) [R13], [R14].

| Case | Cleanup mechanism | Evidence |
|---|---|---|
| Abandoned authorize (browser never POSTs) | Pending row `expires_at` passes → reconciliation marks `expired`; no object exists | Application state machine |
| POST completed but browser never calls finalize | **S3 Lifecycle `Expiration` rule scoped to the quarantine prefix** deletes the orphan object after the approved window; reconciliation expires the pending row | S3 Lifecycle "Expiration actions … Amazon S3 deletes expired objects on your behalf"; rules apply to existing and new objects; lifecycle rules still function even if a bucket policy denies all deletes [F24] |
| Rejected / failed / suspicious object | Immediate `DeleteObject` on rejection, plus the Lifecycle rule as backstop | S3 `DELETE`/`CANCEL` requests are free [R18] |
| Noncurrent versions (versioning enabled, replay attempt) | `NoncurrentVersionExpiration` lifecycle rule | [F24], [R31] |
| Orphan from checksum/type mismatch | Immediate delete in finalize | §13.8 |

**documented** — S3 Lifecycle deletion is **queued, not instantaneous**; billing stops when the object becomes eligible, but the object may still exist briefly [F24]. Consequently the pending row must not be marked "cleaned" until a verification read confirms absence, and no public path may ever reference a quarantine key. **requires approval** — the exact retention TTL for quarantine objects and pending rows (a GDPR/erasure decision), the reconciliation job's schedule, and the deletion audit log format. **unverified** — lifecycle timing and the interaction with versioning/TBAC in the hosted environment.

### 13.10 Technical question 8 — is multipart upload genuinely necessary? **NO — eliminated**

**documented evidence:**

1. The official Amazon S3 FAQ states: "The largest object that can be uploaded in a single PUT is **5 GB**" and objects can be up to 50 TB [F16]. A single-request POST is likewise documented at a 5 GB ceiling by an S3-compatible implementation [F17]. **100 MiB = 104,857,600 bytes ≈ 1.95% of 5 GiB** — far inside the single-request limit.
2. The same FAQ says: "**For objects larger than 100 MB, customers should consider using the multipart upload capability**" [F16]. This is **advisory** ("should consider"), for throughput/parallelism/retry efficiency — **not a requirement**, and not a protocol boundary. 100 MiB (≈104.86 MB decimal) is marginally above that advisory threshold, so the trade-off is acknowledged explicitly rather than hidden.
3. GuardDuty scans POST Object uploads directly [F3]; scanning does not require `CompleteMultipartUpload`.
4. Netlify's 6 MB ceiling applies to the **function**, not to a direct browser→S3 request [R27], so the size problem is solved without multipart.

**CONFIRMED DECISION + RECOMMENDATION (requires approval for implementation, not for the conclusion):** **explicitly recommend single-request presigned POST uploads and eliminate multipart for testimonial videos ≤100 MiB.** Multipart is **not technically necessary**.

**Accepted trade-off (documented / unverified):** a single-request upload cannot pause or resume; an interrupted transfer over a high-latency West-African link (likely users, §12.1.4) requires a **new** authorization, a **new** CSPRNG key, and a full re-upload; typical failure rates for 100 MiB from the target geography are **unverified** and must be measured in staging (§13.14). Multipart would add: per-part presigned PUT URLs, part-size/part-count validation, a server-side `CreateMultipartUpload`/`CompleteMultipartUpload` handshake, `AbortIncompleteMultipartUpload` lifecycle, ETag semantics that are no longer a plain MD5, ~15 S3 requests instead of ~4 per video (13 × 8 MiB parts + create + complete), no `content-length-range` for the whole object, and an additional scan on completion. If staging measurements from the target geography show an unacceptable failure rate, adopting multipart would be **a separate, explicit approval** — it is not part of this design. **This supersedes the per-part presigned PUT suggestion in §12.3.2 / §14.3 (see §13.0).**

### 13.11 CV uploads remain entirely separate (confirmed)

**CONFIRMED DECISION:** do **not** combine testimonial-video uploads with applicant CV uploads. The single-request video design in §13.1 is **not** reused for CVs. Preserved unchanged from §12.4 / §14.4:

- **Separate** quarantine, keys, bucket/prefix, IAM policy, pending-upload records and state machine; **never** a public bucket, **never** a CloudFront origin.
- **Existing 10 MiB CV limit** (`MAX_UPLOAD_BYTES.document`), **unchanged** unless separately approved; `MAX_SUBMISSION_REQUEST_BYTES = 12 MiB` unchanged [R30].
- **Independent validation** (`cv` → pdf/docx only, magic-byte inspection in `src/lib/files/validate.ts`) and **independent malware scanning** with the same fail-closed outcome rules as §13.8.
- **Association only after successful verification:** `POST /api/assessment` (the only public write endpoint) keeps its honeypot, rate limits, Zod validation, consent-against-published-versions checks, duplicate detection, idempotency and **one transaction**; an unverified/unscanned/expired CV must never produce a valid `assessment_attachments` row [R30].
- **Preserved integrity:** immutable `consent_records` snapshot (`termsVersion`, `privacyVersion`, `consentText`, `acceptedAt`, `ipHash`, `userAgent`), `assessments.submittedAt`, `assessment_attachments` `onDelete: restrict`, private `media_assets` keys never returned publicly, and the **administrator-only** `GET /api/admin/assessments/[id]/attachments/[attachmentId]` download with `guardAssessmentRead`, audit entry, `Content-Disposition: attachment`, `no-store`, `nosniff`, sandbox CSP, `same-origin` and `no-referrer` [R30].
- **No schema/migration/API change** was made or approved for either path.

### 13.12 CloudFront delivery architecture — retained (confirmed)

**CONFIRMED DECISION:** retain §12.5 / §14.5. **recommended / requires approval** for implementation:

- **Origin Access Control (OAC)** on a **dedicated public-media bucket/prefix** containing **only** promoted, verified, clean, published objects; all four Block Public Access settings on; `Bucket owner enforced`; the origin is never an S3 website endpoint [R57], [R10].
- **Access restricted to published and verified objects:** publication gate is a `mediaAssets` row with `visibility='public'`, `archivedAt IS NULL`, server-detected `video/mp4` or `video/webm`; CSPRNG immutable keys; **promotion (§13.1 step 8) is the only writer** to the public prefix [R30].
- **No access to quarantine or private CV storage:** separate buckets/prefixes, distinct IAM policies, no wildcard path behaviours, TBAC deny-until-clean, and the existing `/api/media/[...key]` `visibility='public'` filter [R30], [R38], [R57].
- **HTTP Range support:** CloudFront Range GETs (S3 supports Range GETs), byte-range caching, streaming after the first byte — enables `<video>` seeking for 100 MiB files [R25], [R26]. Note each Range request is a billable request [R7].
- **Caching and content-type headers:** `Cache-Control: public, max-age=31536000, immutable` on immutable keys; serve the **server-detected** `Content-Type` (never the declared MIME), `Content-Disposition` `inline` for playback / `attachment` for downloads, `X-Content-Type-Options: nosniff`, restrictive response CSP, CORS only if the player requires it; prefer new keys over overwriting to avoid invalidation [R21], [R7].
- **Documented unpublishing / deletion:** mark `archivedAt`, create an exact-path CloudFront invalidation (first 1,000 paths/month free, then $0.005/path [R21]), delete the promoted object **and all versions**, verify no cached copy remains reachable, write `activity_logs`. **Edge caches persist until TTL/invalidation completes** — a GDPR erasure caveat. **Published testimonial videos are intentionally public**: world-readable URLs, third-party caching, erasure cannot be guaranteed, and a separate publication consent is required. Quarantine, pending uploads and private CVs must never be reachable through this path.
- **CSP (requires approval, NOT changed):** current `media-src 'self' blob:` / `connect-src 'self'` blocks external CDN playback and external upload POST [R30]. Narrow `media-src` (CDN playback) and `connect-src` / `form-action` (direct POST) additions are **unapproved**; **no middleware/CSP/media-access-control change was made**.
- **Small assets:** retain the existing `/api/media/[...key]` proxy for small public assets; it buffers `Uint8Array` → `ArrayBuffer` and is bounded by the 6 MB/20 MB ceilings, so **100 MiB videos must use the CDN path** [R27], [R30].

### 13.13 Cost implications of the refined design

**estimated** — all figures are illustrative, rounded, **not** a quote or a bill. Rates come from §12.6.1 (S3 storage/request rates are **unverified** secondary estimates; GuardDuty rates are the documented **US East** example, Region-specific rates **unverified**; CloudFront rates are documented) [R16], [R23], [R7]. Netlify/Turso/Support/tax/Marketplace/optional replication are **excluded — unverified**.

| Cost line | Per 100 MiB testimonial video | Notes |
|---|---|---|
| S3 storage (quarantine + promoted copy, ~0.195 GiB total) | ~$0.0045/month | $0.023/GB-month **estimated**; double because both copies exist until quarantine cleanup |
| S3 requests (1 POST + HeadObject + small Range GET + CopyObject + tag + lifecycle delete ≈ 6) | <~$0.001 | `$0.005/1k` writes, `$0.0004/1k` reads **estimated**; DELETE/CANCEL free [R18] |
| **GuardDuty scan (separate line)** | **~$0.009/video** | `0.0977 GiB × $0.09/GB + $0.215/1,000 objects` = ~$0.0090 (decimal-GB reading ~$0.0097). 100 videos/month ≈ **~$0.90**; 500/month ≈ **~$4.50** |
| S3 Object Tagging / S3 API / EventBridge managed rule | small, **unverified** | **Excluded** from GuardDuty Free Tier [R39] |
| CloudFront delivery (100 MiB/play) | $0 within the 1 TB free tier; then ~$0.008 (EU) / ~$0.011 (Nigeria/Africa group) per play | [R7]; Range/seeking multiplies requests |
| Invalidation | $0 up to 1,000 paths/month; $0.005/path thereafter | [R21] |
| **Single-request vs multipart** | ~4–6 S3 requests instead of ~15; **no** `CompleteMultipartUpload`, **no** incomplete-part storage, **no** second scan on completion | [R13], [F3], [F18] |
| Failed/rejected uploads | 1 POST (may be rejected before storage) + 1 delete + scan if object was created | Fail-closed; lifecycle backstop [F24] |

**Cost controls retained (requires approval):** budgets/alerts (with the explicit caveat that **budget alerts do not necessarily prevent charges** [R56]), cost-allocation tags, per-admin quotas, `content-length-range` caps, quarantine Lifecycle expiration, noncurrent-version expiration, minimal invalidation, WAF/bot controls. **Free allowances do not make production free** [R39], [R20], [R7]. **No cost was incurred in this task.**

### 13.14 Staging verification requirements (not performed — blocked)

**CONFIRMED DECISION / gate:** no staging or production deployment, no AWS resource creation, no service enablement, no migration, no Git operation, and no administrator provisioning is authorized. The §11.6 / §13.2 staging-access checklist and the §13.3 staging-deployment checklist are **preserved unchanged** and remain blocked: all twelve staging-related environment names were `not set`; Netlify/Turso connectors are `unsupported`; no AWS/Netlify/Turso access, staging site/DB IDs, deploy authorization, staging-only secrets, secure secret-injection channel, separation-from-production confirmation, function/edge logs, hosted build, migration, or admin provisioning is available [R30]. `GH_TOKEN`/`GITHUB_TOKEN` are GitHub credentials, not staging credentials. Production remains prohibited.

**Required before any hosted test (requires approval, each separate):** a **separate** staging AWS account/bucket(s)/IAM role/GuardDuty protection plan/CloudFront distribution with written separation-from-production confirmation; staging-only credentials injected through a supported secure interface; a read-only staging DB schema inspection compared with `drizzle/0000_init.sql` (33 tables / 61 indexes / 47 FKs, one `0000_init` [R30]); a separate non-destructive migration approval; a staging-only administrator with **synthetic data only** (no real applicant submissions/documents); a single hosted build and function/edge log review.

**Staging verification matrix (all entries: NOT PERFORMED — requires approval and staging access):**

| ID | Test | Expected result |
|---|---|---|
| V1 | Upload a synthetic ~99 MiB valid MP4 | Accepted; `HeadObject.ContentLength` measured; finalize `verified` |
| V2 | Upload exactly 100 MiB (104,857,600 bytes) | Accepted if S3's `content-length-range` counts file bytes only; **document the observed boundary**, including 20 KB form-overhead behaviour (§13.2) |
| V3 | Upload 100 MiB + 1 byte, and a much larger file | S3 returns `EntityTooLarge` **before** an object is created; no quarantine object; server-side check would also reject [R12], [F18] |
| V4 | Tamper with the returned `key` / `bucket` / `Content-Type` / checksum field | Signed policy rejects (`AccessDenied` / `SignatureDoesNotMatch` / `BadDigest`) [F4], [F7] |
| V5 | Attempt `${filename}` or a key outside the quarantine prefix | Rejected; keys are always server-generated [F2], [F4] |
| V6 | Use the POST policy after `expiration` | Rejected by S3; finalize also rejects `expires_at` [F4] |
| V7 | Reuse the same POST policy twice | Second finalize rejected by single-use state; versioning reveals >1 version; no promotion of either; only **private** objects exist [F11], [F10] |
| V8 | Wrong `Content-Type`, `.exe` renamed `.mp4`, valid MP4 with a mismatched declared type | Rejected by exact `Content-Type` condition and/or server magic-byte check [R30] |
| V9 | Valid WebM and valid MP4 signature checks | `detectFileType()` returns the canonical extension; `testimonial-video` policy accepts [R30] |
| V10 | Corrupt checksum / mid-upload corruption | S3 `BadDigest` or server checksum mismatch → `rejected` + delete [F7], [F9] |
| V11 | Direct `GET` / `HeadObject` on a quarantine object without the clean tag | `403`; TBAC deny-by-default holds [R38] |
| V12 | GuardDuty clean result (`Completed` + `NO_THREATS_FOUND`) | Promotion occurs once; public object appears only then [F3], [F23] |
| V13 | EICAR-like synthetic test object → `THREATS_FOUND` | Never promoted; alert + manual review; deletion per approved retention [F23] |
| V14 | Password-protected / oversized-for-scanner synthetic object → `UNSUPPORTED` | Never promoted; `statusReasons` recorded [F23] |
| V15 | Remove GuardDuty IAM read permission (or use SSE-C) → `ACCESS_DENIED` | Never treated as clean; alert; role fixed; no promotion [F23], [R31] |
| V16 | Simulate scan failure / no EventBridge event / duplicate events | `FAILED` or reconciliation timeout → `rejected`/`expired`; duplicate results deduplicated; object stays private [F3], [F23] |
| V17 | Abandon an authorize without uploading; abandon after upload without finalize | Pending row expires; orphan object deleted by the quarantine Lifecycle rule; no public exposure [F24] |
| V18 | Request a published video with `Range` headers / seek | `206 Partial Content`; correct server-detected `Content-Type`, `nosniff`, cache headers; range caching works [R25], [R26] |
| V19 | Attempt CDN access to a quarantine key or a private CV key | `403` / not found; OAC limited to the public-media prefix [R57] |
| V20 | Unpublish a video | `archivedAt`, exact-path invalidation, origin object and all versions deleted, cached copy unreachable, audit entry written [R21] |
| V21 | Admin-only CV download and assessment submission with synthetic data | Existing guards, consent snapshot, timestamps, single transaction and private-key protections unchanged; CV never public [R30] |
| V22 | Browser CORS/CSP preflight for direct POST and CDN playback | Narrowly approved CSP + S3 CORS work from the staging origin; no wildcard origins [F13], [R30] |
| V23 | Netlify Function logs for authorize/finalize/promote | Small JSON bodies only; **no** 100 MiB body reaches a function; no signed policy/fields in logs [R27], [F22] |
| V24 | Upload a 100 MiB video from the likely user geography (West Africa) | Measure interruption/failure rate to validate the §13.10 single-request trade-off; **unverified** until tested |
| V25 | Cost/usage after the matrix | Actual requests, bytes scanned, tagging, EventBridge and CDN usage vs §13.13 estimates; budget alerts configured (acknowledging they are not a hard cap) [R56] |

**No test above was run.** No live AWS integration test, no hosted build, no staging deployment, and no production action occurred.

### 13.15 Remaining decisions requiring approval / unresolved questions

**Classification summary — clearly distinguishing the three categories:**

| **CONFIRMED (user decision — not re-opened)** | **RECOMMENDED (requires approval)** | **UNRESOLVED QUESTION (needs a user decision)** |
|---|---|---|
| Amazon S3 as target; Europe residency | `eu-west-1` (Ireland) as Region (§12.1.6) | Exact meaning of "100 MB": **100 MiB (104,857,600 B)** as used here, or decimal 100,000,000 B |
| Testimonial videos normally ≤100 MB; design around that limit | GuardDuty Malware Protection for S3 (§12.2.6 / §13.7) | Approved video format list: currently **mp4/webm only** — add others? |
| No multipart complexity unless technically necessary | Single-request presigned POST (§13.1), **multipart eliminated** (§13.10) | Integrity strategy: browser SHA-256 (memory cost) vs server streaming hash (egress cost) vs S3 stored checksum only (§13.6) |
| CV uploads separate; 10 MiB limit unchanged; transaction/consent/admin-download protections preserved | POST policy TTL (illustrative 300–600 s), `s3:signatureAge` deny | Whether `s3:signatureAge` applies to POST policies (**unverified**, staging test V6) |
| CloudFront delivery retained (OAC, Range, published-only, no quarantine/CV access) | Quarantine Lifecycle TTL + manual-review/deletion runbook | Exact retention window for failed/suspicious objects (investigation vs GDPR erasure) |
| Data residency Europe; no Region approved | Narrow CSP additions (`connect-src`/`form-action`/`media-src`) + S3 CORS | Whether to keep the small-asset proxy for all small assets once the CDN exists |
| GitHub push only after successful staging verification + separate explicit approval | Cost/billing approval before any spend; budgets, quotas, tags | Whether the likely audience's upload reliability warrants revisiting multipart **only after** V24 measurements |
| No staging/production/Git/implementation action in this task | Full §12.9 approval list (unchanged) | Netlify plan/function region, Turso DB residency, Free Tier status, vendor quotes (§12.8) |

**Exact approvals still required (each separate, explicit, written; none granted):** the full 16-item list in **§12.9 remains in force**, plus these refinements:

1. **100 MiB interpretation** — confirm 104,857,600 bytes as the enforceable ceiling (no limit change is authorized).
2. **Approved video format list** — confirm `video/mp4` + `video/webm` only.
3. **Single-request POST architecture** — the §13.1 nine-step state machine, including **new endpoints** (`upload-authorize`, `upload-finalize`, promotion handler, EventBridge consumer), the **`pending_uploads` table and its own migration approval**, and the exact POST policy conditions in §13.3.
4. **Integrity strategy and any new dependency** (browser hashing library, `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`).
5. **Authorization lifetime / replay controls** — policy TTL, versioning, `s3:signatureAge` applicability, single-use state machine.
6. **Malware-scanning approach and cost** — GuardDuty as an independent feature, quarantine-only prefix scope, tagging/TBAC, failure handling (§13.8), and per-Region feature verification.
7. **Failure/retention policy** — quarantine TTL, manual-review workflow, alert routing, deletion runbook (§13.8–13.9).
8. **CSP / CORS / CDN design** — narrow `connect-src`/`form-action`/`media-src` additions, S3 CORS, CloudFront OAC/Range/cache/invalidation, unpublish behaviour, and explicit acknowledgement that published videos are intentionally public (separate consent + erasure caveats).
9. **CV workflow approvals** — unchanged from §12.9 items 5/12; no CV change is approved.
10. **New environment variables / credentials** via secure interfaces (names only; no secrets in chat/docs).
11. **Cost/billing approval before any spend**, acknowledging budget alerts do not necessarily prevent charges.
12. **GDPR / data-protection package** (Region alone is not compliance).
13. **Staging resources and deployment**, read-only schema inspection, separate non-destructive migration, staging-only administrator with synthetic data, hosted build and log review, and the §13.14 verification matrix.
14. **GitHub commit/push only after successful staging verification AND a separate explicit approval.**
15. **Production** — all production actions remain prohibited.
16. **Multipart** — may be reconsidered only as a separate approval if V24 shows the single-request trade-off is unacceptable.

### 13.16 Official references added in this refinement (F1–F24)

R1–R59 in **§12.10 remain in force**. Sources fetched/verified on 5 November 2026 for this refinement:

| Ref | Source | Takeaway |
|---|---|---|
| F1 | Repository code (read-only, unchanged): `src/lib/files/validate.ts`, `src/lib/assessment/config.ts`, `src/lib/files/signatures.ts`, `src/middleware.ts`, `src/db/schema/enums.ts`, `src/app/api/media/[...key]/route.ts` | `MAX_UPLOAD_BYTES.video = 100*1024*1024` (100 MiB), `MAX_SUBMISSION_REQUEST_BYTES = 12 MiB`, `testimonial-video` → mp4/webm, `cv` → pdf/docx, MP4 `ftyp` @ offset 4 / WebM `1A 45 DF A3`, CSP `connect-src`/`form-action`/`media-src` = `'self'`, `STORAGE_PROVIDERS = ['blobs','local']`, public proxy filters `visibility='public'` |
| F2 | `https://raw.githubusercontent.com/awsdocs/amazon-s3-developer-guide/master/doc_source/HTTPPOSTForms.md`, `https://docs.aws.amazon.com/AmazonS3/latest/API/HTTPPOSTForms.html` (official AWS docs; SigV2-era form mechanics) | Form is `multipart/form-data` POST; `key` field; `${filename}` substitution; **file must be last field**; only one file per POST; non-file form data + boundaries ≤ **20 KB**; `success_action_status` 200/201/204 (default 204); redirect appends bucket/key/ETag (avoid); ACLs default `private` |
| F3 | `https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.md` (official, `.md`) | **POST Object is a default scan trigger** alongside PutObject/CopyObject/CompleteMultipartUpload; ≤5 prefixes; tagging must be enabled **before** upload; in-Region isolated no-internet VPC via PrivateLink; **at-least-once** EventBridge delivery (duplicate results, billed once); independent-feature mode has no findings; managed EventBridge rule |
| F4 | `https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html` (official POST Policy reference, retrieved via search index; direct page returns cookie/Welcome shell) | Policy always has `expiration` + `conditions`; exact-match, `starts-with`, `content-length-range` (bytes, e.g. `[1048576, 10485760]`), comma-separated Content-Type lists; `bucket` exact only; `key`, `Content-Type`/`Content-Disposition`/`Cache-Control`/`Content-Encoding`, `success_action_status`, `x-amz-algorithm`/`credential`/`date`/`security-token`, `x-amz-meta-*`, `x-amz-*` |
| F5 | `https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html` (official) | `Content-Length`, ETag, `x-amz-version-id`, `Content-Type`, `x-amz-server-side-encryption`, `x-amz-storage-class`, `x-amz-tagging-count`, `versionId` and `x-amz-checksum-mode` parameters, checksum response headers |
| F6 | `https://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectPOST.html` (official POST Object API reference, retrieved via search index) | Form fields (incl. `key`, `success_action_status`, `success_action_redirect`), checksum fields, `x-amz-version-id` / `x-amz-expiration` response headers |
| F7 | `https://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectPOST.html` (official, "Additional Checksum Request Form Fields") | `x-amz-checksum-algorithm` supports CRC32/CRC32C/SHA1/SHA256; matching `x-amz-checksum-sha256` (base64 256-bit digest) is conditional-required; S3 returns the checksum and a version ID |
| F8 | `https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html` (official) | Full SigV4 checksum algorithm list (CRC64NVME, CRC32, CRC32C, SHA1, SHA256, SHA512, MD5, XXHash*) and `BadDigest` on mismatch; `x-amz-version-id` response |
| F9 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html` (official) | Checksums/ETag integrity; ETag is **not** an MD5 digest for multipart uploads; single PUT up to 5 GB |
| F10 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html` (official, `.html` fetched) | `If-None-Match: *` prevents overwrites; supported APIs are **PutObject, CompleteMultipartUpload, CopyObject** — **not POST Object**; requires SigV4; `If-Match` ETag variant |
| F11 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.md`, `.../PresignedUrlUploadObject.md` (official, `.md` fetched) | "You can use the presigned URL **multiple times**, up to the expiration date and time"; "If an object with the same key already exists … S3 **replaces** the existing object"; bearer token; IAM-user ≤7 days, temporary credentials expire with session; `s3:signatureAge` 600,000 ms deny example; SigV4 checksum support |
| F12 | `https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/` (**secondary**, illustrative) | `createPresignedPost` returns `{ url, fields }`; POST policy signs only the policy, PUT signs the whole request; only exact `Content-Type` for PUT |
| F13 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.md` (official, `.md` fetched) | S3 CORS matches `AllowedOrigins`, `AllowedMethods`, `AllowedHeaders` from the preflight; ACLs/policies still apply |
| F14 | `https://docs.oracle.com/en-us/iaas/Content/Object/s3-post-upload.htm` (**secondary**, S3-compatible implementation) | Each form field (excluding `x-amz-signature`, `file`, `policy`, `x-ignore-*`) must have at least one policy condition; POST ceiling documented as 5 GB |
| F15 | `https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_s3_presigned_post.html`, `https://vercel.com/kb/guide/how-can-i-use-aws-s3-with-vercel` | `createPresignedPost` with `Conditions` / `Fields` / `Expires`; `content-length-range` example |
| F16 | `https://aws.amazon.com/s3/faqs/` (official, chunk 1 fetched) | "The largest object that can be uploaded in a **single PUT is 5 GB**"; objects up to 50 TB; "For objects larger than **100 MB**, customers **should consider** using the multipart upload capability" — advisory, not a requirement |
| F17 | `https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/upload-objects.html` (official AWS documentation mirror) | Single PUT up to 5 GB; multipart for objects from 5 MB to 50 TB, 1–10,000 parts; console max 160 GB |
| F18 | `https://runsite.app/blog/s3-presigned-urls`, `https://advancedweb.hu/differences-between-put-and-post-s3-signed-urls/`, `https://fast.io/resources/s3-presigned-url-file-size-limit/` (**secondary**) | POST `content-length-range` yields `EntityTooLarge`/`EntityTooSmall` before an object exists; a plain presigned PUT has no size range; POST ceiling 5 GB; PUT can at best pin one exact `Content-Length` |
| F19 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html`, `https://github.com/awsdocs/amazon-s3-developer-guide/blob/master/doc_source/Introduction.md` (official) | **Strong read-after-write consistency** for PUT/DELETE and object metadata (HEAD) in all Regions; no object locking for concurrent writers (latest timestamp wins) — motivates app-level single-use state |
| F20 | `https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/` (**secondary**) | PUT can pin an exact `Content-Type` but no generic prefix/range; POST supports `starts-with` and ranges |
| F21 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.md` (official, `.md` fetched) | Bucket policies can enforce `s3:if-none-match` / `s3:if-match` for `s3:PutObject`; multipart operations exempt via `s3:ObjectCreationOperation`; copy operations to a conditionally-enforced bucket are restricted |
| F22 | `https://aws.amazon.com/blogs/security/how-to-securely-transfer-files-with-presigned-urls/` (official AWS security blog) | Presigned URLs are bearer tokens reusable until expiry; use short expiries and avoid logging full URLs/query strings |
| F23 | `https://docs.aws.amazon.com/guardduty/latest/ug/monitoring-malware-protection-s3-scans-gdu.md` (official, `.md` fetched) | Result values `NO_THREATS_FOUND`, `THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED`; statuses `Completed`/`Skipped`/`Failed`; `statusReasons` including `UNAUTHORIZED_TO_GET_OBJECT`, `UNAUTHORIZED_TO_ASSUME_ROLE`, `SSE_C_ENCRYPTED_OBJECT`, `OBJECT_E_TAG_CHANGED`, `BUCKET_NOT_FOUND`, `UNSUPPORTED_STORAGE_CLASS`, `OBJECT_SIZE_LIMIT_EXCEEDED`, `PASSWORD_PROTECTED`, `EXTRACTED_*` limits |
| F24 | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.md` (official, `.md` fetched) | Lifecycle **Expiration actions** delete expired objects; rules apply to existing and new objects; **a bucket policy cannot prevent lifecycle deletions/transitions**; billing stops at eligibility even if deletion is queued; lifecycle transition requests are billed |

**Source-quality notes:** the AWS API-reference pages for POST Policy / POST Object returned the S3 "Welcome" redirect from this sandbox; their content was obtained from the official AWS pages via search indexing [F4], [F6], [F7]. SigV2 form mechanics in [F2] are official AWS documentation but describe the deprecated signature version — the design uses **SigV4 only** [R11], [R12]. Secondary sources [F12], [F14], [F18], [F20] are labelled as such and are used only to corroborate, never as the sole basis for a security decision.

### 13.17 Repository preservation verification — before and after

Both checks were run from `/home/user/immi-website`; no Git operation, staging action, or production action occurred in between. "Before" is the baseline re-verified at the start of this final design refinement; "after" is the verification run after the §13 / §15 appends.

| Check | Before | After |
|---|---|---|
| Branch | `arena/cdcb43ad-immi-website` | `arena/cdcb43ad-immi-website` (unchanged) |
| HEAD | `bc53028b18b4ad9f8f2391b816a872973cbae457` | same (unchanged) |
| Tracked paths | **1** (`README.md`) | **1** (`README.md`) |
| Untracked paths (exact, `git ls-files --others --exclude-standard`) | **283** | **283** |
| `git status --porcelain` entries | 15 (collapsed untracked directories — not the exact count) | 15 (same) |
| Staged paths | **0** | **0** |
| Modified tracked paths | **0** | **0** |
| `.data/local.db` SHA-256 | `7c16c81cc383ae5832c16e02e364f1ed2a15debdcb8edce5bf331aa4df548ff3` | identical |
| `.data/secret-markers.json` SHA-256 | `2e5688ef56d38b4cb1932fe9980ed600041fa415addeccb7800baca5bdee47d0` | identical |
| `docs/PHASE-8-REPORT.md` lines | **1394** (§§12.0–12.12) | **1780** (§§12.0–12.12 preserved + §§13.0–13.18) |
| `docs/DEPLOYMENT.md` lines | **449** (§§14.0–14.11 + header note) | **636** (§§14.0–14.11 preserved + §§15.0–15.14) |
| Appendix A exact inventory | **283/283** | **283/283** — 5 fenced `text` blocks, 283 listed, 283 unique, 0 missing, 0 extra, 0 duplicates |
| Trailing whitespace / tabs / control characters | 0 / 0 / 0 | 0 / 0 / 0 |
| High-confidence secret-value patterns in the two docs | 0 | 0 |
| Files modified in the last 30 minutes | — | **exactly 2**: `docs/PHASE-8-REPORT.md`, `docs/DEPLOYMENT.md` |
| Cross-reference integrity | §11.6, §13.2, §13.3, §12.8–12.12, §14.10–14.11 present | §§13.0–13.18 and §§15.0–15.14 continuous; **R1–R59: 59 defined, 59 used**; **F1–F24: 24 defined, 24 used, 0 undefined, 0 unused** |
| §13 / §15 evaluation sections | absent | present in `docs/PHASE-8-REPORT.md` / `docs/DEPLOYMENT.md` |
| Staging verification | **not verified** | **not verified** |
| Phase 8 completion | not complete | **not complete** |

**Parser caution (recorded for future checks):** the exact untracked baseline must come from `git ls-files --others --exclude-standard` (283 paths), not `git status --porcelain` (15 collapsed directory entries). Appendix A consists of **five** fenced `text` blocks — a parser that reads only the first returns 239 paths and falsely reports 44 missing; a parser that filters lines without `/` drops 10 root config paths. The verified parser reads every plain line inside every fenced block within Appendix A.

**No change to:** any AWS account, bucket, IAM role, policy, key, subscription or paid service; any application source, configuration, dependency, upload limit, database schema, migration ledger, middleware, CSP, media access control, or environment variable; any staging resource, administrator, deployment, function/edge log, hosted build, or separation confirmation; any production resource; any Git state (no stage, commit, push, branch change); any secret value (none printed, stored, or requested). **No live AWS integration test was performed.** No cost was incurred.

### 13.18 Final verdict and stop point

**Delivered (documentation only):** the final recommended **single-request** upload architecture (§13.1), strict two-layer 100 MiB enforcement (§13.2–13.4), the presigned POST vs PUT decision (§13.5), completion verification and replay prevention (§13.6), GuardDuty integration and all four failure outcomes (§13.7–13.8), abandoned-upload cleanup (§13.9), the **explicit elimination of multipart** with evidence (§13.10), CV separation (§13.11), the retained CloudFront delivery design (§13.12), cost implications (§13.13), a 25-test staging verification matrix (§13.14), exact approvals and unresolved questions (§13.15), official references F1–F24 (§13.16), and this before/after verification (§13.17).

**documented:** POST Policy `content-length-range`/exact `key`/`Content-Type`/`expiration`; S3 5 GB single-request ceiling; the advisory (not mandatory) 100 MB multipart guidance; presigned tokens are reusable and replace same-key objects; `If-None-Match` does not apply to POST Object; POST Object triggers GuardDuty scans; strong read-after-write consistency; POST checksum form fields; Lifecycle expiration; all five GuardDuty scan outcomes. **estimated:** per-video costs (~$0.009 GuardDuty, ~$0.0045 storage, <~$0.001 requests) and the §12 scenario totals. **unverified:** exact `content-length-range` byte semantics, POST applicability of `s3:signatureAge`, Region-specific rates/feature availability, Netlify/Turso plans, actual audience upload reliability, all hosted behaviour. **requires approval:** every item in §13.15; **unresolved questions:** the 100 MB/100 MiB interpretation, approved format list, integrity strategy, retention window.

**STOP HERE.** Do **not** claim implementation, enabled scanning, AWS testing, verified staging, or Phase 8 completion. **No Region, scanner, architecture, credential, bucket, paid service, source/config/dependency/upload-limit/schema/migration/deployment/Git operation, or production action has been approved or performed.** Await the user's review and explicit approval before implementation. The staging gate remains blocked; production remains prohibited.

---

## 14. Consolidated Phase 8 Approval Matrix and Controlled Implementation Plan (5 November 2026)

> **THIS IS A DOCUMENTATION AND DECISION-PREPARATION EXERCISE ONLY.** This section is appended after, and **preserves in full**, §§1–13 — including the §12.9 / §13.15 / §14.9 / §15.13 approval lists, §13.18 / §14.10 / §15.14 stop points, the §11.6 / §13.2 / §13.3 staging checklists, all official references **R1–R59** and **F1–F24**, and the 283-path Appendix A. **No prior decision is rewritten or changed in meaning; no approval has been granted or inferred.** No application code, upload limit, AWS/Netlify/Turso resource, paid service, GuardDuty enablement, database schema or migration, staging infrastructure, administrator, deployment, Git operation, or production resource was created or changed. No secret was requested, printed, or stored. No cost was incurred. Staging remains **unverified**; Phase 8 is **not complete**.

### 14.0 Scope, reconciliation and status vocabulary

**Reconciliation performed.** This section consolidates, without altering them:

- **§12.9** — the 16-item exact approval list (Region, scanner, billing, S3 architecture, CV workflow, CDN/CSP, env vars, upload limits, cost controls, GDPR, staging resources, read-only inspection + migration, staging admin, hosted verification, GitHub, production).
- **§13.15** — the confirmed/recommended/unresolved classification and 16 refinement approvals (100 MiB interpretation, formats, POST architecture, integrity strategy, TTL/replay, scanner, retention, CSP/CORS/CDN, CV, env vars, billing, GDPR, staging, GitHub, production, multipart).
- **§13.18** — the final "stop here" verdict and evidence labels.
- **`docs/DEPLOYMENT.md` §14.9 / §15.13 / §15.14** — the operational mirrors of the same lists and stop points.
- **§§13.0–13.13 / §§15.0–15.11** — the latest single-request testimonial-video architecture, CV separation, CloudFront delivery and cost figures.

**Consolidation rule:** where the same requirement appears in several sections, this matrix gives it **one item number** and cross-references all sources. Where §12.9 and §13.15 overlap, the stricter (more specific) requirement governs. Historical wording is preserved: the §11.6 / §13.2 cell "no provider selected" is a dated record — the user subsequently confirmed **Amazon S3** as the implementation target (§12.0, §13.0), which does **not** reopen provider selection and does **not** approve any Region, scanner, architecture, credential or resource.

**Status vocabulary (used consistently below):**

| Status | Meaning |
|---|---|
| **CONFIRMED** | Already decided by the project owner; not re-opened here. Implementation is still separate. |
| **RECOMMENDED — NOT APPROVED** | Advice only. **A recommendation is never an approval.** |
| **UNDECIDED** | No selection made; requires an owner decision, possibly after evidence. |
| **UNRESOLVED QUESTION** | An owner decision is needed to choose between documented alternatives. |
| **UNVERIFIED** | A factual/price/availability question needing account access, a hosted test or a vendor quote. |
| **BLOCKED** | Required resources, identifiers, credentials or secure access are unavailable. |
| **NOT AUTHORIZED / NOT PERFORMED** | No permission granted; no action taken. |
| **PROHIBITED** | Explicitly excluded from the current Phase 8 authorization. |

**Standing cautions carried forward:** a European Region alone does **not** guarantee GDPR compliance [R2], [R28]; free allowances do **not** make production free [R39], [R20], [R7]; **budget alerts do not necessarily prevent charges** [R56]; unpublished commercial pricing requires a **vendor quote** [R53]; scanning costs are kept separate; all cost figures are rounded illustrations, not bills.

### 14.1 Consolidated approval matrix

> **Read this first:** every row marked `RECOMMENDED — NOT APPROVED`, `UNDECIDED`, `UNRESOLVED`, `BLOCKED`, `NOT AUTHORIZED` or `PROHIBITED` is **unapproved**. Being listed in the *Recommendation* column confers **no** authorization. Column 6 states the **primary** approval; an item may require several separate approvals (see §14.2). "Cost" means **potential additional cost if approved and executed** — none is approved or incurred now.

| # | Decision or action | Current status | Existing evidence / documentation reference | Recommendation | Approval required from project owner | Dependencies or blockers | Additional cost? |
|---|---|---|---|---|---|---|---|
| **M01** | **AWS S3 adoption** as the object-storage implementation target | **CONFIRMED** (owner decision) | §11.1.6, §12.0, §13.0; `docs/DEPLOYMENT.md` §13.1 | Retain as the sole target; do not reopen provider selection. Note this confirms a *target*, not any resource or implementation | **None for the decision itself** (already confirmed). All implementation/resource approvals remain separate (M19–M21, M28) | None for the decision; every downstream item depends on it | No direct cost; enables future recurring costs |
| **M02** | **European AWS Region selection** | **UNDECIDED** — no Region approved | §12.1.1–12.1.6, §12.9(1), §14.9(1), §13.15 classification, §12.8 items 1/2/5/6 | Select one EU/EEA Region only after evidence closure; **do not assume** any Region | **Yes — architectural (D02)** | Region-specific S3/GuardDuty rate tables; Malware Protection for S3 feature availability per Region; Netlify plan/function-region eligibility; Turso residency; Free Tier status; DPA/sub-processor review | **Yes** — sets recurring storage/scanning rates (rates **unverified**) |
| **M03** | **Ireland `eu-west-1`** as primary Region | **RECOMMENDED — NOT APPROVED** | §12.1.6, §12.9(1); `docs/DEPLOYMENT.md` §14.1 | Approve as primary candidate **only after** M02 evidence; otherwise decline in favour of M04 | **Yes — architectural, separate decision (D03)** | M02 evidence; §12.8 items 1/2/5/6 | **Yes** — recurring; est. $0.023/GB-month S3 Standard (**unverified**) [R23] |
| **M04** | **Frankfurt `eu-central-1`** as alternative | **RECOMMENDED as alternative — NOT APPROVED** | §12.1.6, §12.9(1); `docs/DEPLOYMENT.md` §14.1 | Retain as fallback; approve only if M03 is declined | **Yes — architectural, separate decision (D04)** | M02 evidence; M03 decision | **Yes** — recurring; est. $0.0245/GB-month (**unverified**) [R23] |
| **M05** | **Single-request presigned POST architecture** (nine-step state machine; multipart eliminated) | **RECOMMENDED — NOT APPROVED; DESIGN ONLY** | §13.1–13.6, §13.10, §15.1–15.6, §15.8; §12.9(4), §13.15(3) | Approve the design in principle; **design approval does not authorize implementation** (§14.3) | **Yes — architectural design approval (D05, D06)** | M03/M04 Region, M11 scanner, M19 table/migration, M20 endpoints, M21 env vars, M16 CSP/CORS | No direct cost; enables S3/GuardDuty/CloudFront charges |
| **M06** | **100 MiB testimonial-video limit** | **CONFIRMED** as design ceiling; **UNRESOLVED** interpretation; **no app limit changed** | §13.0, §13.2–13.4, §15.0, §15.4, F1, F16, F18; §12.9(8), §13.15(1) | Confirm **100 MiB = 104,857,600 bytes** (rather than decimal 100,000,000 B); keep `MAX_UPLOAD_BYTES.video` unchanged; two-layer enforcement (§13.2/§13.4) | **Yes — interpretation decision (D07)**; boundary evidence via SV-05 | Exact `content-length-range` byte semantics **unverified** (§12.8 item 4); staging tests V1–V3 | No |
| **M07** | **Approved video formats** | **UNRESOLVED QUESTION** (code currently mp4/webm only) | §13.2, §15.2, F1, R30; §13.15(2) | Approve `video/mp4` + `video/webm` only; require magic-byte detection, never extensions/browser MIME | **Yes — architectural (D08)** | None for the decision; hosted validation via SV-06 | No |
| **M08** | **Upload integrity verification** strategy | **UNRESOLVED** strategy; independent verification **RECOMMENDED** | §13.2, §13.6, §15.2, §15.6, F7–F9; §13.15(4) | Choose one: browser SHA-256 bound in the POST policy / server-side streaming hash / S3 stored checksum + ETag/VersionId; approve any new dependency separately | **Yes — technical + implementation, after evidence (D17)** | Staged checksum test SV-06/V10; dependency approval M21; browser memory cost vs S3 egress cost | **Potential** — streaming hash adds S3 egress; browser hashing no direct cost |
| **M09** | **Upload authorization expiry and replay protection** | **RECOMMENDED — NOT APPROVED**; one element **UNVERIFIED** | §13.2, §13.6, §15.6, F11, F19, F21, F22; §13.15(5) | Approve illustrative 300–600 s TTL, single-use `pending_uploads` state, versioning, ETag/VersionId binding, `s3:signatureAge` deny, no signed fields in logs | **Yes — architectural + technical evidence (D18)** | `s3:signatureAge` applicability to **POST policies** is **unverified** (§12.8 item 4); staging tests V6–V7 / SV-07 | No direct cost; versioning adds storage |
| **M10** | **Private quarantine architecture** | **RECOMMENDED — NOT APPROVED** | §13.1–13.2, §13.7, §15.1–15.2, §12.9(4), R10, R31, R38 | Approve separate quarantine bucket/prefix, 4× Block Public Access, `Bucket owner enforced`, SSE-S3/SSE-KMS (not SSE-C), deny-by-default IAM, TBAC deny-until-clean | **Yes — architectural (D09)** | M03 Region, M11 scanner, M21 env vars | **Yes** — recurring storage; lifecycle deletes |
| **M11** | **GuardDuty Malware Protection for S3** | **RECOMMENDED — NOT selected, NOT enabled** | §12.2.1, §12.2.6, §13.7, §15.7; §12.9(2), §13.15(6); `docs/DEPLOYMENT.md` §14.2 | Approve as an independent feature scoped to the quarantine-only prefix, tagging enabled before first upload, TBAC, EventBridge dedupe — **or decline** in favour of self-managed ClamAV / commercial scanner (§12.2.2–12.2.3) | **Yes — architectural selection (D23) AND separate billing approval (D24)** | M02 per-Region feature availability (**unverified**); M28 billing; tagging/S3 API/EventBridge costs excluded from Free Tier [R39] | **Yes — recurring**: ~$0.009 per 100 MiB video (**estimated**); $0.09/GB + $0.215/1,000 objects (documented US East example [R16], Region rate **unverified**) |
| **M12** | **Malware-scanning failure handling** (`THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED`, no result) | **RECOMMENDED — NOT APPROVED** | §13.8, §15.7, F23, R35, R39; §13.15(7) | Approve fail-closed outcomes, manual-review queue, alert routing, generic admin errors, no promotion of any non-clean object | **Yes — architectural + operational (D12)** | M11, M13 retention, M22 GDPR; SV-08 | **Potential** — on-demand rescans excluded from Free Tier; storage during review |
| **M13** | **Quarantine retention and cleanup** TTL | **UNRESOLVED** — no retention policy approved | §13.8–13.9, §15.8, F24, §12.9(4), §13.15(7) | Approve an explicit TTL, Lifecycle `Expiration` + `NoncurrentVersionExpiration`, reconciliation job and deletion runbook | **Yes — architectural + GDPR (D21, D33)** | M22 GDPR erasure analysis; SV-16; S3 Lifecycle deletions are queued, not instantaneous [F24] | **Yes** — lifecycle transition requests + storage during retention |
| **M14** | **CloudFront Origin Access Control (OAC)** | **CONFIRMED** retained as design; implementation **NOT APPROVED** | §13.12, §15.10, §12.5; §12.9(6); `docs/DEPLOYMENT.md` §14.5; R57, R10 | Approve OAC on a dedicated public-media origin; never an S3 website endpoint; 4× Block Public Access | **Yes — architectural design (D10) + implementation + billing (D25)** | M03, M15, M16, M28 | **Yes — recurring** egress, HTTPS requests, invalidation [R7], [R21] |
| **M15** | **Public testimonial-video delivery and publication consent** | Design **CONFIRMED** retained; publication consent **UNRESOLVED** | §13.12, §15.10, §12.5; §12.9(6); `docs/DEPLOYMENT.md` §14.9(6) | Approve the explicit acknowledgement that published videos are intentionally public, a **separate** publication consent, unpublish/invalidation behaviour and the erasure caveat | **Yes — architectural + GDPR (D11, D21)** | M22 GDPR; SV-11/SV-12; edge caches persist until TTL/invalidation | **Yes** — CDN delivery; potential bot/hotlinking egress |
| **M16** | **CSP and S3 CORS changes** | **NOT APPROVED**; explicitly prohibited in documentation tasks | §13.2, §13.12, §15.2, §15.10; §12.9(6), §13.15(8); R30, F13 | Approve narrow `connect-src` / `form-action` / `media-src` additions and site-origin-only S3 CORS; no wildcard origins; no broadened directives | **Yes — separate implementation approval (D19)** | Hosted CSP/CORS behaviour **unverified** (§12.8 item 11); SV-18; M20, M21 | No direct cost |
| **M17** | **Separate private CV upload architecture** | **CONFIRMED** separation; implementation **NOT APPROVED** | §13.11, §15.9, §12.4; §12.9(5); `docs/DEPLOYMENT.md` §14.4 | Keep a **fully separate** workstream (P5): no shared endpoints, keys, buckets or pending-upload records with testimonial videos | **Yes — architectural + separate implementation (D13, D15)** | M19 migration, M20, M21, M23 staging | **Yes** — separate storage/scanning |
| **M18** | **CV validation and scanning** | **CONFIRMED** preservation of 10 MiB limit + validation; implementation **NOT APPROVED** | §13.11, §15.9, §12.4; §12.9(5); R30 | Keep pdf/docx magic-byte validation, independent malware scanning, association only after successful verification, unchanged `MAX_SUBMISSION_REQUEST_BYTES = 12 MiB` | **Yes — implementation, separate from M05 (D15)** | M11, M17, M19, SV-13/SV-14 | **Yes** — scanning + private storage |
| **M19** | **`pending_uploads` database table and migration** | **NOT APPROVED** — no schema/migration work performed | §13.1 step 2, §12.4.4, §13.17; §12.9(4)/(12), §13.15(3); `docs/DEPLOYMENT.md` §14.4 / §15.13 | Approve table shape, new Drizzle `0001_*` migration + `_journal.json` entry, scan-status columns, and (if needed) an `s3` value for `STORAGE_PROVIDERS` | **Yes — separate database migration approval (category E, D31–D34)** | Read-only staging schema inspection vs `drizzle/0000_init.sql` (33 tables / 61 indexes / 47 FKs) and `_journal.json` (one `0000_init`); **stop on conflict** | No direct cost (schema only); enables storage costs |
| **M20** | **New upload API endpoints** | **NOT APPROVED** — no code written | §13.1, §15.1; §12.9(4)/(5), §13.15(3) | Approve `upload-authorize`, `upload-finalize`, promotion handler, EventBridge consumer, preserving `guardMutation`, CSRF and `throttleCmsMutation` | **Yes — implementation (D14, D16)** | M05, M19, M21, M16 | No direct cost; Netlify Functions usage may be plan-dependent (**unverified**) |
| **M21** | **New environment variables and credentials** | **NOT APPROVED** — none created | §12.9(7), §13.15(10); `docs/DEPLOYMENT.md` §14.9(7), §13.2 gates 3/9–12 | Approve **exact variable names only**; inject via Netlify env UI/CLI/API with **Functions** scope and correct deploy context; never print/ask for values | **Yes — implementation + secure-interface access (D20, D30)** | M23 staging site; written separation-from-production confirmation; presence-only verification | No direct cost; credentials enable billable resources |
| **M22** | **GDPR / privacy documentation and data handling** | **NOT APPROVED** | §12.1.5, §12.9(10), §13.15(12); `docs/DEPLOYMENT.md` §14.9(10); R2, R28, R29 | Approve DPA/sub-processor review, transfer-impact assessment, privacy-notice update, testimonial-publication consent, retention/deletion schedules, records-of-processing/DPIA work | **Yes — architectural/compliance (D21)** | M02/M03; Turso residency **unverified** (§12.8 item 6); M13 | No direct cost; may need vendor/legal quotes (**unverified**) |
| **M23** | **Staging Netlify site and Turso database** | **BLOCKED** — no IDs, credentials or secure access | §11.6, §12.7; `docs/DEPLOYMENT.md` §13.2 (14 gates), §13.3, §13.4, §14.8 | Provide a separate staging site ID/URL, draft-only deploy auth, staging DB identifier, read-only access, Function/Edge log access and written separation confirmation | **Yes — staging resource approval (category D, D26–D29) + billing (D22)** | All 12 staging env names `not set`; Netlify/Turso connectors `unsupported`; no secure secret channel; deploy/build egress blocked; no billing view | **Yes — potential** Netlify/Turso plan costs **unknown/unverified**; EU function region is a Pro/Enterprise feature [R27] |
| **M24** | **Staging administrator provisioning** | **NOT AUTHORIZED** | §12.9(13), §13.15(13); `docs/DEPLOYMENT.md` §13.3 step 10 | Staging-only account, fresh staging-only credentials, **synthetic data only**, no real applicant documents, no production admin | **Yes — staging resource approval (D29)** | M23 | No direct cost |
| **M25** | **Hosted build and staging verification** | **NOT PERFORMED / NOT AUTHORIZED** | §13.14 (V1–V25), §15.12; §12.9(14); `docs/DEPLOYMENT.md` §13.3 steps 6–11 | Approve one hosted build + Function/Edge log review + the §14.5 verification matrix before **any** claim that staging works | **Yes — staging deployment + hosted verification (D35–D37)** | M23, M24, M19, M16, M20; hosted Deno/edge behaviour **unverified** (§12.8 item 5) | **Yes** — build minutes / Function invocations / bandwidth (**unverified**) |
| **M26** | **GitHub commit and push** | **NOT AUTHORIZED** — no Git operation performed | §12.9(15), §13.15(14), §13.18; `docs/DEPLOYMENT.md` §13.3 step 12, §14.9(15) | Do **not** push. Request only **after successful staging verification AND a separate explicit approval**; push only to `arena/cdcb43ad-immi-website` | **Yes — separate GitHub approval (category G, D38–D39)** | M25 success; separate explicit approval; never `--prod` | No direct cost; may trigger a Git-connected build |
| **M27** | **Production deployment and production administrator provisioning** | **PROHIBITED — excluded from current Phase 8 authorization** | §12.9(16), §13.15(15), §13.18; `docs/DEPLOYMENT.md` §14.9(16), §15.14 | Decline / defer. Production deployment, production DB access/migration, production resource modification, production credentials and production admin provisioning are prohibited | **None requested — explicitly excluded**; would require a new, separate authorization (D40–D41) | All prior phases + a new authorization | **Yes** — recurring production costs (excluded) |
| **M28** | **Cost / billing approval and budget controls** | **NOT APPROVED** — no spend incurred | §12.6, §12.9(3)/(9), §13.13; `docs/DEPLOYMENT.md` §14.6, §14.9(3)/(9), §15.11 | Approve the §14.6 cost summary, a budget cap, Budgets/Cost Anomaly Detection/CloudWatch alerts, cost tags and quotas, acknowledging alerts are **not** a hard cap [R56] | **Yes — billing / cost approval (category C, D22, D24, D25), before any account/bucket/subscription** | M02, M11, M14, M23; current vendor confirmation of all **unverified** prices | N/A — this **is** the cost approval |
| **M29** | **Upload-limit changes** | **NONE APPROVED; limits unchanged** | §12.9(8), §13.0, §13.4, §15.4; `docs/DEPLOYMENT.md` §14.9(8) | Decline any change to `MAX_UPLOAD_BYTES` or `MAX_SUBMISSION_REQUEST_BYTES` unless every layer is evidenced and separately approved | **Yes — separate, only if proposed (D07 includes "no change")** | Hosted 6 MB / ≈4.5 MB binary ceiling evidence [R27], [R55] | No direct cost |
| **M30** | **Multipart reconsideration** | **ELIMINATED** for ≤100 MiB; revisitable only after evidence | §13.10, §15.8, §13.15(16), F16 | Keep single-request; reconsider **only** if SV-19 (V24) shows unacceptable upload failure rates, via a separate approval | **Yes — separate, conditional on SV-19 (D06)** | SV-19 measurement from the likely user geography; no measurement performed | **Potential** — ~15 S3 requests vs ~4–6 per video |
| **M31** | **Small-asset public-media proxy retention** | **UNRESOLVED**; design recommendation retained | §13.12, §15.10, §12.5, §12.8 item 13 | Retain `/api/media/[...key]` for small assets (buffers `Uint8Array`→`ArrayBuffer`, bounded by 6 MB/20 MB); route only validated published videos to CloudFront | **Yes — architectural (D13a)** | M14, M16, SV-11 | No direct cost; proxy function usage (**unverified**) |
| **M32** | **Optional services and exclusions** (backup/replication, flat-rate CDN plan, Marketplace scanners, KMS, WAF, CloudWatch, Support, tax) | **NOT APPROVED** — excluded from all totals | §12.6.2–12.6.3, §12.2.3, §14.6; `docs/DEPLOYMENT.md` §14.6 | Explicitly decline for now, or approve each separately after a vendor quote / allowance-term confirmation; none is included in the estimates | **Yes — separate billing approval for each (D22, D25)** | Vendor quotes; CloudFront flat-rate allowance terms **unverified** [R22] | **Yes — additional recurring**; amounts **unverified** |

**Matrix integrity:** 32 items; all 27 owner-listed subjects are covered (Ireland and Frankfurt are split into M03/M04). No row marked `RECOMMENDED` is approved. Production (M27) is the only row whose approval is **not** being requested.

### 14.2 Authorization categories A–H

Items may legitimately appear in more than one category; column 6 of §14.1 states the **primary** approval. This grouping separates *what kind of authorization* is needed.

| Cat. | Category | Items | What the owner is being asked to authorize |
|---|---|---|---|
| **A** | **Decisions that can be approved now** (existing documentation suffices; no new technical evidence needed for the *decision itself*) | M01 (ratification), M05, M06 (interpretation), M07, M10, M12 (policy in principle), M14 (design), M15 (consent decision), M17, M18 (principle), M22 (workstream), M29, M30 (elimination), M31 | An **approve / decline** on design intent and product rules. **Even a "yes" here authorizes no code, resource, purchase, migration, deployment or Git action.** M06's *boundary behaviour* and M30's *revisit* still depend on category B evidence |
| **B** | **Decisions requiring additional technical evidence** | M02, M03, M04, M08, M09, M11 (per-Region availability), M13, M16, M19 (migration shape), M20 (hosted contracts), M21 (exact names/secure interface), M23 (hosted build/Deno), M25, M32 | Wait for: Region-specific S3/GuardDuty rate tables; Malware Protection for S3 feature availability; Free Tier/credit status; exact `content-length-range` byte semantics; `s3:signatureAge` POST applicability; checksum-strategy staged test; hosted CSP/CORS and edge behaviour; Netlify plan eligibility; Turso residency; vendor quotes/allowance terms; SV-19 reliability measurement (§12.8, §13.15, §14.9) |
| **C** | **Decisions requiring billing or cost approval** | M02 (rate basis), M11, M14, M15, M23, M25, M28, M32 — **and any creation of an account, bucket, subscription or paid service** | Approve the §14.6 cost summary and a budget **before any spend**; approve each recurring service; acknowledge budget alerts do not prevent charges [R56]. **No paid service is approved by this exercise** |
| **D** | **Actions requiring staging access and resources** | M23, M24, M25, and the hosted verification of M05, M08, M09, M16, M17, M19, M20, M21, M30 | Provide separate Netlify staging site, Turso staging DB, AWS staging resources, secure secret interface, written separation confirmation, Function/Edge log access and a permitted runner. **Currently blocked** (§11.6, §13.2, §12.7) |
| **E** | **Actions requiring a separate migration approval** | M19 (and the schema-dependent parts of M17, M18, M20) | First a **read-only** schema inspection vs `drizzle/0000_init.sql` / `_journal.json`; **then** a separate, explicit, **non-destructive** migration approval; stop on any drift; never add `TURSO_DATABASE_URL` to a build (§12.9(12), §13.3 step 4) |
| **F** | **Actions requiring successful staging verification** | M25 (as the gating outcome), M26, and **any claim** that staging works or that Phase 8 is complete | Completion of the §14.5 checklist with synthetic data only, log evidence, no secrets printed, and no failed gate (§13.3) |
| **G** | **Actions requiring separate GitHub approval** | M26 | A **separate explicit approval after successful staging verification** for a commit and a push to `arena/cdcb43ad-immi-website` only; no Git operation is authorized now (§12.9(15)) |
| **H** | **Production actions that remain prohibited** | M27 — production deployment, production DB access/migration, production resource modification, production credentials, production administrator provisioning | **Nothing.** These are explicitly excluded from the current Phase 8 authorization and require a new, separate authorization (§12.9(16), §13.18) |

### 14.3 Architectural approval vs implementation authorization

**The distinction, stated plainly.** *Approving an architectural design* means the project owner agrees that a documented approach is acceptable **in principle** — e.g. "single-request presigned POST into a private quarantine, GuardDuty scan, promote only clean objects, deliver via CloudFront OAC". It changes **no file**, creates **no resource**, enables **no service**, incurs **no cost**, and grants **no permission** to write code, change configuration, buy anything, migrate a database, deploy, or push to Git. It is a decision about *intent*, recorded in documentation.

*Authorizing implementation* is a **different, separate, explicit written approval** that permits named files/systems to be changed. Even then it is **layered**: implementation authorization alone does **not** authorize creating a billable AWS account, enabling GuardDuty, provisioning staging resources, running a migration, deploying, or pushing to GitHub — each has its own gate. This is why §12.9, §13.15, §14.9 and §15.13 list **separate** approvals rather than one bundled sign-off, and why §12.9(15) requires successful staging verification **and** a separate approval before any Git push.

| Level | What is approved | What it permits | What it still does **not** permit |
|---|---|---|---|
| **L0** | Documentation / evaluation (this exercise) | Writing docs, reconciling evidence, preparing decisions | Everything below |
| **L1** | **Architectural design** (category A/B) | Recording intent; choosing Region, formats, strategy, topology | Code/config changes, purchases, resources, migrations, deploys, Git |
| **L2** | **Implementation authorization** (M05→M20) | Named additive source/config/dependency changes **in a staging branch context** | AWS/Netlify/Turso resource creation, billing, migration execution, deployment, Git push |
| **L3** | **Billing & cost approval** (category C) | Creating the billing account, approving budgets and recurring services | Deployment, migration, Git push; does not remove the need for L2 |
| **L4** | **Staging resource + deployment approval** (categories D, E, F) | Separate staging site/DB/buckets, read-only inspection, a **separate** non-destructive migration, one draft deploy | Any production action; any GitHub push |
| **L5** | **Hosted verification acceptance** (F) | Recording that the §14.5 matrix passed; **then** requesting L6 | Skipping L6, or claiming Phase 8 is complete |
| **L6** | **Separate GitHub approval** (G) | A commit and push to `arena/cdcb43ad-immi-website` only | Production deployment or provisioning |
| **L7** | **Production approval** (H) | Nothing in this Phase | **Excluded** — requires a new, separate authorization |

**No level L1–L7 has been granted.** Every `RECOMMENDED` row in §14.1 remains an unapproved recommendation. Approving L1 for one workstream (e.g. testimonial videos) does **not** approve L1 for the CV workstream, nor L2–L7 for either.

### 14.4 Dependency-ordered implementation plan (proposal only — no phase is authorized)

> **This is a plan, not permission.** No phase below has been approved, started or executed. Phases are dependency-ordered: each requires the acceptance criteria of the previous phase plus its own approvals. **Workstream A (testimonial video)** and **Workstream B (applicant CV)** are deliberately separate and must not share endpoints, object keys, buckets, pending-upload records, migration files or scan-result handlers. Workstream B starts only after Workstream A's server-side verification passes.

**Architecture-preservation constraints (apply to every phase):** keep the Next.js 15.5.29 App Router, the existing 58 API routes, `src/middleware.ts`'s CSP/redirect role, the Drizzle schema baseline (`drizzle/0000_init.sql`: 33 tables / 61 indexes / 47 FKs; one `0000_init` journal entry), the `STORAGE_DRIVER=blobs` fail-closed behaviour, the `immi-public` / `immi-private` Blobs stores, the single `POST /api/assessment` transaction and its immutable `consent_records` snapshot, and the administrator-only CV download route. All new code is **additive**; no rewrite of the storage adapter contract beyond adding an `s3` provider value; **no upload limit is changed**; the existing small-asset `/api/media/[...key]` proxy is retained [R30], [F1].

| # | Phase | Objective | Exact work expected | Files / systems likely to change | Required approvals | Tests & acceptance criteria | Rollback strategy | Conditions before proceeding |
|---|---|---|---|---|---|---|---|---|
| **P0** | **Decision & evidence closure** (no code) | Close category A/B decisions and unverified questions using existing evidence and current vendor confirmations | Record owner decisions from §14.9; obtain Region-specific S3/GuardDuty rate tables and Malware Protection for S3 per-Region feature availability; confirm Free Tier/credit status; confirm Netlify plan/EU function-region eligibility; confirm Turso residency; obtain vendor quotes for any optional service; decide 100 MiB interpretation, formats, integrity strategy and retention window | **Docs only**: this report §14, `docs/DEPLOYMENT.md` §16 (decision log). No source/config/infrastructure | L1 architectural and technical decisions (D02–D13, D13a, D17–D21, D23); **no** implementation authorization | Every §14.1 `UNDECIDED`/`UNRESOLVED`/`UNVERIFIED` item has a recorded answer or an explicit "still open — do not proceed"; no price invented; no secret printed | Documentation-only; revert the decision-log entries | Owner decisions recorded; evidence documents obtained; **no resources created** |
| **P1** | **Billing, account & cost controls** | Establish the cost gate **before any spend** | Approve the §14.6 cost summary and a budget cap; create the AWS billing account; configure Budgets (actual + forecast), Cost Anomaly Detection, CloudWatch alarms, cost-allocation tags and upload quotas; record that alerts are not a hard cap [R56] | AWS billing/Budgets/Cost Explorer (system); docs cost log. **No bucket, no GuardDuty, no CloudFront yet** | L3 billing approval (D22, D24, D25); category C | Budget, alerts and tags visible; written acknowledgement that alerts do not prevent charges; no billable storage resource exists yet | Close/delete the newly created account configuration; no data at risk | P0 accepted; **written billing approval before account creation** |
| **P2** | **Staging resources & AWS foundation** (infrastructure only) | Provide separate, verified staging resources and the private S3 foundation | Create **separate** staging Netlify site (ID/URL, draft-only deploy auth, Function/Edge logs), separate staging Turso DB and read-only access; create separate quarantine / public-media / private-CV buckets or prefixes, IAM roles, SSE-KMS/SSE-S3, 4× Block Public Access, `Bucket owner enforced`, CORS, Lifecycle rules, versioning, `s3:signatureAge` policy if verified; create the CloudFront OAC distribution; enable the approved scanner on the **quarantine prefix only**; inject staging-only env names via the secure interface | Netlify UI/CLI/API; Turso secure config; AWS S3/IAM/KMS/CloudFront/GuardDuty/EventBridge/CloudWatch; **no repository files** except doc records. New env var **names** only | L3 billing + L4 staging resource approval (D22, D26–D30); M23 written separation-from-production confirmation | All 14 gates of `docs/DEPLOYMENT.md` §13.2 satisfied; presence-only secret verification; no production identifier in staging config; buckets verified private; scanner enabled on quarantine only | Delete staging-only resources; revoke staging-only credentials; no production resource touched | P1 accepted; **written separation confirmation**; secure secret interface available; Region approved |
| **P3** | **Read-only schema inspection → separate migration** | Establish schema compatibility and apply the minimum non-destructive change | **Step 1:** read-only inspection (tables, columns, indexes, FKs, migration ledger); compare with `drizzle/0000_init.sql` and `drizzle/meta/_journal.json`; report drift; **stop on conflict**. **Step 2 (only after separate approval):** add `pending_uploads`, scan-status columns, and (if needed) `s3` in `STORAGE_PROVIDERS`, via a non-destructive `0001_*` migration | `src/db/schema/*` (new table/columns), `src/db/schema/enums.ts`, `drizzle/0001_*.sql`, `drizzle/meta/_journal.json`, new snapshot. **Never** add `TURSO_DATABASE_URL` to a build | **Category E, separate approval** (D31–D34) after the read-only report; no migration without it | Drift report matches the documented baseline (33/61/47, one `0000_init`); staging data preserved; `npm run db:migrate` targeted **only** at staging; journal entry present | Non-destructive down migration / restore from pre-migration staging snapshot; no production DB access | P2 accepted; **read-only inspection completed and no conflict**; separate migration approval granted |
| **P4** | **Workstream A — testimonial-video server-side implementation** | Implement the §13.1 nine-step state machine without touching CV code | Add the AWS SDK dependency; implement POST-policy signing with exact `key`/`bucket`, `content-length-range` 1–104,857,600, exact `Content-Type`, `expiration`, checksum and SSE conditions; implement `upload-authorize`, `upload-finalize` (HeadObject measured size, ETag/VersionId, checksum, Range GET magic bytes, `detectFileType()`), single-use `pending_uploads` state machine, EventBridge scan-result consumer with dedupe, promotion handler (`CopyObject` from verified versionId → public-media), rejection/cleanup, reconciliation and `activity_logs` | New files: `src/lib/storage/s3.ts` (or equivalent additive adapter), `src/app/api/admin/cms/media/upload-authorize/route.ts`, `.../upload-finalize/route.ts`, promotion + EventBridge consumer modules, `src/db/queries/pending-uploads.ts`; `package.json` / `package-lock.json`; `.env.example` (**names only, no values**). **Do not change** `src/lib/files/validate.ts`, `src/middleware.ts` (yet), `src/app/api/assessment/*`, or the CV download route | L2 implementation approval for Workstream A only (D05, D06, D14, D16–D18); M05, M19, M20, M21 | Unit tests for policy conditions, magic-byte detection, state transitions and failure branches; SV-04–SV-10, SV-16 pass **with synthetic files only**; no 100 MiB body reaches a Function (V23); no signed fields in logs [F22] | Feature-gate the new endpoints; `STORAGE_DRIVER` stays fail-closed to `blobs`/`local`; remove additive files; keep P3 migration reversible; no production write | P3 accepted; Workstream A architecture + implementation approved; env names approved; staging resources available |
| **P5** | **Workstream B — separate private CV upload implementation** | Add CV direct upload without altering assessment integrity | Implement **separate** authorize/finalize endpoints and a separate pending-upload model for `purpose='cv'`; 10 MiB ceiling via `content-length-range`; pdf/docx magic-byte validation; independent scan and fail-closed handling; change `POST /api/assessment` to accept a verified pending-upload token **instead of file bytes**, preserving honeypot, rate limits, Zod, consent-against-published-versions, duplicate detection, idempotency and the single transaction; admin-only download issues a short-lived presigned GET only after a clean scan check | New CV-specific route files and query modules; `src/app/api/assessment/route.ts`, `src/lib/assessment/submit.ts`, `src/lib/assessment/config.ts` (contract only, **no limit change**); `src/lib/assessment/admin-handlers.ts` (download); **no shared modules with P4**; docs | **Separate** L2 implementation approval for Workstream B (D13, D15); M17, M18; §12.9(5) | SV-13, SV-14 pass: immutable `consent_records` snapshot (`termsVersion`, `privacyVersion`, `consentText`, `acceptedAt`, `ipHash`, `userAgent`), `submittedAt`, `onDelete: restrict`, private keys never returned, `guardAssessmentRead` + audit + `no-store`/`nosniff`/sandbox CSP preserved; **no unverified CV becomes a valid attachment** | Feature-gate CV endpoints; retain the existing multipart assessment path behind the existing storage driver until verified; revert contract change; no production write | **P4 verified first**; Workstream B approval granted separately; no shared keys/buckets/records with P4 |
| **P6** | **Delivery, CSP/CORS and browser integration** | Serve only published, verified videos while keeping quarantine/CV private | Configure CloudFront cache policy, Range GET support, server-detected `Content-Type`, `Content-Disposition`, `nosniff`, immutable `Cache-Control`; implement narrow `media-src` / `connect-src` / `form-action` CSP additions and site-origin-only S3 CORS; implement unpublish (`archivedAt` + exact-path invalidation + delete object/versions + audit); retain the small-asset proxy; wire the CMS admin UI to the P4 endpoints | `src/middleware.ts` (**narrow CSP additions only**), CloudFront distribution + S3 CORS config, CMS admin components, `src/app/api/admin/cms/media/*`; `src/app/api/media/[...key]/route.ts` **retained, not rewritten** | L2 implementation approval for delivery (D10, D11, D12, D13a, D19, D25); M14–M16, M31 | SV-11, SV-12, SV-18, SV-22 pass; `206 Partial Content` on Range; quarantine/CV keys return 403 from the CDN (V19); no wildcard CORS origin; CSP no broader than approved | Revert CSP/CORS to documented baseline; disable the distribution's public behaviours; invalidate paths; no production write | P4 (and P5 if sequenced) accepted; CSP/CORS approval granted; publication consent decision recorded |
| **P7** | **Staging deployment, hosted build & verification** | Prove the whole design in a hosted, separated staging environment | Non-production/draft deploy to the **staging site ID** (never `--prod`, never a Git-connected build from this branch); one hosted build; Function **and** Edge log review; execute the entire §14.5 checklist with **synthetic data only**; review effective headers, storage separation, upload ceilings, auth/CSRF, costs and cleanup | Netlify staging site, Turso staging DB, AWS staging resources, CloudFront staging distribution; **no Git operation**; docs verification record | L4 staging deployment + hosted verification (D35–D37); M23–M25 | Every SV item passes; hosted edge handler bundles without the Deno CLI download failure (§10.4); no secret/token/CV URL/object key printed in logs; budget/usage matches §14.6 within the disclosed assumptions; **stop and report on any failure** | Tear down the draft deploy; restore pre-deploy staging state; staging resources remain separate from production | P0–P6 accepted; **all §13.2 gates satisfied**; written separation confirmation; staging admin provisioned with synthetic data |
| **P8** | **GitHub commit and push** | Record verified work in the session branch | A single commit and push to `arena/cdcb43ad-immi-website` only, **after** successful P7 verification and a **separate explicit approval** | Git index/remote on the session branch; no other branch; no production deploy | **L6 separate GitHub approval (D38, D39)**; §12.9(15) | Push succeeds to the named branch only; no `--prod`; no secret in the diff; repository status reported | Revert/force-push only with a **new** separate approval; do not rewrite history unilaterally | **P7 fully verified AND a separate explicit approval** — neither exists now |
| **P9** | **Production (EXCLUDED)** | None in Phase 8 | None. Production deployment, production DB access/migration, production resource modification, production credentials and production administrator provisioning are **prohibited** | None | **Not requested — explicitly excluded** (D40, D41) | N/A — no production success may be claimed before real production verification | N/A | A new, separate authorization outside this Phase |

**Cross-workstream rule:** P4 and P5 produce **separate** endpoint files, separate quarantine keys/prefixes, separate pending-upload record types, separate scan-result handlers and (if needed) separate migrations. A failure in P4 must not weaken P5's assessment transaction, consent snapshot or admin-only download protections. Neither workstream may change `MAX_UPLOAD_BYTES` or `MAX_SUBMISSION_REQUEST_BYTES`.

### 14.5 Consolidated staging verification plan

**Legend:** `H` = **hosted-only — can only be performed after staging resources exist** (categories D/F); `L` = local/static check that could be performed in the workspace. **Every item below is `NOT PERFORMED`** in this documentation exercise. Sources: §13.14 (V1–V25), §15.12, `docs/DEPLOYMENT.md` §13.3 steps 1–12 and §13.2 gates. Synthetic data only; never print secrets, tokens, CV URLs, authorization tokens or internal object keys.

| ID | Check | Source | Type | Status |
|---|---|---|---|---|
| **SV-01** | **Baseline & separation re-verification**: branch/HEAD, 1 tracked / 283 untracked / 0 staged / 0 modified, Appendix A 283/283, protected hashes; written confirmation that Netlify site, Turso DB, buckets, credentials and DNS are separate from production; env **presence-only** check | §13.3 steps 1–3, §13.2 gates 1/5/13 | L (+ H for env) | NOT PERFORMED |
| **SV-02** | **Hosted Netlify build**: one build; confirm plugin/runtime versions and Node patch in the build log; confirm the middleware **Edge Function** bundles without the Deno CLI download failure | §13.3 step 6, §12.8 item 5, V23 | **H** | NOT PERFORMED |
| **SV-03** | **Netlify Functions and Edge Function behaviour**: Function and Edge logs reviewed; small JSON bodies only; **no 100 MiB body reaches a Function**; no signed policy/fields in logs; effective HTTPS/secure-cookie, `no-index`/`no-store`, cache headers, admin redirects | §13.3 steps 6–7, V23, F22 | **H** | NOT PERFORMED |
| **SV-04** | **Turso connectivity and schema compatibility**: read-only inspection of tables/columns/indexes/FKs/migration ledger; compare with `drizzle/0000_init.sql` (33/61/47) and `_journal.json` (one `0000_init`); report drift; stop on conflict; migration never in build | §13.3 step 4, §12.9(12) | **H** | NOT PERFORMED |
| **SV-05** | **S3 upload authorization**: exact `key`/`bucket`/`Content-Type`/checksum/SSE/expiration conditions; tampered fields rejected; `${filename}` rejected; expired policy rejected (V4–V6); `s3:signatureAge` POST applicability observed | §13.14 V4–V6, §15.3, F4, F11 | **H** | NOT PERFORMED |
| **SV-06** | **100 MiB size enforcement**: ~99 MiB accepted; exactly 100 MiB boundary documented (including ≤20 KB form-overhead behaviour); 100 MiB + 1 B and larger files rejected by S3 `EntityTooLarge` **before** object creation and by the server's measured `HeadObject.ContentLength` | §13.14 V1–V3, §13.2, §13.4, F4, F18 | **H** | NOT PERFORMED |
| **SV-07** | **Actual file integrity verification**: valid MP4 (`ftyp` @ offset 4) / WebM (`1A 45 DF A3`) magic bytes; wrong MIME / `.exe` renamed `.mp4` rejected; `x-amz-checksum-sha256` mismatch (`BadDigest`) and `HeadObject` checksum-mode comparison; declared ≠ detected rejected | §13.14 V8–V10, F7–F9, R30 | **H** | NOT PERFORMED |
| **SV-08** | **Upload replay and overwrite protection**: reuse the same POST policy twice → second finalize rejected, versioning reveals >1 version, no promotion; ETag/VersionId binding; single-use `pending_uploads` state; `If-None-Match` not applicable to POST | §13.14 V7, §13.6, F10, F11, F19 | **H** | NOT PERFORMED |
| **SV-09** | **Malware scanning success and failure scenarios**: `NO_THREATS_FOUND` promotes once; `THREATS_FOUND` (EICAR-like synthetic object), `UNSUPPORTED` (password-protected / oversized-for-scanner), `ACCESS_DENIED` (role removed or SSE-C), `FAILED`, no EventBridge event and duplicate events all fail closed, stay private, alert and dedupe | §13.14 V12–V16, §13.8, F23 | **H** | NOT PERFORMED |
| **SV-10** | **Quarantine isolation**: direct `GET`/`HeadObject` on a quarantine or private-CV object denied (403); TBAC deny-until-clean; 4× Block Public Access; separate buckets/prefixes; public proxy `visibility='public'` filter with `nosniff`/sandbox CSP | §13.14 V11/V19, §13.3 step 8, R38, R10 | **H** | NOT PERFORMED |
| **SV-11** | **Promotion to public storage**: only `verified AND clean` objects `CopyObject`-promoted from the verified versionId; new CSPRNG key; `mediaAssets` row with detected MIME/size/checksum; `activity_logs` entry; promotion is the only writer to the public prefix | §13.14 V12, §13.1 step 8 | **H** | NOT PERFORMED |
| **SV-12** | **CloudFront video delivery and HTTP Range requests**: `206 Partial Content` on Range/seek; server-detected `Content-Type`, `nosniff`, immutable cache headers; OAC origin only; no S3 website endpoint | §13.14 V18, §13.12, R25, R26, R57 | **H** | NOT PERFORMED |
| **SV-13** | **Unpublishing and cache invalidation**: `archivedAt`, exact-path invalidation, origin object and all versions deleted, cached copy unreachable, audit entry; invalidation count vs the 1,000 free paths/month allowance | §13.14 V20, R21 | **H** | NOT PERFORMED |
| **SV-14** | **CV privacy and administrator-only access**: CV never public or CDN-reachable; `guardAssessmentRead`, audit entry, `Content-Disposition: attachment`, `no-store`, `nosniff`, sandbox CSP, `same-origin`, `no-referrer` preserved; short-lived presigned GET only after clean scan | §13.14 V21, §13.11, R30 | **H** | NOT PERFORMED |
| **SV-15** | **Assessment transaction integrity**: single transaction writes assessment + immutable `consent_records` snapshot + child rows + private `media_assets` + `assessment_attachments`; `onDelete: restrict`; no unverified/unscanned/expired CV becomes a valid attachment; honeypot/rate limits/Zod/consent/idempotency unchanged | §13.14 V21, §12.4, R30 | **H** | NOT PERFORMED |
| **SV-16** | **Authentication, authorization and CSRF protections**: admin session/role checks (`guardMutation(['owner','admin','editor'])`), CSRF, `throttleCmsMutation`, admin redirects and session cookies verified in the hosted runtime; no anonymous authorize/finalize | §13.3 step 7, §13.1 step 1 | **H** | NOT PERFORMED |
| **SV-17** | **CSP and S3 CORS preflight**: narrow approved `connect-src` / `form-action` / `media-src` additions work from the staging origin; S3 CORS allows only that origin, POST and required headers; no wildcard origins; no broadened directives | §13.14 V22, §13.3 step 7, F13 | **H** | NOT PERFORMED |
| **SV-18** | **Cost and storage cleanup checks**: abandoned authorize and abandoned post-upload-without-finalize → pending row expires, orphan object deleted by quarantine Lifecycle `Expiration`, `NoncurrentVersionExpiration` for replay versions; actual requests/bytes scanned/tagging/EventBridge/CDN usage vs §14.6 estimates; budget alerts configured (acknowledging they are not a hard cap) | §13.14 V17/V25, §13.9, §12.6.3, F24, R56 | **H** | NOT PERFORMED |
| **SV-19** | **100 MiB upload reliability from likely user geography** (West Africa): measure interruption/failure rate to validate the single-request trade-off; only this test can justify reconsidering multipart (M30) | §13.14 V24, §13.10 | **H** | NOT PERFORMED |
| **SV-20** | **Synthetic-data functional verification**: public site, admin portal (staging-only account), assessment workflow, CMS media; **synthetic data only**, no real applicant submissions/documents, no production administrator provisioning | §13.3 step 10 | **H** | NOT PERFORMED |
| **SV-21** | **Log review and evidence collection**: build/Function/Edge logs collected and reported; no secrets, tokens, CV URLs, authorization tokens or internal object keys printed; results recorded | §13.3 step 11 | **H** | NOT PERFORMED |
| **SV-22** | **Effective headers, middleware and public/private storage separation**: merged CSP (nonce, `media-src`/`connect-src` exactly as approved), `no-index`/`no-store`, cache headers, admin redirects; `immi-public`/`immi-private` separation and anonymous denial of private downloads; storage-failure handling; honest record that the 100 MiB video and 12 MiB assessment request paths are incompatible with the **existing** buffered Function path | §13.3 steps 7–9 | **H** | NOT PERFORMED |

**All 22 checks are gated on categories D/F.** SV-01's local baseline portion could be run in the workspace and was run as part of §14.8 verification, but **no hosted verification has been performed**. No live AWS integration test, hosted build, staging deployment or production action occurred.

### 14.6 Cost approval summary

> **No paid service is approved by this exercise.** All figures below are **existing documented estimates** from §12.6.2 / §13.13 / §14.6 / §15.11, restated for a single decision. **Nothing was purchased, enabled, or incurred.** Scenarios A/B/C are the user-given illustrative workloads: A staging **2 GB stored / 10 GB transferred**, B small production **25 GB / 200 GB**, C growth **250 GB / 2,000 GB**; illustrative upload counts/average sizes are **40 × 5 MB**, **500 × 8 MB**, **5,000 × 10 MB** (§12.2.5).

| Cost line | A — staging | B — small production | C — growth | Basis / label | Needs current vendor confirmation? |
|---|---|---|---|---|---|
| **Expected monthly total (GuardDuty + CloudFront, EU edge)** | **~$0.08** | **~$1.2** | **~$118** | **estimated**, rounded order-of-magnitude, not a bill (§12.6.2) | **Yes** |
| **Expected monthly total (Nigeria/Africa edge)** | **~$0.08** | **~$1.2** | **~$143** | **estimated**; viewer location sets the price group, not the S3 Region [R7] | **Yes** |
| Same totals **without** the illustrative 5,000-path invalidation case | ~$0.08 | ~$1.2 | **~$98 (EU) / ~$123 (Nigeria)** | **estimated** arithmetic note in §12.6.2 | **Yes** |
| **GuardDuty scanning (separate line)** | **~$0.03** (or ~$0.00 if Free Tier applies) | **~$0.46** (or ~$0.26) | **~$5.47** (or ~$5.16) | **documented** US East example $0.09/GB + $0.215/1,000 objects [R16], [R24]; **Region-specific rate unverified**; Free Tier 1 GB + 1,000 objects/month/account/Region, on-demand scans, tagging, S3 API and EventBridge rule **excluded** [R39] | **Yes** — Region rate + Free Tier status |
| GuardDuty **per 100 MiB video** (Workstream A refinement) | — | — | **~$0.009/video**; 100 videos/mo ≈ ~$0.90; 500/mo ≈ ~$4.50 | **estimated** from 0.0977 GiB × $0.09/GB + $0.215/1,000 (§13.13) | **Yes** |
| **S3 storage** | ~$0.05 | ~$0.58 | ~$5.75 | **estimated** from secondary $0.023/GB-month (Ireland) [R23]; Frankfurt ~$0.0245 also secondary | **Yes** |
| **S3 requests** (PUT/POST/LIST + GET) | <~$0.002 | ~$0.012 | ~$0.10 | **estimated** from secondary $0.005/1k writes, $0.0004/1k reads [R23]; DELETE/CANCEL free [R18] | **Yes** |
| **S3 data transfer** — CloudFront origin fetch | $0 | $0 | $0 | **documented** [R7] | No |
| **S3 data transfer** — private/admin downloads (0.1 / 2 / 20 GB illustrative) | ~$0.01 | ~$0.18 | ~$1.80 | **documented** Ireland $0.09/GB [R18] on **illustrative** volumes | **Yes** (volumes) |
| **CloudFront delivery egress** | $0 (within 1 TB free) | $0 | ~$85 (EU) / ~$110 (Nigeria/Africa) | **documented** 1 TB free then $0.085/GB EU, $0.110/GB Nigeria/Africa [R7]; 1,000 GB above free tier in C | **Yes** — free-tier applicability |
| **CloudFront HTTPS requests** | $0 | $0 | $0 (under 10M free at assumed rate) | **documented** 10M free then $0.0120/10k [R7] | **Yes** (request amplification) |
| **CloudFront invalidation** | $0 | $0 | $0 if ≤1,000 paths/month; **~$20** in the illustrative 5,000-path case included in the totals | **documented** 1,000 free paths then $0.005/path [R21] | **Yes** (actual path count) |
| **EventBridge / SQS / Lambda orchestration** | <~$0.01 | <~$0.01 | ~$0.02 | **documented** $1/million events, SQS 1M free, Lambda $0.20/1M [R48]–[R51]; managed-rule cost **unverified** | **Yes** |
| **Netlify plan / build minutes / Functions / Edge / bandwidth** | **excluded — unverified** | **excluded — unverified** | **excluded — unverified** | No billing view available; EU function region is a **Pro/Enterprise** feature [R27]; costs unknown (§10.4, §13.4) | **Yes — vendor/account confirmation required; no price invented** |
| **Turso plan / storage / compute / read-write usage** | **excluded — unverified** | **excluded — unverified** | **excluded — unverified** | No billing view or account inspection available; residency unknown (§12.8 item 6) | **Yes — vendor/account confirmation required; no price invented** |
| **Optional services / exclusions** | not modelled | not modelled | not modelled | Backup/replication, CloudFront flat-rate plans (Free $0 / Pro $15 / Business $200 / Premium $1,000 **published** [R22]), commercial scanners (~$99/month min [R52] or $0.20/GB + $0.025/vCPU-hour [R46]), KMS, WAF, CloudWatch, CloudTrail data events, AWS Support, tax — **all excluded from totals** | **Yes — vendor quotes / allowance terms** |
| **Unverified prices & assumptions (explicit)** | — | — | — | Region-specific S3/GuardDuty rate tables; secondary S3 storage/request rates; Free Tier/credit status [R20]; illustrative object counts, average sizes, ~3 writes + ~4 reads per object + 20 reads/delivered GB, 0.1/2/20 GB private egress, edge mix, 5,000-path invalidation case; 1 TB free-tier applicability; real cache-miss ratios; all hosted behaviour (§12.8, §12.6.1, §12.6.3) | **Yes — before any spend** |

**Standing warnings:** free allowances do **not** make production free [R39], [R19], [R20], [R7]; **budget alerts do not necessarily prevent charges** — Budgets data is refreshed up to three times daily, typically 8–12 hours apart, and alerts are not a real-time hard cap [R56]; unexpected-charge sources include incomplete multipart parts, double scans on promotion/versions, tagging, S3 API/EventBridge managed-rule charges, abandoned quarantine objects, presigned-URL abuse, Range request amplification, invalidations, higher Nigeria/Africa price group, versioning/replication, storage-class minimums, KMS/CloudWatch/WAF and Free Tier expiry (§12.6.3). **Cost disclosure + billing approval (M28 / D22, D24, D25) is required before any account, bucket, subscription or paid service.**

### 14.7 Risk register

| ID | Risk | Potential impact | Mitigation | Verification method | Approval dependency |
|---|---|---|---|---|---|
| **RR-01** | **S3 POST size enforcement uncertainty** — whether `content-length-range` measures file bytes alone or the whole form body; exact boundary at 100 MiB | A 100 MiB video is rejected (availability) or, worse, an oversized object is accepted (cost/abuse) | Two independent layers: policy max **exactly 104,857,600 bytes** plus server `HeadObject.ContentLength` check; fail-closed acceptance of form-overhead conservatism; no reliance on browser validation (§13.2, §13.4) | SV-06 (V1–V3) with 99 MiB / 100 MiB / 100 MiB+1 B | M06, M28, category B/F |
| **RR-02** | **Presigned authorization replay** — bearer tokens reusable until expiry; same-key objects replaced; no single-use primitive [F11] | Unauthorized/duplicate objects, unexpected storage & scan charges, wrong object promoted | CSPRNG key per authorization, exact `key` condition, single-use `pending_uploads` state, versioning + `ListObjectVersions` >1 rejection, ETag/VersionId binding, short TTL, `s3:signatureAge`, no signed fields in logs (§13.6) | SV-08 (V7), plus V6 expiry | M09, M20, category B/F |
| **RR-03** | **Incorrect checksum or object-version association** — client-supplied digest mismatch, ETag change after verification, multipart ETag not an MD5 | A tampered or different object is promoted as "verified & clean" | Bind `x-amz-checksum-sha256` in the POST policy, compare `HeadObject` checksum mode, promote only the specific verified `versionId`, reject ETag change, dedupe at-least-once results (§13.6, F7–F9, F19) | SV-07 (V10), SV-11 | M08, M19, category E/F |
| **RR-04** | **Malware scanning delays or failures** — `FAILED`, `ACCESS_DENIED`, `UNSUPPORTED`, missing/duplicate EventBridge events, GuardDuty unavailability | Clean-up ambiguity; a non-clean object could be promoted; stalled uploads | Fail-closed reconciliation timeout, all non-clean outcomes → `rejected`, manual review + alerts, quarantine-only prefix scope, tagging before first upload, TBAC deny-until-clean (§13.7–13.8, F23) | SV-09 (V12–V16) | M11, M12, M13, category C/F |
| **RR-05** | **Public video exposure** — an unverified/quarantine object reaches the CDN; or an intentionally published video is irrevocably copied | Private/suspect content becomes public; GDPR erasure impossible after distribution | Promotion as the only writer to the public prefix, OAC restricted to that prefix, TBAC, `visibility='public'` filter, immutable keys, exact-path invalidation, separate publication consent, erasure caveat (§13.12) | SV-10, SV-11, SV-12, SV-13 (V19/V20) | M14, M15, M22, category F |
| **RR-06** | **Private CV exposure** — CV bytes reach a public bucket, CDN or an unauthenticated client | Severe applicant personal-data breach; GDPR violation | Fully separate Workstream B, private-CV quarantine/bucket, never a CDN origin, admin-only download with `guardAssessmentRead` + audit + `no-store`/`nosniff`/sandbox CSP, `storageKey` never returned publicly (§13.11) | SV-14, SV-15, SV-10 (V21) | M17, M18, M22, category F |
| **RR-07** | **Netlify regional hosting limitations** — Functions default `cmh` (US East, Ohio); EU regions are Pro/Enterprise, project-wide; 6 MB buffered / ≈4.5 MB binary ceiling; hosted Deno/edge behaviour unverified | Applicant/metadata processing outside the EEA; upload path fails; GDPR transfer exposure | Direct browser→S3 upload (bytes never enter a Function), confirm plan eligibility and region setting, one hosted build with Function/Edge log review, no broadened CSP (§12.1.5, §13.1, R27) | SV-02, SV-03, SV-17, SV-22 | M02, M21, M23, category B/D |
| **RR-08** | **Turso data residency** — Region/plan/production state unknown; no account inspection | Applicant personal data may reside outside Europe despite an EU S3 Region | Confirm residency before any approval; DPA/sub-processor review; do not assume a European S3 Region guarantees compliance (§12.1.5, §12.8 item 6) | Vendor/account confirmation; SV-04 read-only inspection | M02, M22, M23, category B/D |
| **RR-09** | **GDPR and retention obligations** — Region alone is not compliance; Object Lock/WORM vs erasure; version/replica/cache copies; consent and lawful basis | Regulatory non-compliance; inability to satisfy erasure/access requests | DPA/TIA, privacy notice, separate publication consent, retention/deletion schedules covering objects/versions/replicas/quarantine/CDN caches/DB rows, records-of-processing/DPIA (§12.1.5, §12.9(10)) | Legal review + SV-13/SV-14/SV-18 | M13, M15, M22, category A/F |
| **RR-10** | **Unexpected AWS charges** — tagging, S3 API, EventBridge managed rule, incomplete multipart parts, double scans, abandoned objects, invalidation, Range amplification, higher Nigeria/Africa group, Free Tier expiry; alerts are not a hard cap [R56] | Budget overrun | Cost disclosure + billing approval before spend, budget cap, Cost Anomaly Detection, quotas, `content-length-range`, Lifecycle cleanup, noncurrent-version expiration, minimal invalidation, WAF/bot controls, monthly review (§12.6.3–12.6.4) | SV-18 (V25), post-deploy usage review | M28, M32, category C |
| **RR-11** | **Staging and production environment separation** — missing IDs, credentials, written confirmation; connectors `unsupported`; deploy/build egress blocked | Accidental production write/charge; inability to verify; invalid "staging verified" claim | All 14 §13.2 gates, presence-only secret verification, no production identifier in staging config, draft-only deploy, never `--prod`, no Git-connected build from this branch (§13.3) | SV-01, SV-21 | M23, M25, M27, category D/F/H |
| **RR-12** | **GuardDuty per-Region feature availability / rate uncertainty** | Scanner unavailable in the chosen Region; cost differs from the US East example | Confirm feature availability and Region-specific rate tables before Region approval; have ClamAV/commercial alternatives documented (§12.2) | Official Region feature table / console; vendor quote | M02, M11, category B/C |
| **RR-13** | **Hosted edge/Deno build compatibility** (earlier offline `dl.deno.land` download failure; hosted image unverified) | Build fails; no staging verification possible | One hosted build with Edge log review; do not assume local offline failure implies hosted failure or vice versa (§10.4, §12.8 item 5) | SV-02, SV-03 | M23, M25, category D/F |
| **RR-14** | **Repository tracking state** — only `README.md` is tracked (1 tracked / 283 untracked); a Git-connected build would lack the app | A deploy contains no application; premature Git push misrepresents readiness | No Git-connected build from this branch; no-Git local CLI path only with an authorized runner; re-verify baseline each phase (§8, §13.3 step 1) | SV-01; §14.8 verification | M26, category G |
| **RR-15** | **100 MiB single-request reliability** over high-latency West-African links (no pause/resume) | Failed uploads; admin friction; pressure to add multipart complexity | Accept the documented trade-off; provide a fresh authorization/key on retry; reconsider multipart **only** after SV-19 evidence and a separate approval (§13.10) | SV-19 (V24) | M30, category B/F |

### 14.8 Repository preservation verification — before and after

Verification method is the same as §13.17: `git status --porcelain` collapses untracked directories (15 entries), so the exact count comes from `git ls-files --others --exclude-standard` (283), and Appendix A is parsed across **all 5 fenced blocks**. This task **appended only** §14 to this report and §16 to `docs/DEPLOYMENT.md`; no earlier line was edited except the 8 cross-reference corrections inside the newly appended §14 text itself.

| Check | Before this task | After this task |
|---|---|---|
| Branch / HEAD | `arena/cdcb43ad-immi-website` / `bc53028b18b4ad9f8f2391b816a872973cbae457` | unchanged |
| Tracked / untracked (exact) / staged / modified tracked | 1 / 283 / 0 / 0 | 1 / 283 / 0 / 0 |
| `git status --porcelain` | 15 collapsed entries | 15 collapsed entries |
| `.data/local.db` SHA-256 | `7c16c81cc383ae5832c16e02e364f1ed2a15debdcb8edce5bf331aa4df548ff3` | unchanged |
| `.data/secret-markers.json` SHA-256 | `2e5688ef56d38b4cb1932fe9980ed600041fa415addeccb7800baca5bdee47d0` | unchanged |
| `docs/PHASE-8-REPORT.md` lines | 1780 | 2116 |
| `docs/DEPLOYMENT.md` lines | 636 | 943 |
| Report top-level sections | §§1–13 | §§1–14 (§§1–13 preserved verbatim) |
| Deployment top-level sections | §§1–15 | §§1–16 (§§1–15 preserved verbatim) |
| Appendix A (5 fenced blocks) | listed 283 / unique 283 / actual 283 / missing 0 / extra 0 / EXACT | same |
| Official references | R1–R59 (59/59), F1–F24 (24/24) | same |
| New section numbering | — | §14.0–14.9 continuous; `docs/DEPLOYMENT.md` §16.0–16.9 continuous |
| Placeholders / trailing whitespace / tabs / control chars / secret-value patterns | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Files changed by this task | 0 | exactly 2 documents (this report, `docs/DEPLOYMENT.md`) |
| Staging / production / Git / AWS / Netlify / Turso / migration / admin / cost state | blocked / prohibited / unchanged / none | unchanged — **no action taken** |

### 14.9 Final owner decision sheet

> **How to read this sheet.** Each item is **one atomic decision**: state exactly what is being asked, then answer **Approve** or **Decline** (or explicitly **Defer** with a reason). **Do not bundle unrelated decisions.** `D13a` is sub-numbered because it is cross-referenced by M31 / P0 / P6; IDs are stable references from §§14.1–14.7, so they are grouped by **authorization type** below rather than being contiguous within each heading. **Every item is currently UNAPPROVED** — including every `RECOMMENDED` design. **No paid service is approved by this exercise.** Approving any architectural item does **not** authorize implementation, billing, staging resources, a migration, a deployment, a Git push or production (§14.3).

#### Architectural approval

**D01.** **Approve or decline:** re-affirming **Amazon S3** as the sole object-storage implementation target (already **CONFIRMED**; this item ratifies, it does not select a Region, scanner, credential or resource). *(M01; §12.0, §13.0)*

**D02.** **Approve or decline:** proceeding to select **one** European AWS Region **after** the §12.8 evidence (Region-specific S3/GuardDuty rates, Malware Protection for S3 feature availability, Free Tier status, Netlify plan/function-region eligibility, Turso residency, DPA/sub-processor review) is supplied — i.e. decline means **no Region is selected yet**. *(M02; §12.9(1))*

**D03.** **Approve or decline:** `eu-west-1` **(Ireland)** as the primary European Region, on the §12.1.6 rationale. *(M03)*

**D04.** **Approve or decline:** `eu-central-1` **(Frankfurt)** as the alternative European Region. *(M04)*

**D05.** **Approve or decline:** the **single-request presigned POST** nine-step architecture in §13.1 for testimonial videos, as a **design only** (no code is authorized). *(M05; §13.15(3))*

**D06.** **Approve or decline:** **eliminating multipart upload** for ≤100 MiB testimonial videos, with reconsideration permitted **only** after SV-19 (V24) evidence and a further separate decision. *(M05, M30; §13.10)*

**D07.** **Approve or decline:** interpreting the limit as **100 MiB = 104,857,600 bytes** (rather than decimal 100,000,000 B) **and** making **no change** to `MAX_UPLOAD_BYTES` / `MAX_SUBMISSION_REQUEST_BYTES`. *(M06, M29; §13.15(1), §12.9(8))*

**D08.** **Approve or decline:** `video/mp4` and `video/webm` as the **only** accepted testimonial-video formats, with magic-byte detection. *(M07; §13.15(2))*

**D09.** **Approve or decline:** the **private quarantine architecture** — separate bucket/prefix, 4× Block Public Access, `Bucket owner enforced`, SSE-S3/SSE-KMS (not SSE-C), deny-by-default and TBAC deny-until-clean. *(M10)*

**D10.** **Approve or decline:** retaining **CloudFront with Origin Access Control** on a dedicated public-media origin for published videos only (never an S3 website endpoint). *(M14; §12.9(6))*

**D11.** **Approve or decline:** the explicit acknowledgement that published testimonial videos are **intentionally public**, together with a **separate** testimonial-publication consent, the unpublish behaviour and the erasure caveat. *(M15; §12.9(6))*

**D12.** **Approve or decline:** the **fail-closed malware-scanning failure policy** (all non-clean outcomes → `rejected`, manual review, alert routing, no promotion). *(M12; §13.8, §13.15(7))*

**D13.** **Approve or decline:** keeping applicant **CV uploads in a fully separate workstream** with the unchanged 10 MiB limit, transaction, consent snapshot and admin-only download protections. *(M17; §12.9(5))*

**D13a.** **Approve or decline:** **retaining the existing small-asset `/api/media/[...key]` proxy** (not rewriting it) and routing only validated published videos to the CDN. *(M31; §12.8 item 13)*

**D21.** **Approve or decline:** the **GDPR / privacy documentation and data-handling package** — DPA/sub-processor review, transfer-impact assessment, privacy-notice update, publication consent, retention/deletion schedules, records-of-processing and DPIA work; acknowledging a European Region alone is not compliance. *(M22; §12.9(10))*

**D23.** **Approve or decline:** selecting **GuardDuty Malware Protection for S3** as the scanning approach (quarantine-only prefix, tagging before first upload, TBAC, EventBridge dedupe) **or** declining in favour of a documented alternative (§12.2.1–12.2.3). This is an **approach selection**, not a purchase or enablement. *(M11; §12.9(2), §13.15(6))*

#### Implementation approval

**D14.** **Approve or decline:** implementing **Workstream A (testimonial video) server-side** code only — additive files, no CV code, no limit change. *(P4; M05)*

**D15.** **Approve or decline:** implementing **Workstream B (applicant CV) server-side** code only — separate endpoints/keys/records, no change to the single assessment transaction or consent snapshot. *(P5; M17, M18)*

**D16.** **Approve or decline:** adding the **four new upload handlers** — `upload-authorize`, `upload-finalize`, promotion handler and EventBridge consumer — preserving `guardMutation`, CSRF and rate limits. *(M20)*

**D17.** **Approve or decline:** one **integrity-verification strategy** (browser SHA-256 bound in the POST policy / server streaming hash / S3 stored checksum + ETag/VersionId) **and** any new dependency (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, hashing library). *(M08; §13.15(4))*

**D18.** **Approve or decline:** the **authorization expiry and replay controls** — illustrative 300–600 s TTL, single-use `pending_uploads` state, versioning, ETag/VersionId binding, `s3:signatureAge` deny, no signed fields in logs. *(M09; §13.15(5))*

**D19.** **Approve or decline:** the **narrow CSP additions** (`connect-src` / `form-action` / `media-src`) and **site-origin-only S3 CORS** rules, with no wildcard origins and no broadened directives. *(M16; §13.15(8))*

**D20.** **Approve or decline:** the **exact list of new environment-variable names** only, with values injected exclusively through the supported secure interface (Functions scope); no value may appear in chat, docs, logs or terminal output. *(M21; §12.9(7))*

#### Billing approval

**D22.** **Approve or decline:** the **§14.6 cost summary** as the disclosed estimate basis, creating the **AWS billing account**, and configuring a budget cap, Budgets/Cost Anomaly Detection/CloudWatch alerts, cost tags and upload quotas — with the written acknowledgement that **alerts do not prevent charges** [R56]. *(M28; §12.9(3)/(9))*

**D24.** **Approve or decline:** the **recurring GuardDuty scanning spend** (documented US East example $0.09/GB + $0.215/1,000 objects; Region rate **unverified**; ~$0.009 per 100 MiB video **estimated**). *(M11; §12.6.2, §13.13)*

**D25.** **Approve or decline:** the **CloudFront distribution and its recurring delivery/invalidation spend** (1 TB free then $0.085/GB EU or $0.110/GB Nigeria/Africa; 1,000 free invalidation paths then $0.005/path) [R7], [R21]. *(M14, M32; §12.6.2)*

#### Staging resource approval

**D26.** **Approve or decline:** creating a **separate staging Netlify site** (site ID/URL, draft-only deploy authorization, never `--prod`, Function **and** Edge log access). *(M23; §13.2 gates 1–4)*

**D27.** **Approve or decline:** creating a **separate staging Turso database** with read-only schema-inspection access and a staging-only auth token via a secure interface. *(M23; §13.2 gates 5–7)*

**D28.** **Approve or decline:** creating **staging-only AWS resources** (quarantine / public-media / private-CV buckets or prefixes, IAM roles, SSE, CORS, Lifecycle, CloudFront OAC, GuardDuty plan) **with written separation-from-production confirmation** covering Netlify, Turso, buckets, credentials and DNS. *(P2; §13.2 gate 13)*

**D29.** **Approve or decline:** provisioning a **staging-only administrator account** with fresh staging-only credentials and **synthetic data only** — no real applicant documents, no production administrator. *(M24; §12.9(13))*

**D30.** **Approve or decline:** using the **secure secret-injection interface** with Functions scope and the correct deploy context, verifying **presence only** and never printing values. *(M21; §13.2 rules/gate 3)*

#### Database migration approval

**D31.** **Approve or decline:** the **read-only staging schema inspection** (tables, columns, indexes, FKs, migration ledger) against `drizzle/0000_init.sql` (33 tables / 61 indexes / 47 FKs) and `drizzle/meta/_journal.json` (one `0000_init`), stopping on any conflict. *(P3; §12.9(12))*

**D32.** **Approve or decline:** the **`pending_uploads` table** shape and a new **non-destructive `0001_*` migration** plus its `_journal.json` entry, preserving staging data. *(M19; §13.15(3))*

**D33.** **Approve or decline:** adding **scan-status and retention columns** to `media_assets` (including the quarantine TTL fields required by M13), as a **separate** schema decision. *(M13, M19)*

**D34.** **Approve or decline:** adding an **`s3` value to `STORAGE_PROVIDERS`** while retaining `STORAGE_DRIVER=blobs` fail-closed behaviour for existing data. *(M19; §12.4.4)*

#### Staging deployment approval

**D35.** **Approve or decline:** a single **non-production / draft staging deploy** to the confirmed staging site ID (never `--prod`, never a Git-connected build from this branch, no Git operation). *(P7; §13.3 step 5)*

**D36.** **Approve or decline:** one **hosted build plus Function and Edge log review**, including the hosted Deno/edge compatibility check. *(M25; §13.3 step 6)*

**D37.** **Approve or decline:** executing the **entire §14.5 staging verification checklist (SV-01–SV-22)** with synthetic data only, stopping and reporting on any failed gate. *(M25; §13.14, §15.12)*

#### GitHub push approval

**D38.** **Approve or decline:** a **GitHub commit** on `arena/cdcb43ad-immi-website` — **only after successful staging verification** and as a **separate explicit approval**. *(M26; §12.9(15))*

**D39.** **Approve or decline:** a **push to `origin arena/cdcb43ad-immi-website`** — **only after successful staging verification** and as a **further separate explicit approval**; no other branch. *(M26; §13.3 step 12)*

#### Production approval — explicitly excluded

**D40.** **Decline / defer — NOT REQUESTED:** production deployment, production resource modification, production credentials and **production administrator provisioning**. Production approval is **explicitly excluded from the current Phase 8 authorization** and would require a new, separate authorization. *(M27; §12.9(16), §13.18)*

**D41.** **Decline / defer — NOT REQUESTED:** production database access, production migration, and any production data write. **Excluded** from the current Phase 8 authorization. *(M27; §12.9(16), §15.14)*

---

**STOP HERE.** This consolidated matrix, implementation plan, staging checklist, cost summary, risk register and decision sheet are **documentation only**. **No decision above has been approved.** No paid service is approved. No Region, scanner, architecture, endpoint, table, migration, credential, environment variable, CSP/CORS rule, staging resource, administrator, build, deployment, Git operation or production resource has been created, enabled, changed or requested as a value. **Staging remains blocked and unverified; Phase 8 is not complete.** Await the project owner's explicit written decisions before any further action.
