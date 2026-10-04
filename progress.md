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