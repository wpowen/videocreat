#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {
    packageDir: "",
    out: "",
    title: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--package" || arg === "--package-dir" || arg === "--out-dir") {
      args.packageDir = argv[++i] || "";
    } else if (arg === "--out") {
      args.out = argv[++i] || "";
    } else if (arg === "--title") {
      args.title = argv[++i] || "";
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return `Usage:
  node .agents/skills/codex-video-workflow/scripts/build-page-review-html.mjs \\
    --package <video-package-dir> [--out <html-path>] [--title <review-title>]

Creates a self-contained page-review.html from workflow/page-decision-contract.json,
workflow/design-plan.json, motion/caption/type artifacts, and local render evidence.`;
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTextIfExists(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function viewerSafeText(value) {
  return String(value ?? "")
    .replace(/\bVue(?:\.js)?\b/g, "组件化页面方案")
    .replace(/\bReact(?:\.js)?\b/g, "组件化页面方案")
    .replace(/\bNext(?:\.js)?\b/g, "页面应用方案")
    .replace(/\bNuxt(?:\.js)?\b/g, "页面应用方案")
    .replace(/\bAngular\b/g, "组件化页面方案")
    .replace(/\bSvelte\b/g, "组件化页面方案")
    .replace(/\bTailwind(?:\s+CSS)?\b/gi, "样式系统")
    .replace(/\bFramer\s+Motion\b/gi, "界面动效方案")
    .replace(/\bGSAP\b/g, "高级动效路线")
    .replace(/\bThree(?:\.js)?\b/g, "三维动效方案")
    .replace(/\bD3(?:\.js)?\b/g, "数据可视化方案")
    .replace(/\bManim\b/gi, "数学动画方案")
    .replace(/\bLottie\b/gi, "矢量动效方案")
    .replace(/\bVite\b/g, "本地预览工具");
}

function escapeHtml(value) {
  return viewerSafeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compactText(value, max = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "item";
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== ""))];
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function findByScene(items, sceneId) {
  return arrayify(items).find((item) => item?.sceneId === sceneId || item?.id === sceneId || item?.frameId === sceneId) || {};
}

function readCatalogs(skillRoot) {
  const motionRegistry = readJsonIfExists(join(skillRoot, "templates/html-motion/motion-template-registry.json")) || {};
  const captionCatalog = readJsonIfExists(join(skillRoot, "assets/caption-style-catalog.json")) || {};
  const typographyCatalog = readJsonIfExists(join(skillRoot, "assets/typography-style-catalog.json")) || {};
  return {
    motionTemplates: arrayify(motionRegistry.templates),
    captionStyles: arrayify(captionCatalog.styles),
    captionGroups: arrayify(captionCatalog.groups),
    typeTreatments: arrayify(typographyCatalog.typeTreatments),
    motionFamilies: arrayify(typographyCatalog.motionFamilies),
    fontFamilies: arrayify(typographyCatalog.fontFamilies),
  };
}

function collectStageFiles(packageDir) {
  const htmlVideoDir = join(packageDir, ".html-video/projects");
  if (!existsSync(htmlVideoDir)) return new Map();
  const projectList = readDirSafe(htmlVideoDir).filter((name) => name.startsWith("proj_"));
  const stageFiles = new Map();
  for (const project of projectList) {
    const framesDir = join(htmlVideoDir, project, "frames");
    for (const file of readDirSafe(framesDir)) {
      const match = file.match(/^(\d{2})-(.+)\.html$/);
      if (match) stageFiles.set(match[2], join(framesDir, file));
    }
  }
  return stageFiles;
}

function readDirSafe(path) {
  try {
    return existsSync(path) ? readdirSync(path) : [];
  } catch {
    return [];
  }
}

function relPath(fromDir, path) {
  if (!path) return "";
  return relative(fromDir, path).split("\\").join("/");
}

function publicPath(value) {
  return String(value || "").split("\\").join("/");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numbersFromText(text, fallbackSeed = 1) {
  const matches = [...String(text || "").matchAll(/(\d+(?:\.\d+)?)(\s*[万亿%]?)/g)]
    .slice(0, 4)
    .map((match, index) => {
      const raw = Number(match[1]);
      const normalized = Number.isFinite(raw) ? raw : 10 + index * 15;
      return {
        label: `${match[1]}${match[2] || ""}`.trim(),
        value: clamp((normalized % 100) || normalized / 10, 18, 96),
      };
    });
  if (matches.length) return matches;
  return [0, 1, 2].map((index) => ({
    label: `${Math.round(24 + fallbackSeed * 7 + index * 18)}%`,
    value: clamp(28 + fallbackSeed * 9 + index * 16, 18, 94),
  }));
}

function capabilityCatalog() {
  return [
    {
      id: "horizontal-default",
      title: "横屏默认",
      category: "画布",
      description: "默认 16:9 / 1920x1080，本地审核视频；只有明确短视频/竖屏时才切 9:16。",
    },
    {
      id: "vertical-short",
      title: "竖屏短视频",
      category: "画布",
      description: "Douyin/TikTok/Shorts/Reels 触发，包含 3 秒钩子、移动安全区和 payoff loop。",
    },
    {
      id: "content-presentation",
      title: "内容呈现设计",
      category: "规划",
      description: "按主题、受众、内容任务、信息层级、视觉隐喻和展示逻辑决定页面内容。",
    },
    {
      id: "page-decision-contract",
      title: "逐页五问契约",
      category: "规划",
      description: "逐页回答内容、设计、交互表达、动画、决策归属，作为生成前的审核面。",
    },
    {
      id: "motion-planning",
      title: "动态规划",
      category: "动效",
      description: "选择 HTML motion template、motion verb、组件、节奏和旁白同步关系。",
    },
    {
      id: "image-drawing",
      title: "图片绘制 / SVG 图形",
      category: "视觉",
      description: "确定性 HTML/SVG/CSS 图形、证据卡、图表、流程板和解释型画面。",
    },
    {
      id: "image-generation",
      title: "图片生成",
      category: "视觉",
      description: "Image2 / Codex built-in 路由，生成封面或场景解释板，精确文字仍由 HTML 层负责。",
    },
    {
      id: "caption-system",
      title: "高级字幕样式",
      category: "字幕",
      description: "字幕风格、几何、安全区、关键词强调和单行顺序显示策略。",
    },
    {
      id: "typography-motion",
      title: "字体与文字动效",
      category: "文字",
      description: "字体栈、标题/正文/数字角色、文字呈现模式、语义动效和可读性约束。",
    },
    {
      id: "data-math-motion",
      title: "数据 / 数学动效",
      category: "动效",
      description: "曲线、排行、份额、公式、几何路径或 D3/Manim 风格插入。",
    },
    {
      id: "whiteboard-layered-reveal",
      title: "白板绘制模式",
      category: "视觉",
      description: "手绘/粗线/标注作为前景层叠加，背景、字幕、QC 仍由主框架管理。",
    },
    {
      id: "ip-diagram-personal",
      title: "个人 IP / 口播教学",
      category: "人物/IP",
      description: "个人 IP 角色、知识卡、手绘图解、课程页和 Agent 协作图的规划能力。",
    },
    {
      id: "free-stock-broll",
      title: "免费素材 / B-roll",
      category: "素材",
      description: "商业兼容素材检索、授权台账、下载归一化和场景级插入。",
    },
    {
      id: "raw-footage-editing",
      title: "授权原片剪辑",
      category: "剪辑",
      description: "转录索引、词边界、EDL、切点 QC 和输出时间线字幕绑定。",
    },
    {
      id: "qc-delivery",
      title: "最终 QC 与交付页",
      category: "交付",
      description: "ffprobe、音量、静音、黑帧、截图、覆盖率、封面和 delivery.html。",
    },
  ];
}

function isCapabilityActive(capability, context) {
  const activeExternalIds = new Set(arrayify(context.externalPlan.capabilities).filter((item) => item?.active).map((item) => item.id));
  const selectedLibraries = new Set(arrayify(context.motionSelection.motionLibraryRouting?.selectedLibraries));
  const requiredArtifacts = new Set(arrayify(context.qualityContract.requiredArtifacts));
  const checks = context.qc?.checks || {};
  const map = {
    "horizontal-default": context.canvas?.ratio === "16:9" || context.canvas?.width > context.canvas?.height,
    "vertical-short": context.canvas?.ratio === "9:16" || context.canvas?.height > context.canvas?.width,
    "content-presentation": Boolean(context.contentDesign.topicType),
    "page-decision-contract": context.pageDecision.coverage?.allPagesAnswerFiveQuestions === true || checks.pageDecisionContractPresent === true,
    "motion-planning": Boolean(context.motionSelection.selectedTemplate),
    "image-drawing": context.pages.some((page) => page.design?.visualAssetDecision?.deterministicVisualSystemPreferred !== false),
    "image-generation": requiredArtifacts.has("workflow/image-generation-strategy.json") || existsSync(join(context.packageDir, "workflow/image-generation-strategy.json")),
    "caption-system": Boolean(context.captionPlan.status),
    "typography-motion": Boolean(context.typographyPlan.status),
    "data-math-motion": selectedLibraries.has("d3-diagram") || selectedLibraries.has("manim-insert") || activeExternalIds.has("data-or-math-motion-inserts"),
    "whiteboard-layered-reveal": activeExternalIds.has("whiteboard-layered-reveal"),
    "ip-diagram-personal": activeExternalIds.has("ip-diagram-creator-planner") || existsSync(join(context.packageDir, "workflow/ip-diagram-creator-plan.json")),
    "free-stock-broll": activeExternalIds.has("free-stock-material-ingest"),
    "raw-footage-editing": activeExternalIds.has("raw-footage-editing"),
    "qc-delivery": checks.pageDecisionContractPresent === true || existsSync(join(context.packageDir, "delivery.html")),
  };
  return Boolean(map[capability.id]);
}

function buildContext(packageDir, skillRoot) {
  const workflowDir = join(packageDir, "workflow");
  const pageDecision = readJsonIfExists(join(workflowDir, "page-decision-contract.json")) || {};
  const designPlan = readJsonIfExists(join(workflowDir, "design-plan.json")) || {};
  const contentDesign = readJsonIfExists(join(workflowDir, "content-presentation-design.json")) || {};
  const motionSelection = readJsonIfExists(join(workflowDir, "motion-template-selection.json")) || {};
  const captionPlan = readJsonIfExists(join(workflowDir, "caption-style-plan.json")) || {};
  const typographyPlan = readJsonIfExists(join(workflowDir, "typography-motion-plan.json")) || {};
  const qualityContract = readJsonIfExists(join(workflowDir, "quality-consistency-contract.json")) || {};
  const externalPlan = readJsonIfExists(join(workflowDir, "external-capability-fusion-plan.json")) || {};
  const visualRhythm = readJsonIfExists(join(workflowDir, "visual-rhythm-plan.json")) || {};
  const imageStrategy = readJsonIfExists(join(workflowDir, "image-generation-strategy.json")) || {};
  const mediaPlan = readJsonIfExists(join(workflowDir, "media-routing-plan.json")) || {};
  const qc = readJsonIfExists(join(packageDir, "logs/qc.json")) || {};
  const manifest = readJsonIfExists(join(packageDir, "delivery-manifest.json")) || {};
  const narration = readTextIfExists(join(packageDir, "script/narration-spoken.txt")) || readTextIfExists(join(packageDir, "script/narration.txt"));
  const catalogs = readCatalogs(skillRoot);
  const stageFiles = collectStageFiles(packageDir);

  const designPages = arrayify(designPlan.pages);
  const motionPages = arrayify(motionSelection.sceneTemplates);
  const captionPages = arrayify(captionPlan.scenes);
  const typographyPages = arrayify(typographyPlan.scenes);
  const qualityPages = arrayify(qualityContract.sceneContracts);
  const visualRhythmPages = arrayify(visualRhythm.scenes);

  const pages = arrayify(pageDecision.pages).map((page, index) => {
    const sceneId = page.sceneId || page.id || designPages[index]?.id || `page-${index + 1}`;
    const design = findByScene(designPages, sceneId);
    const motion = findByScene(motionPages, sceneId);
    const caption = findByScene(captionPages, sceneId);
    const typography = findByScene(typographyPages, sceneId);
    const quality = findByScene(qualityPages, sceneId);
    const rhythm = findByScene(visualRhythmPages, sceneId);
    const order = page.order || design.sceneIndex || index + 1;
    const screenshotPath = join(packageDir, "screenshots", `frame-${String(order).padStart(2, "0")}.png`);
    return {
      sceneId,
      order,
      page,
      design,
      motion,
      caption,
      typography,
      quality,
      rhythm,
      stageFile: stageFiles.get(sceneId),
      screenshot: existsSync(screenshotPath) ? screenshotPath : "",
    };
  });

  const canvas = pageDecision.canvas || designPlan.canvas || {
    width: qc.width || 1920,
    height: qc.height || 1080,
    ratio: qc.width && qc.height ? `${qc.width}:${qc.height}` : "16:9",
  };

  return {
    packageDir,
    workflowDir,
    pageDecision,
    designPlan,
    contentDesign,
    motionSelection,
    captionPlan,
    typographyPlan,
    qualityContract,
    externalPlan,
    visualRhythm,
    imageStrategy,
    mediaPlan,
    qc,
    manifest,
    narration,
    catalogs,
    pages,
    canvas,
  };
}

function renderPills(items, className = "") {
  return arrayify(items)
    .filter((item) => item !== undefined && item !== null && String(item).trim() !== "")
    .map((item) => `<span class="pill ${className}">${escapeHtml(item)}</span>`)
    .join("");
}

function renderMetricBars(numbers) {
  return `<div class="viz-bars">${numbers.map((item, index) => `
    <div class="viz-bar-row">
      <span>${escapeHtml(index === 0 ? "A" : index === 1 ? "B" : index === 2 ? "C" : "D")}</span>
      <i style="--w:${item.value}%"></i>
      <b>${escapeHtml(item.label)}</b>
    </div>`).join("")}</div>`;
}

function renderTrendSvg(accent) {
  return `<svg class="viz-svg" viewBox="0 0 320 170" role="img" aria-label="趋势线预览">
    <defs>
      <linearGradient id="trend-${slug(accent)}" x1="0" x2="1">
        <stop offset="0" stop-color="${escapeHtml(accent)}" stop-opacity=".28"/>
        <stop offset="1" stop-color="${escapeHtml(accent)}" stop-opacity=".9"/>
      </linearGradient>
    </defs>
    <g class="grid-lines">
      <path d="M18 35H302M18 75H302M18 115H302M18 155H302"/>
      <path d="M55 20V155M125 20V155M195 20V155M265 20V155"/>
    </g>
    <path class="area" d="M22 142 C55 122 70 116 94 118 C130 120 126 86 162 82 C198 78 205 42 245 46 C277 49 288 30 302 26 L302 155 L22 155Z" fill="url(#trend-${slug(accent)})"/>
    <path class="line" d="M22 142 C55 122 70 116 94 118 C130 120 126 86 162 82 C198 78 205 42 245 46 C277 49 288 30 302 26" fill="none" stroke="${escapeHtml(accent)}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="245" cy="46" r="7" fill="${escapeHtml(accent)}"/>
  </svg>`;
}

function renderDonut(accent, numbers) {
  const first = Math.round(numbers[0]?.value || 62);
  return `<div class="viz-donut" style="--accent:${escapeHtml(accent)};--share:${first}%">
    <div><b>${escapeHtml(numbers[0]?.label || `${first}%`)}</b><span>share / weight</span></div>
  </div>`;
}

function renderTimeline(pageModel) {
  const content = pageModel.page.contentAnswer || {};
  const labels = unique([
    content.pageRole,
    pageModel.motion.motionVerb,
    pageModel.motion.component,
    pageModel.caption.selectedStyleId || pageModel.page.contentDesignAnswer?.captionTreatment?.selectedStyleId,
  ]).slice(0, 4);
  return `<div class="viz-timeline">${labels.map((label, index) => `
    <div class="timeline-node">
      <i>${String(index + 1).padStart(2, "0")}</i>
      <span>${escapeHtml(label)}</span>
    </div>`).join("")}</div>`;
}

function renderProofCards(pageModel) {
  const design = pageModel.page.contentDesignAnswer || {};
  const motion = pageModel.page.animationAnswer || {};
  const items = [
    ["内容", pageModel.page.contentAnswer?.contentJob],
    ["设计", design.styleLabel || design.styleArchetype],
    ["动效", motion.motionVerb || pageModel.motion.motionVerb],
  ];
  return `<div class="viz-proof">${items.map(([label, value]) => `
    <div class="proof-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "待定")}</strong>
    </div>`).join("")}</div>`;
}

function renderContrastSwap(pageModel) {
  const content = pageModel.page.contentAnswer || {};
  const tokens = compactText(content.supportMessage || content.narrationBeat || "", 64).split(/[，,。；;]/).filter(Boolean).slice(0, 2);
  return `<div class="viz-contrast">
    <div><span>旧理解</span><b>${escapeHtml(tokens[0] || "单点突破")}</b></div>
    <div><span>新模型</span><b>${escapeHtml(tokens[1] || content.primaryMessage || "结构推进")}</b></div>
  </div>`;
}

function renderWhiteboard(pageModel) {
  const title = pageModel.page.contentAnswer?.primaryMessage || "结构图";
  return `<div class="viz-whiteboard">
    <svg viewBox="0 0 320 170" role="img" aria-label="白板预览">
      <path d="M40 48 C88 22 143 24 182 50 S244 74 282 38" />
      <path d="M54 126 C98 98 143 108 178 128 S236 143 282 104" />
      <circle cx="80" cy="70" r="22" />
      <rect x="185" y="62" width="72" height="46" rx="16" />
      <path d="M104 74 L185 82" />
      <path d="M257 84 L288 104" />
    </svg>
    <b>${escapeHtml(compactText(title, 28))}</b>
  </div>`;
}

function renderVisualPreview(pageModel) {
  const content = pageModel.page.contentAnswer || {};
  const motion = pageModel.page.animationAnswer || pageModel.motion || {};
  const component = String(motion.component || pageModel.motion.component || "").toLowerCase();
  const support = content.supportMessage || content.narrationBeat || "";
  const numbers = numbersFromText(support, pageModel.order);
  const accent = pageModel.design.visualTheme?.patternStroke || "#225e7a";

  if (component.includes("rank") || component.includes("bar")) return renderMetricBars(numbers);
  if (component.includes("trend") || component.includes("curve") || component.includes("line")) return renderTrendSvg(accent);
  if (component.includes("donut") || component.includes("share")) return renderDonut(accent, numbers);
  if (component.includes("timeline") || component.includes("sequence")) return renderTimeline(pageModel);
  if (component.includes("rough") || component.includes("sketch") || component.includes("whiteboard")) return renderWhiteboard(pageModel);
  if (component.includes("contrast") || component.includes("swap") || component.includes("transform")) return renderContrastSwap(pageModel);
  return renderProofCards(pageModel);
}

function premiumStageTheme(pageModel) {
  const source = pageModel.design.visualTheme || {};
  const key = String(pageModel.design.themeKey || source.key || "").trim();
  const premiumThemes = {
    storyPaper: {
      background: "#f4efe5",
      plate: "#e8ddcd",
      surface: "#fffaf1",
      ink: "#1a1712",
      accent: "#8b5e34",
      subtitleBand: "#1a1712",
      captionText: "#fffaf1",
      gridStroke: "rgba(26,23,18,.056)",
      gridStrokeSoft: "rgba(26,23,18,.04)",
    },
    tutorialBlue: {
      background: "#edf1ee",
      plate: "#dfe7e1",
      surface: "#fbfffc",
      ink: "#142322",
      accent: "#315d86",
      subtitleBand: "#142322",
      captionText: "#fbfffc",
      gridStroke: "rgba(20,35,34,.056)",
      gridStrokeSoft: "rgba(20,35,34,.04)",
    },
    evidenceSlate: {
      background: "#eceff1",
      plate: "#dde4e8",
      surface: "#fbfcfa",
      ink: "#151a1d",
      accent: "#2f4f5f",
      subtitleBand: "#151a1d",
      captionText: "#fbfcfa",
      gridStroke: "rgba(21,26,29,.056)",
      gridStrokeSoft: "rgba(21,26,29,.038)",
    },
    schoolFresh: {
      background: "#f0f4ec",
      plate: "#e0eadc",
      surface: "#fffdf5",
      ink: "#18221a",
      accent: "#41765d",
      subtitleBand: "#18221a",
      captionText: "#fffdf5",
      gridStroke: "rgba(24,34,26,.056)",
      gridStrokeSoft: "rgba(24,34,26,.038)",
    },
    whiteboardClean: {
      background: "#f5f4ee",
      plate: "#e5e1d8",
      surface: "#fffdf6",
      ink: "#1e211c",
      accent: "#587064",
      subtitleBand: "#1e211c",
      captionText: "#fffdf6",
      gridStroke: "rgba(30,33,28,.052)",
      gridStrokeSoft: "rgba(30,33,28,.036)",
    },
    dataNews: {
      background: "#f2eee5",
      plate: "#ded5c7",
      surface: "#fffaf0",
      ink: "#17202a",
      accent: "#8b5e34",
      subtitleBand: "#17202a",
      captionText: "#fffaf0",
      gridStroke: "rgba(23,32,42,.062)",
      gridStrokeSoft: "rgba(23,32,42,.044)",
    },
    screenGlass: {
      background: "#eef1ef",
      plate: "#dbe5e1",
      surface: "#fcfffc",
      ink: "#102326",
      accent: "#2d6f73",
      subtitleBand: "#102326",
      captionText: "#fcfffc",
      gridStroke: "rgba(16,35,38,.056)",
      gridStrokeSoft: "rgba(16,35,38,.038)",
    },
    documentaryInk: {
      background: "#eee9df",
      plate: "#d9d0c2",
      surface: "#fff9ef",
      ink: "#1b1915",
      accent: "#9a5a2f",
      subtitleBand: "#1b1915",
      captionText: "#fff9ef",
      gridStroke: "rgba(27,25,21,.06)",
      gridStrokeSoft: "rgba(27,25,21,.04)",
    },
  };
  const selected = premiumThemes[key] || premiumThemes.storyPaper;
  return {
    ...selected,
    key: source.key || key,
    label: source.label || key,
  };
}

function stageStyle(pageModel) {
  const theme = premiumStageTheme(pageModel);
  const accent = theme.accent || theme.patternStroke || theme.ink || "#172033";
  return [
    `--bg:${theme.background || "#f4f6f8"}`,
    `--plate:${theme.plate || "#e8edf3"}`,
    `--surface:${theme.surface || "#ffffff"}`,
    `--ink:${theme.ink || "#111827"}`,
    `--accent:${accent}`,
    `--subtitle:${theme.subtitleBand || "#111827"}`,
    `--caption:${theme.captionText || "#ffffff"}`,
    `--grid:${theme.gridStroke || "rgba(17,24,39,.05)"}`,
    `--grid-soft:${theme.gridStrokeSoft || "rgba(17,24,39,.035)"}`,
  ].join(";");
}

function renderStage(pageModel) {
  const page = pageModel.page;
  const content = page.contentAnswer || {};
  const interaction = page.interactionAnswer || {};
  return `
    <div class="video-stage" style="${stageStyle(pageModel)}">
      <div class="stage-grid"></div>
      <main class="stage-main">
        <section class="stage-copy">
          <p>${escapeHtml(content.contentJob || pageModel.design.visualRole || "页面任务")}</p>
          <h2>${escapeHtml(content.primaryMessage || "未命名页面")}</h2>
          <div>${escapeHtml(compactText(content.supportMessage || content.narrationBeat || "", 118))}</div>
        </section>
        <section class="stage-visual">
          ${renderVisualPreview(pageModel)}
        </section>
      </main>
      <footer class="stage-caption">
        <b>${escapeHtml(compactText(interaction.interactionFeeling || content.narrationBeat || content.supportMessage || "", 86))}</b>
      </footer>
    </div>`;
}

function renderDetailRows(pageModel, packageDir) {
  const page = pageModel.page;
  const content = page.contentAnswer || {};
  const design = page.contentDesignAnswer || {};
  const interaction = page.interactionAnswer || {};
  const animation = page.animationAnswer || {};
  const owner = page.decisionOwnershipAnswer || {};
  const tds = {
    text: unique([
      content.primaryMessage,
      content.supportMessage,
      content.narrationBeat,
    ]).join(" / "),
    design: unique([
      design.layoutVariant || pageModel.design.layoutVariant,
      design.styleLabel || design.styleArchetype || pageModel.design.styleArchetype,
      design.typographyTreatment?.treatmentId || pageModel.typography.typeTreatmentId,
    ]).join(" / "),
    subtitle: unique([
      design.captionTreatment?.selectedStyleId || pageModel.caption.selectedStyleId,
      pageModel.caption.safeArea,
      pageModel.caption.displayMode,
    ]).join(" / "),
  };
  const rows = [
    ["内容", content.primaryMessage, content.supportMessage || content.narrationBeat],
    ["设计", `${design.styleLabel || design.styleArchetype || ""} / ${design.layoutVariant || ""}`, `${design.visualLanguage || ""} ${design.stageComposition || ""}`],
    ["交互", interaction.interactionFeeling || "MP4 state changes", interaction.finalOutputMode || ""],
    ["动画", `${animation.selectedMotionTemplate || pageModel.motion.selectedTemplate || ""} / ${animation.motionVerb || pageModel.motion.motionVerb || ""}`, `${animation.component || pageModel.motion.component || ""} ${animation.trigger || animation.timingOwner || ""}`],
    ["TDS", tds.text, `Design: ${tds.design}; Subtitle: ${tds.subtitle}`],
    ["归属", owner.designDecisionOwner || owner.animationDecisionOwner || "codex-video-workflow planner", unique([owner.contentDecisionOwner, owner.interactionDecisionOwner, owner.renderDecisionOwner, owner.qcDecisionOwner]).join(" / ")],
  ];
  const evidence = unique([
    pageModel.stageFile ? relPath(packageDir, pageModel.stageFile) : "",
    pageModel.screenshot ? relPath(packageDir, pageModel.screenshot) : "",
    page.qualityEvidence || "",
  ]);
  return `
    <div class="answer-grid">
      ${rows.map(([label, primary, secondary]) => `
        <section>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(compactText(primary, 96))}</strong>
          <p>${escapeHtml(compactText(secondary, 180))}</p>
        </section>`).join("")}
    </div>
    <div class="page-tags">
      ${renderPills([
        "TDS 可单页批注",
        pageModel.design.styleArchetype || design.styleArchetype,
        pageModel.design.layoutVariant || design.layoutVariant,
        pageModel.motion.selectedTemplate || animation.selectedMotionTemplate,
        pageModel.motion.component || animation.component,
        design.captionTreatment?.selectedStyleId || pageModel.caption.selectedStyleId,
        design.typographyTreatment?.treatmentId || pageModel.typography.typeTreatmentId,
      ])}
    </div>
    ${evidence.length ? `<div class="evidence-line">${evidence.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>` : ""}`;
}

function pageSummary(pageModel) {
  const page = pageModel.page;
  return {
    order: pageModel.order,
    sceneId: pageModel.sceneId,
    content: page.contentAnswer?.primaryMessage || "",
    design: page.contentDesignAnswer?.styleLabel || page.contentDesignAnswer?.styleArchetype || "",
    layout: page.contentDesignAnswer?.layoutVariant || pageModel.design.layoutVariant || "",
    interaction: page.interactionAnswer?.interactionFeeling || "",
    animation: page.animationAnswer?.selectedMotionTemplate || pageModel.motion.selectedTemplate || "",
    component: page.animationAnswer?.component || pageModel.motion.component || "",
  };
}

function renderCapabilitySection(context) {
  const capabilities = capabilityCatalog().map((capability) => ({
    ...capability,
    active: isCapabilityActive(capability, context),
  }));
  const activeCount = capabilities.filter((item) => item.active).length;
  const categories = countBy(capabilities.map((item) => item.category));
  return `
    <section class="panel capability-panel" id="capabilities">
      <div class="section-title">
        <span>01</span>
        <div>
          <h2>当前支持能力总览</h2>
          <p>${activeCount}/${capabilities.length} 个能力在当前包或当前链路中有证据；未激活项仍作为 Planner 可选能力展示。</p>
        </div>
      </div>
      <div class="category-strip">${categories.map(([label, count]) => `<span>${escapeHtml(label)} <b>${count}</b></span>`).join("")}</div>
      <div class="capability-grid">
        ${capabilities.map((item) => `
          <article class="capability ${item.active ? "is-active" : ""}">
            <span>${escapeHtml(item.category)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <b>${item.active ? "当前激活 / 有证据" : "可选能力 / 需触发"}</b>
          </article>`).join("")}
      </div>
    </section>`;
}

function renderFacetStat(title, entries, limit = 12) {
  const visible = entries.slice(0, limit);
  const hiddenCount = Math.max(0, entries.length - visible.length);
  return `
    <article class="facet-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="facet-list">
        ${visible.map(([label, count]) => `
          <div><span>${escapeHtml(label)}</span><b>${escapeHtml(count)}</b></div>`).join("")}
        ${hiddenCount ? `<div><span>其他</span><b>${hiddenCount}</b></div>` : ""}
      </div>
    </article>`;
}

function renderStyleDimensions(context) {
  const pages = context.pages;
  const styleEntries = countBy(pages.map((item) => item.design.styleLabel || item.design.styleArchetype || item.page.contentDesignAnswer?.styleArchetype));
  const layoutEntries = countBy(pages.map((item) => item.design.layoutVariant || item.page.contentDesignAnswer?.layoutVariant));
  const templateEntries = countBy(pages.map((item) => item.motion.selectedTemplate || item.page.animationAnswer?.selectedMotionTemplate));
  const componentEntries = countBy(pages.map((item) => item.motion.component || item.page.animationAnswer?.component));
  const captionEntries = countBy(pages.map((item) => item.page.contentDesignAnswer?.captionTreatment?.selectedStyleId || item.caption.selectedStyleId));
  const typeEntries = countBy(pages.map((item) => item.page.contentDesignAnswer?.typographyTreatment?.treatmentId || item.typography.typeTreatmentId));
  return `
    <section class="panel" id="dimensions">
      <div class="section-title">
        <span>02</span>
        <div>
          <h2>当前页面风格维度</h2>
          <p>这些维度决定每一页看起来像数据新闻、产品演示、白板、时间线、交互证明板，还是其他可视化页面。</p>
        </div>
      </div>
      <div class="facet-grid">
        ${renderFacetStat("风格 archetype", styleEntries)}
        ${renderFacetStat("版式 layout", layoutEntries)}
        ${renderFacetStat("动效模板", templateEntries)}
        ${renderFacetStat("动效组件", componentEntries)}
        ${renderFacetStat("字幕样式", captionEntries)}
        ${renderFacetStat("文字体系", typeEntries)}
      </div>
      <details class="catalog-details">
        <summary>展开全部可选模板 / 字幕 / 字体维度</summary>
        <div class="catalog-columns">
          <section>
            <h3>HTML motion templates</h3>
            ${renderPills(context.catalogs.motionTemplates.map((item) => `${item.id} · ${arrayify(item.motionVerbs).join("/")}`))}
          </section>
          <section>
            <h3>Caption styles (${context.catalogs.captionStyles.length})</h3>
            ${renderPills(context.catalogs.captionStyles.map((item) => `${item.id}${item.labelZh ? ` · ${item.labelZh}` : ""}`))}
          </section>
          <section>
            <h3>Type treatments</h3>
            ${renderPills(context.catalogs.typeTreatments.map((item) => `${item.id} · ${item.label}`))}
          </section>
          <section>
            <h3>Motion families</h3>
            ${renderPills(context.catalogs.motionFamilies.map((item) => `${item.id} · ${item.motionVerb}`))}
          </section>
        </div>
      </details>
    </section>`;
}

function renderPageCards(context) {
  const styleOptions = unique(context.pages.map((item) => item.design.styleLabel || item.design.styleArchetype || item.page.contentDesignAnswer?.styleArchetype));
  const templateOptions = unique(context.pages.map((item) => item.motion.selectedTemplate || item.page.animationAnswer?.selectedMotionTemplate));
  return `
    <section class="panel" id="pages">
      <div class="section-title">
        <span>03</span>
        <div>
          <h2>逐页 HTML 预览</h2>
          <p>每个 16:9 预览帧都对应视频中的一个页面，旁边保留五问答案，便于逐页批注优化。</p>
        </div>
      </div>
      <div class="toolbar">
        <input id="searchBox" type="search" placeholder="搜索页面内容、sceneId、风格、动效…" />
        <select id="styleFilter">
          <option value="">全部风格</option>
          ${styleOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
        </select>
        <select id="templateFilter">
          <option value="">全部动效模板</option>
          ${templateOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
        </select>
      </div>
      <div class="page-list">
        ${context.pages.map((pageModel) => {
          const summary = pageSummary(pageModel);
          const style = pageModel.design.styleLabel || pageModel.design.styleArchetype || pageModel.page.contentDesignAnswer?.styleArchetype || "";
          const template = pageModel.motion.selectedTemplate || pageModel.page.animationAnswer?.selectedMotionTemplate || "";
          const searchText = JSON.stringify(summary);
          return `
            <article class="page-card" data-style="${escapeHtml(style)}" data-template="${escapeHtml(template)}" data-search="${escapeHtml(searchText.toLowerCase())}">
              <div class="page-card-head">
                <div>
                  <span>Page ${String(pageModel.order).padStart(2, "0")}</span>
                  <h3>${escapeHtml(summary.content || pageModel.sceneId)}</h3>
                  <p>${escapeHtml(pageModel.sceneId)}</p>
                </div>
                <button type="button" data-copy='${escapeHtml(JSON.stringify(summary, null, 2))}'>复制页面摘要</button>
              </div>
              <div class="page-body">
                <div class="preview-wrap">${renderStage(pageModel)}</div>
                <div class="answers-wrap">${renderDetailRows(pageModel, context.packageDir)}</div>
              </div>
            </article>`;
        }).join("")}
      </div>
    </section>`;
}

function renderGlobalContract(context) {
  const content = context.contentDesign;
  const selectedLibraries = arrayify(context.motionSelection.motionLibraryRouting?.selectedLibraries);
  const sourceArtifacts = arrayify(context.pageDecision.sourceArtifacts);
  return `
    <section class="panel contract-panel">
      <div class="section-title">
        <span>00</span>
        <div>
          <h2>视频页面生成契约</h2>
          <p>这个 HTML 不是最终视频，而是最终视频页面的审核台：把每页内容、设计和能力选择提前摊开。</p>
        </div>
      </div>
      <div class="contract-grid">
        <article>
          <span>视频主题</span>
          <strong>${escapeHtml(context.pageDecision.briefTitle || context.manifest.title || "未命名视频")}</strong>
          <p>${escapeHtml(content.topicType || context.designPlan.videoType || "topicType 未记录")}</p>
        </article>
        <article>
          <span>画布</span>
          <strong>${escapeHtml(`${context.canvas.width || context.qc.width || 1920} × ${context.canvas.height || context.qc.height || 1080}`)}</strong>
          <p>${escapeHtml(context.canvas.ratio || "16:9")} / ${escapeHtml(context.designPlan.canvas?.profile || "local-review")}</p>
        </article>
        <article>
          <span>页面覆盖</span>
          <strong>${escapeHtml(`${context.pageDecision.coverage?.pagesWithCompleteAnswers || context.pages.length}/${context.pageDecision.coverage?.pageCount || context.pages.length}`)}</strong>
          <p>${context.pageDecision.coverage?.allPagesAnswerFiveQuestions ? "五问全部完整" : "存在缺口，需要补齐"}</p>
        </article>
        <article>
          <span>QC</span>
          <strong>${context.qc.pass ? "PASS" : "未通过/未运行"}</strong>
          <p>${escapeHtml(context.qc.duration ? `${context.qc.duration}s` : "duration 未记录")}</p>
        </article>
      </div>
      <div class="contract-notes">
        <section>
          <h3>展示逻辑</h3>
          <p>${escapeHtml(compactText(content.displayLogic || "", 260))}</p>
        </section>
        <section>
          <h3>视觉隐喻</h3>
          <p>${escapeHtml(compactText(content.visualMetaphor || "", 260))}</p>
        </section>
        <section>
          <h3>动效目的</h3>
          <p>${escapeHtml(compactText(content.motionPurpose || "", 260))}</p>
        </section>
      </div>
      <div class="artifact-row">
        ${renderPills([
          `selectedTemplate: ${context.motionSelection.selectedTemplate || "unknown"}`,
          `libraries: ${selectedLibraries.join(", ") || "none"}`,
          ...sourceArtifacts.slice(0, 6),
        ])}
      </div>
    </section>`;
}

function renderScripts() {
  return `<script>
    const searchBox = document.getElementById('searchBox');
    const styleFilter = document.getElementById('styleFilter');
    const templateFilter = document.getElementById('templateFilter');
    const cards = Array.from(document.querySelectorAll('.page-card'));

    function applyFilters() {
      const query = (searchBox?.value || '').trim().toLowerCase();
      const style = styleFilter?.value || '';
      const template = templateFilter?.value || '';
      for (const card of cards) {
        const matchesQuery = !query || (card.dataset.search || '').includes(query);
        const matchesStyle = !style || card.dataset.style === style;
        const matchesTemplate = !template || card.dataset.template === template;
        card.hidden = !(matchesQuery && matchesStyle && matchesTemplate);
      }
    }

    searchBox?.addEventListener('input', applyFilters);
    styleFilter?.addEventListener('change', applyFilters);
    templateFilter?.addEventListener('change', applyFilters);

    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-copy]');
      if (!button) return;
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(button.dataset.copy || '');
        button.textContent = '已复制';
      } catch {
        button.textContent = '复制失败';
      }
      setTimeout(() => { button.textContent = original; }, 1200);
    });
  </script>`;
}

function renderStyles() {
  return `<style>
    :root {
      color-scheme: light;
      --page-bg: #eef2f6;
      --ink: #111827;
      --muted: #607083;
      --surface: #ffffff;
      --line: rgba(17, 24, 39, .1);
      --accent: #1f6f8b;
      --accent-2: #b14e38;
      font-family: "Inter", "Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        linear-gradient(120deg, rgba(31,111,139,.08), transparent 32%),
        linear-gradient(220deg, rgba(177,78,56,.08), transparent 30%),
        var(--page-bg);
      color: var(--ink);
    }

    a { color: inherit; }
    .shell { width: min(1480px, calc(100vw - 40px)); margin: 0 auto; padding: 28px 0 64px; }
    .hero {
      min-height: 360px;
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
      gap: 28px;
      align-items: end;
      padding: 42px 0 28px;
    }
    .hero h1 { margin: 0; font-size: clamp(38px, 6vw, 82px); line-height: .95; letter-spacing: 0; max-width: 980px; }
    .hero p { margin: 18px 0 0; max-width: 720px; color: #425165; font-size: 18px; line-height: 1.65; }
    .hero-card {
      background: rgba(255,255,255,.72);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(35,48,68,.12);
    }
    .hero-card dl { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0; }
    .hero-card dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .hero-card dd { margin: 4px 0 0; font-size: 20px; font-weight: 850; }

    .panel {
      background: rgba(255,255,255,.82);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin: 20px 0;
      box-shadow: 0 18px 55px rgba(35,48,68,.08);
    }
    .section-title { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .section-title > span {
      display: grid; place-items: center;
      width: 44px; height: 44px; border-radius: 8px;
      background: #172033; color: white; font-weight: 900;
    }
    .section-title h2 { margin: 0; font-size: 25px; line-height: 1.1; letter-spacing: 0; }
    .section-title p { margin: 7px 0 0; color: var(--muted); line-height: 1.55; }

    .contract-grid, .facet-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .contract-grid article, .facet-card, .capability {
      background: #fbfcfe;
      border: 1px solid rgba(17,24,39,.08);
      border-radius: 8px;
      padding: 16px;
    }
    .contract-grid span, .capability span { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
    .contract-grid strong { display: block; margin-top: 8px; font-size: 23px; line-height: 1.05; }
    .contract-grid p, .capability p { margin: 8px 0 0; color: #526274; line-height: 1.45; }
    .contract-notes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .contract-notes section { border: 1px solid rgba(17,24,39,.08); border-radius: 8px; padding: 14px; background: #fff; }
    .contract-notes h3 { margin: 0 0 8px; font-size: 15px; }
    .contract-notes p { margin: 0; color: #526274; line-height: 1.5; }
    .artifact-row, .page-tags, .category-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .pill, .category-strip span {
      display: inline-flex; align-items: center; gap: 6px;
      min-height: 28px; padding: 5px 9px; border-radius: 999px;
      background: #eef3f7; color: #233042; font-size: 12px; font-weight: 700;
    }
    .pill.soft { background: rgba(255,255,255,.68); color: var(--ink); border: 1px solid rgba(17,24,39,.1); }
    code { display: inline-flex; padding: 4px 7px; border-radius: 6px; background: #eef2f6; color: #334155; font-size: 12px; margin: 3px; }

    .capability-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .capability { min-height: 170px; position: relative; overflow: hidden; }
    .capability h3 { margin: 8px 0 0; font-size: 17px; line-height: 1.18; }
    .capability b { display: inline-flex; margin-top: 12px; color: #6b7280; font-size: 12px; }
    .capability.is-active { border-color: rgba(31,111,139,.34); background: linear-gradient(145deg, rgba(31,111,139,.08), #fff 58%); }
    .capability.is-active b { color: #1f6f8b; }

    .facet-card h3 { margin: 0 0 10px; font-size: 16px; }
    .facet-list { display: grid; gap: 7px; }
    .facet-list div { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; color: #526274; }
    .facet-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .facet-list b { color: var(--ink); font-variant-numeric: tabular-nums; }
    .catalog-details { margin-top: 16px; border: 1px solid rgba(17,24,39,.08); border-radius: 8px; padding: 14px; background: #fff; }
    .catalog-details summary { cursor: pointer; font-weight: 850; }
    .catalog-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-top: 14px; }
    .catalog-columns h3 { margin: 0 0 8px; font-size: 15px; }

    .toolbar { position: sticky; top: 0; z-index: 5; display: grid; grid-template-columns: 1fr 220px 250px; gap: 10px; padding: 10px; margin: -4px -10px 16px; background: rgba(238,242,246,.9); backdrop-filter: blur(12px); border-radius: 8px; }
    .toolbar input, .toolbar select {
      height: 42px; border: 1px solid rgba(17,24,39,.14); border-radius: 8px; padding: 0 12px; background: #fff; color: var(--ink); font: inherit;
    }
    .page-list { display: grid; gap: 18px; }
    .page-card { border: 1px solid rgba(17,24,39,.1); border-radius: 8px; background: #fff; overflow: hidden; }
    .page-card[hidden] { display: none; }
    .page-card-head { display: flex; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid rgba(17,24,39,.08); }
    .page-card-head span { color: var(--muted); font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .page-card-head h3 { margin: 4px 0 0; font-size: 24px; line-height: 1.08; }
    .page-card-head p { margin: 5px 0 0; color: var(--muted); font-family: "JetBrains Mono", "SFMono-Regular", monospace; font-size: 12px; }
    button {
      height: 36px; border: 1px solid rgba(17,24,39,.14); border-radius: 8px; background: #172033; color: #fff; padding: 0 12px; font-weight: 800; cursor: pointer;
    }
    .page-body { display: grid; grid-template-columns: minmax(520px, 1.08fr) minmax(360px, .92fr); gap: 0; }
    .preview-wrap { padding: 18px; background: #eef2f6; display: grid; align-content: start; }
    .answers-wrap { padding: 18px; border-left: 1px solid rgba(17,24,39,.08); }

    .video-stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 8px;
      background: var(--bg);
      color: var(--ink);
      box-shadow: 0 22px 60px rgba(16,24,40,.18);
      isolation: isolate;
    }
    .stage-grid {
      position: absolute; inset: 0; opacity: .62; z-index: -1;
      background:
        linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0 / 68px 68px,
        linear-gradient(var(--grid-soft) 1px, transparent 1px) 0 0 / 68px 68px,
        radial-gradient(circle at 18% 22%, rgba(255,255,255,.8), transparent 22%),
        radial-gradient(circle at 86% 72%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 26%),
        linear-gradient(135deg, var(--plate), var(--bg) 58%, color-mix(in srgb, var(--bg) 82%, var(--accent) 18%));
    }
    .stage-main { position: absolute; inset: 42px 34px 88px; display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: 34px; align-items: stretch; }
    .stage-copy { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
    .stage-copy p { margin: 0 0 10px; color: var(--accent); font-size: 13px; font-weight: 950; }
    .stage-copy h2 { margin: 0; font-size: clamp(24px, 2.75vw, 42px); line-height: 1.04; letter-spacing: 0; max-width: 13ch; text-wrap: balance; }
    .stage-copy div { margin-top: 16px; font-size: clamp(13px, 1.05vw, 16px); line-height: 1.48; max-width: 38ch; color: color-mix(in srgb, var(--ink) 76%, white 24%); }
    .stage-visual {
      position: relative; min-width: 0; display: grid; place-items: center; padding: 28px;
      border-radius: 8px; background: color-mix(in srgb, var(--surface) 88%, var(--plate) 12%);
      border: 1px solid rgba(17,24,39,.1);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.45), 0 16px 34px rgba(17,24,39,.08);
    }
    .stage-caption { position: absolute; left: 34px; right: 34px; bottom: 24px; display: grid; align-items: center; min-height: 42px; padding: 10px 14px; border-radius: 8px; background: color-mix(in srgb, var(--subtitle) 92%, black 8%); color: var(--caption); }
    .stage-caption b { font-size: 13px; line-height: 1.3; overflow-wrap: anywhere; }

    .viz-bars { width: min(360px, 100%); display: grid; gap: 13px; }
    .viz-bar-row { display: grid; grid-template-columns: 26px 1fr 70px; gap: 10px; align-items: center; }
    .viz-bar-row span { font-weight: 950; color: var(--accent); }
    .viz-bar-row i { height: 22px; border-radius: 999px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 42%, white)); position: relative; overflow: hidden; }
    .viz-bar-row i::after { content: ""; position: absolute; inset: 0; width: var(--w); background: rgba(255,255,255,.28); border-right: 3px solid rgba(255,255,255,.8); }
    .viz-bar-row b { font-variant-numeric: tabular-nums; font-size: 13px; }
    .viz-svg { width: min(390px, 100%); height: auto; }
    .viz-svg .grid-lines { stroke: rgba(17,24,39,.12); stroke-width: 1; }
    .viz-donut { width: 210px; height: 210px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--accent) 0 var(--share), rgba(17,24,39,.09) var(--share) 100%); }
    .viz-donut > div { width: 132px; height: 132px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; text-align: center; align-content: center; }
    .viz-donut b { font-size: 30px; }
    .viz-donut span { color: var(--muted); font-size: 12px; }
    .viz-timeline { width: min(380px, 100%); display: grid; gap: 10px; }
    .timeline-node { display: grid; grid-template-columns: 42px 1fr; align-items: center; gap: 12px; }
    .timeline-node i { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: var(--accent); color: white; font-style: normal; font-weight: 900; }
    .timeline-node span { padding: 11px 13px; border-radius: 8px; background: var(--plate); font-weight: 850; }
    .viz-proof { width: min(420px, 100%); display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .proof-card { min-height: 138px; padding: 15px; border-radius: 8px; background: var(--plate); display: flex; flex-direction: column; justify-content: space-between; }
    .proof-card span { color: var(--accent); font-size: 12px; font-weight: 950; }
    .proof-card strong { font-size: 18px; line-height: 1.12; }
    .viz-contrast { width: min(420px, 100%); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .viz-contrast div { min-height: 170px; border-radius: 8px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: var(--plate); }
    .viz-contrast div:last-child { background: var(--ink); color: var(--caption); }
    .viz-contrast span { font-size: 12px; font-weight: 900; opacity: .7; }
    .viz-contrast b { font-size: 22px; line-height: 1.12; }
    .viz-whiteboard { width: min(380px, 100%); text-align: center; }
    .viz-whiteboard svg { width: 100%; height: auto; fill: none; stroke: var(--accent); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
    .viz-whiteboard b { display: inline-flex; margin-top: 6px; font-size: 18px; }

    .answer-grid { display: grid; gap: 10px; }
    .answer-grid section { padding: 12px; border-radius: 8px; background: #f7f9fb; border: 1px solid rgba(17,24,39,.06); }
    .answer-grid span { color: var(--muted); font-size: 12px; font-weight: 950; }
    .answer-grid strong { display: block; margin-top: 5px; font-size: 16px; line-height: 1.22; }
    .answer-grid p { margin: 6px 0 0; color: #526274; line-height: 1.45; font-size: 13px; }
    .evidence-line { margin-top: 10px; }

    @media (max-width: 980px) {
      .shell { width: min(100vw - 24px, 760px); }
      .hero, .page-body, .contract-notes { grid-template-columns: 1fr; }
      .contract-grid, .facet-grid, .capability-grid, .catalog-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .answers-wrap { border-left: 0; border-top: 1px solid rgba(17,24,39,.08); }
      .toolbar { grid-template-columns: 1fr; position: static; }
      .stage-main { grid-template-columns: 1fr; gap: 12px; inset: 34px 18px 78px; }
      .stage-copy h2 { max-width: 18ch; font-size: clamp(22px, 6vw, 34px); }
      .stage-copy div { display: none; }
      .stage-visual { padding: 16px; }
    }

    @media (max-width: 620px) {
      .contract-grid, .facet-grid, .capability-grid, .catalog-columns, .hero-card dl { grid-template-columns: 1fr; }
      .page-card-head { flex-direction: column; }
      .preview-wrap { padding: 10px; }
      .stage-caption b { font-size: 11px; }
      .viz-proof { grid-template-columns: 1fr; }
    }
  </style>`;
}

function renderHtml(context, title) {
  const reviewTitle = title || `${context.pageDecision.briefTitle || context.manifest.title || "视频页面"} · 页面审核 HTML`;
  const generatedAt = new Date().toISOString();
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(reviewTitle)}</title>
  ${renderStyles()}
</head>
<body>
  <div class="shell">
    <header class="hero">
      <div>
        <h1>${escapeHtml(reviewTitle)}</h1>
        <p>这个页面把当前视频中每一页要展示的内容、设计方式、交互表达、动画方案、能力类别和决策归属都转成 HTML 审核视图。你可以按页指出风格、样式、布局、字幕或动效要如何统一和优化。</p>
      </div>
      <aside class="hero-card">
        <dl>
          <div><dt>Package</dt><dd>${escapeHtml(compactText(context.packageDir, 42))}</dd></div>
          <div><dt>Pages</dt><dd>${escapeHtml(context.pages.length)}</dd></div>
          <div><dt>Canvas</dt><dd>${escapeHtml(`${context.canvas.width || context.qc.width || 1920}×${context.canvas.height || context.qc.height || 1080}`)}</dd></div>
          <div><dt>Generated</dt><dd>${escapeHtml(generatedAt.slice(0, 10))}</dd></div>
        </dl>
      </aside>
    </header>
    ${renderGlobalContract(context)}
    ${renderCapabilitySection(context)}
    ${renderStyleDimensions(context)}
    ${renderPageCards(context)}
  </div>
  ${renderScripts()}
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.packageDir) throw new Error(`Missing --package.\n${usage()}`);
  const packageDir = resolve(args.packageDir);
  if (!existsSync(packageDir)) throw new Error(`Package directory does not exist: ${packageDir}`);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillRoot = resolve(scriptDir, "..");
  const outPath = args.out
    ? (isAbsolute(args.out) ? args.out : resolve(args.out))
    : join(packageDir, "page-review.html");
  const context = buildContext(packageDir, skillRoot);
  if (!context.pages.length) {
    throw new Error(`No pages found. Expected ${join(packageDir, "workflow/page-decision-contract.json")}`);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  const html = renderHtml(context, args.title);
  writeFileSync(outPath, html, "utf8");
  console.log(JSON.stringify({
    ok: true,
    output: outPath,
    fileUrl: pathToFileURL(outPath).href,
    packageDir,
    pages: context.pages.length,
    allPagesAnswerFiveQuestions: context.pageDecision.coverage?.allPagesAnswerFiveQuestions === true,
  }, null, 2));
}

main();
