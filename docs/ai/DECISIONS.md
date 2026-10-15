# Decisions
- 2026-10-15: Branch `codex/frontend-modernisation`, worktree `/home/chassapis/starlights-frontend`, base `6a6aea2`. Local repository is authoritative; no pull/reset/stash.
- Keep server registration/eligibility, edition rules, snapshots, spellcasting and combat functions intact. Presentation consumes them, so multiclass and existing characters keep their semantics.
- Preserve `/characters/:id/sheet` for Aurora PDF; add a separate interactive route using the same APIs. Existing bookmarks/exports remain valid.
- Use semantic theme variables with existing localStorage key; no new UI framework or separate theme implementations.
- Use inline spell cards with explicit actions, descriptions, filters and pagination. Avoid hover-only essentials and nested scroll panes.
- Documentation is a routing map, not a source copy. Skills point to shared docs instead of repeating architecture.
- Preserve supplied branding through deterministic browser-canvas crops/resizing. Keep navy framing instead of removing the original background or redrawing the emblem. No image-processing dependency added.
- Keep interactive-sheet expansion state above conditional loading views so preparation-related query refreshes preserve navigation. Use Radix DialogTrigger to restore focus after theme previews.
- Validate real state in a disposable SQL database with read-only content imports and synthetic characters; never copy production characters to improve test coverage. Distinguish fixture screenshots from real-backend workflows and report missing content explicitly.
