# Phase 3 — Administrator Account & Secure Authentication

**Status: complete, awaiting approval for Phase 4.**
**Nothing has been committed or pushed.** The repository still has exactly one commit
(`bc53028`); all Phase 3 work is untracked, as required.

---

## 1. What was asked for, and what was built

| Requirement | Where it lives |
| --- | --- |
| Reuse the existing bootstrap script | `scripts/seed-admin.ts` (extended, not replaced) |
| Credentials only from environment variables | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`, `ADMIN_ROLE` |
| Argon2id hashing, hash only in the database | `src/lib/auth/password.ts` (pre-existing, reused) |
| `mustChangePassword = true` on the initial account | `scripts/seed-admin.ts` |
| Forced change enforced after first login | `src/lib/auth/guard.ts` + `/admin/change-password` |
| Server-side session verification | `src/lib/auth/session.ts`, `guard.ts` |
| HttpOnly secure cookies, expiry, logout | `src/lib/auth/session.ts`, `/api/admin/auth/logout` |
| Login rate limiting | `src/lib/auth/rate-limit.ts`, `service.ts` |
| CSRF protection | `src/lib/auth/session.ts`, `guard.ts` |
| No public registration | no such route exists — asserted by a test |
| Safe provisioning, no duplicates, no password overwrite | `scripts/seed-admin.ts` |
| No plaintext password in logs, source or git history | verified, see §6 |

**No database schema change and no migration were needed.** Every column the
phase requires (`must_change_password`, `password_changed_at`, `failed_attempts`,
`locked_until`, `admin_sessions.*`, `login_attempts.*`, `activity_logs.*`) already
existed from Phase 1, so `drizzle/` was not touched and nothing in an existing
database had to be altered.

---

## 2. Files written in Phase 3

**Authentication library — `src/lib/auth/`**

| File | Purpose |
| --- | --- |
| `config.ts` | Every tunable in one auditable place: cookie names, lifetimes, limits, lockout ladder, denylist |
| `session.ts` | Session create / resolve / revoke, CSRF token checking, cookie options, IP hashing |
| `rate-limit.ts` | Database-backed attempt counting and endpoint limiting |
| `audit.ts` | Fire-and-forget activity logging that can never break a request |
| `service.ts` | `attemptLogin`: the whole sign-in decision path |
| `password-change.ts` | `changePassword` + new-password policy |
| `guard.ts` | Page/API guards, role checks, CSRF assertion |

**Routes and pages**

| Path | Purpose |
| --- | --- |
| `src/app/(admin)/layout.tsx` | Admin route-group shell, `noindex`, forced dynamic |
| `src/app/(admin)/admin/login/page.tsx` | Sign-in page shell |
| `src/app/(admin)/admin/login/login-form.tsx` | Client form, generic errors, rate-limit countdown |
| `src/app/(admin)/admin/(dashboard)/layout.tsx` | Guarded layout wrapping every authenticated page |
| `src/app/(admin)/admin/(dashboard)/page.tsx` | Dashboard with real `count()` figures |
| `src/app/(admin)/admin/(dashboard)/settings/page.tsx` | Account and security details |
| `src/app/(admin)/admin/(dashboard)/activity/page.tsx` | Read-only audit log |
| `src/app/(admin)/admin/change-password/page.tsx` | Forced/voluntary change screen |
| `src/app/(admin)/admin/change-password/change-password-form.tsx` | The change form |
| `src/components/admin/admin-shell.tsx` | Authenticated navigation shell |
| `src/app/api/admin/auth/login/route.ts` | `POST` — the only way to obtain a session |
| `src/app/api/admin/auth/logout/route.ts` | `POST` — revoke and clear cookies |
| `src/app/api/admin/auth/change-password/route.ts` | `POST` — CSRF-checked, throttled change |

**Scripts and tests**

| Path | Purpose |
| --- | --- |
| `scripts/seed-admin.ts` | Rewritten to be idempotent and never overwrite a password |
| `scripts/unlock-admin.ts` | Operator recovery for a locked-out account (new) |
| `tests/phase3-auth.test.ts` | 34 tests, including all six mandated verifications |

---

## 3. How the security works, in plain language

**Passwords.** The password is turned into an Argon2id hash before it is ever
stored. A hash is a one-way scramble: it can confirm a password is correct, but
it cannot be turned back into the password. The plaintext exists for a few
milliseconds inside the bootstrap script and the login request, and nowhere else
— not in the database, not in a log, not in a file.

**Sessions.** Signing in produces a long random token. The browser keeps it in a
cookie, and the database keeps only a SHA-256 *fingerprint* of it. When a request
arrives, the server fingerprints the token and looks the fingerprint up. Two
consequences follow: a stolen database cannot be used to impersonate anyone, and
"sign out" is real — the row is revoked, so a copied cookie stops working
immediately rather than lingering until it expires.

**Expiry.** A session dies after 30 minutes of inactivity (so a forgotten laptop
in a café does not stay signed in) and always after 8 hours (so a session cannot
live forever). Both rules are enforced in the database query itself, not by the
browser and not by a note in memory.

**Cookies.** The session cookie is `HttpOnly` (JavaScript cannot read it, so a
script injection cannot steal it) and `Secure` in production (it is only ever sent
over HTTPS). A second, deliberately readable cookie carries the CSRF value — see
below.

**CSRF.** Cross-site request forgery is an attack where a different website
tricks the browser into making a request with the victim's cookies attached. The
defence here is a double submit: a random secret is generated at sign-in, stored
on the session row *and* placed in the readable CSRF cookie. To change anything,
the browser must send it back in a header. Another site can cause our cookies to
be *sent*, but it cannot *read* them, so it cannot produce the header. The server
compares the header, the cookie, and the stored secret — all three must agree.

**Rate limiting.** Counters live in the database, not in memory, because the site
runs as short-lived functions that forget everything on restart and do not share
memory between instances. Two counters run at once: five attempts per IP in
fifteen minutes (stops one machine stuffing many accounts) and five per account
(stops many machines attacking one account). Limits are checked *before* the
password is verified, so a locked-out attacker costs no CPU.

**Account lockout.** Separately from the counter window, repeated wrong passwords
increment a durable counter on the account. Past the threshold the account is
locked, and at the terminal rung (20 failures) it stays locked until an operator
clears it. `npm run admin:unlock` does that without touching the password.

**Enumeration.** "No such account", "wrong password" and "account deactivated"
all return the same message, and an unknown address still spends the same Argon2
time as a real one, so response timing does not reveal which emails are
registered either.

**Forced first change.** The initial account is created with
`must_change_password = true`. Every authenticated page calls the guard, which
redirects to the change screen until the flag clears. The change requires the
*current* password to be proven again, rejects reuse, and signs out every other
device on success.

---

## 4. Provisioning behaviour (requirement 11)

The script previously refused to run whenever *any* administrator existed. That
prevented duplicates but made safe re-provisioning impossible. It now decides
based on the account it was asked to create:

| Situation | Behaviour |
| --- | --- |
| No such account, no administrators | Creates it, `must_change_password = true` |
| **Account with `ADMIN_EMAIL` already exists** | **No writes at all.** Prints the account's state and exits successfully |
| Other administrators exist, this email does not | Refuses (exit code 2) unless `SEED_ADMIN_ALLOW_ADDITIONAL=1` |
| Email differs only by case | Matched, so it is the "already exists" case — no duplicate |
| Password fails policy | Refused before any hash is computed |
| Password contains the email / equals the email | Refused |

Re-running is therefore harmless at any point in the account's life, including
after the operator has chosen their own password. The script also never prints
the password, the hash, or any part of either.

### Real terminal output

First run against a fresh scratch database (`.data/seedtest.db`):

```
[seed:admin] Target database: file:./.data/seedtest.db
[seed:admin] Administrator created successfully.
  email         : [REDACTED-EMAIL]
  role          : owner
  password      : (hashed with Argon2id — not displayed)
  first login   : a password change will be required
[seed:admin] Remove ADMIN_PASSWORD from your environment once you have signed in.
```

Immediately re-run with a *different* `ADMIN_PASSWORD`:

```
[seed:admin] Target database: file:./.data/seedtest.db
[seed:admin] This administrator already exists — no changes made.
  email              : [REDACTED-EMAIL]
  role               : owner
  active             : yes
  password changed   : not yet (still the initial password)
  pending forced change: yes
[seed:admin] The stored password was NOT modified. Use the portal to change it.
```

Third run, comparing a fingerprint of the stored row before and after:

```
row fingerprint before: 71f1b8c0275f8bab337edf272b0c63d1bddca42c608a1f61f4472ba5145cbb11
row fingerprint after : 71f1b8c0275f8bab337edf272b0c63d1bddca42c608a1f61f4472ba5145cbb11
IDENTICAL — password hash unchanged

original password from run 1 still works : true
password supplied on the re-run works    : false
```

Different email, with an administrator already present:

```
[seed:admin] Refusing to run: 1 administrator account(s) already exist, but none uses this email address.
[seed:admin] Re-run with the existing administrator's email to check its state, or set SEED_ADMIN_ALLOW_ADDITIONAL=1 to deliberately add another account.
[seed:admin] Nothing was created.        (exit code 2)
```

Same email in different case: treated as the existing account, still one row.

---

## 5. End-to-end verification over real HTTP

All of the following was run against the dev server (`http://localhost:3000`)
with a local scratch account created by the rewritten bootstrap script. It is
real output, not a description of intended behaviour.

### 5.1 Credential outcomes

```
A. wrong password        -> 401 {"error":"invalid_credentials"}
B. unknown email         -> 401 {"error":"invalid_credentials"}      (identical body)
C. malformed body        -> 400
D. GET on login route    -> 405
E. correct password      -> 200 {"ok":true,"mustChangePassword":true,
                                 "admin":{"fullName":"Portal Administrator","role":"owner"}}
```

Response headers on the successful sign-in:

```
set-cookie: immi_admin_session=…; Path=/; Max-Age=28800; HttpOnly; SameSite=lax
set-cookie: immi_csrf=…;         Path=/; Max-Age=28800; SameSite=lax
cache-control: no-store, max-age=0
```

### 5.2 Forced first-login change

```
GET /admin              -> 307  http://localhost:3000/admin/change-password
GET /admin/settings     -> 307  http://localhost:3000/admin/change-password
GET /admin/activity     -> 307  http://localhost:3000/admin/change-password
GET /admin/change-password -> 200
```

The redirect is a real HTTP 307, not a client-side navigation. This was not true
in the first draft: a `<Suspense>` boundary in the admin layout caused the guard's
redirect to be streamed as a script payload inside a 200 response, which would
have delivered admin markup to an unauthenticated visitor. The boundary was
removed and the behaviour re-verified.

### 5.3 The password change itself

```
without a CSRF header            -> 403
with a forged CSRF header        -> 403
weak new password                -> 400 {"error":"weak_password",
                                        "messages":["Use at least 12 characters.",
                                                    "Include at least one uppercase letter.",
                                                    "Include at least one number."]}
reusing the current password     -> 400 {"error":"reused_password"}
wrong current password           -> 400 {"error":"wrong_current_password"}
valid change                     -> 200 {"ok":true}
```

Afterwards: old password `401`, new password `200` with
`"mustChangePassword": false`, and the dashboard renders.

### 5.4 Rate limiting

Per-IP (one address, one account):

```
attempt 1 -> 401 invalid_credentials
attempt 2 -> 401 invalid_credentials
attempt 3 -> 401 invalid_credentials
attempt 4 -> 401 invalid_credentials
attempt 5 -> 401 invalid_credentials
attempt 6 -> 429 {"error":"rate_limited","retryAfterSeconds":900}
then, with the CORRECT password from the same IP -> 429
```

Per-account (a fresh IP for every attempt — a distributed attack):

```
ip .101 -> 401
ip .102 -> 401
ip .103 -> 401
ip .104 -> 401
ip .105 -> 401
ip .106 -> 429 {"error":"rate_limited","retryAfterSeconds":900}
then, a brand-new clean IP with the CORRECT password -> 429
```

Durable lockout, after twenty failures spread across IPs:

```
failed_attempts: 5
locked_until: 2026-11-03T21:41:03.550Z
lock duration from now: 0.25 hours
```

**A correction made during this phase.** The lockout ladder originally derived its
rung from the raw failure count, and because blocked attempts are themselves
counted, an automated client climbed to the 4-hour rung within seconds — the
first rate-limit test returned `retryAfterSeconds: 14400` on attempt four. The
ladder now escalates only after each five further failures:
15 minutes → 30 minutes → 1 hour → 4 hours, with the hard lock at 20. The output
above is from after the fix.

**Recovery.** `npm run admin:unlock` clears the counter, the lock and the
account's attempt rows, leaving the password untouched:

```
[admin:unlock] Account unlocked.
  email            : [REDACTED-EMAIL]
  prior failures   : 5
  prior lock       : 2026-11-03T21:40:27.514Z
  attempt rows     : 6 removed
  sessions revoked : unchanged
  password         : untouched
```

Immediately afterwards the same, previously blocked IP signed in with `200`.

### 5.5 Session expiry and revocation

```
before logout  /admin -> 200
logout         -> 200, both cookies cleared (expiry set to 1970)
replayed cookie /admin                     -> 307 /admin/login
replayed cookie /api/…/change-password     -> 401
```

Database after the logout:

```
sessions: {"total":3,"revoked":1}
admin.login = 3 | admin.login_failed = 13 | admin.logout = 1 | admin.password_changed = 1
```

Expiry and idle expiry are covered in the automated suite, which moves the
session row into the past and asserts the resolver refuses it (see §7, cases 4–5).

### 5.6 Transport and indexing

```
HTTP/1.1 307 Temporary Redirect
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
x-robots-tag: noindex, nofollow, noarchive, nosnippet
content-security-policy: default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic' …
body bytes: 26          (a redirect, with no admin markup)
```

---

## 6. Requirement: no plaintext password anywhere

Searched the source tree, the build output and the entire git history for the
initial password supplied for production, plus the throwaway values used during
this verification:

```
supplied production password (not reproduced here) -> source files: 0 | build files: 0 | git history: 0
throwaway password used for this verification        -> source files: 0 | build files: 0 | git history: 0
throwaway password used for the live sign-in check   -> source files: 0 | build files: 0 | git history: 0
```

Also searched the raw database file byte-for-byte:

```
absent from db: supplied production password
absent from db: throwaway verification password
absent from db: throwaway live sign-in password
```

The literal values are deliberately not written in this document: a report is
still a file in the repository, and the automated hygiene test in
`tests/phase3-auth.test.ts` scans `docs/` precisely so that a report cannot
become the place a password survives.

The stored value is an Argon2id hash — `$argon2id$v=19$…`, 97 characters.

Environment hygiene:

```
.gitignore:21:.env.local   .env.local
tracked files matching .env: (none tracked)
```

One self-inflicted issue worth recording: the first version of the hygiene test
listed the secret strings as literals in the test file itself, so the scanner
found them there and had to exempt its own source. That exemption would have
hidden a genuine leak. The markers are now assembled at runtime, the exemption is
gone, and the scan legitimately returns zero.

---

## 7. Automated tests

`tests/phase3-auth.test.ts` — **34 tests, all passing** — runs against a real
libSQL database migrated by the project's own migration runner. The mandated
verifications map as follows:

| # | Required verification | Test |
| --- | --- | --- |
| 1 | Correct password authenticates | `correct password authenticates` |
| 2 | Wrong password rejected | `wrong password is rejected with a generic reason` (+ unknown-email equivalence) |
| 3 | First-login change enforced | `forced password change` suite — flag reaches the caller, current password must be proven, policy enforced, reuse refused, flag cleared, other sessions revoked, old password stops working |
| 4 | Expired sessions rejected | `expired session is rejected`, `idle-expired session is rejected even before its absolute expiry` |
| 5 | Revoked sessions rejected | `revoked session is rejected`, `revoking every session invalidates all of them at once`, `deactivating an administrator invalidates their live sessions immediately` |
| 6 | Rate limiting works | `login rate limiting` suite — per-IP, per-account, IP isolation, generic endpoint limiter |

Additional coverage: the raw token is never stored (only its digest); the session
cookie is `HttpOnly`/`SameSite=Lax`/`Secure` in production; the CSRF cookie is
readable but the session cookie is not; CSRF triples must all agree; no
registration route exists; the bootstrap script has no credential defaults and
hashes before inserting; audit rows contain neither the password nor the hash; a
failing audit write cannot break its caller.

### Full gate run

```
tsc --noEmit ..................... 0 errors
eslint . ......................... clean
npm test ......................... 115 tests, 115 pass, 0 fail
                                  (34 new in Phase 3 + 81 from Phases 1–2)
verify-schema.ts ................. 38/38 checks passed
drizzle-kit check ................ Everything's fine
```

The schema verifier still reports 38/38 and `drizzle-kit check` is clean because
**no migration was added** — the Phase 1 schema already supported all of this.

### Credential-free production build

Copied to a temporary directory with no `.env.local`, no `.env`, no `.env.example`,
and neither `TURSO_DATABASE_URL` nor `TURSO_AUTH_TOKEN` in the environment:

```
✓ Compiled successfully
✓ Generating static pages (4/4)
exit=0
```

Every admin and auth route is `ƒ` (server-rendered on demand):

```
ƒ /admin                          ƒ /admin/activity
ƒ /admin/change-password          ƒ /admin/login
ƒ /admin/settings                 ƒ /api/admin/auth/change-password
ƒ /api/admin/auth/login           ƒ /api/admin/auth/logout
```

Nothing about the admin portal is prerendered or cached, and `next build` needs no
credentials — which is what Netlify will do.

---

## 8. Deliberate decisions

- **No schema change.** Everything needed already existed. Adding a migration
  "for completeness" would have been an unnecessary change to a live database.
- **No `<Suspense>` in the admin layout.** Explained in §5.2: it silently converts
  a server redirect into a client-side one.
- **Rate-limit rows, not memory.** Correct on ephemeral, multi-instance hosting.
- **Uniform failure messages.** Neither an attacker nor a legitimate user can tell
  "no such account" from "wrong password" from "deactivated".
- **Navigation lists only what exists.** The shell shows Dashboard, Account and
  Activity as live, and marks the Phase 4 content modules "soon" rather than
  linking to 404s.
- **Dashboard figures are real.** Every number is a `count()` over published,
  non-archived rows. Where a module does not exist yet the dashboard says
  "Not available yet" instead of showing a zero that looks like data.
- **`npm run admin:unlock` added.** A durable lockout with no recovery path is a
  support incident waiting to happen. It cannot change a password.

---

## 9. What is explicitly NOT done

- **The production administrator has not been provisioned.** The production
  password was not used anywhere and is not in this repository. Only a local
  development administrator exists, with a throwaway password, in a git-ignored
  local database.
- **No commit, no push, no deployment.** The repository has one commit and no
  Phase 3 work is tracked.
- **No email-based password reset.** Recovery for a forgotten password is an
  operator task (`npm run admin:unlock` clears a lockout; a genuinely forgotten
  password needs a deliberate re-provisioning decision in a later phase).
- **The 19 admin modules are not built.** Only the authentication shell, dashboard,
  account settings and activity log exist — the minimum needed to prove the gate
  works.
- **No penetration test or load test.** The verifications above are functional and
  adversarial-by-design, but they are not a substitute for either.

---

## 10. To provision the real administrator (for you to run)

Once you are ready, on the machine that holds the real database credentials:

```bash
# 1. Point at the real database (this is the only step that needs secrets)
export TURSO_DATABASE_URL='libsql://…'
export TURSO_AUTH_TOKEN='…'

# 2. Apply migrations if the database is new
npm run db:migrate

# 3. Provide the credentials for this one command
export ADMIN_EMAIL='[REDACTED-EMAIL]'
export ADMIN_PASSWORD='[REDACTED-CREDENTIAL]'
export ADMIN_FULL_NAME='<the display name you want>'

npm run seed:admin

# 4. Remove the password from the environment immediately
unset ADMIN_PASSWORD
```

Then sign in at `/admin/login`. You will be forced to set a new password before
the portal opens, and the value you supplied in step 3 stops working at that
point.

Re-running step 3 later is safe: it will report that the account exists and will
not touch the password you chose.

---

## 11. Awaiting approval

Phase 3 is complete and verified. I have not started Phase 4 and will not until
you say so. Nothing is committed or pushed.
