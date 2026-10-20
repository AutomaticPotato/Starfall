# Starfall — final handoff (maintenance mode)

**v0.11.1, released and live 2026-10-20** (tag `v0.11.1` on `aurora-server`; live `24fd60b`, the same code;
[release notes](../releases/v0.11.1.md), [final completion report](MK2_FINAL_COMPLETION_REPORT.md)): five fixes
(#13–#18) on top of **v0.11.0** (Starfall Mk2, the same day; [notes](../releases/v0.11.0.md),
[Mk2 report](MK2_VERIFICATION_REPORT.md)). Before that: v0.10.0 public beta (2026-10-16,
[V0_10_0_VERIFICATION.md](V0_10_0_VERIFICATION.md)).

Development is closed; from here: bug fixes and live-play improvements, one small mission at a time
(`docs/ai/DEVELOPMENT_DIRECTIVE.md`). Read this, then only the skill for the subject.

## Where things are
- **Server** (.NET 10, FastEndpoints, EF Core, SQL Server 2022): `src/apps/Starlights.Application/Program.cs`
  (admin-key gate for `/api/elements` writes and `/api/admin`; locked-character gate for `/api/characters/{id}/…`),
  `src/modules/characters` (characters, campaigns, players, rules engine `Services/Processing/RegistrationProcessor.cs`,
  portability `Services/Portability` + `Endpoints/Characters/Portability`), `src/modules/elements` (content:
  `Services/AuroraImporter.cs` Aurora XML → elements with ids derived from Aurora ids; `Services/FiveETools/*` the
  5etools translation layer; homebrew endpoints). Map: skill `starlights-architecture`.
- **Web app** (React/TypeScript/Vite): `src/frontend/apps/builder-app/src` — `pages/*`, `lib/api/*`, pure rules in
  `lib/rules/*` (Vitest). Themes Porcelain/Slate/Midnight (Codex's design system). Guide: `docs/ai/FRONTEND_GUIDE.md`.
- **Storage**: schema `characters` (character + JSON columns inventory/magic/combat/extras/story; components;
  registrations = every builder choice), schema `elements` (content). Skill `starlights-database`.
- **Permissions**: no accounts. Optional player passwords → unlock tokens (`X-Player-Token`); master password →
  admin token; `X-Admin-Key` for content administration; campaign DM passwords. Tests in
  `Starlights.Integration.Tests/Tests/Security/AccessControlEndpointTests.cs`.

## Production (homelab) and the community kit
- **Production**: `~/homelab/compose/starlights` (fixed container names `starlights-db/-api/-web`), data in
  `~/homelab/config/starlights*`, builds from `~/starlights` at `aurora-server`. Public door :8098 (Tailscale Funnel,
  htpasswd), LAN :8093. Deploy, backup, rollback: skill `starlights-deployment` (verified `.bak` first; rollback
  images; web-only `starlights-deploy-web.sh`; full deploy for server changes). Nightly content job and encrypted
  off-site backups run from cron.
- **Community kit** (`deploy/`): `setup.sh` (Linux, WSL2 via `setup.ps1`), `maintenance/{backup,verify,restore,update,
  rollback}.sh`; docs `docs/installation.md`, `docs/maintenance.md`. Not used by the homelab. Linux install, content
  download, update from v0.10.0, backup/verify/restore/rollback verified on disposable installs (2026-10-20); Windows untested.

## Skills (`.claude/skills/`)
architecture · database · deployment · dnd-rules · encounters · homebrew · campaign-ops (session notes, NPCs, places,
quests, magic items — prepare, get approval, then write through the API) · session-handoff. Codex's: `.agents/skills/`.

## Fixing a bug (the usual loop)
1. Reproduce from the report; find the code via the architecture skill + `grep -rn`, not a full read.
2. Worktree + short branch from `aurora-server`; fix; test (backend in the .NET 10 SDK container, web in node:22).
3. Behaviour on data: a disposable install or the test copy — never the live database.
4. Report; on approval merge, push (`mine` only, publish checks), deploy per the deployment skill, verify live.

## Campaign help from notes
Skill `starlights-campaign-ops`: turn the owner's notes into session entries, NPC/place/quest updates or item grants;
show the exact changes; write live data only after approval. Rules and book lookups: skill `starlights-dnd-rules`
(5etools mirror, Compendium of Lore).

## Known limitations
- Character files need the same books (and homebrew) on the importing server; a different content version is refused.
- Saving homebrew errors on an install whose content was never imported (`--skip-content`).
- GitHub Actions: pushes and pull requests now start CI (`.github/workflows/ci.yml`; GitHub ignored every push and pull-request event for the old `development-build.yml` path, though the same file under another name runs; see docs/ai/CI.md); one backend integration test
  (`ReorderElementRulesEndpointTests`) fails intermittently on parallel host start-up.
- The serializer/startup race remains an investigation lead, not a confirmed diagnosis or fix. No CI runs were
  returned for the verified remote baseline. See the release report before making a release-readiness claim.
- Windows/WSL2 install and the PowerShell launcher are unverified on real Windows.
- Licensing open: upstream art in `public/images`, D&D logos on the Aurora sheet templates — the owner decides. The
  background art (`public/art`: lore, battle and the watermarked Tasha homebrew tile picture) was published with the
  owner's approval on 2026-10-16.
