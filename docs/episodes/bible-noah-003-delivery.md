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

## First production failure and hook repair

Run 39179570025 ended at script generation, before voice/assets/render/upload. All three automatic hook revisions remained outside the existing 70-word budget; the last had 83 words against the 60-80 acceptance range. Research, selection, packaging and chapter outline completed and the checkpoint was saved. This was not a provider quota failure. The hook brief now supplies two original source-grounded narration blocks totalling exactly 70 words for the model to retain. Word-budget validation and every QA threshold remain unchanged. No completion time is promised while the episode has a failed stage.

Corrective continuation: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39180720903 , commit `a9b04d3fa0b265e3bae48bfb2b7f9c1d747d0526`, restoring checkpoint run 39179570025. This follows an actual editorial repair, not an unchanged quota retry. It counts as the second run toward the unchanged three-total cap. The daily guard limits automatic dispatches, prevents overlap and counts manual corrective runs toward the total. No provider or QA budget was increased.

## Second failure: ending, then editorial assembly repair

Continuation 39180720903 passed the chapter contracts for the hook and the next four chapters, then failed on the ending: 198 words against target 140, permitted 119-161. It did not reach factual QA, voice, assets or render. Its checkpoint archive SHA256 is `45db9cd38d43bb07b597bdc4fb7c01204fcedc25a51f00e7cc2f315725f3ba02`; archive CRC and manifest digest were verified before inspecting the actual cached chapter prose.

The cached prose also contained unsupported engineering assertions, called the altar the first structure added to the landscape and described the hundred and fifty days as additional to the rain period. The new original editorial blocks remove those claims and distinguish textual description from interpretive drawings. This is Codex editorial review, not owner approval or a factual-QA pass.

The script writer now preserves explicitly supplied editorial narration when assembling a chapter from generated evidence/visual metadata. Provider responses remain unchanged in their caches. Word limits, exactly two blocks, hook, novelty, repetition and later independent factual/voice/visual QA are retained. A fixed block outside the existing word budget fails before inference; no generic length tolerance is widened. Regression tests verify that model verbosity cannot expand fixed text, raw generated evidence is not mutated, invalid budgets call no provider and repeated text still fails.

Local text contracts validate 1323 words across the six chapters: 70, 297, 308, 309, 198 and 141. These checks are recorded in `data/research/bible-noah-003/editorial-prose-check.json` and do not claim factual, voice or visual approval. Lint, typecheck, 278 TypeScript tests and 9 Python tests passed.

Third production attempt: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39187154400 , source commit `3501678f816f9f21e301cb17546e521053774f95`, restores run 39180720903. This exhausts the configured three-total dispatch allowance if it fails; preserve evidence and stop for review rather than silently launching a fourth. At dispatch, the full script still requires independent factual QA and no new voice/images/render are claimed complete.

## Structural recovery after owner review (2026-10-19 UTC)

Run 39187154400 passed the complete 1323-word script and script-quality checks, then rejected three assertions whose actual Genesis 7 verses were missing from the research selector's 12 chosen excerpts. It reached no narration, asset generation or render. This is an incomplete-evidence defect, not a reason to waive factual QA or restart the script.

The repair retrieves the four configured complete primary passages, checks literal anchors against actual HTTP text and records SHA256 receipts. A SHA-verified offline replay of the archived source HTML expands the corpus to 73 excerpts and finds the three required quotations; see `data/research/bible-noah-003/primary-evidence-check.json`. That replay is not fresh HTTP or a factual approval. Actions must independently review the actual current script against the retrieved evidence, scene by scene with verbatim objections. Factual approvals now bind to the script/evidence digest.

Failed factual/script/audio/final gates now fail inside the stage instead of logging success and failing afterward. Explicit retries preserve old reports and integrity files under evidence-history. Completed script chapters have content-addressed checkpoints, preventing a late chapter failure from repeating earlier generation. No voice/style change or lowered factual, visual, audio or cost threshold.

Validation: npm run lint, npm run typecheck, 284 TypeScript tests and 9 Python tests passed. New regressions cover incomplete source recovery, actual-quote rejection, failed-cache status, exact prior evidence preservation, stale factual approvals and chapter reuse after provider failure.

The owner's renewed request authorizes a new bounded continuation window starting 2026-10-19T02:58:54Z; previous attempts are retained in config approvalHistory. The maximum remains three within this window, unchanged expiry and budgets. Resume the completed script from checkpoint 39187154400 with retry_from=facts. Full production and scheduling are not yet verified.
