# Claude handoff

Updated 2026-10-19 (session 9e7d5e8e). Keep under ~80 lines; replace stale lines.

## Task (current): Starfall Mk2 stabilization — 2026-10-19 (sessions 4213521d, 9e7d5e8e)
Owner's brief (15 phases); report: [MK2_VERIFICATION_REPORT.md](MK2_VERIFICATION_REPORT.md) — PARTIALLY VERIFIED.
Seven draft PRs on `aurora-server` 8adf858, none merged or deployed: #4 A append-import transaction (b6d8ec1),
#5 B skills missing on SQL Server + statistic proficiency (5a2b079), #6 C empty Aurora attack ids (0634cff),
#7 D homepage art (c6ae753), #11 E ornaments + Compendium phone overflow (e7bf84e), #9 F CI renamed to `ci.yml` +
SQL Server service + docs (29528b4), #10 G import sets abilities before equipment (a456728). Merge F first.
After deploying B and G: admin `reprocess` once (heals characters without skills; changes nothing else).
`aurora-server` now takes changes only through pull requests with "Build & Test Solution" passing (rulesets
25414439, 25415668; docs/ai/CI.md). Evidence ledger + scripts: `~/.cache/starlights-test/mk2/`.
Disposable installs (SQL container `starfall-mk2-sql`, APIs 8195/8196/8199, webs 8197/8198/8212/8213) are test-only.

## Earlier work
Homebrew workshop + encounter difficulty (2026-10-15, 4752dfa), API compatibility / custom attacks (2026-10-16,
ec3b83f), v0.10.0 (b4d3e6b): all merged and live; details in git history and [FINAL_HANDOFF.md](FINAL_HANDOFF.md).

## Not done / known limits
- Custom-monster CR calculator (DMG "creating a monster" CR from HP/AC/damage): a separate feature, not built.
- Homebrew classes: no Mystic Arcanum, no third-casters (Eldritch Knight style), no custom resource pools.
- Simulator charge edits made while a builder tab is open aren't reconciled (pre-existing).
- Open dependency notes: shadcn in runtime deps; NuGet: transitive System.Security.Cryptography.Pkcs 9.0.4.
- Mk2 (see report): live data never compared; Lore content, campaign editing, multiclass and export/import not
  checked in a browser; the pack's Slate ornaments are faint on the light Slate theme.

## Coordination (shared files touched)
- PR D: `pages/landing/Index.tsx` hero (artwork from `useTheme().resolvedTheme`, `public/branding/starfall/`).
- PR E: `styles/ornament.css` (picture URLs per `data-theme`), `components/ornaments.tsx` (`CelestialDivider` one
  element, new `PageCorners`), `App.tsx` (page corners in the App shell), `pages/compendium/Index.tsx` (`grid-cols-1`),
  `public/ornaments/<theme>/`. No new theme system; Codex's theme provider untouched.
- PR B: `lib/api/sheet.ts` (`withProficiencies`), `lib/rules/proficiencies.ts`; PR C: `lib/rules/items.ts`; PR G:
  `lib/aurora-character-import.ts`. D and E were merged together locally without conflicts.

## Next
Owner: review and merge (F first), deploy, then admin `reprocess` and a live before/after snapshot. Afterwards
pull requests other than F need "Update branch" once to get pull-request CI.

## Blockers
None for the code. Merges, deploys and live checks need the owner. The session's classifier refuses copying the
live database; real characters were re-imported from their Aurora files instead.
