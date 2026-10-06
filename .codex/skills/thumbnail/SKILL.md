---
name: thumbnail
description: Operate and review the thumbnail pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Render independent Thumbnail compositions A/B/C at 1280x720, with one focal subject, 1–5 truthful words and strong mobile contrast. Inspect variants, checksums and all six rubric scores. Dimension/readability/contrast gates must pass; subjective scores still need human review. Do not capture the first video frame.

Supported command(s): `npm run video -- --mode demo --run-id <id>`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `thumbnail` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
