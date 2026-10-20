# Starfall Mk2 — final completion report

2026-10-20, Claude (session 0a6fe6db). Mission: the owner's "Starfall Mk2 — Final completion, verification & release
readiness" brief. Baseline: `aurora-server` **b409275** (v0.11.0 = live **c69600b** + the Mk2 report). Earlier
evidence: [MK2_VERIFICATION_REPORT.md](MK2_VERIFICATION_REPORT.md). Commands and raw results for everything below:
`~/.cache/starlights-test/mk2final/LEDGER.md` on the homelab (scripts beside it and in `~/.cache/starlights-test/pw/`).

## 1. Verdict: **DONE FOR LINUX — WINDOWS UNTESTED** (updated 2026-10-20 after the deploy, see §8)

v0.11.0 works for regular live play: every area was exercised on disposable installs with the owner's real Aurora
characters, and no release-blocking defect was found in what is live. This mission found and fixed **five real
defects** (pull requests #13–#18, all with green CI). The owner merged them with this report and deployed them the
same day: live is **`24fd60b`** (§8). Windows (Docker Desktop/WSL2, the PowerShell launcher) cannot be verified
here, so that path stays "untested".

When this report was written the fixes were not merged yet, and the verdict was "partially — not fully verified".

## 2. Work

Already complete (Mk2 v0.11.0, merged and live): append-import transaction safety (#4), skill proficiencies (#5),
empty Aurora attack ids (#6), homepage art (#7), ornaments (#11), CI + protection (#9), import ability order (#10).

Finished in this mission (base `b409275`; each merges cleanly alone and all together):

| PR | Branch | What | Severity | Deploy |
| --- | --- | --- | --- | --- |
| [#13](https://github.com/CHassapis/Starfall/pull/13) | `fix/companion-proficiency-log` | familiars' `companion:proficiency` no longer logged as an error (12 ERR lines on live) | low (logs) | API; merged + live (§8) |
| [#14](https://github.com/CHassapis/Starfall/pull/14) | `fix/multiclass-spellcasting-grant` | 2014 Wizard multiclassed with another caster got each class's slots added (W3/C1: 6+2) instead of the multiclass table (4/3) | medium (wrong sheet/PDF/Magic tab) | API |
| [#15](https://github.com/CHassapis/Starfall/pull/15) | `fix/a11y-compendium-battle-labels` | axe: Compendium filters had no accessible name (critical), battle use-pips aria misuse (serious) | low | web |
| [#16](https://github.com/CHassapis/Starfall/pull/16) | `deps/npm-audit-fix` | Dependabot 59 → 9 alerts (0 critical); only runtime change react-router 7.18.1 → 7.18.4 | low (tooling) | web |
| [#17](https://github.com/CHassapis/Starfall/pull/17) | `fix/maintenance-relative-backup-path` | `verify.sh`/`restore.sh` with a relative folder from outside `deploy/` failed, error lost the name | low (community kit) | none (scripts) |
| [#18](https://github.com/CHassapis/Starfall/pull/18) | `fix/portability-builtin-elements` | character import refused **every** character between two independent servers (built-in elements have per-server ids) | high for that feature | API |
| this PR | `docs/mk2-final-completion` | this report, handoffs, status, installation validation, 3 browser-tool fixes | — | none |

## 3. Feature verification matrix (all on disposable installs; never production)

| Area | Result | Evidence |
| --- | --- | --- |
| Aurora import (14 real files) | PASS | browser dialog, 14/14, 0 page errors; vs Aurora's own PDFs: 0 proficiency/expertise differences (known: stack weights, spell source labels, resistance order) |
| Homebrew append lifecycle | PASS | `append-builder.py` 14/14 on the release tree (a first 13/14 was the script reading 2 s after a pick while another build ran; state was right) |
| SQL Server rollback safety | PASS | `SqlServer` category 11/11 on SQL Server 2022 (failures before save, after deletions, while committing, rebuilding targets) |
| File atomicity | documented limit | `APPEND_FINAL_VERIFICATION.md`: "not crash-proof", recovery steps; no stronger claim made |
| Skill proficiencies / expertise | PASS | API, interactive sheet and PDF; expertise double marks rendered (Vesper, 50 COIN) |
| PDF export | PASS | all characters downloaded in the browser, rendered page by page (poppler): stats, saves, skills, attacks, portrait, inventory, spell pages; spells listed twice = Aurora's own PDF (2014+2024 printings) |
| Multiclass | PASS after #14 | Wizard 3/Cleric 1 both editions vs hand calculation: HP 27, 3d6+1d8, PB, saves, DCs, AC; slots wrong only on 2014 → #14 |
| Builder: create, level, spells, preparation, rests, HP | PASS | Codex's `workflows.mjs` + `play-checks.mjs` (adapted to this install): 3 characters, cast, slots, prepare/unprepare, short/long rest, Second Wind |
| Custom attacks | PASS | `custom-attacks.mjs` (never run before; stale route fixed) 320/390/1440; real API: imported Mace deleted, "Update from Aurora" ×2 → stays deleted |
| Battle simulator | PASS | readouts for 27 characters (0 problems); campaign fight: initiative, turns, damage (bloodied), conditions, persistence, player view hides monster HP |
| Encounter difficulty / CR | PASS | 4 Goblin Warriors vs L4+L5: 2014 "Easy 500 adjusted XP", 2024 "Low, budgets 750/1125/1600" = 5etools' own tables |
| Campaigns | PASS | browser: non-admin DM creates, sessions (revealed/hidden), DM and party notes, party, campaign password; player sees only revealed content; player API writes 403, wrong DM password 401 |
| Export / import | PASS same server; **FAIL between servers → fixed in #18** | round trip identical apart from per-copy ids; across two servers refused before #18, identical after |
| Compendium, Lore, search, filters | PASS | real Compendium of Lore built from 5etools v2.38.0; search + level/school filters, source filter |
| Homepage art, theme switching | PASS | `homepage-branding.mjs` 17/17 (release build and #16 build) |
| Ornaments, responsive | PASS | `ornaments.mjs` 65/65 (320–1440 px, 3 themes, switching without reload) |
| Accessibility | PASS for checked aspects | `accessibility.mjs`; axe-core WCAG 2.1 A/AA: 2 findings fixed (#15), 2 left (Slate chip contrast 4.42, nested card controls) |
| Installer (Linux) | PASS | `docker_smoke.py` (isolated project): install, repeat keeps credentials + data, recovery; a fresh `setup.sh` **with** content download (Aurora + 5etools from GitHub) in 1m40s, then 14 real characters imported (from a clone with one test-only commit binding the site to 127.0.0.1, because the default port is live's) |
| Update / backup / rollback / restore | PASS | GitHub clone at v0.10.0 (+ the same 127.0.0.1 test-only commit) + real content + 14 characters → `update.sh` → reprocess heals the 8 v0.10.0 skill-less characters → `verify.sh --deep` → `rollback.sh` → `restore.sh` (byte-identical to before) → update again (byte-identical) |
| Windows | NOT VERIFIED | no Windows host |
| Live (before the deploy) | healthy | `c69600b`, 0 5xx, only the 12 companion ERR lines (#13); after it see §8 |

## 4. Tests

| Suite | Result |
| --- | --- |
| Backend, release tree b22fe63 (= b409275 + #13), SQL Server | 853 total, 0 failed, 24 skipped |
| Backend, merged set (#13–#18 on b409275) | 859 total, 0 failed, 24 skipped (SQL Server); frontend build + Vitest 256 passed, 5 skipped |
| Characters tests per fix | #13 326/326, #14 324/324, #18 325/325; Elements (#14) 220 passed, 8 skipped |
| Frontend (Vitest) | 256 passed, 5 skipped (release, #15, #16); TypeScript + production build pass |
| ESLint | changed files clean; repository 38 errors + 1 warning (pre-existing, unchanged) |
| Installer unit tests | 39/39 |
| shellcheck (maintenance scripts) | 2 pre-existing notes, unchanged |
| CI (pull_request, "Build & Test Solution" incl. SQL Server) | #13–#18 green on their heads; this PR green before merging (required check) |

## 5. Remaining problems

| Problem | Severity | Blocks release? |
| --- | --- | --- |
| ~~#13–#18 not merged/deployed~~ | resolved: merged and live `24fd60b` (§8) | — |
| Windows install path unverified | unknown | no (documented as untested) |
| Builder: an edit in the first seconds after levelling (while the save snapshot waits for processing) is not undone by Discard | low | no |
| Resistance order can differ from Aurora's ("Radiant, Necrotic") | cosmetic | no |
| Slate destructive chip contrast 4.42:1; Characters cards nest controls | a11y, minor | no |
| 9 npm advisories need shadcn CLI / typography majors (build tooling only) | low | no |
| `--skip-content` + manual `admin.sh import` needs `/api/elements/initialize` first (the documented Content-page path does it) | low | no |
| Two Aurora files share the name "Barry McKockiner" (levels 3 and 5) | data, not code | no |

## 6. Repository and deployment readiness

- GitHub: rulesets active (no force push/deletion; PR + "Build & Test Solution"); secret scanning + push protection on,
  0 open alerts; gitleaks over 712 commits: 1 false positive (prose); Actions read-only.
- Merged set: all six PR heads merge onto `b409275` without conflicts; backend 859/0 failed/24 skipped, frontend
  build and Vitest pass. On one copy of the test database (33 characters, incl. the real ones and imported copies)
  the merged code reads every character byte-identically to the released code (skills, saves, registrations,
  statistics, inventory); the only change is #14's: the four 2014 Wizard/Cleric characters' Wizard spellcasting
  now counts as a full caster (slots 4/3). API error lines on the merged code: 0.
- Production was untouched while verifying (live `c69600b`); the owner then merged and deployed the set (§8).

**Merge and deploy order** (both steps run by the owner on 2026-10-20, results in §8):
1. `bash ~/.cache/starlights-test/mk2/companion/go.sh` — merges #13 and deploys the API (already approved).
2. `bash ~/.cache/starlights-test/mk2final/finish2.sh`: refuses unless
   step 1 is live and nothing else changed; merges #14, #18, #15, #16, #17 and this PR only if each head is the
   tested commit and CI passed; then a verified backup, rollback images for API and web, one API + web rebuild, and
   a strict before/after comparison of every live character (`starlights-snapshot.py`: choices, statistics,
   abilities, saves, skills), rolling back on any difference. #14 changes only the spellcasting slots of 2014
   Wizard multiclass characters, which that comparison does not read, and the merged-set check showed everything
   it does read unchanged. No migration, no reprocess.

## 7. Recommendation

Starfall Mk2 is done for Linux: #13–#18 and this report are merged and live (`24fd60b`). Windows stays "untested"
until someone runs `setup.ps1` on a real Windows machine. The five fixes are released as **v0.11.1** (2026-10-20,
[notes](../releases/v0.11.1.md); the tag is on the merge of the PR that added §8, whose code is identical to live
`24fd60b`).

## 8. Live results (2026-10-20, after the merge)

Both steps of §6 were run by the owner; the logs are `~/.cache/starlights-test/mk2final/finish2.log` and the
before/after snapshots beside it and in `~/.cache/starlights-test/mk2/companion/`.

| Step | Result |
| --- | --- |
| `go.sh` (12:31) | #13 merged (`0dea987`), API rebuilt; rollback image `starlights-backend:rollback-c69600b`; every character identical before/after |
| `finish2.sh` merges (12:33) | #14, #18, #15, #16, #17, #19 merged at their tested heads; `aurora-server` = `24fd60b` |
| Quiet-site gate | players on the site: waited 25 minutes, then continued |
| Backup (12:58) | `starlights-20261020-125832-pre-24fd60b.bak`, `RESTORE VERIFYONLY` valid; rollback images `starlights-{backend,web}:rollback-0dea987` |
| Deploy (12:59) | API + web rebuilt from `24fd60b`, no migration, no reprocess; API reports `24fd60b` |
| Characters | all 11 live characters identical before/after (`starlights-snapshot.py`: choices, statistics, abilities, saves, skills) |
| Pages | home, API, Compendium 200; API ERR/FTL lines 0 right after the deploy and still 0 at 20:17 |
| #14 on live | no live character is a multiclass caster, so it changes nothing there today (read-only check of every character's spellcasting at 20:17; single-class Wizard 6 shows 4/3/3, the correct table). The fix itself is proven on the test copy (§6), not on live |
| CI on `aurora-server` | the push run for `005be01` (all code: #13–#18) passed; the run for `24fd60b` (adds this report and 3 browser-tool scripts) was cancelled by the workflow's concurrency setting. The pull request that adds this section runs CI on top of `24fd60b` |

Rollback, if ever needed: `docker tag starlights-backend:rollback-0dea987 starlights-backend && docker tag
starlights-web:rollback-0dea987 starlights-web`, then `docker compose up -d --force-recreate starlights-api
starlights-web` in `~/homelab/compose/starlights`; the database needs nothing (no migration).
