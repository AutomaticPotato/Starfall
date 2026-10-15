# Codex handoff
Updated 2026-10-15. Task: frontend modernization and persistent knowledge.

## Isolation
Work only in `/home/chassapis/starlights-frontend`, branch `codex/frontend-modernisation`, base `6a6aea2`. Main and Claude worktrees were clean at inspection. No remote mutation/deployment authorized. Protected: homebrew, encounter calculator and integration.

## Milestone 1
Inspected routing, builder/magic, sheet/combat APIs, themes, deployment and authentication. Created AGENTS.md, five focused skills and docs/ai. Implementation pending. Toolchain limitations in PROJECT_STATUS.

## Resume
Read AGENTS.md, this file, then FRONTEND_GUIDE sections relevant to current changes. Inspect `git status`/`git log`; do not rediscover the full repository. Next: implement semantic themes and shared spell/character components, then validate.

## Milestone 2 — theme foundation
Semantic Porcelain/Slate/Midnight palettes; preview/save/cancel; migration of light/dark settings; OS and cross-tab sync; reduced motion; touch-size buttons and constrained dialogs. Header uses a labeled mobile menu. Background photos are replaced by clean theme surfaces; files remain intact. Shared toast colors now follow the actual provider.
Validation: direct workspace TypeScript 7 app check passes; targeted ESLint JSON checks pass (provider retains fast-refresh warnings for shared exports). All five skills validate. Token foreground/background ratios checked by WCAG relative luminance: minimum 5.69:1 among tested foreground, muted, primary, status pairs. This is a palette check, not a full page accessibility audit.
Remaining implementation is in the worktree (spell browser, reprints, interactive sheet and battle presentation); commit it as the next milestone after review. Full Vite/Vitest runs blocked by host Node 18. Backend SDK absent. Browser package present, Chromium executable absent. User asked to provide runtime paths.

## Milestone 3 — spell learning and preparation
Added `components/spells/spell-browser.tsx` (8-card pagination, level/school/source/search, inline lazy descriptions, requirements and explicit actions), `pages/characters/builder/spell-choice.tsx` (server choice mutations), `lib/rules/spell-options.ts` and five Vitest regression cases. Magic tab now shows counts, per-level navigation, per-class known/cantrip/preparation totals and shared cards. Simulator preparation uses the same cards and keeps its existing explicit DM override.
User steering: duplicate spell printings must not appear as separate creation options. `groupSpellOptions` groups normalized names, prefers the enabled edition/eligible printing, retains selected ids, and exposes other printings inside one details panel. Same-feature choices prevent learning another printing of a learned name. Mixed rules stay selectable without changing stored ids.
Validation: seven direct assertions against the transpiled production grouping function pass, including edition, existing id, eligibility, punctuation and distinct-name cases. This does not substitute for the blocked full Vitest run.

## Milestone 4 — interactive sheet and simulator presentation
Added `/characters/:id/play` and interactive-sheet.tsx; header/guide/battle link to it, PDF stays at `/characters/:id/sheet`. Sheet reuses existing battle Vitals/Status/RestDialog, MagicTab, EquipmentTab and server state. RestDialog only changed its exported type boundary to accept the fields actually used. Battle page, index, items and companions now use semantic colors and readable text; tabs wrap; no combat formulas changed.
Added tools/frontend synthetic fixture/browser runner covering all three themes and five requested widths for spell learning, sheet and battle, with assertions for no horizontal overflow, duplicate printings, HP writes and theme cancellation. It needs a local Vite server and Playwright Chromium. Syntax checked; browser execution pending.
User offered access and answered Yes to installing Node 22.12+/24, .NET 10 and Chromium; executable paths not supplied yet. Do not assume Yes means installation has happened.
