---
name: video-editor
description: Operate and review the video-editor pipeline stage.
---

Read AGENTS.md, README.md and config files. Work in the existing checkout; do not create worktrees unless requested.

Use the shared audio-first Remotion Explainer at 1920x1080/30fps H.264/AAC, with contiguous shots, camera motion and short word-timed captions. Narration controls all frame ranges. Inspect the mixed audio, FFmpeg format, motion/black/silence/clipping checks and representative frames. Preserve the CI browser supervisor and bounded cleanup.

Supported command(s): `npm run video -- --mode demo --run-id <id>`. Use the same run ID only for unchanged inputs and configuration. Commands run the pipeline and resume completed stages; they do not expose an isolated stage bypass. Inspect `composition, render` JSON under `data/runs/<id>/` (analytics outputs under `data/analytics/`). Validate with the stage schemas in src/orchestration/schemas.ts. Preserve status, integrity records and logs.

Never commit credentials, copy scripts, invent sources, weaken safety rules or enable public publishing without explicit authorization.
