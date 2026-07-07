# Motion Style Template Design Spec

这份规范约束 `assets/motion-style-template-library.json` 和每次运行写出的
`workflow/motion-style-template-selection.json`。模板不是颜色皮肤，也不是
一次性提示词；模板是一组可复用的视频页面决策，必须同时说明内容类型、
数据准确性、页面骨架、文字设计、动效逻辑、素材任务、字幕安全区和 QC。

当前生产库至少包含 32 个内容 family x 5 个视觉 variant = 160 套可选
模板。旧版 20 类只能覆盖基础知识视频，不能充分覆盖排行表、地图、层级树、
关系网络、漏斗、Agent 协作、界面路径、风险告警、资料引用、语音同步、
样张对比和日历事件等生产场景。

## 0. 横向调研与审美基准

模板库实现前必须先绑定横向参考，而不是凭空生成样式：

- Apple Human Interface Guidelines / Motion：动效必须传达状态、反馈、
  指令或连续性，不能为了装饰而动。
- Material Design Motion：转场必须保持一致的空间模型、稳定布局、统一
  方向，并尊重无障碍/弱动效设置。
- GSAP CSS 动效模型：优先使用 transform、opacity、color 等可序列化、
  可验证的属性，复杂 layout 变化需要有 FLIP/状态变换思路。
- FT Visual Vocabulary + Observable Plot：数据页先按数据关系选结构，
  例如变化、排名、分布、空间、流向、相关性，再决定视觉样式。
- Manim Transform 方法：公式、数学、推导类页面必须让对象一步步变形，
  观众能看到“从哪一步变到哪一步”。
- UI/UX Pro Max：最终页面必须满足可读层级、对齐、留白、动效节奏、
  对比度、缩略/展开一致性和控件/状态可理解性。

这些参考不替代当前 workflow；它们只作为 Template Director 的审美和
动效基准。最终执行仍由本 Skill 的模板库、planner、HTML renderer 和 QC
接管。

## 1. 模板目标

后续视频生成可以并行拆成多个 Agent：

- Planner Agent：拆解题材、口播稿、页面角色、数据/素材需求和风险。
- TTS Timing Agent：生成或复用语音，输出每个字幕/页面的时间绑定。
- Template Director Agent：读取模板库，给每个页面选择内容骨架、布局、
  字体动效、画面对象、动效层和素材任务。
- Data/Material Agent：在模板要求真实数据、代码、公式、素材或个人 IP
  时，补齐来源、口径、授权和图片任务。
- Renderer/QC Agent：按模板合同渲染，并验证不重叠、不裁切、不泄漏技术
  标签、不伪造数据、不把最终中文文本交给图片生成。

这些 Agent 可以并行工作，但必须以同一份模板选择产物作为接口，避免
Planner、TTS、画面设计和 QC 各自做决定。

## 2. 选择输入

Template Director Agent 只能基于这些输入选择模板：

- `topicType`：题材类型，例如教程、数据分析、产品演示、故事方法、
  课程页、个人 IP 口播、白板推演。
- `scriptBeat`：当前口播单元的精确语义，不是全片摘要。
- `contentKind`：页面要承载的内容类型，例如代码、公式、趋势曲线、
  证据板、流程、矩阵、素材拼贴、封面衔接、个人 IP 知识卡、排行表、
  地图、关系网络、转化漏斗、语音同步、资料引用、Agent 泳道。
- `pageJob`：这一页要完成的传播任务，例如开场钩子、定义、证明、
  对比、推导、示例、检查、收束。
- `assetNeed`：是否需要真实数据、授权素材、Image 2 图片、个人 IP
  角色、白板前景、代码块、公式或图表。
- `canvas`：横竖屏、尺寸和字幕安全区。默认横屏，除非用户明确要求竖屏
  或短视频。
- `colorSystem`：默认由 planner 自动选择，用户可覆盖，但不能让最终画面
  回到普通蓝绿默认色或一整套低质色块。

## 3. 选择输出

每次运行必须写 `workflow/motion-style-template-selection.json`，至少包含：

- `templateLibrary`：引用 `assets/motion-style-template-library.json`。
- `designSpec`：引用本文件。
- `agentHandoff`：Planner、TTS、Template、Data/Material、Renderer/QC 的
  输入输出边界。
- `sceneSelections[]`：每个页面的模板 id、内容类型、页面骨架、动效层、
  数据准确性规则、素材任务、文字模式、字幕安全区和拒绝项。
- `parallelizationPlan`：哪些任务可以并行，哪些必须等待数据/语音/授权。
- `qualityGates`：模板库选择、数据准确性、文字可读性、字幕安全区、
  页面不重叠、封面承诺衔接、个人 IP 一致性、白板前景约束等检查。

## 4. 内容类型规则

模板库必须覆盖以下生产内容域：

- 观点/反差：`claim-split`、`typed-thesis`、`quote-lockup`。
- 流程/路径/时间：`process-timeline`、`journey-map`、`timeline-calendar`。
- 证据/研究/引用：`evidence-board`、`source-citation`、`recap-loop`。
- 代码/产品/界面：`code-walkthrough`、`dashboard-inspection`、
  `screenflow-demo`。
- 数据/空间/比较：`data-chart`、`table-ranking`、`geo-map`、
  `choice-matrix`、`funnel-conversion`。
- 数学/结构/关系：`formula-derivation`、`hierarchy-tree`、
  `network-relationship`、`concept-orbit`。
- 视觉素材/封面/IP/白板：`material-collage`、`comparison-gallery`、
  `cover-bridge`、`ip-knowledge-card`、`whiteboard-method`。
- 风险/门禁/语音：`risk-alert`、`checklist-gate`、`voice-sync`。
- 故事/协作：`storyboard-pressure`、`agent-simulation`。

### 代码展示

- 必须展示代码输入、运行状态、输出结果或错误修复路径，不能只放一张
  装饰性代码卡。
- 代码文本必须是确定性 HTML/SVG/CSS 层，不能交给图片生成。
- 若显示真实命令、API、库名或框架名，必须来自用户题材或真实内容；
  不能把 Vue.js、React、Tailwind 等实现标签泄漏到非教学画面。

### 公式推导

- 必须拆成条件、变形、结果三步以内的可读推导。
- 公式关系必须准确；若不能保证数学准确性，则只能做概念图，不得伪装
  成严格证明。
- 复杂几何、物理、参数曲线可路由到 Manim 插入，但中文字幕和最终标签
  仍由主 workflow 确定性渲染。

### 数据图表

- 真实数据必须先写 `workflow/data-source-plan.json`、`workflow/data-series.json`
  和 `workflow/data-motion-plan.json`。
- 模板必须显示单位、口径、时间范围、地理范围、来源脚注和当前聚焦点。
- 如果没有可靠数据，只能标记为 qualitative，并使用概念曲线或结构图，
  不得画精确假数值。
- 排行表必须说明排名依据、分母、并列处理和选中理由。
- 地图必须说明边界/区域来源；若只是示意图，必须标记为 illustrative。
- 漏斗必须显示阶段分母和流失口径，不能只画漂亮形状。

### 关系结构

- 层级树必须有根节点、分支节点、当前路径和结论，不得超过三层。
- 关系网络必须说明关系方向、关系含义和当前高亮链路，不能生成随机散点。
- Agent 协作泳道必须明确各 Agent 的职责、输入、输出和交接点，不能让
  Planner、TTS、Template、Renderer/QC 决策互相覆盖。

### 语音字幕同步

- 语音页必须读取 `workflow/voice-subtitle-manifest.json` 和
  `workflow/sync-timecode-plan.json`，把语言、方言、男/女声、字幕 cue 和
  关键词高亮绑定到同一时间线。
- 不得在画面中显示具体内部 TTS 引擎名、技术栈名或调试标签。

### 个人 IP

- 个人 IP 页面必须绑定口播单元：一段口播至少对应一张主图任务，必要时
  补角色动作、表情、局部、白板描线或 Agent 协作变体。
- 已保存的人设素材必须优先复用。没有素材时，引导用户提供授权照片、
  头像、角色设定图或 manifest，创建后写入用户物料库。
- 角色只在承担讲解、搬运、圈画、交接、指向等语义动作时出现，不能作为
  装饰摆件。

### 白板绘制

- 白板是前景语义层：箭头、圈画、下划线、描线、步骤高亮。
- 白板不得重画整个页面，不得移动或裁切底图，不得覆盖字幕。
- 白板可以和个人 IP 结合，也可以和普通动效结合；个人 IP 与普通动效互斥。

### 封面衔接

- 封面不是 PPT 缩略图，而是点击决策面。首帧必须承接封面承诺、主视觉
  或核心钩子。
- 模板只负责首帧承诺桥接；封面生成仍由 Image 2 integrated typography
  cover 逻辑和 `references/cover-design.md` 负责。

## 5. 审美规则

- 一页只放一个主意图、一个支持信息和一个继续观看理由。
- 文字必须被设计成视觉对象：大标题、支持线、信息轨、标注、数字、
  引用、标签都要有角色和层级。
- 不把所有模板做成左右布局。模板库必须覆盖全屏短句、中心轨道、顶部
  语境卡、底部安全字幕、三栏证据、数据坐标、代码运行面板、公式推导板、
  素材拼贴、个人 IP 知识卡、白板前景层等结构。
- 动效必须解释关系、因果、状态、选择、推导、拐点或收束，不做随机炫技。
- 色彩由 planner 自动选择为默认；用户选择仅作为覆盖输入。颜色系统必须
  支持无黑、纯黑、单色、多色和高明度版本，并保留对比度证据。
- 缩略预览和点击展开预览必须共享同一套语义 markup。展开态可以显示更多
  细节，但不能成为另一套设计。
- 每个模板必须有 `benchmarkContract`，说明横向参考、内容骨架、审美基准、
  缩略/展开一致性和语义动效目标。
- 最终视频帧不得显示页码、场景计数、技术栈、执行框架名、渲染器名、
  QC 标签、文件路径或操作员提示。

## 6. QC 拒绝项

任何模板或选择产物出现以下问题应失败：

- 模板只有换色，没有内容骨架、页面任务和动效层。
- 同一视频所有页面重复同一种布局，除非用户明确要求固定版式。
- 字幕、标题、图表、代码、公式、角色、Agent、白板描线互相重叠。
- 文本被裁切、省略、隐藏、变成不可读图片文字或脱离口播语义。
- 数据图表没有来源、单位、口径或把概念图伪装成真实精确数据。
- 个人 IP 角色每次重新生成，没有读取已保存素材或角色一致性计划。
- 白板绘制覆盖整个页面、移动底图、遮挡字幕或成为最终可读文本 owner。
- 选择只来自 LLM 自由描述，没有模板库 id、规则证据和场景绑定。
- 没有横向 benchmark，或者 benchmark 只写成口号，不能落到布局、动效、
  数据准确性、文字层级和 QC。
