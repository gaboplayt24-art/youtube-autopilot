---
name: qa
description: Operate and review the qa pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Inspect every requiredQAChecks entry in src/qa/index.ts, the demo showcase gate and thumbnail variant QA. Fail on missing checks, mismatched narration, missing/repeated assets, unreadable captions, pacing gaps/long shots, black/frozen frames, silence or clipping. Never replace a meaningful failure with a passing assertion. Preview the actual rendered video and thumbnails.

Supported command(s): `npm test`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `qa` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
