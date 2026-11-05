# Phase 6 — Admin Assessment Management

**Status:** complete, awaiting approval. No commit, push or deploy was performed.
**Branch:** `arena/cdcb43ad-immi-website` · HEAD `bc53028` (unchanged)
**Database changes:** **none** — no new tables, no new columns, no migration.

---

## 1. What was built

An assessment-management interface inside the existing authenticated admin portal.
An owner or administrator can now find an application, read everything the
applicant submitted, download the CV, work the record through the five-status
workflow and keep private notes — and every one of those actions is gated on the
server and recorded.

| Requirement | Where it lives |
| --- | --- |
| List all submitted applications | `/admin/assessments` → `GET /api/admin/assessments` |
| Search by name, email, reference | `listAssessments()` — three-column `LIKE`, escaped |
| Filter by status and submission date | `status`, `from`, `to` query parameters |
| Sort and paginate | closed sort set + `page` / `pageSize` (10 · 25 · 50) |
| Submission date and reference shown | inbox table, mobile cards, detail header |
| Open an individual application | `/admin/assessments/[id]` → `GET /api/admin/assessments/[id]` |
| Personal, passport, education, employment, skills, languages, preferences, declarations, travel, family, examinations | detail page sections |
| Consent records and accepted policy versions | "Consent and accepted policies" section, from `consent_records` |
| Secure CV download | `GET /api/admin/assessments/[id]/attachments/[attachmentId]` |
| Internal notes (add / delete) | `POST /api/admin/assessments/[id]/notes`, `DELETE …/notes/[noteId]` |
| Change status with who + when + previous → new | `POST /api/admin/assessments/[id]/status` |
| Status history | append-only `assessment_status_history`, rendered on the page |
| Activity records | `activity_logs` filtered by `entity_type = 'assessment'` and entity id |
| Dashboard counts | `getAssessmentSummary()` — one grouped `count()` |

### Statuses

Exactly the approved set, ordered, defined once in
`src/lib/assessment/status.ts` and read by the filter, the picker, the badges and
both summary panels:

| # | Value | Label | Badge tone |
| --- | --- | --- | --- |
| 1 | `new` | New | info |
| 2 | `under_review` | Under Review | warning |
| 3 | `additional_info_required` | Additional Information Required | danger |
| 4 | `reviewed` | Reviewed | success |
| 5 | `closed` | Closed | neutral |

The values were already in `ASSESSMENT_STATUSES` (Phase 5); what is new is the
ordered presentation layer and the fact that nothing can offer a sixth status.

---

## 2. Routes

### Pages

| Route | File | Notes |
| --- | --- | --- |
| `/admin/assessments` | `src/app/(admin)/admin/(dashboard)/assessments/page.tsx` | Server-rendered live counts + client list |
| `/admin/assessments/[id]` | `src/app/(admin)/admin/(dashboard)/assessments/[id]/page.tsx` | Full application, server-rendered |

Both live under the existing `(dashboard)` layout, so `requireAdminPage()` runs
before any page code and each page additionally checks the role.

### API

| Method | Route | Handler |
| --- | --- | --- |
| GET | `/api/admin/assessments` | `listAssessmentsHandler` |
| GET | `/api/admin/assessments/[id]` | `readAssessmentHandler` |
| POST | `/api/admin/assessments/[id]/status` | `changeStatusHandler` |
| POST | `/api/admin/assessments/[id]/notes` | `addNoteHandler` |
| DELETE | `/api/admin/assessments/[id]/notes/[noteId]` | `deleteNoteHandler` |
| GET | `/api/admin/assessments/[id]/attachments/[attachmentId]` | `downloadAttachmentHandler` |

Every route file is a three-line re-export of the handler in
`src/lib/assessment/admin-handlers.ts`, so the guard order lives in one place and
cannot be forgotten in a new file.

**No DELETE route exists for an application.** "Closed" is how a record leaves
the working queue; deleting applicant data is not a portal capability.

### Files added

```
src/lib/assessment/status.ts              status vocabulary (ordered, shared by client and server)
src/lib/assessment/admin.ts               list / summary / detail / download lookup queries
src/lib/assessment/manage.ts              status change (transactional), notes, audit text
src/lib/assessment/admin-handlers.ts      guarded route handlers
src/components/admin/assessments/assessment-list.tsx      inbox (search, filter, sort, paginate)
src/components/admin/assessments/assessment-workspace.tsx status, documents, notes, history
src/app/(admin)/admin/(dashboard)/assessments/page.tsx
src/app/(admin)/admin/(dashboard)/assessments/[id]/page.tsx
src/app/api/admin/assessments/**/route.ts                 6 route files
tests/cms/phase6-assessments.test.ts                       48 tests
docs/PHASE-6-REPORT.md                                     this report
```

### Files modified

| File | Change |
| --- | --- |
| `src/components/admin/admin-shell.tsx` | "Assessments" nav item under Overview, `roles: ['owner','admin']`; header comment updated |
| `src/app/(admin)/admin/(dashboard)/page.tsx` | Real assessment count panel; the stale "Not available yet" panel removed; count note corrected |
| `src/lib/cms/api.ts` | `auditMutation` action union widened by five assessment verbs (code only — see §3) |
| `tests/support/test-stubs.ts` | The in-memory audit stub now keeps `summary`, `metadata` and the actor, so Phase 6 can assert what was recorded. Existing assertions read the same three fields as before. |

---

## 3. Database changes: none, and why

The Phase 5 schema already had everything Phase 6 needs:

- `assessments.status` (enum `ASSESSMENT_STATUSES`, default `new`)
- `assessment_status_history` — `from_status`, `to_status`, `admin_id`, `note`, `created_at`
- `assessment_notes` — `body`, `is_pinned`, `admin_id`, `created_at`, `updated_at`
- `assessment_attachments` — `assessment_id`, `media_asset_id`, `kind`
- `consent_records` — immutable snapshots of terms/privacy version and consent text
- `activity_logs` — `action`, `entity_type`, `entity_id`, `summary`, `metadata`

The audit verbs `assessment.viewed`, `assessment.status_changed`,
`assessment.note_added`, `assessment.note_deleted` and
`assessment.attachment_downloaded` were already declared in `ACTIVITY_ACTIONS`
(`src/db/schema/enums.ts`), which is a **code-level** union. The audit writer's
call-site type in `src/lib/cms/api.ts` did not yet list them, so they were added
there. `assessment.deleted` was deliberately **not** added: the portal has no
such operation, and an unused verb would imply a capability that does not exist.

Verification that no migration is involved:

```
drizzle-kit generate ....... "No schema changes, nothing to migrate"
drizzle-kit check .......... "Everything's fine"
```

`activity_logs.action` is plain `text` in `drizzle/0000_init.sql` (no CHECK
constraint), so a new verb is a TypeScript change, not a schema change. A probe
confirmed `assessment.submitted` round-trips through `writeAuditLog` into a real
`activity_logs` row.

---

## 4. Security and privacy

### Authorisation

| Layer | Mechanism |
| --- | --- |
| Page | `requireAdminPage()` in the `(dashboard)` layout, plus an explicit `hasRole(admin, ASSESSMENT_ROLES)` in each page body |
| API read | `guardAssessmentRead()` — session, then role |
| API write | `guardMutation(request, ASSESSMENT_ROLES)` — session, role, then CSRF |
| Role set | `ASSESSMENT_ROLES = ['owner','admin']`; an `editor` is refused on **every** assessment route, reads included |

An editor who types the URL gets an explanatory refusal page, the navigation item
is not rendered for them, and their dashboard does not query the assessments
table at all — so no count of applications can be inferred from it.

### CV download

`GET /api/admin/assessments/[id]/attachments/[attachmentId]`:

1. Session + role first. Unauthenticated → 401, editor → 403.
2. The attachment is looked up **by assessment id and attachment id together**.
   A valid attachment id paired with the wrong assessment is a 404 — the same
   answer as "does not exist" — so an id cannot be walked sideways to another
   applicant's file.
3. The asset must be `visibility = 'private'`. Archive state is honoured: an
   archived asset is refused even though its row exists.
4. The audit row (`assessment.attachment_downloaded`) is written **before** the
   bytes are streamed, so an aborted download is still accounted for.
5. Response: `Content-Disposition: attachment`, `Cache-Control: no-store`,
   `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src
   'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`.

The storage key is never selected by any page or JSON response — the detail view
carries `id`, `kind`, filename, size and type only. The key is resolved inside the
download route at the moment of download, after the guard has run.
`findAttachmentForDownload()` is the only function that returns one.

The public media proxy is untouched: it still hard-filters
`visibility = 'public'` and still refuses document types, so
`/api/media/assessments/<id>/cv/<file>.pdf` is a 404 (verified live, §7).

### Applicant data boundaries

- No public route imports `@/lib/assessment/admin` or `@/lib/assessment/manage`
  (asserted by a test that walks every non-admin `route.ts`).
- The list query selects twelve fields; addresses, passport number, date of birth,
  medical/criminal details and all long free text are only read for a single
  record.
- Errors are generic. A missing record says "That application no longer exists."
  and never echoes an id, a name or a reference of a different record.
- Admin responses are `Cache-Control: no-store` (asserted), and the middleware
  already marks `/api/*` and `/admin/*` noindex + no-store.
- Internal notes have no public reader and are not exported by anything the public
  site imports.

### Audit trail

Five verbs are written, all with `entity_type = 'assessment'` and the entity id:

| Action | Summary recorded |
| --- | --- |
| `assessment.viewed` | `Opened application IMA-…` |
| `assessment.status_changed` | `IMA-…: Under Review → Additional Information Required`, metadata `{referenceNumber, fromStatus, toStatus}` |
| `assessment.note_added` | `Added an internal note to IMA-…`, metadata `{referenceNumber, noteId, pinned}` |
| `assessment.note_deleted` | `Deleted an internal note on IMA-…`, metadata `{referenceNumber, noteId}` |
| `assessment.attachment_downloaded` | `Downloaded CV for IMA-…`, metadata `{referenceNumber, attachmentId, kind}` |

Applicant text is never written: no name, no note body, no filename, no storage
key. Tests assert each of those omissions.

### Status-change integrity

The status update and its history row are written in one transaction, so the trail
can never be missing the change it describes. A change to the *current* status is
refused with 409 and appends nothing — the history contains no fake events.

---

## 5. User interface

- Same white/red theme and existing design tokens; blue (`accent`) for active and
  focus states, as in the CMS.
- **Inbox:** search box (name / email / reference, debounced 300 ms), status
  filter with the five statuses numbered, `type="date"` from/to range, sort by
  submission date / name / reference / status with an asc-desc toggle, rows-per-
  page selector, previous/next pager, and a live "Showing 1–25 of 132" line.
- **Desktop table, mobile cards.** The table collapses to one card per
  application below `md`; a six-column table at 380 px is not usable.
- **Detail page:** status panel, documents panel, then the application grouped
  into labelled sections, then notes and history side by side, then the activity
  trail.
- **Feedback:** success and failure both render through `FormAlert` in words. A
  failed load says what to do next; a failed status change says explicitly that
  nothing was written; a no-op change comes back as "already marked Under Review.
  Nothing was changed."
- **Confirmation dialogs:** status changes and note deletion both go through the
  existing `ConfirmDialog`, which names the reference number and the exact
  previous → new status before the write.
- **Accessibility:** every control is labelled (visually or `sr-only`), status is
  never conveyed by colour alone, tables have `<caption>` and `scope="col"`,
  headings are hierarchical, and the pill colours pair with text.
- **Sensitive sections** ("Additional declarations") carry an inline note saying
  the content is special-category data.

---

## 6. Test results

New file: `tests/cms/phase6-assessments.test.ts` — **48 tests, 10 suites**, all
passing. They run against the real library and a real scratch libSQL database
(`.data/verify-phase6.db`, deleted afterwards); only the cookie jar,
`next/navigation` and the audit sink are stubbed, so the guard logic under test is
the shipped logic. A CV is stored through the real Phase 5 `storeApplicantCv()`
and served from the real local storage adapter.

| Mandated area | Tests |
| --- | --- |
| Listing and pagination | default order, page window, page-size clamping, out-of-range page, sort by name and by workflow status, thin list rows |
| Search and filtering | name / email / reference, `%` escaped, status filter, inclusive date range, AND combination, unknown values ignored |
| Individual views | every section present, attachment described without a storage key, unknown id → 404 |
| Status changes | row + history + audit, no-op refused without writing, unknown value 400, history appends, all five labels |
| Internal notes | add/list/delete round-trip, empty refused, cross-record delete refused, note body absent from audit |
| CV authorisation and download | 200 with safe headers, audit written, wrong-assessment pair 404, unknown id 404, private key prefix, archived asset refused |
| Unauthorised access | all six endpoints 401 without a session; all refused 403 for an editor; administrator (non-owner) allowed; CSRF absent and CSRF mismatched both 403 with no write |
| Privacy boundaries | no public route reaches assessment data, media proxy stays public-only, no-store, errors leak nothing, no delete route |
| Dashboard counts | counts equal the rows and include all five statuses, and move correctly on a status change |
| Portal wiring | nav item and role gate, dashboard panel replaces the placeholder, both pages role-gated, confirmation dialog present, CV link never a storage URL |

### Full gate (re-run at the end of this phase)

```
npx tsc --noEmit ..................... EXIT=0
npx eslint . ......................... EXIT=0
npm test ............................. 243 core + 99 cms = 342 passing, 0 failing
  (Phase 1–5 baseline was 243 + 51 = 294; Phase 6 adds 48)
npx tsx scripts/verify-schema.ts ..... 38/38 checks passed, EXIT=0
npx drizzle-kit check ................ "Everything's fine"
npx drizzle-kit generate ............. "No schema changes, nothing to migrate"
credential-free next build ........... EXIT=0 (compiled 9.9s, 4/4 static pages;
                                       /admin/assessments and both API routes present)
secret-marker scan ................... 320 files, 0 hits
```

The credential-free build was produced in `/tmp/cfbuild` (repo copied without
`node_modules`, `.next`, `.data` or `.env*`, `node_modules` symlinked), so no
production credential was read.

---

## 7. Live verification (dev server, not a browser)

The dev server was restarted against a **throwaway** database
(`.data/smoke.db`, deleted afterwards) and a temporary owner/editor pair created
with process-local random passwords. Nothing was provisioned in the real
environment and nothing was committed.

Confirmed with `curl`/`urllib` against `http://localhost:3000`:

| Check | Result |
| --- | --- |
| Submit a real application through `POST /api/assessment` (with CV) | 201, reference `IMA-2026-AKHQW526`, private file written under `.data/uploads/private/assessments/<id>/cv/` |
| `GET /api/admin/assessments` with a session | 200, `total = 1`, 12 list fields, no special-category fields |
| Search by name / reference / email | 1 / 1 / 1 |
| Filter `status=new` / `status=closed` | 1 / 0 |
| Filter today / a past year | 1 / 0 |
| `GET /api/admin/assessments/[id]` | 200 — 1 education, 2 employment, 1 skill, 2 languages, 1 attachment, consent v1; no `private/assessments` string in the JSON |
| CV download | 200, 600 bytes, `%PDF` intact, `content-disposition: attachment; filename="ngozi-cv.pdf"`, `content-type: application/pdf`, `cache-control: no-store`, `x-content-type-options: nosniff` |
| Status change | 200 `new → under_review` |
| Repeat same status | 409 "This application is already marked Under Review. Nothing was changed." |
| Bogus status | 400 |
| Note add / delete | 200 / 200 |
| Detail after actions | 1 history entry; 6 activity entries: `assessment.submitted`, `viewed`, `attachment_downloaded`, `status_changed`, `note_added`, `note_deleted` |
| `/api/media/assessments/<id>/cv/<file>.pdf` | 404 — the public proxy refuses the private path |
| `/admin/assessments` and `/admin` (owner) | 200; counts "Total 1"; nav item rendered; detail page renders all sections; no storage key in the HTML |
| Editor: list/detail/status APIs | 403 on all |
| Editor: `/admin/assessments` page | 200 with the refusal notice, no applicant name in the HTML, no nav item, no dashboard panel |
| No session: all six endpoints | 401 (`{"error":"unauthorized"}`); pages 307 → `/admin/login?next=…` |

**This is HTTP and HTML inspection, not visual verification.** No browser was
available (no Chromium, Playwright host blocked), so layout, colour, responsive
breakpoints, focus rings and dialog behaviour have **not** been seen rendered and
must be checked manually before launch. See §8.

---

## 8. Known limitations

1. **No visual or interactive browser verification.** Every UI claim above is
   from source and from server-rendered HTML, never from a screenshot or a click.
   Manual checks required: the mobile card layout at 360–414 px, the
   status-change and delete-note dialogs (including `Escape` and focus
   trapping), the date-range pickers in Safari and Firefox, and the pager at the
   end of a large result set.
2. **Pagination without a total-scan shortcut.** `count()` and the page query run
   separately; at very large volumes (tens of thousands of applications) `OFFSET`
   degrades. Fine at the agency's expected volume; keyset pagination is the
   upgrade if it ever matters.
3. **No date filter presets.** Only explicit from/to. "This month" is two
   clicks away, not one.
4. **Notes cannot be edited.** They can be added and deleted, not amended — a
   deliberate choice (an edit history would be needed to make editing honest).
5. **No bulk actions.** Status is changed one application at a time.
6. **No CSV/spreadsheet export.** Not requested; it is also the fastest way to
   leak a file full of applicant data, so it needs its own approval.
7. **No assignment / reviewer ownership.** Any owner or administrator can work any
   application; the history records who did.
8. **Attachments other than CVs** are displayed by `kind`, but only `cv` is ever
   produced today.
9. **`assessment.viewed` is written on every detail read**, including the
   server-rendered page and a refresh — so the activity trail is accurate but
   chatty. If it becomes noise, coalescing per administrator per record per hour
   is the fix.
10. **Live smoke used a scratch database.** It proves the routes, guards,
    storage and queries work in a running Next.js process; it does not prove
    anything about the production Netlify Blobs adapter, which remains covered
    only by the storage abstraction and the credential-free build.

---

## 9. Outstanding issues carried forward

- **Correction:** Phase 4 §4 records defects D1–D11 as corrected. This line originally said they remained open; that was a documentation error. Phase 7's regression suite did not reproduce those defects.
- The production administrator is still **not provisioned** and no deployment
  has been made (both per instruction).
- Enquiry management, applicant accounts and the client portal remain out of
  scope; Phase 7 has not been started.

---

## 10. Summary of the acceptance criteria

| Criterion | Verdict |
| --- | --- |
| View all submitted applications | Done |
| Search by name, email, reference | Done (escaped, bounded) |
| Filter by status and submission date | Done |
| Sort and paginate | Done (workflow-aware status sort) |
| Submission dates and references visible | Done |
| Open an individual application | Done |
| All applicant sections + consent versions | Done |
| Secure CV download, server-authorised | Done (paired ids, private only, audited) |
| Add / edit internal notes | Add and delete done; **editing not offered** (see §8.4) |
| Change status, with who/when/previous → new | Done (transactional) |
| Status history and activity records | Done |
| Dashboard counts (total, new, under review, awaiting info, reviewed, closed) | Done, real `count()` |
| Existing white/red theme, blue active states, responsive | Followed; responsive layout unverified in a browser |
| Clear feedback and confirmations | Done |
| Tests incl. Phase 1–5 regression | 342 passing, 0 failing |
| tsc / eslint / tests / schema / drizzle / credential-free build | All green, exit 0 |
| Report with actual outputs and exit codes | This document |
