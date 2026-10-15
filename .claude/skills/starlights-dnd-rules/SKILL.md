---
name: starlights-dnd-rules
description: Load before implementing or checking a D&D 5e rule in Starlights (2014 vs 2024 behaviour, spellcasting, encounter XP, item uses) — it says where the rule already lives and which sources are authoritative, so nothing is invented.
---

# Rules: where they live, what is authoritative

Never invent a rule. In order of authority:
1. The content itself: Aurora Legacy XML (`~/aurora-elements`, the builder's rules: grants, selects, stats,
   requirements) and the 5etools data (`~/5etools/data`, monsters, spells, the DMG/XDMG encounter tables via the
   Compendium build in `~/homelab/config/starlights-lore`). Use the `anthropic-skills:dnd-5etools-lookup` skill
   for official tables (e.g. XP budgets) and cite the book.
2. Existing implementations (reuse, don't duplicate):
   - server rules engine: `Services/Processing/RegistrationProcessor.cs`, `RequirementsExpression.cs`;
     spellcasting facts `Services/Magic/SpellcastingFacts.cs`; multiclass slots in content grants
     (`ID_INTERNAL_GRANT_MULTICLASS_SPELLCASTING_SLOTS_{FULL,HALF,HALF_UP,SOLO}`);
   - web `lib/rules/*`: `magic.ts` (slots, preparation, rests), `battle.ts`, `items.ts`, `item-uses.ts`,
     `encounter.ts` (initiative, attack/save odds, CR → proficiency), `monster-actions.ts`.
3. Editions: an element's source book decides (books with "(2024)" are 2024); a character's edition choice in
   Sources filters books. Keep 2014 and 2024 behaviour side by side, selected by data, never by guessing.
When a rule is ambiguous, state the source and the reading chosen in the code comment and the handoff.
