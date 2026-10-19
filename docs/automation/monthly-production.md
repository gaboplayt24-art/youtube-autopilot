# Unattended production: 19 October–18 November 2026

The owner granted standing authorization for production without per-cycle approvals. GitHub Actions runs independently of this chat or any local computer. This is a finite30-day editorial plan; it does not silently increase monthly budgets or promise four successful deliveries. It stops on19NovemberUTC. Later plans can replace the editorial queue without redesigning the pipeline.

| Earliest startUTC | Episode | Format |
| --- | --- | --- |
|19October | Noah, continuing bible-noah-003 | Existing8:07 narration,18 accepted sources, isolated pitch repair |
|26October | Jonah beyond the fish | Existing approximately ten-minute quality_test target |
|2November | Manna and daily provision | Same engine and narrator |
|9November | Daniel and the lions | Same engine and narrator |

`config/monthly-production.json` is the plan and kill switch (`enabled=false`). After the owner's request to finish as soon as possible without artificial limits, the active policy is `continuous`: there is no daily cooldown or retry-count cap. The existing `resume-approved-episode` workflow checks every15minutes; GitHub cron can be delayed. Manual dispatch starts a ready continuation immediately. The older daily1/episode7/plan28 counts and single-use correction exception are preserved history, not active limits.

Production is still serialized. The controller checks completed episodes, restores the newest complete checkpoint and atomically reserves a digest of episode/checkpoint/runtime/editorial inputs. Repeating the exact dispatch does not create a second production. Progress-only commits do not change that identity. Actual provider reset timestamps are read from the small checkpoint manifest; no provider quota is bypassed or guessed. No old reservation is removed.

When an actual generated image is rejected, autonomous visual correction analyzes its pixels, the reference and the actual QA issues, rewrites only its concept and generates a separately evidenced candidate. Narration, required facts, cast, historical setting, source-bound anatomy and overlays stay fixed. Every candidate passes the original objective QA before use. There is no arbitrary correction count; identical unsuccessful plans stop without more draws, provider quota errors stop until real recovery, the financial ledger remains enforced, and the existing job timeout protects against hung processes. Individual accepted source checkpoints remain reusable after an interruption.

Every episode uses a separate source-grounded editorial brief and actual primary passages. The current factual, voice, style, anatomy, timing, audio and final QA remain mandatory. The renderer and providers are unchanged. A permanent code/content defect can still prevent completion: adaptive visual correction cannot rewrite repository code or invent missing evidence. It preserves and reports the failure instead of publishing it. Quota exhaustion waits for actual provider reset timestamps; Cloudflare reservations and the8USD/month total cap remain authoritative. Other providers remain free-only.

Successful full episodes upload privately and schedule the next22:00UTC slot with at least three hours' lead. The owner can still cancel in Studio. The existing social workflow builds three complete measured vertical passages and automatically schedules QA-passed YouTube Shorts from their exact bundle. It records standing authorization, never a fabricated human review. It preserves all scheduling receipts and original media in Releases, and uses Supabase for small JSON state. No Actions artifact allocation or new paid provider is needed.

TikTok videos are prepared in the same package, with isolated narration and licensed/original SFX. Existing API requirements for actual human preview and express consent remain in force. This unattended plan does not falsely set those fields. TikTok posting is therefore still conditional on that platform requirement; no post is claimed without a verified receipt.

Required credentials are the existing production GitHub Secrets/variables: Gemini, Cloudflare, narrator dependencies, Supabase and YouTubeOAuth. No production secret is required in Codex. `ZERNIO_API_KEY` remains used only by existing TikTok actions.

Activation verified: controller [39211993635](https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39211993635) finished successfully and actually dispatched Noah [39212046350](https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39212046350) from checkpoint39208900562. Configuration commit e178057d1981b8e81693efe6e668fd39a5ed8917 verified in origin/main. A second read-only evaluation reported production-active and did not dispatch a duplicate. This verifies the controller, not a completed video. Lint, typecheck,299 TypeScript tests and9 Python tests passed.

Same-day corrected retry: the daily cooldown is a local cost-control setting, not proof that Gemini or Cloudflare are unavailable. A prepared `sameDayRepair` may allow exactly one additional dispatch for a specific failed run and the exact SHA256 of its committed visual revision. The controller verifies the newest manifest matches that source, verifies the actual revision file, and uses a separate atomic repair reservation. It never deletes the original daily reservation. A newer episode attempt, changed revision bytes, success, active production, episode cap or plan cap blocks the exception. This allows the already prepared Noah library-detail repair to run now; ordinary subsequent attempts still follow the daily schedule. It does not guarantee provider quota availability.

The prior same-day exception has been consumed and archived. Active continuous mode supersedes its administrative restriction, while keeping all old evidence and reservations.
