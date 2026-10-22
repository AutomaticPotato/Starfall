# Claude handoff

Updated 2026-10-22. Keep under ~80 lines; replace stale lines.

## Current task: local-network ID generation

Fix the builder's Add attack crash when HTTP local-network origins do not expose `crypto.randomUUID`.

- Branch/worktree: `fix/custom-attack-uuid` / `/Users/jeroen/Server/starfall-custom-attack-uuid`.
- Baseline: `4bbca02` (`aurora-server`).
- Status: done, committed and tested in `e2b1e2d`; done but untested: none; in progress: handoff only; not started: integration/release.
- Last milestone: `4bbca02` → `e2b1e2d`.
- Next concrete step: review `src/frontend/apps/builder-app/src/lib/id.ts:newId` and `src/frontend/apps/builder-app/src/pages/characters/builder/custom-attacks-editor.tsx:CustomAttacksEditor`; integrate only with owner approval.
- Changes: `newId` uses `crypto.randomUUID` when available and falls back to timestamp/random IDs otherwise. Custom attacks, battle companions, equipment and starting equipment share it.
- Tests: builder frontend suite, 258 passed / 5 skipped; focused ID tests, 2 passed; affected-file ESLint passed; package build and builder app build passed. The app build has the existing large-chunk warning. The suite's five skipped cases and real browser interaction were not exercised.
- Blockers: none. No database changes or production actions. IDs remain strings; fallback IDs use the existing project convention.
- Coordination: only custom-attack, battle-companion and equipment ID creation changed; no Codex-owned theme/navigation/sheet files touched.

## Recent completed work

- Visual fidelity changes merged in #21.
- Mk2 final completion shipped in v0.11.1 (`24fd60b`, 2026-10-20); see `docs/ai/MK2_FINAL_COMPLETION_REPORT.md`.
- Earlier Mk2 stabilization and v0.11.0: `docs/ai/MK2_VERIFICATION_REPORT.md`; earlier homebrew, encounter and custom-attack work: git history and `docs/ai/FINAL_HANDOFF.md`.

## Known limits

- Windows (Docker Desktop, WSL2, `setup.ps1`) has not been tested on real Windows.
- Builder Discard does not undo an edit made during the initial level-up processing window.
- Resistance ordering can differ from Aurora; battle violet-chip contrast and nested Characters-card controls have minor accessibility debt.
- Nine npm advisories remain in build tooling; transitive `System.Security.Cryptography.Pkcs` 9.0.4 note remains open.
- `--skip-content` plus manual import needs `/api/elements/initialize` first. Character exports made before #18 cannot move between servers; export again.

## Verification references

- Disposable install setup: `~/.cache/starlights-test/mk2/e2e-setup.sh REPO DB API_PORT WEB_PORT`; never target production.
- Community installer tests: `deploy/installer-tests/docker_smoke.py --run`.
- Lore ingestion for a disposable web: `lore-ingest/ingest.ts` with `--out` in scratch storage, never the homelab lore directory.

## Next

Maintenance mode: one mission per branch. Do not merge, push or deploy without owner approval.
