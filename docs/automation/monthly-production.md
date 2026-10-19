# Unattended production: 19 October–18 November 2026

The owner granted standing authorization for production without per-cycle approvals. GitHub Actions runs independently of this chat or any local computer. This is a finite30-day editorial plan; it does not silently increase monthly budgets or promise four successful deliveries. It stops on19NovemberUTC. Later plans can replace the editorial queue without redesigning the pipeline.

| Earliest startUTC | Episode | Format |
| --- | --- | --- |
|19October | Noah, continuing bible-noah-003 | Existing8:07 narration,18 accepted sources, isolated pitch repair |
|26October | Jonah beyond the fish | Existing approximately ten-minute quality_test target |
|2November | Manna and daily provision | Same engine and narrator |
|9November | Daniel and the lions | Same engine and narrator |

`config/monthly-production.json` is the plan and kill switch (`enabled=false`). `resume-approved-episode.yml` checks it daily at00:35UTC; GitHub cron can be delayed. Manual dispatch supports a read-only decision (`dispatch_ready=false`) and actual dispatch (`true`). The legacy `config/episode-delivery.json` controller is disabled. No three-attempt renewal prompt remains in the active flow.

The controller serializes production, checks prior successes to avoid repeats, restores the newest complete checkpoint, and reserves theUTC day atomically in the existing Supabase ledger before dispatch. An uncertain dispatch retains its reservation until the next day. It permits at most one production dispatch perUTC day, seven attempts per episode and28 total for this plan. Exhausted episodes are reported and skipped when the next episode becomes due. A completed or active production is never blindly restarted. The Noah targeted `retry_from=visuals` applies only to source39208900562, so a later completed render is retained. None of these controller decisions means QA approval.

Every episode uses a separate source-grounded editorial brief and actual primary passages. The current factual, voice, style, anatomy, timing, audio and final QA remain mandatory. The renderer and providers are unchanged. A permanent code/content defect can prevent an episode from completing: a scheduled controller cannot autonomously rewrite repository code or invent missing evidence. It preserves and reports the failure instead of publishing it. Quota exhaustion waits for later daily checks; Cloudflare reservations and the8USD/month total cap remain authoritative. Other providers remain free-only.

Successful full episodes upload privately and schedule the next22:00UTC slot with at least three hours' lead. The owner can still cancel in Studio. The existing social workflow builds three complete measured vertical passages and automatically schedules QA-passed YouTube Shorts from their exact bundle. It records standing authorization, never a fabricated human review. It preserves all scheduling receipts and original media in Releases, and uses Supabase for small JSON state. No Actions artifact allocation or new paid provider is needed.

TikTok videos are prepared in the same package, with isolated narration and licensed/original SFX. Existing API requirements for actual human preview and express consent remain in force. This unattended plan does not falsely set those fields. TikTok posting is therefore still conditional on that platform requirement; no post is claimed without a verified receipt.

Required credentials are the existing production GitHub Secrets/variables: Gemini, Cloudflare, narrator dependencies, Supabase and YouTubeOAuth. No production secret is required in Codex. `ZERNIO_API_KEY` remains used only by existing TikTok actions.
