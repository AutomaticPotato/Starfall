# Starfall Mk2 — verification report

2026-10-19, Claude (sessions 4213521d on 2026-10-17 and 9e7d5e8e). Mission: the owner's "Starfall Mk2 — Final
stabilization & release readiness" brief. Baseline: `aurora-server` **8adf858** (PR #3), live until this release.
Sections A–F were verified on disposable installs (a copy of the live database was refused by the session's safety
classifier, so real characters were re-imported from their Aurora files instead). On 2026-10-19 the owner approved
merging, deploying and publishing; the release script rehearsed the update on a copy of the live database, deployed
it, ran the admin reprocess and compared every live character before and after (section H).

## Overall: **RELEASED as v0.11.0 — verified on disposable installs and on live data; the areas in G remain unverified**

Every reported defect is fixed and verified on disposable SQL Server installs with the owner's real Aurora
characters, then on a copy of the live database and on live itself (H). CI runs on pushes and pull requests again,
including the SQL Server tests, and repository protection works. Several areas were checked only by loading their
pages; they are listed under "Not verified" (G).

## Pull requests (base `aurora-server` 8adf858, merged in the order F, A, B, G, C, D, E, then this report)

| PR | Branch | Head | What |
| --- | --- | --- | --- |
| [#4](https://github.com/CHassapis/Starfall/pull/4) A | `fix/append-failure-safety` | b6d8ec1 | Aurora import / homebrew changes in one transaction; content version bumped after commit; SQL Server tests |
| [#5](https://github.com/CHassapis/Starfall/pull/5) B | `fix/sheet-proficiency-statistics` | 5a2b079 | skills missing entirely (registration order on SQL Server) + proficiency from statistics |
| [#6](https://github.com/CHassapis/Starfall/pull/6) C | `fix/aurora-attack-identifiers` | 0634cff | Aurora attacks with `identifier=""` kept with a stable fallback id |
| [#7](https://github.com/CHassapis/Starfall/pull/7) D | `feature/starfall-homepage-branding` | c6ae753 | homepage artwork per theme |
| [#11](https://github.com/CHassapis/Starfall/pull/11) E | `feature/starfall-ui-ornaments` | e7bf84e | universal ornaments + Compendium phone overflow |
| [#9](https://github.com/CHassapis/Starfall/pull/9) F | `ci/workflow-triggers` | 29528b4 | CI runs on push/PR again; SQL Server in CI; docs |
| [#10](https://github.com/CHassapis/Starfall/pull/10) G | `fix/aurora-import-ability-order` | a456728 | Aurora import sets ability scores before equipment |

F went first so that the others could get CI; in this order all eight merge onto 8adf858 without conflicts. A, B,
C, D, E and G were built and tested together as one install; F changes only CI and docs.

**After deploying B (and G), the admin reprocess runs once** (`starlights-admin.sh reprocess` on the homelab,
`./admin.sh reprocess` on an installer setup): characters saved without skills, or with an armour rule judged
before their Strength was set, are put right; on the disposable copy it changed nothing else (all statistics,
saves, registrations and inventories identical). The live run is in H.

## A. Reported bugs

| Item | Result | Evidence |
| --- | --- | --- |
| Skill proficiency calculations | PASS | **Root cause found:** 6 of 14 real characters imported into SQL Server had *no skill rows* (Skills rule processed before Abilities rule; skills skipped, never retried). Fixed (PR B); fresh import: 0/14 without skills; healed copy: +18 skills each, nothing else changed |
| Skill proficiency indicators | PASS | sheet values vs Aurora's own PDFs for every character with form fields: **0 proficiency/expertise differences**; expertise/Resilient given as statistics now marked (10 unit tests, 5 fail without the fix) |
| Interactive sheet compatibility | PASS | 252/252 skill rows (14 characters) show the same level on `/play` as in the PDF fields |
| PDF proficiency compatibility | PASS | field-level comparison above; PDFs generated for all 19 characters on the install (valid `%PDF`) |
| Aurora custom attacks with empty IDs | PASS | real file: Mace imported as `aurora-mace-d19fc537-1`, sheet attack row 1 = Aurora's |
| Deterministic fallback identifiers | PASS | 7 unit tests (6 fail without the fix); same id on every import |
| Stable imports and reimports | PASS | "Update from Aurora" ×2 in the browser: one Mace, same id |
| Custom attack editing and deletion | PASS (edit in browser; deletion by unit test) | manual edit kept across both browser updates; deleted fallback attack not restored (unit) |
| Aurora append-only uploads | PASS | SQL Server lifecycle test; builder journey (below) |
| Mixed Aurora XML | PASS | SQL Server lifecycle test (own element + append) |
| Homebrew replacement and deletion | PASS | SQL Server tests; builder journey: replace swaps the patch, delete restores the element exactly |
| SQL Server rollback safety | PASS | 11/11 on SQL Server 2022 (failures injected at first save, after deletions were saved, at commit); 10/11 fail on the baseline code |

Builder journey on the full Aurora content (`append-builder.py`, the builder API the UI uses): **14/14** — Arcana
is offered to a Fighter only while an append-only file adds the "Fighter" support; a new character picks it and
keeps it after save/reopen and after the file is replaced; overlapping files, repeat uploads and repeat imports add
nothing twice; deleting both files restores the element byte for byte; 14 other characters byte-identical.

## B. Character compatibility

| Item | Result | Evidence |
| --- | --- | --- |
| 2014 rules | PASS | real 2014 characters (Scout-style rogues, Knowledge-style clerics checked by tests); sheets = Aurora |
| 2024 rules | PASS | real characters on 2024 content; 2024 Resilient and Thaumaturge unit tests; 2024 Chain Mail Strength rule (PR G) |
| Multiclass | PASS (unit tests only) | rogue/ranger expertise test; **none of the 14 real files is multiclass** |
| Imported Aurora characters | PASS | 14/14 imported through the dialog, 0 page errors, 0 server errors |
| Existing saved characters | PASS (live) | healed by reprocess on disposable copies, then on a copy of the live database and on live (H) |
| Newly created characters | PASS | created through the builder API; fresh imports |
| Character levelling | PASS (through import) | the import levels characters with the level endpoint (levels 1–6) |
| Character export/import | PASS (backend tests) | portability tests in the backend suite; no browser round trip this session |

## C. Application regression testing

| Area | Result | Evidence |
| --- | --- | --- |
| Character Builder | PASS | imports, builder API journey, page in 3 themes × 2 widths |
| Interactive Character Sheet | PASS | all characters render; matches PDF |
| PDF Export | PASS | values compared with Aurora; files generated for all characters |
| Battle Simulator | PASS (readout + load) | readout (`?model`) for all 19 characters (14 imported + 5 test), every tab opens; Fedra's includes the imported Mace; page in 3 themes × 2 widths |
| Campaign Management | PASS (load + backend tests) | no campaign created or edited in the browser |
| Compendium | PASS | phone overflow fixed (PR E); page in all themes/widths |
| Homebrew | PASS | uploads/replace/delete on SQL Server; page in all themes/widths |
| Lore | NOT VERIFIED (content) | page loads in all themes/widths; the disposable install has no lore data |
| Settings (theme/player dialogs) | PASS | theme switching through the dialog, no reload |
| API | PASS | backend suites; OpenAPI drift test passes |
| Database | PASS | SQL Server tests; fresh migrations; no new migrations in any PR |
| Installer | PASS (unit tests) | 39/39 installer tests on the integrated tree; no Docker installer smoke run |
| Frontend / Backend | PASS | numbers in E |

## D. Visual integration

| Item | Result | Evidence |
| --- | --- | --- |
| Midnight / Porcelain / Slate homepage artwork | PASS | `homepage-branding.mjs` 17/17 (PR build and integrated build) |
| Automatic theme selection | PASS | from `resolvedTheme`; follows the dialog preview; survives reload |
| Universal decorations | PASS | `ornaments.mjs` 65/65; Slate art shows only faintly on the light Slate theme (flagged in PR #11) |
| Responsive layouts | PASS | 320/375/390/768/1024/1440/1920 px; no horizontal overflow (Compendium fixed) |
| Accessibility | PASS (checked aspects) | decorations aria-hidden, not clickable, never cover focused controls; alt text; no automated axe audit |
| Navigation / favicons preserved | PASS | asserted by the branding test |
| No unrelated visual changes | PASS | before/after screenshots of 9 pages × 3 themes × 2–3 widths against the same data |
| Performance | PASS (not benchmarked) | +85 KB WebP for the hero, ≤ 6 small SVGs per theme, only the current theme's load |

## E. Automated testing

| Suite | Result |
| --- | --- |
| Backend, baseline 8adf858 | 817 total, 793 passed, 0 failed, 24 skipped |
| Backend, PR A (in-memory) | 846 total, 811 passed, **0 failed**, 35 skipped (24 pre-existing + 11 SqlServer rows without a server) |
| Backend, PR A `SqlServer` category on SQL Server 2022 | **11/11 passed** (negative control: 10/11 fail) |
| Backend, PR B | 820 total, 796 passed, **0 failed**, 24 skipped |
| Frontend Vitest, baseline | 239 passed, 5 skipped |
| Frontend Vitest, PR B / C / D / E / G | 249 / 246 / 239 / 239 / 239 passed, 5 skipped each, 0 failed |
| TypeScript + production build | pass on every PR and on the integrated tree |
| ESLint | changed files clean; whole repository 38 errors + 1 warning = baseline (pre-existing) |
| Browser: import journey | 14/14 characters, 0 page errors, 0 5xx (three separate installs) |
| Browser: homepage branding | 17/17 |
| Browser: ornaments | 65/65 (integrated build, `ornaments-rerun.out`) |
| Browser: Update from Aurora ×2 | pass |
| PDF files | 19/19 generated (14 imported + 5 test characters), all valid PDF |
| Battle readouts | 19/19, every tab opens |
| Installer unit tests | 39/39 |
| Sheets vs Aurora PDFs | 0 proficiency/expertise differences; remaining differences pre-existing (spell source labels, stack weights, resistance order, one reach range; one PDF a level ahead of its file) |

Commands and logs: `~/.cache/starlights-test/mk2/LEDGER.md` (evidence ledger) and the scripts beside it
(`e2e-setup.sh`, `final-run.sh`, `append-builder.py`, `char-snapshot.py`, `sql-test.sh`); browser scripts in
`tools/frontend/` (`homepage-branding.mjs`, `ornaments.mjs`) and `~/.cache/starlights-test/pw/` (`mk2-e2e.mjs`,
`mk2-update.mjs`).

## F. CI and repository protection

| Item | Result | Evidence |
| --- | --- | --- |
| GitHub Actions functionality | PASS (after PR F) | old `development-build.yml`: 13 runs ever, all manual; push/PR events ignored for that path (exact copy under another name ran). Renamed `ci.yml` runs on pull_request (probe PR #8, PR #9 at d344dd7: green) |
| SQL Server tests inside CI | PASS | run 39279953578 (A+F merged, `ci/verify-sql`): 846 total, 822 passed, 0 failed, 24 skipped; the 11 SqlServer tests ran against the job's SQL Server 2022 service (`STARFALL_REQUIRE_SQLSERVER=1`) |
| Required checks | PASS | ruleset requires "Build & Test Solution" (GitHub Actions) on `aurora-server` |
| Branch protection | PASS | changes only through pull requests (0 approvals; admins may bypass only when merging a PR) |
| Force-push prevention | PASS | ruleset; verified with an identical throwaway ruleset: `Cannot force-push to this branch` |
| Branch deletion prevention | PASS | verified: `Cannot delete this branch` |
| Direct push prevention | PASS | verified: `Changes must be made through a pull request` |
| Secret scanning | PASS | enabled, read back |
| Push protection | PASS (setting) | enabled, read back; not exercised with a test secret |
| Workflow permissions | PASS | `ci.yml`: `contents: read`; repository default read; Actions cannot approve PRs |
| Normal pull request functionality | PASS | feature branches pushed, PRs opened and updated throughout |

## G. Not verified / remaining actions

- Lore content, campaign create/edit in the browser, a real multiclass character, character export/import in the
  browser, an automated accessibility audit, the Docker installer smoke test, Windows.
- Deletion state of custom attacks across re-imports is covered by unit tests, not a browser run.
- CI before merging: manual runs green on A b6d8ec1, B 5a2b079, C 0634cff and D c6ae753; pull-request runs green
  on F 29528b4; E and G were run again after a GitHub Actions incident left their first runs queued, and merged only
  once green. The merged `aurora-server` passed push CI (with SQL Server) before the deploy (H).
- Owner decision left: whether the faint Slate ornaments are acceptable.

## Release readiness

Released as **v0.11.0**. It rests on the disposable-install verification above, CI on the merged code (with SQL
Server), a rehearsal on a copy of the live database and live before/after character snapshots (H).

## H. Live deployment

Deployed 2026-10-20 08:12 EEST with the owner-run release script (`~/.cache/starlights-test/mk2/finish/finish.sh`,
log `finish.log` beside it). Nobody was using the site (requests other than the health check, last 15 minutes).

| Step | Result |
| --- | --- |
| Merges into `aurora-server` | #9 `091e740`, #4 `44b124c`, #5 `2d1b276`, #10 `e274f00`, #6 `1fac04e`, #7 `da8ede5`, #11 `c69600b` |
| CI on the deployed commit `c69600b` | [run 39373071605](https://github.com/CHassapis/Starfall/actions/runs/39373071605): success (push event, with the SQL Server service) |
| Backup before the rehearsal | `starlights-20261020-080603-pre-v0.11.0-rehearsal.bak`, `RESTORE VERIFYONLY` OK |
| Rehearsal on a copy (`starlights_copy`, new build on port 8094) | before reprocess: the new build shows all 11 characters exactly as live does; reprocess: 11 characters: 11 unchanged, 0 got skills/saving throws back, 0 speed corrected only, 0 unexpected |
| Backup before the deploy | `starlights-20261020-081217-pre-v0.11.0.bak`, `RESTORE VERIFYONLY` OK; rollback images `starlights-backend:rollback-8adf858`, `starlights-web:rollback-8adf858` |
| Deploy (API + web; database container untouched, no migrations) | API reports `STARLIGHTS_COMMIT=c69600b`; characters identical before and after the image swap |
| Live reprocess (`starlights-admin.sh reprocess`) | 11 characters: 11 unchanged, 0 got skills/saving throws back, 0 speed corrected only, 0 unexpected; every character ends exactly as in the rehearsal |
| Live checks | home page 200, API 200, ornament `page-corner.svg` 200 (SVG), home art `starfall-midnight.webp` 200 (WebP), background art 200, API log lines at ERR/FTL since start: 12 |

Changes made by the live reprocess, per character:

- (no character changed)

Rollback, if ever needed: `docker tag starlights-backend:rollback-8adf858 starlights-backend && docker tag
starlights-web:rollback-8adf858 starlights-web && docker compose up -d --force-recreate starlights-api starlights-web`
in `~/homelab/compose/starlights`; the reprocess itself is undone only by restoring `starlights-20261020-081217-pre-v0.11.0.bak`.

