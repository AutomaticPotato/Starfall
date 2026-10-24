# Claude handoff

Updated 2026-10-22. Keep under ~80 lines; replace stale lines.

## Current task: Bestiary stat-block-only printing

Add an opt-in Bestiary print mode that keeps the creature heading/type/source and stat block, hiding lore and supplementary notes.

- Branch/worktree: `aurora-server` / `/Users/jeroen/Server/starlights`; feature branch `feat/bestiary-stat-block-print` is locally fast-forwarded to the same tip.
- Baseline: `bcc9094`.
- Status: implementation committed and tested in `2d23b75`; handoff update in progress; no untested code or remaining implementation.
- Last milestone: `bcc9094` → `2d23b75` (local fast-forward merge into `aurora-server`).
- Next concrete step: owner reviews and pushes the local commits; no push or PR created.
- Changes: `src/frontend/apps/builder-app/src/pages/lore/category-page.tsx:EntryPane` adds the Bestiary-only toggle; `src/frontend/apps/builder-app/src/components/lore/entry-view.tsx:EntryView` hides lore, environment and version notes only in print mode.
- Tests: frontend suite 260 passed / 5 skipped; workspace packages and builder app builds passed; ESLint on the three changed TSX files and `git diff --check` passed. No browser print-preview test.
- Blockers: none. No database, production data or compatibility changes.
- Coordination: limited to Bestiary printing; no Codex-owned theme/navigation/sheet files changed.

## Recent completed work

- Local-network ID fallback completed in `e2b1e2d`.
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
