# Project status
## Existing completed systems
Character creation/guided builder, registration progression, multiclassing, sources/2014+2024 editions, equipment, spellcasting/preparation, Aurora import/PDF, campaigns, party transfers, combat/action simulation, lore/content imports, player locks, snapshots and Docker packaging.

## Parallel work
User reports interrupted Claude work: homebrew improvements, CR/encounter difficulty and integration. On 2026-10-15 both `aurora-server` and `homebrew-workshop` were clean at `6a6aea2`; no unfinished diff was visible. Claude worktree: `/home/chassapis/.claude/jobs/f4aa8337/tmp/wt-hb`. Treat homebrew, encounter calculations and related backend/integration as protected; recheck before integration.

## Frontend priorities
Semantic themes/shared surfaces → spell selection → interactive sheet → battle presentation → automated and responsive validation. Exact milestone state is in CODEX_HANDOFF.md.

## Environment limitations
Initial shell has Node 18, no dotnet on PATH, restricted DNS and Docker socket access denied. Existing frontend dependencies and Playwright package are available in local caches; test feasibility is being assessed. No production data or services may be changed to work around these limitations.

## Implemented on the isolated frontend branch
Three previewable persisted themes, responsive header menu, shared spell browser, learning/preparation counts and level navigation, duplicate printing consolidation, interactive sheet route and token-based battle presentation. No backend/database/rules engine changes. Full browser/build/runtime verification remains outstanding until the local toolchain is available; see handoff for exact test outcomes.
