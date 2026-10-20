# Starfall Mk2 — final completion report

2026-10-20, Claude (session 0a6fe6db). Mission: the owner's "Starfall Mk2 — Final completion, verification & release
readiness" brief. Baseline: `aurora-server` **b409275** (v0.11.0 = live **c69600b** + the Mk2 report). Earlier
evidence: [MK2_VERIFICATION_REPORT.md](MK2_VERIFICATION_REPORT.md). Commands and raw results for everything below:
`~/.cache/starlights-test/mk2final/LEDGER.md` on the homelab (scripts beside it and in `~/.cache/starlights-test/pw/`).

## 1. Verdict: **PARTIALLY — NOT FULLY VERIFIED**

v0.11.0 works for regular live play: every area was exercised on disposable installs with the owner's real Aurora
characters, and no release-blocking defect was found in what is live. This mission found and fixed **five real
defects** (pull requests #13–#18, all with green CI, none merged); until they are merged and deployed, the released
code still has them. Windows (Docker Desktop/WSL2, the PowerShell launcher) cannot be verified here. Hence
"partially", not "yes".

## 2. Work

Already complete (Mk2 v0.11.0, merged and live): append-import transaction safety (#4), skill proficiencies (#5),
empty Aurora attack ids (#6), homepage art (#7), ornaments (#11), CI + protection (#9), import ability order (#10).

Finished in this mission (base `b409275`; each merges cleanly alone and all together):

| PR | Branch | What | Severity | Deploy |
| --- | --- | --- | --- | --- |
| [#13](https://github.com/CHassapis/Starfall/pull/13) | `fix/companion-proficiency-log` | familiars' `companion:proficiency` no longer logged as an error (12 ERR lines on live) | low (logs) | API; **owner-approved, `go.sh` ready** |
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
| Installer (Linux) | PASS | `docker_smoke.py` (isolated project): install, repeat keeps credentials + data, recovery; a fresh `setup.sh` **with** content download (Aurora + 5etools from GitHub) in 1m40s, then 14 real characters imported |
| Update / backup / rollback / restore | PASS | GitHub clone at v0.10.0 + real content + 14 characters → `update.sh` → reprocess heals the 8 v0.10.0 skill-less characters → `verify.sh --deep` → `rollback.sh` → `restore.sh` (byte-identical to before) → update again (byte-identical) |
| Windows | NOT VERIFIED | no Windows host |
| Live | healthy | `c69600b`, 0 5xx, only the 12 companion ERR lines (#13) |

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
| CI (pull_request) | #13–#17 green; #18 and this PR: see the PR pages |

## 5. Remaining problems

| Problem | Severity | Blocks release? |
| --- | --- | --- |
| #13–#18 not merged/deployed | the defects above stay live until then | yes, for "done" |
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
- Production is untouched by this mission; live is `c69600b`.

**Merge and deploy order** (owner's approval per step):
1. `~/.cache/starlights-test/mk2/companion/go.sh` — merges #13 and deploys the API (already approved; its strict
   before/after character comparison holds only while nothing else is merged first).
2. #14 and #18 (API), #15 and #16 (web), #17 (community kit only), this docs PR — then one API + web deploy.
   #14 changes the sheet's slots for 2014 Wizard multiclass characters only; nothing needs a reprocess.

## 7. Recommendation

Not finished yet, but close: merge #13 first (`go.sh`), then #14–#18 and this PR, deploy API + web once, and
Starfall Mk2 is done for Linux. Windows stays "untested" until someone runs `setup.ps1` on a real Windows machine.
