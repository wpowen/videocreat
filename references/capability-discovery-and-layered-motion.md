# 能力发现与分层语义动效

## 对话入口

用户不需要记住字段名。出现以下表达时，Planner 应主动建议或启用分层语义动效：

- 分层动画、按层展示、逐层出现、分批展示元素；
- 动画线、连线动画、路径绘制、沿路径升级；
- 画面不要像 PPT，希望更有交互感、绘制感或过程感；
- 保留个人 IP 的角色设定和视觉 DNA，同时把页面内容拆成可独立编排的 SVG/HTML 语义层。

如果用户只说“做个视频”，先根据内容推荐最多三个相关能力，不要倾倒完整能力清单。例如流程型内容可提示：

> 这段内容适合启用“分层路径动画”：步骤卡依次出现，连接线在卡片下方绘制，最终态保留全部内容。若指定个人 IP，会保留角色与整体设计语言，并将人物、标题、内容、路径、结论和字幕拆成独立图层。是否有明确视觉偏好可继续补充；没有则由 Planner 自动选择。

这类提示是非阻塞引导。用户没有回应时，继续使用 Planner 的内容适配默认值。

## 触发优先级

1. CLI：`--layered-motion semantic-path|layered-reveal|off|auto`。
2. brief 显式字段：`layeredMotion`。
3. 用户自然语言中的强信号。
4. 无信号时保持关闭，不把所有页面强制改成同一套动效。

## 四种用户入口

- 不指定视觉模式：走默认 HTML 动画与新分层语义动画流程，由 Planner 按内容选择模板；内容本身出现路径、步骤、关系等信号时可激活分层路径。视觉层复用个人 IP 的设计 DNA（暖纸、墨线、橙蓝标记、有机边角、触感阴影、单一视觉焦点），但不会激活个人身份或白板。
- 指定“个人 IP”：走个人 IP 原生页面流程，`addHandDrawnImageAnimation=off`。
- 指定“个人 IP + 动画”：先走原始 `ip-diagram-creator` 的个人 IP 内容页生成流程得到视觉母版，再用 `workflow/personal-ip-semantic-decomposition.json` 把母版设计与精确内容映射到真实语义层。必须输出独立的 `00-background`、`10-headline`、`20-content-main`、`30-content-path`、`40-annotation`、`50-persona`、`60-agent`、`100-caption` SVG，合并 `personal-ip-layered.svg` 和交互式 `personal-ip-layered.html`。母版只作审美/布局参照和 QC 对照，不得作为运行时整页位图；文字、卡片、图标、路径和 Agent 优先使用确定性 SVG/HTML，复杂人物只允许透明或独立媒体容器。缺少母版来源、required roles、精确文字、最终稳定态或存在遮挡/裁切时必须在 MP4 前阻断。
- 画幅由 brief 决定：`9:16` 使用 1080×1920 纵向堆叠布局，`16:9` 使用 1920×1080 横向双模块布局。横屏不能复用竖屏坐标后缩放、裁切或挤压；manifest 必须记录所选原生布局和 `cropOrSqueezeFallbackForbidden: true`。
- 指定“白板”：走默认动画框架 + 白板语义前景绘制，字幕保持最高层。

以上所有视频路线共享同一个内容自适应场景契约：先从本次运行的结构化字幕 cue、完整口播、场景草案和课程/方法论来源中选择唯一规范内容源，再按真实时长、cue 密度、字数、语义单元与方法论视觉单元计算 `workflow/adaptive-content-scene-plan.json`。源场景/源页面只是覆盖下限，不是最终数量；默认动画、白板、静态个人 IP、个人 IP 动画与 Image2 系列页均不得固定成 12/24/48 页，也不得把上一次运行的页数带到本次运行。课程中的步骤、表格、评分卡、清单、公式与命名框架即使口播未逐字展开，也必须映射到 `workflow/methodology-visual-coverage.json` 的最终可见场景中。

显式字段优先于自然语言。`personalIpAnimation: "semantic-layers"` 是新母版语义分层路线的规范值；历史值 `subtle` / `draw-reveal` 保持原生页面前景动效路线，不会静默改变历史包语义。只写 `personalIp` 不得隐式开启动画。

推荐 brief：

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

## 运行产物

启用或评估该能力的每次运行都必须写 `workflow/layered-motion-plan.json`。它至少记录：

- 触发来源和匹配信号；
- 场景级启用状态；
- 基础模板；
- layer order 与 z bands；
- 动画线所属语义模块；
- 个人 IP 原生页面保护策略；
- 最终态完整性要求；
- 必需 QC 证据和拒绝项。

## 层级硬规则

统一层级为：`base 0 -> structure 10 -> motion 20 -> content 30 -> foreground 40 -> subtitle 100`。

- 路径或动画线必须是目标模块的子节点，不能放在全画布高层 overlay 中。
- 动画路径必须低于文字、卡片、图标和最终可读内容。
- 字幕始终最高。
- 静态个人 IP 保留完整原生页面；个人 IP + 动画只保留母版作为审计参照，并重建真实语义内容层。两条路线不得互相降级。
- 个人 IP 动画必须写 `workflow/personal-ip-layered-motion-manifest.json` 与 `workflow/personal-ip-layered-source-manifest.json`，并导出原生 base SVG、前景 SVG、HTML master timeline 与同源 MP4；仅 MP4 hash 不同、仅底边一条细线、或每条字幕一张静态 JPG 均不算通过。
- 最终进度必须显示全部必需内容。

## 验证

运行：

```bash
node scripts/self-test-layered-motion-flow.mjs /tmp/layered-motion-flow
node scripts/self-test-personal-ip-semantic-scene-planning.mjs
node scripts/self-test-personal-ip-semantic-layered-export.mjs
```

通过条件：

- `workflow/layered-motion-plan.json` 存在且触发来源正确；
- 半自动配置页展示真实动画预览；
- SVG 路径层级低于内容卡片；
- 至少一个匹配场景绑定语义路径；
- 个人 IP 保护策略存在；
- reduced-motion 状态保留完整信息。
- 个人 IP 动画交付中原生页面来源证明、base SVG、页面局部前景 SVG、HTML master timeline、视频和 manifest 全部存在；原生底图稳定，字幕最高层，最终态无缺失。
- 自动场景目标、计划场景数与渲染场景数完全相等；每个 source page ID（包括最后一页）都进入时间轴，源口播拼接覆盖无丢失，内容指纹和场景中点截图均互异；长内容必须按真实时长、字幕 cue 和口播字数增长，不能把粗粒度章节页数当成最终页数，更不能用一个画板拉伸整段音频。
- 上述门禁必须分别对 `9:16` 与 `16:9` 执行，并验证视频尺寸分别为 1080×1920 和 1920×1080。
