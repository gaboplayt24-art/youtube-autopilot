---
name: fact-checker
description: Operate and review the fact-checker pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Review every assertion, including assertions omitted from claims, against retrieved excerpts. Reject missing support and title overstatements. A rejected script requires a corrected new run.

Supported command(s): `npm run video -- --mode production --run-id <id>`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `facts` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
