# Starlights — Claude notes

Starlights is an Aurora-compatible D&D 5e character builder and table companion (fork of swdriessen/starlights,
branch `aurora-server`, published to `mine` = github.com/CHassapis/starlights; never push to `origin`). It runs in
Docker on the homelab server (`~/homelab/compose/starlights`, site :8093, public door :8098 via Tailscale Funnel).

## Session start (in this order, stop when you know enough)
1. `git status`, `git branch --show-current`, `git worktree list` — other agents work in parallel.
2. Current task: [docs/ai/CLAUDE_HANDOFF.md](docs/ai/CLAUDE_HANDOFF.md). Codex's: `docs/ai/CODEX_HANDOFF.md`.
3. Shared maps (Codex wrote them; on `aurora-server` once `codex/frontend-modernisation` is merged, until then
   `git show codex/frontend-modernisation:docs/ai/ARCHITECTURE.md`): `AGENTS.md`, `docs/ai/ARCHITECTURE.md`,
   `FRONTEND_GUIDE.md`, `DECISIONS.md`, `PROJECT_STATUS.md`.
4. Load only the skill for the subject: `.claude/skills/starlights-*` (homebrew, encounters, dnd-rules, database,
   deployment, architecture, session-handoff).
5. Search for the symbol you need (`grep -rn`), read that range. Don't reread whole directories or large files.

## Ownership (parallel agents)
- Claude: homebrew, encounter difficulty / CR, their backend integration, homelab deployment and backups.
- Codex (`~/starlights-frontend`, branch `codex/frontend-modernisation`): themes, navigation, spell selection,
  interactive sheet, battle simulator visuals, readability. Don't edit those files; if a shared component must
  change, note it in CLAUDE_HANDOFF.md under "Coordination" instead.
- Work in a worktree on its own branch. Never reset, stash or overwrite another agent's changes.

## Build and test (Docker; the host has Node 18 and no dotnet)
- Server: `docker run --rm -v "$W:/src" -v starlights-nuget:/root/.nuget/packages -w /src mcr.microsoft.com/dotnet/sdk:10.0 dotnet test src/modules/characters/Modules.Characters.Tests`
  (also `Modules.Elements.Tests`; `dotnet build src/apps/Starlights.Application` compiles everything). Chown bin/obj back afterwards.
- Web: node:22-slim with `~/starlights/src/frontend/node_modules` mounted read-only — exact command in the
  `starlights-deployment` skill. `docker build -f deploy/frontend.Dockerfile <worktree>` is the real type check.
- Behaviour on real data: the test copy (`~/homelab/scripts/starlights-test-copy.sh`), never live.

## Protected
- Live database (`starlights` in container `starlights-db`), `~/homelab/config/starlights*`, `compose/starlights/.env`,
  backups in the mssql volume `backup/` folder and the off-site backup config in `~/.config/starlights-backup`.
- No push, merge or deploy without the user's go-ahead in this session. Push only `aurora-server`, after the
  publish checks (see deployment skill). Book text, character files and secrets never go into git.

## Decisions worth knowing (details in the skills)
- Tokens are signed over the current password; access checks go through `PlayerAccess` (`CanActAsAsync`, `IsDm…`).
- Inventory/combat writes take `ICharactersRepository.LockAsync`; trades and gifts also update open builder snapshots.
- Content changes from the importer need `--replace` imports + reprocess, only while nobody plays.
