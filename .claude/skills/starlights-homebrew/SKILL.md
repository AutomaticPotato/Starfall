---
name: starlights-homebrew
description: Load before working on Starlights homebrew — the Homebrew page, homebrew items/monsters/spells/classes/subclasses, the homebrew folder and import, who may create it, and how it reaches the builder, compendium, campaigns, inventories and the battle simulator.
---

# Homebrew

- Storage: folder `Aurora:HomebrewPath` (homelab `~/homelab/config/starlights/homebrew`, kit `deploy/data/homebrew`).
  Uploaded Aurora `.xml` files plus files written by the forms: `starlights-items.xml` (magic items as Aurora
  `Magic Item` elements), `starlights-monsters.json` (monsters, 5etools-like JSON, for encounters only).
  The forms' generated files follow the same pattern (one `starlights-<kind>.xml` per kind).
- Server: `src/modules/elements/Modules.Elements.Endpoints/Installation/HomebrewContentEndpoints.cs`
  (`HomebrewContent` paths + `Gate` semaphore, `HomebrewItemXml.ToXml/FromXml`, GET/PUT/DELETE
  `/api/elements/homebrew/{items,monsters}`), `HomebrewEndpoints.cs` (upload/list/delete files). After a write:
  `IAuroraImporter.ImportAsync(AuroraImporterIndex.Homebrew, replace:false, update:true)`.
- Permissions: every `/api/elements` write needs the admin key or admin token (Program.cs middleware) — keep new
  routes under `/api/elements/homebrew/…` and they're covered. Reading is open.
- Reaching players: a homebrew book is off by default — a character ticks it in Sources (new books are switched off
  for every character after a save: `withNewBooksOff` in `lib/api/homebrew.ts`); campaigns switch on
  `useHomebrew`. Items then appear in the builder, Compendium, campaign item pickers and simulator like book items
  (item uses are read from the description text). Homebrew monsters are offered in encounters (`AddHomebrew`).
- Aurora XML shapes: copy from `~/aurora-elements/core/players-handbook-2024` (class, archetypes/, spells) — a
  subclass's `<supports>` must equal its class's `select type="Archetype"` supports (read it from content, don't
  guess). Build XML with `XElement`, allowlist enums, cap lengths, keep ids stable across edits.
- Web: `pages/homebrew/{Index.tsx,homebrew-tabs.tsx}`, `lib/api/homebrew.ts`.
- Status of the workshop (spells/classes/subclasses forms, home page tiles): see `docs/ai/CLAUDE_HANDOFF.md`.
