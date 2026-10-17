# Append-only homebrew upload fix

2026-10-16. Owner requested this fix after testers received HTTP 400 for valid append-only Aurora files.
Branch: `fix/homebrew-append-upload`; isolated worktree `/home/chassapis/starfall-append-fix`.
Base: `29bec01` (includes the locally committed Starfall/custom-attacks work). No other worktrees were edited.
This explicitly requested homebrew fix is separate from the earlier homebrew workshop work owned by Claude.

## Changes

- Upload validation accepts `<elements>` containing definitions, append patches, or both. Missing/blank IDs and malformed definitions get actionable messages. Files still need a single `<elements>` root.
- Homebrew imports include append targets defined outside the homebrew folder. A marker in stored Aurora XML identifies previously patched targets; replacement, retargeting and deletion rebuild those targets from source while retaining remaining patches. IDs and source ownership remain unchanged. No schema migration.
- File upload/delete uses the existing homebrew write gate. Delete refreshes remaining patches after removing the file's definitions.
- Missing targets produce warnings instead of silently suggesting every patch applied. Files list their target IDs. The UI explains root structure, replacing a file and the fact that patches affect their targets' original source books. Upload errors include the filename and readable validation guidance instead of raw HTTP/JSON.
- README and the additive listing API schema updated. Existing API routes, credentials, configuration and visual design remain unchanged.

## Verification

- Frontend Vitest: **239 passed, 5 skipped**, 28 passing test files, one optional fixture suite skipped. Three new tests cover upload error presentation.
- Builder TypeScript 7.0.2 check and Vite production build passed. Targeted ESLint passed. Existing large-bundle warning remains.
- Added 11 validation/listing cases and two importer regressions, including first import, existing external targets, duplicate import, missing target warning, stable IDs, retargeting, deletion and preserving another file's patches.
- **Backend tests/build could not run:** no host .NET SDK; Docker API access denied at `/var/run/docker.sock`. These new backend tests are not claimed as passing. Browser execution remains unavailable under the session's socket/Chromium restrictions documented in STARFALL_HANDOFF.md.
- Logs: `/tmp/starfall-append-{tests,types,lint,build}.log`. Frontend dependencies reused temporarily from the existing checkout. The shared `.bin/tsc` is obsolete; use `node_modules/@typescript/typescript-linux-x64/lib/tsc -b apps/builder-app --force` from `src/frontend`, as in the prior handoff.

## Remaining release gates

1. In a .NET 10 development environment, run the Elements test project (including `HomebrewUploadXmlTests` and `AuroraImporterAppendTests`) and build `src/apps/Starlights.Application`. Regenerate/check the OpenAPI snapshot.
2. Against a disposable API/database, import synthetic base content; upload an append-only file through the UI, then repeat, replace and delete it. Check supports/rules and stable target IDs after every step. Verify missing-target warning, malformed XML feedback, admin restrictions and mobile rendering. Do not use production characters or content.
3. Push/integrate after verification and fetch/review current remote changes first. This fix depends on the unpushed Starfall branch; do not silently deploy either branch. No deployment was authorized or performed.

Implementation commit: `04ca66c`. The original shell push failed with `Could not resolve host: github.com`.

## Resume — 2026-10-17

The GitHub connector is available even though shell DNS and local backend tooling remain unavailable. Remote `aurora-server` is `b3008b8bb0e2c08271789d124e8195dd4f942064` (PR #2 merged the rebrand/custom-attacks branch). Its tree `d65eb90e2a5deb63619c420b65a2bb63bde8ee92` exactly matches local baseline `29bec01`; those dependencies are now integrated. The repository is still `CHassapis/starlights`.

Publish the 13-file append fix on a separate review branch through the connector, then open a draft PR to run the existing build/test workflow. This workflow contains no deployment job. Connector-created commits have different IDs from the preserved local implementation commits; verify the published tree matches the local tree. Backend and browser results remain unverified until their checks actually run. No merge, repository rename or deployment is part of this follow-up.
