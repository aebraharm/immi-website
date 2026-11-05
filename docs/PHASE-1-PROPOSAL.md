# Phase 1 Proposal — Foundation & Database Architecture

**Project:** Premium immigration agency website (public site + private admin portal)
**Status:** PROPOSAL ONLY — no application code written, no commits made
**Branch:** `arena/cdcb43ad-immi-website`
**Date:** 2026-11-03

---

## 0. How this document is organised

| Section | What it covers |
|---|---|
| 1 | What I checked before proposing (repo state, package availability) |
| 2 | Decisions I need you to confirm (4 open questions) |
| 3 | Technology stack, exact pinned versions, Node runtime |
| 4 | Folder architecture |
| 5 | Database design — full schema, keys, indexes, deletion rules |
| 6 | Migration strategy |
| 7 | Storage strategy (public vs private files) |
| 8 | Security architecture |
| 9 | Environment variables |
| 10 | Design system / tokens |
| 11 | Build & Netlify configuration, credential-free builds |
| 12 | Phase 1 task list + the exact evidence I will produce |
| 13 | Things I will deliberately **not** build (per your rules) |

Plain-language explanations are marked **In plain terms:**. Everything else is engineering detail.

---

## 1. Pre-flight findings

- The repository contains only a placeholder `README.md`. There is no existing code, config, schema or dependency to preserve. A greenfield build is safe — nothing to break, nothing to migrate.
- Verified available versions on the npm registry (3 Nov 2026):

| Package | Latest | What I propose | Why |
|---|---|---|---|
| `next` | 16.4.5 | **15.5.29** (`next-15` backport line) | You specified Next.js 15. 15.5.29 is the last, most-patched 15.x release. |
| `react` / `react-dom` | 19.3.1 | **19.3.1** | Required by Next 15 App Router. |
| `drizzle-orm` | 0.45.4 | **0.45.4** | Current stable, supports libSQL. |
| `drizzle-kit` | 0.31.11 | **0.31.11** | Matches ORM. |
| `@libsql/client` | 0.18.0 | **0.18.0** | Official Turso driver, HTTP + local-file modes. |
| `tailwindcss` | 4.3.4 | **4.3.4** | v4, CSS-first config (`@theme`), no `tailwind.config.js` needed. |
| `framer-motion` | 14.9.0 | **14.9.0** | Supports React 19 (verified peer range `^18 || ^19`). |
| `zod` | 4.6.7 | **4.6.7** | Single source of truth for all validation. |
| `@netlify/blobs` | 11.1.7 | **11.1.7** | Private/public file storage. |
| `@netlify/plugin-nextjs` | 5.16.6 | **5.16.6** | Official adapter. |
| `@node-rs/argon2` | 2.2.2 | **2.2.2** | Native Argon2id hashing — fast, no WASM overhead. |

**In plain terms:** every technology you asked for is current and compatible. Next.js 15 is one major version behind the newest release, but it is patched, still supported, and it is what you specified.

---

## 2. Decisions I need from you before coding

These four items change real code. Everything else in this document I can proceed with once you approve.

### Q1 — Build-time database access (most important)

Your requirement: *"The application must build successfully without requiring production database credentials during static compilation."*

These two requirements conflict at the edges, so I need your choice:

- Requirement 17 says published content **must be indexable**.
- Requirement 19 says content **must be database-driven and admin-editable**.
- Requirement 2 says the **build must not need database credentials**.

If public pages are statically pre-rendered at build time, the HTML Google indexes is whatever existed at build. An admin edit would then only appear after a rebuild — which contradicts admin editability.

| Option | Behaviour | Trade-off |
|---|---|---|
| **A (recommended)** | Public pages are dynamically rendered (server-rendered on each request, with a short-lived cache). Build never touches the DB. Admin edits appear immediately. SEO is fully intact because crawlers receive complete server-rendered HTML. | Slightly higher function invocations on Netlify; no benefit from full static export. |
| **B** | Static pre-render with `generateStaticParams` + on-demand revalidation (`revalidatePath`) triggered by admin saves, and a Netlify build hook for safety. | Fastest pages; but a DB outage at build time fails the build unless a fallback is coded, and there is a window where content is stale. |
| **C** | Hybrid: marketing pages static, destination/service detail pages dynamic. | More moving parts to reason about and test. |

I recommend **A**. It satisfies every stated requirement without a stale-content window, and Netlify's CDN + Next caching keeps it fast.

### Q2 — Admin credential bootstrap

You supplied `[REDACTED-EMAIL]` / `[REDACTED-EMAIL]` as bootstrap credentials, and separately required that credentials never appear in source code.

Proposal: **no password literal anywhere in the repo.** Instead:

- `scripts/seed-admin.ts` — a one-time Node CLI command. It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment (your shell or a local `.env.local` that is git-ignored), hashes with Argon2id, inserts the administrator with `mustChangePassword = true`, and prints only `Created administrator: [REDACTED-EMAIL] (password change required on first login)` — never the password.
- The command refuses to create a second administrator if one already exists (idempotent, no accidental reset).
- `.env.local` is not committed; `.env.example` contains empty placeholders only.
- For your convenience I will run the seed locally in a later phase so the login works exactly as you specified.

**In plain terms:** the password you gave me gets typed into a command once, on your machine, instead of being written into the code where anyone with the repo could read it. The database then only ever holds a scrambled (hashed) version that cannot be reversed.

Confirm this, or tell me you'd rather seed via a Netlify environment variable + first-run bootstrap endpoint (less safe — it exposes an unauthenticated creation surface until first use).

### Q3 — Argon2 native module vs bcrypt

`@node-rs/argon2` is a prebuilt native binary and is my recommendation (Argon2id is the current OWASP first choice). If you want zero native dependencies for maximum Netlify portability, I'll use `bcryptjs` instead. Both are acceptable; Argon2id is stronger.

### Q4 — Locale of the assessment form

The form has a "Nationality" field and "Preferred salary currency". Do you want a fixed static country list (~200 entries, from a static file — this is form-field definition, not editable content, so it's allowed by your rules), or a curated shortlist? I propose a static ISO-3166 list for nationality/residence, and a `countries` table for **destinations** (admin-managed, as required).

---

## 3. Technology stack

```
Framework      Next.js 15.5.29 — App Router, Server Components, Server Actions
Language       TypeScript 5.x, "strict": true + noUncheckedIndexedAccess, exactOptionalPropertyTypes
Styling        Tailwind CSS v4 (CSS-first @theme tokens) + small CSS-variable layer
Animation      Framer Motion 14.9 (client islands only, reduced-motion aware)
Icons          lucide-react
Database       Turso (libSQL) in production · local libSQL file in development
ORM            Drizzle ORM 0.45 + drizzle-kit 0.31 (versioned SQL migrations)
Validation     Zod 4.6 — shared schemas, server re-validation on every mutation
Storage        Netlify Blobs (public + private stores), local filesystem adapter in dev
Auth           Custom DB-backed sessions (no third-party auth vendor)
Password hash  Argon2id (@node-rs/argon2)
Deployment     Netlify + @netlify/plugin-nextjs 5
Runtime        Node **22 LTS** (Netlify default; Next 15.5 requires >= 18.18)
Package mgr    npm (package-lock.json committed)
```

**In plain terms:**
- **Next.js App Router** lets one codebase serve both the public website and the admin portal, and lets us render pages on the server so database content is in the HTML that search engines read.
- **Drizzle ORM** gives type-safe database access and generates real SQL migration files we can read, review and roll back. Nothing is auto-magicked at deploy time.
- **Zod** schemas are written once and used twice: in the browser for instant feedback and again on the server, because the browser can never be trusted.

**Node 22** is chosen because it is the Netlify default runtime, is supported by Next 15.5, and is what local builds will use — so dev and production behave identically.

---

## 4. Folder architecture

```
immi-website/
├─ docs/                            # proposals, deployment + security runbooks
│  └─ PHASE-1-PROPOSAL.md
├─ drizzle/                         # generated, versioned SQL migrations + meta
├─ scripts/
│  ├─ seed-admin.ts                 # one-time admin bootstrap (env-driven)
│  ├─ seed-destinations.ts           # creates the 5 required destinations as DRAFTS, empty fields
│  └─ migrate.ts                    # runs pending migrations against TURSO
├─ public/                          # only static, non-editable assets (favicon fallback, og fallback)
├─ src/
│  ├─ app/
│  │  ├─ (site)/                    # PUBLIC website — own layout, header, footer
│  │  │  ├─ page.tsx                          Home
│  │  │  ├─ about/page.tsx
│  │  │  ├─ services/page.tsx
│  │  │  ├─ services/[slug]/page.tsx
│  │  │  ├─ destinations/page.tsx
│  │  │  ├─ destinations/[slug]/page.tsx      includes immigration process content
│  │  │  ├─ testimonials/page.tsx
│  │  │  ├─ team/page.tsx
│  │  │  ├─ faq/page.tsx
│  │  │  ├─ contact/page.tsx
│  │  │  ├─ terms/page.tsx
│  │  │  ├─ privacy/page.tsx
│  │  │  ├─ assessment/page.tsx                multi-step form
│  │  │  └─ assessment/success/[ref]/page.tsx  confirmation (no-store)
│  │  ├─ (admin)/
│  │  │  ├─ admin/login/page.tsx
│  │  │  └─ admin/…                            dashboard + 19 modules
│  │  ├─ api/
│  │  │  ├─ assessment/route.ts                POST public submission
│  │  │  ├─ admin/…                            admin mutations, uploads, downloads
│  │  │  ├─ files/[...key]/route.ts            authorised streaming of PRIVATE files only
│  │  │  └─ health/route.ts
│  │  ├─ sitemap.ts · robots.ts · not-found.tsx · error.tsx
│  │  └─ layout.tsx · globals.css
│  ├─ components/
│  │  ├─ ui/                        # Button, Card, Input, Select, Checkbox, Modal, Table…
│  │  ├─ motion/                    # Reveal, PageTransition, AnimatedCounter (client)
│  │  ├─ site/                      # Header, MobileNav, Footer, Hero, SectionHeading…
│  │  ├─ forms/                     # assessment step components, field groups
│  │  └─ admin/                     # sidebar, data tables, editors, uploaders
│  ├─ db/
│  │  ├─ schema/                    # split by domain: auth, settings, content, destinations,
│  │  │                             # assessments, testimonials, team, media, audit
│  │  ├─ index.ts                   # drizzle client (Turso prod / file dev)
│  │  ├─ seed-data/                 # reference/fixture data (no fake public copy)
│  │  └─ queries/                   # typed read/write functions, one module per domain
│  ├─ lib/
│  │  ├─ auth/                      # session, password, rbac, csrf, rate-limit
│  │  ├─ storage/                   # StorageProvider interface + blobs + local adapters
│  │  ├─ files/                     # MIME sniffing, size limits, magic-number checks
│  │  ├─ validation/                # shared Zod schemas
│  │  ├─ utils/                     # cn, format, slug, reference-number
│  │  └─ config/                    # env parsing, site constants
│  ├─ types/
│  └─ middleware.ts                 # admin session gate + security headers
├─ netlify.toml
├─ drizzle.config.ts
├─ postcss.config.mjs
├─ tsconfig.json
├─ .env.example                     # placeholders only — never real values
└─ .gitignore
```

**Why `(site)` and `(admin)` route groups:** two completely different shells (public marketing layout vs admin app layout) without URL prefixes leaking into paths. It also makes the "no client portal" requirement structurally obvious — there is no client-auth group at all.

**In plain terms:** `app/` is the routing map (one folder = one URL). `components/` is the reusable visual furniture. `db/` is everything that talks to the database. `lib/` is the toolbox — security, file handling, validation, helpers. Each area has one job, so a bug is easy to locate and a change is hard to break elsewhere.

---

## 5. Database design

### 5.1 Conventions (applied to every table)

- **IDs:** uuid v4 text PKs for records (`crypto.randomUUID()`), so IDs are non-enumerable. Human-facing slugs are separate unique columns.
- **Timestamps:** `created_at` / `updated_at` as INTEGER unix-ms (Drizzle `timestamp_ms`, mode `'timestamp'`), UTC everywhere, formatted in the UI.
- **Soft delete:** content tables carry `archived_at` (nullable) plus `status` (`draft | published | archived`). Your requirement is "delete **or archive** safely" — so nothing is hard-deleted through the UI; archives vanish from the public site but remain recoverable.
- **Referential integrity:** FKs declared in SQL and enforced by libSQL, with explicit `onDelete` per relationship (listed below).
- **Text:** `TEXT` columns; long-form rich content as Markdown text, sanitized on render.
- **Money/salary:** stored as integer minor units + ISO-4217 currency code (never floats).
- **No destructive changes:** all Phase 1 DDL is additive-on-empty. Later changes are new migration files only.

### 5.2 Tables

#### Authentication & administration

**`admins`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid |
| email | TEXT NOT NULL UNIQUE | lowercased on write |
| password_hash | TEXT NOT NULL | Argon2id; never selected by any public query |
| full_name | TEXT NOT NULL | |
| role | TEXT NOT NULL DEFAULT 'admin' | `owner \| admin \| editor` |
| is_active | INTEGER NOT NULL DEFAULT 1 | disable without deleting |
| must_change_password | INTEGER NOT NULL DEFAULT 1 | forced first-login change |
| password_changed_at | INTEGER | |
| failed_attempts | INTEGER NOT NULL DEFAULT 0 | |
| locked_until | INTEGER | brute-force lockout |
| last_login_at | INTEGER | |
| created_at / updated_at | INTEGER NOT NULL | |

**`admin_sessions`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid (never the cookie value) |
| admin_id | TEXT NOT NULL → admins.id ON DELETE CASCADE |
| token_hash | TEXT NOT NULL UNIQUE | SHA-256 of the opaque cookie token — DB leak ≠ session theft |
| csrf_secret | TEXT NOT NULL | per-session CSRF token material |
| ip_hash | TEXT | SHA-256 of IP (privacy-preserving rate limiting / audit) |
| user_agent | TEXT | truncated |
| created_at | INTEGER NOT NULL | |
| expires_at | INTEGER NOT NULL | absolute expiry (8h default) |
| last_seen_at | INTEGER NOT NULL | sliding idle timeout (30m default) |
| revoked_at | INTEGER | set on logout / “revoke all sessions” |

Indexes: `(admin_id)`, `(token_hash)` unique, `(expires_at)` for cleanup.

**`admin_password_resets`** — id, admin_id, token_hash (unique), expires_at, used_at, created_at. (No *client* password recovery exists; this is admin-only recovery.)

#### Settings, branding & SEO

**`site_settings`** — single-row key/value-free typed table (all columns, no JSON blob for the fields you listed):
agency_name, tagline, short_description, long_description,
logo_asset_id → media_assets, favicon_asset_id → media_assets, og_image_asset_id → media_assets,
brand_primary_color, brand_secondary_color, brand_accent_state_color, brand_text_color,
email, phone_primary, phone_secondary, whatsapp, address_line1, address_line2, city, state, postal_code, country,
office_hours, google_maps_embed_url,
social_facebook, social_instagram, social_linkedin, social_x, social_tiktok, social_youtube,
privacy_retention_days, privacy_data_contact_email, privacy_allow_indexing,
updated_at, updated_by → admins.id ON DELETE SET NULL

**`seo_settings`** — per-route rows: route (TEXT UNIQUE, e.g. `/`, `/about`), title, description, og_title, og_description, og_image_asset_id, no_index (int), canonical_override, updated_at.

**`website_pages`** — one row per editable long-form page:
id, slug UNIQUE (`terms`, `privacy`, `about`), title, subtitle, content_md, version INTEGER, status, published_at, updated_by, created_at, updated_at.
`version` increments on every publish — this is what consent records point at.

**`homepage_sections`** — id, section_key UNIQUE (`hero`, `why_us`, `services_preview`, `destinations_preview`, `stats`, `cta_band`, `testimonials_preview`, `faq_preview`), heading, subheading, body_md, cta_label, cta_href, image_asset_id, is_visible, display_order, updated_at.
Content is data; the *component* per key is code. An admin can reorder, hide and rewrite, not invent new layouts.

**`faqs`** — id, question, answer_md, category, display_order, status, created_at, updated_at.

#### Services

**`services`** — id, slug UNIQUE, title, short_description, description_md, icon_name (lucide key, validated against an allowlist), image_asset_id, cta_label, display_order, status, created_at, updated_at.
**`service_features`** — id, service_id → services.id ON DELETE CASCADE, label, display_order. (Bullet lists without JSON blobs.)

#### Destinations, countries & immigration

**`countries`** — destination countries, admin-managed:
id, name, iso_code UNIQUE (2-letter), slug UNIQUE, flag_asset_id → media_assets, hero_image_asset_id, summary, description_md, is_featured, display_order, status, created_at, updated_at.
Seeded **as drafts with names + ISO codes only** for USA, Canada, United Kingdom, Luxembourg, Australia. No invented descriptions, requirements or fees — those are entered by you.

**`destinations`** — the destination-specific programme/visa-route layer (a country can have several routes: e.g. skilled worker vs employer-sponsored):
id, country_id → countries.id ON DELETE RESTRICT, slug UNIQUE, title, summary, description_md, processing_info_md, important_notice_md, status, is_featured, display_order, created_at, updated_at.

**`visa_categories`** — id, destination_id → destinations.id ON DELETE CASCADE, name, code, description_md, is_active, display_order.

**`destination_requirements`** — id, destination_id → CASCADE, category (`eligibility | documents | language | qualification | procedure | notice | link`), label, detail_md, link_url, display_order.
*Why one table with a `category` column instead of eight tables:* your list (eligibility requirements, required documents, language requirements, professional qualifications, application procedures, important notices, relevant links) is the same shape — an ordered list of labelled items per destination. One table keeps the admin UI as one repeatable list editor and the schema honest. Every field is optional/free-text: nothing is pre-filled.

**`employment_opportunities`** — id, destination_id → CASCADE, country_id → countries.id ON DELETE RESTRICT, title, sector, description_md, is_active, display_order, created_at, updated_at.
(Public copy is never fabricated. If empty, the page shows a professional empty state.)

#### Testimonials & team

**`testimonials`** — id, client_display_name, client_country, service_category, quote, photo_asset_id → media_assets, video_asset_id → media_assets, video_url, status (`draft | published | archived`), display_order, created_at, updated_at, archived_at.
*(No `client_id` column exists — there is no client account system. Correct by construction.)*

**`team_members`** — id, full_name, slug UNIQUE, title, department, bio_md, qualifications, expertise, photo_asset_id, social_linkedin, social_x, social_facebook, social_instagram, email_public, display_order, status, created_at, updated_at.

#### Media

**`media_assets`** — id, storage_key UNIQUE, storage_provider (`blobs | local`), visibility (`public | private`), purpose (`logo | favicon | flag | destination | team | testimonial | video | article | cv | other`), original_filename, stored_filename, mime_type, detected_mime_type (from magic bytes), extension, size_bytes, width, height, checksum_sha256, alt_text, caption, uploaded_by → admins.id ON DELETE SET NULL, created_at, archived_at.
Indexes: `(visibility, purpose)`, `(created_at)`.
Public URLs are derived only when `visibility = 'public'`. Private keys are never returned to any client without an authorised proxy request.

#### Assessments (the core private data)

**`assessments`**
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | uuid |
| reference_number | TEXT NOT NULL UNIQUE | `IMA-YYYY-XXXXXXXX` (Crockford base32, 8 chars, crypto-random) |
| idempotency_key | TEXT UNIQUE | client-generated; makes retries safe |
| -- Section A |
| full_name | TEXT NOT NULL |
| date_of_birth | TEXT NOT NULL | ISO `YYYY-MM-DD` (no TZ drift) |
| gender | TEXT NOT NULL |
| nationality | TEXT NOT NULL |
| country_of_residence | TEXT NOT NULL |
| residential_address | TEXT NOT NULL |
| city / state_province / postal_code | TEXT NOT NULL |
| mobile_country_code / mobile_number | TEXT NOT NULL |
| alt_mobile_country_code / alt_mobile_number | TEXT NULL |
| email | TEXT NOT NULL | lowercased |
| marital_status | TEXT NOT NULL |
| has_children | INTEGER NOT NULL | 0/1 |
| number_of_children | INTEGER NULL | required iff has_children |
| -- Section B |
| has_passport | INTEGER NOT NULL |
| passport_number | TEXT NULL |
| passport_city_of_issue | TEXT NULL |
| passport_issue_date | TEXT NULL |
| passport_expiry_date | TEXT NULL |
| -- Section D (current employment) |
| is_currently_unemployed | INTEGER NOT NULL DEFAULT 0 |
| current_employer / current_position / current_country | TEXT NULL |
| current_start_date | TEXT NULL | ISO month |
| current_salary_amount | INTEGER NULL | minor units |
| current_salary_currency | TEXT NULL |
| -- Sections H–L |
| has_medical_condition | INTEGER NOT NULL |
| medical_details | TEXT NULL | **sensitive** |
| has_criminal_record | INTEGER NOT NULL |
| criminal_record_details | TEXT NULL | **sensitive** |
| has_travelled_abroad | INTEGER NOT NULL |
| travelled_countries | TEXT NULL |
| has_family_abroad | INTEGER NOT NULL |
| family_abroad_countries | TEXT NULL |
| has_professional_exams | INTEGER NOT NULL |
| professional_exams_notes | TEXT NULL |
| -- Section G |
| preferred_country_id | TEXT → countries.id ON DELETE SET NULL |
| preferred_country_text | TEXT NULL | falls back if the country was archived |
| preferred_occupation | TEXT NOT NULL |
| expected_salary_amount | INTEGER NULL |
| expected_salary_currency | TEXT NULL |
| -- Lifecycle |
| status | TEXT NOT NULL DEFAULT 'new' | `new · under_review · additional_info_required · reviewed · closed` |
| submitted_at | INTEGER NOT NULL |
| reviewed_at | INTEGER NULL |
| reviewed_by | TEXT → admins.id ON DELETE SET NULL |
| submission_ip_hash | TEXT | SHA-256, privacy-preserving |
| consent_record_id | TEXT → consent_records.id ON DELETE RESTRICT |
| created_at / updated_at | INTEGER NOT NULL |

Indexes: `(reference_number)` unique, `(email)`, `(submitted_at)`, `(status)`, `(preferred_country_id)`, `(idempotency_key)` unique.
**In plain terms:** the medical and criminal-record answers live in the same private record as the rest, but every query that feeds a browser checks the admin role first, and there is no public endpoint that can return them.

**`applicant_education`** — id, assessment_id → assessments.id **ON DELETE CASCADE**, qualification_level (`secondary|diploma|bachelor|master|other`), institution_name, country, year_completed, display_order. Multiple rows per assessment.
**`applicant_employment_history`** — id, assessment_id → CASCADE, record_type (`current | previous`), employer_name, position, country, start_date, end_date, years_worked, monthly_salary_amount, monthly_salary_currency, display_order.
*Why one table with `record_type`:* "current employment" and "multiple previous employments" are the same shape. One repeatable list editor in the admin UI, one list in the public-facing record, and no near-duplicate table to keep in sync.
**`applicant_skills`** — id, assessment_id → CASCADE, skill (validated against the fixed 20-item allowlist), UNIQUE (assessment_id, skill).
**`applicant_languages`** — id, assessment_id → CASCADE, language (`english|french|spanish|german`), proficiency (`basic|intermediate|advanced|fluent`), UNIQUE (assessment_id, language).
**`applicant_examinations`** — id, assessment_id → CASCADE, exam_name, result_or_notes, display_order. (Covers IELTS / NCLEX / AHPRA / other with no invented data.)
**`applicant_travel_history`** — id, assessment_id → CASCADE, country, notes, display_order.
**`applicant_family_abroad`** — id, assessment_id → CASCADE, country, relationship, display_order.
**`assessment_attachments`** — id, assessment_id → assessments.id **ON DELETE RESTRICT**, media_asset_id → media_assets.id ON DELETE RESTRICT, kind (`cv`), created_at.
  *RESTRICT, not CASCADE:* a deleted assessment must never silently orphan a private CV — deletion has to be a deliberate, logged, two-step operation.
**`consent_records`** — id, assessment_id → assessments.id ON DELETE RESTRICT, terms_page_id → website_pages.id ON DELETE RESTRICT, terms_version, privacy_page_id, privacy_version, consent_text (exact wording shown at the time), accepted_at, ip_hash, user_agent.
  *This is the immutability guarantee you asked for:* the version numbers and the exact wording are copied into the consent row at submission. Editing or republishing Terms later cannot retroactively change what a past applicant agreed to.
**`assessment_notes`** — id, assessment_id → assessments.id ON DELETE CASCADE, admin_id → admins.id ON DELETE SET NULL, body, is_pinned, created_at, updated_at. (Internal only.)
**`assessment_status_history`** — id, assessment_id → CASCADE, from_status, to_status, admin_id → SET NULL, note, created_at. (Every status change is attributable.)

#### Operations

**`activity_logs`** — id, actor_admin_id → admins.id ON DELETE SET NULL, actor_email_snapshot, action (e.g. `assessment.status_changed`), entity_type, entity_id, summary, metadata_json (sanitized — never sensitive values), ip_hash, created_at.
Indexes: `(created_at)`, `(entity_type, entity_id)`, `(actor_admin_id)`.
**`login_attempts`** — id, email_attempted_hash, ip_hash, success (int), reason, created_at. Index `(ip_hash, created_at)` for rate limiting.
**`rate_limit_buckets`** — optional DB-backed limiter (key, window_start, count, expires_at) used where in-memory state isn't shared across serverless instances. *(Decision: Netlify functions are ephemeral, so rate limiting is DB-backed for correctness, with an in-memory fast path.)*

### 5.3 Deletion & archival policy

| Action | Behaviour |
|---|---|
| Destination archived | `status='archived'`; hidden publicly; assessments keep a text fallback of the country name |
| Country archived | `ON DELETE RESTRICT` if referenced by assessments — archive instead of delete |
| Assessment deleted | Requires explicit typed confirmation; restricted by attachments rule; writes an activity log |
| Assessment note deleted | Cascades with its assessment only |
| Admin deactivated | `is_active=0`, all sessions revoked, logs preserved (`SET NULL` keeps the history) |
| Media archived | Public rows stop being served; referenced rows are protected by RESTRICT |

**No destructive schema change will be applied at any point without your written approval of the exact SQL, its impact, and rollback steps.**

---

## 6. Migration strategy

- `drizzle-kit generate` produces numbered SQL files in `drizzle/` (`0000_init.sql`, `0001_…`). They are committed, readable, and additive.
- `drizzle-kit migrate` (via `scripts/migrate.ts`) applies pending migrations to whichever `TURSO_DATABASE_URL` is set.
- **Development:** local libSQL file (`file:./.data/local.db`, git-ignored) → fast, offline, no credentials.
- **Production:** Turso. Migrations are run **explicitly** by you (or by a documented CI step) — never automatically on request/boot, so a bad migration can't fire on a cold start.
- Every migration is reviewed before application. Rollback for Phase 1 = dropping newly created tables in a fresh database (nothing pre-existing is touched).
- `drizzle-kit studio` available locally for visual inspection of the schema.

---

## 7. Storage strategy

**Two physical stores, one interface.**

```
StorageProvider (interface)
 ├─ NetlifyBlobsProvider    → store 'immi-public'  (public site media)
 │                          → store 'immi-private' (applicant CVs)
 └─ LocalFilesystemProvider → ./.data/uploads/{public,private}  (development only)
```

| | Public store | Private store |
|---|---|---|
| Contents | logo, favicon, flags, destination/team/testimonial photos, video | applicant CVs, any sensitive attachment |
| URL served | `/api/media/<key>` or Blobs public URL, long cache headers | **never public** — only `/api/files/<key>` after an admin session check |
| Access check | none needed | session + role + audit log line per download |
| Naming | `public/<purpose>/<uuid>.<ext>` | `private/assessments/<assessmentId>/<uuid>.<ext>` |

**Upload validation (server-side, never trusting the browser):**
1. Size cap (CV 10 MB, images 8 MB, video 100 MB) checked before reading the body.
2. Extension allowlist per purpose.
3. **Magic-number signature check** — PDF `%PDF-`, DOCX (ZIP `PK\x03\x04` + `[Content_Types].xml` presence), JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF….WEBP`, MP4 `ftyp`.
4. Declared MIME must agree with the detected signature, or the upload is rejected.
5. SHA-256 checksum stored; **filenames are never trusted** — the stored key is a fresh uuid and the original name is kept only as metadata.
6. No `Content-Disposition: inline` for private files; downloads force `attachment` and `X-Content-Type-Options: nosniff`.

**In plain terms:** public pictures go in a shop window anyone can photograph; CVs go in a locked filing cabinet where every time the drawer opens, we write down who opened it.

---

## 8. Security architecture

| Control | Implementation |
|---|---|
| Password hashing | Argon2id (or bcrypt cost 12), per-password salt, never reversible, never logged |
| Sessions | Opaque 256-bit random token; only its SHA-256 hash is stored; `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`, `__Host-` prefix |
| Expiry / revocation | 8 h absolute + 30 min idle; logout revokes; "revoke all sessions" available; expired rows swept |
| Route protection | `middleware.ts` gate on `/admin/*` **plus** a server-side `requireAdmin()` check inside every admin page, action and API route (middleware alone is never the only gate) |
| RBAC | `owner` (all), `admin` (content + assessments), `editor` (content only, no assessments, no settings) |
| CSRF | Per-session token; every state-changing request is a POST/PATCH/DELETE with a double-submit token verified against the session; SameSite as defence-in-depth |
| Rate limiting | Login: 5 attempts / 15 min per email+IP, exponential lockout; public assessment: 5 / hour per IP hash; uploads throttled per admin |
| Validation | Zod on every input, server-side; DB constraints back it up |
| SQL injection | Drizzle parameterised queries only; no string-concatenated SQL |
| XSS | No `dangerouslySetInnerHTML` on user content; Markdown rendered through a sanitizing pipeline with an allowlist |
| Clickjacking / headers | CSP (nonce-based for scripts), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS |
| Privacy | Sensitive fields never selected by list queries the UI doesn't need; no sensitive data in logs, error bodies or analytics; IP stored only as SHA-256; `noindex` on `/admin` and `/assessment/success` |
| Duplicate submissions | Client `idempotency_key` + `UNIQUE` constraint → a retry after a network error returns the **same** reference number instead of creating a second record |
| Audit | Every admin mutation logs actor, action, entity, timestamp, IP hash; log-writing never throws into the user's request path |
| Safe errors | Generic message to the client, real detail to server logs; no stack traces or SQL in responses |
| Secrets | Environment variables only; `.env.example` has empty placeholders; `.gitignore` covers `.env*` (except the example) |

---

## 9. Environment variables

```bash
# ---- Public (safe to expose to the browser) ----
NEXT_PUBLIC_SITE_URL=https://example.netlify.app

# ---- Database (Turso production) ----
TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
TURSO_AUTH_TOKEN=<token>

# ---- Local development only ----
# TURSO_DATABASE_URL=file:./.data/local.db      # no token required

# ---- Session / crypto ----
SESSION_COOKIE_NAME=immi_admin_session
SESSION_SECRET=<64+ random chars>

# ---- Admin bootstrap (used only by scripts/seed-admin.ts) ----
ADMIN_EMAIL=
ADMIN_PASSWORD=

[REDACTED-CREDENTIAL] ---- Storage ----
NETLIFY_BLOBS_SITE_ID=<auto-injected on Netlify>
NETLIFY_BLOBS_TOKEN=<auto-injected on Netlify>
STORAGE_DRIVER=blobs            # 'local' in development

# ---- Optional ----
RESEND_API_KEY=                 # only if you later want email notifications
```

Missing configuration behaviour: the app detects absent `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` at runtime and shows a clear, non-leaking "database not configured" state on **public** pages, while hard-failing with a specific log line on **admin** and write paths. `npm run build` never requires any of them.

---

## 10. Design system (tokens set in Phase 1, UI built in Phase 2)

```
Background   #FFFFFF  · surface #F8FAFC · charcoal text #111827
Primary red  #E11D2E  (hover #C2182A)
Secondary    #1D4ED8  · active/pressed button state #1E3FBF
Neutrals     50 → 900 scale
Glass        rgba(255,255,255,.65) + backdrop-blur(16px) + 1px white/10 border
Radius       12 / 16 / 24  ·  Shadow: 3 soft elevation levels
Type         Inter (variable, self-hosted) — display/title/body/label scale, fluid clamp()
Motion       Fast .18s · Base .32s · Slow .6s · easing cubic-bezier(.22,1,.36,1)
             All wrapped by a `MotionConfig` that respects prefers-reduced-motion
```

Buttons: red primary fill → **blue pressed/active** state, exactly as specified; focus rings use the secondary blue for visibility on white.

---

## 11. Build & Netlify configuration

- `netlify.toml`: `[build] command = "npm run build"`, `publish = ".next"`, `NODE_VERSION = "22"`, plugin `@netlify/plugin-nextjs`.
- `npm run build` must succeed with **zero** database and storage credentials present. I will prove this by building with an emptied environment.
- `next.config.ts`: strict mode, image remote patterns limited to the storage hosts, security headers, `typedRoutes`.
- Quality gates: `tsc --noEmit`, `next lint`, `drizzle-kit check`, and a schema-vs-DB drift check.

---

## 12. Phase 1 task list and the evidence I will produce

Phase 1 deliverables (only after your approval):

1. `package.json`, `tsconfig.json` (strict), `next.config.ts`, `postcss.config.mjs`, `netlify.toml`, `.gitignore`, `.env.example`.
2. All 28 tables in `src/db/schema/*` with FKs, indexes, uniques, cascade rules.
3. `drizzle/0000_init.sql` + drizzle meta, generated and reviewed.
4. `src/db/index.ts` — Turso/local client factory with a clear missing-config error.
5. `scripts/migrate.ts`, `scripts/seed-admin.ts`, `scripts/seed-destinations.ts` (drafts, names + ISO codes only).
6. `src/lib/storage/*` — provider interface + Blobs and local adapters.
7. `src/lib/env.ts` — Zod-validated environment parsing.
8. Design tokens in `globals.css`, base UI primitives (Button, Card, Input, Select, Field, Badge) with reduced-motion support.
9. `src/middleware.ts` + security headers.

**Evidence pack** (pasted as real terminal output, not claimed):

- `npm run build` exit code + route table, with the environment emptied.
- `tsc --noEmit` exit code — clean.
- `drizzle-kit generate` output + the actual `0000_init.sql`.
- Migration applied to a scratch local libSQL DB, then `sqlite3 .schema` / `PRAGMA foreign_key_check` output.
- `PRAGMA foreign_key_list` proof that cascade/restrict rules exist.
- A row inserted into each parent/child pair to prove FK enforcement actually rejects bad rows.
- The seed script's console output (proving no password is printed).
- `git status` showing exactly which files exist — **not committed**, since commits need your authorisation.

If any of that fails, I stop and report the failure rather than continuing.

---

## 13. Explicitly out of scope (per your rules)

- No client login / registration / dashboard / tracking / password recovery — not even placeholder routes.
- No fabricated agency name, logo, testimonials, team members, statistics, awards, visa requirements, fees, processing times or success stories. Every content table ships **empty** except: the 5 required destination countries (name + ISO code, status `draft`) and the Terms & Privacy page rows (empty body, `draft`).
- No hardcoded admin password in any file.
- No commits, no pushes, no PR until you authorise them.
- No database created, deleted or recreated without your explicit permission.

---

## 14. What I need back from you

1. **Approval of this Phase 1 architecture** (or a list of changes).
2. Answers to **Q1–Q4** in section 2.
3. Confirmation that Phase 1 may include running database migrations against a **scratch local** database only — no remote Turso project will be created or touched.

On your approval I will implement Phase 1 exactly as scoped above and return the evidence pack, then stop and wait.
