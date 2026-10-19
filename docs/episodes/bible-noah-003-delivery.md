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

Corrective workflow dispatched: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39192567746 . Source commit `09ab131038b4ca34b4e94fa16e11b4574624bff7` was verified in origin/main. Restores 39187154400, retry_from=facts, all prior delivery/model/style/topic settings unchanged. This is the first attempt within the owner-renewed bounded window; startup is not factual approval or completed video evidence.

## Real-cloud source recovery and structured citation repair

Run 39192567746 successfully fetched and checkpointed the complete primary evidence. Factual review then reached the ending scene but exhausted three structured-output repairs: the model reported supported construction details as advisory confirmations with paraphrased/source-only narration quotes and concatenated source quotes. The literal-evidence contract correctly rejected these. Raw provider responses, previous factual rejection and full checkpoints were saved; downloaded ZIP SHA256 `d82d81341698e19d653ffa3ea7078e581b2faedf7a102c5d6ec4d4dd0a70fcc1` and archive CRC were verified. No voice/render/upload occurred.

The factual reviewer now selects actual narration sentence IDs and source excerpt IDs. Bounds are validated, and the application inserts the exact original strings into the existing factual observation report. It never silently fixes meaningful words or accepts fabricated quotes. Supported assertions belong in review rather than fabricated objections; genuine major errors still block. Full scene-by-scene historical assertion review remains mandatory. The original generated responses remain untouched as evidence.

Validation: lint, typecheck, 285 TypeScript tests and 9 Python tests pass. Regressions assert literal report derivation, rejection of nonexistent sentence/source IDs after bounded retries, intact minor advice and retained major-error failures. Resume from completed checkpoint 39192567746 with retry_from=facts, counted as second within the renewed three-attempt maximum.

Indexed factual continuation: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39193191490 , verified source commit `9823d3896f0dda894fa33e8b0d2a5c10d6bb8ee2` in origin/main. Reuses source checkpoint 39192567746, retry_from=facts. Second attempt within the owner-renewed maximum of three; no media or schedule is claimed at dispatch.

CI cache efficiency correction: completed job logs show the rembg environment is reinstalled after a later factual gate fails. Default actions/cache saves only on successful jobs. The workflow now restores those environment caches explicitly and saves them even after later failure, but only if their install/model-validation step succeeded and the job was not cancelled. Existing keys and dependencies are unchanged; failed/partial installations are never cached. This affects later runs, not the currently executing source commit.

## Actual factual recovery verified

Read-only Actions probe 39193447048 confirmed Supabase HTTP 200 and the actual `facts` record passed at 2026-10-19T03:11:02.719Z. Critical terms, scene plan and approved voice selection completed immediately afterward; narration is now executing. Receipt: `data/research/bible-noah-003/factual-recovery-progress.json`. This verifies the original incomplete-evidence/citation blockers are resolved in real inference; it is not voice approval, a completed render or a YouTube scheduling receipt.

## Voice false-positive repair with actual audio evidence

Run 39193191490 ended at voice, preserving two complete synthesized WAVs. First voice chapter passed at WER 1.78%, 253.74 seconds. Second measured WAV was 185.18 seconds, WER 0.99% (five substitutions, no insertions/deletions), no acoustic discontinuity or unexpected pauses. All factual names/numbers passed. The sole failed critical occurrence was the pronoun “Our”, misclassified as a historical name because it started a sentence and that voice group contained no lowercase occurrence. Publish was skipped.

Personal pronouns are now excluded from inferred proper names. This does not normalize the actual lexical difference away: our→a remains one of the five WER substitutions. Existing declared terms, factual names/dates/numbers, WER thresholds and acoustic gates are unchanged. Tests still reject Augustus→August and forty→fourteen with low total WER.

The downloaded checkpoint archive and WAV SHA256 values were verified. A local rerun of voice QA against the exact second WAV and saved measured Whisper transcript now passes with 100% factual critical accuracy and passing acoustic checks. Receipt: `data/research/bible-noah-003/voice-pronoun-recovery.json`; original rejected evidence remains in the prior versioned release checkpoint. The first chapter sidecar matches the corrected expected terms and can be reused unchanged. Second synthesis is likewise reusable; Actions will re-run its ASR/QA and then synthesize only the remaining narration. No timestamps were fabricated.

Validation: lint, typecheck, 286 TypeScript tests and 9 Python tests pass. The next continuation is the third/final within the existing renewed window, restoring 39193191490 from voice. A later objective failure must stop at that cap with evidence, not silently add attempts. No final video or schedule is yet claimed.

Pronoun-recovery continuation: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39195273263 , verified source commit `cf311aabe7b462d4a1cb46331ddf0999c1e80c90` in origin/main. Restores 39193191490 with retry_from=voice. Third/final attempt in the owner-renewed window; script/facts and both existing synthesized WAVs retained, no re-synthesis requested for them. No final media or schedule claimed at dispatch.

## All narration synthesized; final short listening review required

Run 39195273263 successfully retained approved facts and existing WAV synthesis. All 1323 words now have complete source narration coverage in three WAVs: 253.74 + 185.18 + 47.76 = 486.68 seconds (about 8:07). The first two parts pass (WER 1.78%, 0.99%); pronoun correction resolved the prior false critical gate.

The final 47.76 seconds has WER 2.13% from exactly three substitutions: two ark→arc spellings (English homophones), and could→can. Every detected factual critical term passes; no repetitions, skipped phrases, unexpected pauses or continuity defects. Both independent measured Whisper transcripts are retained. This legitimately reaches the configured 2–5% listening-review range; it is not a new structural failure, permission to erase lexical differences, or a completed video. Production stopped and publish was skipped.

All renewed three production attempts are now used; the dry-run continuation guard reports attempt-cap-reached. Per AGENTS.md and the voice review policy, no fourth production dispatch occurs before owner review. The existing evidence-only workflow may export the actual WAV/ASR/QA without synthesis, image inference, YouTube publication or paid calls. Listening exports now allow up to 90 seconds so the entire short ending can be reviewed, while all approval thresholds remain unchanged. Local end-to-end exporter verified full narration coverage and produced a playable 47.808-second MP3 plus raw-evidence archive. Lint, typecheck, 286 TypeScript and 9 Python tests passed.

Pending request and immutable source bindings: `data/research/bible-noah-003/voice-ending-review-request.json`. No owner confirmation or human ASR correction is fabricated. The prior local direct Release upload failed authentication for uploads.github.com; use the existing authenticated Actions exporter, never request new production secrets in Codex.

## Listening artifact uploaded and independently verified

Evidence-only workflow https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39196444828 completed successfully. The Release now contains `voice-evidence-bible-noah-003-39196444828-attempt-1-excerpt.mp3`, its summary and the ZIP with all three raw WAVs, measured Whisper transcripts, original QA/diffs and script. The downloaded ZIP passed CRC and all 33 manifest SHA256 checks; ffprobe confirmed the MP3 duration of 47.808 seconds. Narration coverage is complete; facts passed; final narration still needs listening review. Cloud summary is committed separately from the original rejected reports.

The owner has been asked to listen and confirm the two ark occurrences around 00:03 and 00:41 before continuation. No response/approval, transcription correction, new production attempt, image inference, rendered video or schedule has been fabricated. The could/can discrepancy remains unchanged. All files are preserved in the versioned checkpoint Release; no Actions artifact storage allocation or new paid API is used by the export.

## Owner review received and bounded continuation authorized

The owner replied “dale avanza” after the linked 48-second ending and explicit ark listening question. This contextual affirmative is recorded literally, not rewritten as a fabricated detailed listening statement. The existing human-ASR mechanism permits only the two exact arc→ark spellings, bound to the original WAV, script and measured Small transcript SHA256. The could→can difference remains, raw evidence and real timestamps remain untouched, and no global QA threshold changes.

The prior three attempts remain in approvalHistory. New bounded maximum-three window starts 2026-10-19T04:46:44Z, same expiry/budgets. Restore checkpoint 39195273263 from voice, preserving the complete 486.68-second narration, approved script/facts and all prior rejections. Production is not yet rendered or scheduled.

Exact local owner-review application verified: the original WAV SHA and raw Small transcript SHA match the signed review record; every measured timestamp remains unchanged. Corrected comparison passes at WER 0.7092%, critical accuracy 100%, one could→can substitution retained, acoustic pause/continuity checks pass. See `data/research/bible-noah-003/voice-owner-approved-recheck.json`. This is not a new synthesis or full-video QA approval. Lint, typecheck and the 295-test suite passed before dispatch.

Owner-reviewed continuation dispatched: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39201301855 , verified main source commit `824f89813fb885980e571796b3a67c012673570b`. Restore 39195273263 from voice. First attempt within the owner-reviewed bounded window; all original synthesis retained, exact ASR review only. No completed imagery/render/schedule claimed at dispatch.
