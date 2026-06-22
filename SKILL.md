---
name: codex-video-workflow
description: Use when a user asks Codex to research, plan, render, QC, or package a rights-safe local video workflow, especially when integrating html-video, HyperFrames, FFmpeg, voice, subtitles, and evidence logs.
---

# Codex Video Workflow

## Overview

Build local, rights-safe video packages from a brief: research notes, script, storyboard, type-specific visual design, image prompts/assets, voice direction, narration, subtitles, timecode alignment, render, cover/thumbnail design, QC, screenshots, and delivery evidence. The preferred renderer is `html-video` after the storyboard/design step; narration must use local CosyVoice or MeloTTS by default; existing `video-maker`/HyperFrames/FFmpeg remains the fallback and evidence/QC backbone.

Strict execution rule: do not replace this skill with an ad hoc static renderer, one-off SVG slideshow, PPT-style card deck, silent/synthetic placeholder, or shortcut that skips the required design, voice, animation, and QC artifacts. If a fallback is necessary, it must preserve the same design contract, motion language, local TTS policy, subtitles, evidence logs, and final QC gates, and the manifest must mark the renderer as degraded. Static/FFmpeg fallback is not a final delivery path by default; it must fail or be explicitly labeled with `--allow-degraded-renderer`.

## Use This Skill When

- The user wants a reproducible local video from a brief, article, lesson, or script.
- The user asks whether a video repo, SDK, or renderer should be merged into the current `videocreat` workflow.
- The output needs proof: commands, configs, logs, screenshots, final MP4, rights record, QC scorecard, and follow-up risks.
- The topic is creator/marketing/social content, but the exact examples must be original rather than copied from YouTube, X, TikTok, or other creators.

## Do Not Use By Default

- Paid/cloud video APIs, production platform accounts, cloud GPU, private uploads, external TTS, real-person voice cloning, celebrity/likeness imitation, commercial stock, unlicensed music, unlicensed fonts, or platform-restricted assets.
- macOS `say` as a normal final-quality narration path in any language. It is allowed only when the caller explicitly passes `--allow-say-fallback`, and the manifest must mark it as degraded fallback evidence.
- OpenAI Sora Videos API as a default path: official OpenAI docs state Sora video generation models/API are deprecated and scheduled to shut down on September 24, 2026.
- Any copied creator script, shot order, packaging, persona, brand treatment, or recognizable expression. Extract only abstract methods and quality criteria.

## Workflow

1. Audit the local workspace first: read current `video-maker` docs, schemas, workflow scripts, renderer options, quality gates, and prior POC artifacts.
2. Research current external references only when the answer depends on current vendor/platform behavior. Prefer official docs and primary repos.
3. Create a production contract: target platform/aspect/duration, rights boundaries, script budget, visual style, voice/subtitle policy, cover/thumbnail targets, sync strategy, and QC criteria.
4. Plan the video as a video, not slides:
   - Infer video type from the brief, topic, audience, platform, and scenes.
   - Choose a core template kit, visual language, motion language, shot templates, aesthetic direction, and caption-safe layout.
   - Create `workflow/content-presentation-design.json`, `workflow/quality-consistency-contract.json`, `workflow/aesthetic-brief.json`, `workflow/aesthetic-quality-rubric.md`, `workflow/motion-template-selection.json`, `workflow/design-plan.json`, `workflow/image2-prompts.json`, and `workflow/visual-asset-manifest.json` before rendering.
   - `workflow/quality-consistency-contract.json` is mandatory for every run. It must bind the selected template kit, palette, motion template, caption safe area, exact-text ownership, required artifacts, reject list, and per-scene contracts into one final-quality gate.
   - Keep consistency through shared quality bars and gates, not by making every video look the same. Each video must still vary scene roles, shot templates, camera/motion jobs, and visual metaphors according to its content.
   - Design the on-screen content as a complete presentation system: topic type, audience state, content jobs, hierarchy, display logic, visual metaphor, layout system, motion purpose, and reject list.
   - Select an HTML motion template before rendering. Read `references/html-motion-platforms.md` and `references/motion-usage-playbook.md`, choose from `templates/html-motion/motion-template-registry.json` when possible, and create `workflow/motion-template-selection.json`.
   - Route aesthetic work deliberately: `$design`/`DESIGN.md` for durable taste rules, `awesome-design-md` for mature style contracts, Creative Production moodboard/scene/shot explorers for directions, `generative-polish` for premium image finish, and visual-verdict style screenshot review for iteration.
   - Use image2-compatible prompts for original still assets, with deterministic local SVG fallback unless `--image-source image2` is explicitly requested.
   - Reject pure text-card/PPT output for final videos unless the user explicitly asks for slides.
   - Do not remove motion to save render time. Every final video must have scene-level animation or camera/element movement that follows the selected motion language.
   - Do not invent motion randomly. Motion must come from the selected template or a documented custom template, and must serve a named job: reveal, compare, pressure, trace, accumulate, resolve, inspect, or transform.
   - UI composition must follow the selected template kit, safe zones, typography hierarchy, color rules, inserted visual assets, and caption layout from the design artifacts.
5. Plan voice by video type before TTS:
   - Create `workflow/voice-direction.json` and `script/narration-spoken.txt`.
   - If the user asks for口语化/conversational speech, add breathing pauses only after complete sentences or complete semantic beats.
   - Treat comma-like punctuation (`，`, `,`, `、`) as short in-clause pauses, not line-break or sentence-end pauses. If an explicit pause duration is inserted, use `0.5s`; leave sentence-ending punctuation (`。`, `！`, `？`, `!`, `?`) on the backend/default pause.
   - Do not insert pauses between subject and predicate, verb and object, number and unit, or setup and required answer.
   - Use different voice rules for tutorials, explainers, story narration, news analysis, product demos, and documentary narration.
   - Use normal audible口播 loudness. Prefer a clearly present voice mix over a quiet narration; final QC must include `volumedetect` and fail if the voice is not comfortably audible at normal playback volume.
   - Control dynamics, not only average volume. Apply compression/dynamic normalization/limiting/loudness normalization when narration sounds uneven, and record the filter chain.
   - For MeloTTS Chinese narration, use the uppercase language code `ZH`, CPU device by default, and a Chinese default speed around `0.95` unless a different speed is intentionally recorded in the manifest.
6. Build one authoritative timecode plan before final render:
   - Create `workflow/sync-timecode-plan.json` after narration exists. It must define how spoken audio, subtitles, scene changes, progress indicators, and cover-derived opening visuals share timing.
   - Final video duration must be derived from actual generated narration duration plus any video-internal opening cover, not from a fixed sample cap or stale pre-TTS estimate.
   - Split `script/narration-spoken.txt` into `script/frame-narration-segments.json` before TTS. Each visual frame must own exactly one spoken segment, and concatenating those segments must preserve the spoken narration exactly except whitespace.
   - Generate TTS from those frame-bound segments and write actual segment `start`, `end`, and `durationSeconds` into `workflow/voice-subtitle-manifest.json`. Main scene durations, subtitles, and render frame durations must be copied from those actual segment timings.
   - Prefer forced alignment or ASR-assisted alignment when available for long口播. At minimum, scene and subtitle timing must come from the same source, not separate fixed-duration estimates.
   - Do not advance main visual chapters by equal scene duration when the narration is not equal-duration. Fixed-duration scene cuts over long narration are a sync failure.
   - Do not compute main visual timing by dividing total narration duration across frames. Total-duration alignment alone is insufficient; each scene cut must match its corresponding TTS segment.
   - Do not pad a short narration track with silence to satisfy an estimated duration. If TTS emits multiple chunks for one segment, concatenate every ordered chunk before calculating final timing.
   - Verify stream duration delta, `frameAudioTimingBound`, and semantic timing evidence before claiming audio/video sync.
7. Render with the lightest suitable path:
   - Recommended: `html-video` content graph plus per-frame designed HTML after storyboard, then local `cosyvoice_local -> melotts_local` narration, burned-in or otherwise visibly verified subtitles, and QC packaging.
   - Fallback: existing `.agents/skills/video-maker/scripts/video-workflow.mjs` or `.agents/skills/video-maker/scripts/video-maker.mjs --renderer ffmpeg`, only when `html-video` is unavailable or fails after the recorded retry policy. The fallback must be explicitly allowed with `--allow-degraded-renderer` and reported as a draft/degraded renderer; otherwise stop with render failure evidence instead of producing a lower-quality final.
   - For second-pass edits, pass `--base-project <previous-output-dir>` or reuse the same output directory so unchanged covers, voice cache, visual assets, timing evidence, and render logs remain available. Write `workflow/edit-lineage.json` and apply the requested change on top of the previous project instead of recreating the whole package.
8. Design covers before final packaging:
   - Create `workflow/cover-design.json` and separate `cover/*` outputs for each requested platform. Cross-platform requests must produce ratio-specific variants instead of stretching one design.
   - Use `--cover-only` when the user wants an independent cover package before rendering the video. This must still write the click logic, video-internal cover, standalone platform covers, and `delivery-manifest.json`.
   - Default standalone cover targets include YouTube `16:9`, Bilibili `4:3` plus horizontal-safe `16:9`, Douyin/TikTok `9:16`, X video-matching ratio, and X square feed image when useful.
   - The video-internal opening cover is a separate target and must keep the final MP4 aspect ratio. Do not put Bilibili `4:3`, TikTok `9:16`, or any other platform crop inside a `16:9` video unless the whole video is that aspect.
   - The video-internal opening cover must be rendered into the final MP4, not merely exported under `cover/*`. QC must fail if the MP4 render manifest does not prove the opening cover is included.
   - Cover design must express the video's core click promise, curiosity gap, visual subject, emotional signal, and mobile-readable hook. It must not be a title card, platform/spec mock, or visible workflow label.
   - The opening seconds should visually honor the cover promise so the thumbnail and content feel continuous.
9. Write a static delivery review page:
   - Create `delivery.html` in the output directory for every complete video package and cover-only package.
   - The page must be self-contained and pre-render local data into HTML instead of relying on `fetch()` from `file://`.
   - It must show the final video when present, covers/title images, narration, spoken script, storyboard, subtitles, QC summary, workflow evidence, and grouped material links with relative and absolute local file paths.
   - Open `delivery.html` in the default browser after generation unless `--no-open-delivery-page` is passed.
10. Verify before claiming completion: ffprobe metadata, stream duration delta, per-frame TTS segment timing binding, sync-timecode plan, `volumedetect`, `silencedetect`, blackdetect, screenshots, subtitle/audio existence, visible subtitles, video-internal cover evidence, cover artifacts, voice direction, rights record, scorecard, package manifest, delivery page, command log, quality-consistency contract, and screenshot/motion evidence. Do not claim completion when audio is present but too quiet, the口播 drops into long post-opening silence, the renderer became static, the UI no longer follows the design plan, the quality-consistency contract is missing or unenforced, the main visual timing drifts from narration, the cover exists only as a standalone file, the delivery page is missing, or cover artifacts are missing.

## Local Production Run

Run the deterministic local video workflow:

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/authorized-video \
  --mode recommended \
  --voice-backend auto \
  --speech-style conversational \
  --image-source image2-dryrun
```

Expected outputs:

- `renders/final.mp4`
- `final.mp4`
- `script/narration.txt`, `script/narration-spoken.txt`, `script/frame-narration-segments.json`, `script/storyboard.md`, `script/subtitles.srt`
- `workflow/voice-direction.json`
- `workflow/voice-subtitle-manifest.json` with actual per-frame TTS segment timings
- `workflow/final-audio-normalization.json`
- `workflow/sync-timecode-plan.json`
- `workflow/cover-design.json`, `cover/*`
- `workflow/content-presentation-design.json`
- `workflow/quality-consistency-contract.json`
- `workflow/aesthetic-brief.json`, `workflow/aesthetic-quality-rubric.md`
- `workflow/motion-template-selection.json`
- `workflow/design-plan.json`, `workflow/image2-prompts.json`, `workflow/visual-asset-manifest.json`
- `workflow/commands.json`, `workflow/tool-candidate-selection.json`, `workflow/quality-scorecard.md`
- `workflow/timing-summary.json` with stage/category durations and cache-hit evidence
- `logs/ffprobe.json`, `logs/blackdetect.log`, `logs/volumedetect.log`, `logs/silencedetect.log`, `logs/qc.json`
- `screenshots/*.png`
- `AUTHORIZATION.md`, `delivery-manifest.json`, `delivery.html`

Voice defaults:

- `--voice-backend auto`: try `cosyvoice_local`, then `melotts_local`.
- `--voice-backend cosyvoice_local`: prefer CosyVoice, then MeloTTS.
- `--voice-backend melotts_local`: prefer MeloTTS, then CosyVoice.
- `--allow-say-fallback`: optional degraded fallback only; do not use for final-quality videos unless the local TTS environments are unavailable and the limitation is reported.
- Local TTS outputs are cached within the output directory by backend, text, speaker/language, and speed. Reusing the same output directory may skip unchanged TTS work; changing narration or voice settings invalidates the cache.
- Second-pass edits should use `--base-project` or the same `--out` directory to reuse previous covers, voice cache, visual assets, logs, and evidence where the requested change does not invalidate them.

Speech style defaults:

- `--speech-style auto`: infer from video type and brief.
- `--speech-style conversational`: oral creator-style narration with sentence-end pauses only.
- `--speech-style tutorial`: clear step-by-step pacing.
- `--speech-style explainer`: balanced knowledge explanation.
- `--speech-style story`: scene/reveal-driven narration.
- `--speech-style news`: controlled factual analysis.
- `--speech-style product`: crisp demo/benefit pacing.
- `--speech-style documentary`: slower atmospheric narration.

Image defaults:

- `--image-source image2-dryrun`: default. Write GPT Image 2 prompts and insert deterministic local SVG illustrations.
- `--image-source local`: insert only deterministic local SVG illustrations while still recording prompt intent.
- `--image-source image2`: call GPT Image 2 through the OpenAI Images API using `OPENAI_API_KEY`; continue with local fallback only if `ALLOW_IMAGE2_FALLBACK=1` is set and the failure is recorded.

Delivery page defaults:

- `delivery.html`: static local review page with final video playback, covers, scripts, QC evidence, and material links.
- Default behavior opens `delivery.html` in the system browser after generation.
- `--no-open-delivery-page`: write the page but skip launching the browser, useful for CI or batch generation.

## Reference Loading

Load only the reference files needed for the task:

- `references/candidate-matrix.md` for renderer/model/tool choices.
- `references/methodology.md` for script/storyboard/editing method.
- `references/voice-direction.md` for video-type-specific speech style, oralization, and pause rules.
- `references/cover-design.md` for platform-aware thumbnail/cover strategy, artifacts, ratios, and quality gates.
- `references/content-presentation-design.md` for complete on-screen information design, hierarchy, topic-fit, and premium presentation logic.
- `references/aesthetic-system.md` for design taste, skill/capability routing, and visual quality gates.
- `references/design-templates.md` for type-specific visual template kits and image2 insertion rules.
- `references/html-motion-platforms.md` and `templates/html-motion/motion-template-registry.json` for HTML/CSS/JS motion platform routing and reusable template selection.
- `references/motion-usage-playbook.md` for how to use, design, show, and verify motion templates scene by scene.
- `references/quality-gates.md` for pass/fail checks.
- `references/integration-roadmap.md` for how `html-video` fits the current project.
- `references/research-sources.md` for current source URLs and what each source supports.
- `references/failure-cases.md` when renderer/toolchain failure handling matters.

## Output Contract

Final delivery must name the output directory, final MP4 path, validation evidence, and any unverified or manual-review gaps. Do not say the video is platform-ready unless licensing, AI-labeling, platform upload policy, and human editorial review have been completed.
