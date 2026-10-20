# CI and repository protection

Set up 2026-10-19 (Starfall Mk2 stabilization). Repository `CHassapis/Starfall`, default branch `aurora-server`.

## CI: `.github/workflows/ci.yml` ("CI/CD - Development", job "Build & Test Solution")

Runs on pushes to `dev` / `aurora-server`, on pull requests to `main` / `dev` / `aurora-server`, and by hand
(`gh workflow run ci.yml --repo CHassapis/Starfall --ref <branch>`). Steps: .NET restore + Release build, frontend
`npm ci` + build + Vitest, then `dotnet test` with a throwaway SQL Server 2022 service so the `SqlServer` test
category (homebrew/append import rollback, see APPEND_FINAL_VERIFICATION.md) runs instead of being inconclusive.
Permissions: `contents: read` only. A newer push to the same ref cancels the run in progress.

**Why it was renamed.** Until 2026-10-19 the file was `development-build.yml`, and GitHub never started it for a
push or a pull request (all 13 runs were manual). Probes on a scratch branch showed the file itself is fine: an
exact copy under another name ran on push, and the same file renamed to `ci.yml` ran on a pull request; disabling and
re-enabling the old workflow did not help. GitHub ignored events for the workflow stored at the old path.

## Repository rulesets (Settings → Rules → Rulesets)

| Ruleset | Rules on `aurora-server` | Bypass |
| --- | --- | --- |
| `aurora-server: no force pushes or deletion` (id 25414439) | no force push, no deletion | nobody |
| `aurora-server: changes through pull requests with passing CI` (id 25415668) | changes only through a pull request (0 approvals needed); status check "Build & Test Solution" (GitHub Actions) must pass | repository admins, **only when merging a pull request** (e.g. to merge while CI is down) |

Verified on throwaway branches with identical rules: a force push, a branch deletion and a direct push were each
refused (`GH013 … Cannot force-push`, `Cannot delete this branch`, `Changes must be made through a pull request`);
feature-branch pushes and pull requests work. Any check name matches a run on the PR's head commit, whatever
started it (push, pull request or a manual run).

The owner can always change or switch off a ruleset in the settings; nothing here can lock an admin out.

To change them from the command line: `gh api repos/CHassapis/Starfall/rulesets` (list),
`gh api -X PUT repos/CHassapis/Starfall/rulesets/<id> --input ruleset.json` (change),
`... -X DELETE ...` (remove). Open pull requests from before the rename get CI once they are updated
("Update branch" on GitHub) after `ci.yml` is on `aurora-server`, or by a manual run on their branch.

## Security settings

Enabled and read back on 2026-10-19: secret scanning, secret scanning push protection, Dependabot alerts.
Actions default workflow permissions: read (unchanged); Actions may not approve pull requests.
Not enabled, left to the owner: Dependabot security update pull requests, non-provider secret patterns, validity
checks. The tracked configuration files hold no secrets (`deploy/.env.example` and the appsettings files have empty
values; `.env`, `*.htpasswd` are ignored).
