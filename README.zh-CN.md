# Codex Video Workflow

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <img src="media/showcase/hero/codex-video-workflow-hero.png" alt="从 Brief 到视频、封面与质量证据的完整生产链" width="100%">
</p>

<h3 align="center">把一份 Brief 变成可审查、可修复、可追溯的视频生产包</h3>

<p align="center">
  全自动生产 · 中英双语半自动配置 · 160 套动效合同 · 44 套配置色系 · 68 种字幕 · 封面 · 个人 IP · 手绘白板 · 独立 QC
</p>

<p align="center">
  <a href="media/showcase/capability-reel-v2/capability-showcase-v2.mp4"><strong>观看 V2 语义动效宣传片</strong></a> ·
  <a href="media/codex-video-workflow-core-2026-zh.mp4">观看完整工作流 Demo</a> ·
  <a href="media/showcase/core-demo/semi-auto-config.html">打开双语配置台</a> ·
  <a href="media/showcase/core-demo/motion-style-template-review.html">浏览 160 套动效组合</a> ·
  <a href="SKILL.md">阅读 Skill 合同</a>
</p>

---

## 先看结论

`codex-video-workflow` 不是“一条提示词换一个 MP4”，而是一条本地优先、阶段可见的生产链：

```text
Brief → 内容与留存规划 → 本地语音 → 真实时序 → 页面与语义动效
      → 字幕 → 独立封面线 → 视频 QC / 封面 QC → 证据化交付包
```

当前仓库同时提供两种模式：

| 模式 | 适合谁 | 默认行为 | 本次真实证据 |
| --- | --- | --- | --- |
| **全自动** | 希望直接得到审阅视频与证据包 | 未显式指定模式时自动规划、配音、渲染、QC、打包 | 122.1 秒、1920×1080、H.264/AAC 的新 Demo；视频主体已渲染，平台封面仍待原生 Image2 生成与验收 |
| **半自动** | 需要先选风格、逐页批注或团队审阅 | 显式使用 `--generation-mode semi-auto`，停在配置台与审核包 | 真实生成的中英双语配置台、68 种字幕、160 套动效组合、12 类封面逻辑、10 个封面尺寸 |

> 状态说明：✅ 表示有本次运行证据；🧭 表示可配置目录/审核预览；⏳ 表示必须继续生成或通过 QC。目录数量不等于已经产出的成片数量。

## 先看 V2：不是样式列表，是语义镜头

[![V2 语义动效能力宣传片](media/showcase/capability-reel-v2/poster.jpg)](media/showcase/capability-reel-v2/capability-showcase-v2.mp4)

V2 根据当前框架重新设计，不再把一批抽象卡片快速扫过。每个案例都明确展示：**具体内容 → 哪个对象发生变化 → 这个动作代表什么**。

![V2 九个关键画面](media/showcase/capability-reel-v2/final-contact-sheet.png)

| 成片中的具体案例 | 动效动作 | 它解释的含义 |
| --- | --- | --- |
| 六步生成一条可审片视频 | 轨道生长、节点完成、结果锁定 | 阶段推进与可验收产物 |
| 数据曲线证明 | 坐标建立、曲线追踪、拐点放大 | 趋势、量级、口径与来源 |
| 咖啡价值链真实图片 | 供应关系与反馈连线逐步出现 | 图片成为证据，连线表达因果 |
| 中英双语配置平台 | 输入、处理中、输出依次聚焦 | 一次真实产品操作如何改变状态 |
| 封面结构对比 | 前后并置、差异补齐、QC 锁定 | 设计升级不是简单换颜色 |
| 模板选择矩阵 | 坐标建立、候选分布、目标象限锁定 | Planner 如何做确定性选择 |
| 多角色协作泳道 | 并行、交接、合并 | 负责人、产物边界和最终验收 |
| 多比例封面候选墙 | 比较、选择、放大理由 | 先选结构与承诺，再选比例与色彩 |
| 两页 Personal IP + 4.5 秒白板 | 原生页面剪辑、路径描绘、节点圈选 | 人物一致性与分层手绘能力 |

- ✅ 71.5 秒、1920×1080、30fps、H.264/AAC，本地 MeloTTS 中文口播
- ✅ 主片真实剪入独立生成的两页 Personal IP Demo，而不是只放静态角标
- ✅ 白板段落严格控制为 4.5 秒：底图稳定 → 描线 → 圈节点 → 彩色回填 → 阅读停留
- ✅ 68 种字幕位于同一张“大画布”，按 8 个语义分区巡览；任一时刻只有一条主字幕占用安全区
- ✅ 项目图片、封面、配置页、Personal IP 页面均记录在[素材清单](media/showcase/capability-reel-v2/workflow/visual-asset-manifest.json)中
- ✅ 分辨率、编码、音视频轨、黑帧、布局与目录覆盖检查已通过；见[QC 记录](media/showcase/capability-reel-v2/logs/qc.json)

<details>
<summary><strong>旧版 38.4 秒目录覆盖 Reel（保留作目录回归证据）</strong></summary>

旧版仍可用于证明 32 个 family × 5 个 variant、44 套配置色系与 68 种字幕的并集覆盖，但它不是当前主宣传片，因为其通用几何图无法充分解释每个动效的业务含义。[观看旧版目录 Reel](media/showcase/capability-reel/capability-showcase.mp4)。

</details>

## 2026 核心能力 Demo

[![2026 核心能力 Demo](media/codex-video-workflow-core-2026-zh-poster.jpg)](media/codex-video-workflow-core-2026-zh.mp4)

这支新 Demo 由当前代码重新生成，覆盖：全自动与半自动模式、双语配置台、语义动效目录、字幕与封面系统、个人 IP 路线边界、QC 与交付证据。

- ✅ 122.1 秒，1920×1080，H.264 + AAC
- ✅ 本地 MeloTTS 女声，真实口播时序驱动字幕
- ✅ 黑帧、静音、解码、分辨率、音视频轨与响度检查已执行
- ⏳ 10 个平台封面仍是审核预览；未完成内置 Image2 原生生成、人工检查和封面 QC，因此本次运行不标记为“可发布”
- 🧭 Personal IP 在 Demo 中只解释路线边界；下方三张 Personal IP 图来自独立的原生页面样本，不冒充本次全自动视频画面

演示输入可直接审查：[core-capability-demo-2026-brief-zh.json](media/oral-materials/core-capability-demo-2026-brief-zh.json)。

![全自动 Demo 八场景分镜总览](media/showcase/core-demo/full-auto-contact-sheet.jpg)

## 两种使用方式

### 全自动：默认跑到渲染与 QC

```bash
node scripts/poc-video-workflow.mjs \
  --brief media/oral-materials/core-capability-demo-2026-brief-zh.json \
  --out /tmp/codex-video-core-demo \
  --mode recommended \
  --voice-backend melotts_local \
  --speech-style explainer \
  --image-source image2-dryrun \
  --no-open-output
```

CLI 的 `image2-dryrun` 会生成可审查的图片与封面请求，但会在原生图片门禁处保持未完成。在具备内置 `image_gen` 的 Codex App 流程中，继续完成图片、封面、接入和复检，才能得到发布状态。

### 半自动：先配置，再决定是否合成

```bash
node scripts/poc-video-workflow.mjs \
  --brief media/oral-materials/core-capability-demo-2026-brief-zh.json \
  --out /tmp/codex-video-core-demo-config \
  --generation-mode semi-auto \
  --voice-backend melotts_local \
  --image-source image2-dryrun \
  --no-open-output
```

半自动模式通常在数秒内生成：

- `semi-auto-config.html`：完整配置台
- `motion-style-template-review.html`：横版动效目录
- `vertical-motion-style-template-review.html`：竖版动效目录
- `workflow/generation-mode-contract.json`：模式与继续条件
- `workflow/caption-style-plan.json`：字幕选择与路由
- `workflow/cover-size-selection.json`：平台封面目标

### 口播停顿合同

逗号类标点（`，`、`,`、`、`）保持句子完整；需要显式停顿时使用 0.5s 的句内短停顿。句末标点继续使用 TTS 后端默认停顿，字幕视觉换行不会变成新的音频切分。

## 中英双语配置台

配置页右上角可在 `中文 / EN` 间切换；切换会更新页面语言、核心导航、章节、主要操作、无障碍标签和 URL 状态。部分动态目录项保留其源语言名称，方便与底层 manifest 对照。

| 中文基础设置 | English base settings |
| --- | --- |
| ![中文基础设置](media/showcase/core-demo/config-base-zh.png) | ![English base settings](media/showcase/core-demo/config-base-en.png) |

| 160 套动效合同 | 68 种字幕样式 |
| --- | --- |
| ![完整动效目录](media/showcase/core-demo/config-motion-all-families.png) | ![完整字幕目录](media/showcase/core-demo/config-caption-gallery.png) |

| 44 套配置色彩系统 | 封面工作台：逻辑与比例 |
| --- | --- |
| ![配置色彩系统](media/showcase/core-demo/config-color-gallery.png) | ![封面生成工作台](media/showcase/core-demo/config-cover-workbench.png) |

| 语音、语言与方言 | 逐页内容/设计/字幕批注 |
| --- | --- |
| ![语音本地化配置](media/showcase/core-demo/config-voice-localization.png) | ![逐页编辑](media/showcase/core-demo/config-page-editor.png) |

<details>
<summary><strong>展开更多真实页面截图：素材路由、英文目录、横竖屏模板浏览器</strong></summary>

| 素材路由 | 英文动效目录 |
| --- | --- |
| ![素材路由](media/showcase/core-demo/config-material-routing.png) | ![英文动效目录](media/showcase/core-demo/config-motion-en.png) |

| 英文字幕目录 | 英文封面工作台 |
| --- | --- |
| ![英文字幕目录](media/showcase/core-demo/config-caption-en.png) | ![英文封面工作台](media/showcase/core-demo/config-cover-en.png) |

| 横屏动效浏览器 | 竖屏动效浏览器 |
| --- | --- |
| ![横屏动效浏览器](media/showcase/core-demo/motion-style-review-horizontal.png) | ![竖屏动效浏览器](media/showcase/core-demo/motion-style-review-vertical.png) |

</details>

配置内容包括：画幅与视频类型、动效组合、颜色、字幕、素材、封面、语音、逐页内容/设计/字幕批注，以及继续合成所需的结构化决定。

## 动效：32 个 family × 5 个 variant

🧭 当前目录提供 **160 套可审核组合**，同时包含 **6 个可直接运行的核心 HTML 页面模板**与 **14 类场景级动效能力**。160 是目录组合数，不是“已经通过 QC 的 160 支视频”。

V2 主片用八个可读案例解释目录能力；配置台负责完整浏览。下面两张图分别展示“案例化成片”和“全目录选择面”。

| 语义动效案例 | 半自动完整目录 |
| --- | --- |
| [![V2 语义动效案例](media/showcase/capability-reel-v2/final-contact-sheet.png)](media/showcase/capability-reel-v2/capability-showcase-v2.mp4) | [![半自动配置中的动效目录](media/showcase/core-demo/config-motion-all-families.png)](media/showcase/core-demo/motion-style-template-review.html) |

<p align="center">
  <img src="media/showcase/templates/gsap-semantic-flow.png" width="48%" alt="GSAP 语义流动">
  <img src="media/showcase/templates/kinetic-editorial-explainer.png" width="48%" alt="动态编辑讲解">
</p>
<p align="center">
  <img src="media/showcase/templates/semantic-timeline-reveal.png" width="48%" alt="语义时间线揭示">
  <img src="media/showcase/templates/interactive-proof-board.png" width="48%" alt="交互证据板">
</p>
<p align="center">
  <img src="media/showcase/templates/data-curve-trace.png" width="48%" alt="数据曲线追踪">
  <img src="media/showcase/templates/dark-saas-magic-ui.png" width="48%" alt="深色产品界面动效">
</p>
<p align="center">
  <img src="media/showcase/templates/typed-black-white-opener.png" width="48%" alt="黑白打字开场">
</p>

动效按语义任务选择：揭示、比较、追踪、连接、累积、强调、转场、数据变化、路径绘制、卡片检查、公式推演、媒体剪辑、字幕节奏与封面承诺，而不是随机给页面加动画。每个公开案例必须同时具备可读内容、真实或项目内素材、对象变化、明确结论、字幕安全区和来源说明。

## 字幕：68 种样式、8 个设计组

V2 将 68 种样式设计成同一张“字幕博物馆”大画布。全景中八个分区同时存在；镜头巡览时只放大当前组，其余组自动降噪，底部始终只有一条真实口播字幕。

| 68 种样式同页总览 | 当前语义组聚焦 |
| --- | --- |
| ![字幕博物馆全景](media/showcase/capability-reel-v2/screenshots/captionsOverview.png) | ![字幕博物馆分组聚焦](media/showcase/capability-reel-v2/screenshots/captionsFocus.png) |

[打开半自动配置中的完整可选择字幕目录](media/showcase/core-demo/config-caption-gallery.png)

| 设计组 | 数量 | 典型用途 |
| --- | ---: | --- |
| 界面工具 UI | 16 | 产品演示、操作步骤、状态反馈 |
| 编辑叙事 Editorial | 14 | 观点、证据、转折、结论 |
| 节奏强调 Kinetic | 14 | 钩子、关键词、短视频节奏 |
| 玻璃 Glass | 9 | 科技感、轻量信息层、深色背景 |
| 极简 Minimal | 6 | 纪录片、课程、低干扰讲解 |
| 双语 Bilingual | 3 | 中英双行、翻译与术语解释 |
| 声音同步 Audio | 3 | 波形、逐词与节拍反馈 |
| 移动端 Mobile | 3 | 9:16 安全区与大字号阅读 |

字幕不是最后覆盖的一层贴纸：它与真实口播 cue、关键词强调、单行安全区、页面内容层和平台画幅共同规划。

## 封面：12 类点击逻辑 × 10 个原生输出目标

🧭 配置台现在会真正显示全部 **12 类封面设计逻辑**，而不仅是尺寸列表。

![12 类封面设计逻辑](media/showcase/core-demo/config-cover-style-presets.png)

| 逻辑 | 适用叙事 |
| --- | --- |
| 问题到证明 | 痛点 → 可见证据 |
| 方法路线图 | 步骤、教程、框架 |
| 反差揭示 | 误区、反常识、认知翻转 |
| 账本兑现 | 成本、收益、结果复盘 |
| 人物压力 | 决策冲突、角色困境 |
| 前后对照 | 改造、优化、过程成果 |
| 产品控制台证明 | 工具、SaaS、功能演示 |
| 个人 IP 教学 | 创作者、课程、知识输出 |
| 白板图解揭示 | 结构、公式、关系讲解 |
| 数据证据冲击 | 指标、趋势、研究结论 |
| 全链路证据栈 | 工作流、系统与交付闭环 |
| 平台原生强钩子 | 短视频/信息流首屏点击 |

![10 个封面比例与尺寸目标](media/showcase/core-demo/config-cover-logic.png)

10 个常用目标包含视频内 16:9、4K 16:9、YouTube 1280×720、4:3、Bilibili 常用尺寸、竖版 9:16、3:4、Reels 420×654 与 1:1。示例路径包括 `cover-master-16x9-3840x2160.svg`；选择结果写入 `workflow/cover-size-selection.json`。需要单独重跑封面时可使用 `--cover-only`。

> 仓库里的 SVG 是审核预览。上传终版必须是目标原生比例 bitmap，并完成生成来源、文字可读性、裁切安全区与封面 QC。

### 已提交的封面成品样本

| 16:9 | 9:16 | 1:1 |
| --- | --- | --- |
| ![横版封面](media/showcase/covers/story-spine-horizontal-16x9.jpg) | ![竖版封面](media/showcase/covers/story-spine-vertical-9x16.jpg) | ![方形封面](media/showcase/covers/story-spine-square-1x1.jpg) |

这些图片是既有独立封面样本；不是本次新 Demo 尚未完成的 10 个封面目标。

## 颜色与视觉系统

![44 套配置色彩系统](media/showcase/core-demo/config-color-gallery.png)

🧭 半自动配置台提供 44 套设计色系，覆盖编辑出版、产品界面、白板、矿物玻璃、档案叙事、创作者 IP、品牌观点、数据新闻、单色和多色页面。在运行合同层，当前引擎有 10 个命名 palette 与 10 个 visual theme；44 套是建立在这些运行控制之上的策展选择面，不代表 44 个独立渲染引擎。

## Personal IP：一致性优先，动画路线隔离

### 新版两页原生 Demo

[![两页 Personal IP 原生短片](media/showcase/personal-ip/demo-v2/personal-ip-two-page-poster.jpg)](media/showcase/personal-ip/demo-v2/personal-ip-two-page-horizontal.mp4)

这支 7.05 秒横屏短片由独立任务生成，并已剪入 V2 主宣传片。它使用两个已经通过来源运行 `publishingReady` 检查的原生页面，通过 0.35 秒转场连接 Hook 与 Framework 两个语义页面；视频、页面 SHA、来源 QC 与非本人形象边界见[溯源记录](media/showcase/personal-ip/demo-v2/provenance.json)。

### 横屏 / 竖屏 6 秒短 Demo

| 16:9 原生 Personal IP 手绘页 | 9:16 原生 Personal IP + 白板动效 |
| --- | --- |
| [![横屏 Personal IP 手绘短片](media/showcase/personal-ip/demos/personal-ip-whiteboard-horizontal-poster.jpg)](media/showcase/personal-ip/demos/personal-ip-whiteboard-horizontal-6s.mp4) | [![竖屏 Personal IP 白板动效短片](media/showcase/personal-ip/demos/personal-ip-whiteboard-vertical-poster.jpg)](media/showcase/personal-ip/demos/personal-ip-whiteboard-vertical-6s.mp4) |
| 6 秒 · 1920×1080 · 原生手绘教学页 + 确定性字幕 | 6 秒 · 1080×1920 · 原生底图固定 + 页面局部路径/节点动画 + 字幕顶层 |

两个片段都截取自最终交付 QC 中 `pass`、`videoPass`、`publishingReady` 均为 true 的来源运行。横屏片段证明原生 Personal IP 手绘页面路线，但该来源的页面局部白板前景计划未启用；竖屏片段证明已启用的分层白板动画路线。两者均使用通用女性主理人 fallback，并明确**不宣称是用户本人形象**。完整来源、哈希与口径见[溯源记录](media/showcase/personal-ip/demos/provenance.json)。

| 开场页 | 教学页 | 收束页 |
| --- | --- | --- |
| ![Personal IP 开场](media/showcase/personal-ip/story-spine-opening.png) | ![Personal IP 教学](media/showcase/personal-ip/story-spine-middle.png) | ![Personal IP 收束](media/showcase/personal-ip/story-spine-ending.png) |

- 普通 Personal IP 视频必须使用有来源证明的原生页面，保持人物、服装、构图与视觉 DNA 一致。
- “Personal IP + 动画”只有在显式授权时才重建标题、卡片、路径、人物与字幕等语义层。
- 缺少原生页面来源时，全自动流程会在合成前停止，不会退回到近似 HTML 人物页冒充成品。

### 4.5 秒分层白板

![白板关键路径演示](media/showcase/capability-reel-v2/screenshots/whiteboard.png)

白板不重画整张页面，只在稳定底图之上添加语义前景层：约 0.7 秒建立底图，随后描出主线、圈出关键节点、添加箭头和颜色回填，最后保留阅读时间。字幕始终在最上层，画线不会穿过人物脸部或字幕安全区。完整时序写入[白板计划](media/showcase/capability-reel-v2/workflow/whiteboard-layered-reveal-plan.json)。

## 可扩展视觉页面类型

![九类视觉系列总览](media/showcase/visual-series/nine-scenes-contact-sheet.png)

| 攻略指南 | 关系地图 | 界面展示板 |
| --- | --- | --- |
| ![攻略指南](media/showcase/visual-series/strategy-guide.png) | ![关系地图](media/showcase/visual-series/relationship-map.png) | ![界面展示板](media/showcase/visual-series/interface-plate.png) |

仓库内置的视觉模块包括知识百科、攻略指南、关系地图、集合图鉴、编辑钩子、超现实载体、东方水墨、界面展示板和渐进拼贴。它们是可路由的页面设计能力；每次进入视频成品前仍需通过来源、可读性和画面 QC。

## 核心 Skill

| Skill | 角色 | 负责内容 |
| --- | --- | --- |
| `codex-video-workflow` | **主生产引擎** | Brief、脚本、留存结构、页面路由、本地语音、字幕、渲染、QC 与交付包 |
| `codex-video-cover-generation` | **独立封面引擎** | 点击逻辑、平台比例、Image2 请求、接入、来源证明与封面 QC |
| `build-*` 视觉模块 | **专业页面路由** | 知识、攻略、关系、图鉴、编辑、抽象、水墨、界面与渐进场景 |

主 Skill 与封面 Skill 有版本一致性门禁。安装到 Codex 后应重启客户端，让技能目录重新加载。

## 证据化交付包

```text
<output>/
├── delivery.html
├── <标题>.mp4
├── delivery-manifest.json
├── script/
│   ├── narration.txt
│   ├── narration-spoken.txt
│   ├── storyboard.md
│   └── subtitles.srt
├── workflow/
│   ├── generation-mode-contract.json
│   ├── presentation-route-lock.json
│   ├── page-decision-contract.json
│   ├── voice-subtitle-manifest.json
│   ├── caption-style-plan.json
│   ├── cover-design.json
│   ├── cover-size-selection.json
│   └── quality-scorecard.md
├── cover/
├── 最终成品/
└── logs/
    ├── ffprobe.json
    ├── blackdetect.log
    ├── silencedetect.log
    ├── volumedetect.log
    └── qc.json
```

## 安装与验证

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME/skills/codex-video-workflow"
rsync -a --exclude '.git/' --exclude 'research/' --exclude 'output/' ./ \
  "$CODEX_HOME/skills/codex-video-workflow/"

for skill_name in \
  codex-video-cover-generation \
  build-collection-atlas build-editorial-hook build-interface-plate \
  build-knowledge-encyclopedia build-oriental-ink build-progression-collage \
  build-relationship-map build-strategy-guide build-surreal-carrier; do
  skill_dir="skills/$skill_name"
  [ -f "$skill_dir/SKILL.md" ] || continue
  mkdir -p "$CODEX_HOME/skills/$skill_name"
  rsync -a "$skill_dir/" "$CODEX_HOME/skills/$skill_name/"
done

node --check scripts/poc-video-workflow.mjs
node --check scripts/build-semi-auto-config-html.mjs
node scripts/self-test-generation-mode-default.mjs
node scripts/validate-cover-targets.mjs
node scripts/validate-html-motion-templates.mjs
```

## 发布边界

- “渲染成功”不等于“可发布”；平台封面、来源、字幕安全区和 QC 必须全部满足。
- 目录预览、dry-run SVG 和计划文件不能替代真实 bitmap、运行像素与人工画面检查。
- 68 种字幕目录已存在，但当前字幕策略路由回归仍有 6 个失败用例；暂时不能宣传为“场景到字幕的自动路由已全部通过”。
- 仓库根目录目前没有许可证文件。公开复用或再分发前，请先由项目维护者选择并添加明确的 `LICENSE`。

## 参考文档

- [生成模式](references/generation-modes.md)
- [质量门禁](references/quality-gates.md)
- [封面生命周期](references/cover-generation-workflow.md)
- [封面设计方法](references/cover-design.md)
- [视觉系列路由](references/gpt-image-2-visual-series.md)
- [展示素材来源说明](media/showcase/README.md)
