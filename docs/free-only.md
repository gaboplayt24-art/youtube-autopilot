# FREE-ONLY model and provider audit

Reviewed official sources on 2026-10-06:

| Component | Implementation | License / billing constraint |
| --- | --- | --- |
| LLM | Gemini Free Tier, official generateContent | Eligible free project must be confirmed; never switch silently to paid LLM |
| Images | Cloudflare `@cf/black-forest-labs/flux-1-schnell`, 4 steps | FLUX Schnell Apache-2.0 model; Cloudflare/BFL service terms still apply |
| Narration | Official Chatterbox Nano 110M via ChatterboxTurboTTS.from_local(..., nano=True), CPU | MIT code/model, built-in Perth watermark retained; cached pinned model |
| Alternate narrator | Kokoro-82M q8, local CPU | Apache-2.0 model, genuine local Whisper timestamps |
| Optional audition C | Cloudflare `@cf/myshell-ai/melotts` | Free allocation; official account token only |
| Depth | `depth-anything/Depth-Anything-V2-Small-hf` | Apache-2.0 Small ONLY, fixed revision; no NC larger weights |
| Benchmark | YouTube Data API channels/playlistItems/videos | Quota counts persisted; no competitor script copying |

Pins: Chatterbox code `5de7a54aa4e5e2baadb0182dde554908b48b85c2`, Nano model `71ccd1d0081b430592cea481f4307e764e07bc64`, Small depth model `5426e4f0f36572d16453bbda7a8389317b1bef99`. Python dependency freeze and Perth commit are in scripts/requirements-cpu-ai.lock. CPU torch wheels are installed first, then the complete pinned environment with `--no-deps` and mandatory `pip check`; this avoids Chatterbox's mutable Perth@master URL conflicting with our immutable Perth pin. CUDA is never downloaded. Chatterbox still has a substantial speech decoder download even though its language backbone is Nano. Cache the model directory and Python environment rather than promising tiny downloads or GPU throughput.

Secret-free development in Codex:

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

Do not copy production credentials into Codex. Real API checks are performed through the manual GitHub workflows; they consume GitHub Secrets. Account ID may be a GitHub Variable or Secret. Pexels is optional and skipped in the legacy stock smoke when absent.

Optional **local CPU-only audition** (no API keys):

```bash
npm ci
bash scripts/setup-cpu-ai.sh
npm run voice-audition-free -- --run-id voice-free-001
```

Run **Actions → quality-test-free** for the real Gemini/Cloudflare test; do not attempt it with production credentials in Codex.

The quality test is deliberately an **imagined historical reconstruction**, with a Gemini-authored 190–210-word script. It evaluates visual/voice quality without fabricated event-specific factual claims. Actual TTS duration must be 60–90s; no stretching or guessed timestamps makes it pass. ASR mismatch fails. Every media stage keeps JSON checkpoints. Same-image reuse requires a matching prompt/bible plus related narration, and distinct editorial crop/motion. Prompt consistency is not a guarantee of identical faces; human review is mandatory before channel identity and pilot approval.

Audio uses the existing high-pass, corrective EQ, mild compression/de-essing, two-pass loudness normalization and limiter. Target -15 LUFS with true-peak headroom; narration/music ducking and fades remain the existing shared pipeline. Auditions are dry mastered narration for voice comparison, not a music bed comparison. Low short-clip LRA is reported rather than artificially expanded. The short quality test uses an explicitly disclosed original CC0 procedural score; choose licensed production beds before the pilot.

`promptctl/elvenspeak` was evaluated as a **local API compatibility server**, not an ElevenLabs billing proxy. It offers Kokoro/Piper and local ElevenLabs-shaped endpoints, but adds a server lifecycle, substituted voice IDs, alignment-capability checks and ambiguous repository licensing metadata (GitHub reported no detected license). This repository already has native interchangeable TTS adapters, so it does not install or depend on elvenspeak. If later licensed/audited, integrate a self-hosted local instance explicitly, require real voice IDs and capabilities, and reject unknown-voice substitution. Never connect unofficial paid proxies, shared accounts, demo exploits or billing bypasses.

Quota reports contain reservations and provider-returned token counts, not fake invoices. Cloudflare actual neurons remain unknown until account analytics/invoice reconciliation. Workers FREE-plan enforcement prevents automatic billing even when other applications consume that account's allowance. External usage cannot be inferred from this repository ledger. Gemini free-tier eligibility is also a truthful operator declaration. GitHub process runtime excludes setup/cache/upload and is not billed job runtime; use Actions timestamps for the complete job.

Cloudflare pricing/schema sources: [official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [FLUX official schema](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/workers-ai-models/flux-1-schnell.json), [MeloTTS official schema](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/workers-ai-models/melotts.json). Model references: [Chatterbox Nano](https://github.com/resemble-ai/chatterbox#chatterbox-nano), [Nano model](https://huggingface.co/ResembleAI/chatterbox-nano), [Depth model/licensing](https://github.com/DepthAnything/Depth-Anything-V2#license), [elvenspeak](https://github.com/promptctl/elvenspeak).
