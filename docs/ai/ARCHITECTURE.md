# Architecture
Paths below are relative to the repository root. Start with the relevant subsystem, not a repository-wide scan.

## Runtime
`src/apps/Starlights.Application/Program.cs:Main` registers platform modules, FastEndpoints, content sync, CORS and access middleware. `LockedCharacterId` protects parsed character routes. `src/modules/characters/Modules.Characters/Services/Players/PlayerAccess.cs` validates player/admin unlock tokens. Frontend `lib/player.tsx` stores player choice/unlock tokens; `lib/api-client.ts` attaches headers. Preserve these checks on every new view.

## Persistence
SQL Server, EF Core `src/modules/characters/Modules.Characters.Data.EntityFramework/CharactersContext.cs` and `src/modules/elements/Modules.Elements.Data.EntityFramework/ElementsContext.cs`; separate migration services. Character data, campaign state, inventory and content remain on existing APIs. `CharacterSnapshot` and `Services/Campaigns/BuilderSnapshotInventory.cs` preserve Save/Discard and transferred items. Never use live databases for UI fixtures.

## Content
`src/apps/Starlights.Application/Content/ContentSync.cs` manages content downloads/imports. `src/modules/elements/Modules.Elements/Services/AuroraImporter.cs` imports Aurora XML. `src/modules/elements/Modules.Elements/Services/FiveETools/FiveEToolsContent.cs` plus `.Classes.cs`, `.Rules.cs`, `.Options.cs` bridge 5etools; `FiveEToolsRenderer.cs` renders its content; Lore is served as generated static data. Sources and edition filters are applied by existing endpoints. Homebrew paths and endpoints are protected parallel-work areas.

## Frontend
`src/frontend` is an npm workspace. Builder app `src/main.tsx` owns routes and QueryClient/ThemeProvider/PlayerProvider. `App.tsx` supplies app chrome. `lib/api` contains query/mutation hooks; `lib/rules` contains pure rules. Shared packages provide API types and UI styles. See FRONTEND_GUIDE for paths relative to builder-app/src.

## Character progression
`pages/characters/builder/builder-page.tsx:CharacterBuilderPage` consumes `useBuilderChoices` and class APIs. `ChoiceRow` registers selections through `usePickChoice`; `refreshCharacter` handles asynchronous server processing. Server `Generation/Registrations/GetBuilderChoices/GetBuilderChoicesEndpoint.cs` exposes choice slots; `Services/Processing/RegistrationProcessor.cs` processes registrations. `Services/Magic/SpellcastingFacts.cs` derives class spellcasting. `lib/rules/magic.ts` handles multiclass slots, preparations and rests. Preserve 2014/2024 distinctions. `save-bar.tsx:SaveBar` controls builder snapshots.

## Sheet and battle
`lib/api/sheet.ts:useSheetData` composes existing character, registration, statistics, inventory and spell data. `lib/sheet-model.ts` calculates display values; `lib/aurora-sheet.ts:buildAuroraSheet` fills existing PDF templates. `pages/characters/sheet/sheet-page.tsx` preserves print/export.
`pages/battle/battle-page.tsx:CharacterBattlePage` uses `lib/battle-model.ts:buildBattleModel`, `lib/rules/battle.ts` and `lib/api/combat.ts`. Combat is optimistic server-persisted state, with conflict retry for party updates. Turn/action tracking is separate browser state. Inventory and magic use their existing APIs, shared with builder. Encounter rules/DM pages are Claude-owned parallel work.

## Deployment and backups
`src/aspire/Starlights.AppHost/AppHost.cs` orchestrates local development. `deploy/docker-compose.yml` starts SQL Server, migration jobs, API and nginx frontend. `deploy/nginx.conf` proxies APIs/static content. `deploy/setup.sh` and `deploy/admin.sh` manage deployment; inspect README for operational procedures. Persistent volumes under `deploy/data` contain private data. Existing backups and host services are outside frontend scope.
