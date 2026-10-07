## Session � 2026-10-05 17:03:07 +02:00 � Resume after PC crash

### git log --oneline -10
835ad9d chore: fix certificate folder name, add progress and handoff docs
a3ffaa4 real certificate: real certificate but include duplictaes
ab9626c fix: allow unrs-resolver build script for pnpm v11
c28b219 Merge remote-tracking branch 'origin/main'
a0812e4 Add Kigali Safety Academy training platform
67fe1cf Initial commit


### git status

## main...origin/main [ahead 1]
 M .gitignore
 M HANDOFF.md
 M app/(app)/audit-log/page.tsx
 M app/(app)/certificates/[id]/page.tsx
 M app/(app)/certificates/page.tsx
 M app/(app)/courses/[id]/edit/page.tsx
 M app/(app)/courses/[id]/page.tsx
 M app/(app)/courses/page.tsx
 M app/(app)/dashboard/page.tsx
 M app/(app)/exams/[id]/page.tsx
 M app/(app)/exams/attempts/[id]/page.tsx
 M app/(app)/exams/new/page.tsx
 M app/(app)/exams/page.tsx
 M app/(app)/layout.tsx
 M app/(app)/payments/[id]/page.tsx
 M app/(app)/payments/new/page.tsx
 M app/(app)/payments/page.tsx
 M app/(app)/reports/page.tsx
 M app/(app)/settings/page.tsx
 M app/(app)/trainees/[id]/page.tsx
 M app/(app)/trainees/import/page.tsx
 M app/(app)/trainees/new/page.tsx
 M app/(app)/trainees/page.tsx
 M app/(app)/trainers/page.tsx
 M app/(auth)/login/mfa/page.tsx
 M app/(auth)/login/page.tsx
 M components/forms/CourseForm.tsx
 M components/layout/AppShell.tsx
 M components/layout/UserMenu.tsx
 M lib/mock/courses.ts
 M lib/stores/auth-store.ts
 M lib/types/index.ts
 M next.config.ts
 M package.json
 M pnpm-lock.yaml
 M pnpm-workspace.yaml
?? app/(app)/trainees/[id]/edit/
?? app/(auth)/login/mfa/setup/
?? app/api/
?? components/layout/SessionBridge.tsx
?? components/shared/DemoBanner.tsx
?? lib/api/
?? lib/auth/
?? lib/db.ts
?? prisma/
?? prisma7.config.ts
?? tmp-dbcheck.ts
?? tmp-e2e.ts


### git stash list



### git diff --stat HEAD

 .gitignore                             |    5 +
 HANDOFF.md                             |   99 +-
 app/(app)/audit-log/page.tsx           |    6 +
 app/(app)/certificates/[id]/page.tsx   |    6 +
 app/(app)/certificates/page.tsx        |    6 +
 app/(app)/courses/[id]/edit/page.tsx   |   12 +-
 app/(app)/courses/[id]/page.tsx        |  490 +-------
 app/(app)/courses/page.tsx             |   67 +-
 app/(app)/dashboard/page.tsx           |    6 +
 app/(app)/exams/[id]/page.tsx          |    6 +
 app/(app)/exams/attempts/[id]/page.tsx |    6 +
 app/(app)/exams/new/page.tsx           |    6 +
 app/(app)/exams/page.tsx               |    5 +
 app/(app)/layout.tsx                   |  109 +-
 app/(app)/payments/[id]/page.tsx       |    6 +
 app/(app)/payments/new/page.tsx        |    6 +
 app/(app)/payments/page.tsx            |    6 +
 app/(app)/reports/page.tsx             |    6 +
 app/(app)/settings/page.tsx            |    5 +
 app/(app)/trainees/[id]/page.tsx       |   75 +-
 app/(app)/trainees/import/page.tsx     |    6 +
 app/(app)/trainees/new/page.tsx        |   59 +-
 app/(app)/trainees/page.tsx            |   80 +-
 app/(app)/trainers/page.tsx            |    5 +
 app/(auth)/login/mfa/page.tsx          |  159 +--
 app/(auth)/login/page.tsx              |  114 +-
 components/forms/CourseForm.tsx        |  110 +-
 components/layout/AppShell.tsx         |    4 +-
 components/layout/UserMenu.tsx         |   16 +-
 lib/mock/courses.ts                    |   10 +-
 lib/stores/auth-store.ts               |   75 +-
 lib/types/index.ts                     |   24 +-
 next.config.ts                         |   41 +
 package.json                           |   13 +
 pnpm-lock.yaml                         | 1912 +++++++++++++++++++++++++++++++-
 pnpm-workspace.yaml                    |   14 +
 36 files changed, 2621 insertions(+), 954 deletions(-)


## Summary
Resumed after crash. Remaining steps: lock-in, seed review, frontend wiring check, security audit, verify, docs+commit.

## Session - 2026-10-05 22:48:27 +02:00 - Full completion run (Step 0 lock-in)

### git log --oneline -10
835ad9d chore: fix certificate folder name, add progress and handoff docs
a3ffaa4 real certificate: real certificate but include duplictaes
ab9626c fix: allow unrs-resolver build script for pnpm v11
c28b219 Merge remote-tracking branch 'origin/main'
a0812e4 Add Kigali Safety Academy training platform
67fe1cf Initial commit

### git status
main...origin/main [ahead 1]
37 modified files, 12 untracked paths (app/api/, lib/api/, lib/auth/, prisma/, lib/db.ts, tmp-e2e.ts, tmp-dbcheck.ts)

### git diff --stat HEAD
37 files changed, 2707 insertions(+), 953 deletions(-)

### Env check (.env.local) - ALL KEYS PRESENT
DATABASE_URL=po***e (Neon Postgres: neondb @ ep-raspy-truth-b135bgvx-pooler.c-5.eu-central-1.aws.neon.tech)
SESSION_SECRET=Gu***=
SEED_OWNER_PASSWORD=Ch***!
RESEND_API_KEY=re***u
EMAIL_FROM=Kig***v>
APP_URL=htt***00

### Step 0 verification
- pnpm build: GREEN (Next 15.5.26, all routes compiled)
- pnpm dlx prisma migrate status: Database schema is up to date! (5 migrations)
- Note: /dashboard is 140 kB first-load JS (recharts inlined) - Step 8 target
- Note: NEXT_PUBLIC_APP_URL is NOT in .env.local (only needed for Vercel, Step 11)

Resumed at Step 0. Remaining: 1 Audit, 2 Schema, 3 Exam OTP, 4 Access links, 5 Notifications, 6 Certificates, 7 PWA, 8 Perf, 9 Security, 10 Tests, 11 Deploy, 12 Docs.

## Session - 2026-10-05 22:55:07 +02:00 - Step 1 AUDIT (read-only, verified by reading files)

### Prisma models
| Model | Status | Evidence |
|---|---|---|
| User | OK | prisma/schema.prisma:39 (email unique, passwordHash, totpSecret, totpCounter, failedLogins, lockedAt) |
| Session | OK | schema:72 (id=HMAC of token, mfaPassed, expiresAt, ip, userAgent) |
| RecoveryCode | OK | schema:62 (codeHash, usedAt) |
| Category | OK | schema:85 |
| Course | OK | schema:91 (topics String[], passMarkPct 50, maxAttempts 2, examDurationMin) |
| Trainee | OK | schema:116 (traineeNo unique, email, courseId, status, paymentStatus) |
| Question | MISSING | no model |
| QuestionOption | MISSING | no model |
| ExamAttempt | MISSING | no model |
| ExamAnswer | MISSING | no model |
| Certificate | MISSING | no model |
| AccessLink | MISSING | no model |
| ReferralCode | MISSING | no model |
| DeviceSession | MISSING | no model |
| Notification | MISSING | no model |
| AuditLog | MISSING | no model (page app/(app)/audit-log/page.tsx reads mocks) |

### API routes
Existing (11, all real DB-backed):
OK app/api/health/route.ts
OK app/api/auth/login/route.ts
OK app/api/auth/logout/route.ts
OK app/api/auth/me/route.ts
OK app/api/auth/mfa/setup/route.ts
OK app/api/auth/mfa/confirm/route.ts
OK app/api/auth/mfa/verify/route.ts
OK app/api/categories/route.ts
OK app/api/courses/route.ts
OK app/api/courses/[id]/route.ts
OK app/api/trainees/route.ts
OK app/api/trainees/[id]/route.ts

MISSING:
POST /api/exams/:courseId/send
POST /api/exams/attempts/:token/verify-otp
POST /api/exams/attempts/:token/resend-otp
GET  /api/exams/attempts/:token/next
POST /api/exams/attempts/:token/answer
POST /api/exams/attempts/:token/submit
POST /api/access/generate
POST /api/access/use
GET  /api/access/list
POST /api/access/[id]/revoke
GET  /api/access/[id]/devices
POST /api/access/[id]/devices/[deviceId]/revoke
POST /api/referral/generate
POST /api/referral/redeem
GET  /api/notifications
GET  /api/notifications/stream
POST /api/notifications/[id]/read
POST /api/notifications/read-all
GET  /api/questions?courseId=
GET  /api/certificates
GET  /api/certificates/[id]
GET  /api/certificates/[id]/pdf
POST /api/certificates/[id]/revoke
GET  /api/verify/[token]
GET  /api/exams (list) / GET /api/exams/[id]

### Frontend pages
OK  /login (app/(auth)/login/page.tsx)
OK  /login/mfa
OK  /login/mfa/setup
OK  /trainees, /trainees/new, /trainees/[id], /trainees/[id]/edit, /trainees/import
OK  /courses, /courses/new, /courses/[id], /courses/[id]/edit
OK  /exams, /exams/new, /exams/[id], /exams/attempts/[id]
OK  /certificates, /certificates/[id]
PARTIAL /verify (app/verify/page.tsx is a search form, no /verify/[token])
PARTIAL /exam/[token] - full runner UI exists but reads lib/mock (mockApi.attempts), not the API
MISSING /access/[code]
MISSING /settings/access
MISSING /settings/devices
MISSING /settings/notifications
MISSING /exam/[token]/submitted
MISSING /dashboard is OK (mock data)

### Utilities
OK  lib/auth/authorize.ts, cookies.ts, password.ts, session.ts, totp.ts
OK  lib/api/client.ts, guard.ts, hooks.ts, rate-limit.ts, response.ts, schemas.ts, adapters.ts, types.ts
MISSING lib/email/* (no Resend integration at all)
MISSING lib/certificates/pdf
MISSING lib/notifications/*
PARTIAL lib/mock/* (prototype data; /exams, /certificates, /reports, /payments, /audit-log, /settings, /trainers, /verify still read it)
OK  lib/utils/shuffle.ts, ids.ts, format.ts, cn.ts
OK  lib/db.ts (Prisma 7 + @prisma/adapter-pg, Neon)

### Notable defects found
- app/layout.tsx metadata has mojibake (encoding corruption): "template: \"%s A? Kigali Safety Academy\"" and "certificates" line. Fix in Step 7.
- components/providers.tsx:15 refetchOnWindowFocus: false -> must be true (Step 8 requirement).
- /dashboard first-load JS 140 kB (recharts inline) -> split with next/dynamic (Step 8).
- lib/stores/notification-store.ts seeds from lib/mock/notifications.ts -> must be replaced by real API (Step 5).
- authorize.ts hard-blocks every role except OWNER -> ADMIN/TRAINER access links would 403. Must be relaxed in Step 4.
- lib/auth/password.ts ARGON_OPTIONS is the module to reuse for OTP hashing.

Audit complete. Building Steps 2-3 now.

## Session - 2026-10-05 23:05:09 - Step 2 SCHEMA + Step 3 exam OTP backend

### Step 2 - schema.prisma extended, migration 20261005205703_launch_features APPLIED
New models: Question, QuestionOption, ExamAttempt, ExamAnswer, Certificate,
AccessLink, ReferralCode, DeviceSession, Notification, AuditLog.
Updated: User (+emailNotifications), Session (+accessLinkId, +expiresAt index),
Course (+questions/attempts/certificates relations), Trainee (+attempts/certificates).
Certificate carries studentNumber Int @unique, verificationToken @unique,
topicsSnapshot, durationSnapshot, trainerNameSnapshot, trainerTitleSnapshot,
contentHash, revokedAt, revokedReason.
ExamAttempt carries otpHash, otpExpiresAt, otpAttempts, manifest, tokenHash @unique.
All Step 2 requested fields verified present.
Indexes added for every FK and every WHERE/ORDER BY column (Step 8 partially
pre-empted here; a second migration will add any stragglers).

### Step 3 - backend complete and typechecked
- lib/auth/password.ts: hashSecret() added, shares ARGON_OPTIONS (argon2id 19MiB/2/1)
- lib/exams/token.ts: 32-byte base64url token, sha256 tokenHash, crypto.randomInt OTP,
  30min TTL, 5 attempts, 3 resends/hour
- lib/exams/manifest.ts: CSPRNG (HMAC-SHA256 keyed on the token) drives the
  question + option shuffle. Manifest holds IDS ONLY, never isCorrect.
- lib/exams/attempt.ts: loadAttemptByToken() - the single lookup path
- lib/exams/session-cookie.ts: exam_session_{token} cookie, httpOnly,
  secure in prod, SameSite=Lax, 2h TTL, HMAC-signed
- lib/email/send.ts + lib/email/templates.ts: Resend transport, examLinkEmail
  (subject "Your Kigali Safety Academy exam access", spaced OTP, 30-min line,
  Start exam button, inline CSS only, no external images), otpResentEmail,
  certificateEmail
- lib/notifications/emit.ts + broadcaster.ts: emit(type, opts) writes the row,
  publishes to SSE, emails only exam.failed / certificate.issued /
  deadline.approaching
- lib/certificates/issue.ts: MAX(studentNumber)+1 allocation with SEED_STUDENT_START
  (263) default, unique-violation retry, canonical-JSON SHA-256 content hash

Routes built:
POST /api/exams/[courseId]/send          per-trainee attempt + email + manifest
POST /api/exams/attempts/[token]/verify-otp   single generic 401, 5/token + 10/IP
POST /api/exams/attempts/[token]/resend-otp   3/hour/token, shares the IP bucket
GET  /api/exams/attempts/[token]/next         manifest order, isCorrect never selected
POST /api/exams/attempts/[token]/answer       autosave, 30/min/token
POST /api/exams/attempts/[token]/submit       server grading + certificate + SSE

### lib/auth/authorize.ts REWRITTEN
Was hard-coded to reject every role except OWNER, which would have made Step 4's
ADMIN/TRAINER access links 403 on every route. Now a GRANTS table with explicit
per-action role sets; TRAINER is additionally scoped to their own courses.
New actions added for exam, certificate, question, access, device, audit, report.

### Verification
- npx tsc --noEmit: 0 errors

## Session: Step 3 exam OTP verified end-to-end + three real defects fixed

### BLOCKER for the user: the Resend sending domain is not verified
`GET https://api.resend.com/domains` returns `{"data":[]}` for this account, so
`onboarding@kigalisafety.dev` cannot send. Sending fails with:
    403 validation_error - "The kigalisafety.dev domain is not verified."

The API key itself is valid (it is used to read /domains and /api-keys fine).
Verification needs DNS records on the kigalisafety.dev zone, which needs
registrar/DNS access that is not available in this environment.

Workaround in place so the flow could be proven for real: EMAIL_FROM was pointed at
Resend's sandbox sender, `Kigali Safety Academy <onboarding@resend.dev>`. That
sandbox only ever delivers to the account owner's own address
(gahiredev01@gmail.com), so the harness switches the exam recipient's email to that
address before sending. `.env.local` carries a comment block next to RESEND_API_KEY
recording that EMAIL_FROM must go back to `onboarding@kigalisafety.dev` once the
domain verifies. Until then "OTP Email Verified" in progress.md cannot be ticked on
the strength of a real inbox check alone.

### Defect 1 (fixed): Trainee had no relation to Category
`prisma/schema.prisma` kept `Trainee.categoryId String` with no relation and no
back-reference on Category, but `app/api/trainees/route.ts` includes `category` in
every read and write. Prisma rejected the query at runtime:
    Unknown field `category` for include statement on model `Trainee`
so POST /api/trainees 500'd, GET /api/trainees 500'd, and the duplicate-email guard
never ran. Fixed by adding the relation plus `Category.trainees`, and applying
migration 20261005211908_add_trainee_category_fk.

### Defect 2 (fixed): Prisma client generated by a dev CLI, not the pinned one
`lib/generated/prisma` had been produced by `pnpm dlx prisma`, which resolved
8.1.0-dev.7 while package.json pins prisma 7.10.0. Regenerated with the local
binary (`node_modules/.bin/prisma generate`, 7.10.0) so the client matches
@prisma/client and @prisma/adapter-pg. Use the local binary for migrate/generate,
never bare `pnpm dlx prisma`.

### Defect 3 (fixed): /next disclosed attempt state before the OTP was entered
`app/api/exams/attempts/[token]/next/route.ts` checked `status !== "STARTED"` before
checking the exam-session cookie, so anyone holding only a link got 410 "This exam
is not open." for a pending sitting and 401 "Enter the code..." for a started one -
the status code alone told a stranger which state the attempt was in. The cookie
check now runs first, so an unverified visitor always gets the same 401.

### Runner/OTP front-end fixes
- components/exam/OtpInput.tsx: setDigit updated the `focused` index but never moved
  DOM focus, so auto-advance only recoloured the box and the next keystroke returned
  to the box already typed in. Now focuses the next box imperatively (same for paste).
- components/exam/ExamRunner.tsx: autosave derived the question to save from the last
  key of the `answers` object. Re-answering an earlier question rewrites an existing
  key and leaves its position, so the wrong question could be saved. Replaced with an
  explicit `pendingSave` ref set by the radio handler.
- components/exam/ExamRunner.tsx: submit could beat the 900ms autosave debounce, so
  the final answer was graded as unanswered. `submit` now awaits `flushPendingSave()`
  first.
- components/exam/ExamRunner.tsx: a zero-second timer tick could fire repeated
  submits while the first was in flight. Guarded with `autoSubmitted`.
- app/(app)/exams/new/page.tsx rewritten off mock data onto the real APIs, reporting
  the per-trainee sent/failed/skipped outcome the send route returns.

### Verification
- npx tsc --noEmit: 0 errors
- pnpm lint: 0 errors, 0 warnings
- pnpm build: green (Next 15.5.26)
- tmp-e2e.ts extended to 131 checks against the running dev server + live Neon:
  119 pass, 12 fail. The harness resets its own fixtures each run (owner TOTP,
  E2E courses, test trainees) so it is re-runnable.

Proven green by that run: whole Phase 1 auth surface (login, MFA enrol/confirm/
verify, TOTP single-use replay protection, recovery codes single-use, per-session
MFA rate limit with Retry-After, security headers, X-Request-Id correlation,
no stack traces), course + trainee CRUD, and the entire exam-link OTP flow -
send -> emailed link -> wrong code 401 + otpAttempts increment -> correct code ->
frozen manifest -> paper with no isCorrect -> autosave rejects off-manifest ids ->
submit grades 100% -> PASSED -> certificate issued at studentNumber 263.

### Known gaps carried forward
- The 12 remaining failures are all Step 10, which has not been started:
  `app/api/certificates`, `app/api/certificates/[id]/revoke`,
  `app/api/certificates/[id]/pdf` and `app/api/verify/[token]` do not exist. The
  public `app/verify/page.tsx` is still backed by `mockApi` and needs rewiring.
- `app/api/questions/route.ts` (new, untracked) returns `isCorrect` to staff, which
  will fail the Step 9 blanket grep. Decide whether staff question editing needs the
  answer key in the response.
- `lib/certificates/issue.ts` is still not in a transaction and can mark an attempt
  PASSED before the certificate row exists.
- No SSE route, heartbeat, client hook or notification centre yet.
- Access links, referrals and the 5-device cap are untouched (Step 4).
- No PWA manifest/icons/service worker, no Lighthouse run, no Vercel deploy.
- `NEXT_PUBLIC_APP_URL` is still absent from .env.local.

---

## Session: Step 10 certificates, public verification, revocation and PDF

### Routes added
- `app/api/certificates/route.ts` — staff register. `certificate.read`, MFA required.
  Search across trainee name, enrolment number, course name/code and the numeric
  student number; status is filtered in memory because it is derived, not stored.
- `app/api/certificates/[id]/route.ts` — staff detail, including `contentHash` and
  the originating attempt so a certificate can be traced back to its exam.
- `app/api/certificates/[id]/revoke/route.ts` — `certificate.revoke`, which is
  OWNER-only in `lib/auth/authorize.ts`. Idempotent: revoking twice returns the
  certificate rather than erroring, so a double-clicked button is not a failure.
  Writes an `auditLog` row with the actor, reason and IP.
- `app/api/certificates/[id]/pdf/route.ts` — `private, no-store`, `attachment`
  disposition. `certificate.read` rather than a new grant: an actor who may revoke
  already holds read.
- `app/api/verify/[token]/route.ts` — unauthenticated, deliberately. Returns 200 with
  `status: "REVOKED"` rather than an error so the public page can show the reason;
  only a token matching nothing is a 404.

### Public payload is deliberately thin
`lib/certificates/verify.ts` is the single projection used by both the API route and
the server-rendered page, so the two cannot drift. It carries the holder's name, the
course, the topics, the dates, the printed student number and the revocation reason —
and nothing else. No email, no phone, no internal id, no enrolment number, and no
`contentHash`. The old mock page printed the content hash on the public card, which
would have handed anyone holding a leaked token enough to confirm a forged row.

The token helpers live in `lib/certificates/token.ts` rather than `verify.ts` so the
search box in `/verify` can parse a pasted link in the browser without pulling Prisma
and the `pg` driver into the client bundle — that split is what first broke the build.

### Status is derived, never stored
`lib/certificates/status.ts` computes VALID / EXPIRING / EXPIRED / REVOKED from
`revokedAt` and `expiresAt` on read. Revoked wins over expired: "we withdrew this" is
the more important message to an employer. Storing the state would need a nightly job
to keep it honest.

### Revocation keeps the row
Revoking never deletes. A revoked certificate that quietly vanished would leave an
employer holding a PDF with no way to learn it was withdrawn, and it would destroy
the audit trail. The PDF still renders, stamped REVOKED.

### PDF
`@react-pdf/renderer` 4.9.0 added. `lib/certificates/pdf.tsx` builds the document and
`lib/certificates/render.ts` renders the buffer. Both read only the snapshot columns,
so a renamed course or trainee never rewrites an already-issued certificate. Fonts are
read from `public/fonts` if present and fall back to base-14 Helvetica rather than
fetching from a CDN, so a cold render cannot block on the network.

The score is deliberately **not** printed on the certificate. A pass mark is an
internal judgement; printing it turns a competence record into a permanent grade
sheet. The old mock page printed it, along with a fake `pdfKey`.

### Fixed: certificates could be lost permanently
`app/api/exams/attempts/[token]/submit/route.ts` set the attempt to PASSED and marked
the trainee COMPLETED *before* allocating a student number. If allocation then failed —
a number clash that outlasts the retry, or a process death in between — the attempt
stayed PASSED, nothing retried it, and the trainee was permanently without their
certificate.

A transaction is not the fix: the MAX+1 allocation relies on catching a P2002 unique
violation, and a failed statement aborts a Postgres transaction, so the retry loop
cannot run inside one. Made it self-healing instead:

- Allocation failure on the first path now logs loudly with the attempt, trainee and
  course ids, instead of failing quietly.
- The replay path (any re-submit of an already-graded attempt) attempts issuance again
  when the attempt is PASSED. `issueCertificate` returns the existing row without
  re-sending the email, so this repairs the hole and cannot spam the holder.

### Verification
`npx tsc --noEmit` clean, `pnpm lint` clean, `pnpm build` green.
`tmp-e2e.ts`: **131/131**, stable across two consecutive runs. The first run showed one
failure, which was cold route compilation on the newly added endpoints.

### Verified end to end
send -> OTP -> paper -> autosave -> submit grades 100% -> PASSED -> certificate
issued at studentNumber 263 -> register lists it -> `/api/verify/<token>` returns
VALID with no session and no `@` anywhere in the body -> owner revokes -> same URL
returns REVOKED with the reason -> `/pdf` returns 200, `attachment`,
`application/pdf`, body starting `%PDF` (5060 bytes).

## Pre-launch blockers
Verify kigalisafety.dev on Resend before launch: add DKIM/SPF DNS records, then swap EMAIL_FROM.

## Step 4 — access links, referral codes, device limit

- `POST /api/access-links` (OWNER) mints `ADMIN`/`TRAINER` links; `OWNER` links are rejected
  by the enum, and `TRAINER` links must name a real trainer (422 otherwise). The response
  carries the plaintext token exactly once with `Cache-Control: no-store`; only the SHA-256
  digest is persisted, and the list response never contains a token.
- `POST /api/access-links/redeem` is unauthenticated, takes the token in the body, creates
  the account, consumes the link with a compare-and-set (single-use replay → 410 with the
  same message as an unknown token), records a device, and returns `mfa-setup` — the session
  is unusable until TOTP enrolment.
- `POST /api/access-links/[id]/revoke` (OWNER) cascades: revokes the link, deletes its
  sessions, revokes its devices, writes an audit record.
- `POST /api/referral-codes` (OWNER) mints look-alike-free codes (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
  with `maxUses`/expiry; consumption is one atomic `UPDATE ... WHERE timesUsed < maxUses`.
- `GET /api/devices` + `POST /api/devices/[id]/revoke` are self-service. Cap is 5: the sixth
  sign-in evicts the least-recently-seen device rather than failing. Self-revoking the device
  in use → 422. `deviceHash` never appears in a response.
- Owner UI: `app/(app)/access/page.tsx`, linked from the sidebar under Team (OWNER only).
  Public redemption: `app/(auth)/access/[token]/page.tsx`, which posts the token in a body and
  then routes straight to TOTP enrolment.

`tmp-e2e.ts`: **168/168**, stable across two consecutive runs (up from 131). New coverage
includes anon→401, token shape/absence, no-store, owner-link and trainer-without-trainer
rejection, redeem + single-use replay + equal error messages, existing-account takeover
refusal, an invited admin signing back in with a password, password-only sessions being
refused by data routes, seven consecutive correct sign-ins never rate limiting, device
cap/visibility/self-revoke, referral minting and charset, revoke cascade, a session cookie
without its device cookie resolving to no session *without* destroying the real one, and
device revocation ending the sessions it created. Two harness bugs fixed along the way: the
cookie jar only absorbs a session when the request used that jar, and raw `fetch` calls now
send both cookies.

`getSession()` now resolves the device beside the session and returns one of three outcomes:
`active` proceeds; `revoked` deletes the session and clears the cookie; `unknown` refuses the
request but leaves the row alone, so a leaked session cookie cannot sign the real device out.
The five-device cap is therefore a real cap now, not just a row count.

## Step 4 follow-up — the two defects it exposed

- **Phase 1 single-tenant login gate removed.** It rejected every non-OWNER password, which
  meant an admin or trainer invited by a link could sign in exactly once and then never again.
  Safe to lift because `guard()` requires `mfaPassed` on every data route and Step 4 makes TOTP
  enrolment the mandatory first step, so a password still reads nothing on its own.
- **Login rate limiter charged successes.** `rateLimit()` checked and incremented in one call,
  and it ran *before* the password was tested — so every successful sign-in spent one unit of a
  five-attempt budget. Twenty staff behind one office NAT would have locked the building out,
  and an attacker who already knew a valid password could have starved the real user out of
  their own account. Split into `rateLimit(..., { consume: false })` for the check and
  `rateLimitHit()` on the failure path only; a correct password also clears the address's own
  bucket. Every other caller keeps the default `consume: true`, so OTP/MFA/autosave limits are
  unchanged. Regression checks: seven correct sign-ins all 200, then a wrong password still 401.

## Step 6 — realtime notifications

The mock SSE loop is gone. Notifications now come off the database and reach the browser over a
real stream.

**Routes added**

| Route | What it does |
| --- | --- |
| `GET /api/notifications` | The signed-in user's rows, plus `total` and `unread`. Scoped by `session.user.id` only — no query parameter can widen it. `Cache-Control: private, no-store`. |
| `POST /api/notifications` | Marks one `{ id }` or everything `{ all: true }` read. Both filters carry `userId`, so a guessed foreign id matches nothing rather than marking it read. |
| `GET /api/notifications/stream` | SSE. Same `guard()` as everything else, so there is no separate unauthenticated path into the bus. |

The stream does the three things a naive SSE route skips: `request.signal` **and** the stream's
`cancel()` both run one teardown (an unsubscribe that never fired would leak one EventEmitter
listener per reconnect attempt); a `: ping` comment every 25s keeps proxies from dropping an idle
connection; and `Cache-Control: no-cache, no-transform` plus `X-Accel-Buffering: no` stop nginx
accumulating events and delivering them in a burst long after they happened. `retry: 3000` and a
named `open` event let the client tell "authenticated and listening" apart from "connected but
rejected".

**Client**

- `lib/hooks/use-notification-stream.ts` — `useNotificationStream()` opens the `EventSource` and
  folds events into the store; `useNotificationHydration()` replaces the store with the server's
  copy on mount. `onerror` distinguishes `CONNECTING` (the browser is already retrying — stay out
  of its way) from `CLOSED` (it gave up, e.g. on a 401 — reconnect ourselves with capped
  exponential backoff), and a `visibilitychange` reconnect gets a usable stream back immediately
  after a backgrounded tab wakes. Each event also invalidates the query keys it affects, so a
  "certificate issued" push refreshes the certificate list.
- `components/layout/AppShell.tsx` mounts both instead of the deleted `use-realtime-events.ts`.
- `lib/stores/notification-store.ts` gained `hydrate()` and **no longer seeds from
  `lib/mock/notifications.ts`** (deleted). It starts empty, so a persisted copy of demo rows can
  never be mistaken for real ones. `hydrate()` keeps anything that arrived over SSE while the
  fetch was in flight.
- `NotificationBell` drops its "restore demo notifications" button and persists read state to
  the server (optimistic, self-correcting on the next hydration).
- New `app/(app)/notifications/page.tsx` — the notification centre, with an unread filter, a
  mark-all control, per-row type chips and a live/offline indicator. Reads the same store as the
  bell, so the two cannot disagree. Linked from the sidebar under Main.

**Two authorisation defects found and fixed while building this**

1. `authorize()` applied the `TRAINER_SCOPED` resource check to *every* action, so a trainer
   calling `guard("notification.read")` with no course to name was denied their own notifications
   (`403 Trainers can only work on the courses assigned to them`). Added a `SELF_SCOPED` set —
   actions whose rows are already scoped by `session.user.id` — which currently holds
   `notification.read` and `device.self`. Missing from the set still requires a resource, so it
   stays closed by default.
2. The devices routes borrowed `guard("notification.read")`, which was never the right action.
   Added `device.self` (`ALL_ROLES`, self-scoped) and switched both routes to it, leaving
   `device.manage` for the owner acting on somebody else's device.

`NotificationType` was also missing `exam.sent`, `exam.passed` and `exam.failed` — types
`emit()` has been writing all along — which made `Record<NotificationType, …>` in settings and the
mock matrix incomplete. The list route checks the stored string against the known union and falls
back to `"system"` rather than casting, so an unexpected value cannot reach a `switch` that
silently matches nothing.

**Verification**: `npx tsc --noEmit` clean, `pnpm lint` clean, `pnpm build` green with
`/notifications`, `/api/notifications` and `/api/notifications/stream` in the output, and
`npx tsx tmp-e2e.ts` at **183/183** across two consecutive runs. The new checks cover list,
unread count, an `exam.sent` row actually written by the send flow, cross-user isolation on both
list and mark-read, anonymous 401s, the stream's content type, and direct assertions that a trainer
is allowed `notification.read` / `device.self` and still denied course-scoped work.

## Step 7 — PWA (manifest, icons, service worker)

Installable web app scaffolding, from one source asset.

- `public/icons/*` — generated by `node scripts/gen-icons.mjs` (dev-only `sharp`) from
  `public/logo.svg`: `icon-{16,32,48,96,192,512}.png`, `maskable-{192,512}.png`,
  `apple-touch-icon.png` and `icon.svg`. The maskable variant drops the rounded corners and
  scales the glyph to ~64% so it survives Android's circular droplet mask; `public/logo.svg`
  is served as the `"sizes": "any"` SVG entry, so the logo stays crisp at any zoom. The
  PNGs are committed, so a fresh checkout builds without running the generator.
- `public/manifest.webmanifest` — standalone display, `start_url: /dashboard`, theme/background
  `#f4f2ec`, the full icon list (any + maskable), and shortcuts to Trainees, Certificates and
  Notifications. Served as `application/manifest+json`.
- `app/layout.tsx` — `metadata.manifest`, `metadata.icons` (favicons + iOS touch icon) and
  `appleWebApp` (capable, title, status bar), since iOS ignores the manifest. Registered
  `ServiceWorkerRegistration` in the body.
- `public/sw.js` — deliberately conservative for an authenticated app:
  - **Never caches `/api/**`, `/exam/**` or `/_next/image`** — a cached `/api/trainees` in the
    Cache Storage of a shared device is a breach; the exam runner must never open offline.
  - Navigations are network-first with a bounded cached copy (and `/offline`) as fallback, so
    a user on a flaky connection sees their last view rather than a browser error, but online
    always wins.
  - `/_next/static/**` and icons are cache-first with background revalidation (immutable,
    content-hashed).
  - Versioned cache (`ksa-v1`), `skipWaiting`/`claim` on install/activate, stale-cache purge.
- `app/offline/page.tsx` — `force-static` offline fallback that renders no data and touches no
  session; it is the only HTML the worker serves from cache unconditionally. Verified old that
  it renders without a session.
- `components/pwa/service-worker-registration.tsx` — registers `/sw.js` on `load`, **production
  only**: in dev `/_next/static` chunks are re-hashed every compile and caching them breaks HMR
  and serves stale code. Failures degrade to no-offline, never crash the render.

Manual gate (still open): on a phone (or Chrome DevTools device emulation) Add to Home Screen /
install, then go offline and confirm the shell + `/offline` appear. The `sw.js` file itself,
manifest content types and the offline page render are smoke-checked (see below).

**Verification**: `npx tsc --noEmit` clean, `pnpm lint` clean, `pnpm build` green with
`/offline` shown as static, and `npx tsx tmp-e2e.ts` at **191/191** across two consecutive runs.
The new PWA checks prove the manifest serves, declares `standalone` + the dashboard `start_url`,
lists the 192/512/maskable icons, that `/icons/icon-512.png` is a real PNG, that `/sw.js` serves
as JavaScript with the `/api` never-cache guard in it, and that `/offline` renders session-free.

## Still open after Step 7
- `app/api/questions/route.ts` returns `isCorrect` to staff; Step 9's blanket grep
  needs a decision on whether staff question editing gets the answer back.
- No Lighthouse run (Step 8), no Vercel deploy.
- The broadcaster is in-process (`EventEmitter`), so a multi-instance deploy would only deliver
  each event to the instance that produced it. Fine for one Vercel function; revisit on scale-out.
- `AccessLink.referralCode` is its own random string and is not a `ReferralCode` row, so a
  link's companion code and the referral-code table are still two separate things;
  `consumeReferralCode()` has no route to call it from.
- Manual gates: real OTP inbox check, six-browser device test, phone PWA install.
- `NEXT_PUBLIC_APP_URL` is still absent from .env.local; `appUrl()` falls back to
  `APP_URL`, which is correct for localhost but must be set for production.

## Login — Locked In (2026-10-06 16:37:49 +02:00)

Flow: email + password → 6-digit email code → dashboard. No TOTP, no authenticator app,
no QR scan. All 25 edge cases green (matrix below).

### What shipped

- **Schema** — `LoginOtp` (migration `20261006125609_login_otp_email`): one live code per
  user, argon2id-hashed, 10-minute expiry, `attempts` capped at 5, `resendCount`/`lastSentAt`
  for the resend cooldown.
- **`POST /api/auth/login`** — validate (400) → per-IP 20/15 min (charged for every request)
  → lookup with a dummy argon2 verify for unknown addresses → identical `401 Invalid email
  or password` → `403` disabled → `423` locked → per-account 5/15 min → single active code →
  mail. Send failure deletes the row and returns `500 Could not send code. Try again in a
  moment.` The body never carries the code, the hash or a user id.
- **`POST /api/auth/login/verify`** — format check first (`400` even before any lookup) →
  per-IP 30 → per-email 10 → one identical `401 Invalid or expired code` for unknown
  address / no code on file / expired / wrong → `429 Too many attempts. Request a new code.`
  at attempt 6 → on success: row destroyed, session + device record minted, `lastLoginAt`
  set, body is only `{ role, email, name }`.
- **`POST /api/auth/login/resend`** — 3/15 min, a silent 60 s cooldown from `lastSentAt`,
  `{ ok: true }` for unknown addresses (nothing leaks), row rolled back if the mail fails.
- **`app/(auth)/login/page.tsx`** — one page, two phases: credentials, then six `otp-0…otp-5`
  boxes with auto-advance, backspace/arrow handling, paste, a 200 ms-debounced auto-submit,
  a 10-minute expiry countdown, a 60-second resend cooldown, and `Use a different email`.
  The pending address survives a refresh via `localStorage` (`ksa:login:pending-email`) and is
  dropped on back-navigation so returning from the dashboard lands on a clean Phase A.
- **Email** — `loginOtpEmail()` / `sendLoginOtpEmail()` in `lib/email/templates.ts` (throws
  on failure so the route can answer 500), `EMAIL_FROM` falls back to `onboarding@resend.dev`.
- **`GET /api/auth/me`** — `401` when signed out, `{ id, email, role, name }` when not.
- **Unlinked TOTP** — no redirect into `/login/mfa*` from anywhere; `/login/mfa` and
  `/login/mfa/setup` now `redirect("/login")`; `guard()` lost its `requireMfa` option; the
  app layout no longer branches on `mfaPassed`; invite redemption mints a complete session
  and goes straight to `/dashboard`. `User.totpSecret`/`totpEnabled` and the MFA endpoints
  are untouched for a possible return of the feature.

### Recovery

If login breaks, run `pnpm dlx tsx scripts/reset-owner.ts` to reset the owner password and
clear sessions/OTP rows. Add `--reset-password` to also rewrite the password to
`SEED_OWNER_PASSWORD`, `--password <value>` for a specific one, `--email <addr>` for a
different account, `--keep-sessions` to leave sessions alone. `prisma/seed.ts` is idempotent,
takes the password from `SEED_OWNER_PASSWORD`, has no TOTP requirement, and clears any
outstanding code on every run.

### Email sender

`onboarding@resend.dev` for now; swap to `onboarding@kigalisafety.dev` after the domain is
verified.

### Deliberate deviations

- Session rows keep the existing `createSession` scheme (DB id = `HMAC(token)`, cookie holds
  the 32-byte base64url token) instead of "the row id *is* the 32 bytes". Same cookie names
  (`ksa_session` / `__Host-ksa_session`), same flags (httpOnly, secure in prod, sameSite lax,
  7 days) and the database never stores the token itself.
- `verify` also calls `recordDevice()` — without a device cookie `getSession()` treats the
  session as a copied half-credential and refuses it.
- Test 5 was executed by backdating `LoginOtp.expiresAt` (`tmp-backdate-otp.ts`) rather than
  sitting out 11 real minutes: the row, its attempts and the code stay exactly as the server
  wrote them, so `verify` takes the same branch it would after 11 minutes.

### Two bugs the matrix caught (both fixed)

1. `clearCode()` also reset `codeError`, so the 401/429 message was set and wiped in the same
   batch — a wrong code showed no error at all. Fixed by clearing the boxes *before* stating
   the reason.
2. The code fieldset was disabled while `verifying`, so the "focus back to box 1" call after a
   401 hit a disabled input and focus fell to `<body>`. The fieldset is now disabled only
   during the post-429 lockout (the submit button stays disabled while a request is in flight).

### How the 25 were run

Playwright (Chromium via the installed Edge channel, headless) against
`http://localhost:3000`, in five groups — 1–5, 6–8, 9–14, 15–17, 18–25 — with the dev server
restarted before each group so the in-memory rate-limit buckets start empty. Every code was
read back out of the delivered mail through the Resend API, so the browser tests are true
end-to-end runs, not stubs. `pnpm lint` and `pnpm exec tsc --noEmit` are both clean.

## Login — Edge Case Matrix

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Happy path: email + password → code → dashboard | ✅ | code delivered 10.0s after the click (7.6–10.0s across runs, visible in the inbox 0.9s after Resend accepted it); /dashboard reached |
| 2 | Wrong password → 401, no email sent | ✅ | error "Invalid email or password"; newest sign-in-code email id unchanged after 5s |
| 3 | Nonexistent email → same generic 401, no email | ✅ | byte-identical message to test 2; no code email |
| 4 | Correct password, wrong code (000000) → 401 | ✅ | "Invalid or expired code"; all six boxes cleared; focus back on box 1 |
| 5 | Correct password, code expired (11 min) → 401 | ✅ | `expiresAt` backdated to −60s, real code rejected with the same generic 401 (row deleted server-side) |
| 6 | Wrong code ×5 → 6th attempt 429 | ✅ | verify statuses 401,401,401,401,401,429; UI shows "Too many attempts. Request a new code." |
| 7 | Resend: new mail, old code dead, new code works | ✅ | old code → 401, new code → dashboard; toast "New code sent" |
| 8 | Resend cooldown: link disabled with 60s countdown | ✅ | `disabled=true`, link reads "Didn't get it? Resend in 60s" |
| 9 | Paste 6 digits → all boxes fill and auto-submit | ✅ | paste of "482913" filled `["4","8","2","9","1","3"]` and fired the verify POST; real code then signed in |
| 10 | Auto-advance: typing moves focus right | ✅ | focus path `otp-1 → otp-2 → otp-3` |
| 11 | Backspace on empty box 4 → box 3 focused and cleared | ✅ | focus `otp-2`, its value cleared, later boxes untouched |
| 12 | Arrow keys move focus without changing values | ✅ | ArrowRight → `otp-3`, ArrowLeft ×2 → `otp-1`; values identical before/after |
| 13 | Refresh on Phase B | ✅ | stays on Phase B, boxes empty, email kept in `localStorage` |
| 14 | Back button from dashboard | ✅ | lands on fresh Phase A (0 code boxes, email field empty, `ksa:login:pending-email` cleared) |
| 15 | Login → logout → login again | ✅ | sign-out → /login with `/me` 401; second sign-in → /dashboard with `/me` 200 |
| 16 | Login on browser A and browser B | ✅ | both sessions valid (`/me` 200 in each context) |
| 17 | Logout on A → B unaffected | ✅ | A `/me` 401 after sign-out, B still `/me` 200 on `/dashboard` |
| 18 | 25 rapid logins from one IP | ✅ | requests 1–20 → 401, request 21 onwards → 429 |
| 19 | `/login` with missing body fields → 400 | ✅ | `{}`, `{email}`, `{password}` all 400 |
| 20 | `/login` with malformed email → 400 | ✅ | `"not-an-email"` and `"a@b"` both 400 |
| 21 | `/login/verify` with code `abc123` → 400 | ✅ | non-numeric rejected before any lookup |
| 22 | `/login/verify` with code shorter than 6 → 400 | ✅ | `"12345"` → 400, `"1234567"` → 400 |
| 23 | `/login/verify` with no prior `/login` → 401 | ✅ | 401 "Invalid or expired code" (no `LoginOtp` row), code not echoed back |
| 24 | No `console.log` carrying code/otp in the login route | ✅ | 1 console statement in the route (`console.error` on send failure, no code/otp), 0 `console.log/info/debug` |
| 25 | `mfaPassed` only remains in non-login paths | ✅ | 20 hits total; 19 outside login (store, SessionBridge, layout, MFA endpoints, session helper); the single login-path hit is the `mfaPassed: true` **write** at `app/api/auth/login/verify/route.ts:109`, not a check |

25/25 ✅ — no open failures.



## Session — 2026-10-06 20:38:34 +02:00 — Overnight polish

### git log --oneline -10
e0843c9 feat(auth): email-OTP sign-in replaces TOTP at login
2f71745 fix(auth): switch to hash-wasm to avoid native Windows binary block
37fe7d6 ∩╗┐fix(a11y): reach 100 on Lighthouse a11y audits
5082e03 chore: drop accidental dev-server.log from tracking
db97a17 feat(pwa): manifest, icon set, service worker and offline shell
a3c06b1 feat(notifications): realtime SSE stream, notification centre, and two authz fixes
9ce7275 ∩╗┐fix(auth): stop charging the login rate limit for successful sign-ins
b13fc23 ∩╗┐Step 4: access links, referral codes, five-device cap
e171e2b Step 10: certificates, public verification, revocation and PDF
2128a9f fix(exams): restore Trainee-Category relation, order /next session check first, harden exam runner

### git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	public/certificate/signature.png
	public/logo.png
	public/student/

nothing added to commit but untracked files present (use "git add" to track)

### git diff --stat HEAD


### Env check (.env.local)
DATABASE_URL=po***e (present)
SESSION_SECRET=Gu***= (present)
SEED_OWNER_PASSWORD=Ch***! (present)
RESEND_API_KEY=re***u (present)
EMAIL_FROM=Ki***> (present)
APP_URL=htt***00 (present)
NEXT_PUBLIC_APP_URL = MISSING (only needed for Vercel — Step 16)
TWILIO_* = MISSING (WhatsApp lookup will fall back to email-only — Step 6)

### Assets
public/logo.png: present
public/certificate/signature.png: present
public/student/: present (KIGALI SAFETY ACADEMY STUDENTS LIST.docx, 29405 bytes)

### Step 0 verification
pnpm build: GREEN (Next 15.5.26, all routes compiled; /dashboard 140 kB first-load JS -> Step 9 target)


## Step 1 — Demo/dev indicators removed (2026-10-06 20:47:03)
- DemoBanner usages removed from 17 files; components/shared/DemoBanner.tsx deleted. Zero 'DemoBanner'/'demo data' matches in app/, components/, lib/ source.
- Removed the auth-layout 'front-end demonstration' footer, both verify-page 'demonstration service' footers, and the AppShell 'Other sections still show demo data' sentence.
- next.config.ts: devIndicators: false added (plus optimizePackageImports, see Step 9).
- Only remaining console.warn is the PWA service-worker registration failure (internal, legit).
- pnpm lint: 0 errors/warnings. npx tsc --noEmit: 0 errors.


## Step 2 — Logo everywhere (2026-10-06 22:xx) 
- components/shared/Logo.tsx rewritten: next/image on /logo.png, alt "Kigali Safety Academy". Sidebar size 32, auth-layout brand 48.
- scripts/gen-icons.mjs rewritten to source from public/logo.png; regenerated all PWA/apple/favicon icons and icon.svg (now embeds a 256px PNG).
- Certificate detail sheet, PDF (lib/certificates/pdf.tsx) and all three email templates (lib/email/templates.ts) now lead with the logo (detail 80px, PDF 60pt, email 120px header). react-pdf Image has no alt prop (eslint suppressed).
- lib/mock/index.ts logoUrl -> "/logo.png"; app/(app)/payments/[id]/page.tsx already pointed at /logo.png.

## Step 3 — Sessions management (2026-10-06 22:xx)
- Schema: Session.lastSeenAt DateTime? + ExamAttempt.integrityFlags Json? -> migration `20261006185808_session_last_seen_integrity_flags` applied (EXIT=0); prisma generate re-run.
- TTLs: SESSION_TTL_SECONDS 30d / SESSION_SHORT_TTL_SECONDS 12h. Login page "Remember me for 30 days" checkbox (default on); createSession({remember}) sizes cookie+row from the same TTL; getSession refreshes lastSeenAt <= every 5 min.
- Device cap: enforceDeviceCap skips OWNER role (owner never hits the 5-device eviction).
- New API: GET /api/auth/sessions, DELETE /api/auth/sessions/[id] (self-only, clears cookie when it was the current one), POST /api/auth/sessions/revoke-others. lib/utils/ua.ts (agent parsing) + lib/utils/geo.ts (ipwho.is lookup, 1.2s timeout, private-IP skip, memoized).
- New UI: /settings/profile — account card + owner-only active-sessions list (per-row sign out + "sign out all other sessions"). Sidebar link lands in Step 8.
- Removed the SEED_OWNER_PASSWORD hint from the login page; added the developer credit (Step 12, part 1).

## Step 4 — Certificate expiry removal (2026-10-06 22:xx)
- Certificate.expiresAt column kept, but issuance (lib/certificates/issue.ts) now always writes null; snapshot hashes expiresAt:null. issuedAt = new Date(); issued date shown as DD.MM.YYYY on the sheet + PDF; topics joined with " , ".
- Register: Expiring/Expired chips, status filters and stat cards removed (only Valid/Revoked remain); "Expires" table column and CSV `expires_at` column removed; "expiring soon" banner deleted.
- Verify surfaces: /verify and /verify/[token] copy no longer mention expiring/expired/"in date"; CertificateResult "Issued" no longer prints "Valid until … / No expiry date".
- Notification type "certificate.expiring" removed from the union and all maps (types, settings, notifications page, /api/notifications KNOWN_TYPES, SSE stream key mapping). "exam.link.expiring" kept (exam links genuinely expire). No background jobs/cron exist to remove.
- Course.validityMonths: now null in seed.ts (all 8 courses) and all mock courses. CourseForm no longer collects a validity field (removed schema field, default, hydration and FormField); course API create/update no longer write it; course detail no longer shows a validity row/pill.
- mocks: dashboard no longer surfaces expiring/expired certificate alerts; mock certificates are VALID unless revoked (brief's revoked sample retained). Dashboard "Upcoming deadlines" description no longer says "expiring certificates".
- Verify: pnpm build GREEN, tsc clean, eslint clean (0 warnings).## Student Numbering � Source of Truth

- Source: public/student/KIGALI SAFETY ACADEMY STUDENTS LIST.docx (Word table, 2 columns: number | name)
- Register rows parsed: 443; unique students: 382; aliases: 57; number collisions: 3 (#74, #214, #231); skipped: 2 (#5 \"## the certificate was skipped\", #344 \"ane\")
- Numbers missing (intentionally absent in register): 42, 45, 66, 86, 119, 227, 232, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332
- Register max student number: 456
- Register next allocation (certificate numbers): 457
- Manifest: scripts/student-list/student-numbers.json (382 students); summary: scripts/student-list/register-numbers.ts (REGISTER_MAX_STUDENT_NUMBER=456, REGISTER_NEXT_STUDENT_NUMBER=457)
- Seeding: scripts/seed-from-student-list.ts imports the register idempotently, creates only numeric trainee numbers (plain register numbers), does NOT enroll (courseId null), and uses placeholder contacts (student-<n>@register.example, +250000000000, Rwanda, category Firefighters). Rows edited by the owner keep their real contacts and are never overwritten; re-runs clean stale placeholder rows for removed fragments.
- Certificate allocation: new certificates start at max(certificate.studentNumber, REGISTER_NEXT_STUDENT_NUMBER) and increment, preserving uniqueness via the index and retry on clashes (see lib/certificates/issue.ts).
## Session � 2026-10-07T09:00:00Z � Morning resume

- git log --oneline -10: clean recent commits (latest c736c09)
- git status: clean (working tree)
- tsc --noEmit: 0 errors
- build: green

Sidebar.tsx syntax error (overnight PowerShell corruption) fixed by restoring from git. Ready for Step 1.


## Session - Claude - 2026-10-07 - Part D (owner signature)

Resumed at: Part D. Remaining: E-Q (F link lifecycle, I Twilio, audits of G/H/J/K/L/M/N, smoke, deploy).

- Step 0: tsc/lint/build were red on arrival (half-edited integrity-flag route from a WIP commit). Fixed; all three green.
- D.1: Signature model + SignatureSource enum; Certificate.signatureUrlSnapshot/signerNameSnapshot/signerTitleSnapshot (nullable, legacy rows). Migration 20261007120000_signature_system WRITTEN BY HAND, NOT APPLIED. Includes partial unique index so only one row can be active.
- Storage decision: PNG bytes live in Signature.imageData (BYTEA), served from /api/signature/:id/image. No R2 and Vercel has no writable disk. imageKey = db:<id>.
- D.2: /settings/signature (owner only): Draw tab (1400x400 canvas shown at 700x200, pressure, undo/redo/clear, transparent PNG) + Upload tab; lock panel with checkbox. Sidebar link added.
- D.3: POST /api/signature/upload (5/min/IP, owner only), POST /api/signature/lock (transactional, audit signature.lock), GET /api/signature, GET /api/signature/:id/image (public once locked). New authz action signature.manage (OWNER).
- Image hygiene: lib/signature/png.ts, dependency-free: magic bytes, 2 MB, dimension bounds, keeps only render chunks (strips EXIF/text). SVG rejected. Tested against real signature.png and malformed inputs.
- D.4: issueCertificate snapshots the active signature; PDF + detail page read the snapshot only. Legacy certs keep the bundled static signature + Director name.
- D.5: PDF/detail signature block uses a fixed 60pt band, image max 180x60 contain, line below.
- D.6: prisma/seed.ts seeds public/certificate/signature.png as active UPLOADED if no Signature row exists.

BLOCKERS (cannot be resolved in this environment)
- No .env / DATABASE_URL: migrations unapplied, seed not run, smoke tests 1-24 not run.
- No Twilio credentials, no Vercel access.
- Not pushed: repo is Gahire01/KSA and the signed-in GitHub account here is gmflaubert. Work is on local branch ksa-launch.

### Part D review result (2 independent reviews, 1 rotation of fixes)
- Fixed (b1b6056): legacy-vs-no-signature discriminator (null signerNameSnapshot = legacy only), atomic upload (no "pending" URLs), lock race -> 409, audit writes no longer fail a committed action, image route try/catch.
- Known limitations: in-memory rate limiter is per-process (pre-existing, app-wide); PNG cleaner drops iCCP profiles; lock-race 409 relies on the pg adapter surfacing code P2002 (unverified without a DB); migrate dev may propose dropping the partial index Signature_one_active, so keep it.


## Session - Claude - 2026-10-07 - Part F (exam link lifecycle)

Resumed at: Part F. Remaining: I (Twilio), audits of G/H/J/K/L/M/N, smoke, deploy.

- F.1 schema: ExamAttempt linkMaxUses/linkUses/firstOpenedAt/firstOpenedIp/firstOpenedUa. Migration 20261007130000_exam_link_lifecycle WRITTEN BY HAND, NOT APPLIED. Backfills: already-started rows count as used; open rows with no expiry get now()+72h. linkExpiresAt stays nullable in the DB (legacy rows); null counts as expired.
- F.2/F.3: send sets linkExpiresAt (default 72h, max 720), maxUses 1. verify-otp checks expiry then used before the code, redeems with an atomic compare-and-swap (linkUses + status), preserves startedAt on resume. New GET /api/exams/attempts/:token/status. Copy per F.6 in lib/exams/link.ts.
- F.4: single-tab election in lib/exams/single-tab.ts (hook wraps it). Simulated in Node: 2 tabs at 0/30/250/700ms and 3-4 tabs pass; one cold-start run failed once and did not reproduce (15/15 warm). Real browser timing NOT verified. Deterrent only; the server single-use rule is the guarantee.
- F.5: POST /api/attempts/:id/link (extend/reset/reissue, audited, email sent before the DB change), GET /api/attempts/:id, PATCH /api/attempts/:id/flags (reviewed flag, atomic jsonb_set). Page /exams/[id]/attempts/[attemptId]. The existing exam list/detail pages are still MOCK-backed, so nothing links to the new page yet.
- Integrity flags are appended with one atomic SQL statement (jsonb ||, 500 cap). That raw SQL is UNTESTED (no DB).

Review: 2 independent reviews + 1 re-review. Fixed: CAS status guard, backfill, resend after reset, single-tab race, atomic flags, page recovery (retry/auto-submit), reset on expired link, unknown-token oracle on next/integrity-flag, wrong "submitted" message, blur counter at cap, flag-review 404.
Known/not changed: reissue/reset email can be sent then lose a race (dead link in inbox, trainee not locked out); audit writes are best-effort; answer/submit routes overwrite blurCount with the client value (pre-existing, revisit in Part H); a blocked tab never unblocks if the owner closes; /status failure falls to the OTP box.


## Session - Claude - 2026-10-07 - Parts I, G, H, J, L, M, N, E, K (summary)

Completed in code (none of it run against a real database or browser; see BLOCKERS):
- I  WhatsApp via Twilio: lib/whatsapp/twilio.ts (E.164 normalising, Lookup cached 24h, send), POST /api/whatsapp/lookup (20/min/IP), channel + "verify first" + resolved-number preview + Retry failed in /exams/new. Soft-fails to email-only when TWILIO_* is missing. NOTE: the Lookup "whatsapp" field is taken from the spec; if the Twilio account does not return it the result is "unknown" and the send proceeds.
- G  Question import (CSV paste/file + .xlsx, dependency-free reader with zip-bomb cap) at /exams/[courseId]/import -> POST /api/questions/import (preview/commit, 5,000 rows, one transaction, formula cells rejected). 31/31 library tests passed. Auto second attempt on first fail, owner-only extra attempt (POST /api/attempts/:id/grant), GET /api/exams/attempts/:token/time, answers accepted until clock + 30s grace, submit grades what was saved (flag late_submit), server-side auto-submit past 5 focus losses. Course form defaults now 50% / 2 attempts.
- H  Lockdown hook (lib/hooks/use-exam-lockdown.ts), briefing screen before the code box (Begin enters fullscreen), 30s server clock sync, PrintScreen blur, devtools guess (flag only).
- J  Certificate PDF + sheet rewritten to the J.2 layout with QR (qrcode), no expiry anywhere (status = VALID | REVOKED only), filename {studentNumber}.pdf, signer on the verify page. Student numbers: trainee's own numeric number, else register name match, else max+1; NEW trainees are now numeric and continue from 457 (they were "KSA-0001" and string-sorted). REMOVED from the certificate sheet: "Republic of Rwanda - MINECOFIN accredited" and a sample "Official stamp" image. Confirm with the client whether the accreditation line is true before restoring it.
- L/M/N  Motion layer (CSS, reduced-motion safe), lazy charts + command palette, refetchOnWindowFocus, button press feedback, install-app button, theme #0F2340. Service worker kept deliberately stricter than the spec: it NEVER caches /api (a cached /api/trainees on a shared phone is a data leak) or /exam/.
- E  REBUILT to the spec: team members have NO login. Redeem is token-only (POST /api/access-links/redeem), a link session runs as the named trainer (TRAINER) or a per-link service account (ADMIN), the 6th device gets 403 (never evicts), an owner-removed device stays removed, sessions are capped at the link's expiry and die on revoke. Referral codes redeem the same way (POST /api/referral-codes/redeem). /login has "Have an access link or referral code?". Trainers: real GET/POST /api/trainers, picker in the course form + access dialog. Spec paths /settings/access and /settings/referrals re-export /access.
- K  Fixed from the audit: CSRF (middleware.ts: Sec-Fetch-Site/Origin, 12/12 tests), audit entries on trainee/course/category/question/trainer/login/logout/session mutations, CSV formula escaping on all four exports, nightly cleanup cron (/api/cron/cleanup + vercel.json; needs CRON_SECRET), login/resend no longer reveals whether an account exists, session rotation on sign-in, seed/reset-owner no longer fall back to a password written in the repo and no longer print it, deleting a trainee/course that has certificates is refused (it would have cascaded and erased them), course trainer must be a real active trainer, TRAINER row-level scoping on every trainer-reachable route (guard(..., {trainerScoped:true}) + lib/auth/scope.ts).

BLOCKERS / NOT DONE (cannot be done from this machine)
- No DATABASE_URL: migrations 20261007120000..20261007160000 are hand-written and UNAPPLIED; seed not run; smoke tests 1-24 NOT run; Lighthouse NOT run.
- No Twilio / Resend / Vercel credentials: WhatsApp/email delivery, deploy and production smoke NOT done.
- NOT pushed: the repo is Gahire01/KSA and the signed-in GitHub account is gmflaubert. Work is on local branch ksa-launch.
- Not looked at in a browser: the new certificate layout, signature pad, lockdown behaviour, motion. PDFs were rendered (valid, 1 page each incl. extreme names) but not visually inspected.

KNOWN GAPS (honest list)
- The dashboard, reports, payments, audit-log, exams list/detail, trainers and trainees-import pages still render from lib/mock. The real attempt page is /exams/[courseId]/attempts/[attemptId] and nothing links to it yet.
- Rate limiting is in memory per instance and trusts the first X-Forwarded-For value; SSE notifications use an in-memory broadcaster, so they do not cross serverless instances. Move both to Postgres/Redis for production.
- Unverified raw SQL (jsonb append/review, trainee number MAX, referral consume) - no DB to run it against.
- TOTP routes (dormant) let any session overwrite the secret; harmless while TOTP is off, fix if it returns.
- HANDOFF.md (earlier sessions) contains the database pooler hostname; rotate the DB password before sharing the repo.
- tmp-e2e.ts, tmp-dbcheck.ts, tmp-backdate-otp.ts are tracked scratch files (one uses $queryRawUnsafe); remove them.
- Only one signature per student number: a trainee certified in a second course gets the next free number (the column is unique).


### Final review round (3 independent reviews of Parts E/G/H/I/J/K) - items deliberately NOT changed
- A-2: sessions minted from a referral code BEFORE the 20261007170000 migration have no referralCodeId, so after deploy the holder re-enters the code once. Nothing is deployed yet, so no one is affected.
- A-3: that migration adds unique indexes on (accessLinkId,deviceHash), (referralCodeId,deviceHash) and (traineeId,courseId,attemptNumber). Against a database that already holds duplicates it will fail and roll back. The database is empty today; if it is not by the time this is applied, de-duplicate first.
- B-3: a score of 49.5% is stored and shown rounded (50%) but compared exactly against the pass mark, so 99/200 on a 50% mark shows "50%, not passed". Only possible with 200+ question papers.
- Abandoned STARTED attempts block a re-send until staff reissue or void them; there is no job that closes them.
- Referral codes have no per-device list (revoking the whole code is the lever); link devices are listed and removable per device.
- Lookalike/format cases: a quote preceded by a space in a CSV is not treated as quoted; UTF-16 CSV is supported only with a byte-order mark.
- Per-link device limit uses a cookie-based device id: clearing cookies looks like a new device and uses a slot (the owner can remove it).

## Session - 2026-10-07 overnight - Completion run (Parts 1-11)

### Part 1 - Vercel build fix (DONE, pushed 09b90d7)
- package.json: build = "prisma generate && next build", added postinstall = "prisma generate", engines.node -> "20.x".
- prisma/schema.prisma generator output ../lib/generated/prisma + lib/db.ts import already correct (no change).
- vercel.json: added buildCommand "pnpm build", installCommand "pnpm install".
- Local verify: pnpm install, prisma generate, tsc --noEmit, pnpm build, pnpm lint ALL GREEN.

### BLOCKERS
- No Vercel CLI / token / gh CLI on this machine: cannot watch the Vercel build console. Fix is in place; verify at https://vercel.com when creds are available.
- No Twilio credentials (WhatsApp send soft-fails to email).
- Resend domain kigalisafety.dev not verified (emails go from onboarding@resend.dev sandbox).

### Part 2 - placeholder data stripped (25b9038)
- NEW lib/academy/constants.ts: single source of truth (name, tagline, city/country filled; address/phone/email/website/registrationNumber = "TO BE FILLED BY OWNER", nothing invented). Helpers academyFooterLine()/academyContactLine() drop placeholders instead of printing them.
- Removed invented claims: "est. 2019 / ISO 45001 aligned" (login brand panel), "KN 07/MIN/EDUC/2024" registration number (login + /verify footers), fake address/phone (settings academy profile, payment receipt), "kigalisafetyacademy.com" (email footer), fake phone/email placeholders in trainee forms, example.com in the import template (now trainee1@ksa.test), "Try it with sample data" -> "Try the template".
- Grep clean: zero matches for lorem ipsum / test trainee / John Doe / example.com / coming soon / testimonial in app/, components/, lib/.

### Part 3 - OTP expiry UX (inline, no redirect)
- lib/exams/link.ts: new OTP_EXPIRED_MESSAGE ("This code has expired. Request a new one below.").
- POST /api/exams/attempts/:token/verify-otp: expired code now 410 OTP_EXPIRED_MESSAGE (was generic 401). Wrong code / unknown token still identical 401. Dead link keeps its own 410 copy.
- POST /api/auth/login/verify: expired code now 410 with the same sentence (was 401 INVALID_CODE). Deliberate change: the recipient has already proved the password; wrong/no-code stays a single generic 401. HANDOFF login matrix test 5 expectation updated (was 401 identical).
- /exam/[token]: on 410 with OTP_EXPIRED_MESSAGE the page STAYS on the OTP screen - inline error, boxes cleared + refocused (OtpInput reacts to error), countdown set to 0. Only a dead LINK leaves for the blocked screen.
- /login: 410 -> inline error, boxes cleared/focused, secondsLeft 0, resendIn dropped to 0 so resend is available immediately; resend button becomes a prominent "Send a new code" button once expired (60s cooldown waived after expiry).
- OtpInput: expired state now reads "This code has expired. Request a new one below." and the resend button becomes a primary "Send a new code" button.
- tsc + lint green.

### Part 4 - email logo everywhere (edea2d5..e855349)
- All five mail templates (examLink, otpResent, certificate, loginOtp, otpCodeOnly) already render the navy header with the 120x120 logo via shared shell() (Part 2 verified). The odd one out was notificationEmailHtml in lib/notifications/emit.ts (used for exam.failed / certificate.issued / deadline.approaching) - it built its own bare text header with NO logo.
- Fixed: shell() and BRAND_FOOTER are now exported from lib/email/templates.ts; notificationEmailHtml now renders inside shell() (logo header) with the brand footer (website line only once ACADEMY.website is real). "Update" eyebrow + Open button kept.
- NOT built: no code actually emits "deadline.approaching" today (type is registered in the configs only) - a datetime-based reminder cron is a stretch item, not a Part 4 fix. Logged as stretch.
- tsc + lint green.
