---
name: youtube-publisher
description: Operate and review the youtube-publisher pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Private uploads only during development. Require passing rerun QA, OAuth and the durable Supabase reservation. Reconcile uncertain uploads in Studio; never blindly retry.

Supported command(s): `npm run publish -- --run-id <id>`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `upload, youtube-thumbnail, schedule` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
