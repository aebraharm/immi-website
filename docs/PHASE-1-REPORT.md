# Phase 1 — Completion Report

**Project:** Premium immigration agency website
**Phase:** 1 — Foundation & Database Architecture
**Branch:** `arena/cdcb43ad-immi-website`
**Date:** 2026-11-03
**Status:** Phase 1 complete, awaiting approval for Phase 2
**Commits made:** none (per your rule 11 — commit/push requires your authorisation)

---

## 1. What was built

### Configuration & tooling

| File | Purpose |
|---|---|
| `package.json` | Pinned dependency set, all scripts |
| `tsconfig.json` | `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` |
| `next.config.ts` | Security headers, image policy, noindex rules |
| `postcss.config.mjs` | Tailwind v4 pipeline |
| `drizzle.config.ts` | Turso dialect, generates SQL without connecting |
| `netlify.toml` | Node 22, plugin-nextjs, edge headers, dev block |
| `eslint.config.mjs` | Flat config for ESLint 9; `no-console` enforced in `src/`, off in CLI scripts |
| `.gitignore` | Ignores `.env*`, `.data/`, build output |
| `.env.example` | Empty placeholders only — no real values |

### Database — 33 domain tables + 1 migration ledger

| Group | Tables |
|---|---|
| Auth | `admins`, `admin_sessions`, `admin_password_resets` |
| Media | `media_assets` |
| Settings | `site_settings`, `seo_settings`, `website_pages`, `homepage_sections`, `faqs` |
| Services | `services`, `service_features` |
| Destinations | `countries`, `destinations`, `visa_categories`, `destination_requirements`, `employment_opportunities` |
| People | `testimonials`, `team_members` |
| Assessments | `assessments`, `consent_records`, `applicant_education`, `applicant_employment`, `applicant_skills`, `applicant_languages`, `applicant_examinations`, `applicant_travel_history`, `applicant_family_abroad`, `assessment_attachments`, `assessment_notes`, `assessment_status_history` |
| Operations | `activity_logs`, `login_attempts`, `rate_limit_buckets` |

`drizzle/0000_init.sql` — 589 lines, 33 `CREATE TABLE`, 61 indexes, 47 foreign keys
(14 CASCADE / 4 RESTRICT / 29 SET NULL).

### Application layer

- `src/lib/env.ts` — Zod-validated environment, throws nothing at import
- `src/db/client.ts`, `src/db/index.ts` — lazy, memoised libSQL + Drizzle clients
- `src/lib/auth/crypto.ts` — SHA-256 digests, 256-bit tokens, constant-time compare, privacy-preserving IP hashing
- `src/lib/auth/password.ts` — Argon2id (19 MiB, t=2, p=1) + password policy
- `src/lib/storage/` — `StorageAdapter` interface, Blobs adapter, local adapter, key builder, private-URL guard
- `src/lib/files/` — magic-number detection, per-purpose allowlists, DOCX container verification, filename sanitisation
- `src/lib/utils/` — `cn`, `reference.ts`, `slug.ts`, `format.ts`
- `src/lib/data/countries-iso.ts` — 197 ISO countries + dial codes, 12 salary currencies
- `src/components/ui/` — Button (red→blue active state), Card, GlassCard, Field, Badge, Skeleton
- `src/components/motion/` — `MotionProvider` (`reducedMotion="user"`), `Reveal`, `RevealGroup`, `PageTransition`
- `src/middleware.ts` — HTTPS, per-request CSP nonce, noindex, admin pre-filter
- `src/app/` — root layout with self-hosted Inter, config-aware placeholder page, `robots.ts`, `sitemap.ts`, `not-found`, `error`, `api/health`
- `scripts/` — `migrate.ts`, `seed-admin.ts`, `seed-destinations.ts`, `verify-schema.ts`
- `tests/` — 64 assertions across 15 suites

**Totals:** 50 source files, 6,386 lines of TypeScript/TSX/CSS.

---

## 2. Evidence — actual command output

### 2.1 TypeScript strict mode

```
$ npx tsc --noEmit
EXIT=0  no type errors
```

### 2.2 ESLint

```
$ npx eslint .
EXIT=0  no lint errors
```

### 2.3 Unit tests — 64 assertions

```
$ npx tsx --test tests/files.test.ts tests/security.test.ts
# tests 64
# pass 64
# fail 0
```

Coverage includes: PDF/PNG/JPEG/GIF/WEBP/MP4 detection; rejection of executables,
shell scripts and SVG; a `.pdf` that is really a PNG; a `.docx` that is only a
ZIP; a CV over the 10 MB limit; path traversal in filenames; Argon2id password
policy; reference-number ambiguity and collision checks; constant-time compare;
IP hashing.

### 2.4 Schema verification — 38/38 checks

```
$ npx tsx scripts/verify-schema.ts
=========================================================
 SCHEMA VERIFICATION
 target: file:.data/verify-scratch.db (throwaway)
=========================================================
[1] Applying migrations from ./drizzle
  PASS  all expected tables created — 34 tables (33 domain + migration log)
  PASS  PRAGMA foreign_key_check — no violations
...
 RESULT: 38/38 checks passed
=========================================================
```

Selected behaviours proven (not asserted — each line is a real database operation
that was *attempted* and either succeeded or was *rejected by SQLite*):

| Check | Result |
|---|---|
| Insert note referencing non-existent assessment | **rejected** |
| Delete assessment that still has an attached CV | **rejected** (RESTRICT) |
| Delete after attachment unlinked | **succeeded**, children cascaded |
| Delete media asset referenced by an attachment | **rejected** (RESTRICT) |
| Delete country referenced by a destination | **rejected** (RESTRICT) |
| Delete admin who authored an activity log | **succeeded**, log kept with `actor_admin_id = NULL` and email snapshot intact |
| `hasChildren=false` with count 2 | **rejected** (CHECK) |
| `hasPassport=false` with passport number | **rejected** (CHECK) |
| Testimonial with both video upload and video URL | **rejected** (CHECK) |
| Duplicate reference number | **rejected** (UNIQUE) |
| Replayed idempotency key | **rejected** (UNIQUE) |
| Duplicate ISO code, team slug, skill | **rejected** (UNIQUE) |
| Terms republished v1 → v2 | consent row **still v1**, wording unchanged |
| Second consent for same assessment | **rejected** (UNIQUE) |
| `medical_details` / `criminal_record_details` | present only in `assessments`; absent from every public content table |

### 2.5 Credential-free build — empty environment

```
$ env -i PATH="$PATH" HOME="$HOME" npm run build
Route (app)                                 Size  First Load JS
┌ ○ /                                    44.5 kB         156 kB
├ ○ /_not-found                            133 B         103 kB
├ ƒ /api/health                            133 B         103 kB
├ ○ /robots.txt                            133 B         103 kB
└ ○ /sitemap.xml                           133 B         103 kB
ƒ Middleware                               33 kB
BUILD_EXIT=0
```

Note: the first build attempt **failed** — `next/font/google` could not reach
Google Fonts and broke the compile. That is a genuine defect in the plan, not a
flaky test. It was fixed by self-hosting Inter via `next/font/local` +
`@fontsource-variable/inter`, which also removed a third-party runtime dependency
and a privacy leak. The build above is the result after that fix.

### 2.6 Admin bootstrap security

```
$ ADMIN_EMAIL=… ADMIN_PASSWORD="[REDACTED-CREDENTIAL]" npm run seed:admin
[seed:admin] ADMIN_PASSWORD does not meet the policy (min 12 chars):
  - Use at least 12 characters.
  - Include at least one uppercase letter.
  - Include at least one number.

$ ADMIN_EMAIL=[REDACTED-EMAIL] ADMIN_PASSWORD="[REDACTED-CREDENTIAL]" npm run seed:admin
[seed:admin] ADMIN_PASSWORD must not be the same as the email address.

$ npm run seed:admin          # no env vars
[seed:admin] ADMIN_EMAIL and ADMIN_PASSWORD must be set (see .env.example).
[seed:admin] Nothing was created.

$ ADMIN_EMAIL=[REDACTED-EMAIL] ADMIN_PASSWORD="[REDACTED-CREDENTIAL]" npm run seed:admin
[seed:admin] Administrator created successfully.
  email         : [REDACTED-EMAIL]
  role          : owner
  password      : (hashed with Argon2id — not displayed)
  first login   : a password change will be required
--- grep the output for the plaintext password ---
PASS: plaintext password never printed

$ # second run
[seed:admin] Refusing to run: 1 administrator account(s) already exist.
```

Stored hash inspected directly:

```
hash prefix          : $argon2id$v=19$m=19456,t=2,p=1$P...
is argon2id v=19     : true
params m=19456,t=2,p=1: true
hash length          : 97 chars
must_change_password : 1
contains plaintext   : false
verify(correct pw)   : true
verify(wrong pw)     : false
same password -> different hashes (unique salt): true
hash cost            : 17 ms per hash
```

### 2.7 Running application (dev server, live)

```
GET /                      -> status=200, 26,860 B
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
content-security-policy: default-src 'self'; script-src 'self' 'nonce-26f8acb0971f4b79883df1697c5cff39' 'strict-dynamic' …

GET /admin           -> 307  -> /admin/login?next=%2Fadmin
GET /admin/settings  -> 307  -> /admin/login?next=%2Fadmin%2Fsettings
X-Robots-Tag: noindex, nofollow, noarchive

GET /does-not-exist  -> 404
```

Health endpoint, before and after configuring a database:

```
# no TURSO_DATABASE_URL
{"status":"degraded","database":"not_configured",…}   HTTP 503

# TURSO_DATABASE_URL=file:./.data/local.db
{"status":"ok","database":"ok","storage":"local",…}   HTTP 200
```

### 2.8 Storage round trip

```
driver              : local
public key shape    : true
put checksum (sha256): 33c9e76e5bb64425... size 208
exists()            : true
get() returns bytes : true
public URL          : /api/media/logo/a8765d23-…-b540b07d7824.png
private key shape   : private/assessments/demo-assessm...
private -> public URL blocked: PASS
path traversal blocked      : PASS
EXE disguised as .pdf rejected: true (unrecognised_type)
delete() then exists(): false
```

### 2.9 Destinations seed — no fabricated content

```
  US  United States of America   status=draft  summary=""  description=""
  CA  Canada                     status=draft  summary=""  description=""
  GB  United Kingdom             status=draft  summary=""  description=""
  LU  Luxembourg                 status=draft  summary=""  description=""
  AU  Australia                  status=draft  summary=""  description=""
  total: 5
```

Re-running is idempotent: `0 created, 5 skipped`.

### 2.10 Responsive & accessibility (foundation level)

```
accessibility:
  skip-link rendered and focusable .................. found
  semantic landmarks (main/section/header) .......... present
  <html lang="en"> .................................. present
  focus-visible outline defined globally ............ present
  reduced-motion handling:
    CSS: @media (prefers-reduced-motion) block ...... compiled into layout.css
    Motion: MotionConfig reducedMotion="user" ...... applied app-wide
responsive:
  fluid clamp() type scale .......................... compiled
  Tailwind breakpoints available .................... sm/md/lg/xl/2xl
```

Full responsive and WCAG verification belongs to Phase 7; Phase 1 only
establishes the primitives.

---

## 3. Requirement checks

| # | Requirement | Phase 1 status |
|---|---|---|
| 2 | Next 15 / TS strict / Tailwind / Framer / Lucide / Turso / Drizzle / Zod | ✅ all installed and exercised |
| 2 | Node version compatible with Next 15 + Netlify | ✅ Node 22 LTS, `engines` pinned |
| 2 | Builds without production DB credentials | ✅ proven with `env -i` |
| 3 | White bg, red primary, blue secondary, charcoal | ✅ tokens in `globals.css` |
| 3 | Buttons have a blue active state | ✅ `active:bg-accent-700` on primary |
| 3 | Glassmorphism utilities | ✅ `glass`, `glass-strong`, `glass-dark` |
| 3 | Reduced-motion respected | ✅ CSS media query + `MotionConfig` |
| 4/19 | Nothing hardcoded that an admin must edit | ✅ `site_settings`, `website_pages`, `homepage_sections` tables; placeholder page has no agency name |
| 5 | 5 destinations seeded, nothing fabricated | ✅ drafts, name + ISO only |
| 9 | Reference number generation | ✅ Crockford base32, CSPRNG, collision-safe |
| 13 | Statuses | ✅ `new / under_review / additional_info_required / reviewed / closed` |
| 14 | Public vs private media separation | ✅ two Blobs stores, guarded `publicUrl` |
| 15 | FKs, indexes, uniques, deletion rules | ✅ 47 FKs verified |
| 15 | Additive versioned migrations | ✅ `drizzle/0000_init.sql` only |
| 16 | Argon2id, DB sessions, audit tables, rate-limit tables | ✅ schema + hashing done; enforcement is Phase 3 |
| 17 | Sitemap, robots.txt, noindex on admin | ✅ live |
| 18 | Netlify config + env documentation | ✅ `netlify.toml`, `docs/DEPLOYMENT.md` |

---

## 4. Deviations from the approved proposal

| Item | Proposed | Delivered | Reason |
|---|---|---|---|
| Table count | 28 | **33** | I under-counted the proposal (auth 3 + media 1 + settings 5 + services 2 + destinations 5 + people 2 + assessments 12 + operations 3 = 33). No table was added beyond what the proposal described. |
| Brand font delivery | not specified | **self-hosted** `next/font/local` | `next/font/google` broke the credential-free build and added a third-party dependency + privacy leak. |
| ESLint config | flat | **FlatCompat bridge** | Next 15.5 ships eslintrc-style configs; the direct-import form did not resolve. |

No other functional deviation. No destructive schema change was made. No
database was created, deleted or recreated outside the throwaway
`.data/verify-scratch.db` and local `.data/local.db`.

---

## 5. Known limitations (deliberately deferred)

1. **Rate limiting is schema-only.** `login_attempts` and `rate_limit_buckets`
   exist, but no code enforces them yet — that is Phase 3.
2. **No assessment API.** `reference.ts` and the tables exist; the POST route
   that uses them is Phase 5.
3. **`/api/media/*` and `/api/files/*` are not implemented.** `publicUrl()` and
   the private-URL guard return paths that no route serves yet (Phases 2 and 6).
4. **`middleware.ts` is a pre-filter, not the security boundary.** It only checks
   for a cookie's presence. The authoritative session check lands in Phase 3.
5. **The root page is a placeholder shell.** It contains no agency identity, by
   design, and is replaced in Phase 2.
6. **CSP allows `'unsafe-inline'` for styles.** Required by Tailwind's injected
   brand-colour CSS variables. Scripts already use a per-request nonce.

---

## 6. Not claimed

- The site is **not deployed**. No Netlify site exists, no Turso database exists.
- No production smoke test has been run, because there is no production.
- No content has been authored. Ten of the eleven public pages do not exist yet.
- Phase 2 has **not** begun.

---

## 7. Approval requested to start Phase 2

Phase 2 — Public Website and UI:

- Site layout: database-driven header (logo from `site_settings`), footer, desktop
  nav, mobile nav with the **Admin Login link hidden on phones**, sticky
  glassmorphic header with scroll transition
- Homepage composed from `homepage_sections` rows, with a hardcoded
  **"Book a Consultation Now"** CTA in the navigation and hero
- About, Services (+ detail), Destinations (+ detail), Testimonials, Team, FAQ,
  Contact, Terms, Privacy — all reading from Turso
- Professional empty states wherever an admin has not yet added content
- Dynamic metadata per page from `seo_settings`; sitemap extended with DB routes
- Brand colours and logo injected from `site_settings` as CSS variables

Phase 2 requires no destructive schema change. If it turns out that one is
needed, I will stop, explain the exact SQL, its impact and the rollback before
touching anything.

Reply **"approve Phase 2"** to proceed, or tell me what to change.
