#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const workflowScript = join(skillRoot, "scripts", "poc-video-workflow.mjs");
const registryPath = join(skillRoot, "templates", "html-motion", "motion-template-registry.json");

function parseArgs(argv) {
  const args = {
    outRoot: join(workspace, "research", "codex-video-workflow-poc", "capability-routing-self-test"),
    keepExisting: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--out-root") args.outRoot = resolve(argv[++i]);
    else if (item === "--keep-existing") args.keepExisting = true;
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/self-test-capability-routing.mjs [--out-root <dir>] [--keep-existing]",
    "",
    "Runs cover-only planner smoke tests across video types and validates capability routing artifacts.",
  ].join("\n");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function rel(path) {
  return path.replace(`${workspace}/`, "");
}

function baseBrief(overrides = {}) {
  return {
    title: "Capability routing baseline",
    language: "zh",
    audience: "workflow verifier",
    objective: "Verify planner routing, artifacts, and video-type selection without external media.",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 18,
    videoType: "professional-explainer",
    imageSource: "image2-dryrun",
    style: "animated-infographic",
    voiceBackend: "auto",
    speechStyle: "explainer",
    rights: {
      text: "original local self-test brief",
      visuals: "local deterministic HTML/SVG",
      voice: "local TTS policy, not rendered in cover-only self-test",
      music: "none in cover-only self-test",
      externalMedia: "none",
    },
    scenes: [
      {
        id: "hook",
        label: "Hook",
        kicker: "01",
        headline: ["Planning first", "Tools second"],
        stat: "QC",
        body: "A baseline explainer should keep core capabilities active without optional routes.",
        subtitle: "The framework plans the video before any optional capability is used.",
        palette: "blue",
      },
      {
        id: "resolve",
        label: "Resolve",
        kicker: "02",
        headline: ["Evidence", "then delivery"],
        stat: "PASS",
        body: "The output package must expose evidence files.",
        subtitle: "A local package should make the routing decision reviewable.",
        palette: "green",
      },
    ],
    narration: "The framework plans the video before any optional capability is used. A local package should make the routing decision reviewable.",
    ...overrides,
  };
}

function ensureThreeScenes(brief) {
  const scenes = Array.isArray(brief.scenes) ? [...brief.scenes] : [];
  while (scenes.length < 3) {
    const index = scenes.length + 1;
    scenes.push({
      id: `self-test-fill-${index}`,
      label: `Self-test fill ${index}`,
      kicker: `0${index}`,
      headline: [`Evidence ${index}`, "stays reviewable"],
      stat: "QC",
      body: "This filler scene keeps the workflow's minimum scene contract while preserving the scenario trigger.",
      subtitle: "The self-test keeps every artifact reviewable.",
      palette: index % 2 ? "teal" : "gold",
    });
  }
  return {
    ...brief,
    scenes,
    narration: sentenceCount(brief.narration) >= scenes.length
      ? brief.narration
      : scenes.map((scene) => scene.subtitle || scene.body || scene.label || scene.id).join(" "),
  };
}

function sentenceCount(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const matches = text.match(/[^.!?。！？]+[.!?。！？]/g);
  return matches ? matches.length : text.split(/\s+/).filter(Boolean).length ? 1 : 0;
}

function scenarios(fixtureDir) {
  const clipPath = join(fixtureDir, "authorized-clip.mp4");
  const referencePath = join(fixtureDir, "reference-video.mp4");
  writeFileSync(clipPath, "placeholder authorized local clip for planner inventory\n");
  writeFileSync(referencePath, "placeholder reference video for planner route\n");
  return [
    {
      id: "baseline-explainer",
      brief: baseBrief(),
      expect: {
        selectedTemplate: "interactive-proof-board",
        activeCapabilities: ["remotion"],
        inactiveCapabilities: ["build-web-data-visualization", "product-design", "website-to-hyperframes", "video-use-style-footage-editing", "remotion-style-template-props", "reference-video-alignment-qc"],
        inactiveExternal: ["raw-footage-editing", "ip-diagram-creator-planner", "template-props-contract", "data-or-math-motion-inserts", "reference-video-alignment-qc"],
      },
    },
    {
      id: "explicit-kinetic-template",
      brief: baseBrief({
        title: "Explicit kinetic opener remains reachable",
        style: "animated-infographic",
        scenes: [
          {
            id: "explicit-kinetic",
            label: "Explicit kinetic",
            headline: ["Fast claim", "sharp proof"],
            body: "This scenario explicitly selects the kinetic template to keep registry coverage without making it a default dark opener.",
            subtitle: "Explicit kinetic templates still remain reachable.",
            palette: "ink",
            motionTemplate: "kinetic-editorial-explainer",
          },
          {
            id: "proof",
            label: "Proof",
            headline: ["Proof", "stays readable"],
            body: "The second scene keeps the package complete.",
            subtitle: "The package keeps every artifact reviewable.",
            palette: "blue",
          },
        ],
        narration: "Explicit kinetic templates still remain reachable. The package keeps every artifact reviewable.",
      }),
      expect: {
        selectedTemplate: "kinetic-editorial-explainer",
        firstPageThemeKeyNot: "kineticDark",
      },
    },
    {
      id: "process-tutorial",
      brief: baseBrief({
        title: "Workflow tutorial process",
        videoType: "tutorial-explainer",
        objective: "Show a workflow process with ordered steps and model progression.",
        scenes: [
          { id: "step-one", label: "Step one", headline: ["Step 1", "Plan"], body: "First define the workflow.", subtitle: "First define the workflow.", palette: "blue" },
          { id: "step-two", label: "Step two", headline: ["Step 2", "Verify"], body: "Then verify every stage.", subtitle: "Then verify every stage.", palette: "green" },
        ],
        narration: "First define the workflow. Then verify every stage.",
      }),
      expect: {
        selectedTemplate: "semantic-timeline-reveal",
        inactiveExternal: ["ip-diagram-creator-planner"],
      },
    },
    {
      id: "default-horizontal-hook-no-platform",
      brief: baseBrief({
        title: "默认横屏科普开场",
        objective: "没有要求短视频或竖屏，只要求用开场反差和3秒钩子解释一个普通知识点。",
        platform: undefined,
        aspectRatio: undefined,
        scenes: [
          {
            id: "opening-hook",
            label: "开场钩子",
            headline: ["先给反差", "再解释机制"],
            body: "普通横屏科普可以有开场钩子，但不应该被当成竖屏短视频。",
            subtitle: "普通横屏科普也可以先给反差，但画布仍应默认横屏。",
            palette: "blue",
          },
          {
            id: "mechanism",
            label: "机制解释",
            headline: ["机制", "承接问题"],
            body: "第二幕解释因果链路。",
            subtitle: "第二幕再解释因果链路。",
            palette: "teal",
          },
        ],
        narration: "普通横屏科普也可以先给反差，但画布仍应默认横屏。第二幕再解释因果链路。",
      }),
      expect: {
        canvasAspect: "16:9",
        canvasVertical: false,
        shortFormHookPlanActive: false,
        shortFormHookPlanFile: false,
        firstPageThemeKeyNot: "kineticDark",
      },
    },
    {
      id: "explicit-ip-diagram-primary",
      brief: baseBrief({
        title: "个人IP方法图解课",
        objective: "Use ip-diagram-creator as the primary visual planner for a creator-led teaching video with knowledge cards and execution Agents.",
        videoType: "tutorial-explainer",
        visualMode: "ip-diagram",
        ipDiagramCreator: true,
        primaryIpDiagramCreator: true,
        personalIp: "方法课主讲人",
        scenes: [
          {
            id: "persona",
            label: "主讲人角色",
            headline: ["个人IP", "先给观众一个角色"],
            body: "主讲人用一张知识卡把承诺讲清楚。",
            subtitle: "个人IP先建立可信的讲解角色。",
            visualMode: "ip-diagram",
            diagramMode: "character-led-small-scene",
            palette: "blue",
          },
          {
            id: "agent-flow",
            label: "执行Agent",
            headline: ["拆内容", "连流程"],
            body: "执行 Agent 分工把方法步骤串起来。",
            subtitle: "执行 Agent 负责拆内容、连流程和补证据。",
            diagramMode: "agent-collaboration-diagram",
            palette: "teal",
          },
          {
            id: "method-card",
            label: "方法卡",
            headline: ["知识卡", "只保留一个动作"],
            body: "知识卡收束成观众下一步能照做的动作。",
            subtitle: "最后收束成一张能执行的方法卡。",
            diagramMode: "knowledge-card-diagram",
            palette: "gold",
          },
        ],
        narration: "个人IP先建立可信的讲解角色。执行 Agent 负责拆内容、连流程和补证据。最后收束成一张能执行的方法卡。",
      }),
      expect: {
        activeExternal: ["ip-diagram-creator-planner"],
        files: [
          "workflow/ip-diagram-creator-plan.json",
          "workflow/ip-diagram-creator-native-jobs.json",
          "workflow/ip-diagram-layout-audit.json",
        ],
        minVisualRoleDistinct: 3,
        ipNativeDirectSelected: false,
        ipNativeFinalRequested: true,
        ipNativeFinalSelected: false,
        ipIntegratedSelected: false,
        ipNativeFinalStatus: "blocked-needs-native-page-provenance",
        ipPromptOnlySelected: false,
        ipPersonalIpChoice: "auto",
        ipPrimaryPlannerRoute: true,
      },
    },
    {
      id: "zh-personal-ip-diagram-natural-language",
      brief: baseBrief({
        title: "个人 IP 手绘图解视频",
        objective: "生成个人 IP 手绘图解视频，用个人 IP 形象把口播内容做成白底手绘知识卡，不要普通模板。",
        videoType: "professional-explainer",
        durationSeconds: 720,
        personalIp: {
          name: "方法课主讲人",
          allowGenericFallback: false,
        },
        scenes: [
          {
            id: "personal-ip-promise",
            label: "个人 IP 开场",
            headline: ["个人 IP", "先建立主讲角色"],
            body: "主讲人把核心观点画成一张白底手绘知识卡。",
            subtitle: "个人 IP 先把观点讲成一张图。",
            palette: "blue",
          },
          {
            id: "diagram-card",
            label: "手绘图解",
            headline: ["手绘图解", "少字多动作"],
            body: "执行 Agent 辅助搬卡片、标风险、递交结果。",
            subtitle: "执行 Agent 负责把方法拆开。",
            palette: "teal",
          },
          {
            id: "takeaway",
            label: "行动卡",
            headline: ["知识卡", "收束行动"],
            body: "最后把口播收束成观众能执行的行动卡。",
            subtitle: "最后收束成一张行动卡。",
            palette: "gold",
          },
        ],
        narration: "个人 IP 先把观点讲成一张图。执行 Agent 负责把方法拆开。最后收束成一张行动卡。",
      }),
      expect: {
        activeExternal: ["ip-diagram-creator-planner"],
        files: [
          "workflow/ip-diagram-creator-plan.json",
          "workflow/personal-ip-asset-registry.json",
          "workflow/ip-diagram-creator-native-jobs.json",
          "workflow/ip-diagram-layout-audit.json",
        ],
        ipNativeDirectSelected: false,
        ipNativeFinalRequested: true,
        ipNativeFinalSelected: false,
        ipIntegratedSelected: false,
        ipNativeFinalStatus: "blocked-needs-native-page-provenance",
        ipPromptOnlySelected: false,
        ipPersonalIpChoice: "auto",
        ipPrimaryPlannerRoute: true,
        ipPersonaStatus: "ready-default-persona",
        ipNativeMinResolvedImageCount: 24,
      },
    },
    {
      id: "writing-method",
      brief: baseBrief({
        title: "Novel writing chapter promise",
        videoType: "writing-method",
        objective: "Explain why a story chapter needs promise, pressure, and payoff.",
        scenes: [
          { id: "promise", label: "Promise", headline: ["Reader promise", "must be paid"], body: "Story evidence should be inspected.", subtitle: "A chapter needs a promise.", palette: "ink" },
          { id: "payoff", label: "Payoff", headline: ["Payoff", "opens the next question"], body: "Resolution should create the next pressure.", subtitle: "The payoff opens a new question.", palette: "red", visualStyle: "kinetic-typography" },
        ],
        narration: "A chapter needs a promise. The payoff opens a new question.",
      }),
      expect: {
        selectedTemplate: "interactive-proof-board",
        pageStyleArchetypes: ["narrative-story-lab", "narrative-story-lab"],
      },
    },
    {
      id: "ordinary-explainer-hook-no-dark-stage",
      brief: baseBrief({
        title: "普通用户科普首幕不该自动黑底",
        objective: "做一支普通用户能看懂的科普口播，开头用3秒钩子，但不请求黑色背景。",
        audience: "普通用户和小白观众",
        platform: "local-review-horizontal",
        scenes: [
          {
            id: "hook",
            label: "3秒钩子",
            headline: ["外卖公司", "做大模型", "为了办事"],
            body: "用反差开场，但画面应该保持清晰明亮。",
            subtitle: "一家外卖公司为什么要做大模型？答案不是陪聊，而是办事。",
            palette: "blue",
          },
          {
            id: "explain",
            label: "解释原因",
            headline: ["本地生活", "是一张网"],
            body: "解释用户、商家、骑手和平台工具链。",
            subtitle: "本地生活不是一道问答题，而是一整套流程。",
            palette: "teal",
          },
        ],
        narration: "一家外卖公司为什么要做大模型？答案不是陪聊，而是办事。本地生活不是一道问答题，而是一整套流程。",
      }),
      expect: {
        canvasAspect: "16:9",
        canvasVertical: false,
        firstPageThemeKeyNot: "kineticDark",
        firstPageStyleArchetypeNot: "kinetic-typography",
        shortFormHookPlanActive: false,
        shortFormHookPlanFile: false,
      },
    },
    {
      id: "mechanical-style-cycle",
      brief: baseBrief({
        title: "Longform writing method should not become a style carousel",
        videoType: "writing-method",
        visualStyle: "narrative-story-lab",
        objective: "Make a long spoken writing-method lesson from a full script. The planner should adapt visuals to the content and not hard-code a black opener plus repeated style cards.",
        scenes: [
          { id: "hook", label: "开场钩子", headline: ["爽点不是", "主角赢了"], body: "The opening should stay in the story-lab system.", subtitle: "The opening should stay in the story-lab system.", palette: "red", visualStyle: "kinetic-typography" },
          { id: "problem", label: "问题定位", headline: ["为什么反转", "不一定爽"], body: "Diagnose the writing problem.", subtitle: "Diagnose the writing problem.", palette: "purple", visualStyle: "narrative-story-lab" },
          { id: "spring", label: "情绪弹簧", headline: ["不是事件", "是弹簧"], body: "Explain pressure and release.", subtitle: "Explain pressure and release.", palette: "ink", visualStyle: "whiteboard-lesson" },
          { id: "definition", label: "核心定义", headline: ["爽点不是结果", "是释放"], body: "Define the method.", subtitle: "Define the method.", palette: "gold", visualStyle: "animated-infographic" },
          { id: "evidence", label: "压缩证据", headline: ["压缩不能靠", "情绪词"], body: "Show evidence from action.", subtitle: "Show evidence from action.", palette: "blue", visualStyle: "documentary-editorial" },
          { id: "loss", label: "可见损失", headline: ["位置、资源", "尊严被夺"], body: "Make loss visible.", subtitle: "Make loss visible.", palette: "teal", visualStyle: "kinetic-typography" },
          { id: "contrast", label: "关系对比", headline: ["关系越近", "代价越深"], body: "Contrast raises pressure.", subtitle: "Contrast raises pressure.", palette: "magenta", visualStyle: "narrative-story-lab" },
          { id: "exit", label: "出口封闭", headline: ["每条路", "都有代价"], body: "Block simple exits.", subtitle: "Block simple exits.", palette: "amber", visualStyle: "whiteboard-lesson" },
          { id: "timing", label: "释放时机", headline: ["太早太薄", "太晚折磨"], body: "Time the release.", subtitle: "Time the release.", palette: "cyan", visualStyle: "animated-infographic" },
          { id: "payoff", label: "收运", headline: ["胜利进入", "故事账本"], body: "Payoff changes the next scene.", subtitle: "Payoff changes the next scene.", palette: "green", visualStyle: "documentary-editorial" },
        ],
        narration: "The opening should stay in the story-lab system. Diagnose the writing problem. Explain pressure and release. Define the method. Show evidence from action. Make loss visible. Contrast raises pressure. Block simple exits. Time the release. Payoff changes the next scene.",
      }),
      expect: {
        selectedTemplate: "interactive-proof-board",
        firstPageStyleArchetype: "narrative-story-lab",
        ignoredMechanicalStyleCycle: true,
        minVisualRoleDistinct: 6,
        forbiddenVisualRoleDominance: { role: "method-step", maxRatio: 0.4 },
        minMotionComponentDistinct: 4,
      },
    },
    {
      id: "data-curve",
      brief: baseBrief({
        title: "Monthly adoption trend curve",
        objective: "Show a sourced metric curve over time and bind the curve to narration.",
        style: "data-newsroom",
        scenes: [
          {
            id: "trend",
            label: "Trend line",
            headline: ["Adoption rises", "then plateaus"],
            body: "The curve must trace measured values.",
            subtitle: "The adoption curve rises from January to May.",
            palette: "blue",
            chartData: {
              type: "trend-line",
              title: "Monthly adoption rate",
              metricLabel: "Adoption rate",
              unit: "%",
              year: "2026",
              sourceName: "Local self-test dataset",
              sourceUrl: "local://self-test/adoption-rate",
              values: [
                { label: "Jan", value: 12 },
                { label: "Feb", value: 18 },
                { label: "Mar", value: 27 },
                { label: "Apr", value: 31 },
                { label: "May", value: 33, highlight: true },
              ],
            },
          },
        ],
        narration: "The adoption curve rises from January to May.",
      }),
      expect: {
        selectedTemplate: "data-curve-trace",
        activeCapabilities: ["build-web-data-visualization"],
        activeExternal: ["data-or-math-motion-inserts"],
        files: ["workflow/data-source-plan.json", "workflow/data-series.json", "workflow/data-motion-plan.json"],
        motionLibraries: ["d3-diagram"],
      },
    },
    {
      id: "math-formula-motion",
      brief: baseBrief({
        title: "Geometry formula derivation",
        objective: "Explain a formula-driven geometry relationship with symbolic motion instead of a generic card.",
        style: "whiteboard-lesson",
        scenes: [
          {
            id: "formula",
            label: "Formula derivation",
            headline: ["函数轨迹", "不是装饰线"],
            body: "用函数 y = ax^2 + b 的轨迹推导焦点变化。",
            subtitle: "公式推导需要按步骤显形。",
            palette: "blue",
          },
          {
            id: "geometry",
            label: "Geometry relation",
            headline: ["坐标变化", "带来曲率变化"],
            body: "几何关系应该通过坐标、向量和曲率运动表现。",
            subtitle: "坐标变化会改变曲率。",
            palette: "teal",
          },
        ],
        narration: "公式推导需要按步骤显形。坐标变化会改变曲率。",
      }),
      expect: {
        activeCapabilities: ["build-web-data-visualization"],
        activeExternal: ["data-or-math-motion-inserts"],
        files: ["workflow/data-source-plan.json", "workflow/data-series.json", "workflow/data-motion-plan.json"],
        motionLibraries: ["manim-insert"],
      },
    },
    {
      id: "typed-opener",
      brief: baseBrief({
        title: "Explicit typed opener",
        objective: "Use an in-video opener with a black white typed title before the main claim.",
        videoType: "professional-explainer",
        scenes: [
          { id: "typed", label: "Typed opener", headline: ["Stop", "before you render"], body: "Explicit typed opener requested.", subtitle: "Use a typed opener for the first hook.", palette: "ink" },
        ],
        narration: "Use a typed opener for the first hook.",
      }),
      expect: { selectedTemplate: "typed-black-white-opener" },
    },
    {
      id: "dark-saas-product",
      brief: baseBrief({
        title: "AI product launch magic UI",
        objective: "Show a SaaS tool launch with a dark magic UI product surface and transformation cue.",
        videoType: "professional-explainer",
        style: "screen-demo",
        productSurface: {
          name: "Routing Console",
          flow: ["brief", "plan", "render", "QC"],
          purpose: "Show the product workflow as a visible interface.",
        },
        scenes: [
          { id: "product", label: "Product surface", headline: ["AI workflow", "turns into QC"], body: "The product UI should be inspectable.", subtitle: "The interface shows the transformation.", palette: "purple" },
        ],
        narration: "The interface shows the transformation.",
      }),
      expect: {
        selectedTemplate: "dark-saas-magic-ui",
        activeCapabilities: ["product-design"],
        inactiveExternal: ["ip-diagram-creator-planner"],
      },
    },
    {
      id: "raw-reference-template",
      brief: baseBrief({
        title: "Footage edit with reference and variants",
        objective: "Plan authorized raw footage editing, reference-video alignment, and template props for batch variants.",
        rawFootageDir: rel(fixtureDir),
        referenceVideoPath: rel(referencePath),
        templateProps: { headlineTone: "direct", paletteMode: "variant-safe" },
        batchVariants: [
          { id: "short", label: "Short cut", overrides: { platform: "shorts" } },
          { id: "wide", label: "Wide review", overrides: { platform: "local-review-horizontal" } },
        ],
        rights: {
          text: "original self-test",
          visuals: "local deterministic HTML/SVG",
          voice: "local TTS policy",
          music: "none",
          externalMedia: "authorized local self-test fixture",
        },
      }),
      expect: {
        activeCapabilities: ["video-use-style-footage-editing", "remotion-style-template-props", "reference-video-alignment-qc"],
        activeExternal: ["raw-footage-editing", "template-props-contract", "reference-video-alignment-qc"],
        files: [
          "workflow/raw-footage-inventory.json",
          "workflow/raw-transcript-index.json",
          "workflow/takes-packed.md",
          "workflow/word-boundary-map.json",
          "workflow/edit-decision-list.json",
          "workflow/cut-boundary-qc.json",
          "workflow/source-media-normalization-plan.json",
          "workflow/template-props-contract.json",
          "workflow/variant-render-plan.json",
          "workflow/reference-alignment/comparison.json",
          "workflow/reference-alignment/alignment-report.md",
          "workflow/reference-alignment/comparison-report.md",
        ],
      },
    },
    {
      id: "website-route",
      brief: baseBrief({
        title: "Landing page to motion video",
        objective: "Use a website source as the design input while keeping framework-owned timing and QC.",
        websiteUrl: "https://example.com/product",
      }),
      expect: {
        activeCapabilities: ["website-to-hyperframes"],
      },
    },
    {
      id: "vertical-short",
      brief: baseBrief({
        title: "Douyin short hook",
        platform: "douyin",
        aspectRatio: "9:16",
        objective: "Make a vertical short-form hook with mobile safe areas and platform cover variants.",
      }),
      expect: {
        canvasAspect: "9:16",
        canvasVertical: true,
        shortFormHookPlanActive: true,
        shortFormHookPlanFile: true,
        videoInternalCover: "cover/cover-video-opening-9x16.svg",
      },
    },
    {
      id: "vertical-personal-ip-diagram",
      brief: baseBrief({
        title: "竖屏个人 IP 图解",
        platform: "douyin",
        aspectRatio: "9:16",
        objective: "生成竖屏个人 IP 手绘图解视频，个人 IP 主讲，执行 Agent 辅助拆解。",
        videoType: "professional-explainer",
        scenes: [
          { id: "vertical-ip-hook", label: "竖屏开场", headline: ["个人 IP", "第一秒给承诺"], body: "竖屏先保留主讲人和底部字幕安全区。", subtitle: "第一秒先给承诺。", palette: "blue" },
          { id: "vertical-agent", label: "执行 Agent", headline: ["拆解", "交付"], body: "执行 Agent 只做辅助动作，不遮挡主讲和字幕。", subtitle: "执行 Agent 负责拆解和交付。", palette: "teal" },
          { id: "vertical-card", label: "行动卡", headline: ["行动卡", "能照做"], body: "收束为竖屏可读行动卡。", subtitle: "最后给一张能照做的卡。", palette: "gold" },
        ],
        narration: "第一秒先给承诺。执行 Agent 负责拆解和交付。最后给一张能照做的卡。",
      }),
      expect: {
        canvasAspect: "9:16",
        canvasVertical: true,
        shortFormHookPlanActive: true,
        shortFormHookPlanFile: true,
        activeExternal: ["ip-diagram-creator-planner"],
        ipNativeDirectSelected: false,
        ipNativeFinalRequested: true,
        ipNativeFinalSelected: false,
        ipIntegratedSelected: false,
        ipNativeFinalStatus: "blocked-needs-native-page-provenance",
        ipPersonalIpChoice: "auto",
        ipPrimaryPlannerRoute: true,
        ipPersonaStatus: "ready-default-persona",
      },
    },
  ];
}

function runScenario({ scenario, outRoot, briefDir }) {
  const out = join(outRoot, scenario.id);
  const briefPath = join(briefDir, `${scenario.id}.json`);
  writeJson(briefPath, ensureThreeScenes(scenario.brief));
  const result = spawnSync("node", [
    workflowScript,
    "--brief", briefPath,
    "--out", out,
    "--cover-only",
    "--no-open-delivery-page",
    "--image-source", "image2-dryrun",
  ], {
    cwd: workspace,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return { out, briefPath, result };
}

function capability(contract, id) {
  return (contract.capabilities || []).find((item) => item.id === id) || {};
}

function externalCapability(plan, id) {
  return (plan.capabilities || []).find((item) => item.id === id) || {};
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function validateScenario(scenario, run) {
  const failures = [];
  if (run.result.status !== 0) {
    failures.push(`workflow command failed: ${run.result.stderr || run.result.stdout}`);
    return { failures };
  }
  const out = run.out;
  const read = (path) => readJson(join(out, path));
  const motion = read("workflow/motion-template-selection.json");
  const plugin = read("workflow/plugin-routing-contract.json");
  const external = read("workflow/external-capability-fusion-plan.json");
  const quality = read("workflow/quality-consistency-contract.json");
  const design = read("workflow/design-plan.json");
  const motionGrammar = read("workflow/motion-grammar-plan.json");
  const cover = read("workflow/cover-design.json");
  const manifest = read("delivery-manifest.json");
  const shortFormHookPlanPath = join(out, "workflow", "short-form-hook-plan.json");
  const shortFormHookPlan = existsSync(shortFormHookPlanPath) ? read("workflow/short-form-hook-plan.json") : null;
  const requiredCoreFiles = [
    "workflow/content-presentation-design.json",
    "workflow/design-platform-planner.json",
    "workflow/production-plan.json",
    "workflow/material-candidate-pool.json",
    "workflow/motion-grammar-plan.json",
    "workflow/image-generation-strategy.json",
    "workflow/visual-rhythm-plan.json",
    "workflow/visual-asset-manifest.json",
    "workflow/visual-relevance-audit.json",
    "workflow/plugin-routing-contract.json",
    "workflow/external-capability-fusion-plan.json",
    "workflow/quality-consistency-contract.json",
    "workflow/retention-structure-contract.json",
    "workflow/generation-mode-contract.json",
    "workflow/semi-auto-config.json",
    "workflow/cover-design.json",
    "delivery-manifest.json",
    "semi-auto-config.html",
    "delivery-service.mjs",
  ];
  for (const file of requiredCoreFiles) assert(existsSync(join(out, file)), `missing core artifact ${file}`, failures);
  assert(manifest.mode === "semi-auto-config", "default capability route smoke must stop at semi-auto config mode", failures);
  assert(manifest.generationMode === "semi-auto", "default capability route smoke must keep ordinary topic/script intake on semi-auto", failures);
  assert(plugin.governor === "codex-video-workflow", "plugin routing governor mismatch", failures);
  assert(plugin.rule === "plugins-are-capabilities-not-quality-substitutes", "plugin routing rule mismatch", failures);
  assert(external.governor === "codex-video-workflow", "external fusion governor mismatch", failures);
  assert(external.rule === "borrow-capabilities-not-frameworks", "external fusion rule mismatch", failures);
  assert((quality.requiredArtifacts || []).includes("workflow/external-capability-fusion-plan.json"), "quality contract does not require external fusion plan", failures);
  assert((quality.requiredArtifacts || []).includes("workflow/retention-structure-contract.json"), "quality contract does not require retention structure contract", failures);
  assert(manifest.files?.externalCapabilityFusionPlan === "workflow/external-capability-fusion-plan.json", "manifest does not expose external fusion plan", failures);
  assert(manifest.files?.retentionStructureContract === "workflow/retention-structure-contract.json", "manifest does not expose retention structure contract", failures);

  const expect = scenario.expect || {};
  if (expect.selectedTemplate) {
    assert(motion.selectedTemplate === expect.selectedTemplate, `expected template ${expect.selectedTemplate}, got ${motion.selectedTemplate}`, failures);
  }
  for (const id of expect.activeCapabilities || []) {
    assert(capability(plugin, id).active === true, `expected plugin capability active: ${id}`, failures);
  }
  for (const id of expect.inactiveCapabilities || []) {
    assert(capability(plugin, id).active !== true, `expected plugin capability inactive: ${id}`, failures);
  }
  for (const id of expect.activeExternal || []) {
    assert(externalCapability(external, id).active === true, `expected external capability active: ${id}`, failures);
  }
  for (const id of expect.inactiveExternal || []) {
    assert(externalCapability(external, id).active !== true, `expected external capability inactive: ${id}`, failures);
  }
	  for (const file of expect.files || []) {
	    assert(existsSync(join(out, file)), `missing expected routed artifact ${file}`, failures);
	  }
	  if (typeof expect.ipNativeDirectSelected === "boolean"
        || typeof expect.ipNativeFinalRequested === "boolean"
        || typeof expect.ipNativeFinalSelected === "boolean"
        || typeof expect.ipIntegratedSelected === "boolean"
        || typeof expect.ipPromptOnlySelected === "boolean"
        || expect.ipNativeFinalStatus
        || expect.ipPersonalIpChoice) {
	    const ipPlan = read("workflow/ip-diagram-creator-plan.json");
	    const nativeDirect = (ipPlan.executionModes || []).find((mode) => mode.id === "native-skill-direct-generation") || {};
	    const nativeFinal = (ipPlan.executionModes || []).find((mode) => mode.id === "native-final-video") || {};
	    const integrated = (ipPlan.executionModes || []).find((mode) => mode.id === "integrated-html-video-composition") || {};
	    const promptOnly = (ipPlan.executionModes || []).find((mode) => mode.id === "prompt-only-native-handoff") || {};
	    if (typeof expect.ipNativeDirectSelected === "boolean") {
	      assert(nativeDirect.selected === expect.ipNativeDirectSelected, `expected native-skill-direct-generation selected=${expect.ipNativeDirectSelected}, got ${nativeDirect.selected}`, failures);
	      assert(ipPlan.nativeDirectUsePlan?.selectedNow === expect.ipNativeDirectSelected, `expected nativeDirectUsePlan.selectedNow=${expect.ipNativeDirectSelected}, got ${ipPlan.nativeDirectUsePlan?.selectedNow}`, failures);
	    }
	    if (typeof expect.ipNativeFinalRequested === "boolean") {
	      assert(ipPlan.nativeFinalVideoPlan?.requestedNow === expect.ipNativeFinalRequested, `expected nativeFinalVideoPlan.requestedNow=${expect.ipNativeFinalRequested}, got ${ipPlan.nativeFinalVideoPlan?.requestedNow}`, failures);
	    }
	    if (typeof expect.ipNativeFinalSelected === "boolean") {
	      assert(nativeFinal.selected === expect.ipNativeFinalSelected, `expected native-final-video selected=${expect.ipNativeFinalSelected}, got ${nativeFinal.selected}`, failures);
	      assert(ipPlan.nativeFinalVideoPlan?.selectedNow === expect.ipNativeFinalSelected, `expected nativeFinalVideoPlan.selectedNow=${expect.ipNativeFinalSelected}, got ${ipPlan.nativeFinalVideoPlan?.selectedNow}`, failures);
	    }
	    if (typeof expect.ipIntegratedSelected === "boolean") {
	      assert(integrated.selected === expect.ipIntegratedSelected, `expected integrated-html-video-composition selected=${expect.ipIntegratedSelected}, got ${integrated.selected}`, failures);
	    }
	    if (expect.ipNativeFinalStatus) {
	      assert(ipPlan.nativeFinalVideoPlan?.status === expect.ipNativeFinalStatus, `expected nativeFinalVideoPlan.status=${expect.ipNativeFinalStatus}, got ${ipPlan.nativeFinalVideoPlan?.status}`, failures);
	      assert(nativeFinal.status === expect.ipNativeFinalStatus, `expected native-final-video mode status=${expect.ipNativeFinalStatus}, got ${nativeFinal.status}`, failures);
	    }
	    if (typeof expect.ipPromptOnlySelected === "boolean") {
	      assert(promptOnly.selected === expect.ipPromptOnlySelected, `expected prompt-only-native-handoff selected=${expect.ipPromptOnlySelected}, got ${promptOnly.selected}`, failures);
	    }
	    if (expect.ipPersonalIpChoice) {
	      assert(ipPlan.userChoices?.makePersonalIp === expect.ipPersonalIpChoice, `expected makePersonalIp=${expect.ipPersonalIpChoice}, got ${ipPlan.userChoices?.makePersonalIp}`, failures);
	    }
	    if (typeof expect.ipPrimaryPlannerRoute === "boolean") {
	      assert(ipPlan.primaryPlannerRoute === expect.ipPrimaryPlannerRoute, `expected ip primaryPlannerRoute=${expect.ipPrimaryPlannerRoute}, got ${ipPlan.primaryPlannerRoute}`, failures);
	    }
	    if (expect.ipPersonaStatus) {
	      assert(ipPlan.personalIpAssetRegistry?.status === expect.ipPersonaStatus, `expected personal IP persona status ${expect.ipPersonaStatus}, got ${ipPlan.personalIpAssetRegistry?.status}`, failures);
	    }
	    if (expect.ipNativeMinResolvedImageCount) {
	      const nativeCount = Number(ipPlan.imageCountPolicy?.nativeSourcePageCountPolicy?.resolvedImageCount || 0);
	      const durationTarget = Number(ipPlan.imageCountPolicy?.nativeSourcePageCountPolicy?.contentMetrics?.durationBasedTarget || 0);
	      assert(nativeCount >= expect.ipNativeMinResolvedImageCount, `expected duration-aware personal IP native pages >= ${expect.ipNativeMinResolvedImageCount}, got ${nativeCount}`, failures);
	      assert(durationTarget >= expect.ipNativeMinResolvedImageCount, `expected durationBasedTarget >= ${expect.ipNativeMinResolvedImageCount}, got ${durationTarget}`, failures);
	    }
	  }
	  for (const libraryId of expect.motionLibraries || []) {
    assert((motion.motionLibraryRouting?.selectedLibraries || []).includes(libraryId), `expected motion library route: ${libraryId}`, failures);
  }
  if (expect.canvasAspect) {
    assert(design.canvas?.aspect === expect.canvasAspect || cover.videoInternalCover?.ratio === expect.canvasAspect, `expected canvas/cover aspect ${expect.canvasAspect}`, failures);
  }
  if (typeof expect.canvasVertical === "boolean") {
    const vertical = design.canvas?.vertical ?? (cover.videoInternalCover?.ratio === "9:16");
    assert(vertical === expect.canvasVertical, `expected canvas vertical=${expect.canvasVertical}, got ${vertical}`, failures);
  }
  if (typeof expect.shortFormHookPlanActive === "boolean") {
    assert(Boolean(shortFormHookPlan?.active) === expect.shortFormHookPlanActive, `expected short-form hook plan active=${expect.shortFormHookPlanActive}`, failures);
  }
  if (typeof expect.shortFormHookPlanFile === "boolean") {
    assert(existsSync(shortFormHookPlanPath) === expect.shortFormHookPlanFile, `expected short-form hook plan file present=${expect.shortFormHookPlanFile}`, failures);
  }
  if (expect.videoInternalCover) {
    assert(manifest.files?.videoInternalCover === expect.videoInternalCover || cover.videoInternalCover?.file === expect.videoInternalCover, `expected video internal cover ${expect.videoInternalCover}`, failures);
  }
  if (expect.firstPageStyleArchetype) {
    assert(design.pages?.[0]?.styleArchetype === expect.firstPageStyleArchetype, `expected first page style ${expect.firstPageStyleArchetype}, got ${design.pages?.[0]?.styleArchetype}`, failures);
  }
  if (expect.firstPageStyleArchetypeNot) {
    assert(design.pages?.[0]?.styleArchetype !== expect.firstPageStyleArchetypeNot, `first page style should not be ${expect.firstPageStyleArchetypeNot}`, failures);
  }
  if (expect.firstPageThemeKeyNot) {
    assert(design.pages?.[0]?.themeKey !== expect.firstPageThemeKeyNot, `first page theme should not be ${expect.firstPageThemeKeyNot}`, failures);
  }
  if (expect.pageStyleArchetypes) {
    for (let i = 0; i < expect.pageStyleArchetypes.length; i += 1) {
      assert(design.pages?.[i]?.styleArchetype === expect.pageStyleArchetypes[i], `expected page ${i + 1} style ${expect.pageStyleArchetypes[i]}, got ${design.pages?.[i]?.styleArchetype}`, failures);
    }
  }
  if (expect.ignoredMechanicalStyleCycle) {
    assert(design.styleOverridePolicy?.mechanicalStyleCycleDetected === true, "expected mechanical style cycle detection", failures);
    assert(design.styleOverridePolicy?.sceneStyleOverrideMode === "ignore-mechanical-cycle", "expected mechanical style cycle to be ignored", failures);
  }
  if (expect.minVisualRoleDistinct) {
    const roles = (design.pages || []).map((page) => page.visualRole).filter(Boolean);
    assert(new Set(roles).size >= expect.minVisualRoleDistinct, `expected at least ${expect.minVisualRoleDistinct} distinct visual roles, got ${new Set(roles).size}: ${roles.join(", ")}`, failures);
  }
  if (expect.forbiddenVisualRoleDominance) {
    const roles = (design.pages || []).map((page) => page.visualRole || "");
    const count = roles.filter((role) => role === expect.forbiddenVisualRoleDominance.role).length;
    const ratio = roles.length ? count / roles.length : 1;
    assert(ratio <= expect.forbiddenVisualRoleDominance.maxRatio, `visual role ${expect.forbiddenVisualRoleDominance.role} dominates ${ratio.toFixed(2)} of pages`, failures);
  }
  if (expect.minMotionComponentDistinct) {
    const components = (motionGrammar.components || [])
      .map((component) => component.selectedComponent || component.component)
      .filter(Boolean);
    assert(new Set(components).size >= expect.minMotionComponentDistinct, `expected at least ${expect.minMotionComponentDistinct} distinct motion grammar components, got ${new Set(components).size}: ${components.join(", ")}`, failures);
  }
  assert(motion.remotionMotionPrimitives?.sourcePlugin === "remotion", "motion template selection must include Remotion-inspired primitives", failures);
  assert((motion.remotionMotionPrimitives?.scenes || []).length === (design.pages || []).length, "Remotion primitive scene count must match design pages", failures);
  assert((motion.remotionMotionPrimitives?.sceneTriggerMap || []).length === (design.pages || []).length, "Remotion scene trigger map must match design pages", failures);
  assert((motion.remotionMotionPrimitives?.sceneTriggerMap || []).every((scene) => scene.activationMode && (scene.triggerPoints || []).length >= 4), "Remotion trigger map must name activation mode and trigger points", failures);
  assert((motionGrammar.components || []).every((component) => component.remotionPrimitive?.frameClock && component.remotionPrimitive?.easing && component.remotionPrimitive?.triggerProfile?.activationMode), "motion grammar components must include Remotion primitive timing/easing/trigger profile", failures);
  if (motion.selectedTemplate === "data-curve-trace") {
    const dataSource = read("workflow/data-source-plan.json");
    const dataSeries = read("workflow/data-series.json");
    const dataMotion = read("workflow/data-motion-plan.json");
    assert(dataSource.stage === "pre-render-data-source-plan", "data-source-plan stage mismatch", failures);
    assert(dataSeries.series?.some((series) => series.points?.length > 0 || series.nodes?.length > 0), "data-series has no measured values or nodes", failures);
    assert(dataMotion.selectedTemplate === "data-curve-trace", "data-motion-plan selected template mismatch", failures);
    assert((quality.requiredArtifacts || []).includes("workflow/data-source-plan.json"), "quality contract missing data-source-plan requirement", failures);
  }
  return {
    failures,
    selectedTemplate: motion.selectedTemplate,
    selectedActiveCapabilities: plugin.selectedActiveCapabilities || [],
    externalSignals: external.routingSignals || {},
    output: out,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const outRoot = resolve(args.outRoot);
  if (!args.keepExisting && existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });
  ensureDir(outRoot);
  const fixtureDir = join(outRoot, "fixtures");
  const briefDir = join(outRoot, "briefs");
  ensureDir(fixtureDir);
  ensureDir(briefDir);
  const registry = readJson(registryPath);
  const expectedTemplates = (registry.templates || []).map((template) => template.id).sort();
  const rows = [];
  const workflowSource = readFileSync(workflowScript, "utf8");
  const hasStyleWideVisualHide = /\.style-[^{]+\.visual-plate,[\s\S]{0,1200}\{\s*display:\s*none;\s*\}/.test(workflowSource);
  rows.push({
    id: "template-visual-layer-regression",
    ok: !hasStyleWideVisualHide
      && /proofRouteIds\.has\(decisionId\)/.test(workflowSource)
      && /videoType === "writing-method"[\s\S]{0,220}narrative-story-lab/.test(workflowSource)
      && /roleSpecific\[role\] \|\| roleSpecific\["guided-note"\]/.test(workflowSource)
      && /role-\$\{capabilitySlug\(page\.visualRole/.test(workflowSource)
      && /textPresentationForTreatment/.test(workflowSource)
      && /data-text-presentation/.test(workflowSource)
      && /text-intelligence/.test(workflowSource)
      && /ordinary left paragraph/.test(workflowSource),
    selectedTemplate: "static-script-contract",
    activeCapabilities: [],
    externalSignals: {},
    failures: [
      hasStyleWideVisualHide ? "style-wide visual/card/motion-note display:none rule would hide ordinary video elements" : "",
      !/proofRouteIds\.has\(decisionId\)/.test(workflowSource) ? "capability visual class is not gated to proof-capability routes" : "",
      !/videoType === "writing-method"[\s\S]{0,220}narrative-story-lab/.test(workflowSource) ? "writing-method style priority no longer forces story-lab before kinetic dark" : "",
      !/roleSpecific\[role\] \|\| roleSpecific\["guided-note"\]/.test(workflowSource) ? "unknown local illustration role falls back to hook instead of neutral guided-note" : "",
      !/role-\$\{capabilitySlug\(page\.visualRole/.test(workflowSource) ? "frame HTML no longer exposes role-specific classes for typography/design variation" : "",
      !/textPresentationForTreatment/.test(workflowSource) ? "typography plan no longer creates scene-specific text presentation modes" : "",
      !/data-text-presentation/.test(workflowSource) ? "rendered HTML no longer exposes the selected text presentation mode" : "",
      !/text-intelligence/.test(workflowSource) ? "semantic text info rail no longer renders beside main text" : "",
      !/ordinary left paragraph/.test(workflowSource) ? "regression guard for plain left-column text is missing" : "",
    ].filter(Boolean),
    output: workflowScript,
  });
  const retiredPersonalIpTemplateStillRenderable = /return `?<svg class="ip-persona-svg"[\s\S]{0,300}data-personal-ip-persona-source="template-fallback"/.test(workflowSource);
  rows.push({
    id: "personal-ip-retired-template-guard",
    ok: !retiredPersonalIpTemplateStillRenderable
      && /data-personal-ip-persona-source="fixed-persona-manifest"/.test(workflowSource)
      && /data-personal-ip-persona-source="missing-fixed-persona"/.test(workflowSource)
      && /personalIpTemplateFallbackRemoved/.test(workflowSource)
      && /personalIpFixedPersonaRendered/.test(workflowSource),
    selectedTemplate: "static-personal-ip-contract",
    activeCapabilities: [],
    externalSignals: {},
    failures: [
      retiredPersonalIpTemplateStillRenderable ? "retired personal-IP SVG/template fallback is still reachable from the render path" : "",
      !/data-personal-ip-persona-source="fixed-persona-manifest"/.test(workflowSource) ? "fixed persona manifest render evidence marker is missing" : "",
      !/data-personal-ip-persona-source="missing-fixed-persona"/.test(workflowSource) ? "missing fixed persona state marker is missing" : "",
      !/personalIpTemplateFallbackRemoved/.test(workflowSource) ? "QC no longer checks retired template fallback removal" : "",
      !/personalIpFixedPersonaRendered/.test(workflowSource) ? "QC no longer requires fixed persona render evidence" : "",
    ].filter(Boolean),
    output: workflowScript,
  });
  for (const scenario of scenarios(fixtureDir)) {
    const run = runScenario({ scenario, outRoot, briefDir });
    const validation = validateScenario(scenario, run);
    rows.push({
      id: scenario.id,
      ok: validation.failures.length === 0,
      selectedTemplate: validation.selectedTemplate || null,
      activeCapabilities: validation.selectedActiveCapabilities || [],
      externalSignals: validation.externalSignals || {},
      failures: validation.failures,
      output: validation.output || run.out,
      stdout: run.result.stdout,
      stderr: run.result.stderr,
    });
  }
  const reachedTemplates = [...new Set(rows.map((row) => row.selectedTemplate).filter(Boolean))].sort();
  const missingTemplates = expectedTemplates.filter((id) => !reachedTemplates.includes(id));
  if (missingTemplates.length) {
    rows.push({
      id: "registry-template-reachability",
      ok: false,
      selectedTemplate: null,
      activeCapabilities: [],
      externalSignals: {},
      failures: [`templates not reachable by self-test scenarios: ${missingTemplates.join(", ")}`],
      output: outRoot,
    });
  }
  const ok = rows.every((row) => row.ok);
  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    outRoot,
    registry: rel(registryPath),
    expectedTemplates,
    reachedTemplates,
    rows,
  };
  writeJson(join(outRoot, "capability-routing-self-test-report.json"), report);
  const markdown = [
    "# Capability Routing Self-Test",
    "",
    `Status: ${ok ? "PASS" : "FAIL"}`,
    "",
    `Output root: ${outRoot}`,
    "",
    "| Scenario | Status | Template | Output |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.id} | ${row.ok ? "PASS" : "FAIL"} | ${row.selectedTemplate || "-"} | ${row.output || "-"} |`),
    "",
    "## Failures",
    "",
    ...rows.flatMap((row) => row.failures.length ? [`### ${row.id}`, "", ...row.failures.map((failure) => `- ${failure}`), ""] : []),
  ].join("\n");
  writeFileSync(join(outRoot, "capability-routing-self-test-report.md"), markdown + "\n");
  console.log(JSON.stringify({
    ok,
    outRoot,
    report: join(outRoot, "capability-routing-self-test-report.json"),
    reachedTemplates,
    missingTemplates,
    scenarios: rows.map((row) => ({ id: row.id, ok: row.ok, selectedTemplate: row.selectedTemplate, failures: row.failures })),
  }, null, 2));
  if (!ok) process.exitCode = 1;
}

main();
