# Decisions
- 2026-10-15: Branch `codex/frontend-modernisation`, worktree `/home/chassapis/starlights-frontend`, base `6a6aea2`. Local repository is authoritative; no pull/reset/stash.
- Keep server registration/eligibility, edition rules, snapshots, spellcasting and combat functions intact. Presentation consumes them, so multiclass and existing characters keep their semantics.
- Preserve `/characters/:id/sheet` for Aurora PDF; add a separate interactive route using the same APIs. Existing bookmarks/exports remain valid.
- Use semantic theme variables with existing localStorage key; no new UI framework or separate theme implementations.
- Use inline spell cards with explicit actions, descriptions, filters and pagination. Avoid hover-only essentials and nested scroll panes.
- Documentation is a routing map, not a source copy. Skills point to shared docs instead of repeating architecture.
