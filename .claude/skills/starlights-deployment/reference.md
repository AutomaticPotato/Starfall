# Commands

```bash
# secrets, never printed
ENV=~/homelab/compose/starlights/.env
SA=$(grep -E '^STARLIGHTS_SA_PASSWORD=' $ENV | cut -d= -f2-); MASTER=$(grep -E '^STARLIGHTS_MASTER_PASSWORD=' $ENV | cut -d= -f2-)
sql() { docker exec starlights-db /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA" -b -h -1 -W -Q "$1"; }

# backup before a deploy
bak="/var/opt/mssql/backup/starlights-$(date +%Y%m%d-%H%M%S)-pre-<what>.bak"
sql "BACKUP DATABASE starlights TO DISK = N'$bak' WITH COPY_ONLY, INIT, CHECKSUM"; sql "RESTORE VERIFYONLY FROM DISK = N'$bak' WITH CHECKSUM"
docker tag starlights-web:latest starlights-web:rollback-<old>; docker tag starlights-backend:latest starlights-backend:rollback-<old>

# admin token and status
TOKEN=$(curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"password\":\"$MASTER\"}" http://127.0.0.1:8093/api/admin/unlock | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
curl -fsS -H "X-Player-Token: $TOKEN" http://127.0.0.1:8093/api/admin/status   # commit, migrations, counts

# re-import (after an importer change)
cd ~/homelab/scripts; for i in AuroraLegacy.index pull-requests homebrew 5etools starlights; do ./starlights-admin.sh import $i --replace; done; ./starlights-admin.sh reprocess

# character snapshot (before/after must match)
python3 ~/homelab/scripts/starlights-snapshot.py http://localhost:8093/api "$MASTER" > before.json

# every sheet as a PDF through the web app
docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v ~/.cache/starlights-test/pw:/w -w /w \
  mcr.microsoft.com/playwright:v1.55.0-noble node sheet-pdfs.mjs "$TOKEN" http://127.0.0.1:8093 /w/out

# web tests from a worktree $W (node_modules from the main checkout, read-only)
M=~/starlights/src/frontend
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 -v "$W/src/frontend:/w" -v "$M/node_modules:/w/node_modules:ro" \
  -v "$M/apps/builder-app/node_modules:/w/apps/builder-app/node_modules:ro" --tmpfs /w/apps/builder-app/node_modules/.vite:mode=1777 \
  --tmpfs /w/apps/builder-app/node_modules/.vite-temp:mode=1777 -w /w/apps/builder-app node:22-slim npx vitest run
# then remove the empty root-owned mount points: docker run --rm -v "$W/src/frontend:/f" alpine rmdir … node_modules dirs

# rollback (before cleanup)
git -C ~/starlights checkout <old>; docker tag starlights-backend:rollback-<old> starlights-backend; docker tag starlights-web:rollback-<old> starlights-web
docker compose up -d --force-recreate starlights-api starlights-web   # database: restore the .bak only if needed
```
Nightly at 03:30 (`starlights-nightly.sh`: pulls and imports content) and off-site backup at 05:15 run from cron;
don't overlap a `--replace` import with 03:30.
