# Claude handoff

Updated 2026-10-15 (session f4aa8337). Keep under ~80 lines; replace stale lines.

## Task
Homebrew workshop (create spells, subclasses, classes besides items/monsters; home-page section) and encounter
difficulty (pick characters/creatures; 2014 + 2024 DMG; optional magic-item estimate). Plus project memory.

## Where
Branch `homebrew-workshop` (7 commits on `aurora-server` 6a6aea2 = live = GitHub), worktree
`/home/chassapis/.claude/jobs/f4aa8337/tmp/wt-hb` (a job folder: if it is gone, the branch is in `~/starlights`).
Not pushed, not merged, not deployed. Codex: `~/starlights-frontend`, `codex/frontend-modernisation`.

## Status: done, waiting for the user's go-ahead to merge + deploy
- Encounter difficulty: `lib/rules/encounter-difficulty.ts` (+test, the 2014 DMG's worked example) and
  `pages/campaigns/encounter-difficulty.tsx` in the encounter set-up (DM only, nothing saved to the fight). The
  2014 and 2024 results are separate; the magic-item estimate is its own labelled section, weights in
  localStorage. A creature with no known CR asks for one; no result until then.
- Homebrew workshop, server: `Modules.Elements.Domain/Homebrew/HomebrewWorkshopXml.cs` (spell/subclass/class ↔ Aurora
  XML), `Modules.Elements.Endpoints/Installation/HomebrewWorkshopEndpoints.cs` (GET/PUT
  `/api/elements/homebrew/{spells,subclasses,classes}`, GET `/homebrew/subclass-targets`, DELETE
  `/homebrew/{kind}/{id}`); generated files are hidden/protected in the files tab (`HomebrewContent.IsManaged`).
- Homebrew workshop, web: `lib/api/homebrew.ts`, `pages/homebrew/{Index.tsx,workshop-tabs.tsx,form-styles.ts}`,
  `pages/landing/homebrew-section.tsx` (five tiles → `/homebrew?tab=X&new=1`).
- Integration: spells/classes/subclasses are Aurora elements in the homebrew book, so they reach the builder,
  Compendium, sheet and simulator like book content once a character's Sources (or a campaign's Use homebrew)
  switch the book on. Verified end to end in the builder (below); Compendium/simulator not separately checked.

## Tests run (this branch)
Characters 299 pass; Elements 186 pass / 8 skipped (6 new workshop tests); web 190 pass / 5 skipped; ESLint
clean on changed files; web image build (tsc) passes. Test copy, `tmp/sec/hb_e2e.py`: 11/11 (targets from
content; save/list; bad subclass target 400; non-admin 403; homebrew class offers its homebrew subclass; every
level-5 choice has options; homebrew cantrip with the Wizard list; slots 4/3/2 + prepared; skill choice exactly the
class's three; book-class subclass). Browser (`~/.cache/starlights-test/pw/workshop-shots.mjs`, 390/360/1280,
dark+light via `starlights-ui-theme`): no page errors, no sideways scroll on home, homebrew tabs + new dialogs,
encounter panel. CoS fight (4 PCs lvl 5–6, 6 creatures, 4,750 XP): 2014 Deadly (×2 = 9,500 vs 5,300), 2024 High
(vs 5,300), both checked by hand; with injected items Fedra → 5.75 (uncommon + carried rare; stored rare and potion
excluded). The real party carries no magic items (checked read-only), so live shows "no magic items counted".
Test copy torn down afterwards (copy DB dropped, its .bak and :test images deleted).

## Not done / known limits
- Custom-monster CR calculator (DMG "creating a monster" CR from HP/AC/damage): a separate feature, not built.
- Homebrew classes: no Mystic Arcanum, no third-casters (Eldritch Knight style), no custom resource pools.
- Simulator charge edits made while a builder tab is open aren't reconciled (pre-existing).
- Open dependency notes: pdfjs-dist 5.7.284 → ≥ 6.2.108; shadcn in runtime deps; CI skips Vitest and
  `aurora-server`.

## Coordination (shared files touched)
- `pages/landing/Index.tsx`: one import + `<HomebrewSection />` line (Codex's theme work owns the rest).
- `pages/campaigns/encounter-page.tsx`: one import + `<EncounterDifficulty … />` line in the set-up `<details>`.
- `pages/homebrew/homebrew-tabs.tsx`: `Field` exported; items/monsters accept `startNew`.
- Spell selection redesign (D&D Beyond style) is Codex's (`codex/frontend-modernisation` fd6bd92); not touched.
- Merge order: either; the two branches touch different lines. Re-run web tests after both merge.

## Deploy (when approved)
Deployment skill: active-device check, verified backup + rollback tags, build, `up -d --force-recreate`. No
content re-import needed (importer unchanged; homebrew imports on save). Publish checks, then
`git push mine aurora-server` only.

## Blockers
None. No push/merge/deploy without the user's go-ahead.
