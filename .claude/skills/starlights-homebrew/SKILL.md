---
name: starlights-homebrew
description: Load before working on Starlights homebrew — the Homebrew page, homebrew items/monsters/spells/classes/subclasses, the homebrew folder and import, who may create it, and how it reaches the builder, compendium, campaigns, inventories and the battle simulator.
---

# Homebrew

- Storage: folder `Aurora:HomebrewPath` (homelab `~/homelab/config/starlights/homebrew`, kit `deploy/data/homebrew`).
  Uploaded Aurora `.xml` files plus files written by the forms: `starlights-items.xml` (magic items as Aurora
  `Magic Item` elements), `starlights-monsters.json` (monsters, 5etools-like JSON, for encounters only).
  The workshop writes `starlights-spells.xml`, `starlights-subclasses.xml`, `starlights-classes.xml`; all
  generated files are `HomebrewContent.IsManaged` (hidden from the files tab, can't be uploaded over or deleted).
- Server: `src/modules/elements/Modules.Elements.Endpoints/Installation/HomebrewContentEndpoints.cs`
  (`HomebrewContent` paths + `Gate` semaphore, `HomebrewItemXml.ToXml/FromXml`, GET/PUT/DELETE
  `/api/elements/homebrew/{items,monsters}`), `HomebrewEndpoints.cs` (upload/list/delete files),
  `HomebrewWorkshopEndpoints.cs` (spells/subclasses/classes, `/homebrew/subclass-targets`, DELETE
  `/homebrew/{kind}/{id}`); XML in `Modules.Elements.Domain/Homebrew/HomebrewWorkshopXml.cs` (tests:
  `HomebrewWorkshopXmlTests`; the importer maps `Archetype` → SubClass). After a write:
  `IAuroraImporter.ImportAsync(AuroraImporterIndex.Homebrew, replace:false, update:true)`.
- Permissions: every `/api/elements` write needs the admin key or admin token (Program.cs middleware) — keep new
  routes under `/api/elements/homebrew/…` and they're covered. Reading is open.
- Reaching players: a homebrew book is off by default — a character ticks it in Sources (new books are switched off
  for every character after a save: `withNewBooksOff` in `lib/api/homebrew.ts`); campaigns switch on
  `useHomebrew`. Items then appear in the builder, Compendium, campaign item pickers and simulator like book items
  (item uses are read from the description text). Homebrew monsters are offered in encounters (`AddHomebrew`).
- Aurora XML shapes: copy from `~/aurora-elements/core/players-handbook-2024` (class, archetypes/, spells) — a
  subclass's `<supports>` must equal its class's `select type="Archetype"` supports (read it from content, don't
  guess; when it has `||` alternatives use the LAST, e.g. the 2024 Fighter's "Fighter Subclass"). A class's
  skill select lists skill ids joined with `|`; proficiencies carry `requirements="!{MULTICLASS id}"` except the
  multiclass subset; casting tables are copied from the 2024 Cleric/Paladin/Warlock. Build XML with `XElement`, allowlist enums, cap lengths, keep ids stable across edits.
- Web: `pages/homebrew/{Index.tsx,homebrew-tabs.tsx,workshop-tabs.tsx,form-styles.ts}`, `lib/api/homebrew.ts`,
  one "Homebrew" picture tile on the home page (`pages/landing/Index.tsx`, art `/art/homebrew.webp`); `/homebrew?tab=spells&new=1` opens a new form.
- End-to-end check on the test copy: `tmp/sec/hb_e2e.py`-style script (builds a level-5 character of a homebrew
  class and checks choices, slots, skills, subclass choice).
- Status of the workshop (spells/classes/subclasses forms, home page tiles): see `docs/ai/CLAUDE_HANDOFF.md`.
