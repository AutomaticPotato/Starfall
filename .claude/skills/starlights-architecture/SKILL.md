---
name: starlights-architecture
description: Load when you need to find where something lives in Starfall (server modules, endpoints, importer, web app pages, rules libraries) before searching the code yourself.
---

# Where things are

Overview: `docs/ai/ARCHITECTURE.md` and `FRONTEND_GUIDE.md` (Codex's; on its branch until merged:
`git show codex/frontend-modernisation:docs/ai/ARCHITECTURE.md`). This adds the server-side map.

- API host `src/apps/Starlights.Application/Program.cs` (admin-key middleware for `/api/elements` writes and
  `/api/admin`; locked-character middleware `LockedCharacterId`), `Content/ContentSync.cs` (kit content job).
- `src/modules/elements`: `Services/AuroraImporter.cs` (Aurora XML → elements; appends, PR/homebrew precedence),
  `Services/FiveETools/*` (5etools translation layer), `Services/Spells/SpellIndex.cs` (`ISpellIndex`),
  `Services/Items/*` catalog, `Modules.Elements.Endpoints/Installation/Homebrew*Endpoints.cs`.
- `src/modules/characters`: `Domain/*` (Character, Campaign, Player, CharacterSnapshot), `Services/Processing/
  RegistrationProcessor.cs` (rules engine), `Services/Players/PlayerAccess.cs` + `UnlockLimiter.cs`,
  `Services/Campaigns/*` (InventoryTrade, PartyItemEffect, BuilderSnapshotInventory),
  `Modules.Characters.Endpoints/{Characters,Campaigns,Generation}/*`. Character files (export/import between servers):
  `Services/Portability/CharacterExportFile.cs` (format, id remapping) + `Endpoints/Characters/Portability/*`
  (reuses the builder snapshot capture/restore; docs/character-portability.md).
- Campaign sessions page: `pages/campaigns/campaign-page.tsx` + `session-navigation.ts` (Codex 014A). Final overview:
  `docs/ai/FINAL_HANDOFF.md`.
- Web app `src/frontend/apps/builder-app/src`: `pages/*` (builder, battle, campaigns incl. `encounter-page.tsx`,
  homebrew, lore, landing), `lib/api/*` hooks, `lib/rules/*` pure tested rules, `components/search-select.tsx`.
- Homelab glue: `~/homelab/compose/starlights/docker-compose.yml`, `~/homelab/scripts/starlights-*.sh`.
Use `grep -rn <Symbol> src` to land on the exact range; FastEndpoints routes are in each endpoint's `Configure()`.
