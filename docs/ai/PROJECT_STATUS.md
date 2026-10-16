# Project status

## Current release — 2026-10-16

**Maintenance mode; v0.10.0 public beta released** (tag `v0.10.0` on `aurora-server`). It includes the frontend,
homebrew, security, installation, portability, API and AC work described below, the README screenshots, the bundled
background art and the wrapped-5etools fix. Earlier integration instructions and totals are historical. See the
[release verification](V0_10_0_VERIFICATION.md) and the [final handoff](FINAL_HANDOFF.md).

## Existing systems
Character creation/guided builder, registration progression, multiclassing, 2014/2024 sources, equipment, spellcasting/preparation, Aurora imports/PDF, campaigns, combat/action simulation, lore imports, player locks, snapshots and Docker packaging.

## Frontend modernization
Implemented on isolated `codex/frontend-modernisation`: three persisted previewable themes, responsive navigation, shared filtered/paginated spell cards, one choice per spell reprint group, explicit level/choice limits, interactive sheet sharing character state, coherent simulator surfaces, and official celestial branding. No combat calculations, backend APIs, production data or PDF engine changes. Implementation is ready for review; no merge/push/deploy authorized.

## Evidence and limitations
See CODEX_HANDOFF.md for commits and artifact paths. Supported-runtime build passes; frontend 188 tests pass with 5 optional content tests skipped; character backend 299 pass. Ninety responsive/theme checks and real synthetic Fighter/Wizard/multiclass, save/rest/preparation/battle/PDF workflows pass. Existing lint debt: 38 errors and 1 warning. Optional 5etools tests need the missing parser.js from a full source checkout. Fresh imported test content supplies no alignment options, so that choice remains unfilled. No exhaustive all-class/content or full WCAG audit is claimed.

## Parallel work
Protected Claude branches: `security/pdfjs-6.2.108`, `feature/homebrew-home-tile`, `ci/aurora-server-vitest`, `fix/backend-auth-tests` (Mission 006B). Homepage Index.tsx overlaps the Homebrew tile branch; retain both changes when the owner approves integration. PDF dependencies/interface and auth tests remain Claude's work. Local source is authoritative; inspect current branch state again before integration.

## Next priority
Owner review, then an explicitly approved integration in a fresh worktree using current local aurora-server. Repeat synthetic checks after conflict resolution. Do not begin a new mission or touch production to resolve test-environment limitations.
