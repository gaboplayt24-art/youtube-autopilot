Production validation freezes the existing architecture. `final-style-review` performs only the owner-authorized additional source-02 correction and source-01 reassessment, preserves approved 03/04, and uploads STYLE-PREVIEW-FINAL.jpg with a draft channel-art-direction.json. Subjective Gemini scores are advisory; objective anatomy, historical/prop/style/readability defects and corrupted/wrong-sized files still block acceptance. The draft is not an active human approval. The 90-second production test starts only after the owner approves the final four-frame preview. Existing 30-thumbnail public evidence is frozen under data/benchmarks/initial-packaging; production generates topic-specific direction from this dataset without repeatedly rediscovering competitors. Packaging DNA remains permanent owner policy. Target 24-32 visual beats can reuse 8-12 illustrations through progressive reveals and camera/editorial changes; no consecutive identical completed frames. No new visual version, provider or benchmark layer. AUTO_PUBLISH=false; paid API cost $0.

### Current milestone: v4.3 selective style review and packaging v2

Manual **style-packaging-v4-3** reuses the four native 1536×864 Klein sources from the v4.2 review artifact. Source-01 gets actual Gemini density/narrative reassessment without regeneration. Only source-02 may receive one reference-guided adult anatomy correction, with the positive reference and original image as inputs. Original 03/04 remain byte-identical and retain their prior QA; their new density scores are not fabricated. All originals, the candidate, SHA-256 checks, continuity QA and `STYLE-PREVIEW-v4.3.jpg` are retained. A failed correction stops further inference. `resume_run_id` restores completed checkpoints; `benchmark_only=true` resumes packaging without visual inference or rewriting the saved style verdict (a successful packaging-only job never means visual QA approved); an uncertain uncheckpointed inference is blocked from repetition.

Sparse composition can pass: `NARRATIVE_SUFFICIENCY` and `REFERENCE_DENSITY_MATCH` replace the generic richness gate. Anatomy, historical plausibility, reference style, narration fit, no text/watermark and no photo/CGI/code-art remain required. Native 1920×1080/30fps production architecture is unchanged. No video is authorized by this workflow, even when automated QA passes.

`packaging-benchmark-v2.json` separates the owner-selected Ancient Lives HQ/positive-reference visual grammar, compatible faceless illustrated packaging leader, and broad public outlier/idea leader. Packaging weights are 25% relative views, 15% daily velocity, 10% likes, 5% comments, 10% consistency, 10% historical relevance, 25% format compatibility. Creator-face/vlog dependence prevents transferable leadership. Small public samples expose uncertainty without automatically penalizing new channels. Competitor audience geography, CTR and revenue remain unknown.

The benchmark gradually inspects 30 targeted thumbnails balanced across channels, reusing prior actual Vision results when applicable. It selects relative performance, velocity, engagement, recent above-baseline and evergreen examples instead of global absolute views. Source snapshots and cached/new analysis provenance remain explicit. Topic angles are scored before three original titles/concepts; all design/angle scores are heuristics, never performance promises. `config/channel-packaging-dna.json` is persistent owner policy and is never rewritten by automated analysis. Production consumes the same v2 direction before scripts/assets, but remains blocked pending human style approval.

Dispatch from Actions with `run_id=style-v4-3-real-001` and default `source_run_id=37746244518`. Existing GitHub Secrets supply Gemini, Cloudflare and the public YouTube key. The benchmark step has no Cloudflare credentials and cannot generate artwork. Local lint/typecheck/tests need no Secrets. FREE_ONLY=true, PAID_FALLBACK_ENABLED=false, MAX_PAID_COST_USD=0, AUTO_PUBLISH=false.

## Current milestone: native v4.2 + public packaging benchmark

The active identity is a mature, hand-drawn historical editorial cartoon. `VisualStyleEngine` generates original native 16:9 illustrations using **Cloudflare FLUX.2 Klein 4B** and actual `assets/references/style-v4.jpg` bytes as `input_image_0`. Production requests 1920×1080; the four-source audition requests 1536×864. No square crop or geometric-art fallback is permitted. Reference resizing preserves aspect ratio. The old square source-03/04 are internal style evidence only, with provenance under `assets/references/v4-evidence/`.

`BenchmarkPackagingEngine` resolves seed channels and additional competitors with the public YouTube Data API, samples recent long-form uploads, normalizes own-channel baselines and ranks outliers. It never claims access to competitor Analytics or audience geography. Leader scoring weights are 35% relative views, 20% velocity, 15% likes, 10% comments, 10% consistency and 10% historical relevance. Gemini analyzes actual public thumbnails and abstract title patterns. Three original packaging concepts must each score at least 82 before production scripts/assets. These scores are design assessments, not CTR predictions.

To run the current **real** milestone, manually dispatch **style-audition-v4-2** on `main` with `run_id=style-v4-2-real-001`. It uses existing GitHub Secrets `YOUTUBE_DATA_API_KEY`, `GEMINI_API_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` (the account ID may instead be a repository variable). No production secrets or Pexels key are needed locally. The workflow generates exactly four NEW native sources, preserves raw PNGs, dimensions, QA, `STYLE-PREVIEW-v4.2.jpg`, benchmark and packaging reports in `native-packaging-<run_id>`, then stops for human approval. No video or remaining eight scenes is generated. Both stages must succeed for a green run; rejected/partial results are preserved too.

`FREE_ONLY=true`, `MAX_PAID_COST_USD=0`, `PAID_FALLBACK_ENABLED=false`, and `AUTO_PUBLISH=false` remain mandatory. A Cloudflare paid-plan rejection stops the run; it never enables billing or switches to square Schnell. Quota reservations are conservative estimates, not measured usage. Successful API inference does not imply human style approval. Future approved production thumbnails use independently planned native 16:9 artwork and a 3840×2160 Remotion canvas with 0–4 overlay words.

Local validation: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. Resume an interrupted native milestone using the same `run_id` and the previous numeric Actions `source_run_id`; immutable reference/configuration and raw-source hashes are checked before reuse. Change the run ID if the reference or generation configuration changes.

The manual `style-evidence-v4-2` workflow only repackages an existing four-source artifact: it verifies raw source/reference hashes, produces a compact wide-image preview, and recomputes cost counters from the original ledger. It has no production Secrets or inference calls. A green evidence-packaging job means artifact preparation succeeded; it never changes or approves the original style QA.

Earlier milestone documentation below is retained as history; current v4.2 rules take precedence.

# youtube-autopilot

## Current milestone: illustrated art v4, no video

The owner rejected the programmatic v3 SVG artwork. **AI generates the art; Remotion animates the art.** The active configuration is `config/style-lock-v4.json`. People, clothing, objects and environments must be actual FLUX illustrations. React/SVG/CSS provides only camera movement, labels, arrows, underlines, captions and simple explanatory lines. The primary scene and thumbnail renderers reject geometric/debug artwork and missing FLUX/reference-QA provenance.

`style-audition-v4` is the only authorized visual generation workflow for this milestone. It generates 12 original illustrated scenes, not a video. It first sends the actual positive PNG/JPG to Gemini to analyze linework, anatomy/proportions, faces, hands/feet/hair, clothing, fills/shading, backgrounds, props, palette, negative space, composition and density. The resulting descriptor and palette are pinned to the reference hash; the immutable prefix is shared across prompts. Before each FLUX call Gemini checks historical/style consistency and the absence of requested lettering. After generation it compares the reference, original FLUX image and 16:9 delivery. Photography, CGI, geometric clipart, UI/PowerPoint appearance, baked text and damaged crops fail closed.

The checked-in analysis is explicitly **pending**, not a fabricated Gemini result. The inline screenshot is visible in chat but has no downloadable file ID for Actions. Supply the same positive image as a downloadable PNG/JPG, a repository file at `assets/references/style-v4.png`, or an allowed HTTPS image URL. Do not substitute the rejected examples. Study the general illustrative language; never copy exact artwork, characters, branding or compositions.

Actions → **style-audition-v4** → main → `run_id=style-v4-001` → choose reference file/URL. It uses existing GitHub Secrets `GEMINI_API_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` (the account ID may also be an existing variable). Free-plan attestations remain required. No production secrets are needed in Codex. `validate_only=true` runs code validation with zero inference; it is explicitly **not** a completed style audition.

The artifact `style-test-<run_id>` retains:

- `STYLE-TEST-CONTACT-SHEET-v4.jpg`: original FLUX sources, with diagnostic captions outside the artwork.
- `STYLE-TEST-SCENES-v4.jpg`: selected still Remotion presentations with separate labels, arrows and gentle camera movement.
- `style-reference-analysis-v4.json`, `style-lock-v4.json`, `reference-style-QA-v4.json`.
- All individual originals, 16:9 deliveries, rejected attempts, prompts, Gemini evidence, checkpoints and quota/cost/runtime reports.

Schnell's official endpoint returns 1024-square sources, not native 16:9. Prompts reserve a central wide composition; FFmpeg makes a 1920×1080 delivery and Gemini must confirm that heads, hands and essential props survive the crop. The contact sheet preserves the original square outputs so art and editorial framing can be judged separately. No fabricated API dimensions or geometric replacement is used.

`FREE_ONLY=true`, `PAID_FALLBACK_ENABLED=false`, `MAX_PAID_COST_USD=0`, `AUTO_PUBLISH=false`. Quota exhaustion saves evidence and stops. Manually resume with the same `run_id`, `source_run_id` and reference after the reported reset. Actual vendor neuron consumption is unavailable; the report distinguishes conservative reservations from measured usage. No paid fallback and no automatic old-style continuation.

Optional `bash scripts/setup-rembg-cpu.sh` installs local CPU `rembg`; `removeIllustratedBackground` extracts only accepted AI-generated sprites and retains source provenance. It is not required by the full-frame audition. `createIllustratedCharacterSheet` supports six generated poses and actual cross-image continuity QA; it is separate from the 12-image audition and does not run by default.

**STOP after the style audition.** Human approval of the contact sheet is required before any demo/quality video, pilot or documentary. The approved Nano WAV/reference, audio mastering, captions, existing SFX, benchmark, Gemini retries, FFmpeg and Chromium supervisor are preserved. A future API-free demo requires a human-approved illustrated fixture manifest; missing artwork fails rather than drawing placeholder people. The remaining sections document earlier infrastructure; v3 geometric rendering and prior cinematic examples are archived, not approved directions.

**Codex development requires no production secrets.** Run lint, typecheck and tests locally with public dependencies and mocked API contracts. Keep production keys exclusively in GitHub Secrets and validate live APIs through manual Actions workflows. Pexels is never required for these checks or the historical production pipeline.

Cloud-first video production with TypeScript, Node.js 22+, Remotion, FFmpeg, interchangeable free/paid providers, YouTube OAuth2, and optional Supabase checkpoint mirroring. GitHub-hosted runners perform the work; no computer needs to remain online.

The visual engine uses the same Remotion composition in demo and production. Demo uses a 60–90 second original illustrated narrative with no external APIs. Production uses configured live providers; those integrations require credentials and separate validation. Public publishing remains disabled.

## Audio-first architecture

`benchmark duration → cost estimate → research → ideas → scoring → selection → chapter script/performance → facts/pronunciations → chapter TTS → transcription/word timing → captions → semantic shots → guarded assets → chapter music/audio mastering → audio QA → composition → render → metadata → visual/final audio QA → three thumbnails`

Scenes organize the narrative. `ShotPlanner` cuts at speech-derived word boundaries, normally every 2–4 seconds; it never invents narration duration. `HookDirector` gives the first 5 seconds an image-led opening and introduces restrained pattern interrupts through 30 seconds. Zod schemas validate every checkpoint, with per-run input fingerprints, JSON/media checksums, locks and structured logs. A failed stage resumes without regenerating previous stages. The style fingerprint requires a fresh run ID when restoring older engine artifacts.

Default output is **1920×1080, 30 fps, H.264/AAC**. 3840×2160 is supported by dimensions in config/style.json; previewing/benchmarking a 4K hosted run is still recommended before routine use. Thumbnails render independently at 1280×720, never by capturing the video's first frame.

The reusable motion library includes camera push/pull, pan, Ken Burns, parallax, subtle shake, blur/light transitions, depth, masks, highlights, underlines, counters, timelines, conceptual map paths, charts, headlines, documents, quotes and illustrated characters. Every shot has a moving background. Static assets are original detailed SVG illustrations in demo, not title-only cards. The active historical visual system uses original 2D educational scene graphs in the same compositor; generated imagery remains optional and must pass the new style gate.

Captions use short cues and retained word timestamps, large type, safe margins, high contrast and active-word emphasis. Presets are per visual profile. The demo TTS is intentionally synthetic; it is not an example of a premium production voice.

`config/visual-profiles/{history,psychology,finance,stickman,documentary}.json` selects asset tendencies, caption treatment, camera direction, colors, audio levels and spending limits. Change `config/style.json.visualProfile` to choose a profile. The technical demo remains a schematic **fictional spotlight metaphor**: maps are conceptual and charts are explicitly illustrative, not empirical psychological findings.

Audio stems are normalized in separate FFmpeg passes before mixing (compatible with Ubuntu FFmpeg 6.1), with an independent narration input for the ducking detector: normalized narration, compression, limiter, original ambient score (or a licensed local track), narration sidechain ducking, fades and sparse procedural SFX. Whoosh, impact, riser, click, page-turn, camera, transition and ambient event synthesis are supported. Music/SFX levels are configurable per profile. The narration remains dominant. Detailed vector backgrounds are rasterized once to PNG before rendering; camera motion and editorial graphics remain animated, avoiding repeated SVG rasterization on hosted CPU runners.

## Providers, fallbacks and costs

Interfaces isolate LLM, image, stock, video, TTS, transcription, music and sound-effects providers. FREE-ONLY uses Gemini Free Tier, local Chatterbox Nano/local Whisper, Cloudflare FLUX and Depth Anything V2 Small. Kokoro is a local alternative; Commons/Pexels adapters are retained for explicitly requested licensed editorial material. OpenAI and ElevenLabs are optional guarded alternatives. Demo ignores external provider switches and makes no external API calls.

A configured AI-video adapter may be injected via the VideoProvider interface. No vendor-specific AI-video adapter or key is included. Historical production uses the locked educational 2D grammar, constrained by period evidence. Cloudflare integrations remain available for explicitly approved new-style assets. Free quota exhaustion pauses with checkpoints. AI video is off, paid providers are blocked by default. Failed, empty or too-short media cannot produce a blank shot. No global verification bypass is used. External stock URLs/licenses and fallback failures are retained in visuals.json.

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

All workflows support `workflow_dispatch`. There are no scheduled publishing triggers. `AUTO_PUBLISH=false` is enforced in the workflows and `config/schedule.json` has `autoPublish:false`, `privacyStatus:"private"`, and `publishAt:null`.

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
| `PEXELS_API_KEY` | Repository secret | Optional licensed stock adapter, not the historical visual default |
| `ELEVENLABS_API_KEY` | Repository secret | Optional disabled premium voice/music/SFX; normal production uses local Nano |
| `ELEVENLABS_VOICE_ID` | Repository variable | Voice selection for ElevenLabs |
| `OPENAI_API_KEY` | Repository secret | Optional disabled legacy providers; Gemini/local models handle normal production |
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

## FREE-ONLY historical architecture

Current defaults: `FREE_ONLY=true`, `PAID_FALLBACK_ENABLED=false`, `MAX_PAID_COST_USD=0`, `AI_VIDEO_ENABLED=false`, `AUTO_PUBLISH=false`. Every positive expected provider cost is rejected before the request, even when a key exists. Premium adapters are compatibility options; activating them requires deliberately reviewing both policy and flags. There is no Brave, Fal.ai, paid-image or ElevenLabs requirement.

Gemini Free Tier handles planning, synthesis, scripts, fact review, shot prompts, visual bible, thumbnail concepts, metadata and multimodal semantic QA for the short quality test. YouTube Data API supplies real benchmark metadata; existing trusted-source fetching remains unchanged. `GEMINI_FREE_TIER_CONFIRMED=true` requires an actually eligible free-tier project, not merely possession of a key. 429 responses checkpoint and stop without switching to paid OpenAI.

`CloudflareWorkersAIImageProvider` calls the official `@cf/black-forest-labs/flux-1-schnell` REST endpoint. Its published contract supports `prompt`/`steps`, not configurable image dimensions. A square image is cropped/reframed to 16:9 and upscaled for 1080p composition; this is not native 1080p generation. A per-video Zod visual bible fixes era, location, architecture, characters, clothing, materials, light, camera/lens, grade, realism, film texture and forbidden anachronisms. AI reconstructions are explicitly disclosed and cannot serve as historical evidence.

Workers AI grants 10,000 free neurons/day, resetting at 00:00 UTC. Each four-step FLUX request reserves **64 neurons** conservatively (published estimate: 4 tiles ×4.80 +4 steps ×9.60 =57.60), including failures whose consumption is uncertain. Optional MeloTTS reserves 128/call, with text capped at 1,000 characters. Reservations are **not measured vendor neurons**: `free-quota-report.json` separates them and leaves actual usage null. Verify account totals in Cloudflare's dashboard. Require a **Workers FREE plan**, confirmed with `CLOUDFLARE_FREE_PLAN_CONFIRMED=true`; paid accounts are refused because another application could consume the account allowance and cause billing despite our ledger. Exhaustion stops, saves checkpoints, and resumes after reset. All new inference workflows and create-video share a concurrency group and restore the latest `free-quota-ledger` artifact, including failures. Artifacts expire after 30 days; account free-plan enforcement remains essential.

Depth estimation pins **Depth Anything V2 Small**, Apache-2.0, to a fixed revision and runs on CPU. Base/Large/Giant weights are never accepted. Soft foreground/midground masks and a complete blurred background feed bounded Remotion 2.5D parallax, perspective, camera movement, fog, particles, rays and grain. This is relative-depth approximation, not full 3D reconstruction or inpainting. Related shots may share `assetKey` and identical `assetPrompt`, with different `editorialReframe`/motion; changed prompts or corrupt checkpoints fail. Review disocclusion artifacts and historical details manually.

`cost-report.json` records paid-provider spend as zero when no paid calls were made; optional paid reservations remain unknown/null until reconciled with invoices. `free-quota-report.json` tracks Gemini requests/token metadata, reserved Cloudflare neurons, YouTube quota units, generated images, synthesized minutes and process runtime. Actions job runtime/billing is separate and must be read from the workflow. GitHub compute/artifacts are free only within the repository's plan/allowances. Local model inference does not require an API subscription.

See [the FREE-ONLY setup and model audit](docs/free-only.md) for exact configuration, workflows, licensing and limitations.

### Benchmark and duration

`npm run benchmark` uses **YouTube Data API v3**, `channels.list(forHandle)` → uploads playlist → `playlistItems.list` → batched `videos.list`. No `search.list`, scraping or competitor script/media copying. `YOUTUBE_DATA_API_KEY` reads public metadata, entirely separate from publication OAuth. The analyzer scans until it finds the latest **20 qualified videos**, excludes videos under five minutes and live/upcoming/archived livestreams, records optional views/likes as null when absent, and calculates median/mean/p25/p75/min/max in **seconds**. Successful output: `data/benchmarks/ancientlivesHQ.json`; missing keys, API failure and insufficient samples write an error report and exit nonzero. No invented benchmark or estimated replacement.

`config/duration.json` and `TARGET_DURATION_MODE` support `fixed`, `benchmark_median` and `benchmark_range` (midpoint of observed p25/p75), with reviewed safety bounds. Benchmark mode requires a complete report no older than 30 days. The manual **doodle-quality-free** workflow reuses the approved Nano passage unchanged (approximately 100 seconds). The former painted quality-test-free entry point is cancelled. After manual voice/image approval, the existing create-video `quality_test` option remains the **8–12 minute pilot**; `longform` uses the benchmark. Do not run either long option yet. Demo remains the short offline technical test. LongFormPlanner allocates hook, ACT 1/2/3, payoff, ending and chapter objectives, curiosity loops, facts, emotion, visual needs and music direction. Main-body chapters usually last 3–6 minutes; shorter hook/ending are intentional. Script chapters are generated to word budgets at the configured 140 WPM; missed budgets fail instead of stretching audio. New facts, repetition, repeated 12-word phrases and cliché filler are checked; semantic novelty still needs editorial judgment.

### Narrator, auditions and pronunciation

The primary English narrator is native **Chatterbox Nano**, loaded from the official resemble-ai/chatterbox code and pinned MIT model on CPU. `KokoroProvider` remains the zero-cost alternate; choose it explicitly before pinning channel identity if Nano does not meet your needs. Optional `MeloTTSProvider` uses the Cloudflare free-plan allocation. No narrator changes occur after human approval/pinning. ElevenLabs requires paid-fallback flags and an authorized positive budget; FREE_ONLY blocks it even with a valid secret.

Run **Actions → voice-audition-free**. A is Chatterbox Nano, B is Kokoro `am_michael`, C is a bounded CPU probe/full attempt for Qwen3-TTS when practical, and D is MeloTTS only when Cloudflare's free plan is confirmed. Every candidate receives the same 60–90-second source-grounded historical passage and identical mastering. The artifact preserves raw WAVs, mastered WAVs, Whisper Small transcripts with word timestamps, normalized comparisons, WER/substitution/insertion/deletion counts, critical-term checks, pause/continuity evidence, loudness metrics, generation time, RTF, memory evidence, long-form extrapolations, and `human-listening.html`. Optional C/D are explicitly skipped or marked failed without a substitute WAV. WER thresholds are configurable in `config/voice-qa.json`; a low WER still fails if names, dates, places, dynasties, numbers, or other declared critical terms change. There is no automatic winner. Listen and pin approvedProvider/approvedVoiceId in narrator.json only after your choice; the audition does not modify channel identity. Existing voice-audition remains available for legacy adapters, now under the zero-dollar guard.

Narration is synthesized per **long narrative chapter**, with preceding/following text for supported providers. Visual scenes never make TTS calls. Lossless scene WAVs are slices of the chapter recording and feed the existing shared editor, captions and shot planner. Chapters have durable audio checkpoints; later failures do not regenerate completed narration. Kokoro's 510-token context limit requires internal sentence-sized inference chunks: the chapter adapter joins these without added pauses, but cannot promise the long-context prosody of ElevenLabs. Local ASR provides real word timings; mismatched transcripts fail instead of assigning guessed timings. Native ElevenLabs character alignment is converted to word timings with independent local ASR available for verification.

Script text and performance metadata are separate (`tone`, `pace`, `pauseAfterMs`, `emphasis`, `pronunciation`, `emotion`, `energy`). ElevenLabs pace maps to documented voice settings; previous/next text retain continuity. Unsupported emotional/pause/emphasis metadata is recorded for review rather than inserted as spoken bracket/SSML instructions. Kokoro varies the channel base speed gently by chapter performance pace, keeping the same voice. This implementation does not claim that every performance parameter is expressively realized by every provider.

Each run writes `pronunciations.json` and a candidate review. Set `PRONUNCIATIONS_PATH` to an approved dictionary following `config/pronunciations.example.json`; supply verified terms/sources rather than invented phonetics. Optional ElevenLabs dictionary ID/version Variables attach real dictionary locators. Production QA requires candidate entries to be verified. Listen to names/dates; the heuristic candidate detector is not linguistic certification.

### Chapter music, mastering and QA

`config/audio.json` sets a gentle high-pass/EQ/de-esser/compression/presence chain, two-pass loudness normalization, true-peak headroom, music automation and sidechain ducking. Master target ~-15 LUFS, true peak <=-1 dBTP; LRA 4–9 is an editorial target, with an optional strict gate on long material. Short auditions can have smaller LRA; the system reports this rather than expanding dynamics artificially.

Production music uses multiple supplied licensed beds in `config/music-library.json` (path, license, direction); a single `MUSIC_PATH` plus `MUSIC_LICENSE` is supported for short tests, and is rejected as the sole bed for long production; procedural audio is only an explicitly recorded fallback. Set `musicProvider=elevenlabs` for **Music v2**, separately generated chapter directions and crossfades. Set `sfxProvider=elevenlabs` for the documented sound-effects endpoint; sparse events are selected semantically (documents, ambience, restrained reveals), not every cut. Paid music/SFX remain under the same ledger and budget. All positive-cost music/narration requests are blocked by the zero-dollar policy.

`audio-qa.json` measures integrated LUFS, true peak, LRA, silence percentage, declared voice identity, duration continuity, unexpected silence, boundary discontinuities, measured narration/music loudness difference, music presence and clipping. Production must pass both stem/master and final AAC checks, including rechecking before upload. Abrupt voice changes use the selected provider trace, not speaker recognition. Prosody restarts, musical appropriateness and names require listening. Longer body shots use ~3–7-second beats; animated information shots can last longer. Hook density and continuous movement remain required.

### GitHub setup for these tests only

1. Keep existing repository Secrets `GEMINI_API_KEY`, `YOUTUBE_DATA_API_KEY`. Add `CLOUDFLARE_API_TOKEN`; set `CLOUDFLARE_ACCOUNT_ID` as a repository Variable (or an existing Secret) (Workers AI Run permission for this account). Never paste values into tracked files.
2. Confirm the free plans using the workflow's `gemini_free_tier_confirmed` / `cloudflare_free_plan_confirmed` checkboxes, or repository Variables `GEMINI_FREE_TIER_CONFIRMED=true` / `CLOUDFLARE_FREE_PLAN_CONFIRMED=true`. These are non-secret declarations of actual billing settings, not permission to use paid plans. Paid overflow protection depends on their accuracy. Keep auto-publishing disabled.
3. Run **benchmark** for real metadata statistics; it does not retrieve competitor scripts. The Nano narrator is already approved; do not repeat auditions.
4. Use the manual **doodle-quality-free** workflow described below for the new visual preview. The old quality-test-free entry point is cancelled.
5. Preserve checkpoints on failure. Old painted runs must never resume. Use a new-style run ID and its artifact for manual prototype retries.
6. Review image/voice quality and source accuracy before authorizing an 8–12-minute pilot. Only after human visual approval, record it in style-lock-v3.json and strategy.imageQualityApproved; narrator approval is already pinned. No long documentary is automatically dispatched.

Validated public benchmark snapshot (2026-10-06): 20 qualified videos from @ancientlivesHQ, median **1,245.5 seconds (20m 45.5s)**, mean 1,174.9s, p25 999.5s, p75 1,373.75s, minimum 714s, maximum 1,594s. The real analyzer used 3 quota units. Source run: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/37527973177. This is a dated metadata snapshot, not a permanent channel rule; rerun the analyzer before production.

The channel owner approved the reference-cloned Chatterbox Nano narrator for the near-90-second quality milestone. The new `doodle-quality-free` workflow lists Gemini models before inference and uses only discovered `generateContent` models in order 3.8 Flash, 3.6 Flash, 3.5 Flash, 3.1 Flash Lite. Transient errors retry the same model with jitter and Retry-After before fallback. Per-call JSON caches and stage checkpoints are retained in the artifact; resume with the same run_id and source_run_id.

## Active visual direction: educational-doodle-v3

The ONLY active visual identity is `config/style-lock-v3.json`: flat 2D educational schematic/doodle storytelling, thick dark outlines, simple semi-stickman characters, fixed earth tones and cream backgrounds. Photography, painterly realism, CGI, movie stills, realistic actors, cinematic lighting/depth of field and clutter are rejected. Competitor analysis informs general educational grammar only; no copied artwork, scripts, cast, branding or layouts.

`VisualThinkingDirector` turns measured narration beats into typed visual ideas: CHARACTER_EXPLANATION, ICON_EXPLANATION, COMPARE_TWO, HIERARCHY, PROCESS, MAP, TIMELINE and WARNING. Gemini chooses WHAT; original vector primitives and the immutable lock define HOW. Ideas contain at most four nodes, simple poses, short labels and supported relationships. Dates/numbers cannot be added without narration evidence. Labels are composed by the editor, never random AI typography. `DoodleScene` progressively reveals nodes/arrows and applies restrained 2D pan/zoom; no film grain, vignette, light leaks or photographic depth. Original vector art and independent 1280×720 thumbnails share the fixed palette.

The original infrastructure remains: Gemini discovery/retry/fallback, Cloudflare adapters, free quota and cost ledgers, checkpoints, Remotion/FFmpeg, benchmark analyzer, WER/critical-term voice QA, mastering and captions. The approved Nano narrator and `assets/voice/narrator-reference.wav` are unchanged. Do not run more narrator auditions.

**Cancelled:** the old `quality-style-lock-001` continuation. Its workflow is disabled in GitHub, its configuration is disabled, and its cron is removed. Both old painted quality/image-smoke CLIs fail before provider calls. Their checkpoints, old style lock and actor registry remain technical evidence only. Historical documentation is in [docs/legacy-visual-audition.md](docs/legacy-visual-audition.md), not active directions.

**Manual new-style preview:** Actions → **doodle-quality-free** → main → new `quality-doodle-...` run ID. The default narration source is the smaller paused artifact from run 37606098544: the restoration helper copies ONLY the already approved script, raw WAVs, ASR/timestamps and voice QA; no previous images. Gemini uses existing GitHub Secrets to plan educational ideas and review actual rasterized frames BEFORE render. Original authored vectors consume no Cloudflare requests. Lint/typecheck/tests, audio QA, 1080p rendering, ffprobe evidence, representative frames, WAVs and three thumbnails are retained in `quality-test-<run_id>`. The cloud prototype uses the same compositor as demo/production and remains subject to human visual approval. A local API-free proof can use original scene fixtures; `--offline-preview` explicitly labels semantic review as unrun.

Structural QA rejects missing ideas, invented numeric labels, invalid graph relationships and consecutive identical concepts. Actual-image Gemini review rejects obsolete styles, mismatched ideas, unreadable/overlapping labels and period errors. Structural success is never presented as semantic/historical approval. Production remains blocked by `visualSystemApproved=false` and `strategy.imageQualityApproved=false`. Future automatic continuation additionally requires an explicit dated approval and a new-style run created afterward; it cannot revive pre-approval or old-style runs.

Rejected new-style ideas are repaired selectively from their actual frame-review findings, preserving all narration times and untouched ideas. Versioned layout/acceptance checkpoints retain original rejected PNGs and reports. Hierarchy arrows follow the declared relationship direction; relation labels sit beside the figure column. Bulk inventory uses a group of illustrated objects, not a single icon with a plural label. Bounded repairs must receive a fresh actual-image pass before rendering; no failed review is overwritten or forced to pass.

Keep `AUTO_PUBLISH=false`, `FREE_ONLY=true`, `PAID_FALLBACK_ENABLED=false`, `MAX_PAID_COST_USD=0`. No paid service, public publication or long pilot is enabled.
# v4 first-four quota gate

Cloudflare errors are classified from their sanitized internal codes: 429/3036 pauses until UTC midnight; 429/3040 retries the same request five times with jitter (5/15/30/60/120 seconds) and honors Retry-After; an unknown 429 receives three conservative retries (10/30/60 seconds). Temporary exhaustion checkpoints a later capacity retry, never a daily reset. `cloudflare-error.json` and structured logs preserve only sanitized diagnostics. Failed capacity/account-limit requests release their local reservations unless measured consumption is reported; actual consumption is never inferred from an estimated reservation. HTTP 403/5035 refuses models requiring a paid plan.

`resume-style-capacity` checks eligible checkpoints every 15 minutes and supports manual dispatch. It is scoped to `style-v4-real-002`, reuses its exact artifact and reference, and permits at most three automatic continuations. It never resumes daily exhaustion, failed style QA or videos. Disable it with `config/style-capacity-retry.json` or the Actions workflow switch. GitHub scheduling can be delayed; the checkpoint timestamp is the earliest retry time.

The real style audition first generates exactly four representative samples (character, interaction, daily life and historical explanatory action), with no regeneration at this gate. Each receives actual-reference Gemini QA. `STYLE-PREVIEW-v4.jpg`, `source-01.png` through `source-04.png`, and `first-four-reference-style-QA-v4.json` retain the evidence even if style fails. Any failed sample stops generation of the remaining eight. On success, the final artifact includes all twelve raw `source-NN.png` files and the two final contact sheets. No video is authorized by this gate.
