# Codex Video Workflow Skill

English | [简体中文](README.zh-CN.md)

Produce reviewable narrated videos from a brief: script first, render second, evidence at the end.

`codex-video-workflow` is a local Codex skill for planning, rendering, and validating rights-safe explainer, product, tutorial, and oral-series videos. It does not treat video generation as a single black-box render. It creates the narration material, voice direction, visual system, motion plan, cover package, subtitles, screenshots, and QC report as inspectable artifacts.

> This is an independent, community-maintained project. It is not affiliated with, sponsored by, or endorsed by OpenAI. OpenAI and Codex are trademarks of their respective owner.

## Demo

Open the visual-effects showcase:

[Launch the Galacean-style VFX showcase](media/galacean-vfx-showcase.html)

| Chinese oral-series cut | English oral-series cut |
| --- | --- |
| ![Chinese demo cover](media/codex-video-workflow-zh-cover.svg) | ![English demo cover](media/codex-video-workflow-en-cover.svg) |
| Chinese workflow cover fixture. | English workflow cover fixture. |

Rendered voice and video binaries are intentionally excluded from the public source repository. Generate them locally with assets you are authorized to use; the resulting package contains its own QC and provenance evidence.

## What It Does

- **Narration before rendering**: writes the oral script and TTS-ready spoken text before video generation.
- **Voice policy**: keeps comma-like punctuation as short in-clause pauses and only inserts semantic line breaks after complete sentences or beats.
- **Content presentation design**: selects a visual system, aesthetic brief, motion template, and scene metaphor before render.
- **Local voice path**: supports local CosyVoice and MeloTTS for authorized narration in both Chinese and English final-quality runs.
- **HTML motion rendering**: uses the local `html-video` renderer when available, with FFmpeg fallback paths recorded in the logs.
- **Remotion-inspired motion primitives**: borrows Remotion frame-driven timing, easing, transition accounting, and text-animation rules to make `html-video` scenes more dynamic without replacing the renderer.
- **Image prompt manifest**: can write GPT Image 2-compatible prompts while consuming Codex built-in `image_gen` bitmap assets or recording prompt-pending local review assets.
- **Cover package**: uses a Codex built-in Image 2 / `image_gen` integrated-typography cover route by default. The title, subtitle, badge, visual subject, lighting, and material finish are expected inside the cover bitmap; direct OpenAI Images API usage is only an explicit opt-in path.
- **Personal-IP diagram route**: can activate `ip-diagram-creator` style planning for explicit personal IP, creator persona, knowledge-card, Agent-collaboration, PPT/course, or livestream teaching briefs without turning every tutorial into one house style.
- **Video-tool fusion**: borrows bounded capabilities from Video-Use, FFmpeg, HyperFrames, Remotion, Manim/D3, and reference-video QC while keeping this workflow as the script, timing, voice, cover, render, packaging, and QC governor.
- **Visual effects layer**: can plan Galacean/effects-runtime-style particles, fireworks, energy beams, scans, 2D/3D accents, and transition bursts as optional scene layers inside the visual motion system. Effects must have a semantic job, safe placement, asset rights, fallback, and screenshot/motion QC evidence.
- **Whiteboard layered reveal**: supports marker/hand-drawn foreground reveal over the existing designed scene background, while subtitles and captions remain topmost.
- **Free commercial-compatible stock material engine**: derives scene queries from the narration or material brief, fetches/normalizes B-roll from authorized local files, direct URLs, NASA, Pexels, Pixabay, or local fixtures, writes a source/license/hash ledger, and inserts the clips into the rendered scene design.
- **Incremental repair**: can patch a single scene window on top of a previously generated package and emit incremental lineage, timing, screenshots, decoder checks, and QC evidence.
- **QC evidence**: emits final MP4, screenshots, subtitles, manifests, FFprobe data, black-frame checks, volume checks, and `logs/qc.json`.
- **Final loudness normalization**: raises delivered MP4 narration to a clear playback level and records the filter in `workflow/final-audio-normalization.json`.

## How Users Trigger Capabilities

Users do not need to know template IDs or JSON fields. Describe the viewing experience in natural language, for example:

- `Reveal the process layer by layer and draw an animated line between the steps.`
- `Keep the personal-IP page unchanged; add only foreground circles, underlines, semantic paths, and subtitles.`
- `Make this feel interactive and progressive instead of a static slide deck.`

The conversation should surface only the 2-3 capabilities relevant to the current content. The default full-auto flow continues through planning, generation, render, QC, and packaging. Semi-auto/custom mode writes a reviewable configuration page only when the user explicitly requests configuration or page review.

Use four stable user-facing signals: no visual-mode signal selects the default HTML animation and its content-driven layered semantic-motion flow, now styled with the personal-IP visual grammar without activating a persona; `personal IP` selects verified native personal-IP pages with foreground motion off; `personal IP + animation` combines the stable native page with continuous cue-bound progress, focus, connector, and draw-reveal foreground layers; and `whiteboard` selects the framework animation plus a behind-content whiteboard reveal. Explicit `personalIpAnimation` / `addHandDrawnImageAnimation` fields override natural language. A plain `personalIp` field resolves animation to `off`.

For deterministic triggering, set `brief.layeredMotion.mode` to `semantic-path` or pass `--layered-motion semantic-path`. The run writes `workflow/layered-motion-plan.json`, and `semi-auto-config.html` shows the selected layered-motion preview. See `assets/examples/layered-semantic-motion-brief.json` for a complete example.

## Quick Start

Install this skill into a Codex skill folder:

```bash
mkdir -p ~/.codex/skills
rsync -a .agents/skills/codex-video-workflow ~/.codex/skills/
```

Or install it into a workspace-local skill folder:

```bash
mkdir -p /path/to/project/.agents/skills
rsync -a .agents/skills/codex-video-workflow /path/to/project/.agents/skills/
```

Restart Codex after copying so the skill list refreshes.

## Requirements

Required:

- Node.js 18+
- FFmpeg / FFprobe
- local CosyVoice or MeloTTS workspace for production narration

Optional:

- local `html-video` clone/build at `research/html-video-research/html-video/packages/cli/dist/index.js`
- macOS `say` only for explicitly degraded smoke checks
- macOS Quick Look (`qlmanage`) for the FFmpeg fallback card path
- `OPENAI_API_KEY` only when running the direct API path with `--image-source image2`; Codex built-in `image_gen` assets do not require it.
- Free-stock provider keys only when those adapters are enabled: `PEXELS_API_KEY` for Pexels and `PIXABAY_API_KEY` for Pixabay. The NASA adapter is no-key. The `fixture` adapter is only for local demo/smoke validation and is not publication-ready external stock.
- Galacean/effects-runtime package and project-authored or explicitly licensed effect JSON/textures/models only when the visual-effects layer is active. The runtime does not make third-party effect assets publication-ready by itself.

The default scene-image path is `image2-dryrun`: it writes GPT Image 2 compatible prompts without calling the OpenAI API. Covers are different: the normal final-quality cover path is Context Image2 / Codex built-in `image_gen`. The workflow first writes the core cover strategy and prompts, including `workflow/context-image2-cover-requests.json` and `prompts/context-image2-covers/*.txt`; generate the complete cover from those requests in the Codex app, save it under the project, then ingest it so the workflow verifies ratio and upload readiness. Files named with `cover`, `thumbnail`, `封面`, `海报`, `integrated`, `typography`, `final`, `完整`, `成品`, or `带字` are automatically prioritized as complete cover assets.

Runtime defaults are centralized in `assets/runtime-defaults.json`. Each run writes `workflow/runtime-config.json` with the resolved image, voice, material, cover, and frame-limit policies. Command-line flags and brief fields can override the defaults, but environment capabilities such as `OPENAI_API_KEY` only enable explicit routes; they do not silently change the default `image2-dryrun` path.

## Validate Install

Run from the target workspace:

```bash
node --check .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs
node --check .agents/skills/codex-video-workflow/scripts/self-test-full-framework.mjs
node .agents/skills/codex-video-workflow/scripts/validate-voice-pause-policy.mjs
node .agents/skills/codex-video-workflow/scripts/validate-cover-targets.mjs
node .agents/skills/codex-video-workflow/scripts/self-test-capability-routing.mjs --out-root /tmp/codex-video-workflow-capability-routing
node .agents/skills/codex-video-workflow/scripts/self-test-full-framework.mjs --out-root /tmp/codex-video-workflow-full-framework
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/codex-video-workflow
```

## Smoke Test

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/install-smoke \
  --mode recommended \
  --duration 30 \
  --voice-backend melotts_local \
  --speech-style conversational \
  --image-source image2-dryrun
```

Cover-only prompt/review package without binding generated cover assets:

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/cover-only \
  --cover-only \
  --speech-style conversational \
  --image-source image2-dryrun
```

Final-quality cover package with Codex built-in Image 2 assets:

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/cover-only-codex-image2 \
  --cover-only \
  --speech-style conversational \
  --image-source codex-builtin \
  --codex-image-assets-dir research/codex-video-workflow-inputs/codex-image2-covers
```

The asset directory should contain project-bound cover images generated in Codex/Cos X Image 2, preferably native target-ratio files such as `horizontal-16x9-integrated-cover.png`, `horizontal-4x3-integrated-cover.png`, `vertical-9x16-integrated-cover.png`, `vertical-3x4-integrated-cover.png`, `reels-420x654-integrated-cover.png`, and `square-1x1-integrated-cover.png`.

English demo path with the same local voice workflow:

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/media/oral-materials/skill-capability-brief-en.json \
  --out research/codex-video-workflow-promo/runs/skill-capability-oral-series-en \
  --mode recommended \
  --voice-backend auto \
  --speech-style conversational \
  --image-source image2-dryrun
```

Free-stock material engine demo:

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/free-stock-material-demo-brief.json \
  --out research/codex-video-workflow-poc/free-stock-material-video-demo \
  --mode recommended \
  --voice-backend melotts_local \
  --image-source local \
  --free-stock-engine \
  --free-stock-provider-order fixture \
  --allow-free-stock-fixture \
  --no-open-delivery-page
```

For publishable runs, prefer `local-authorized,direct-url,nasa,pexels,pixabay` and keep a human rights review. `fixture` creates local test clips only to validate the pipeline and layout gates.

Incremental scene repair / fusion export:

```bash
node .agents/skills/codex-video-workflow/scripts/incremental-video-edit.mjs \
  --base research/codex-video-workflow-poc/authorized-video \
  --out research/codex-video-workflow-poc/authorized-video-revision-01 \
  --scene-id product-ui \
  --label "review patch: product-ui visual element" \
  --force
```

Use this path when a generated package already passed the full workflow and the requested fix is localized to a scene-level visual element while narration, subtitle text, cue timing, and music timing remain unchanged. It copies the base package, preserves `renders/final.base.mp4`, modifies only the selected scene window, reuses planner/TTS/audio/non-target scenes, and fuses a new `renders/final.mp4`. If the fix changes spoken text, cue duration, scene boundaries, voice settings, or rights-sensitive media, rebuild the affected nodes and downstream sync/QC instead of claiming full reuse.

## Output Evidence

Typical output includes:

- `final.mp4`
- `<current-video-title>.mp4`
- `workflow/aesthetic-brief.json`
- `workflow/aesthetic-quality-rubric.md`
- `workflow/content-presentation-design.json`
- `workflow/caption-style-plan.json`
- `workflow/motion-template-selection.json`
- `workflow/motion-grammar-plan.json`
- `workflow/voice-direction.json`
- `workflow/cover-design.json`
- `workflow/cover-image2-prompts.json`
- `workflow/context-image2-cover-requests.json` and `prompts/context-image2-covers/*.txt`
- `workflow/cover-image2-qc.json`
- `workflow/cover-size-selection.json`
- `semi-auto-config.html` cover module with a real sample-cover preview, click-to-open large preview, and one visible target card for every supported cover resolution in `workflow/cover-size-selection.json`
- `cover/cover-video-opening-16x9.svg`
- `cover/cover-master-16x9-3840x2160.svg`
- `cover/cover-16x9-1920x1080.svg`
- `cover/cover-16x9-1280x720.svg`
- `cover/cover-horizontal-4x3-1600x1200.svg`
- `cover/cover-bilibili-1146x717.svg`
- `cover/cover-vertical-1080x1920.svg`
- `cover/cover-vertical-profile-1080x1440.svg`
- `cover/cover-instagram-reels-420x654.svg`
- `cover/cover-square-1200x1200.svg`
- `最终成品/` as the topic's only user-facing upload cover delivery directory; it contains Chinese group folders such as `横版16比9/`, `横版4比3/`, `竖版9比16/`, `竖版3比4/`, and `方形1比1/`, and contains only true native target-ratio Image 2/Codex outputs
- `封面预览-非上传终版/` only when a local target-ratio recomposition preview is explicitly created before a native Image 2/Codex target-ratio asset exists; these previews are review-only and never counted as upload-ready
- `最终成品/需原生重生成清单.md` for missing native target-ratio sizes such as `横版4比3`, `竖版3比4`, `B站常用1146x717`, or `Reels封面420x654` when the run only has a non-target-ratio source
- batch-friendly `_封面总索引/封面总索引.html` generated by `scripts/build-cover-size-selection-index.mjs --root <batch-root>` when producing multi-topic cover packages; final image files stay inside each topic's own `最终成品/`, while duplicate root copies and old `按尺寸选择/` folders are cleaned
- `script/narration.txt`
- `script/narration-spoken.txt`
- `workflow/design-plan.json`
- `workflow/image-generation-strategy.json`
- `workflow/image2-prompts.json`
- `workflow/visual-asset-manifest.json`
- `workflow/visual-relevance-audit.json`
- `workflow/visual-rhythm-plan.json`
- `workflow/external-capability-fusion-plan.json`
- `workflow/galacean-effects-plan.json` when Galacean visual effects are active
- `workflow/whiteboard-layered-reveal-plan.json` when whiteboard layered reveal is active
- `workflow/ip-diagram-creator-plan.json`, `workflow/ip-diagram-creator-native-jobs.json`, and `workflow/ip-diagram-layout-audit.json` when personal-IP / teaching-diagram routing is active
- `workflow/free-stock-material-plan.json`, `workflow/free-stock-asset-ledger.json`, `materials/free-stock/raw/*`, and `assets/free-stock/*.mp4` when free-stock enrichment is active
- `workflow/raw-footage-inventory.json`, `workflow/raw-transcript-index.json`, `workflow/takes-packed.md`, `workflow/word-boundary-map.json`, `workflow/edit-decision-list.json`, `workflow/cut-boundary-qc.json`, and `workflow/source-media-normalization-plan.json` when authorized raw footage is provided
- `workflow/voice-subtitle-manifest.json`
- `workflow/chinese-pronunciation-preflight.json`
- `workflow/effective-pronunciation-plan.json`
- `workflow/pronunciation-application-verification.json`
- `workflow/final-audio-normalization.json`
- `logs/qc.json`
- `screenshots/frame-*.png`
- Incremental repair packages also include `workflow/incremental-edit-lineage.json`, `workflow/incremental-timing-summary.json`, `logs/incremental-qc.json`, `logs/incremental-ffprobe.json`, `logs/incremental-blackdetect.log`, `logs/incremental-volumedetect.log`, `screenshots/incremental-base-target-scene.png`, and `screenshots/incremental-patched-target-scene.png`

QC passes only when video/audio metadata, local voice compliance, voice pause policy, direct first-scene start with zero-second narration by default, final MP4 loudness, integrated Image 2 cover evidence across required platform families, cover title source, cover Image 2 prompts, PNG/JPG byte-size evidence, title-named MP4 and `最终成品/` cover copies, aesthetic planning, premium caption style planning, HTML motion-template selection, Remotion-inspired frame-driven motion primitives, image-generation strategy, image prompt manifests, narration-bound visual relevance evidence, visual rhythm density evidence, inserted visuals, single-line sequential subtitle display, screenshots, and black-frame checks are present. When Galacean visual effects are active, QC also requires `workflow/galacean-effects-plan.json`, selected/rejected effect decisions, asset rights, subtitle-safe layer order, deterministic exact-text ownership, fallback, and pre/peak/post effect evidence. Incremental repair QC additionally requires `logs/incremental-qc.json` with duration drift within `0.2s`, changed target-scene screenshot hash, clean blackdetect, preserved/audible audio when the base has audio, and delivery-grade bitrate; a copied full-run `logs/qc.json` alone is stale evidence for the repair. If raw footage is active, QC also requires the Video-Use-style contract: source inventory, transcript index, packed transcript reading surface, word-boundary map, EDL, cut-boundary self-review, and source-media normalization plan. Cloud ASR remains explicit opt-in only.

After editing motion templates, run:

```bash
node .agents/skills/codex-video-workflow/scripts/validate-html-motion-templates.mjs
```

After editing voice pause logic, run:

```bash
node .agents/skills/codex-video-workflow/scripts/validate-voice-pause-policy.mjs
```

After editing cover targets, run:

```bash
node .agents/skills/codex-video-workflow/scripts/validate-cover-targets.mjs
```

After editing subtitle timing, visual caption wrapping, or cover-title logic, run this against a generated package:

```bash
node .agents/skills/codex-video-workflow/scripts/validate-subtitle-cover-contract.mjs \
  --out research/codex-video-workflow-poc/authorized-video \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json
```

After an incremental scene repair, run the decoder check and package validator:

```bash
ffmpeg -v error -i research/codex-video-workflow-poc/authorized-video-revision-01/renders/final.mp4 -f null -
node .agents/skills/codex-video-workflow/scripts/validate-subtitle-cover-contract.mjs \
  --out research/codex-video-workflow-poc/authorized-video-revision-01 \
  --brief research/codex-video-workflow-poc/authorized-video-revision-01/brief.json
```

After editing raw-footage / Video-Use-style routing, run:

```bash
node .agents/skills/codex-video-workflow/scripts/validate-raw-footage-editing-contract.mjs \
  --out research/codex-video-workflow-poc/authorized-video \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json
```

## Runtime Options

Voice:

```bash
--voice-backend auto
--voice-backend cosyvoice_local
--voice-backend melotts_local
--voice-backend say
--allow-say-fallback
```

Use `say` or `--allow-say-fallback` only for explicitly degraded smoke checks. Final-quality videos in any language should use CosyVoice or MeloTTS.

Before generated Chinese TTS, the workflow analyzes the complete finalized spoken manuscript and writes candidate occurrences, context, selected tone3 pinyin, sources, and unresolved items to `workflow/chinese-pronunciation-preflight.json`. Unresolved items block TTS by default. Add manuscript-specific readings through brief `ttsPronunciations`, for example `{ "phrase": "凡人修仙传", "pinyin": ["fan2", "ren2", "xiu1", "xian1", "zhuan4"] }`. The effective plan is injected into both `pypinyin` and `jieba`, validated through the real MeloTTS frontend, bound into cache/manifest hashes, and recorded in `workflow/effective-pronunciation-plan.json` plus `workflow/pronunciation-application-verification.json`. See `references/chinese-pronunciation-control.md`.

Speech style:

```bash
--speech-style auto
--speech-style conversational
--speech-style tutorial
--speech-style explainer
--speech-style story
--speech-style news
--speech-style product
--speech-style documentary
```

`conversational` adds TTS pause cues only after complete sentences or semantic beats. Comma-like punctuation (`，`, `,`, `、`) stays a short in-clause pause; if an explicit duration is inserted, use `0.5s`, while sentence-ending punctuation keeps the backend/default pause. The original narration stays in `script/narration.txt`; the TTS-ready version is written to `script/narration-spoken.txt`.

Cover-only:

```bash
--cover-only
```

This writes `workflow/cover-design.json`, `cover/cover-video-opening-16x9.svg`, and standalone resolution exports without generating audio or rendering the MP4. Standalone covers use one master cover concept reflowed to common sizes; the video-opening cover asset must match the final video aspect ratio, but default MP4 renders start directly on the first content scene unless `--opening-cover` or `--cover-intro-seconds` is supplied.
Normal cover-only output uses `defaultCoverEngine: "image2-integrated-typography-cover"` in `workflow/cover-design.json`. The older title-card/promise-seal SVG design and subject-only bitmap plus local overlay path are review fallbacks, not the default final-quality path.

Images:

```bash
--image-source image2-dryrun
--image-source local
--image-source codex-builtin --codex-image-assets-dir <dir>
--image-source image2
```

`--image-source codex-builtin` consumes project-bound images generated by Codex/Cos X built-in `image_gen` and does not require `OPENAI_API_KEY`. For covers, prefer names like `horizontal-16x9-integrated-cover.png`, `horizontal-4x3-integrated-cover.png`, `vertical-9x16-integrated-cover.png`, `vertical-3x4-integrated-cover.png`, `square-1x1-integrated-cover.png`, `封面-完整.png`, or `海报-带字.png` inside `--codex-image-assets-dir`. `--image-source image2` calls the OpenAI Images API and requires `OPENAI_API_KEY`; it is not the default cover path. Scene subtitles, claims, and logos should remain deterministic HTML/SVG overlays; cover title/subtitle/badge text is intentionally integrated in the Image 2/Codex cover bitmap.

When filling missing cover target ratios, do not use local drawings as final upload assets. For Codex App runs, use the standalone `codex-video-cover-generation` Skill to prepare one dispatch plan containing every pending request, generate those native-ratio bitmaps with Context Image2 / built-in `image_gen`, record target-bound results and inspection evidence, then run its locked batch-ingest coordinator once. The default cover worker pool processes the pending count up to 9 concurrently; concurrency never reduces the requested count. Cover-only QC completes before the parent video workflow runs full package QC. The direct API alternative is `scripts/generate-cover-targets-image2.mjs --root <batch-root-or-topic-root> --concurrency 9` and requires `OPENAI_API_KEY`; `--limit` is forbidden, and without a real Image2/Codex bitmap the target must stay pending.

Free-stock material:

```bash
--free-stock-engine
--free-stock-provider-order local-authorized,direct-url,nasa,pexels,pixabay
--allow-free-stock-fixture
```

The engine derives queries from `scenes[].stockQuery`, `scenes[].visualPrompt`, title/body/narration text, then writes the query plan and asset ledger before rendering. `local-authorized` and `direct-url` require explicit source/license metadata in the brief; `pexels` and `pixabay` require environment keys; `nasa` records a public-domain/review caveat; `fixture` is demo-only.

## Skill Layout

```text
codex-video-workflow/
├── SKILL.md
├── README.md
├── README.zh-CN.md
├── agents/openai.yaml
├── assets/examples/authorized-brief.json
├── assets/examples/free-stock-material-demo-brief.json
├── assets/galacean-effects-capability-catalog.json
├── media/
│   ├── galacean-vfx-showcase.html
│   ├── codex-video-workflow-zh-cover.svg
│   ├── codex-video-workflow-en-cover.svg
│   ├── oral-materials/
│   │   ├── skill-capability-brief-zh.json
│   │   ├── skill-capability-oral-series-zh.md
│   │   ├── skill-capability-brief-en.json
│   │   └── skill-capability-oral-series-en.md
├── references/
│   ├── aesthetic-system.md
│   ├── candidate-matrix.md
│   ├── content-presentation-design.md
│   ├── cover-design.md
│   ├── external-capability-fusion.md
│   ├── galacean-visual-effects.md
│   ├── design-templates.md
│   ├── failure-cases.md
│   ├── html-motion-platforms.md
│   ├── image-generation-routing.md
│   ├── integration-roadmap.md
│   ├── ip-diagram-creator-integration.md
│   ├── methodology.md
│   ├── motion-usage-playbook.md
│   ├── plugin-routing.md
│   ├── quality-gates.md
│   ├── research-sources.md
│   ├── whiteboard-layered-reveal.md
│   └── voice-direction.md
├── scripts/poc-video-workflow.mjs
├── scripts/incremental-video-edit.mjs
├── scripts/free-stock-material-engine.mjs
├── scripts/render-ip-diagram-native-pages.mjs
├── scripts/self-test-capability-routing.mjs
├── scripts/self-test-full-framework.mjs
├── scripts/validate-html-motion-templates.mjs
├── scripts/validate-cover-targets.mjs
├── scripts/validate-cover-image2-qc.mjs
├── scripts/validate-plugin-routing-contract.mjs
├── scripts/validate-planner-media-routing.mjs
├── scripts/validate-subtitle-cover-contract.mjs
├── scripts/validate-voice-pause-policy.mjs
└── templates/html-motion/
    ├── motion-template-registry.json
    ├── kinetic-editorial-explainer.html
    ├── semantic-timeline-reveal.html
    └── interactive-proof-board.html
```

## Rights And Safety

- No cloned voices.
- No copied creator assets.
- No commercial stock by default.
- No unlicensed music.
- No private uploads required for local rendering.
- Platform publishing still requires human review for licensing, AI labeling, policy, and editorial quality.

## Open-Source And Reference Notes

This skill is built around local, inspectable tooling and references:

- [FFmpeg](https://ffmpeg.org/) and FFprobe for media inspection, muxing, fallback rendering, and audio checks.
- [FunAudioLLM CosyVoice](https://github.com/FunAudioLLM/CosyVoice) and [MeloTTS](https://github.com/myshell-ai/MeloTTS) as local voice backend options when installed and authorized.
- `html-video` as the preferred local HTML-motion renderer when the workspace clone/build is present.
- [GitHub Docs on repository READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), especially relative links and images in README files.
- Public README conventions from projects such as [awesome-readme](https://github.com/matiassingers/awesome-readme) and [Best-README-Template](https://github.com/othneildrew/Best-README-Template): show the demo early, keep setup copyable, and put acknowledgements near the end.
