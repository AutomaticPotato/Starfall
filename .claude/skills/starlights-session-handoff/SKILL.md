---
name: starlights-session-handoff
description: Load before ending a Starlights session, before context is compacted, or after finishing a milestone — how to record progress in docs/ai/CLAUDE_HANDOFF.md so the next session resumes without rereading the code or conversation.
---

# Recording progress

Update `docs/ai/CLAUDE_HANDOFF.md` (keep it under ~80 lines; replace stale lines, don't append a diary):
- **Task** and **branch/worktree**; **status** split into done (committed + tested), done but untested,
  in progress (uncommitted files listed), not started.
- **Last milestone** with commit hashes; **next concrete step** (file and symbol to open first).
- **Tests run** with results and what they didn't cover; **blockers**; **coordination** notes for Codex.
- Relevant files as `path:Symbol`, not code.

Then commit the handoff with the work (WIP commits on your own branch are fine; squash before publishing).
Durable facts that outlive the task (where things live, decisions) go into the matching skill or Codex's
`docs/ai/DECISIONS.md`-style note once, not into the handoff. Never put secrets, tokens or player data in it.
