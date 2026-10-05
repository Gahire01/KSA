## Session — 2026-10-05 17:03:07 +02:00 — Resume after PC crash

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
