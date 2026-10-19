# Noah's ark — full episode bible-noah-003

The owner questioned the short duration and requested continuation. This uses the existing `quality_test` target of 600 seconds, about 1400 words at the approved 140 wpm planning pace; final runtime is measured from actual narration. Rough editorial target: 8-12 minutes, with no padding or audio stretching. This is a full episode rather than another production_test audition.

The earlier short `bible-noah-002`, Actions 39170301678, was cancelled; publish was skipped. Its checkpoints and quota evidence are retained in Release `pipeline-checkpoint-bible-noah-002`. It must not be resumed or scheduled as the principal video.

The long brief `data/scripts/bible-noah-003-editorial-draft.json` contains distinct scopes for the hook, construction, occupants/provisions, waiting and bird tests, the narrative conclusion and ending. Four public-domain KJV passages (Genesis 6:9-22; 7:1-24; 8:1-22; 9:8-17) and an explicitly secondary interpretive article were fetched successfully. Actual retrieved paragraphs and response SHA256 values are preserved in `data/research/bible-noah-003/source-check.json`; the pipeline must independently retrieve/select evidence and fact-check its generated script.

Artwork follows approved Eli v5 and Claude's existing dynamic editor: original FLUX raster illustrations, optional local cut-outs, varied camera moves, measured phrase cuts, chapter cards, source chips, captions and original SFX. The voice remains approved Chatterbox Nano. The source descriptions must not become a claim of an excavated wreck or an exact verified engineering reconstruction. Clean/unclean animal wording, rain versus prevailing water, and raven versus dove must remain distinct.

Three original covers are generated. Full QA blocks every upload on objective failure; the existing YouTube flow uploads privately and schedules the next daily slot with the configured lead time. Cloudflare retains the $8/month total cap; all other providers remain free-only. No extra subscription or local production secret is needed.

The three social chapter selections are in `data/ideas/bible-noah-003-shorts-chapters.json`. After full production succeeds, the existing social workflow builds candidates from complete 20-40-second sentences using actual measured chapter word timestamps, then applies all existing clip checks. No candidate creates consent or claims publication. Any absent/ambiguous words or missing visual coverage block export instead of inventing timing.

Claude integration was checked against the current remote head `424b89dfcbf7abc6724f9af668ac2e4c72a8ed20`, which is fully contained in main. Historical handoff documents are archived under `docs/history`; old still-review branches contain exports rather than missing production implementation. This verification cannot see unpushed work in another local workspace.

## Actual production dispatch

Workflow: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39179570025 . Production source commit: `3902c10ef3c369502840319ba509a4691a49241b`. Dispatch uses `production_kind=quality_test` (600-second planner), `style=v5`, Gemini Free, generated covers, existing QA-gated YouTube scheduling. Startup reached media-tool preparation after storage probing and cache restoration. This is dispatch evidence, not a claim of completed narration/render or public upload.

The read-only `cloud-connections` progress probe accepts `episode_run_id=bible-noah-003`; no credentials or new API bindings are needed in Codex. This avoids reporting stale angels-stage records while the Noah workflow is active.

## Bounded cloud continuation

The existing daily `resume-approved-episode` guard is configured for bible-noah-003 only, with `notBefore=2026-10-19T00:10:22Z`, unchanged expiry `2026-10-22T23:59:59Z`, one production attempt per UTC day and three total attempts including the initial run. It restores the latest complete same-run checkpoint rather than restarting the video. It stops on workflow success, an active/same-day attempt, expiry or the attempt cap. No provider budget is increased. The completed angels run and cancelled Noah short are not eligible.

Delivery-mode validation retains distinct literal policies: angels requires the owner-cover/private-only handoff; Noah uses generated covers and the existing QA-gated private upload/next-slot scheduling. Neither configuration can silently change the other episode's cover gate. Tests exercise dispatch arguments with a mocked gh process; the real guard will be invoked in dry-run mode to confirm it does not launch a duplicate of the active production.
