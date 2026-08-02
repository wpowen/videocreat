# Codex Video Workflow Skill

[English](README.md) | 简体中文

从一份 brief 生成可审查的口播视频：先产出口播脚本，再生成视频，最后留下可验证证据。

`codex-video-workflow` 是一个本地 Codex Skill，用于规划、渲染并验证版权安全的讲解、产品、教程和口播系列视频。它不把视频生成当作一次黑盒渲染，而是把口播材料、声音方向、视觉系统、动效计划、封面包、字幕、截图和 QC 报告都产出为可检查的文件。

> 这是由社区独立维护的项目，与 OpenAI 不存在隶属、赞助或官方背书关系。OpenAI 与 Codex 为其各自权利人的商标。

## Demo

打开视觉特效能力展示：

[启动 Galacean 风格视觉特效展示页](media/galacean-vfx-showcase.html)

| 中文口播版 | 英文口播版 |
| --- | --- |
| ![中文 Demo 封面](media/codex-video-workflow-zh-cover.svg) | ![英文 Demo 封面](media/codex-video-workflow-en-cover.svg) |
| 中文工作流封面 fixture。 | 英文工作流封面 fixture。 |

公开源码仓库刻意不包含已渲染的语音和视频二进制文件。请只使用你有权使用的资产在本地生成；生成包会携带自己的 QC 与来源证据。

## 能做什么

- **先口播后渲染**：在生成视频之前，先写出口播脚本和适合 TTS 的 spoken text。
- **口播停顿策略**：把逗号类标点保留为短句内停顿，只在完整句子或语义节拍后插入换行。
- **内容呈现设计**：渲染前先选择视觉系统、美术 brief、动效模板和场景隐喻。
- **本地语音路径**：支持本地 CosyVoice 和 MeloTTS，用于中英文最终质量的授权口播生成。
- **HTML 动效渲染**：优先使用本地 `html-video` renderer；不可用时走 FFmpeg fallback，并把 fallback 记录到日志中。
- **Remotion 风格动效 primitive**：借用 Remotion 的帧驱动时序、easing、转场时长核算和文字动效规则，让 `html-video` 场景更有动效，但不默认替换 renderer。
- **图片提示词清单**：可写出 GPT Image 2 兼容的提示词，消费 Codex 内置 `image_gen` 生成的位图资产，或记录待生成的本地审阅资产。
- **封面包**：默认走 Codex/Cos X 内置 Image 2 / `image_gen` 的一体化文字封面路线。标题、副标题、badge、主体、光影和材质应一起生成在封面位图里；OpenAI Images API 只保留为显式直连选项，不是默认封面路径。
- **个人 IP 图解路线**：可在明确个人 IP、creator persona、知识卡、Agent 协作图、PPT/课程/直播教学 brief 中启用 `ip-diagram-creator` 风格规划，同时避免普通 tutorial/explainer 被误改成同一种 house style。
- **视频工具融合**：可借用 Video-Use、FFmpeg、HyperFrames、Remotion、Manim/D3、reference-video QC 等外部能力，但脚本、时序、声音、封面、渲染、包装和 QC 仍由本 skill 统一治理。
- **视觉特效层**：可把 Galacean/effects-runtime 风格的粒子、烟花、能量光束、扫描、2D/3D 点缀和转场爆发纳入“视觉动效”体系，作为可选场景层使用。特效必须有明确语义任务、安全位置、资产授权、fallback，以及截图/motion QC 证据。
- **白板 layered reveal**：支持在现有设计背景上叠加 marker/手绘前景揭示，字幕和 caption 始终保持最上层。
- **免费商用兼容素材引擎**：可根据口播稿或视频素材稿拆分场景查询，从本地授权素材、直接 URL、NASA、Pexels、Pixabay 或本地 fixture 中获取并标准化 B-roll，输出来源/授权/哈希账本，再把素材作为视频画面的一部分融入场景。
- **增量修复**：可在已生成包上只修某个场景窗口，并输出 lineage、耗时、截图、解码检查和增量 QC 证据。
- **QC 证据**：输出最终 MP4、截图、字幕、manifest、FFprobe 数据、黑帧检查、音量检查和 `logs/qc.json`。
- **最终响度归一化**：把交付 MP4 的口播音量提升到清晰可听的播放水平，并在 `workflow/final-audio-normalization.json` 记录滤镜链。

## 用户如何触发能力

用户不需要知道模板名或 JSON 字段。直接描述想要的观看体验即可，Skill 会把自然语言映射到相应流程，并在半自动配置页展示已选择能力。

常用提示词示例：

- `把流程按层拆开，步骤逐个出现，用动画线把它们连接起来。`
- `不要做成 PPT，希望元素分批展示，路径和重点可以动态绘制。`
- `保留个人 IP 原图和原来的 UI，只在上面增加圈画、下划线、路径动画和字幕。`
- `这是数据趋势页，请用曲线追踪、拐点高亮和来源脚注。`
- `这是代码演示，请展示输入、运行状态和输出，不要只放装饰代码卡。`

对话流程会优先推荐与当前题材相关的 2-3 项能力，例如“分层路径动画、个人 IP 语义分层、字幕顶层”，不会要求用户先学习完整能力清单。默认全自动流程会持续完成规划、生成、渲染、QC 和打包；只有用户明确要求半自动、自定义配置或逐页审阅时，才生成配置页并在最终合成前停下。

推荐使用四个稳定信号：

- 不指定：默认 HTML 动画与新的分层语义动画流程；按内容决定是否绘制路径，并继承个人 IP 的暖纸、墨线、自然留白、橙蓝标记、偏移阴影和单一文字所有权，但不会自动启用具体人物身份。
- `个人 IP`：个人 IP 原生页面，默认不增加手绘动画。
- `个人 IP + 动画`：先按原始 `ip-diagram-creator` 提示词生成与内容匹配的个人 IP 视觉母版，再建立绑定母版路径、SHA、尺寸和精确文字的语义分层合同。每个母版像素只能归属于一个运行时图层；卡片与 Agent 等在扁平母版中互相穿插时，合并为一个原子内容单元并共享同一次入场，避免重影、撕裂和重复信息。路径保持在内容下方，字幕始终置顶。母版只用于审美/布局参照和最终 QC，运行时不得作为整页 `<img>`/`<image>` 底图；白底切片、重叠裁片、整页位图兜底、漏字、遮挡、越界或只画额外进度线都会被拒绝。该路线与默认动画、普通个人 IP、白板路线隔离，阻塞时不会静默降级。
- `白板`：默认动画框架加白板语义前景，字幕永远最高。

显式 brief 使用 `personalIpAnimation: "semantic-layers"`。历史值 `"subtle"` 和 `"draw-reveal"` 保持原来的“原生页面 + 前景动效”语义，不会被静默迁移到新的母版语义分层路线；只设置 `personalIp` 时动画值固定为 `off`，继续保留原生个人 IP 页面流程。

触发优先级固定为：显式 `off`/否定表达 > 显式 `semantic-layers` > 非否定的“个人 IP + 动画”自然语言 > 历史 `subtle`/`draw-reveal` > 纯“个人 IP” > 白板 > 默认动画。`不要动画`、`不做动画`、`不用动画`、`别做动画`、`不需要动画`、`取消动画`都不会误入语义分层路线。分层路线缺少已验证母版或独占图层审计时直接阻塞，不会改走默认 HTML、普通个人 IP、白板或 FFmpeg 卡片路线。

语义分层路线的完整执行与验证：

```bash
node scripts/export-personal-ip-semantic-layered-video.mjs \
  --master-reference path/to/verified-master.png \
  --persona path/to/fixed-persona.png \
  --spec path/to/personal-ip-semantic-layer-spec.json \
  --audio path/to/narration.m4a \
  --out research/personal-ip-semantic-layered-review

node scripts/self-test-personal-ip-semantic-layered-export.mjs
```

交付包必须同时包含母版视觉检查/来源证明、`workflow/personal-ip-semantic-decomposition.json`、`workflow/personal-ip-semantic-layer-spec.json`、`workflow/personal-ip-semantic-layer-manifest.json`、`workflow/personal-ip-layer-ownership-audit.json`、`layers/*.svg`、`personal-ip-layered.svg`、`personal-ip-layered.html`、`logs/qc.json` 和 `final.mp4`。缺少任一项都不能把路线标记为完成。历史 `subtle` / `draw-reveal` 原生页面前景路线继续由 `render-ip-diagram-native-pages.mjs` 和 `self-test-native-page-adaptive-policy.mjs` 验证，不能与语义分层路线混用。

原生页面必须按目标画布生成：`9:16` 为 1080×1920，`16:9` 为 1920×1080；禁止把另一画幅裁切、挤压、缩放或加黑边后冒充原生页面。视频渲染只允许在原生页面之上叠加前景路径、节点强调和字幕。

### 分层动画线的显式触发

brief：

```json
{
  "layeredMotion": {
    "enabled": true,
    "mode": "semantic-path",
    "intensity": "balanced",
    "revealOrder": "progressive"
  }
}
```

命令行覆盖：

```bash
node scripts/poc-video-workflow.mjs \
  --brief assets/examples/layered-semantic-motion-brief.json \
  --out research/layered-motion-review \
  --generation-mode semi-auto \
  --layered-motion semantic-path \
  --layered-motion-intensity balanced \
  --image-source image2-dryrun
```

流程会输出 `workflow/layered-motion-plan.json`，并在 `semi-auto-config.html` 中提供真实动画预览。动画线固定在内容卡片下方；个人 IP 原生页面不会被替换。

## 快速开始

每次执行都会写入 `workflow/skill-runtime-provenance.json`。如果仓库副本与 `~/.codex/skills/codex-video-workflow` 的活动全局副本在 `SKILL.md` 或主 runner 上不一致，流程会在生成前直接失败，避免“对话理解了新规则、实际却调用旧脚本”。

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
- 仅直接调用 API 路径 `--image-source image2` 时需要 `OPENAI_API_KEY`；Codex 内置 `image_gen` 资产不需要。
- 免费素材 API key：`PEXELS_API_KEY`、`PIXABAY_API_KEY` 只在启用对应 provider 时需要；`nasa` provider 不需要 key；`fixture` 只用于本地 demo/smoke，不代表可发布外部素材。
- Galacean/effects-runtime package 以及项目自制或明确授权的特效 JSON、纹理、模型资产，仅在启用视觉特效层时需要。runtime 可用不等于第三方特效素材可发布。

默认场景图片路径是 `image2-dryrun`：它会写出 GPT Image 2 兼容提示词，不会调用 OpenAI API。封面单独处理：正常最终质量封面路径是 Codex/Cos X 内置 Image 2 / `image_gen`，通过 `--image-source codex-builtin --codex-image-assets-dir <dir>` 绑定到项目包里。先在 Codex App 里生成完整带字封面，保存到项目目录，再交给 workflow 做尺寸、证据、QC 和交付整理；文件名包含 `cover`、`thumbnail`、`封面`、`海报`、`integrated`、`typography`、`final`、`完整`、`成品` 或 `带字` 的图片会优先被选为完整封面资产。

运行默认值统一放在 `assets/runtime-defaults.json`。每次生成都会写出 `workflow/runtime-config.json`，记录最终解析出的图片、语音、素材、封面和帧数策略。命令行参数和 brief 字段可以显式覆盖默认值，但 `OPENAI_API_KEY` 这类环境能力只代表可用凭证，不会静默把默认 `image2-dryrun` 改成真实 API 调用。

## 验证安装

在目标工作区运行：

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

只生成提示词/审阅版封面包，不绑定已生成封面资产：

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/cover-only \
  --cover-only \
  --speech-style conversational \
  --image-source image2-dryrun
```

使用 Codex/Cos X 内置 Image 2 资产生成最终质量封面包：

```bash
node .agents/skills/codex-video-workflow/scripts/poc-video-workflow.mjs \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json \
  --out research/codex-video-workflow-poc/cover-only-codex-image2 \
  --cover-only \
  --speech-style conversational \
  --image-source codex-builtin \
  --codex-image-assets-dir research/codex-video-workflow-inputs/codex-image2-covers
```

资产目录里应放入 Codex/Cos X Image 2 已生成并保存到项目内的封面图，最好是原生目标比例文件，例如 `horizontal-16x9-integrated-cover.png`、`horizontal-4x3-integrated-cover.png`、`vertical-9x16-integrated-cover.png`、`vertical-3x4-integrated-cover.png`、`reels-420x654-integrated-cover.png`、`square-1x1-integrated-cover.png`。

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

启用免费素材引擎的本地 demo：

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

真实发布素材建议使用 `local-authorized,direct-url,nasa,pexels,pixabay` provider，并保留人工授权复核。`fixture` 会生成本地测试片段，只用于验证引擎链路和版式 QC。

增量场景修复 / 融合导出：

```bash
node .agents/skills/codex-video-workflow/scripts/incremental-video-edit.mjs \
  --base research/codex-video-workflow-poc/authorized-video \
  --out research/codex-video-workflow-poc/authorized-video-revision-01 \
  --scene-id product-ui \
  --label "review patch: product-ui visual element" \
  --force
```

当一个视频包已经通过完整流程，并且本次只修改某个场景里的视觉元素，同时口播、字幕文本、cue 时长和音乐时序都不变时，使用这条路径。它会复制 base 包，保留 `renders/final.base.mp4`，只在目标场景时间窗里修改画面，复用 Planner、TTS、音频和非目标场景，最后融合导出新的 `renders/final.mp4`。如果修改会影响口播文本、cue 时长、场景边界、声音设置或权利敏感素材，就必须重建受影响节点及其下游同步/QC，不能声称全量复用。

## 输出证据

典型输出包括：

- `final.mp4`
- `<当前视频标题>.mp4`
- `workflow/aesthetic-brief.json`
- `workflow/aesthetic-quality-rubric.md`
- `workflow/content-presentation-design.json`
- `workflow/caption-style-plan.json`
- `workflow/motion-template-selection.json`
- `workflow/motion-grammar-plan.json`
- `workflow/voice-direction.json`
- `workflow/cover-design.json`
- `workflow/cover-image2-prompts.json`
- `workflow/cover-image2-qc.json`
- `workflow/cover-size-selection.json`
- `cover/cover-video-opening-16x9.svg`
- `cover/cover-master-16x9-3840x2160.svg`
- `cover/cover-16x9-1920x1080.svg`
- `cover/cover-16x9-1280x720.svg`
- `cover/cover-bilibili-1146x717.svg`
- `cover/cover-vertical-1080x1920.svg`
- `cover/cover-vertical-profile-1080x1440.svg`
- `cover/cover-instagram-reels-420x654.svg`
- `cover/cover-square-1200x1200.svg`
- 每个主题自己的 `最终成品/` 上传封面目录；该目录按中文比例/平台分组，并且只放原生目标比例 Image 2/Codex 终版
- 可选的 `封面预览-非上传终版/`；仅用于还没有原生目标比例 Image 2/Codex 封面资产时查看本地目标比例重排预览，不能作为上传终版
- `script/narration.txt`
- `script/narration-spoken.txt`
- `workflow/design-plan.json`
- `workflow/image-generation-strategy.json`
- `workflow/image2-prompts.json`
- `workflow/visual-asset-manifest.json`
- `workflow/visual-relevance-audit.json`
- `workflow/visual-rhythm-plan.json`
- `workflow/external-capability-fusion-plan.json`
- 启用 Galacean 视觉特效时，还会输出 `workflow/galacean-effects-plan.json`
- 启用白板 layered reveal 时，还会输出 `workflow/whiteboard-layered-reveal-plan.json`
- 启用个人 IP / 教学图解路线时，还会输出 `workflow/ip-diagram-creator-plan.json`、`workflow/ip-diagram-creator-native-jobs.json` 和 `workflow/ip-diagram-layout-audit.json`
- 当启用免费素材引擎时，还会输出 `workflow/free-stock-material-plan.json`、`workflow/free-stock-asset-ledger.json`、`materials/free-stock/raw/*` 和 `assets/free-stock/*.mp4`
- 当 brief 提供授权原始素材时，还会输出 `workflow/raw-footage-inventory.json`、`workflow/raw-transcript-index.json`、`workflow/takes-packed.md`、`workflow/word-boundary-map.json`、`workflow/edit-decision-list.json`、`workflow/cut-boundary-qc.json` 和 `workflow/source-media-normalization-plan.json`
- `workflow/voice-subtitle-manifest.json`
- `workflow/chinese-pronunciation-preflight.json`
- `workflow/effective-pronunciation-plan.json`
- `workflow/pronunciation-application-verification.json`
- `workflow/final-audio-normalization.json`
- `logs/qc.json`
- `screenshots/frame-*.png`
- 增量修复包还必须包含 `workflow/incremental-edit-lineage.json`、`workflow/incremental-timing-summary.json`、`logs/incremental-qc.json`、`logs/incremental-ffprobe.json`、`logs/incremental-blackdetect.log`、`logs/incremental-volumedetect.log`、`screenshots/incremental-base-target-scene.png` 和 `screenshots/incremental-patched-target-scene.png`

只有当视频/音频元数据、本地语音合规性、口播停顿策略、默认直接进入第一幕且 0 秒开始口播、最终 MP4 响度、一个主设计多分辨率封面证据、封面标题来源、封面 Image 2 主提示词、PNG/JPG 字节大小证据、按标题命名的根目录 MP4、主题内 `最终成品/` 原生目标比例封面拷贝、美术规划、高级字幕样式计划、HTML 动效模板选择、Remotion 风格帧驱动动效 primitive、图片生成策略、图片提示词清单、口播语义绑定的视觉相关性证据、视觉节奏密度证据、插入视觉、单行顺序字幕显示、截图和黑帧检查都齐全时，QC 才会通过。启用 Galacean 视觉特效时，还必须有 `workflow/galacean-effects-plan.json`、已选择/已拒绝特效决策、资产授权、字幕安全层级、确定性文字所有权、fallback，以及特效前/峰值/后的截图证据。增量修复还要求 `logs/incremental-qc.json` 通过：时长漂移不超过 `0.2s`，目标场景前后截图哈希发生变化，blackdetect 干净，base 有音频时必须保留并保持可听，码率仍达到交付质量；只复制旧的完整流程 `logs/qc.json` 不能证明本次修复通过。如果启用原始素材剪辑，还必须通过 Video-Use-style 合同：素材 inventory、转写索引、packed transcript 阅读面、词边界图、EDL、切点自检和素材 normalization 计划。云端 ASR 只能显式 opt-in，不能作为默认依赖。

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

修改字幕时序、视觉换行或封面标题逻辑后，对生成包运行：

```bash
node .agents/skills/codex-video-workflow/scripts/validate-subtitle-cover-contract.mjs \
  --out research/codex-video-workflow-poc/authorized-video \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json
```

完成增量场景修复后，运行解码检查和包合同验证：

```bash
ffmpeg -v error -i research/codex-video-workflow-poc/authorized-video-revision-01/renders/final.mp4 -f null -
node .agents/skills/codex-video-workflow/scripts/validate-subtitle-cover-contract.mjs \
  --out research/codex-video-workflow-poc/authorized-video-revision-01 \
  --brief research/codex-video-workflow-poc/authorized-video-revision-01/brief.json
```

修改原始素材 / Video-Use-style 路由后运行：

```bash
node .agents/skills/codex-video-workflow/scripts/validate-raw-footage-editing-contract.mjs \
  --out research/codex-video-workflow-poc/authorized-video \
  --brief .agents/skills/codex-video-workflow/assets/examples/authorized-brief.json
```

## 运行参数

语音：

```bash
--voice-backend auto
--voice-backend cosyvoice_local
--voice-backend melotts_local
--voice-backend say
--allow-say-fallback
--provided-audio path/to/audio.wav
--provided-audio-trim-start 4
--provided-audio-trim-end 2
```

提供音频时，流程必须把该文件作为口播源：复制到视频包内，按 `--provided-audio-trim-start` / `--provided-audio-trim-end` 裁剪；输入必须是纯人声，不能把工作流已经生成的 `mix.m4a` 再作为输入。纯人声资产保留到最终封装阶段，只做一次统一响度处理，并在 `workflow/voice-subtitle-manifest.json` 记录 `voiceBackend: "provided_audio"` 与 `providedAudio.authorizedByUser: true`。默认不添加可听见的正弦垫音，`assets/mix.m4a` 只表示纯人声交付副本。这时不会重新生成 TTS，最终视频时长以提供音频裁剪后的真实时长为准。

未提供音频时，流程才使用 skill 自身语音能力生成口播。默认 `--voice-backend auto` 会先尝试本地 CosyVoice，再尝试本地 MeloTTS；显式指定 `cosyvoice_local` 或 `melotts_local` 时只走对应本地后端。

`say` 或 `--allow-say-fallback` 只应该用于明确降级的 smoke check。任何语言的最终质量视频都应该使用 CosyVoice 或 MeloTTS。

中文生成 TTS 前会先分析完整的 `script/narration-spoken.txt`，把多音字候选、上下文、最终 tone3 拼音、来源和未解析项写入 `workflow/chinese-pronunciation-preflight.json`。未解析项默认阻断 TTS；专有名词可以通过 brief 的 `ttsPronunciations` 传入，例如 `{ "phrase": "凡人修仙传", "pinyin": ["fan2", "ren2", "xiu1", "xian1", "zhuan4"] }`。有效读音计划写入 `workflow/effective-pronunciation-plan.json`，并同时注入 `pypinyin` 与 `jieba` 后再由真实 MeloTTS 前端验证。存在受控读音时，`auto` 会锁定 `melotts_local`，不会回退到无法证明读音已应用的后端。完整规则见 `references/chinese-pronunciation-control.md`。

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

该参数会写出 `workflow/cover-design.json`、`cover/cover-video-opening-16x9.svg` 和独立分辨率导出，不生成音频，也不渲染 MP4。独立封面使用同一个主封面概念重排到常见尺寸；视频开场封面资产必须匹配最终视频画幅，但默认 MP4 会直接从第一幕开始，只有传入 `--opening-cover` 或 `--cover-intro-seconds` 才把封面渲染进视频。
正常封面包会在 `workflow/cover-design.json` 中记录 `defaultCoverEngine: "image2-integrated-typography-cover"`。旧的标题卡/promise-seal SVG 设计，以及“主体图 + 本地叠字”路径，都是审稿兜底，不再是默认最终质量路径。

图片：

```bash
--image-source image2-dryrun
--image-source local
--image-source codex-builtin --codex-image-assets-dir <dir>
--image-source image2
```

`--image-source codex-builtin` 消费 Codex/Cos X 内置 `image_gen` 生成并保存到项目内的图片，不需要 `OPENAI_API_KEY`。封面图建议命名为 `horizontal-16x9-integrated-cover.png`、`horizontal-4x3-integrated-cover.png`、`vertical-9x16-integrated-cover.png`、`vertical-3x4-integrated-cover.png`、`square-1x1-integrated-cover.png`、`封面-完整.png` 或 `海报-带字.png` 并放入 `--codex-image-assets-dir`。`--image-source image2` 会调用 OpenAI Images API，需要 `OPENAI_API_KEY`；它不是默认封面路径。场景字幕、声明和 logo 应保持为确定性的 HTML/SVG overlay；封面主标题、副标题和 badge 则应一体化生成在 Image 2/Codex 封面位图里。

补齐缺失的封面目标比例时，不允许用本地绘制图冒充最终成品。`4:3`、`3:4`、`1:1`、Reels、B 站 1146x717 等缺失项应保持 `needs-native-target-ratio-image2`，直到拿到真实 Codex/Image2 原生目标比例位图。Codex App 默认路线由独立 `codex-video-cover-generation` Skill 先生成包含全部 pending 目标的调度计划，再通过内置 Image 2 / `image_gen` 工作池生成、逐目标记录结果和检查证据，最后只运行一次带锁批量导入。默认并发宽度为 pending 数量且最多 9；并发只控制吞吐，绝不能减少目标数量。封面 QC 完成后，再由父视频工作流单独运行全片 QC。显式 API 备选是 `scripts/generate-cover-targets-image2.mjs --root <batch-root-or-topic-root> --concurrency 9`，需要 `OPENAI_API_KEY`，且禁止 `--limit`；没有真实 Image2/Codex 图时必须继续 pending，避免生成假最终图。

免费素材：

```bash
--free-stock-engine
--free-stock-provider-order local-authorized,direct-url,nasa,pexels,pixabay
--allow-free-stock-fixture
```

引擎会从 brief 的 `scenes[].stockQuery`、`scenes[].visualPrompt`、标题、正文和口播中生成查询计划。`local-authorized` 和 `direct-url` 要求 brief 明确写入授权/来源元数据；`pexels` 和 `pixabay` 需要对应环境变量；`nasa` 会记录公共领域/权利复核提示；`fixture` 仅用于本地测试。

## Skill 结构

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

## 权利与安全

- 不克隆真人声音。
- 不复制创作者资产。
- 默认不使用商业素材库。
- 免费素材必须留下来源、授权、归因、哈希和发布复核状态；demo fixture 不能当作外部素材发布。
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
