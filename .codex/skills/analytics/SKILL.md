---
name: analytics
description: Operate and review the analytics pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Normalize owner metrics. Impressions/CTR are unavailable and must remain null absent imported data. Recommendations are separate from hard rules and require review.

Supported command(s): `npm run analytics -- --run-id <id>; npm run learn`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `analytics, recommendations` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
