# Claude handoff

Updated 2026-10-19 (session 18ccc2e7). Keep under ~80 lines; replace stale lines.

## Task (done): Starfall Mk2 stabilization — released as v0.11.0 on 2026-10-19
Owner's brief (15 phases); report: [MK2_VERIFICATION_REPORT.md](MK2_VERIFICATION_REPORT.md) (H = live results).
Merged into `aurora-server` in this order: #9 F CI renamed to `ci.yml` + SQL Server service + docs, #4 A
append-import transaction, #5 B skills missing on SQL Server + statistic proficiency, #10 G import sets abilities
before equipment, #6 C empty Aurora attack ids, #7 D homepage art, #11 E ornaments + Compendium phone overflow,
#12 this report. Rehearsed on a copy of the live database, deployed, admin `reprocess` run once on live.
`aurora-server` takes changes only through pull requests with "Build & Test Solution" passing (rulesets
25414439, 25415668; docs/ai/CI.md); CI runs on pushes and pull requests. Evidence: `~/.cache/starlights-test/mk2/`
(LEDGER.md; release script and its log in `finish/`).

## Earlier work
Homebrew workshop + encounter difficulty (2026-10-15, 4752dfa), API compatibility / custom attacks (2026-10-16,
ec3b83f), v0.10.0 (b4d3e6b): all merged and live; details in git history and [FINAL_HANDOFF.md](FINAL_HANDOFF.md).

## Not done / known limits
- Custom-monster CR calculator (DMG "creating a monster" CR from HP/AC/damage): a separate feature, not built.
- Homebrew classes: no Mystic Arcanum, no third-casters (Eldritch Knight style), no custom resource pools.
- Simulator charge edits made while a builder tab is open aren't reconciled (pre-existing).
- Open dependency notes: shadcn in runtime deps; NuGet: transitive System.Security.Cryptography.Pkcs 9.0.4.
- Mk2 (report G): Lore content, campaign editing, multiclass and export/import not checked in a browser; the
  pack's Slate ornaments are faint on the light Slate theme.

## Coordination (shared files touched)
- PR D: `pages/landing/Index.tsx` hero (artwork from `useTheme().resolvedTheme`, `public/branding/starfall/`).
- PR E: `styles/ornament.css` (picture URLs per `data-theme`), `components/ornaments.tsx` (`CelestialDivider` one
  element, new `PageCorners`), `App.tsx` (page corners in the App shell), `pages/compendium/Index.tsx` (`grid-cols-1`),
  `public/ornaments/<theme>/`. No new theme system; Codex's theme provider untouched.
- PR B: `lib/api/sheet.ts` (`withProficiencies`), `lib/rules/proficiencies.ts`; PR C: `lib/rules/items.ts`; PR G:
  `lib/aurora-character-import.ts`.

## Next
Maintenance mode: bug fixes, one mission per branch, merged through pull requests once CI passes.

## Blockers
None. The session's auto-mode classifier refuses merges and production deploys; the owner ran the prepared release
script (`~/.cache/starlights-test/mk2/finish/finish.sh`).
