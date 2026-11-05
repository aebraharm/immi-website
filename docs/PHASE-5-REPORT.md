# Phase 5 Report — Applicant Assessment Form and Secure Submission Backend

**Project:** Premium immigration agency website (`immi-website`)
**Phase:** 5 of 7 — Public assessment form and submission
**Branch:** `arena/cdcb43ad-immi-website` (based on `bc53028`)
**Status:** Complete. All gates green. **Nothing committed, nothing pushed, nothing
deployed, no production account provisioned, no Phase 6 work started.**

---

## 1. Scope delivered

From the approved Phase 5 brief, every item is built:

| Requirement | Where it lives | Verified by |
| --- | --- | --- |
| Ten sectioned steps with progress, Back/Next, per-step validation | `src/components/assessment/wizard.tsx` | §7 UI suite (41 tests) |
| Conditional fields (passport, children count, employment detail, five yes/no details) | `src/components/assessment/steps.tsx` | §7 + schema suite |
| Repeatable education (1–8) and previous employment (0–10) | `steps.tsx` | schema suite |
| Skills multi-select (fixed 20-item list) | `steps.tsx` + `SKILLS` enum | schema suite |
| Languages: English/French/Spanish/German × Basic/Intermediate/Advanced/Fluent | `steps.tsx` + `LANGUAGES`, `PROFICIENCY_LEVELS` | schema suite |
| Employment preferences (destination, occupation, expected salary + currency) | `steps.tsx` (from published `countries`) | submission suite |
| Country/nationality selection over the full ISO 3166-1 list | `src/lib/data/countries-iso.ts` (202 entries) | schema suite (loops all 202) |
| CV upload, PDF/DOCX, 10 MB, content-validated, private storage | `src/lib/assessment/cv.ts` | submission suite (7 cases) |
| Review page before submit, with change links | `steps.tsx` → `ReviewStep` | UI suite |
| Mandatory Terms **and** Privacy consent, no preselect, versions + timestamps recorded | `wizard.tsx` + `submit.ts` | schema + submission suites |
| Server-side Zod validation of the whole form | `src/lib/assessment/schema.ts` | both |
| Unique reference generation (`IMA-2026-7QK3M2XA`) | `src/lib/assessment/reference-number.ts` | schema + submission suites |
| Duplicate prevention + idempotent retries | `submit.ts` | submission suite |
| Rate limiting + honeypot | `config.ts`, `submit.ts`, `rate-limit.ts` | submission suite |
| Loading state → reference → confirmation, no eligibility claim | `wizard.tsx` | UI suite |
| Agency branding + logo on form and receipt | `wizard.tsx`, `page.tsx` | UI suite |
| No client accounts, no applicant login, no read path | `src/app/api/assessment/route.ts` | route + submission suites |
| Compatible with Phase 6 without building it | `status = 'new'`, `assessment_status_history`, `activity_logs` untouched by this phase | §9 |

---

## 2. Database changes and migrations

**No table was added, altered or dropped. No migration was generated.** Every table,
column, index and constraint Phase 5 needs was created in Phase 1 and verified again
this phase by `drizzle-kit generate`, which reported:

```
No schema changes, nothing to migrate 😴
```

**One enum value added** — `activity_logs.action` gained `'assessment.submitted'`
(`src/db/schema/enums.ts`). This is a TypeScript-driven `TEXT` column with no SQL
`CHECK` constraint, so it is a **code-level** enum addition, not a schema change.
Adding it was necessary because a submission must appear in the administrative audit
trail, and inventing an out-of-list value would have made the log unqueryable by
action. Reversal: delete the line; nothing in the database changes.

### What Phase 5 relies on (built in Phase 1, now exercised for the first time)

| Constraint | Why it matters here |
| --- | --- |
| `assessments_reference_unique` | Two applicants can never receive the same reference, even under a race. |
| `assessments_idempotency_unique` | A retried POST after a dropped connection returns the original record instead of a duplicate. |
| `consent_records_assessment_unique` | One consent row per assessment; a second cannot be attached silently. |
| `assessments_children_consistency` | `number_of_children` exists **iff** `has_children = 1`. |
| `assessments_passport_consistency` | Passport fields are `NULL` **iff** `has_passport = 0`. |
| `applicant_skills_unique`, `applicant_languages_unique` | Duplicate skill/language rows rejected by the database as well as the schema. |
| `assessment_attachments` `ON DELETE RESTRICT` (both sides) | A CV cannot be orphaned by deleting an assessment; removal must be a deliberate Phase 6 operation. |
| `media_assets.visibility` + `publicUrlFor()` throwing for private keys | The private CV cannot acquire a public URL through any code path. |
| `rate_limit_buckets` | Survives serverless cold starts, so the 5-per-hour submission limit is real. |

---

## 3. Routes and files created or modified

### New — validation and domain logic (`src/lib/assessment/`, 7 files, 2 022 lines)

| File | Responsibility |
| --- | --- |
| `schema.ts` | The single source of truth. All eleven section schemas, `assessmentSchema` for the whole form, `validateStep()` for one screen, `stepForField()` for routing server errors back to the right screen. Coerces missing sections to empty ones so a hand-crafted request gets field messages, not type errors. |
| `draft.ts` | The browser's state shape, `emptyDraft()`, and the eleven `STEPS` definitions. |
| `submit.ts` | The submission service: rate limit → honeypot → whole-form validation → idempotency → consent against *currently published* policies → duplicate check → private CV store → one transaction → audit. |
| `cv.ts` | CV validation and private storage. Rejects non-documents by bytes, always writes `visibility: 'private'`, deletes the object if the registry insert fails, and offers `discardCv()` to unwind a failed transaction. |
| `reference-number.ts` | `IMA-YYYY-XXXXXXXX` from Crockford Base32 (no `I`, `L`, `O`, `U`), 40 bits of CSPRNG entropy, with a validating regex. |
| `reference.ts` | The form vocabulary shared by the UI and the schema: label maps for skills, languages, proficiency, qualification, gender, marital status, currencies. |
| `config.ts` | Public endpoint limits: 5 submissions/hour/IP, 20 rejected attempts/15 min/IP, 12 MB request ceiling, 24-hour duplicate window. |

### New — UI (`src/components/assessment/`, 3 files, 2 446 lines)

| File | Responsibility |
| --- | --- |
| `wizard.tsx` | The client wizard: draft state, progress rail, per-step validation, whole-form validation before submit, focus management, `AnimatePresence` step transitions that respect `prefers-reduced-motion`, loading panel, confirmation panel, consent block. |
| `steps.tsx` | The eleven step views plus the review summary. All are controlled: they receive `{ draft, errors, update }` and never hold state of their own. |
| `controls.tsx` | Accessible text/textarea/select/yes-no/checkbox-tile/row controls built on the existing `Field` primitive. |

### New — public endpoint

`src/app/api/assessment/route.ts` — `POST` only (plus an explicit `GET` that returns
405). Refuses non-multipart bodies with 415 before reading anything, refuses a
declared oversize body with 413, caps the JSON answers at 60 KB, then delegates to
`submitAssessment()`. Success returns **exactly** `{ ok, referenceNumber, submittedAt,
receiptToken, created }` with `Cache-Control: no-store`.

### Rewritten — the page

`src/app/(site)/assessment/page.tsx` — now renders `<AssessmentWizard>` when the Terms
and Privacy pages are published and at least one destination exists; otherwise it
renders an honest "not open yet" panel naming what is missing. The page previously
showed a disabled "Begin assessment" button and the sentence "The multi-step form and
secure submission are delivered in the next phase" — both removed.

### Modified — existing modules

| File | Change |
| --- | --- |
| `src/db/schema/enums.ts` | `'assessment.submitted'` added to `ACTIVITY_ACTIONS` (§2). |
| `src/lib/auth/rate-limit.ts` | `peekRateLimit()` added: reads a counter without incrementing it, so a blocked caller cannot extend its own lockout by retrying. Additive only; login limiting is untouched. |

No Phase 1–4 file was removed, renamed or weakened. No existing test was modified.

---

## 4. Upload and storage security

The CV is the most sensitive artefact on the site, so it has a single write path.

**Where the bytes go.** `private/assessments/<assessmentId>/cv/<uuid>.<ext>`. The key
is entirely server-generated; the uploaded filename never reaches a path or a URL. The
local adapter resolves keys under `.data/uploads/` and refuses anything that escapes
it; the production adapter writes to a physically separate `immi-private` Blobs store,
so a misconfigured public route cannot read private bytes at all.

**What is checked, in order** (`validateUpload({ purpose: 'cv' })`, reused from
Phase 2 rather than reimplemented):

1. Empty file → rejected.
2. Extension must be `pdf` or `docx`.
3. **Magic-number detection** — `%PDF-` for PDF; `PK\x03\x04` *plus* `[Content_Types].xml`
   and `word/document.xml` for DOCX, so a plain ZIP or an XLSX renamed to `.docx` fails.
4. Declared browser MIME must not contradict the detected type.
5. Size measured from the bytes actually received, capped at 10 MB.

**What is recorded.** A `media_assets` row with `visibility = 'private'`,
`purpose = 'cv'`, `detected_mime_type` (not the claimed one), `size_bytes`, and a
SHA-256 checksum — plus an `assessment_attachments` row of kind `cv`.

**What cannot happen.** `publicUrlFor()` throws for a private key (asserted in tests);
`/api/media/[...key]` hard-codes `visibility = 'public'` in its query and only serves
an allowlist of image/video types, so a guessed key returns 404 (verified live: 404 for
`/api/media/assessments/<uuid>/cv/x.pdf`, and 404 for a percent-encoded traversal
attempt). There is no public route that selects from `assessments` — asserted by a
test that walks every public `route.ts`.

**Failure hygiene.** If the registry insert fails, the object is deleted. If the
database transaction fails, `discardCv()` removes both. A rejected upload leaves no
media row and no assessment row (asserted).

---

## 5. Validation and privacy controls

**One schema, two callers.** The browser calls `validateStep(stepId, draft)` to gate
"Next"; the server calls `assessmentSchema` over the whole payload. Both are the
*same* Zod objects, so the client cannot be more permissive than the server.

**Conditional rules are enforced server-side, not by hiding inputs:**

- `hasPassport: 'no'` + any passport detail → refused with "Clear this field, or answer
  Yes to holding a passport." (the database CHECK needs `NULL`; the schema is what
  produces it).
- `status: 'unemployed'` + employer details → refused; `unemployed` is otherwise a
  complete, valid answer that writes no current-employment row.
- `hasChildren: 'no'` + a count → refused; `'yes'` without a count → refused.
- A second mobile number must be a complete pair, and must differ from the first.
- Medical / criminal / travel / family / exams: a `yes` requires detail, a `no`
  forbids it.
- Consent must be literally `true` for **both** policies; a truthy string fails.

**Messages are written for applicants.** Missing sections are coerced to empty ones,
so an incomplete request reports "Full name is required." rather than Zod's "expected
string, received undefined". A test asserts no step ever surfaces a raw developer
message.

**Privacy:**

- The success response contains only the receipt. A test asserts the key set is exactly
  `{ ok, referenceNumber, submittedAt, receiptToken, created }` and that no email, name,
  phone number, filename or storage key appears in a success *or* failure body.
- The audit row records counts, booleans and policy versions — never applicant data.
  A test greps the serialised row for the applicant's email, name, passport number and
  exam result.
- IP addresses are stored only as a SHA-256 hash (`submissionIpHash`, `consent.ipHash`).
- The confirmation page says "received", never "approved", and states plainly that
  submitted ≠ eligible and that no visa, job or interview is guaranteed.
- `/assessment` and `/api/*` remain `noindex` at the middleware layer (Phase 1).
- Nothing is written to `localStorage`, `sessionStorage` or a cookie: a reload starts
  clean, so an applicant's answers do not outlive the visit on a shared device.

**Duplicate and retry behaviour:**

- Same idempotency key → the original reference, `created: false`, nothing written.
- Same email + date of birth + full name within 24 hours → `409` quoting the original
  reference so the applicant can be helped rather than blocked blindly.
- Same email with a different date of birth is treated as a different person (a shared
  family address must not block a second applicant).

---

## 6. Defects found and corrected during verification

Twelve defects surfaced while building and testing Phase 5. All are fixed; each is
recorded because the fix is now load-bearing.

| # | Defect | Fix |
| --- | --- | --- |
| D1 | Step schemas wrapped their slice (`{ education: [...] }`), but the whole-form schema declared the bare list — so the browser validated one shape and the server another. A valid submission was rejected with "expected object, received array". | Split every section into a value schema and a wrapper; the whole form now composes the *values* (`educationListSchema` etc.). |
| D2 | `validateStep()` returned step-relative keys (`fullName`) while the server returned qualified keys (`personal.fullName`), so no input could find its own error and every field looked valid. | `validateStep()` qualifies paths once, using a `STEP_ROOT` map, so client and server return identical key shapes. |
| D3 | An omitted optional field produced "expected string, received undefined". | `optionalText` and `required` preprocess with `asString`, so a missing key is treated as blank and yields the applicant-facing sentence. |
| D4 | A whole missing section produced "expected object, received undefined". | `assessmentSchema` coerces each section with `asRecord`/`asArray`, so errors land on fields. |
| D5 | `mobileCountryCode`, `mobileNumber`, `altMobileNumber` and `email` were plain `z.string()` and escaped the preprocessing above. | Wrapped in `z.preprocess(asString, …)` with explicit "required" messages. |
| D6 | Zod *stripped* a skill outside `SKILLS`, leaving an empty array and the misleading message "Select at least one skill." | The skill array now validates strings with an explicit allowlist check, so an injected value is named and refused. |
| D7 | `validate.ts` writes a better message for `unrecognised_type` ("a ZIP archive, not a Word document") than `cv.ts` could, and `cv.ts` was discarding it. | `cv.ts` now prefers the validator's own message and keeps its map as a fallback. |
| D8 | `Curriculum vitae` errors were routed to the review step, so the wizard moved the applicant to Review instead of the CV step. | `stepForField('cv')` returns `'cv'`. |
| D9 | The languages step read `errors.languages` while the validator produced `errors['languages.languages']`, so the message never rendered. | The component reads both keys (the server's whole-form path and the step path). |
| D10 | `submit.ts` had a second, drifting copy of `splitCountries()`. | Extracted to `src/lib/assessment/transforms.ts`, imported by the service, unit-tested directly. |
| D11 | The submission counter was incremented before validation, so a visitor correcting typos would spend their hourly allowance on rejected attempts. | Split into two limits: `failedAttempt` (20/15 min) for rejections, `submission` (5/hour) counted only when a record is actually about to be written. |
| D12 | The route contained a placeholder size re-check that referenced a variable before its declaration (caught by `tsc`, not by review). | Bodiless `content-length` pre-check retained; the real byte ceiling is enforced in `validateUpload` against the bytes. |

---

## 7. Test results

All figures below are from commands executed in this session; exit codes are the
shell's.

```
npx tsc --noEmit ........................................ EXIT=0
npx eslint . ............................................. EXIT=0
npm test ................................................. EXIT=0
   tests/*.test.ts (core + phase 5) ...................... 243/243 pass, 0 fail
   tests/cms/*.test.ts (Phase 4, unchanged) .............. 51/51 pass, 0 fail
   TOTAL ................................................. 294 tests
npx tsx scripts/verify-schema.ts ......................... RESULT: 38/38 checks passed · EXIT=0
npx drizzle-kit check .................................... "Everything's fine 🐶🔥" · EXIT=0
npx drizzle-kit generate ................................. "No schema changes, nothing to migrate 😴"
credential-free `next build` (no .env, no DB, no secrets)  EXIT=0
   ✓ Compiled successfully in 10.6s
   ✓ Generating static pages (4/4)
```

Phase 5 tests, 127 new — none replaced, none weakened:

| Suite | Tests | Covers |
| --- | --- | --- |
| `tests/assessment-schema.test.ts` | 48 | Every step rejects an empty draft; every field's required/optional rule; passport, children, employment and additional-information conditional rules; all 202 countries accepted; all 20 skills accepted; consent literal-true; error routing; reference format, alphabet and uniqueness; country splitting. |
| `tests/assessment-submission.test.ts` | 30 | Successful write of the full record and every child list; unique and database-enforced references; duplicate refusal quoting the original reference; idempotent retry; server-side validation of a UI-skipping request; consent refusal and snapshot (versions 4/9, wording, timestamp, IP hash); policy-unpublished refusal; CV accept/reject by bytes, private key layout, on-disk presence, no orphan on failure; sixth submission rate-limited; honeypot; no applicant data in any response; draft destination cannot be stored; storage separation. |
| `tests/assessment-route.test.ts` | 8 | 415 for JSON, 405 for GET, 413 for declared oversize, 400 for no answers, 201 + receipt-only body + `no-store` for success, field errors for incomplete/consentless submissions, disguised-file refusal at the HTTP edge. |
| `tests/assessment-ui.test.ts` | 41 | Step order and definitions; progress bar ARIA; Back/Next; no forward skip; controlled steps; **no browser storage**; per-step and whole-form validation; review page sections; consent unchecked by default and linked; loading and confirmation panels; disclaimer wording; logo on form and receipt; CTA wording unchanged; responsive classes; label/`aria-invalid`/`aria-describedby` wiring; honeypot; page gates; no guarantee language anywhere. |

**Rendered verification.** With the dev server running, `/assessment` returns 200 and
the server-rendered HTML contains "Step 1 of 11", "Personal information", the children
question, Back/Next and the mandated "Book a Consultation Now" — i.e. the form is
server-rendered and hydrated, not a placeholder. All eleven public routes return 200,
`/admin/login` returns 200, and `/api/health` reports `database: ok`.

**Live HTTP verification of the endpoint** (dev server, then rows purged):

| Request | Result |
| --- | --- |
| Valid multipart submission + PDF | `201` with `IMA-2026-YA1GRF79` |
| Same idempotency key again | `201`, same reference, no second row |
| Same person, new key | `409` naming the original reference |
| `{}` payload | `400` with per-field applicant messages |
| HTML renamed to `cv.pdf` | `400 cv_rejected`, no rows written |
| `content-type: application/json` | `415` |
| `GET` | `405` |
| `/api/media/assessments/<uuid>/cv/x.pdf` | `404` |

---

## 8. Known limitations

1. **Nothing is committed, pushed or deployed.** All Phase 5 work is untracked on the
   branch, per your instruction. The site is not production-ready.
2. **No production administrator exists** (§1 of the Phase 4 report still applies).
3. **No browser automation.** Confirmed again this phase: no Chromium/Firefox binary
   is present and the Playwright download host is unreachable from the sandbox, so
   **no screenshot, click-through, keyboard-only walkthrough or visual-regression check
   was performed, and none is claimed.** The UI suite asserts structure and content
   from the shipped source; the following must be walked manually before launch:
   - all eleven steps on a 360 px phone, a 768 px tablet and a 1440 px desktop;
   - a full submission with a real PDF and a real DOCX;
   - keyboard-only completion, including the radio groups and the consent checkboxes;
   - a screen-reader pass over the progress rail and the error announcements;
   - the confirmation page layout after a real submit.
4. **No editable answers after submission.** There is no applicant account by design, so
   a submitted assessment cannot be changed from the site; the confirmation asks the
   applicant to contact the agency with their reference. Phase 6 will let an
   administrator reopen a record.
5. **No email notification.** A submission is written to the database and the audit log;
   nothing is emailed to the agency yet, because no mail provider is configured. Until
   Phase 6 gives you an assessment dashboard, a new submission is visible only in the
   database.
6. **Travel and family answers are free text.** They are split into one row per country
   on commas/semicolons/slashes/"and", de-duplicated and capped at 20 rows, but a
   visitor who writes a sentence ("I visited Ghana for a funeral in 2019") produces a
   single long "country". This is honest to what they typed; a structured repeatable
   list would be more queryable but harder to complete.
7. **`numberOfChildren` and salary amounts are bounded** (20 children; twelve-digit
   salaries). Both ceilings are arbitrary but generous; say if you want different ones.
8. **The rate limiter is per hashed IP.** Applicants behind one corporate NAT share an
   allowance of five per hour. That is the intended trade-off (the alternative is a
   captcha, or storing raw IPs), but it should be watched after launch.
9. **16 MB Netlify function payload ceiling.** The form enforces 10 MB for the CV and
   60 KB for the answers, both well inside it; a much larger PDF is refused by our own
   validation with a clear message rather than by the platform with an opaque one.
10. **Phase 6 is not built**, as instructed: there is no assessment list, detail view,
    status change, note, or authorised CV download endpoint yet. The data model and the
    audit verbs (`assessment.viewed`, `assessment.status_changed`,
    `assessment.attachment_downloaded`, `assessment.deleted`) are in place for it.

---

## 9. Decisions taken, and what they cost

1. **No new tables.** Phase 1's eleven assessment tables covered every requirement, so
   Phase 5 is application code. I did not add a "submission attempts" table: the
   existing `rate_limit_buckets` and `activity_logs` carry that information.
2. **`'assessment.submitted'` added to the activity enum** (§2). The only schema-adjacent
   change, code-level only, reversible by deleting one line.
3. **Two rate limits instead of one** (D11), so a visitor correcting typos is never
   punished for it.
4. **No `localStorage` draft saving.** It would be a convenience, but it would leave date
   of birth, home address and medical details on a shared device after the visit. The
   wizard keeps the draft in memory and says so in the progress rail.
5. **The honeypot is a hidden text input**, not a captcha: no third-party script, no
   accessibility cost, no data sent to anyone. It stops naive bots only; the rate limiter
   is what actually bounds abuse.
6. **Duplicate detection is a 24-hour window** on email + date of birth + full name. A
   genuine second application after 24 hours is allowed rather than being blocked
   forever, which would otherwise need a support process we do not have yet.

### Outstanding decisions for you

- **Who is emailed when a submission arrives?** Nothing is sent today. Phase 6 gives you
  a dashboard; a notification email needs a provider and a destination address.
- **Retention.** `site_settings` has a privacy-retention field, but nothing enforces it
  on assessments yet. What should happen to a `closed` assessment after N months:
  purge, or archive with the CV retained until a second confirmation?
- **Manual walkthrough.** §8.3 lists the checks that need a real browser. I can prepare
  a script for you to run, or run them once a browser is available in this environment.

---

## 10. Confirmation of the stopping point

- **No Phase 6 work.** No assessment dashboard, no list, no detail view, no status
  workflow, no notes, no CV download endpoint.
- **No client accounts, no applicant login, no portal.** There is still no user table;
  `/api/assessment` has no session concept and no read handler.
- **No production administrator provisioned.**
- **No deployment.** Nothing has been pushed to Netlify, and `netlify.toml` is unchanged.
- **No commit, no push.** `git status` shows the same untracked working tree as before,
  now including the Phase 5 files.
- **No existing test removed or weakened.** The Phase 1–4 suites run unchanged: 51/51 CMS
  and the core suite, green.
- **Development data left clean.** All HTTP-test submissions, consent rows, media rows,
  audit rows, rate-limit buckets and the private CV files created while verifying were
  deleted; the local database is back to the demo seed and `.data/uploads/private` is
  empty. The temporary scripts used for that check have been removed.

I am stopping here and waiting for your review and approval before Phase 6.
