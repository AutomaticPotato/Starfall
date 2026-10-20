# Project status

## Current release — 2026-10-20

**v0.11.0** (Starfall Mk2) is live on the homelab (`c69600b`; tag `v0.11.0` = `b409275` on `aurora-server`). Mk2
fixed append-import safety, missing skills on SQL Server, empty Aurora attack ids and the import order, and added the
Starfall homepage art, theme ornaments and working CI with branch protection
([verification](MK2_VERIFICATION_REPORT.md)).

The final completion pass the same day ([report](MK2_FINAL_COMPLETION_REPORT.md)) checked every area on disposable
installs and opened six fixes (#13–#18) plus a docs PR; they are green and waiting to be merged. Verdict: partially
verified until they are merged and deployed; Windows is untested.

## Existing systems
Character creation/guided builder, registration progression, multiclassing, 2014/2024 sources, equipment, custom
attacks, spellcasting/preparation, Aurora imports and "Update from Aurora", homebrew (XML uploads, append patches,
workshop), PDF sheets, interactive play sheet, battle simulator, campaigns (DM/player, sessions, notes, encounters
with difficulty, fights), Compendium and Compendium of Lore, character export/import, three themes, community
installer with backup/verify/restore/update/rollback, Docker packaging.

## Evidence and limitations
See the two reports above. Known limits: Windows unverified; minor a11y debt (Slate chip contrast, nested card
controls); 9 npm advisories in build tooling need majors; existing lint debt 38 errors + 1 warning.

## Parallel work
None open. Codex's branches are merged; its handoffs (`CODEX_HANDOFF.md`, `CODEX_014A_HANDOFF.md`) are history.
Inspect `git worktree list` and open pull requests before starting anything.

## Next priority
Owner: run `go.sh` (#13), then merge #14–#18 and the docs PR, then one API + web deploy. After that, maintenance
mode: one small mission per branch.
