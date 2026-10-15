# Project Starlights
Expanded Aurora-compatible character builder and tabletop companion. Local Git is the source of truth.

## Stack and locations
- React 19, TypeScript, Vite, Tailwind 4, Radix, TanStack Query: `src/frontend/apps/builder-app/src`.
- Shared npm workspaces: `src/frontend/packages/{api-client,ui,ui-framework}`.
- .NET 10 / FastEndpoints / EF Core / SQL Server: `src/apps`, `src/modules`, `src/platform`.
- Docker/nginx packaging: `deploy/`. Never run deployment scripts as a test.

## Commands
From `src/frontend`: `npm run build:packages`, `npm run build -w apps/builder-app`, `npm run test -w apps/builder-app`, `npm run lint`.
From repository root: `dotnet test` (SDK selected by `global.json`). Use a current Node version satisfying installed Vite's engines.

## Conventions and safety
Reuse `lib/api` hooks and `lib/rules` functions; keep rules separate from presentation. Preserve builder Save/Discard snapshots, query invalidation, unlock headers and PDF exports. Use semantic theme tokens and keyboard-accessible controls.
Inspect status, diffs, commits and all worktrees before editing. Work on an isolated branch/worktree. Never reset, stash or overwrite another agent's changes. Homebrew and encounter-calculator work belongs to Claude; coordinate before touching those areas. Do not commit production data, secrets, downloaded books or node_modules. Do not merge, push or deploy without user approval.

## Read only what is relevant
- [Architecture](docs/ai/ARCHITECTURE.md)
- [Frontend](docs/ai/FRONTEND_GUIDE.md)
- [Status](docs/ai/PROJECT_STATUS.md)
- [Decisions](docs/ai/DECISIONS.md)
- [Current handoff](docs/ai/CODEX_HANDOFF.md)
- [Owner engineering directive](docs/ai/DEVELOPMENT_DIRECTIVE.md)
Focused skills live in `.agents/skills/`; load only the relevant subject.
