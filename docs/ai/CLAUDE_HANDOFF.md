# Claude handoff

Updated 2026-10-21 (session 5d4ac16e). Keep under ~80 lines; replace stale lines.

## Task (done on its branch, not deployed): visual-fidelity correction
Owner's pack `Starfall_Claude_Visual_Fidelity_Pack.zip` (Copyparty data folder). Branch `feature/visual-fidelity`
(worktree `~/starfall-visual-fidelity`) from `aurora-server` `79610c3`; report with asset choices, checks and the
remaining differences: [VISUAL_FIDELITY_REPORT.md](VISUAL_FIDELITY_REPORT.md). One page frame (`StarfallShell`) with
the supplied corners/edges on its line, homepage rebuilt to the mockup (brand block, not the portrait), Slate now a
dark theme, theme applied before first paint. Evidence and disposable install: `~/.cache/starlights-test/vf/`
(README.md, shots/, checks/). Superseded: `feature/celestial-polish` (unpushed `f4d4e85`, same files) — don't merge both.

## Previous task (done, merged and live): Mk2 final completion
[MK2_FINAL_COMPLETION_REPORT.md](MK2_FINAL_COMPLETION_REPORT.md); live `24fd60b` (2026-10-20 12:59), released v0.11.1.

## Earlier work
Mk2 stabilization, v0.11.0 (2026-10-20, [MK2_VERIFICATION_REPORT.md](MK2_VERIFICATION_REPORT.md)); homebrew workshop
+ encounter difficulty, API compatibility / custom attacks, v0.10.0: details in git history and
[FINAL_HANDOFF.md](FINAL_HANDOFF.md).

## Not done / known limits
- Windows (Docker Desktop, WSL2, `setup.ps1`) never run on real Windows.
- Builder: an edit made in the first seconds after levelling, while the save snapshot waits for processing, is not
  undone by Discard (kept, not lost).
- Resistance order can differ from Aurora's; battle page violet chip contrast 3.3–3.9:1; Characters cards nest
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
- Visual fidelity: `styles/themes.css` (all three palettes; Slate dark), `lib/themes.ts` (`isDarkTheme`),
  `theme-provider.tsx`, `ui/sonner.tsx`, `index.html` (pre-paint theme), `default-layout.tsx` (header text/padding),
  `App.tsx`, `ornaments.tsx`, `ornament.css`, landing, `lore-home.tsx` banner, `campaigns-page.tsx` cards,
  `tools/frontend/ornaments.mjs` + `homepage-branding.mjs` (new contracts).
- Earlier (Mk2): `pages/landing/Index.tsx` hero, `styles/ornament.css`, `components/ornaments.tsx`, `App.tsx`,
  `lib/api/sheet.ts`, `lib/rules/proficiencies.ts`, `lib/rules/items.ts`, `lib/aurora-character-import.ts`.

## How to verify things here (reusable)
- Disposable install of a worktree: `~/.cache/starlights-test/mk2/e2e-setup.sh REPO DB API_PORT WEB_PORT`
  (SQL container `starfall-mk2-sql` on network `starfall-mk2-test`, removed 2026-10-20; recreate both first:
  `docker network create starfall-mk2-test`, then `docker run -d --name starfall-mk2-sql --network starfall-mk2-test
  -e ACCEPT_EULA=Y -e MSSQL_PID=developer -e MSSQL_SA_PASSWORD="$(cat ~/.cache/starlights-test/mk2/sqlpw)"
  mcr.microsoft.com/mssql/server:2022-latest`); real characters via `~/.cache/starlights-test/pw/mk2-e2e.mjs` (its
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
