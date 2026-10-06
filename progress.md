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


