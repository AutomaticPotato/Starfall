# v0.10.0 independent release verification — 2026-10-16

**Decision: HOLD. No v0.10.0 tag or GitHub release was created. Maintenance mode; no feature work.**

> Codex's report as written. Superseded the same day by the [Claude addendum](#claude-addendum--gates-run-on-the-merged-candidate-2026-10-16)
> at the end: the open gates were run on the merged candidate, the owner decided the asset question, and v0.10.0 was
> published. Two statements below no longer hold: the background art (the watermarked Homebrew tile included) now
> ships in `public/art`, and the release is no longer a draft.

Baseline: `ec3b83fe06bb7729d876a0ac4eeadba29bcb8cc5`, local and remote `aurora-server`, independently confirmed
through the GitHub connector. During finalization the branch advanced to
`8237b3788fb483c938500fd17b1a764a7c0661f2` (README screenshots only), confirmed locally and remotely and merged
into this isolated candidate without conflicts. Both screenshots and Claude's README additions are preserved.
Worktree: `/home/chassapis/starlights-release-v010`, branch `release/v0.10.0`.
Compatibility fix: `e718fad9863b560cd25897b932f4de2345a42c1a`. The final preparation commit is obtained with
`git log -1 --format=%H release/v0.10.0`. No candidate changes have been merged into `aurora-server` or pushed.
Release URL: **none**. [Release notes](../releases/v0.10.0.md) are a local draft, not a publication.

No production data, homelab configuration, live services or deployment scripts were used. Existing worktrees and
their changes were preserved. No dependency upgrade, feature, redesign, schema change or migration was added.

## Integration audit

The following completed work is in the baseline's ancestry:

| Work | Verified ancestor |
| --- | --- |
| Frontend modernization and spell identity QA | `5d991a8` |
| PDF.js security update | `ac2bd9e` |
| CI branch triggers and Vitest step | `a7b58d6` |
| Single Homebrew landing tile | `9f32e6d` |
| Synthetic integration-test authentication | `1f9f681` |
| Community installer and maintenance tools | `58f76ba`, `07fcc86` |
| Character portability | `c10fd79` |
| Campaign session navigation | `f7eaf0e` |
| Visual refinement | `8952853` |
| Claude's custom Aurora attacks and API documentation | `e625dab` |
| Natural/unarmored AC correction | `b214f65` |

Read the permanent directive, architecture/frontend guidance, Claude/Codex handoffs, final handoff, API guide,
installation/maintenance docs, and the separate `maintenance/final-reliability` verification report. Older handoffs
describe unmerged work which is now integrated. The latter maintenance branch contains **unfinished verification**
and test-runner additions, not a completed release; it was left intact. There is no evidence that its blockers were
resolved by the later feature merges.

## Checks actually performed

Local logs and the synthetic PDF are in ignored `.artifacts/release/` in this worktree. They are not release assets.

| Check | Result |
| --- | --- |
| Baseline frontend unit suite | 225 passed, 5 optional real-content tests skipped |
| Baseline optional real-content suite | 4 passed, 1 failed: adventure chapters silently empty |
| Final frontend suite with real content | **234 passed, 0 failed, 0 skipped; 26 files** |
| Full frontend build (`npm run build`) | **PASS**: workspace libraries and all four apps; existing bundle warnings |
| Changed frontend files, ESLint | **PASS**, no findings |
| Full app ESLint before the fix | 38 errors, 1 warning; existing documented debt |
| Installer contract tests | **39 passed** |
| All tracked deployment shell scripts, `bash -n` | **PASS**; syntax only, scripts not executed |
| PDF assets and synthetic real generator | **19 templates parse; 3-page PDF generated**, 1,222,154 bytes; custom attack field mapping checked |
| OpenAPI static validation | **143 paths, 286 schemas, 338 internal references resolve**; custom-attack and module-name-collision schemas present |
| Repository API access | Guide, JSON and Scalar HTML retrieved from remote `aurora-server` |
| Python/TypeScript examples | Synthetic attack order/figures pass; TypeScript token header/query pass with mocked fetch |
| Basic tracked-file secret-pattern check | No private-key, GitHub-token or AWS access-key patterns found; not a full secret audit |
| Backend/unit/integration/acceptance suites | **BLOCKED**: no `dotnet`; Docker socket permission denied |
| OpenAPI generation/drift integration tests | **BLOCKED** with backend tests |
| Browser journeys and Scalar rendering | **BLOCKED**: local listen and Chromium startup return `EPERM` |
| Clean dependency install and current npm audit | **BLOCKED**: offline install cannot resolve dependencies; registry DNS fails |
| CI for baseline commit | Connector returned no workflow runs for `ec3b83f` |

Runtime: Node 24.21.0; app compiler TypeScript 7.0.2; Vite 8.1.4; Vitest 5.0.3. Dependencies were copied into
the isolated worktree from existing local caches, including the per-workspace dependencies. The initial root-only
copy selected TypeScript 5.8.3 and failed with TS5103; restoring workspace caches fixed that environment error.
The initial cache also had old PDF.js; the final copy uses the lockfile's 6.2.108. Three optional native-canvas
packages remain at 0.1.100 versus locked 1.0.11. Missing packages are optional platform packages. This is **not a
clean lockfile-install certification**. npm 9's aggregate command status was misleading on the initial failure;
the actual logs were inspected and the final Vitest run invoked its executable directly.

Real-content fixtures: external, read-only `/home/chassapis/5etools/5etools-src`, commit
`90d343cde64cf8dce1083ea0525a6b0b9e545f2e`; no book data was copied into Git. Final commands:

```bash
# src/frontend, with a supported Node runtime and installed workspace dependencies
npm run build
LORE_SRC=/path/to/5etools-src node node_modules/vitest/vitest.mjs run --root apps/builder-app
# repository root
python3 -m unittest discover -s deploy/installer-tests -v
```

## Critical content compatibility defect

The current fixture stores chapters under `adventureData[].data` / `bookData[].data`. The frontend assumed only
root-level `data`, so an adventure with 26 chapters imported as zero. The same assumption in the backend
organization reader would throw when reading the wrapped book. Both readers now accept old and wrapped formats,
select the matching volume ID case-insensitively, and preserve existing content handling.

Four synthetic frontend cases check old/new books and adventures, chapter output and section links. All five
real-content checks now pass. Two synthetic backend cases cover legacy/wrapped organization books, including a
preceding unrelated volume. **The backend patch and its tests have not been compiled or executed.** That remains
a release gate; no claim is made that the frontend pass verifies the backend.

## JSON serializer integration-test investigation

`ReorderElementRulesEndpointTests` retains its three behavioral assertions. Method-level parallelism creates a
separate `WebApplicationFactory` per test; accessing `factory.Services` starts each host in its constructor.
Pinned FastEndpoints 7.1.1 assigns shared serializer options/service resolver during startup and then configures
that serializer. Its configuration fields are static. Concurrent host startup and requests are therefore a
credible race lead, **not a reproduced root cause**. See the pinned
[startup source](https://raw.githubusercontent.com/FastEndpoints/FastEndpoints/v7.1.1/Src/Library/Main/MainExtensions.cs)
and [configuration](https://raw.githubusercontent.com/FastEndpoints/FastEndpoints/v7.1.1/Src/Library/Config/Config.cs).
The EF JSON converter creates fresh options; this inspection found no basis for changing it.

No original exception stack was available in the inspected test artifacts. **Zero backend repetitions ran here.**
No assertions were weakened, tests skipped, parallelism disabled or speculative serializer patch applied.
On a permitted disposable .NET 10 environment:

```bash
dotnet restore
dotnet build --configuration Release --no-restore
dotnet test --configuration Release --no-build
dotnet test --project src/tests/integration/Starlights.Integration.Tests --configuration Release --no-build \
  --filter FullyQualifiedName~ReorderElementRulesEndpointTests
dotnet test --project src/tests/integration/Starlights.Integration.Tests --configuration Release --no-build \
  --filter FullyQualifiedName~OpenApiDocument
```

Capture the first exception stack. Repeat both the class and the entire integration project with existing
parallelism (30 runs, stopping on failure); passing only the class does not test cross-class startup overlap.
Implement a regression/fix only after matching the failure to its cause, then rerun the full suite. The API guide's
commands now use `--project`, as required by the selected
[.NET 10 test runner](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-dotnet-test).

## Feature coverage and documentation limits

Custom-attack import ordering, repeated-import merging, missing-item preservation and Battle action rows pass
their frontend tests. AC, spell identity, progression, inventory, combat and encounter calculations pass too.
The PDF check exercises the real generator with a synthetic character; portraits, spell-card HTML and browser
rendering/download were **not** tested. Homebrew persistence, character locks, save/discard, spell saves, trades,
portability and shared Battle state need disposable SQL/API/browser journeys on this exact candidate. Earlier
Claude/Codex evidence is historical, not an independent pass for this release.

The OpenAPI document is present and structurally consistent. Its runtime drift test is still unrun. Query metadata
and some admin 200/201 responses are known description limitations, explicitly documented in the guide. Production
does not map OpenAPI/Scalar; development maps both and Integration maps OpenAPI. GitHub shows the Scalar file as
source: serve `docs/api` to render it; its pinned jsDelivr bundle needs internet. No GitHub Pages deployment was made.

## Security and bundled-asset readiness

- The upstream MIT copyright notice is retained. Carlito and Source Sans font notices and renamed subset provenance
  are present. Owner-supplied branding provenance is recorded in `public/branding/README.md`.
- **Unresolved:** no redistribution grant was found for the five images under
  `src/frontend/apps/builder-app/public/images/` (`compendium.jpeg`, `development.jpg`, `drow.jpg`, `group.jpg`,
  `spiritdragon_olivierbernard_full.jpg`) or Aurora PDF template artwork/D&D logos. Attribution is not evidence of
  permission. Resolve rights or approve suitable asset changes before a public release. Existing artwork was preserved.
  The newly added README screenshots were visually inspected: they show the landing page and also reproduce that
  bundled artwork, so the same unresolved permissions apply to those screenshots.
- The watermarked Homebrew tile mentioned in the prior handoff is outside Git and was not bundled. No production art
  was read or copied. External rules/books remain outside Git.
- PDF.js 6.2.108 is pinned, matching Mozilla's fix for
  [GHSA-hq66-cqwq-w95j](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j).
  This is not a whole-dependency security clearance: npm/NuGet audits and a clean install remain required.
- Static inspection preserves the admin gate, locked-player checks, non-development CORS restrictions, production
  documentation exclusion, `.gitignore` and Docker exclusions for `deploy/.env` and `deploy/data`. Access-control
  integration tests still need execution. Unlocked players remain accessible to anyone who can reach the service;
  deployments belong on a private network.

## Remaining release gates / maintenance handoff

1. Compile and test the backend compatibility fix; resolve/retest the serializer failure with evidence.
2. Run fresh dependency installs/audits and full CI on the final candidate commit.
3. Verify disposable SQL/browser journeys for attacks, homebrew, sheets/PDFs, spells, Battle, permissions and persistence;
   check runtime OpenAPI drift and Scalar rendering. Never use the live homelab.
4. Resolve bundled-asset redistribution permissions. Keep Windows/WSL2, incomplete full-installer content verification,
   lint debt and the documented gameplay/API limits explicit in the beta notes.
5. Only after the gates pass, integrate the reviewed candidate, publish tag/release `v0.10.0` on that verified SHA,
   and replace the draft status with the real release URL and evidence. The user's release authorization already
   covers publication after successful checks; it does not authorize deployment.

Stop here in maintenance mode. Do not infer permission for new features or production work from this release task.

## Claude addendum — gates run on the merged candidate, 2026-10-16

Candidate: branch `release/v0.10.0-final` = Codex's `release/v0.10.0` (`8d10a53`) with `aurora-server` `383b022`
merged in (`ddb4218`: Midnight README screenshots, background art bundled with the owner's approval), plus
`ed9a946` (Compendium: subraces that copy another subrace) and this documentation. Run on the homelab host with
Docker, in the images CI uses (.NET 10 SDK + Node 22.19); no production data, service or configuration was used.

| Gate | Check | Result |
| --- | --- | --- |
| 1 | `dotnet restore`, `dotnet build -c Release`, `dotnet test -c Release` (whole solution, TRX) | **build 0 errors; 803 tests: 779 passed, 0 failed, 24 skipped** (the 24 are pre-existing skips) |
| 1 | Codex's backend wrapped-book tests `Organizations_ReadLegacyAndWrappedBooks` (legacy, wrapped) | **both passed** |
| 1 | OpenAPI drift `ThePublishedOpenApiDocument_MatchesTheEndpoints` | **passed** |
| 1 | `ReorderElementRulesEndpointTests` alone, repeated | **10 of 10 runs passed** |
| 1 | `Starlights.Integration.Tests` (140 tests), repeated with its normal parallelism | **3 of 3 runs passed** (no failure seen; the start-up race stays a lead, not a reproduced cause) |
| 2 | `npm ci` from the lockfile in a clean container, `npm run build` | **pass** |
| 2 | Vitest with `LORE_SRC` = 5etools-src `90d343c` (v2.38.0), read-only | **235 passed, 0 failed, 0 skipped; 27 files** (one earlier run timed out at 5 s in the adventure test while the backend suite loaded the CPU; alone it takes 2.7 s) |
| 2 | `npm audit --omit=dev` | 24 advisories (1 critical, 17 high, 6 moderate). All are server-side packages reached through the `shadcn` CLI in `packages/ui-framework` (`@modelcontextprotocol/sdk`, `hono`, `undici`, `proxy-addr`, …), build tooling (`postcss`, `braces`, …) or react-router's RSC server mode. The shipped app is static files served by nginx; none of these runs in production. Not upgraded (maintenance scope). |
| 2 | `dotnet list package --vulnerable --include-transitive` | `Starlights.Application`: transitive `System.Security.Cryptography.Pkcs` 9.0.4, GHSA-846f-f764-76mx (high) and GHSA-2fmv-rv2c-59x7 (moderate). `Starlights.AppHost` (development only): `Pkcs` 10.0.8, `MessagePack` 2.5.302 (moderate). **Follow-up:** pin a patched `Pkcs`. |
| 2 | CI on the exact release commit | run by hand after the push; the release is tagged only on the commit it passed |
| 3 | Compendium build from the candidate on real 5etools 2.38 (scratch output) | **all 101 adventures and 67 books have chapters** (Curse of Strahd: 26); live, built with the old reader, had none of the 168. Report: 1 problem left, a 5etools data error (Umbraxakar's legendary group "Shadow Dragon (Bronze Dragon)" (MM) does not exist), left as it is |
| 3 | `docs/api/index.html` served locally, rendered in Chromium (Playwright) | **Scalar renders the description**, no page errors |
| 3 | Disposable SQL/browser journeys (homebrew, sheets/PDF downloads, spells, Battle, permissions, persistence) | **not run on this commit**; earlier evidence is historical |
| 4 | Bundled-asset rights | **owner's decision**: publish as they are, the upstream pictures in `public/images`, the background art in `public/art` (the watermarked Tasha tile included) and the sheet templates' D&D logos |

`ed9a946`: 5etools makes the Amonkhet human (PSA) a `_copy` of the PHB human Variant subrace. The species reader
looked up the race before resolving copies, so it reported "race undefined (undefined) not found" and left it out.
Subraces now resolve their copies first, keyed by race as well as name and source; a synthetic test covers it, and
"Human (Amonkhet)" is in the species index built from 2.38. The server's 5etools translation already resolves that
copy (only one "Variant" PHB subrace exists), so it is unchanged.

The Compendium build format goes from 7 to 8 (version `2.38.0-90d343c-f8`): the files of a build are cached by
browsers for good, and an install builds again only for a new version, so a fixed build of the same 5etools release
needs a new name. The app reads the name from `current.json` and pins no format.

Production follow-up approved by the owner: rebuild the live Compendium from the release (the nightly only rebuilds
on a new 5etools release). The homelab nightly now treats any "no chapters"/"no file" problem in a new build's
report as a failure (ntfy, high priority), so a future 5etools format change is caught the same night.
