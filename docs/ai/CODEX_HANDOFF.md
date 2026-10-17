> Latest follow-up (2026-10-16): [append-only homebrew uploads](HOMEBREW_APPEND_HANDOFF.md), on `fix/homebrew-append-upload`. Backend verification and delivery remain subject to the documented environment blockers.

> Current work (2026-10-16): [Starfall rebrand and Custom Attacks](STARFALL_HANDOFF.md). Implementation is committed separately; backend/browser verification and GitHub operations remain blocked. The historical frontend QA handoff below is retained.

# Codex handoff — frontend QA complete

Updated 2026-10-15. Integrate **`codex/frontend-qa`**, not just `codex/frontend-modernisation`. Owner approval is still required before integration; no merge, push or deployment was performed. Follow `AGENTS.md` and `DEVELOPMENT_DIRECTIVE.md`.

## Commits and preservation

- Original modernization base: `6a6aea2`; earlier resume point: `fd6bd9234310db48d0b72c32baa6fe234bf806dc`.
- Modernization finished at `a9a305f`; QA starts from that commit and ends its implementation at **`5d991a8e898e394f536b1329772cbe6075dca0b4`**.
- This finalization started at `5d991a8` with a clean tree. All QA source/tests were already committed. Only this handoff changed during finalization.
- The ending handoff commit is the commit containing this revision, titled `docs: finalize frontend QA and integration handoff`; obtain its exact ID with `git log -1 --format=%H -- docs/ai/CODEX_HANDOFF.md`. The final owner report supplies the branch-tip hash.
- QA retains the complete ancestry: knowledge `fb54b51`, themes `f09f4b2`, spell browser `fd6bd92`, preservation `cc9ca8d`, official branding **`44bf88f`**, interaction fixes `5df27f7`, modernization handoff **`a9a305f`**, spell correction **`5d991a8`**. No resets, discarded work, amended commits or changes to Claude's worktrees.

## Delivered and corrected

- Porcelain/Slate/Midnight themes, persisted legacy settings, keyboard-accessible preview/cancel/save, responsive navigation and semantic shared controls.
- Official celestial landing logo, navigation compass, favicon/touch assets; responsive tile fallback. Source attribution/hash and crop reproduction remain in `public/branding/README.md` and `tools/frontend/branding.mjs`.
- Filtered, paginated spell cards, inline details and explicit Learn/Remove actions; clearer builder progression, known/prepared spells and shared slot presentation.
- Interactive `/characters/:id/play` sheet reuses existing combat, inventory and magic APIs; section expansion survives query refresh; save failure rollback and pending-write feedback. Original Aurora PDF route remains intact with a reciprocal link.
- **QA correction:** names and casting summaries cannot establish spell identity. Only verified identical official same-edition printings consolidate, using full descriptions, setters, lists and stats from the existing read-only compendium batch endpoint. Only page metadata/tag ordering are ignored. 2014/2024 versions, changed effects, homebrew, custom IDs and uncertain provenance remain separate. Failed identity lookup leaves entries separate.
- Exact saved spell IDs remain unchanged; no references or choices are manufactured, migrated or deleted. Same-feature duplicate prevention compares verified identity, including saved printings absent from the current options. Other classes/features retain their existing choices. Fourteen regressions cover these rules.
- Missing alignment choices were traced to the isolated test-content import, not the UI. No fabricated options, backend fix or database change was introduced.

## Final validation

Local evidence is ignored and retained at **`/home/chassapis/starlights-frontend/.artifacts/`**. Commands run from `src/frontend` with `PATH=/home/chassapis/starlights-frontend/.tooling/bin:$PATH` (Node **24.21.0**; system Node 18 is insufficient).

| Check | Final result | Evidence relative to `.artifacts/` |
| --- | --- | --- |
| `npm run build:packages` | PASS | `handoff-build-packages.log` |
| `npm run build -w apps/builder-app` | PASS, TypeScript + Vite; existing large-chunk warning (main 2,191.57 kB) | `handoff-build-app.log` |
| `npm run test -w apps/builder-app` | **197 passed, 0 failed, 5 skipped**; 21 files passed, 1 skipped, 22 total; 202 tests collected | `handoff-unit.log` |
| Same test command with `-- src/lib/rules/spell-options.test.ts --reporter=verbose` | **14 passed, 0 failed/skipped**, 1 file; included in the 197, not additional | `handoff-spell-identity.log` |
| ESLint, all 4 QA TS/TSX files | **0 errors, 0 warnings** | `handoff-lint-qa.json` |
| ESLint, all 26 modified app TS/TSX files since `6a6aea2` | **1 pre-existing error, 0 warnings**: `components/ui/button.tsx:52`, mixed component/variant exports (`react-refresh/only-export-components`) | `handoff-lint-modified.json` |
| Full app ESLint | **38 errors, 1 warning**; every rule/file occurrence matches the previously verified baseline, no new findings | `handoff-lint-full.json`, `lint-baseline.json` |

Do not claim every modified file or full lint is clean: the shared Button exception predates this work. No unrelated lint repairs were made. The five skipped tests are `lore-ingest/real-data.test.ts`, requiring a complete 5etools-src fixture. The earlier content-only checkout lacked `js/parser.js`, causing suite initialization failure when explicitly enabled; this environment issue was not rerun.

**188 versus 190 resolved:** the common frontend suite has **183 passing tests** (`qa/baseline-tests.log`, excluding spell-options). Modernization had five spell tests: **183 + 5 = 188 passes**, plus five skips (`unit-final.log`). Claude's handoff reports **190 passes** on its branch: **183 + 7 encounter-difficulty tests**, plus five skips. Those seven are in `encounter-difficulty.test.ts`, added after the common base on `aurora-server`; they are absent from this isolated Codex branch. QA replaces the five spell tests with fourteen: **183 + 14 = 197 passes**. After combining the current branches, expect **204 passes + 5 skips** (209 collected), subject to Claude's later changes; this is a prediction, not an integrated test result. The baseline log's **188 total** means 183 passes + 5 skips, a different number from modernization's 188 passes.

Prior evidence was preserved, not extensively rerun during this documentation-only finalization:

- `screenshots/results.json`, `browser.log`: **90** responsive/theme checks across six widths (320/360/390/768/1024/1440), three themes and five journeys; no overflow or app/unmocked-API errors.
- `qa/browser-results.json`: **14 successful flags** (7 at each of 360/390): identity, preview without writes, multiclass, replacement/save/reload, explicit removal, play state and themes. `qa/accessibility.log`: keyboard navigation, theme Escape/focus return, HP-save failure rollback/retry pass.
- `workflows/results.json`, `completion.json`, `play-results.json`: synthetic Fighter 2014 and Wizards 2014/2024; multiclass, spell learning, saves/reloads, HP, rests, resources, preparation, slots and PDF rendering/download, using isolated SQL/API. Required-choice completion filled 13/36/33 options respectively, except missing imported alignments.
- Earlier character backend suite: **299 passed, 0 failed/skipped**; not rerun here. Mission 006B/auth fixes remain Claude's responsibility.

## Screenshots

All paths below are relative to the artifact directory above; files were verified present. These are existing evidence, not newly captured images.

- QA spells: `qa/spell-identity-360.png`, `qa/spell-identity-390.png`.
- QA sheets: `qa/sheet-play-360.png`, `qa/sheet-play-390.png`.
- Branding: `qa/logo-{porcelain,slate,midnight}-{360,390}.png` (six images).
- Full matrix: `screenshots/` (homepage, creation, spell selection, sheet, battle across themes/widths; names and results in `screenshots/results.json`).
- Real synthetic workflows: `workflows/{Fighter-2014,Wizard-2014,Wizard-2024}-{sheet,battle,pdf}.png`, plus their `.pdf` files and `wizard-{2014,2024}-magic.png`.

## Integration review — no integration performed

Branch tips inspected locally: PDF.js `ac2bd9e`, Homebrew tile `9f32e6d`, CI `a7b58d6`, Mission 006B `fix/backend-auth-tests` at `db02a74`. The latter worktree was clean when inspected read-only; ongoing or later backend work is not validated by this handoff.

- **Confirmed textual conflict:** `pages/landing/Index.tsx` against `feature/homebrew-home-tile`. A three-way text comparison used scratch artifact copies only, without a Git merge or index/worktree changes. Preserve Codex's celestial logo/header, theme tokens and readable image fallback AND Claude's **single Tasha-themed Homebrew tile**. Retain `HOMEBREW_TILE`, `imagePosition="object-top"`, `/homebrew`, and Claude's Battle/Homebrew grid placement. Remove the old `HomebrewSection` import/render; do not recreate the five workshop tiles or replace the entire landing file. Preserve Claude's homebrew page, art constant and section deletion. `/art/homebrew.webp` is an existing external asset, not supplied by this Codex branch.
- **`security/pdfjs-6.2.108`:** its changes to builder `package.json`, frontend lockfile and `lib/pdf-view.ts` do not overlap Codex changes. Preserve all three; rerun PDF generation/rendering after integration. This branch alone still has the older dependency.
- **`ci/aurora-server-vitest`:** no direct workflow overlap. Preserve frontend Vitest and `aurora-server` CI triggers; its full frontend build/backend tests exceed this final builder-only validation. Keep all test files, including Claude's seven encounter tests.
- **Mission 006B:** no backend/test-file overlap from Codex. Do not treat the earlier character-suite pass as validation of Claude's ongoing auth/backend fixes. Reinspect its final committed state before integration.
- The directive is identical to `aurora-server`; its add/add comparison is clean. Base homepage changes merge textually with current `aurora-server`; the explicit tile branch is the conflict described above. Future branch changes require rechecking.

After owner approval, Claude can integrate **the final tip of `codex/frontend-qa`** in a separate integration worktree based on the then-current approved `aurora-server`. Preserve both histories and all Claude changes. Validate build/unit results, the combined homepage in all three themes/mobile widths, spell identity and PDFs against synthetic data before acceptance. No merge, push or deployment is authorized by this handoff.

## Modified files and scope

Full authoritative inventory: `git diff --name-only 6a6aea2 codex/frontend-qa` (**58 files**). App paths below are relative to `src/frontend/apps/builder-app`.

- App entry/assets: `index.html`, `vite.config.ts`, `public/branding/{README.md,apple-touch-icon.png,favicon-16.png,favicon-32.png,favicon-48.png,favicon.ico,starlights-emblem.webp,starlights-logo.webp}`.
- App source: `src/{main.tsx,index.css,styles/themes.css}`; `src/components/{hourly-backdrop.tsx,mode-toggle.tsx,theme-provider.tsx,spells/spell-browser.tsx,ui/button.tsx,ui/dialog.tsx,ui/sonner.tsx}`; `src/lib/{themes.ts,api/spell-printings.ts,rules/spell-options.ts,rules/spell-options.test.ts}`.
- Pages under `src/pages`: `battle/{battle-index,battle-page,companions,items,prepare-spells}.tsx`; `characters/builder/{builder-page,magic-tab,spell-choice,wizard}.tsx`; `characters/sheet/{interactive-sheet,sheet-page}.tsx`; `landing/Index.tsx`; `layouts/default-layout.tsx`.
- Repository tooling: `tools/frontend/{accessibility,branding,complete-characters,fixtures,play-checks,qa,smoke,workflows}.mjs`.
- Repository guidance: `.gitignore`, `AGENTS.md`, `docs/ai/{ARCHITECTURE,CODEX_HANDOFF,DECISIONS,DEVELOPMENT_DIRECTIVE,FRONTEND_GUIDE,PROJECT_STATUS}.md`; `.agents/skills/starlights-{battle-simulator,character-builder,frontend,safe-development,testing}/SKILL.md`. Older status notes describe the modernization checkpoint; this handoff supersedes their test totals and integration branch.
- QA-only delta from `a9a305f`: `src/lib/api/spell-printings.ts`, `src/lib/rules/spell-options{,.test}.ts`, `src/pages/characters/builder/spell-choice.tsx`, `tools/frontend/{fixtures,qa}.mjs`, and this handoff (app-relative paths for the first four).

## Limits, production and cleanup

No backend, database schema/migration or deployment files changed from the common base. No production database/content, credentials, containers, services or unrelated homelab services were changed. No deployment, Docker restart, merge or push occurred. Earlier real tests used only synthetic data in disposable Codex SQL/API containers; no production data was copied. No new servers or containers were started during this finalization.

Earlier modernization cleanup recorded the isolated containers/networks and Vite as stopped/removed. **Current host-level cleanup cannot be independently certified:** this session's sandbox exposes only its own processes/network namespace, denies socket inspection and denies the read-only Docker listing. No preview is running in this session, but the earlier QA preview on host port **55052** (and disposable API **55053**) cannot be checked or stopped from here. A host-capable session must confirm those Codex-only processes are absent before declaring cleanup complete; never stop a service solely by port or touch production. No broad kill or container action was attempted.

Remaining limitations: existing lint debt and large bundle; optional lore fixtures; missing imported alignment options; no exhaustive class/content or WCAG audit; PDF.js security update pending Claude integration; host preview shutdown verification outstanding. Frontend work is preserved and ready for reviewed integration after owner approval, with that cleanup limitation explicitly recorded.
