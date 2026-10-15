#!/usr/bin/env bash
# Puts a backup made by backup.sh back into this install: the database AND the portraits/homebrew/art folders.
# Everything there now is replaced, so it is careful:
#   1. checks the backup (checksums; --deep test restore unless --skip-deep-check)
#   2. refuses a backup made by newer code (database migrations this code doesn't know) or a newer SQL Server
#   3. asks you to type the install's name (or --confirm NAME)
#   4. makes a safety backup of what is there now (label pre-restore); stops if that fails
#   5. stops the web app and the API, restores the database (SQL Server RESTORE ... WITH REPLACE, CHECKSUM),
#      moves the current folders aside to deploy/data/.before-restore-<time>/ (nothing is deleted) and unpacks
#      the backup's folders
#   6. starts everything (the code applies any newer migrations to the restored database) and checks that the
#      characters, campaigns, players, content and files match the backup
#
#   deploy/maintenance/restore.sh BACKUP_FOLDER [--confirm NAME] [--skip-deep-check]
#
# It never runs by itself, and it only restores into the install in this deploy folder.
source "$(dirname "$0")/lib.sh"

backup="" confirm="" deep=true
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm) confirm="${2:?--confirm needs the install name}"; shift 2 ;;
    --skip-deep-check) deep=false; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    -*) die "unknown option: $1" "Run with --help to see the options." ;;
    *) backup="$1"; shift ;;
  esac
done
[ -n "$backup" ] || die "say which backup to restore." "Backups: ls $BACKUP_ROOT     then: deploy/maintenance/restore.sh $BACKUP_ROOT/<folder>"
require_install
backup=$(cd "$backup" 2>/dev/null && pwd) || die "no such backup folder: $backup"

step "1. Checking the backup"
if $deep; then "$MAINT_DIR/verify.sh" "$backup" --deep; else "$MAINT_DIR/verify.sh" "$backup"; fi

step "2. Checking it fits this version of Starlights"
require_db_running
known=$(code_migrations HEAD)
newer=$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["migrations"]))' "$backup/manifest.json" | grep -vxF -f <(printf '%s\n' "$known") || true)
[ -z "$newer" ] || die "this backup comes from a NEWER version of Starlights (its database has changes this code does not know):
$(printf '%s\n' "$newer" | sed 's/^/  /')" "Update the code first (git pull, or check out the version the backup came from: $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["code_commit"])' "$backup/manifest.json")), then restore."
bver=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sql_server_version"])' "$backup/manifest.json")
cver=$(sql_server_version)
[ "${bver%%.*}" -le "${cver%%.*}" ] || die "the backup was made by SQL Server $bver, newer than this one ($cver); it cannot be restored here." "Use the SQL Server image the backup came from."
older=$( { printf '%s\n' "$known" | grep -vxF -f <(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["migrations"]))' "$backup/manifest.json") || true; } | grep -c . || true)
say "ok: SQL Server $bver -> $cver; $([ "$older" -gt 0 ] && echo "the code will apply $older newer database change(s) after the restore" || echo "same database version as the code")"

project=$(project_name)
python3 - "$backup/manifest.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1])); c = m["counts"]
print(f"\nRestore the backup made {m['created']} (code {m['code_commit']}):")
print(f"  characters {c.get('characters')}, campaigns {c.get('campaigns')}, players {c.get('players')}, content elements {c.get('elements')}")
print("  " + ", ".join(f"{k}: {v['files']} files" for k, v in m["folders"].items()))
PY
db_exists && now=$(db_counts | tr '\n' ' ') || now="(no database yet)"
say "What is there now (will be replaced): $now"
confirm_typed "$project" "This REPLACES the database, portraits, homebrew and art of the install '$project' with the backup.
The site goes offline for a few minutes. A safety backup of the current state is made first." "$confirm"

stamp=$(date +%Y%m%d-%H%M%S)
safety=""
if db_exists; then
  step "3. Safety backup of what is there now"
  "$MAINT_DIR/backup.sh" --label pre-restore || die "the safety backup failed, so nothing was restored." "Fix what the backup reported (disk space?) and try again."
  safety=$(newest_backup)
fi

step "4. Stopping the web app and the API"
dc stop starlights-web starlights-api >/dev/null
restore_failed() {
  printf '\nSTOPPED during the restore.\n' >&2
  [ -n "$safety" ] && printf 'What was there before is in the safety backup: %s\nTo go back to it: deploy/maintenance/restore.sh %s\n' "$safety" "$safety" >&2
  [ -d "$DATA_DIR/.before-restore-$stamp" ] && printf 'The folders that were there before are in %s\n' "$DATA_DIR/.before-restore-$stamp" >&2
  printf 'The web app and API are stopped; start them with: docker compose up -d\n' >&2
}
trap restore_failed ERR

step "5. Restoring the database"
inner="$CONTAINER_BACKUP_DIR/starlights-restore-$stamp.bak"
dc exec -T starlights-db mkdir -p "$CONTAINER_BACKUP_DIR"
dc cp "$backup/database.bak" "starlights-db:$inner" >/dev/null
dc exec -T -u 0 starlights-db chown mssql "$inner"
logical=$(printf "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'%s';\nGO\n" "$inner" | sql | awk -F'|' 'NF>2 {print $1 "|" $3}')
moves=$(printf '%s\n' "$logical" | awk -F'|' -v db="$DB_NAME" '{ext = ($2 == "L") ? "_log.ldf" : ".mdf"; if ($2 != "L" && n++) ext = "_" n ".ndf"; printf "MOVE N'"'"'%s'"'"' TO N'"'"'/var/opt/mssql/data/%s%s'"'"', ", $1, db, ext}')
{
  db_exists && printf "ALTER DATABASE [%s] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;\nGO\n" "$DB_NAME"
  printf "RESTORE DATABASE [%s] FROM DISK = N'%s' WITH %s REPLACE, CHECKSUM, RECOVERY;\nGO\n" "$DB_NAME" "$inner" "$moves"
  printf "ALTER DATABASE [%s] SET MULTI_USER;\nGO\n" "$DB_NAME"
} | sql | tail -2
dc exec -T starlights-db rm -f "$inner"

step "6. Restoring portraits, homebrew and art"
aside="$DATA_DIR/.before-restore-$stamp"
uid=$(id -u)
docker run --rm --network none --security-opt no-new-privileges -v "$DATA_DIR:/d" -v "$backup:/b:ro" alpine:3.21 sh -c '
  set -e
  mkdir -p "/d/.before-restore-'"$stamp"'"
  for f in '"${USER_FOLDERS[*]}"'; do [ -e "/d/$f" ] && mv "/d/$f" "/d/.before-restore-'"$stamp"'/$f"; done
  tar xzf /b/files.tar.gz -C /d --numeric-owner
  for f in '"${USER_FOLDERS[*]}"'; do mkdir -p "/d/$f"; done
  chown -R '"$uid"' "/d/.before-restore-'"$stamp"'" && chmod 700 "/d/.before-restore-'"$stamp"'"'
say "the folders that were there are kept in $aside"

step "7. Starting everything"
trap - ERR
dc up -d >/dev/null 2>&1 || die "docker compose up -d failed." "Look at: docker compose ps -a; docker compose logs --tail 50"
wait_for_site 60 || die "the site does not answer after 3 minutes." "Look at: docker compose ps -a; docker compose logs --tail 50 starlights-migrate-elements starlights-migrate-characters starlights-api
The restored database is in place; the safety backup is ${safety:-not needed (there was no database)}."

step "8. Checking the restore"
got=$(db_counts); prints=$(folder_fingerprints)
python3 - "$backup/manifest.json" "$got" "$prints" <<'PY' || die "the restored data does not match the backup (see above)." "The safety backup is ${safety:-none}."
import json, sys
m = json.load(open(sys.argv[1]))
got = {k: int(v) for k, v in (l.split("|") for l in sys.argv[2].splitlines() if l.strip())}
folders = {f: (int(n), h) for f, n, h in (l.split("|") for l in sys.argv[3].splitlines() if l.strip())}
ok = True
for k, v in m["counts"].items():
    good = got.get(k) == v or (k == "elements" and got.get(k, 0) >= v)
    ok &= good
    print(f"  {'ok ' if good else 'BAD'} {k:17} backup {v:6}  now {got.get(k)}")
for f, v in m["folders"].items():
    n, h = folders.get(f, (0, "absent"))
    good = n == v["files"] and h == v["fingerprint"]
    ok &= good
    print(f"  {'ok ' if good else 'BAD'} {f:17} backup {v['files']:6}  now {n} files{'' if good else ' (contents differ)'}")
sys.exit(0 if ok else 1)
PY
say ""
say "Restored. The site is up on port $(site_port)."
[ -n "$safety" ] && say "If this was a mistake, the state before the restore is in: $safety"
say "When you are happy, you can delete $aside (the folders from before)."
