# Deployment Guide — Netlify + existing Turso + Netlify Blobs

> **Deployment status (5 November 2026, updated after the isolated staging attempt in §12):** no staging or production deploy has been performed or verified. The authorized isolated staging attempt was **blocked before deployment** because none of the required staging-only resources, identifiers, credentials, or secure secret channel were available, connectors are `unsupported`, and deploy-target network egress is restricted. Netlify site configuration, the current production Turso database state, hosted Blobs, and billing plan have not been inspected. This guide is preparation only. It does **not** authorize production deployment, migration, seeding, or administrator provisioning.
>
> Preserve the existing Turso database. Never create a replacement database, run a production migration, or seed production data as part of a build. Production deployment requires a separate explicit approval after the readiness report.
>
> **Controlled next steps (5 November 2026, §13):** the current authorization is **investigation, documentation, planning, and staging-readiness preparation only**. Option B (a separate object-storage service with secure, short-lived, scoped upload authorization) was **evaluated**, not implemented: see `docs/PHASE-8-REPORT.md` §11. At the time §13 was written, no provider was selected or purchased, no account/bucket/resource was created, no upload limit or source file was changed, and no new environment variable was introduced. §13 below is a staging-access checklist and a staging-deployment checklist for use **only after** staging resources and separate approvals exist. No staging deployment, migration, or Git commit/push is authorized now.
>
> **Amazon S3 Europe evaluation (5 November 2026, §14):** the user subsequently confirmed **Amazon S3** as the implementation target with **European** data residency; this is a historical update to the earlier "no provider selected" wording, **not** a reopening of provider selection. §14 is an **evaluation and documentation only** section covering European Region comparison, three malware-scanning approaches, three cost scenarios, upload/CV/delivery architectures, consolidated costs, risks, uncertainties, official references and exact approvals. **No Region, scanner, architecture, credential, bucket, paid service, source file, configuration, dependency, upload limit, schema, migration, middleware/CSP change, media access control, deployment, Git operation, or production action has been approved or performed.** The §13 checklists remain in force and blocked; staging is **not** verified and Phase 8 is **not** complete. Production deployment, migration, seeding and administrator provisioning remain prohibited.

## 1. Runtime and supported Next.js integration

- The application uses Next.js **15.5.29** and the App Router.
- Netlify uses the official `@netlify/plugin-nextjs` integration. The project pins **5.16.6** as a dev dependency and declares it in `netlify.toml`; confirm the effective plugin version in each Netlify build log.
- `@netlify/plugin-nextjs@5.16.6` supports Next.js 13.5+ and Node.js 18+ according to its published package README. Netlify normally installs its Next.js runtime automatically; the explicit pinned dependency is for reproducible integration.
- `@netlify/blobs@11.1.7` declares Node.js **>=22.12.0**. `netlify.toml` selects the current Node 22 patch; `package.json` also enforces a `>=22.12.0 <23` engine range. Confirm the actual resolved Node patch in Netlify build/function logs.
- Build command: `npm run build`. Netlify Next.js runtime handles `.next` output, server rendering, middleware, and route handlers. The repository has 58 App Router API routes; all use Node.js runtime (explicitly or by Next.js default), while middleware is the edge-compatible first-pass redirect/CSP layer.
- There are no custom Netlify rewrites/redirects. Next.js routes handle application paths. Existing Netlify and Next.js response headers cover security, no-index, and no-store cases; verify effective deployed headers rather than assuming merge behavior.

### Repository tracking / deploy-method gate (audit dated 5 November 2026)

The current branch HEAD (`bc53028`) tracks only `README.md`; the application, deployment configuration, documentation, and tests are present as **283 untracked paths** in the workspace. A Git-connected Netlify deployment from this branch would not contain the application and is not safe. Do not stage, commit, or push as part of Phase 8. A manual local Netlify CLI deployment might avoid Git, but it has not been authenticated or verified against a separate staging site. Netlify/Turso integrations are not available in the current session; do not attempt a deploy until an authorized secure staging runner/site is provided. If the approved process requires commit/push or repository restructuring, stop for separate approval.

## 2. Existing database — preserve and inspect before connecting

The repository contains the existing application schema and one initial migration at `drizzle/0000_init.sql` (33 domain tables plus the Drizzle migration ledger). Phase 7 verified the repository schema against a throwaway database and reported no schema changes. **That does not reveal the current production database state.**

1. Identify and confirm the existing production database in the authorized Turso account. Do not run `turso db create` or point the application at a new replacement.
2. Before any deploy that could access production, compare the existing database's migration history, tables, columns, indexes, and foreign-key state to the repository schema using a read-only inspection. Verify that the provided connection is the existing production database; do not print its URL or token.
3. If schema drift or a missing migration is found, stop. Document the exact migration, affected objects, additive/destructive classification, impact, backup, and rollback plan; obtain explicit approval before applying it.
4. `npm run db:migrate` is a write operation against whatever `TURSO_DATABASE_URL` targets. It is deliberately **not** part of `npm run build`, and must not be added to a Netlify build hook.
5. Never run `npm run db:reset:local` against the protected `.data/local.db`. Phase 8 schema checks must use an isolated throwaway database, not `.data/local.db` or production.

The connection is lazy and server-side. Remote `libsql://` configuration requires both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; missing remote authentication is rejected. `/api/health` only runs `SELECT 1` and returns an opaque database status; it does not disclose errors or credentials.

## 3. Netlify site and deploy contexts

No Netlify site or staging site has been verified as of this report; there is no staging URL or site identifier available. Netlify/Turso connector lookups were unsupported and no native authenticated CLI/secure setup was available, so staging setup and deployment are blocked. Do not create paid resources without confirming the account plan/cost and receiving approval where needed.

- Connect the existing repository/authorized branch to the **existing** Netlify site only after the production gate is approved.
- For staging, use a **separate Netlify site** with a separate staging Turso database and staging environment variables. Netlify Blobs' default stores are site-scoped and shared across deploys/deploy contexts; a branch deploy on the production site is not storage-isolated from production.
- The pinned official Next.js plugin is declared in `netlify.toml`. Build configuration is `npm run build`, `publish = ".next"`, `NODE_VERSION = "22"`, and telemetry disabled.
- Do not copy production secrets into a preview/staging context. Do not use the production applicant database or real applicant files for staging tests.

## 4. Environment-variable checklist

Set the applicable values through Netlify's secure environment-variable UI for the correct site and deploy context. Never put secret values in this repository, command output, reports, screenshots, or chat. This table records names and handling only; no production values have been inspected or configured.

| Variable | Required / purpose | Scope and exposure |
|---|---|---|
| `TURSO_DATABASE_URL` | Required for database-backed runtime routes; remote value uses `libsql://…`. | Netlify site environment; server-only. Confirm it points to the existing production DB only after authorization. |
| `TURSO_AUTH_TOKEN` | Required secret for remote Turso connections. | Netlify secret environment; server-only. Never print or expose. |
| `SESSION_SECRET` | Required by authentication; at least 32 characters. Prefer the documented 48-byte random value encoded as hex. | Netlify secret environment; server-only. Never reuse a password or store in source. |
| `STORAGE_DRIVER` | Required in production and must equal `blobs`. Production code now fails closed if it is missing or set to `local`, avoiding ephemeral filesystem storage. | Netlify site environment; server-only, non-secret. Set explicitly for staging and production. |
| `NETLIFY_BLOBS_CONTEXT` | Netlify Blobs SDK execution context, automatically populated by Netlify for supported function/edge execution. | Platform-injected; server-only and sensitive. Do not set manually, copy between sites, or log. |
| `NETLIFY_BLOBS_SITE_ID` / `NETLIFY_BLOBS_TOKEN` | Optional explicit SDK credentials for running outside Netlify's injected context. | Server-only; token is secret. Prefer the injected context on Netlify. Do not use in browser code. |
| `NEXT_PUBLIC_SITE_URL` | Required for canonical URLs, Open Graph, sitemap, and absolute URLs; source falls back to localhost if unset. | Set in each site/build context. Intentionally public and may be embedded in client output. Use the exact authorized HTTPS hostname, with no trailing slash. |
| `NODE_ENV` | Netlify-managed production mode. | Platform/runtime variable; non-secret. |
| `NODE_VERSION` | Configured as Node 22; effective version must be >=22.12.0 for the installed Blobs package. | Build/runtime selection; non-secret. Confirm the resolved version in logs. |
| `NEXT_TELEMETRY_DISABLED` | Already set to `1` in `netlify.toml`. | Build-only, non-secret. |
| `SESSION_COOKIE_NAME` | Optional; defaults to `immi_admin_session`. | Server-only, non-secret; leave at default unless approved. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`, `ADMIN_ROLE`, `SEED_ADMIN_ALLOW_ADDITIONAL` | One-time `npm run seed:admin` inputs only; not required at site runtime. | Do **not** set as persistent Netlify site variables. Production administrator provisioning is a separate approval checkpoint. Do not use any previously shared password. |

The local `.env.example` is for development and contains placeholders only. Its `STORAGE_DRIVER=local` value must not be copied into a production Netlify context.

## 5. Public and private media storage

The application uses two distinct Netlify Blobs stores:

- `immi-public`: approved agency logo, public website images, team/testimonial media.
- `immi-private`: applicant CVs and other sensitive attachments.

The public proxy accepts only database rows with `visibility='public'`, rejects unsupported types, and serves content through the site origin with `Cache-Control: public, max-age=31536000, immutable`. Private CVs are returned only by the admin assessment attachment route after server-side session/role checks and an audit write; the response is forced as an attachment, uses `no-store`, `nosniff`, and a sandbox CSP. Upload validation checks bytes/signatures and purpose allowlists; current limits are 8 MB for images, 10 MB for CVs/documents, and 100 MB for testimonial videos.

Netlify's Blobs context is **not** evidence that hosted Blobs has been tested. Use synthetic fixtures only in the separate staging site. Verify store separation, approved public proxy behavior, authorized private download, upload errors, and cache headers. Never upload real applicant data.

**Upload-size deployment risk (corrected 5 Nov 2026):** The current official Netlify Functions configuration documents a **6 MB buffered request/response payload** limit that is not configurable; binary/base64 request bodies have ~30% overhead, so the **effective binary ingress ceiling is ≈4.5 MB**. (Phase 5 recorded "16 MB"; that figure is outdated — see §12.) The current video validator permits 100 MiB, and the image/document tiers are 8/10 MB, all above the documented ingress ceiling. Confirm the effective limit for the deployed function type and test uploads in isolated staging before production. If large video requests exceed the platform limit, stop and return with options; do not silently change the limit or upload architecture.

**Current upload architecture assessment (local source review):** `POST /api/admin/cms/media` receives multipart data in a Node function, calls `request.formData()`, then `File.arrayBuffer()`, and passes the resulting bytes through `storage.put()` to `@netlify/blobs` `store.set()`. The payload reaches the function before Blobs; the SDK's server-side `set` call does not bypass Netlify's incoming request-size limit. The installed `@netlify/blobs@11.1.7` public API exposes no supported browser presigned-upload URL helper; its internal `type=signed-url` mechanism only transmits a body the Function already holds. Official Blobs docs describe CRUD from Functions/Edge/Build Plugins/CLI, with no native client or resumable upload. Do not expose Blobs tokens or rely on undocumented internal signed-URL behavior. Therefore the 100 MB video limit is **not safely supported by the current request path** under the documented 6 MB (≈4.5 MB binary) ceiling.

No direct-upload workflow is implemented or verified. A safe future direct-upload design would require a supported, short-lived, one-use authorization scoped to a generated object key and size/type ceiling; an untrusted/quarantine store; trusted server-side size, MIME and magic-byte validation before publication; strict public/private separation; replay/unauthorized-write prevention; and expiry/orphan cleanup. If Netlify Blobs does not provide a supported mechanism, the choices are to seek explicit approval for a safe size-limit change (including multipart overhead) or evaluate a separately approved object-storage service with direct uploads and its cost/security tradeoffs. Do not weaken existing validation or expose storage credentials.

## 6. Build, migration, and seed safety

- `npm run build` runs `next build`; it does not run database migrations, seed content, or provision an administrator.
- There are no `prebuild`, `postinstall`, or Netlify build hooks that seed/migrate. Keep it that way.
- The project has a credential-free production-build check. Build commands must run without production database/storage credentials and must not depend on `.data/local.db`.
- `npm run verify:schema`, `npm run db:check`, and `npm run db:generate` are development verification tools. Run schema checks against an isolated scratch file; never let a check target the protected local DB or production.
- `npm run seed:destinations` and `npm run seed:demo` write data. Use synthetic content only in staging after environment isolation is confirmed. Do not run them against production without explicit content approval.
- `npm run seed:admin` creates a new owner/admin and forces password change. It is not a deployment/build step. Do not run it for production in this phase. The specified production account `[REDACTED-EMAIL]` remains unprovisioned pending its separate explicit authorization and secure credential configuration.

## 7. Staging verification plan

Staging is not complete until an isolated site and database are available and the checks below have actual evidence. No production resource may be substituted for staging. At the 5 November 2026 audit checkpoint, no staging site, URL, or Turso database was available, and Netlify/Turso secure integrations were unsupported in this session; no staging variables were configured and no hosted tests were run.

- Public routes: homepage, about, services, destinations/process pages, testimonials, team, FAQs, contact, legal pages, and assessment navigation/validation (no submission).
- Admin: login and session cookies, forced-change behavior using a synthetic staging account, protected routes, CMS access, media upload, assessment inbox/detail using synthetic records, activity log, and authorization checks for private CV download. Do not create real applicant records.
- Storage: synthetic public media through the proxy, private CV only through the authorized route, negative public-access check for private keys, upload validation and error handling, and caching/no-store behavior.
- Runtime: SSR, API handlers, middleware redirects/CSP, database `SELECT 1`, secure cookies/HTTPS, graceful errors, and deployed Node/plugin versions.
- Upload size: test within the actual Netlify function payload limit; larger video uploads remain a known risk until verified.

A branch deploy on the production site is not an isolated storage test. If no separate staging site/database is available, mark staging **not run** rather than treating local checks or the Blobs filesystem simulator as hosted evidence.

## 8. Production deployment approval gate

Before production, present a readiness report with architecture, exact Netlify/plugin/Node settings, existing Turso state comparison, staging results, Blobs status, environment-variable configuration status (names only), build/test/audit results, costs, known upload limits, risks, rollback plan, and every incomplete check. Then stop and wait for explicit production-deploy approval.

Even after deployment approval, do not apply a production migration unless it has its own explicit approval and documented non-destructive plan. Do not provision the production administrator until separate explicit authorization. Do not use a previously shared password.

### Rollback boundaries

- Bad application deploy: use Netlify's previous-deploy rollback only after verifying it targets the intended site.
- Database changes: no automated rollback is assumed. Preserve backups and approved migration history; never drop/reset/replace production tables or databases. If a migration is proposed, stop for explicit approval.
- Blobs: public/private stores are persistent site data and are not rolled back by publishing an earlier deploy. Do not delete, overwrite, or reset stores to roll back code.

## 9. Local development

For local work, `.env.local` may use a scratch `file:` database and `STORAGE_DRIVER=local`. Protect `.data/local.db` and `.data/secret-markers.json`; use a separate throwaway copy/path for schema verification, migrations, and browser tests. Do not copy production credentials or data into local files.

## 10. Authorized staging access, deployment workflow, and costs

### Secure access prerequisite

At the 5 November 2026 audit checkpoint, Arena's Netlify and Turso connector lookups returned `unsupported`; the native CLIs and a remote secure deployment runner were unavailable. Do not paste credentials into chat. Before hosted staging work, arrange one of:

1. A supported, authorized Netlify/Turso integration with **staging-only** access and a secure environment-variable interface; or
2. A separately authorized runner with Netlify/Turso CLI tools, permitted network egress, and staging credentials injected from a secret manager.

For Netlify, obtain access to a separate staging site (site ID/name and URL) with only the permissions needed to create a draft deploy, view build/function/edge logs, and configure staging-scoped variables/Blobs. For Turso, an authorized organization member must provide a separate staging database identity and create a staging-only auth token through a secure console/CLI workflow. Keep production credentials entirely separate. No site, database, or token has been created/configured by this work.

### No-Git deployment option and current repository state

Netlify CLI `27.16.2` help describes a local build-and-upload deployment, a `--site` target, a `--remote` build mode, and a draft deploy by default; `--prod` is a separate opt-in. A local CLI route could avoid Git commits in principle, but it still requires Netlify authentication, a confirmed staging site ID, outbound Netlify API access, and a successful application/edge build. This app has not completed the local edge bundle and the current Arena environment cannot provide the required authenticated network access. No deployment was attempted. The CLI's `--site-name` and `--allow-anonymous` options can create sites; do not use either without a cost/access checkpoint.

The current branch HEAD tracks only `README.md`; the 283 application/configuration/docs/test paths are untracked. A Git-connected Netlify workflow would therefore omit the app. If the user later chooses Git-connected deployment, required source/configuration must first be reviewed and committed/pushed to the authorized branch. That Git operation needs separate explicit approval. Do not stage, commit, push, or restructure this repository under the current authorization. Do not include local `.env.local`, `.data/`, `.next/`, `node_modules/`, caches, or local database files in a deploy archive.

### Staging database constraint

The current instruction prohibits database migrations. Consequently, the separate staging database must already have the schema compatible with `drizzle/0000_init.sql`, which can be checked read-only after secure access is available. If it is empty or requires migration, stop and obtain separate authorization before applying even a staging migration. No production migration is allowed.

### Costs and permissions to confirm first

No billing or plan information was accessible, so no exact amount can be stated. Before creating staging resources, the account owner should confirm: Netlify site/team limits, build minutes, Functions/Edge usage, bandwidth and Blobs storage/operations/egress; Turso database/compute/storage/read-write plan limits; and any separate object-storage or scheduled-cleanup costs if a direct-upload solution is approved. No resource creation or paid service is authorized until this review is complete.

## 11. Next.js middleware edge-bundle investigation

**Resolved 5 November 2026 (see §12.3).** A credential-free local `netlify build --offline --context deploy-preview` using plugin v5.16.6 completed the Next.js application build and server-function bundle, then failed while packaging `___netlify-edge-handler-src-middleware` (`Next.js Middleware Handler`) with `fetch failed`. The earlier working theory blamed the remote Deno imports in the generated `vendor.ts` seed; that was **wrong**. Those modules (`deno.land/std@0.175.0`, `path_to_regexp`, `htmlrewriter`, `edge-utils`) are **pre-vendored** in the generated `edge-runtime/vendor/` directory (149 files) and the emitted handler `.js` has zero remote `https://` imports, so they need no build-time network.

The real failing fetch is `@netlify/edge-bundler@16.2.0` downloading the **Deno CLI binary** from `https://dl.deno.land/release/v2.4.2/deno-x86_64-unknown-linux-gnu.zip` (version range `^2.4.2`; the `release-latest.txt` probe fails silently first). With no global/cached Deno present, that `fetch` throws `TypeError: fetch failed` / `ECONNRESET` and is retried 4 times. This was reproduced directly by invoking the downloader. Every `dl.deno.land`, `deno.land`, `edge.netlify.com`, `api.netlify.com`, and `edge-utils.netlify.app` host is egress-blocked in this sandbox while allowlisted hosts succeed — so this is a **network restriction, not a compatibility issue**. On hosted Netlify a compatible global Deno is pre-installed on the build image and `getGlobalBinary()` skips the download, so the failing fetches do not occur; hosted packaging is still unverified until a staging build exists.

The middleware implements HTTPS redirect, CSP nonce, no-index/cache behavior, and a cheap admin redirect; all were confirmed present and unchanged. Keep that behavior. Do not claim hosted compatibility from the partial local build, and do not remove security behavior to make the local check pass.

---

## 12. Isolated staging deployment and verification attempt (5 November 2026)

This section records the authorized attempt to perform isolated staging deployment and verification. It is the operational companion to `docs/PHASE-8-REPORT.md` §10. **No staging deployment or verification took place.** Nothing was created, connected, migrated, or configured; no cost was incurred; no production resource was accessed; no commit/push/branch change occurred; no security control was weakened. The existing 283-path audit and Appendix A in the Phase 8 report are preserved intact.

### 12.1 Access gate — BLOCKED (nothing to deploy with)

The authorization requires a separate staging site and database and staging-only secrets, and requires identifying exactly what is missing rather than guessing. Verified availability (values never printed; only names/presence checked):

| Required staging-only item | Available? |
|---|---|
| Netlify staging site ID | No — no ID, no `.netlify/state.json`, no linked-site config. |
| Netlify staging site URL | No. |
| Netlify staging deployment auth | No — environment has only GitHub (`GH_TOKEN`, `GITHUB_TOKEN`) and E2B sandbox tokens. |
| Turso staging database URL | No. |
| Turso staging auth token | No. |
| Staging-scoped `SESSION_SECRET`, `STORAGE_DRIVER`, `NEXT_PUBLIC_SITE_URL`, etc. | No; none set. |
| Confirmation resources are separate from production | No — no staging or production resource was identified or supplied. |

Both Netlify and Turso connector lookups returned `unsupported`. There is **no secure environment-variable/secret interface** in this session (full env name list is only `E2B_*`, `GH_TOKEN`, `GITHUB_TOKEN`, `GIT_TERMINAL_PROMPT`, and shell variables). All deploy-target hosts (`api.netlify.com`, `app.netlify.com`, `api.turso.tech`, `turso.io`, `edge.netlify.com`, `dl.deno.land`, `deno.land`, `edge-utils.netlify.app`) are egress-blocked (TLS error 35 / ECONNRESET); only `github.com`, `api.github.com`, `codeload.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org` are reachable. No identifier was guessed and no production value substituted. Provide staging secrets only through an authorized secure interface, never in chat or documentation.

### 12.2 Repository baseline re-verified (before any action)

Branch `arena/cdcb43ad-immi-website`, HEAD `bc53028b18b4ad9f8f2391b816a872973cbae457`, 1 tracked file (`README.md`), **283 untracked paths**, no staged and no modified tracked files. `.data/local.db` (`7c16…ff3`) and `.data/secret-markers.json` (`2e56…47d0`) hashes unchanged. Appendix A still matches the working tree **exactly 283/283**. No Git operation, no source hiding, no protected-file overwrite.

### 12.3 Edge-function build failure — RESOLVED locally (not a blocker on hosted Netlify)

- `___netlify-edge-handler-src-middleware` is the Next.js Middleware Handler edge function generated by `@netlify/plugin-nextjs@5.16.6` / `@netlify/edge-bundler@16.2.0`.
- The remote Deno URLs in `edge-runtime/vendor.ts` are a **seed**; the runtime ships a **pre-vendored `vendor/` tree (149 files)** and the generated handler `.js` has **zero** remote `https://` imports. They need no build-time network.
- The actual `fetch failed` is the edge-bundler downloading the **Deno CLI binary** from `https://dl.deno.land/release/v2.4.2/deno-x86_64-unknown-linux-gnu.zip` (range `^2.4.2`); the `release-latest.txt` probe fails silently first. Reproduced directly: `TypeError: fetch failed`, cause `ECONNRESET`, 4-attempt `p-retry`. Cause is **restricted egress**, not a plugin/runtime/middleware incompatibility.
- Hosted Netlify pre-installs a compatible global Deno (edge-bundler source ties `^2.4.2` to the `netlify/buildbot` image), so `getGlobalBinary()` skips the download; combined with pre-vendored modules, the failing fetches do not happen on Netlify. **Compatible in principle; hosted build still unverified** until a staging build exists. Confirm with one hosted build + edge-function log.
- Middleware security (HTTPS 308 redirect, per-request CSP nonce, `frame-ancestors 'none'`, no-index for `/admin`/`/assessment/success`/`/api`, no-store for admin/API, admin cookie pre-filter, protocol-relative redirect guard) and `netlify.toml` headers (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) all present and unchanged. Nothing removed or weakened.

### 12.4 Video upload — corrected platform limit; resolution REQUIRES APPROVAL

- **Corrected ceiling:** official Netlify Functions configuration documents a **6 MB buffered request/response payload** (not configurable); binary/base64 bodies add ~30% overhead → **≈4.5 MB effective** for uploads. Streamed *response* is 20 MB but does not raise request ingress. The Phase 5 "16 MB" note is outdated. Sources: docs.netlify.com/build/functions/configuration and /usage-and-billing; Netlify support answer 108419; Netlify Blobs knowledge base.
- **Installed SDK:** `@netlify/blobs@11.1.7` provides only server-side `getStore(...).set(key, ArrayBuffer | Blob | string, …)`; the internal `type=signed-url` header is a server-to-Blobs transport detail for a body the Function already holds, **not** a browser presigned-upload primitive. Official docs and independent references confirm Netlify Blobs has no native client/presigned or resumable upload. Blobs' 5 GB per-object cap is irrelevant: the Function request body is the binding limit.
- **Current path:** `POST /api/admin/cms/media` buffers the whole multipart request (`request.formData()` → `File.arrayBuffer()`) inside a Netlify Function before `store.set()`. A 100 MiB video cannot pass the documented ingress ceiling, and 8/10 MB tiers may also exceed the ≈4.5 MB binary ceiling, being rejected with an opaque platform error before the app's clear validator message. No limit or architecture was changed; no presigned implementation was introduced.
- **Options — both need approval:** (a) reduce accepted limits to a ceiling safely below the effective binary ingress ceiling including multipart/base64 overhead (product approval, no new cost); or (b) add a separately evaluated object-storage/direct-upload service with genuinely supported short-lived scoped presigned uploads, with a reviewed design covering server-issued single-use authorization bound to a generated key + byte ceiling, private quarantine stage, trusted server-side size/MIME/magic-byte validation before publication, strict public/private separation, replay/unauthorized-write prevention, expiry/orphan cleanup, and no storage credential in the browser. Netlify's `prepare_upload → PUT → finalize_upload` pattern still routes bytes through a Function and does not by itself bypass the ceiling. Preserve server-side validation, MIME/magic-byte checks, size enforcement, public/private separation, access restrictions, and cleanup of failed/abandoned uploads.

### 12.5 Staging database — BLOCKED before any migration

No staging Turso database was supplied, so no schema inspection, comparison, missing-object check, migration-history check, or "will not overwrite existing staging data" confirmation was possible. No migration was run. Expected-schema baseline recorded locally (read-only): `drizzle/0000_init.sql` = **33 tables, 61 indexes, 47 foreign keys**; journal `drizzle/meta/_journal.json` has one entry `0000_init` (v7, dialect sqlite); `db:migrate` is an explicit CLI command, not a build hook. If a staging DB is later supplied empty or drifted, stop and obtain separate approval for a non-destructive staging migration after a read-only comparison. No production migration is authorized.

### 12.6 Deployment & verification method and results

- **Intended method (no Git):** a Netlify CLI local/draft deploy explicitly targeting the separate staging site (`--site <staging-id>`, draft default, `--prod` never used), with staging-only variables injected via the site's secure environment-variable UI, pointed at the separate staging Turso DB. A Git-connected deploy would require committing/pushing the 283 untracked files, which is prohibited; it was not used.
- **Why it could not run:** missing site ID/URL/auth, missing Turso staging URL/token, missing staging variables, no confirmation of production separation, connectors `unsupported`, no secret interface, and blocked deploy egress. Per the instruction, stop and report rather than improvise; no workaround attempted.
- **Five-way status:** **(1) Verified locally** — repo baseline, edge root cause, middleware/header security, official 6 MB/≈4.5 MB ceiling + Blobs capabilities, expected schema, prior Phase 8 local test/build results. **(2) Verified on staging** — *none*. **(3) Not verified** — hosted build/edge packaging, function/edge logs, effective merged headers. **(4) Blocked** — staging site ID/URL, Turso DB identifier, deployment/build result, staging schema comparison, all public-site/assessment/admin/infrastructure browser and functional tests, staging DB & storage connectivity, env-var configuration, no-production-reference and error-handling/header checks. **(5) Requires approval** — creating billable staging resources (cost), video-upload architecture/limit decision, any staging migration (if DB empty/drifted), any staging admin provisioning (staging-only account + fresh credentials), separate production deploy/migration/admin/Git gates.

### 12.7 Costs and completion verdict

No billable resource was created, so no cost was triggered. Before any future creation, confirm: Netlify site/team limits, build minutes, Functions compute (credit-based GB-hour or legacy per-request), Edge invocations, bandwidth, Blobs storage/operations/egress (Functions region is Pro/Enterprise); Turso database/compute/storage/read-write limits; and any separate object-storage/cleanup cost. No billing view was accessible here.

**Phase 8 is not complete and staging is not yet safe for further testing.** The deployment, database, storage, public website, admin portal, assessment workflow, security controls, and outstanding deployment risks have not been tested on staging. Do not equate the local build/readiness results with staging verification. Provide an authorized secure staging integration/runner with staging-only secret injection and permitted egress, plus the approvals in §12.6, then repeat the single hosted build/edge-log check and the full staged verification with synthetic data only. **Stop here — no production deployment, production migration, production administrator provisioning, Git commit, or Git push.**

## 13. Controlled next steps — staging-access and staged-deployment checklists (5 November 2026)

Companion to `docs/PHASE-8-REPORT.md` §11. This section is **preparation only**. It does not authorize a deployment, a provider purchase, a bucket/account creation, a database migration, or any Git operation. Staging is **not verified**; Phase 8 is **not complete**.

### 13.1 Storage evaluation summary (no implementation)

Five options were evaluated: **Amazon S3**, **Cloudflare R2**, **Backblaze B2** (technically suitable), **Wasabi Hot Cloud Storage** (unsuitable: 1 TB minimum monthly charge + 90-day minimum storage duration makes abandoned-upload cleanup billable), and **Netlify Blobs** (unsuitable: no supported browser presigned-upload primitive). The report recommends **Amazon S3** as the primary candidate because it is the only evaluated provider with a documented, server-enforced size bound inside the upload authorization (`content-length-range` in a presigned POST policy), native managed malware scanning, lifecycle cleanup, and conditional writes; **Cloudflare R2** is the cost-optimized alternative (zero egress, free deletes, short-lived scoped grants) but requires a hosted verification that a signed `Content-Length` is enforced, since R2 does not support presigned POST. Expected cost scenarios range from ≈ $0.00–$0.06/month at synthetic staging volume to ≈ $9.65/month (S3) or ≈ $0.23/month (R2) for a small production workload, with S3 egress dominating at scale. See §11.1–§11.4 of the Phase 8 report for the full comparison, official references, cost table, ten-step architecture, security considerations, and eleven open uncertainties.

**No provider, account, bucket, subscription, API token, dependency, endpoint, environment variable, upload limit, or storage driver was added or changed.** The existing `STORAGE_DRIVER=blobs` Netlify implementation and the separate `immi-public` / `immi-private` Blobs stores remain intact. Public testimonial media and private applicant CVs stay strictly separated. The existing 100 MiB video path remains incompatible with the documented 6 MB buffered / ≈4.5 MB effective binary Netlify Function ceiling; the 12 MiB assessment request ceiling is likewise affected. No unsupported presigned-upload workaround was introduced.

### 13.2 Staging-access checklist (Workstream B)

**Rules:** all secrets must be supplied only through supported secure configuration interfaces (Netlify environment variables via UI/CLI/API with the correct deploy context and **Functions** scope; Turso's secure configuration). **Document only non-secret identifiers** — site ID, URL, database identifier/URL, variable names, bucket/region names where non-sensitive. **Never** paste, print, log, or ask for passwords, tokens, private keys, database secrets, private storage keys, CV URLs, upload tokens, or internal object identifiers in chat, docs, or terminal output. **Confirm in writing that every resource is separate from production before any use**; do not guess identifiers and never substitute production values. Variables declared in `netlify.toml` are **not** available to Functions or Edge Functions; environment values are frozen at deploy time, so changing one requires a new deploy.

| # | Gate | Required | Status |
|---|---|---|---|
| 1 | **Netlify — separate staging site** | Staging **site ID** and staging **URL**; written confirmation that this is a distinct site, not production | Not provided — blocked |
| 2 | | **Staging-only deploy authorization** scoped to that site; draft/branch-deploy only, **never `--prod`** | Not provided — blocked |
| 3 | | Staging **environment variables** with Functions scope and the correct deploy context (`branch:staging` / deploy-preview) | Not provided — blocked |
| 4 | | **Function and Edge log access** (build logs, function logs, edge logs) for the staging site | Not provided — blocked |
| 5 | **Turso — separate staging DB** | Staging **database identifier / URL** and written confirmation it is distinct from production | Not provided — blocked |
| 6 | | **Staging-only auth token** via a secure secret interface | Not provided — blocked |
| 7 | | **Read-only schema inspection** access (tables, columns, indexes, FKs, migration ledger) | Not provided — blocked |
| 8 | | **Staging-only migration/write access only if separately approved**, after the read-only comparison; non-destructive and preserves staging data | Not authorized |
| 9 | **Application config (staging-only)** | Staging-only `SESSION_SECRET` | Not provided — blocked |
| 10 | | `STORAGE_DRIVER=blobs` where appropriate for the existing Netlify Blobs implementation (production fails closed unless set) | Not provided — blocked |
| 11 | | `NEXT_PUBLIC_SITE_URL` = **staging URL**, never production | Not provided — blocked |
| 12 | | **Newly approved object-storage variables only after provider selection and approval** (endpoint/region/jurisdiction, bucket identifiers, scoped credentials, quarantine prefix, lifecycle TTL, malware-scanning config) | Not applicable yet — no provider selected |
| 13 | **Separation confirmation** | Written confirmation that Netlify site, Turso DB, storage buckets, credentials, and DNS are all separate from production; review staging config for any production identifier | Not provided — blocked |
| 14 | **Cost gate** | Disclosed expected costs and written approval **before** creating any billable resource; budget cap and billing alerts configured | Not provided — blocked |

Earlier audit (Phase 8 §10.2): all twelve checked staging-related environment names were `not set`; Netlify/Turso connectors are `unsupported`; no secret mounts, no `.netlify/state.json`, and no native staging CLIs. `GH_TOKEN` / `GITHUB_TOKEN` are GitHub credentials, **not** staging credentials. `NETLIFY_BLOBS_CONTEXT` is injected automatically by Netlify — do not set or print it.

### 13.3 Precise staging deployment checklist (Workstream C)

**Executable only after** every §13.2 gate is satisfied and the exact approvals in `docs/PHASE-8-REPORT.md` §11.5 are granted. Each step is a gate — stop and report on any failure. **Do not execute any step now.**

1. **Re-verify baseline:** branch `arena/cdcb43ad-immi-website`, HEAD `bc53028b18b4ad9f8f2391b816a872973cbae457`, 1 tracked file, 283 untracked paths, 0 staged, 0 modified tracked changes, Appendix A exact 283/283, protected hashes unchanged. No Git staging, commit, push, or branch change.
2. **Confirm separation:** Netlify staging site ID/URL, Turso staging DB identifier, separate storage buckets/credentials; no production identifier in staging config; written confirmation recorded.
3. **Inject staging-only secrets** through the secure interface with Functions scope and correct deploy context; verify **presence only** (never values). Include object-storage variables only if a provider has been approved. Confirm no production value is present.
4. **Read-only schema inspection:** list tables, columns, indexes, FKs, and migration ledger; compare with `drizzle/0000_init.sql` (33 tables, 61 indexes, 47 FKs) and `drizzle/meta/_journal.json` (one `0000_init` entry). Report drift. **Stop** on conflict. No migration without separate approval; any approved migration must be non-destructive and preserve staging data. `npm run db:migrate` writes to whatever `TURSO_DATABASE_URL` targets — never add it to the build.
5. **Deploy to staging only:** non-production/draft deploy targeting the staging **site ID**; never `--prod`; never a Git-connected build from this branch (only `README.md` is tracked). Use the authorized no-Git local CLI path only if a secure runner with permitted egress is provided. Do not stage/commit/push.
6. **Single hosted build + edge check:** confirm plugin/runtime versions and Node patch in the build log, confirm the middleware edge handler bundles without the Deno CLI download failure (Phase 8 §10.4), and review Function **and** Edge logs. Hosted edge compatibility is unverified until this step actually runs.
7. **Verify effective headers and middleware:** HTTPS/secure-cookie behaviour, merged CSP (nonce, `media-src`/`connect-src` exactly as approved), `no-index`/`no-store`, cache headers, admin redirects, CSRF and session in the hosted runtime. No broadened CSP directives.
8. **Verify storage public/private separation:** `immi-public` / `immi-private` Blobs stores, anonymous denial of private downloads, storage-failure handling, public proxy `visibility='public'` filter with `nosniff` and sandbox CSP.
9. **Verify upload ceilings honestly:** test within the documented 6 MB buffered / ≈4.5 MB effective binary ceiling; record explicitly that the 100 MiB video path and the 12 MiB assessment request path remain incompatible. **Do not** change limits or claim support. If an approved Option B implementation exists in a later turn, test authorize → direct upload → quarantine → finalize → promote → cleanup with **synthetic files only**, including wrong-MIME, oversize, expired-token, and abandoned-upload rejection cases.
10. **Synthetic-data functional verification:** public site, admin portal (staging-only account), assessment workflow, CMS media. Synthetic data only; no real applicant submissions/documents; no production administrator provisioning.
11. **Log review and evidence:** collect build/function/edge logs, record results, report. Never print secrets, tokens, CV URLs, authorization tokens, or internal object keys.
12. **Only after successful staging verification:** request the **separate explicit approval** for GitHub commit and push. Production deployment, production DB access/migration, production resource modification, and production credentials remain prohibited.

### 13.4 Remaining deployment blockers and required approvals

**Blockers:** no staging Netlify site ID/URL or deploy authorization; no Turso staging DB identifier/token or read-only inspection access; no secure secret channel or supported connector (`unsupported`); no function/Edge log access; no confirmation that staging resources are separate from production; no cost disclosure/approval or billing-plan visibility; no hosted build; egress to deploy targets blocked from this sandbox while npm/GitHub are reachable; no provider selection or storage-architecture approval; no malware-scanning choice; no public-delivery design for large video; no data-residency decision.

**Approvals needed before any implementation (each separate and explicit):** provider selection; cost/billing approval before any account, bucket, subscription, or paid service; the ten-step storage architecture (including new endpoints, a pending-uploads table and its own migration approval, CORS, lifecycle rules, quarantine TTL, malware scanner, public delivery path, and any narrow CSP change); any upload-limit change; new environment variables/credentials via secure interfaces; staging resource creation and deployment; staging migration only after read-only comparison and only if non-destructive; staging-only administrator provisioning if needed; hosted verification; and **GitHub commit/push only after successful staging verification plus a separate explicit approval**.

### 13.5 Stop point

Stop after the documentation in `docs/PHASE-8-REPORT.md` §11 and this §13. Do not claim staging is verified or that Phase 8 is complete. Await explicit approval before implementing any storage architecture, selecting or purchasing a provider, creating billable resources, deploying staging, running a migration, or performing any Git operation. No production action occurred or is authorized. `.data/local.db` and `.data/secret-markers.json` remain untouched.

---

## 14. Amazon S3 Europe — architecture, malware-scanning and cost evaluation (5 November 2026)

> **Status: EVALUATION AND DOCUMENTATION ONLY.** This section is appended after, and preserves in full, §§1–13 — in particular the **staging-access checklist (§13.2)** and the **precise staging-deployment checklist (§13.3)**. Nothing here implements, enables, purchases, deploys, migrates, or verifies anything. No cloud resource, account, bucket, IAM role, paid service, source file, configuration, dependency, upload limit, schema, migration, middleware, CSP or media access control was created or changed. No staging resources, admin, deployment, Git operation, or production action occurred. Full detail, official references R1–R59, worked cost tables and the 15-item control mapping are in `docs/PHASE-8-REPORT.md` **§12**; this section is the operational counterpart.

### 14.0 Scope, decisions and labels

**Confirmed decisions:** implementation target **Amazon S3**; data residency **Europe** with suitable European AWS Regions compared and **no Region assumed approved**; malware scanning **evaluated before selection**, recommendation made only for approval; GitHub push only after successful staging verification **and** a separate explicit approval. **Authorization boundary:** research, technical evaluation, cost estimation, architecture planning and documentation only — no implementation, purchase, resource creation, live AWS integration test, source/config/dependency/upload-limit/schema/migration/deployment/Git/production action; no secrets in chat or docs.

Labels used throughout: **documented** (official AWS / Netlify / ClamAV / vendor-published source, see §12.10 R1–R59), **estimated** (arithmetic on documented rates + explicit illustrative workload assumptions; not a quote), **unverified** (cannot be resolved without account access, a hosted staging build, a vendor quote, or a live AWS test), **requires approval** (must not proceed without separate explicit written approval). Standing cautions: a European Region alone does **not** guarantee GDPR compliance; free allowances do **not** make production free; **budget alerts do not necessarily prevent charges**; unpublished commercial pricing means **vendor quote required**; scanning costs are kept separate from S3/requests/transfer/Netlify/Turso/CDN.

### 14.1 European Region comparison and recommendation — **requires approval**

**documented** — Eight European Regions [R1]: `eu-west-1` Ireland, `eu-central-1` Frankfurt, `eu-west-2` London, `eu-west-3` Paris, `eu-north-1` Stockholm, `eu-south-1` Milan, `eu-south-2` Spain, `eu-central-2` Zurich. EU/EEA member-state Regions: Ireland, Frankfurt, Paris, Stockholm, Milan, Spain; **London (UK) and Zurich (CH) are not EU/EEA** but have GDPR adequacy decisions [R2], [R3]. Milan/Spain/Zurich are **opt-in** Regions requiring account enablement [R4]. A Lagos, Nigeria **Local Zone** exists but its parent is `af-south-1` (Africa, Cape Town), **not Europe** — excluded [R5]. CloudFront has a **Lagos, Nigeria PoP** [R6].

| Dimension | Finding |
|---|---|
| S3 / upload mechanism availability | S3 is regional; presigned URLs, POST policies (`content-length-range`, exact/`starts-with` conditions), SigV4 checksums, multipart (1–10,000 parts), Block Public Access (4 settings default on), `Bucket owner enforced` all documented [R10]–[R14]. Malware protection must be in the **same Region/account** as the bucket [R8], [R9]. |
| Malware-scanning availability | GuardDuty endpoints in **all eight** European Regions [R15]; Config rule `guardduty-malware-protection-enabled` listed for 7 EU Regions [R17]. **Feature-level** Malware Protection for S3 availability per Region and Region-specific rate tables are **unverified** [R16]. |
| Storage / request / transfer / retrieval pricing | S3 cost components, no minimum charge, DELETE/CANCEL free, LIST at PUT rate, storage-class minimum durations (30/90/180 days) and retrieval fees, Ireland $0.09/GB internet egress example [R18]. CloudFront 1 TB + 10M requests free, then $0.085/GB (Europe) / $0.110/GB (Nigeria/Africa), HTTPS $0.0120/10k, 1,000 free invalidation paths then $0.005/path, AWS-origin fetch free [R7], [R21]. **Estimated (secondary, unverified):** S3 Standard $0.023/GB-month (Ireland/Stockholm), $0.0245 (Frankfurt), $0.005/1k writes, $0.0004/1k reads [R23]. |
| Likely-user latency | West-African audience suggested but **unverified**; Lagos CDN PoP mitigates delivery; direct browser uploads to EU have higher RTT; no measurement performed [R6], [R25], [R26]. |
| GDPR operational | Customer chooses storage location and encryption; AWS may use sub-processors; GDPR does not change the shared-responsibility model [R28], [R29]; DPA/SCCs apply automatically [R2]. Netlify Functions default `cmh` (US East, Ohio); EU regions (`dub`/`fra`/`lhr`/`cdg`/`mxp`) are **Pro/Enterprise, project-wide** [R27]. Turso DB residency **unverified**. A European S3 Region addresses storage at rest only — function region, DB residency, global CDN edges, sub-processors, testimonial-publication consent, retention/deletion across versions/replicas/caches all remain open [R2], [R28], [R29]. |
| Netlify-hosted-app compatibility | 6 MB buffered request/response (≈4.5 MB binary), 20 MB streamed, 60 s sync / 15 min background, 1024 MB, **non-configurable** [R27], [R55]. The existing 100 MiB video and 12 MiB assessment paths remain incompatible; direct-to-S3 upload (small authorize/finalize JSON) is the proposed remedy, but **no change is authorized**. CSP `connect-src 'self'` / `form-action 'self'` / `media-src 'self' blob:` currently block external upload/playback [R30]. |
| Backup / retention / deletion / access control | Versioning, replication, backups and CDN caches create extra copies; erasure must cover objects, versions, replicas, quarantine, caches and DB rows; SSE-S3/SSE-KMS (not SSE-C [R31]), least-privilege IAM, Block Public Access, TBAC, CloudTrail/CloudWatch and existing `activity_logs` audit. Object Lock/WORM can conflict with erasure — review required. |

**Recommendation for further approval: `eu-west-1` (Ireland)** — EU/EEA, deepest European service catalogue, GuardDuty endpoint, matching Netlify `dub` region, official Ireland egress example, **estimated** lowest/equal-lowest storage, not opt-in. **Alternative: `eu-central-1` (Frankfurt)** — EU/EEA, GuardDuty endpoint, Netlify `fra`, **estimated** slightly higher storage. `eu-west-3` is a third EU/EEA candidate. **No Region is approved.** Before selection: confirm Region-specific pricing, Malware Protection for S3 feature availability, Free Tier status, Netlify plan/function region, Turso residency and DPA/sub-processor review.

### 14.2 Malware-scanning options, costs and recommendation — **requires approval**

Three approaches evaluated before selection; **none selected or enabled**. All are async, need an upload-event trigger (S3 → EventBridge/SQS), a result handler correlating on bucket/key/versionId/ETag, a pending-upload state machine, private quarantine with deny-by-default/TBAC, fail-closed handling of failed/unavailable scans, manual review for false positives, promotion only after clean + validation, rejection/deletion, and lifecycle cleanup [R38], [R50], [R51], [R54].

| | **1. GuardDuty Malware Protection for S3** | **2. Self-managed ClamAV** | **3. Separately operated commercial scanner** |
|---|---|---|---|
| File types / size | All S3 formats; max **100 GB** object; password-protected/archives limits → `UNSUPPORTED` [R34], [R33]; SSE-C/client-side encryption/Glacier Flexible+Deep Archive/directory buckets unsupported [R31] | GPLv2 engine [R40]; PE/ELF/Mach-O, archives, Office/RTF/PDF/HTML [R41]; defaults `MaxFileSize` 100M, `MaxScanSize` 400M, 2 GB technical ceiling [R43] — **100 MiB videos exceed the default and need tuning** | In-account Sophos: up to **5 TB** [R45]; ClamAV variant 2 GB; external APIs (Cloudmersive) cap at 32 MB → unsuitable for 100 MiB video [R53] |
| Detection / sync | Automatic on PUT/POST/Copy/CompleteMultipartUpload, in-Region isolated no-internet VPC via PrivateLink [R9], [R32] | S3 event → SQS/EventBridge → ECS/Fargate/EC2 worker → GetObject → scan → callback/queue/DB | Real-time, scheduled, on-demand, on-access, API scans; SNS/SQS/EventBridge/webhooks; auto tag/delete/quarantine [R46], [R52] |
| Result communication | Default EventBridge bus + CloudWatch; optional `GuardDutyMalwareScanStatus` tag (enable before first upload, tagging cost, 10-tag cap) [R9], [R37], [R54] | Queue/callback/DB; DLQ + retries + idempotency | Vendor notifications, tags, quarantine, reports [R46] |
| Failed/unavailable | `COMPLETED`/`SKIPPED`/`FAILED`; results `NO_THREATS_FOUND`, `THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED` + reasons [R35]; **fail closed**, alert, reconcile | Worker down/stale signatures/timeout/OOM → fail closed, DLQ, alerts; signature DB via `freshclam` [R44] | Same; vendor SLA unverified |
| Quarantine until clean | **TBAC** bucket policy denies `GetObject` unless tag `NO_THREATS_FOUND` and restricts tag writes [R38] | IAM/bucket policy deny + app state machine | Vendor quarantine + app state machine |
| False positives | Manual-review queue (allow-listing **unverified**) | Hash allow-list + manual queue | Manual queue; multi-engine/CDR options |
| Complexity | Low infra; needs IAM role, prefix scope, EventBridge consumer, tagging/TBAC, reconciliation | **High**: container, signatures, patching, scaling, monitoring | Medium: vendor deployment/account, licence metering, DPA |
| Published fees | **$0.09/GB + $0.215/1,000 objects** (US East; Region rate **unverified**) [R16], [R24]; Free Tier **1,000 requests + 1 GB/month/account/Region**, on-demand scans, tagging, S3 API and EventBridge rule **excluded** [R39] | **No licence fee** (GPLv2) [R40]; compute/queues/logs/egress — **estimated** tens of $/month; packaged variant $0.025/vCPU-hour + ~$19–$47/mo AWS infra (**secondary, unverified**) [R46], [R47] | bucketAV Sophos **$0.20/GB + $0.025/vCPU-hour** [R46], [R47]; CSS PAYG **$99/month incl. 100 GB** then $0.80/GB [R52]; OPSWAT/Cloudmersive commercial pricing **not published → vendor quote required** [R53] |
| Regional / data processing | Endpoints in all 8 European Regions [R15]; scans **in the same Region** [R32]; feature availability **unverified** | Runs in chosen European Region/own account; `freshclam` egress; vendor telemetry **unverified** | Marketplace/Region availability, DPA, and whether data leaves the EEA **unverified**; external API export needs a separate transfer assessment [R28] |

**Three scenarios — explicit illustrative assumptions (given: stored / transferred monthly; object counts & average sizes are illustrative):**

| | A staging **2 GB / 10 GB** | B small production **25 GB / 200 GB** | C growth **250 GB / 2,000 GB** |
|---|---|---|---|
| Illustrative uploaded objects / avg size | **40 / 5 MB** | **500 / 8 MB** | **5,000 / 10 MB** |
| Bytes scanned (estimated) | 0.20 GB | 3.91 GB | 48.83 GB |
| **Scanning only — GuardDuty** | **~$0.03** (or ~$0.00 with Free Tier) | **~$0.46** (or ~$0.26) | **~$5.47** (or ~$5.16) |
| **Scanning only — ClamAV self-managed** | $0 licence + **estimated** tens of $/mo compute | same order | higher, **unverified** |
| **Scanning only — commercial in-account** | ~$0.04/GB + vCPU-hours + infra | ~$0.78/GB + vCPU-hours + infra | ~$9.77/GB + vCPU-hours + infra |
| **Scanning only — PAYG / external API** | ~$99/mo min / **vendor quote required** | same | same |

**Free allowances do not make production free** [R39], [R19], [R20], [R7]. **Recommendation for further approval: GuardDuty Malware Protection for S3**, scoped to a **quarantine-only prefix**, independent-feature mode, tagging enabled before first upload, TBAC deny-by-default, EventBridge reconciliation — lowest ops burden, strongest documented data residency, 100 GB ceiling far above the app's 100 MiB limit, modest cost at all three scenarios. **No scanner selected or enabled.** Alternative commercial options have published Marketplace prices but need a **vendor quote** for Region availability, DPA and contractual terms; external API scanners are **not recommended for private CVs**.

### 14.3 Administrator testimonial photo/video upload design — evaluation only

**No new endpoint, source file, dependency, env var, upload limit, middleware/CSP or media access-control change was made.** The existing `POST /api/admin/cms/media` uses `guardMutation(request, ['owner','admin','editor'])` + `throttleCmsMutation` and buffers via `formData()`; 100 MiB video exceeds Netlify's 6 MB buffered ceiling [R27], [R30], [R55]. Proposed design (all items **requires approval**):

1. **Admin session / role / CSRF** — keep existing guards on the small authorize/finalize JSON calls.
2. **Server-authorized upload request** — admin-only authorize endpoint validates intent, returns short-lived scoped authorization; browser never gets AWS credentials [R11], [R12].
3. **CSPRNG server-generated keys** — `quarantine/<uuid>` → `public/testimonial-video/<uuid>.mp4`; browser filename is untrusted metadata only [R12], [R30].
4. **Short-lived restricted authorization** — presigned POST with short `expiration`, exact `bucket`/`key`, `success_action_status`, required SSE, checksum; URLs are **bearer tokens**, credentials expire with the session; optionally `s3:signatureAge` + network restriction [R11].
5. **Server-enforced size / permitted fields** — POST policy **`content-length-range`** (min>0, max = currently approved ceiling; **no limit change**), exact/prefix `Content-Type`, `Content-Disposition`, `Cache-Control`, `x-amz-meta-*`, signing fields [R12].
6. **Direct browser upload to private quarantine** — 4× Block Public Access, `Bucket owner enforced`, SSE-KMS/SSE-S3 (not SSE-C [R31]), deny-by-default bucket policy, scoped CORS [R10].
7. **Pending-upload row** — id, quarantine key, admin id, intended `purpose`, declared size/type, checksum, status, expiry; **schema change with its own migration approval**.
8. **Server verification** — `HeadObject`/`GetObject`: existence, **measured** size, SHA-256 / S3 SigV4 checksum, ETag/versionId, leading bytes [R11], [R13].
9. **MIME + magic-byte validation** — reuse `src/lib/files/signatures.ts` (MP4 `ftyp` @ offset 4, WebM `1A 45 DF A3`) and `validate.ts` (`testimonial-video` mp4/webm); store detected vs declared MIME [R30].
10. **Malware-scan workflow** — quarantine-only protection; EventBridge `GuardDuty Malware Protection Object Scan Result` correlates and updates status; any non-clean result fails closed → alert/manual review [R32], [R35], [R54].
11. **Promotion only after validation AND clean scan** — server `CopyObject` to the public-media prefix with a new CSPRNG key, create `mediaAssets` (`visibility='public'`, correct `purpose`), mark `promoted` [R38].
12. **Rejection / deletion** — delete quarantine object (DELETE/CANCEL free [R18]), mark `rejected`, audit, generic error.
13. **Abandoned / incomplete multipart expiry** — `AbortIncompleteMultipartUpload` (AWS example 7 days) + quarantine TTL + reconciliation; parts are billed until aborted [R13], [R14].
14. **Rate limits / quotas / audit / cost controls** — keep `throttleCmsMutation`, add quotas/bytes-per-month caps, `activity_logs`, cost allocation tags, Budgets/Cost Anomaly Detection/CloudWatch; **budget alerts do not necessarily prevent charges** (Budgets refreshed up to 3×/day, 8–12 h lag) [R56].
15. **Strict public-media vs private-applicant-document separation** — three distinct buckets/prefixes (quarantine, public-media, private-CV); only public-media is a CDN origin; quarantine/private-CV never public, never in `/api/media/[...key]` (which filters `visibility='public'` [R30]).

**Presigned POST vs presigned PUT — official-document evaluation:** POST policy documents `content-length-range`, exact and `starts-with` conditions over key/bucket/Content-Type/Content-Disposition/Cache-Control/Content-Encoding/Expires/success actions/`x-amz-meta-*`/signing fields [R12]; AWS provides `createPresignedPost` [R58]. Presigned PUT grants time-limited single-object access, is a bearer token, expires with credentials, **overwrites same-key objects**, and supports SigV4 checksum headers [R11]; it has **no documented POST-policy `content-length-range`** (exact signed `Content-Length` is possible but strict; **unverified** in this scenario [R59]). **Recommendation (requires approval):** presigned POST for single-part uploads ≤ approved ceilings; presigned PUT **per part** for resumable multipart of large videos, with server-side part validation. **Server verification remains mandatory.** No official numeric POST Object maximum was verified from this sandbox (**unverified**). **CSP/CORS caveat:** direct external POST needs narrow CSP additions + S3 CORS; the user prohibited middleware/CSP/media-access-control changes in this task — **none made**, listed for approval.

### 14.4 Separate secure CV-upload workflow — evaluation only

**Preserved invariants (documented, code unchanged):** `POST /api/assessment` is the only public write endpoint; 12 MiB request ceiling before `formData()`, 60 KiB answers ceiling, honeypot, rate limits, Zod validation, consent against published policy versions, duplicate detection, idempotency, then **one transaction**; immutable `consent_records` snapshot (`termsVersion`, `privacyVersion`, `consentText`, `acceptedAt`, `ipHash`, `userAgent`); `assessments.submittedAt`; `assessment_attachments` `onDelete: restrict` both sides + unique `media_asset_id`; the **only** private-document route is `GET /api/admin/assessments/[id]/attachments/[attachmentId]` with `guardAssessmentRead()`, archived check, `assessment.attachment_downloaded` audit, `Content-Disposition: attachment`, `no-store`, `nosniff`, sandbox CSP, `same-origin`, `no-referrer`; `media_assets` stores private keys, detected MIME, checksum, `archivedAt`; public proxy filters `visibility='public'` [R30].

**Proposed two-phase design (no implementation):** (1) heavily rate-limited public authorize bound to a server-generated random draft/submission token and `purpose='cv'`, recording a pending row; (2) direct upload to **private-CV quarantine** with `content-length-range` at the existing 10 MiB document ceiling (**no limit change**), permitted PDF/DOCX `Content-Type`, exact key/bucket, SSE, short TTL — never a public bucket or CDN origin; (3) server verifies existence/measured size/checksum/actual bytes, `validate.ts` restricts `cv` to pdf/docx with magic bytes, scanner returns clean, TBAC denies reads until clean [R38]; (4) `POST /api/assessment` submits the validated payload + pending token (not file bytes) — the **single existing transaction** creates consent snapshot → assessment → children → private `media_assets` (`purpose='cv'`) → `assessment_attachments` → audit; **an unverified/unscanned/mismatched/expired CV must never produce a valid attachment**, and a not-clean scan rejects submission without creating the assessment row (**requires approval** — UX/behaviour decision); (5) consent records/timestamps unchanged and written at submission time; (6) incomplete/abandoned handling via quarantine TTL, `AbortIncompleteMultipartUpload`, single-use short-lived tokens and a reconciliation job [R13], [R14]; (7) admin-only downloads keep the existing route/guards/headers, with a short-lived presigned GET issued only after a clean scan check, never logging keys/URLs [R11], [R30]; (8) audit/retention/deletion runbooks covering object, versions, replicas, quarantine, caches and DB rows, preserving `archivedAt` and `onDelete: restrict`.

**Explicit non-goals:** no public media endpoint exposure for CVs; no weakened submission validation (Zod/honeypot/rate limits/duplicate detection/idempotency/consent all remain); **no unverified CV treated as valid**; no `storageKey` to a public client; no public ACL/policy/CDN origin for private CVs or quarantine.

**Proposed changes needing separate approval (identification only, none performed):** a new public authorize endpoint, a finalize/confirm path, a changed `POST /api/assessment` contract accepting a pending token instead of multipart bytes; a new `pending_uploads` table and scan-status columns on `media_assets` (plus a possible `s3` value for `storageProvider`, currently `blobs`/`local`); a new Drizzle migration `0001_*` + `_journal.json` entry (baseline 33 tables / 61 indexes / 47 FKs / one `0000_init`); AWS SDK dependencies; new env vars (Region/bucket/role/KMS/TTL/allowed origins) via secure Netlify env with Functions scope [R27]; S3 CORS/lifecycle/bucket policies; EventBridge rule + consumer; narrow CSP/CORS additions. **No DB connection, inspection, migration, source change or dependency addition occurred.**

### 14.5 Secure delivery of validated public testimonial videos — evaluation only

**documented** — CloudFront **OAC** is AWS's recommended way to keep an S3 origin private, works in all Regions including opt-in, supports SSE-KMS and dynamic PUT/DELETE, requires `Bucket owner enforced`, and cannot be used with an S3 website endpoint [R57]. CloudFront supports **Range GETs** (S3 supports Range GETs), caches byte ranges, and streams after the first byte — enabling `<video>` seeking [R25], [R26]. Invalidation: 1,000 free paths/month then $0.005/path [R21].

**Proposed design (requires approval; no middleware/CSP/media-access-control change made):** (1) a **dedicated public-media origin** bucket/prefix containing **only** promoted, validated, clean, published objects, private behind OAC with all four Block Public Access settings on [R10], [R57]; quarantine and private-CV buckets/prefixes are **never** CDN origins, never granted to OAC, never reachable via wildcard path patterns; (2) publication gate = `mediaAssets` (`visibility='public'`, `archivedAt IS NULL`, detected `video/mp4`/`video/webm`), CSPRNG keys, no listing; (3) Range/seeking enabled; (4) `Cache-Control: public, max-age=31536000, immutable` on immutable keys, publish new keys instead of overwriting, exact-path invalidation on removal, safe unpublish = mark `archivedAt` + invalidate + delete object/versions + audit + verify — **edge caches persist until TTL/invalidation completes** (GDPR erasure caveat); (5) serve **server-detected** `Content-Type`, `inline` or `attachment` `Content-Disposition`, `nosniff`, restrictive response CSP, CORS only if the player requires it; (6) **CSP:** current `media-src 'self' blob:` / `connect-src 'self'` blocks an external CDN [R30]; a narrow approved `media-src` addition (and `connect-src` only if the player fetches ranges via JS) is needed — **not made in this task**; (7) **keep the existing `/api/media/[...key]` proxy for small assets** because it enforces `visibility='public'`, detected MIME, `nosniff`, sandbox CSP and immutable caching [R30]; it buffers `Uint8Array` → `ArrayBuffer` and is bounded by the 6 MB/20 MB ceilings, so **100 MiB videos must use the CDN path** [R27]; any proxy removal/invalidation must be staged, verified and separately approved; (8) **consequences of intentionally public testimonial videos** — world-readable URLs, search-engine/third-party caching, erasure cannot be guaranteed, personal data (likeness/voice) needs its **own documented consent**, bandwidth/hotlinking/bot cost, WAF/bot controls and monitoring — quarantine, pending uploads and private CVs must never be reachable through this path.

### 14.6 Consolidated cost table, hidden charges and controls — **estimated**

Rates are from §14.1 and §12.6.1; all figures USD/month, rounded, **estimated**, not a quote/bill. Assumptions: ~3 writes + ~4 reads per uploaded object + 20 reads per delivered GB; illustrative private/admin egress 0.1 / 2 / 20 GB; 1 TB CDN egress free; CloudFront origin fetch free [R7]; Netlify/Turso/Support/tax/Marketplace/optional replication **excluded — unverified**.

| Cost line | A staging | B small production | C growth |
|---|---|---|---|
| S3 storage | ~$0.05 | ~$0.58 | ~$5.75 |
| S3 PUT/POST/COPY/LIST | ~$0.001 | ~$0.01 | ~$0.08 |
| S3 GET/other | <~$0.001 | ~$0.002 | ~$0.02 |
| S3 → CloudFront origin fetch | $0 | $0 | $0 |
| S3 direct egress (private/admin downloads) | ~$0.01 | ~$0.18 | ~$1.80 |
| S3 replication/backup | not modelled | not modelled | not modelled |
| S3 retrieval/lifecycle/tagging | small, **unverified** | small, **unverified** | small, **unverified** |
| **Malware scanning (separate)** — GuardDuty | **~$0.03** (or ~$0.00 w/ Free Tier) | **~$0.46** (or ~$0.26) | **~$5.47** (or ~$5.16) |
| **Malware scanning (separate)** — ClamAV / commercial / PAYG | $0 licence + **estimated** tens of $/mo compute | ~$0.04–$0.78/GB + vCPU + infra, or ~$99/mo min | ~$9.77/GB + vCPU + infra, or ~$99/mo min / **vendor quote** |
| EventBridge / SQS / Lambda orchestration | <~$0.01 | <~$0.01 | ~$0.02 |
| CloudFront egress (Europe group) | $0 | $0 | ~$85 |
| CloudFront egress (Nigeria/Africa group) | $0 | $0 | ~$110 |
| CloudFront HTTPS requests / invalidation | $0 | $0 | $0 (≤1,000 paths); **~$20 in the illustrative 5,000-path case included in the totals below** |
| Separately operated scanning infra | not in GuardDuty variant; **estimated** tens of $/mo for ClamAV/commercial | same | higher, **unverified** |
| Netlify / Turso / Support / tax | excluded — **unverified** | excluded — **unverified** | excluded — **unverified** |
| **Illustrative total (GuardDuty + CloudFront, EU edge)** | **~$0.08** | **~$1.2** | **~$118** |
| **Illustrative total (GuardDuty + CloudFront, Nigeria/Africa edge)** | **~$0.08** | **~$1.2** | **~$143** |

**Arithmetic note (estimated):** scenario C totals include the illustrative 5,000-path invalidation case (~$20) and 1,000 GB of egress above the 1 TB free tier; **without** the invalidation case the corresponding totals are **~$98 (EU edge)** and **~$123 (Nigeria/Africa edge)**. Totals are rounded order-of-magnitude illustrations, not precise bills.

**Unexpected-charge sources:** incomplete multipart parts [R13], [R14]; protecting both quarantine and public prefixes / `CopyObject` promotion causing double scans and version scans [R9], [R31]; GuardDuty on-demand scans, S3 tagging, S3 API calls and the EventBridge managed rule excluded from Free Tier [R39]; abandoned quarantine objects; presigned-URL abuse/repeat use and same-key overwrite [R11]; Range/seeking request amplification, cache misses, invalidations >1,000/month, hotlinking/bots, and the higher Nigeria/Africa price group [R7], [R21]; versioning/replication/backup storage + cross-Region transfer + requests [R18]; storage-class minimums and retrieval fees [R18]; KMS/CloudWatch/CloudTrail data events/Lambda/WAF; Free Tier/credit expiry [R20].

**Recommended controls (requires approval; none configured):** AWS Budgets actual+forecast alerts, Cost Anomaly Detection, CloudWatch alarms, cost-allocation tags, monthly usage review [R56]; per-admin/per-applicant upload quotas, `content-length-range` size caps, pending-upload/bytes-per-month caps [R12]; quarantine TTL, `AbortIncompleteMultipartUpload`, noncurrent-version expiration, reconciliation [R13], [R14]; immutable keys + long cache TTL, minimal invalidation, scoped OAC, WAF/bot controls. **Explicitly: budget alerts do not necessarily prevent charges** — Budgets data is refreshed up to three times daily, typically 8–12 hours apart; they provide tracking, notifications and configurable actions, not a real-time hard spend cap, and cannot undo charges already incurred [R56].

### 14.7 Data protection, security and operational risks (summary)

| Risk | Status |
|---|---|
| European Region ≠ GDPR compliance | **documented** [R28], [R2] — function region, Turso residency, global CDN edges, sub-processors, consent, retention/deletion all remain |
| Private CV or quarantine exposure | Design forbids it (separate buckets, deny-by-default/TBAC, no CDN origin, public proxy `visibility='public'` filter) [R10], [R30], [R38]; **unverified** until a hosted staging test |
| 100 MiB video / 12 MiB assessment vs 6 MB Netlify ceiling | **documented** unresolved blocker [R27], [R30], [R55]; direct-to-S3 design proposed but **requires approval**, no limit change made |
| CSP blocks external upload/playback | **documented** [R30]; CSP/CORS changes **requires approval**, not made |
| Scanner failure, `UNSUPPORTED`/password-protected CVs, false positives | **documented** statuses [R35]; fail-closed + manual review designed; behaviour **unverified** |
| ClamAV default 100 MB `MaxFileSize` below 100 MiB video | **documented** [R43]; must be tuned/tested if that option is chosen |
| SSE-C / client-side encryption incompatibility with GuardDuty | **documented** [R31] |
| Presigned URL bearer-token/overwrite/size gaps | **documented** [R11], [R12]; POST policy recommended, server verification mandatory |
| Budget alerts / free allowances assumed to cap cost | **documented** not a hard cap [R56]; allowances do not make production free [R39], [R20] |
| Public testimonial video erasure / consent / hotlinking | **documented** consequence of intentional publication; needs separate consent + erasure runbook |
| Region-specific pricing/feature availability, vendor quotes, latency, Turso/Netlify plans, hosted behaviour | **unverified** (§12.8) |
| Staging/deploy/Git/production actions | **not authorized**; no action taken |

### 14.8 Staging-access checklist preserved and blockers (unchanged)

**Preserved unchanged:** §13.2 (staging-access checklist) and §13.3 (precise staging-deployment checklist), plus the §11.6 summary in the Phase 8 report. All secrets via supported secure interfaces only; document identifiers, never values; confirm every resource is **separate from production**; do not guess identifiers or substitute production values.

**Still blocked:** all twelve staging-related environment names `not set`; Netlify/Turso connectors `unsupported`; no AWS/Netlify/Turso access, staging site/DB IDs, deploy authorization, staging-only secrets, secure secret-injection channel, separation-from-production confirmation, function/edge logs, hosted build, migration, or admin provisioning; `GH_TOKEN`/`GITHUB_TOKEN` are **not** staging credentials; deploy/build hosts unreachable from this sandbox. **No staging deploy until** staging-only access via a supported secure interface **and** written separation-from-production confirmation exist. No staging resources, migrations, administrator, deployment or Git operation occurred; production actions remain prohibited.

### 14.9 Uncertainties and exact approvals

**Uncertainties (unverified):** Region-specific S3/GuardDuty rate tables; Malware Protection for S3 feature availability per Region and opt-in enablement; Free Tier/credit status; presigned PUT signed-`Content-Length` enforcement and numeric POST Object maximum; Netlify plan/EU function region/hosted Deno behaviour; Turso residency; audience geography/latency; commercial vendor quotes/DPA/Region availability; scanning of password-protected files and allow-listing; CloudFront flat-rate allowance terms; hosted CSP/CORS behaviour; real object counts/sizes/request amplification; small-asset proxy coexistence; token-based assessment flow and migration shape; all hosted/staging behaviour (no live AWS test permitted). Full list: `docs/PHASE-8-REPORT.md` **§12.8**.

**Exact approvals (each separate, explicit, written; none granted):** (1) European Region selection; (2) malware-scanning approach and cost; (3) cost disclosure + billing approval **before any spend**; (4) S3 storage architecture (buckets/prefixes, IAM, KMS, Block Public Access, CORS, lifecycle, quarantine TTL, TBAC, EventBridge consumer, new endpoints, `pending_uploads` + **own migration approval**, new dependencies); (5) assessment API / CV workflow changes incl. rejection-on-unclean-CV behaviour and schema/migration; (6) public-media origin / CDN / CSP / proxy design plus explicit acknowledgement that published testimonial videos are intentionally public; (7) new env vars/credentials via secure interfaces; (8) any upload-limit change (**none approved**); (9) budgets/alerts/quotas/lifecycle/tagging/monitoring, acknowledging alerts do not prevent charges; (10) GDPR/data-protection package (DPA, sub-processors, transfer assessment, privacy notice, publication consent, retention/deletion, records/DPIA); (11) staging resource creation + deployment with written separation confirmation; (12) staging read-only schema inspection then a **separate** non-destructive migration approval; (13) staging-only admin provisioning if needed; (14) hosted verification; (15) **GitHub commit/push only after successful staging verification AND a separate explicit approval**; (16) production remains prohibited. Full list: **§12.9**.

### 14.10 Official references and stop point

Official AWS, Netlify, ClamAV and vendor-published sources R1–R59 are enumerated with takeaways in `docs/PHASE-8-REPORT.md` **§12.10** (AWS Region codes, EU data protection/GDPR Center/HDS, S3 pricing/POST policy/presigned URLs/multipart/lifecycle/Block Public Access, GuardDuty pricing/regions/quotas/capabilities/TBAC/EventBridge, CloudFront pricing/Range/OAC/invalidation, AWS Budgets, Netlify Functions configuration, ClamAV docs, AWS Marketplace scanner listings, SQS/Lambda/EventBridge pricing). **Secondary/estimated** rate sources are explicitly labelled [R23], [R46], [R47], [R53], [R59].

**Stop point:** after this documentation and `docs/PHASE-8-REPORT.md` §12. **Do not** claim the architecture is implemented or tested, that staging is verified, or that Phase 8 is complete. Await explicit approval before implementation, purchases, resource creation, migrations, deployment, or Git operations. No production action occurred or is authorized. `.data/local.db` and `.data/secret-markers.json` remain untouched.

### 14.11 Repository preservation verification — before and after

| Check | Before this task | After this task |
|---|---|---|
| Branch / HEAD | `arena/cdcb43ad-immi-website` / `bc53028b18b4ad9f8f2391b816a872973cbae457` | unchanged |
| Tracked / untracked (exact) / staged / modified | 1 / 283 / 0 / 0 | 1 / 283 / 0 / 0 |
| `git status --porcelain` | 15 collapsed entries | 15 collapsed entries (not the exact count) |
| `.data/local.db` SHA-256 | `7c16c81cc383ae5832c16e02e364f1ed2a15debdcb8edce5bf331aa4df548ff3` | identical |
| `.data/secret-markers.json` SHA-256 | `2e5688ef56d38b4cb1932fe9980ed600041fa415addeccb7800baca5bdee47d0` | identical |
| `docs/PHASE-8-REPORT.md` / `docs/DEPLOYMENT.md` lines | 914 / 266 | 1394 / 449 |
| Appendix A inventory | exact 283/283 | exact 283/283 (5 fenced blocks, 0 missing / extra / duplicates) |
| Trailing whitespace / tabs / control chars / secret-value patterns | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Files modified in the last 25 minutes | — | exactly 2: the two docs above |
| Official references | §12.10 (report) | 59 defined, 59 used, 0 undefined / unused |
| §12 / §14 evaluation sections | absent | present |
| Staging verification / Phase 8 completion | not verified / not complete | **not verified / not complete** |

**Parser caution:** use `git ls-files --others --exclude-standard` for the exact 283-path baseline, not `git status --porcelain` (15 collapsed entries); read **all five** Appendix A fenced blocks, and do not filter out root config paths. Full verification record: `docs/PHASE-8-REPORT.md` **§12.11**.

**No change** to any AWS account/bucket/IAM/paid service, application source, configuration, dependency, upload limit, schema, migration, middleware, CSP, media access control, environment variable, staging resource, administrator, deployment, production resource, or Git state. No secret value was printed, stored, or requested; no live AWS integration test was run; no cost was incurred. **Staging remains blocked and unverified; production remains prohibited; GitHub push requires successful staging verification plus a separate explicit approval.**

---

## 15. Final technical design refinement — single-request testimonial video uploads (5 November 2026)

> **Status: DESIGN AND DOCUMENTATION ONLY.** Appended after, and preserving in full, §§1–14 — especially the **staging-access checklist (§13.2)**, the **staging-deployment checklist (§13.3)**, the §14 Amazon S3 Europe evaluation, and the header status notes. **No implementation code, upload limit, AWS account/bucket/IAM role/infrastructure, purchased or enabled service, malware-scanning enablement, database schema or migration, Netlify/Turso resource, staging or production deployment, Git operation, administrator, or production resource was created or changed.** No secret value was printed, stored, or requested; no live AWS integration test was run. Full official evidence (R1–R59, F1–F24), the nine-step state machine, the worked cost figures, the 15-control mapping and the 25-test staging matrix are in `docs/PHASE-8-REPORT.md` **§13**.

### 15.0 Confirmed decisions, recommendation and supersession

**CONFIRMED (user):** administrator testimonial videos will **normally not exceed 100 MB per video**; design around that limit and **do not introduce multipart complexity unless technically necessary**. The enforceable ceiling used here is **100 MiB = 104,857,600 bytes**, matching `MAX_UPLOAD_BYTES.video = 100 * 1024 * 1024` (comment "100 MB — testimonial videos") in `src/lib/files/validate.ts` [R30], [F1]. **unresolved question:** if decimal 100 MB (100,000,000 bytes) was intended, confirm separately — **no limit was changed**.

**CONFIRMED, carried forward:** Amazon S3 / Europe (no Region approved); malware scanning evaluated before selection (recommendation only for approval); GitHub push only after successful staging verification **and** a separate explicit approval; **CV uploads kept separate**; CloudFront delivery from §14.5 retained; staging checklists remain blocked.

**RECOMMENDATION (requires approval):** a **single-request, direct-browser-to-S3 presigned POST** workflow; **multipart eliminated** for ≤100 MiB. Labels: **confirmed**, **recommended / requires approval**, **documented** (official source, §13.16 / §12.10), **estimated** (illustrative arithmetic), **unverified**, **unresolved question**. Cautions retained: a European Region alone does **not** guarantee GDPR compliance; free allowances do **not** make production free; **budget alerts do not necessarily prevent charges**; scanning costs kept separate.

**Supersession:** the earlier §14.3 / §12.3.2 suggestion of **presigned PUT per part for resumable multipart of 100 MiB videos is superseded** by the confirmed decision and §15.8 evidence. §§12–14 are preserved verbatim as the historical record; this §15 is the refined design. `AbortIncompleteMultipartUpload` is **not required** for the single-request video path.

### 15.1 Final architecture and endpoint sequence (proposals only)

| # | Actor → endpoint / service | Action | State |
|---|---|---|---|
| 1 | Admin CMS → `POST /api/admin/cms/media/upload-authorize` (proposed) | Small JSON (`purpose='testimonial-video'`, declared MIME/size hint, optional SHA-256). Keep `guardMutation(['owner','admin','editor'])`, CSRF, `throttleCmsMutation`; browser size hint is **advisory only** | `initiated` |
| 2 | Server | Generate **CSPRNG** key `quarantine/testimonial-video/<uuid>.bin`; create `pending_uploads` row (id, key, bucket, admin, purpose, expected digest, `expires_at`, status, `consumed_at`) — **schema change with own migration approval** | `initiated` |
| 3 | Server → response | Sign short-lived presigned POST with §15.3 conditions; return `{ uploadId, url, fields }` **only** — no AWS secret, access key or permanent credential; log `uploadId` + expiry, never signed fields | `initiated` |
| 4 | Browser → S3 (direct `fetch`/`FormData` POST) | All returned fields + `Content-Type` + checksum fields + `file` **last** [F2]; S3 validates the signed policy **before** writing; oversize → `EntityTooLarge`. **Bytes never pass through a Netlify Function** (6 MB buffered / ≈4.5 MB binary ceiling [R27], [R55]) | object created |
| 5 | Browser → `POST /api/admin/cms/media/upload-finalize` (proposed) | Small JSON `uploadId`; single-use compare-and-set; `HeadObject` (existence, **measured** `ContentLength`, ETag, VersionId, `ContentType`, SSE, checksum); small `Range GET` for magic bytes; `detectFileType()` + `testimonial-video` policy [R30] | `uploaded → validating → verified` or `rejected` |
| 6 | S3 → GuardDuty (quarantine prefix only) | Automatic scan on **POST Object** [F3]; result on default EventBridge bus; optional pre-enabled tagging | `scanning` |
| 7 | EventBridge consumer (proposed) | Correlate on bucket + key + versionId + eTag, **dedupe at-least-once delivery** [F3]; only `Completed`+`NO_THREATS_FOUND` → `clean`; else `rejected` + manual review | `clean` / `rejected` |
| 8 | Server (proposed promotion handler) | Only when `verified AND clean`: `CopyObject` from the **verified versionId** to a new CSPRNG key in **public-media**; create `mediaAssets` (`visibility='public'`, detected MIME, size, checksum); `activity_logs`; mark `promoted`. **Promotion is the only writer to the public origin** | `promoted` |
| 9 | Viewer → CloudFront | OAC serves only published, verified objects (§15.10); quarantine / private-CV never CDN origins | published |

**All proposed endpoints are documentation only — none exists.** No new endpoint, dependency, env var, schema, migration, CSP or media access-control change was made.

### 15.2 Security controls — two or more independent enforcement layers

| Restriction | S3 POST policy | Server | Bucket / platform |
|---|---|---|---|
| **100 MiB ceiling** | `["content-length-range", 1, 104857600]`; S3 rejects oversize **before** write [R12], [F4], [F18] | `HeadObject.ContentLength <= 104857600`, else reject + delete [F5]; strong read-after-write consistency [F19] | `MAX_UPLOAD_BYTES.video` **unchanged** [R30] |
| Exact key / no arbitrary keys | `{"key": "<CSPRNG key>"}` exact + `{"bucket": ...}` exact; **never** `${filename}` [F4], [F2], [F6] | Finalize looks up key by `uploadId`; client never supplies a key | Bucket policy denies writes outside quarantine prefix |
| Approved formats | Exact `Content-Type` = `video/mp4` or `video/webm` [F4] | Magic bytes: MP4 `ftyp` @ offset 4, WebM `1A 45 DF A3`; `validate.ts` `testimonial-video` allows only mp4/webm; reject declared ≠ detected [R30] | Store canonical `.mp4`/`.webm`, never the uploaded filename |
| Real file signatures | POST policy cannot inspect bytes | Small `Range GET` of leading bytes; independent of extension/MIME [R30] | `nosniff`, server-detected `Content-Type` |
| Integrity | `x-amz-checksum-algorithm: SHA256` + exact `x-amz-checksum-sha256` condition; S3 rejects `BadDigest` [F7], [F8] | `HeadObject` with `x-amz-checksum-mode: ENABLED` → compare `ChecksumSHA256` to stored digest [F5], [F9] | Optional server streaming hash (§15.6) |
| No unauthorized overwrite | Exact key; one key per authorization | Single-use state; reject if >1 version; bind ETag/VersionId; promote only that version [F10], [F11] | Versioning; `s3:signatureAge` deny [F11]; `If-None-Match` applies to **PutObject only, not POST** [F10] |
| Short-lived authorization | `expiration` (illustrative 300–600 s); exact SigV4 fields [R12], [R11] | `expires_at` check; reconciliation expires stale rows | Optional `s3:signatureAge` 600,000 ms deny; POST applicability **unverified** |
| Private quarantine | `acl` absent/`private`; exact SSE (`AES256`/`aws:kms`, **not SSE-C** [R31]) | No `mediaAssets` row / public path until promotion | 4× Block Public Access, `Bucket owner enforced`, deny-by-default, TBAC deny-until-clean [R10], [R38] |
| No credentials in browser | Only `url` + `fields` returned [F12] | Server-side short-lived role credential via secure interface; **no secret in chat/docs** | Temporary credentials expire with session [R11] |
| No unscanned/rejected video public | — | Promotion gated on `verified AND clean` | OAC limited to public-media prefix only [R57]; TBAC [R38] |
| Cross-origin upload/playback | S3 CORS: site origin only, POST, restricted headers [F13] | — | Current CSP `connect-src 'self'` / `form-action 'self'` / `media-src 'self' blob:` blocks it [R30]; **narrow additions require approval, NOT made** |

**documented** — non-file form fields + boundaries ≤20 KB, `file` must be last, one file per POST [F2]. **unverified** — whether `content-length-range` counts file bytes alone or the whole form body; safe either way because the policy maximum is exactly 104,857,600 bytes and the independent server `HeadObject` check always guarantees no object >100 MiB. **Do not rely on browser-side validation alone.**

### 15.3 Does presigned POST support all required restrictions? — **YES (documented)**

Official POST Policy [F4], [R12]: always `expiration` + `conditions`; `{"key": "<exact>"}` exact match; `["content-length-range", min, max]` in **bytes** (official example 1–10 MiB); exact or `starts-with` `Content-Type` (comma-separated lists allowed); `bucket` **exact only**; `Cache-Control`/`Content-Type`/`Content-Disposition`/`Content-Encoding`/`Expires`, `success_action_status`, `x-amz-algorithm`/`credential`/`date`/`security-token`, `x-amz-meta-*`, `x-amz-*` bound by exact conditions. Illustrative policy in **§13.3** (not code, not deployed) uses `success_action_status: 204` to avoid a redirect that appends bucket/key/ETag [F2]. `createPresignedPost` supports `Conditions`/`Fields`/`Expires` [R58], [F15]; any new SDK dependency **requires approval**.

**5 GB question from §12.8 resolved:** official S3 FAQ says a single PUT can upload up to **5 GB** (objects up to 50 TB) [F16]; an S3-compatible implementation documents the POST ceiling as 5 GB [F14], [F17]. **100 MiB ≈ 1.95% of 5 GiB**, far inside the single-request limit. Exact `content-length-range` byte semantics remain **unverified**.

### 15.4 Is the 100 MiB limit reliably enforceable? — **YES (documented / recommended)**

Two independent enforcement points: (1) `content-length-range` max **104,857,600 bytes** enforced by S3 **before** the object exists (`EntityTooLarge`) [F4], [F18]; (2) server reads **measured** `HeadObject.ContentLength`, rejects/deletes otherwise [F5], with strong read-after-write consistency making verification immediate [F19]. The 100 MiB body never enters a Netlify Function (6 MB buffered ceiling), so nothing can truncate or bypass the check [R27], [R55]. Failure mode is **fail-closed**: if form overhead is included in the range, a file at exactly 100 MiB is conservatively rejected; no oversized object is ever stored. Browser size hints are advisory only. **unverified** — exact boundary behaviour must be tested in staging (V1–V3). **No upload limit was changed.**

### 15.5 Presigned PUT — weaker on size (documented)

| | Presigned **POST** (recommended) | Presigned **PUT** (rejected here) |
|---|---|---|
| Size | `content-length-range` min/max enforced by S3 before write [F4] | **No size range**; plain PUT accepts any body up to the 5 GB service ceiling; only an **exact** signed `Content-Length` can be pinned (**unverified** behaviour) [F18], [F20] |
| Content type | Exact or prefix conditions [F4] | Exact signed header only [F20] |
| Overwrite protection | `If-None-Match: *` is documented for **PutObject / CompleteMultipartUpload / CopyObject — not POST Object** [F10], [F21] | `If-None-Match: *` available [F10] |
| Reuse / overwrite | Bearer token reusable until expiry [F11] | Reusable; same-key object **replaced** [F11] |
| Integrity | POST Object checksum form fields [F7] | SigV4 checksum headers [R11], [F8] |

**Conclusion (requires approval):** PUT is **weaker on size** and equally reusable/overwriting; its `If-None-Match` advantage is unnecessary because the POST design compensates with CSPRNG keys, exact `key` conditions, versioning + single-version checks, a single-use pending state machine, ETag/VersionId binding, and a deny-by-default private quarantine with TBAC. **Use presigned POST; do not use presigned PUT for testimonial videos.**

### 15.6 Completion verification and authorization-token reuse (documented problem / recommended controls)

**documented:** S3 states presigned URLs/policies can be used **multiple times until expiry** and an existing same-key object is **replaced**; they are **bearer tokens with no built-in single-use enforcement** [F11], [R11]. AWS recommends short expiries, `s3:signatureAge`, network restrictions and app-level state [R11], [F22].

**recommended / requires approval:** finalize with `uploadId` only → `HeadObject` (existence, measured size, ETag, VersionId, ContentType, SSE, StorageClass, checksum mode) [F5], [F9] + small `Range GET` magic bytes [R30]; atomic single-use `pending_uploads.status` compare-and-set (`initiated→uploaded→validating→verified→scanning→clean→promoted`, or `rejected`/`expired`) with `consumed_at`; versioning + `ListObjectVersions` >1 → reject; `CopyObject` from the **specific verified versionId**; ETag change after verification invalidates; illustrative 300–600 s expiry mirrored in `expires_at`; optional `s3:signatureAge` 600,000 ms deny (**POST applicability unverified**); log only `uploadId` + expiry, never signed URLs/fields; `success_action_status: 204`; dedupe **at-least-once** GuardDuty results (billed once) [F3]; last-resort credential rotation [R11].

**Integrity (documented):** POST Object supports `x-amz-checksum-algorithm` (CRC32/CRC32C/SHA1/SHA256) + `x-amz-checksum-sha256` form field (base64 256-bit digest), returns `x-amz-checksum-sha256` and `x-amz-version-id`; `HeadObject` exposes the stored checksum with checksum mode enabled [F7], [F8], [F5]. **unresolved question / requires approval:** computing SHA-256 of 100 MiB in the browser needs a ~100 MiB `ArrayBuffer` or an incremental hashing library (new dependency); alternatives are a server-side streaming hash (extra S3→function egress) or S3 stored checksum + ETag/VersionId binding. **No code/dependency added.**

### 15.7 GuardDuty integration and failure handling

**documented:** GuardDuty's how-it-works page confirms **POST Object is a default scan trigger** alongside PutObject/CopyObject/CompleteMultipartUpload — multipart is **not** needed for scanning [F3], [R9]. GuardDuty runs in an isolated no-internet VPC **in the same Region** via PrivateLink [F3], [R32].

**recommended / requires approval:** enable as an **independent feature** (no detector ID; rely on EventBridge scan-result events) [R8]; scope protection to the **quarantine prefix only** (≤5 prefixes) so `CopyObject` promotion does not trigger a second scan or double billing [R9], [R31]; same Region/account only [R8]; dedicated least-privilege IAM role; SSE-S3/SSE-KMS (**SSE-C unsupported** → `ACCESS_DENIED` [R31], [F23]); 100 MiB ≪ 100 GB object limit [R33]; enable `GuardDutyMalwareScanStatus` tagging **before first upload** (tagging cost, 10-tag limit) [R9], [R37], [F3]; **TBAC** deny `GetObject` unless `NO_THREATS_FOUND` [R38]; EventBridge correlation on bucket/key/versionId/eTag with duplicate handling [R32], [R54], [F3]; a reconciliation job that fails closed on missing results/timeouts. **Scanner not selected or enabled.**

**Failure handling — all fail closed (recommended / requires approval):** no failed, rejected, expired or suspicious object becomes public; every branch keeps it private, writes `activity_logs`, and shows a generic admin error.

| Outcome | Action |
|---|---|
| `THREATS_FOUND` (`Completed`) | `rejected`; alert; manual review; never promote; delete per **approved** retention |
| `UNSUPPORTED` (`Skipped`; `PASSWORD_PROTECTED`, `OBJECT_SIZE_LIMIT_EXCEEDED`, `UNSUPPORTED_STORAGE_CLASS`, `EXTRACTED_*` limits) | `rejected`; **never treated as clean**; admin told the file could not be scanned |
| `ACCESS_DENIED` (`Skipped`; `UNAUTHORIZED_TO_GET_OBJECT`, `UNAUTHORIZED_TO_ASSUME_ROLE`, `SSE_C_ENCRYPTED_OBJECT`, `OBJECT_E_TAG_CHANGED`, `BUCKET_NOT_FOUND`) | `rejected`; alert operations to fix IAM/KMS/encryption; `OBJECT_E_TAG_CHANGED` also triggers the replay check |
| `FAILED` (`Failed`) | `rejected`; alert; fail closed; optional manual on-demand rescan (**excluded from Free Tier** [R39]) |
| No result / timeout / GuardDuty unavailable | `expired`/`rejected`; alert; keep private; no promotion |
| Oversize / wrong type / signature / checksum mismatch / ETag or version changed / expired policy / duplicate replay | `rejected` or `expired`; immediate delete; generic error |
| CORS/CSP/network failure | Row expires via reconciliation; no object |
| Admin retry | **New** `uploadId`, **new** CSPRNG key, **new** policy; never reuse |

Full statuses and `statusReasons`: [F23], [R35]. **requires approval:** quarantine retention window, manual-review workflow, alert routing and deletion runbook. **No retention policy is approved.**

### 15.8 Abandoned uploads and the multipart decision — **multipart eliminated**

**Single-request POST creates no multipart parts:** a POST either creates a complete object or nothing. **`AbortIncompleteMultipartUpload` is NOT required** for this path (retain only as defence-in-depth for any other multipart path) [R13], [R14]. Cleanup: pending rows expire via reconciliation; orphan quarantine objects are deleted by an **S3 Lifecycle `Expiration` rule scoped to the quarantine prefix** (rules apply to existing and new objects; **a bucket policy cannot prevent lifecycle deletions**; billing stops at eligibility even though deletion is queued) [F24]; rejected objects are deleted immediately (DELETE/CANCEL free [R18]); `NoncurrentVersionExpiration` handles replay versions. **requires approval:** exact TTL, reconciliation schedule, deletion audit format. **unverified:** lifecycle timing and versioning/TBAC interaction in the hosted environment.

**Multipart — NO, not technically necessary (documented):**

1. Official S3 FAQ: "The largest object that can be uploaded in a single PUT is **5 GB**" (objects up to 50 TB) [F16]; POST ceiling documented at 5 GB [F14], [F17]. **100 MiB = 104,857,600 B ≈ 1.95% of 5 GiB.**
2. The same FAQ: "For objects larger than 100 MB, customers **should consider** using the multipart upload capability" — **advisory** for throughput/retry, **not a requirement** [F16]. 100 MiB (≈104.86 MB decimal) is marginally above that advisory threshold; the trade-off is stated explicitly.
3. GuardDuty scans POST Object directly [F3]; Netlify's 6 MB ceiling applies to functions, not direct browser→S3 [R27].

**CONFIRMED DECISION + RECOMMENDATION:** **explicitly recommend single-request presigned POST; eliminate multipart for testimonial videos ≤100 MiB.** **Accepted trade-off (unverified):** no pause/resume — an interrupted 100 MiB upload over a high-latency West-African link needs a new authorization, new key and full re-upload; failure rates are **unverified** until staging test V24. Multipart would add per-part presigned PUTs, part validation, `CreateMultipartUpload`/`CompleteMultipartUpload` handshake, `AbortIncompleteMultipartUpload`, non-MD5 ETag semantics, ~15 S3 requests instead of ~4–6, no whole-object `content-length-range`, and an extra scan on completion. Adopting it would be **a separate explicit approval** only if V24 measurements demand it. **This supersedes §14.3 / §12.3.2.**

### 15.9 CV uploads remain separate (confirmed)

**CONFIRMED:** do **not** combine testimonial-video uploads with applicant CV uploads; the §15.1 design is **not** reused for CVs. Preserved from §14.4 / §12.4: separate quarantine/keys/bucket/IAM/pending records; **existing 10 MiB CV limit unchanged** unless separately approved (`MAX_SUBMISSION_REQUEST_BYTES = 12 MiB` unchanged [R30]); **independent validation** (`cv` → pdf/docx, magic bytes) and **independent malware scanning** with the same fail-closed rules; **association only after successful verification** inside the existing single `POST /api/assessment` transaction (honeypot, rate limits, Zod, consent against published versions, duplicate detection, idempotency) — an unverified/unscanned/expired CV must never produce a valid `assessment_attachments` row; immutable `consent_records` snapshot (`termsVersion`, `privacyVersion`, `consentText`, `acceptedAt`, `ipHash`, `userAgent`), `submittedAt`, `onDelete: restrict`, private keys never public, and the **admin-only** attachment download (`guardAssessmentRead`, audit, `Content-Disposition: attachment`, `no-store`, `nosniff`, sandbox CSP, `same-origin`, `no-referrer`) [R30]. **No schema/migration/API change made or approved for either path.**

### 15.10 CloudFront delivery — retained (confirmed)

**CONFIRMED:** retain §14.5 / §12.5. **recommended / requires approval:** **OAC** on a dedicated public-media bucket/prefix containing **only** promoted, verified, clean, published objects (4× Block Public Access, `Bucket owner enforced`, never an S3 website endpoint) [R57], [R10]; access gated by `mediaAssets` (`visibility='public'`, `archivedAt IS NULL`, server-detected `video/mp4`/`video/webm`), CSPRNG immutable keys, promotion as the **only** writer; **no access to quarantine or private-CV** (separate buckets/IAM, no wildcard behaviours, TBAC deny-until-clean [R38], public proxy `visibility='public'` filter [R30]); **HTTP Range GET** support for seeking on 100 MiB files [R25], [R26]; `Cache-Control: public, max-age=31536000, immutable`, server-detected `Content-Type`, `inline`/`attachment` `Content-Disposition`, `nosniff`, restrictive response CSP; **unpublish** = `archivedAt` + exact-path invalidation (1,000 free paths/month then $0.005/path [R21]) + delete object and all versions + verify cached copy unreachable + audit; **edge caches persist until TTL/invalidation** (GDPR erasure caveat); published videos are **intentionally public** (separate consent, erasure cannot be guaranteed). **CSP (requires approval, NOT changed):** current `media-src 'self' blob:` / `connect-src 'self'` blocks CDN playback and external POST; narrow additions are unapproved. **Small assets:** keep the existing `/api/media/[...key]` proxy (buffers `Uint8Array`→`ArrayBuffer`, bounded by 6 MB/20 MB); **100 MiB videos must use the CDN path** [R27], [R30].

### 15.11 Cost implications (estimated)

Rates from §14.6 / §12.6.1; S3 storage/request rates are **unverified** secondary estimates, GuardDuty rates are the documented **US East** example (Region-specific rates **unverified**), CloudFront rates **documented** [R16], [R23], [R7]. Netlify/Turso/Support/tax/Marketplace/replication **excluded — unverified**. All figures rounded, not a bill.

| Line | Per 100 MiB video | Note |
|---|---|---|
| S3 storage (quarantine + promoted ≈0.195 GiB) | ~$0.0045/month | $0.023/GB-month estimated; both copies until cleanup |
| S3 requests (POST + HeadObject + Range GET + CopyObject + tag + delete ≈6) | <~$0.001 | $0.005/1k writes, $0.0004/1k reads estimated; DELETE/CANCEL free [R18] |
| **GuardDuty scan (separate)** | **~$0.009/video** | 0.0977 GiB × $0.09/GB + $0.215/1,000 objects; 100 videos/mo ≈ **~$0.90**, 500/mo ≈ **~$4.50** |
| Tagging / S3 API / EventBridge managed rule | small, **unverified** | Excluded from GuardDuty Free Tier [R39] |
| CloudFront per 100 MiB play | $0 within 1 TB free; then ~$0.008 (EU) / ~$0.011 (Nigeria/Africa group) | Range/seeking multiplies requests [R7] |
| Invalidation | $0 ≤1,000 paths/month; $0.005/path after | [R21] |
| **Single-request vs multipart** | ~4–6 S3 requests instead of ~15; **no** `CompleteMultipartUpload`, **no** incomplete-part storage, **no** second scan | [R13], [F3], [F18] |

**Controls (requires approval):** budgets/alerts (**budget alerts do not necessarily prevent charges** [R56]), cost tags, per-admin quotas, `content-length-range` caps, quarantine Lifecycle expiration, noncurrent-version expiration, minimal invalidation, WAF/bot controls. **Free allowances do not make production free** [R39], [R20], [R7]. **No cost was incurred.**

### 15.12 Staging verification requirements (not performed — blocked)

**Gate (confirmed):** no staging/production deploy, no AWS resource creation, no service enablement, no migration, no Git operation, no administrator provisioning. The §13.2 staging-access checklist and §13.3 staging-deployment checklist are **preserved unchanged** and remain blocked: all twelve staging env names `not set`; Netlify/Turso connectors `unsupported`; no AWS/Netlify/Turso access, staging IDs, deploy auth, staging-only secrets, secure injection channel, separation-from-production confirmation, logs, hosted build, migration or admin provisioning [R30]. `GH_TOKEN`/`GITHUB_TOKEN` are not staging credentials. Production remains prohibited.

**Before any hosted test (requires approval, each separate):** separate staging AWS account/bucket(s)/IAM role/GuardDuty plan/CloudFront distribution with written separation confirmation; staging-only credentials through a secure interface; read-only staging schema inspection vs `drizzle/0000_init.sql` (33 tables / 61 indexes / 47 FKs, one `0000_init` [R30]); separate non-destructive migration approval; staging-only administrator with **synthetic data only**; one hosted build + function/edge log review.

**Verification matrix (all: NOT PERFORMED; full 25 tests V1–V25 in `docs/PHASE-8-REPORT.md` §13.14):** 100 MiB boundary (99 MiB accept / 100 MiB document / 100 MiB+1 `EntityTooLarge`), tampered key/bucket/Content-Type/checksum rejection, `${filename}` rejection, expired policy, POST-policy reuse + version detection, wrong type / `.exe` renamed `.mp4`, WebM+MP4 signature checks, corrupt checksum, direct quarantine GET `403`, GuardDuty `NO_THREATS_FOUND`/`THREATS_FOUND`/`UNSUPPORTED`/`ACCESS_DENIED`/`FAILED` + missing/duplicate events, abandoned uploads + Lifecycle deletion, Range `206` + headers, CDN access to quarantine/CV denied, unpublish invalidation, admin-only CV download + single-transaction assessment with synthetic data, CORS/CSP preflight, Netlify Function logs containing no signed fields and no large body, 100 MiB upload reliability from West Africa (V24), and actual cost/usage vs §15.11 estimates. **No test was run.**

### 15.13 Remaining decisions requiring approval / unresolved questions

**Classification:**

| **CONFIRMED** | **RECOMMENDED (requires approval)** | **UNRESOLVED QUESTION** |
|---|---|---|
| Amazon S3 / Europe; no Region approved | `eu-west-1` (Ireland) Region (§14.1) | "100 MB" = **100 MiB (104,857,600 B)** as used here, or decimal 100,000,000 B |
| Videos normally ≤100 MB; design around it | GuardDuty Malware Protection for S3 (§14.2 / §15.7) | Approved video formats: currently **mp4/webm only** — add others? |
| No multipart complexity unless necessary | Single-request presigned POST (§15.1); **multipart eliminated** (§15.8) | Integrity strategy: browser SHA-256 vs server streaming hash vs S3 stored checksum (§15.6) |
| CV uploads separate; 10 MiB limit unchanged; transaction/consent/admin-download protections preserved | POST policy TTL 300–600 s; `s3:signatureAge` deny | `s3:signatureAge` applicability to POST policies (**unverified**, V6) |
| CloudFront retained (OAC, Range, published-only, no quarantine/CV access) | Quarantine Lifecycle TTL + manual-review/deletion runbook | Retention window for failed/suspicious objects (investigation vs erasure) |
| GitHub push only after successful staging verification + separate explicit approval | Narrow CSP additions (`connect-src`/`form-action`/`media-src`) + S3 CORS | Keep the small-asset proxy once the CDN exists? |
| No staging/production/Git/implementation action in this task | Full §14.9 / §12.9 approval list (unchanged) | Netlify plan/function region, Turso residency, Free Tier status, vendor quotes (§14.9) |

**Exact approvals (each separate, explicit, written; none granted):** the full **16-item §12.9 / §14.9 list remains in force**, plus: (1) 100 MiB interpretation; (2) approved video format list; (3) single-request POST architecture incl. **new endpoints**, **`pending_uploads` table + own migration approval** and exact POST-policy conditions; (4) integrity strategy + any new dependency (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, hashing library); (5) authorization lifetime/replay controls; (6) malware-scanning approach/cost (GuardDuty, quarantine-only prefix, tagging/TBAC, failure handling, per-Region feature verification); (7) failure/retention policy; (8) CSP/CORS/CDN design + intentional-publication acknowledgement; (9) CV workflow approvals (unchanged, no CV change approved); (10) new env vars/credentials via secure interfaces (names only); (11) cost/billing approval before any spend; (12) GDPR package; (13) staging resources/deploy, read-only schema inspection, separate non-destructive migration, staging-only admin with synthetic data, hosted build/log review and the verification matrix; (14) **GitHub commit/push only after successful staging verification AND a separate explicit approval**; (15) production prohibited; (16) multipart reconsidered only as a separate approval if V24 demands it.

### 15.14 Official references, repository verification and stop point

**References:** R1–R59 in `docs/PHASE-8-REPORT.md` **§12.10** remain in force; **F1–F24** added for this refinement are enumerated in **§13.16** (AWS S3 POST Policy / POST Object / HTML forms / presigned URL / conditional writes / CORS / HeadObject / PutObject / checksum / FAQ / Lifecycle docs, GuardDuty how-it-works and scan-status docs, AWS security blog, Netlify Functions config, and clearly labelled secondary sources). Source-quality notes: AWS API-reference POST pages returned the "Welcome" redirect from this sandbox and were retrieved via official search indexing; SigV2 form mechanics are official but the design uses **SigV4 only**; secondary sources corroborate, never decide, security controls.

**Repository preservation verification (before → after):**

| Check | Before this task | After this task |
|---|---|---|
| Branch / HEAD | `arena/cdcb43ad-immi-website` / `bc53028b18b4ad9f8f2391b816a872973cbae457` | unchanged |
| Tracked / untracked (exact) / staged / modified | 1 / 283 / 0 / 0 | 1 / 283 / 0 / 0 |
| `git status --porcelain` | 15 collapsed entries | 15 collapsed entries |
| `.data/local.db` SHA-256 | `7c16c81cc383ae5832c16e02e364f1ed2a15debdcb8edce5bf331aa4df548ff3` | identical |
| `.data/secret-markers.json` SHA-256 | `2e5688ef56d38b4cb1932fe9980ed600041fa415addeccb7800baca5bdee47d0` | identical |
| `docs/PHASE-8-REPORT.md` / `docs/DEPLOYMENT.md` lines | 1394 / 449 | 1780 / 636 |
| Appendix A inventory | exact 283/283 | exact 283/283 (5 fenced blocks, 0 missing / extra / duplicates) |
| Trailing whitespace / tabs / control chars / secret-value patterns | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Files modified in the last 30 minutes | — | exactly 2: the two docs above |
| §13 / §15 sections | absent | present |
| Staging verification / Phase 8 completion | not verified / not complete | **not verified / not complete** |

**Parser caution:** use `git ls-files --others --exclude-standard` for the exact 283-path baseline (not `git status --porcelain`, 15 collapsed entries); read **all five** Appendix A fenced blocks; do not filter out root config paths. Full verification record: `docs/PHASE-8-REPORT.md` **§13.17**.

**No change** to any AWS account/bucket/IAM/paid service, application source, configuration, dependency, upload limit, schema, migration, middleware, CSP, media access control, environment variable, staging resource, administrator, deployment, production resource, or Git state. No secret value printed, stored or requested; no live AWS integration test; no cost incurred.

**STOP HERE.** Do **not** claim the architecture is implemented, that malware scanning is enabled, that AWS was tested, that staging is verified, or that Phase 8 is complete. **No Region, scanner, architecture, credential, bucket, paid service, source/config/dependency/upload-limit/schema/migration/deployment/Git operation, or production action has been approved or performed.** Await the user's review and explicit approval before implementation. Staging remains blocked; production remains prohibited; GitHub push requires successful staging verification plus a separate explicit approval.

---

## 16. Consolidated Phase 8 Approval Matrix — operational counterpart (5 November 2026)

> **DOCUMENTATION AND DECISION-PREPARATION ONLY.** This section is appended after, and **preserves in full**, §§1–15 — including the §13.2 staging-access checklist (14 gates), the §13.3 staged-deployment checklist (12 steps), §13.4 blockers, §14.9 uncertainties and 16 exact approvals, §15.13 remaining decisions, and the §15.14 stop point. **No approval has been granted or inferred; no prior decision is changed in meaning.** No application code, upload limit, AWS/Netlify/Turso resource, paid service, GuardDuty enablement, schema/migration, staging infrastructure, administrator, deployment, Git operation or production resource was created or changed. No secret was requested or printed. No cost was incurred. Staging remains **unverified**; Phase 8 is **not complete**.

### 16.0 Scope, reconciliation and cross-references

**Authoritative source:** the full **Phase 8 Approval Matrix** is `docs/PHASE-8-REPORT.md` **§14.1** (32 items M01–M32, eight columns). This §16 is its **operational counterpart**: it restates the decision state compactly, links each item to the deployment gates and checklists that already exist in this document, and does **not** duplicate the underlying evidence reports. Where wording differs, §14.1 governs; where a deployment gate is stricter, §§13.2–13.4 govern.

**Reconciled approval sources (all still in force):** `docs/PHASE-8-REPORT.md` **§12.9** (16 items), **§13.15** (16 refinements + confirmed/recommended/unresolved classification), **§13.18** (stop point), and this document's **§14.9** (16 items) / **§15.13** (16 items) / **§15.14** (stop point). **Reconciled architecture:** `docs/PHASE-8-REPORT.md` **§§13.0–13.18** and this document's **§§15.0–15.14**. **Costs:** §12.6.2, §13.13 and §14.6 of the report. **References:** R1–R59 (§12.10), F1–F24 (§13.16).

**Status vocabulary (identical to §14.0):** `CONFIRMED` = already decided by the owner, not re-opened; `RECOMMENDED — NOT APPROVED` = advice only (**A recommendation is never an approval**); `UNDECIDED` = needs an owner decision; `UNRESOLVED QUESTION` = owner must choose between documented alternatives; `UNVERIFIED` = needs account access, a hosted test or a vendor quote; `BLOCKED` = resources/credentials/access unavailable; `NOT AUTHORIZED / NOT PERFORMED` = no permission, no action; `PROHIBITED` = excluded from the current Phase 8 authorization.

**Historical note (meaning preserved):** the §13.1 / §13.2 gate text "no provider selected" is a dated record. The owner subsequently **confirmed Amazon S3** (§12.0 / §13.0 of the report); this does **not** reopen provider selection and does **not** approve any Region, scanner, architecture, credential or resource. The §14.3 multipart wording in this document's §14.3 and the earlier §12 per-part PUT suggestions are explicitly superseded by the report's §13.0 / this document's §15.0, with the historical wording left intact.

### 16.1 Compact approval matrix (mirror of §14.1)

> **Every row is currently UNAPPROVED** unless its status is `CONFIRMED` — and even `CONFIRMED` rows do **not** authorize implementation. "Approval" below is the **primary** approval; see §14.2/§16.2 for overlapping categories A–H. **No paid service is approved by this exercise.**

| # | Decision or action | Status | Primary approval required | Cost? | Evidence / deployment gate |
|---|---|---|---|---|---|
| **M01** | AWS S3 adoption as target | **CONFIRMED** | None for the decision; implementation separate | No direct | §14.1 M01; §12.0, §13.0 |
| **M02** | European AWS Region selection | **UNDECIDED** | Architectural (D02) | Yes (rates unverified) | §14.9(1); §12.8 items 1/2/5/6 |
| **M03** | Ireland `eu-west-1` | **RECOMMENDED — NOT APPROVED** | Architectural (D03) | Yes | §14.1/§14.9(1) |
| **M04** | Frankfurt `eu-central-1` alternative | **RECOMMENDED — NOT APPROVED** | Architectural (D04) | Yes | §14.1/§14.9(1) |
| **M05** | Single-request presigned POST architecture | **RECOMMENDED — NOT APPROVED** | Architectural design only (D05) | No direct | §15.1–15.6; §14.9(4) |
| **M06** | 100 MiB testimonial-video limit | **CONFIRMED** ceiling / **UNRESOLVED** interpretation | Interpretation (D07) | No | §15.0, §15.2, §15.4; §14.9(8) |
| **M07** | Approved video formats | **UNRESOLVED QUESTION** | Architectural (D08) | No | §15.2 |
| **M08** | Upload integrity verification | **UNRESOLVED** strategy | Technical + implementation after evidence (D17) | Potential (egress) | §15.6 |
| **M09** | Authorization expiry / replay protection | **RECOMMENDED — NOT APPROVED** | Architectural + evidence (D18) | No direct | §15.6; §15.13(5) |
| **M10** | Private quarantine architecture | **RECOMMENDED — NOT APPROVED** | Architectural (D09) | Yes | §15.1–15.2; §14.9(4) |
| **M11** | GuardDuty Malware Protection for S3 | **RECOMMENDED — NOT selected/enabled** | Approach (D23) **and separate billing (D24)** | **Yes — recurring** | §14.2; §14.9(2) |
| **M12** | Malware-scanning failure handling | **RECOMMENDED — NOT APPROVED** | Architectural + operational (D12) | Potential | §15.7; §15.13(7) |
| **M13** | Quarantine retention / cleanup TTL | **UNRESOLVED** | Architectural + GDPR (D21, D33) | Yes | §15.8; §14.9(4) |
| **M14** | CloudFront Origin Access Control | **CONFIRMED** design / **NOT APPROVED** implementation | Design + implementation + billing (D10, D25) | **Yes — recurring** | §14.5, §15.10; §14.9(6) |
| **M15** | Public video delivery + publication consent | **UNRESOLVED** consent | Architectural + GDPR (D11, D21) | Yes | §14.5, §15.10; §14.9(6) |
| **M16** | CSP and S3 CORS changes | **NOT APPROVED** | Separate implementation (D19) | No direct | §15.2, §15.10; §14.9(6) |
| **M17** | Separate private CV upload architecture | **CONFIRMED** separation / **NOT APPROVED** implementation | Architectural + separate implementation (D13, D15) | Yes | §14.4, §15.9; §14.9(5) |
| **M18** | CV validation and scanning (10 MiB unchanged) | **CONFIRMED** preservation / **NOT APPROVED** implementation | Implementation, separate (D15) | Yes | §14.4, §15.9 |
| **M19** | `pending_uploads` table and migration | **NOT APPROVED** | **Separate migration approval (D31–D34)** | No direct | §14.4; §14.9(4)/(12); §13.3 step 4 |
| **M20** | New upload API endpoints | **NOT APPROVED** | Implementation (D14, D16) | No direct | §15.1; §14.9(4) |
| **M21** | New env vars / credentials | **NOT APPROVED** | Implementation + secure interface (D20, D30) | No direct | §13.2 gates 3/9–12; §14.9(7) |
| **M22** | GDPR / privacy documentation | **NOT APPROVED** | Architectural/compliance (D21) | No direct | §14.9(10); §15.13(12) |
| **M23** | Staging Netlify site and Turso DB | **BLOCKED** | Staging resource (D26–D28) + billing (D22) | **Yes — potential, unverified** | **§13.2 (14 gates)**, §13.4, §14.8 |
| **M24** | Staging administrator provisioning | **NOT AUTHORIZED** | Staging resource (D29) | No direct | §13.3 step 10; §14.9(13) |
| **M25** | Hosted build and staging verification | **NOT PERFORMED / NOT AUTHORIZED** | Staging deployment + verification (D35–D37) | Yes (unverified) | **§13.3 steps 6–11**; §15.12; §14.9(14) |
| **M26** | GitHub commit and push | **NOT AUTHORIZED** | **Separate GitHub approval (D38, D39)** | No direct | §13.3 step 12; §14.9(15) |
| **M27** | Production deployment / production admin | **PROHIBITED — excluded** | **None requested** (D40–D41) | Yes (excluded) | §14.9(16); §15.14 |
| **M28** | Cost / billing approval + budget controls | **NOT APPROVED — no spend** | **Billing (D22, D24, D25)** | N/A | §14.6; §14.9(3)/(9) |
| **M29** | Upload-limit changes | **NONE APPROVED** | Separate only if proposed (D07) | No direct | §14.9(8); §15.4 |
| **M30** | Multipart reconsideration | **ELIMINATED** for ≤100 MiB | Separate, conditional on SV-19 (D06) | Potential | §15.8; §15.13(16) |
| **M31** | Small-asset public-media proxy retention | **UNRESOLVED** | Architectural (D13a) | No direct | §15.10; report §12.8 item 13 |
| **M32** | Optional services / exclusions | **NOT APPROVED** | Separate billing per service (D22, D25) | **Yes — unverified** | §14.6 |

### 16.2 Authorization categories A–H

| Cat. | Category | Items | Operational gate |
|---|---|---|---|
| **A** | **Decisions approvable now** (existing documentation suffices) | M01, M05, M06 (interpretation), M07, M10, M12 (policy), M14 (design), M15 (consent), M17, M18 (principle), M22, M29, M30 (elimination), M31, D21, D23 | An approve/decline on **intent**; **authorizes no code, resource, purchase, migration, deploy or Git action** |
| **B** | **Needs additional technical evidence** | M02–M04, M08, M09, M11 (per-Region availability), M13, M16, M19, M20, M21, M23, M25, M32 | Region rate tables & feature availability, Free Tier status, `content-length-range` semantics, `s3:signatureAge` POST applicability, checksum strategy, hosted CSP/CORS/edge behaviour, Netlify plan, Turso residency, vendor quotes, SV-19 |
| **C** | **Needs billing / cost approval** | M02 (rates), M11, M14, M15, M23, M25, M28, M32 — **and any account, bucket, subscription or paid service** | §14.6 cost summary + budget **before any spend**; alerts are **not** a hard cap [R56]; **no paid service approved here** |
| **D** | **Needs staging access / resources** | M23, M24, M25 + hosted verification of M05, M08, M09, M16, M17, M19, M20, M21, M30 | **§13.2's 14 gates**: separate site ID/URL, deploy auth, Turso DB, secure secret interface, written separation confirmation, Function/Edge logs, permitted runner. Currently **blocked** (connectors `unsupported`, 12 env names `not set`, deploy/build egress blocked) |
| **E** | **Needs separate migration approval** | M19 (+ schema-dependent parts of M17, M18, M20) | **§13.3 step 4**: read-only inspection vs `drizzle/0000_init.sql` (33/61/47) and `_journal.json` (one `0000_init`), stop on drift, **then** separate non-destructive approval; never add `TURSO_DATABASE_URL` to a build |
| **F** | **Needs successful staging verification** | M25 (outcome), M26, and any claim that staging works or Phase 8 is complete | §14.5 / §16.5 checklist with synthetic data only, log evidence, no secrets printed, no failed gate |
| **G** | **Needs separate GitHub approval** | M26 | **Only after successful staging verification AND a separate explicit approval**; push only to `arena/cdcb43ad-immi-website` |
| **H** | **Production actions remain prohibited** | M27 — production deployment, DB access/migration, resource modification, credentials, administrator provisioning | **Explicitly excluded** from the current Phase 8 authorization; requires a new, separate authorization |

### 16.3 Architectural approval vs implementation authorization

**Approving an architectural design** means accepting a documented approach **in principle** (e.g. "presigned POST → private quarantine → GuardDuty → promote clean objects → CloudFront OAC"). It changes **no file**, creates **no resource**, enables **no service**, incurs **no cost**, and grants **no** permission to write code, change configuration, buy anything, migrate a database, deploy or push. **Authorizing implementation** is a **different, separate, explicit written approval** for named files/systems — and even then it does **not** authorize billing account creation, resource provisioning, a migration, a deployment or a Git push. This is why §14.9 / §15.13 list separate approvals and why §14.9(15) requires staging verification **plus** a separate approval before any push.

| Level | Approved | Permits | Does **not** permit |
|---|---|---|---|
| **L0** | Documentation / evaluation (this exercise) | Docs, evidence reconciliation, decision preparation | L1–L7 |
| **L1** | Architectural design (A/B) | Recorded intent, Region/formats/strategy/topology choices | Code/config changes, purchases, resources, migrations, deploys, Git |
| **L2** | Implementation authorization | Named **additive** source/config/dependency changes | AWS/Netlify/Turso creation, billing, migration execution, deployment, push |
| **L3** | Billing & cost approval (C) | Billing account, budgets, approved recurring services | Deployment, migration, push; does not replace L2 |
| **L4** | Staging resource + deployment approval (D/E/F) | Separate staging site/DB/buckets, read-only inspection, a **separate** non-destructive migration, one draft deploy | Any production action; any push |
| **L5** | Hosted verification acceptance (F) | Record that §16.5 passed; **then** request L6 | Skipping L6; claiming Phase 8 complete |
| **L6** | Separate GitHub approval (G) | Commit + push to `arena/cdcb43ad-immi-website` only | Production deployment/provisioning |
| **L7** | Production approval (H) | Nothing in Phase 8 | **Excluded** |

**No level L1–L7 has been granted.** Approving L1 for testimonial videos does **not** approve L1 for CV uploads, nor L2–L7 for either.

### 16.4 Dependency-ordered implementation sequence (proposal only — no phase authorized)

> **Plan, not permission.** Full detail, exact file lists and acceptance criteria: `docs/PHASE-8-REPORT.md` **§14.4**. **Workstream A (testimonial videos)** and **Workstream B (applicant CVs)** stay separate — no shared endpoints, keys, buckets, pending-upload records, migrations or scan handlers; B starts only after A's server-side verification passes. Preserve the existing Next.js App Router, 58 API routes, `src/middleware.ts` role, the Drizzle baseline (33 tables / 61 indexes / 47 FKs; one `0000_init`), `STORAGE_DRIVER=blobs` fail-closed behaviour, the `immi-public`/`immi-private` Blobs stores, the single `POST /api/assessment` transaction and immutable `consent_records`, and the admin-only CV download route. **No rewrites; no upload-limit change.**

| Phase | Objective | Exact work expected | Files / systems likely to change | Required approvals | Tests & acceptance | Rollback | Conditions before proceeding |
|---|---|---|---|---|---|---|---|
| **P0** Decision & evidence closure (no code) | Close category A/B questions | Record §16.9 decisions; obtain Region rate tables, GuardDuty feature availability, Free Tier status, Netlify plan/region eligibility, Turso residency, vendor quotes; decide 100 MiB, formats, integrity, retention | Docs only: report §14, this §16 | L1 (D02–D13, D13a, D17–D21, D23) | Every `UNDECIDED`/`UNRESOLVED`/`UNVERIFIED` item answered or explicitly "open — do not proceed"; no invented price; no secret printed | Revert decision-log entries | Owner decisions recorded; no resources created |
| **P1** Billing, account & cost controls | Cost gate **before any spend** | Approve §16.6; create billing account; Budgets (actual+forecast), Cost Anomaly Detection, CloudWatch alarms, cost tags, quotas; acknowledge alerts are not a hard cap [R56] | AWS billing/Budgets/Cost Explorer; docs cost log. **No bucket/scanner/CDN yet** | L3 (D22, D24, D25) | Budget/alerts/tags visible; written acknowledgement; no billable storage exists | Remove newly created account config; no data at risk | P0 accepted; **written billing approval** |
| **P2** Staging resources & AWS foundation | Separate, verified staging resources | Create separate Netlify site (ID/URL, draft auth, logs), separate Turso DB + read-only access, quarantine/public/private-CV buckets or prefixes, IAM, SSE, 4× BPA, `Bucket owner enforced`, CORS, Lifecycle, versioning, CloudFront OAC, quarantine-only scanner; inject env **names** securely | Netlify UI/CLI/API, Turso secure config, AWS S3/IAM/KMS/CloudFront/GuardDuty/EventBridge/CloudWatch; **no repo files** | L3 + L4 (D22, D26–D30) | All **14 §13.2 gates** satisfied; presence-only secret verification; no production identifier; buckets private | Delete staging-only resources; revoke staging-only credentials | P1 accepted; **written separation confirmation**; Region approved |
| **P3** Read-only inspection → separate migration | Schema compatibility + minimum change | **Step 1:** read-only inspection and drift report vs `drizzle/0000_init.sql` / `_journal.json`; **stop on conflict**. **Step 2 (separate approval only):** `pending_uploads`, scan-status columns, optional `s3` provider value, non-destructive `0001_*` | `src/db/schema/*`, `src/db/schema/enums.ts`, `drizzle/0001_*.sql`, `drizzle/meta/_journal.json`, snapshot | **Category E, separate (D31–D34)** | Drift report matches 33/61/47 + one `0000_init`; staging data preserved; migration targeted only at staging | Non-destructive down migration / staging snapshot restore | P2 accepted; read-only inspection clean; **separate migration approval** |
| **P4** **Workstream A** — testimonial-video server side | Nine-step state machine, no CV code | AWS SDK dependency; POST-policy signing (exact `key`/`bucket`, `content-length-range` 1–104,857,600, exact `Content-Type`, `expiration`, checksum, SSE); `upload-authorize` / `upload-finalize` (HeadObject size, ETag/VersionId, checksum, Range magic bytes, `detectFileType()`); single-use pending state; EventBridge consumer with dedupe; `CopyObject` promotion from verified versionId; rejection, reconciliation, audit | New additive `src/lib/storage/s3.ts`, new `src/app/api/admin/cms/media/*` route + handler modules, `src/db/queries/pending-uploads.ts`, `package.json` / `package-lock.json`, `.env.example` (**names only**) | L2 for **A only** (D05, D06, D14, D16–D18) | Unit tests for policy/state/failure branches; SV-04–SV-11, SV-18 with **synthetic files**; no 100 MiB body in a Function (V23); no signed fields in logs | Feature-gate endpoints; keep `STORAGE_DRIVER` fail-closed; remove additive files; reversible P3 migration | P3 accepted; A approved; env names approved; staging resources available |
| **P5** **Workstream B** — separate private CV upload | CV direct upload, intact assessment integrity | Separate authorize/finalize endpoints and pending model (`purpose='cv'`); 10 MiB `content-length-range`; pdf/docx magic-byte validation; independent scan + fail-closed; `POST /api/assessment` accepts a verified token **instead of file bytes**; admin download issues short-lived presigned GET only after clean scan | New CV-specific route/query modules; `src/app/api/assessment/route.ts`, `src/lib/assessment/{submit,config,admin-handlers}.ts` (contract only, **no limit change**); **no shared modules with P4** | **Separate** L2 for **B only** (D13, D15) | SV-13–SV-15: immutable consent snapshot, `submittedAt`, `onDelete: restrict`, private keys never returned, `guardAssessmentRead` + audit + `no-store`/`nosniff`/sandbox CSP preserved; no unverified CV attachment | Feature-gate CV endpoints; retain existing assessment path until verified; revert contract change | **P4 verified first**; B approved separately; no shared keys/records |
| **P6** Delivery, CSP/CORS, browser integration | Serve only published verified videos | CloudFront cache policy, Range, server-detected `Content-Type`, `Content-Disposition`, `nosniff`, immutable `Cache-Control`; narrow `media-src`/`connect-src`/`form-action` additions + site-origin-only S3 CORS; unpublish (`archivedAt` + exact-path invalidation + delete object/versions + audit); retain small-asset proxy; wire CMS admin UI | `src/middleware.ts` (**narrow CSP only**), CloudFront + S3 CORS config, CMS admin components, `src/app/api/admin/cms/media/*`; `src/app/api/media/[...key]/route.ts` **retained** | L2 for delivery (D10, D11, D12, D13a, D19, D25) | SV-11/SV-12/SV-17/SV-22; `206` on Range; quarantine/CV keys 403 from CDN (V19); no wildcard CORS; CSP no broader than approved | Revert CSP/CORS baseline; disable public behaviours; invalidate paths | P4 (and P5) accepted; CSP/CORS approval; publication consent recorded |
| **P7** Staging deploy, hosted build & verification | Prove the design in hosted staging | Draft deploy to staging site ID (never `--prod`, never Git-connected from this branch); one hosted build; Function **and** Edge log review; execute **§16.5** with synthetic data only | Netlify staging site, Turso staging DB, AWS staging resources; **no Git operation**; docs verification record | L4 + hosted verification (D35–D37) | Every SV item passes; edge handler bundles without the Deno CLI download failure (report §10.4); no secret/token/CV URL/object key in logs; usage within §16.6 assumptions; **stop on any failure** | Tear down draft deploy; restore pre-deploy staging state | P0–P6 accepted; **all §13.2 gates satisfied**; separation confirmed; staging admin with synthetic data |
| **P8** GitHub commit and push | Record verified work | One commit + push to `arena/cdcb43ad-immi-website` only, **after** P7 and a **separate explicit approval** | Git index/remote on the session branch; no other branch; no prod deploy | **L6 separate approval (D38, D39)** | Push to named branch only; no `--prod`; no secret in diff; status reported | Revert only with a **new** separate approval | **P7 fully verified AND separate explicit approval** — neither exists |
| **P9** Production (**EXCLUDED**) | None in Phase 8 | **None** — production deploy, DB access/migration, resource modification, credentials and admin provisioning are prohibited | None | **Not requested (D40, D41)** | N/A — no production success may be claimed before real verification | N/A | A new, separate authorization outside Phase 8 |

### 16.5 Consolidated staging verification checklist

**Legend:** `H` = **hosted-only — can only be performed after staging resources exist** (categories D/F); `L` = local/static check. **Every item is `NOT PERFORMED`** in this documentation exercise. Sources: report §13.14 (V1–V25) / §15.12, and this document's **§13.2 gates**, **§13.3 steps 1–12**. Synthetic data only; never print secrets, tokens, CV URLs, authorization tokens or internal object keys.

| ID | Check | Source | Type | Status |
|---|---|---|---|---|
| **SV-01** | Baseline & separation re-verification (branch/HEAD, 1/283/0/0, Appendix A 283/283, protected hashes); written separation confirmation; env **presence-only** check | §13.3 steps 1–3; §13.2 gates 1/5/13 | L (+H) | NOT PERFORMED |
| **SV-02** | **Hosted Netlify build**: plugin/runtime versions, Node patch, middleware **Edge Function** bundles without the Deno CLI download failure | §13.3 step 6; V23 | **H** | NOT PERFORMED |
| **SV-03** | **Netlify Functions / Edge behaviour**: Function + Edge logs; small JSON bodies only; no 100 MiB body reaches a Function; no signed policy/fields in logs; HTTPS/secure cookies, `no-index`/`no-store`, cache headers, admin redirects | §13.3 steps 6–7; V23 | **H** | NOT PERFORMED |
| **SV-04** | **Turso connectivity & schema compatibility**: read-only inspection vs `drizzle/0000_init.sql` (33/61/47) and `_journal.json`; drift report; stop on conflict; migration never in build | §13.3 step 4 | **H** | NOT PERFORMED |
| **SV-05** | **S3 upload authorization**: exact `key`/`bucket`/`Content-Type`/checksum/SSE/expiration; tampered/`${filename}`/expired policies rejected; `s3:signatureAge` POST applicability observed | V4–V6; §15.3 | **H** | NOT PERFORMED |
| **SV-06** | **100 MiB enforcement**: ~99 MiB accepted; exact boundary documented (incl. ≤20 KB form overhead); 100 MiB+1 B rejected by S3 `EntityTooLarge` before object creation **and** by measured `HeadObject.ContentLength` | V1–V3; §15.2/§15.4 | **H** | NOT PERFORMED |
| **SV-07** | **Actual file integrity**: MP4 `ftyp` @ offset 4 / WebM `1A 45 DF A3`; wrong MIME / renamed `.exe` rejected; checksum mismatch (`BadDigest`); declared ≠ detected rejected | V8–V10; F7–F9 | **H** | NOT PERFORMED |
| **SV-08** | **Replay / overwrite protection**: same policy twice → second finalize rejected, >1 version, no promotion; ETag/VersionId binding; single-use state; `If-None-Match` not applicable to POST | V7; §15.6 | **H** | NOT PERFORMED |
| **SV-09** | **Malware success & failure**: `NO_THREATS_FOUND` promotes once; `THREATS_FOUND` (EICAR-like), `UNSUPPORTED`, `ACCESS_DENIED`, `FAILED`, missing event, duplicate events all fail closed, stay private, alert + dedupe | V12–V16; §15.7 | **H** | NOT PERFORMED |
| **SV-10** | **Quarantine isolation**: quarantine/private-CV objects denied (403); TBAC deny-until-clean; 4× BPA; separate buckets/prefixes; public proxy `visibility='public'` + `nosniff`/sandbox CSP | V11/V19; §13.3 step 8 | **H** | NOT PERFORMED |
| **SV-11** | **Promotion to public storage**: only `verified AND clean` promoted from the verified versionId; new CSPRNG key; `mediaAssets` row (detected MIME/size/checksum); audit entry | V12; §15.1 | **H** | NOT PERFORMED |
| **SV-12** | **CloudFront delivery / HTTP Range**: `206 Partial Content` on seek; server-detected `Content-Type`, `nosniff`, immutable cache; OAC origin only | V18; §15.10 | **H** | NOT PERFORMED |
| **SV-13** | **Unpublishing / cache invalidation**: `archivedAt`, exact-path invalidation, object + all versions deleted, cached copy unreachable, audit; invalidation count vs 1,000 free paths | V20 | **H** | NOT PERFORMED |
| **SV-14** | **CV privacy / admin-only access**: never public or CDN-reachable; `guardAssessmentRead`, audit, `Content-Disposition: attachment`, `no-store`, `nosniff`, sandbox CSP preserved; presigned GET only after clean scan | V21; §15.9 | **H** | NOT PERFORMED |
| **SV-15** | **Assessment transaction integrity**: single transaction (assessment + immutable consent snapshot + children + private `media_assets` + attachments); `onDelete: restrict`; no unverified/unscanned/expired CV attachment; honeypot/rate limits/Zod/consent/idempotency unchanged | V21; §14.4 | **H** | NOT PERFORMED |
| **SV-16** | **Auth / authz / CSRF**: admin role checks, CSRF, `throttleCmsMutation`, redirects and session cookies in hosted runtime; no anonymous authorize/finalize | §13.3 step 7; §15.1 | **H** | NOT PERFORMED |
| **SV-17** | **CSP / S3 CORS preflight**: narrow approved additions work from the staging origin; CORS allows only that origin, POST and required headers; no wildcards; no broadened directives | V22; §13.3 step 7 | **H** | NOT PERFORMED |
| **SV-18** | **Cost / storage cleanup**: abandoned authorize and post-upload-without-finalize → pending expiry, orphan deleted by Lifecycle `Expiration`, `NoncurrentVersionExpiration` for replay versions; actual requests/bytes scanned/tagging/EventBridge/CDN usage vs §16.6; budget alerts configured (not a hard cap) | V17/V25; §15.8 | **H** | NOT PERFORMED |
| **SV-19** | **100 MiB reliability from likely user geography** (West Africa): measure interruption/failure rate; the **only** test that can justify reconsidering multipart | V24; §15.8 | **H** | NOT PERFORMED |
| **SV-20** | **Synthetic-data functional verification**: public site, admin portal (staging-only account), assessment workflow, CMS media; **no real applicant data**, no production administrator | §13.3 step 10 | **H** | NOT PERFORMED |
| **SV-21** | **Log review / evidence**: build + Function + Edge logs collected and reported; no secrets, tokens, CV URLs, authorization tokens or object keys printed | §13.3 step 11 | **H** | NOT PERFORMED |
| **SV-22** | **Effective headers / middleware / storage separation**: merged CSP (nonce, `media-src`/`connect-src` as approved), `no-index`/`no-store`, cache headers, redirects; `immi-public`/`immi-private` separation, anonymous denial, storage-failure handling; honest record that the 100 MiB video and 12 MiB assessment paths are incompatible with the **existing** buffered Function path | §13.3 steps 7–9 | **H** | NOT PERFORMED |

**All 22 checks are gated on categories D/F** and require the resources listed in §13.2. No live AWS integration test, hosted build, staging deployment or production action occurred.

### 16.6 Cost approval summary (operational restatement)

> **No paid service is approved by this exercise.** Figures are the **existing documented estimates** from the report's §12.6.2 / §13.13 / §14.6 and this document's §14.6 / §15.11. **Nothing purchased, enabled or incurred.** Scenarios: A staging 2 GB stored / 10 GB transferred; B small production 25 GB / 200 GB; C growth 250 GB / 2,000 GB.

| Cost line | A — staging | B — small production | C — growth | Label | Current vendor confirmation needed? |
|---|---|---|---|---|---|
| **Expected monthly total (EU edge)** | **~$0.08** | **~$1.2** | **~$118** | **estimated**, rounded, not a bill | **Yes** |
| **Expected monthly total (Nigeria/Africa edge)** | **~$0.08** | **~$1.2** | **~$143** | **estimated**; viewer location sets the price group, not the S3 Region [R7] | **Yes** |
| Totals without the illustrative 5,000-path invalidation case | ~$0.08 | ~$1.2 | ~$98 (EU) / ~$123 (Nigeria) | **estimated** | **Yes** |
| **GuardDuty scanning (separate)** | ~$0.03 (or ~$0.00 Free Tier) | ~$0.46 (or ~$0.26) | ~$5.47 (or ~$5.16) | **documented** US East $0.09/GB + $0.215/1k objects; **Region rate unverified**; Free Tier 1 GB + 1,000 objects/month, tagging/S3 API/EventBridge excluded [R39] | **Yes** |
| GuardDuty per 100 MiB video | — | ~$0.009/video | 100/mo ≈ $0.90; 500/mo ≈ $4.50 | **estimated** (§13.13) | **Yes** |
| **S3 storage** | ~$0.05 | ~$0.58 | ~$5.75 | **estimated** from secondary $0.023/GB-month [R23] | **Yes** |
| **S3 requests** | <~$0.002 | ~$0.012 | ~$0.10 | **estimated** from secondary $0.005/1k writes / $0.0004/1k reads [R23] | **Yes** |
| S3 → CloudFront origin fetch | $0 | $0 | $0 | **documented** [R7] | No |
| S3 private/admin egress (0.1/2/20 GB illustrative) | ~$0.01 | ~$0.18 | ~$1.80 | **documented** Ireland $0.09/GB [R18] on illustrative volumes | **Yes** |
| **CloudFront delivery egress** | $0 (1 TB free) | $0 | ~$85 (EU) / ~$110 (Nigeria) | **documented** $0.085 / $0.110 per GB above 1 TB [R7] | **Yes** |
| CloudFront HTTPS requests / invalidation | $0 / $0 | $0 / $0 | $0 (under 10M) / $0 or **~$20** (5,000 paths) | **documented** 10M free, 1,000 free paths then $0.005/path [R7], [R21] | **Yes** |
| EventBridge / SQS / Lambda | <~$0.01 | <~$0.01 | ~$0.02 | **documented** [R48]–[R51]; managed-rule cost unverified | **Yes** |
| **Netlify plan / build minutes / Functions / Edge / bandwidth** | **excluded — unverified** | **excluded — unverified** | **excluded — unverified** | No billing view; EU function region is a **Pro/Enterprise** feature [R27]; **no price invented** | **Yes** |
| **Turso plan / storage / compute / usage** | **excluded — unverified** | **excluded — unverified** | **excluded — unverified** | No billing view or account inspection; residency unknown | **Yes** |
| **Optional services / exclusions** | not modelled | not modelled | not modelled | Backup/replication, CloudFront flat-rate plans (Free $0 / Pro $15 / Business $200 / Premium $1,000 **published** [R22]), commercial scanners (~$99/month min [R52] or $0.20/GB + $0.025/vCPU-hour [R46]), KMS, WAF, CloudWatch, CloudTrail, Support, tax | **Yes — quotes / allowance terms** |
| **Unverified prices & assumptions** | — | — | — | Region-specific S3/GuardDuty rates, secondary S3 rates, Free Tier/credit status [R20], illustrative object counts/sizes and request multipliers, 0.1/2/20 GB private egress, edge mix, 5,000-path invalidation case, 1 TB free-tier applicability, cache-miss ratios, all hosted behaviour | **Yes — before any spend** |

**Warnings:** free allowances do **not** make production free [R39], [R19], [R20], [R7]; **budget alerts do not necessarily prevent charges** (Budgets data refreshed up to three times daily, typically 8–12 hours apart; not a real-time hard cap) [R56]. Unexpected-charge sources: incomplete multipart parts, double scans, tagging, S3 API/EventBridge managed rules, abandoned objects, presigned-URL abuse, Range amplification, invalidations, the higher Nigeria/Africa group, versioning/replication, storage-class minimums, KMS/CloudWatch/WAF and Free Tier expiry (report §12.6.3). **Cost disclosure + billing approval (D22, D24, D25) is required before any account, bucket, subscription or paid service.**

### 16.7 Risk register (operational restatement)

Full detail: `docs/PHASE-8-REPORT.md` **§14.7**.

| ID | Risk | Potential impact | Mitigation | Verification | Approval dependency |
|---|---|---|---|---|---|
| **RR-01** | **S3 POST size enforcement uncertainty** (`content-length-range` byte semantics; exact 100 MiB boundary) | Rejected valid uploads or accepted oversized objects / avoidable cost | Policy max exactly 104,857,600 B **plus** independent `HeadObject.ContentLength` check; fail-closed form-overhead conservatism (§15.2/§15.4) | SV-06 (V1–V3) | M06, M28, B/F |
| **RR-02** | **Presigned authorization replay** (bearer token reuse until expiry; same-key replacement) | Unauthorized/duplicate objects, extra scan charges, wrong object promoted | CSPRNG key, exact `key` condition, single-use pending state, versioning + >1 version rejection, ETag/VersionId binding, short TTL, `s3:signatureAge` (§15.6) | SV-08 (V7) | M09, M20, B/F |
| **RR-03** | **Incorrect checksum / object-version association** | A tampered or different object promoted as verified | Bind `x-amz-checksum-sha256` in policy, `HeadObject` checksum mode, promote only verified `versionId`, reject ETag change, dedupe at-least-once events | SV-07, SV-11 | M08, M19, E/F |
| **RR-04** | **Scanning delays / failures** (`FAILED`, `ACCESS_DENIED`, `UNSUPPORTED`, missing/duplicate events) | Stalled or non-clean object promoted | Fail-closed reconciliation timeout, all non-clean → `rejected`, manual review + alerts, quarantine-only prefix, tagging before first upload, TBAC | SV-09 (V12–V16) | M11–M13, C/F |
| **RR-05** | **Public video exposure** (unverified/quarantine object on CDN; irrevocable publication) | Private/suspect content public; erasure impossible | Promotion is the only public-prefix writer, OAC restricted to that prefix, TBAC, `visibility='public'`, immutable keys, exact-path invalidation, separate consent | SV-10–SV-13 (V19/V20) | M14, M15, M22, F |
| **RR-06** | **Private CV exposure** | Severe applicant data breach / GDPR violation | Fully separate Workstream B, private bucket, never a CDN origin, admin-only `guardAssessmentRead` + audit + `no-store`/`nosniff`/sandbox CSP, `storageKey` never returned publicly (§15.9) | SV-14, SV-15 (V21) | M17, M18, M22, F |
| **RR-07** | **Netlify regional hosting limitations** (default `cmh` US East; EU regions Pro/Enterprise; 6 MB / ≈4.5 MB binary ceiling; hosted Deno unverified) | Applicant/metadata processing outside EEA; upload path fails | Direct browser→S3 (bytes never enter a Function), confirm plan/region, one hosted build with Function + Edge logs, no broadened CSP | SV-02, SV-03, SV-17, SV-22 | M02, M21, M23, B/D |
| **RR-08** | **Turso data residency** unknown | Applicant data outside Europe despite an EU S3 Region | Confirm residency before approval; DPA/sub-processor review; never assume an EU S3 Region guarantees compliance | Vendor/account confirmation; SV-04 | M02, M22, M23, B/D |
| **RR-09** | **GDPR / retention obligations** (Region alone ≠ compliance; Object Lock vs erasure; versions/replicas/caches; consent) | Regulatory non-compliance; erasure/access requests unsatisfiable | DPA/TIA, privacy notice, separate publication consent, retention/deletion schedules covering objects/versions/replicas/quarantine/CDN/DB, records/DPIA | Legal review; SV-13/SV-14/SV-18 | M13, M15, M22, A/F |
| **RR-10** | **Unexpected AWS charges** (tagging, S3 API, EventBridge, incomplete MPUs, double scans, abandonment, invalidation, Range amplification, Nigeria/Africa group, Free Tier expiry; alerts not a hard cap) | Budget overrun | Billing approval before spend, budget cap, anomaly detection, quotas, `content-length-range`, Lifecycle cleanup, noncurrent-version expiration, minimal invalidation, WAF/bot controls, monthly review | SV-18 (V25); usage review | M28, M32, C |
| **RR-11** | **Staging/production separation** (missing IDs/credentials/written confirmation; connectors `unsupported`; deploy/build egress blocked) | Accidental production write/charge; invalid "staging verified" claim | All 14 §13.2 gates, presence-only secret verification, no production identifier in staging config, draft-only deploy, never `--prod`, no Git-connected build | SV-01, SV-21 | M23, M25, M27, D/F/H |
| **RR-12** | **GuardDuty per-Region availability / rate uncertainty** | Scanner unavailable; cost differs from US East example | Confirm feature availability and Region-specific rates before Region approval; documented ClamAV/commercial alternatives (report §12.2) | Official Region table / console; vendor quote | M02, M11, B/C |
| **RR-13** | **Hosted edge/Deno build compatibility** (earlier offline download failure) | Build fails; no verification possible | One hosted build with Edge log review; do not infer hosted behaviour from local offline failure (report §10.4) | SV-02, SV-03 | M23, M25, D/F |
| **RR-14** | **Repository tracking state** (only `README.md` tracked, 283 untracked; Git-connected build would lack the app) | Empty deploy; premature push | No Git-connected build from this branch; authorized no-Git CLI path only; baseline re-verified each phase | SV-01; §16.8 | M26, G |
| **RR-15** | **100 MiB single-request reliability** on high-latency West-African links (no resume) | Failed uploads / pressure for multipart complexity | Accept the documented trade-off; fresh authorization on retry; reconsider multipart **only** after SV-19 and a separate approval | SV-19 (V24) | M30, B/F |

### 16.8 Repository preservation verification — before and after

Exact counts use `git ls-files --others --exclude-standard` (283), not `git status --porcelain` (15 collapsed entries); Appendix A is parsed across **all 5 fenced blocks**. This task appended §14 to the report and §16 here; no earlier line of either document was changed.

| Check | Before | After |
|---|---|---|
| Branch / HEAD | `arena/cdcb43ad-immi-website` / `bc53028b18b4ad9f8f2391b816a872973cbae457` | unchanged |
| Tracked / untracked (exact) / staged / modified tracked | 1 / 283 / 0 / 0 | 1 / 283 / 0 / 0 |
| `git status --porcelain` | 15 collapsed entries | 15 collapsed entries |
| Protected hashes | `.data/local.db` `7c16c81c…548ff3`; `.data/secret-markers.json` `2e5688ef…ee47d0` | unchanged |
| `docs/PHASE-8-REPORT.md` / `docs/DEPLOYMENT.md` lines | 1780 / 636 | 2116 / 943 |
| Top-level sections | report §§1–13 / deployment §§1–15 | report §§1–14 / deployment §§1–16 (all prior sections preserved) |
| Appendix A (5 fences) | 283 / 283 / 283 / 0 / 0 EXACT | same |
| References | R1–R59 (59/59), F1–F24 (24/24) | same |
| New numbering | — | report §14.0–14.9; deployment §16.0–16.9 (both continuous) |
| Placeholders / trailing whitespace / tabs / control chars / secret patterns | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Files changed by this task | 0 | exactly 2 documents |
| Staging / production / Git / AWS / Netlify / Turso / migration / admin / cost | blocked / prohibited / unchanged / none | unchanged — **no action taken** |

### 16.9 Final owner decision sheet

> One **atomic** decision per item: answer **Approve**, **Decline** or **Defer** (with a reason). **Do not bundle unrelated decisions.** IDs are stable cross-references from §§14.1–14.7 of the report and §§16.1–16.7 here; they are grouped by **authorization type**, so numbering is not strictly contiguous within each heading; `D13a` is sub-numbered for M31 / P0 / P6. **Every item is currently UNAPPROVED** — including every `RECOMMENDED` design. **No paid service is approved by this exercise.** Approving an architectural item does **not** authorize implementation, billing, staging resources, migration, deployment, Git push or production (§16.3).

#### Architectural approval

**D01.** **Approve or decline:** re-affirming **Amazon S3** as the sole object-storage target (already **CONFIRMED**; ratification only — no Region/scanner/credential/resource). *(M01)*

**D02.** **Approve or decline:** proceeding to select **one** European AWS Region **after** the §14.9 evidence is supplied; decline means **no Region selected yet**. *(M02)*

**D03.** **Approve or decline:** `eu-west-1` **(Ireland)** as the primary Region. *(M03)*

**D04.** **Approve or decline:** `eu-central-1` **(Frankfurt)** as the alternative Region. *(M04)*

**D05.** **Approve or decline:** the **single-request presigned POST** nine-step architecture for testimonial videos, as a **design only**. *(M05)*

**D06.** **Approve or decline:** **eliminating multipart** for ≤100 MiB videos, with reconsideration only after SV-19 and a further separate decision. *(M05, M30)*

**D07.** **Approve or decline:** **100 MiB = 104,857,600 bytes** (not decimal 100,000,000 B) **and no change** to `MAX_UPLOAD_BYTES` / `MAX_SUBMISSION_REQUEST_BYTES`. *(M06, M29)*

**D08.** **Approve or decline:** `video/mp4` + `video/webm` as the **only** accepted formats, with magic-byte detection. *(M07)*

**D09.** **Approve or decline:** the **private quarantine architecture** (separate bucket/prefix, 4× BPA, `Bucket owner enforced`, SSE-S3/KMS not SSE-C, deny-by-default, TBAC). *(M10)*

**D10.** **Approve or decline:** retaining **CloudFront OAC** on a dedicated public-media origin for published videos only. *(M14)*

**D11.** **Approve or decline:** the acknowledgement that published testimonial videos are **intentionally public**, a **separate** publication consent, unpublish behaviour and the erasure caveat. *(M15)*

**D12.** **Approve or decline:** the **fail-closed malware-scanning failure policy** (all non-clean outcomes → `rejected`, manual review, alerts, no promotion). *(M12)*

**D13.** **Approve or decline:** keeping **applicant CV uploads as a fully separate workstream** with the unchanged 10 MiB limit, transaction, consent snapshot and admin-only download. *(M17)*

**D13a.** **Approve or decline:** **retaining the existing small-asset `/api/media/[...key]` proxy** (not rewriting it), with only validated published videos on the CDN. *(M31)*

**D21.** **Approve or decline:** the **GDPR / privacy package** (DPA, sub-processors, transfer-impact assessment, privacy notice, publication consent, retention/deletion schedules, records/DPIA); a European Region alone is not compliance. *(M22)*

**D23.** **Approve or decline:** selecting **GuardDuty Malware Protection for S3** as the scanning approach (quarantine-only prefix, tagging before first upload, TBAC, EventBridge dedupe) **or** declining in favour of a documented alternative. **Approach selection only** — not a purchase or enablement. *(M11)*

#### Implementation approval

**D14.** **Approve or decline:** implementing **Workstream A (testimonial video) server-side** code only — additive files, no CV code, no limit change. *(P4)*

**D15.** **Approve or decline:** implementing **Workstream B (applicant CV) server-side** code only — separate endpoints/keys/records, assessment transaction and consent snapshot intact. *(P5)*

**D16.** **Approve or decline:** adding the **four new upload handlers** (`upload-authorize`, `upload-finalize`, promotion handler, EventBridge consumer), preserving `guardMutation`, CSRF and rate limits. *(M20)*

**D17.** **Approve or decline:** **one integrity-verification strategy** (browser SHA-256 / server streaming hash / S3 stored checksum + ETag/VersionId) **and** any new dependency (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, hashing library). *(M08)*

**D18.** **Approve or decline:** **authorization expiry and replay controls** (300–600 s TTL, single-use pending state, versioning, ETag/VersionId binding, `s3:signatureAge`, no signed fields in logs). *(M09)*

**D19.** **Approve or decline:** **narrow CSP additions** + **site-origin-only S3 CORS**, no wildcard origins, no broadened directives. *(M16)*

**D20.** **Approve or decline:** the **exact list of new environment-variable names** only; values exclusively via the secure interface (Functions scope), never printed in chat, docs, logs or terminal output. *(M21)*

#### Billing approval

**D22.** **Approve or decline:** the **§16.6 cost summary**, creating the **AWS billing account**, and a budget cap, Budgets/Cost Anomaly Detection/CloudWatch alerts, cost tags and quotas — with written acknowledgement that **alerts do not prevent charges** [R56]. *(M28)*

**D24.** **Approve or decline:** **recurring GuardDuty scanning spend** (US East example $0.09/GB + $0.215/1,000 objects; Region rate unverified; ~$0.009 per 100 MiB video estimated). *(M11)*

**D25.** **Approve or decline:** the **CloudFront distribution and recurring delivery/invalidation spend** (1 TB free then $0.085/GB EU or $0.110/GB Nigeria; 1,000 free paths then $0.005/path) [R7], [R21]. *(M14, M32)*

#### Staging resource approval

**D26.** **Approve or decline:** creating a **separate staging Netlify site** (site ID/URL, draft-only deploy authorization, never `--prod`, Function **and** Edge logs). *(M23; §13.2 gates 1–4)*

**D27.** **Approve or decline:** creating a **separate staging Turso database** with read-only schema-inspection access and a staging-only auth token via a secure interface. *(M23; §13.2 gates 5–7)*

**D28.** **Approve or decline:** creating **staging-only AWS resources** (buckets/prefixes, IAM, SSE, CORS, Lifecycle, CloudFront OAC, GuardDuty plan) **with written separation-from-production confirmation** for Netlify, Turso, buckets, credentials and DNS. *(P2; §13.2 gate 13)*

**D29.** **Approve or decline:** provisioning a **staging-only administrator** with fresh staging-only credentials and **synthetic data only** — no real applicant documents, no production administrator. *(M24; §13.3 step 10)*

**D30.** **Approve or decline:** using the **secure secret-injection interface** (Functions scope, correct deploy context), **presence-only** verification, never printing values. *(M21; §13.2 rules)*

#### Database migration approval

**D31.** **Approve or decline:** **read-only staging schema inspection** vs `drizzle/0000_init.sql` (33/61/47) and `_journal.json` (one `0000_init`), stopping on any conflict. *(P3; §13.3 step 4)*

**D32.** **Approve or decline:** the **`pending_uploads` table** shape and a new **non-destructive `0001_*` migration** + journal entry, preserving staging data. *(M19)*

**D33.** **Approve or decline:** adding **scan-status and retention columns** to `media_assets` (quarantine TTL fields for M13), as a **separate** schema decision. *(M13, M19)*

**D34.** **Approve or decline:** adding an **`s3` value to `STORAGE_PROVIDERS`** while retaining `STORAGE_DRIVER=blobs` fail-closed behaviour. *(M19)*

#### Staging deployment approval

**D35.** **Approve or decline:** a single **non-production / draft staging deploy** to the confirmed staging site ID (never `--prod`, never Git-connected from this branch, no Git operation). *(P7; §13.3 step 5)*

**D36.** **Approve or decline:** one **hosted build plus Function and Edge log review**, including hosted Deno/edge compatibility. *(M25; §13.3 step 6)*

**D37.** **Approve or decline:** executing the **entire §16.5 checklist (SV-01–SV-22)** with synthetic data only, stopping and reporting on any failed gate. *(M25; §15.12)*

#### GitHub push approval

**D38.** **Approve or decline:** a **GitHub commit** on `arena/cdcb43ad-immi-website` — **only after successful staging verification** and as a **separate explicit approval**. *(M26; §14.9(15))*

**D39.** **Approve or decline:** a **push to `origin arena/cdcb43ad-immi-website`** — **only after successful staging verification** and as a **further separate explicit approval**; no other branch. *(M26; §13.3 step 12)*

#### Production approval — explicitly excluded

**D40.** **Decline / defer — NOT REQUESTED:** production deployment, production resource modification, production credentials and **production administrator provisioning**. **Explicitly excluded** from the current Phase 8 authorization; requires a new, separate authorization. *(M27; §14.9(16))*

**D41.** **Decline / defer — NOT REQUESTED:** production database access, production migration and any production data write. **Excluded** from the current Phase 8 authorization. *(M27; §15.14)*

---

**STOP HERE.** This operational counterpart is **documentation only**. **No decision above has been approved.** No paid service is approved. No Region, scanner, architecture, endpoint, table, migration, credential, environment variable, CSP/CORS rule, staging resource, administrator, build, deployment, Git operation or production resource has been created, enabled, changed or requested as a value. **Staging remains blocked and unverified; Phase 8 is not complete.** Await the project owner's explicit written decisions before any further action.
