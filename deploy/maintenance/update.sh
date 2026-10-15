#!/usr/bin/env bash
# Updates this Starlights install to newer code, carefully. Nothing happens by itself: you run it, it shows what
# would change, and asks before doing anything.
#
#   deploy/maintenance/update.sh [--to REF] [--check] [--confirm NAME]
#
#   --to REF    what to update to (default: the branch this checkout follows, e.g. origin/aurora-server)
#   --check     only show what the update would do (nothing is changed)
#   --confirm   the install's name, instead of typing it when asked
#
# Steps: checks (clean code, a straight fast-forward, disk, a healthy install) -> shows the new commits and what they
# touch (web app only / server / DATABASE CHANGES / content importer) -> asks -> backup.sh (stops if it fails) ->
# keeps the running images as :rollback-<old commit> -> moves the code -> builds (the site keeps running the old
# version until the build works) -> starts the new version (database changes run first) -> checks the site answers,
# runs the new commit, and that no characters, campaigns, players, homebrew or portraits went missing.
# If something fails it stops and says exactly how to go back (see docs/maintenance.md).
source "$(dirname "$0")/lib.sh"

target="" check_only=false confirm=""
while [ $# -gt 0 ]; do
  case "$1" in
    --to) target="${2:?--to needs a git ref}"; shift 2 ;;
    --check) check_only=true; shift ;;
    --confirm) confirm="${2:?--confirm needs the install name}"; shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) die "unknown option: $1" "Run with --help to see the options." ;;
  esac
done
require_install; need git; need curl

step "1. Checks"
git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1 || die "$REPO_DIR is not a git checkout, so it can't be updated with git." "Download the new version by hand, or clone the repository again."
[ -z "$(git -C "$REPO_DIR" status --porcelain --untracked-files=no)" ] || die "the code has local changes:
$(git -C "$REPO_DIR" status --short --untracked-files=no | head -10)" "Commit or undo them first (git -C $REPO_DIR status). An update never overwrites your changes."
branch=$(git -C "$REPO_DIR" branch --show-current)
[ -n "$branch" ] || die "the code is not on a branch (detached HEAD)." "git -C $REPO_DIR checkout aurora-server"
if [ -z "$target" ]; then
  target=$(git -C "$REPO_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) \
    || die "branch $branch follows no remote branch." "Say what to update to: --to origin/aurora-server"
fi
remote="${target%%/*}"
if git -C "$REPO_DIR" remote | grep -qxF "$remote"; then
  git -C "$REPO_DIR" fetch -q "$remote" || die "could not fetch from $remote (network?)." "Nothing was changed. Try again later."
fi
from=$(git -C "$REPO_DIR" rev-parse --short HEAD)
to=$(git -C "$REPO_DIR" rev-parse --short "$target^{commit}" 2>/dev/null) || die "unknown version: $target"
[ "$from" != "$to" ] || { say "Already up to date ($from)."; exit 0; }
git -C "$REPO_DIR" merge-base --is-ancestor HEAD "$target" || die "$target is not a straight continuation of your code ($from)." "Your branch has commits $target lacks (or the other way round). Sort it out with git first; this script only fast-forwards."
require_db_running
site_answers || die "the site does not answer right now, so a before/after check is impossible." "Start it (docker compose up -d) and check it works, then update."
free=$(free_mb "$DATA_DIR"); [ "$free" -gt 4000 ] || die "only ${free} MB free disk; an update needs about 4 GB (backup + new images)." "Free some space and try again."

step "2. What the update brings ($from -> $to)"
git -C "$REPO_DIR" log --oneline --no-decorate -30 "HEAD..$target"
total=$(git -C "$REPO_DIR" rev-list --count "HEAD..$target"); [ "$total" -le 30 ] || say "... and $((total - 30)) older ones"
changed=$(git -C "$REPO_DIR" diff --name-only HEAD "$target")
web=$(grep -c '^src/frontend/' <<<"$changed" || true)
server=$(grep -E '^src/' <<<"$changed" | grep -vE '^src/(frontend|tests)/' | grep -c . || true)
new_migrations=$(comm -13 <(code_migrations HEAD) <(code_migrations "$target"))
deployfiles=$(grep -E '^deploy/' <<<"$changed" | grep -v '^deploy/maintenance/' || true)
importer=$(grep -E '^src/modules/elements/.*(Aurora|Import|Homebrew)' <<<"$changed" | grep -v '/Tests/' || true)
say "web app files: $web    server files: $server"
if [ -n "$new_migrations" ]; then
  say "DATABASE CHANGES: $(wc -l <<<"$new_migrations") migration(s) will run when the new version starts:"
  sed 's/^/  /' <<<"$new_migrations"
  say "  After they run, going back needs the backup this update makes (a web/API rollback alone is not enough)."
else
  say "database changes: none (going back is a simple image rollback)"
fi
[ -z "$deployfiles" ] || { say "deployment files change (read them before going on):"; sed 's/^/  /' <<<"$deployfiles"; }
[ -z "$importer" ] || say "the content importer changes: read the release notes; a content re-import (./admin.sh import ... --replace) may be needed, while nobody plays."
$check_only && { say ""; say "--check: nothing was changed."; exit 0; }

project=$(project_name)
confirm_typed "$project" "Update the install '$project' from $from to $to? The site restarts (a minute or two offline)." "$confirm"

step "3. Backup before updating"
"$MAINT_DIR/backup.sh" --label "pre-update-$from" || die "the backup failed, so the update did not start." "Nothing was changed. Fix what the backup reported and run the update again."
backup=$(newest_backup)
before_counts=$(db_counts); before_prints=$(folder_fingerprints)

step "4. Keeping the running version for a rollback"
backend_image=$(compose_image starlights-api); web_image=$(compose_image starlights-web)
for img in "$backend_image" "$web_image"; do
  docker image inspect "$img:latest" >/dev/null 2>&1 && docker tag "$img:latest" "$img:rollback-$from" && say "kept $img:rollback-$from"
done
mkdir -p "$DATA_DIR/maintenance"
printf '{"from":"%s","to":"%s","backup":"%s","started":"%s","new_migrations":%s}\n' "$from" "$to" "$backup" "$(date -Iseconds)" \
  "$(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().split()))' <<<"$new_migrations")" > "$DATA_DIR/maintenance/last-update.json"

step "5. Moving the code to $to and building"
git -C "$REPO_DIR" merge --ff-only -q "$target"
# if the new version names its images differently (older versions used starlights/backend and starlights/web for
# every install), keep the rollback copies under the new names too, so rollback.sh from the new code finds them
for pair in "$backend_image:$(compose_image starlights-api)" "$web_image:$(compose_image starlights-web)"; do
  old_name=${pair%%:*}; new_name=${pair#*:}
  if [ "$old_name" != "$new_name" ] && docker image inspect "$old_name:rollback-$from" >/dev/null 2>&1; then
    docker tag "$old_name:rollback-$from" "$new_name:rollback-$from" && say "the new version names its images $new_name; kept $new_name:rollback-$from too"
  fi
done
if ! STARLIGHTS_COMMIT="$to" dc build -q; then
  die "the new version did not build. The site is still running the old version ($from); nothing live changed." "To put the code back as it was:
  git -C $REPO_DIR reset --keep $from
  docker tag $backend_image:rollback-$from $backend_image:latest; docker tag $web_image:rollback-$from $web_image:latest"
fi

step "6. Starting the new version"
up_ok=true
STARLIGHTS_COMMIT="$to" dc up -d >/dev/null 2>&1 || up_ok=false
migrated=$(comm -12 <(db_migrations | sort) <(printf '%s\n' "$new_migrations" | sort) | grep -c . || true)
recovery() {
  if [ "$migrated" -gt 0 ]; then
    printf '\nThe database was already changed by %s migration(s), so the old version cannot simply be put back.\nTo go back completely:\n  1. deploy/maintenance/rollback.sh %s --after-restore\n  2. deploy/maintenance/restore.sh %s\n' "$migrated" "$from" "$backup" >&2
  else
    printf '\nThe database was not changed. To go back: deploy/maintenance/rollback.sh %s\n' "$from" >&2
  fi
}
$up_ok || { recovery; die "docker compose up -d failed (see docker compose ps -a and docker compose logs --tail 50)."; }
for svc in starlights-migrate-elements starlights-migrate-characters; do
  state=$(service_state "$svc")
  case "$state" in "exited 0"*) ;; *) recovery; die "the database step $svc did not finish ($state)." "Its log: docker compose logs $svc" ;; esac
done
wait_for_site 60 || { recovery; die "the new version does not answer after 3 minutes." "Look at: docker compose logs --tail 50 starlights-api starlights-web"; }

step "7. Checking the new version"
running=$(api_commit)
[ -z "$running" ] || [ "$running" = "$to" ] || warn "the API says it runs $running, not $to (was STARLIGHTS_COMMIT set?)."
after_counts=$(db_counts); after_prints=$(folder_fingerprints)
python3 - "$before_counts" "$after_counts" "$before_prints" "$after_prints" <<'PY' || { recovery; die "something went missing during the update (see above)." "The backup from just before is $backup."; }
import sys
def counts(t): return {k: int(v) for k, v in (l.split("|") for l in t.splitlines() if l.strip())}
def prints(t): return {f: (int(n), h) for f, n, h in (l.split("|") for l in t.splitlines() if l.strip())}
b, a, bp, ap = counts(sys.argv[1]), counts(sys.argv[2]), prints(sys.argv[3]), prints(sys.argv[4])
ok = True
for k in ("characters", "campaigns", "campaign_entries", "players"):
    good = a.get(k, 0) >= b.get(k, 0); ok &= good
    print(f"  {'ok ' if good else 'LOST'} {k:17} before {b.get(k)}  after {a.get(k)}")
for f in ("portraits", "homebrew", "art"):
    (bn, bh), (an, ah) = bp.get(f, (0, "")), ap.get(f, (0, ""))
    good = an >= bn; ok &= good
    note = "" if bh == ah else "  (some files changed: check them; the backup has the old ones)"
    print(f"  {'ok ' if good else 'LOST'} {f:17} before {bn} files  after {an} files{note}")
sys.exit(0 if ok else 1)
PY
say ""
say "Updated $from -> $to. The backup from just before is $backup."
say "Players with the site open should reload it once. If something is wrong later: deploy/maintenance/rollback.sh $from (see docs/maintenance.md)."
