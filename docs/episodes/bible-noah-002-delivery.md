# Noah's ark — bible-noah-002

Owner approved production on 2026-10-18. Original 246-word draft, 90-105 seconds, approved Nano voice, Eli v5 and the existing dynamic editor. This bounded episode uses the same production engine rather than the ten-minute quality-test target.

Draft: `data/scripts/bible-noah-002-editorial-draft.json`. Verified source excerpts and response hashes: `data/research/bible-noah-002/source-check.json`. Topic evidence: https://github.com/gaboplayt24-art/youtube-autopilot/actions/runs/39166077681 .

Preferred title: **Noah's Ark: 3 Details You Probably Missed**. The earlier “most pictures get wrong” wording was softened because the research did not establish how many illustrations are wrong. The three sourced details are rooms, three levels and pitch inside/outside. The old draft's uncertain wood-identification passage is omitted from this narrow episode; the additional wood source returned 403 and was not used. All illustrated reconstruction details stay explicitly interpretive.

Production: `production-validation`, `run_id=bible-noah-002`, `production_kind=production_test`, `style=v5`, `llm_provider=gemini`, `gemini_model=gemini-3.1-flash-lite`, `owner_thumbnail=false`, `publish=true`. Existing rules enforce QA before private upload and the next daily schedule slot, with a minimum three-hour lead. Three original thumbnail variants are generated for this episode; no reuse of the owner's angels cover. Cloudflare reserves quota before calls under the existing $8/month total cap; every other provider stays free-only.

No media or API inference is generated in Codex. CI receives GitHub Secrets. Checkpoints and media remain in Releases, not Actions artifacts. On failure, retain the run ID and restore the newest complete checkpoint with `source_run_id`; never regenerate successful voice/assets from zero.

Three vertical candidates in `data/ideas/bible-noah-002-shorts-candidates.json` are draft passages, not measured timestamps. Reconcile any final factual edits, then run the existing `social-delivery` build against the completed master. Nothing is posted merely because a draft candidate exists.
