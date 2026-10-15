# Project Starlights — permanent development directive

From the project owner, 2026-10-15. Applies to every agent and contributor (Claude, Codex, community).

## Mission

Project Starlights is a free, open-source, self-hosted, browser-based D&D 5e platform.

Repository: https://github.com/CHassapis/starlights

Primary goals, in order:

1. Intuitive character creation and independent player character management.
2. Comprehensive, approachable campaign management for Dungeon Masters.
3. Efficient live tabletop play, including character sheets, combat, encounters and resources.
4. Fast access to installed D&D rules and reference content.

The experience must be beautiful, clean, readable, responsive and accessible to new players without frustrating experienced players.

Preserve the existing D&D-inspired visual identity, branding and Aurora-style character sheets.

No in-app AI features, native applications, subscriptions or monetization.

Keep the existing React/TypeScript, .NET, SQL Server and Docker architecture.

## 1. Protect the live application

Starlights has real users and persistent character and campaign data.

Production is strictly off-limits unless I explicitly authorize an operation.

Never modify production containers, databases, volumes, credentials, services or configuration.

Never deploy, merge, push, publish releases or apply production migrations without my approval.

Do not assume reverting code reverses database migrations.

Never reset, clean, overwrite or discard existing work.

Use isolated development worktrees, disposable test data and separate databases.

Protect existing characters, campaigns, inventory, homebrew and session data.

## 2. Use small, independent development missions

Never interpret this directive as an instruction to implement every feature listed in the project's roadmap.

Each mission must have:

- One clearly defined objective.
- Explicit scope and ownership.
- A known baseline commit.
- A separate short-lived feature branch.
- Defined acceptance tests.
- Clear exclusions.
- A completion report and stop point.

Base new work on the latest approved integration baseline.

Do not accumulate unrelated features in a long-lived branch.

Complete and test one mission before proposing integration.

Keep community fixes moving independently of larger development projects.

## 3. Respect concurrent development

Check existing branches, worktrees, commits and handoffs before editing.

Other Claude sessions, Codex and community contributors may be active.

Do not overwrite their work.

Do not edit files another agent currently owns without an agreed handoff.

Where dependencies exist, establish a clear ownership map or wait for the prerequisite work to be integrated.

Preserve approved changes from other contributors when updating development branches.

## 4. Reuse before rebuilding

Use this decision order:

1. Reuse existing Starlights functionality.
2. Improve the existing implementation.
3. Find an appropriate implementation in Borealis.
4. Reuse or adapt compatible licensed code.
5. Port a small isolated algorithm when beneficial.
6. Implement from scratch only when necessary.

Borealis: https://github.com/alon-mini/borealis

Reuse suitable React/TypeScript components, importer utilities, validation, portable data formats, algorithms and tests when this reduces development effort without introducing unnecessary complexity.

Do not introduce Rust services, Tauri, Electron or a replacement rules engine.

Preserve required attribution and licence notices.

Review third-party content and artwork rights separately. Do not silently remove established D&D branding; flag unresolved licensing issues for my decision.

## 5. Design and usability

Use the established Codex design system and themes as the visual baseline once integrated.

New interfaces must follow existing shared components and design tokens.

Prioritize:

- Clear visual hierarchy.
- Readable typography.
- Excellent contrast.
- Simple navigation.
- Appropriate touch targets.
- Clear forms and selection states.
- Consistent desktop and mobile layouts.
- Contextual explanations for newcomers.
- Efficient workflows for experienced users.

Avoid rebuilding interfaces that already work.

Do not create competing component or theme systems.

Use representative browser-based user journeys and screenshots to verify material UI changes.

Subjective design goals must be supported by concrete acceptance criteria for each mission.

## 6. Preserve existing functionality

Before changes, establish current behavior and relevant tests.

Protect:

- Character creation, leveling and multiclassing.
- Magic and spell preparation.
- Character saving, importing and exporting.
- Campaign and player permissions.
- Homebrew.
- Compendium.
- Inventories and trading.
- Interactive sheets and PDF exports.
- Battle Simulator.
- Encounter calculations.
- Persistent data and backups.

Prefer backwards-compatible changes.

Any real-time synchronization system or major architectural change requires its own separately approved mission.

Do not turn a minor UI improvement into a major backend rewrite.

## 7. Validate every mission

Verification must include relevant automated tests and actual user workflows.

Compilation alone does not establish correctness.

For UI changes, test representative mobile and desktop sizes.

For database changes, verify migrations using isolated data and document recovery implications.

For shared gameplay changes, test permissions, consistency and persistence.

Report untested functionality explicitly.

## 8. Minimize token and resource use

Read relevant project handoffs, skills and architecture documentation first.

Inspect only the files needed for the current mission.

Avoid repeatedly scanning entire repositories.

Record decisions and test results concisely.

Use small commits and maintain a recoverable working state.

Do not generate extensive planning documents for simple changes.

## 9. Completion and integration

At the end of each mission, provide:

- Branch and starting commit.
- Changes completed.
- Reused code and attribution, if applicable.
- Tests run and results.
- Known limitations.
- Database and compatibility risks.
- Integration dependencies.
- Review instructions.

Stop after the mission is complete.

Wait for my approval before merging, pushing or deploying.

A completed feature is not authorization to release it.

## Governing principle

**Make Starlights simpler, more reliable and more useful without damaging the existing application or increasing complexity unnecessarily.**

Character creation, campaign management and live tabletop play take precedence over additional features.
