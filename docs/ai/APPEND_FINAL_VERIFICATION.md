# Aurora append verification

Updated 2026-10-19 (first written 2026-10-17). Branch `fix/append-failure-safety` (PR #4), baseline `aurora-server`
`8adf858` (PR #3, the version live since 2026-10-17).

Conclusion for this PR: **SQL Server rollback VERIFIED; Character Builder end-to-end NOT VERIFIED** (see the table).

## The defect and the correction

At the baseline, `AuroraImporter.ImportAsync` saved the deletions of a replace before rebuilding and saving the
replacements, with no transaction around both saves; `UploadHomebrewEndpoint` overwrote the source XML before
importing, and deleting a file committed the removal of its definitions before refreshing the other files' patches.
A failure in between left elements deleted. The SQL Server tests below reproduce this on the baseline code.

The correction (4184523) wraps the importer's saves in one `TransactionScope` (read committed, async flow), joins
the upload/delete database work into it, and puts the previous file bytes back when importing, cancellation or the
commit fails. 42ede19 adds:

- **Content version after commit.** `ElementsContentVersion` (the item catalog and spell index caches) was bumped
  inside the transaction. A cache rebuilt before the commit kept the old content under the new version, and a
  rolled-back import still bumped it. `ElementsContentVersion.BumpWhenCommitted()` now bumps from the transaction's
  `TransactionCompleted` event, only when it committed (unit tests `ElementsContentVersionTests`).
- **Real SQL Server tests.** Integration hosts can use a prepared SQL Server database (`Integration:SqlServer`)
  instead of the in-memory provider, which ignores transactions. `HomebrewSqlServerTests` (category `SqlServer`)
  needs `STARFALL_TEST_SQLSERVER` (a connection string without a database; each test creates and drops its own).
  Without it the tests are inconclusive, unless `STARFALL_REQUIRE_SQLSERVER` is set, where they fail.

3d55fc1 removes a generated build file that 42ede19 had picked up and ignores the folder the Linux build writes it to.

## What the SQL Server tests check

Each test snapshots every table of the `elements` and `characters` schemas (row count + checksum) and the homebrew
files, injects a failure through an EF `SaveChangesInterceptor` or a volatile enlistment that forces a rollback while
the transaction prepares, and compares afterwards.

- **Lifecycle (1 test):** append-only upload; six target types (proficiency, class, race, background, feat, spell);
  a second file and a mixed file (own element + append) patching the same element; repeated upload and repeated
  `homebrew --update` import change nothing; malformed XML and a blank id are rejected and change nothing; replacing a
  file swaps its patch; deleting files removes only their patches; at the end the same element ids, the same stored
  Aurora XML and the unrelated character are unchanged.
- **Replacing a homebrew file (3):** failure before anything is saved, after the deletions were saved, while committing.
- **Uploading a new file (2):** failure at the first save, while committing; the file is removed again.
- **Deleting a file (3):** failure removing its elements, rebuilding the patched targets, committing; elements and file stay.
- **Replace import (2):** failure after the deletions were saved, while committing; no existing element is lost.

## Results

| Area | Result | Evidence |
| --- | --- | --- |
| SQL Server rollback (11 tests) | **PASS** | 11/11 on SQL Server 2022 (disposable container, `STARFALL_REQUIRE_SQLSERVER=1`), at 42ede19 and again at 3d55fc1 |
| Negative control | **PASS** (tests catch the defect) | the same 11 tests with `AuroraImporter.cs` + `HomebrewEndpoints.cs` from 8adf858: 10/11 fail (elements snapshot differs) |
| Full backend suite | **PASS** | 3d55fc1: 846 total, 811 passed, 0 failed, 35 skipped (24 pre-existing skips + the 11 SqlServer rows, inconclusive without a server) |
| Append on full Aurora content | **PASS** | disposable API with all of AuroraLegacy.index (14,492 elements): append to `ID_PROFICIENCY_SKILL_ARCANA` adds the support, delete restores the element exactly |
| Locking during a replace import | **PASS** (on an EF-created database) | 96 s and 110 s full replace in one transaction; reads polled every ~9 s all answered in < 0.12 s |
| Homebrew upload/delete time | **PASS** | 0.58 s upload, 0.47 s repeat (no change), 0.56 s delete, on full content |
| Frontend | unchanged by this PR | baseline 239 passed / 5 skipped |
| Character Builder end-to-end (create a character on a patched element, save, reopen) | **NOT VERIFIED** | API and database level only; no browser journey on a patched element yet |
| Production | not touched | no deployment; live is still 8adf858 |

## Limits and operating notes

- **Not crash-proof.** The database work is one transaction; the homebrew file is restored by exception handling.
  Process termination, power loss or a disk failure between writing the file and committing (or a failure while
  restoring it) can leave the file and the database disagreeing. Recovery: restore the backup, or re-upload / delete
  the file (an upload or delete rebuilds what that file patches).
- **Readers and long imports.** A full replace import now holds one transaction for its whole length (~1.5–2 min for
  AuroraLegacy). Readers were not blocked because a database created by the migration service has
  `READ_COMMITTED_SNAPSHOT ON` (EF Core's database creation sets it). A database created another way (restored from
  elsewhere, created by hand) may have it off; then reads of elements wait for the import. Check, read-only:
  `SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE name = 'starlights'`. Either way, run full
  replace imports when nobody is playing, as before.
- **Transaction size.** The scope uses `TransactionManager.MaximumTimeout` (10 minutes by default on .NET). The
  largest import measured took 110 s.
- **Connection pools in tests.** Clearing all connection pools while a test's transaction is open makes SQL Server
  promote it to a distributed transaction, which .NET on Linux does not support. The tests clear only their own
  database's pool when dropping it. Production does not clear pools; if a second connection ever joined the
  transaction it would fail and roll back, not commit partially.

## How to run

```sh
# disposable SQL Server (never the live one)
docker run -d --name starfall-sql-test -p 127.0.0.1:14339:1433 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<password>' \
  mcr.microsoft.com/mssql/server:2022-latest
STARFALL_REQUIRE_SQLSERVER=1 \
STARFALL_TEST_SQLSERVER='Server=127.0.0.1,14339;User Id=sa;Password=<password>;TrustServerCertificate=True' \
  dotnet test --project src/tests/integration/Starlights.Integration.Tests --filter TestCategory=SqlServer
```
