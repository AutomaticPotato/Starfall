---
name: starlights-deployment
description: Load before testing Starfall against real data, deploying it to the homelab, rolling back or publishing to GitHub. Covers the test copy, the deploy routine (backup, rollback images, build, content re-import), live checks and the publish checks.
---

# Starfall deployment (homelab)

Live = `~/homelab/compose/starlights` (containers `starlights-web`, `starlights-api`, `starlights-db`); it builds
from `~/starlights` at whatever `aurora-server` points to. Nothing is tried on live first.

1. **Test copy** — `~/homelab/scripts/starlights-test-copy.sh refresh` (backs up live, restores it as
   `starlights_copy`), `up` (API :8094 built from `~/starlights`), `web` (:8097), checks `compare`,
   `compare-magic`, `compare-sheet`, `battle-check`, then `down`. It builds from `~/starlights`, so fast-forward the
   local `aurora-server` to your branch first (not pushed, can be undone with `git reset --keep`).
2. **Deploy** (needs the user's go-ahead): commands in [reference.md](reference.md).
   - check for active players (requests from `100.x` Tailscale addresses in `docker logs --since 20m starlights-web`);
     `172.24.0.1` is the server itself (your own scripts);
   - verified backup (`BACKUP … WITH CHECKSUM` + `RESTORE VERIFYONLY`), tag rollback images;
   - `STARLIGHTS_COMMIT=$(git -C ~/starlights rev-parse --short HEAD) docker compose build -q`, then
     `docker compose up -d --force-recreate starlights-api starlights-web` (plain `up -d` may keep an old web image);
   - importer changed → `--replace` imports (AuroraLegacy.index, pull-requests, homebrew, 5etools, starlights) +
     `reprocess`, only with nobody playing (a replace during play broke a level-up);
   - checks: version via `/api/admin/status`, character snapshot before/after (`starlights-snapshot.py`),
     sheets (`~/.cache/starlights-test/pw/sheet-pdfs.mjs`), public door still 401.
3. **Publish**: run the checks from `~/homelab/scripts/starlights-publish.sh` (everything before `user=`), then
   `git push mine aurora-server` only — the script itself pushes every branch. The repo is public: commit messages
   factual, no exploit recipes, no book text.
4. **Afterwards**: remove test leftovers (`starlights_copy`, test `.bak`, `:test` images), update the handoff
   artifact (https://claude.ai/artifact/5HcNLHRWQapfCiNuK66gnT — read it first, other sessions edit it) and
   `docs/ai/CLAUDE_HANDOFF.md`.

Web-only changes (nothing outside `src/frontend`) can use `~/homelab/scripts/starlights-deploy-web.sh [branch]`.
