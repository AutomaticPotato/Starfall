#!/usr/bin/env bash
# Checks a backup made by backup.sh, without touching your install.
#
#   deploy/maintenance/verify.sh [BACKUP_FOLDER] [--deep]
#
# Always: the files match their checksums, the manifest is readable, files.tar.gz opens.
# --deep: also restores the database into a throwaway SQL Server (its own private network, deleted afterwards),
#         runs DBCC CHECKDB and compares the counts of characters, campaigns, players and content with the
#         manifest. Proof that the backup can really be restored. Needs ~2x the database size of free disk.
# Without a folder it checks the newest backup in deploy/data/backups.
source "$(dirname "$0")/lib.sh"

backup="" deep=false
while [ $# -gt 0 ]; do
  case "$1" in
    --deep) deep=true; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    -*) die "unknown option: $1" "Run with --help to see the options." ;;
    *) backup="$1"; shift ;;
  esac
done
need docker; need python3; need sha256sum
[ -n "$backup" ] || backup=$(newest_backup)
[ -n "$backup" ] || die "there are no backups in $BACKUP_ROOT yet." "Make one with: deploy/maintenance/backup.sh"
given="$backup"
backup=$(user_dir "$given") || die "no such backup folder: $given"
case "$backup" in *.incomplete) die "$backup did not finish when it was made; it cannot be used." ;; esac

step "Checking $backup"
for f in database.bak files.tar.gz manifest.json SHA256SUMS; do
  [ -f "$backup/$f" ] || die "$f is missing from the backup." "This folder is not a complete backup made by backup.sh."
done
(cd "$backup" && sha256sum -c --quiet SHA256SUMS) \
  || die "some files do not match their checksums: the backup was changed or damaged." "Use another backup (deploy/data/backups or your off-machine copy)."
say "checksums: ok"
python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); assert m["format"]==1 and m["database"] and "counts" in m' "$backup/manifest.json" \
  || die "manifest.json is not readable." "The backup was made by another tool or is damaged."
tar tzf "$backup/files.tar.gz" >/dev/null || die "files.tar.gz does not open." "The portraits/homebrew part of this backup is damaged."
say "manifest and files archive: ok"
python3 - "$backup/manifest.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
c = m["counts"]
print(f"made {m['created']} from code {m['code_commit']} on SQL Server {m['sql_server_version']}")
print(f"characters {c.get('characters')}, campaigns {c.get('campaigns')}, players {c.get('players')}, content elements {c.get('elements')}; "
      + ", ".join(f"{k} {v['files']} files" for k, v in m["folders"].items()))
PY

$deep || { say "Quick check passed. For proof that it restores, run again with --deep."; exit 0; }

step "Test restore in a throwaway SQL Server (your install is not touched)"
image=$(dc config --format json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["starlights-db"]["image"])' 2>/dev/null || echo mcr.microsoft.com/mssql/server:2022-latest)
size=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["database_size_mb"])' "$backup/manifest.json")
[ "$(free_mb /var/lib/docker 2>/dev/null || free_mb /)" -gt $((size * 2 + 500)) ] || warn "free disk looks tight for a test restore of ${size} MB."
tag="starlights-verify-$$"
envfile=$(mktemp); chmod 600 "$envfile"
printf 'ACCEPT_EULA=Y\nMSSQL_PID=Express\nMSSQL_SA_PASSWORD=Vf1!%s\n' "$(head -c 24 /dev/urandom | base64 | tr -d '/+=')" >"$envfile"
cleanup() { docker rm -fv "$tag" >/dev/null 2>&1 || true; docker network rm "$tag" >/dev/null 2>&1 || true; rm -f "$envfile"; }
trap cleanup EXIT
docker network create --internal "$tag" >/dev/null
docker run -d --name "$tag" --network "$tag" --env-file "$envfile" "$image" >/dev/null
tsql() { docker exec -i "$tag" bash -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" exec /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -b -h -1 -W -s "|" -i /dev/stdin'; }
for _ in $(seq 1 60); do printf 'SELECT 1;\nGO\n' | tsql >/dev/null 2>&1 && break; sleep 2; done
printf 'SELECT 1;\nGO\n' | tsql >/dev/null 2>&1 || die "the throwaway SQL Server did not start." "docker logs $tag  (it is removed when this script ends)"
docker exec "$tag" mkdir -p /var/opt/mssql/backup
docker cp "$backup/database.bak" "$tag:/var/opt/mssql/backup/test.bak" >/dev/null
docker exec -u 0 "$tag" chown mssql /var/opt/mssql/backup/test.bak
logical=$(printf "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'/var/opt/mssql/backup/test.bak';\nGO\n" | tsql | awk -F'|' 'NF>2 {print $1 "|" $3}')
moves=$(printf '%s\n' "$logical" | awk -F'|' -v db="$DB_NAME" '{ext = ($2 == "L") ? "_log.ldf" : ".mdf"; if ($2 != "L" && n++) ext = "_" n ".ndf"; printf "MOVE N'"'"'%s'"'"' TO N'"'"'/var/opt/mssql/data/%s%s'"'"', ", $1, db, ext}')
printf "RESTORE DATABASE [%s] FROM DISK = N'/var/opt/mssql/backup/test.bak' WITH %s CHECKSUM, RECOVERY;\nGO\n" "$DB_NAME" "$moves" | tsql | tail -1 \
  || die "the database in this backup could not be restored." "Do not rely on this backup; use another one."
printf "DBCC CHECKDB ([%s]) WITH NO_INFOMSGS, ALL_ERRORMSGS;\nGO\n" "$DB_NAME" | tsql \
  || die "the restored database has consistency errors (DBCC CHECKDB above)." "Do not rely on this backup; use another one."
say "restored and DBCC CHECKDB: ok"
restored=$(printf '%s\n' "$DATA_COUNTS_SQL" | tsql | sed '/^\s*$/d')
python3 - "$backup/manifest.json" "$restored" <<'PY' || die "the restored database does not match the manifest (see above)." "Do not rely on this backup."
import json, sys
m = json.load(open(sys.argv[1]))
got = {k: int(v) for k, v in (l.split("|") for l in sys.argv[2].splitlines() if l.strip())}
bad = {k: (v, got.get(k)) for k, v in m["counts"].items() if got.get(k) != v}
for k, v in m["counts"].items(): print(f"  {k:17} manifest {v:6}   restored {got.get(k)}")
sys.exit(1 if bad else 0)
PY
say "Deep check passed: this backup restores, is consistent, and holds what its manifest says."
