# Claude handoff

Updated 2026-10-20 (session 0a6fe6db). Keep under ~80 lines; replace stale lines.

## Task (done, waiting on the owner): Mk2 final completion
Owner's brief "Final completion, verification & release readiness"; report:
[MK2_FINAL_COMPLETION_REPORT.md](MK2_FINAL_COMPLETION_REPORT.md) (verdict PARTIALLY: fixes not merged yet; Windows
unverified). Live is v0.11.0 = `c69600b`. Open pull requests, all based on `b409275`, green, none merged:
#13 companion ERR log (owner-approved: `~/.cache/starlights-test/mk2/companion/go.sh` merges and deploys it; run it
FIRST, its deploy compares characters strictly), #14 2014 Wizard multiclass slots, #15 a11y labels, #16 npm audit
fix, #17 maintenance scripts' relative backup folder, #18 portability between independent servers, and the docs PR.
All merge together without conflicts (merged-set suite in the report). After merging: one API + web deploy, no
migration, no reprocess. Evidence: `~/.cache/starlights-test/mk2final/` (LEDGER.md).

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
- Character files exported before #18 can't move between servers; export again after #18 is live.

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
(`go.sh` for #13, then the rest).
