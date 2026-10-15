# Codex handoff — frontend modernization

Updated 2026-10-15. Implementation finished on `codex/frontend-modernisation` in `/home/chassapis/starlights-frontend`. Awaiting owner review and integration approval. **Do not merge, push or deploy.** Read AGENTS.md and DEVELOPMENT_DIRECTIVE.md before further work.

## Preservation and commits
Original branch base: `6a6aea2`. Resume started at `fd6bd9234310db48d0b72c32baa6fe234bf806dc`.
All 24 unfinished source/docs/test files were inspected for secrets/generated/unrelated content and preserved in `cc9ca8d6689ec6a8c9b55289f92f97e002ee32f2` before further editing. Main/Claude working trees were not modified, reset or stashed.
- `fb54b51`: project knowledge and five local skills.
- `f09f4b2`: semantic themes and responsive navigation.
- `fd6bd92`: shared spell browser, selection and reprint consolidation.
- `cc9ca8d`: preservation of interactive sheet, battle styling and tests.
- `44bf88f`: separate official branding commit.
- `5df27f7`: interaction fixes and isolated workflow validation.
- Final documentation commit: find with `git log -1` (this file is in that commit).

## Delivered
Paths below are relative to `src/frontend/apps/builder-app/src`.
- `styles/themes.css`, `lib/themes.ts`, `components/{theme-provider,mode-toggle}.tsx`: Porcelain/Slate/Midnight, persisted legacy-compatible settings, preview/cancel/save, focus return and reduced motion. Shared UI button/dialog/toast tokens; localhost-only Vite.
- `components/spells/spell-browser.tsx`: search, level/school/source filters, eight-card pagination, inline descriptions, casting/component/concentration/ritual details and explicit actions.
- `lib/rules/spell-options.ts`, `pages/characters/builder/spell-choice.tsx`: one card per normalized spell name, exact selected IDs preserved, alternate 2014/2024 printings in details, same-feature duplicate learning prevented. Server eligibility and progression unchanged.
- `pages/characters/builder/{builder-page,magic-tab,wizard}.tsx`: readable level/choice counts, wrapped navigation, known/prepared distinctions, selection feedback, shared per-class preparation and slot display.
- `/characters/:id/play`, `pages/characters/sheet/interactive-sheet.tsx`: identity, abilities/saves/skills, attacks, inventory, features, HP/temp HP, conditions, resources and rests. Shares existing combat/magic/inventory endpoints and battle components. Section navigation opens collapsed panels; expansion survives dependent query refresh. Failure feedback and rollback tested. Resources are spent through existing battle controls; no duplicate mechanics.
- `pages/battle/{battle-page,battle-index,prepare-spells,items,companions}.tsx`: semantic surfaces, readable typography, responsive actions and shared spell presentation. Exported Vitals/Status/RestDialog are reused by the sheet. Rest and slot notices no longer claim success before writes finish.
- `/characters/:id/sheet` remains Aurora PDF. Only a reciprocal link changed; generation and PDF.js interface/dependencies unchanged.
- `pages/landing/Index.tsx`, `pages/layouts/default-layout.tsx`, `../public/branding`, `../index.html`: supplied logo, real compass crop, favicon 16/32/48 + ICO, 180px touch icon. Fixed dimensions and intentional navy framing. Missing tile artwork has a readable fallback.

Original logo preserved at `/home/chassapis/homelab/config/copyparty/data/Project Starlights Celestial Emblem.png`; SHA256 and deterministic reproduction in `public/branding/README.md` and `tools/frontend/branding.mjs`.

## Validation evidence
Artifacts are ignored, outside the live web directory: `/home/chassapis/starlights-frontend/.artifacts/`.
- Supported Node 24: workspace packages and TypeScript/Vite production build PASS. Existing large-chunk warning remains (~2.19 MB main chunk).
- Frontend Vitest: **188 passed; 5 optional real-data tests skipped**, 21 passing files. `unit-final.log`.
- Attempt with `LORE_SRC=/home/chassapis/5etools`: suite initialization fails because this content-only checkout lacks `js/parser.js`; the other 188 tests pass. `unit-content.log`. Requires a complete 5etools-src checkout; no importer changes made.
- .NET 10 character tests: **299 passed, zero failed/skipped**. Existing duplicate MSTest package-reference warnings. No auth-test repair work attempted.
- Full ESLint: **38 errors, 1 warning**; comparison of each affected file against base `6a6aea2` finds the same 38 errors. `lint.log`, `lint-baseline.json`. Targeted final modified functional files pass (`lint-targeted.log`). Existing Button mixed-export lint error also remains unchanged.
- `tools/frontend/smoke.mjs`: **90** checks across homepage, creation, spell selection, sheet, battle × Porcelain/Slate/Midnight × 320/360/390/768/1024/1440. No horizontal overflow or app/unmocked-API errors. Checks learning, duplicate reprints, builder Save, HP writes, theme cancellation and save/reload. `screenshots/results.json`, `browser.log`.
- Screenshots visually inspected: mobile creation/magic/sheet, desktop sheet/battle/home, all three palettes, emblem and favicon. Final sheet spacing additionally checked at 390/1440 in all themes. These are representative manual checks, not a comprehensive WCAG audit. Palette checks previously measured minimum 5.69:1 for tested text/status pairs; dark destructive button now uses the full semantic color.
- `tools/frontend/workflows.mjs`: **real isolated SQL/API**, browser creation of Fighter 2014 and Wizards 2014/2024; API class selection, scores, Wizard level 3 and Cleric multiclass; browser spell learning/Save, HP/temp HP, reload, short/long rests. `workflows/results.json`.
- `tools/frontend/complete-characters.mjs`: selected other eligible required options through real rules APIs: 13 Fighter, 36 Wizard 2024, 33 Wizard 2014. **Alignment has no options in the fresh import**, so these builds retain that outstanding choice. `workflows/completion.json`.
- `tools/frontend/play-checks.mjs`: real battle Dash/used-state/reload/next turn; Second Wind spend/short-rest recovery; Wizard cantrip casting, preparation/removal, shared slot persistence and long-rest restoration; actual PDF generation/download and rendered pages for all three characters. `workflows/play-results.json`, PDFs and screenshots.
- `tools/frontend/accessibility.mjs`: keyboard sheet navigation, theme preview/Escape/focus return, injected HP-save failure/rollback and successful retry. `accessibility.log`.
- Five skill frontmatters validated; `git diff --check` passes.

## Test isolation and reproduction
Host Node 18 is insufficient. `.tooling/bin/node` is Node 24 copied from the existing `node:24-slim` Docker image. No system packages installed. Playwright module: `/home/chassapis/.cache/starlights-test/pw/node_modules/playwright/index.mjs`; installed headless Chromium works. Prefix npm commands with `PATH=/home/chassapis/starlights-frontend/.tooling/bin:$PATH`.

For fixture-only checks, start `VITE_API_BASE='' npm run dev -- --host 127.0.0.1 --port 55052 --strictPort` in builder-app, then from repository root run `PLAYWRIGHT_MODULE=/home/chassapis/.cache/starlights-test/pw/node_modules/playwright/index.mjs SCREENSHOT_DIR=/home/chassapis/starlights-frontend/.artifacts/screenshots .tooling/bin/node tools/frontend/smoke.mjs`. Run accessibility.mjs the same way. API interception matches pathname `/api/` only; matching `**/api/**` also intercepts Vite source imports and breaks loading.

Real tests used only newly created `starlights-codex-api` and `starlights-codex-db` containers, an internal dedicated DB network, a dedicated localhost publishing network, and **127.0.0.1:55053**. SQL used disposable tmpfs; only synthetic player `Codex Synthetic`. Existing Aurora content was mounted read-only; no production database was read/copied. Published API/migrations live in ignored `.tooling`; migrations ran only against this disposable database. Test containers/networks and Vite are stopped/removed on completion; real tests require recreating this isolated environment, importing core 2014/2024 indices, then workflows → complete-characters → play-checks. Never use homelab test-copy scripts: they copy real production data. No preview server is left running.

## Limits and integration
No backend changes required by the implemented UI. No live players were opened. Auth/campaign/homebrew/encounter/backup code was not changed. Tests cover representative classes and existing calculations, not every supported class/content combination. Missing imported alignment options and incomplete optional lore fixtures remain content/test-environment issues; no fabricated choices or bypasses were added. Existing lint debt and bundle warning remain.

Claude branches were inspected read-only, never merged/cherry-picked:
- `feature/homebrew-home-tile`: overlap in `src/frontend/apps/builder-app/src/pages/landing/Index.tsx`. Preserve Claude's Homebrew tile/section/import and this branch's logo header/readable tile fallback. Do not replace the whole file.
- `security/pdfjs-6.2.108`: owns builder package.json, frontend package-lock.json and lib/pdf-view.ts. This branch leaves those unchanged; preserve security changes during integration and rerun PDF checks.
- `ci/aurora-server-vitest` and Mission 006B `fix/backend-auth-tests`: leave their tests/CI ownership intact.
- `docs/ai/DEVELOPMENT_DIRECTIVE.md` copied verbatim from the user's main worktree so this isolated branch is self-contained.

After explicit approval, create an integration worktree from the then-current local `aurora-server`, merge this branch there with `--no-commit --no-ff`, resolve only reviewed overlaps, and rerun package/app builds, unit/browser/PDF checks against synthetic data. Coordinate Claude's pending branches independently; do not overwrite/cherry-pick them. Review the full integration diff and commit only after acceptance. Push/deploy require separate explicit approval. Do not integrate inside the production working tree.

Approved-integration commands (documented only; **not executed**):
```bash
git -C ~/starlights status --short
git -C ~/starlights worktree add -b integration/frontend-review ~/starlights-integration aurora-server
git -C ~/starlights-integration merge --no-commit --no-ff codex/frontend-modernisation
```
Inspect and resolve conflicts without resetting either branch; retain Claude's Homebrew tile and PDF.js security changes. Run the documented validation in the integration worktree, review `git diff --cached`, then make a local integration commit if the approved scope permits it. No push or deployment is included.
