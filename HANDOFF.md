# Handoff

## How to use this file

Every session appends. Never delete prior entries.

## Project status

Frontend prototype complete. Backend not started.

## Environment

Node v26.2.0, pnpm 11.5.1, Windows, no Docker, no Postgres installed.

Verified this session: `node -v` → v26.2.0, `pnpm -v` → 11.5.1, git 2.49.0.windows.1.
`package.json` pins `packageManager: pnpm@11.5.1` and `engines.node: ">=20"`.

## Session log

### 2026-10-04 — Cleanup session (Phase 0)

Goal: three housekeeping tasks only, no feature work.

- **Certificate asset folder.** Tracked path was `public/certificate /` with a
  trailing space. Key finding: Windows strips trailing spaces from directory
  names, so the folder on disk was already `certificate` (confirmed LEN=11 by
  enumerating via the `\\?\` extended-length path) — only the git index still
  held the spaced name. `git status` therefore reported the PDFs as deleted even
  though the files were present. Reconciled the index to the real name; git now
  tracks all 5 PDFs as renames and the false "deleted" entries are gone.
- **Dedupe.** 2 of the 7 tracked PDFs were `(1)` copies. Confirmed both were
  byte-identical to the canonical file by comparing `git rev-parse` blob SHAs,
  then deleted them. 5 unique certificates remain.
- **No stale references.** `git grep "certificate /"` returns no matches, so
  nothing in the app pointed at the old spaced path. `scripts/gen-assets.mjs`
  writes only to the `public/` root, so it is unaffected by the folder rename.
- **Tracking files.** Created `progress.md` and `HANDOFF.md`.
- Committed. **Not pushed** — owner to push.

## Blockers

- No database: no Postgres, no Docker. Phase 1 needs an owner decision (managed
  Postgres vs. local install) before schema work can start.
- No email / WhatsApp credentials. Phase 2 delivery integrations stay blocked.

## Next session should start at

Phase 1 — DB + Auth + Trainees + Courses. Do not begin until the owner says go,
and confirm the database decision first.