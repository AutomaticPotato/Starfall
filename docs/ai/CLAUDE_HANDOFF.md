# Claude handoff

Updated 2026-10-15 (session f4aa8337). Keep under ~80 lines; replace stale lines.

## Task
Homebrew workshop (create spells, subclasses, classes besides items/monsters; home-page section) and encounter
difficulty (pick characters/creatures; 2014 + 2024 DMG; optional magic-item estimate). Plus project memory.

## Where
Branch `homebrew-workshop`, worktree `/home/chassapis/.claude/jobs/f4aa8337/tmp/wt-hb`, base `aurora-server`
6a6aea2 (= live and GitHub). Codex works in `~/starlights-frontend` on `codex/frontend-modernisation`
(themes, navigation, spell selection = the D&D Beyond-style list the user asked for, sheet, battle visuals).

## Recovered state (start of this session)
Interrupted work had produced no code: the worktree was clean at 6a6aea2. Research was done (Aurora XML shapes
for class/archetype/spell, multiclass slot grant ids exist: `ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_{FULL,
HALF,HALF_UP,SOLO}`).

## Status
- Done, tested (unit): `lib/rules/encounter-difficulty.ts` + test (7, incl. the 2014 DMG's own worked example).
- Done, type-checked, not yet tried in a browser: `pages/campaigns/encounter-difficulty.tsx`, wired into
  `encounter-page.tsx` set-up (one import + one line).
- Done: `CLAUDE.md`, `.claude/skills/starlights-{architecture,homebrew,encounters,dnd-rules,database,deployment,
  session-handoff}`.
- Not started: homebrew spells/subclasses/classes (server generators + endpoints + tabs), home-page section.

## Next step
Server: `Modules.Elements.Endpoints/Installation/HomebrewContentEndpoints.cs` — add spell model + `ToXml/FromXml`
(file `starlights-spells.xml`), GET/PUT/DELETE `/api/elements/homebrew/spells`; then subclass (targets read from
content: class → granted Class Feature with `select type="Archetype"` supports), then class (proficiencies with
the multiclass pattern, features by level, subclass level, ASI feats, optional full/half/pact casting with an
existing spell list). Tests: round trip + import (`AuroraImporterAppendTests` setup) + `AuroraChoicesAuditTests`.

## Tests run
Web unit tests for the difficulty rules; web image build (tsc). Not yet: full web suite, browser check of the panel.

## Coordination
Landing page (`pages/landing/Index.tsx`) is shared with Codex's theme work: add the homebrew section as its own
component file and a one-line insertion only. Don't touch spell selection components.

## Blockers
None. No push/deploy without the user's go-ahead.
