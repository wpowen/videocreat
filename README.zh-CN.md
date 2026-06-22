# Codex Video Workflow Skill

[English](README.md) | 简体中文

从一份 brief 生成可审查的口播视频：先产出口播脚本，再生成视频，最后留下可验证证据。

`codex-video-workflow` 是一个本地 Codex Skill，用于规划、渲染并验证版权安全的讲解、产品、教程和口播系列视频。它不把视频生成当作一次黑盒渲染，而是把口播材料、声音方向、视觉系统、动效计划、封面包、字幕、截图和 QC 报告都产出为可检查的文件。

## Demo

打开中英文播放器：

[启动中文 / 英文 Demo 页面](media/demo.html)

| 中文口播版 | 英文口播版 |
| --- | --- |
| [![中文 Demo 封面](media/codex-video-workflow-zh-cover.svg)](media/codex-video-workflow-zh.mp4) | [![英文 Demo 封面](media/codex-video-workflow-en-cover.svg)](media/codex-video-workflow-en.mp4) |
| 本地授权中文语音工作流，74 秒，1080p。 | 同一套本地语音工作流，使用英文 CosyVoice speaker，86 秒，1080p。 |

GitHub README 在不同上下文中对已提交 MP4 的渲染方式可能不同。上方封面图会直接链接到 MP4 文件；`media/demo.html` 提供本地或托管浏览时可用的语言切换播放器。

Demo 的验证证据包含 [`media/qc/codex-video-workflow-zh-qc.json`](media/qc/codex-video-workflow-zh-qc.json) 和 [`media/qc/codex-video-workflow-en-qc.json`](media/qc/codex-video-workflow-en-qc.json)。

## 能做什么

- **先口播后渲染**：在生成视频之前，先写出口播脚本和适合 TTS 的 spoken text。
- **口播停顿策略**：把逗号类标点保留为短句内停顿，只在完整句子或语义节拍后插入换行。
- **内容呈现设计**：渲染前先选择视觉系统、美术 brief、动效模板和场景隐喻。
- **本地语音路径**：支持本地 CosyVoice 和 MeloTTS，用于中英文最终质量的授权口播生成。
- **HTML 动效渲染**：优先使用本地 `html-video` renderer；不可用时走 FFmpeg fallback，并把 fallback 记录到日志中。
- **图片提示词清单**：可写出 GPT Image 2 兼容的提示词，同时保留本地确定性的 SVG fallback 视觉资产。
- **封面包**：生成视频开场封面和面向平台的独立封面变体。
- **QC 证据**：输出最终 MP4、截图、字幕、manifest、FFprobe 数据、黑帧检查、音量检查和 `logs/qc.json`。
- **最终响度归一化**：把交付 MP4 的口播音量提升到清晰可听的播放水平，并在 `workflow/final-audio-normalization.json` 记录滤镜链。

## 快速开始

安装到 Codex 的全局 skill 文件夹：

```bash
mkdir -p ~/.codex/skills
rsync -a .agents/skills/codex-video-workflow ~/.codex/skills/
```

或者安装到某个工作区的本地 skill 文件夹：

```bash
mkdir -p /path/to/project/.agents/skills
rsync -a .agents/skills/codex-video-workflow /path/to/project/.agents/skills/
```

复制完成后重启 Codex，让 skill 列表刷新。

## 环境要求

必需：

- Node.js 18+
- FFmpeg / FFprobe
- 用于生产口播的本地 CosyVoice 或 MeloTTS 工作区

可选：

- 本地 `html-video` clone/build，路径为 `research/html-video-research/html-video/packages/cli/dist/index.js`
- macOS `say`，仅用于明确降级的 smoke check
- macOS Quick Look（`qlmanage`），用于 FFmpeg fallback 卡片路径
- 仅在使用 `--image-source image2` 时需要 `OPENAI_API_KEY`

默认图片路径是 `image2-dryrun`：它会写出 GPT Image 2 提示词，并插入本地生成的 SVG 视觉资产，不会调用 OpenAI API。

## 验证安装

在目标工作区运行：

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

只生成封面包：

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/cover-only \
  --cover-only \
  --speech-style conversational \
  --image-source image2-dryrun
```

使用同一套本地语音工作流生成英文 Demo：

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/media/oral-materials/skill-capability-brief-en.json \
  --out research/codex-video-workflow-promo/runs/skill-capability-oral-series-en \
  --mode recommended \
  --voice-backend auto \
  --speech-style conversational \
  --image-source image2-dryrun
```

## 输出证据

典型输出包括：

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

只有当视频/音频元数据、本地语音合规性、口播停顿策略、最终 MP4 响度、平台封面变体、视频内封面比例、美术规划、HTML 动效模板选择、图片提示词清单、插入视觉、截图和黑帧检查都齐全时，QC 才会通过。

修改动效模板后运行：

```bash
node .agents/skills/codex-video-workflow/scripts/validate-html-motion-templates.mjs
```

修改口播停顿逻辑后运行：

```bash
node .agents/skills/codex-video-workflow/scripts/validate-voice-pause-policy.mjs
```

修改封面尺寸目标后运行：

```bash
node .agents/skills/codex-video-workflow/scripts/validate-cover-targets.mjs
```

## 运行参数

语音：

```bash
--voice-backend auto
--voice-backend cosyvoice_local
--voice-backend melotts_local
--voice-backend say
--allow-say-fallback
```

`say` 或 `--allow-say-fallback` 只应该用于明确降级的 smoke check。任何语言的最终质量视频都应该使用 CosyVoice 或 MeloTTS。

口播风格：

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

`conversational` 只在完整句子或语义节拍后加入 TTS 停顿提示。逗号类标点（`，`、`,`、`、`）保留为短句内停顿；如果插入显式时长，使用 `0.5s`；句末标点仍使用后端默认停顿。原始口播文本保存在 `script/narration.txt`，适合 TTS 的版本写入 `script/narration-spoken.txt`。

只生成封面：

```bash
--cover-only
```

该参数会写出 `workflow/cover-design.json`、`cover/cover-video-opening-16x9.svg` 和独立平台封面变体，不生成音频，也不渲染 MP4。独立封面可以使用平台比例；视频开场封面必须匹配最终视频画幅。

图片：

```bash
--image-source image2-dryrun
--image-source local
--image-source image2
```

`--image-source image2` 需要 `OPENAI_API_KEY`。精确中文文字、字幕、声明和 logo 应保持为确定性的 HTML/SVG overlay，不应生成在图片内部。

## Skill 结构

```text
codex-video-workflow/
├── SKILL.md
├── README.md
├── README.zh-CN.md
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

## 权利与安全

- 不克隆真人声音。
- 不复制创作者资产。
- 默认不使用商业素材库。
- 不使用未授权音乐。
- 本地渲染不需要上传私有材料。
- 平台发布前仍需要人工审查授权、AI 标识、平台政策和编辑质量。

## 开源与引用说明

这个 skill 围绕本地、可检查的工具链和参考资料构建：

- [FFmpeg](https://ffmpeg.org/) 和 FFprobe：用于媒体检查、muxing、fallback 渲染和音频检查。
- [FunAudioLLM CosyVoice](https://github.com/FunAudioLLM/CosyVoice) 和 [MeloTTS](https://github.com/myshell-ai/MeloTTS)：在已安装且已授权的前提下，作为本地语音后端选项。
- `html-video`：当工作区内存在本地 clone/build 时，作为优先使用的 HTML 动效渲染器。
- [GitHub README 文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)：尤其是 README 中相对链接和图片的处理方式。
- 来自 [awesome-readme](https://github.com/matiassingers/awesome-readme) 和 [Best-README-Template](https://github.com/othneildrew/Best-README-Template) 等项目的公开 README 惯例：尽早展示 demo，安装步骤保持可复制，并把致谢/引用放在文档末尾。
