---
name: starlights-encounters
description: Load before working on Starlights encounters — a campaign encounter run as a fight, adding party and monsters, monster stat blocks and actions, the battle simulator's link to fights, and encounter difficulty (2014/2024 XP maths and the optional magic-item estimate).
---

# Encounters

- Data: a campaign entry of kind encounter holds a `Fight` JSON (`lib/rules/encounter.ts`: `Fight`, `Combatant`
  kind pc/monster/npc, `characterId`, `link` {category bestiary|homebrew, key}). Server:
  `Modules.Characters.Endpoints/Campaigns/CampaignFightEndpoints.cs` (DM sees all; players get `FightView`
  without monster HP/notes/hidden). Party members' live HP/AC come from their simulators' combat state.
- Page: `pages/campaigns/encounter-page.tsx` (set-up `<details>`: add party, Compendium creatures via
  `creatureStats`, homebrew monsters, own creatures, initiative), `monster-panel.tsx` (actions, recharges,
  `lib/rules/monster-actions.ts`), area damage. Stat blocks come from the Compendium build's bestiary chunks
  (`lib/lore/data.ts` `chunkUrl`, query key `["lore", version, "chunk", "bestiary", source]`).
- Difficulty: rules `lib/rules/encounter-difficulty.ts` (+ test) — 2014 DMG thresholds × multiplier with the
  party-size step (`multiplier2014`), 2024 DMG budgets without multiplier; tables are copied from the 5etools book
  data (`~/5etools/5etools-src/data/book/book-dmg.json`, `book-xdmg.json`). The magic-item estimate
  (`itemBonus`, `effectiveLevel`, `DEFAULT_ITEM_WEIGHTS`) is not a book rule and is always shown separately.
  UI `pages/campaigns/encounter-difficulty.tsx` (DM only, inside set-up): characters (default: PCs in the fight,
  else the party), creatures (CR from Compendium/homebrew, else a CR picker), planned creatures by CR, weights
  kept in localStorage `starlights.encounter-item-weights`. Nothing is saved to the fight.
- Not done: a homebrew monster's own CR calculator (DMG "Creating a Monster") — distinct from encounter
  difficulty; don't conflate them.
