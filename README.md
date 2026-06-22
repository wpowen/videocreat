# Codex Video Workflow Skill

Produce reviewable narrated videos from a brief: script first, render second, evidence at the end.

`codex-video-workflow` is a local Codex skill for planning, rendering, and validating rights-safe explainer, product, tutorial, and oral-series videos. It does not treat video generation as a single black-box render. It creates the narration material, voice direction, visual system, motion plan, cover package, subtitles, screenshots, and QC report as inspectable artifacts.

## Demo

Open the bilingual player:

[Launch the Chinese / English demo page](media/demo.html)

| Chinese oral-series cut | English oral-series cut |
| --- | --- |
| [![Chinese demo cover](media/codex-video-workflow-zh-cover.svg)](media/codex-video-workflow-zh.mp4) | [![English demo cover](media/codex-video-workflow-en-cover.svg)](media/codex-video-workflow-en.mp4) |
| Local authorized Chinese voice workflow, 74s, 1080p. | Same local voice workflow with English CosyVoice speaker, 86s, 1080p. |

GitHub README pages can render committed MP4 files differently across contexts. The cover images above link directly to the MP4 files, while `media/demo.html` provides the language switcher and player for local or hosted viewing.

Demo evidence is included as [`media/qc/codex-video-workflow-zh-qc.json`](media/qc/codex-video-workflow-zh-qc.json) and [`media/qc/codex-video-workflow-en-qc.json`](media/qc/codex-video-workflow-en-qc.json).

## What It Does

- **Narration before rendering**: writes the oral script and TTS-ready spoken text before video generation.
- **Voice policy**: keeps comma-like punctuation as short in-clause pauses and only inserts semantic line breaks after complete sentences or beats.
- **Content presentation design**: selects a visual system, aesthetic brief, motion template, and scene metaphor before render.
- **Local voice path**: supports local CosyVoice and MeloTTS for authorized narration in both Chinese and English final-quality runs.
- **HTML motion rendering**: uses the local `html-video` renderer when available, with FFmpeg fallback paths recorded in the logs.
- **Image prompt manifest**: can write GPT Image 2-compatible prompts while keeping local deterministic SVG fallback assets.
- **Cover package**: creates video-opening and platform-specific cover variants.
- **QC evidence**: emits final MP4, screenshots, subtitles, manifests, FFprobe data, black-frame checks, volume checks, and `logs/qc.json`.
- **Final loudness normalization**: raises delivered MP4 narration to a clear playback level and records the filter in `workflow/final-audio-normalization.json`.

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
- `OPENAI_API_KEY` only when running with `--image-source image2`

The default image path is `image2-dryrun`: it writes GPT Image 2 prompts and inserts local generated SVG visuals without calling the OpenAI API.

## Validate Install

Run from the target workspace:

```bash
node --check .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs
node .agents/skills/codex-video-workflow/scripts/validate-voice-pause-policy.mjs
node .agents/skills/codex-video-workflow/scripts/validate-cover-targets.mjs
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

Cover-only package:

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/cover-only \
  --cover-only \
  --speech-style conversational \
  --image-source image2-dryrun
```

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

## Output Evidence

Typical output includes:

- `final.mp4`
- `workflow/aesthetic-brief.json`
- `workflow/aesthetic-quality-rubric.md`
- `workflow/content-presentation-design.json`
- `workflow/motion-template-selection.json`
- `workflow/voice-direction.json`
- `workflow/cover-design.json`
- `cover/cover-video-opening-16x9.svg`
- `cover/cover-youtube-16x9.svg`
- `cover/cover-bilibili-4x3.svg`
- `cover/cover-douyin-tiktok-9x16.svg`
- `script/narration.txt`
- `script/narration-spoken.txt`
- `workflow/design-plan.json`
- `workflow/image2-prompts.json`
- `workflow/visual-asset-manifest.json`
- `workflow/voice-subtitle-manifest.json`
- `workflow/final-audio-normalization.json`
- `logs/qc.json`
- `screenshots/frame-*.png`

QC passes only when video/audio metadata, local voice compliance, voice pause policy, final MP4 loudness, platform cover variants, video-internal cover ratio, aesthetic planning, HTML motion-template selection, image prompt manifests, inserted visuals, screenshots, and black-frame checks are present.

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

This writes `workflow/cover-design.json`, `cover/cover-video-opening-16x9.svg`, and standalone platform variants without generating audio or rendering the MP4. Standalone covers may use platform ratios; the video-opening cover must match the final video aspect ratio.

Images:

```bash
--image-source image2-dryrun
--image-source local
--image-source image2
```

`--image-source image2` requires `OPENAI_API_KEY`. Exact Chinese text, subtitles, claims, and logos should remain deterministic HTML/SVG overlays, not generated inside the image.

## Skill Layout

```text
codex-video-workflow/
├── SKILL.md
├── README.md
├── agents/openai.yaml
├── assets/examples/authorized-brief.json
├── media/
│   ├── demo.html
│   ├── codex-video-workflow-zh.mp4
│   ├── codex-video-workflow-zh-cover.svg
│   ├── codex-video-workflow-en.mp4
│   ├── codex-video-workflow-en-cover.svg
│   ├── oral-materials/
│   │   ├── skill-capability-brief-zh.json
│   │   ├── skill-capability-oral-series-zh.md
│   │   ├── skill-capability-brief-en.json
│   │   └── skill-capability-oral-series-en.md
│   └── qc/
│       ├── codex-video-workflow-zh-qc.json
│       └── codex-video-workflow-en-qc.json
├── references/
│   ├── aesthetic-system.md
│   ├── candidate-matrix.md
│   ├── content-presentation-design.md
│   ├── cover-design.md
│   ├── design-templates.md
│   ├── failure-cases.md
│   ├── html-motion-platforms.md
│   ├── integration-roadmap.md
│   ├── methodology.md
│   ├── motion-usage-playbook.md
│   ├── quality-gates.md
│   ├── research-sources.md
│   └── voice-direction.md
├── scripts/poc-video-workflow.mjs
├── scripts/validate-html-motion-templates.mjs
├── scripts/validate-cover-targets.mjs
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
