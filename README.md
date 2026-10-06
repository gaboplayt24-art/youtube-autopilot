# youtube-autopilot

Cloud-first video production with TypeScript, Node.js 22+, Remotion, FFmpeg, OpenAI, YouTube OAuth2, and optional Supabase checkpoint mirroring. GitHub-hosted runners perform the work; no computer needs to remain online.

The first milestone is an original educational video generated in the cloud, with no upload. Demo mode uses an original curated script, real offline eSpeak narration, original illustrated cards, speech-timed captions, a rendered H.264/AAC video, a thumbnail, metadata and a QA report. Production mode retrieves configured sources and uses OpenAI for research, idea generation, writing, factual review, speech and transcription alignment. Original cards remain the default; OpenAI images are opt-in.

This is a working first implementation, not a certification of unattended production readiness. Live OpenAI, YouTube and Supabase integrations need your credentials and end-to-end validation. No public upload or scheduled release has been performed.

## Architecture

`research → ideas → scoring → selection → script → facts → plan → voice → visuals → captions → composition → render → metadata → QA → thumbnail`

Manual private upload, optional gated scheduling, analytics and weekly recommendations are separate commands. Every stage emits Zod-validated JSON under `data/runs/<run-id>/`. Stage status and structured JSONL logs accompany each run. Checkpoint hashes detect changed JSON; video and thumbnail hashes detect changed media. Provider interfaces isolate LLM, TTS, image, optional video and storage implementations. OpenAI and original-card providers are implemented; external video generation is an extension point, not used in the initial pipeline.

A failed stage retries without rerunning completed stages. A lock prevents concurrent local execution. Input/config fingerprints prevent resuming a run with changed configuration. GitHub artifacts preserve checkpoints and media between machines; restore the artifact before retrying. Supabase mirrors completed stages when configured and is mandatory for private uploads, providing an atomic durable upload reservation across Actions runs. An uncertain upload is blocked until reconciled; exactly-once delivery cannot be guaranteed across a YouTube/Supabase transaction boundary.

QA checks source review, missing assets, actual narration duration against scene frames, contiguous timing, sustained black frames, sustained silence, an audio stream, speech-derived caption timing and text coverage, duplicate narration/images, title equality with the approved script, and metadata validity. OpenAI fact checking also evaluates all script assertions. Upload reruns QA and checks media integrity. QA is conservative but does not replace a human factual or editorial review.

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
- `config/style.json`: even pixel dimensions, FPS and image provider (`cards` or `openai`). Background/accent colors configure the original card design.
- `config/competitors.json`: optional channel references and the no-copy rule. References are context only: the implementation does not claim to have retrieved competitor scripts or channel performance. Add authoritative pattern observations as source material when needed.
- `config/schedule.json`: private upload settings and optional future UTC ISO-8601 `publishAt`. Keep automatic publishing disabled during development.

Never invent facts, present speculation as fact, copy competitor scripts or use unlicensed media. Recommendations are written to `data/analytics/recommendations.json`; they do not rewrite hard rules or configuration.

## Secrets and external API setup

Demo video creation requires **no secrets**.

In **Settings → Secrets and variables → Actions**, configure:

| Name | Location | Required for |
| --- | --- | --- |
| `OPENAI_API_KEY` | Repository secret | Production research/writing/review/TTS/transcription; optional image generation |
| `SUPABASE_URL` | Repository variable | Checkpoint mirroring, private-upload ledger, analytics history |
| `SUPABASE_SERVICE_ROLE_KEY` | Repository secret | Supabase server-side access; required for upload |
| `YOUTUBE_CLIENT_ID` | Secret in protected `youtube-private` environment and repository for analytics | OAuth2 |
| `YOUTUBE_CLIENT_SECRET` | Same scope | OAuth2 |
| `YOUTUBE_REFRESH_TOKEN` | Same scope | Private uploads and channel-owner analytics |

Never enter credential values in issues or chat. `.env.example` contains names only; local CLI invocations read process environment variables. Node supports loading `.env` through `NODE_OPTIONS=--env-file=.env`; do not commit that file. `MODE` is descriptive; select mode using `--mode` or the workflow input. Default OpenAI model is `gpt-4.1-mini`; optionally set `OPENAI_MODEL` in the process environment.

For OpenAI, enable API billing and access to the selected chat model, `tts-1`, `whisper-1`, and optionally `gpt-image-1`. Production speech transcription must match the original narration; ambiguous alignment fails instead of silently emitting inaccurate captions. API availability, quotas and costs depend on your account.

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

The initial implementation uses illustrated scenes, not AI-generated video footage. Captions are speech-timed (eSpeak events in demo; Whisper word timestamps in production). Fact review uses retrieved excerpts and an LLM rather than independent reporting. Workflow files must be committed and triggered on GitHub to validate hosted-runner behavior; local cloud execution alone does not prove a GitHub run succeeded.
