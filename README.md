# youtube-autopilot

Cloud-first video production with TypeScript, Node.js 22+, Remotion, FFmpeg, interchangeable free/paid providers, YouTube OAuth2, and optional Supabase checkpoint mirroring. GitHub-hosted runners perform the work; no computer needs to remain online.

The visual engine uses the same Remotion composition in demo and production. Demo uses a 60–90 second original illustrated narrative with no external APIs. Production uses configured live providers; those integrations require credentials and separate validation. Public publishing remains disabled.

## Audio-first architecture

`benchmark duration → cost estimate → research → ideas → scoring → selection → chapter script/performance → facts/pronunciations → chapter TTS → transcription/word timing → captions → semantic shots → guarded assets → chapter music/audio mastering → audio QA → composition → render → metadata → visual/final audio QA → three thumbnails`

Scenes organize the narrative. `ShotPlanner` cuts at speech-derived word boundaries, normally every 2–4 seconds; it never invents narration duration. `HookDirector` gives the first 5 seconds an image-led opening and introduces restrained pattern interrupts through 30 seconds. Zod schemas validate every checkpoint, with per-run input fingerprints, JSON/media checksums, locks and structured logs. A failed stage resumes without regenerating previous stages. Engine v2 requires a fresh run ID when restoring a v1 artifact.

Default output is **1920×1080, 30 fps, H.264/AAC**. 3840×2160 is supported by dimensions in config/style.json; previewing/benchmarking a 4K hosted run is still recommended before routine use. Thumbnails render independently at 1280×720, never by capturing the video's first frame.

The reusable motion library includes camera push/pull, pan, Ken Burns, parallax, subtle shake, blur/light transitions, depth, masks, highlights, underlines, counters, timelines, conceptual map paths, charts, headlines, documents, quotes and illustrated characters. Every shot has a moving background. Static assets are original detailed SVG illustrations in demo, not title-only cards. Production can use real stock clips or generated imagery with the same compositor.

Captions use short cues and retained word timestamps, large type, safe margins, high contrast and active-word emphasis. Presets are per visual profile. The demo TTS is intentionally synthetic; it is not an example of a premium production voice.

`config/visual-profiles/{history,psychology,finance,stickman,documentary}.json` selects asset tendencies, caption treatment, camera direction, colors, audio levels and spending limits. Change `config/style.json.visualProfile` to choose a profile. The initial demo is a psychology-style **fictional spotlight metaphor**: maps are conceptual and charts are explicitly illustrative, not empirical psychological findings.

Audio stems are normalized in separate FFmpeg passes before mixing (compatible with Ubuntu FFmpeg 6.1), with an independent narration input for the ducking detector: normalized narration, compression, limiter, original ambient score (or a licensed local track), narration sidechain ducking, fades and sparse procedural SFX. Whoosh, impact, riser, click, page-turn, camera, transition and ambient event synthesis are supported. Music/SFX levels are configurable per profile. The narration remains dominant. Detailed vector backgrounds are rasterized once to PNG before rendering; camera motion and editorial graphics remain animated, avoiding repeated SVG rasterization on hosted CPU runners.

## Providers, fallbacks and costs

Interfaces isolate LLM, image, stock, video, TTS, transcription, music and sound-effects providers. FREE-FIRST uses Gemini, local Kokoro/local Whisper, Commons and Pexels. OpenAI and ElevenLabs are optional guarded alternatives. Demo ignores external provider switches and makes no external API calls.

A configured AI-video adapter may be injected via the VideoProvider interface. No vendor-specific AI-video adapter or key is included. Asset generation prefers licensed Commons, Pexels video/images and local graphics; paid high-impact stills require a below-floor free alternative and budget. AI video requires explicit enablement. Failed, empty or too-short media cannot produce a blank shot. No global verification bypass is used. External stock URLs/licenses and fallback failures are retained in visuals.json.

`cost-plan.json` is written before costly assets. `visuals.json` records per-asset estimates and totals. AI video is budget-disabled by default and is not generated for every shot. Current image estimates are advisory, not vendor invoices; review pricing, relevance and license terms before enabling paid production runs. Use `MUSIC_PATH` plus `MUSIC_LICENSE` for licensed production music. Original procedural audio is a demo source and explicit production fallback.

## Quality and thumbnails

QA checks facts, assets, audio duration, frame timing, black/silent segments, codecs/resolution/FPS, speech/caption bounds, duplicate media, metadata, shot pacing, visual coverage, motion, asset-intent alignment, asset repetition, caption legibility, text density, rendered freezes and clipping. The demo additionally requires 60–90 seconds, 15+ shots and multiple shot types. `pacingScore` and `visualDensity` are recorded in shots.json. These checks catch mechanical defects; intent matching is heuristic and does not replace semantic/editorial review of every downloaded/generated asset.

Three thumbnail variants A/B/C are produced, with independent image-led compositions, 1–5 words, high contrast and mobile-sized type. `thumbnail.png` is the selected primary; `thumbnail-{A,B,C}.png` and score records are retained. Readability and dimensions are gated, and backing contrast is measured from the rendered PNG. Focal-region contrast estimates subject visibility, while hook wording and title duplication estimate curiosity/complementarity; these are heuristics, not semantic image understanding. All scores form a design rubric, not a CTR prediction or a claim of tested audience preference. Production hooks are grounded in the approved script; demo uses its curated attention hooks. Human review remains necessary for subjective relevance and curiosity.

## First cloud video: exact GitHub setup

1. Commit these files and `package-lock.json` to `gaboplayt24-art/youtube-autopilot` on `main`. Do not commit `.env`, credentials or generated run directories. From this checkout: `git add .`, `git commit -m "Implement cloud video pipeline"`, then `git push origin HEAD:main` after reviewing the diff.
2. Open the repository's **Settings → Actions → General**, enable GitHub Actions, and permit the official checkout, setup-node, upload-artifact and download-artifact actions. Keep workflow token permissions read-only. Make sure hosted-runner minutes are available.
3. Open **Actions → create-video → Run workflow**. Select `main`, `mode=demo`, `run_id=first-video`, leave `source_run_id` empty. The topic input does not alter the curated demo script; use production mode for a custom topic.
4. Wait for the workflow to finish. It installs dependencies, runs lint/typecheck/tests, renders on the hosted runner, and uploads `pipeline-first-video`. Download that artifact. It contains `first-video/final.mp4`, `thumbnail.png`, `script.json`, `metadata.json`, `qa.json`, `logs.jsonl`, status, checkpoints, and original assets. Nothing is uploaded to YouTube by this workflow.
5. For a retry, keep the same logical `run_id`, mode, topic and config, and set `source_run_id` to the numeric GitHub Actions run ID from the earlier run URL (`/actions/runs/<ID>`). This is different from the logical video run ID. If inputs or code affecting outputs change, choose a new run ID. Artifacts expire after 30 days; archive valuable videos separately.

All five workflows support `workflow_dispatch`. There are no scheduled publishing triggers. `AUTO_PUBLISH=false` is enforced in the workflows and `config/schedule.json` has `autoPublish:false`, `privacyStatus:"private"`, and `publishAt:null`.

## Channel and content configuration

- `config/channel.json`: name, language, category ID, made-for-kids setting and synthetic-media disclosure. The bundled demo is English; production prompts use the channel configuration.
- `config/audience.json`: intended viewer and needs.
- `config/strategy.json`: topics, trusted HTTPS source pages, and hard rules. Production research retrieves these pages, validates quoted excerpts against retrieved text, and refuses unknown citations. Provide readable authoritative pages relevant to the chosen topic; this is not a general web search engine.
- `config/style.json`: even pixel dimensions, FPS and visual profile. Background/accent fields are retained for compatibility; provider switches are process variables, and the active profile configures captions and editorial direction.
- `config/competitors.json`: optional channel references and the no-copy rule. References are context only: the implementation does not claim to have retrieved competitor scripts or channel performance. Add authoritative pattern observations as source material when needed.
- `config/schedule.json`: private upload settings and optional future UTC ISO-8601 `publishAt`. Keep automatic publishing disabled during development.

Never invent facts, present speculation as fact, copy competitor scripts or use unlicensed media. Recommendations are written to `data/analytics/recommendations.json`; they do not rewrite hard rules or configuration.

## Secrets and external API setup

Demo video creation requires **no secrets**.

In **Settings → Secrets and variables → Actions**, configure:

| Name | Location | Required for |
| --- | --- | --- |
| `PEXELS_API_KEY` | Repository secret | Production stock clips/images with STOCK_PROVIDER=pexels |
| `ELEVENLABS_API_KEY` | Repository secret | Optional premium voice/music/SFX; FREE-FIRST drafts use local Kokoro |
| `ELEVENLABS_VOICE_ID` | Repository variable | Voice selection for ElevenLabs |
| `OPENAI_API_KEY` | Repository secret | Production research/writing/review/TTS/transcription; optional image generation |
| `SUPABASE_URL` | Repository variable | Checkpoint mirroring, private-upload ledger, analytics history |
| `SUPABASE_SERVICE_ROLE_KEY` | Repository secret | Supabase server-side access; required for upload |
| `YOUTUBE_CLIENT_ID` | Secret in protected `youtube-private` environment and repository for analytics | OAuth2 |
| `YOUTUBE_CLIENT_SECRET` | Same scope | OAuth2 |
| `YOUTUBE_REFRESH_TOKEN` | Same scope | Private uploads and channel-owner analytics |

Never enter credential values in issues or chat. `.env.example` contains names only; local CLI invocations read process environment variables. Node supports loading `.env` through `NODE_OPTIONS=--env-file=.env`; do not commit that file. `MODE` is descriptive; select mode using `--mode` or the workflow input. Default OpenAI model is `gpt-4.1-mini`; optionally set `OPENAI_MODEL` in the process environment.

For OpenAI, enable API billing and access to the selected chat model, `tts-1`, `whisper-1`, and optionally `gpt-image-1`. ElevenLabs uses native character alignment and local Whisper fallback; no OpenAI key is required for ElevenLabs alignment. Production speech transcription must match the original narration; ambiguous alignment fails instead of silently emitting inaccurate captions. API availability, quotas and costs depend on your account.

For Supabase, create a project and run `src/database/schema.sql` in the SQL editor. It creates `pipeline_artifacts` with row-level security and no anonymous access policy. Use a server-only service-role key. Do not expose it in Remotion props or browser code. Local JSON/artifacts preserve large media; the database stores JSON checkpoints and the upload ledger, not video bytes.

For Google/YouTube:

1. Create a Google Cloud project. Enable **YouTube Data API v3** and **YouTube Analytics API**.
2. Configure the OAuth consent screen. Add your channel-owning account as a test user while developing. Create a Web OAuth client with redirect URI `https://developers.google.com/oauthplayground`.
3. In OAuth Playground settings, select **Use your own OAuth credentials** and enter that client ID and secret. Authorize scopes `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.force-ssl`, and `https://www.googleapis.com/auth/yt-analytics.readonly`. Exchange the code and securely save the refresh token in GitHub Secrets. Request offline access; repeat consent if Google does not issue a refresh token. This is a one-time interactive authorization, not an always-online local service.
4. Confirm you authorized the intended channel or Brand Account. Testing-mode refresh tokens can expire after seven days; a durable deployment may require changing consent-screen publishing status and completing Google's verification/audit requirements. Unverified API projects may be restricted to private videos. Check quotas and enable custom thumbnails on the channel.
5. Create repository **Settings → Environments → youtube-private** and configure required reviewers if your GitHub plan supports them. Add the OAuth secrets there for upload. For the analytics workflow, add equivalent repository secrets or adapt it to use a protected environment. Set Supabase settings as above.
6. Inspect the video, script, citations, QA and metadata. Open **Actions → publish → Run workflow** with the logical `run_id` and the numeric `source_run_id` of its create-video run. Approve the protected environment request if configured. The workflow uploads **PRIVATE**, then applies the thumbnail; no direct public upload is implemented. Its new artifact contains `upload.json` with the video ID. For retries or analytics, use the latest upload workflow run ID as the source.

Scheduling support exists in the API adapter, but stays disabled. Only after explicit authorization should you change both `config/schedule.json.autoPublish` and the workflow's `AUTO_PUBLISH` to `true`, set a future `publishAt`, and regenerate metadata under a new run ID. Upload still starts private; scheduling is a separate update. Do not enable this during development.

## Analytics and weekly learning

Run **Actions → analytics** with the logical video ID and the numeric run ID of the successful private-upload workflow. Owner reports need processing time. Metrics are normalized to `videoId, topic, format, hook, title, thumbnailVariant, duration, publishTime, views, impressions, ctr, averageViewDuration, averagePercentageViewed, likes, comments, subscribersGained`.

YouTube Analytics public API does not expose Studio thumbnail impressions/CTR through this query; those fields are `null`, never fabricated. Import licensed/manual Studio data separately if you need those metrics. Default reporting window is the last 30 days and timestamps are from the API. CLI accepts `--start-date` and `--end-date`.

Each week, run **weekly-learning** manually. With Supabase configured it reads persisted video analytics. Otherwise provide the numeric analytics workflow run ID to download its `analytics` artifact. Recommendations include evidence and require human review. No safety rules are rewritten, and no automatic publishing is enabled. Empty history yields no recommendations.

## Development and recovery

```bash
npm ci --cache /workspace/.npm
npm run lint
npm run typecheck
npm test
CHROME_EXECUTABLE=/usr/bin/chromium npm run video -- --mode demo --run-id example-001
```

Install FFmpeg and a supported Chrome/Chromium browser on the execution machine. Actions installs FFmpeg and uses the hosted runner's Google Chrome. `CHROME_EXECUTABLE` is optional when allowing Remotion to provision its supported browser. Use the existing checkout; tasks are already isolated and do not need another worktree.

For an interrupted local run, confirm the process is no longer running before removing its `.lock`; never remove an active lock. Normal failures release it. Schema/hash failures require investigating the checkpoint rather than blindly deleting the run. Restore the original artifact or start a new logical run after correcting inputs. Successful stages are not repeated on unchanged retries. To regenerate a diagnosed failed stage, use `--retry-from <stage>` (workflow `retry_from`) with unchanged inputs. Only that stage and downstream checkpoints are invalidated; earlier work remains. Use a new run ID for an already-uploaded video.

If a YouTube upload times out after the durable reservation, check YouTube Studio and the Supabase `upload-<run-id>` entry. If the video exists, reconcile the entry to `{state:"uploaded",fingerprint:<original>,videoId:<actual-id>}`. If absence is confirmed, remove the reservation before an explicitly reviewed retry. The system intentionally does not guess whether a remote upload succeeded.

## Validation and boundaries

Lint, type checking, unit/integration tests and a real cloud demo render are required. Tests cover checkpoint resume/retry, integrity errors, locks, QA/publication gates, unsupported citations, captions, atomic upload reservations and FFmpeg detection of black/silent video. A demo does not test paid OpenAI endpoints or authenticated Google/Supabase operations. Human review remains appropriate before any release; factual coverage and thumbnail/title semantics need editorial judgment.

Demo uses original illustrated shots; production stock-video playback is supported. Captions are speech-timed (eSpeak events in demo; Whisper word timestamps in production). Fact review uses retrieved excerpts and an LLM rather than independent reporting. Workflow files must be committed and triggered on GitHub to validate hosted-runner behavior; local cloud execution alone does not prove a GitHub run succeeded.

### Headless CI rendering

Full Chrome/Chromium paths use Remotion `chrome-for-testing` mode with `headless:true` (`--headless=new`), multiprocess Linux rendering and Chromium-selected 2D rasterization (no forced software ANGLE). The hosted runner supplies Google Chrome; the workflow verifies its version before rendering. Without a custom executable, Remotion uses its matching Headless Shell mode. DBus warnings alone are not proof of a failed browser launch.

Each video/thumbnail render runs in an isolated worker, explicitly closes its shared browser in `finally`, and exits after reporting success or failure. The supervisor tracks owned descendants, including detached browser processes, sends TERM followed by KILL to survivors, and bounds video rendering to 12 minutes and thumbnails to 2 minutes. Browser connection timeout remains Remotion's default 25 seconds; the change does not conceal startup failures by extending it. The generation step has a 18-minute limit and the job a 25-minute limit. Render failures propagate to the stage status and a nonzero CLI exit.

## FREE-FIRST, audio-first long-form (before any final production)

`config/cost-policy.json` governs **all paid API calls**, including OpenAI LLM/TTS/Whisper/images, ElevenLabs narration/music/SFX and injected AI-video adapters. Default ceiling and approval threshold are both **USD 2**; neither can be bypassed by an environment flag. Change the reviewed policy deliberately to authorize a higher budget. Reservations are persisted *before* the request, including failed/uncertain calls; retries retain that spend. `cost-blocked.json` explains a rejected request. Never delete a ledger to bypass a budget.

Every run includes `cost-estimate.json`, `cost-ledger.json`, `cost-report.json`. Categories: GitHub compute, LLM, TTS, transcription, stock, generated images, AI video, music, SFX and storage. `FREE`, `INCLUDED`, `PAID` distinguish free tools from plan allowances. Actual paid invoices are **unknown/null**, never invented. Rates are configurable conservative assumptions, not live quotes. GitHub compute and artifacts can incur charges outside repository allowances; public repository usage and private plan quotas differ. Supabase stores JSON/checkpoints/analytics/provider history only; MP4 files stay in GitHub artifacts during development.

Free LLM: `GeminiProvider` implements the existing interface; `FreeFirstLLM` tries schema-valid Gemini results before budget-guarded OpenAI. Set `GEMINI_FREE_TIER_CONFIRMED=true` only for an eligible free-tier project. Research verifies verbatim source excerpts; factual review and script repetition checks still apply. Free does not remove factual safety rules or establish editorial quality merely by parsing JSON.

Visual order: Commons → Pexels video → Pexels image → local motion graphics → eligible paid images. Commons keeps creator, source URL, license URL, attribution and public-domain status; unrecognized, non-commercial, no-derivatives and fair-use licenses are rejected. CC BY-SA works require complying with share-alike conditions on adaptations. Paid images are limited to high-impact/reconstruction shots when the free alternative falls below the configured technical floor; default maximum 8. AI video defaults disabled. Asset quality scores describe technical suitability/provenance and conservative fallback limitations, **not independent visual-semantic verification**. Production QA rejects below-floor assets; review the historical accuracy of every reconstruction and map before publication.

### Benchmark and duration

`npm run benchmark` uses **YouTube Data API v3**, `channels.list(forHandle)` → uploads playlist → `playlistItems.list` → batched `videos.list`. No `search.list`, scraping or competitor script/media copying. `YOUTUBE_DATA_API_KEY` reads public metadata, entirely separate from publication OAuth. The analyzer scans until it finds the latest **20 qualified videos**, excludes videos under five minutes and live/upcoming/archived livestreams, records optional views/likes as null when absent, and calculates median/mean/p25/p75/min/max in **seconds**. Successful output: `data/benchmarks/ancientlivesHQ.json`; missing keys, API failure and insufficient samples write an error report and exit nonzero. No invented benchmark or estimated replacement.

`config/duration.json` and `TARGET_DURATION_MODE` support `fixed`, `benchmark_median` and `benchmark_range` (midpoint of observed p25/p75), with reviewed safety bounds. Benchmark mode requires a complete report no older than 30 days. `quality_test` targets 10 minutes (configurable 8–12); `longform` uses the benchmark. Demo remains the short offline technical test. LongFormPlanner allocates hook, ACT 1/2/3, payoff, ending and chapter objectives, curiosity loops, facts, emotion, visual needs and music direction. Main-body chapters usually last 3–6 minutes; shorter hook/ending are intentional. Script chapters are generated to word budgets at the configured 140 WPM; missed budgets fail instead of stretching audio. New facts, repetition, repeated 12-word phrases and cliché filler are checked; semantic novelty still needs editorial judgment.

### Narrator, auditions and pronunciation

**Latest cost policy takes precedence:** `TTS_PROVIDER=auto` → local **Kokoro-82M** with voice QA → approved ElevenLabs fallback within the budget. Kokoro and local Whisper run on the Actions CPU; no paid speech service is used for draft auditions. Model/tokenizer downloads are cached. The optional premium historical narrator uses **`eleven_v4`**, documented as supporting 10,000 characters per request. Model/voice are not hardcoded into channel identity: ElevenLabs voice IDs come from GitHub Variables. OpenAI remains an explicit optional alternative.

`config/narrator.json` defines style, language, pace, tone and exclusions. Run **Actions → voice-audition → provider=kokoro**. Default A/B/C voices are `am_michael`, `bm_george`, `bm_daniel`, with the **same original fictional audition passage** (~30–45 seconds). The `voice-audition` artifact includes WAVs, comparison.json, per-voice audio QA, independent local Whisper transcripts and cost comparisons. For premium auditions choose `provider=elevenlabs` only after configuring the secret and comma-separated `ELEVENLABS_AUDITION_VOICE_IDS`. Paid reservations and USD 2 ceiling still apply.

Listen, choose and explicitly pin `approvedProvider` and `approvedVoiceId` in narrator.json, set `voiceApproved=true`, and match the corresponding GitHub Variable. Before pinning the final identity, `paidFallbackVoiceApproved=true` permits the separately auditioned premium backup for quality tests when Kokoro fails. An approved final narrator never silently switches provider/voice between videos; a quality failure requires a new audition/review. Final long-form production is blocked until identity is approved. The automatic pre-approval probe uses intelligibility, timing and signal checks; it does not certify premium expressive performance.

Narration is synthesized per **long narrative chapter**, with preceding/following text for supported providers. Visual scenes never make TTS calls. Lossless scene WAVs are slices of the chapter recording and feed the existing shared editor, captions and shot planner. Chapters have durable audio checkpoints; later failures do not regenerate completed narration. Kokoro's 510-token context limit requires internal sentence-sized inference chunks: the chapter adapter joins these without added pauses, but cannot promise the long-context prosody of ElevenLabs. Local ASR provides real word timings; mismatched transcripts fail instead of assigning guessed timings. Native ElevenLabs character alignment is converted to word timings with independent local ASR available for verification.

Script text and performance metadata are separate (`tone`, `pace`, `pauseAfterMs`, `emphasis`, `pronunciation`, `emotion`, `energy`). ElevenLabs pace maps to documented voice settings; previous/next text retain continuity. Unsupported emotional/pause/emphasis metadata is recorded for review rather than inserted as spoken bracket/SSML instructions. Kokoro varies the channel base speed gently by chapter performance pace, keeping the same voice. This implementation does not claim that every performance parameter is expressively realized by every provider.

Each run writes `pronunciations.json` and a candidate review. Set `PRONUNCIATIONS_PATH` to an approved dictionary following `config/pronunciations.example.json`; supply verified terms/sources rather than invented phonetics. Optional ElevenLabs dictionary ID/version Variables attach real dictionary locators. Production QA requires candidate entries to be verified. Listen to names/dates; the heuristic candidate detector is not linguistic certification.

### Chapter music, mastering and QA

`config/audio.json` sets a gentle high-pass/EQ/de-esser/compression/presence chain, two-pass loudness normalization, true-peak headroom, music automation and sidechain ducking. Master target ~-15 LUFS, true peak <=-1 dBTP; LRA 4–9 is an editorial target, with an optional strict gate on long material. Short auditions can have smaller LRA; the system reports this rather than expanding dynamics artificially.

Production music uses multiple supplied licensed beds in `config/music-library.json` (path, license, direction); a single `MUSIC_PATH` plus `MUSIC_LICENSE` is supported for short tests, and is rejected as the sole bed for long production; procedural audio is only an explicitly recorded fallback. Set `musicProvider=elevenlabs` for **Music v2**, separately generated chapter directions and crossfades. Set `sfxProvider=elevenlabs` for the documented sound-effects endpoint; sparse events are selected semantically (documents, ambience, restrained reveals), not every cut. Paid music/SFX remain under the same ledger and budget. Many minutes of premium music/narration **will exceed USD 2** and cannot run under the default policy.

`audio-qa.json` measures integrated LUFS, true peak, LRA, silence percentage, declared voice identity, duration continuity, unexpected silence, boundary discontinuities, measured narration/music loudness difference, music presence and clipping. Production must pass both stem/master and final AAC checks, including rechecking before upload. Abrupt voice changes use the selected provider trace, not speaker recognition. Prosody restarts, musical appropriateness and names require listening. Longer body shots use ~3–7-second beats; animated information shots can last longer. Hook density and continuous movement remain required.

### GitHub setup for these tests only

1. Settings → Secrets and variables → Actions → Secrets: `YOUTUBE_DATA_API_KEY` (public read), `PEXELS_API_KEY`, optionally `GEMINI_API_KEY`; paid tests additionally need `ELEVENLABS_API_KEY`. Never commit values.
2. Variables: `TTS_PROVIDER=auto`, `ELEVENLABS_MODEL=eleven_v4`, `BENCHMARK_CHANNEL=@ancientlivesHQ`, `TARGET_DURATION_MODE=benchmark_median`, `QUALITY_FLOOR=80`, `MAX_GENERATED_IMAGES_PER_VIDEO=8`. Add `KOKORO_VOICE` after selection; add `ELEVENLABS_VOICE_ID` / `ELEVENLABS_AUDITION_VOICE_IDS` only if premium narration is intentionally tested. `GEMINI_FREE_TIER_CONFIRMED=true` is conditional on free-tier eligibility.
3. Run **benchmark**; download `benchmark-report`. A red run with missing key is an honest blocker; it is not a measured channel median.
4. Run **free-first-smoke**; artifact contains real licensed Commons/Pexels samples and cost plans. Pexels without a key is a failed live check, not simulated success.
5. Run **voice-audition**, default Kokoro. Review the WAVs, QA and comparison. No documentary, no assets for a long production and no publication occur in these workflows.
6. Keep `AUTO_PUBLISH=false` and schedule.autoPublish=false. Configure relevant historical research sources/channel/profile before any eventual quality test or long-form run; existing demonstration research sources are not evidence about Ancient Egypt.

No long documentary should be dispatched until benchmark, voice selection, licensed music, pronunciation review and source sufficiency are resolved. Actions create-video retains resumable demo/production modes and bounded process cleanup. Production duration/timeouts scale with the planned audio; no production run is started by setup or by a schedule.

API references reviewed during implementation: [ElevenLabs models](https://elevenlabs.io/docs/overview/models), [TTS with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps), [Music compose](https://elevenlabs.io/docs/api-reference/music/compose), [Sound effects](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert), [YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list), [Kokoro](https://github.com/hexgrad/kokoro), [Kokoro.js](https://www.npmjs.com/package/kokoro-js).

Validated public benchmark snapshot (2026-10-06): 20 qualified videos from @ancientlivesHQ, median **1,245.5 seconds (20m 45.5s)**, mean 1,174.9s, p25 999.5s, p75 1,373.75s, minimum 714s, maximum 1,594s. The real analyzer used 3 quota units. Source run: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/37527973177. This is a dated metadata snapshot, not a permanent channel rule; rerun the analyzer before production.
