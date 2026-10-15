# shellcheck shell=bash disable=SC2034
# Shared helpers for the Starlights maintenance scripts (backup, verify, restore, update, rollback).
# Sourced, not run. Works on the install in deploy/ (docker-compose.yml + .env next to it), whatever its compose
# project name. Secrets are never printed or put on a command line: SQL runs inside the database container with
# the password that container already has.

set -Eeuo pipefail
umask 077
# a command that fails where no message was planned still says where it stopped (scripts may set their own trap)
trap 'printf "\nSTOPPED unexpectedly at line %s of %s (exit %s). Nothing after that point was done; the messages above show what failed.\n" "$LINENO" "$(basename "$0")" "$?" >&2' ERR

MAINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$MAINT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
DATA_DIR="$DEPLOY_DIR/data"
BACKUP_ROOT="${STARLIGHTS_BACKUP_DIR:-$DATA_DIR/backups}"
DB_NAME="starlights"
# the folders of user data next to the database (content and lore are downloaded/rebuilt by the app)
USER_FOLDERS=(portraits homebrew art)
# inside the database container; it is part of the data/mssql bind mount
CONTAINER_BACKUP_DIR="/var/opt/mssql/backup"

cd "$DEPLOY_DIR"

say()  { printf '%s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf '\nSTOPPED: %s\n' "$1" >&2; [ -n "${2:-}" ] && printf '%s\n' "$2" >&2; exit "${3:-1}"; }

need() { command -v "$1" >/dev/null 2>&1 || die "this needs '$1', which is not installed." "Install it and run this again."; }

dc() { docker compose "$@"; }

# the compose project name (what `docker compose ls` shows): containers are <project>-<service>-1
project_name() {
  dc config --format json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])'
}

require_install() {
  need docker; need python3; need sha256sum; need tar
  docker compose version >/dev/null 2>&1 || die "Docker's compose plugin is missing." "See https://docs.docker.com/compose/install/"
  [ -f "$DEPLOY_DIR/docker-compose.yml" ] || die "no docker-compose.yml in $DEPLOY_DIR."
  [ -f "$DEPLOY_DIR/.env" ] || die "no .env in $DEPLOY_DIR: this folder is not a Starlights install (run ./setup.sh first)."
}

# a value from deploy/.env as docker compose reads it: the last KEY=value line wins, an "export " prefix is allowed,
# Windows line endings (CRLF, e.g. after editing in Notepad) and surrounding quotes are dropped. Empty when absent.
env_value() {
  local line value
  line=$({ grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$DEPLOY_DIR/.env" 2>/dev/null || true; } | tail -1)
  [ -n "$line" ] || return 0
  value=${line#*=}
  value=${value%$'\r'}
  if [ "${#value}" -ge 2 ]; then
    case "$value" in \"*\"|\'*\') value=${value:1:${#value}-2} ;; esac
  fi
  printf '%s' "$value"
}

site_port() { local p; p=$(env_value STARLIGHTS_PORT || true); echo "${p:-8093}"; }

# state of a service: "running healthy", "running", "exited 0", "" (no container)
service_state() {
  dc ps -a --format json "$1" 2>/dev/null | python3 -c '
import json, sys
rows = [json.loads(l) for l in sys.stdin.read().splitlines() if l.strip()]
if rows and isinstance(rows[0], list): rows = rows[0]
for r in rows[:1]:
    print(r.get("State", ""), r.get("Health", "") or r.get("ExitCode", ""))'
}

require_db_running() {
  local state; state=$(service_state starlights-db)
  case "$state" in
    "running healthy"*) ;;
    running*) die "the database container is running but not healthy yet ($state)." "Wait a minute and try again, or look at: docker compose logs starlights-db" ;;
    *) die "the database container is not running (state: ${state:-none})." "Start it with: docker compose up -d starlights-db   (then try again)" ;;
  esac
}

# runs SQL (from stdin) inside the database container; prints rows, fails on SQL errors
sql() {
  dc exec -T starlights-db bash -c 'SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" exec /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -b -h -1 -W -s "|" -i /dev/stdin'
}

db_exists() { [ "$(printf "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name = N'%s';\nGO\n" "$DB_NAME" | sql | tr -d '[:space:]')" = "1" ]; }

# the migration ids the database has applied, one per line
db_migrations() {
  printf "SET NOCOUNT ON; IF OBJECT_ID(N'%s.dbo.__EFMigrationsHistory') IS NOT NULL SELECT MigrationId FROM %s.dbo.__EFMigrationsHistory ORDER BY MigrationId;\nGO\n" "$DB_NAME" "$DB_NAME" | sql | sed '/^\s*$/d'
}

# the migration ids a commit of the code knows (from the migration files' names), one per line
code_migrations() {
  { git -C "$REPO_DIR" ls-tree -r --name-only "${1:-HEAD}" -- src/modules \
    | grep -E '/Migrations/[0-9]{14}_[^/]+\.cs$' | grep -v '\.Designer\.cs$' || true; } \
    | sed -E 's#.*/##; s#\.cs$##' | sort -u
}

# counts that must never go down unnoticed, as "name|count" lines
DATA_COUNTS_SQL="SET NOCOUNT ON;
SELECT 'characters', COUNT(*) FROM $DB_NAME.characters.character;
SELECT 'campaigns', COUNT(*) FROM $DB_NAME.characters.campaign;
SELECT 'campaign_entries', COUNT(*) FROM $DB_NAME.characters.campaign_entry;
SELECT 'players', COUNT(*) FROM $DB_NAME.characters.player;
SELECT 'elements', COUNT(*) FROM $DB_NAME.elements.element;
GO"
db_counts() { printf '%s\n' "$DATA_COUNTS_SQL" | sql | sed '/^\s*$/d'; }

# per user folder: number of files and a fingerprint of their names, sizes and contents ("folder|files|sha256")
folder_fingerprints() {
  local root="${1:-$DATA_DIR}"
  docker run --rm -v "$root:/d:ro" alpine sh -c '
    for f in '"${USER_FOLDERS[*]}"'; do
      if [ -d "/d/$f" ]; then
        n=$(find "/d/$f" -type f | wc -l)
        h=$(cd "/d/$f" && find . -type f -exec sha256sum {} + | sort -k2 | sha256sum | cut -c1-64)
        echo "$f|$n|$h"
      else
        echo "$f|0|absent"
      fi
    done'
}

free_mb() { df -Pm "$1" | awk 'NR==2 {print $4}'; }

db_size_mb() {
  printf "SET NOCOUNT ON; SELECT CAST(SUM(size) * 8 / 1024 AS int) FROM %s.sys.database_files;\nGO\n" "$DB_NAME" | sql | tr -d '[:space:]'
}

sql_server_version() { printf "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(64));\nGO\n" | sql | tr -d '[:space:]'; }

# what the running API says it is (commit), via the site's /api/admin/status with the admin key
api_commit() {
  local key; key=$(env_value STARLIGHTS_ADMIN_KEY || true)
  [ -n "$key" ] || return 0
  curl -fsS -m 10 -H @<(printf 'X-Admin-Key: %s\n' "$key") "http://127.0.0.1:$(site_port)/api/admin/status" 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("commit",""))' 2>/dev/null || true
}

site_answers() { curl -fsS -m 10 -o /dev/null "http://127.0.0.1:$(site_port)/api/characters/creation-options" 2>/dev/null; }

wait_for_site() {
  local tries="${1:-60}"
  for _ in $(seq 1 "$tries"); do site_answers && return 0; sleep 3; done
  return 1
}

confirm_typed() {
  # $1 = what to type, $2 = what is about to happen, $3 = value of a --confirm flag (if given)
  local expected="$1" given="${3:-}"
  if [ -n "$given" ]; then
    [ "$given" = "$expected" ] || die "--confirm must be exactly '$expected' (got '$given'); nothing was changed."
    return 0
  fi
  [ -t 0 ] || die "this needs confirmation, but there is no terminal to ask on." "Run it in a terminal, or pass --confirm $expected"
  printf '\n%s\nType %s to go ahead (anything else stops): ' "$2" "$expected"
  local answer; read -r answer
  [ "$answer" = "$expected" ] || die "not confirmed; nothing was changed."
}

# the newest finished backup folder (names start with the date, so they sort by time)
newest_backup() {
  local d newest=""
  for d in "$BACKUP_ROOT"/*/; do
    [ -d "$d" ] || continue
    case "$d" in *.incomplete/) continue ;; esac
    newest="${d%/}"
  done
  printf '%s\n' "$newest"
}
