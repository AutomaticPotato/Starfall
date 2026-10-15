# Frontend guide
All paths relative to `src/frontend/apps/builder-app/src` unless stated otherwise.

## Components and state
`main.tsx` defines routes. `App.tsx` / `pages/layouts/default-layout.tsx` supply header, navigation and footer. `components/ui` wraps Radix controls. Reuse Button, Dialog, Drawer, Input, Spinner and `ElementDetails` (sanitized HTML). QueryClient owns server state; local React state owns navigation/search. `lib/api-client.ts` attaches unlock headers. Do not bypass it.

## Styling
Tailwind 4 imports workspace `packages/ui/src/index.css` through app `index.css`. Semantic background, foreground, card, border, primary and muted tokens should replace fixed white/black surfaces. Theme provider uses the existing `starlights-ui-theme` storage key. Preserve legacy light/dark/system preferences. Theme UI must remain keyboard accessible and support reduced motion.

## Builder and magic
`pages/characters/builder/builder-page.tsx` renders Build, Abilities, Magic, Equipment, Story and Sources. `wizard.tsx` is guided creation; `lib/rules/wizard-steps.ts:stepChoices` and `spellChoiceGroups` determine choice grouping. `ChoiceRow` uses server eligibility and choice APIs. `magic-tab.tsx:MagicTab` displays per-class casting, prepared spells, slots and next-level summary. `lib/api/magic.ts` provides index/casting/magic/save hooks; `lib/rules/magic.ts` is authoritative client rules. Never infer new selection limits from spell list lengths. `save-bar.tsx` owns Save/Discard; selection feedback must not claim a builder snapshot was saved.

## Sheet
`lib/api/sheet.ts:useSheetData` and `lib/sheet-model.ts` supply existing display data. Printable `pages/characters/sheet/sheet-page.tsx` and `lib/aurora-sheet.ts` are retained. On-screen sheet must reuse combat, magic and inventory hooks; no separate character store.

## Battle
`pages/battle/battle-page.tsx` contains shell, vitals, status, action choices and RestDialog. `items.tsx`, `companions.tsx`, `prepare-spells.tsx` are companions. `lib/battle-model.ts` builds available actions; `lib/rules/battle.ts`, `item-uses.ts`, `item-spells.ts` are mechanics. Style changes must not change combat calculations. Campaign encounter UI is separate and protected.

## Validation
Run workspace package build before app build; API/client package exports use dist. Vitest tests under `lib/rules` cover spell progression, multiclass, combat, inventory and encounters. Browser tests should use synthetic intercepted API responses on an isolated dev server, never production mutations. Check 320/390/768/1024/1440 widths, all themes, focus, expansion, filtering, errors and persistence. PDF tests need templates/assets present.
