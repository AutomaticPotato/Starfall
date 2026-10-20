# Claude handoff

Updated 2026-10-20 (sessions 0a6fe6db, 540ea579). Keep under ~80 lines; replace stale lines.

## Task (done, merged and live): Mk2 final completion
Owner's brief "Final completion, verification & release readiness"; report:
[MK2_FINAL_COMPLETION_REPORT.md](MK2_FINAL_COMPLETION_REPORT.md) (verdict: done for Linux; Windows unverified).
Merged 2026-10-20 by the owner: #13 companion ERR log, #14 2014 Wizard multiclass slots, #15 a11y labels, #16 npm
audit fix, #17 maintenance scripts' relative backup folder, #18 portability between independent servers, #19 docs.
Live is `24fd60b` since 12:59 (verified backup, rollback images `rollback-0dea987`, every character identical, 0 API
errors; report §8). Not released yet: v0.11.1 needs the owner's go-ahead. Evidence:
`~/.cache/starlights-test/mk2final/` (LEDGER.md, finish2.log).

## Earlier work
Mk2 stabilization, v0.11.0 (2026-10-20, [MK2_VERIFICATION_REPORT.md](MK2_VERIFICATION_REPORT.md)); homebrew workshop
+ encounter difficulty, API compatibility / custom attacks, v0.10.0: details in git history and
[FINAL_HANDOFF.md](FINAL_HANDOFF.md).

## Not done / known limits
- Windows (Docker Desktop, WSL2, `setup.ps1`) never run on real Windows.
- Builder: an edit made in the first seconds after levelling, while the save snapshot waits for processing, is not
  undone by Discard (kept, not lost).
- Resistance order can differ from Aurora's; Slate's destructive chip contrast 4.42:1; Characters cards nest
  their export/delete buttons in the card's control (axe `nested-interactive`).
- 9 npm advisories left after #16, all in build tooling, each needing a shadcn CLI or `@tailwindcss/typography`
  major. NuGet: transitive System.Security.Cryptography.Pkcs 9.0.4 note still open.
- `--skip-content` install + manual `./admin.sh import` needs `/api/elements/initialize` first (the Content page /
  content update does it). Custom-monster CR calculator, homebrew Mystic Arcanum/third-casters: not built.
- Character files exported before #18 can't move between servers; export again (#18 is live since 2026-10-20).

## Coordination (shared files touched)
- #15: `pages/battle/battle-page.tsx` (`UsePips`: `role="img"`), `pages/compendium/Index.tsx` (two `aria-label`s).
- Docs PR: `tools/frontend/custom-attacks.mjs` (builder route `/characters/:id`), `workflows.mjs` (waits for the
  builder session before editing), `accessibility.mjs` (`FRONTEND_URL` override). Codex's other tools unchanged.
- Earlier (Mk2): `pages/landing/Index.tsx` hero, `styles/ornament.css`, `components/ornaments.tsx`, `App.tsx`,
  `lib/api/sheet.ts`, `lib/rules/proficiencies.ts`, `lib/rules/items.ts`, `lib/aurora-character-import.ts`.

## How to verify things here (reusable)
- Disposable install of a worktree: `~/.cache/starlights-test/mk2/e2e-setup.sh REPO DB API_PORT WEB_PORT`
  (SQL container `starfall-mk2-sql`); real characters via `~/.cache/starlights-test/pw/mk2-e2e.mjs` (its
  "errors 0" counts page errors only: read `import-report.txt` for per-file failures).
- Community kit: `deploy/installer-tests/docker_smoke.py --run` (isolated project, random 127.0.0.1 port).
  For `update.sh`, clone from GitHub and bind 127.0.0.1 with a local test commit (default port 8093 = live).
- Lore data for a disposable web: run `lore-ingest/ingest.ts` with `--out` in a scratch folder, never
  `~/homelab/config/starlights-lore`.

## Next
Maintenance mode: bug fixes, one mission per branch, merged through pull requests once CI passes.

## Blockers
None in the code. The session's auto-mode classifier refuses merges and production deploys; the owner runs them
(prepared scripts with guards, as `go.sh` / `finish2.sh` were).
