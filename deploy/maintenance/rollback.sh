#!/usr/bin/env bash
# Puts the previous version's web app and API back (the images update.sh kept as :rollback-<commit>).
# This is NOT a database restore: it only swaps the program, the data stays as it is.
#
#   deploy/maintenance/rollback.sh OLD_COMMIT [--web-only] [--after-restore] [--confirm NAME]
#
#   --web-only       only the web app (the pages); the API and database stay on the new version.
#                    Fine when the update changed only the web app.
#   --after-restore  you are going to restore (or have restored) the backup from before the update, because the
#                    update changed the database: skip the check that refuses an old API on a newer database
#
# Without --after-restore it refuses when the database has changes (migrations) the old version doesn't know: the
# old API on a newer database can break or damage data. Then go back completely instead:
#   rollback.sh OLD_COMMIT --after-restore   and   restore.sh <the pre-update backup>
source "$(dirname "$0")/lib.sh"

old="" web_only=false after_restore=false confirm=""
while [ $# -gt 0 ]; do
  case "$1" in
    --web-only) web_only=true; shift ;;
    --after-restore) after_restore=true; shift ;;
    --confirm) confirm="${2:?--confirm needs the install name}"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    -*) die "unknown option: $1" "Run with --help to see the options." ;;
    *) old="$1"; shift ;;
  esac
done
require_install
backend_image=$(compose_image starlights-api); web_image=$(compose_image starlights-web)
[ -n "$old" ] || die "say which version to go back to." "Kept versions: $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -F "$web_image:rollback-" | sed 's/.*rollback-//' | sort -u | tr '\n' ' ')"
images=("$web_image"); $web_only || images=("$backend_image" "$web_image")
for img in "${images[@]}"; do
  docker image inspect "$img:rollback-$old" >/dev/null 2>&1 || die "there is no kept image $img:rollback-$old." "Kept versions: $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^$img:rollback-" | tr '\n' ' ')"
done

step "Checking the database"
require_db_running
if ! $web_only && ! $after_restore; then
  git -C "$REPO_DIR" cat-file -e "$old^{commit}" 2>/dev/null || die "the code of $old is not in this checkout, so the database check is impossible." "Fetch it (git fetch) or use --after-restore if you restore the pre-update backup."
  unknown=$(db_migrations | grep -vxF -f <(code_migrations "$old") || true)
  [ -z "$unknown" ] || die "the database has changes the old version ($old) does not know:
$(sed 's/^/  /' <<<"$unknown")" "A program rollback alone would run old code on a newer database. Go back completely:
  deploy/maintenance/rollback.sh $old --after-restore
  deploy/maintenance/restore.sh <the backup made before the update, e.g. $(newest_backup)>"
  say "ok: the database has nothing the old version doesn't know"
fi

project=$(project_name)
what=$($web_only && echo "the web app" || echo "the web app and the API")
confirm_typed "$project" "Put $what of '$project' back to $old? (The data is not changed.)" "$confirm"

for img in "${images[@]}"; do docker tag "$img:rollback-$old" "$img:latest"; say "$img:latest is now $old"; done
if ! $web_only; then
  cur=$(git -C "$REPO_DIR" rev-parse --short HEAD)
  if [ "$cur" != "$old" ] && git -C "$REPO_DIR" cat-file -e "$old^{commit}" 2>/dev/null; then
    git -C "$REPO_DIR" reset --keep "$old" && say "code moved back to $old (from $cur; git reset --keep, your local changes are kept)"
  fi
fi
if $web_only; then
  dc up -d --no-build --no-deps starlights-web >/dev/null
else
  STARLIGHTS_COMMIT="$old" dc up -d --no-build >/dev/null
fi
wait_for_site 60 || die "the site does not answer after the rollback." "docker compose ps -a; docker compose logs --tail 50"
say "Rolled back to $old. $($after_restore && echo "Now restore the pre-update backup: deploy/maintenance/restore.sh <folder>")"
