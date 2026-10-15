---
name: starlights-database
description: Load before changing Starlights persistence — EF Core contexts, migrations, the character JSON columns, builder snapshots, row locks, or anything touching the live SQL Server or its backups.
---

# Starlights data

- Two EF Core contexts on one SQL Server 2022: `CharactersContext` (schema `characters`;
  `src/modules/characters/Modules.Characters.Data.EntityFramework`) and `ElementsContext` (schema `elements`).
  Each has a migration worker (`*.MigrationService`) that runs on `docker compose up` before the API.
- New migration: in the .NET 10 SDK container, `dotnet tool restore` then `dotnet ef migrations add <Name>` for the
  context's project (startup project is the same Data project via its `DesignTime*ContextFactory`). Check the
  generated code; never edit an applied migration.
- `character` keeps inventory, extras, magic, combat as JSON (`TypeConfiguration/CharacterTypeConfiguration.cs`,
  default serializer: PascalCase, e.g. `$.Revision`). Shape changes need no migration; missing properties read as
  defaults. Inventory has `Revision`, combat has `Received`: stale client saves get 409.
- Read-check-write on inventory/combat goes through `ICharactersRepository.LockAsync(ids)` (UPDLOCK, one
  transaction, commit after `SaveChangesAsync`, before reprocessing). No retry strategy on the context.
- Builder Save/Discard: `CharacterSnapshotsRepository` captures and restores a character's rows as JSON;
  trades/gifts also update open snapshots (`BuilderSnapshotInventory`).
- Content (elements) is rebuilt by imports; characters reference elements by ids derived from Aurora ids, so a
  `--replace` import keeps characters working.
- Live database `starlights`, test copy `starlights_copy` (same container). Backups: nightly `.bak` per weekday
  in the volume's `backup/`, encrypted off-site to GitHub releases at 05:15. Before any risky change take a
  verified `.bak` (deployment skill). Never run experiments on `starlights`.
