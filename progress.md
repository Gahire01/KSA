# Progress

## Legend

✅ Done   🟡 In progress   ⬜ Not started   ⚠️ Blocked (needs credential)

## Phases

- Phase 0 — Cleanup: ✅ Done
- Phase 1 — DB + Auth + Trainees + Courses: ⬜
- Phase 2 — Exams + OTP + Certificates + Email: ⬜
- Phase 3 — Payments + Reports + Notifications: ⬜
- Phase 4 — SEO + PWA + Launch: ⬜

## Decisions Log

- **2026-10-04 — Certificate asset folder renamed to `public/certificate`.**
  The tracked path was `public/certificate /` (trailing space). Windows silently
  strips trailing spaces from directory names, so the on-disk folder already read
  as `certificate` while git still indexed the spaced name — the mismatch is what
  breaks git on Windows. Fixed by reconciling the git index to the real name.
- **2026-10-04 — Deleted 2 byte-identical duplicate PDFs.**
  Verified with `git rev-parse` (identical blob SHAs) before deleting, so no
  unique asset was lost:
  - Kept `Kwisanga Elie - FIRST AID Certificate.pdf` — deleted the ` (1)` copy.
  - Kept `Ntakiyinanira Safu- CONSTRUCT SAFETY MANAGEMENT HSE Certificate.pdf` — deleted the ` (1)` copy.
  5 unique certificates remain. No other `copy` / `final` / `v2` duplicates were present.
- **2026-10-04 — Renamed filenames left untouched.** Two kept PDFs have cosmetic
  warts (`... Certificate1.pdf`, `... Operations..pdf`). Left as-is to avoid
  breaking references; no code references these paths today.

## Blockers (needs input from owner)

- No database available yet: no Postgres and no Docker on this machine. Phase 1
  needs a decision on managed Postgres vs. local install.
- No credentials supplied for email/WhatsApp delivery (Phase 2). Until provided,
  those integration points stay ⚠️ Blocked.
## Session — Resume (2026-10-05)
- [x] Repo state captured (ahead 1, uncommitted changes present)
- [x] Schema, migrations, seed inspected
- [x] API/auth/core files verified
- [x] Build succeeds
- [x] Migrations in sync
- [x] Seed executed (1 owner, 6 categories, 8 courses)


### Step 5 (Seed)
- [x] prisma/seed.ts is idempotent (upserts on unique keys), seeds 1 OWNER (gahiredev01@gmail.com), 6 categories, 8 courses with passMarkPct=50, maxAttempts=2. No trainees seeded. Uses lib/auth/password.ts. No secrets logged.


### Step 6 (Frontend wiring)
- [x] login/login-mfa pages use API (useLogin, useMfaVerify)
- [x] trainees pages import from @/lib/api/hooks (useTrainees)
- [x] courses pages import from @/lib/api/hooks (useCourses/useCategories)
- [x] Other /(app) pages have DemoBanner at top (verified)
- [x] No visual design changes


### Step 7 (Security partial check)
- [x] argon2id used; no bcrypt found
- [x] Cookie flags: httpOnly, secure in prod, SameSite=Lax, __Host- in prod (cookie logic)
- [x] Session TTL 7d; expired rejected; logout deletes session
- [x] TOTP recovery codes argon2id hashed, single-use; verify prevents replay via totpCounter
- [x] MFA/rate limiting code present (rate-limit.ts, guard, verify route)
- [x] Zod strict on inputs, pageSize cap 100 (schemas)
- [x] Routes guarded via authorize/guard; health unauthenticated
- [x] No raw SQL concat/unsafe query usage observed
- [x] Security headers + CSP configured; X-Frame-Options DENY
- [x] No isCorrect found in API responses
- [x] No secrets logged (seed, health, etc.)
- [ ] pnpm audit --prod (to run)

- [x] pnpm audit --prod clean of HIGH/CRITICAL


### Step 8 (Verify - static)
- [x] pnpm build succeeds
- [x] pnpm lint (eslint) passes (0 errors)
- [x] npx tsc --noEmit passes (0 errors)


E2E: will run tmp-e2e.ts against dev server once started (per instructions).

## Session - 2026-10-06 - Email-OTP login locked in

- [x] Email-OTP login flow (`/login` email+password → 6-digit emailed code → `/dashboard`;
      `LoginOtp` schema + `/login`, `/login/verify`, `/login/resend`, `loginOtpEmail()` template)
- [x] Rate limits (IP + user): login 20/15min per IP and 5/15min per account, verify 30/15min
      per IP and 10/15min per email, resend 3/15min per email — all at the API layer with
      `Retry-After`
- [x] Resend with cooldown (60s from `lastSentAt`, silent `{ok:true}`, rollback on send failure)
- [x] All 25 edge cases tested and passing (18 browser + 7 API — see
      "Login — Edge Case Matrix" in HANDOFF.md; 25/25 ✅)
- [x] Old TOTP paths unlinked (`/login/mfa` and `/login/mfa/setup` redirect to `/login`,
      `guard()`'s `requireMfa` gone, layout no longer branches on `mfaPassed`, invite
      redemption lands on `/dashboard`; TOTP columns/endpoints kept for later)
- [x] `scripts/reset-owner.ts` created and run (clears lockout, sessions, devices, OTP rows;
      optional password rewrite); `prisma/seed.ts` idempotent, no TOTP requirement
- [x] `pnpm lint` clean, `pnpm exec tsc --noEmit` clean




## Launch run - 2026-10-07 (local branch ksa-launch, NOT pushed)

Legend here: DONE = built, type-checked, linted, and (where noted) unit-tested or independently reviewed. NOT RUN = needs a database / credentials / a browser that this machine did not have.

| Part | Status | Evidence / caveat |
|---|---|---|
| C  Step 0 (tsc, lint, build) | DONE | integrity-flag route was syntactically broken on arrival; fixed |
| D  Owner signature | DONE | 2 independent reviews; PNG validator 5/5 tests; draw/lock UI not exercised in a browser |
| E  Access links + referral codes + devices | DONE (rebuilt) | Original was invite-with-password; rebuilt to token-only, 5-device hard limit, link-bound sessions. 1 independent review, findings fixed. Device logic not run against a DB |
| F  Exam link lifecycle | DONE | 3 reviews; single-tab simulated in Node (warm 15/15) |
| G  Exam engine + import | DONE | import lib 38/38 tests; 1 review, findings fixed |
| H  Exam security | DONE | server enforces focus-loss limit; hook not exercised in a browser |
| I  WhatsApp (Twilio) | DONE, UNTESTED LIVE | no credentials; soft-fails to email |
| J  Certificate | DONE | 4 PDFs rendered, all 1 page incl. extreme names; NOT visually inspected |
| K  Security checklist | DONE with exceptions | see HANDOFF known gaps; CSRF middleware 12/12 tests |
| L  Speed | PARTIAL | indexes, caching, lazy load, query defaults done. Lighthouse NOT RUN |
| M  Animations | DONE | CSS only, reduced-motion safe; not seen in a browser |
| N  PWA + notifications | DONE | SW intentionally stricter than spec (never caches /api); SSE in-memory only |
| O  Smoke test 1-24 | NOT RUN | needs DATABASE_URL, email, a browser, a phone |
| P  Deploy | NOT DONE | no Vercel access; nothing pushed |
| Q  Docs | DONE | this file + HANDOFF.md |

Production URL: none recorded here (see HANDOFF.md).
Lighthouse: not measured (no browser run was possible in the build environment).

Known limitations: see "KNOWN GAPS" in HANDOFF.md. The mock-backed pages and `lib/mock` are gone (Oct 2026 build).

---

## Security checklist (Part 14) — verified 2026-10-09

✅ = verified in code (file:line); ⚠️ = a limit worth knowing, with the reason.

- ✅ argon2id passwords + OTPs: `lib/auth/password.ts:29,95` (hash-wasm argon2id, 19 MiB / 2 passes); exam OTP hashed at `lib/exams/issue-attempt.ts:87`; sign-in code hashed in `app/api/auth/login/verify/route.ts`.
  Tokens are 32 random bytes, so they are stored as a SHA-256 / HMAC digest (`lib/exams/token.ts:7`, session id in `lib/auth/session.ts`), which is the right tool for a high-entropy secret (argon2id is for guessable ones).
- ✅ Session cookie `httpOnly`, `secure` in production, `SameSite=Lax`: `lib/auth/cookies.ts:26-28`.
- ✅ Session TTL 30 days with "Remember me": `lib/auth/cookies.ts:4` (12 hours without it).
- ✅ Rate limits: sign-in `lib/api/rate-limit.ts:22`, sign-in code verify `:34`, resend `:38`, exam OTP `:48`, answer autosave `:60`, integrity flag `app/api/exams/attempts/[token]/integrity-flag/route.ts:11`.
  ⚠️ The limiter is in memory, so on a serverless host each instance counts for itself. The controls that actually stop guessing are in the database and do not depend on it: five tries per sign-in code, five per exam code (`otpAttempts`), and the account lockout (`app/api/auth/login/route.ts:89`).
- ✅ Every API route checks the session via `guard()` (`lib/api/guard.ts:37`) except the ones that are public or authenticated another way, each on purpose: health, login/resend/verify/logout/me, the link and code redemptions, the public certificate verify, the signature image (locked signatures only), the cron route (bearer secret), and the exam-attempt routes (emailed token + the cookie set after the OTP).
- ✅ No `isCorrect` in any trainee-reachable response: the paper is projected without it (`app/api/exams/attempts/[token]/next/route.ts:54`), the manifest holds ids only, and the 30-check HTTP test confirmed `/next`, `/verify-otp` and `/submit` bodies contain none. Staff-only authoring endpoints return it by design.
- ✅ No stack traces in error responses: `apiFail` (`lib/api/response.ts:27`) sends a message and a request id only; causes go to the server log.
- ✅ Security headers: HSTS `next.config.ts:29`, nosniff `:30`, Referrer-Policy `:31`, X-Frame-Options DENY `:32`, Permissions-Policy `:34`, CSP `:38`.
- ✅ No wildcard CORS: no `Access-Control-*` header exists anywhere; `middleware.ts:16` rejects cross-origin state changes.
- ✅ No secrets in source: grep for `re_…`, `postgresql://user:pass@` and `sk_…` over app, components, lib, prisma, scripts and root files returns nothing.
- ✅ `.env.local` is ignored: `.gitignore:34` (`.env*`).
- ✅ Exam tokens single-use: `linkMaxUses = 1`, redeemed atomically in `app/api/exams/attempts/[token]/verify-otp/route.ts:119`.
- ✅ OTP expiry is server-side: `verify-otp/route.ts:91`.
- ✅ Autosave never returns the answer key: the answer route returns `{ saved, questionId, hasAnswer }` only.
- ✅ Audit log is append-only: nothing in `app` or `lib` updates or deletes `AuditLog`; `/api/audit-log` is GET only (a test confirmed 405 for DELETE and POST).

Not part of the checklist but worth saying plainly: the in-app protections on the exam page deter and record; they cannot stop a phone camera or an OS screenshot (see "Content protection" in HANDOFF.md).
