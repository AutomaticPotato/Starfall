# Starfall rebrand and Custom Attacks handoff

2026-10-16. Branch `feature/starfall-custom-attacks`, isolated worktree `/home/chassapis/starfall-work`, based on local `aurora-server` at `b4d3e6b`. The owner authorized implementation, commit, push and repository rename after verification; production deployment is prohibited.

## Implemented

- Equipment → Custom Attacks: create, edit, confirm deletion, keyboard-accessible up/down ordering; pending controls, length limits and failed-save retry retain the draft. Uses existing inventory revision/conflict handling and builder snapshots. The shared Equipment view also appears in the interactive sheet.
- Additive inventory JSON fields: custom attack `edited` and inventory `removedAttackIds`. Aurora updates unedited rows by stable ID, keeps manual changes/order and suppresses deleted IDs. Existing IDs, attack figures, equipment slots and attack consumers remain intact. No schema migration. Old clients omitting custom attacks/deletion metadata preserve it; existing true edit markers survive older client writes.
- Shared sheet/PDF and Battle data tests cover changed figures and deletion. Backend tests cover metadata serialization, old-client compatibility, validation and portable exports. API docs/schema updated; live schema regeneration remains to be verified.
- Starfall display branding, HTML/PDF/API metadata, installer messages, documentation and fork URLs. Original Project Starlights, Bas Driessen and Aurora credits retained. Artwork, favicon, CSS/themes and Compose file are byte-for-byte unchanged. Namespaces, routes, source IDs, packages, settings, filenames, `.starlights.json` format and Docker names stay compatible. PowerShell's existing default checkout path remains compatible; documentation supplies explicit new clone paths.

## Verification completed

- Workspace package builds and showcase/landing/content-manager bundles passed. The standard builder command initially failed: the shared `.bin/tsc` points at TypeScript 5.8.3, incompatible with `ignoreDeprecations: "6.0"`. Found the already installed native TypeScript 7.0.2 at `src/frontend/node_modules/@typescript/typescript-linux-x64/lib/tsc`; direct `tsc -b src/frontend/apps/builder-app --force` passes, followed by a separate Vite build. No repository configuration was weakened or shared dependency changed. Existing large-bundle warnings remain. A broader native 7.0.2 build across all workspaces reports one pre-existing TS6133 unused `React` import in unchanged `packages/ui-framework/src/components/ui/scroll-area.tsx`; the builder check passes independently.
- Frontend: **236 passed, 5 skipped**, 27 passing files and one optional fixture file skipped.
- Installer: **39 passed** (`python3 -m unittest discover -s deploy/installer-tests -p 'test_*.py'`). Deployment scripts were not run.
- ESLint passes for new editor/helpers/tests and updated battle regression test. Full repository lint was not rerun; known baseline lint debt is outside this change.
- `git diff --check`, browser harness syntax check, protected-asset/config/migration diff checks passed.
- Logs: `/tmp/starfall-{packages,build,build-final,typecheck,typecheck-all,vite,tests,installer,lint}.log`. Node 24.21.0 from `/home/chassapis/starlights-frontend/.tooling/bin`. Dependency directory reused temporarily from the original checkout; do not commit node_modules.

## Blockers and required next session

1. **Backend checks blocked:** no host `dotnet`; read-only `docker version` fails with permission denied on `/var/run/docker.sock`. Run .NET 10 build and tests in a development environment with SDK or isolated Docker access. Run the character suite, portability tests, inventory endpoint tests, builder Save/Discard and OpenAPI contract check. Never use production SQL or containers.
2. **Browser checks blocked:** Vite listen on `127.0.0.1:55162` fails `EPERM`; Chromium exits at `sandbox_host_linux.cc:41` with `shutdown: Operation not permitted`. `tools/frontend/custom-attacks.mjs` is prepared and syntax checked, but **not executed**. In a browser-capable environment start isolated Vite on 55162; run it with `PLAYWRIGHT_MODULE=/home/chassapis/.cache/starlights-test/pw/node_modules/playwright/index.mjs`. It intercepts synthetic APIs and covers 320/390/1440px edits, failure/retry, keyboard ordering and delete/reload. Also verify real disposable API Save/Discard, Aurora reimport, interactive sheet and PDF download. No visual or end-to-end pass is claimed.
3. **GitHub blocked:** Git cannot resolve `github.com`; `gh auth status` reports invalid credentials for CHassapis. Restore network/DNS and authenticate an account with repository administration permission. No callable connected GitHub repository-rename action is available here.

## Finish after verification

- Inspect all worktree statuses and fetch the latest fork branch. Preserve concurrent work; merge this feature branch into the then-current `aurora-server` without resetting or force-pushing. Rerun checks if integration changes code.
- Push the verified branch/integration. Rename the existing `CHassapis/starlights` repository to `CHassapis/starfall` via repository settings or `gh repo rename starfall --repo CHassapis/starlights --yes`; do not create a replacement repository. Confirm releases, tags, branches and history remain and default branch is `aurora-server`.
- Only after successful rename, set the shared fork remote: `git remote set-url mine https://github.com/CHassapis/starfall.git`. Leave `origin` pointing at `swdriessen/starlights`. Confirm remote HEAD/default branch and read back the pushed commit.
- No deployment, force push, production operation, repository rename or remote rewrite was performed in this session. Rename deliberately waits for the outstanding verification. The local `aurora-server` and all other worktrees were left intact.
