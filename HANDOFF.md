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


