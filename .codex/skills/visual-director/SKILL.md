---
name: visual-director
description: Operate and review the visual-director pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Direct speech-timed shots with ShotPlanner and HookDirector, normally 2–4 seconds. Select config/visual-profiles; use licensed stock/generated imagery with motion or original editorial graphics. Preserve provider fallbacks, intent/provenance and cost budgets. Inspect shots, cost-plan, visuals and audio-mix JSON. Never substitute flat title cards for montage.

Supported command(s): `npm run video -- --mode production --run-id <id>`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `plan, visuals` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
