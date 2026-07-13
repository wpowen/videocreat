#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = resolve(SKILL_ROOT, "../../..");
const IP_DIAGRAM_REPO = join(WORKSPACE_ROOT, "research", "external-repos", "ip-diagram-creator");
const VOICE_PREVIEW_ASSET_ROOT = join(SKILL_ROOT, "assets", "voice-preview");
const VOICE_PREVIEW_ASSET_MANIFEST = join(VOICE_PREVIEW_ASSET_ROOT, "manifest.json");
const VOICE_PREVIEW_RESEARCH_ROOT = join(WORKSPACE_ROOT, "research", "voice-quality-poc", "cosyvoice-accent-dialect-20260630");
const VOICE_PREVIEW_RESEARCH_MANIFEST = join(VOICE_PREVIEW_RESEARCH_ROOT, "manifest.json");

function parseArgs(argv) {
  const args = {
    packageDir: "",
    out: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--package" || arg === "--package-dir" || arg === "--out-dir") args.packageDir = argv[++i] || "";
    else if (arg === "--out") args.out = argv[++i] || "";
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node .agents/skills/codex-video-workflow/scripts/build-semi-auto-config-html.mjs \\
    --package <video-package-dir> [--out <html-path>]

Creates semi-auto-config.html and workflow/semi-auto-config.json from the
current workflow package.`;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function write(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

function writeJson(path, value) {
  write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
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

function compactText(value, max = 130) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    const key = String(value || "other");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function motionTemplateLabel(id) {
  return {
    "kinetic-editorial-explainer": "大字叙事解释",
    "semantic-timeline-reveal": "语义时间线",
    "interactive-proof-board": "交互证明板",
    "data-curve-trace": "数据曲线追踪",
    "typed-black-white-opener": "打字片头",
    "dark-saas-magic-ui": "产品界面魔法态",
  }[id] || id;
}

function motionTemplateDescription(template) {
  const id = template.id || "";
  return {
    "kinetic-editorial-explainer": "适合观点、钩子、结论反转，用大标题和证据块快速建立注意力。",
    "semantic-timeline-reveal": "适合流程、课程、方法论，让节点随旁白逐步激活。",
    "interactive-proof-board": "适合因果、证明、诊断，用连线和卡片展示推理过程。",
    "data-curve-trace": "适合趋势、指标、排名，用曲线或柱形随叙事推进。",
    "typed-black-white-opener": "适合显式片头，用极简输入态制造开场节奏。",
    "dark-saas-magic-ui": "适合产品/工具状态，用可检查的界面变化展示能力。",
  }[id] || compactText(arrayify(template.bestFor).join(" / "), 120);
}

function motionCapabilityCatalog() {
  return [
    {
      id: "local-css-svg-waapi",
      label: "基础网页动效",
      category: "默认",
      description: "入场、滑移、透明度、路径描边、关键词强调，适合大多数页面。",
      preview: "path",
      selected: true,
    },
    {
      id: "two-d-emphasis",
      label: "二维强调动效",
      category: "强调",
      description: "卡片弹入、证据框聚焦、局部放大、节奏型强调。",
      preview: "cards",
      selected: true,
    },
    {
      id: "data-chart-motion",
      label: "数据图表动效",
      category: "数据",
      description: "曲线追踪、柱形增长、节点揭示、数值拐点提示。",
      preview: "chart",
      selected: true,
    },
    {
      id: "authored-vector-loop",
      label: "授权矢量动效",
      category: "素材",
      description: "使用已授权的循环动效素材作为局部前景或状态提示。",
      preview: "orbit",
      selected: true,
    },
    {
      id: "formula-derivation",
      label: "公式推导演示",
      category: "知识",
      description: "公式、步骤、代码块按旁白节拍逐层显现。",
      preview: "formula",
      selected: true,
    },
    {
      id: "sketch-rough-board",
      label: "手绘草图动效",
      category: "白板",
      description: "箭头、圈画、下划线、草图卡片逐笔绘制。",
      preview: "sketch",
      selected: true,
    },
    {
      id: "depth-3d-motion",
      label: "三维深度动效",
      category: "空间",
      description: "层级堆叠、空间推进、透视卡片，用于系统架构与产品场景。",
      preview: "depth",
      selected: true,
    },
    {
      id: "whiteboard-layered-reveal",
      label: "白板分层绘制",
      category: "白板",
      description: "背景、文字、线稿、强调层分开渲染，字幕始终保持在最上层。",
      preview: "whiteboard",
      selected: true,
    },
    {
      id: "product-state-motion",
      label: "产品状态动效",
      category: "产品",
      description: "输入、生成、审核、完成等界面状态逐步变化。",
      preview: "states",
      selected: true,
    },
    {
      id: "reference-rhythm-sync",
      label: "参考节奏对齐",
      category: "剪辑",
      description: "参考视频存在时，对齐段落节奏、切点和视觉强度。",
      preview: "sync",
      selected: true,
    },
    {
      id: "raw-footage-editing",
      label: "本地素材剪辑",
      category: "素材",
      description: "授权本地素材可进入 EDL 切点、速度、遮罩和转场规划。",
      preview: "film",
      selected: true,
    },
    {
      id: "caption-micro-motion",
      label: "字幕微动效",
      category: "字幕",
      description: "字幕入场、关键词强调、双语切换、节奏脉冲。",
      preview: "caption",
      selected: true,
    },
    {
      id: "cover-variant-motion",
      label: "封面变体动效",
      category: "封面",
      description: "同一内容承诺下，横竖封面视觉结构与视频片头保持一致。",
      preview: "cover",
      selected: true,
    },
    {
      id: "advanced-timeline-explicit",
      label: "高级时间轴动效",
      category: "例外",
      description: "只在用户显式要求且授权条件满足时开启，默认展示为可控能力。",
      preview: "gate",
      selected: true,
    },
  ];
}

function colorSystems() {
  return [
    {
      id: "porcelain-ink",
      label: "瓷白墨线",
      role: "知识解释 / 观点视频",
      mood: "清透、克制、信息密度高",
      colors: ["#f7f3ea", "#171817", "#6f5b45", "#43656f", "#d8cbbb"],
    },
    {
      id: "mineral-glass",
      label: "矿物玻璃",
      role: "工具演示 / 工作流",
      mood: "冷静、透明、产品感",
      colors: ["#eef3f0", "#122222", "#2a7471", "#335f82", "#dce6e1"],
    },
    {
      id: "newsprint-copper",
      label: "新闻铜版",
      role: "数据 / 趋势 / 证据",
      mood: "可信、锐利、带一点暖金属",
      colors: ["#f2eee5", "#182027", "#9a673f", "#3f6d7a", "#d8d0c3"],
    },
    {
      id: "archive-olive",
      label: "档案橄榄",
      role: "纪录 / 故事 / 案例",
      mood: "沉稳、叙事、适合案例",
      colors: ["#eee9df", "#1a1a16", "#8f5f3d", "#5a6e5e", "#d7cfc2"],
    },
    {
      id: "studio-sage",
      label: "鼠尾草演播",
      role: "课程 / 手绘 / 方法论",
      mood: "柔和但不松散，适合讲解",
      colors: ["#f4f1e9", "#1e211c", "#627568", "#9a714b", "#e2ddd1"],
    },
    {
      id: "cobalt-porcelain",
      label: "钴蓝瓷面",
      role: "科技解释 / 系统方案",
      mood: "干净、专业、强识别",
      colors: ["#f4f7f5", "#111b22", "#254f7f", "#7b6042", "#d8e0df"],
    },
    {
      id: "plum-graphite",
      label: "梅紫石墨",
      role: "品牌观点 / 情绪叙事",
      mood: "低饱和、成熟、有记忆点",
      colors: ["#f1ede8", "#1b181d", "#6d4e68", "#87613f", "#d7cdd4"],
    },
    {
      id: "amber-graphite",
      label: "琥珀石墨",
      role: "产品卖点 / 决策建议",
      mood: "硬朗、清晰、转化感",
      colors: ["#f3f0e8", "#171a1b", "#b27744", "#4e6d72", "#d9d5ca"],
    },
    {
      id: "mist-vermilion",
      label: "雾白朱砂",
      role: "短促钩子 / 重点强调",
      mood: "轻、亮、但有高级重心",
      colors: ["#f7f5ef", "#161817", "#a84735", "#4e6c72", "#ded9ce"],
    },
    {
      id: "midnight-studio",
      label: "午夜演播",
      role: "明确深色风格时使用",
      mood: "深色、聚光、不要平铺纯黑",
      colors: ["#15191d", "#f6f4ed", "#8fb6b2", "#c48a5a", "#313a40"],
    },
    {
      id: "paper-aubergine",
      label: "纸面茄紫",
      role: "创意课程 / 写作表达",
      mood: "温润、编辑感、低噪音",
      colors: ["#f4efe7", "#1c1819", "#5c4a5e", "#a26f49", "#d9cec5"],
    },
    {
      id: "clear-whiteboard",
      label: "清爽白板",
      role: "手绘 / 公式 / 知识卡片",
      mood: "白板干净，保留质感边界",
      colors: ["#f8f7f1", "#1f241e", "#5d7666", "#9b6841", "#e5e1d7"],
    },
    {
      id: "material-roles-slate",
      label: "角色色板：青岩",
      role: "系统化产品 / 操作页",
      mood: "主色、容器色、强调色分层明确",
      colors: ["#f8faf6", "#18211f", "#406a63", "#6b5c86", "#d7e4de"],
      source: "Material Design color roles",
    },
    {
      id: "material-roles-ruby",
      label: "角色色板：石榴",
      role: "观点解释 / 强转折",
      mood: "暖重点但整体克制，不做满屏红",
      colors: ["#fbf7ef", "#201817", "#8d463f", "#486d73", "#ead7ce"],
      source: "Material Design color roles",
    },
    {
      id: "atlassian-product-blue",
      label: "产品角色：远洋蓝",
      role: "协作工具 / 看板 / 工作流",
      mood: "任务、状态、反馈各自有明确层级",
      colors: ["#f5f7f8", "#17212b", "#1f5c99", "#5b6f7f", "#dbe5ea"],
      source: "Atlassian color foundations",
    },
    {
      id: "atlassian-product-green",
      label: "产品角色：松木绿",
      role: "增长分析 / 经营复盘",
      mood: "可信、稳定、适合指标解释",
      colors: ["#f3f6f1", "#172018", "#2f6b4f", "#7c6248", "#d9e4d5"],
      source: "Atlassian color foundations",
    },
    {
      id: "editorial-neutral-red",
      label: "编辑高亮：朱红",
      role: "新闻评论 / 证据链",
      mood: "纸面中性色配单点高亮",
      colors: ["#f4f0e8", "#171818", "#a64032", "#53626c", "#ddd2c5"],
    },
    {
      id: "editorial-neutral-gold",
      label: "编辑高亮：旧金",
      role: "长篇讲解 / 案例复盘",
      mood: "低饱和金属质感，避免土黄",
      colors: ["#f2eee5", "#1d1d1a", "#a87a3f", "#4b6773", "#d9d2c7"],
    },
    {
      id: "enterprise-neutral-cyan",
      label: "企业中性：雾青",
      role: "SaaS / 控制台 / 参数页",
      mood: "冷静界面感，强调线条和容器边界",
      colors: ["#f6f8f6", "#151d1f", "#40777a", "#76604d", "#dce4e1"],
    },
    {
      id: "enterprise-neutral-violet",
      label: "企业中性：灰紫",
      role: "AI 工具 / 知识产品",
      mood: "有科技感但避免高饱和紫蓝渐变",
      colors: ["#f4f2ee", "#1b1a1f", "#625b81", "#7b6b4b", "#ddd9d2"],
    },
    {
      id: "creator-warm-studio",
      label: "创作者演播：暖影棚",
      role: "个人 IP / 口播",
      mood: "人物友好，卡片和字幕仍保持专业",
      colors: ["#f7f1e7", "#201917", "#a46a42", "#516f68", "#e2d6c9"],
    },
    {
      id: "creator-cool-studio",
      label: "创作者演播：冷影棚",
      role: "个人 IP / 工具讲解",
      mood: "人物清晰，环境简洁，适合屏幕录制融合",
      colors: ["#f2f6f4", "#161d20", "#3d6c7a", "#7a6048", "#d7e0dd"],
    },
  ];
}

function isNearBlack(color) {
  const normalized = String(color || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return false;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return red <= 38 && green <= 38 && blue <= 38;
}

function normalizeColorSystem(system) {
  const colors = arrayify(system.colors);
  const hasBlack = colors.some(isNearBlack);
  return {
    paletteMode: system.paletteMode || "multi",
    colorTone: system.colorTone || (hasBlack ? "has-dark-anchor" : "no-black"),
    hasBlack,
    ...system,
    colors,
  };
}

function expandedColorSystems() {
  const additions = [
    {
      id: "pearl-sage-mono",
      label: "单色：珍珠鼠尾草",
      role: "白板 / 知识卡 / 温和解释",
      mood: "无黑色、浅底、低噪音，适合长时间观看",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#ffffff", "#f7faf5", "#e7f1e8", "#c6dccb", "#7aa083"],
    },
    {
      id: "ice-blue-mono",
      label: "单色：冰湖蓝",
      role: "工具演示 / 系统解释",
      mood: "明亮、干净、没有黑色锚点",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fbfdff", "#eef7ff", "#d7ebff", "#94c5ed", "#3f86be"],
    },
    {
      id: "coral-studio-mono",
      label: "单色：珊瑚影棚",
      role: "个人 IP / 情绪叙事",
      mood: "明亮暖色、亲近但不过甜",
      paletteMode: "mono",
      colorTone: "bright",
      colors: ["#fff9f6", "#ffe9e2", "#ffc9b8", "#ff9273", "#d85640"],
    },
    {
      id: "lavender-paper-mono",
      label: "单色：薰衣草纸面",
      role: "创意课程 / 写作拆解",
      mood: "柔和单色、低压阅读、适合长字幕",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fcf9ff", "#f0eaff", "#dbcaff", "#ab91ef", "#7554c9"],
    },
    {
      id: "mint-bright-mono",
      label: "单色：薄荷亮面",
      role: "方法论 / 流程 / 白板",
      mood: "清亮、轻盈、适合透明容器",
      paletteMode: "mono",
      colorTone: "bright",
      colors: ["#fbfff9", "#e9ffe9", "#c6f6cb", "#75d885", "#25a85a"],
    },
    {
      id: "amber-light-mono",
      label: "单色：浅琥珀",
      role: "故事复盘 / 重点提示",
      mood: "明亮纸面、温暖、没有重黑",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fffdf6", "#fff2d8", "#ffdca3", "#f6b45f", "#bb7832"],
    },
    {
      id: "rose-milk-mono",
      label: "单色：玫瑰奶白",
      role: "个人 IP / 轻知识 / 女性向课程",
      mood: "柔和亮色、低压阅读，不依赖黑色对比",
      paletteMode: "mono",
      colorTone: "bright",
      colors: ["#fffafa", "#ffeef2", "#ffd5df", "#f59ab1", "#c95a74"],
    },
    {
      id: "sky-paper-mono",
      label: "单色：天空纸面",
      role: "流程讲解 / 工具教程",
      mood: "高明度蓝灰，适合长流程和卡片界面",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fbfeff", "#eef8fc", "#d5edf6", "#8cc8df", "#3c8bab"],
    },
    {
      id: "lime-glass-mono",
      label: "单色：青柠玻璃",
      role: "产品状态 / 增长提示",
      mood: "明亮、轻盈、状态变化清楚",
      paletteMode: "mono",
      colorTone: "bright",
      colors: ["#fdfff7", "#effbd7", "#d7f29a", "#a7d84b", "#6ea329"],
    },
    {
      id: "apricot-cream-mono",
      label: "单色：杏仁奶油",
      role: "故事复盘 / 创作者口播",
      mood: "温暖、明亮、人物友好",
      paletteMode: "mono",
      colorTone: "bright",
      colors: ["#fffaf2", "#ffedd0", "#ffd59a", "#f5a95b", "#c97731"],
    },
    {
      id: "aqua-clean-mono",
      label: "单色：水绿色清透",
      role: "白板 / 方法论 / 健康知识",
      mood: "清爽无黑，适合留白和线稿",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fbfffd", "#e8fbf5", "#c6f0e2", "#74cdb1", "#2b9678"],
    },
    {
      id: "violet-bright-mono",
      label: "单色：明亮紫罗兰",
      role: "AI 工具 / 创意课程",
      mood: "亮紫但不过饱和，适合科技感轻界面",
      paletteMode: "mono",
      colorTone: "bright",
      colors: ["#fdfaff", "#f1e9ff", "#d8c4ff", "#a77bed", "#6f46c8"],
    },
    {
      id: "sandstone-mono",
      label: "单色：浅砂岩",
      role: "纪录 / 案例 / 复盘",
      mood: "暖灰单色，稳重但不发暗",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fffdf7", "#f1ebe1", "#ddd2c2", "#bba98d", "#826f57"],
    },
    {
      id: "ceramic-blue-mono",
      label: "单色：陶瓷蓝",
      role: "知识解释 / 数据趋势",
      mood: "瓷白底配蓝色层级，清晰专业",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fbfdff", "#e8f0f8", "#c7dced", "#7fa9ce", "#356c9d"],
    },
    {
      id: "leaf-studio-mono",
      label: "单色：叶绿演播",
      role: "方法论 / 课程 / 长口播",
      mood: "自然、克制、适合字幕长时间停留",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fbfff8", "#edf6e7", "#d1e6c5", "#91bc7d", "#4f8350"],
    },
    {
      id: "silver-blue-mono",
      label: "单色：银蓝控制台",
      role: "SaaS / 参数页 / 系统说明",
      mood: "冷静产品感，容器边界清楚",
      paletteMode: "mono",
      colorTone: "no-black",
      colors: ["#fbfdfe", "#edf3f6", "#d5e3ea", "#94b4c4", "#53798d"],
    },
    {
      id: "pure-black-stage",
      label: "纯黑：黑场聚光",
      role: "明确纯黑风格 / 片头 / 高反差",
      mood: "纯黑底、白字、单点强调，作为显式选项",
      paletteMode: "dark",
      colorTone: "pure-black",
      colors: ["#000000", "#121212", "#252525", "#f8f8f2", "#d7c9a5"],
    },
    {
      id: "black-neon-cyan",
      label: "纯黑：青色扫描",
      role: "工具 / 数据 / 科技片段",
      mood: "黑底高亮、线条清楚、适合 HUD 式画面",
      paletteMode: "dark",
      colorTone: "pure-black",
      colors: ["#000000", "#101820", "#00c2d1", "#78ffcc", "#f4f7fb"],
    },
    {
      id: "bright-editorial-primary",
      label: "多色：亮面主编色",
      role: "观点 / 快节奏解释",
      mood: "亮丽、多色、无黑色，适合年轻内容",
      paletteMode: "multi",
      colorTone: "bright",
      colors: ["#fffdf7", "#1f6feb", "#ff7a59", "#30c48d", "#ffd166"],
    },
    {
      id: "candy-product-ui",
      label: "多色：糖果产品界面",
      role: "产品演示 / App 功能",
      mood: "高明度、多状态色、避免沉重黑底",
      paletteMode: "multi",
      colorTone: "bright",
      colors: ["#ffffff", "#6c63ff", "#00c2ff", "#ff6fb1", "#ffe66d"],
    },
    {
      id: "garden-pop-multi",
      label: "多色：花园亮色",
      role: "生活方式 / 创作者口播",
      mood: "亮绿、珊瑚、柠檬黄组合，亲和但有层次",
      paletteMode: "multi",
      colorTone: "bright",
      colors: ["#fbfff3", "#3dbb74", "#ff8066", "#f7cf45", "#6aa9ff"],
    },
    {
      id: "sunset-data-multi",
      label: "多色：日落数据",
      role: "数据故事 / 趋势叙事",
      mood: "橙粉蓝对比，亮丽但保留信息层级",
      paletteMode: "multi",
      colorTone: "bright",
      colors: ["#fff7ed", "#ff6b4a", "#ffb703", "#4cc9f0", "#8ecae6"],
    },
  ];
  return [...colorSystems(), ...additions].map(normalizeColorSystem);
}

function paletteModes(systems) {
  const count = (predicate) => systems.filter(predicate).length;
  return [
    { id: "multi", label: "多色体系", count: count((system) => system.paletteMode === "multi") },
    { id: "mono", label: "单色体系", count: count((system) => system.paletteMode === "mono") },
    { id: "dark", label: "纯黑/深色", count: count((system) => system.paletteMode === "dark") },
    { id: "no-black", label: "无黑色", count: count((system) => !system.hasBlack) },
    { id: "all", label: "全部", count: systems.length },
  ];
}

function colorSystemReferences() {
  return [
    {
      id: "material-color-system",
      label: "Material Design 色彩系统",
      url: "https://m3.material.io/styles/color/system/overview",
      appliedAs: "角色色、容器色、强调色分层",
    },
    {
      id: "atlassian-color-foundations",
      label: "Atlassian 色彩基础",
      url: "https://atlassian.design/foundations/color",
      appliedAs: "产品状态、反馈和中性色层级",
    },
  ];
}

function personalIpExamples() {
  return [
    {
      id: "ip-character-assets",
      label: "个人 IP 形象资产",
      example: "基于授权身份信息生成角色正面、半身口播和表情/手势资产，服务知识图解。",
      sourceAsset: "characterAssets",
    },
    {
      id: "ip-diagram-modes",
      label: "知识图解模式",
      example: "同一 IP 主角可进入知识卡、流程图、手绘图、执行角色图等不同画面模式。",
      sourceAsset: "diagramModes",
    },
    {
      id: "ip-agent-collaboration",
      label: "协作图",
      example: "主讲 IP 负责提出问题，执行角色沿任务流程推进，适合解释自动化工作流。",
      sourceAsset: "banner",
    },
    {
      id: "ip-ppt-director",
      label: "课程页导演模式",
      example: "把长内容拆成页面导演脚本，每页有主信息、讲述节奏、图解结构和修复建议。",
      sourceAsset: "pptMode",
    },
  ];
}

function personalIpPresetIdentities() {
  return [
    {
      id: "male-teaching-host",
      label: "男生主讲",
      role: "理性讲解 / 产品方法论",
      description: "黑色外套、干净线稿、适合工作流和知识图解。",
      selected: true,
      tone: "#315f7d",
      accent: "#9a673f",
    },
    {
      id: "female-teaching-host",
      label: "女生主讲",
      role: "课程讲解 / 轻知识",
      description: "柔和轮廓、清爽白底、适合课程页和知识卡。",
      selected: false,
      tone: "#6d4e68",
      accent: "#4f735f",
    },
    {
      id: "business-analyst-host",
      label: "商务分析师",
      role: "数据证明 / 案例复盘",
      description: "低饱和商务形象，适合数据、证据和决策场景。",
      selected: false,
      tone: "#5f6f7b",
      accent: "#b27744",
    },
    {
      id: "whiteboard-coach",
      label: "白板教练",
      role: "手绘推演 / 方法拆解",
      description: "更强手势和指向动作，适合与白板绘制组合。",
      selected: false,
      tone: "#4f735f",
      accent: "#a84735",
    },
  ];
}

function whiteboardModule() {
  const pocRoot = join(WORKSPACE_ROOT, "research", "whiteboard-layered-subtitle-top-demo-20260701");
  const engineDemoRoot = join(WORKSPACE_ROOT, "research", "whiteboard-skill-demo-20260701");
  return {
    enabledByDefault: true,
    sourceSkill: "gnipbao/codex-whiteboard-video-skill",
    sourceEngine: "gnipbao/whiteboard-video-engine",
    activationScope: "planner-gated bounded insert",
    layerPolicy: "当前视频背景归主框架所有；白板引擎只绘制语义前景线稿/手写轨迹；彩色组件回填在描线层之上；字幕始终最后合成。",
    previewArtifacts: {
      validatedPocVideo: imageDataUriIfExists(join(pocRoot, "whiteboard-layered-subtitle-top-demo.mp4")),
      validatedPocPoster: imageDataUriIfExists(join(pocRoot, "screenshots", "frame-04-4s.png")),
      validatedPocFinalFrame: imageDataUriIfExists(join(pocRoot, "screenshots", "frame-final.png")),
      layeringStrategy: imageDataUriIfExists(join(pocRoot, "workflow", "layering-strategy.json")),
      layeredCompositeRender: imageDataUriIfExists(join(pocRoot, "workflow", "layered-composite-render.json")),
      qcLog: imageDataUriIfExists(join(pocRoot, "logs", "qc.json")),
      engineClip: imageDataUriIfExists(join(engineDemoRoot, "whiteboard-capability-demo.mp4")),
      enginePlan: imageDataUriIfExists(join(engineDemoRoot, "workflow", "whiteboard-scene-plan.json")),
    },
    layerOrder: [
      { id: "background", label: "框架背景", owner: "codex-video-workflow", rule: "不送入白板引擎" },
      { id: "whiteboard-sketch", label: "白板描线", owner: "whiteboard-video-engine", rule: "只画前景线稿、箭头、圈画和手写轨迹" },
      { id: "foreground-components", label: "彩色组件", owner: "codex-video-workflow", rule: "精确文字、卡片、图表和颜色回填" },
      { id: "subtitles", label: "字幕顶层", owner: "codex-video-workflow", rule: "最后合成，永远不被手写层遮挡" },
    ],
    modes: [
      {
        id: "floating-element-reveal",
        label: "浮层描线插入",
        description: "白板引擎只接收前景组件线稿，生成手/笔描线视频，再作为可抠出的前景插入。",
      },
      {
        id: "framework-background-preserved",
        label: "框架背景保留",
        description: "现有视频背景、主题、光影和页面结构不交给白板引擎重画。",
      },
      {
        id: "colored-component-resolve",
        label: "彩色组件回填",
        description: "描线完成后由主框架把带精确文字和颜色的组件回填，避免双字和糊字。",
      },
      {
        id: "subtitle-topmost-composite",
        label: "字幕顶层合成",
        description: "字幕不进入白板引擎，最终合成时始终在最上层并避开主体。",
      },
    ],
  };
}

function imageDataUriIfExists(path) {
  if (!existsSync(path)) return "";
  return path;
}

function imageMimeType(path) {
  return {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
  }[extname(path).toLowerCase()] || "application/octet-stream";
}

function inlineImageIfExists(path) {
  if (!path || !existsSync(path)) return "";
  try {
    return `data:${imageMimeType(path)};base64,${readFileSync(path).toString("base64")}`;
  } catch {
    return "";
  }
}

function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function fallbackIpPreviewSvg(label = "个人 IP") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#f6f2e9"/>
    <rect x="70" y="70" width="1140" height="580" rx="22" fill="#fffdf7" stroke="#d8d0c3"/>
    <circle cx="270" cy="288" r="86" fill="#315f7d"/>
    <path d="M166 550 C190 418 350 418 380 550" fill="#1d232b"/>
    <rect x="498" y="168" width="540" height="96" rx="18" fill="#e9eee9" stroke="#cbd8d1"/>
    <rect x="498" y="312" width="650" height="74" rx="16" fill="#f1e6d7" stroke="#d8c8b2"/>
    <rect x="498" y="436" width="436" height="64" rx="16" fill="#e7f1e8" stroke="#c6dccb"/>
    <path d="M392 322 C484 278 548 278 618 319" fill="none" stroke="#a06f32" stroke-width="16" stroke-linecap="round"/>
    <text x="270" y="610" font-size="38" text-anchor="middle" fill="#1d232b" font-family="Arial, sans-serif">${escapeHtml(label)}</text>
  </svg>`;
  return svgDataUri(svg);
}

function ipDesignPreviewSvg(type = "characterAssets", label = "个人 IP 图解") {
  const sceneLabel = escapeHtml(label);
  const titleByType = {
    characterAssets: "固定人设资产表",
    diagramModes: "知识图解模式",
    banner: "协作图",
    pptMode: "课程页导演模式",
    workflowOverview: "内容生成流程",
    knowledgeCard: "知识卡片",
    pptMethodPage: "方法页拆解",
    characterSample: "角色动作样张",
  };
  const title = escapeHtml(titleByType[type] || label);
  const body = {
    characterAssets: `
      <rect x="64" y="96" width="340" height="500" rx="18" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="92" y="144" class="small">01 固定主讲人</text>
      <circle cx="224" cy="250" r="58" fill="#101615"/>
      <path d="M140 474 C170 354 285 354 318 474" fill="#232a2b"/>
      <path d="M150 494 C204 520 260 520 312 494" fill="none" stroke="#a66d39" stroke-width="10" stroke-linecap="round"/>
      <rect x="112" y="518" width="224" height="42" rx="12" fill="#f2e8da" stroke="#d8d0c3"/>
      <text x="224" y="545" text-anchor="middle" class="note">正面 / 半身 / 手势</text>
      <rect x="470" y="96" width="340" height="500" rx="18" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="498" y="144" class="small">02 角色规范</text>
      <circle cx="594" cy="240" r="46" fill="#101615"/>
      <path d="M524 408 C550 316 642 316 668 408" fill="#252b2d"/>
      <path d="M684 238 C760 220 770 274 708 294" class="line accent"/>
      <rect x="524" y="452" width="216" height="34" rx="10" fill="#e9eee9" stroke="#cad8d1"/>
      <text x="632" y="475" text-anchor="middle" class="note">服装 / 发型 / 表情</text>
      <rect x="876" y="96" width="340" height="500" rx="18" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="904" y="144" class="small">03 动作扩展</text>
      <rect x="930" y="200" width="88" height="120" rx="14" fill="#eef4f0" stroke="#cad8d1"/>
      <rect x="1056" y="200" width="88" height="120" rx="14" fill="#f3e7d8" stroke="#d8c8b2"/>
      <rect x="930" y="362" width="88" height="120" rx="14" fill="#eef4f0" stroke="#cad8d1"/>
      <rect x="1056" y="362" width="88" height="120" rx="14" fill="#f3e7d8" stroke="#d8c8b2"/>
      <path d="M974 260 C1014 248 1044 248 1094 260" class="line red"/>
      <path d="M974 422 C1014 410 1044 410 1094 422" class="line accent"/>`,
    diagramModes: `
      <rect x="76" y="118" width="280" height="420" rx="18" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="112" y="164" class="small">知识卡</text>
      <rect x="112" y="208" width="204" height="54" rx="12" fill="#101615"/>
      <rect x="112" y="298" width="204" height="32" rx="9" fill="#e9eee9"/>
      <rect x="112" y="354" width="154" height="32" rx="9" fill="#f3e7d8"/>
      <circle cx="294" cy="432" r="34" fill="#315f7d"/>
      <rect x="420" y="118" width="420" height="420" rx="18" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="456" y="164" class="small">流程图</text>
      <rect x="474" y="230" width="104" height="58" rx="14" fill="#eef4f0" stroke="#cad8d1"/>
      <rect x="626" y="230" width="104" height="58" rx="14" fill="#f3e7d8" stroke="#d8c8b2"/>
      <rect x="626" y="354" width="104" height="58" rx="14" fill="#eef4f0" stroke="#cad8d1"/>
      <path d="M584 260H618M678 296V344" class="line accent"/>
      <path d="M496 426 C584 464 704 458 774 402" class="line red"/>
      <rect x="904" y="118" width="280" height="420" rx="18" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="940" y="164" class="small">执行角色图</text>
      <circle cx="998" cy="252" r="34" fill="#101615"/>
      <circle cx="1092" cy="252" r="34" fill="#4f735f"/>
      <rect x="960" y="342" width="176" height="74" rx="15" fill="#f7f2e9" stroke="#d8d0c3"/>
      <path d="M1002 286 C1026 318 1066 318 1088 286" class="line accent"/>`,
    banner: `
      <circle cx="180" cy="310" r="60" fill="#101615"/>
      <path d="M96 530 C128 398 232 398 268 530" fill="#252b2d"/>
      <text x="180" y="590" text-anchor="middle" class="note">IP 主讲</text>
      <rect x="382" y="128" width="210" height="116" rx="20" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="486" y="178" text-anchor="middle" class="small">资料角色</text>
      <rect x="382" y="336" width="210" height="116" rx="20" fill="#fffdf7" stroke="#d8d0c3"/>
      <text x="486" y="386" text-anchor="middle" class="small">设计角色</text>
      <rect x="704" y="232" width="240" height="136" rx="22" fill="#e9eee9" stroke="#cad8d1"/>
      <text x="824" y="290" text-anchor="middle" class="small">知识图解</text>
      <text x="824" y="330" text-anchor="middle" class="note">卡片 / 箭头 / 批注</text>
      <rect x="1030" y="252" width="150" height="96" rx="18" fill="#f3e7d8" stroke="#d8c8b2"/>
      <text x="1105" y="310" text-anchor="middle" class="small">视频页</text>
      <path d="M258 310 C326 226 354 190 382 186M258 350 C324 420 350 396 382 394M592 186 C650 196 674 238 704 266M592 394 C650 384 674 342 704 320M944 300H1030" class="line accent"/>
      <path d="M288 284 C352 270 394 272 446 294" class="line red"/>`,
    pptMode: `
      <rect x="70" y="88" width="1140" height="520" rx="22" fill="#fffdf7" stroke="#d8d0c3"/>
      ${Array.from({ length: 8 }, (_, index) => {
        const x = 116 + (index % 4) * 272;
        const y = 148 + Math.floor(index / 4) * 202;
        const fill = index % 3 === 0 ? "#e9eee9" : index % 3 === 1 ? "#f3e7d8" : "#f7f2e9";
        return `<rect x="${x}" y="${y}" width="210" height="128" rx="16" fill="${fill}" stroke="#d8d0c3"/>
          <rect x="${x + 22}" y="${y + 24}" width="92" height="16" rx="8" fill="#101615"/>
          <rect x="${x + 22}" y="${y + 58}" width="154" height="10" rx="5" fill="#a66d39"/>
          <circle cx="${x + 170}" cy="${y + 88}" r="20" fill="#315f7d"/>
          <text x="${x + 26}" y="${y + 108}" class="tiny">P${index + 1}</text>`;
      }).join("")}
      <path d="M118 624 C370 676 870 676 1162 624" class="line accent"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <style>
      text{font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;fill:#111716}
      .small{font-size:28px;font-weight:800}.note{font-size:22px;font-weight:700;fill:#5d6763}.tiny{font-size:18px;font-weight:800;fill:#5d6763}
      .line{fill:none;stroke:#315f7d;stroke-width:9;stroke-linecap:round;stroke-linejoin:round}.accent{stroke:#a66d39}.red{stroke:#c45b3a}
    </style>
    <rect width="1280" height="720" fill="#f6f2e9"/>
    <rect x="40" y="38" width="1200" height="644" rx="28" fill="#fbfaf5" stroke="#d9d2c7"/>
    <text x="76" y="78" class="tiny">${sceneLabel}</text>
    <text x="76" y="122" class="small">${title}</text>
    ${body[type] || body.characterAssets}
  </svg>`;
  return svgDataUri(svg);
}

function ipDesignPreviewAssets() {
  return {
    banner: ipDesignPreviewSvg("banner", "个人 IP / 协作图"),
    characterAssets: ipDesignPreviewSvg("characterAssets", "个人 IP / 形象固定"),
    diagramModes: ipDesignPreviewSvg("diagramModes", "个人 IP / 知识图解"),
    pptMode: ipDesignPreviewSvg("pptMode", "个人 IP / PPT 导演"),
    characterSample: ipDesignPreviewSvg("characterAssets", "个人 IP / 角色资产样张"),
    knowledgeCard: ipDesignPreviewSvg("diagramModes", "个人 IP / 知识卡模式"),
    workflowOverview: ipDesignPreviewSvg("banner", "个人 IP / 工作流图解"),
    pptMethodPage: ipDesignPreviewSvg("pptMode", "个人 IP / 方法页导演"),
  };
}

function copyIpDiagramAssetIfExists(packageDir, sourcePath, fileName) {
  if (!sourcePath || !existsSync(sourcePath) || !packageDir) return "";
  const assetDir = join(packageDir, "assets", "ip-diagram-creator");
  ensureDir(assetDir);
  const targetName = fileName || basename(sourcePath);
  const targetPath = join(assetDir, targetName);
  try {
    copyFileSync(sourcePath, targetPath);
    return relative(packageDir, targetPath).split("\\").join("/");
  } catch {
    return "";
  }
}

function firstExistingImage(packageDir, candidates, targetName, fallback = "") {
  const targetStem = targetName ? basename(targetName, extname(targetName)) : "";
  for (const candidate of candidates) {
    const copied = copyIpDiagramAssetIfExists(packageDir, candidate, targetStem ? `${targetStem}${extname(candidate)}` : basename(candidate));
    if (copied) return copied;
  }
  return fallback;
}

function ipDiagramCreatorAssets(packageDir) {
  const assetsDir = join(IP_DIAGRAM_REPO, "assets");
  const galleryDir = join(assetsDir, "examples", "gallery");
  const pptDir = join(assetsDir, "examples", "ppt-mode");
  const fallbackPreviews = ipDesignPreviewAssets();
  return {
    repository: "haloshin/ip-diagram-creator",
    localPath: IP_DIAGRAM_REPO,
    publicUrl: "https://github.com/haloshin/ip-diagram-creator",
    previewSource: "official-ip-diagram-creator-example-assets-served-as-package-relative-review-files",
    sourceFilesAvailable: {
      banner: existsSync(join(assetsDir, "banner.webp")),
      characterAssets: existsSync(join(assetsDir, "what-you-get-character-assets.png")) || existsSync(join(assetsDir, "what-you-get-character-assets.webp")),
      diagramModes: existsSync(join(assetsDir, "what-you-get-diagram-modes.png")) || existsSync(join(assetsDir, "what-you-get-diagram-modes.webp")),
      pptMode: existsSync(join(assetsDir, "examples", "ppt-mode", "ppt-mode-gallery-8up.png")) || existsSync(join(assetsDir, "examples", "ppt-mode", "ppt-mode-gallery-8up.webp")),
    },
    banner: firstExistingImage(packageDir, [join(assetsDir, "banner.webp")], "banner.webp", fallbackPreviews.banner),
    characterAssets: firstExistingImage(packageDir, [
      join(assetsDir, "what-you-get-character-assets.png"),
      join(assetsDir, "what-you-get-character-assets.webp"),
    ], "what-you-get-character-assets.png", fallbackPreviews.characterAssets),
    diagramModes: firstExistingImage(packageDir, [
      join(assetsDir, "what-you-get-diagram-modes.png"),
      join(assetsDir, "what-you-get-diagram-modes.webp"),
    ], "what-you-get-diagram-modes.png", fallbackPreviews.diagramModes),
    pptMode: firstExistingImage(packageDir, [
      join(pptDir, "ppt-mode-gallery-8up.png"),
      join(pptDir, "ppt-mode-gallery-8up.webp"),
    ], "ppt-mode-gallery-8up.png", fallbackPreviews.pptMode),
    characterSample: firstExistingImage(packageDir, [
      join(galleryDir, "character-assets-sample.png"),
      join(galleryDir, "character-assets-sample.webp"),
    ], "character-assets-sample.png", fallbackPreviews.characterSample),
    knowledgeCard: firstExistingImage(packageDir, [
      join(galleryDir, "knowledge-card-high-density.png"),
      join(galleryDir, "knowledge-card-high-density.webp"),
    ], "knowledge-card-high-density.png", fallbackPreviews.knowledgeCard),
    workflowOverview: firstExistingImage(packageDir, [
      join(galleryDir, "workflow-overview-16x9.png"),
      join(galleryDir, "workflow-overview-16x9.webp"),
    ], "workflow-overview-16x9.png", fallbackPreviews.workflowOverview),
    pptMethodPage: firstExistingImage(packageDir, [
      join(pptDir, "ppt-mode-07-method-page.png"),
      join(pptDir, "ppt-mode-07-method-page.webp"),
    ], "ppt-mode-07-method-page.png", fallbackPreviews.pptMethodPage),
  };
}

function voiceModes() {
  return {
    languageModes: [
      {
        id: "zh-mandarin",
        label: "中文普通话",
        sample: "今天这段内容，我们用一个清晰的例子讲透。",
        backend: "本地高质量语音",
        support: "默认支持",
        previewSampleId: "01_zh_female_mandarin_creator",
      },
      {
        id: "en-narration",
        label: "英文口播",
        sample: "Let us turn the workflow into a clear visual story.",
        backend: "本地英文语音",
        support: "英文稿支持",
        previewSampleId: "05_en_female_short",
      },
      {
        id: "bilingual",
        label: "中英双语",
        sample: "先给结论，再补 evidence，让观众马上跟上。",
        backend: "本地分段口播 + 双语字幕层",
        support: "脚本分段支持",
        previewSampleId: "05_en_female_short",
      },
      {
        id: "dialect-accent",
        label: "方言 / 口音",
        sample: "保留地方语气，但字幕仍然使用清晰书面表达。",
        backend: "本地音色资源可用时启用",
        support: "条件支持",
        previewSampleId: "03_yue_female_short",
      },
    ],
    dialects: [
      {
        id: "yue",
        label: "粤语",
        sample: "呢段内容，先讲结论，再拆开证明。",
        available: true,
        previewSampleId: "03_yue_female_short",
        speaker: "粤语女",
        fallback: "本机已验证粤语女固定 speaker，可直接试听。",
      },
      {
        id: "sichuan",
        label: "四川话",
        sample: "这个流程先看结果，再看每一步咋个来的。",
        available: false,
        previewSampleId: "",
        speaker: "",
        fallback: "当前固定 speaker 模型未安装四川话 Instruct 路线，暂不标成可试听能力。",
      },
      {
        id: "northeast",
        label: "东北话",
        sample: "先把关键点整明白，再看页面咋展示。",
        available: false,
        previewSampleId: "",
        speaker: "",
        fallback: "当前固定 speaker 模型未安装东北话 Instruct 路线，暂不标成可试听能力。",
      },
      {
        id: "taiwan",
        label: "台式普通话",
        sample: "我们先把重点放在画面最容易理解的位置。",
        available: false,
        previewSampleId: "",
        speaker: "",
        fallback: "当前固定 speaker 模型未安装台式普通话专用音色，暂不标成可试听能力。",
      },
      {
        id: "shanghai",
        label: "上海话",
        sample: "先交代结论，再用图解把关系讲清爽。",
        available: false,
        previewSampleId: "",
        speaker: "",
        fallback: "当前固定 speaker 模型未安装上海话 Instruct 路线，暂不标成可试听能力。",
      },
    ],
    genderOptions: [
      { id: "female", label: "女声", default: true },
      { id: "male", label: "男声", default: false },
    ],
    toneTypes: [
      {
        id: "all",
        label: "全部音色",
        description: "显示当前语言与性别下所有可试听样本。",
        default: true,
      },
      {
        id: "creator",
        label: "自然知识口播",
        description: "适合课程、解释、方法论视频。",
      },
      {
        id: "fast",
        label: "快节奏短视频",
        description: "语速更紧，适合短视频信息推进。",
      },
      {
        id: "dialect",
        label: "方言口音",
        description: "只展示本机已验证的方言 speaker。",
      },
      {
        id: "english",
        label: "英文旁白",
        description: "英文脚本试听与英文口播预览。",
      },
    ],
    speakerMatching: [
      { language: "中文普通话", female: "中文女声", male: "中文男声" },
      { language: "英文口播", female: "英文女声", male: "英文男声" },
      { language: "粤语", female: "粤语女声；缺失时中文女声", male: "粤语男声；缺失时中文男声" },
      { language: "其他方言", female: "对应方言女声；缺失时中文女声", male: "对应方言男声；缺失时中文男声" },
    ],
    speechStyles: [
      { id: "auto", label: "自动匹配", description: "根据题材自动选择节奏。" },
      { id: "conversational", label: "自然口播", description: "更像创作者面对镜头讲。" },
      { id: "tutorial", label: "课程讲解", description: "步骤清楚，停顿稳定。" },
      { id: "explainer", label: "知识解释", description: "观点、例子、结论平衡。" },
      { id: "story", label: "故事叙事", description: "重视悬念与转折。" },
      { id: "news", label: "新闻分析", description: "事实密度高，语气克制。" },
      { id: "product", label: "产品演示", description: "短句、利益点、状态变化。" },
      { id: "documentary", label: "纪录片感", description: "更慢、更有空间感。" },
    ],
  };
}

function voicePreviewSampleDefinitions() {
  return [
    {
      id: "zh-female-creator",
      sampleIds: ["01_zh_female_mandarin_creator"],
      label: "中文女声 - 自然知识口播",
      languageMode: "zh-mandarin",
      languageLabel: "中文普通话",
      gender: "female",
      genderLabel: "女声",
      toneType: "creator",
      toneLabel: "自然知识口播",
      dialectId: "mandarin",
      dialectLabel: "普通话",
      speaker: "中文女",
      fallbackText: "这是一段普通中文口播。我们测试它的节奏、咬字、情绪起伏，以及能不能适合知识类视频。",
      note: "本地 CosyVoice 固定 speaker 已验证样本。",
    },
    {
      id: "zh-male-creator",
      sampleIds: ["02_zh_male_short", "02_zh_male_mandarin_creator"],
      label: "中文男声 - 自然口播",
      languageMode: "zh-mandarin",
      languageLabel: "中文普通话",
      gender: "male",
      genderLabel: "男声",
      toneType: "creator",
      toneLabel: "自然知识口播",
      dialectId: "mandarin",
      dialectLabel: "普通话",
      speaker: "中文男",
      fallbackText: "男声口播测试。",
      note: "本地 CosyVoice 固定 speaker 已验证样本。",
    },
    {
      id: "zh-female-fast",
      sampleIds: ["06_zh_female_fast_short", "08_zh_female_fast"],
      label: "中文女声 - 快节奏",
      languageMode: "zh-mandarin",
      languageLabel: "中文普通话",
      gender: "female",
      genderLabel: "女声",
      toneType: "fast",
      toneLabel: "快节奏短视频",
      dialectId: "mandarin",
      dialectLabel: "普通话",
      speaker: "中文女",
      fallbackText: "快速口播测试。",
      note: "同一 speaker 的更快语速样本，用于短视频节奏判断。",
    },
    {
      id: "yue-female-cantonese",
      sampleIds: ["03_yue_female_short", "03_yue_female_cantonese_written"],
      label: "粤语女声 - 广东话",
      languageMode: "dialect-accent",
      languageLabel: "方言 / 口音",
      gender: "female",
      genderLabel: "女声",
      toneType: "dialect",
      toneLabel: "方言口音",
      dialectId: "yue",
      dialectLabel: "粤语",
      speaker: "粤语女",
      fallbackText: "今日试下广东话。",
      note: "当前本机已验证的方言 speaker。",
    },
    {
      id: "yue-female-mandarin-text",
      sampleIds: ["04_yue_female_mandarin_short", "04_yue_female_mandarin_text"],
      label: "粤语女声 - 普通话文本",
      languageMode: "dialect-accent",
      languageLabel: "方言 / 口音",
      gender: "female",
      genderLabel: "女声",
      toneType: "dialect",
      toneLabel: "方言口音",
      dialectId: "yue",
      dialectLabel: "粤语",
      speaker: "粤语女",
      fallbackText: "普通话口播测试。",
      note: "用于试听粤语 speaker 朗读普通话文本的口音表现。",
    },
    {
      id: "en-female",
      sampleIds: ["05_en_female_short", "05_en_female_english"],
      label: "英文女声 - English narration",
      languageMode: "en-narration",
      languageLabel: "英文口播",
      gender: "female",
      genderLabel: "女声",
      toneType: "english",
      toneLabel: "英文旁白",
      dialectId: "english",
      dialectLabel: "English",
      speaker: "英文女",
      fallbackText: "English voice test.",
      note: "本地 CosyVoice 英文固定 speaker 已验证样本。",
    },
    {
      id: "en-male",
      sampleIds: ["06_en_male_english"],
      label: "英文男声 - English narration",
      languageMode: "en-narration",
      languageLabel: "英文口播",
      gender: "male",
      genderLabel: "男声",
      toneType: "english",
      toneLabel: "英文旁白",
      dialectId: "english",
      dialectLabel: "English",
      speaker: "英文男",
      fallbackText: "This is a short English voice test for narration.",
      note: "speaker 已存在；当前试听包尚未生成男声英文样本。",
    },
  ];
}

function voicePreviewManifest() {
  const manifestPath = [VOICE_PREVIEW_ASSET_MANIFEST, VOICE_PREVIEW_RESEARCH_MANIFEST].find((candidate) => existsSync(candidate));
  if (!manifestPath) {
    return {
      exists: false,
      manifestPath: VOICE_PREVIEW_ASSET_MANIFEST,
      rootDir: VOICE_PREVIEW_ASSET_ROOT,
      source: "missing",
      availableSpeakers: [],
      samples: [],
      limits: ["Local voice preview manifest is missing."],
    };
  }
  const manifest = readJsonIfExists(manifestPath) || {};
  return {
    exists: true,
    manifestPath,
    rootDir: dirname(manifestPath),
    source: manifest.source || relative(WORKSPACE_ROOT, manifestPath).split("\\").join("/"),
    model: manifest.model || "",
    modelDir: manifest.modelDir || "",
    generatedAt: manifest.generatedAt || "",
    availableSpeakers: arrayify(manifest.availableSpeakers),
    samples: arrayify(manifest.samples),
    limits: arrayify(manifest.limits),
  };
}

function resolveVoicePreviewMediaPath(mediaPath, manifestRoot) {
  if (!mediaPath) return "";
  if (mediaPath.startsWith("/")) return mediaPath;
  const candidates = [
    resolve(manifestRoot || "", mediaPath),
    resolve(SKILL_ROOT, mediaPath),
    resolve(WORKSPACE_ROOT, mediaPath),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0] || resolve(WORKSPACE_ROOT, mediaPath);
}

function collectVoicePreviewCatalog(packageDir, outPath) {
  const manifest = voicePreviewManifest();
  const sourceSamples = new Map(manifest.samples.map((sample) => [sample.id, sample]));
  const targetDir = join(packageDir, "assets", "voice-preview");
  const samples = voicePreviewSampleDefinitions().map((definition) => {
    const source = definition.sampleIds
      .map((sampleId) => sourceSamples.get(sampleId))
      .find((sample) => {
        const mediaPath = sample?.mp3 || sample?.wav || "";
        return mediaPath && existsSync(resolveVoicePreviewMediaPath(mediaPath, manifest.rootDir));
      });
    const mediaPath = source?.mp3 || source?.wav || "";
    const sourcePath = resolveVoicePreviewMediaPath(mediaPath, manifest.rootDir);
    const ext = extname(mediaPath || "");
    let localPath = "";
    let htmlSrc = "";
    let available = false;
    if (sourcePath && ext && existsSync(sourcePath)) {
      ensureDir(targetDir);
      localPath = join(targetDir, `${definition.id}${ext}`);
      copyFileSync(sourcePath, localPath);
      htmlSrc = htmlRelativePath(outPath, localPath);
      available = true;
    }
    return {
      ...definition,
      sourceSampleId: source?.id || definition.sampleIds[0] || "",
      text: source?.text || definition.fallbackText,
      durationSeconds: Number(source?.durationSeconds || 0),
      speed: Number(source?.speed || 1),
      sampleRate: Number(source?.sampleRate || 0),
      sourcePath: mediaPath,
      localPath: localPath ? relative(packageDir, localPath).split("\\").join("/") : "",
      src: htmlSrc,
      mediaType: ext ? ext.slice(1).toLowerCase() : "",
      available,
      support: available ? "可试听" : "暂无本地试听样本",
    };
  });
  return {
    source: manifest.source || "assets/voice-preview/manifest.json",
    sourceExists: manifest.exists,
    model: manifest.model || "CosyVoice-300M-SFT",
    modelDir: manifest.modelDir || "research/voice-quality-poc/cosyvoice/CosyVoice/pretrained_models/CosyVoice-300M-SFT",
    generatedAt: manifest.generatedAt || "",
    sampleCount: samples.filter((sample) => sample.available).length,
    totalOptionCount: samples.length,
    availableSpeakers: manifest.availableSpeakers,
    limits: manifest.limits,
    samples,
  };
}

function inferCanvas(brief, contract, designPlan) {
  const canvas = brief.canvas || contract.canvasDecision || designPlan.canvas || {};
  const width = Number(canvas.width || (canvas.vertical ? 1080 : 1920));
  const height = Number(canvas.height || (canvas.vertical ? 1920 : 1080));
  const explicitFps = Number(brief.fps || brief.frameRate || canvas.fps || canvas.frameRate || 0);
  return {
    width,
    height,
    aspect: canvas.aspect || (height > width ? "9:16" : "16:9"),
    vertical: Boolean(canvas.vertical ?? height > width),
    platformProfile: canvas.platformProfile || (height > width ? "short-form-vertical" : "local-review-horizontal"),
    fps: explicitFps > 0 ? explicitFps : 60,
  };
}

function buildContext(packageDir) {
  const workflowDir = join(packageDir, "workflow");
  const brief = readJsonIfExists(join(packageDir, "brief.json")) || {};
  const contract = readJsonIfExists(join(workflowDir, "generation-mode-contract.json")) || {};
  const designPlan = readJsonIfExists(join(workflowDir, "design-plan.json")) || {};
  const colorSystemPlan = readJsonIfExists(join(workflowDir, "color-system-plan.json")) || designPlan.colorSystemPlan || {};
  const motionPlan = readJsonIfExists(join(workflowDir, "motion-template-selection.json")) || {};
  const layeredMotionPlan = readJsonIfExists(join(workflowDir, "layered-motion-plan.json")) || {};
  const motionStylePlan = readJsonIfExists(join(workflowDir, "motion-style-plan.json")) || {};
  const captionPlan = readJsonIfExists(join(workflowDir, "caption-style-plan.json")) || {};
  const mediaPlan = readJsonIfExists(join(workflowDir, "media-routing-plan.json")) || {};
  const ipPlan = readJsonIfExists(join(workflowDir, "ip-diagram-creator-plan.json")) || {};
  const personalIpAssetRegistry = readJsonIfExists(join(workflowDir, "personal-ip-asset-registry.json")) || ipPlan.personalIpAssetRegistry || {};
  const ipNativeJobs = readJsonIfExists(join(workflowDir, "ip-diagram-creator-native-jobs.json")) || {};
  const pageDecision = readJsonIfExists(join(workflowDir, "page-decision-contract.json")) || {};
  const runtimeConfig = readJsonIfExists(join(workflowDir, "runtime-config.json")) || {};
  const captionCatalog = readJsonIfExists(join(SKILL_ROOT, "assets", "caption-style-catalog.json")) || {};
  const motionStyleCatalog = readJsonIfExists(join(SKILL_ROOT, "assets", "motion-style-catalog.json")) || {};
  const motionStyleTemplateLibrary = readJsonIfExists(join(SKILL_ROOT, "assets", "motion-style-template-library.json")) || {};
  const motionRegistry = readJsonIfExists(join(SKILL_ROOT, "templates", "html-motion", "motion-template-registry.json")) || {};
  const coverDesign = readJsonIfExists(join(workflowDir, "cover-design.json")) || {};
  const coverImage2Prompts = readJsonIfExists(join(workflowDir, "cover-image2-prompts.json")) || {};
  const coverSizeSelection = readJsonIfExists(join(workflowDir, "cover-size-selection.json")) || coverDesign.coverSizeSelection || {};
  const canvas = inferCanvas(brief, contract, designPlan);
  const pages = arrayify(pageDecision.pages).length ? arrayify(pageDecision.pages) : arrayify(designPlan.pages);
  return {
    packageDir,
    workflowDir,
    brief,
    contract,
    designPlan,
    colorSystemPlan,
    motionPlan,
    layeredMotionPlan,
    motionStylePlan,
    captionPlan,
    mediaPlan,
    ipPlan,
    personalIpAssetRegistry,
    ipNativeJobs,
    pageDecision,
    runtimeConfig,
    captionStyles: arrayify(captionCatalog.styles),
    captionGroups: arrayify(captionCatalog.groups),
    motionStyleCatalog,
    motionStyleTemplateLibrary,
    motionTemplates: arrayify(motionRegistry.templates),
    motionCapabilities: motionCapabilityCatalog(),
    colorSystems: expandedColorSystems(),
    colorReferences: colorSystemReferences(),
    personalIpExamples: personalIpExamples(),
    personalIpPresetIdentities: personalIpPresetIdentities(),
    ipDiagramAssets: ipDiagramCreatorAssets(packageDir),
    whiteboardModule: whiteboardModule(),
    voiceModes: voiceModes(),
    coverDesign,
    coverImage2Prompts,
    coverSizeSelection,
    canvas,
    pages,
  };
}

function captionGroupLabel(group) {
  return {
    ui: "界面工具",
    editorial: "编辑叙事",
    kinetic: "节奏强调",
    glass: "玻璃质感",
    minimal: "极简清读",
    audio: "声音节奏",
    bilingual: "双语字幕",
    mobile: "移动端留存",
    quote: "引用强调",
    "data-evidence": "数据证据",
    "mobile-safe-retention": "移动端留存",
  }[group] || "其他字幕";
}

function captionGroupSortIndex(group) {
  const order = ["ui", "editorial", "kinetic", "glass", "minimal", "audio", "bilingual", "mobile", "quote", "data-evidence", "mobile-safe-retention"];
  const index = order.indexOf(group);
  return index === -1 ? order.length : index;
}

function captionGroupsFromStyles(styles) {
  return countBy(styles.map((style) => style.group))
    .map(([group, count]) => ({ group, labelZh: captionGroupLabel(group), count }))
    .sort((a, b) => captionGroupSortIndex(a.group) - captionGroupSortIndex(b.group) || a.labelZh.localeCompare(b.labelZh));
}

function motionStyleExampleCatalog() {
  return {
    "claim-split-reveal": {
      kind: "claim-split",
      contentType: "观点反差",
      previewTitle: "错觉 vs 证据",
      scenario: "先把错误直觉放在左侧，再用证据卡和结论章完成反转。",
      designIdea: "一页只解释一个认知冲突，视觉重心从左侧错误判断移动到右侧证据。",
    },
    "checkpoint-timeline": {
      kind: "process-timeline",
      contentType: "流程节点",
      previewTitle: "三步上线流程",
      scenario: "适合方法论、课程流程、操作步骤，节点按口播节拍逐个激活。",
      designIdea: "把流程做成可跟随的轨道，当前节点展开，非当前节点降低存在感。",
    },
    "proof-thread-board": {
      kind: "evidence-board",
      contentType: "证据推理",
      previewTitle: "线索证明板",
      scenario: "分散证据卡先出现，再用连线、焦点圈和结论卡解释关系。",
      designIdea: "模仿调查板的阅读顺序，观众先看到事实，再看到事实之间的因果。",
    },
    "product-state-cascade": {
      kind: "code-walkthrough",
      contentType: "代码演示",
      previewTitle: "代码执行流",
      scenario: "用于代码、脚本、产品自动化演示：代码高亮、运行状态和输出结果依次出现。",
      designIdea: "把代码页拆成 IDE、运行面板、结果卡三层，动效服务“看懂执行过程”。",
    },
    "data-curve-proof": {
      kind: "data-chart",
      contentType: "数据图表",
      previewTitle: "指标拐点证明",
      scenario: "坐标轴、曲线、拐点、结论标签依次展示，适合趋势与指标分析。",
      designIdea: "先建立数据语境，再追踪曲线，最后只高亮真正支持结论的点。",
    },
    "typed-opener-promise": {
      kind: "typed-thesis",
      contentType: "片头命题",
      previewTitle: "第一句承诺",
      scenario: "适合强观点开场或课程命题，短句打出后迅速进入正文画面。",
      designIdea: "减少装饰，靠打字停顿制造节奏；只保留一句可复述的承诺。",
    },
    "whiteboard-overlay-step": {
      kind: "whiteboard-method",
      contentType: "白板推演",
      previewTitle: "手绘步骤",
      scenario: "手绘箭头、圈画、下划线作为前景层叠在主页面之上。",
      designIdea: "白板只画语义前景，不重画完整页面；最终回填精确文字和颜色。",
    },
    "cover-continuity-bridge": {
      kind: "cover-bridge",
      contentType: "封面衔接",
      previewTitle: "封面到首帧",
      scenario: "封面主钩子延续到第一内容页，避免点击后视觉承诺断裂。",
      designIdea: "把封面里的主体、关键词或构图复用到首帧，形成连续的观看路径。",
    },
    "ip-presenter-board": {
      kind: "ip-knowledge-card",
      contentType: "个人 IP",
      previewTitle: "主讲人知识卡",
      scenario: "固定 IP 形象指向知识卡、执行角色或流程图，适合口播讲解。",
      designIdea: "角色必须参与解释，而不是装饰；动作、视线和手势都指向当前结论。",
    },
    "before-after-craft": {
      kind: "before-after",
      contentType: "前后对照",
      previewTitle: "优化前后",
      scenario: "左侧旧状态压低，右侧新状态逐步构建，适合改写、修复和优化。",
      designIdea: "差异点必须可见，观众能直接判断哪里变好了。",
    },
    "matrix-choice-map": {
      kind: "choice-matrix",
      contentType: "策略矩阵",
      previewTitle: "选型坐标",
      scenario: "二维矩阵展示选择逻辑，当前方案移动到目标象限。",
      designIdea: "轴标签短，选择点少，把判断依据放在象限而不是大段说明里。",
    },
    "dashboard-inspection": {
      kind: "dashboard-inspection",
      contentType: "仪表盘巡检",
      previewTitle: "运营指标巡检",
      scenario: "多个指标卡逐个聚焦，最后落到一个需要行动的状态。",
      designIdea: "让观众看到检查路径：从全局概览到关键指标，再到下一步动作。",
    },
    "formula-step-proof": {
      kind: "formula-derivation",
      contentType: "公式推导",
      previewTitle: "公式三步推导",
      scenario: "数学公式、规则或逻辑链拆成条件、变形、结果三步演示。",
      designIdea: "每一步只引入一个变化，箭头和高亮标出这一步到底改了什么。",
    },
    "story-pressure-line": {
      kind: "storyboard-pressure",
      contentType: "故事结构",
      previewTitle: "压力线推高",
      scenario: "人物目标、冲突压力、代价选择逐步被点亮。",
      designIdea: "故事页不堆剧情摘要，而是把冲突结构可视化成压力变化。",
    },
    "concept-orbit-system": {
      kind: "concept-orbit",
      contentType: "概念系统",
      previewTitle: "核心概念轨道",
      scenario: "核心概念居中，外围模块按轨道进入并建立关系。",
      designIdea: "适合抽象框架：先锁定核心，再解释模块之间的相对位置。",
    },
    "material-collage-focus": {
      kind: "material-collage",
      contentType: "素材选择",
      previewTitle: "素材池聚焦",
      scenario: "多个素材缩略片先铺开，再放大最能支撑结论的主素材。",
      designIdea: "让授权素材有筛选过程，避免画面变成无意义拼贴。",
    },
    "quote-emphasis-lockup": {
      kind: "quote-lockup",
      contentType: "金句强调",
      previewTitle: "关键词锁定",
      scenario: "一句话拆成片段，关键词先后强调，最终合成完整结论。",
      designIdea: "关键词不超过三个，用节奏和排版帮助记忆，而不是堆特效。",
    },
    "checklist-gate": {
      kind: "checklist-gate",
      contentType: "质量门禁",
      previewTitle: "通过 / 阻断",
      scenario: "每个条件通过后才打开下一步，适合检查清单、审核和发布门禁。",
      designIdea: "通过、警告、阻断要有不同状态，不能都画成普通列表。",
    },
    "journey-map-scan": {
      kind: "journey-map",
      contentType: "路径地图",
      previewTitle: "学习路径扫描",
      scenario: "路径从起点扫描到终点，当前节点展开一句说明。",
      designIdea: "把复杂路线变成可跟随地图，只有当前站点展开细节。",
    },
    "recap-payoff-loop": {
      kind: "recap-loop",
      contentType: "复盘闭环",
      previewTitle: "三证据合一",
      scenario: "回收前文三个证据，合成一个行动结论。",
      designIdea: "结尾只总结已出现内容，通过闭环箭头把前后叙事扣住。",
    },
    "ranking-table-system": {
      kind: "table-ranking",
      contentType: "排行表格",
      previewTitle: "Top 方案锁定",
      scenario: "表格按行扫描，排名、数值条和选择理由同时说明为什么第一名成立。",
      designIdea: "表格不是密密麻麻的信息墙；只展示能支撑当前结论的指标和选中依据。",
    },
    "geo-data-map": {
      kind: "geo-map",
      contentType: "地理地图",
      previewTitle: "区域指标定位",
      scenario: "先建立地图空间关系，再点亮目标区域和指标旁注。",
      designIdea: "地图只解释空间差异，重点区域用色块、连线和旁注成为当前句子的证据。",
    },
    "hierarchy-tree-map": {
      kind: "hierarchy-tree",
      contentType: "层级结构",
      previewTitle: "知识树展开",
      scenario: "根节点先出现，分支按层级展开，当前路径被高亮。",
      designIdea: "适合课程目录、组织结构和决策树：观众先看父子关系，再看当前路径。",
    },
    "network-relationship-map": {
      kind: "network-relationship",
      contentType: "关系网络",
      previewTitle: "主链路隔离",
      scenario: "节点按簇出现，讲到某个关系时只点亮对应边和主链路。",
      designIdea: "关系图要降低复杂度：让观众看到这条关系为什么重要，而不是看随机散点。",
    },
    "conversion-funnel-flow": {
      kind: "funnel-conversion",
      contentType: "转化漏斗",
      previewTitle: "流失点诊断",
      scenario: "漏斗按阶段收窄，流失比例和下一步动作同时呈现。",
      designIdea: "漏斗页必须讲清分母和损耗位置，不能只是漂亮的锥形图。",
    },
    "agent-simulation-lane": {
      kind: "agent-simulation",
      contentType: "协作流程",
      previewTitle: "并行泳道",
      scenario: "规划、配音、模板、验收任务卡沿泳道并行推进再汇合。",
      designIdea: "多角色协作页面要像运行图，职责、交接和合并结果都必须能看懂。",
    },
    "screenflow-demo-path": {
      kind: "screenflow-demo",
      contentType: "界面路径",
      previewTitle: "三屏操作流",
      scenario: "起始界面、点击焦点和完成状态连续切换。",
      designIdea: "产品页不堆 UI 截图，而是把一次真实操作路径压缩成可理解的状态迁移。",
    },
    "risk-alert-diagnosis": {
      kind: "risk-alert",
      contentType: "风险告警",
      previewTitle: "分诊到处理",
      scenario: "风险等级、影响范围、诊断线索和处理动作按顺序出现。",
      designIdea: "风险页要克制且准确：先定位影响，再给出控制动作，避免夸张红色堆砌。",
    },
    "source-citation-stack": {
      kind: "source-citation",
      contentType: "资料引用",
      previewTitle: "证据卡堆栈",
      scenario: "来源卡、短引用、解释和结论分层显示。",
      designIdea: "研究页把事实、短引用和推论拆开，观众能追溯结论来自哪里。",
    },
    "voice-waveform-sync": {
      kind: "voice-sync",
      contentType: "语音同步",
      previewTitle: "波形时间点对齐",
      scenario: "波形、字幕时间点、关键词高亮和声音模式在同一时间线上对齐。",
      designIdea: "语音页要展示“声音如何驱动画面”，而不是单独放一组声音选项。",
    },
    "comparison-gallery-wall": {
      kind: "comparison-gallery",
      contentType: "样张对比",
      previewTitle: "候选墙选优",
      scenario: "候选样张先铺开，选中样张放大，同时出现选择理由。",
      designIdea: "设计审核页要让差异可见，并说明为什么这个候选更适合当前内容。",
    },
    "calendar-timeline-board": {
      kind: "timeline-calendar",
      contentType: "日历事件",
      previewTitle: "截止点定位",
      scenario: "日历格和事件线并排展示，当前日期与关键截止点被标注。",
      designIdea: "时间页要使用真实或明确示例日期，避免把时间线画成无意义进度条。",
    },
  };
}

function ipDiagramMethodologyForStyle(example = {}, variant = {}) {
  const byKind = {
    "claim-split": ["大判断页", "定点聚焦", "左侧误区区 / 中央反转动作 / 右侧证据结论区", "不需要人物时不放人物；需要时只让主讲人指向反转点", "证据角色负责递交证据卡"],
    "process-timeline": ["路线页", "呼吸节奏", "顶部步骤轨道 / 当前节点展开 / 底部收束句安全区", "主讲人站在当前节点旁边做节奏引导", "2-4 个执行角色分别负责准备、生成、审核、合成"],
    "evidence-board": ["证明板页", "高密信息", "左右证据卡 / 中央连线 / 底部结论章", "主讲人只参与圈出因果线", "证据角色把卡片挂到证明路径上"],
    "code-walkthrough": ["演示页", "高密信息", "左侧代码编辑器 / 右侧运行状态 / 底部输出结果与字幕安全区", "人物可缩小到角落提示当前执行行", "调试角色负责检查输入、运行、输出"],
    "data-chart": ["数据页", "定点聚焦", "上方语境卡 / 中央坐标和曲线 / 右侧拐点解释", "数据页默认少放人物，必要时只做旁白指向", "指标角色负责标出拐点和样本"],
    "typed-thesis": ["命题页", "定点聚焦", "全屏短句 / 光标节奏 / 次级承诺贴片", "不放人物，避免削弱第一句冲击", "无执行角色"],
    "whiteboard-method": ["白板推演页", "呼吸节奏", "主页面留白 / 前景描线轨迹 / 回填彩色组件", "人物可和白板结合，做指向或圈画动作", "白板角色只画语义前景"],
    "cover-bridge": ["首帧承诺页", "定点聚焦", "封面主体复用 / 首帧内容卡 / 视觉承诺桥", "人物只在需要口播背书时出现", "承诺角色对齐封面与正文"],
    "ip-knowledge-card": ["个人 IP 知识卡页", "定点聚焦", "左侧固定人物 / 中央知识板 / 右侧执行角色或图解行动", "人物必须承担讲解、搬运、圈画或交接职责", "2-6 个执行角色做拆内容、找隐喻、查可读、补证据"],
    "before-after": ["前后对照页", "定点聚焦", "左旧状态 / 中央迁移动作 / 右新状态", "人物可执行搬运或修复动作", "修复角色负责标出变化点"],
    "choice-matrix": ["决策坐标页", "高密信息", "二维坐标 / 方案点 / 目标象限解释", "人物只做决策指向，不遮挡坐标轴", "选择角色给出依据和风险"],
    "dashboard-inspection": ["巡检页", "高密信息", "顶部指标卡 / 中央焦点面板 / 底部行动条", "人物缩小到角落做巡检旁白", "巡检角色逐项检查异常"],
    "formula-derivation": ["推导页", "呼吸节奏", "左侧条件 / 中间变形步骤 / 右侧结果锁定", "人物可指向当前变形，不参与计算本身", "推导角色逐步移动项并保留依据"],
    "storyboard-pressure": ["故事压力页", "定点聚焦", "三格故事板 / 压力曲线 / 选择代价标记", "人物不替代故事角色，只做结构讲解", "结构角色标记目标、冲突、代价"],
    "concept-orbit": ["概念系统页", "呼吸节奏", "中心概念 / 外围模块轨道 / 关系线", "人物可站在中心外侧解释模块关系", "模块角色负责守住各自边界"],
    "material-collage": ["素材筛选页", "高密信息", "左侧素材池 / 中央筛选动作 / 右侧主素材放大", "人物可做筛选动作并保留授权语境", "素材角色负责排序、裁剪、合规"],
    "quote-lockup": ["金句页", "定点聚焦", "短句分片 / 关键词锁定 / 底部回收结论", "通常不放人物，保留文字节奏", "无执行角色"],
    "checklist-gate": ["门禁页", "高密信息", "左侧条件清单 / 右侧开关门 / 底部阻断原因", "人物可指向未通过项", "审核角色逐项放行或阻断"],
    "journey-map": ["路径地图页", "呼吸节奏", "路径曲线 / 当前站点卡 / 下个行动标记", "人物作为路线讲解员站在当前节点旁", "路线角色分别负责阶段目标"],
    "recap-loop": ["复盘闭环页", "定点聚焦", "三证据回收 / 中央闭环箭头 / 行动结论卡", "人物只做收束动作", "收束角色回收前文证据"],
    "table-ranking": ["排行表页", "高密信息", "排名徽章 / 指标列 / 数值条 / 选中理由", "人物通常不出现，必要时只指向冠军行", "排行角色负责口径、分母和并列规则"],
    "geo-map": ["地理地图页", "定点聚焦", "地图轮廓 / 区域点亮 / 指标旁注 / 来源脚注", "人物不遮挡地图，只在旁边解释空间差异", "空间角色负责边界、区域来源和示意/真实标记"],
    "hierarchy-tree": ["层级树页", "呼吸节奏", "根节点 / 二级分支 / 当前路径 / 结论卡", "人物只指向当前分支，不遮挡树结构", "结构角色守住父子关系和层级深度"],
    "network-relationship": ["关系网络页", "高密信息", "节点簇 / 关系线 / 主链路 / 解释旁注", "人物可作为讲解者，不参与网络节点", "关系角色负责方向、关系含义和置信边界"],
    "funnel-conversion": ["转化漏斗页", "定点聚焦", "阶段漏斗 / 转化率 / 流失点 / 行动建议", "人物可指向流失段，不能遮挡分母", "增长角色负责分母、阶段口径和下一步动作"],
    "agent-simulation": ["协作泳道页", "高密信息", "并行泳道 / 任务卡 / 交接箭头 / 合并输出", "人物可作为主讲人，执行角色卡承担动作", "各执行角色只做自己的输入、输出和交接"],
    "screenflow-demo": ["界面路径页", "定点聚焦", "起始屏 / 光标焦点 / 状态迁移 / 完成徽章", "人物默认不出现，保持界面连续性", "产品角色负责真实/示意状态和操作路径"],
    "risk-alert": ["风险诊断页", "定点聚焦", "风险等级 / 影响范围 / 诊断线索 / 处理动作", "人物可提醒风险，但不能夸张化", "风险角色负责严重性、影响面和处理动作"],
    "source-citation": ["资料引用页", "高密信息", "来源卡 / 短引用 / 解释层 / 结论章", "人物可做资料翻阅动作，但不替代引用卡", "研究角色负责事实、引用边界和推论边界"],
    "voice-sync": ["语音同步页", "呼吸节奏", "波形 / 字幕时间点 / 关键词高亮 / 声音模式", "人物可作为口播头像，但不遮挡时间点块", "语音时间角色负责语言、方言、性别和字幕时间点"],
    "comparison-gallery": ["样张对比页", "高密信息", "候选墙 / 选中大图 / 理由条 / 淘汰原因", "人物可作为审核者，不能盖住候选图", "设计角色负责差异、选择理由和拒绝项"],
    "timeline-calendar": ["日历事件页", "呼吸节奏", "日历格 / 事件线 / 当前日期 / 截止点旁注", "人物可提示日期，不取代日历标注", "时间角色负责绝对日期和事件顺序"],
  };
  const [pageCardType, visualWeight, layoutBlueprint, rolePlan, agentPolicy] = byKind[example.kind] || byKind["claim-split"];
  const variantMethod = {
    "calm-premium": "留白优先，动作更慢，适合讲方法和结论。",
    "editorial-contrast": "大黑白对比和裁切感，适合强观点或反转。",
    "glass-product": "半透明产品层和状态层，适合工具、SaaS、流程演示。",
    "warm-paper": "纸面手绘感更强，适合白板、课程和个人 IP。",
    "bright-clean": "高明度彩色节点，适合轻知识、社媒和移动端。",
  }[variant.id] || "按内容结构决定动效节奏。";
  return {
    methodologySource: "ip-diagram-creator-inspired-page-director",
    pageCardType,
    visualWeight,
    layoutBlueprint,
    rolePlan,
    agentPolicy,
    textOwnership: "final readable Chinese text stays in deterministic HTML/SVG/CSS layers",
    motionFusion: [
      "先显露页面骨架",
      "再按口播单元激活当前结构",
      "最后锁定结论并保留字幕安全区",
    ],
    variantMethod,
  };
}

function motionStyleExampleForFamily(family, familyIndex, variant, variantIndex) {
  const catalog = motionStyleExampleCatalog();
  const examples = Object.values(catalog);
  const example = catalog[family.id] || examples[familyIndex % examples.length];
  const methodology = ipDiagramMethodologyForStyle(example, variant);
  return {
    ...example,
    ...methodology,
    variantTone: variant.labelZh || variant.id,
    variantDensity: variant.density || "medium",
    reviewTag: `${example.contentType} / ${variant.labelZh || variant.id}`,
    choreography: [
      arrayify(family.animationSteps)[0] || "结构入场",
      arrayify(family.animationSteps)[1] || "语义高亮",
      arrayify(family.animationSteps)[2] || "结论锁定",
    ],
    reviewIndex: familyIndex * 10 + variantIndex + 1,
  };
}

function expandMotionStyleCatalogForConfig(catalog = {}) {
  const families = arrayify(catalog.families);
  const variants = arrayify(catalog.variants);
  return families.flatMap((family, familyIndex) => variants.map((variant, variantIndex) => {
    const example = motionStyleExampleForFamily(family, familyIndex, variant, variantIndex);
    return {
      id: `${family.id}--${variant.id}`,
      familyIndex,
      variantIndex,
      familyId: family.id,
      familyLabelZh: family.labelZh,
      variantId: variant.id,
      variantLabelZh: variant.labelZh,
      baseTemplate: family.baseTemplate,
      motionVerbs: arrayify(family.motionVerbs),
      bestFor: arrayify(family.bestFor),
      layoutIntent: family.layoutIntent,
      visualHierarchy: family.visualHierarchy,
      interactionFeeling: family.interactionFeeling,
      animationSteps: arrayify(family.animationSteps),
      guardrails: arrayify(family.guardrails),
      density: variant.density,
      camera: variant.camera,
      paletteBehavior: variant.paletteBehavior,
      timingProfile: variant.timingProfile,
      captionSafeArea: variant.captionSafeArea || "bottom-caption-band",
      pageCardType: example.pageCardType,
      visualWeight: example.visualWeight,
      layoutBlueprint: example.layoutBlueprint,
      rolePlan: example.rolePlan,
      agentPolicy: example.agentPolicy,
      textOwnership: example.textOwnership,
      motionFusion: example.motionFusion,
      methodologySource: example.methodologySource,
      variantMethod: example.variantMethod,
      benchmarkContract: {
        externalReferences: [
          { name: "Apple HIG Motion" },
          { name: "Material Motion" },
          { name: "GSAP CSS motion" },
          { name: "FT Visual Vocabulary / Observable Plot" },
          { name: "Manim Transform" },
        ],
        horizontalComparisonRule: "小图和大图共享同一语义 markup，按内容类型对应横向参考进行审美和动效校验。",
      },
      example,
    };
  }));
}

function coverStylePresets(coverDesign = {}) {
  const selectedTemplate = readableInline(coverDesign.masterCoverConcept?.compositionTemplate || coverDesign.compositionTemplate || "").toLowerCase();
  const presets = [
    {
      id: "problem-to-proof",
      label: "问题到证明",
      description: "把用户痛点、错误路径和最终证明放在同一张封面里，适合方法论和工具改造。",
      logic: "先击中问题，再展示可验证结果。",
      composition: "左侧大钩子，中间失败稿与箭头，右侧结果证明板，底部 4-6 个方法珠。",
      bestFor: ["知识方法论", "产品能力", "工作流优化"],
      headlineSystem: "4-8 字强钩子 + 一句结果承诺",
      accent: "#c45b3a",
      aliases: ["problem-to-proof transformation cover", "transformation", "问题到证明"],
    },
    {
      id: "method-roadmap",
      label: "方法路线图",
      description: "用路径、节点和终点样张表达“照着做就能完成”的稳定感。",
      logic: "把抽象能力拆成可执行路径。",
      composition: "左侧混乱输入，中部路线节点，右侧完成态样张，节点间有推进动线。",
      bestFor: ["教程", "课程", "规划流程"],
      headlineSystem: "结果名 + 步骤感副标题",
      accent: "#4d7b6f",
      aliases: ["method-roadmap cover", "roadmap", "路线图"],
    },
    {
      id: "misdirection-reveal",
      label: "反差揭示",
      description: "先展示错误直觉，再用撕开、聚光或封条揭示真正原因。",
      logic: "用认知反差制造点击缺口。",
      composition: "左右对比或上下遮罩，错误面被压暗，真相区高亮并带揭示动效。",
      bestFor: ["观点反转", "误区解释", "行业真相"],
      headlineSystem: "不是 X，而是 Y",
      accent: "#b08a32",
      aliases: ["misdirection-reveal contrast cover", "reveal", "反差"],
    },
    {
      id: "ledger-payoff",
      label: "账本兑现",
      description: "用账本、勾选、票据和兑现章把承诺、证据和结果绑定起来。",
      logic: "让承诺看起来可核算、可兑现。",
      composition: "中心账本或清单，左右是投入/收益证据，右下角给兑现章或结果票据。",
      bestFor: ["复盘", "数据证明", "清单交付"],
      headlineSystem: "这笔账终于算清",
      accent: "#58724c",
      aliases: ["ledger-payoff reveal cover", "payoff", "账本"],
    },
    {
      id: "character-pressure",
      label: "人物压力",
      description: "让人物、障碍和选择压力成为第一视觉，适合个人 IP 口播和故事化内容。",
      logic: "用人物状态承载情绪和冲突。",
      composition: "人物占主视觉三分之一，压力线/障碍物压近，文字绕开面部和手势。",
      bestFor: ["个人 IP", "故事观点", "情绪钩子"],
      headlineSystem: "短钩子贴近人物视线",
      accent: "#8f5f9b",
      aliases: ["character-pressure cover", "character", "人物"],
    },
    {
      id: "before-after-craft",
      label: "前后对照",
      description: "把弱版本和高质量版本放在同屏，差异由批注、放大镜和校正线解释。",
      logic: "用前后差异证明方法有效。",
      composition: "左弱右强或上弱下强，中央放大镜/批改线连接关键差异。",
      bestFor: ["案例拆解", "改稿", "设计优化"],
      headlineSystem: "改前改后 + 一句方法点",
      accent: "#2f82a2",
      aliases: ["before-after craft cover", "before after", "前后"],
    },
    {
      id: "product-console-proof",
      label: "产品控制台证明",
      description: "把真实产品能力拆成控制台、预览窗和结果状态，适合平台/工具介绍。",
      logic: "用可操作界面证明能力不是口号。",
      composition: "大预览图占 60%，右侧状态面板列出生成链路，主标题贴近预览的关键变化。",
      bestFor: ["SaaS", "AI 工具", "内部平台"],
      headlineSystem: "能力结果 + 稳定证据",
      accent: "#315f7d",
      aliases: ["console", "product", "工具"],
    },
    {
      id: "creator-ip-teaching",
      label: "个人 IP 教学",
      description: "用固定主讲形象、知识卡和手绘标注建立系列辨识度。",
      logic: "用同一人设承接长期内容信任。",
      composition: "人物在左下或右下，知识板居中，手绘箭头连接问题、方法和结论。",
      bestFor: ["口播教学", "知识 IP", "课程页"],
      headlineSystem: "人物视角一句话 + 卡片结论",
      accent: "#b36f3d",
      aliases: ["ip", "persona", "个人"],
    },
    {
      id: "whiteboard-diagram-reveal",
      label: "白板图解揭示",
      description: "让线稿、圈画、箭头和关键节点组成一张可读的白板封面。",
      logic: "用绘制过程感暗示内容会被讲清楚。",
      composition: "白板底图承载结构，彩色重点只落在 2-3 个关键节点。",
      bestFor: ["白板绘制", "流程解释", "知识图谱"],
      headlineSystem: "问题词加手绘下划线",
      accent: "#d77842",
      aliases: ["whiteboard", "diagram", "白板"],
    },
    {
      id: "data-evidence-shock",
      label: "数据证据冲击",
      description: "用一张曲线、排行榜或指标卡制造可信冲击，而不是堆图表。",
      logic: "一个关键数字解释为什么值得点开。",
      composition: "数据图占背景中轴，主数字压前景，结论标签与异常点绑定。",
      bestFor: ["数据分析", "趋势", "行业判断"],
      headlineSystem: "数字 + 结论冲突",
      accent: "#2f6c91",
      aliases: ["data", "chart", "数据"],
    },
    {
      id: "workflow-stack",
      label: "全链路证据栈",
      description: "把脚本、封面、页面、字幕、合成和 QC 组织成有层级的证据栈。",
      logic: "让复杂流程在一秒内看出闭环。",
      composition: "中心堆叠式层级，前景突出最终成片，边缘只保留必要节点。",
      bestFor: ["复杂系统", "生成工作流", "能力验证"],
      headlineSystem: "闭环承诺 + 最终结果",
      accent: "#526a51",
      aliases: ["workflow", "stack", "证据栈"],
    },
    {
      id: "platform-native-hook",
      label: "平台原生强钩子",
      description: "按 YouTube/B站/短视频缩略图习惯强化大字、主体和小图可读性。",
      logic: "先适配平台点击环境，再做视觉精修。",
      composition: "一主标题、一主体、一信号，边缘留足裁切安全区，避免内部流程标签。",
      bestFor: ["跨平台发布", "短视频封面", "移动端搜索"],
      headlineSystem: "平台原生大字贴纸",
      accent: "#b94e48",
      aliases: ["platform", "youtube", "bilibili", "平台"],
    },
  ];
  const selectedIndex = Math.max(0, presets.findIndex((preset) => {
    const tokens = [preset.id, preset.label, ...arrayify(preset.aliases)].map((token) => String(token).toLowerCase());
    return tokens.some((token) => selectedTemplate.includes(token));
  }));
  return presets.map((preset, index) => ({
    ...preset,
    selected: index === selectedIndex,
  }));
}

function coverShowcaseExample(coverDesign = {}) {
  return {
    title: coverDesign.coverTitle || "高点击量视频封面设计方法论",
    coverTitle: coverDesign.hookText || "高点击封面公式",
    topicType: coverDesign.contentCategoryStrategy || "知识科普 / 创作方法论 / 封面点击率",
    audience: "想提升视频点击率的 B站、抖音、YouTube 内容创作者",
    hookText: coverDesign.hookText || "高点击封面公式",
    payoffText: coverDesign.payoffText || "普通封面 vs 高点击封面",
    viewerPain: "创作者不知道为什么自己的封面没人点，或者只会换颜色而没有点击逻辑。",
    resultPromise: coverDesign.coverPromise || "用方法论拆解为什么有些封面让人忍不住点开，并展示普通封面和高点击封面的差异。",
    contrarianPoint: "封面不是配置页、工作流证据板或 PPT 标题卡，而是观众的一秒点击决策面。",
    visualMetaphor: "知识博主人物、巨大标题、改前改后封面对比卡、点击率增长箭头。",
    credibleEvidence: "点击率 2.1% vs 11.3%、红叉、对勾、黄色增长箭头、方法论编号角标。",
    methodSteps: ["主题定位", "视觉钩子", "改前改后", "小图测试", "平台适配", "最终封面"],
  };
}

function coverEntryUploadReady(entry = {}) {
  const selectedAsset = entry.selectedAsset || {};
  const evidence = [
    entry.qualityStatus,
    selectedAsset.mode,
    selectedAsset.provider,
    selectedAsset.status,
  ].map((value) => String(value || "")).join(" ").toLowerCase();
  if (entry.uploadReady !== true || entry.needsRegeneration === true) return false;
  if (/review-only|preview|fallback|prompt|local-preview|local-target|dry-run|svg/.test(evidence)) return false;
  return /upload-ready-native-target-ratio|image2-integrated-typography-cover|codex built-in image_gen|gpt image 2|gpt-image-2/.test(evidence);
}

function coverResolutionOptions(coverDesign = {}, coverSizeSelection = {}) {
  const entries = arrayify(coverSizeSelection.entries);
  const byId = new Map(entries.map((entry) => [entry.id || entry.targetId, entry]));
  const presets = arrayify(coverDesign.resolutionPresets);
  const source = presets.length ? presets : entries;
  return source.map((item, index) => {
    const entry = byId.get(item.id || item.targetId) || item;
    const width = Number(item.width || entry.width || 0);
    const height = Number(item.height || entry.height || 0);
    const ratio = item.ratio || entry.ratio || (width && height ? `${width}:${height}` : "");
    const id = item.id || entry.id || entry.targetId || `cover-size-${index + 1}`;
    const group = entry.group || coverResolutionGroupLabel(id) || item.platform || "封面尺寸";
    return {
      id,
      label: entry.labelZh || group,
      platform: item.platform || entry.platform || group,
      group,
      width,
      height,
      ratio,
      file: item.file || entry.file || "",
      uploadReady: coverEntryUploadReady(entry),
      qualityStatus: entry.qualityStatus || "",
      selectedAsset: entry.selectedAsset || null,
      usage: item.usage || entry.usage || "",
      selected: true,
    };
  });
}

function coverResolutionGroupLabel(id = "") {
  const labels = {
    "video-opening": "视频内封面",
    "master-16x9-4k": "横版16比9 · 4K母版",
    "youtube-1280x720": "YouTube 16比9常用",
    "horizontal-4x3-1600x1200": "横版4比3",
    "bilibili-common-1146x717": "B站常用1146x717",
    "bilibili-1920x1080": "B站 / 横版HD",
    "vertical-1080x1920": "竖版9比16",
    "vertical-profile-1080x1440": "竖版3比4主页",
    "instagram-reels-cover": "Reels主页封面",
    "square-1200x1200": "方形1比1",
  };
  return labels[id] || "";
}

function isImageFile(path) {
  return /\.(png|jpe?g|webp|svg)$/i.test(path || "");
}

function coverFileStem(file) {
  const base = basename(file || "");
  return base ? base.slice(0, base.length - extname(base).length).toLowerCase() : "";
}

function coverSampleLabel(file) {
  const name = basename(file).replace(/\.(png|jpe?g|webp|svg)$/i, "");
  return name
    .replace(/^cover-/, "")
    .replace(/-/g, " ")
    .replace(/\b(\d+x\d+)\b/g, " $1 ")
    .trim();
}

function collectCoverSamples({ packageDir, outPath, coverDesign = {}, coverSizeSelection = {} } = {}) {
  const candidates = [];
  const push = (file, label = "", meta = "", options = {}) => {
    if (!file || !isImageFile(file)) return;
    const absolute = resolve(packageDir, file);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) return;
    candidates.push({
      file,
      absolute,
      label: label || coverSampleLabel(file),
      meta,
      uploadReady: options.uploadReady === true,
      qualityStatus: options.qualityStatus || "",
    });
  };
  push(coverDesign.videoInternalCover?.file, "视频内封面", "16:9 opening frame");
  for (const target of arrayify(coverDesign.platformTargets)) {
    push(target.file, target.platform || target.id || "", target.ratio || "");
  }
  for (const variant of arrayify(coverDesign.platformVariants)) {
    push(variant.file, variant.platform || variant.id || "", variant.ratio || "");
  }
  for (const entry of arrayify(coverSizeSelection.entries)) {
    if (!coverEntryUploadReady(entry)) continue;
    push(
      entry.file,
      entry.labelZh || entry.id || "",
      `${entry.width || ""}x${entry.height || ""} · 上传就绪`,
      {
        uploadReady: true,
        qualityStatus: entry.qualityStatus || "",
      },
    );
  }
  const coverDir = join(packageDir, "cover");
  if (existsSync(coverDir)) {
    for (const item of readdirSync(coverDir).sort()) {
      const isFeatured = /high[-_ ]?click|imagegen|upload[-_ ]?cover|thumbnail/i.test(item);
      if (!isFeatured) continue;
      const featuredLabel = /9x16|vertical|short|reels|douyin|tiktok/i.test(item)
        ? "短视频竖版提示词封面"
        : /youtube|bilibili|16x9|horizontal/i.test(item)
          ? "B站/YouTube 提示词封面"
          : "高点击封面样例";
      const featuredMeta = /9x16|vertical|short|reels|douyin|tiktok/i.test(item)
        ? "ImageGen bitmap · 9:16 review sample"
        : "ImageGen bitmap · 16:9 review sample";
      push(
        `cover/${item}`,
        isFeatured ? featuredLabel : "",
        isFeatured ? featuredMeta : "",
        { uploadReady: true, qualityStatus: "imagegen-review-sample" },
      );
    }
  }
  const seen = new Set();
  return candidates
    .sort((a, b) => {
      const score = (item) => /\.(png|jpe?g)$/i.test(item.file) ? 0 : /\.webp$/i.test(item.file) ? 1 : 2;
      return score(a) - score(b) || a.file.localeCompare(b.file);
    })
    .filter((item) => {
      const stem = item.file.replace(/\.(png|jpe?g|webp|svg)$/i, "");
      const preferredKey = stem;
      if (seen.has(preferredKey)) return false;
      seen.add(preferredKey);
      return true;
    })
    .slice(0, 64)
    .map((item, index) => ({
      id: `cover-sample-${index + 1}`,
      file: item.file,
      stem: coverFileStem(item.file),
      label: item.label,
      meta: item.meta || coverSampleLabel(item.file),
      uploadReady: item.uploadReady === true,
      qualityStatus: item.qualityStatus || "",
      html: htmlRelativePath(outPath, item.absolute),
    }));
}

function coverResolutionSlides({ samples = [], resolutionOptions = [] } = {}) {
  const samplePool = arrayify(samples);
  const options = arrayify(resolutionOptions);
  const byStem = new Map();
  const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
  samplePool.forEach((sample) => {
    const stem = coverFileStem(sample.file || sample.stem || "");
    if (stem && !byStem.has(stem)) byStem.set(stem, sample);
  });
  const pickSample = (option) => {
    const exactStem = coverFileStem(option.file || "");
    if (exactStem && byStem.has(exactStem)) return byStem.get(exactStem);
    const dimension = option.width && option.height ? `${option.width}x${option.height}` : "";
    const optionTokens = [
      option.id,
      option.label,
      option.group,
      option.platform,
      dimension,
      option.ratio,
      basename(option.file || ""),
    ].map(normalize).filter(Boolean);
    const sameTarget = samplePool.find((candidate) => {
      const haystack = normalize(`${candidate.file} ${candidate.label} ${candidate.meta}`);
      return optionTokens.some((token) => token && haystack.includes(token));
    });
    return sameTarget || null;
  };
  return options.map((option, index) => {
    const sample = pickSample(option);
    const uploadReady = option.uploadReady === true;
    return {
      id: option.id || sample?.id || `cover-resolution-slide-${index + 1}`,
      sampleId: sample?.id || "",
      label: option.label || sample?.label || `封面尺寸 ${index + 1}`,
      group: option.group || "封面尺寸",
      platform: option.platform || option.group || "",
      width: Number(option.width || 0),
      height: Number(option.height || 0),
      ratio: option.ratio || "",
      uploadReady,
      qualityStatus: option.qualityStatus || "",
      usage: option.usage || "",
      file: sample?.file || option.file || "",
      html: sample?.html || "",
      meta: sample?.meta || (option.width && option.height ? `${option.width}x${option.height}` : option.ratio || ""),
      exactTargetPreview: Boolean(uploadReady && sample && coverFileStem(sample.file) === coverFileStem(option.file)),
    };
  });
}

function coverFinalPreviewSample({ samples = [], resolutionSlides = [] } = {}) {
  const pool = arrayify(samples).filter((sample) => sample.uploadReady === true);
  const readySlides = arrayify(resolutionSlides).filter((slide) => slide.uploadReady === true && slide.html);
  const targetSlide = readySlides.find((slide) => slide.exactTargetPreview)
    || readySlides.find((slide) => /video-opening|16x9|youtube|bilibili/i.test(`${slide.id || ""} ${slide.file || ""} ${slide.label || ""}`))
    || readySlides[0];
  if (targetSlide?.html) {
    return {
      id: "final-cover-preview",
      label: targetSlide.label || "最终封面预览",
      group: targetSlide.group || "默认封面",
      platform: targetSlide.platform || "上传封面",
      width: Number(targetSlide.width || 0),
      height: Number(targetSlide.height || 0),
      ratio: targetSlide.ratio || "",
      uploadReady: true,
      file: targetSlide.file || "",
      html: targetSlide.html,
      meta: coverSlideMeta(targetSlide),
      exactTargetPreview: Boolean(targetSlide.exactTargetPreview),
    };
  }
  const preferred = [
    /cover-00-high-click-imagegen-16x9\.(png|jpe?g|webp)$/i,
    /high[-_ ]?click[-_ ]?prompt[-_ ]?youtube[-_ ]?bilibili[-_ ]?16x9\.(png|jpe?g|webp)$/i,
    /high[-_ ]?click[\s\S]*16x9\.(png|jpe?g|webp)$/i,
    /imagegen[\s\S]*16x9\.(png|jpe?g|webp)$/i,
    /cover-00-high-click-formula-youtube-bilibili-16x9\.(png|jpe?g|webp)$/i,
    /cover-00-0-high-click-prompt-youtube-bilibili-16x9\.(png|jpe?g|webp)$/i,
  ];
  const matches = (sample, pattern) => {
    const fields = [sample.file, sample.html, sample.label, sample.meta].filter(Boolean);
    return fields.some((field) => pattern.test(field));
  };
  const selected = preferred
    .map((pattern) => pool.find((sample) => matches(sample, pattern)))
    .find(Boolean)
    || pool.find((sample) => /high[-_ ]?click|imagegen|image2|thumbnail/i.test(`${sample.file} ${sample.label} ${sample.meta}`))
    || {};
  if (!selected.html) return null;
  return {
    id: "final-cover-preview",
    label: "最终封面预览",
    group: "默认封面",
    platform: "上传封面",
    width: Number(selected.width || 0),
    height: Number(selected.height || 0),
    ratio: selected.ratio || "",
    uploadReady: selected.uploadReady !== false,
    file: selected.file || "",
    html: selected.html,
    meta: selected.meta || selected.file || "高点击封面样例",
    exactTargetPreview: Boolean(selected.exactTargetPreview),
  };
}

function coverImage2PromptCount(coverDesign = {}, coverImage2Prompts = {}) {
  if (Array.isArray(coverDesign.image2CoverPrompts)) return coverDesign.image2CoverPrompts.length;
  if (Array.isArray(coverImage2Prompts.prompts)) return coverImage2Prompts.prompts.length;
  if (Array.isArray(coverImage2Prompts.image2CoverPrompts)) return coverImage2Prompts.image2CoverPrompts.length;
  if (Array.isArray(coverImage2Prompts.items)) return coverImage2Prompts.items.length;
  return 0;
}

function coverImage2Status({ coverDesign = {}, coverImage2Prompts = {}, imageSource = "image2-dryrun" } = {}) {
  const promptCount = coverImage2PromptCount(coverDesign, coverImage2Prompts);
  const readiness = coverDesign.thumbnailReadiness || {};
  const reviewFallbackOnly = Boolean(
    readiness.reviewFallbackOnly
    ?? coverImage2Prompts.reviewFallbackOnly
    ?? coverDesign.coverImage2Qc?.reviewFallbackOnly
  );
  const finalCoverQualityEligible = Boolean(
    readiness.finalCoverQualityEligible
    ?? coverImage2Prompts.finalCoverQualityEligible
    ?? coverDesign.coverImage2Qc?.finalCoverQualityEligible
  );
  const promptQualityPass = Boolean(
    readiness.promptQualityPass
    ?? coverImage2Prompts.promptQualityPass
    ?? coverDesign.coverImage2Qc?.promptQualityPass
  );
  const defaultCoverEngine = coverDesign.defaultCoverEngine || coverImage2Prompts.defaultCoverEngine || "image2-integrated-typography-cover";
  const assetEvidence = [
    coverDesign.selectedCoverAsset,
    ...(arrayify(coverDesign.selectedCoverAssets)),
    coverImage2Prompts.selectedCoverAsset,
    ...(arrayify(coverImage2Prompts.selectedCoverAssets)),
  ].filter(Boolean).map((asset) => [
    asset.provider,
    asset.mode,
    asset.status,
    asset.file,
  ].map((value) => String(value || "")).join(" ").toLowerCase()).join(" ");
  const hasGeneratedBitmapEvidence = finalCoverQualityEligible
    && !reviewFallbackOnly
    && /codex built-in image_gen|gpt image 2|gpt-image-2|image2-integrated-typography-cover/.test(assetEvidence)
    && !/review-only|fallback|local-preview|prompt-pending/.test(assetEvidence);
  const realBitmapProviderActive = ["image2", "codex-builtin"].includes(imageSource) || hasGeneratedBitmapEvidence;
  let status = "dry-run-prompt-package";
  let label = "仅提示词与降级预览";
  let guidance = "当前未接入真实图片生成源；页面中的封面图只能作为审阅占位，不能代表最终 Image2 封面效果。";
  if (realBitmapProviderActive && finalCoverQualityEligible && !reviewFallbackOnly) {
    status = "image2-cover-ready";
    label = "真实图片封面已就绪";
    guidance = "当前封面可进入人工审阅与平台尺寸选择。";
  } else if (realBitmapProviderActive) {
    status = "image2-source-active-needs-review";
    label = "图片源已接入，仍需封面终审";
    guidance = "已使用图片源参与封面链路，但仍需检查文字、尺寸和平台适配状态。";
  }
  return {
    status,
    label,
    guidance,
    imageSource,
    defaultCoverEngine,
    promptCount,
    promptQualityPass,
    finalCoverQualityEligible,
    reviewFallbackOnly,
    realBitmapProviderActive,
    hasGeneratedBitmapEvidence,
    promptSource: "workflow/cover-image2-prompts.json",
    designSource: "workflow/cover-design.json",
    productionHint: imageSource === "image2-dryrun" && !hasGeneratedBitmapEvidence
      ? "生产封面需改用 --image-source image2，或先用 Codex image_gen 生成项目内封面资产后以 --image-source codex-builtin --codex-image-assets-dir <dir> 接入。"
      : "",
  };
}

function firstFilled(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "object" && Object.keys(value).length) return value;
  }
  return "";
}

function readableInline(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).replace(/\s+/g, " ").trim();
  }
  if (Array.isArray(value)) return value.map(readableInline).filter(Boolean).join(" / ");
  if (typeof value === "object") {
    const preferred = [
      value.strategy,
      value.decisionSurface,
      value.clickLogic,
      value.layoutBias,
      value.safeArea,
      value.firstRead,
      value.secondRead,
      value.reject,
      value.description,
      value.labelZh,
      value.label,
      value.id,
    ].map(readableInline).filter(Boolean);
    if (preferred.length) return preferred.slice(0, 4).join(" / ");
    return Object.values(value).map(readableInline).filter(Boolean).slice(0, 4).join(" / ");
  }
  return "";
}

function coverCreativeStrategy({ coverDesign = {}, coverImage2Prompts = {}, brief = {}, image2Status = {} } = {}) {
  const sourceStrategy = coverDesign.coverCreativeStrategy || {};
  const sourceAssets = sourceStrategy.contentAssets || {};
  const master = coverDesign.masterCoverConcept || {};
  const title = firstFilled(coverDesign.coverTitle, master.coverTitle, brief.title, brief.topic, "视频自动生成工作流");
  const promise = firstFilled(coverDesign.coverPromise, master.coverPromise, master.sharedPromise, brief.title, "让视频页面从配置到合成都可控、可审阅、可验证");
  const hook = firstFilled(coverDesign.hookText, sourceStrategy.copywriting?.hookText, master.hookText, "别再堆模板");
  const payoff = firstFilled(coverDesign.payoffText, sourceStrategy.copywriting?.payoffText, master.payoffText, "一页就看懂生成质量");
  const visualSubject = firstFilled(
    coverDesign.visualSubject,
    sourceAssets.visualMetaphor,
    master.visualSubject,
    "左侧失败模板、右侧高质量视频页和中间的生成箭头"
  );
  const credibleEvidence = firstFilled(
    sourceAssets.credibleEvidence,
    coverDesign.credibleEvidence,
    master.credibleEvidence,
    "风格模板、封面、字幕、动效和素材能力都进入同一套页面审核"
  );
  const selectedTemplate = firstFilled(master.compositionTemplate, coverDesign.compositionTemplate, "problem-to-proof transformation cover");
  const platformStrategies = arrayify(coverDesign.platformCoverStrategies || coverDesign.platformTargets).slice(0, 4);
  const visualHierarchy = arrayify(sourceStrategy.visualHierarchy).length
    ? arrayify(sourceStrategy.visualHierarchy)
    : [
      `主钩子：${hook}`,
      `视觉主体：${visualSubject}`,
      `可信证据：${credibleEvidence}`,
    ];
  const qaChecklist = arrayify(sourceStrategy.qaChecklist).length
    ? arrayify(sourceStrategy.qaChecklist)
    : [
      "120-180px 小图仍能读出主钩子",
      "不重复完整视频标题，不像 PPT 标题页",
      "封面承诺能在第一屏内容中兑现",
      "只保留 2-3 个主要视觉元素",
    ];
  return {
    contentAssets: {
      coreViewpoint: firstFilled(sourceAssets.coreViewpoint, master.coreViewpoint, promise),
      userPain: firstFilled(sourceAssets.userPain, coverDesign.userPain, "用户看不出页面质量，只能凭感觉选择"),
      resultPromise: firstFilled(sourceAssets.resultPromise, promise),
      contrarianPoint: firstFilled(sourceAssets.contrarianPoint, coverDesign.curiosityGap, master.curiosityGap, "真正该自动的是审美与页面规划，而不是让用户逐项猜"),
      visualMetaphor: visualSubject,
      credibleEvidence,
    },
    clickMotivation: firstFilled(sourceStrategy.clickMotivation, coverDesign.clickMotivation, "result-method"),
    copywriting: {
      hookText: hook,
      payoffText: payoff,
      titleComplementRule: "封面主钩子补足标题的点击理由，不把完整标题当 PPT 标题粘上去。",
    },
    selectedTemplate,
    compositionReason: firstFilled(master.compositionReason, coverDesign.compositionReason, "当前任务是修正旧配置页和半成品页面感，问题到证明结构能最直接展示前后差异。"),
    compositionBlueprint: firstFilled(
      master.compositionBlueprint,
      coverDesign.compositionBlueprint,
      "左侧痛点钩子；中间失败稿/错误信号；中间箭头；右侧高质量结果页；底部方法步骤珠。"
    ),
    visualHierarchy,
    qaChecklist,
    platformStrategies: platformStrategies.length ? platformStrategies : [
      { platform: "YouTube/Bilibili 横版", strategy: "低文字量，大钩子，一个证明对象，安全区内完成点击判断。" },
      { platform: "竖版/短视频封面", strategy: "中心钩子和人物/结果对象优先，边缘信息可丢失。" },
      { platform: "方图/社交卡", strategy: "居中承诺与证明物，减少边缘依赖。" },
    ],
    smallPreviewTest: firstFilled(coverDesign.smallPreviewTest, "缩到 160px 时仍应先读到钩子，再看到结果页证明对象。"),
    image2Route: {
      defaultCoverEngine: image2Status.defaultCoverEngine || coverDesign.defaultCoverEngine || coverImage2Prompts.defaultCoverEngine || "image2-integrated-typography-cover",
      promptSource: image2Status.promptSource || "workflow/cover-image2-prompts.json",
      promptCount: image2Status.promptCount || coverImage2PromptCount(coverDesign, coverImage2Prompts),
      status: image2Status.status || "dry-run-prompt-package",
      reviewFallbackOnly: Boolean(image2Status.reviewFallbackOnly),
    },
    methodBeads: ["题材", "痛点", "承诺", "证据", "比例", "小图测试"],
  };
}

function normalizeConfigScriptUnitText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitConfigScriptUnits(value = "", source = "brief.narration") {
  const raw = String(value || "").replace(/\r/g, "\n").trim();
  if (!raw) return [];
  const lineUnits = raw.split(/\n+/).map(normalizeConfigScriptUnitText).filter((unit) => unit.length >= 6);
  const units = lineUnits.length > 1
    ? lineUnits
    : raw.split(/(?<=[。！？!?；;])\s*/u).map(normalizeConfigScriptUnitText).filter((unit) => unit.length >= 6);
  return (units.length ? units : [normalizeConfigScriptUnitText(raw)].filter(Boolean)).map((text, index) => ({
    order: index + 1,
    source,
    text,
  }));
}

function estimateConfigPersonalIpScriptUnits(context = {}) {
  const units = [];
  arrayify(context.brief.voiceoverSegments).forEach((segment, index) => {
    const text = normalizeConfigScriptUnitText(segment?.text || segment?.narration || segment?.voiceover || segment?.subtitle || segment);
    if (text) units.push({ order: index + 1, source: "voiceoverSegments", text });
  });
  arrayify(context.brief.narrationSegments).forEach((segment, index) => {
    const text = normalizeConfigScriptUnitText(segment?.text || segment?.narration || segment?.voiceover || segment?.subtitle || segment);
    if (text) units.push({ order: index + 1, source: "narrationSegments", text });
  });
  arrayify(context.pages).forEach((page, index) => {
    const frame = page.frame || {};
    const text = normalizeConfigScriptUnitText(frame.narration || frame.spokenText || frame.subtitle || frame.body || "");
    if (text) units.push({ order: index + 1, source: "page", sceneId: page.id, text });
  });
  units.push(...splitConfigScriptUnits(context.brief.narration, "brief.narration"));
  const seen = new Set();
  return units.filter((unit) => {
    const key = normalizeConfigScriptUnitText(unit.text).replace(/[，,。！？!?；;：:\s]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((unit, index) => ({ ...unit, order: index + 1 }));
}

function mergeMotionStyleTemplateContracts(templates, templateLibrary) {
  const libraryTemplates = new Map(arrayify(templateLibrary?.templates).map((template) => [template.id, template]));
  return arrayify(templates).map((template) => {
    const libraryTemplate = libraryTemplates.get(template.id);
    if (!libraryTemplate) return template;
    return {
      ...template,
      ...libraryTemplate,
      example: template.example || {},
      familyIndex: template.familyIndex,
      variantIndex: template.variantIndex,
      density: template.density,
      layoutBlueprint: template.layoutBlueprint || libraryTemplate.layoutContract?.blueprint || "",
      layoutIntent: template.layoutIntent || libraryTemplate.layoutContract?.blueprint || "",
      visualWeight: template.visualWeight,
      pageCardType: template.pageCardType,
      captionSafeArea: template.captionSafeArea || libraryTemplate.layoutContract?.captionSafeArea || "",
      animationSteps: arrayify(template.animationSteps).length
        ? arrayify(template.animationSteps)
        : arrayify(libraryTemplate.motionContract?.animationSteps),
      guardrails: arrayify(template.guardrails).length
        ? arrayify(template.guardrails)
        : arrayify(libraryTemplate.rejectList),
      motionFusion: arrayify(template.motionFusion).length
        ? arrayify(template.motionFusion)
        : arrayify(libraryTemplate.motionContract?.verbs),
      variantMethod: template.variantMethod,
      interactionFeeling: template.interactionFeeling,
    };
  });
}

function buildConfigModel(context, outPath) {
  const plannedCaptionIds = arrayify(context.captionPlan.scenes).map((scene) => scene.selectedStyleId || scene.styleId).filter(Boolean);
  const selectedCaptionIds = new Set([plannedCaptionIds[0] || context.captionStyles[0]?.id].filter(Boolean));
  const detectedMotionIds = new Set([
    context.motionPlan.selectedTemplate,
    ...arrayify(context.motionPlan.sceneTemplates).map((scene) => scene.selectedTemplate),
  ].filter(Boolean));
  const selectedMotionIds = new Set(context.motionTemplates.map((template) => template.id).filter(Boolean));
  for (const id of detectedMotionIds) selectedMotionIds.add(id);
  const selectedMotionCapabilityIds = new Set(context.motionCapabilities.filter((capability) => capability.selected !== false).map((capability) => capability.id));
  const motionStyleTemplates = mergeMotionStyleTemplateContracts(
    expandMotionStyleCatalogForConfig(context.motionStyleCatalog),
    context.motionStyleTemplateLibrary,
  );
  const motionStyleSceneStyles = arrayify(context.motionStylePlan.sceneStyles);
  const selectedMotionStyleIds = new Set(motionStyleSceneStyles.map((style) => style.styleTemplateId).filter(Boolean));
  const motionStyleFamilyRows = countBy(motionStyleTemplates.map((template) => template.familyId))
    .map(([familyId, count]) => {
      const template = motionStyleTemplates.find((item) => item.familyId === familyId) || {};
      return {
        familyId,
        familyLabelZh: template.familyLabelZh || familyId,
        baseTemplate: template.baseTemplate || "",
        count,
        selected: motionStyleSceneStyles.some((style) => style.familyId === familyId),
      };
    });
  const freeStockPolicy = context.brief.freeStockMaterialPolicy
    || context.runtimeConfig.resolved?.freeStockMaterialPolicy
    || context.mediaPlan.policy
    || "auto";
  const localVideoEntries = arrayify(context.mediaPlan.scenes)
    .filter((scene) => scene.localVideo || scene.rawFootage || scene.sourceVideo || scene.sourceClip);
  const ipActive = context.ipPlan.active === true || context.ipPlan.primaryPlannerRoute === true;
  const selectedSpeechStyle = context.brief.speechStyle
    || context.brief.voiceStyle
    || context.runtimeConfig.resolved?.speechStyle
    || "auto";
  const selectedVoiceBackend = context.brief.voiceBackend
    || context.runtimeConfig.resolved?.voiceBackend
    || "auto";
  const selectedVoiceGender = context.brief.voiceGender || context.brief.gender || "female";
  const explicitVoiceDialect = context.brief.dialect || context.brief.voiceDialect || "";
  const selectedVoiceDialect = explicitVoiceDialect || "yue";
  const selectedVoiceLanguageMode = context.brief.voiceLanguageMode
    || context.brief.voiceLanguage
    || (context.brief.language === "en" ? "en-narration" : explicitVoiceDialect ? "dialect-accent" : "zh-mandarin");
  const selectedVoiceToneType = context.brief.voiceToneType || "all";
  const rawSelectedVideoTypeId = context.brief.videoType
    || context.designPlan.videoType
    || (context.canvas.vertical ? "short-form" : "writing-method");
  const videoTypeOptions = [
    {
      id: "writing-method",
      label: "方法论口播",
      canvas: "16:9",
      description: "横屏知识讲解，适合课程、写作方法、观点拆解。",
      orientationPreset: "horizontal",
      defaultCapabilities: ["motion", "dynamic-planning", "cover-design"],
    },
    {
      id: "personal-ip-explainer",
      label: "个人 IP 讲解",
      canvas: "16:9 / 9:16",
      description: "固定主讲人、知识卡、执行 Agent 与字幕顶层组合。",
      orientationPreset: "horizontal",
      defaultCapabilities: ["motion", "dynamic-planning", "personal-ip", "cover-design"],
    },
    {
      id: "handdrawn-whiteboard",
      label: "手绘白板",
      canvas: "16:9 / 9:16",
      description: "白板描线只画语义前景，文字和字幕仍由框架承载。",
      orientationPreset: "horizontal",
      defaultCapabilities: ["motion", "dynamic-planning", "whiteboard", "cover-design"],
    },
    {
      id: "short-form",
      label: "竖屏短视频",
      canvas: "9:16",
      description: "移动端安全区、三秒钩子、强字幕和高频视觉状态变化。",
      orientationPreset: "vertical",
      defaultCapabilities: ["motion", "dynamic-planning", "whiteboard", "cover-design"],
    },
    {
      id: "custom-composite",
      label: "自定义组合",
      canvas: "按用户选择",
      description: "允许动效、动态规划、个人 IP、手绘和封面模块组合启用。",
      orientationPreset: context.canvas.vertical ? "vertical" : "horizontal",
      defaultCapabilities: ["motion", "dynamic-planning", "personal-ip", "whiteboard", "cover-design"],
    },
  ];
  const knownVideoTypeIds = new Set(videoTypeOptions.map((option) => option.id));
  const normalizedRawVideoType = String(rawSelectedVideoTypeId || "").toLowerCase();
  const selectedVideoTypeId = knownVideoTypeIds.has(rawSelectedVideoTypeId)
    ? rawSelectedVideoTypeId
    : context.canvas.vertical
      ? "short-form"
      : ipActive && (/hand|whiteboard|sketch|draw|手绘|白板/i.test(normalizedRawVideoType) || context.whiteboardModule.enabledByDefault)
        ? "custom-composite"
        : ipActive || /personal[-_\s]?ip|个人\s*ip|ip[-_\s]?explainer/i.test(normalizedRawVideoType)
          ? "personal-ip-explainer"
          : /hand|whiteboard|sketch|draw|手绘|白板/i.test(normalizedRawVideoType)
            ? "handdrawn-whiteboard"
            : "writing-method";
  const selectedVideoType = videoTypeOptions.find((option) => option.id === selectedVideoTypeId) || videoTypeOptions[0];
  const selectedVideoTypeCapabilities = new Set(arrayify(selectedVideoType.defaultCapabilities));
  const voicePreviewCatalog = collectVoicePreviewCatalog(context.packageDir, outPath);
  const colorSystemEntries = context.colorSystems.map(normalizeColorSystem);
  const autoColorSystem = context.colorSystemPlan || {};
  const plannerSelectedColorSystemId = autoColorSystem.selectedSystem?.id
    || context.designPlan.colorSystemPlan?.selectedSystem?.id
    || colorSystemEntries[0]?.id
    || "";
  const selectedColorSystem = colorSystemEntries.find((system) => system.id === plannerSelectedColorSystemId)
    || normalizeColorSystem(autoColorSystem.selectedSystem || {})
    || colorSystemEntries[0]
    || {};
  const selectedColorSystemMode = selectedColorSystem.paletteMode || autoColorSystem.selectedSystem?.paletteMode || "multi";
  const rankedColorCandidates = arrayify(autoColorSystem.rankedCandidates).map((candidate) => ({
    id: candidate.id || "",
    label: candidate.label || candidate.id || "",
    paletteMode: candidate.paletteMode || "",
    score: Number(candidate.score || 0),
    reasons: arrayify(candidate.reasons).slice(0, 3),
    rejectedForAuto: Boolean(candidate.rejectedForAuto),
  }));
  const captionGroups = captionGroupsFromStyles(context.captionStyles);
  const defaultCaptionGroup = captionGroups[0]?.group || "";
  const coverStyles = coverStylePresets(context.coverDesign);
  const coverResolutions = coverResolutionOptions(context.coverDesign, context.coverSizeSelection);
  const coverSamples = collectCoverSamples({
    packageDir: context.packageDir,
    outPath,
    coverDesign: context.coverDesign,
    coverSizeSelection: context.coverSizeSelection,
  });
  const coverShowcase = coverShowcaseExample(context.coverDesign);
  const coverSlides = coverResolutionSlides({
    samples: coverSamples,
    resolutionOptions: coverResolutions,
  });
  const coverFinalPreview = coverFinalPreviewSample({
    samples: coverSamples,
    resolutionSlides: coverSlides,
  });
  const generatedImageSource = context.designPlan.imageSource || context.brief.imageSource || "image2-dryrun";
  const image2Status = coverImage2Status({
    coverDesign: context.coverDesign,
    coverImage2Prompts: context.coverImage2Prompts,
    imageSource: generatedImageSource,
  });
  const coverStrategy = coverCreativeStrategy({
    coverDesign: context.coverDesign,
    coverImage2Prompts: context.coverImage2Prompts,
    brief: context.brief,
    image2Status,
  });
  const whiteboardArtifacts = context.whiteboardModule.previewArtifacts || {};
  const whiteboardPreviewArtifacts = Object.fromEntries(Object.entries(whiteboardArtifacts).map(([key, artifactPath]) => [
    key,
    {
      path: artifactPath,
      html: htmlRelativePath(outPath, artifactPath),
      available: Boolean(artifactPath),
    },
  ]));
  const pageCount = context.pages.length;
  const fallbackScriptUnits = estimateConfigPersonalIpScriptUnits(context);
  const fallbackScriptUnitCount = Math.max(pageCount, fallbackScriptUnits.length);
  const fallbackRoleAssetMinimum = 8;
  const fallbackVariantsPerScriptUnit = 5;
  const fallbackIpImageCountPolicy = {
    mode: "rich-preview",
    currentLegacyLogic: "one pageCard and one native main image job per active scene, plus a role-sheet brief",
    upgradedLogic: "启用个人 IP 后按口播稿/字幕/页面拆分匹配单元，每个单元至少一张个人 IP 主图，并补充动作、协作角色、局部、白板描线和替代构图变体。",
    roleAssetMinimum: fallbackRoleAssetMinimum,
    sceneCount: pageCount,
    scriptUnitCount: fallbackScriptUnitCount,
    scriptUnitSource: "config-page-fallback",
    scriptUnitSamples: fallbackScriptUnits.slice(0, 8),
    mainSceneImageJobs: fallbackScriptUnitCount,
    sceneVariantsPerScriptUnit: fallbackVariantsPerScriptUnit,
    sceneVariantsPerPage: fallbackVariantsPerScriptUnit,
    supplementalSceneVariantCount: fallbackScriptUnitCount * fallbackVariantsPerScriptUnit,
    targetTotal: fallbackRoleAssetMinimum + fallbackScriptUnitCount * (fallbackVariantsPerScriptUnit + 1),
  };
  const plannerIpImageCountPolicy = context.ipPlan.imageCountPolicy || null;
  const ipImageCountPolicy = plannerIpImageCountPolicy?.mode && plannerIpImageCountPolicy.mode !== "not-applicable"
    ? plannerIpImageCountPolicy
    : fallbackIpImageCountPolicy;
  const nativeMainJobCount = arrayify(context.ipNativeJobs.jobs).length;
  const nativeSupplementalJobCount = arrayify(context.ipNativeJobs.supplementalImageJobs).length;
  const ipMainSceneJobs = ipActive
    ? Math.max(nativeMainJobCount, Number(ipImageCountPolicy.mainSceneImageJobs || 0), Number(ipImageCountPolicy.scriptUnitCount || 0), pageCount)
    : Number(ipImageCountPolicy.mainSceneImageJobs || 0);
  const ipSupplementalJobs = ipActive
    ? Math.max(nativeSupplementalJobCount, Number(ipImageCountPolicy.supplementalSceneVariantCount || 0) + Number(ipImageCountPolicy.roleAssetMinimum || 0))
    : Number(ipImageCountPolicy.supplementalSceneVariantCount || 0) + Number(ipImageCountPolicy.roleAssetMinimum || 0);
  return {
    schemaVersion: 1,
    status: "semi-auto-config-ready",
    generatedAt: new Date().toISOString(),
    packageDir: context.packageDir,
    html: relative(context.packageDir, outPath).split("\\").join("/"),
    generationMode: {
      selected: context.contract.selectedMode || "semi-auto",
      defaultMode: context.contract.defaultMode || "semi-auto",
      supportedModes: arrayify(context.contract.supportedModes).map((mode) => ({
        id: mode.id,
        label: mode.label,
        default: Boolean(mode.default),
      })),
    },
    baseParameters: {
      selected: {
        orientation: context.canvas.vertical ? "竖屏" : "横屏",
        aspect: context.canvas.aspect,
        resolution: `${context.canvas.width}x${context.canvas.height}`,
        fps: context.canvas.fps,
      },
      videoTypeSelection: {
        selected: selectedVideoTypeId,
        userMayOverride: true,
        selectionContract: {
          group: "video-type",
          type: "single-choice-radio",
          mutualExclusive: true,
          presetAppliesCapabilities: true,
          capabilitiesRemainComposableAfterPreset: true,
        },
        options: videoTypeOptions.map((option) => ({
          ...option,
          selected: option.id === selectedVideoTypeId,
        })),
      },
      options: {
        orientation: [
          { id: "horizontal", label: "横屏", resolution: "1920x1080", default: true },
          { id: "vertical", label: "竖屏", resolution: "1080x1920", default: false },
        ],
        resolution: ["1920x1080", "1280x720", "1080x1920", "720x1280"],
        fps: [60, 30, 24],
      },
      resolutionSupport: {
        defaultResolution: "1920x1080",
        supports2k: false,
        disabled2kOption: "2560x1440",
        reason: "当前 HTML 截图/视频 fallback 渲染路径仍以 1920x1080 作为稳定输出；2K 需要完成全链路渲染与 QC 验证后再开放。",
      },
    },
    motionTemplates: {
      count: context.motionTemplates.length,
      selected: [...selectedMotionIds],
      templates: context.motionTemplates.map((template) => ({
        id: template.id,
        label: motionTemplateLabel(template.id),
        description: motionTemplateDescription(template),
        motionVerbs: arrayify(template.motionVerbs),
        selected: selectedMotionIds.has(template.id),
      })),
    },
    layeredMotion: {
      active: context.layeredMotionPlan.status === "active",
      status: context.layeredMotionPlan.status || "inactive",
      mode: context.layeredMotionPlan.mode || "off",
      intensity: context.layeredMotionPlan.intensity || "balanced",
      revealOrder: context.layeredMotionPlan.revealOrder || "progressive",
      trigger: context.layeredMotionPlan.trigger || {},
      zBands: context.layeredMotionPlan.zBands || {},
      personalIpPolicy: context.layeredMotionPlan.personalIpPolicy || "preserve-native-page-as-immutable-base",
      scenePlans: arrayify(context.layeredMotionPlan.scenePlans),
      plan: "workflow/layered-motion-plan.json",
    },
    motionCapabilities: {
      count: context.motionCapabilities.length,
      selected: [...selectedMotionCapabilityIds],
      capabilities: context.motionCapabilities.map((capability) => ({
        ...capability,
        selected: selectedMotionCapabilityIds.has(capability.id),
      })),
    },
    motionStyleCatalog: {
      source: "assets/motion-style-catalog.json",
      count: motionStyleTemplates.length,
      familyCount: arrayify(context.motionStyleCatalog.families).length,
      variantCount: arrayify(context.motionStyleCatalog.variants).length,
      templateLibrary: {
        source: "assets/motion-style-template-library.json",
        status: context.motionStyleTemplateLibrary.status || "missing",
        designSpec: context.motionStyleTemplateLibrary.designSpec || "references/motion-style-template-design-spec.md",
        selectionArtifact: context.motionStyleTemplateLibrary.selectionArtifact || "workflow/motion-style-template-selection.json",
        templateCount: Number(context.motionStyleTemplateLibrary.coverage?.templateCount || arrayify(context.motionStyleTemplateLibrary.templates).length || 0),
        contentKinds: arrayify(context.motionStyleTemplateLibrary.coverage?.contentKinds),
        topicTypes: arrayify(context.motionStyleTemplateLibrary.coverage?.topicTypes),
        typographyModes: arrayify(context.motionStyleTemplateLibrary.coverage?.typographyModes),
        agentContractRoles: Object.keys(context.motionStyleTemplateLibrary.agentContract || {}),
        selectionMode: context.motionStyleTemplateLibrary.selectionPolicy?.mode || "planner-auto-first-with-user-override",
      },
      selectedSceneStyles: motionStyleSceneStyles,
      selectedStyleIds: [...selectedMotionStyleIds],
      families: motionStyleFamilyRows,
      templates: motionStyleTemplates,
      previewTemplates: motionStyleTemplates.slice(0, 12),
      reviewPage: "motion-style-template-review.html",
      verticalReviewPage: "vertical-motion-style-template-review.html",
      plan: {
        path: "workflow/motion-style-plan.json",
        status: context.motionStylePlan.status || "missing",
        selectionMode: context.motionStylePlan.selectionPolicy?.mode || "rule-ranked-curated-catalog",
        videoLevelRule: context.motionStylePlan.videoLevelLayoutPlan?.rule || "",
      },
    },
    colorSystems: {
      count: colorSystemEntries.length,
      references: context.colorReferences,
      defaultMode: selectedColorSystemMode,
      autoSelection: {
        enabledByDefault: autoColorSystem.userOverridePolicy?.autoEnabledByDefault !== false,
        plannerOwner: autoColorSystem.plannerOwner || "codex-video-workflow planner",
        planPath: "workflow/color-system-plan.json",
        selectedSystemId: selectedColorSystem.id || plannerSelectedColorSystemId,
        selectedLabel: selectedColorSystem.label || autoColorSystem.selectedSystem?.label || "",
        selectedMode: selectedColorSystemMode,
        reasons: arrayify(autoColorSystem.selectedSystem?.reasons).slice(0, 5),
        appliedToVideoElements: arrayify(autoColorSystem.appliedToVideoElements),
        rankedCandidates: rankedColorCandidates,
        userOverridePolicy: autoColorSystem.userOverridePolicy || {
          autoEnabledByDefault: true,
          userMayOverride: true,
          overrideScope: "whole-video first; page-level override only through page TDS review",
        },
      },
      modes: paletteModes(colorSystemEntries),
      systems: colorSystemEntries.map((system) => ({
        ...system,
        selectedByPlanner: system.id === plannerSelectedColorSystemId,
      })),
    },
    captionStyles: {
      count: context.captionStyles.length,
      selected: [...selectedCaptionIds],
      defaultGroup: defaultCaptionGroup,
      groups: captionGroups,
      autoSubtitle: {
        enabledByDefault: context.captionPlan.autoSubtitle?.enabledByDefault !== false,
        plannerOwner: context.captionPlan.autoSubtitle?.plannerOwner || "caption-style-planner",
        validation: context.captionPlan.autoSubtitle?.validation || "scripts/validate-caption-strategy-routing.mjs",
        previewRows: arrayify(context.captionPlan.scenes).slice(0, 5).map((scene) => ({
          sceneId: scene.sceneId,
          sceneJob: scene.sceneJob,
          group: scene.group,
          selectedStyleId: scene.selectedStyleId,
          reason: scene.reason || "",
        })),
      },
      keywordHighlight: {
        enabledByDefault: context.captionPlan.keywordHighlight?.enabledByDefault !== false,
        mode: context.captionPlan.keywordHighlight?.mode || "keyword-visual-emphasis",
        defaultTreatments: arrayify(context.captionPlan.keywordHighlight?.defaultTreatments).length
          ? arrayify(context.captionPlan.keywordHighlight.defaultTreatments)
          : ["accentColor", "highlightBackground", "bold", "underline"],
        maxTokensPerCue: Number(context.captionPlan.keywordHighlight?.maxTokensPerCue || 3),
      },
      styles: context.captionStyles.map((style, index) => ({
        id: style.id,
        labelZh: style.labelZh || style.name || style.id,
        group: style.group || "other",
        groupLabelZh: captionGroupLabel(style.group || "other"),
        useCase: style.useCase || "",
        traits: arrayify(style.traits),
        motionIntensity: style.motion?.intensity || "subtle",
        index,
        selected: selectedCaptionIds.has(style.id),
      })),
    },
    featureCompatibility: {
      defaults: {
        motion: selectedVideoTypeCapabilities.has("motion"),
        dynamicPlanning: selectedVideoTypeCapabilities.has("dynamic-planning"),
        personalIp: selectedVideoTypeCapabilities.has("personal-ip") || ipActive,
        whiteboard: selectedVideoTypeCapabilities.has("whiteboard"),
        coverDesign: selectedVideoTypeCapabilities.has("cover-design"),
      },
      mutualExclusion: {
        primaryVideoType: {
          group: "video-type",
          controls: "input[name=\"video-type\"]",
          selected: selectedVideoTypeId,
          options: videoTypeOptions.map((option) => option.id),
        },
        orientation: {
          group: "orientation",
          controls: "input[name=\"orientation\"]",
          selected: selectedVideoType.orientationPreset,
          options: ["horizontal", "vertical"],
        },
        composableFeatures: ["motion", "dynamic-planning", "personal-ip", "whiteboard", "cover-design"],
      },
      rules: [
        {
          id: "all-capabilities-composable",
          label: "动效、动态规划、个人 IP、手绘和封面设计默认可组合",
          type: "compatible",
          features: ["motion", "dynamic-planning", "personal-ip", "whiteboard", "cover-design"],
        },
        {
          id: "qc-resolves-layer-conflicts",
          label: "如页面出现遮挡或层级冲突，由页面级 TDS/QC 修复，而不是自动关闭能力",
          type: "guarded-compatible",
          features: ["personal-ip", "motion", "whiteboard"],
        },
        {
          id: "cover-design-independent",
          label: "封面设计不依赖 TTS 或 MP4 渲染，可与视频生成并行",
          type: "compatible",
          features: ["cover-design", "tts-timing", "render"],
        },
      ],
    },
    materialSources: {
      freeStockSearch: {
        policy: freeStockPolicy,
        enabledByDefault: freeStockPolicy !== "off",
        plan: "workflow/media-routing-plan.json",
      },
      localVideoMaterials: {
        enabledByDefault: localVideoEntries.length > 0,
        detectedCount: localVideoEntries.length,
        pickerRequiredWhenEnabled: true,
        acceptedTypes: ["video/mp4", "video/quicktime", "video/webm", "image/png", "image/jpeg", "image/webp"],
      },
      generatedImages: {
        imageSource: generatedImageSource,
        strategy: "workflow/image-generation-strategy.json",
      },
    },
    coverModule: {
      autoCover: {
        enabledByDefault: true,
        label: "自动按封面设计规范生成",
        source: "workflow/cover-design.json",
        promptSource: "workflow/cover-image2-prompts.json",
      },
      image2Status,
      creativeStrategy: coverStrategy,
      showcase: coverShowcase,
      samples: coverSamples,
      finalPreview: coverFinalPreview,
      resolutionSlides: coverSlides,
      stylePresets: coverStyles,
      selectedStyleId: coverStyles.find((style) => style.selected)?.id || coverStyles[0]?.id || "",
      resolutionOptions: coverResolutions,
      supportedResolutionCount: coverResolutions.length,
      resolutionGalleryRequired: true,
      selectedResolutionIds: coverResolutions.filter((option) => option.selected).map((option) => option.id),
      artifacts: {
        coverDesign: "workflow/cover-design.json",
        coverImage2Prompts: "workflow/cover-image2-prompts.json",
        coverSizeSelection: "workflow/cover-size-selection.json",
        finalDeliveryDirectory: context.coverDesign.finalDeliveryDirectory || "最终成品",
      },
      currentCoverPromise: context.coverDesign.coverPromise || context.coverDesign.masterCoverConcept?.hookText || "",
      currentCompositionTemplate: context.coverDesign.masterCoverConcept?.compositionTemplate || "",
    },
	    personalIp: {
	      enabledByDefault: ipActive,
	      plan: "workflow/ip-diagram-creator-plan.json",
	      userChoices: context.ipPlan.userChoices || {
	        makePersonalIp: ipActive ? "auto" : "off",
	        addHandDrawnImageAnimation: "off",
	      },
	      executionModes: Array.isArray(context.ipPlan.executionModes) ? context.ipPlan.executionModes : [],
	      selectedExecutionModes: Array.isArray(context.ipPlan.executionModes)
	        ? context.ipPlan.executionModes.filter((mode) => mode.selected === true).map((mode) => mode.id)
	        : [],
	      nativeDirectGeneration: context.ipPlan.nativeDirectUsePlan || {},
	      nativeFinalVideo: context.ipPlan.nativeFinalVideoPlan || {},
	      integration: {
	        sourceFramework: "haloshin/ip-diagram-creator",
        presenterLayer: "个人 IP 主角、身份资产、口播视角",
        handDrawnLayer: "手绘箭头、圈画、知识卡前景层",
        diagramLayer: "知识图解、协作图、PPT 导演页",
        subtitleLayer: "字幕始终在最上层并避开人物与卡片",
      },
      source: {
        repository: context.ipDiagramAssets.repository,
        url: context.ipDiagramAssets.publicUrl,
        localPath: context.ipDiagramAssets.localPath,
        assetsAvailable: Boolean(context.ipDiagramAssets.characterAssets && context.ipDiagramAssets.diagramModes),
      },
      assetRegistry: context.personalIpAssetRegistry || {},
      presetIdentities: context.personalIpPresetIdentities,
      imageCountPolicy: {
        ...ipImageCountPolicy,
        supplementalJobs: ipSupplementalJobs,
        mainSceneJobs: ipMainSceneJobs,
        totalPlannedImageJobs: context.ipNativeJobs.imageJobSummary?.totalPlannedImageJobs
          ? Math.max(Number(context.ipNativeJobs.imageJobSummary.totalPlannedImageJobs || 0), ipMainSceneJobs + ipSupplementalJobs, Number(ipImageCountPolicy.targetTotal || 0))
          : (ipMainSceneJobs + ipSupplementalJobs)
            || ipImageCountPolicy.targetTotal
            || 0,
      },
      examples: context.personalIpExamples,
      previewAssets: {
        banner: context.ipDiagramAssets.banner,
        characterAssets: context.ipDiagramAssets.characterAssets,
        diagramModes: context.ipDiagramAssets.diagramModes,
        pptMode: context.ipDiagramAssets.pptMode,
        characterSample: context.ipDiagramAssets.characterSample,
        knowledgeCard: context.ipDiagramAssets.knowledgeCard,
        workflowOverview: context.ipDiagramAssets.workflowOverview,
        pptMethodPage: context.ipDiagramAssets.pptMethodPage,
      },
    },
    whiteboard: {
      ...context.whiteboardModule,
      previewArtifacts: whiteboardPreviewArtifacts,
    },
    voiceModule: {
      selected: {
        backend: selectedVoiceBackend,
        speechStyle: selectedSpeechStyle,
        gender: selectedVoiceGender,
        dialect: selectedVoiceDialect,
        languageMode: selectedVoiceLanguageMode,
        toneType: selectedVoiceToneType,
      },
      policy: "默认使用本地高质量语音；不做真人克隆，不使用付费外部语音 API。",
      languageModes: context.voiceModes.languageModes.map((mode) => ({
        ...mode,
        selected: mode.id === selectedVoiceLanguageMode,
      })),
      dialects: context.voiceModes.dialects.map((dialect) => ({
        ...dialect,
        selected: dialect.id === selectedVoiceDialect,
      })),
      genderOptions: context.voiceModes.genderOptions.map((option) => ({
        ...option,
        selected: option.id === selectedVoiceGender || (!selectedVoiceGender && option.default),
      })),
      toneTypes: context.voiceModes.toneTypes.map((type) => ({
        ...type,
        selected: type.id === selectedVoiceToneType || (!selectedVoiceToneType && type.default),
      })),
      speakerMatching: context.voiceModes.speakerMatching,
      previewCatalog: voicePreviewCatalog,
      speechStyles: context.voiceModes.speechStyles.map((style) => ({
        ...style,
        selected: style.id === selectedSpeechStyle || (selectedSpeechStyle === "auto" && style.id === "auto"),
      })),
    },
    pageEditing: {
      pageCount: context.pages.length,
      pageReviewHtml: "page-review.html",
      pageDecisionContract: "workflow/page-decision-contract.json",
      tds: {
        T: "Text/content",
        D: "Design/layout",
        S: "Subtitle/style",
      },
    },
  };
}

function renderSwatches(colors) {
  return `<div class="swatches">${colors.map((color) => `<i style="background:${escapeHtml(color)}"></i>`).join("")}</div>`;
}

function htmlRelativePath(outPath, artifactPath) {
  if (!artifactPath) return "";
  return relative(dirname(outPath), artifactPath).split("\\").join("/");
}

function renderMotionPreview(template) {
  const id = template.id || "";
  const kind = slug(id);
  const previews = {
    "kinetic-editorial-explainer": `
      <div class="motion-stage kinetic-stage">
        <i class="motion-word w1">主张</i><i class="motion-word w2">证据</i><i class="motion-word w3">结论</i>
        <b class="motion-stamp">重点</b>
      </div>`,
    "semantic-timeline-reveal": `
      <div class="motion-stage timeline-stage">
        <span class="timeline-rail"></span>
        <i class="node n1"></i><i class="node n2"></i><i class="node n3"></i><i class="node n4"></i>
        <b class="step-label l1">准备</b><b class="step-label l2">生成</b><b class="step-label l3">审核</b><b class="step-label l4">合成</b>
      </div>`,
    "interactive-proof-board": `
      <div class="motion-stage proof-stage">
        <svg viewBox="0 0 260 130" aria-hidden="true">
          <path class="proof-line p1" d="M66 34 C105 24 135 42 173 36"/>
          <path class="proof-line p2" d="M72 95 C116 112 148 93 194 92"/>
        </svg>
        <i class="proof-card c1">原因</i><i class="proof-card c2">证据</i><i class="proof-card c3">结论</i>
      </div>`,
    "data-curve-trace": `
      <div class="motion-stage curve-stage">
        <svg viewBox="0 0 260 130" aria-hidden="true">
          <path class="axis" d="M28 104H230M28 22V104"/>
          <path class="curve-line" d="M32 94 C68 86 80 60 112 64 C148 68 154 34 198 30"/>
          <circle class="curve-dot" cx="198" cy="30" r="7"/>
        </svg>
        <b class="curve-callout">拐点</b>
      </div>`,
    "typed-black-white-opener": `
      <div class="motion-stage typed-stage">
        <span class="typed-line line-a">这段内容</span>
        <span class="typed-line line-b">从一个问题开始</span>
        <i class="caret"></i>
      </div>`,
    "dark-saas-magic-ui": `
      <div class="motion-stage product-stage">
        <i class="ui-panel main"></i><i class="ui-panel side"></i><i class="ui-chip input">输入</i>
        <i class="ui-chip build">生成</i><i class="ui-chip done">完成</i>
      </div>`,
  };
  return `<div class="motion-preview motion-${escapeHtml(kind)}" data-motion-kind="${escapeHtml(kind)}" aria-hidden="true">
    ${previews[id] || previews["kinetic-editorial-explainer"]}
  </div>`;
}

function renderMotionCapabilityPreview(capability) {
  const kind = slug(capability.preview || capability.id);
  const previewByKind = {
    path: `<i class="cap-dot a"></i><b class="cap-rail"></b><em class="cap-path"></em><span class="cap-tag">入场</span>`,
    cards: `<i class="cap-card one"></i><i class="cap-card two"></i><i class="cap-card three"></i><span class="cap-focus"></span>`,
    chart: `<b class="cap-axis x"></b><b class="cap-axis y"></b><em class="cap-chart-line"></em><i class="cap-bar one"></i><i class="cap-bar two"></i><i class="cap-bar three"></i>`,
    orbit: `<i class="cap-orbit core"></i><i class="cap-orbit sat one"></i><i class="cap-orbit sat two"></i><b class="cap-loop"></b>`,
    formula: `<span class="cap-formula">A → B</span><em class="cap-proof-line"></em><span class="cap-formula result">结论</span>`,
    sketch: `<em class="cap-sketch-line one"></em><em class="cap-sketch-line two"></em><i class="cap-pen"></i><span class="cap-note">草图</span>`,
    depth: `<i class="cap-depth back"></i><i class="cap-depth mid"></i><i class="cap-depth front"></i><b class="cap-depth-shadow"></b>`,
    whiteboard: `<span class="cap-board">脚本</span><em class="cap-draw one"></em><em class="cap-draw two"></em><i class="cap-pen"></i>`,
    states: `<span class="cap-state start">输入</span><b class="cap-state-line"></b><span class="cap-state end">完成</span>`,
    sync: `<b class="cap-wave one"></b><b class="cap-wave two"></b><i class="cap-cut"></i><i class="cap-cut second"></i>`,
    film: `<b class="cap-film-strip"></b><i class="cap-frame one"></i><i class="cap-frame two"></i><em class="cap-trim"></em>`,
    caption: `<span class="cap-subtitle">重点</span><em class="cap-highlight"></em><b class="cap-pulse"></b>`,
    cover: `<i class="cap-cover wide"></i><i class="cap-cover vertical"></i><em class="cap-cover-flash"></em>`,
    gate: `<span class="cap-gate">授权</span><b class="cap-gate-line"></b><i class="cap-switch"></i>`,
  };
  return `<div class="capability-motion-preview preview-${escapeHtml(kind)}" data-capability-motion="${escapeHtml(kind)}" aria-hidden="true">
    ${previewByKind[kind] || previewByKind.path}
  </div>`;
}

function captionDemoText(style) {
  const group = style.group || "";
  if (group === "bilingual") return "先给结论  then show proof";
  if (group === "quote") return "关键句要被观众记住";
  if (group === "audio") return "声音节奏跟着字幕走";
  if (group === "mobile-safe-retention") return "重点只占一行";
  if (group === "data-evidence") return "证据出现，结论才成立";
  return style.labelZh || style.id || "字幕预览";
}

function hashString(value) {
  return String(value ?? "").split("").reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function captionPreviewTokens(style, index = 0) {
  const group = style.group || "";
  const id = style.id || style.labelZh || "";
  const seed = hashString(`${id}|${style.labelZh || ""}|${group}|${index}`);
  const hue = seed % 360;
  const accent = `hsl(${hue} 54% 43%)`;
  const accentSoft = `hsl(${(hue + 22) % 360} 72% 78%)`;
  const accentDark = `hsl(${hue} 36% 20%)`;
  const paper = `hsl(${(hue + 38) % 360} 46% 96%)`;
  const layouts = ["end center", "center center", "end start", "start center"];
  const aligns = ["center", "left", "right"];
  const decorations = ["rail", "corner", "marker", "meter", "split", "none"];
  const variants = [
    {
      look: "glass-pill",
      bg: `color-mix(in srgb, ${accentDark} 82%, transparent)`,
      color: "#fffdf7",
      border: "rgba(255,255,255,.28)",
      accent,
      radius: "999px",
      shadow: "0 10px 26px rgba(20,24,23,.22)",
      transform: "none",
    },
    {
      look: "editorial-rule",
      bg: paper,
      color: "#171817",
      border: "rgba(20,24,23,.14)",
      accent,
      radius: "3px",
      shadow: "inset 0 -4px 0 rgba(154,103,63,.35)",
      transform: "none",
    },
    {
      look: "marker-swipe",
      bg: "transparent",
      color: "#151817",
      border: "transparent",
      accent: accentSoft,
      radius: "4px",
      shadow: "none",
      transform: `rotate(${seed % 2 === 0 ? "-" : ""}1deg)`,
    },
    {
      look: "hud-strip",
      bg: `linear-gradient(90deg, ${accentDark}, ${accent})`,
      color: "#f8fbf7",
      border: "rgba(248,251,247,.36)",
      accent: accentSoft,
      radius: "2px",
      shadow: "0 10px 24px rgba(49,95,125,.22)",
      transform: "none",
    },
    {
      look: "quote-slab",
      bg: accentDark,
      color: "#f8f1e4",
      border: "rgba(248,241,228,.22)",
      accent: accentSoft,
      radius: "7px",
      shadow: "0 8px 0 rgba(196,138,90,.38)",
      transform: "none",
    },
    {
      look: "clean-lower-third",
      bg: paper,
      color: "#18211f",
      border: "rgba(20,24,23,.12)",
      accent,
      radius: "6px",
      shadow: "0 8px 22px rgba(20,24,23,.12)",
      transform: "none",
    },
    {
      look: "mono-console",
      bg: "#15191d",
      color: "#dfe9e5",
      border: "rgba(143,182,178,.4)",
      accent: accentSoft,
      radius: "5px",
      shadow: "0 0 0 1px rgba(143,182,178,.2)",
      transform: "none",
    },
    {
      look: "paper-sticker",
      bg: paper,
      color: "#1b181d",
      border: "rgba(27,24,29,.12)",
      accent,
      radius: "6px",
      shadow: "4px 5px 0 rgba(20,24,23,.12)",
      transform: `rotate(${seed % 2 === 0 ? "1.2" : "-1.2"}deg)`,
    },
    {
      look: "data-band",
      bg: `linear-gradient(90deg,${accentDark},${accent})`,
      color: "#fff",
      border: "rgba(255,255,255,.24)",
      accent: accentSoft,
      radius: "4px",
      shadow: "0 10px 26px rgba(23,33,43,.22)",
      transform: "none",
    },
    {
      look: "bilingual-stack",
      bg: paper,
      color: "#171817",
      border: "rgba(20,24,23,.14)",
      accent,
      radius: "7px",
      shadow: "0 8px 20px rgba(20,24,23,.1)",
      transform: "none",
    },
    {
      look: "audio-wave",
      bg: "rgba(246,244,237,.92)",
      color: "#171817",
      border: "rgba(20,24,23,.12)",
      accent,
      radius: "999px",
      shadow: "0 6px 18px rgba(20,24,23,.1)",
      transform: "none",
    },
    {
      look: "mobile-pop",
      bg: "#ffffff",
      color: "#151817",
      border: "rgba(20,24,23,.1)",
      accent,
      radius: "8px",
      shadow: "0 8px 0 rgba(166,64,50,.26)",
      transform: "none",
    },
  ];
  const groupOverride = {
    bilingual: "bilingual-stack",
    quote: "quote-slab",
    audio: "audio-wave",
    "mobile-safe-retention": "mobile-pop",
    "data-evidence": "data-band",
  }[group];
  const selected = groupOverride
    ? variants.find((variant) => variant.look === groupOverride)
    : variants[seed % variants.length];
  const tokens = selected || variants[0];
  return {
    ...tokens,
    accent,
    signature: `${tokens.look}-${seed.toString(36)}`,
    place: layouts[seed % layouts.length],
    align: aligns[Math.floor(seed / 7) % aligns.length],
    decoration: decorations[Math.floor(seed / 11) % decorations.length],
    padX: `${9 + (seed % 8)}px`,
    padY: `${6 + (Math.floor(seed / 3) % 6)}px`,
    fontSize: `${12 + (seed % 3)}px`,
    width: `${70 + (seed % 24)}%`,
  };
}

function renderCaptionPreview(style, index = 0) {
  const group = slug(style.group || "caption");
  const text = captionDemoText(style);
  const tokens = captionPreviewTokens(style, index);
  const cssVars = [
    `--cap-bg:${tokens.bg}`,
    `--cap-color:${tokens.color}`,
    `--cap-border:${tokens.border}`,
    `--cap-accent:${tokens.accent}`,
    `--cap-radius:${tokens.radius}`,
    `--cap-shadow:${tokens.shadow}`,
    `--cap-transform:${tokens.transform}`,
    `--cap-place:${tokens.place}`,
    `--cap-align:${tokens.align}`,
    `--cap-pad-x:${tokens.padX}`,
    `--cap-pad-y:${tokens.padY}`,
    `--cap-font-size:${tokens.fontSize}`,
    `--cap-width:${tokens.width}`,
  ].join(";");
  return `<div class="caption-preview caption-${escapeHtml(group)}" data-caption-group="${escapeHtml(group)}" data-caption-look="${escapeHtml(tokens.look)}" data-caption-decor="${escapeHtml(tokens.decoration)}" data-caption-signature="${escapeHtml(tokens.signature)}" data-caption-style-id="${escapeHtml(style.id || "")}" style="${escapeHtml(cssVars)}">
    <span>${escapeHtml(text)}</span>
    <em>${escapeHtml((style.traits || []).slice(0, 1).join("") || style.motionIntensity || "focus")}</em>
  </div>`;
}

function ipPreviewSlides(personalIp) {
  const assets = personalIp.previewAssets || {};
  const assetByExample = {
    characterAssets: assets.characterSample || assets.characterAssets,
    diagramModes: assets.knowledgeCard || assets.diagramModes,
    banner: assets.workflowOverview || assets.banner,
    pptMode: assets.pptMethodPage || assets.pptMode,
  };
  const slides = personalIp.examples
    .map((example) => ({
      ...example,
      src: assetByExample[example.sourceAsset] || assets.banner,
    }))
    .filter((example) => example.src);
  if (slides.length) return slides;
  return [{
    id: "ip-default-fallback",
    label: "个人 IP 默认形象",
    example: "未找到外部示例资产时，仍展示一个默认主讲人和知识卡组合，避免个人 IP 预览为空。",
    sourceAsset: "fallback",
    src: fallbackIpPreviewSvg("个人 IP"),
  }];
}

function renderIpCompositePreview(personalIp) {
  const slides = ipPreviewSlides(personalIp);
  return `<div class="ip-gallery" data-ip-gallery aria-label="个人 IP 图解创作器预览">
    <div class="ip-gallery-head">
      <strong>个人 IP 内容预览</strong>
      <span data-ip-counter>1 / ${escapeHtml(slides.length || 1)}</span>
    </div>
    <div class="ip-gallery-frame">
      ${slides.map((slide, index) => `
        <figure class="ip-gallery-slide ${index === 0 ? "active" : ""}" data-ip-slide="${index}" ${index === 0 ? "" : "hidden"}>
          <img src="${escapeHtml(slide.src)}" alt="${escapeHtml(slide.label)}" />
          <figcaption>${escapeHtml(slide.label)}</figcaption>
        </figure>`).join("")}
    </div>
    <div class="ip-gallery-controls">
      <button type="button" data-ip-prev aria-label="上一张">‹</button>
      <button type="button" data-ip-next aria-label="下一张">›</button>
    </div>
    <div class="ip-gallery-details">
      ${slides.map((slide, index) => `
        <article class="${index === 0 ? "active" : ""}" data-ip-detail="${index}" ${index === 0 ? "" : "hidden"}>
          <small>haloshin / ip-diagram-creator</small>
          <h3>${escapeHtml(slide.label)}</h3>
          <p>${escapeHtml(slide.example)}</p>
        </article>`).join("")}
    </div>
  </div>`;
}

function renderIpIdentityAvatar(identity) {
  return `<span class="ip-avatar" style="--ip-tone:${escapeHtml(identity.tone)};--ip-accent:${escapeHtml(identity.accent)}">
    <i class="ip-avatar-head"></i>
    <i class="ip-avatar-body"></i>
    <em class="ip-avatar-gesture"></em>
    <b></b>
  </span>`;
}

function renderIpIdentityPicker(personalIp) {
  return `<div class="ip-identity-grid" aria-label="个人 IP 形象选择">
    ${personalIp.presetIdentities.map((identity) => `
      <label class="ip-identity-card ${identity.selected ? "selected" : ""}" data-ip-identity="${escapeHtml(identity.id)}">
        <input type="radio" name="ip-identity" value="${escapeHtml(identity.id)}" ${identity.selected ? "checked" : ""}/>
        ${renderIpIdentityAvatar(identity)}
        <span>
          <strong>${escapeHtml(identity.label)}</strong>
          <small>${escapeHtml(identity.role)}</small>
          <em>${escapeHtml(identity.description)}</em>
        </span>
      </label>`).join("")}
  </div>`;
}

function renderIpAssetRegistryCard(personalIp) {
  const registry = personalIp.assetRegistry || {};
  const library = registry.library || {};
  const existing = registry.existingPersona || {};
  const guidance = registry.userGuidance || {};
  const status = registry.status || "not-configured";
  const statusLabel = {
    "ready-existing-persona": "已读取固定人设",
    "authorized-input-pending-save": "授权素材待保存",
    "needs-user-persona-onboarding": "需要先创建固定人设",
    "not-applicable": "当前未启用",
  }[status] || "等待配置";
  const acceptedInputs = arrayify(guidance.acceptedInputs).slice(0, 5);
  return `<div class="ip-asset-registry-card" data-ip-asset-registry data-ip-registry-status="${escapeHtml(status)}">
    <div class="ip-asset-registry-head">
      <span>
        <b>固定人设物料库</b>
        <em>${escapeHtml(statusLabel)}</em>
      </span>
      <strong>${escapeHtml(Number(existing.assetCount || 0))} 个素材</strong>
    </div>
    <p>${escapeHtml(guidance.prompt || "首次创建固定形象后，后续视频默认读取同一个人设 manifest，避免每次重新设计。")}</p>
    <details class="ip-asset-library" data-ip-asset-library="${escapeHtml(library.root || "")}">
      <summary>查看物料库路径与 manifest</summary>
      <span>物料库</span>
      <code>${escapeHtml(library.root || "未配置")}</code>
      <span>当前 manifest</span>
      <code>${escapeHtml(library.manifestPath || "等待创建")}</code>
    </details>
    <div class="ip-onboarding-grid">
      <label class="ip-upload-drop">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple data-ip-reference-upload />
        <span>上传照片 / 头像 / 形象图</span>
        <em data-ip-upload-count>${escapeHtml(acceptedInputs.join(" / ") || "支持授权照片、头像、角色设定图")}</em>
      </label>
      <label class="ip-manifest-input">
        <span>已有 manifest 或素材目录</span>
        <input type="text" value="${escapeHtml(library.manifestPath || "")}" placeholder="选择或粘贴已保存的人设 manifest 路径" data-ip-manifest-path />
      </label>
    </div>
    <div class="ip-onboarding-actions">
      <button type="button" data-ip-create-persona>创建固定人设</button>
      <button type="button" data-ip-reuse-persona>读取已保存人设</button>
      <small>${escapeHtml(guidance.suggestedCommand || "创建后将自动优先复用已保存 manifest。")}</small>
    </div>
  </div>`;
}

function renderIpScriptMatchSamples(policy = {}) {
  const samples = arrayify(policy.scriptUnitSamples).slice(0, 5);
  if (!samples.length) return "";
  return `<div class="ip-script-match-list">
    ${samples.map((sample) => `
      <span>
        <b>${escapeHtml(sample.order || "")}</b>
        <em>${escapeHtml(compactText(sample.text || "", 30))}</em>
      </span>`).join("")}
	  </div>`;
}

function renderIpExecutionModeControls(personalIp = {}) {
  const modes = arrayify(personalIp.executionModes);
  if (!modes.length) return "";
  const choices = personalIp.userChoices || {};
  return `<div class="ip-count-policy ip-execution-modes" data-ip-execution-modes>
    <b>个人 IP 执行流程</b>
    ${modes.map((mode) => `
      <label class="ip-mode-row ${mode.selected ? "selected" : ""}" data-ip-execution-mode="${escapeHtml(mode.id || "")}">
        <input type="${mode.id === "native-final-video" ? "checkbox" : "radio"}" name="ip-execution-mode" value="${escapeHtml(mode.id || "")}" ${mode.selected ? "checked" : ""}/>
        <span>
          <h3>${escapeHtml(mode.id || "")}</h3>
          <p>${escapeHtml(mode.status || "available")}${mode.personaStatus ? ` / ${escapeHtml(mode.personaStatus)}` : ""}</p>
        </span>
      </label>`).join("")}
    <em>makePersonalIp=${escapeHtml(choices.makePersonalIp || "auto")}；handDrawnAnimation=${escapeHtml(choices.addHandDrawnImageAnimation || "off")}。原生 final 只有在页面来源证明通过后才可作为最终视频画面。</em>
  </div>`;
}

function renderIpMotionPane(model) {
  const policy = model.personalIp.imageCountPolicy || {};
  const scriptUnitCount = Number(policy.scriptUnitCount || policy.mainSceneJobs || 0);
  const variantsPerUnit = Number(policy.sceneVariantsPerScriptUnit || policy.sceneVariantsPerPage || 0);
  return `<div class="ip-composite-grid motion-detail-grid">
    ${renderIpCompositePreview(model.personalIp)}
	    <div class="ip-mode-list">
	      ${renderIpAssetRegistryCard(model.personalIp)}
	      ${renderIpExecutionModeControls(model.personalIp)}
	      ${renderIpIdentityPicker(model.personalIp)}
	      <div class="ip-count-policy" data-ip-image-count-policy>
        <b>图片数量策略</b>
        <span>口播匹配单元：${escapeHtml(scriptUnitCount)} 个</span>
        <span>主图任务：${escapeHtml(policy.mainSceneJobs || 0)} 个</span>
        <span>每单元补充：${escapeHtml(variantsPerUnit)} 个</span>
        <span>角色资产：${escapeHtml(policy.roleAssetMinimum || 0)} 个</span>
        <span>补充任务：${escapeHtml(policy.supplementalJobs || 0)} 个</span>
        <span>目标总量：${escapeHtml(policy.totalPlannedImageJobs || policy.targetTotal || 0)} 个</span>
        ${renderIpScriptMatchSamples(policy)}
        <em>${escapeHtml(policy.upgradedLogic || "优先按口播单元规划更多角色资产和页面变体，生成端可按质量下选。")}</em>
      </div>
    </div>
  </div>`;
}

function renderWhiteboardMotionPane(model) {
  const artifacts = model.whiteboard.previewArtifacts || {};
  const previewVideo = artifacts.validatedPocVideo?.html || "";
  const previewPoster = artifacts.validatedPocPoster?.html || artifacts.validatedPocFinalFrame?.html || "";
  return `<div class="whiteboard-layout motion-detail-grid">
    <div class="whiteboard-skill-preview" data-whiteboard-skill-preview aria-label="白板视频 Skill 真实预览">
      <div class="whiteboard-video-frame">
        ${previewVideo ? `<video src="${escapeHtml(previewVideo)}" ${previewPoster ? `poster="${escapeHtml(previewPoster)}"` : ""} autoplay muted loop playsinline controls></video>` : `<div class="whiteboard-video-missing">未找到白板 POC 视频</div>`}
      </div>
      <div class="whiteboard-proof-strip">
        <span>已验证 POC</span>
        <span>1920x1080 / 30fps</span>
        <span>字幕最后合成</span>
      </div>
      <div class="whiteboard-layer-stack">
        ${model.whiteboard.layerOrder.map((layer) => `
          <article>
            <small>${escapeHtml(layer.owner)}</small>
            <strong>${escapeHtml(layer.label)}</strong>
            <em>${escapeHtml(layer.rule)}</em>
          </article>`).join("")}
      </div>
    </div>
    <div class="whiteboard-mode-list">
      <div class="whiteboard-source-card">
        <b>能力来源</b>
        <span>适配层：${escapeHtml(model.whiteboard.sourceSkill)}</span>
        <span>描线引擎：${escapeHtml(model.whiteboard.sourceEngine)}</span>
        <em>${escapeHtml(model.whiteboard.activationScope)}</em>
      </div>
      ${model.whiteboard.modes.map((mode) => `
        <article class="whiteboard-mode-row">
          <span>
            <strong>${escapeHtml(mode.label)}</strong>
            <em>${escapeHtml(mode.description)}</em>
          </span>
        </article>`).join("")}
      <p>${escapeHtml(model.whiteboard.layerPolicy)}</p>
    </div>
  </div>`;
}

function renderMotionPreviewDialog() {
  return `<dialog class="motion-preview-dialog" data-motion-preview-modal>
    <form method="dialog">
      <button type="submit" aria-label="关闭">×</button>
    </form>
    <div class="motion-preview-dialog-body">
      <div class="motion-preview-zoom" data-motion-preview-frame></div>
      <div class="motion-preview-dialog-copy">
        <small data-motion-preview-meta></small>
        <h3 data-motion-preview-title>动效预览</h3>
        <p data-motion-preview-description></p>
      </div>
    </div>
  </dialog>`;
}

function motionStyleColor(template) {
  const familyColors = [
    "#315d86", "#4d7b6f", "#9a673f", "#6d4e68", "#2f82a2",
    "#58724c", "#a84735", "#3f6d7a", "#7b6042", "#5f6f7b",
  ];
  const variantColors = {
    "calm-premium": "#6f8d83",
    "editorial-contrast": "#a84735",
    "glass-product": "#3f86be",
    "warm-paper": "#b27744",
    "bright-clean": "#30c48d",
  };
  return variantColors[template.variantId] || familyColors[Number(template.familyIndex || 0) % familyColors.length];
}

function renderStyleExampleMarkup(template) {
  const example = template.example || {};
  const kind = example.kind || "claim-split";
  const label = escapeHtml(compactText(example.previewTitle || template.familyLabelZh || "页面示例", 12));
  const type = escapeHtml(compactText(example.contentType || "内容页", 8));
  const steps = arrayify(example.choreography).length ? arrayify(example.choreography) : arrayify(template.animationSteps);
  const stepA = escapeHtml(compactText(steps[0] || "入场", 7));
  const stepB = escapeHtml(compactText(steps[1] || "高亮", 7));
  const stepC = escapeHtml(compactText(steps[2] || "锁定", 7));
  const common = `
    <defs>
      <marker id="arrow-${escapeHtml(template.id)}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="var(--style-accent)"/>
      </marker>
    </defs>`;
  const text = (x, y, content, cls = "ex-text") => `<text x="${x}" y="${y}" class="${cls}">${escapeHtml(content)}</text>`;
  const panel = (x, y, width, height, cls = "ex-panel") => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" class="${cls}"/>`;
  const line = (x1, y1, x2, y2, cls = "ex-line") => `<path d="M${x1} ${y1}L${x2} ${y2}" class="${cls}" marker-end="url(#arrow-${escapeHtml(template.id)})"/>`;
  const variantOverlay = ({
    "calm-premium": `
      <rect x="22" y="34" width="276" height="118" rx="12" class="ex-variant-frame"/>
      <path d="M42 150H278" class="ex-variant-guide"/>
      <circle cx="294" cy="36" r="5" class="ex-variant-dot"/>`,
    "editorial-contrast": `
      <rect x="0" y="0" width="82" height="180" class="ex-variant-editorial-band"/>
      <path d="M82 0L132 180" class="ex-variant-editorial-slice"/>
      <text x="18" y="50" class="ex-variant-vertical">裁切</text>
      <path d="M82 34L142 34M82 146L142 146" class="ex-variant-cut"/>`,
    "glass-product": `
      <rect x="198" y="28" width="106" height="104" rx="13" class="ex-variant-glass"/>
      <rect x="216" y="52" width="68" height="18" rx="6" class="ex-variant-glass-chip"/>
      <path d="M216 88H288M216 110H276" class="ex-variant-glass-line"/>`,
    "warm-paper": `
      <rect x="220" y="118" width="70" height="34" rx="8" class="ex-variant-sticky"/>
      <path d="M28 32 C42 24 58 26 72 36" class="ex-variant-hand"/>
      <path d="M226 136 C248 120 272 124 302 140" class="ex-variant-hand"/>
      <text x="236" y="154" class="ex-variant-note">边注</text>`,
    "bright-clean": `
      <rect x="192" y="34" width="118" height="34" rx="12" class="ex-variant-bright-rail"/>
      <rect x="204" y="42" width="20" height="18" rx="6" class="ex-variant-bright a"/>
      <rect x="232" y="42" width="20" height="18" rx="6" class="ex-variant-bright b"/>
      <rect x="260" y="42" width="20" height="18" rx="6" class="ex-variant-bright c"/>`,
  })[template.variantId] || "";
  const cases = {
    "claim-split": `${common}
      ${panel(16, 42, 118, 92, "ex-panel muted")} ${panel(184, 38, 120, 100, "ex-panel")}
      ${text(30, 68, "常见判断", "ex-text muted")} ${text(202, 66, "证据结论")}
      <path d="M40 102H106" class="ex-rule muted"/><path d="M206 96H280" class="ex-rule"/>
      <circle cx="160" cy="92" r="18" class="ex-pulse"/><path d="M148 92H172M160 80V104" class="ex-plus"/>
      <rect x="218" y="112" width="54" height="20" rx="6" class="ex-accent"/><text x="229" y="127" class="ex-chip-text">反转</text>`,
    "process-timeline": `${common}
      <path d="M34 98H286" class="ex-rule"/>
      <circle cx="54" cy="98" r="11" class="ex-node a"/><circle cx="130" cy="98" r="11" class="ex-node b"/><circle cx="206" cy="98" r="11" class="ex-node c"/><circle cx="282" cy="98" r="11" class="ex-node d"/>
      ${panel(38, 42, 84, 34)} ${panel(176, 124, 96, 34, "ex-panel accent")}
      ${text(48, 64, stepA)} ${text(188, 146, stepC, "ex-text light")}
      <path d="M130 72V90M206 106V124" class="ex-line no-arrow"/>`,
    "evidence-board": `${common}
      ${panel(24, 34, 78, 48)} ${panel(218, 36, 76, 48)} ${panel(122, 116, 82, 44, "ex-panel accent")}
      ${text(42, 63, "原因")} ${text(238, 65, "证据")} ${text(142, 144, "结论", "ex-text light")}
      <path d="M102 58 C142 44 180 48 218 60" class="ex-line"/><path d="M248 84 C226 112 206 124 204 134" class="ex-line"/>
      <circle cx="160" cy="90" r="6" class="ex-pulse"/>`,
    "code-walkthrough": `${common}
      ${panel(18, 34, 150, 118, "ex-panel dark")} ${panel(188, 50, 112, 84)}
      <rect x="34" y="54" width="62" height="6" rx="3" class="ex-code-line a"/><rect x="34" y="76" width="104" height="6" rx="3" class="ex-code-line b"/><rect x="52" y="98" width="82" height="6" rx="3" class="ex-code-line c"/><rect x="34" y="120" width="112" height="6" rx="3" class="ex-code-line d"/>
      ${text(202, 78, "run()")}<rect x="202" y="96" width="74" height="18" rx="6" class="ex-accent"/><text x="218" y="110" class="ex-chip-text">输出结果</text>
      ${line(168, 94, 188, 94)}`,
    "data-chart": `${common}
      <path d="M42 136H282M42 136V44" class="ex-axis"/>
      <path d="M54 122 C96 106 114 78 154 88 C194 98 214 62 266 48" class="ex-curve"/>
      <circle cx="154" cy="88" r="7" class="ex-node b"/><circle cx="266" cy="48" r="7" class="ex-node c"/>
      ${panel(184, 108, 92, 34, "ex-panel")} ${text(198, 130, "拐点锁定")}`,
    "typed-thesis": `${common}
      <rect x="0" y="0" width="320" height="180" fill="#141816"/>
      <text x="38" y="72" class="ex-type-text">这段内容</text><text x="38" y="110" class="ex-type-text accent">先给结论</text>
      <rect x="180" y="88" width="4" height="28" class="ex-caret"/>
      <path d="M38 132H246" class="ex-rule light"/>`,
    "whiteboard-method": `${common}
      ${panel(36, 42, 242, 100)}
      <path d="M70 84 C112 54 154 58 184 86 C206 106 232 104 254 78" class="ex-sketch"/>
      <path d="M88 126H162M188 126H244" class="ex-rule"/>
      <circle cx="184" cy="86" r="22" class="ex-sketch-circle"/>
      ${text(76, 66, "Step 1", "ex-text muted")} ${text(196, 150, "回填彩色组件")}`,
    "cover-bridge": `${common}
      ${panel(26, 38, 118, 96, "ex-panel cover")} ${panel(178, 42, 118, 92)}
      <rect x="46" y="60" width="72" height="12" rx="6" class="ex-dark-line"/><rect x="46" y="86" width="46" height="10" rx="5" class="ex-accent"/>
      <circle cx="238" cy="78" r="22" class="ex-node c"/><path d="M210 112H266" class="ex-rule"/>
      ${line(144, 88, 178, 88)} ${text(54, 152, "封面")} ${text(210, 152, "首帧")}`,
    "ip-knowledge-card": `${common}
      <circle cx="66" cy="74" r="24" class="ex-person-head"/><path d="M36 142 C46 104 88 104 98 142" class="ex-person-body"/>
      ${panel(128, 42, 150, 92)}<rect x="148" y="64" width="88" height="10" rx="5" class="ex-dark-line"/><rect x="148" y="90" width="108" height="8" rx="4" class="ex-rule-fill"/><rect x="148" y="112" width="72" height="8" rx="4" class="ex-rule-fill"/>
      <path d="M88 82 C112 66 122 62 138 68" class="ex-line no-arrow"/><circle cx="254" cy="118" r="14" class="ex-node c"/>`,
    "before-after": `${common}
      ${panel(20, 46, 122, 88, "ex-panel muted")} ${panel(178, 42, 122, 96)}
      <path d="M42 82H118M42 108H98" class="ex-rule muted"/><path d="M202 74H270M202 102H282M202 126H246" class="ex-rule"/>
      ${line(142, 90, 178, 90)}<rect x="214" y="136" width="52" height="18" rx="6" class="ex-accent"/><text x="225" y="150" class="ex-chip-text">更清晰</text>`,
    "choice-matrix": `${common}
      <path d="M58 142V38M58 142H276" class="ex-axis"/><path d="M58 90H276M168 142V38" class="ex-rule muted"/>
      <circle cx="104" cy="116" r="8" class="ex-dot muted"/><circle cx="214" cy="66" r="12" class="ex-node c"/><path d="M104 116 C142 112 176 90 214 66" class="ex-line no-arrow"/>
      ${text(184, 52, "优先", "ex-text")} ${text(68, 34, "收益")} ${text(230, 158, "成本")}`,
    "dashboard-inspection": `${common}
      ${panel(20, 34, 280, 118, "ex-panel dark")}
      ${panel(36, 54, 72, 34)} ${panel(124, 54, 72, 34)} ${panel(212, 54, 72, 34)}
      <rect x="42" y="104" width="92" height="28" rx="7" class="ex-accent"/><rect x="148" y="104" width="132" height="8" rx="4" class="ex-rule-fill"/><rect x="148" y="124" width="84" height="8" rx="4" class="ex-rule-fill"/>
      <circle cx="248" cy="70" r="16" class="ex-pulse"/>`,
    "formula-derivation": `${common}
      ${panel(26, 38, 268, 112)}
      <text x="52" y="72" class="ex-formula">A + B = C</text><text x="72" y="108" class="ex-formula small">C - B = A</text><text x="208" y="136" class="ex-formula result">A</text>
      <path d="M174 68 C208 74 216 90 198 106" class="ex-line no-arrow"/><path d="M176 112 C202 118 214 124 220 132" class="ex-line no-arrow"/>
      <rect x="214" y="48" width="46" height="22" rx="7" class="ex-accent"/><text x="225" y="64" class="ex-chip-text">变形</text>`,
    "storyboard-pressure": `${common}
      ${panel(24, 48, 70, 84)} ${panel(124, 48, 70, 84)} ${panel(224, 48, 70, 84)}
      <circle cx="59" cy="82" r="14" class="ex-person-head"/><path d="M44 118 C50 100 68 100 74 118" class="ex-person-body"/>
      <path d="M142 102H176" class="ex-rule"/><path d="M240 74L278 118" class="ex-line red no-arrow"/>
      <path d="M66 148 C112 126 172 126 260 148" class="ex-line red no-arrow"/>`,
    "concept-orbit": `${common}
      <circle cx="160" cy="92" r="34" class="ex-orbit-core"/><text x="140" y="98" class="ex-chip-text">核心</text>
      <ellipse cx="160" cy="92" rx="96" ry="56" class="ex-orbit"/>
      <circle cx="70" cy="92" r="14" class="ex-node a"/><circle cx="160" cy="36" r="14" class="ex-node b"/><circle cx="250" cy="92" r="14" class="ex-node c"/><circle cx="160" cy="148" r="14" class="ex-node d"/>`,
    "material-collage": `${common}
      ${panel(28, 46, 70, 50, "ex-panel media")} ${panel(82, 98, 70, 50, "ex-panel media")} ${panel(168, 42, 112, 88)}
      <rect x="184" y="60" width="76" height="42" rx="8" class="ex-accent"/><path d="M194 118H258" class="ex-rule"/>
      <path d="M98 70 C130 58 148 58 168 72M152 124 C168 118 174 112 184 102" class="ex-line no-arrow"/>`,
    "quote-lockup": `${common}
      <text x="38" y="76" class="ex-quote">“先给结论”</text>
      <rect x="72" y="92" width="92" height="18" rx="7" class="ex-accent"/><text x="90" y="106" class="ex-chip-text">关键词</text>
      <path d="M42 130H278" class="ex-rule"/><circle cx="264" cy="72" r="18" class="ex-pulse"/>`,
    "checklist-gate": `${common}
      ${panel(38, 34, 180, 118)}
      <path d="M60 66H182M60 94H182M60 122H182" class="ex-rule"/>
      <path d="M42 64L50 72L66 52M42 92L50 100L66 80" class="ex-check"/><path d="M42 118L64 140M64 118L42 140" class="ex-cross"/>
      ${line(218, 94, 278, 94)}<rect x="250" y="72" width="42" height="42" rx="10" class="ex-lock"/>`,
    "journey-map": `${common}
      <path d="M42 128 C82 58 126 58 158 104 C188 146 230 130 278 52" class="ex-curve"/>
      <circle cx="42" cy="128" r="9" class="ex-node a"/><circle cx="158" cy="104" r="11" class="ex-node b"/><circle cx="278" cy="52" r="12" class="ex-node c"/>
      ${panel(114, 42, 96, 38)} ${text(128, 66, "当前站点")}`,
    "recap-loop": `${common}
      ${panel(40, 42, 58, 44)} ${panel(132, 42, 58, 44)} ${panel(224, 42, 58, 44)}
      <path d="M76 100 C92 142 228 142 244 100" class="ex-line no-arrow"/><path d="M244 100 L232 106L238 88" class="ex-accent-fill"/>
      ${panel(104, 112, 112, 38, "ex-panel accent")} ${text(124, 136, "行动结论", "ex-text light")}`,
  };
  return `<svg class="style-example-svg" viewBox="0 0 320 180" aria-hidden="true">
    <rect x="0" y="0" width="320" height="180" fill="none"/>
    <text x="16" y="24" class="ex-kicker">${type}</text>
    <text x="16" y="164" class="ex-title">${label}</text>
    ${cases[kind] || cases["claim-split"]}
    ${variantOverlay}
    <text x="244" y="24" class="ex-step">${stepB}</text>
  </svg>`;
}

function styleSceneSpec(template) {
  const example = template.example || {};
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const effect = template.galaceanEffectContract || {};
  const kind = scenario.contentKind || template.contentKind || example.kind || "claim-split";
  const specs = {
    "claim-split": {
      title: "不要让用户自己猜配置",
      support: "左侧保留错误直觉，右侧用证据给出自动规划结果。",
      subtitle: "真正该自动的是审美判断，而不是把选择压力丢给用户。",
      capabilities: ["观点反差", "证据卡", "结论章", "字幕安全区"],
    },
    "process-timeline": {
      title: "题材输入后自动推进",
      support: "从口播解析到页面生成，每个节点按 narration beat 激活。",
      subtitle: "输入题材、生成脚本、选择风格、合成视频。",
      capabilities: ["流程时间线", "节点状态", "步骤动效", "字幕安全区"],
    },
    "evidence-board": {
      title: "为什么这页这样设计",
      support: "原因、证据和结论分开摆放，再用连线解释关系。",
      subtitle: "先看证据，再看结论；页面不再只是漂亮卡片。",
      capabilities: ["证据板", "因果连线", "焦点镜头", "结论锁定"],
    },
    "code-walkthrough": {
      title: "把脚本逻辑跑给观众看",
      support: "左侧代码片段，右侧运行状态，底部给出输出结果。",
      subtitle: "高亮当前执行行，状态变化与口播同步。",
      capabilities: ["代码展示", "运行状态", "结果输出", "局部高亮"],
    },
    "data-chart": {
      title: "色系选择不是拍脑袋",
      support: "用候选色卡和内容属性推导最终视觉系统。",
      subtitle: "自动选择色系后，图表、标签和字幕使用同一套规则。",
      capabilities: ["数据图表", "趋势追踪", "拐点标注", "色系规划"],
    },
    "typed-thesis": {
      title: "风格模板不是封面缩略图",
      support: "开场用一句强命题建立观看承诺，然后进入真实内容页。",
      subtitle: "一页只承担一个核心判断。",
      capabilities: ["打字片头", "命题停顿", "转场承诺", "短句动效"],
    },
    "whiteboard-method": {
      title: "先画关系，再回填信息",
      support: "白板只做前景描线、圈画和语义强调，不替代页面主体。",
      subtitle: "手绘箭头、圈重点、彩色组件回填，字幕保持最上层。",
      capabilities: ["白板描线", "前景层", "彩色回填", "字幕顶层"],
    },
    "cover-bridge": {
      title: "点击承诺必须接到首帧",
      support: "封面主钩子进入第一内容页，避免封面和正文断裂。",
      subtitle: "封面不是片头停留，而是第一秒的视觉承诺。",
      capabilities: ["封面连续性", "首帧承诺", "视觉隐喻", "Image2 提示词"],
    },
    "ip-knowledge-card": {
      title: "固定主讲人讲同一套知识卡",
      support: "人物、知识板和执行角色一一匹配口播单元。",
      subtitle: "先复用已保存人设，再为每个口播单元生成对应图片任务。",
      capabilities: ["个人 IP", "知识卡", "执行角色", "固定人设"],
    },
    "before-after": {
      title: "优化前后要一眼看懂",
      support: "旧状态降低权重，新状态逐步构建，变化点独立高亮。",
      subtitle: "不是换颜色，而是让差异变成可见证据。",
      capabilities: ["前后对照", "状态迁移", "差异高亮", "结果锁定"],
    },
    "choice-matrix": {
      title: "把选择变成坐标判断",
      support: "用收益和成本两条轴解释为什么选这个方案。",
      subtitle: "观众看到的是决策依据，不是大段解释。",
      capabilities: ["策略矩阵", "坐标移动", "方案比较", "风险标注"],
    },
    "dashboard-inspection": {
      title: "从总览扫到关键异常",
      support: "指标卡、焦点面板和行动条组成巡检路径。",
      subtitle: "镜头聚焦到需要动作的那一个指标。",
      capabilities: ["仪表盘", "指标巡检", "焦点缩放", "行动提示"],
    },
    "formula-derivation": {
      title: "公式推导要能看见每一步",
      support: "条件、变形和结果分列展示，当前变化单独高亮。",
      subtitle: "每一次移项都要有理由、有轨迹、有结果。",
      capabilities: ["公式推导", "步骤高亮", "条件锁定", "结果强调"],
    },
    "storyboard-pressure": {
      title: "故事张力来自压力线",
      support: "目标、冲突和代价逐步点亮，压力线推到选择时刻。",
      subtitle: "不复述剧情，只展示结构里的变化。",
      capabilities: ["故事板", "压力线", "角色选择", "代价标记"],
    },
    "concept-orbit": {
      title: "抽象概念需要空间关系",
      support: "核心概念居中，外围模块按轨道建立相对位置。",
      subtitle: "让观众知道每个模块围绕什么运转。",
      capabilities: ["概念轨道", "关系线", "模块分层", "系统解释"],
    },
    "material-collage": {
      title: "素材要服务当前证据",
      support: "素材池先铺开，再选出最能证明这一句口播的主素材。",
      subtitle: "授权素材、生成图和本地视频都要有用途。",
      capabilities: ["视频素材", "素材池", "主素材放大", "合规选择"],
    },
    "quote-lockup": {
      title: "一句话只强调三个关键词",
      support: "短语分段入场，关键词加粗、变色并最终合成完整句。",
      subtitle: "字幕高亮跟随语义，不改变口播原意。",
      capabilities: ["金句排版", "关键词高亮", "字幕强调", "节奏锁定"],
    },
    "checklist-gate": {
      title: "通过条件才进入合成",
      support: "每项门禁都有通过、警告或阻断状态。",
      subtitle: "发现重叠、遮挡、素材缺失时直接阻断。",
      capabilities: ["质量门禁", "勾选状态", "阻断提示", "QC 规则"],
    },
    "journey-map": {
      title: "学习路径要显示当前位置",
      support: "路径线扫描到当前站点，下一步动作单独出现。",
      subtitle: "观众知道现在在哪、下一步去哪。",
      capabilities: ["路径地图", "节点扫描", "阶段卡片", "行动标记"],
    },
    "recap-loop": {
      title: "把前文证据收成行动",
      support: "三个证据回收成一个闭环，最后输出行动结论。",
      subtitle: "结尾只回收已经出现过的信息。",
      capabilities: ["复盘闭环", "证据回收", "行动卡", "结论收束"],
    },
    "table-ranking": {
      title: "让排名理由一眼成立",
      support: "表格按行扫描，冠军行和评分依据同时锁定。",
      subtitle: "排名不是结果截图，而是有口径、有分母、有选择理由。",
      capabilities: ["排行表", "数值条", "选中行", "口径说明"],
    },
    "geo-map": {
      title: "空间差异需要地图证据",
      support: "地图轮廓先建立，再点亮目标区域与指标旁注。",
      subtitle: "先看区域位置，再看指标为什么指向这里。",
      capabilities: ["地理地图", "区域高亮", "指标旁注", "来源脚注"],
    },
    "hierarchy-tree": {
      title: "复杂结构先展开主干",
      support: "根节点、分支节点和当前路径逐层展开。",
      subtitle: "观众要先知道层级，再看这一页讲哪条路径。",
      capabilities: ["层级树", "分支展开", "路径高亮", "结构结论"],
    },
    "network-relationship": {
      title: "从关系网里抽出主链路",
      support: "节点按簇出现，只有当前关系线被点亮。",
      subtitle: "关系图的价值是筛选关键链路，不是制造复杂感。",
      capabilities: ["关系网络", "节点簇", "主链路", "关系解释"],
    },
    "funnel-conversion": {
      title: "漏斗要指出流失发生在哪",
      support: "阶段、转化率、流失点和行动建议同屏呈现。",
      subtitle: "没有分母的漏斗，只是一个装饰形状。",
      capabilities: ["转化漏斗", "阶段口径", "流失标记", "行动建议"],
    },
    "agent-simulation": {
      title: "多角色协作必须看到交接",
      support: "泳道并行推进，任务卡在合并点输出结果。",
      subtitle: "规划、配音、模板和验收各自负责，不互相覆盖。",
      capabilities: ["协作泳道", "任务卡", "并行动效", "合并输出"],
    },
    "screenflow-demo": {
      title: "界面操作要保持连续",
      support: "三屏状态沿同一操作路径切换，焦点光标指向当前动作。",
      subtitle: "产品演示页要像真实点击，而不是堆三张截图。",
      capabilities: ["界面路径", "状态迁移", "点击焦点", "完成徽章"],
    },
    "risk-alert": {
      title: "风险先分诊，再给动作",
      support: "告警等级、影响范围和处理动作按顺序出现。",
      subtitle: "风险表达要准确克制，不靠红色堆满页面。",
      capabilities: ["风险告警", "影响范围", "诊断线索", "处理动作"],
    },
    "source-citation": {
      title: "研究结论必须能追溯",
      support: "来源卡、短引用、解释层和结论章分开呈现。",
      subtitle: "事实、引用和推论要分层，避免把观点伪装成证据。",
      capabilities: ["资料引用", "短引用", "核验章", "推论边界"],
    },
    "voice-sync": {
      title: "语音节奏驱动画面",
      support: "波形、字幕时间点和关键词高亮沿同一时间线对齐。",
      subtitle: "声音选择、方言和字幕强调必须绑定到时间点。",
      capabilities: ["语音波形", "字幕时间点", "关键词高亮", "声音匹配"],
    },
    "comparison-gallery": {
      title: "候选样张要能比较",
      support: "候选墙先铺开，选中样张放大并给出选择理由。",
      subtitle: "风格选择不能只看颜色，要看到结构差异。",
      capabilities: ["样张墙", "选中放大", "选择理由", "淘汰原因"],
    },
    "timeline-calendar": {
      title: "时间信息要落到日期",
      support: "日历格与事件线并排，当前日期和截止点被标注。",
      subtitle: "相对时间必须转换成明确日期或标为示例。",
      capabilities: ["日历格", "事件线", "截止点", "日期标注"],
    },
  };
  const details = {
    "claim-split": {
      pageRole: "反直觉开场页",
      designPrinciple: "左误区、右证据、中心反转",
      proofObject: "自动规划结果卡",
      interaction: "错误直觉先弱化，证据侧被推到视觉中心。",
      motion: "反转按钮入场后，右侧证据卡放大锁定。",
      secondary: "保留一个对照理由和一个结论章，避免多点争夺。",
    },
    "process-timeline": {
      pageRole: "流程解释页",
      designPrinciple: "节点驱动、状态逐步激活",
      proofObject: "从题材到合成的四段流程轨道",
      interaction: "当前节点随口播移动，下一节点保持可预期。",
      motion: "轨道填充、节点脉冲、当前状态卡浮出。",
      secondary: "用进度关系替代内部页码或场景号。",
    },
    "evidence-board": {
      pageRole: "证据推理页",
      designPrinciple: "原因、证据、结论三点成链",
      proofObject: "可追溯的证据板和因果连线",
      interaction: "点击感由卡片聚焦和连线描边模拟。",
      motion: "先钉住原因，再连到证据，最后盖章结论。",
      secondary: "把设计理由留在证据层，避免口号式页面。",
    },
    "code-walkthrough": {
      pageRole: "代码演示页",
      designPrinciple: "当前执行行、运行状态、输出结果同屏",
      proofObject: "高亮代码行与右侧状态面板",
      interaction: "执行行切换时状态面板同步变更。",
      motion: "代码行扫描、状态条填充、输出条入场。",
      secondary: "代码只保留能解释当前口播的四行。",
    },
    "data-chart": {
      pageRole: "数据判断页",
      designPrinciple: "指标、曲线、拐点说明三层分离",
      proofObject: "趋势曲线与自动匹配分数",
      interaction: "拐点被点亮后，解释卡贴近关键位置。",
      motion: "坐标轴先立住，曲线描边，关键点弹出。",
      secondary: "色系和图表共享同一组强调色。",
    },
    "typed-thesis": {
      pageRole: "命题片头页",
      designPrinciple: "一句话先建立观看承诺",
      proofObject: "强命题文字和节奏光标",
      interaction: "打字完成后进入下一页，不停留成封面。",
      motion: "逐字输入、停顿、短促转场。",
      secondary: "只展示主判断，不塞解释段落。",
    },
    "whiteboard-method": {
      pageRole: "白板前景页",
      designPrinciple: "背景由框架控制，手绘只做语义前景",
      proofObject: "描线路径、圈画重点和彩色回填",
      interaction: "圈画动作跟随当前概念，不替代排版层。",
      motion: "先描主关系，再圈重点，最后回填精确组件。",
      secondary: "字幕始终在最上层并避开画线区域。",
    },
    "cover-bridge": {
      pageRole: "封面承诺衔接页",
      designPrinciple: "封面钩子直接接到第一屏内容",
      proofObject: "封面主钩子与首帧内容板",
      interaction: "封面对象变成首帧证明对象。",
      motion: "封面主元素收束到内容页焦点。",
      secondary: "不把封面当静态片头强行停留。",
    },
    "ip-knowledge-card": {
      pageRole: "个人 IP 讲解页",
      designPrinciple: "固定主讲人、知识卡、执行角色一一匹配",
      proofObject: "同一人设与当前口播单元知识卡",
      interaction: "主讲姿态与知识卡状态按句子切换。",
      motion: "人物轻动作、知识卡翻入、重点手绘标注。",
      secondary: "每个口播单元至少保留主图任务和补充任务。",
    },
    "before-after": {
      pageRole: "前后对比页",
      designPrinciple: "弱旧态、强新态、变化点独立高亮",
      proofObject: "优化前后两块页面样本",
      interaction: "滑块式对照让观众主动感知差异。",
      motion: "旧态退后，新态推进，差异点逐个亮起。",
      secondary: "对比文案短，不抢主视觉。",
    },
    "choice-matrix": {
      pageRole: "策略选择页",
      designPrinciple: "坐标化解释选择依据",
      proofObject: "收益成本矩阵和目标象限",
      interaction: "候选点移动到最终象限。",
      motion: "坐标轴建立、候选点入场、选中点放大。",
      secondary: "用象限解释为什么不是纯人工选择。",
    },
    "dashboard-inspection": {
      pageRole: "巡检决策页",
      designPrinciple: "先看总览，再聚焦异常和动作",
      proofObject: "指标卡、焦点面板和下一步行动",
      interaction: "选中指标驱动下方面板切换。",
      motion: "卡片扫描、异常聚焦、行动条锁定。",
      secondary: "指标数量受控，避免仪表盘堆砌。",
    },
    "formula-derivation": {
      pageRole: "公式推导页",
      designPrinciple: "条件、变形、结果一步一屏内完成",
      proofObject: "推导链路和当前变形结果",
      interaction: "当前步骤被高亮，前后步骤降权。",
      motion: "公式项位移、箭头显现、结果加粗。",
      secondary: "每一步都有理由，不只展示最终答案。",
    },
    "storyboard-pressure": {
      pageRole: "故事结构页",
      designPrinciple: "目标、冲突、代价形成压力线",
      proofObject: "三格故事板和压力曲线",
      interaction: "压力线推进到选择节点。",
      motion: "场景格逐步点亮，压力线扫过。",
      secondary: "不复述剧情，把结构变化可视化。",
    },
    "concept-orbit": {
      pageRole: "概念系统页",
      designPrinciple: "核心居中，模块按关系围绕",
      proofObject: "中心概念与四个关系轨道",
      interaction: "外围模块围绕核心依次激活。",
      motion: "轨道旋转、模块脉冲、关系线短亮。",
      secondary: "避免抽象概念散成随机卡片。",
    },
    "material-collage": {
      pageRole: "素材证据页",
      designPrinciple: "素材池铺开，主素材放大证明当前句子",
      proofObject: "本地视频、生成图、授权素材候选",
      interaction: "候选素材被筛选成当前主素材。",
      motion: "素材缩略图入场、主素材放大、证据标签贴合。",
      secondary: "所有素材都有口播句子的用途。",
    },
    "quote-lockup": {
      pageRole: "金句强调页",
      designPrinciple: "短句、关键词、语义强调三层",
      proofObject: "主金句与关键词高亮",
      interaction: "关键词跟随口播重音切换。",
      motion: "短语分段入场，关键词色块扫过。",
      secondary: "不改写口播，只改变可视重点。",
    },
    "checklist-gate": {
      pageRole: "质量门禁页",
      designPrinciple: "通过、警告、阻断状态分明",
      proofObject: "合成前检查项与阻断提示",
      interaction: "状态变化决定能否继续合成。",
      motion: "勾选逐项点亮，警告项抖动提示。",
      secondary: "验证项写成用户能理解的结果。",
    },
    "journey-map": {
      pageRole: "学习路径页",
      designPrinciple: "当前位置和下一步行动清晰",
      proofObject: "路径线、当前站点和下一步卡",
      interaction: "路径扫描停在当前站点。",
      motion: "路径绘制、站点弹出、行动卡入场。",
      secondary: "进度是故事状态，不是内部页码。",
    },
    "recap-loop": {
      pageRole: "复盘收束页",
      designPrinciple: "前文证据回收成行动结论",
      proofObject: "内容、设计、动效三证据闭环",
      interaction: "三块证据汇入行动卡。",
      motion: "证据卡回收、闭环箭头、结论锁定。",
      secondary: "只回收出现过的信息，不新增概念。",
    },
    "table-ranking": {
      pageRole: "排行决策页",
      designPrinciple: "排名、数值、依据同步呈现",
      proofObject: "冠军行、数值条和评分口径",
      interaction: "表格扫描后锁定最佳行。",
      motion: "表头建立、行扫描、选中行放大。",
      secondary: "用可解释指标替代主观推荐。",
    },
    "geo-map": {
      pageRole: "空间判断页",
      designPrinciple: "地图只服务区域差异",
      proofObject: "目标区域、指标旁注和来源脚注",
      interaction: "镜头从全局推到当前区域。",
      motion: "轮廓显现、区域点亮、旁注连线。",
      secondary: "示意地图必须标明示意，不伪造边界。",
    },
    "hierarchy-tree": {
      pageRole: "层级结构页",
      designPrinciple: "先主干，再分支，再路径",
      proofObject: "根节点、分支和当前路径",
      interaction: "点击感由分支展开和路径高亮模拟。",
      motion: "根节点锁定、分支展开、路径收束。",
      secondary: "层级不超过三层，避免树变成正文墙。",
    },
    "network-relationship": {
      pageRole: "关系网络页",
      designPrinciple: "从复杂网络中隔离主链路",
      proofObject: "节点簇、激活边和主链路",
      interaction: "关系线按口播逐条点亮。",
      motion: "节点成簇、边线点亮、主链路加粗。",
      secondary: "每条关系都必须解释方向和含义。",
    },
    "funnel-conversion": {
      pageRole: "转化诊断页",
      designPrinciple: "阶段口径和流失点同屏",
      proofObject: "漏斗段、转化率和行动建议",
      interaction: "每段漏斗收窄后显示损耗。",
      motion: "阶段入场、比例填充、动作卡出现。",
      secondary: "分母和口径必须可见。",
    },
    "agent-simulation": {
      pageRole: "协作流程页",
      designPrinciple: "职责泳道、任务流转、合并输出",
      proofObject: "四条协作泳道和合并结果",
      interaction: "任务卡沿泳道移动并交接。",
      motion: "泳道建立、任务并行、结果合并。",
      secondary: "显示分工，不把执行角色画成装饰图标。",
    },
    "screenflow-demo": {
      pageRole: "界面路径页",
      designPrinciple: "连续状态比截图堆叠更重要",
      proofObject: "三屏状态和当前点击焦点",
      interaction: "焦点光标触发下一屏状态。",
      motion: "屏幕切换、焦点点击、完成徽章落位。",
      secondary: "保护隐私和真实数据。",
    },
    "risk-alert": {
      pageRole: "风险诊断页",
      designPrinciple: "等级、影响、处理三段式",
      proofObject: "风险等级、影响区和处理动作",
      interaction: "分诊结果决定动作卡是否出现。",
      motion: "告警弹出、影响描边、动作锁定。",
      secondary: "准确克制，不夸大。",
    },
    "source-citation": {
      pageRole: "资料核验页",
      designPrinciple: "事实、引用、推论分层",
      proofObject: "来源卡、短引用和结论章",
      interaction: "引用片段从资料卡抽出。",
      motion: "资料堆叠、引用抽出、核验盖章。",
      secondary: "引用短而精确，避免长文复制。",
    },
    "voice-sync": {
      pageRole: "语音同步页",
      designPrinciple: "波形、字幕、关键词同轴对齐",
      proofObject: "语音波形、时间点块和高亮词",
      interaction: "播放头扫过时字幕块点亮。",
      motion: "波形扫过、时间点点亮、关键词加粗。",
      secondary: "不显示内部配音引擎或技术栈名。",
    },
    "comparison-gallery": {
      pageRole: "样张审核页",
      designPrinciple: "候选差异和选择理由同屏",
      proofObject: "候选墙、选中样张和理由条",
      interaction: "点击样张后放大并保留上下文。",
      motion: "候选铺开、选中放大、理由入场。",
      secondary: "候选差异要真实，不只是换颜色。",
    },
    "timeline-calendar": {
      pageRole: "日期事件页",
      designPrinciple: "日历格和事件线互相校验",
      proofObject: "当前日期、事件线和截止点",
      interaction: "事件线推进到当前日期。",
      motion: "日历显现、事件推进、截止点高亮。",
      secondary: "日期要写绝对值，避免相对词误导。",
    },
  };
  const baseSpec = specs[kind] || specs["claim-split"];
  const detail = details[kind] || details["claim-split"];
  const layoutModes = {
    "claim-split": "proof-arena",
    "process-timeline": "flow-lane",
    "evidence-board": "proof-arena",
    "code-walkthrough": "split-workbench",
    "data-chart": "data-stage",
    "typed-thesis": "full-poster",
    "whiteboard-method": "sketch-canvas",
    "cover-bridge": "cover-continuity",
    "ip-knowledge-card": "persona-board",
    "before-after": "comparison-stage",
    "choice-matrix": "coordinate-stage",
    "dashboard-inspection": "dashboard-stage",
    "formula-derivation": "math-canvas",
    "storyboard-pressure": "cinematic-board",
    "concept-orbit": "orbit-stage",
    "material-collage": "media-stage",
    "quote-lockup": "editorial-poster",
    "checklist-gate": "gate-stage",
    "journey-map": "map-stage",
    "recap-loop": "recap-stage",
    "table-ranking": "ranking-stage",
    "geo-map": "geo-stage",
    "hierarchy-tree": "tree-stage",
    "network-relationship": "network-stage",
    "funnel-conversion": "funnel-stage",
    "agent-simulation": "agent-lane-stage",
    "screenflow-demo": "screenflow-stage",
    "risk-alert": "alert-stage",
    "source-citation": "citation-stage",
    "voice-sync": "audio-stage",
    "comparison-gallery": "gallery-stage",
    "timeline-calendar": "calendar-stage",
  };
  const textModes = {
    "claim-split": "kinetic-poster",
    "process-timeline": "product-ui",
    "evidence-board": "editorial-display",
    "code-walkthrough": "code-terminal",
    "data-chart": "data-mono",
    "typed-thesis": "kinetic-poster",
    "whiteboard-method": "warm-annotation",
    "cover-bridge": "cover-hook",
    "ip-knowledge-card": "warm-annotation",
    "before-after": "comparison-slab",
    "choice-matrix": "math-coordinate",
    "dashboard-inspection": "data-mono",
    "formula-derivation": "math-coordinate",
    "storyboard-pressure": "cinematic-title",
    "concept-orbit": "system-label",
    "material-collage": "media-caption",
    "quote-lockup": "editorial-display",
    "checklist-gate": "product-ui",
    "journey-map": "map-label",
    "recap-loop": "summary-lockup",
    "table-ranking": "data-mono",
    "geo-map": "map-label",
    "hierarchy-tree": "product-ui",
    "network-relationship": "system-label",
    "funnel-conversion": "data-mono",
    "agent-simulation": "product-ui",
    "screenflow-demo": "product-ui",
    "risk-alert": "alert-editorial",
    "source-citation": "editorial-display",
    "voice-sync": "audio-caption",
    "comparison-gallery": "editorial-display",
    "timeline-calendar": "map-label",
  };
  return {
    ...baseSpec,
    ...detail,
    title: scenario.pageTitle || baseSpec.title,
    support: scenario.usageScene || scenario.useCase || baseSpec.support,
    subtitle: scenario.videoSubtitle || baseSpec.subtitle,
    proofObject: scenario.primaryEvidence || detail.proofObject,
    secondary: sourcePlan.label
      ? `来源/口径：${sourcePlan.label}`
      : detail.secondary,
    interaction: scenario.useCase || detail.interaction,
    motion: effect.semanticJob
      ? `${detail.motion}；效果层只服务当前语义，不覆盖文字。`
      : detail.motion,
    capabilities: [...new Set([
      ...arrayify(baseSpec.capabilities),
      "真实场景",
      sourcePlan.mode ? "数据口径" : "",
      effect.capabilityId ? "效果层" : "",
    ].filter(Boolean))],
    layoutMode: layoutModes[kind] || "proof-arena",
    textMode: textModes[kind] || "product-ui",
    qualityChecks: ["无文字重叠", "字幕安全区", "主视觉第一眼", "动效服务语义"],
  };
}

function renderStyleSceneBoard(template) {
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const kind = scenario.contentKind || template.contentKind || template.example?.kind || "claim-split";
  const card = (label, value, cls = "") => `<div class="style-frame-card ${cls}" data-critical-layer="card"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`;
  const codeLines = ["parseBrief(input)", "selectTemplate(kind)", "bindEffects(scene)", "renderFrame()"];
  const cases = {
    "claim-split": `<div class="style-claim-grid">
      <div class="style-frame-card muted claim-card-left">
        <b>错误直觉</b><span>用户自己选才高级</span>
        <i></i><i></i><i></i>
      </div>
      <div class="style-flip-action"><span>反转</span></div>
      <div class="style-frame-card strong claim-card-right">
        <b>证据结论</b><span>系统先选，用户再微调</span>
        <em>色系 / 动效 / 字幕 / 素材 已绑定</em>
      </div>
      <div class="claim-proof-tape"><span>主题识别</span><span>页面骨架</span><span>字幕安全</span></div>
    </div>`,
    "process-timeline": `<div class="style-flow-board">
      <div class="flow-title"><b>口播稿驱动的数据流</b><span>主题解析到视频合成</span></div>
      <div class="flow-lane">
        ${["题材输入", "脚本分句", "页面任务", "素材绑定", "合成输出"].map((item, index) => `<span class="flow-node f${index + 1}"><b>${escapeHtml(item)}</b><em>${escapeHtml(["brief", "beats", "frames", "assets", "video"][index])}</em></span>`).join("")}
        <i class="flow-rail"></i>
      </div>
      <div class="flow-packets"><i></i><i></i><i></i></div>
      ${card("当前节点", "第 3 句口播匹配数据图表页", "floating flow-note")}
    </div>`,
    "evidence-board": `<div class="style-proof-board">
      ${card("原因", "模板只换色", "pin a")}
      ${card("证据", "骨架与内容脱节", "pin b")}
      ${card("结论", "改成真实页面模拟", "pin c strong")}
      <svg viewBox="0 0 520 260"><path d="M120 90 C210 36 318 42 410 92M410 116 C350 178 260 190 170 176" /></svg>
    </div>`,
    "code-walkthrough": `<div class="style-code-board">
      <div class="code-editor">${codeLines.map((line, index) => `<span class="${index === 1 ? "active" : ""}"><em>${String(index + 1).padStart(2, "0")}</em>${escapeHtml(line)}</span>`).join("")}</div>
      <div class="run-panel"><b>运行状态</b><i></i><span>色系已匹配</span><span>动效已绑定</span></div>
      <div class="output-panel">输出：页面可直接进入视频帧</div>
    </div>`,
    "data-chart": `<div class="style-data-board gdp-chart-board">
      <div class="kpi-card" data-critical-layer="card"><b>World Bank</b><span>GDP</span><em>current US$ / 2019-2025</em></div>
      <svg class="gdp-chart" viewBox="0 0 640 320" aria-hidden="true">
        <path class="axis" d="M72 260H570M72 260V54"/>
        <path class="grid" d="M72 214H570M72 168H570M72 122H570M72 76H570"/>
        <path class="curve country-us" d="M86 146C166 136 246 120 326 98C408 76 498 58 560 42"/>
        <path class="curve country-cn" d="M86 214C166 194 248 172 326 150C408 134 498 124 560 118"/>
        <path class="curve country-de" d="M86 248C166 242 246 238 326 232C408 224 498 214 560 206"/>
        <path class="curve country-in" d="M86 260C166 254 246 248 326 238C408 228 498 216 560 212"/>
        <circle class="country-point" cx="560" cy="42" r="8"/><circle class="country-point second" cx="560" cy="118" r="7"/>
        <text x="82" y="282" class="axis-label">2019</text><text x="522" y="282" class="axis-label">2025</text><text x="26" y="60" class="axis-label">万亿美元</text>
        <text x="474" y="38" class="gdp-label us">美国 30.77T</text><text x="454" y="114" class="gdp-label">中国 19.50T</text><text x="442" y="206" class="gdp-label de">德国 5.05T</text><text x="448" y="232" class="gdp-label india">印度 3.96T</text>
      </svg>
      <div class="gdp-legend"><span class="us">美国</span><span class="cn">中国</span><span class="in">印度</span><span class="de">德国</span></div>
      ${card("口径", compactText(sourcePlan.label || "World Bank GDP current US$ 2019-2025", 34), "chart-note")}
    </div>`,
    "typed-thesis": `<div class="style-type-board poster-type-board"><strong>风格模板</strong><span>决定真实视频页怎么呈现</span><em>不是缩略图，而是一帧可合成画面</em><i></i></div>`,
    "whiteboard-method": `<div class="style-whiteboard-board">
      <svg viewBox="0 0 560 260"><path class="sketch" d="M70 166C118 78 208 74 268 142C318 198 410 170 482 80"/><path class="mark" d="M224 112C262 86 316 88 348 122"/><path class="mark" d="M116 184H224M348 184H460"/></svg>
      ${card("描线", "只画语义前景", "wb a")}
      ${card("回填", "精确文字和颜色在上层", "wb b strong")}
    </div>`,
    "cover-bridge": `<div class="style-cover-board">
      <div class="cover-mini"><b>自动生成不是堆模板</b><span>封面承诺</span></div>
      <div class="bridge-arrow"></div>
      ${card("首帧内容", "用同一视觉主体兑现承诺", "strong")}
    </div>`,
    "ip-knowledge-card": `<div class="style-ip-board">
      <div class="presenter"><i></i><b></b><span></span></div>
      ${card("知识卡", "每个口播单元一张主图", "knowledge strong")}
      <div class="agent-stack"><span>拆解</span><span>圈画</span><span>补证</span></div>
    </div>`,
    "before-after": `<div class="style-before-after-board">
      ${card("优化前", "简化卡片 / 信息少", "muted")}
      <div class="bridge-arrow"></div>
      ${card("优化后", "页面、交互、动效一起设计", "strong")}
    </div>`,
    "choice-matrix": `<div class="style-matrix-board coordinate-board">
      <svg viewBox="0 0 560 300" aria-hidden="true">
        <path class="coord-grid" d="M80 40V250M160 40V250M240 40V250M320 40V250M400 40V250M480 40V250M56 70H516M56 120H516M56 170H516M56 220H516"/>
        <path class="coord-axis" d="M56 220H520M120 254V36"/>
        <text x="498" y="244" class="coord-axis-label">X 轴：实现成本</text>
        <text x="28" y="50" class="coord-axis-label">Y 轴：表达收益</text>
        <circle class="coord-point muted" cx="198" cy="178" r="10"/><text x="212" y="183" class="coord-label">模板 A</text>
        <circle class="coord-point muted" cx="322" cy="146" r="10"/><text x="336" y="151" class="coord-label">模板 B</text>
        <circle class="coord-point selected" cx="416" cy="82" r="14"/><text x="432" y="88" class="coord-label selected">目标象限</text>
        <path class="coord-path" d="M198 178C260 166 338 124 416 82"/>
      </svg>
      ${card("坐标判断", "高收益、可实现的方案自动进入目标象限", "matrix-note")}
    </div>`,
    "dashboard-inspection": `<div class="style-dashboard-board">
      ${["字幕", "色系", "动效"].map((item, index) => card(item, index === 1 ? "自动已选" : "待校验", index === 1 ? "metric active" : "metric")).join("")}
      <div class="focus-panel"><b>下一步动作</b><span>进入完整生成流程验证</span></div>
    </div>`,
    "formula-derivation": `<div class="style-formula-board formula-canvas">
      <div class="formula-chain"><span>y = ax^2 + bx + c</span><i>求导</i><span>y' = 2ax + b</span><i>令 0</i><b>x = -b / 2a</b></div>
      <svg viewBox="0 0 560 240" aria-hidden="true">
        <path class="coord-grid" d="M78 34V206M154 34V206M230 34V206M306 34V206M382 34V206M458 34V206M56 64H500M56 108H500M56 152H500M56 196H500"/>
        <path class="coord-axis" d="M56 184H512M278 210V30"/>
        <path class="parabola-line" d="M92 54C168 196 378 196 468 54"/>
        <circle class="vertex-dot" cx="278" cy="184" r="8"/>
        <text x="292" y="178" class="coord-label selected">顶点</text>
      </svg>
    </div>`,
    "storyboard-pressure": `<div class="style-story-board">
      ${["目标", "冲突", "代价"].map((item) => card(item, item === "冲突" ? "选择压力上升" : "结构节点")).join("")}
      <svg viewBox="0 0 560 260"><path d="M60 206C156 174 252 150 344 96C410 58 462 50 508 42"/></svg>
    </div>`,
    "concept-orbit": `<div class="style-orbit-board">
      <div class="orbit-core">视频页</div>
      ${["内容", "设计", "交互", "动画"].map((item, index) => `<span class="orb o${index + 1}">${escapeHtml(item)}</span>`).join("")}
    </div>`,
    "material-collage": `<div class="style-material-board media-flow-board">
      ${["本地视频", "Image2 生成图", "免费授权素材"].map((item, index) => `<div class="media-tile t${index + 1}"><i></i><b>${escapeHtml(item)}</b><span>${escapeHtml(["12 秒 B-roll", "封面连续主体", "补充环境证据"][index])}</span></div>`).join("")}
      <div class="media-flow-line"><i></i><i></i><i></i></div>
      ${card("主素材", "优先选最能证明当前口播的一段，其他素材只做补证", "material-note strong")}
    </div>`,
    "quote-lockup": `<div class="style-quote-board editorial-quote-board"><strong>“自动规划”</strong><span>不是减少选择，而是减少低质量选择</span><b>关键词高亮</b><em>词组分段 / 色块扫过 / 语义停顿</em></div>`,
    "checklist-gate": `<div class="style-gate-board">
      ${["无重叠", "字幕安全", "素材匹配"].map((item, index) => `<span class="${index === 2 ? "warn" : ""}">${escapeHtml(item)}</span>`).join("")}
      ${card("合成判断", "全部通过后输出视频", "gate-note strong")}
    </div>`,
    "journey-map": `<div class="style-journey-board">
      <svg viewBox="0 0 560 260"><path d="M60 198C134 72 226 72 282 150C342 232 424 152 502 54"/></svg>
      ${card("当前位置", "页面风格审核", "journey-note strong")}
    </div>`,
    "recap-loop": `<div class="style-recap-board">
      ${["内容", "设计", "动效"].map((item) => card(item, "已绑定")).join("")}
      <div class="loop-card">输出可验证的视频页</div>
    </div>`,
    "table-ranking": `<div class="style-ranking-board">
      <div class="rank-head" data-critical-layer="card"><b>2025 GDP 排行</b><span>口径：current US$ / World Bank</span></div>
      ${[
        ["01", "美国", "30.77T", "current US$"],
        ["02", "中国", "19.50T", "current US$"],
        ["03", "德国", "5.05T", "current US$"],
        ["04", "日本", "4.44T", "current US$"],
        ["05", "印度", "3.96T", "current US$"],
      ].map(([rank, name, score, note], index) => `<div class="rank-row r${index + 1}">
        <b>${escapeHtml(rank)}</b><span>${escapeHtml(name)}</span><i style="--score:${escapeHtml(String(Math.max(12, Math.min(100, Number.parseFloat(score) * 3))))}%"></i><em>${escapeHtml(score)}</em><small>${escapeHtml(note)}</small>
      </div>`).join("")}
      ${card("排名依据", compactText(sourcePlan.label || "World Bank GDP current US$ 2025", 34), "ranking-note strong")}
    </div>`,
    "geo-map": `<div class="style-geo-board">
      <svg viewBox="0 0 620 320" aria-hidden="true">
        <path class="geo-land main" d="M92 96C152 42 244 58 280 104C326 162 410 118 472 158C528 194 514 260 430 278C342 298 270 250 198 266C120 282 44 236 54 170C58 142 70 118 92 96Z"/>
        <path class="geo-region active" d="M260 116C306 82 374 98 392 138C412 184 358 214 304 194C252 174 224 142 260 116Z"/>
        <path class="geo-region" d="M126 122C160 94 208 102 222 138C236 176 198 202 156 190C118 178 98 146 126 122Z"/>
        <circle class="geo-dot" cx="322" cy="150" r="14"/><circle class="geo-dot second" cx="166" cy="156" r="12"/><circle class="geo-dot third" cx="438" cy="218" r="7"/>
        <path class="geo-callout-line" d="M334 150C406 118 468 92 528 76"/>
        <text x="398" y="70" class="geo-label">印度 14.64 亿 / 中国 14.07 亿</text>
        <text x="82" y="296" class="geo-source">World Bank 2025 人口总量；地图为区域示意</text>
      </svg>
      ${card("空间结论", compactText(sourcePlan.label || "World Bank Population total 2025", 34), "geo-note strong")}
    </div>`,
    "hierarchy-tree": `<div class="style-tree-board">
      <div class="tree-node root">视频生成</div>
      <div class="tree-row level1"><span>规划层</span><span class="active">模板层</span><span>验收层</span></div>
      <div class="tree-row level2"><span>内容骨架</span><span class="active">动效层</span><span>QC 门禁</span></div>
      <svg viewBox="0 0 620 320" aria-hidden="true"><path d="M310 74V118M156 118H464M310 118V164M198 164H426" class="tree-line"/><path d="M310 118C350 142 390 146 426 164" class="tree-line active"/></svg>
      ${card("当前路径", "模板层 → 动效层：决定页面怎么动、哪些层不能重叠", "tree-note strong")}
    </div>`,
    "network-relationship": `<div class="style-network-board">
      <svg viewBox="0 0 620 320" aria-hidden="true">
        <path class="net-edge muted" d="M122 160L220 94M220 94L324 150M324 150L452 86M324 150L478 224M122 160L276 238M276 238L478 224"/>
        <path class="net-edge active" d="M122 160C198 110 258 112 324 150C380 182 422 204 478 224"/>
        ${[[122,160,"脚本"],[220,94,"色系"],[324,150,"模板"],[452,86,"素材"],[478,224,"成片"],[276,238,"字幕"]].map(([x,y,label], index) => `<g class="net-node n${index + 1}"><circle cx="${x}" cy="${y}" r="${index === 2 ? 24 : 18}"/><text x="${Number(x) - 18}" y="${Number(y) + 5}">${escapeHtml(label)}</text></g>`).join("")}
      </svg>
      ${card("主链路", "脚本语义先决定模板，再把素材、字幕和成片 QC 串起来", "network-note strong")}
    </div>`,
    "funnel-conversion": `<div class="style-funnel-board">
      ${[
        ["题材输入", "1000", "100%"],
        ["脚本成页", "720", "72%"],
        ["素材匹配", "510", "51%"],
        ["QC 通过", "430", "43%"],
      ].map(([label, count, rate], index) => `<div class="funnel-stage f${index + 1}">
        <b>${escapeHtml(label)}</b><span>${escapeHtml(count)}</span><em>${escapeHtml(rate)}</em>
      </div>`).join("")}
      <div class="funnel-drop">最大流失：素材匹配</div>
      ${card("下一步动作", "补齐本地素材与 Image2 任务，减少页面空画面", "funnel-note strong")}
    </div>`,
    "agent-simulation": `<div class="style-agent-board">
      ${["规划层", "配音层", "模板层", "验收层"].map((lane, index) => `<div class="agent-lane l${index + 1}"><b>${escapeHtml(lane)}</b><span>${escapeHtml(["拆页", "时间点", "选模板", "验收"][index])}</span><i></i></div>`).join("")}
      <svg viewBox="0 0 620 320" aria-hidden="true"><path class="agent-flow" d="M122 78C210 78 236 126 310 126C392 126 414 214 506 214"/><path class="agent-flow second" d="M122 240C210 240 230 178 310 178C388 178 420 126 506 126"/></svg>
      ${card("合并输出", "页面结构、语音时间和 QC 门禁在模板选择产物里合并", "agent-note strong")}
    </div>`,
    "screenflow-demo": `<div class="style-screenflow-board">
      ${["输入题材", "自动规划", "合成确认"].map((label, index) => `<div class="screen-card s${index + 1}"><b>${escapeHtml(label)}</b><i></i><span></span><em>${escapeHtml(index === 1 ? "当前点击" : "状态")}</em></div>`).join("")}
      <div class="tap-cursor"></div>
      ${card("完成状态", "同一操作路径连续切换，不跳到无关界面", "screen-note strong")}
    </div>`,
    "risk-alert": `<div class="style-risk-board">
      <div class="risk-level"><b>中风险</b><span>页面重叠概率上升</span></div>
      <div class="risk-impact"><i></i><b>影响范围</b><span>字幕安全区 / 图表标签 / 角色前景</span></div>
      <div class="risk-thread"><span>定位</span><span>隔离</span><span>修复</span></div>
      ${card("处理动作", "缩略和展开都要通过同一套 overlap audit", "risk-note strong")}
    </div>`,
    "source-citation": `<div class="style-citation-board">
      ${["效果运行层", "World Bank GDP", "World Bank Population"].map((item, index) => `<div class="source-card c${index + 1}" data-critical-layer="card"><b>${escapeHtml(item)}</b><span>${escapeHtml(["动画效果能力", "current US$", "人口总量"][index])}</span></div>`).join("")}
      <div class="quote-fragment" data-critical-layer="card">事实、口径、推论分层呈现</div>
      ${card("核验结论", "来源卡只放证据摘要，长链接进入 workflow source plan", "citation-note strong")}
    </div>`,
    "voice-sync": `<div class="style-voice-board">
      <svg viewBox="0 0 620 240" aria-hidden="true">
        <path class="wave-baseline" d="M54 120H560"/>
        ${Array.from({ length: 34 }, (_, index) => {
          const x = 62 + index * 14;
          const height = 18 + ((index * 17) % 58);
          return `<rect class="wave-bar b${index % 5}" x="${x}" y="${120 - height / 2}" width="7" height="${height}" rx="4"/>`;
        }).join("")}
        <path class="playhead" d="M300 42V198"/>
      </svg>
      <div class="cue-row"><span>中文女声</span><span class="active">关键词高亮</span><span>粤语候选</span></div>
      ${card("同步规则", "波形播放头扫过时间点，字幕关键词同步加粗变色", "voice-note strong")}
    </div>`,
    "comparison-gallery": `<div class="style-gallery-board">
      ${Array.from({ length: 8 }, (_, index) => `<div class="gallery-tile g${index + 1}"><i></i><b>${escapeHtml(index === 2 ? "选中" : `候选 ${index + 1}`)}</b></div>`).join("")}
      <div class="selected-frame">最佳候选</div>
      ${card("选择理由", "结构差异、信息密度和动效语义优先于单纯配色", "gallery-note strong")}
    </div>`,
    "timeline-calendar": `<div class="style-calendar-board">
      <div class="calendar-grid">
        ${Array.from({ length: 21 }, (_, index) => `<span class="${index === 10 ? "today" : index === 16 ? "deadline" : ""}">${escapeHtml(String(index + 1).padStart(2, "0"))}</span>`).join("")}
      </div>
      <div class="event-rail"><i></i><span>2026-07-04 生成模板库</span><em>2026-07-06 自测截止</em></div>
      ${card("日期规则", "相对日期必须写成绝对日期，示例日期必须明确标注", "calendar-note strong")}
    </div>`,
  };
  return cases[kind] || cases["claim-split"];
}

function titleFragments(title) {
  const raw = String(title || "").trim();
  const chunks = raw.match(/[\u4e00-\u9fff]{1,4}|[A-Za-z0-9+.%/_=-]+/g) || [raw];
  return chunks.filter(Boolean).slice(0, 5);
}

function renderDesignedTitle(title, spec = {}) {
  const raw = compactText(title || "页面标题", 18);
  const parts = titleFragments(raw);
  const mode = spec.textMode || "product-ui";
  const modeClass = slug(mode);
  const first = parts[0] || raw;
  const second = parts[1] || parts[0] || raw;
  const rest = parts.slice(2).join("");
  const safeRaw = escapeHtml(raw);
  const phrase = [first, second, rest].filter(Boolean).map((part) => escapeHtml(part));
  const content = {
    "kinetic-poster": `<span class="title-slab main">${phrase[0]}</span><span class="title-slab accent">${phrase.slice(1).join("") || safeRaw}</span>`,
    "editorial-display": `<span class="title-rule"></span><span class="title-large">${safeRaw}</span><span class="title-foot">${escapeHtml(compactText(spec.pageRole || "内容页", 10))}</span>`,
    "data-mono": `<span class="title-metric">GDP</span><span class="title-large">${safeRaw}</span><span class="title-delta">+3.2%</span>`,
    "product-ui": `<span class="title-command">AUTO</span><span class="title-large">${safeRaw}</span>`,
    "warm-annotation": `<span class="title-marker"></span><span class="title-large">${safeRaw}</span><span class="title-note">手写标注层</span>`,
    "math-coordinate": `<span class="title-formula">f(x)</span><span class="title-large">${safeRaw}</span><span class="title-axis">X / Y</span>`,
    "code-terminal": `<span class="title-terminal">$ run</span><span class="title-large">${safeRaw}</span>`,
    "cover-hook": `<span class="title-hook">点击承诺</span><span class="title-large">${safeRaw}</span>`,
    "comparison-slab": `<span class="title-before">Before</span><span class="title-large">${safeRaw}</span><span class="title-after">After</span>`,
    "cinematic-title": `<span class="title-pressure">PRESSURE LINE</span><span class="title-large">${safeRaw}</span>`,
    "system-label": `<span class="title-system">SYSTEM</span><span class="title-large">${safeRaw}</span>`,
    "media-caption": `<span class="title-media">素材证据</span><span class="title-large">${safeRaw}</span>`,
    "map-label": `<span class="title-path">当前位置</span><span class="title-large">${safeRaw}</span>`,
    "summary-lockup": `<span class="title-summary">RECAP</span><span class="title-large">${safeRaw}</span>`,
  }[mode] || `<span class="title-large">${safeRaw}</span>`;
  return `<h4 class="designed-title mode-${escapeHtml(modeClass)}" data-designed-title="${escapeHtml(mode)}">${content}</h4>`;
}

function renderGalaceanEffectLayer(template, layer = "background") {
  const effect = template.galaceanEffectContract || {};
  if (!effect.capabilityId) return "";
  const effectClass = slug(effect.capabilityId);
  return `<div class="style-galacean-effect effect-${escapeHtml(effectClass)} layer-${escapeHtml(layer)}" data-galacean-effect-layer="${escapeHtml(layer)}" aria-hidden="true">
    <i></i><i></i><i></i><i></i>
  </div>`;
}

function renderVideoStyleFrameMarkup(template) {
  const example = template.example || {};
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const effect = template.galaceanEffectContract || {};
  const kind = scenario.contentKind || template.contentKind || example.kind || "claim-split";
  const spec = styleSceneSpec(template);
  const steps = arrayify(example.choreography).length ? arrayify(example.choreography) : arrayify(template.animationSteps);
  const supportCards = [
    ["内容层", spec.proofObject],
    ["交互层", spec.interaction],
    ["动画层", spec.motion],
  ];
  return `<div class="video-style-frame" data-style-video-frame data-style-capability-set="${escapeHtml(spec.capabilities.join(" / "))}"
    data-business-scenario="${escapeHtml(scenario.businessScenario || "")}"
    data-use-scenario="${escapeHtml(scenario.useCase || "")}"
    data-data-source="${escapeHtml(sourcePlan.label || sourcePlan.mode || "")}"
    data-galacean-effect="${escapeHtml(effect.capabilityId || "")}"
    data-effect-placement="${escapeHtml(effect.placement || "")}">
    <div class="style-page-shell layout-${escapeHtml(slug(spec.layoutMode))} text-${escapeHtml(slug(spec.textMode))}" data-style-page-shell data-style-layout-mode="${escapeHtml(spec.layoutMode)}" data-style-typography-mode="${escapeHtml(spec.textMode)}">
      <div class="style-page-topline">
        <span>${escapeHtml(example.contentType || template.pageCardType || "视频页")}</span>
        <b>${escapeHtml(spec.pageRole)}</b>
      </div>
      ${renderGalaceanEffectLayer(template, "background")}
      <div class="style-page-main">
        <div class="style-frame-copy">
          <span class="style-frame-kicker">${escapeHtml(spec.designPrinciple)}</span>
          ${renderDesignedTitle(spec.title, spec)}
          <p>${escapeHtml(spec.support)}</p>
          <div class="style-proof-strip">
            <strong>${escapeHtml(compactText(spec.proofObject, 18))}</strong>
            <em>${escapeHtml(compactText(spec.secondary, 34))}</em>
          </div>
        </div>
        <div class="style-frame-board scene-${escapeHtml(slug(kind))}">
          ${renderStyleSceneBoard(template)}
        </div>
      </div>
      <div class="style-page-support" data-style-page-support>
        ${supportCards.map(([label, value]) => `<span><b>${escapeHtml(label)}</b><em>${escapeHtml(compactText(value, 34))}</em></span>`).join("")}
      </div>
      <div class="style-frame-steps" data-style-animation-track>
        ${steps.slice(0, 4).map((step, index) => `<span class="s${index + 1}">${escapeHtml(compactText(step, 13))}</span>`).join("")}
      </div>
      <div class="style-quality-strip">
        ${spec.qualityChecks.map((item) => `<i data-style-quality-check>${escapeHtml(item)}</i>`).join("")}
      </div>
      ${renderGalaceanEffectLayer(template, "foreground")}
      <div class="style-frame-subtitle"><span>${escapeHtml(spec.subtitle)}</span></div>
    </div>
  </div>`;
}

function verticalStyleSpec(template) {
  const base = styleSceneSpec(template);
  const scenario = template.scenarioContract || {};
  const vertical = template.verticalShortFormContract || {};
  const hook = vertical.hookArchitecture || {};
  const layout = vertical.mobileLayout || {};
  const effectPlan = vertical.effectPlan || {};
  return {
    ...base,
    vertical,
    firstFramePromise: hook.firstFramePromise || base.title,
    zeroToOne: hook.zeroToOneSecond || "首秒给出反差钩子",
    oneToThree: hook.oneToThreeSeconds || scenario.primaryEvidence || base.proofObject,
    payoffLoop: hook.payoffLoop || "结尾回到首帧承诺形成循环",
    mobileComposition: layout.composition || "上方钩子，中屏证明对象，底部一行字幕。",
    subtitlePolicy: vertical.captionContract?.band || "底部安全字幕带",
    rightRailPolicy: layout.safeAreas?.rightActionRail || "右侧平台操作区不放关键文字",
    effectPlacement: effectPlan.verticalPlacement || "效果层避开字幕、右侧操作区和主标签",
  };
}

function verticalLayoutCluster(template) {
  const scenario = template.scenarioContract || {};
  const kind = scenario.contentKind || template.contentKind || template.example?.kind || "claim-split";
  if (["typed-thesis", "quote-lockup", "claim-split", "cover-bridge"].includes(kind)) return "vertical-layout-poster";
  if (["data-chart", "table-ranking", "geo-map", "choice-matrix", "funnel-conversion"].includes(kind)) return "vertical-layout-data";
  if (["formula-derivation", "concept-orbit", "hierarchy-tree", "network-relationship"].includes(kind)) return "vertical-layout-structure";
  if (["ip-knowledge-card"].includes(kind)) return "vertical-layout-ip";
  if (["whiteboard-method", "journey-map", "storyboard-pressure"].includes(kind)) return "vertical-layout-sketch";
  if (["code-walkthrough", "dashboard-inspection", "screenflow-demo", "agent-simulation", "voice-sync"].includes(kind)) return "vertical-layout-product";
  if (["material-collage", "comparison-gallery", "before-after"].includes(kind)) return "vertical-layout-media";
  if (["risk-alert", "checklist-gate", "source-citation", "evidence-board", "recap-loop", "process-timeline", "timeline-calendar"].includes(kind)) return "vertical-layout-proof";
  return "vertical-layout-default";
}

function renderVerticalEffectLayer(template, layer = "background") {
  const effect = template.galaceanEffectContract || {};
  if (!effect.capabilityId) return "";
  const effectClass = slug(effect.capabilityId);
  return `<div class="style-galacean-effect vertical-galacean-effect effect-${escapeHtml(effectClass)} layer-${escapeHtml(layer)}" data-galacean-effect-layer="${escapeHtml(layer)}" data-vertical-effect-layer="${escapeHtml(layer)}" aria-hidden="true">
    <i></i><i></i><i></i><i></i>
  </div>`;
}

function renderVerticalSceneBoard(template) {
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const kind = scenario.contentKind || template.contentKind || template.example?.kind || "claim-split";
  const card = (label, value, cls = "") => `<div class="vertical-card ${cls}" data-critical-layer="vertical-card"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`;
  const miniStep = (label, index) => `<span class="vertical-mini-step s${index + 1}">${escapeHtml(label)}</span>`;
  const calendarCells = ["", "", ...Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")), "", ""];
  const cases = {
    "claim-split": `<div class="vertical-split-board">
      ${card("误区", "用户自己选才高级", "muted")}
      <div class="vertical-impact-badge">反转</div>
      ${card("证据", "系统先选，用户再微调", "strong")}
    </div>`,
    "process-timeline": `<div class="vertical-timeline-board">
      ${["题材", "拆页", "选模板", "QC", "合成"].map((item, index) => miniStep(item, index)).join("")}
      <i class="vertical-progress-line"></i>
      ${card("当前节点", "第 3 句口播匹配页面模板", "floating strong")}
    </div>`,
    "evidence-board": `<div class="vertical-evidence-board">
      ${card("原因", "模板只换色", "pin a")}
      ${card("证据", "骨架与内容脱节", "pin b")}
      ${card("结论", "改成真实页面模拟", "pin c strong")}
      <svg viewBox="0 0 360 560"><path d="M94 122C162 88 224 98 278 146M270 190C232 280 178 332 132 398" /></svg>
    </div>`,
    "code-walkthrough": `<div class="vertical-code-board">
      <div class="vertical-terminal">
        ${["parseBrief(input)", "selectTemplate(kind)", "bindShortHook()", "renderVertical()"].map((line, index) => `<span class="${index === 1 ? "active" : ""}"><em>${String(index + 1).padStart(2, "0")}</em>${escapeHtml(line)}</span>`).join("")}
      </div>
      ${card("输出", "竖屏页面可进入合成", "strong")}
    </div>`,
    "data-chart": `<div class="vertical-chart-board" data-chart-vertical-proof="true">
      <b class="vertical-source-pill">${escapeHtml(compactText(sourcePlan.label || "World Bank GDP current US$ 2019-2025", 34))}</b>
      <div class="vertical-chart-plot">
        <svg viewBox="0 0 360 520" aria-hidden="true">
          <path class="axis" d="M44 448H332M44 448V64"/>
          <path class="grid" d="M44 364H332M44 280H332M44 196H332M44 112H332"/>
          <path class="curve us" d="M58 302C108 270 156 214 208 164C252 122 292 88 322 58"/>
          <path class="curve cn" d="M58 388C118 344 168 292 222 248C266 212 296 196 322 188"/>
          <path class="curve in" d="M58 432C126 416 182 396 234 370C278 346 302 326 322 312"/>
          <circle cx="322" cy="58" r="9"/><circle cx="322" cy="188" r="8"/><circle cx="322" cy="312" r="7"/>
          <text x="162" y="42" class="chart-title">2025 终点值</text>
          <text x="178" y="86" class="chart-label">美国 30.77T</text>
          <text x="180" y="218" class="chart-label">中国 19.50T</text>
          <text x="178" y="342" class="chart-label">印度 3.96T</text>
        </svg>
      </div>
    </div>`,
    "typed-thesis": `<div class="vertical-type-board"><strong>${escapeHtml(compactText(scenario.pageTitle || "先给承诺", 12))}</strong><span>不是缩略图，是可合成视频帧</span><i></i></div>`,
    "whiteboard-method": `<div class="vertical-whiteboard-board">
      <svg viewBox="0 0 360 560"><path class="sketch" d="M58 356C104 190 172 178 214 292C244 374 292 322 322 180"/><path class="mark" d="M132 236C170 206 220 214 250 252"/><path class="mark" d="M72 426H154M206 426H304"/></svg>
      ${card("描线", "只画前景语义", "wb a")}
      ${card("回填", "文字仍在页面层", "wb b strong")}
    </div>`,
    "cover-bridge": `<div class="vertical-cover-board">
      <div class="vertical-cover-mini"><b>自动生成不是堆模板</b><span>封面承诺</span></div>
      <i class="vertical-bridge-arrow"></i>
      ${card("首帧证明", "同一视觉主体兑现承诺", "strong")}
    </div>`,
    "ip-knowledge-card": `<div class="vertical-ip-board" data-ip-vertical-series="true">
      <div class="vertical-ip-canvas" data-ip-vertical-image="true">
        <div class="vertical-ip-paper-frame">
          <span class="ip-paper-tag">口播单元 03</span>
          <div class="vertical-presenter" aria-hidden="true"><i></i><b></b><span></span></div>
          <div class="ip-speech-bubble">这句话要配一张主图</div>
          <div class="ip-knowledge-sheet">
            <b>固定人设图解</b>
            <span>同一角色 + 主图 + 动作 + 局部补充</span>
            <i></i>
          </div>
          <div class="ip-detail-chip c1">表情</div>
          <div class="ip-detail-chip c2">手势</div>
          <div class="ip-detail-chip c3">知识卡</div>
        </div>
      </div>
      <div class="vertical-agent-stack"><span>拆解口播</span><span>匹配图片</span><span>固定形象</span></div>
      ${card("图片策略", "主图 + 动作 + 表情 + 局部", "knowledge strong")}
    </div>`,
    "before-after": `<div class="vertical-before-after-board">
      ${card("优化前", "信息少 / 重叠", "muted")}
      <i class="vertical-bridge-arrow"></i>
      ${card("优化后", "内容、交互、动效绑定", "strong")}
    </div>`,
    "choice-matrix": `<div class="vertical-matrix-board">
      <svg viewBox="0 0 360 520" aria-hidden="true">
        <path class="coord-grid" d="M72 88V430M146 88V430M220 88V430M294 88V430M48 140H322M48 220H322M48 300H322M48 380H322"/>
        <path class="coord-axis" d="M48 380H326M90 438V76"/>
        <circle class="coord-point muted" cx="142" cy="324" r="12"/><circle class="coord-point muted" cx="222" cy="264" r="12"/><circle class="coord-point selected" cx="280" cy="146" r="18"/>
        <path class="coord-path" d="M142 324C188 292 232 226 280 146"/>
        <text x="214" y="124" class="coord-label selected">目标象限</text>
      </svg>
      ${card("选择依据", "高收益、可实现", "matrix-note")}
    </div>`,
    "dashboard-inspection": `<div class="vertical-dashboard-board">
      ${["字幕安全", "色系自动", "动效语义"].map((item, index) => card(item, index === 1 ? "已选" : "待验收", index === 1 ? "metric active" : "metric")).join("")}
      ${card("动作", "异常项先修复再合成", "strong")}
    </div>`,
    "formula-derivation": `<div class="vertical-formula-board" data-formula-vertical-proof="true">
      <div class="formula-chain">
        <span class="formula-step given">y=ax²+bx+c</span>
        <i>求导</i>
        <span class="formula-step derive">y'=2ax+b</span>
        <i>令 0</i>
        <b class="formula-step result">x=-b/2a</b>
      </div>
      <div class="formula-graph-window">
        <svg viewBox="0 0 360 260" aria-hidden="true"><path class="coord-axis" d="M42 210H326M184 236V34"/><path class="parabola-line" d="M62 58C116 214 258 214 316 58"/><circle class="vertex-dot" cx="184" cy="210" r="8"/><text x="198" y="202" class="coord-label selected">顶点</text></svg>
      </div>
      <div class="formula-note">导数为 0 的位置，就是抛物线顶点。</div>
    </div>`,
    "storyboard-pressure": `<div class="vertical-story-board">
      <svg viewBox="0 0 360 560"><path d="M70 444C126 390 178 318 224 226C258 158 290 108 320 78"/></svg>
      ${["目标", "冲突", "代价"].map((item, index) => card(item, index === 1 ? "选择压力上升" : "结构节点", index === 1 ? "strong" : "")).join("")}
    </div>`,
    "concept-orbit": `<div class="vertical-orbit-board"><div class="vertical-orbit-core">页面任务</div>${["内容", "设计", "交互", "动画"].map((item, index) => `<span class="v-orb o${index + 1}">${escapeHtml(item)}</span>`).join("")}</div>`,
    "material-collage": `<div class="vertical-material-board">
      <div class="main-material"><i></i><b>主素材</b><span>证明这一句话</span></div>
      <div class="material-strip">${["本地视频", "生成图", "授权素材"].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      ${card("授权", "用途和来源写入素材台账", "strong")}
    </div>`,
    "quote-lockup": `<div class="vertical-quote-board"><strong>自动规划</strong><span>不是减少选择</span><b>是减少低质量选择</b><em>关键词跟随语义高亮</em></div>`,
    "checklist-gate": `<div class="vertical-check-board">
      ${["无重叠", "字幕安全", "素材匹配"].map((item, index) => `<span class="${index === 2 ? "warn" : "ok"}">${escapeHtml(item)}</span>`).join("")}
      ${card("合成判断", "全部通过后再输出视频", "strong")}
    </div>`,
    "journey-map": `<div class="vertical-journey-board"><svg viewBox="0 0 360 560"><path d="M62 464C104 316 178 322 204 238C230 154 276 138 312 72"/></svg>${card("当前位置", "页面风格审核", "journey-note strong")}</div>`,
    "recap-loop": `<div class="vertical-recap-board">${["内容", "设计", "动效"].map((item) => card(item, "已绑定")).join("")}<div class="loop-card">输出可验证的视频页</div></div>`,
    "table-ranking": `<div class="vertical-ranking-board">
      <div class="rank-head"><b>2025 GDP 排行</b><span>current US$ / World Bank</span></div>
      ${[["01", "美国", "30.77T"], ["02", "中国", "19.50T"], ["03", "德国", "5.05T"], ["04", "日本", "4.44T"]].map(([rank, name, value], index) => `<div class="rank-row r${index + 1}"><b>${escapeHtml(rank)}</b><span>${escapeHtml(name)}</span><i></i><em>${escapeHtml(value)}</em></div>`).join("")}
    </div>`,
    "geo-map": `<div class="vertical-geo-board">
      <svg viewBox="0 0 360 520"><path class="geo-land main" d="M66 130C118 58 206 70 232 142C258 216 324 194 330 284C336 380 244 434 154 408C72 384 28 284 48 210C52 178 56 154 66 130Z"/><path class="geo-region active" d="M158 164C206 122 260 150 256 210C252 266 188 282 150 240C116 204 126 184 158 164Z"/><circle class="geo-dot" cx="194" cy="208" r="18"/><path class="geo-callout-line" d="M206 206C244 158 278 130 322 110"/><text x="138" y="86" class="geo-label">印度 14.64 亿</text><text x="82" y="464" class="geo-source">World Bank 2025 人口总量</text></svg>
    </div>`,
    "hierarchy-tree": `<div class="vertical-tree-board"><div class="tree-node root">视频生成</div>${["规划层", "模板层", "验收层"].map((item, index) => `<span class="${index === 1 ? "active" : ""}">${escapeHtml(item)}</span>`).join("")}<i></i>${card("当前路径", "模板层 → 竖屏动效层", "strong")}</div>`,
    "network-relationship": `<div class="vertical-network-board"><svg viewBox="0 0 360 520"><path class="net-edge muted" d="M82 132L188 90L270 174L192 302L94 388M188 90L192 302M270 174L94 388"/><path class="net-edge active" d="M82 132C154 128 224 210 192 302C174 354 130 372 94 388"/>${[[82,132,"脚本"],[188,90,"模板"],[270,174,"素材"],[192,302,"字幕"],[94,388,"成片"]].map(([x,y,label], index) => `<g class="net-node n${index + 1}"><circle cx="${x}" cy="${y}" r="${index === 1 ? 24 : 18}"/><text x="${Number(x) - 18}" y="${Number(y) + 5}">${escapeHtml(label)}</text></g>`).join("")}</svg></div>`,
    "funnel-conversion": `<div class="vertical-funnel-board">${[["题材输入", "1000"], ["脚本成页", "720"], ["素材匹配", "510"], ["QC 通过", "430"]].map(([label, value], index) => `<div class="funnel-stage f${index + 1}"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("")}<div class="funnel-drop">最大流失：素材匹配</div></div>`,
    "agent-simulation": `<div class="vertical-agent-board">${["规划", "配音", "模板", "验收"].map((lane, index) => `<div class="agent-lane l${index + 1}"><b>${escapeHtml(lane)}</b><span>${escapeHtml(["拆页", "时间", "选型", "通过"][index])}</span><i></i></div>`).join("")}<svg viewBox="0 0 360 520"><path class="agent-flow" d="M78 86C150 146 222 180 278 246C306 280 306 354 260 420"/></svg></div>`,
    "screenflow-demo": `<div class="vertical-screenflow-board">${["输入题材", "自动规划", "合成确认"].map((label, index) => `<div class="screen-card s${index + 1}"><b>${escapeHtml(label)}</b><i></i><span></span></div>`).join("")}<div class="tap-cursor"></div></div>`,
    "risk-alert": `<div class="vertical-risk-board"><div class="risk-level"><b>中风险</b><span>页面重叠概率上升</span></div><div class="risk-impact"><i></i><b>影响范围</b><span>字幕 / 图表 / 人物</span></div>${card("处理", "缩略和展开都要过重叠校验", "strong")}</div>`,
    "source-citation": `<div class="vertical-citation-board">${["事实", "引用", "推论"].map((item, index) => card(item, ["来源卡", "短摘录", "边界说明"][index], index === 1 ? "strong" : "")).join("")}<div class="verification-stamp">已核验</div></div>`,
    "voice-sync": `<div class="vertical-voice-board"><svg viewBox="0 0 360 300">${Array.from({ length: 28 }, (_, index) => {
      const x = 28 + index * 11;
      const h = 26 + ((index * 19) % 74);
      return `<rect class="wave-bar b${index % 5}" x="${x}" y="${150 - h / 2}" width="6" height="${h}" rx="4"/>`;
    }).join("")}<path class="playhead" d="M178 52V248"/></svg><div class="cue-row"><span>女声</span><span class="active">关键词</span><span>粤语</span></div></div>`,
    "comparison-gallery": `<div class="vertical-gallery-board"><div class="gallery-strip">${Array.from({ length: 6 }, (_, index) => `<span class="${index === 2 ? "active" : ""}">${escapeHtml(index === 2 ? "选中" : `候选${index + 1}`)}</span>`).join("")}</div><div class="selected-frame">最佳候选</div>${card("理由", "结构差异优先于配色", "strong")}</div>`,
    "timeline-calendar": `<div class="vertical-calendar-board" data-calendar-vertical-proof="true">
      <div class="calendar-header"><b>2026 年 7 月</b><span>当前日期 2026-07-06</span></div>
      <div class="weekday-row">${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span>${escapeHtml(day)}</span>`).join("")}</div>
      <div class="calendar-grid">${calendarCells.map((day) => {
        const cls = day === "06" ? "today" : day === "04" ? "start" : day === "17" ? "deadline" : day ? "" : "empty";
        return `<span class="${cls}" ${day ? `data-date="2026-07-${escapeHtml(day)}"` : ""}>${escapeHtml(day || " ")}</span>`;
      }).join("")}</div>
      <div class="event-rail"><i></i><span>开始 2026-07-04</span><em>验收 2026-07-06</em></div>
    </div>`,
  };
  return cases[kind] || cases["claim-split"];
}

function renderVerticalVideoStyleFrameMarkup(template) {
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const effect = template.galaceanEffectContract || {};
  const spec = verticalStyleSpec(template);
  const vertical = spec.vertical || {};
  const hook = vertical.hookArchitecture || {};
  const kind = scenario.contentKind || template.contentKind || template.example?.kind || "";
  const kindSlug = slug(kind);
  const layoutCluster = verticalLayoutCluster(template);
  const beatLabels = [
    ["0-1s", spec.firstFramePromise],
    ["1-3s", spec.oneToThree],
    ["3-6s", hook.threeToSixSeconds || spec.mobileComposition],
  ];
  return `<div class="vertical-video-frame ${escapeHtml(layoutCluster)} vertical-kind-${escapeHtml(kindSlug)}" data-vertical-style-frame data-vertical-video-frame
    data-vertical-layout="${escapeHtml(layoutCluster)}"
    data-vertical-content-kind="${escapeHtml(kind)}"
    data-business-scenario="${escapeHtml(scenario.businessScenario || "")}"
    data-use-scenario="${escapeHtml(scenario.useCase || "")}"
    data-data-source="${escapeHtml(sourcePlan.label || sourcePlan.mode || "")}"
    data-galacean-effect="${escapeHtml(effect.capabilityId || "")}"
    data-effect-placement="${escapeHtml(spec.effectPlacement || "")}"
    data-vertical-hook-contract="${escapeHtml(spec.firstFramePromise)}"
    data-first-three-second-hook="${escapeHtml([spec.zeroToOne, spec.oneToThree].filter(Boolean).join(" / "))}"
    data-platform-safe-area="${escapeHtml([spec.rightRailPolicy, spec.subtitlePolicy].filter(Boolean).join(" / "))}"
    data-vertical-caption-policy="${escapeHtml(vertical.captionContract?.subtitlePolicy || spec.subtitlePolicy)}"
    ${kind === "ip-knowledge-card" ? `data-ip-vertical-series="true"` : ""}>
    <div class="vertical-phone-shell ${escapeHtml(layoutCluster)}">
      ${renderVerticalEffectLayer(template, "background")}
      <div class="vertical-platform-safe top" data-platform-safe-top aria-hidden="true"></div>
      <div class="vertical-platform-safe right" data-platform-safe-right aria-hidden="true"></div>
      <div class="vertical-platform-safe bottom" data-platform-safe-bottom aria-hidden="true"></div>
      <section class="vertical-hook-zone">
        <span>${escapeHtml(compactText(scenario.categoryZh || template.categoryZh || "短视频页", 8))}</span>
        <h4>${escapeHtml(compactText(spec.firstFramePromise || spec.title, 18))}</h4>
        <p>${escapeHtml(compactText(spec.zeroToOne || spec.support, 34))}</p>
      </section>
      <section class="vertical-proof-stage scene-${escapeHtml(kindSlug)}">
        ${renderVerticalSceneBoard(template)}
      </section>
      <div class="vertical-beat-rail" data-vertical-hook-rail>
        ${beatLabels.map(([time, label], index) => `<span class="b${index + 1}"><b>${escapeHtml(time)}</b><em>${escapeHtml(compactText(label, 18))}</em></span>`).join("")}
      </div>
      <div class="vertical-payoff-loop"><span>${escapeHtml(compactText(spec.payoffLoop, 30))}</span></div>
      ${renderVerticalEffectLayer(template, "foreground")}
      <div class="vertical-caption-band" data-vertical-caption-band><span>${escapeHtml(compactText(spec.subtitle || scenario.videoSubtitle || "字幕安全区", 15))}</span></div>
    </div>
  </div>`;
}

function renderVerticalMotionStyleTemplatePreview(template, mode = "card") {
  const base = slug(template.baseTemplate || "kinetic-editorial-explainer");
  const variant = slug(template.variantId || "calm-premium");
  const density = slug(template.density || "medium");
  const accent = motionStyleColor(template);
  const kind = slug(template.scenarioContract?.contentKind || template.contentKind || template.example?.kind || "claim-split");
  const layoutCluster = verticalLayoutCluster(template);
  const variantLabel = compactText(template.variantLabelZh || template.variantId, 7);
  return `<div class="style-template-preview vertical-template-preview ${escapeHtml(layoutCluster)} style-base-${escapeHtml(base)} style-variant-${escapeHtml(variant)} style-density-${escapeHtml(density)} style-example-${escapeHtml(kind)} ${mode === "large" ? "large" : ""}" style="--style-accent:${escapeHtml(accent)}" data-content-kind="${escapeHtml(template.scenarioContract?.contentKind || template.contentKind || template.example?.kind || "")}" data-vertical-layout="${escapeHtml(layoutCluster)}" aria-hidden="true">
    <div class="vertical-style-canvas">
      <span class="style-chip a">${escapeHtml(variantLabel)}</span>
      ${renderVerticalVideoStyleFrameMarkup(template)}
    </div>
  </div>`;
}

function renderMotionStyleTemplatePreview(template, mode = "card") {
  const base = slug(template.baseTemplate || "kinetic-editorial-explainer");
  const variant = slug(template.variantId || "calm-premium");
  const density = slug(template.density || "medium");
  const accent = motionStyleColor(template);
  const kind = slug(template.scenarioContract?.contentKind || template.contentKind || template.example?.kind || "claim-split");
  const variantLabel = compactText(template.variantLabelZh || template.variantId, 7);
  return `<div class="style-template-preview style-base-${escapeHtml(base)} style-variant-${escapeHtml(variant)} style-density-${escapeHtml(density)} style-example-${escapeHtml(kind)} ${mode === "large" ? "large" : ""}" style="--style-accent:${escapeHtml(accent)}" data-content-kind="${escapeHtml(template.scenarioContract?.contentKind || template.contentKind || template.example?.kind || "")}" aria-hidden="true">
    <div class="style-canvas">
      <i class="style-bg-grid"></i>
      <span class="style-chip a">${escapeHtml(variantLabel)}</span>
      ${renderVideoStyleFrameMarkup(template)}
      <i class="style-caption-safe"></i>
    </div>
  </div>`;
}

function motionStyleTemplateDetail(template, index) {
  const bestFor = arrayify(template.bestFor).slice(0, 3).join(" / ");
  const steps = arrayify(template.animationSteps).join(" · ");
  const guardrails = arrayify(template.guardrails).join(" · ");
  const example = template.example || {};
  const scenario = template.scenarioContract || {};
  const visualObjects = arrayify(scenario.visualObjects || scenario.visualObjectPlan).slice(0, 4).join(" / ");
  const layoutSummary = [
    template.pageCardType || scenario.contentKind || example.contentType,
    visualObjects || template.layoutIntent,
  ].filter(Boolean).join(" / ");
  const description = `${scenario.businessScenario || example.scenario || template.layoutIntent || ""} ${layoutSummary} ${scenario.useCase || example.designIdea || ""}`.trim();
  const metaParts = [
    String(index + 1).padStart(3, "0"),
    example.contentType || template.categoryZh || template.pageCardType || "视频页",
    template.variantLabelZh || "",
  ].filter(Boolean);
  return {
    bestFor,
    steps,
    guardrails,
    example,
    layoutSummary,
    description,
    meta: metaParts.join(" / "),
    title: `${template.familyLabelZh} · ${template.variantLabelZh}`,
  };
}

function renderMotionStyleVariantPanel(template, index, active = false) {
  const detail = motionStyleTemplateDetail(template, index);
  const spec = styleSceneSpec(template);
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const effect = template.galaceanEffectContract || {};
  return `<div class="style-variant-panel" data-style-variant-panel data-template-id="${escapeHtml(template.id)}"
    data-style-title="${escapeHtml(detail.title)}"
    data-style-meta="${escapeHtml(detail.meta)}"
    data-style-description="${escapeHtml(detail.description || template.layoutIntent || "")}"
    data-style-steps="${escapeHtml(detail.steps)}"
    data-style-guardrails="${escapeHtml(detail.guardrails)}"
    data-style-layout="${escapeHtml(detail.layoutSummary || detail.example.designIdea || detail.bestFor || template.paletteBehavior || "")}"
    data-style-role="${escapeHtml(detail.example.rolePlan || detail.example.designIdea || "")}"
    data-style-method="${escapeHtml(template.variantMethod || detail.example.variantMethod || "")}"
    data-style-interaction="${escapeHtml(template.interactionFeeling || "")}"
    data-style-animation="${escapeHtml(arrayify(template.motionFusion).join(" · ") || detail.steps)}"
    data-style-benchmark="${escapeHtml(arrayify(template.benchmarkContract?.externalReferences).map((item) => item.name || item).filter(Boolean).slice(0, 5).join(" / ") || "Apple HIG / Material Motion / GSAP / FT Visual Vocabulary / Manim")}"
    data-style-capabilities="${escapeHtml(spec.capabilities.join(" / "))}"
    data-style-video-use="${escapeHtml(`${spec.title}：${spec.support}`)}"
    data-style-scenario="${escapeHtml(scenario.businessScenario || "")}"
    data-style-use-scenario="${escapeHtml(scenario.useCase || "")}"
    data-style-data-source="${escapeHtml([sourcePlan.mode, sourcePlan.label].filter(Boolean).join(" / "))}"
    data-style-galacean-effect="${escapeHtml(effect.capabilityId || "")}"
    data-style-effect-plan="${escapeHtml(effect.semanticJob || "")}"
    ${active ? "" : "hidden"}>
    ${renderMotionStyleTemplatePreview(template)}
  </div>`;
}

function renderVerticalMotionStyleVariantPanel(template, index, active = false) {
  const detail = motionStyleTemplateDetail(template, index);
  const spec = verticalStyleSpec(template);
  const scenario = template.scenarioContract || {};
  const sourcePlan = scenario.sourcePlan || scenario.dataSource || {};
  const effect = template.galaceanEffectContract || {};
  return `<div class="style-variant-panel vertical-style-variant-panel" data-style-variant-panel data-template-id="${escapeHtml(template.id)}"
    data-style-title="${escapeHtml(`竖屏 · ${detail.title}`)}"
    data-style-meta="${escapeHtml(`${detail.meta} / 9:16 / 60fps`)}"
    data-style-description="${escapeHtml(`${spec.mobileComposition} ${spec.firstFramePromise}`)}"
    data-style-steps="${escapeHtml([spec.zeroToOne, spec.oneToThree, spec.payoffLoop].filter(Boolean).join(" · "))}"
    data-style-guardrails="${escapeHtml(arrayify(template.verticalShortFormContract?.rejects).join(" · ") || detail.guardrails)}"
    data-style-layout="${escapeHtml(spec.mobileComposition || detail.layoutSummary || "")}"
    data-style-role="${escapeHtml(`3 秒钩子：${spec.firstFramePromise}`)}"
    data-style-method="${escapeHtml(template.verticalShortFormContract?.motionPlan || "")}"
    data-style-interaction="${escapeHtml(template.verticalShortFormContract?.interactionContract?.primaryGestureCue || spec.interaction || "")}"
    data-style-animation="${escapeHtml(spec.motion || detail.steps)}"
    data-style-benchmark="${escapeHtml(arrayify(template.benchmarkContract?.externalReferences).map((item) => item.name || item).filter(Boolean).slice(0, 5).join(" / ") || "Apple HIG / Material Motion / GSAP / FT Visual Vocabulary / Manim")}"
    data-style-capabilities="${escapeHtml([...spec.capabilities, "9:16", "3秒吸引力", "一行字幕安全区"].join(" / "))}"
    data-style-video-use="${escapeHtml(`竖屏短视频页：${spec.firstFramePromise}；${spec.mobileComposition}`)}"
    data-style-scenario="${escapeHtml(scenario.businessScenario || "")}"
    data-style-use-scenario="${escapeHtml(scenario.useCase || "")}"
    data-style-data-source="${escapeHtml([sourcePlan.mode, sourcePlan.label].filter(Boolean).join(" / "))}"
    data-style-galacean-effect="${escapeHtml(effect.capabilityId || "")}"
    data-style-effect-plan="${escapeHtml(spec.effectPlacement || effect.semanticJob || "")}"
    data-vertical-hook-contract="${escapeHtml(spec.firstFramePromise || "")}"
    data-vertical-caption-policy="${escapeHtml(spec.subtitlePolicy || "")}"
    data-vertical-safe-area="${escapeHtml(spec.rightRailPolicy || "")}"
    ${active ? "" : "hidden"}>
    ${renderVerticalMotionStyleTemplatePreview(template)}
  </div>`;
}

function groupMotionStyleTemplatesForReview(templates = []) {
  const groups = [];
  const byFamily = new Map();
  for (const template of templates) {
    const familyId = template.familyId || "unknown";
    if (!byFamily.has(familyId)) {
      const group = {
        familyId,
        familyLabelZh: template.familyLabelZh || familyId,
        contentKind: template.scenarioContract?.contentKind || template.contentKind || template.example?.kind || "",
        templates: [],
      };
      byFamily.set(familyId, group);
      groups.push(group);
    }
    byFamily.get(familyId).templates.push(template);
  }
  for (const group of groups) {
    group.templates.sort((a, b) => Number(a.variantIndex || 0) - Number(b.variantIndex || 0));
  }
  return groups;
}

function renderMotionStyleSkeletonCard(group, index) {
  const templates = arrayify(group.templates);
  const first = templates[0] || {};
  const detail = motionStyleTemplateDetail(first, Number(first.familyIndex || index) * 5);
  const activeLayout = detail.layoutSummary || detail.example.designIdea || detail.bestFor || first.paletteBehavior || "";
  const activeRole = detail.example.rolePlan || detail.example.designIdea || "";
  return `<article class="style-review-card style-skeleton-card" data-style-review-card data-style-skeleton-card data-family="${escapeHtml(group.familyId)}" data-content-kind="${escapeHtml(group.contentKind || "")}">
    <button type="button" class="style-review-preview-button" data-open-style-preview>
      ${templates.map((template) => renderMotionStyleVariantPanel(template, Number(template.familyIndex || index) * 5 + Number(template.variantIndex || 0), template.id === first.id)).join("")}
    </button>
    <div class="style-review-copy">
      <small>${escapeHtml(String(index + 1).padStart(2, "0"))} / ${escapeHtml(detail.example.contentType || first.baseTemplate || "内容骨架")} / <span data-style-active-variant>${escapeHtml(first.variantLabelZh || "")}</span></small>
      <h3>${escapeHtml(group.familyLabelZh || first.familyLabelZh || "内容骨架")}</h3>
      <p>${escapeHtml(first.scenarioContract?.businessScenario || detail.example.scenario || first.layoutIntent || "")}</p>
      <span data-style-active-layout>${escapeHtml(activeLayout)}</span>
      <span data-style-active-role>${escapeHtml(activeRole)}</span>
      <span class="style-active-method" data-style-active-method>${escapeHtml(first.variantMethod || detail.example.variantMethod || "")}</span>
      <div class="style-variant-switcher" aria-label="${escapeHtml(group.familyLabelZh || "样式变体")}样式切换">
        ${templates.map((template, variantIndex) => `<button type="button" class="${variantIndex === 0 ? "active" : ""}" data-style-variant-button data-template-id="${escapeHtml(template.id)}">${escapeHtml(template.variantLabelZh || template.variantId || `样式${variantIndex + 1}`)}</button>`).join("")}
      </div>
    </div>
  </article>`;
}

function renderVerticalMotionStyleSkeletonCard(group, index) {
  const templates = arrayify(group.templates);
  const first = templates[0] || {};
  const detail = motionStyleTemplateDetail(first, Number(first.familyIndex || index) * 5);
  const spec = verticalStyleSpec(first);
  return `<article class="style-review-card vertical-review-card style-skeleton-card" data-style-review-card data-style-skeleton-card data-vertical-style-card data-family="${escapeHtml(group.familyId)}" data-content-kind="${escapeHtml(group.contentKind || "")}">
    <button type="button" class="style-review-preview-button vertical-review-preview-button" data-open-style-preview>
      ${templates.map((template) => renderVerticalMotionStyleVariantPanel(template, Number(template.familyIndex || index) * 5 + Number(template.variantIndex || 0), template.id === first.id)).join("")}
    </button>
    <div class="style-review-copy vertical-review-copy">
      <small>${escapeHtml(String(index + 1).padStart(2, "0"))} / 9:16 短视频 / <span data-style-active-variant>${escapeHtml(first.variantLabelZh || "")}</span></small>
      <h3>${escapeHtml(group.familyLabelZh || first.familyLabelZh || "竖屏内容骨架")}</h3>
      <p>${escapeHtml(spec.firstFramePromise || first.scenarioContract?.businessScenario || detail.example.scenario || "")}</p>
      <span data-style-active-layout>${escapeHtml(spec.mobileComposition || detail.layoutSummary || "")}</span>
      <span data-style-active-role>${escapeHtml(`3 秒吸引力：${spec.zeroToOne || ""}`)}</span>
      <span class="style-active-method" data-style-active-method>${escapeHtml(first.verticalShortFormContract?.motionPlan || "")}</span>
      <div class="style-variant-switcher" aria-label="${escapeHtml(group.familyLabelZh || "竖屏样式")}样式切换">
        ${templates.map((template, variantIndex) => `<button type="button" class="${variantIndex === 0 ? "active" : ""}" data-style-variant-button data-template-id="${escapeHtml(template.id)}">${escapeHtml(template.variantLabelZh || template.variantId || `样式${variantIndex + 1}`)}</button>`).join("")}
      </div>
    </div>
  </article>`;
}

function renderMotionStyleReviewDialog() {
  return `<dialog class="style-review-dialog" data-style-preview-modal>
    <form method="dialog">
      <button type="submit" aria-label="关闭">×</button>
    </form>
    <div class="style-review-dialog-body">
      <div class="style-review-zoom" data-style-preview-frame></div>
      <div class="style-review-detail">
        <small data-style-preview-meta></small>
        <h3 data-style-preview-title></h3>
        <p data-style-preview-description></p>
        <b>业务场景</b>
        <span data-style-preview-scenario></span>
        <b>数据/口径</b>
        <span data-style-preview-data-source></span>
        <b>效果层计划</b>
        <span data-style-preview-effect-plan></span>
        <b>真实视频页用途</b>
        <span data-style-preview-video-use></span>
        <b>交互表达</b>
        <span data-style-preview-interaction></span>
        <b>动画步骤</b>
        <span data-style-preview-steps></span>
        <b>动画层逻辑</b>
        <span data-style-preview-animation></span>
        <b>横向参考</b>
        <span data-style-preview-benchmark></span>
        <b>能力呈现</b>
        <span data-style-preview-capabilities></span>
        <b>限制规则</b>
        <span data-style-preview-guardrails></span>
      </div>
    </div>
  </dialog>`;
}

function renderMotionStyleReviewHtml(model) {
  const catalog = model.motionStyleCatalog;
  const templates = arrayify(catalog.templates);
  const groups = groupMotionStyleTemplatesForReview(templates);
  const families = arrayify(catalog.families);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>风格模板</title>
  ${renderStyles()}
</head>
<body class="style-review-page">
  <header class="topbar">
    <div>
      <strong>风格模板</strong>
      <span>${escapeHtml(groups.length)} 个视频页模式 × ${escapeHtml(catalog.variantCount)} 个样式按钮</span>
    </div>
    <nav>
      <a href="semi-auto-config.html">返回配置页</a>
    </nav>
  </header>
  <main class="shell style-review-shell">
    <section class="panel">
      <div class="section-head">
        <span>${escapeHtml(templates.length)}</span>
        <div>
          <h2>风格模板</h2>
          <p>这里展示后续视频页面会采用的真实模拟模式：同一内容骨架可用按钮切换样式，每个预览都包含页面内容、设计结构、交互表达、动画步骤、素材/IP/白板/字幕等能力呈现。</p>
        </div>
      </div>
      <div class="style-review-filters" role="tablist" aria-label="风格模板筛选">
        <button type="button" class="active" data-style-filter-family="">全部 <b>${escapeHtml(groups.length)}</b></button>
        ${families.map((family) => `<button type="button" data-style-filter-family="${escapeHtml(family.id || family.familyId)}">${escapeHtml(family.labelZh || family.familyLabelZh || family.id)} <b>${escapeHtml(catalog.variantCount || 5)}式</b></button>`).join("")}
      </div>
      <div class="style-review-grid" data-style-review-grid>
        ${groups.map((group, index) => renderMotionStyleSkeletonCard(group, index)).join("")}
      </div>
    </section>
  </main>
  ${renderMotionStyleReviewDialog()}
  ${renderScripts()}
</body>
</html>`;
}

function renderVerticalMotionStyleReviewHtml(model) {
  const catalog = model.motionStyleCatalog;
  const templates = arrayify(catalog.templates);
  const groups = groupMotionStyleTemplatesForReview(templates);
  const families = arrayify(catalog.families);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>竖屏风格模板</title>
  ${renderStyles()}
</head>
<body class="style-review-page vertical-style-review-page">
  <header class="topbar">
    <div>
      <strong>竖屏风格模板</strong>
      <span>${escapeHtml(groups.length)} 个 9:16 短视频页模式 × ${escapeHtml(catalog.variantCount)} 个样式按钮</span>
    </div>
    <nav>
      <a href="motion-style-template-review.html">横屏模板</a>
      <a href="semi-auto-config.html">返回配置页</a>
    </nav>
  </header>
  <main class="shell style-review-shell vertical-review-shell">
    <section class="panel">
      <div class="section-head">
        <span>${escapeHtml(templates.length)}</span>
        <div>
          <h2>竖屏风格模板</h2>
          <p>这里展示竖屏短视频会采用的真实模拟页面：每个模板都有 9:16 独立布局、首帧承诺、0-3 秒吸引力、右侧平台操作安全区、底部一行字幕安全区和效果层避让规则。</p>
        </div>
      </div>
      <div class="style-review-filters" role="tablist" aria-label="竖屏风格模板筛选">
        <button type="button" class="active" data-style-filter-family="">全部 <b>${escapeHtml(groups.length)}</b></button>
        ${families.map((family) => `<button type="button" data-style-filter-family="${escapeHtml(family.id || family.familyId)}">${escapeHtml(family.labelZh || family.familyLabelZh || family.id)} <b>${escapeHtml(catalog.variantCount || 5)}式</b></button>`).join("")}
      </div>
      <div class="style-review-grid vertical-review-grid" data-style-review-grid data-vertical-review-grid>
        ${groups.map((group, index) => renderVerticalMotionStyleSkeletonCard(group, index)).join("")}
      </div>
    </section>
  </main>
  ${renderMotionStyleReviewDialog()}
  ${renderScripts()}
</body>
</html>`;
}

function renderIpPreview(example) {
  return `<div class="ip-preview">
    <svg viewBox="0 0 360 180" role="img" aria-label="${escapeHtml(example.label)}预览">
      <path class="board" d="M18 22H342V158H18Z"/>
      <circle class="head" cx="84" cy="76" r="25"/>
      <path class="body" d="M54 140 C66 112 103 112 116 140"/>
      <path class="flow" d="M145 60H306M145 98H278M145 136H318"/>
      <circle class="dot" cx="148" cy="60" r="7"/>
      <circle class="dot" cx="148" cy="98" r="7"/>
      <circle class="dot" cx="148" cy="136" r="7"/>
      <path class="mark" d="M220 42 C246 30 278 34 298 52"/>
      <path class="mark" d="M226 122 C255 112 286 118 306 138"/>
    </svg>
  </div>`;
}

function renderHeader(model) {
  return `<header class="topbar">
    <div>
      <strong>视频生成配置台</strong>
      <span>${escapeHtml(model.baseParameters.selected.resolution)} / ${escapeHtml(String(model.baseParameters.selected.fps))}fps</span>
    </div>
    <nav>
      <a href="#base">基础</a>
      <a href="#motion">动效</a>
      <a href="#color">颜色</a>
	      <a href="#caption">字幕</a>
	      <a href="#materials">素材</a>
	      <a href="#cover">封面</a>
	      <a href="#voice">语音</a>
      <a href="#page-edit">页面</a>
    </nav>
  </header>`;
}

function renderBaseSection(model) {
  const selected = model.baseParameters.selected;
  const videoTypeSelection = model.baseParameters.videoTypeSelection || { selected: "", options: [] };
  return `<section class="panel" id="base">
    <div class="section-head">
      <span>01</span>
      <div><h2>基础参数</h2><p>先选视频类型，再按需要调整画幅、分辨率和帧率；不再静默套用默认流程。</p></div>
    </div>
    <div class="video-type-grid" data-video-type-selection>
      ${arrayify(videoTypeSelection.options).map((option) => `
        <label class="video-type-card ${option.selected ? "selected" : ""}" data-video-type-card="${escapeHtml(option.id)}" data-video-type-capabilities="${escapeHtml(arrayify(option.defaultCapabilities).join(" "))}" data-video-type-orientation="${escapeHtml(option.orientationPreset || "horizontal")}">
          <input type="radio" name="video-type" value="${escapeHtml(option.id)}" ${option.selected ? "checked" : ""}/>
          <span>
            <b>${escapeHtml(option.label)}</b>
            <small>${escapeHtml(option.canvas || "")}</small>
          </span>
          <em>${escapeHtml(option.description || "")}</em>
          <strong>${escapeHtml(arrayify(option.defaultCapabilities).join(" + "))}</strong>
        </label>`).join("")}
    </div>
    <div class="option-grid cols-3">
      ${model.baseParameters.options.orientation.map((option) => `
        <label class="option-card ${selected.orientation === option.label ? "selected" : ""}" data-orientation-card="${escapeHtml(option.id)}">
          <input type="radio" name="orientation" value="${escapeHtml(option.id)}" ${selected.orientation === option.label ? "checked" : ""}/>
          <b>${escapeHtml(option.label)}</b>
          <span>${escapeHtml(option.resolution)}</span>
        </label>`).join("")}
      <label class="field-card">
        <span>分辨率</span>
        <select>${model.baseParameters.options.resolution.map((item) => `<option ${item === selected.resolution ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select>
        <small>2K ${model.baseParameters.resolutionSupport.supports2k ? "已开放" : "暂不开放"}：${escapeHtml(model.baseParameters.resolutionSupport.reason)}</small>
      </label>
      <label class="field-card">
        <span>帧率</span>
        <select>${model.baseParameters.options.fps.map((item) => `<option ${item === selected.fps ? "selected" : ""}>${escapeHtml(item)} fps</option>`).join("")}</select>
      </label>
    </div>
  </section>`;
}

function renderMotionStyleCatalog(model) {
  const catalog = model.motionStyleCatalog;
  const selectedScenes = arrayify(catalog.selectedSceneStyles).slice(0, 6);
  return `<div class="motion-style-summary" data-motion-style-count="${escapeHtml(catalog.count)}">
    <div class="motion-style-overview">
      <small>视频级动效风格库</small>
      <strong>${escapeHtml(catalog.count)} 个已审核风格模板</strong>
      <span>${escapeHtml(catalog.familyCount)} 个 family x ${escapeHtml(catalog.variantCount)} 个 variant；${escapeHtml(catalog.plan.selectionMode)}</span>
      <em>${escapeHtml(catalog.plan.videoLevelRule || "每页按内容任务选择风格模板。")}</em>
      <div class="motion-style-review-actions">
        <a class="motion-style-review-link" href="${escapeHtml(catalog.reviewPage)}" target="_blank" rel="noreferrer">打开横屏模板</a>
        <a class="motion-style-review-link secondary" href="${escapeHtml(catalog.verticalReviewPage || "vertical-motion-style-template-review.html")}" target="_blank" rel="noreferrer">打开竖屏模板</a>
      </div>
    </div>
    <div class="motion-style-family-grid">
      ${catalog.families.map((family) => `
        <label class="motion-style-family ${family.selected ? "selected" : ""}">
          <input type="checkbox" checked />
          <span>
            <b>${escapeHtml(family.familyLabelZh)}</b>
            <em>${escapeHtml(family.baseTemplate)} / ${escapeHtml(family.count)} 套</em>
          </span>
        </label>`).join("")}
    </div>
    <div class="motion-style-scene-strip">
      ${selectedScenes.length ? selectedScenes.map((scene) => `
        <article>
          <small>${escapeHtml(scene.sceneId)} / ${escapeHtml(scene.selectedTemplate)}</small>
          <strong>${escapeHtml(scene.familyLabelZh)} · ${escapeHtml(scene.variantLabelZh)}</strong>
          <span>${escapeHtml(scene.layoutIntent || scene.decisionReason || "")}</span>
        </article>`).join("") : `<article><small>待生成</small><strong>尚无页面风格绑定</strong><span>${escapeHtml(catalog.plan.path)}</span></article>`}
    </div>
  </div>`;
}

function renderLayeredMotionPreview(model) {
  const layered = model.layeredMotion || {};
  const activeScenes = arrayify(layered.scenePlans).filter((scene) => scene.active);
  return `<div class="layered-motion-discovery ${layered.active ? "selected" : ""}" data-layered-motion-preview>
    <div class="layered-motion-copy">
      <small>语义分层动效 · ${escapeHtml(layered.mode || "off")}</small>
      <strong>分层动画线与路径揭示</strong>
      <span>动画线固定在模块背景层，文字卡片在内容层，字幕永远最高；个人 IP 原生页面保持为不可变底图。</span>
      <em>触发：说“分层动画 / 动画线 / 路径绘制 / 逐层展示”，或在 brief 中设置 layeredMotion.mode。</em>
      <b>${layered.active ? `当前已启用 · ${activeScenes.length} 个场景` : "当前未启用，可通过提示词或 brief 开启"}</b>
    </div>
    <div class="layered-preview-stage" aria-label="动画线位于内容卡片下方的分层预览">
      <svg class="layered-preview-line" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true"><path d="M30 94 C260 42 740 42 970 94" pathLength="1"/></svg>
      ${["倒计时", "陌生世界", "失联来电", "证据检查"].map((label, index) => `<article class="layered-preview-card" style="--i:${index}"><i>${index + 1}</i><strong>${label}</strong><span>${["明确时限", "规则成谜", "打破常识", "线索收束"][index]}</span></article>`).join("")}
    </div>
  </div>`;
}

function renderMotionSection(model) {
  const featureDefaults = model.featureCompatibility.defaults || {};
  const templateItems = model.motionTemplates.templates.map((template) => ({
    id: template.id,
    type: "template",
    name: "motion-template",
    category: "页面模板",
    meta: arrayify(template.motionVerbs).slice(0, 3).join(" / "),
    label: template.label,
    description: template.description,
    selected: template.selected,
    preview: renderMotionPreview(template),
  }));
  const capabilityItems = model.motionCapabilities.capabilities.map((capability) => ({
    id: capability.id,
    type: "capability",
    name: "motion-capability",
    category: capability.category,
    meta: capability.preview || capability.id,
    label: capability.label,
    description: capability.description,
    selected: capability.selected,
    preview: renderMotionCapabilityPreview(capability),
  }));
  const items = [...templateItems, ...capabilityItems];
  return `<section class="panel" id="motion">
    <div class="section-head">
      <span>02</span>
      <div><h2>视觉动效</h2><p>${model.motionTemplates.count} 个页面模板 + ${model.motionCapabilities.count} 个场景级能力；动效、动态规划、个人 IP、手绘和封面并行可以组合启用。</p></div>
    </div>
    <div class="feature-combo-bar" data-feature-compatibility>
      <label class="feature-toggle ${featureDefaults.motion ? "selected" : ""}"><input type="checkbox" data-feature-toggle="motion" ${featureDefaults.motion ? "checked" : ""}/> <span>动效</span></label>
      <label class="feature-toggle ${featureDefaults.dynamicPlanning ? "selected" : ""}"><input type="checkbox" data-feature-toggle="dynamic-planning" ${featureDefaults.dynamicPlanning ? "checked" : ""}/> <span>动态规划</span></label>
      <label class="feature-toggle ${featureDefaults.personalIp ? "selected" : ""}"><input type="checkbox" data-feature-toggle="personal-ip" ${featureDefaults.personalIp ? "checked" : ""}/> <span>个人 IP</span></label>
      <label class="feature-toggle ${featureDefaults.whiteboard ? "selected" : ""}"><input type="checkbox" data-feature-toggle="whiteboard" ${featureDefaults.whiteboard ? "checked" : ""}/> <span>白板绘制</span></label>
      <label class="feature-toggle ${featureDefaults.coverDesign ? "selected" : ""}"><input type="checkbox" data-feature-toggle="cover-design" ${featureDefaults.coverDesign ? "checked" : ""}/> <span>封面并行</span></label>
      <p data-compatibility-status>规则：能力可以组合使用；遮挡和层级冲突由页面级规划与 QC 修复，不再自动关闭某一项。</p>
    </div>
    <div class="motion-pane-tabs" role="tablist" aria-label="视觉能力页面">
      <button type="button" class="active" data-motion-pane-tab="motion">视觉动效</button>
      <button type="button" data-motion-pane-tab="personal-ip">个人 IP</button>
      <button type="button" data-motion-pane-tab="whiteboard">白板绘制</button>
    </div>
    <div class="motion-pane active" data-motion-pane="motion">
      ${renderLayeredMotionPreview(model)}
      ${renderMotionStyleCatalog(model)}
      <div class="motion-table-grid">
        ${items.map((item) => `
          <article class="motion-table-card ${item.selected ? "selected" : ""}" data-motion-option="${escapeHtml(item.type)}" data-motion-preview-card>
            <label class="motion-check">
              <input type="checkbox" name="${escapeHtml(item.name)}" ${item.selected ? "checked" : ""}/>
            </label>
            <span class="motion-gif-cell" data-motion-preview-source>${item.preview}</span>
            <span class="motion-table-copy">
              <small>${escapeHtml(item.category)} / ${escapeHtml(item.meta)}</small>
              <strong>${escapeHtml(item.label)}</strong>
              <em>${escapeHtml(item.description)}</em>
            </span>
            <button type="button" class="motion-preview-open" data-open-motion-preview data-preview-title="${escapeHtml(item.label)}" data-preview-meta="${escapeHtml(`${item.category} / ${item.meta}`)}" data-preview-description="${escapeHtml(item.description)}">大图</button>
          </article>`).join("")}
      </div>
    </div>
    <div class="motion-pane" data-motion-pane="personal-ip" hidden>
      ${renderIpMotionPane(model)}
    </div>
    <div class="motion-pane" data-motion-pane="whiteboard" hidden>
      ${renderWhiteboardMotionPane(model)}
    </div>
    ${renderMotionPreviewDialog()}
  </section>`;
}

function renderColorSection(model) {
  const auto = model.colorSystems.autoSelection || {};
  const selectedMode = auto.selectedMode || model.colorSystems.defaultMode || "multi";
  const reasonText = arrayify(auto.reasons).length
    ? arrayify(auto.reasons).slice(0, 3).join("；")
    : "按题材、口播内容和页面类型自动选择。";
  const elementText = arrayify(auto.appliedToVideoElements).slice(0, 4).join(" / ");
  return `<section class="panel" id="color">
    <div class="section-head">
      <span>03</span>
      <div><h2>颜色体系</h2><p>${model.colorSystems.count} 套色彩系统，默认由自动规划器根据题材、口播和页面内容自动选择，也支持人工覆盖。</p></div>
    </div>
    <label class="color-auto-card selected">
      <input type="checkbox" data-color-auto-toggle ${auto.enabledByDefault !== false ? "checked" : ""}/>
      <span>
        <strong>自动选择色系</strong>
        <em>自动规划器当前选择：${escapeHtml(auto.selectedLabel || "未命名色系")}。${escapeHtml(reasonText)}</em>
        <small>${escapeHtml(auto.planPath || "workflow/color-system-plan.json")}${elementText ? ` · 应用到：${escapeHtml(elementText)}` : ""}</small>
      </span>
    </label>
    <div class="palette-candidate-strip">
      ${arrayify(auto.rankedCandidates).slice(0, 4).map((candidate) => `<span>${escapeHtml(candidate.label || candidate.id)} <b>${escapeHtml(String(candidate.score || 0))}</b></span>`).join("")}
    </div>
    <div class="palette-tabs" role="tablist" aria-label="颜色体系分类">
      ${model.colorSystems.modes.map((mode) => `<button type="button" role="tab" class="${mode.id === selectedMode ? "active" : ""}" data-palette-tab="${escapeHtml(mode.id)}">${escapeHtml(mode.label)} <b>${escapeHtml(mode.count)}</b></button>`).join("")}
    </div>
    <div class="palette-list">
      ${model.colorSystems.systems.map((system, index) => `
        <label class="palette-row ${system.selectedByPlanner ? "selected" : ""}" data-palette-mode="${escapeHtml(system.paletteMode)}" data-has-black="${system.hasBlack ? "true" : "false"}" data-color-tone="${escapeHtml(system.colorTone)}" data-planner-selected="${system.selectedByPlanner ? "true" : "false"}" ${system.paletteMode === selectedMode ? "" : "hidden"}>
          <input type="radio" name="color-system" ${system.selectedByPlanner ? "checked" : ""}/>
          ${renderSwatches(system.colors)}
          <strong>${escapeHtml(system.label)}</strong>
          <span>${escapeHtml(system.role)}</span>
          <em>${escapeHtml(system.mood || "")}</em>
        </label>`).join("")}
    </div>
    <div class="source-strip">
      ${model.colorSystems.references.map((reference) => `<a href="${escapeHtml(reference.url)}" target="_blank" rel="noreferrer">${escapeHtml(reference.label)}：${escapeHtml(reference.appliedAs)}</a>`).join("")}
    </div>
  </section>`;
}

function renderCaptionSection(model) {
  const groups = model.captionStyles.groups;
  const defaultGroup = model.captionStyles.defaultGroup || groups[0]?.group || "";
  const autoRows = model.captionStyles.autoSubtitle.previewRows || [];
  return `<section class="panel" id="caption">
    <div class="section-head">
      <span>04</span>
      <div><h2>字幕样式</h2><p>当前目录共 ${model.captionStyles.count} 种，默认按分类展示，右侧为真实样式预览。</p></div>
    </div>
    <div class="caption-automation-grid">
      <label class="caption-auto-card selected">
        <input type="checkbox" data-auto-caption-toggle ${model.captionStyles.autoSubtitle.enabledByDefault ? "checked" : ""}/>
        <span>
          <b>自动字幕</b>
          <em>按页面语义、平台和画面任务自动选择合适字幕样式。</em>
        </span>
      </label>
      <label class="caption-auto-card selected">
        <input type="checkbox" data-keyword-highlight-toggle ${model.captionStyles.keywordHighlight.enabledByDefault ? "checked" : ""}/>
        <span>
          <b>关键词高亮</b>
          <em>${escapeHtml(model.captionStyles.keywordHighlight.defaultTreatments.join(" / "))}</em>
        </span>
      </label>
      <div class="caption-planner-preview">
        <b>自动规划预览</b>
        ${autoRows.length ? autoRows.map((row) => `
          <span><strong>${escapeHtml(row.sceneJob || row.sceneId)}</strong><em>${escapeHtml(row.group || "-")} / ${escapeHtml(row.selectedStyleId || "-")}</em></span>`).join("") : `<span><strong>待生成</strong><em>${escapeHtml(model.captionStyles.autoSubtitle.validation)}</em></span>`}
      </div>
    </div>
    <div class="caption-toolbar">
      ${groups.map((item) => `<button type="button" class="${item.group === defaultGroup ? "active" : ""}" data-group="${escapeHtml(item.group)}">${escapeHtml(item.labelZh)} <b>${item.count}</b></button>`).join("")}
      <button type="button" data-group="">全部 <b>${escapeHtml(model.captionStyles.count)}</b></button>
    </div>
    <div class="caption-table" role="list">
      ${model.captionStyles.styles.map((style, index) => `
        <label class="caption-row ${style.selected ? "selected" : ""}" data-group="${escapeHtml(style.group)}" role="listitem" ${defaultGroup && style.group !== defaultGroup ? "hidden" : ""}>
          <span class="caption-check"><input type="checkbox" ${style.selected ? "checked" : ""}/></span>
          <div class="caption-copy">
            <small>${escapeHtml(style.groupLabelZh)} / ${escapeHtml(style.motionIntensity)}</small>
            <h3>${escapeHtml(style.labelZh)}</h3>
            <p>${escapeHtml(compactText(style.useCase, 96))}</p>
          </div>
          ${renderCaptionPreview(style, index)}
        </label>`).join("")}
    </div>
  </section>`;
}

function renderMaterialSection(model) {
  const sources = model.materialSources;
  const imageSourceLabel = {
    "image2-dryrun": "提示词预览 + 本地绘制",
    image2: "图片生成",
    "codex-builtin": "项目内图片",
    local: "本地绘制",
  }[sources.generatedImages.imageSource] || "图片生成/绘制";
  return `<section class="panel" id="materials">
    <div class="section-head">
      <span>05</span>
      <div><h2>素材来源</h2><p>素材入口独立配置，避免生成阶段能力混用。</p></div>
    </div>
    <div class="option-grid cols-3">
      <label class="toggle-card ${sources.freeStockSearch.enabledByDefault ? "selected" : ""}">
        <input type="checkbox" ${sources.freeStockSearch.enabledByDefault ? "checked" : ""}/>
        <b>免费素材搜索</b>
        <span>策略：${escapeHtml(sources.freeStockSearch.policy)}</span>
      </label>
      <label class="toggle-card ${sources.localVideoMaterials.enabledByDefault ? "selected" : ""}">
        <input type="checkbox" data-local-material-toggle ${sources.localVideoMaterials.enabledByDefault ? "checked" : ""}/>
        <b>本地视频素材</b>
        <span>检测到 ${escapeHtml(sources.localVideoMaterials.detectedCount)} 个候选</span>
      </label>
      <label class="toggle-card selected">
        <input type="checkbox" checked/>
        <b>图片生成/绘制</b>
        <span>${escapeHtml(imageSourceLabel)}</span>
      </label>
    </div>
    <div class="local-material-picker" data-local-material-panel ${sources.localVideoMaterials.enabledByDefault ? "" : "hidden"}>
      <label>
        <span>选择素材目录或文件</span>
        <input type="file" multiple webkitdirectory directory accept="${escapeHtml(sources.localVideoMaterials.acceptedTypes.join(","))}" />
      </label>
      <label>
        <span>本地素材路径</span>
        <input type="text" placeholder="/path/to/authorized/materials" />
      </label>
      <small>仅接收用户授权素材；选择目录后进入素材解析、剪辑候选和页面级引用。</small>
    </div>
	  </section>`;
}

function renderCoverMiniPreview(style) {
  return `<div class="cover-mini-preview" style="--cover-accent:${escapeHtml(style.accent)}">
    <i class="cover-bg"></i>
    <b></b>
    <span></span>
    <em></em>
  </div>`;
}

function renderCoverTemplatePreview(style, showcase = {}) {
  const steps = arrayify(showcase.methodSteps).slice(0, 4);
  return `<div class="cover-template-preview" style="--cover-accent:${escapeHtml(style.accent)}">
    <div class="cover-template-hook">${escapeHtml(compactText(showcase.hookText || "别再交付半成品", 12))}</div>
    <div class="cover-template-sub">${escapeHtml(compactText(showcase.payoffText || "脚本、封面、视频、QC 一次打通", 22))}</div>
    <div class="cover-template-board">
      <i></i>
      <b>${escapeHtml(compactText(style.label, 8))}</b>
      <span>${escapeHtml(compactText(style.logic || style.description, 22))}</span>
    </div>
    <div class="cover-template-proof">
      <span></span>
      <strong>成片证据</strong>
    </div>
    <div class="cover-template-steps">
      ${steps.map((step) => `<em>${escapeHtml(compactText(step, 5))}</em>`).join("")}
    </div>
  </div>`;
}

function renderCoverSampleGallery(cover) {
  const samples = arrayify(cover.samples);
  if (!samples.length) {
    return `<div class="cover-sample-empty">当前包尚未生成封面示例图；生成 cover artifacts 后这里会展示真实预览。</div>`;
  }
  return `<div class="cover-sample-grid" data-cover-sample-grid>
    ${samples.map((sample) => `
      <button type="button" class="cover-sample-card" data-cover-open data-cover-src="${escapeHtml(sample.html)}" data-cover-title="${escapeHtml(sample.label)}" data-cover-meta="${escapeHtml(sample.meta)}">
        <img src="${escapeHtml(sample.html)}" alt="${escapeHtml(sample.label)}" loading="eager" decoding="async" />
        <span>
          <strong>${escapeHtml(sample.label)}</strong>
          <em>${escapeHtml(sample.meta || sample.file)}</em>
        </span>
      </button>`).join("")}
  </div>`;
}

function coverSlideMeta(slide = {}) {
  const dimensions = slide.width && slide.height ? `${slide.width}x${slide.height}` : slide.meta || "";
  const readiness = slide.uploadReady ? "上传就绪" : "需原生重生成";
  const targetMatch = slide.exactTargetPreview ? "目标文件预览" : "参考预览";
  return `${slide.platform || slide.group || "封面尺寸"} · ${dimensions}${slide.ratio ? ` · ${slide.ratio}` : ""} · ${readiness} · ${targetMatch}`;
}

function renderCoverResolutionCarousel(cover) {
  const slides = arrayify(cover.resolutionSlides);
  const finalPreview = cover.finalPreview || {};
  const first = finalPreview.html ? finalPreview : slides[0] || {};
  const defaultPreviewActive = Boolean(finalPreview.html);
  if (!slides.length) {
    return `<div class="cover-sample-empty">当前包尚未生成封面示例图；生成 cover artifacts 后这里会用单图左右切换展示各分辨率。</div>`;
  }
  const firstMeta = coverSlideMeta(first);
  return `<div class="cover-resolution-carousel" data-cover-resolution-carousel data-cover-default-active="${defaultPreviewActive ? "true" : "false"}" data-cover-supported-resolution-gallery data-cover-supported-resolution-count="${escapeHtml(slides.length)}">
    <div class="cover-resolution-summary">
      <span>示例封面</span>
      <strong>支持 ${escapeHtml(slides.length)} 个封面输出尺寸</strong>
      <em>默认展示最终封面；点击尺寸可切换输出预览。</em>
    </div>
    <div class="cover-carousel-stage ${defaultPreviewActive ? "final-cover-stage" : ""}">
      <button type="button" class="cover-carousel-nav prev" aria-label="上一张封面尺寸" data-cover-carousel-prev>‹</button>
      <button type="button" class="cover-carousel-image-button" data-cover-open data-cover-carousel-open data-cover-src="${escapeHtml(first.html || "")}" data-cover-title="${escapeHtml(first.label || "封面预览")}" data-cover-meta="${escapeHtml(firstMeta)}">
        ${first.html
          ? `<img src="${escapeHtml(first.html)}" alt="${escapeHtml(first.label || "封面预览")}" loading="eager" decoding="async" data-cover-carousel-image />`
          : `<span class="cover-carousel-placeholder" data-cover-carousel-image>等待生成封面图</span>`}
      </button>
      <button type="button" class="cover-carousel-nav next" aria-label="下一张封面尺寸" data-cover-carousel-next>›</button>
    </div>
    <div class="cover-carousel-meta">
      <small data-cover-carousel-index>${defaultPreviewActive ? "默认封面" : `1 / ${escapeHtml(slides.length)}`}</small>
      <strong data-cover-carousel-title>${escapeHtml(first.label || "封面尺寸")}</strong>
      <span data-cover-carousel-meta>${escapeHtml(firstMeta)}</span>
    </div>
  </div>`;
}

function renderCoverDecisionSurface(cover) {
  const strategy = cover.creativeStrategy || {};
  const showcase = cover.showcase || {};
  const assets = strategy.contentAssets || {};
  const copy = strategy.copywriting || {};
  const image2 = strategy.image2Route || {};
  const hierarchy = arrayify(strategy.visualHierarchy).slice(0, 3);
  const qa = arrayify(strategy.qaChecklist).slice(0, 4);
  const platforms = arrayify(strategy.platformStrategies).slice(0, 3);
  const beads = arrayify(showcase.methodSteps).length ? arrayify(showcase.methodSteps).slice(0, 6) : arrayify(strategy.methodBeads).slice(0, 6);
  const hook = showcase.hookText || copy.hookText || cover.currentCoverPromise || "别再堆模板";
  const payoff = showcase.payoffText || copy.payoffText || assets.resultPromise || "一页看懂质量";
  const viewerPain = showcase.viewerPain || assets.userPain || "用户看不出页面质量";
  const contrarianPoint = showcase.contrarianPoint || assets.contrarianPoint || "选择太多但质量不可控";
  const visualMetaphor = showcase.visualMetaphor || assets.visualMetaphor || "高质量视频页";
  const credibleEvidence = showcase.credibleEvidence || assets.credibleEvidence || "封面、动效、字幕同屏验证";
  const clickPromise = showcase.resultPromise || assets.resultPromise || cover.currentCoverPromise || "";
  return `<div class="cover-example-brief" data-cover-example-brief>
    <span><b>示例题材</b><em>${escapeHtml(showcase.title || "Codex Video Workflow")}</em></span>
    <span><b>内容类别</b><em>${escapeHtml(showcase.topicType || "工具方法论")}</em></span>
    <span><b>目标观众</b><em>${escapeHtml(showcase.audience || "需要验收视频生成质量的团队")}</em></span>
    <span><b>封面承诺</b><em>${escapeHtml(clickPromise)}</em></span>
  </div>
  <div class="cover-decision-grid" data-cover-methodology>
    <div class="cover-decision-preview" data-cover-decision-surface data-cover-click-promise="${escapeHtml(clickPromise)}">
      <div class="cover-left-hook">
        <strong>${escapeHtml(compactText(hook, 12))}</strong>
        <span>${escapeHtml(compactText(viewerPain, 24))}</span>
      </div>
      <div class="cover-failed-draft">
        <i></i>
        <b>旧页</b>
        <span>${escapeHtml(compactText(contrarianPoint, 24))}</span>
      </div>
      <div class="cover-transform-arrow">→</div>
      <div class="cover-proof-board">
        <b>${escapeHtml(compactText(payoff, 18))}</b>
        <span>${escapeHtml(compactText(visualMetaphor, 28))}</span>
        <em>${escapeHtml(compactText(credibleEvidence, 28))}</em>
      </div>
      <div class="cover-method-beads">
        ${beads.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
    <div class="cover-strategy-panel">
      <div class="cover-strategy-card main">
        <small>点击决策面</small>
        <strong>${escapeHtml(compactText(readableInline(assets.coreViewpoint || assets.resultPromise), 52))}</strong>
        <span>${escapeHtml(compactText(readableInline(strategy.compositionBlueprint), 120))}</span>
      </div>
      <div class="cover-strategy-list">
        <span><b>点击动机</b><em>${escapeHtml(readableInline(strategy.clickMotivation) || "result-method")}</em></span>
        <span><b>模板响应</b><em>${escapeHtml(readableInline(strategy.selectedTemplate || cover.currentCompositionTemplate) || "problem-to-proof transformation cover")}</em></span>
        <span data-cover-small-preview><b>小图测试</b><em>${escapeHtml(readableInline(strategy.smallPreviewTest) || "主钩子和证明对象必须保留。")}</em></span>
        <span data-cover-image2-route><b>Image2 路由</b><em>${escapeHtml(`${image2.defaultCoverEngine || "image2-integrated-typography-cover"} / ${image2.promptCount || 0} 组提示词`)}</em></span>
      </div>
      <div class="cover-platform-strategy" data-cover-platform-strategy>
        ${platforms.map((platform) => `<span><b>${escapeHtml(readableInline(platform.platform || platform.id || "平台策略"))}</b><em>${escapeHtml(compactText(readableInline(platform.strategy || platform.decisionSurface || platform.clickLogic || platform.textDensity), 74))}</em></span>`).join("")}
      </div>
      <div class="cover-hierarchy-list">
        ${hierarchy.map((item) => `<span>${escapeHtml(compactText(readableInline(item), 42))}</span>`).join("")}
      </div>
      <div class="cover-qa-list">
        ${qa.map((item) => `<span>${escapeHtml(compactText(readableInline(item), 48))}</span>`).join("")}
      </div>
    </div>
  </div>`;
}

function renderCoverPreviewDialog() {
  return `<dialog class="cover-preview-dialog" data-cover-preview-modal>
    <form method="dialog">
      <button type="submit" aria-label="关闭">×</button>
    </form>
    <div class="cover-preview-dialog-body">
      <figure>
        <img data-cover-preview-image alt="封面大图预览" />
      </figure>
      <div>
        <small data-cover-preview-meta></small>
        <h3 data-cover-preview-title>封面预览</h3>
      </div>
    </div>
  </dialog>`;
}

function coverStatusCopy(status = {}, cover = {}) {
  const promptCount = status.promptCount || 0;
  if (status.realBitmapProviderActive && !status.reviewFallbackOnly) {
    return {
      label: status.label || "封面可进入终版检查",
      detail: `Image2/Codex bitmap 已接入，${promptCount} 组平台提示词可用于多比例生成。`,
    };
  }
  return {
    label: "当前为封面审核预览",
    detail: "当前包用于审核封面样式、模板方向和平台比例；上传终版需要原生比例 bitmap 通过封面 QC 后进入最终成品。",
  };
}

function renderCoverTemplateSwitcher(cover) {
  const presets = arrayify(cover.stylePresets);
  const selectedIndex = Math.max(0, presets.findIndex((style) => style.selected));
  return `<div class="cover-template-switcher" data-cover-template-switcher>
    <div class="cover-aside-head">
      <span>模板</span>
      <strong>选择封面设计方向</strong>
    </div>
    <div class="cover-template-showcase">
      ${presets.map((style, index) => `
        <div class="cover-template-slide" data-cover-template-slide="${index}" data-cover-template-preset="${escapeHtml(style.id || `cover-template-${index + 1}`)}" ${index === selectedIndex ? "" : "hidden"}>
          ${renderCoverTemplatePreview(style, cover.showcase)}
          <span>
            <b>${escapeHtml(style.label)}</b>
            <em>${escapeHtml(style.logic || style.description)}</em>
            <small>${escapeHtml(style.composition)}</small>
          </span>
        </div>`).join("")}
    </div>
    <div class="cover-template-tabs" aria-label="封面模板切换">
      ${presets.map((style, index) => `
        <button type="button" class="${index === selectedIndex ? "active" : ""}" data-cover-template-tab="${index}">
          ${escapeHtml(style.label)}
        </button>`).join("")}
    </div>
  </div>`;
}

function renderCoverStyleControls(cover) {
  const presets = arrayify(cover.stylePresets);
  return `<div class="cover-style-controls">
    <label class="cover-auto-card selected" data-cover-auto-card>
      <input type="checkbox" data-cover-auto-toggle checked/>
      <span>
        <b>${escapeHtml(cover.autoCover?.label || "自动按封面设计规范生成")}</b>
        <em>自动规划器根据题材、口播稿、平台比例和封面方法论选择封面方向；用户仍可在下方审核模板。</em>
      </span>
    </label>
    <div class="cover-style-list" aria-label="专业封面模板">
      ${presets.map((style, index) => `
        <label class="cover-style-card ${style.selected ? "selected" : ""}" data-cover-style-card>
          <input type="radio" name="cover-style" value="${escapeHtml(style.id || `cover-style-${index + 1}`)}" ${style.selected ? "checked" : ""}/>
          ${renderCoverMiniPreview(style)}
          <span>
            <strong>${escapeHtml(style.label)}</strong>
            <em>${escapeHtml(style.logic || style.description)}</em>
            <small>${escapeHtml(style.composition || "")}</small>
            <i>${escapeHtml(arrayify(style.bestFor).slice(0, 2).join(" / "))}</i>
          </span>
        </label>`).join("")}
    </div>
  </div>`;
}

function renderCoverAutoOption(cover) {
  return `<label class="cover-auto-card selected cover-default-option" data-cover-auto-card>
    <input type="checkbox" data-cover-auto-toggle checked/>
    <span>
      <b>${escapeHtml(cover.autoCover?.label || "自动生成上传封面")}</b>
      <em>默认开启。自动规划器根据题材、口播稿、平台比例和封面方法论选择封面方案。</em>
    </span>
  </label>`;
}

function renderCoverRatioCompact(cover) {
  const options = arrayify(cover.resolutionSlides).length ? arrayify(cover.resolutionSlides) : arrayify(cover.resolutionOptions);
  const defaultPreviewActive = Boolean(cover.finalPreview?.html);
  return `<div class="cover-ratio-compact" data-cover-resolution-list>
    <div class="cover-aside-head">
      <span>比例</span>
      <strong>默认全部生成，可收窄选择</strong>
    </div>
    <div class="cover-ratio-chip-grid">
      ${options.map((option, index) => {
        const meta = coverSlideMeta(option);
        const dimensions = option.width && option.height ? `${option.width}x${option.height}` : option.meta || "";
        return `
        <label class="cover-ratio-chip selected ${!defaultPreviewActive && index === 0 ? "active" : ""}" data-cover-slide data-cover-resolution-card data-cover-target-id="${escapeHtml(option.id || "")}" data-cover-slide-index="${index}" data-cover-src="${escapeHtml(option.html || "")}" data-cover-title="${escapeHtml(option.label || `封面尺寸 ${index + 1}`)}" data-cover-meta="${escapeHtml(meta)}">
          <input type="checkbox" name="cover-resolution" value="${escapeHtml(option.id)}" checked/>
          <span>
            <b>${escapeHtml(option.group)}</b>
            <em>${escapeHtml(dimensions)} · ${escapeHtml(option.ratio || "")}</em>
          </span>
        </label>`;
      }).join("")}
    </div>
  </div>`;
}

function renderCoverOptionsPanel(cover) {
  return `<aside class="cover-review-aside cover-options-panel">
    <div class="cover-options-head">
      <span>封面选项</span>
      <strong>默认选中</strong>
    </div>
    ${renderCoverAutoOption(cover)}
    ${renderCoverRatioCompact(cover)}
  </aside>`;
}

function renderCoverEngineStatus(cover) {
  const status = cover.image2Status || {};
  const copy = coverStatusCopy(status, cover);
  const state = status.realBitmapProviderActive && !status.reviewFallbackOnly ? "ready" : "warning";
  const promptCount = Number(status.promptCount || 0);
  const engine = status.defaultCoverEngine || cover.creativeStrategy?.image2Route?.defaultCoverEngine || "image2-integrated-typography-cover";
  return `<div class="cover-engine-status ${escapeHtml(state)}">
    <strong>${escapeHtml(copy.label)}</strong>
    <span>${escapeHtml(copy.detail)}</span>
    <small>Image2 提示词：${escapeHtml(engine)} / ${escapeHtml(promptCount)} 组 / ${escapeHtml(status.promptSource || "workflow/cover-image2-prompts.json")}</small>
  </div>`;
}

function renderCoverArtifactList(cover) {
  const artifacts = [
    cover.autoCover?.source || "workflow/cover-design.json",
    cover.autoCover?.promptSource || "workflow/cover-image2-prompts.json",
    "workflow/cover-image2-qc.json",
    "workflow/cover-size-selection.json",
    "最终成品/",
  ];
  return `<div class="cover-artifact-list" aria-label="封面工作流产物">
    ${artifacts.map((artifact) => `<span>${escapeHtml(artifact)}</span>`).join("")}
  </div>`;
}

function renderCoverSection(model) {
  const cover = model.coverModule;
  return `<section class="panel" id="cover">
    <div class="section-head">
      <span>06</span>
      <div><h2>封面设计</h2><p>默认生成上传封面；左侧审核最终封面，右侧收窄平台尺寸。</p></div>
    </div>
    <div class="cover-review-board cover-review-board-simple">
      <div class="cover-review-main">
        ${renderCoverResolutionCarousel(cover)}
      </div>
      ${renderCoverOptionsPanel(cover)}
    </div>
    ${renderCoverPreviewDialog()}
  </section>`;
}

function renderIpSection(model) {
  const ipEnabled = Boolean(model.featureCompatibility.defaults?.personalIp || model.personalIp.enabledByDefault);
  return `<section class="panel" id="ip">
    <div class="section-head">
      <span>06</span>
      <div><h2>个人 IP / 手绘融合</h2><p>使用引用的个人 IP 图解框架，把 IP 形象、知识卡、协作图和页面导演统一到视频页面。</p></div>
    </div>
    <div class="ip-composite-grid">
      ${renderIpCompositePreview(model.personalIp)}
      <div class="ip-mode-list">
        <div class="ip-source-card">
          <b>引用框架</b>
          <a href="${escapeHtml(model.personalIp.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(model.personalIp.source.repository)}</a>
          <span>${model.personalIp.source.assetsAvailable ? "本地示例资产可用" : "未找到本地示例资产"}</span>
        </div>
        <label class="ip-enable-row ${ipEnabled ? "selected" : ""}">
          <input type="checkbox" data-feature-toggle="personal-ip" ${ipEnabled ? "checked" : ""}/>
          <span>
            <strong>启用个人 IP 模式</strong>
            <em>可与动效、动态规划和白板绘制组合，由页面级规划处理遮挡与层级。</em>
          </span>
	        </label>
	        ${renderIpExecutionModeControls(model.personalIp)}
	      ${model.personalIp.examples.map((example) => `
        <label class="ip-mode-row ${ipEnabled ? "selected" : ""}">
          <input type="checkbox" ${ipEnabled ? "checked" : ""}/>
          <span>
          <h3>${escapeHtml(example.label)}</h3>
          <p>${escapeHtml(example.example)}</p>
          </span>
        </label>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderWhiteboardSection(model) {
  const whiteboardEnabled = Boolean(model.featureCompatibility.defaults?.whiteboard);
  const artifacts = model.whiteboard.previewArtifacts || {};
  const previewVideo = artifacts.validatedPocVideo?.html || "";
  const previewPoster = artifacts.validatedPocPoster?.html || artifacts.validatedPocFinalFrame?.html || "";
  return `<section class="panel" id="whiteboard">
    <div class="section-head">
      <span>07</span>
      <div><h2>白板绘制</h2><p>使用已验证的白板视频 Skill：只借描线/手写运动，背景、彩色组件和字幕仍由主视频流程控制。</p></div>
    </div>
    <div class="whiteboard-layout">
      <div class="whiteboard-skill-preview" data-whiteboard-skill-preview aria-label="白板视频 Skill 真实预览">
        <div class="whiteboard-video-frame">
          ${previewVideo ? `<video src="${escapeHtml(previewVideo)}" ${previewPoster ? `poster="${escapeHtml(previewPoster)}"` : ""} autoplay muted loop playsinline controls></video>` : `<div class="whiteboard-video-missing">未找到白板 POC 视频</div>`}
        </div>
        <div class="whiteboard-proof-strip">
          <span>已验证 POC</span>
          <span>1920x1080 / 30fps</span>
          <span>字幕最后合成</span>
        </div>
        <div class="whiteboard-layer-stack">
          ${model.whiteboard.layerOrder.map((layer) => `
            <article>
              <small>${escapeHtml(layer.owner)}</small>
              <strong>${escapeHtml(layer.label)}</strong>
              <em>${escapeHtml(layer.rule)}</em>
            </article>`).join("")}
        </div>
      </div>
      <div class="whiteboard-mode-list">
        <label class="whiteboard-enable-row ${whiteboardEnabled ? "selected" : ""}">
          <input type="checkbox" data-feature-toggle="whiteboard" ${whiteboardEnabled ? "checked" : ""}/>
          <span>
            <strong>启用白板绘制</strong>
            <em>可单独使用，也可与动效或个人 IP 结合；不会替换整个视频渲染器。</em>
          </span>
        </label>
        <div class="whiteboard-source-card">
          <b>能力来源</b>
          <span>适配层：${escapeHtml(model.whiteboard.sourceSkill)}</span>
          <span>描线引擎：${escapeHtml(model.whiteboard.sourceEngine)}</span>
          <em>${escapeHtml(model.whiteboard.activationScope)}</em>
        </div>
        ${model.whiteboard.modes.map((mode) => `
          <label class="whiteboard-mode-row selected">
            <input type="checkbox" checked />
            <span>
              <strong>${escapeHtml(mode.label)}</strong>
              <em>${escapeHtml(mode.description)}</em>
            </span>
          </label>`).join("")}
        <p>${escapeHtml(model.whiteboard.layerPolicy)}</p>
      </div>
    </div>
  </section>`;
}

function findVoicePreviewSample(samples, predicate) {
  return samples.find((sample) => sample.available && predicate(sample))
    || samples.find(predicate)
    || null;
}

function renderVoicePreviewButton(sample, label = "试听", attrs = {}) {
  const available = Boolean(sample?.available && sample?.src);
  const extraAttrs = Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ` data-${escapeHtml(key)}="${escapeHtml(String(value))}"`)
    .join("");
  return `<button type="button" class="voice-play-button ${available ? "" : "disabled"}" data-voice-preview-button data-preview-src="${escapeHtml(available ? sample.src : "")}" data-preview-label="${escapeHtml(sample?.label || "")}"${extraAttrs} ${available ? "" : "disabled"}>${escapeHtml(available ? label : "暂无")}</button>`;
}

function renderVoiceSection(model) {
  const voiceSamples = arrayify(model.voiceModule.previewCatalog?.samples);
  const previewSampleById = new Map(voiceSamples.flatMap((sample) => [
    [sample.id, sample],
    [sample.sourceSampleId, sample],
  ].filter(([key]) => key)));
  const sampleForMode = (mode) => previewSampleById.get(mode.previewSampleId)
    || findVoicePreviewSample(voiceSamples, (sample) => sample.languageMode === mode.id);
  const sampleForDialect = (dialect) => previewSampleById.get(dialect.previewSampleId)
    || findVoicePreviewSample(voiceSamples, (sample) => sample.dialectId === dialect.id);
  const sampleForGender = (option) => findVoicePreviewSample(voiceSamples, (sample) => sample.gender === option.id && sample.languageMode === "zh-mandarin" && sample.toneType === "creator")
    || findVoicePreviewSample(voiceSamples, (sample) => sample.gender === option.id);
  const sampleForTone = (type) => type.id === "all"
    ? findVoicePreviewSample(voiceSamples, (sample) => sample.languageMode === "zh-mandarin" && sample.toneType === "creator")
    : findVoicePreviewSample(voiceSamples, (sample) => sample.toneType === type.id);
  const selectedLanguageMode = model.voiceModule.selected.languageMode || "zh-mandarin";
  const selectedGender = model.voiceModule.selected.gender || "female";
  const selectedToneType = model.voiceModule.selected.toneType || "all";
  return `<section class="panel" id="voice">
    <div class="section-head">
      <span>07</span>
      <div><h2>语音模块</h2><p>默认生成口播/旁白音频；语言、性别、音色和方言选项旁可直接试听。</p></div>
    </div>
    <div class="voice-layout">
      <div class="voice-list">
        <div class="voice-gender-bar">
          ${model.voiceModule.genderOptions.map((option) => {
            const sample = sampleForGender(option);
            return `
            <article class="voice-option-card ${option.selected ? "selected" : ""}">
              <label>
                <input type="radio" name="voice-gender" value="${escapeHtml(option.id)}" ${option.selected ? "checked" : ""}/>
                <span>${escapeHtml(option.label)}</span>
              </label>
              ${renderVoicePreviewButton(sample, "试听", { "preview-kind": "gender", "preview-value": option.id })}
            </article>`;
          }).join("")}
        </div>
        <div class="voice-tone-list" data-voice-tone-list>
          ${model.voiceModule.toneTypes.map((type) => {
            const sample = sampleForTone(type);
            return `
            <article class="voice-tone-chip ${type.selected ? "selected" : ""}">
              <label>
                <input type="radio" name="voice-tone-type" value="${escapeHtml(type.id)}" ${type.selected ? "checked" : ""}/>
                <span>
                  <strong>${escapeHtml(type.label)}</strong>
                  <em>${escapeHtml(type.description)}</em>
                </span>
              </label>
              ${renderVoicePreviewButton(sample, "试听", { "preview-kind": "tone", "preview-value": type.id })}
            </article>`;
          }).join("")}
        </div>
        ${model.voiceModule.languageModes.map((mode) => {
          const sample = sampleForMode(mode);
          return `
          <article class="voice-row ${mode.selected ? "selected" : ""}" data-voice-mode="${escapeHtml(mode.id)}">
            <label>
              <input type="radio" name="voice-language" value="${escapeHtml(mode.id)}" ${mode.selected ? "checked" : ""}/>
              <span>
                <strong>${escapeHtml(mode.label)}</strong>
                <small>${escapeHtml(mode.backend)} / ${escapeHtml(mode.support)}</small>
                <em>${escapeHtml(mode.sample)}</em>
              </span>
            </label>
            ${renderVoicePreviewButton(sample, "试听", { "preview-kind": "language", "preview-value": mode.id })}
          </article>`;
        }).join("")}
        <div class="dialect-picker" data-dialect-picker>
          <strong>可试听方言</strong>
          <label class="dialect-select-row">
            <span>具体方言</span>
            <select name="dialect" data-dialect-select>
              ${model.voiceModule.dialects.map((dialect) => `<option value="${escapeHtml(dialect.id)}" ${dialect.selected ? "selected" : ""}>${escapeHtml(dialect.label)}${dialect.available ? " · 可试听" : " · 暂无试听"}</option>`).join("")}
            </select>
          </label>
          <div class="dialect-card-list">
            ${model.voiceModule.dialects.map((dialect) => {
              const sample = sampleForDialect(dialect);
              const available = Boolean(dialect.available && sample?.available);
              return `
              <article class="dialect-card ${available ? "available" : "unavailable"} ${dialect.selected ? "selected" : ""}" data-dialect-option="${escapeHtml(dialect.id)}">
                <input type="radio" name="voice-dialect" value="${escapeHtml(dialect.id)}" ${dialect.selected ? "checked" : ""} hidden/>
                <span>
                  <strong>${escapeHtml(dialect.label)}</strong>
                  <small>${escapeHtml(available ? (dialect.speaker || sample?.speaker || "本地 speaker") : "暂不可试听")}</small>
                  <em>${escapeHtml(dialect.sample)}</em>
                  <i>${escapeHtml(dialect.fallback)}</i>
                </span>
                ${renderVoicePreviewButton(available ? sample : null, "试听", { "preview-kind": "dialect", "preview-value": dialect.id })}
              </article>`;
            }).join("")}
          </div>
        </div>
        <p class="voice-inline-status" data-voice-preview-status>音频默认是口播/旁白音频。点击选项旁边的试听按钮播放对应样本。</p>
        <audio class="voice-inline-player" data-voice-preview-player preload="none"></audio>
      </div>
    </div>
    <div class="speech-style-list">
      ${model.voiceModule.speechStyles.map((style) => `
        <label class="speech-chip ${style.selected ? "selected" : ""}">
          <input type="radio" name="speech-style" value="${escapeHtml(style.id)}" ${style.selected ? "checked" : ""}/>
          <strong>${escapeHtml(style.label)}</strong>
          <span>${escapeHtml(style.description)}</span>
        </label>`).join("")}
    </div>
    <div class="speaker-match-table">
      ${model.voiceModule.speakerMatching.map((row) => `
        <div>
          <strong>${escapeHtml(row.language)}</strong>
          <span>女声：${escapeHtml(row.female)}</span>
          <span>男声：${escapeHtml(row.male)}</span>
        </div>`).join("")}
    </div>
    <p class="module-note">${escapeHtml(model.voiceModule.policy)} 试听样本来源：${escapeHtml(model.voiceModule.previewCatalog?.source || "")}；已复制 ${Number(model.voiceModule.previewCatalog?.sampleCount || 0)} 个可播放样本到当前配置包。</p>
    <script type="application/json" id="voice-preview-data">${JSON.stringify({
      selectedLanguageMode,
      selectedGender,
      selectedToneType,
      previewCatalog: model.voiceModule.previewCatalog,
    }).replaceAll("<", "\\u003c")}</script>
  </section>`;
}

function renderPageEditSection(model) {
  return `<section class="panel" id="page-edit">
    <div class="section-head">
      <span>08</span>
      <div><h2>页面级编辑</h2><p>${model.pageEditing.pageCount} 个页面可按内容、设计、字幕三类批注。</p></div>
    </div>
    <div class="tds-grid">
      <article><b>T</b><h3>内容</h3><p>主信息、支撑信息、口播节拍、屏幕文字。</p></article>
      <article><b>D</b><h3>设计</h3><p>版式、颜色、视觉隐喻、图片/图表/白板构图。</p></article>
      <article><b>S</b><h3>字幕</h3><p>68 种字幕样式、安全区、关键词强调、时间绑定。</p></article>
    </div>
    <div class="compose-bar">
      <span>确认配置与页面批注后进入最终合成。</span>
      <button type="button">生成页面审核包</button>
      <button type="button" class="primary">确认并合成</button>
    </div>
  </section>`;
}

function renderStyles() {
  return `<style>
    :root {
      color-scheme: light;
      --bg: #eef1ed;
      --ink: #141817;
      --muted: #66706b;
      --line: rgba(20, 24, 23, .12);
      --surface: rgba(253, 252, 246, .9);
      --surface-strong: #fffdf7;
      --surface-subtle: #f5f3ed;
      --accent: #315f7d;
      --accent-2: #9a673f;
      --green: #4f735f;
      --plum: #67516a;
      font-family: "Inter", "Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); }
    button, input, select { font: inherit; }
    input { accent-color: var(--accent); }
    .shell { width: min(1480px, calc(100vw - 36px)); margin: 0 auto; padding: 84px 0 54px; }
    .topbar { position: fixed; z-index: 20; top: 0; left: 0; right: 0; height: 62px; padding: 0 max(18px, calc((100vw - 1480px) / 2)); background: rgba(246,248,245,.88); backdrop-filter: blur(18px); border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 18px; }
    .topbar div { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
    .topbar strong { font-size: 18px; white-space: nowrap; }
    .topbar span { color: var(--muted); font-size: 13px; white-space: nowrap; }
    .topbar nav { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .topbar a { color: var(--ink); text-decoration: none; font-size: 13px; border: 1px solid transparent; padding: 8px 10px; border-radius: 7px; }
    .topbar a:hover { border-color: var(--line); background: rgba(255,255,255,.58); }
    .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; box-shadow: 0 18px 50px rgba(42, 54, 62, .08); }
    .section-head { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .section-head > span { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--ink); font-weight: 900; }
    .section-head h2 { margin: 0; font-size: 26px; line-height: 1.15; letter-spacing: 0; }
    .section-head p { margin: 7px 0 0; color: var(--muted); line-height: 1.7; }
    .option-grid, .video-type-grid, .motion-grid, .tds-grid, .voice-layout, .ip-composite-grid { display: grid; gap: 14px; }
    .cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .video-type-grid { grid-template-columns: repeat(auto-fit, minmax(205px, 1fr)); margin-bottom: 16px; }
    .video-type-card {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 9px 10px;
      align-content: start;
      min-height: 158px;
      padding: 14px;
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 8px;
      cursor: pointer;
    }
    .video-type-card input { width: 18px; height: 18px; }
    .video-type-card > span, .video-type-card em, .video-type-card strong { grid-column: 2; min-width: 0; }
    .video-type-card b { display: block; font-size: 17px; line-height: 1.2; }
    .video-type-card small, .video-type-card em { display: block; color: var(--muted); line-height: 1.45; font-style: normal; }
    .video-type-card strong { align-self: end; color: var(--accent); font-size: 12px; line-height: 1.35; }
    .motion-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tds-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .voice-layout { grid-template-columns: 1fr; align-items: start; }
    .ip-composite-grid { grid-template-columns: minmax(520px, 1.08fr) minmax(410px, .92fr); align-items: stretch; }
    .option-card, .field-card, .toggle-card, .motion-card, .color-auto-card, .palette-row, .caption-row, .ip-mode-row, .voice-row, .speech-chip, .tds-grid article {
      background: var(--surface-strong); border: 1px solid var(--line); border-radius: 8px; padding: 15px; min-width: 0;
    }
    .selected { border-color: rgba(49,93,134,.42); box-shadow: inset 0 0 0 1px rgba(49,93,134,.18); }
    .option-card, .toggle-card { display: grid; gap: 8px; cursor: pointer; }
    .option-card input, .toggle-card input { width: 18px; height: 18px; accent-color: var(--accent); }
    .option-card b, .toggle-card b { font-size: 18px; }
    .option-card span, .toggle-card span, .field-card span { color: var(--muted); line-height: 1.5; }
    .field-card { display: grid; gap: 10px; }
    .field-card select { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 11px 12px; background: #fff; color: var(--ink); }
    .field-card small { color: var(--muted); line-height: 1.55; font-size: 12px; }
    .motion-card { display: grid; grid-template-columns: minmax(240px, .9fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
    .inline-select { display: flex; align-items: center; gap: 8px; color: var(--accent); font-size: 12px; font-weight: 800; }
    .inline-select input { width: 16px; height: 16px; }
    .motion-card h3, .caption-row h3, .ip-mode-row h3, .tds-grid h3 { margin: 5px 0 7px; font-size: 18px; line-height: 1.2; letter-spacing: 0; }
    .motion-card p, .caption-row p, .ip-mode-row p, .tds-grid p { margin: 0; color: var(--muted); line-height: 1.65; }
    .motion-preview { position: relative; min-height: 154px; overflow: hidden; border-radius: 8px; background: #f1eee6; border: 1px solid rgba(20,25,24,.08); }
    .motion-stage { position: absolute; inset: 0; padding: 16px; overflow: hidden; }
    .motion-stage i, .motion-stage b, .motion-stage span { position: absolute; display: block; font-style: normal; letter-spacing: 0; }
    .kinetic-stage { background: linear-gradient(140deg, #f6f0e4, #dee7e2); }
    .motion-word { left: 18px; padding: 7px 10px; border-radius: 7px; color: #fff; font-weight: 900; background: var(--ink); box-shadow: 0 8px 24px rgba(20,24,23,.16); }
    .motion-word.w1 { top: 20px; animation: kineticSlide 2.6s infinite both; }
    .motion-word.w2 { top: 58px; background: var(--accent); animation: kineticSlide 2.6s .22s infinite both; }
    .motion-word.w3 { top: 96px; background: var(--accent-2); animation: kineticSlide 2.6s .44s infinite both; }
    .motion-stamp { right: 20px; bottom: 22px; padding: 10px 12px; border-radius: 50%; color: #fff; background: var(--green); transform: rotate(-12deg); animation: stampPop 2.6s .7s infinite both; }
    .timeline-stage { background: #f4f1e9; }
    .timeline-rail { left: 28px; right: 28px; top: 72px; height: 4px; border-radius: 4px; background: rgba(20,24,23,.16); overflow: hidden; }
    .timeline-rail::after { content: ""; display: block; width: 100%; height: 100%; background: var(--accent); transform-origin: left; animation: railFill 3s infinite both; }
    .node { top: 62px; width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 4px solid var(--muted); }
    .node.n1 { left: 28px; animation: nodePulse 3s .15s infinite both; }
    .node.n2 { left: 33%; animation: nodePulse 3s .55s infinite both; }
    .node.n3 { left: 61%; animation: nodePulse 3s .95s infinite both; }
    .node.n4 { right: 28px; animation: nodePulse 3s 1.35s infinite both; }
    .step-label { top: 100px; color: var(--muted); font-size: 12px; font-weight: 800; }
    .step-label.l1 { left: 20px; }.step-label.l2 { left: 30%; }.step-label.l3 { left: 58%; }.step-label.l4 { right: 18px; }
    .proof-stage { background: #f2eee7; }
    .proof-stage svg, .curve-stage svg, .ip-composite-preview svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .proof-line { fill: none; stroke: var(--accent); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 180; stroke-dashoffset: 180; animation: lineDraw 2.8s infinite both; }
    .proof-line.p2 { stroke: var(--green); animation-delay: .45s; }
    .proof-card { padding: 9px 11px; border-radius: 8px; background: #fffdf7; border: 1px solid var(--line); color: var(--ink); font-weight: 900; box-shadow: 0 12px 30px rgba(20,24,23,.12); animation: cardInspect 2.8s infinite both; }
    .proof-card.c1 { left: 18px; top: 22px; }.proof-card.c2 { right: 25px; top: 28px; animation-delay: .35s; }.proof-card.c3 { left: 38%; bottom: 20px; animation-delay: .7s; }
    .curve-stage { background: #f6f4ee; }
    .axis { fill: none; stroke: rgba(20,24,23,.22); stroke-width: 3; }
    .curve-line { fill: none; stroke: var(--accent-2); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 260; stroke-dashoffset: 260; animation: curveTrace 3s infinite both; }
    .curve-dot { fill: var(--accent); opacity: 0; animation: dotResolve 3s infinite both; }
    .curve-callout { right: 22px; top: 18px; padding: 7px 9px; border-radius: 7px; color: #fff; background: var(--accent); animation: calloutPop 3s infinite both; }
    .typed-stage { background: #151719; color: #f8f6ee; }
    .typed-line { left: 22px; height: 28px; overflow: hidden; white-space: nowrap; font-weight: 900; }
    .typed-line.line-a { top: 36px; width: 96px; animation: typeWidthA 3s steps(5) infinite both; }
    .typed-line.line-b { top: 76px; width: 164px; color: #e4d1bd; animation: typeWidthB 3s steps(8) infinite both; }
    .caret { left: 188px; top: 77px; width: 3px; height: 26px; background: #f8f6ee; animation: caretBlink .7s infinite; }
    .product-stage { background: #15191d; }
    .ui-panel { border-radius: 8px; background: rgba(246,244,237,.12); border: 1px solid rgba(246,244,237,.18); }
    .ui-panel.main { left: 18px; top: 18px; width: 126px; height: 94px; animation: productGlow 3s infinite both; }
    .ui-panel.side { right: 18px; bottom: 18px; width: 92px; height: 78px; animation: productGlow 3s .55s infinite both; }
    .ui-chip { padding: 6px 8px; border-radius: 7px; font-size: 12px; font-weight: 900; color: #fff; background: var(--accent); animation: chipFlow 3s infinite both; }
    .ui-chip.input { left: 28px; bottom: 22px; }.ui-chip.build { left: 108px; bottom: 46px; animation-delay: .45s; background: var(--accent-2); }.ui-chip.done { right: 24px; top: 24px; animation-delay: .9s; background: var(--green); }
    @keyframes kineticSlide { 0% { transform: translateX(-30px); opacity: 0; } 18%, 82% { transform: none; opacity: 1; } 100% { transform: translateX(16px); opacity: 0; } }
    @keyframes stampPop { 0%, 42% { transform: scale(.65) rotate(-12deg); opacity: 0; } 55%, 86% { transform: scale(1) rotate(-12deg); opacity: 1; } 100% { opacity: 0; } }
    @keyframes railFill { 0% { transform: scaleX(0); } 70%, 100% { transform: scaleX(1); } }
    @keyframes nodePulse { 0%, 18% { border-color: var(--muted); transform: scale(.82); } 28%, 70% { border-color: var(--accent); transform: scale(1.06); } 100% { border-color: var(--muted); transform: scale(.88); } }
    @keyframes lineDraw { 0%, 18% { stroke-dashoffset: 180; opacity: .2; } 58%, 82% { stroke-dashoffset: 0; opacity: 1; } 100% { opacity: .25; } }
    @keyframes cardInspect { 0%, 25% { transform: translateY(10px); opacity: .45; } 45%, 82% { transform: none; opacity: 1; } 100% { opacity: .5; } }
    @keyframes curveTrace { 0%, 18% { stroke-dashoffset: 260; } 70%, 100% { stroke-dashoffset: 0; } }
    @keyframes dotResolve { 0%, 62% { opacity: 0; transform: scale(.6); } 76%, 100% { opacity: 1; transform: scale(1); } }
    @keyframes calloutPop { 0%, 66% { opacity: 0; transform: translateY(8px); } 78%, 100% { opacity: 1; transform: none; } }
    @keyframes typeWidthA { 0% { width: 0; } 30%, 100% { width: 96px; } }
    @keyframes typeWidthB { 0%, 32% { width: 0; } 70%, 100% { width: 164px; } }
    @keyframes caretBlink { 0%, 45% { opacity: 1; } 46%, 100% { opacity: 0; } }
    @keyframes productGlow { 0%, 100% { box-shadow: none; transform: translateY(0); } 45%, 70% { box-shadow: 0 0 28px rgba(143,182,178,.32); transform: translateY(-4px); } }
    @keyframes chipFlow { 0% { opacity: 0; transform: translateY(12px); } 24%, 82% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-8px); } }
    .feature-combo-bar { display: grid; grid-template-columns: repeat(5, minmax(128px, 1fr)); gap: 10px; align-items: stretch; margin-bottom: 14px; }
    .feature-toggle, .ip-enable-row, .whiteboard-enable-row { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 9px; align-items: center; padding: 11px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-strong); cursor: pointer; }
    .feature-toggle input, .ip-enable-row input, .whiteboard-enable-row input { width: 18px; height: 18px; }
    .feature-toggle span, .ip-enable-row strong, .whiteboard-enable-row strong { font-weight: 900; }
    .ip-enable-row em, .whiteboard-enable-row em { display: block; color: var(--muted); font-size: 12px; line-height: 1.45; font-style: normal; margin-top: 3px; }
    .layered-motion-discovery { display: grid; grid-template-columns: minmax(280px,.78fr) minmax(480px,1.22fr); gap: 14px; margin-bottom: 16px; padding: 15px; border: 1px solid var(--line); border-radius: 10px; background: linear-gradient(135deg, rgba(255,255,255,.9), rgba(236,243,255,.78)); }
    .layered-motion-discovery.selected { border-color: color-mix(in srgb, var(--accent), transparent 42%); box-shadow: 0 14px 34px rgba(34,75,130,.09); }
    .layered-motion-copy { display: grid; align-content: center; gap: 7px; }
    .layered-motion-copy small { color: var(--accent); font-weight: 950; letter-spacing: .08em; }
    .layered-motion-copy strong { font-size: 21px; line-height: 1.14; }
    .layered-motion-copy span, .layered-motion-copy em { color: var(--muted); font-size: 13px; line-height: 1.55; font-style: normal; }
    .layered-motion-copy b { color: var(--ink); font-size: 12px; }
    .layered-preview-stage { position: relative; isolation: isolate; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; align-items: center; min-height: 200px; padding: 28px 14px 18px; overflow: hidden; border-radius: 9px; background: linear-gradient(150deg,#f9fbff,#edf3fb); border: 1px solid rgba(35,64,105,.1); }
    .layered-preview-line { position: absolute; left: 7%; right: 7%; top: 44px; z-index: 0; width: 86%; height: 92px; pointer-events: none; overflow: visible; }
    .layered-preview-line path { fill: none; stroke: var(--accent); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; opacity: .72; animation: layeredPreviewDraw 2.8s cubic-bezier(.19,.82,.22,1) 1 forwards; }
    .layered-preview-card { position: relative; z-index: 1; display: grid; align-content: center; min-width: 0; min-height: 116px; padding: 20px 10px 13px; border-radius: 9px; border: 1px solid rgba(30,51,80,.12); background: rgba(255,255,255,.97); box-shadow: 0 10px 24px rgba(35,54,82,.08); animation: layeredPreviewCardIn 2.8s cubic-bezier(.19,.82,.22,1) calc(var(--i) * .13s) 1 both; }
    .layered-preview-card i { position: absolute; left: 10px; top: -11px; display: grid; place-items: center; width: 25px; height: 25px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; font-style: normal; font-weight: 950; }
    .layered-preview-card strong { font-size: 13px; line-height: 1.2; }
    .layered-preview-card span { margin-top: 5px; color: var(--muted); font-size: 10px; line-height: 1.25; }
    @keyframes layeredPreviewDraw { 0%,12% { stroke-dashoffset: 1; } 58%,100% { stroke-dashoffset: 0; } }
    @keyframes layeredPreviewCardIn { 0%,10% { opacity: 0; transform: translateY(12px); } 28%,82% { opacity: 1; transform: none; } 100% { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .layered-preview-line path, .layered-preview-card { animation: none; stroke-dashoffset: 0; opacity: 1; transform: none; } }
    .feature-combo-bar p { grid-column: 1 / -1; margin: 0; padding: 11px 12px; border-radius: 8px; background: rgba(255,255,255,.58); border: 1px dashed rgba(49,95,125,.28); color: var(--muted); line-height: 1.45; }
    .motion-pane-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
    .motion-pane-tabs button { border: 1px solid var(--line); background: var(--surface-strong); color: var(--ink); border-radius: 8px; min-height: 38px; padding: 0 14px; font-weight: 900; cursor: pointer; }
	    .motion-pane-tabs button.active { color: #fff; background: var(--ink); border-color: var(--ink); }
	    .motion-pane { display: block; }
	    .motion-pane[hidden] { display: none; }
	    .motion-style-summary { display: grid; grid-template-columns: minmax(260px, .72fr) minmax(420px, 1.28fr); gap: 10px; margin-bottom: 12px; }
	    .motion-style-overview, .motion-style-family, .motion-style-scene-strip article { border: 1px solid var(--line); border-radius: 8px; background: rgba(255,253,247,.86); }
	    .motion-style-overview { display: grid; gap: 5px; padding: 13px; align-content: center; }
	    .motion-style-overview small, .motion-style-scene-strip small { color: var(--accent); font-size: 11px; font-weight: 900; line-height: 1.2; }
	    .motion-style-overview strong { font-size: 20px; line-height: 1.15; }
	    .motion-style-overview span, .motion-style-overview em, .motion-style-scene-strip span, .motion-style-family em { color: var(--muted); font-style: normal; line-height: 1.45; font-size: 12px; }
	    .motion-style-family-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; max-height: 198px; overflow: auto; padding-right: 2px; }
	    .motion-style-family { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px; cursor: pointer; min-width: 0; }
	    .motion-style-family input { width: 15px; height: 15px; }
	    .motion-style-family span { display: grid; gap: 2px; min-width: 0; }
	    .motion-style-family b { font-size: 13px; line-height: 1.2; }
	    .motion-style-scene-strip { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
	    .motion-style-scene-strip article { display: grid; gap: 4px; padding: 10px; min-width: 0; }
	    .motion-style-scene-strip strong { font-size: 13px; line-height: 1.2; }
	    .motion-style-review-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
	    .motion-style-review-link { width: max-content; max-width: 100%; color: var(--accent); text-decoration: none; border: 1px solid rgba(49,95,125,.22); background: rgba(238,245,244,.78); border-radius: 7px; padding: 8px 10px; font-size: 12px; font-weight: 900; }
	    .motion-style-review-link.secondary { color: #7a4b2d; border-color: rgba(154,103,63,.25); background: rgba(247,238,222,.8); }
	    .style-review-page { background: #e9eee9; }
	    .style-review-shell { width: min(1540px, calc(100vw - 36px)); }
	    .style-review-filters, .style-review-variant-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
	    .style-review-filters button, .style-review-variant-strip button { border: 1px solid var(--line); border-radius: 7px; background: #fffdf7; color: var(--ink); min-height: 36px; padding: 0 10px; font-size: 12px; font-weight: 900; cursor: pointer; }
	    .style-review-filters button.active, .style-review-variant-strip button.active { color: #fff; background: var(--ink); border-color: var(--ink); }
	    .style-review-filters b { margin-left: 4px; opacity: .74; }
	    .style-review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
	    .style-review-card { display: grid; grid-template-rows: auto 1fr; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); overflow: hidden; min-width: 0; }
	    .style-review-card[hidden] { display: none; }
	    .style-review-preview-button { display: block; width: 100%; border: 0; background: transparent; padding: 0; cursor: zoom-in; text-align: left; }
	    .style-variant-panel[hidden] { display: none; }
	    .style-review-copy { display: grid; gap: 6px; padding: 12px; min-width: 0; }
	    .style-review-copy small { color: var(--accent); font-size: 11px; font-weight: 900; overflow-wrap: anywhere; }
	    .style-review-copy h3 { margin: 0; font-size: 16px; line-height: 1.22; letter-spacing: 0; }
	    .style-review-copy p, .style-review-copy span { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
	    .style-active-method { color: #6d5c4d; background: rgba(244,236,220,.68); border: 1px solid rgba(166,109,57,.18); border-radius: 7px; padding: 6px 8px; }
	    .style-variant-switcher { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: 4px; }
	    .style-variant-switcher button { min-width: 0; min-height: 34px; border: 1px solid rgba(20,24,23,.15); border-radius: 7px; background: #f7f2e8; color: #27322f; padding: 0 6px; font-size: 11px; font-weight: 900; cursor: pointer; overflow-wrap: anywhere; }
	    .style-variant-switcher button.active { background: var(--ink); color: #fffdf7; border-color: var(--ink); }
	    .style-template-preview { position: relative; width: 100%; aspect-ratio: 16 / 9; min-height: 342px; overflow: hidden; background: #f6f1e7; border-bottom: 1px solid rgba(20,24,23,.1); }
	    .style-template-preview.large { height: auto; min-height: min(74vh, 760px); border: 0; border-radius: 8px; }
	    .style-canvas { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(145deg, color-mix(in srgb, var(--style-accent) 12%, #fffdf7), #e3e9e4); }
	    .style-bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(20,24,23,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(20,24,23,.04) 1px, transparent 1px); background-size: 26px 26px; opacity: .62; }
	    .style-title { position: absolute; left: 16px; top: 14px; max-width: 58%; font-size: 20px; line-height: 1.1; letter-spacing: 0; color: #18201e; z-index: 2; animation: styleTitleIn 4s infinite both; }
	    .style-chip { position: absolute; z-index: 2; padding: 6px 8px; border-radius: 7px; font-size: 11px; font-weight: 950; color: #fff; background: var(--style-accent); box-shadow: 0 10px 22px rgba(20,24,23,.14); animation: styleChip 4s infinite both; }
	    .style-chip.a { right: 16px; top: 16px; }
	    .video-style-frame { position: absolute; inset: 0; z-index: 2; display: grid; grid-template-columns: minmax(170px, .56fr) minmax(250px, 1fr); grid-template-rows: 1fr auto; gap: 14px; padding: 22px 24px 54px; color: #131918; }
	    .style-frame-copy { align-self: center; display: grid; gap: 8px; min-width: 0; }
	    .style-frame-kicker { width: max-content; max-width: 100%; border: 1px solid color-mix(in srgb, var(--style-accent) 34%, rgba(20,24,23,.12)); border-radius: 999px; padding: 5px 9px; background: rgba(255,253,247,.72); color: color-mix(in srgb, var(--style-accent) 78%, #111716); font-size: 11px; font-weight: 950; }
	    .style-frame-copy h4 { margin: 0; max-width: 360px; font-size: 24px; line-height: 1.08; letter-spacing: 0; }
	    .style-frame-copy p { margin: 0; max-width: 360px; color: rgba(19,25,24,.72); line-height: 1.45; font-size: 13px; font-weight: 700; }
	    .style-frame-board { position: relative; min-width: 0; min-height: 0; border: 1px solid rgba(20,24,23,.12); border-radius: 10px; background: rgba(255,253,247,.64); box-shadow: 0 18px 42px rgba(20,24,23,.1); overflow: hidden; }
	    .style-frame-steps { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; min-width: 0; }
	    .style-frame-steps span { flex: 0 1 auto; min-width: 0; border: 1px solid rgba(20,24,23,.12); border-radius: 999px; padding: 5px 9px; background: rgba(255,253,247,.72); color: #25302d; font-size: 11px; font-weight: 900; animation: styleStepBlink 4s infinite both; white-space: nowrap; }
	    .style-frame-steps .s2 { animation-delay: .35s; }
	    .style-frame-steps .s3 { animation-delay: .7s; }
	    .style-frame-subtitle { position: absolute; left: 16%; right: 16%; bottom: 14px; min-height: 28px; display: grid; place-items: center; border-radius: 999px; background: rgba(18,23,22,.82); color: #fffdf7; box-shadow: 0 12px 28px rgba(20,24,23,.18); z-index: 4; }
	    .style-frame-subtitle span { padding: 5px 14px; font-size: 13px; font-weight: 900; line-height: 1.25; text-align: center; }
	    .video-style-frame { position: absolute; inset: 0; z-index: 2; display: block; padding: 18px; color: #131918; }
	    .style-page-shell { position: relative; width: 100%; height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto auto; gap: 10px; padding: 14px 16px 50px; border-radius: 12px; background: rgba(255,253,247,.72); border: 1px solid rgba(20,24,23,.1); box-shadow: inset 0 0 0 1px rgba(255,255,255,.4), 0 18px 46px rgba(20,24,23,.12); overflow: hidden; }
	    .style-page-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
	    .style-page-topline span, .style-page-topline b { min-width: 0; border-radius: 999px; padding: 5px 9px; font-size: 11px; line-height: 1.15; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .style-page-topline span { color: color-mix(in srgb, var(--style-accent) 78%, #111716); background: rgba(255,253,247,.78); border: 1px solid color-mix(in srgb, var(--style-accent) 28%, rgba(20,24,23,.1)); }
	    .style-page-topline b { color: #fffdf7; background: color-mix(in srgb, var(--style-accent) 78%, #141918); border: 1px solid rgba(20,24,23,.14); }
	    .style-page-main { min-height: 0; display: grid; grid-template-columns: minmax(210px, .74fr) minmax(320px, 1.26fr); gap: 13px; align-items: stretch; }
	    .style-frame-copy { align-self: stretch; display: grid; align-content: center; gap: 8px; min-width: 0; padding: 12px 0; }
	    .style-frame-kicker { width: max-content; max-width: 100%; border: 1px solid color-mix(in srgb, var(--style-accent) 34%, rgba(20,24,23,.12)); border-radius: 999px; padding: 5px 9px; background: rgba(255,253,247,.72); color: color-mix(in srgb, var(--style-accent) 78%, #111716); font-size: 11px; font-weight: 950; overflow-wrap: anywhere; }
	    .style-frame-copy h4 { margin: 0; max-width: 430px; font-size: 26px; line-height: 1.08; letter-spacing: 0; color: #141918; }
	    .style-frame-copy p { margin: 0; max-width: 430px; color: rgba(19,25,24,.72); line-height: 1.45; font-size: 13px; font-weight: 750; }
	    .style-proof-strip { display: grid; gap: 5px; margin-top: 2px; padding: 10px 11px; border-radius: 9px; background: color-mix(in srgb, var(--style-accent) 10%, rgba(255,253,247,.8)); border: 1px solid color-mix(in srgb, var(--style-accent) 22%, rgba(20,24,23,.1)); }
	    .style-proof-strip strong { font-size: 12px; line-height: 1.2; color: color-mix(in srgb, var(--style-accent) 76%, #141918); }
	    .style-proof-strip em { color: rgba(19,25,24,.68); font-style: normal; font-size: 11px; line-height: 1.35; font-weight: 750; }
	    .style-frame-board { position: relative; min-width: 0; min-height: 0; border: 1px solid rgba(20,24,23,.12); border-radius: 11px; background: rgba(255,253,247,.64); box-shadow: 0 18px 42px rgba(20,24,23,.1); overflow: hidden; }
	    .style-page-support { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; min-width: 0; }
	    .style-page-support span { min-width: 0; display: grid; gap: 3px; padding: 8px 9px; border-radius: 8px; background: rgba(255,253,247,.7); border: 1px solid rgba(20,24,23,.1); }
	    .style-page-support b { font-size: 11px; line-height: 1.15; color: #141918; }
	    .style-page-support em { color: rgba(19,25,24,.65); font-style: normal; font-size: 10px; line-height: 1.25; font-weight: 750; }
	    .style-frame-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; align-items: center; min-width: 0; }
	    .style-frame-steps span { min-width: 0; border: 1px solid rgba(20,24,23,.12); border-radius: 999px; padding: 5px 8px; background: rgba(255,253,247,.72); color: #25302d; font-size: 10px; font-weight: 900; animation: styleStepBlink 4s infinite both; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
	    .style-quality-strip { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
	    .style-quality-strip i { border-radius: 999px; padding: 4px 7px; background: rgba(20,24,23,.08); color: rgba(19,25,24,.72); font-size: 9px; line-height: 1.1; font-style: normal; font-weight: 900; }
	    .style-quality-strip i::before { content: "✓"; margin-right: 3px; color: color-mix(in srgb, var(--style-accent) 78%, #375d4d); }
	    .style-frame-subtitle { left: 12%; right: 12%; bottom: 10px; min-height: 30px; background: rgba(18,23,22,.86); }
	    .style-frame-subtitle span { font-size: 12px; max-width: 100%; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
	    .style-frame-card { position: relative; display: grid; align-content: center; gap: 5px; min-width: 0; padding: 12px; border-radius: 10px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.13); box-shadow: 0 10px 22px rgba(20,24,23,.08); }
	    .style-frame-card b { font-size: 12px; line-height: 1.15; }
	    .style-frame-card span { color: rgba(19,25,24,.7); font-size: 11px; line-height: 1.35; font-weight: 700; }
	    .style-frame-card.strong { border-color: color-mix(in srgb, var(--style-accent) 40%, rgba(20,24,23,.14)); box-shadow: 0 14px 30px color-mix(in srgb, var(--style-accent) 18%, transparent); }
	    .style-frame-card.muted { opacity: .7; filter: saturate(.78); }
	    .style-claim-grid, .style-before-after-board, .style-cover-board { position: absolute; inset: 18px; display: grid; grid-template-columns: 1fr 58px 1fr; gap: 12px; align-items: center; }
	    .claim-card-left, .claim-card-right { min-height: 150px; align-content: start; }
	    .claim-card-left i { display: block; height: 7px; border-radius: 8px; background: rgba(20,24,23,.16); margin-top: 7px; }
	    .claim-card-left i:nth-of-type(2) { width: 72%; }
	    .claim-card-left i:nth-of-type(3) { width: 48%; }
	    .claim-card-right em { margin-top: auto; border-radius: 8px; padding: 8px 9px; background: color-mix(in srgb, var(--style-accent) 12%, rgba(255,253,247,.92)); color: color-mix(in srgb, var(--style-accent) 78%, #141918); font-size: 10px; line-height: 1.25; font-style: normal; font-weight: 900; }
	    .claim-proof-tape { position: absolute; left: 8%; right: 8%; bottom: 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
	    .claim-proof-tape span { min-width: 0; border-radius: 999px; padding: 7px 8px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.12); color: #25302d; font-size: 10px; font-weight: 950; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .style-flip-action, .bridge-arrow { display: grid; place-items: center; min-width: 0; height: 44px; border-radius: 999px; background: var(--style-accent); color: #fffdf7; font-size: 11px; font-weight: 950; animation: styleChip 4s infinite both; }
	    .bridge-arrow::after { content: "→"; font-size: 24px; line-height: 1; }
	    .style-timeline-board { position: absolute; inset: 20px; }
	    .tl-rail { position: absolute; left: 34px; right: 34px; top: 50%; height: 5px; border-radius: 5px; background: rgba(20,24,23,.16); overflow: hidden; }
	    .tl-rail::after { content: ""; display: block; height: 100%; background: var(--style-accent); transform-origin: left; animation: railFill 4s infinite both; }
	    .tl-node { position: absolute; top: calc(50% - 22px); width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: #fffdf7; border: 4px solid rgba(20,24,23,.22); font-style: normal; animation: nodePulse 4s infinite both; }
	    .tl-node b { font-size: 11px; }
	    .tl-node.n1 { left: 8px; }.tl-node.n2 { left: 31%; animation-delay: .25s; }.tl-node.n3 { left: 58%; animation-delay: .5s; }.tl-node.n4 { right: 8px; animation-delay: .75s; }
	    .style-frame-card.floating { position: absolute; right: 8px; bottom: 8px; width: min(220px, 48%); }
	    .style-proof-board, .style-data-board, .style-whiteboard-board, .style-story-board, .style-journey-board { position: absolute; inset: 0; }
	    .style-proof-board svg, .style-data-board svg, .style-whiteboard-board svg, .style-story-board svg, .style-journey-board svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	    .style-proof-board svg path, .style-story-board svg path, .style-journey-board svg path { fill: none; stroke: var(--style-accent); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 560; stroke-dashoffset: 560; animation: stylePathDraw 4s infinite both; }
	    .style-frame-card.pin { position: absolute; width: 34%; }
	    .style-frame-card.pin.a { left: 18px; top: 24px; }.style-frame-card.pin.b { right: 18px; top: 28px; }.style-frame-card.pin.c { left: 33%; bottom: 18px; }
	    .style-code-board { position: absolute; inset: 16px; display: grid; grid-template-columns: 1.12fr .78fr; grid-template-rows: 1fr auto; gap: 10px; }
	    .code-editor { grid-row: 1 / -1; display: grid; align-content: center; gap: 10px; min-width: 0; overflow: hidden; padding: 16px; border-radius: 10px; background: #151a1b; color: #eaf0ec; }
	    .code-editor span { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 6px; align-items: center; min-width: 0; max-width: 100%; overflow: hidden; white-space: nowrap; color: rgba(234,240,236,.74); font-size: 11px; font-weight: 800; }
	    .code-editor em { color: rgba(234,240,236,.34); font-style: normal; }
	    .code-editor .active { color: #fffdf7; background: color-mix(in srgb, var(--style-accent) 36%, transparent); border-radius: 7px; padding: 6px; }
	    .run-panel, .output-panel { border-radius: 10px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.12); padding: 13px; }
	    .run-panel { display: grid; gap: 8px; }
	    .run-panel i { width: 54px; height: 8px; border-radius: 8px; background: var(--style-accent); animation: railFill 4s infinite both; }
	    .run-panel span, .output-panel { color: rgba(19,25,24,.72); font-size: 12px; font-weight: 800; }
	    .style-data-board .axis { fill: none; stroke: rgba(20,24,23,.24); stroke-width: 3; }
	    .style-data-board .curve { fill: none; stroke: var(--style-accent); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 620; stroke-dashoffset: 620; animation: stylePathDraw 4s infinite both; }
	    .style-data-board circle { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 4; animation: styleDot 4s infinite both; }
	    .kpi-card { position: absolute; left: 18px; top: 18px; display: grid; gap: 3px; padding: 11px 13px; border-radius: 10px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.12); z-index: 2; }
	    .kpi-card b { font-size: 11px; }.kpi-card span { font-size: 22px; font-weight: 950; color: var(--style-accent); }
	    .chart-note { position: absolute; right: 18px; bottom: 20px; width: 38%; }
	    .style-type-board, .style-quote-board { position: absolute; inset: 20px; display: grid; align-content: center; gap: 12px; }
	    .style-type-board strong, .style-quote-board strong { font-size: 30px; line-height: 1.05; animation: styleTypeIn 4s infinite both; }
	    .style-type-board span, .style-quote-board span { color: rgba(19,25,24,.68); font-size: 14px; font-weight: 800; }
	    .style-type-board i { width: 5px; height: 34px; background: var(--style-accent); animation: caretBlink .7s infinite; }
	    .style-whiteboard-board .sketch { fill: none; stroke: #111716; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 620; stroke-dashoffset: 620; animation: stylePathDraw 4s infinite both; }
	    .style-whiteboard-board .mark { fill: none; stroke: #c45b3a; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 260; stroke-dashoffset: 260; animation: stylePathDraw 4s .4s infinite both; }
	    .style-frame-card.wb { position: absolute; width: 34%; }.style-frame-card.wb.a { left: 18px; top: 20px; }.style-frame-card.wb.b { right: 18px; bottom: 20px; }
	    .cover-mini { display: grid; align-content: center; gap: 12px; min-height: 150px; padding: 18px; border-radius: 12px; background: #151a1b; color: #fffdf7; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
	    .cover-mini b { font-size: 20px; line-height: 1.1; }.cover-mini span { color: color-mix(in srgb, var(--style-accent) 72%, #fffdf7); font-weight: 900; }
	    .style-ip-board { position: absolute; inset: 16px; display: grid; grid-template-columns: 82px minmax(0, 1fr) 68px; gap: 10px; align-items: center; min-width: 0; overflow: hidden; }
	    .style-template-preview.large .style-ip-board { grid-template-columns: 130px minmax(0, 1fr) 104px; }
	    .presenter { position: relative; height: 160px; min-width: 0; overflow: hidden; }
	    .presenter i { position: absolute; left: 27px; top: 10px; width: 48px; height: 48px; border-radius: 50%; background: #c9a17a; }
	    .presenter b { position: absolute; left: 16px; top: 64px; width: 70px; height: 90px; border-radius: 28px 28px 12px 12px; background: #344b45; }
	    .presenter span { position: absolute; left: 70px; top: 80px; width: 54px; height: 7px; border-radius: 8px; background: var(--style-accent); transform: rotate(-22deg); transform-origin: left center; }
	    .knowledge { min-height: 150px; }
	    .agent-stack { display: grid; gap: 8px; }
	    .agent-stack span { border-radius: 999px; padding: 8px 9px; background: color-mix(in srgb, var(--style-accent) 18%, #fffdf7); border: 1px solid rgba(20,24,23,.1); font-size: 11px; font-weight: 900; text-align: center; animation: styleDot 4s infinite both; }
	    .style-matrix-board { position: absolute; inset: 22px; }
	    .axis-x, .axis-y { position: absolute; background: rgba(20,24,23,.28); }
	    .axis-x { left: 20px; right: 12px; bottom: 38px; height: 3px; }.axis-y { left: 42px; top: 12px; bottom: 20px; width: 3px; }
	    .style-matrix-board .dot { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: rgba(20,24,23,.25); }
	    .style-matrix-board .d1 { left: 92px; bottom: 78px; }.style-matrix-board .d2 { right: 92px; bottom: 108px; }.style-matrix-board .selected { right: 54px; top: 42px; width: 28px; height: 28px; background: var(--style-accent); box-shadow: 0 0 0 8px color-mix(in srgb, var(--style-accent) 20%, transparent); animation: styleDot 4s infinite both; }
	    .matrix-note { position: absolute; right: 12px; bottom: 8px; width: 42%; }
	    .style-dashboard-board { position: absolute; inset: 16px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: auto 1fr; gap: 10px; }
	    .metric.active { border-color: color-mix(in srgb, var(--style-accent) 44%, rgba(20,24,23,.12)); }
	    .focus-panel { grid-column: 1 / -1; display: grid; align-content: center; gap: 8px; padding: 16px; border-radius: 12px; background: #151a1b; color: #fffdf7; }
	    .focus-panel b { font-size: 18px; }.focus-panel span { color: rgba(255,253,247,.72); font-weight: 800; }
	    .style-formula-board { position: absolute; inset: 20px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
	    .style-formula-board span, .style-formula-board b { padding: 12px 14px; border-radius: 10px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.12); font-size: 14px; font-weight: 950; }
	    .style-formula-board i { color: var(--style-accent); font-size: 24px; font-style: normal; font-weight: 950; }
	    .style-orbit-board { position: absolute; inset: 18px; display: grid; place-items: center; }
	    .orbit-core { width: 116px; height: 116px; border-radius: 50%; display: grid; place-items: center; background: var(--style-accent); color: #fffdf7; font-size: 18px; font-weight: 950; box-shadow: 0 0 0 34px color-mix(in srgb, var(--style-accent) 12%, transparent); }
	    .orb { position: absolute; border-radius: 999px; padding: 8px 10px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.12); font-size: 12px; font-weight: 900; }
	    .orb.o1 { left: 26px; top: 40%; }.orb.o2 { top: 24px; }.orb.o3 { right: 26px; top: 40%; }.orb.o4 { bottom: 24px; }
	    .style-material-board { position: absolute; inset: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: start; }
	    .media-tile { min-height: 112px; border-radius: 12px; background: rgba(255,253,247,.76); border: 1px solid rgba(20,24,23,.12); display: grid; align-content: center; justify-items: center; gap: 8px; animation: styleCardFloat 4s infinite both; }
	    .media-tile i { width: 44px; height: 30px; border-radius: 8px; background: var(--style-accent); position: relative; }
	    .media-tile i::after { content: ""; position: absolute; left: 17px; top: 8px; border-left: 12px solid #fffdf7; border-top: 7px solid transparent; border-bottom: 7px solid transparent; }
	    .media-tile b { font-size: 11px; }.material-note { position: absolute; left: 25%; right: 25%; bottom: 8px; }
	    .style-quote-board b { width: max-content; max-width: 100%; border-radius: 999px; padding: 8px 12px; background: var(--style-accent); color: #fffdf7; font-size: 12px; }
	    .style-gate-board { position: absolute; inset: 18px; display: grid; grid-template-columns: .8fr .8fr .8fr 1fr; gap: 10px; align-items: center; }
	    .style-gate-board > span { display: grid; place-items: center; min-height: 74px; border-radius: 12px; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.12); font-size: 12px; font-weight: 950; }
	    .style-gate-board > span::before { content: "✓"; color: #4f735f; margin-right: 4px; }
	    .style-gate-board > span.warn::before { content: "!"; color: #c45b3a; }
	    .gate-note { min-height: 100px; }
	    .journey-note { position: absolute; left: 36%; top: 28px; width: 36%; }
	    .style-recap-board { position: absolute; inset: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: center; }
	    .loop-card { grid-column: 1 / -1; justify-self: center; border-radius: 999px; padding: 12px 18px; background: var(--style-accent); color: #fffdf7; font-size: 14px; font-weight: 950; animation: styleChip 4s infinite both; }
	    .style-chip.b { right: 16px; top: 16px; background: #2a302d; animation-delay: .36s; }
	    .style-card { position: absolute; display: block; border-radius: 8px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.11); box-shadow: 0 18px 34px rgba(20,24,23,.12); z-index: 1; animation: styleCardFloat 4s infinite both; }
	    .style-card.main { left: 52px; right: 80px; top: 58px; height: 52px; }
	    .style-card.side { right: 22px; bottom: 24px; width: 64px; height: 58px; animation-delay: .5s; }
	    .style-template-preview svg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }
	    .style-example-svg text { font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif; letter-spacing: 0; }
	    .ex-kicker { fill: color-mix(in srgb, var(--style-accent) 88%, #111716); font-size: 10px; font-weight: 950; }
	    .ex-title { fill: #141816; font-size: 14px; font-weight: 950; }
	    .style-base-typed-black-white-opener .ex-title, .style-base-typed-black-white-opener .ex-kicker, .style-variant-editorial-contrast .ex-title, .style-variant-editorial-contrast .ex-kicker { fill: #fffdf7; }
	    .ex-step { fill: rgba(20,24,23,.52); font-size: 9px; font-weight: 900; }
	    .ex-text { fill: #141816; font-size: 11px; font-weight: 900; }
	    .ex-text.muted { fill: #66726d; }
	    .ex-text.light, .ex-chip-text { fill: #fffdf7; font-size: 10px; font-weight: 950; }
	    .ex-type-text { fill: #fffdf7; font-size: 22px; font-weight: 950; animation: styleTypeIn 4s infinite both; }
	    .ex-type-text.accent { fill: color-mix(in srgb, var(--style-accent) 72%, #fffdf7); animation-delay: .3s; }
	    .ex-formula { fill: #141816; font-size: 24px; font-weight: 950; }
	    .ex-formula.small { font-size: 18px; fill: #4f5a55; }
	    .ex-formula.result { fill: var(--style-accent); font-size: 28px; }
	    .ex-quote { fill: #141816; font-size: 23px; font-weight: 950; }
	    .ex-panel { fill: rgba(255,253,247,.9); stroke: rgba(20,24,23,.16); stroke-width: 1.4; animation: styleCardFloat 4s infinite both; }
	    .ex-panel.muted { fill: rgba(231,229,220,.78); opacity: .88; }
	    .ex-panel.accent, .ex-accent, .ex-lock { fill: var(--style-accent); stroke: color-mix(in srgb, var(--style-accent) 72%, #111716); stroke-width: 1; }
	    .ex-panel.dark { fill: #171c1d; stroke: rgba(255,253,247,.18); }
	    .ex-panel.cover { fill: color-mix(in srgb, var(--style-accent) 16%, #fffdf7); }
	    .ex-panel.media { fill: #e9eee9; }
	    .ex-line, .ex-curve, .ex-sketch { fill: none; stroke: var(--style-accent); stroke-width: 4.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 260; stroke-dashoffset: 260; animation: stylePathDraw 4s infinite both; }
	    .ex-line.red { stroke: #c45b3a; }
	    .ex-line.no-arrow { marker-end: none; }
	    .ex-rule, .ex-axis { fill: none; stroke: rgba(20,24,23,.34); stroke-width: 3; stroke-linecap: round; }
	    .ex-rule.light { stroke: rgba(255,253,247,.42); }
	    .ex-rule.muted { stroke: rgba(20,24,23,.18); }
	    .ex-rule-fill, .ex-code-line { fill: rgba(20,24,23,.26); animation: examplePulse 4s infinite both; }
	    .ex-code-line.a { fill: #78a6c8; }
	    .ex-code-line.b { fill: #e0c28e; animation-delay: .2s; }
	    .ex-code-line.c { fill: #9fc0aa; animation-delay: .4s; }
	    .ex-code-line.d { fill: #c98b70; animation-delay: .6s; }
	    .ex-dark-line { fill: #141816; }
	    .ex-accent-fill { fill: var(--style-accent); }
	    .ex-node { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 4; animation: styleDot 4s infinite both; }
	    .ex-node.a { animation-delay: .05s; }
	    .ex-node.b { animation-delay: .28s; }
	    .ex-node.c { animation-delay: .54s; }
	    .ex-node.d { animation-delay: .78s; }
	    .ex-dot.muted { fill: rgba(20,24,23,.28); }
	    .ex-pulse { fill: var(--style-accent); opacity: .88; animation: examplePulse 4s infinite both; }
	    .ex-plus { fill: none; stroke: #fffdf7; stroke-width: 4; stroke-linecap: round; }
	    .ex-axis { stroke-width: 2.4; }
	    .ex-sketch { stroke: #101615; stroke-width: 3.2; }
	    .ex-sketch-circle { fill: none; stroke: #c45b3a; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 120; stroke-dashoffset: 120; animation: stylePathDraw 4s infinite both; }
	    .ex-person-head { fill: #101615; }
	    .ex-person-body { fill: #29302f; }
	    .ex-orbit { fill: none; stroke: rgba(20,24,23,.26); stroke-width: 2.6; stroke-dasharray: 8 6; animation: orbitSpin 8s linear infinite; transform-origin: 160px 92px; }
	    .ex-orbit-core { fill: var(--style-accent); }
	    .ex-check { fill: none; stroke: #4f735f; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; animation: examplePulse 4s infinite both; }
	    .ex-cross { fill: none; stroke: #c45b3a; stroke-width: 4; stroke-linecap: round; animation: examplePulse 4s infinite both; animation-delay: .7s; }
	    .ex-caret { fill: #fffdf7; animation: caretBlink .7s infinite; }
	    .ex-variant-frame { fill: none; stroke: rgba(20,24,23,.18); stroke-width: 1.8; stroke-dasharray: 10 8; }
	    .ex-variant-guide, .ex-variant-cut, .ex-variant-hand, .ex-variant-glass-line { fill: none; stroke: rgba(20,24,23,.28); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 8 7; animation: stylePathDraw 5s infinite both; }
	    .ex-variant-dot { fill: var(--style-accent); opacity: .65; }
	    .ex-variant-editorial-band { fill: rgba(20,24,23,.72); }
	    .ex-variant-editorial-slice { fill: none; stroke: rgba(20,24,23,.28); stroke-width: 7; }
	    .ex-variant-vertical { fill: #fffdf7; font-size: 12px; font-weight: 950; writing-mode: tb; glyph-orientation-vertical: 0; }
	    .ex-variant-glass { fill: rgba(255,255,255,.28); stroke: rgba(255,255,255,.72); stroke-width: 1.4; filter: drop-shadow(0 12px 24px rgba(49,95,125,.16)); }
	    .ex-variant-glass-chip { fill: rgba(255,255,255,.52); stroke: rgba(255,255,255,.78); stroke-width: 1; }
	    .ex-variant-glass-line { stroke: rgba(20,24,23,.24); stroke-width: 3; stroke-dasharray: none; }
	    .ex-variant-hand { stroke: #a84735; stroke-width: 3; }
	    .ex-variant-sticky { fill: rgba(255,246,222,.88); stroke: rgba(166,109,57,.24); stroke-width: 1.2; }
	    .ex-variant-note { fill: #9b5d32; font-size: 11px; font-weight: 950; }
	    .ex-variant-bright-rail { fill: rgba(255,255,255,.72); stroke: color-mix(in srgb, var(--style-accent) 28%, #d8e6dd); stroke-width: 1; }
	    .ex-variant-bright { fill: var(--style-accent); opacity: .86; animation: styleDot 4s infinite both; }
	    .ex-variant-bright.b { fill: #4f735f; animation-delay: .18s; }
	    .ex-variant-bright.c { fill: #e0a33f; animation-delay: .36s; }
	    .style-example-code-walkthrough .style-canvas, .style-example-dashboard-inspection .style-canvas { background: linear-gradient(145deg, #151a1b, #24302f); }
	    .style-example-code-walkthrough .style-caption-safe, .style-example-dashboard-inspection .style-caption-safe { background: rgba(255,253,247,.26); }
	    .style-example-formula-derivation .style-canvas, .style-example-whiteboard-method .style-canvas { background: linear-gradient(145deg, #fffdf7, #eee7dc); }
	    .style-example-data-chart .style-canvas { background: linear-gradient(145deg, #f7fbf8, color-mix(in srgb, var(--style-accent) 12%, #e5efe9)); }
	    .style-example-ip-knowledge-card .style-canvas { background: linear-gradient(145deg, #fbfaf5, #ede6db); }
	    .style-variant-calm-premium .ex-panel { stroke-width: 1.2; filter: drop-shadow(0 10px 14px rgba(20,24,23,.06)); }
	    .style-variant-editorial-contrast .ex-panel { fill: rgba(255,253,247,.74); stroke: rgba(255,253,247,.32); filter: drop-shadow(0 14px 20px rgba(0,0,0,.22)); }
	    .style-variant-editorial-contrast .ex-title, .style-variant-editorial-contrast .ex-step { fill: #fffdf7; }
	    .style-variant-glass-product .style-canvas { background: linear-gradient(145deg, #eaf4f8, color-mix(in srgb, var(--style-accent) 18%, #f8fffb)); }
	    .style-variant-glass-product .style-bg-grid { opacity: .22; }
	    .style-variant-glass-product .ex-panel { fill: rgba(255,255,255,.48); stroke: rgba(255,255,255,.72); filter: drop-shadow(0 18px 24px rgba(49,95,125,.16)); }
	    .style-variant-glass-product .ex-rule-fill, .style-variant-glass-product .ex-code-line { opacity: .72; }
	    .style-variant-warm-paper .style-canvas { background: linear-gradient(145deg, #fbf0df, #eee0c8); }
	    .style-variant-warm-paper .style-bg-grid { background-size: 20px 20px; opacity: .28; }
	    .style-variant-warm-paper .ex-panel { fill: #fff8ec; stroke: #d7c2a6; filter: drop-shadow(0 8px 0 rgba(166,109,57,.08)); }
	    .style-variant-warm-paper .ex-line, .style-variant-warm-paper .ex-curve { stroke-width: 5.4; }
	    .style-variant-bright-clean .style-bg-grid { opacity: .18; }
	    .style-variant-bright-clean .ex-panel { fill: rgba(255,255,255,.86); stroke: color-mix(in srgb, var(--style-accent) 28%, #d8e6dd); }
	    .style-variant-bright-clean .ex-accent, .style-variant-bright-clean .ex-panel.accent { filter: drop-shadow(0 12px 20px color-mix(in srgb, var(--style-accent) 24%, transparent)); }
	    .style-variant-editorial-contrast .style-frame-copy h4,
	    .style-base-dark-saas-magic-ui .style-frame-copy h4,
	    .style-base-typed-black-white-opener .style-frame-copy h4 { color: #fffdf7; }
	    .style-variant-editorial-contrast .style-frame-copy p,
	    .style-base-dark-saas-magic-ui .style-frame-copy p,
	    .style-base-typed-black-white-opener .style-frame-copy p { color: rgba(255,253,247,.74); }
	    .style-variant-editorial-contrast .style-page-shell,
	    .style-base-dark-saas-magic-ui .style-page-shell,
	    .style-base-typed-black-white-opener .style-page-shell { background: rgba(16,20,20,.58); border-color: rgba(255,253,247,.16); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 22px 54px rgba(0,0,0,.24); }
	    .style-variant-editorial-contrast .style-page-topline span,
	    .style-base-dark-saas-magic-ui .style-page-topline span,
	    .style-base-typed-black-white-opener .style-page-topline span { background: rgba(255,253,247,.12); color: #fffdf7; border-color: rgba(255,253,247,.22); }
	    .style-variant-editorial-contrast .style-page-support span,
	    .style-base-dark-saas-magic-ui .style-page-support span,
	    .style-base-typed-black-white-opener .style-page-support span,
	    .style-variant-editorial-contrast .style-proof-strip,
	    .style-base-dark-saas-magic-ui .style-proof-strip,
	    .style-base-typed-black-white-opener .style-proof-strip { background: rgba(255,253,247,.12); border-color: rgba(255,253,247,.16); }
	    .style-variant-editorial-contrast .style-page-support b,
	    .style-base-dark-saas-magic-ui .style-page-support b,
	    .style-base-typed-black-white-opener .style-page-support b,
	    .style-variant-editorial-contrast .style-proof-strip strong,
	    .style-base-dark-saas-magic-ui .style-proof-strip strong,
	    .style-base-typed-black-white-opener .style-proof-strip strong { color: #fffdf7; }
	    .style-variant-editorial-contrast .style-page-support em,
	    .style-base-dark-saas-magic-ui .style-page-support em,
	    .style-base-typed-black-white-opener .style-page-support em,
	    .style-variant-editorial-contrast .style-proof-strip em,
	    .style-base-dark-saas-magic-ui .style-proof-strip em,
	    .style-base-typed-black-white-opener .style-proof-strip em,
	    .style-variant-editorial-contrast .style-quality-strip i,
	    .style-base-dark-saas-magic-ui .style-quality-strip i,
	    .style-base-typed-black-white-opener .style-quality-strip i { color: rgba(255,253,247,.72); }
	    .style-variant-editorial-contrast .style-frame-kicker,
	    .style-base-dark-saas-magic-ui .style-frame-kicker,
	    .style-base-typed-black-white-opener .style-frame-kicker { background: rgba(255,253,247,.14); color: #fffdf7; border-color: rgba(255,253,247,.26); }
	    .style-variant-editorial-contrast .style-frame-steps span,
	    .style-base-dark-saas-magic-ui .style-frame-steps span,
	    .style-base-typed-black-white-opener .style-frame-steps span { background: rgba(255,253,247,.16); color: #fffdf7; border-color: rgba(255,253,247,.2); }
	    .style-page-shell { isolation: isolate; container-type: inline-size; grid-template-rows: auto minmax(0, 1fr) auto auto auto; }
	    .style-page-main { position: relative; overflow: hidden; z-index: 1; }
	    .style-page-topline { position: relative; z-index: 6; }
	    .style-frame-board { z-index: 1; }
	    .style-frame-copy { position: relative; z-index: 4; }
	    .style-page-support, .style-frame-steps, .style-quality-strip { position: relative; z-index: 5; }
	    .style-frame-subtitle { z-index: 8; pointer-events: none; }
	    .style-galacean-effect { position: absolute; inset: 0; pointer-events: none; overflow: hidden; mix-blend-mode: normal; }
	    .style-galacean-effect.layer-background { z-index: 0; opacity: .34; }
	    .style-galacean-effect.layer-foreground { z-index: 3; opacity: .46; }
	    .style-galacean-effect i { position: absolute; display: block; border-radius: 999px; background: color-mix(in srgb, var(--style-accent) 62%, transparent); filter: blur(.2px); }
	    .effect-path-trail-trace i:nth-child(1), .effect-energy-beam-reveal i:nth-child(1) { left: 12%; top: 48%; width: 72%; height: 4px; transform-origin: left; animation: railFill 4s infinite both; }
	    .effect-path-trail-trace i:nth-child(2) { left: 42%; top: 30%; width: 18px; height: 18px; box-shadow: 0 0 0 10px color-mix(in srgb, var(--style-accent) 18%, transparent); animation: styleDot 4s infinite both; }
	    .effect-energy-beam-reveal i:nth-child(1) { height: 7px; transform: rotate(-6deg); box-shadow: 0 0 24px color-mix(in srgb, var(--style-accent) 34%, transparent); }
	    .effect-focus-scan-spotlight i:nth-child(1) { left: 46%; top: 18%; width: 34%; height: 52%; border: 1px solid color-mix(in srgb, var(--style-accent) 42%, rgba(255,253,247,.5)); background: radial-gradient(circle, color-mix(in srgb, var(--style-accent) 20%, transparent), transparent 66%); animation: styleCardFloat 4s infinite both; }
	    .effect-ui-activation-sparkle i { width: 8px; height: 8px; animation: styleDot 4s infinite both; }
	    .effect-ui-activation-sparkle i:nth-child(1) { left: 62%; top: 28%; }.effect-ui-activation-sparkle i:nth-child(2) { left: 70%; top: 46%; animation-delay: .18s; }.effect-ui-activation-sparkle i:nth-child(3) { left: 54%; top: 58%; animation-delay: .34s; }
	    .effect-rich-text-effect-plate i:nth-child(1) { left: 12%; right: 12%; top: 42%; height: 34px; background: color-mix(in srgb, var(--style-accent) 14%, #fffdf7); transform: rotate(-1deg); animation: styleChip 4s infinite both; }
	    .effect-transition-burst i, .effect-firework-payoff i { left: 58%; top: 38%; width: 12px; height: 12px; box-shadow: 0 -34px 0 color-mix(in srgb, var(--style-accent) 34%, transparent), 38px 0 0 color-mix(in srgb, var(--style-accent) 24%, transparent), -34px 18px 0 color-mix(in srgb, var(--style-accent) 28%, transparent); animation: styleDot 4s infinite both; }
	    .effect-depth-orbit-3d i:nth-child(1) { left: 38%; top: 22%; width: 210px; height: 150px; border: 2px solid color-mix(in srgb, var(--style-accent) 30%, transparent); background: transparent; transform: rotate(-14deg); animation: orbitSpin 18s linear infinite; }
	    .effect-ambient-falling-elements i, .effect-particle-atmosphere i { width: 10px; height: 18px; opacity: .6; animation: styleCardFloat 4s infinite both; }
	    .effect-ambient-falling-elements i:nth-child(1), .effect-particle-atmosphere i:nth-child(1) { left: 58%; top: 18%; }.effect-ambient-falling-elements i:nth-child(2), .effect-particle-atmosphere i:nth-child(2) { left: 76%; top: 30%; animation-delay: .22s; }
	    .effect-texture-video-plane i:nth-child(1) { left: 46%; top: 16%; width: 36%; height: 54%; border-radius: 16px; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--style-accent) 13%, transparent) 0 10px, transparent 10px 20px); animation: styleCardFloat 4s infinite both; }
	    .effect-spine-character-motion i:nth-child(1) { left: 42%; bottom: 18%; width: 48px; height: 88px; border-radius: 28px 28px 14px 14px; background: color-mix(in srgb, var(--style-accent) 36%, transparent); animation: styleCardFloat 4s infinite both; }
	    .style-page-support span, .style-frame-steps span, .style-quality-strip i { backdrop-filter: blur(10px); }
	    .designed-title { margin: 0; max-width: min(430px, 100%); display: grid; gap: 5px; align-items: start; color: #141918; letter-spacing: 0; }
	    .designed-title span { min-width: 0; max-width: 100%; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
	    .designed-title .title-large { font-size: 27px; line-height: 1.04; font-weight: 980; }
	    .designed-title .title-slab { width: max-content; max-width: 100%; padding: 3px 8px 5px; border-radius: 8px; color: #fffdf7; background: #141918; font-size: 27px; line-height: 1; font-weight: 980; box-decoration-break: clone; }
	    .designed-title .title-slab.accent { justify-self: start; color: #fffdf7; background: var(--style-accent); transform: translateX(18px); }
	    .designed-title .title-rule { width: 58px; height: 5px; border-radius: 8px; background: var(--style-accent); }
	    .designed-title .title-foot, .designed-title .title-note, .designed-title .title-axis, .designed-title .title-delta, .designed-title .title-pressure, .designed-title .title-system, .designed-title .title-media, .designed-title .title-path, .designed-title .title-summary, .designed-title .title-hook { width: max-content; max-width: 100%; padding: 4px 7px; border-radius: 999px; background: color-mix(in srgb, var(--style-accent) 12%, rgba(255,253,247,.78)); color: color-mix(in srgb, var(--style-accent) 78%, #141918); border: 1px solid color-mix(in srgb, var(--style-accent) 26%, rgba(20,24,23,.1)); font-size: 10px; line-height: 1.1; font-weight: 950; }
	    .designed-title .title-metric, .designed-title .title-command, .designed-title .title-formula, .designed-title .title-terminal, .designed-title .title-before, .designed-title .title-after { width: max-content; max-width: 100%; padding: 4px 8px; border-radius: 7px; background: rgba(20,24,23,.88); color: #fffdf7; font-size: 11px; line-height: 1.1; font-weight: 950; }
	    .mode-data-mono, .mode-code-terminal, .mode-math-coordinate { font-family: "SFMono-Regular", "Menlo", "Consolas", monospace; }
	    .mode-data-mono { grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; column-gap: 8px; }
	    .mode-data-mono .title-large { font-size: 22px; }
	    .mode-product-ui { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 8px; }
	    .mode-warm-annotation .title-marker { width: 72%; height: 11px; border-radius: 9px; background: rgba(196,91,58,.24); transform: rotate(-1deg); }
	    .mode-math-coordinate { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: 8px; }
	    .mode-code-terminal .title-terminal { background: #151a1b; color: #9fc0aa; }
	    .mode-comparison-slab { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: 7px; }
	    .mode-comparison-slab .title-after { background: var(--style-accent); }
	    .layout-full-poster .style-page-main,
	    .layout-data-stage .style-page-main,
	    .layout-coordinate-stage .style-page-main,
	    .layout-math-canvas .style-page-main,
	    .layout-dashboard-stage .style-page-main,
	    .layout-orbit-stage .style-page-main,
	    .layout-media-stage .style-page-main,
	    .layout-editorial-poster .style-page-main,
	    .layout-map-stage .style-page-main { display: block; min-height: 0; }
	    .layout-full-poster .style-frame-board,
	    .layout-data-stage .style-frame-board,
	    .layout-coordinate-stage .style-frame-board,
	    .layout-math-canvas .style-frame-board,
	    .layout-dashboard-stage .style-frame-board,
	    .layout-orbit-stage .style-frame-board,
	    .layout-media-stage .style-frame-board,
	    .layout-editorial-poster .style-frame-board,
	    .layout-map-stage .style-frame-board { position: absolute; inset: 0; }
	    .layout-full-poster .style-frame-copy,
	    .layout-data-stage .style-frame-copy,
	    .layout-coordinate-stage .style-frame-copy,
	    .layout-math-canvas .style-frame-copy,
	    .layout-dashboard-stage .style-frame-copy,
	    .layout-orbit-stage .style-frame-copy,
	    .layout-media-stage .style-frame-copy,
	    .layout-editorial-poster .style-frame-copy,
	    .layout-map-stage .style-frame-copy { position: absolute; left: 16px; top: 16px; width: min(360px, 42%); max-height: calc(100% - 32px); align-content: start; padding: 12px; border-radius: 11px; background: rgba(255,253,247,.74); border: 1px solid rgba(20,24,23,.12); box-shadow: 0 18px 38px rgba(20,24,23,.12); backdrop-filter: blur(12px); overflow: hidden; }
	    .layout-full-poster .style-frame-copy p,
	    .layout-data-stage .style-frame-copy p,
	    .layout-coordinate-stage .style-frame-copy p,
	    .layout-math-canvas .style-frame-copy p,
	    .layout-dashboard-stage .style-frame-copy p,
	    .layout-orbit-stage .style-frame-copy p,
	    .layout-media-stage .style-frame-copy p,
	    .layout-editorial-poster .style-frame-copy p,
	    .layout-map-stage .style-frame-copy p { font-size: 12px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	    .layout-full-poster .style-proof-strip,
	    .layout-data-stage .style-proof-strip,
	    .layout-coordinate-stage .style-proof-strip,
	    .layout-math-canvas .style-proof-strip,
	    .layout-dashboard-stage .style-proof-strip,
	    .layout-orbit-stage .style-proof-strip,
	    .layout-media-stage .style-proof-strip,
	    .layout-editorial-poster .style-proof-strip,
	    .layout-map-stage .style-proof-strip { padding: 8px; }
	    .layout-data-stage .style-frame-copy,
	    .layout-coordinate-stage .style-frame-copy,
	    .layout-math-canvas .style-frame-copy { width: min(275px, 35%); }
	    .layout-data-stage .style-frame-copy .style-proof-strip,
	    .layout-coordinate-stage .style-frame-copy .style-proof-strip,
	    .layout-math-canvas .style-frame-copy .style-proof-strip { display: none; }
	    .layout-full-poster .style-page-support span,
	    .layout-data-stage .style-page-support span,
	    .layout-coordinate-stage .style-page-support span,
	    .layout-math-canvas .style-page-support span,
	    .layout-dashboard-stage .style-page-support span,
	    .layout-orbit-stage .style-page-support span,
	    .layout-media-stage .style-page-support span,
	    .layout-editorial-poster .style-page-support span,
	    .layout-map-stage .style-page-support span { padding: 6px 8px; }
	    .layout-full-poster .style-page-support em,
	    .layout-data-stage .style-page-support em,
	    .layout-coordinate-stage .style-page-support em,
	    .layout-math-canvas .style-page-support em,
	    .layout-dashboard-stage .style-page-support em,
	    .layout-orbit-stage .style-page-support em,
	    .layout-media-stage .style-page-support em,
	    .layout-editorial-poster .style-page-support em,
	    .layout-map-stage .style-page-support em { display: none; }
	    .layout-full-poster .style-quality-strip,
	    .layout-data-stage .style-quality-strip,
	    .layout-coordinate-stage .style-quality-strip,
	    .layout-math-canvas .style-quality-strip,
	    .layout-dashboard-stage .style-quality-strip,
	    .layout-orbit-stage .style-quality-strip,
	    .layout-media-stage .style-quality-strip,
	    .layout-editorial-poster .style-quality-strip,
	    .layout-map-stage .style-quality-strip { display: none; }
	    .style-flow-board { position: absolute; inset: 18px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; }
	    .flow-title { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding: 10px 12px; border-radius: 10px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.12); }
	    .flow-title b { font-size: 14px; line-height: 1.15; }.flow-title span { color: rgba(19,25,24,.62); font-size: 11px; font-weight: 850; }
	    .flow-lane { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; align-items: center; }
	    .flow-rail { position: absolute; left: 6%; right: 6%; top: calc(50% - 2px); height: 4px; border-radius: 6px; background: rgba(20,24,23,.18); overflow: hidden; z-index: 0; }
	    .flow-rail::after { content: ""; display: block; height: 100%; background: var(--style-accent); transform-origin: left; animation: railFill 4s infinite both; }
	    .flow-node { position: relative; z-index: 1; min-width: 0; display: grid; gap: 3px; padding: 10px 8px; border-radius: 10px; text-align: center; background: #fffdf7; border: 1px solid rgba(20,24,23,.12); box-shadow: 0 10px 24px rgba(20,24,23,.08); animation: styleCardFloat 4s infinite both; }
	    .flow-node b { font-size: 11px; line-height: 1.15; }.flow-node em { color: var(--style-accent); font-size: 10px; font-style: normal; font-weight: 950; }
	    .flow-node.f2 { animation-delay: .15s; }.flow-node.f3 { animation-delay: .3s; }.flow-node.f4 { animation-delay: .45s; }.flow-node.f5 { animation-delay: .6s; }
	    .flow-packets { display: grid; grid-template-columns: repeat(3, 34px); gap: 7px; justify-content: center; }
	    .flow-packets i { height: 9px; border-radius: 999px; background: var(--style-accent); animation: miniFill 2.4s infinite both; transform-origin: left; }
	    .flow-note { width: min(240px, 50%); }
	    .gdp-chart-board .gdp-chart { position: absolute; inset: 10px 10px 36px 10px; width: calc(100% - 20px); height: calc(100% - 46px); }
	    .layout-data-stage .gdp-chart-board .gdp-chart { inset: 0 10px 28px 38%; width: calc(62% - 20px); height: calc(100% - 28px); }
	    .gdp-chart-board .grid, .coordinate-board .coord-grid, .formula-canvas .coord-grid { fill: none; stroke: rgba(20,24,23,.08); stroke-width: 1; }
	    .gdp-chart-board .axis, .coordinate-board .coord-axis, .formula-canvas .coord-axis { fill: none; stroke: rgba(20,24,23,.34); stroke-width: 3; stroke-linecap: round; }
	    .gdp-chart-board .curve { fill: none; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 680; stroke-dashoffset: 680; animation: stylePathDraw 4s infinite both; }
	    .country-us { stroke: #315f7d; }.country-cn { stroke: #a84735; animation-delay: .12s; }.country-in { stroke: #4f735f; animation-delay: .24s; }.country-de { stroke: #9a673f; animation-delay: .36s; }
	    .gdp-chart-board .country-point { fill: #fffdf7; stroke: #a84735; stroke-width: 4; animation: styleDot 4s infinite both; }
	    .gdp-chart-board .country-point.second { stroke: #4f735f; animation-delay: .3s; }
	    .axis-label, .gdp-label, .coord-label, .coord-axis-label { font-family: Arial, "PingFang SC", sans-serif; letter-spacing: 0; font-size: 13px; font-weight: 900; fill: rgba(19,25,24,.66); }
	    .gdp-label { fill: #a84735; paint-order: stroke; stroke: rgba(255,253,247,.88); stroke-width: 4; stroke-linejoin: round; }
	    .gdp-label.us { fill: #315f7d; }.gdp-label.india { fill: #4f735f; }.gdp-label.de { fill: #9a673f; }
	    .gdp-legend { position: absolute; left: 14px; right: 14px; bottom: 10px; display: flex; gap: 6px; justify-content: center; z-index: 2; }
	    .gdp-legend span { padding: 5px 8px; border-radius: 999px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.1); font-size: 10px; font-weight: 950; }
	    .gdp-legend .us { color: #315f7d; }.gdp-legend .cn { color: #a84735; }.gdp-legend .in { color: #4f735f; }.gdp-legend .de { color: #9a673f; }
	    .gdp-chart-board .chart-note { right: 18px; bottom: 46px; width: min(240px, 38%); z-index: 3; }
	    .layout-data-stage .gdp-chart-board .chart-note { left: 18px; right: auto; bottom: 46px; width: min(250px, 34%); }
	    .coordinate-board svg, .formula-canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	    .layout-coordinate-stage .coordinate-board svg { left: 154px; width: calc(100% - 160px); }
	    .coordinate-board .coord-point { fill: rgba(20,24,23,.24); stroke: #fffdf7; stroke-width: 3; }
	    .coordinate-board .coord-point.selected { fill: var(--style-accent); filter: drop-shadow(0 0 12px color-mix(in srgb, var(--style-accent) 34%, transparent)); animation: styleDot 4s infinite both; }
	    .coordinate-board .coord-label { fill: rgba(19,25,24,.68); paint-order: stroke; stroke: rgba(255,253,247,.88); stroke-width: 4; stroke-linejoin: round; }
	    .coordinate-board .coord-label.selected { fill: var(--style-accent); }
	    .coordinate-board .coord-path { fill: none; stroke: var(--style-accent); stroke-width: 4; stroke-dasharray: 420; stroke-dashoffset: 420; animation: stylePathDraw 4s infinite both; }
	    .coordinate-board .matrix-note { right: 18px; bottom: 18px; width: min(250px, 42%); z-index: 3; }
	    .layout-coordinate-stage .coordinate-board .matrix-note { left: 18px; right: auto; bottom: 18px; width: min(250px, 34%); }
	    .formula-canvas { display: block; padding: 0; }
	    .formula-chain { position: absolute; left: 18px; right: 18px; top: 16px; z-index: 3; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
	    .layout-math-canvas .formula-chain { left: 42%; }
	    .layout-math-canvas .formula-canvas svg { left: 32%; width: 68%; }
	    .formula-chain span, .formula-chain b, .formula-chain i { padding: 8px 10px; border-radius: 9px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.12); font-size: 12px; line-height: 1.15; font-style: normal; font-weight: 950; }
	    .formula-chain b { color: #fffdf7; background: var(--style-accent); }
	    .formula-chain i { color: var(--style-accent); background: rgba(255,253,247,.72); }
	    .formula-canvas .parabola-line { fill: none; stroke: var(--style-accent); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 520; stroke-dashoffset: 520; animation: stylePathDraw 4s infinite both; }
	    .formula-canvas .vertex-dot { fill: #fffdf7; stroke: #a84735; stroke-width: 4; animation: styleDot 4s infinite both; }
	    .poster-type-board em, .editorial-quote-board em { color: var(--style-accent); font-style: normal; font-size: 12px; font-weight: 950; }
	    .media-flow-board { grid-template-rows: minmax(0, 1fr) auto; align-items: stretch; }
	    .media-flow-board .media-tile { align-content: center; min-height: 136px; padding: 10px; }
	    .media-flow-board .media-tile span { color: rgba(19,25,24,.62); font-size: 10px; line-height: 1.2; font-weight: 850; text-align: center; }
	    .media-flow-line { position: absolute; left: 20%; right: 20%; bottom: 74px; height: 4px; border-radius: 999px; background: rgba(20,24,23,.14); overflow: hidden; }
	    .media-flow-line i { display: block; height: 100%; width: 33%; float: left; background: var(--style-accent); transform-origin: left; animation: miniFill 2.4s infinite both; }
	    .media-flow-line i:nth-child(2) { background: #4f735f; animation-delay: .2s; }.media-flow-line i:nth-child(3) { background: #9a673f; animation-delay: .4s; }
	    .media-flow-board .material-note { left: 18%; right: 18%; bottom: 12px; z-index: 3; }
	    .editorial-quote-board { justify-items: start; }
	    .editorial-quote-board strong { font-size: 34px; max-width: 100%; }
	    .editorial-quote-board span { max-width: 76%; }
	    .layout-data-stage .kpi-card,
	    .layout-data-stage .gdp-chart-board .chart-note,
	    .layout-coordinate-stage .coordinate-board .matrix-note { left: auto; right: 18px; width: min(250px, 40%); }
	    .layout-data-stage .gdp-legend { left: 42%; right: 14px; }
	    .layout-full-poster .style-type-board,
	    .layout-editorial-poster .style-quote-board { left: 48%; right: 20px; }
	    .layout-dashboard-stage .style-dashboard-board,
	    .layout-orbit-stage .style-orbit-board,
	    .layout-media-stage .style-material-board,
	    .layout-map-stage .style-journey-board { left: 46%; right: 16px; }
	    .layout-map-stage .journey-note { left: 8%; width: 70%; }
	    .layout-ranking-stage .style-page-main,
	    .layout-geo-stage .style-page-main,
	    .layout-tree-stage .style-page-main,
	    .layout-network-stage .style-page-main,
	    .layout-funnel-stage .style-page-main,
	    .layout-agent-lane-stage .style-page-main,
	    .layout-screenflow-stage .style-page-main,
	    .layout-alert-stage .style-page-main,
	    .layout-citation-stage .style-page-main,
	    .layout-audio-stage .style-page-main,
	    .layout-gallery-stage .style-page-main,
	    .layout-calendar-stage .style-page-main { display: block; min-height: 0; }
	    .layout-ranking-stage .style-frame-board,
	    .layout-geo-stage .style-frame-board,
	    .layout-tree-stage .style-frame-board,
	    .layout-network-stage .style-frame-board,
	    .layout-funnel-stage .style-frame-board,
	    .layout-agent-lane-stage .style-frame-board,
	    .layout-screenflow-stage .style-frame-board,
	    .layout-alert-stage .style-frame-board,
	    .layout-citation-stage .style-frame-board,
	    .layout-audio-stage .style-frame-board,
	    .layout-gallery-stage .style-frame-board,
	    .layout-calendar-stage .style-frame-board { position: absolute; inset: 0; }
	    .layout-ranking-stage .style-frame-copy,
	    .layout-geo-stage .style-frame-copy,
	    .layout-tree-stage .style-frame-copy,
	    .layout-network-stage .style-frame-copy,
	    .layout-funnel-stage .style-frame-copy,
	    .layout-agent-lane-stage .style-frame-copy,
	    .layout-screenflow-stage .style-frame-copy,
	    .layout-alert-stage .style-frame-copy,
	    .layout-citation-stage .style-frame-copy,
	    .layout-audio-stage .style-frame-copy,
	    .layout-gallery-stage .style-frame-copy,
	    .layout-calendar-stage .style-frame-copy { position: absolute; left: 16px; top: 16px; width: min(286px, 36%); max-height: calc(100% - 34px); align-content: start; padding: 12px; border-radius: 11px; background: rgba(255,253,247,.76); border: 1px solid rgba(20,24,23,.12); box-shadow: 0 18px 38px rgba(20,24,23,.12); backdrop-filter: blur(12px); overflow: hidden; }
	    .layout-ranking-stage .style-frame-copy p,
	    .layout-geo-stage .style-frame-copy p,
	    .layout-tree-stage .style-frame-copy p,
	    .layout-network-stage .style-frame-copy p,
	    .layout-funnel-stage .style-frame-copy p,
	    .layout-agent-lane-stage .style-frame-copy p,
	    .layout-screenflow-stage .style-frame-copy p,
	    .layout-alert-stage .style-frame-copy p,
	    .layout-citation-stage .style-frame-copy p,
	    .layout-audio-stage .style-frame-copy p,
	    .layout-gallery-stage .style-frame-copy p,
	    .layout-calendar-stage .style-frame-copy p { font-size: 12px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	    .layout-ranking-stage .style-proof-strip,
	    .layout-geo-stage .style-proof-strip,
	    .layout-tree-stage .style-proof-strip,
	    .layout-network-stage .style-proof-strip,
	    .layout-funnel-stage .style-proof-strip,
	    .layout-agent-lane-stage .style-proof-strip,
	    .layout-screenflow-stage .style-proof-strip,
	    .layout-alert-stage .style-proof-strip,
	    .layout-citation-stage .style-proof-strip,
	    .layout-audio-stage .style-proof-strip,
	    .layout-gallery-stage .style-proof-strip,
	    .layout-calendar-stage .style-proof-strip { display: none; }
	    .layout-ranking-stage .style-page-support span,
	    .layout-geo-stage .style-page-support span,
	    .layout-tree-stage .style-page-support span,
	    .layout-network-stage .style-page-support span,
	    .layout-funnel-stage .style-page-support span,
	    .layout-agent-lane-stage .style-page-support span,
	    .layout-screenflow-stage .style-page-support span,
	    .layout-alert-stage .style-page-support span,
	    .layout-citation-stage .style-page-support span,
	    .layout-audio-stage .style-page-support span,
	    .layout-gallery-stage .style-page-support span,
	    .layout-calendar-stage .style-page-support span { padding: 6px 8px; }
	    .layout-ranking-stage .style-page-support em,
	    .layout-geo-stage .style-page-support em,
	    .layout-tree-stage .style-page-support em,
	    .layout-network-stage .style-page-support em,
	    .layout-funnel-stage .style-page-support em,
	    .layout-agent-lane-stage .style-page-support em,
	    .layout-screenflow-stage .style-page-support em,
	    .layout-alert-stage .style-page-support em,
	    .layout-citation-stage .style-page-support em,
	    .layout-audio-stage .style-page-support em,
	    .layout-gallery-stage .style-page-support em,
	    .layout-calendar-stage .style-page-support em,
	    .layout-ranking-stage .style-quality-strip,
	    .layout-geo-stage .style-quality-strip,
	    .layout-tree-stage .style-quality-strip,
	    .layout-network-stage .style-quality-strip,
	    .layout-funnel-stage .style-quality-strip,
	    .layout-agent-lane-stage .style-quality-strip,
	    .layout-screenflow-stage .style-quality-strip,
	    .layout-alert-stage .style-quality-strip,
	    .layout-citation-stage .style-quality-strip,
	    .layout-audio-stage .style-quality-strip,
	    .layout-gallery-stage .style-quality-strip,
	    .layout-calendar-stage .style-quality-strip { display: none; }
	    .style-ranking-board, .style-geo-board, .style-tree-board, .style-network-board, .style-funnel-board, .style-agent-board, .style-screenflow-board, .style-risk-board, .style-citation-board, .style-voice-board, .style-gallery-board, .style-calendar-board { position: absolute; inset: 16px; overflow: hidden; }
	    .rank-head { position: absolute; left: 40%; right: 18px; top: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding: 11px 13px; border-radius: 10px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.12); }
	    .rank-head b { font-size: 14px; }.rank-head span { color: rgba(19,25,24,.62); font-size: 10px; font-weight: 850; }
	    .rank-row { position: absolute; left: 40%; right: 18px; display: grid; grid-template-columns: 32px minmax(92px, 1.05fr) minmax(56px, .64fr) 38px minmax(76px, .78fr); gap: 7px; align-items: center; padding: 10px; border-radius: 10px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.11); box-shadow: 0 12px 24px rgba(20,24,23,.08); }
	    .rank-row.r1 { top: 62px; border-color: color-mix(in srgb, var(--style-accent) 34%, rgba(20,24,23,.12)); }.rank-row.r2 { top: 108px; }.rank-row.r3 { top: 154px; }.rank-row.r4 { top: 200px; }.rank-row.r5 { top: 246px; }
	    .rank-row b { color: var(--style-accent); font-size: 13px; }.rank-row span { min-width: 0; font-size: 11px; line-height: 1.12; font-weight: 950; overflow-wrap: anywhere; }.rank-row i { height: 8px; border-radius: 999px; background: linear-gradient(90deg, var(--style-accent) var(--score), rgba(20,24,23,.12) 0); }.rank-row em { color: #141918; font-style: normal; font-weight: 950; font-size: 11px; }.rank-row small { min-width: 0; color: rgba(19,25,24,.58); font-size: 9px; line-height: 1.15; font-weight: 850; overflow-wrap: anywhere; }
	    .ranking-note, .geo-note, .tree-note, .network-note, .funnel-note, .agent-note, .screen-note, .risk-note, .citation-note, .voice-note, .gallery-note, .calendar-note { position: absolute; right: 18px; bottom: 16px; width: min(250px, 38%); z-index: 4; }
	    .style-geo-board svg, .style-tree-board svg, .style-network-board svg, .style-agent-board svg, .style-voice-board svg { position: absolute; left: 34%; right: 0; top: 4px; width: 66%; height: calc(100% - 10px); }
	    .geo-land { fill: rgba(255,253,247,.64); stroke: rgba(20,24,23,.18); stroke-width: 3; }.geo-region { fill: color-mix(in srgb, var(--style-accent) 14%, #fffdf7); stroke: rgba(20,24,23,.12); stroke-width: 2; }.geo-region.active { fill: color-mix(in srgb, var(--style-accent) 44%, #fffdf7); animation: examplePulse 4s infinite both; }.geo-dot { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 5; animation: styleDot 4s infinite both; }.geo-dot.second { stroke: #4f735f; animation-delay: .35s; }.geo-dot.third { stroke: #315f7d; animation-delay: .5s; }.geo-callout-line { fill: none; stroke: var(--style-accent); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 260; stroke-dashoffset: 260; animation: stylePathDraw 4s infinite both; }.geo-label, .geo-source { fill: rgba(19,25,24,.76); font-size: 15px; font-weight: 950; paint-order: stroke; stroke: rgba(255,253,247,.86); stroke-width: 4; }.geo-source { font-size: 11px; fill: rgba(19,25,24,.5); }
	    .tree-node, .tree-row span { position: absolute; display: grid; place-items: center; border-radius: 10px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.12); color: #141918; font-weight: 950; box-shadow: 0 10px 20px rgba(20,24,23,.08); }
	    .tree-node.root { left: 54%; top: 22px; width: 120px; height: 44px; background: var(--style-accent); color: #fffdf7; }
	    .tree-row span { width: 96px; height: 38px; font-size: 11px; }.tree-row.level1 span:nth-child(1) { left: 38%; top: 104px; }.tree-row.level1 span:nth-child(2) { left: 55%; top: 104px; }.tree-row.level1 span:nth-child(3) { right: 6%; top: 104px; }.tree-row.level2 span:nth-child(1) { left: 42%; top: 182px; }.tree-row.level2 span:nth-child(2) { left: 59%; top: 182px; }.tree-row.level2 span:nth-child(3) { right: 2%; top: 182px; }.tree-row span.active { border-color: var(--style-accent); color: var(--style-accent); }
	    .tree-line { fill: none; stroke: rgba(20,24,23,.22); stroke-width: 4; stroke-linecap: round; }.tree-line.active { stroke: var(--style-accent); stroke-dasharray: 220; stroke-dashoffset: 220; animation: stylePathDraw 4s infinite both; }
	    .net-edge { fill: none; stroke: rgba(20,24,23,.18); stroke-width: 3; stroke-linecap: round; }.net-edge.active { stroke: var(--style-accent); stroke-width: 6; stroke-dasharray: 420; stroke-dashoffset: 420; animation: stylePathDraw 4s infinite both; }.net-node circle { fill: #fffdf7; stroke: rgba(20,24,23,.18); stroke-width: 2; }.net-node.n3 circle { fill: var(--style-accent); stroke: color-mix(in srgb, var(--style-accent) 70%, #111716); }.net-node text { fill: #141918; font-size: 12px; font-weight: 950; paint-order: stroke; stroke: rgba(255,253,247,.86); stroke-width: 4; }
	    .style-funnel-board { display: grid; align-content: center; justify-items: end; gap: 8px; padding-right: 20px; }
	    .funnel-stage { width: var(--w, 50%); min-height: 38px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 9px 12px; border-radius: 10px; color: #fffdf7; background: color-mix(in srgb, var(--style-accent) 84%, #141918); box-shadow: 0 12px 22px rgba(20,24,23,.1); clip-path: polygon(5% 0, 95% 0, 88% 100%, 12% 100%); animation: styleCardFloat 4s infinite both; }
	    .funnel-stage.f1 { --w: 54%; }.funnel-stage.f2 { --w: 46%; animation-delay: .12s; }.funnel-stage.f3 { --w: 38%; animation-delay: .24s; }.funnel-stage.f4 { --w: 31%; animation-delay: .36s; }
	    .funnel-stage b { font-size: 12px; }.funnel-stage span, .funnel-stage em { font-style: normal; font-size: 11px; font-weight: 950; }.funnel-drop { position: absolute; right: 26px; top: 74px; padding: 8px 11px; border-radius: 999px; background: #fffdf7; color: #a84735; border: 1px solid rgba(168,71,53,.28); font-size: 11px; font-weight: 950; }
	    .agent-lane { position: absolute; left: 38%; right: 28px; height: 44px; display: grid; grid-template-columns: 104px minmax(0, 1fr) 70px; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 10px; background: rgba(255,253,247,.78); border: 1px solid rgba(20,24,23,.1); }.agent-lane.l1 { top: 38px; }.agent-lane.l2 { top: 94px; }.agent-lane.l3 { top: 150px; }.agent-lane.l4 { top: 206px; }.agent-lane b { font-size: 12px; }.agent-lane span { color: rgba(19,25,24,.62); font-size: 11px; font-weight: 850; }.agent-lane i { height: 10px; border-radius: 99px; background: var(--style-accent); animation: miniFill 2.4s infinite both; transform-origin: left; }.agent-flow { fill: none; stroke: var(--style-accent); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 520; stroke-dashoffset: 520; animation: stylePathDraw 4s infinite both; }.agent-flow.second { stroke: #4f735f; animation-delay: .3s; }
	    .style-screenflow-board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); gap: 12px; padding: 68px 20px 54px 38%; }
	    .screen-card { position: relative; min-width: 0; display: grid; align-content: start; gap: 8px; padding: 13px; border-radius: 14px; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.12); box-shadow: 0 14px 24px rgba(20,24,23,.08); }.screen-card b { font-size: 12px; }.screen-card i { height: 70px; border-radius: 10px; background: linear-gradient(145deg, rgba(20,24,23,.16), rgba(255,253,247,.56)); }.screen-card span { height: 8px; width: 70%; border-radius: 99px; background: var(--style-accent); }.screen-card em { color: rgba(19,25,24,.58); font-style: normal; font-size: 10px; font-weight: 900; }.tap-cursor { position: absolute; left: 66%; top: 112px; width: 28px; height: 28px; border-radius: 50%; border: 8px solid color-mix(in srgb, var(--style-accent) 36%, transparent); background: var(--style-accent); animation: nodePulse 4s infinite both; }
	    .risk-level { position: absolute; left: 40%; top: 26px; right: 30px; padding: 14px; border-radius: 12px; background: color-mix(in srgb, #a84735 16%, #fffdf7); border: 1px solid rgba(168,71,53,.26); }.risk-level b { color: #a84735; font-size: 20px; }.risk-level span { display: block; margin-top: 4px; color: rgba(19,25,24,.68); font-size: 12px; font-weight: 850; }.risk-impact { position: absolute; left: 42%; top: 104px; width: 220px; display: grid; gap: 6px; padding: 12px; border-radius: 12px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.12); }.risk-impact i { height: 42px; border-radius: 10px; border: 2px dashed #a84735; background: rgba(168,71,53,.08); }.risk-impact b { font-size: 12px; }.risk-impact span { color: rgba(19,25,24,.62); font-size: 11px; line-height: 1.35; font-weight: 850; }.risk-thread { position: absolute; right: 34px; top: 112px; display: grid; gap: 8px; }.risk-thread span { padding: 9px 14px; border-radius: 999px; background: var(--style-accent); color: #fffdf7; font-size: 11px; font-weight: 950; }
	    .source-card { position: absolute; width: 170px; min-height: 70px; display: grid; gap: 5px; align-content: center; padding: 12px; border-radius: 12px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.12); box-shadow: 0 16px 28px rgba(20,24,23,.1); }.source-card b { font-size: 13px; }.source-card span { color: rgba(19,25,24,.6); font-size: 11px; font-weight: 850; }.source-card.c1 { left: 40%; top: 34px; transform: rotate(-2deg); }.source-card.c2 { left: 52%; top: 74px; }.source-card.c3 { left: 64%; top: 114px; transform: rotate(2deg); }.quote-fragment { position: absolute; left: 44%; right: 40px; bottom: 104px; padding: 11px 14px; border-left: 5px solid var(--style-accent); background: rgba(255,253,247,.88); color: #141918; font-size: 14px; line-height: 1.3; font-weight: 950; }
	    .wave-baseline { fill: none; stroke: rgba(20,24,23,.18); stroke-width: 3; }.wave-bar { fill: color-mix(in srgb, var(--style-accent) 72%, #141918); animation: examplePulse 4s infinite both; }.wave-bar.b1 { animation-delay: .08s; }.wave-bar.b2 { animation-delay: .16s; }.wave-bar.b3 { animation-delay: .24s; }.wave-bar.b4 { animation-delay: .32s; }.playhead { fill: none; stroke: #a84735; stroke-width: 4; stroke-linecap: round; animation: styleDot 4s infinite both; }.cue-row { position: absolute; left: 40%; right: 26px; bottom: 68px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.cue-row span { min-width: 0; border-radius: 10px; padding: 9px 10px; text-align: center; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.12); font-size: 11px; font-weight: 950; }.cue-row .active { background: var(--style-accent); color: #fffdf7; }
	    .style-gallery-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 66px 24px 62px 39%; }.gallery-tile { display: grid; gap: 5px; min-width: 0; padding: 8px; border-radius: 10px; background: rgba(255,253,247,.76); border: 1px solid rgba(20,24,23,.1); }.gallery-tile i { border-radius: 8px; min-height: 44px; background: linear-gradient(135deg, color-mix(in srgb, var(--style-accent) 28%, #fffdf7), rgba(20,24,23,.08)); }.gallery-tile b { font-size: 10px; }.gallery-tile.g3 { outline: 3px solid var(--style-accent); box-shadow: 0 18px 30px color-mix(in srgb, var(--style-accent) 22%, transparent); }.selected-frame { position: absolute; right: 30px; top: 34px; width: 148px; height: 92px; display: grid; place-items: center; border-radius: 12px; color: #fffdf7; background: var(--style-accent); font-size: 18px; font-weight: 950; box-shadow: 0 18px 34px rgba(20,24,23,.16); }
	    .calendar-grid { position: absolute; left: 40%; top: 28px; right: 32px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }.calendar-grid span { min-height: 28px; display: grid; place-items: center; border-radius: 8px; background: rgba(255,253,247,.8); border: 1px solid rgba(20,24,23,.1); font-size: 10px; font-weight: 950; }.calendar-grid .today { color: #fffdf7; background: var(--style-accent); }.calendar-grid .deadline { color: #fffdf7; background: #a84735; }.event-rail { position: absolute; left: 40%; right: 32px; bottom: 76px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }.event-rail i { grid-column: 1 / -1; height: 5px; border-radius: 99px; background: linear-gradient(90deg, var(--style-accent), #a84735); animation: railFill 4s infinite both; transform-origin: left; }.event-rail span, .event-rail em { padding: 9px 10px; border-radius: 10px; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.1); color: #141918; font-size: 11px; font-style: normal; font-weight: 900; }
	    .style-variant-editorial-contrast .designed-title,
	    .style-base-dark-saas-magic-ui .designed-title,
	    .style-base-typed-black-white-opener .designed-title { color: #fffdf7; }
	    .style-variant-editorial-contrast .designed-title .title-large,
	    .style-base-dark-saas-magic-ui .designed-title .title-large,
	    .style-base-typed-black-white-opener .designed-title .title-large { color: #fffdf7; }
	    .style-variant-editorial-contrast .layout-full-poster .style-frame-copy,
	    .style-variant-editorial-contrast .layout-data-stage .style-frame-copy,
	    .style-variant-editorial-contrast .layout-coordinate-stage .style-frame-copy,
	    .style-variant-editorial-contrast .layout-math-canvas .style-frame-copy,
	    .style-variant-editorial-contrast .layout-dashboard-stage .style-frame-copy,
	    .style-variant-editorial-contrast .layout-orbit-stage .style-frame-copy,
	    .style-variant-editorial-contrast .layout-media-stage .style-frame-copy,
	    .style-variant-editorial-contrast .layout-editorial-poster .style-frame-copy,
	    .style-base-dark-saas-magic-ui .style-frame-copy,
	    .style-base-typed-black-white-opener .style-frame-copy { background: rgba(16,20,20,.64); border-color: rgba(255,253,247,.18); }
	    .style-path { fill: none; stroke: var(--style-accent); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 420; stroke-dashoffset: 420; opacity: .9; animation: stylePathDraw 4s infinite both; }
	    .style-path.two { stroke: #2a302d; stroke-width: 4; opacity: .34; animation-delay: .24s; }
	    .style-dot { fill: var(--style-accent); opacity: 0; animation: styleDot 4s infinite both; }
	    .style-dot.d2 { animation-delay: .28s; }
	    .style-dot.d3 { animation-delay: .56s; }
	    .style-caption-safe { display: none; }
	    .style-base-semantic-timeline-reveal .style-card.main { left: 24px; right: 24px; top: 74px; height: 10px; background: rgba(20,24,23,.18); }
	    .style-base-semantic-timeline-reveal .style-card.side { width: 48px; height: 48px; right: 28px; bottom: 38px; border-radius: 50%; }
	    .style-base-interactive-proof-board .style-card.main { left: 28px; width: 86px; right: auto; top: 62px; height: 58px; }
	    .style-base-interactive-proof-board .style-card.side { right: 28px; top: 50px; bottom: auto; width: 92px; height: 64px; }
	    .style-base-data-curve-trace .style-card.main { left: 30px; right: 30px; top: auto; bottom: 32px; height: 5px; }
	    .style-base-typed-black-white-opener .style-canvas, .style-variant-editorial-contrast .style-canvas { background: #181b1a; color: #fffdf7; }
	    .style-base-typed-black-white-opener .style-title, .style-variant-editorial-contrast .style-title { color: #fffdf7; }
	    .style-base-dark-saas-magic-ui .style-canvas { background: linear-gradient(145deg, #17201f, #26342f); }
	    .style-base-dark-saas-magic-ui .style-title { color: #f7f3ea; }
	    .style-variant-bright-clean .style-canvas { background: linear-gradient(145deg, #fcfff6, color-mix(in srgb, var(--style-accent) 20%, #eef7f4)); }
	    .style-density-high .style-card.side { width: 88px; }
	    .style-density-low .style-card.main { right: 130px; }
	    .style-review-dialog { width: min(1380px, calc(100vw - 40px)); border: 1px solid rgba(20,24,23,.18); border-radius: 8px; padding: 0; background: var(--surface-strong); box-shadow: 0 26px 90px rgba(20,24,23,.28); }
	    .style-review-dialog::backdrop { background: rgba(20,24,23,.48); backdrop-filter: blur(4px); }
	    .style-review-dialog form { position: absolute; right: 12px; top: 12px; z-index: 4; margin: 0; }
	    .style-review-dialog form button { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--line); background: rgba(255,255,255,.88); color: var(--ink); font-size: 22px; line-height: 1; cursor: pointer; }
	    .style-review-dialog-body { display: grid; grid-template-columns: minmax(760px, 1.32fr) minmax(300px, .54fr); gap: 18px; padding: 22px; }
	    .style-review-zoom { min-height: 560px; border-radius: 8px; border: 1px solid var(--line); overflow: hidden; background: #f6f1e7; }
	    .style-review-detail { display: grid; align-content: center; gap: 9px; padding: 18px; border-radius: 8px; background: rgba(237,242,239,.68); border: 1px solid var(--line); }
	    .style-review-detail small { color: var(--accent); font-weight: 900; overflow-wrap: anywhere; }
	    .style-review-detail h3 { margin: 0; font-size: 26px; line-height: 1.15; }
	    .style-review-detail p, .style-review-detail span { margin: 0 0 8px; color: var(--muted); line-height: 1.55; overflow-wrap: anywhere; }
	    .style-review-detail b { font-size: 13px; }
	    .vertical-review-shell { max-width: 1540px; }
	    .vertical-review-grid { grid-template-columns: repeat(auto-fit, minmax(266px, 1fr)); align-items: start; }
	    .vertical-review-card { min-width: 0; background: linear-gradient(180deg, #fffdf8, #f3efe5); }
	    .vertical-review-preview-button { display: grid; place-items: center; min-height: 0; padding: 14px; background: linear-gradient(145deg, #eee8dc, #faf8ef); overflow: visible; }
	    .vertical-style-variant-panel { width: 100%; min-width: 0; display: grid; place-items: center; }
	    .vertical-style-variant-panel[hidden] { display: none; }
	    .vertical-template-preview.style-template-preview { width: min(100%, 310px); aspect-ratio: 9 / 16; min-height: 0; max-height: none; margin: 0 auto; border: 0; border-radius: 12px; background: #101513; box-shadow: 0 18px 46px rgba(20,24,23,.14); }
	    .vertical-template-preview.large { width: min(420px, 44vw); aspect-ratio: 9 / 16; min-height: 0; max-height: none; border-radius: 14px; }
	    .vertical-style-canvas { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--style-accent) 22%, transparent), transparent 26%), linear-gradient(180deg, #111715, #26322d 42%, #f3efe4 42%, #f8f4eb 100%); color: #141918; }
	    .vertical-template-preview.vertical-layout-data .vertical-style-canvas { background: radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--style-accent) 18%, transparent), transparent 24%), linear-gradient(180deg, #17231f 0 28%, #edf3ed 28% 100%); }
	    .vertical-template-preview.vertical-layout-structure .vertical-style-canvas { background: linear-gradient(160deg, #151a1b 0 32%, #f5f0e6 32% 100%); }
	    .vertical-template-preview.vertical-layout-ip .vertical-style-canvas { background: linear-gradient(180deg, #2a302d 0 19%, #e9e0d2 19% 100%); }
	    .vertical-template-preview.vertical-layout-sketch .vertical-style-canvas { background: linear-gradient(180deg, #fbf7ed 0 70%, #e8ded1 70% 100%); }
	    .vertical-template-preview.vertical-layout-product .vertical-style-canvas { background: linear-gradient(180deg, #111715 0 36%, #dfe7e3 36% 100%); }
	    .vertical-template-preview.vertical-layout-media .vertical-style-canvas { background: radial-gradient(circle at 40% 30%, color-mix(in srgb, var(--style-accent) 26%, transparent), transparent 30%), linear-gradient(180deg, #222927 0 40%, #f6f1e7 40% 100%); }
	    .vertical-template-preview.vertical-layout-proof .vertical-style-canvas { background: linear-gradient(180deg, #252c2a 0 26%, #f4efe5 26% 100%); }
	    .vertical-template-preview.vertical-layout-sketch .vertical-hook-zone { color: #141918; }
	    .vertical-template-preview.vertical-layout-sketch .vertical-hook-zone h4 { text-shadow: none; }
	    .vertical-template-preview.vertical-layout-sketch .vertical-hook-zone p { color: rgba(19,25,24,.72); text-shadow: none; }
	    .vertical-template-preview.vertical-layout-sketch .vertical-hook-zone span { background: color-mix(in srgb, var(--style-accent) 18%, #fffdf7); color: color-mix(in srgb, var(--style-accent) 54%, #141918); border: 1px solid color-mix(in srgb, var(--style-accent) 24%, rgba(20,24,23,.12)); }
	    .vertical-style-canvas .style-chip { display: none; }
	    .vertical-video-frame { position: absolute; inset: 0; overflow: hidden; }
	    .vertical-phone-shell { position: absolute; inset: 0; display: grid; grid-template-rows: 21% minmax(0, 49%) 9% 6% 15%; gap: 8px; padding: 6.4% 14.2% 17.8% 7.2%; overflow: hidden; }
	    .vertical-phone-shell.vertical-layout-poster { grid-template-rows: 16% minmax(0, 56%) 8% 5% 15%; padding-top: 5.6%; }
	    .vertical-phone-shell.vertical-layout-data { grid-template-rows: 18% minmax(0, 54%) 8% 5% 15%; padding-top: 5.8%; }
	    .vertical-phone-shell.vertical-layout-structure { grid-template-rows: 17% minmax(0, 55%) 8% 5% 15%; padding-top: 5.8%; }
	    .vertical-phone-shell.vertical-layout-ip { grid-template-rows: 14% minmax(0, 60%) 8% 5% 13%; padding: 5.8% 13.8% 16.4% 6.8%; }
	    .vertical-phone-shell.vertical-layout-sketch { grid-template-rows: 15% minmax(0, 57%) 8% 5% 15%; padding-top: 5.6%; }
	    .vertical-phone-shell.vertical-layout-product { grid-template-rows: 18% minmax(0, 53%) 8% 6% 15%; }
	    .vertical-phone-shell.vertical-layout-media { grid-template-rows: 15% minmax(0, 57%) 8% 5% 15%; }
	    .vertical-phone-shell.vertical-layout-proof { grid-template-rows: 18% minmax(0, 52%) 9% 6% 15%; }
	    .vertical-platform-safe { display: none; position: absolute; z-index: 2; pointer-events: none; border: 1px dashed rgba(255,253,247,.12); background: rgba(255,253,247,.04); }
	    .vertical-platform-safe.top { left: 0; right: 0; top: 0; height: 7%; }
	    .vertical-platform-safe.right { top: 8%; right: 0; bottom: 16%; width: 12%; }
	    .vertical-platform-safe.bottom { left: 0; right: 0; bottom: 0; height: 16%; }
	    .vertical-hook-zone { position: relative; z-index: 5; display: grid; align-content: end; gap: 5px; color: #fffdf7; min-width: 0; overflow: hidden; }
	    .vertical-hook-zone span { width: max-content; max-width: 100%; padding: 5px 8px; border-radius: 999px; background: color-mix(in srgb, var(--style-accent) 78%, #111715); color: #fffdf7; font-size: 10px; line-height: 1; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-hook-zone h4 { margin: 0; max-width: 100%; font-size: 26px; line-height: 1.04; letter-spacing: 0; overflow-wrap: anywhere; text-wrap: balance; text-shadow: 0 12px 28px rgba(0,0,0,.28); }
	    .vertical-hook-zone p { margin: 0; max-width: 96%; color: rgba(255,253,247,.78); font-size: 12px; line-height: 1.32; font-weight: 850; overflow-wrap: anywhere; }
	    .vertical-template-preview:not(.large) .vertical-hook-zone { align-content: end; gap: 3px; }
	    .vertical-template-preview:not(.large) .vertical-hook-zone h4 { font-size: 20px; line-height: 1.06; }
	    .vertical-template-preview:not(.large) .vertical-hook-zone p { display: none; }
	    .vertical-proof-stage { position: relative; z-index: 4; min-width: 0; min-height: 0; border-radius: 16px; background: rgba(255,253,247,.88); border: 1px solid rgba(255,255,255,.58); box-shadow: 0 20px 52px rgba(20,24,23,.22), inset 0 0 0 1px rgba(255,255,255,.5); overflow: hidden; }
	    .vertical-layout-poster .vertical-proof-stage { border-radius: 24px; background: rgba(255,253,247,.72); }
	    .vertical-layout-data .vertical-proof-stage { border-radius: 10px; background: rgba(247,250,246,.94); box-shadow: 0 16px 36px rgba(20,24,23,.16); }
	    .vertical-layout-structure .vertical-proof-stage { border-radius: 18px 18px 8px 18px; background: #fbf7ee; }
	    .vertical-layout-ip .vertical-proof-stage { border-radius: 8px; background: #e8dfd2; border-color: rgba(20,24,23,.12); box-shadow: 0 16px 34px rgba(20,24,23,.16); }
	    .vertical-layout-sketch .vertical-proof-stage { border-radius: 4px; background: #fffdf7; border-color: rgba(20,24,23,.16); box-shadow: inset 0 0 0 1px rgba(20,24,23,.06), 0 12px 28px rgba(20,24,23,.1); }
	    .vertical-layout-product .vertical-proof-stage { border-radius: 20px; background: #15201d; color: #fffdf7; }
	    .vertical-layout-media .vertical-proof-stage { border-radius: 22px 6px 22px 6px; background: #f6f1e7; }
	    .vertical-layout-proof .vertical-proof-stage { border-radius: 12px; background: rgba(255,253,247,.92); }
	    .vertical-beat-rail { position: relative; z-index: 5; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; min-width: 0; }
	    .vertical-beat-rail span { min-width: 0; display: grid; gap: 2px; align-content: center; padding: 7px 6px; border-radius: 10px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.1); box-shadow: 0 10px 24px rgba(20,24,23,.08); animation: styleStepBlink 4s infinite both; }
	    .vertical-beat-rail .b2 { animation-delay: .3s; }
	    .vertical-beat-rail .b3 { animation-delay: .6s; }
	    .vertical-beat-rail b { color: color-mix(in srgb, var(--style-accent) 82%, #141918); font-size: 10px; line-height: 1; }
	    .vertical-beat-rail em { color: rgba(19,25,24,.7); font-style: normal; font-size: 9px; line-height: 1.12; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-payoff-loop { position: relative; z-index: 5; display: grid; align-items: center; min-width: 0; padding: 7px 10px; border-radius: 11px; background: color-mix(in srgb, var(--style-accent) 12%, rgba(255,253,247,.84)); border: 1px solid color-mix(in srgb, var(--style-accent) 24%, rgba(20,24,23,.08)); color: rgba(19,25,24,.72); font-size: 10px; line-height: 1.25; font-weight: 850; }
	    .vertical-payoff-loop span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-caption-band { position: absolute; left: 7.5%; right: 14.5%; bottom: 6.2%; z-index: 9; min-height: 42px; display: grid; place-items: center; border-radius: 999px; background: rgba(16,22,20,.88); color: #fffdf7; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 16px 36px rgba(0,0,0,.24); }
	    .vertical-caption-band span { max-width: 98%; font-size: 11px; line-height: 1.16; font-weight: 950; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-galacean-effect { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: .44; }
	    .vertical-galacean-effect.layer-foreground { z-index: 3; opacity: .14; mix-blend-mode: normal; }
	    .vertical-proof-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	    .vertical-card { position: relative; display: grid; align-content: center; gap: 5px; min-width: 0; padding: 12px; border-radius: 12px; background: rgba(255,253,247,.92); border: 1px solid rgba(20,24,23,.12); box-shadow: 0 12px 28px rgba(20,24,23,.1); }
	    .vertical-card b { color: #141918; font-size: 13px; line-height: 1.12; overflow-wrap: anywhere; }
	    .vertical-card span { color: rgba(19,25,24,.68); font-size: 11px; line-height: 1.32; font-weight: 800; overflow-wrap: anywhere; }
	    .vertical-card.strong { border-color: color-mix(in srgb, var(--style-accent) 42%, rgba(20,24,23,.12)); box-shadow: 0 16px 34px color-mix(in srgb, var(--style-accent) 16%, rgba(20,24,23,.08)); }
	    .vertical-card.muted { opacity: .7; filter: saturate(.76); }
	    .vertical-split-board, .vertical-before-after-board, .vertical-cover-board { position: absolute; inset: 16px; display: grid; grid-template-rows: 1fr auto 1fr; gap: 10px; align-items: center; }
	    .vertical-impact-badge, .vertical-bridge-arrow { width: 58px; height: 38px; justify-self: center; display: grid; place-items: center; border-radius: 999px; background: var(--style-accent); color: #fffdf7; font-size: 12px; font-weight: 950; box-shadow: 0 10px 24px color-mix(in srgb, var(--style-accent) 30%, transparent); animation: styleChip 4s infinite both; }
	    .vertical-bridge-arrow::after { content: "↓"; font-size: 25px; line-height: 1; }
	    .vertical-timeline-board { position: absolute; inset: 16px; display: grid; grid-template-rows: repeat(5, minmax(24px, 1fr)) auto; gap: 5px; }
	    .vertical-mini-step { position: relative; z-index: 2; display: grid; place-items: center; border-radius: 10px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.1); color: #25302d; font-size: 12px; font-weight: 950; }
	    .vertical-progress-line { position: absolute; z-index: 0; left: 28px; top: 12px; bottom: 54px; width: 5px; border-radius: 8px; background: rgba(20,24,23,.12); overflow: hidden; }
	    .vertical-progress-line::after { content: ""; display: block; width: 100%; height: 100%; background: var(--style-accent); transform-origin: top; animation: verticalFill 4s infinite both; }
	    .vertical-card.floating { position: relative; left: auto; right: auto; bottom: auto; z-index: 3; min-height: 44px; padding: 8px 10px; }
	    .vertical-evidence-board, .vertical-whiteboard-board, .vertical-story-board, .vertical-journey-board { position: absolute; inset: 0; }
	    .vertical-evidence-board { display: grid; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 16px; }
	    .vertical-evidence-board svg, .vertical-story-board svg, .vertical-journey-board svg { z-index: 0; }
	    .vertical-evidence-board .vertical-card, .vertical-story-board .vertical-card, .vertical-journey-board .vertical-card { z-index: 2; }
	    .vertical-evidence-board svg path, .vertical-story-board svg path, .vertical-journey-board svg path { fill: none; stroke: var(--style-accent); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 620; stroke-dashoffset: 620; animation: stylePathDraw 4s infinite both; }
	    .vertical-card.pin { position: absolute; width: 46%; }
	    .vertical-card.pin.a { left: 16px; top: 18px; }.vertical-card.pin.b { right: 16px; top: 132px; }.vertical-card.pin.c { left: 24%; bottom: 18px; }
	    .vertical-evidence-board .vertical-card.pin { position: relative; left: auto; right: auto; top: auto; bottom: auto; width: auto; min-height: 0; padding: 9px 11px; }
	    .vertical-code-board { position: absolute; inset: 16px; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 10px; }
	    .vertical-terminal { display: grid; align-content: center; gap: 9px; min-width: 0; overflow: hidden; padding: 14px; border-radius: 13px; background: #151a1b; color: #eaf0ec; }
	    .vertical-terminal span { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 7px; align-items: center; min-width: 0; color: rgba(234,240,236,.76); font-size: 11px; font-weight: 850; white-space: nowrap; overflow: hidden; }
	    .vertical-terminal em { color: rgba(234,240,236,.4); font-style: normal; }
	    .vertical-terminal .active { padding: 7px 8px; border-radius: 8px; color: #fffdf7; background: color-mix(in srgb, var(--style-accent) 38%, transparent); }
	    .vertical-chart-board { position: absolute; inset: 10px; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 7px; min-width: 0; overflow: hidden; }
	    .vertical-source-pill { position: relative; z-index: 3; min-width: 0; padding: 7px 9px; border-radius: 10px; background: rgba(255,253,247,.92); color: rgba(19,25,24,.75); font-size: 10px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-chart-plot { position: relative; min-width: 0; min-height: 0; border-radius: 14px; background: linear-gradient(180deg, rgba(255,253,247,.78), rgba(232,239,233,.78)); overflow: hidden; }
	    .vertical-chart-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	    .vertical-chart-board .axis, .vertical-chart-board .grid, .vertical-matrix-board .coord-grid, .vertical-matrix-board .coord-axis { fill: none; stroke: rgba(20,24,23,.2); stroke-width: 2; }
	    .vertical-chart-board .curve, .vertical-matrix-board .coord-path { fill: none; stroke: var(--style-accent); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 720; stroke-dashoffset: 720; animation: stylePathDraw 4s infinite both; }
	    .vertical-chart-board .curve.cn { stroke: #4d7b6f; }.vertical-chart-board .curve.in { stroke: #a66c3a; }
	    .vertical-chart-board circle, .vertical-matrix-board .coord-point { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 4; animation: styleDot 4s infinite both; }
	    .vertical-chart-board text, .vertical-matrix-board text, .vertical-geo-board text { font-size: 12px; font-weight: 900; fill: rgba(19,25,24,.78); }
	    .vertical-type-board, .vertical-quote-board { position: absolute; inset: 22px; display: grid; align-content: center; gap: 12px; }
	    .vertical-type-board strong, .vertical-quote-board strong { color: #141918; font-size: 36px; line-height: 1.04; animation: styleTypeIn 4s infinite both; overflow-wrap: anywhere; }
	    .vertical-type-board span, .vertical-quote-board span, .vertical-quote-board em { color: rgba(19,25,24,.66); font-size: 14px; line-height: 1.35; font-weight: 850; font-style: normal; }
	    .vertical-type-board i { width: 6px; height: 38px; background: var(--style-accent); animation: caretBlink .7s infinite; }
	    .vertical-whiteboard-board { display: block; }
	    .vertical-whiteboard-board .sketch { fill: none; stroke: #111716; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 720; stroke-dashoffset: 720; animation: stylePathDraw 4s infinite both; }
	    .vertical-whiteboard-board .mark { fill: none; stroke: #c45b3a; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 320; stroke-dashoffset: 320; animation: stylePathDraw 4s .35s infinite both; }
	    .vertical-card.wb { position: absolute; width: 42%; }.vertical-card.wb.a { left: 16px; top: 16px; }.vertical-card.wb.b { right: 12px; bottom: 8px; }
	    .vertical-cover-mini { display: grid; align-content: center; gap: 12px; min-height: 154px; padding: 16px; border-radius: 14px; background: #151a1b; color: #fffdf7; }
	    .vertical-cover-mini b { font-size: 21px; line-height: 1.1; }.vertical-cover-mini span { color: color-mix(in srgb, var(--style-accent) 72%, #fffdf7); font-weight: 950; }
	    .vertical-ip-board { position: absolute; inset: 12px; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 7px; overflow: hidden; }
	    .vertical-ip-board > .vertical-card { display: none; }
	    .vertical-ip-canvas { position: relative; min-width: 0; min-height: 0; border-radius: 14px; background: #f8f3e9; border: 1px solid rgba(20,24,23,.12); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,.62); }
	    .vertical-ip-paper-frame { position: absolute; inset: 10px; border: 2px solid rgba(20,24,23,.18); border-radius: 10px; background: linear-gradient(180deg, #fffdf7, #efe8da); overflow: hidden; }
	    .ip-paper-tag { position: absolute; right: 8px; top: 8px; z-index: 4; padding: 5px 7px; border-radius: 999px; border: 1px solid rgba(20,24,23,.14); background: rgba(255,253,247,.9); font-size: 9px; line-height: 1; font-weight: 950; }
	    .vertical-presenter { position: absolute; left: 4px; bottom: 8px; width: 104px; height: 158px; z-index: 3; transform: scale(.48); transform-origin: left bottom; overflow: hidden; }
	    .vertical-presenter i { position: absolute; left: 34px; top: 0; width: 46px; height: 46px; border-radius: 50%; background: #d6a878; box-shadow: inset 0 -8px 0 rgba(20,24,23,.08); }
	    .vertical-presenter i::after { content: ""; position: absolute; left: 8px; top: -6px; width: 32px; height: 16px; border-radius: 50% 50% 38% 38%; background: #161b1a; transform: rotate(-8deg); }
	    .vertical-presenter b { position: absolute; left: 22px; top: 48px; width: 68px; height: 94px; border-radius: 28px 28px 12px 12px; background: linear-gradient(180deg, #334c45, #22302d); overflow: hidden; }
	    .vertical-presenter b::before, .vertical-presenter b::after { content: ""; position: absolute; top: 22px; width: 46px; height: 8px; border-radius: 999px; background: #334c45; }
	    .vertical-presenter b::before { left: -30px; transform: rotate(-22deg); }
	    .vertical-presenter b::after { right: -34px; transform: rotate(-34deg); background: var(--style-accent); }
	    .vertical-presenter span { position: absolute; left: 64px; top: 78px; width: 60px; height: 8px; border-radius: 8px; background: var(--style-accent); transform: rotate(-24deg); transform-origin: left center; }
	    .ip-speech-bubble { position: absolute; left: 66px; top: 2px; max-width: 76px; padding: 6px 7px; border-radius: 12px 12px 12px 4px; background: #fffdf7; border: 1px solid rgba(20,24,23,.16); box-shadow: 0 10px 18px rgba(20,24,23,.08); font-size: 9px; line-height: 1.18; font-weight: 950; }
	    .ip-knowledge-sheet { position: absolute; right: 8px; bottom: 0; width: 76px; min-height: 76px; display: grid; align-content: start; gap: 4px; padding: 7px; border-radius: 11px; background: #fffdf7; border: 1px solid rgba(20,24,23,.14); box-shadow: 0 14px 26px rgba(20,24,23,.1); }
	    .ip-knowledge-sheet b { font-size: 10px; line-height: 1.12; }
	    .ip-knowledge-sheet span { color: rgba(19,25,24,.64); font-size: 8px; line-height: 1.2; font-weight: 850; }
	    .ip-knowledge-sheet i { height: 18px; border-radius: 8px; background: repeating-linear-gradient(0deg, color-mix(in srgb, var(--style-accent) 22%, #fffdf7), color-mix(in srgb, var(--style-accent) 22%, #fffdf7) 5px, #fffdf7 5px, #fffdf7 10px); border: 1px solid rgba(20,24,23,.08); }
	    .ip-detail-chip { position: absolute; z-index: 4; padding: 5px 7px; border-radius: 999px; background: color-mix(in srgb, var(--style-accent) 16%, #fffdf7); border: 1px solid rgba(20,24,23,.12); font-size: 9px; line-height: 1; font-weight: 950; }
	    .ip-detail-chip.c1 { left: 24px; top: 30px; }.ip-detail-chip.c2 { left: 84px; top: 34px; }.ip-detail-chip.c3 { right: 18px; top: 44px; }
	    .vertical-agent-stack { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
	    .vertical-agent-stack span { padding: 5px 4px; border-radius: 999px; background: color-mix(in srgb, var(--style-accent) 16%, #fffdf7); border: 1px solid rgba(20,24,23,.1); font-size: 9px; font-weight: 950; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-dashboard-board, .vertical-recap-board, .vertical-check-board, .vertical-citation-board { position: absolute; inset: 16px; display: grid; gap: 9px; align-content: center; }
	    .vertical-dashboard-board .metric.active { background: color-mix(in srgb, var(--style-accent) 12%, rgba(255,253,247,.94)); }
	    .vertical-formula-board { position: absolute; inset: 12px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 8px; min-width: 0; overflow: hidden; }
	    .formula-chain { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr); gap: 5px; align-items: center; min-width: 0; padding: 0; overflow: hidden; }
	    .formula-chain span, .formula-chain b { min-width: 0; padding: 8px 7px; border-radius: 10px; background: rgba(255,253,247,.94); border: 1px solid rgba(20,24,23,.12); font-size: 11px; line-height: 1.08; font-weight: 950; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .formula-chain i { color: var(--style-accent); font-style: normal; font-size: 11px; font-weight: 950; text-align: center; white-space: nowrap; }
	    .formula-graph-window { position: relative; min-width: 0; min-height: 0; border-radius: 14px; background: linear-gradient(180deg, rgba(255,253,247,.76), rgba(234,240,236,.82)); border: 1px solid rgba(20,24,23,.1); overflow: hidden; }
	    .formula-graph-window svg { position: absolute; inset: 0; width: 100%; height: 100%; }
	    .formula-note { min-width: 0; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--style-accent) 12%, #fffdf7); border: 1px solid color-mix(in srgb, var(--style-accent) 30%, rgba(20,24,23,.08)); color: rgba(19,25,24,.72); font-size: 10px; line-height: 1.24; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-formula-board .coord-axis, .vertical-formula-board .parabola-line { fill: none; stroke: rgba(20,24,23,.28); stroke-width: 3; }
	    .vertical-formula-board .parabola-line { stroke: var(--style-accent); stroke-width: 6; stroke-linecap: round; }
	    .vertex-dot { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 4; }
	    .vertical-orbit-board { position: absolute; inset: 18px; display: grid; place-items: center; }
	    .vertical-orbit-core { width: 124px; height: 124px; border-radius: 50%; display: grid; place-items: center; background: var(--style-accent); color: #fffdf7; font-size: 17px; font-weight: 950; box-shadow: 0 0 0 42px color-mix(in srgb, var(--style-accent) 12%, transparent); }
	    .v-orb { position: absolute; min-width: 58px; padding: 8px 10px; border-radius: 999px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.1); text-align: center; font-weight: 950; font-size: 12px; }
	    .v-orb.o1 { top: 50px; left: 40px; }.v-orb.o2 { top: 74px; right: 30px; }.v-orb.o3 { bottom: 84px; left: 28px; }.v-orb.o4 { bottom: 48px; right: 52px; }
	    .vertical-material-board { position: absolute; inset: 16px; display: grid; grid-template-rows: 1fr auto auto; gap: 10px; }
	    .main-material { display: grid; align-content: end; gap: 8px; min-height: 210px; padding: 16px; border-radius: 14px; background: linear-gradient(145deg, color-mix(in srgb, var(--style-accent) 28%, #202a26), #151a1b); color: #fffdf7; overflow: hidden; }
	    .main-material i { height: 92px; border-radius: 14px; background: rgba(255,253,247,.18); border: 1px solid rgba(255,255,255,.16); }
	    .main-material b { font-size: 22px; }.main-material span { color: rgba(255,253,247,.7); font-weight: 850; }
	    .material-strip, .gallery-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
	    .material-strip span, .gallery-strip span { min-width: 0; padding: 8px 6px; border-radius: 9px; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.1); color: #25302d; font-size: 10px; font-weight: 950; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-quote-board { overflow: hidden; }
	    .vertical-quote-board b { width: max-content; max-width: 100%; padding: 8px 12px; border-radius: 10px; background: var(--style-accent); color: #fffdf7; font-size: 18px; overflow: hidden; text-overflow: ellipsis; }
	    .vertical-check-board span { display: grid; place-items: center; min-height: 46px; border-radius: 11px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.1); font-weight: 950; }
	    .vertical-check-board span.ok::before { content: "✓"; margin-right: 4px; color: #2f6848; }
	    .vertical-check-board span.warn { color: #9a3c2f; border-color: rgba(168,71,53,.32); }
	    .loop-card, .verification-stamp, .selected-frame, .funnel-drop { display: grid; place-items: center; min-height: 58px; border-radius: 13px; background: var(--style-accent); color: #fffdf7; font-size: 17px; font-weight: 950; text-align: center; }
	    .vertical-ranking-board,
	    .vertical-tree-board,
	    .vertical-funnel-board,
	    .vertical-agent-board,
	    .vertical-risk-board,
	    .vertical-calendar-board,
	    .vertical-calendar-board .event-rail { min-width: 0; overflow: hidden; }
	    .vertical-template-preview .rank-head,
	    .vertical-template-preview .rank-row,
	    .vertical-template-preview .risk-level,
	    .vertical-template-preview .risk-impact,
	    .vertical-template-preview .selected-frame,
	    .vertical-template-preview .calendar-grid,
	    .vertical-template-preview .event-rail,
	    .vertical-template-preview .cue-row,
	    .vertical-template-preview .tree-node,
	    .vertical-template-preview .tree-row span,
	    .vertical-template-preview .agent-lane,
	    .vertical-template-preview .source-card,
	    .vertical-template-preview .funnel-drop,
	    .vertical-template-preview .verification-stamp {
	      position: relative;
	      left: auto;
	      right: auto;
	      top: auto;
	      bottom: auto;
	      width: auto;
	      height: auto;
	      transform: none;
	    }
	    .vertical-ranking-board { position: absolute; inset: 16px; display: grid; grid-template-rows: auto repeat(4, minmax(0, 1fr)); gap: 7px; }
	    .vertical-ranking-board .rank-head,
	    .vertical-ranking-board .rank-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) 46px; gap: 5px; align-items: center; padding: 8px; border-radius: 10px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.1); min-width: 0; overflow: hidden; }
	    .vertical-ranking-board .rank-head { grid-template-columns: minmax(0, 1fr); }
	    .vertical-ranking-board .rank-head b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
	    .vertical-ranking-board .rank-head span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(19,25,24,.62); font-size: 9px; font-weight: 850; }
	    .vertical-ranking-board .rank-row b { color: var(--style-accent); font-size: 12px; }
	    .vertical-ranking-board .rank-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 950; }
	    .vertical-ranking-board .rank-row i { height: 7px; border-radius: 8px; background: var(--style-accent); }
	    .vertical-ranking-board .rank-row em { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style: normal; font-size: 10px; font-weight: 950; }
	    .vertical-geo-board .geo-land { fill: #dfe8e0; stroke: rgba(20,24,23,.18); stroke-width: 2; }
	    .vertical-geo-board .geo-region { fill: color-mix(in srgb, var(--style-accent) 24%, #fffdf7); stroke: var(--style-accent); stroke-width: 3; }
	    .vertical-geo-board .geo-dot { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 5; }
	    .vertical-geo-board .geo-callout-line { fill: none; stroke: var(--style-accent); stroke-width: 4; stroke-linecap: round; }
	    .vertical-tree-board { position: absolute; inset: 16px; display: grid; gap: 8px; align-content: center; }
	    .vertical-tree-board .tree-node, .vertical-tree-board span { display: grid; place-items: center; min-width: 0; min-height: 42px; border-radius: 11px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.1); font-size: 12px; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-tree-board .root, .vertical-tree-board .active { background: color-mix(in srgb, var(--style-accent) 16%, #fffdf7); border-color: color-mix(in srgb, var(--style-accent) 38%, rgba(20,24,23,.12)); }
	    .vertical-network-board .net-edge { fill: none; stroke: rgba(20,24,23,.18); stroke-width: 3; }
	    .vertical-network-board .net-edge.active { stroke: var(--style-accent); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 720; stroke-dashoffset: 720; animation: stylePathDraw 4s infinite both; }
	    .vertical-network-board .net-node circle { fill: #fffdf7; stroke: var(--style-accent); stroke-width: 4; }
	    .vertical-network-board .net-node text { font-size: 11px; font-weight: 950; fill: #141918; }
	    .vertical-funnel-board { position: absolute; inset: 16px; display: grid; gap: 8px; align-content: center; }
	    .vertical-funnel-board .funnel-stage { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; align-items: center; justify-items: center; min-width: 0; min-height: 48px; border-radius: 12px; padding: 7px 10px; text-align: center; background: color-mix(in srgb, var(--style-accent) calc(18% + var(--stage, 0%)), #fffdf7); border: 1px solid rgba(20,24,23,.1); font-weight: 950; overflow: hidden; }
	    .vertical-funnel-board .funnel-stage b,
	    .vertical-funnel-board .funnel-stage span { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-funnel-board .funnel-stage b { font-size: 12px; }
	    .vertical-funnel-board .funnel-stage span { font-size: 11px; }
	    .vertical-funnel-board .f1 { margin: 0 0; --stage: 20%; }.vertical-funnel-board .f2 { margin: 0 12px; --stage: 10%; }.vertical-funnel-board .f3 { margin: 0 24px; --stage: 4%; }.vertical-funnel-board .f4 { margin: 0 36px; --stage: 0%; }
	    .vertical-agent-board { position: absolute; inset: 14px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 9px; }
	    .vertical-agent-board svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
	    .vertical-agent-board .agent-lane { position: relative; z-index: 2; display: grid; align-content: center; gap: 5px; min-width: 0; padding: 10px; border-radius: 12px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.1); overflow: hidden; }
	    .vertical-agent-board .agent-lane b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
	    .vertical-agent-board .agent-lane span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(19,25,24,.64); font-size: 11px; font-weight: 850; }
	    .vertical-agent-board .agent-flow { fill: none; stroke: var(--style-accent); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 720; stroke-dashoffset: 720; animation: stylePathDraw 4s infinite both; }
	    .vertical-screenflow-board { position: absolute; inset: 16px; display: grid; gap: 10px; align-content: center; }
	    .vertical-screenflow-board .screen-card { min-height: 92px; display: grid; align-content: center; gap: 8px; padding: 12px; border-radius: 15px; background: #151a1b; color: #fffdf7; box-shadow: 0 14px 32px rgba(20,24,23,.16); }
	    .screen-card i, .screen-card span { display: block; height: 8px; border-radius: 8px; background: rgba(255,253,247,.22); }
	    .tap-cursor { position: absolute; right: 52px; top: 48%; width: 32px; height: 32px; border-radius: 50%; background: var(--style-accent); box-shadow: 0 0 0 10px color-mix(in srgb, var(--style-accent) 20%, transparent); animation: styleDot 4s infinite both; }
	    .vertical-risk-board { position: absolute; inset: 14px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 8px; }
	    .vertical-risk-board .risk-level, .vertical-risk-board .risk-impact { display: grid; gap: 6px; min-width: 0; padding: 10px 11px; border-radius: 13px; background: rgba(255,253,247,.92); border: 1px solid rgba(20,24,23,.1); overflow: hidden; }
	    .vertical-risk-board .risk-level b { color: #a84735; font-size: 18px; line-height: 1.04; }
	    .vertical-risk-board .risk-level span, .vertical-risk-board .risk-impact span { min-width: 0; color: rgba(19,25,24,.66); font-size: 10px; line-height: 1.28; font-weight: 850; overflow-wrap: anywhere; }
	    .vertical-risk-board .risk-impact i { min-height: 0; height: 52px; border-radius: 12px; background: repeating-linear-gradient(135deg, rgba(168,71,53,.22), rgba(168,71,53,.22) 8px, rgba(255,253,247,.72) 8px, rgba(255,253,247,.72) 16px); }
	    .vertical-citation-board .verification-stamp { min-height: 50px; }
	    .vertical-voice-board { position: absolute; inset: 16px; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
	    .vertical-voice-board .wave-bar { fill: color-mix(in srgb, var(--style-accent) 78%, #315d86); opacity: .75; animation: voiceBar 1.2s infinite ease-in-out alternate; }
	    .vertical-voice-board .playhead { stroke: #141918; stroke-width: 5; stroke-linecap: round; animation: styleStepBlink 4s infinite both; }
	    .cue-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
	    .cue-row span { min-width: 0; padding: 8px 5px; border-radius: 999px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.1); color: #25302d; font-size: 10px; font-weight: 950; text-align: center; }
	    .cue-row .active { background: var(--style-accent); color: #fffdf7; }
	    .vertical-gallery-board { position: absolute; inset: 14px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 8px; }
	    .vertical-gallery-board .gallery-strip { grid-template-columns: repeat(3, 1fr); }
	    .vertical-gallery-board .gallery-strip .active { background: var(--style-accent); color: #fffdf7; }
	    .vertical-gallery-board .selected-frame { min-height: 0; display: grid; place-items: center; border-radius: 14px; background: linear-gradient(145deg, color-mix(in srgb, var(--style-accent) 72%, #151a1b), #151a1b); color: #fffdf7; font-size: 18px; font-weight: 950; }
	    .vertical-calendar-board { position: absolute; inset: 12px; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 6px; }
	    .calendar-header { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; min-width: 0; padding: 8px 9px; border-radius: 11px; background: rgba(255,253,247,.92); border: 1px solid rgba(20,24,23,.1); }
	    .calendar-header b { color: #141918; font-size: 12px; line-height: 1.08; }
	    .calendar-header span { color: rgba(19,25,24,.66); font-size: 9px; line-height: 1.16; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	    .weekday-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; color: rgba(19,25,24,.58); font-size: 8px; line-height: 1; font-weight: 950; text-align: center; }
	    .vertical-calendar-board .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; align-content: start; min-height: 0; }
	    .vertical-calendar-board .calendar-grid span { min-width: 0; min-height: 0; aspect-ratio: 1 / 1; display: grid; place-items: center; border-radius: 7px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.1); color: #141918; font-size: 9px; line-height: 1; font-weight: 950; }
	    .vertical-calendar-board .calendar-grid .empty { opacity: .2; }
	    .vertical-calendar-board .calendar-grid .today { background: var(--style-accent); color: #fffdf7; }
	    .vertical-calendar-board .calendar-grid .start { border-color: color-mix(in srgb, var(--style-accent) 44%, rgba(20,24,23,.12)); color: color-mix(in srgb, var(--style-accent) 72%, #141918); }
	    .vertical-calendar-board .calendar-grid .deadline { border-color: #a84735; color: #a84735; background: rgba(168,71,53,.08); }
	    .vertical-calendar-board .event-rail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 5px; padding: 7px; border-radius: 11px; background: rgba(255,253,247,.92); border: 1px solid rgba(20,24,23,.1); font-size: 9px; line-height: 1.15; font-weight: 900; }
	    .vertical-calendar-board .event-rail i { height: 5px; border-radius: 8px; background: var(--style-accent); }
	    .vertical-calendar-board .event-rail span,
	    .vertical-calendar-board .event-rail em { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .vertical-calendar-board .event-rail i { grid-column: 1 / -1; }
	    .vertical-story-board { display: grid; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 14px 16px 78px; overflow: hidden; }
	    .vertical-story-board svg { position: absolute; inset: auto 14px 12px 32%; width: 62%; height: 62%; opacity: .52; }
	    .vertical-story-board .vertical-card { min-height: 0; padding: 9px 11px; }
	    .vertical-screenflow-board .tap-cursor { left: auto; }
	    .style-review-zoom { display: grid; place-items: center; }
	    .vertical-style-review-page .style-review-dialog { width: min(1120px, calc(100vw - 40px)); }
	    .vertical-style-review-page .style-review-dialog-body { grid-template-columns: minmax(390px, .72fr) minmax(320px, .56fr); align-items: center; }
	    .vertical-style-review-page .style-review-zoom { min-height: 700px; background: #eee8dc; }
	    @keyframes verticalFill { 0% { transform: scaleY(0); } 86%, 100% { transform: scaleY(1); } }
	    @keyframes styleTitleIn { 0% { opacity: 0; transform: translateY(12px); } 18%, 84% { opacity: 1; transform: none; } 100% { opacity: .35; } }
	    @keyframes styleChip { 0%, 26% { opacity: 0; transform: translateY(10px) scale(.94); } 42%, 86% { opacity: 1; transform: none; } 100% { opacity: .2; } }
	    @keyframes styleCardFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
	    @keyframes stylePathDraw { 0%, 18% { stroke-dashoffset: 420; } 64%, 100% { stroke-dashoffset: 0; } }
	    @keyframes styleDot { 0%, 48% { opacity: 0; transform: scale(.6); } 64%, 90% { opacity: 1; transform: scale(1); } 100% { opacity: .25; } }
	    @keyframes styleTypeIn { 0%, 24% { opacity: 0; clip-path: inset(0 100% 0 0); } 54%, 100% { opacity: 1; clip-path: inset(0 0 0 0); } }
	    @keyframes examplePulse { 0%, 38% { opacity: .38; transform: scale(.96); } 56%, 88% { opacity: 1; transform: scale(1); } 100% { opacity: .48; } }
	    @keyframes orbitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	    .motion-detail-grid { margin-top: 4px; }
    .motion-table-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .motion-table-card { position: relative; display: grid; grid-template-columns: 18px 92px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 96px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); min-width: 0; }
    .motion-check { display: grid; place-items: center; cursor: pointer; }
    .motion-table-card input { width: 16px; height: 16px; }
    .motion-table-card.disabled { opacity: .48; }
    .motion-table-card.disabled .motion-gif-cell { filter: grayscale(.35); }
    .motion-gif-cell { display: block; min-width: 0; }
    .motion-gif-cell .motion-preview, .motion-gif-cell .capability-motion-preview { height: 74px; min-height: 74px; width: 92px; border-radius: 8px; }
    .motion-gif-cell .motion-stage { padding: 8px; }
    .motion-gif-cell .motion-word { left: 8px; padding: 4px 6px; font-size: 10px; }
    .motion-gif-cell .motion-word.w1 { top: 8px; }
    .motion-gif-cell .motion-word.w2 { top: 28px; }
    .motion-gif-cell .motion-word.w3 { top: 48px; }
    .motion-gif-cell .motion-stamp { right: 6px; bottom: 8px; padding: 6px; font-size: 10px; }
    .motion-gif-cell .timeline-rail { left: 10px; right: 10px; top: 34px; }
    .motion-gif-cell .node { top: 27px; width: 14px; height: 14px; border-width: 3px; }
    .motion-gif-cell .node.n1 { left: 10px; }.motion-gif-cell .node.n4 { right: 10px; }
    .motion-gif-cell .step-label { display: none; }
    .motion-gif-cell .typed-line { left: 10px; font-size: 11px; }
    .motion-gif-cell .typed-line.line-a { top: 18px; }
    .motion-gif-cell .typed-line.line-b { top: 42px; }
    .motion-gif-cell .caret { top: 43px; left: 76px; height: 18px; }
    .motion-table-copy { min-width: 0; display: grid; gap: 3px; }
    .motion-table-copy small { color: var(--accent); font-size: 11px; font-weight: 900; line-height: 1.2; }
    .motion-table-copy strong { font-size: 14px; line-height: 1.2; }
    .motion-table-copy em { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; }
    .motion-preview-open { align-self: end; border: 1px solid rgba(49,95,125,.26); background: #eef5f4; color: var(--accent); border-radius: 7px; min-height: 30px; padding: 0 9px; font-size: 12px; font-weight: 900; cursor: pointer; }
    .motion-preview-dialog { width: min(980px, calc(100vw - 40px)); border: 1px solid rgba(20,24,23,.18); border-radius: 8px; padding: 0; background: var(--surface-strong); box-shadow: 0 26px 90px rgba(20,24,23,.28); }
    .motion-preview-dialog::backdrop { background: rgba(20,24,23,.48); backdrop-filter: blur(4px); }
    .motion-preview-dialog form { position: absolute; right: 12px; top: 12px; z-index: 3; margin: 0; }
    .motion-preview-dialog form button { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--line); background: rgba(255,255,255,.88); color: var(--ink); font-size: 22px; line-height: 1; cursor: pointer; }
    .motion-preview-dialog-body { display: grid; grid-template-columns: minmax(480px, 1.1fr) minmax(260px, .65fr); gap: 18px; padding: 22px; align-items: stretch; }
    .motion-preview-zoom { min-height: 420px; border-radius: 8px; background: #f1eee6; border: 1px solid var(--line); overflow: hidden; display: grid; place-items: stretch; }
    .motion-preview-zoom .motion-preview, .motion-preview-zoom .capability-motion-preview { width: 100%; height: 100%; min-height: 420px; border-radius: 8px; border: 0; }
    .motion-preview-zoom .motion-stage { padding: 26px; }
    .motion-preview-zoom .motion-stage i, .motion-preview-zoom .motion-stage b, .motion-preview-zoom .motion-stage span, .motion-preview-zoom .capability-motion-preview i, .motion-preview-zoom .capability-motion-preview b, .motion-preview-zoom .capability-motion-preview span, .motion-preview-zoom .capability-motion-preview em { animation-delay: -1.1s !important; }
    .motion-preview-dialog-copy { display: grid; align-content: center; gap: 10px; padding: 18px; border-radius: 8px; background: rgba(237,242,239,.68); border: 1px solid var(--line); }
    .motion-preview-dialog-copy small { color: var(--accent); font-weight: 900; }
    .motion-preview-dialog-copy h3 { margin: 0; font-size: 26px; line-height: 1.15; }
    .motion-preview-dialog-copy p { margin: 0; color: var(--muted); line-height: 1.65; }
    .capability-motion-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .capability-motion-card { display: grid; grid-template-columns: 18px 76px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); cursor: pointer; min-width: 0; }
    .capability-motion-card input { width: 16px; height: 16px; }
    .capability-motion-card span { min-width: 0; display: grid; gap: 2px; }
    .capability-motion-card small { color: var(--accent); font-size: 11px; font-weight: 900; }
    .capability-motion-card strong { font-size: 14px; line-height: 1.2; }
    .capability-motion-card em { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; }
    .capability-motion-preview { position: relative; height: 62px; border-radius: 8px; overflow: hidden; background: linear-gradient(145deg, #f5f1e8, #dfe8e4); border: 1px solid rgba(20,25,24,.08); }
    .capability-motion-preview i, .capability-motion-preview b, .capability-motion-preview span, .capability-motion-preview em { position: absolute; display: block; font-style: normal; }
    .capability-motion-preview i { width: 17px; height: 17px; border-radius: 50%; background: var(--accent); animation: miniPulse 2.4s infinite both; }
    .capability-motion-preview i:nth-child(1) { left: 10px; top: 10px; }
    .capability-motion-preview i:nth-child(2) { left: 30px; top: 28px; animation-delay: .18s; background: var(--accent-2); }
    .capability-motion-preview i:nth-child(3) { right: 12px; top: 14px; animation-delay: .36s; background: var(--green); }
    .capability-motion-preview b { left: 12px; right: 12px; bottom: 13px; height: 4px; border-radius: 5px; background: rgba(20,24,23,.16); overflow: hidden; }
    .capability-motion-preview b::after { content: ""; display: block; height: 100%; width: 100%; background: var(--ink); transform-origin: left; animation: miniFill 2.4s infinite both; }
    .capability-motion-preview span { right: 13px; bottom: 21px; width: 26px; height: 20px; border-radius: 5px; border: 2px solid var(--accent); animation: miniCard 2.4s infinite both; }
    .preview-sketch i, .preview-whiteboard i { border-radius: 0; height: 4px; width: 34px; transform: rotate(-15deg); }
    .preview-depth i:nth-child(1) { width: 32px; height: 22px; border-radius: 5px; transform: perspective(80px) rotateY(24deg); }
    .preview-chart b::after, .preview-path b::after { background: var(--accent-2); }
    .cap-tag, .cap-state, .cap-formula, .cap-note, .cap-board, .cap-subtitle, .cap-gate { padding: 5px 7px; border-radius: 7px; background: rgba(255,253,247,.9); border: 1px solid rgba(20,24,23,.1); font-size: 11px; font-weight: 950; color: var(--ink); }
    .cap-path, .cap-chart-line, .cap-proof-line, .cap-sketch-line, .cap-draw, .cap-highlight, .cap-cover-flash { height: 4px; border-radius: 9px; background: var(--accent-2); transform-origin: left; animation: miniFill 2.4s infinite both; }
    .cap-rail { left: 12px; right: 12px; bottom: 13px; height: 4px; background: rgba(20,24,23,.18); border-radius: 9px; }
    .cap-dot.a { left: 12px; top: 18px; }
    .cap-path { left: 18px; right: 18px; top: 36px; transform: rotate(-8deg); }
    .cap-tag { right: 9px; top: 8px; animation: miniCard 2.4s infinite both; }
    .cap-card { width: 30px; height: 24px; border-radius: 6px; background: #fffdf7; border: 1px solid rgba(20,24,23,.14); }
    .cap-card.one { left: 10px; top: 12px; }.cap-card.two { left: 32px; top: 27px; animation-delay: .16s; }.cap-card.three { right: 11px; top: 14px; animation-delay: .32s; }
    .cap-focus { left: 26px; right: 18px; bottom: 12px; height: 4px; background: var(--accent); border-radius: 9px; animation: miniFill 2.4s infinite both; }
    .cap-axis.x { left: 14px; right: 12px; bottom: 13px; height: 3px; background: rgba(20,24,23,.24); }.cap-axis.y { left: 14px; top: 10px; bottom: 13px; width: 3px; background: rgba(20,24,23,.24); }
    .cap-chart-line { left: 20px; right: 12px; top: 34px; transform: rotate(-12deg); }
    .cap-bar { bottom: 16px; width: 10px; border-radius: 4px 4px 0 0; }.cap-bar.one { left: 34px; height: 20px; }.cap-bar.two { left: 52px; height: 30px; background: var(--accent-2); }.cap-bar.three { left: 70px; height: 25px; background: var(--green); }
    .cap-loop { inset: 12px 20px; border: 3px solid rgba(49,95,125,.28); border-radius: 50%; background: transparent; animation: orbitSpin 3s linear infinite; }
    .cap-orbit.core { left: 39px; top: 25px; }.cap-orbit.sat.one { left: 15px; top: 17px; }.cap-orbit.sat.two { right: 16px; bottom: 16px; background: var(--accent-2); }
    .cap-formula { left: 9px; top: 12px; }.cap-formula.result { right: 9px; bottom: 12px; color: #fff; background: var(--accent); }
    .cap-proof-line { left: 15px; right: 15px; top: 38px; }
    .cap-sketch-line.one, .cap-draw.one { left: 12px; right: 18px; top: 22px; transform: rotate(-8deg); }.cap-sketch-line.two, .cap-draw.two { left: 22px; right: 25px; top: 39px; transform: rotate(4deg); background: var(--green); }
    .cap-pen { right: 12px; top: 27px; width: 14px; height: 14px; background: var(--accent-2); border-radius: 50%; box-shadow: 0 0 0 5px rgba(154,103,63,.18); animation: miniPulse 2.4s infinite both; }
    .cap-note { left: 10px; bottom: 9px; }
    .cap-depth { border-radius: 6px; border: 1px solid rgba(20,24,23,.16); background: rgba(255,253,247,.85); }.cap-depth.back { left: 16px; top: 12px; width: 42px; height: 32px; opacity: .55; }.cap-depth.mid { left: 30px; top: 20px; width: 44px; height: 34px; opacity: .75; }.cap-depth.front { right: 12px; bottom: 10px; width: 46px; height: 36px; }
    .cap-depth-shadow { left: 18px; right: 12px; bottom: 8px; height: 4px; background: rgba(20,24,23,.14); border-radius: 9px; }
    .cap-board { left: 10px; top: 10px; }
    .cap-state.start { left: 9px; top: 16px; }.cap-state.end { right: 8px; bottom: 13px; background: var(--green); color: #fff; }
    .cap-state-line { left: 18px; right: 20px; top: 39px; height: 4px; border-radius: 9px; background: rgba(20,24,23,.15); }
    .cap-wave { left: 9px; right: 9px; height: 5px; border-radius: 9px; background: var(--accent); animation: miniFill 2.4s infinite both; }.cap-wave.one { top: 20px; }.cap-wave.two { top: 39px; background: var(--accent-2); animation-delay: .25s; }
    .cap-cut { top: 12px; left: 34px; width: 3px; height: 40px; border-radius: 3px; background: var(--ink); }.cap-cut.second { left: 64px; animation-delay: .35s; }
    .cap-film-strip { inset: 12px 10px; border-radius: 6px; background: #18211f; }.cap-frame { border-radius: 4px; width: 24px; height: 22px; background: #f8faf6; }.cap-frame.one { left: 18px; top: 20px; }.cap-frame.two { right: 18px; top: 20px; background: #dce6e1; }
    .cap-trim { left: 20px; right: 20px; bottom: 13px; height: 4px; background: var(--accent-2); animation: miniFill 2.4s infinite both; }
    .cap-subtitle { left: 16px; right: 16px; bottom: 13px; text-align: center; color: #fff; background: rgba(20,24,23,.78); }.cap-highlight { left: 35px; right: 28px; bottom: 15px; height: 10px; background: rgba(196,138,90,.55); animation: miniFill 2.4s infinite both; }.cap-pulse { left: 14px; top: 13px; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); animation: miniPulse 1.6s infinite both; }
    .cap-cover.wide { left: 12px; top: 13px; width: 46px; height: 30px; border-radius: 6px; background: #fffdf7; border: 1px solid rgba(20,24,23,.14); }.cap-cover.vertical { right: 15px; bottom: 10px; width: 24px; height: 42px; border-radius: 6px; background: #dce6e1; border: 1px solid rgba(20,24,23,.14); }
    .cap-cover-flash { left: 16px; right: 16px; top: 31px; }
    .cap-gate { left: 10px; top: 10px; }.cap-gate-line { left: 12px; right: 12px; bottom: 15px; height: 4px; background: rgba(20,24,23,.18); border-radius: 9px; }.cap-switch { right: 16px; bottom: 9px; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); animation: miniCard 2.4s infinite both; }
    @keyframes orbitSpin { to { transform: rotate(360deg); } }
    @keyframes miniPulse { 0% { transform: translateY(10px) scale(.7); opacity: .35; } 45%, 80% { transform: none; opacity: 1; } 100% { opacity: .35; } }
    @keyframes miniFill { 0% { transform: scaleX(0); } 72%, 100% { transform: scaleX(1); } }
    @keyframes miniCard { 0%, 28% { opacity: 0; transform: translateY(10px); } 52%, 100% { opacity: 1; transform: none; } }
    .color-auto-card { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 11px; align-items: start; margin-bottom: 10px; cursor: pointer; }
    .color-auto-card input { width: 18px; height: 18px; margin-top: 2px; }
    .color-auto-card span { display: grid; gap: 5px; min-width: 0; }
    .color-auto-card strong { font-size: 16px; line-height: 1.2; }
    .color-auto-card em, .color-auto-card small { color: var(--muted); font-size: 12px; line-height: 1.45; font-style: normal; }
    .palette-candidate-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
    .palette-candidate-strip span { border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.58); padding: 5px 8px; color: var(--muted); font-size: 12px; }
    .palette-candidate-strip b { color: var(--accent); font-weight: 900; }
    .palette-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .palette-tabs button { border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; background: #fff; color: var(--ink); cursor: pointer; }
    .palette-tabs button.active { color: #fff; background: var(--ink); border-color: var(--ink); }
    .palette-tabs b, .caption-toolbar b { margin-left: 4px; opacity: .75; }
    .palette-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .palette-row[hidden] { display: none; }
    .palette-row { display: grid; grid-template-columns: 22px 116px minmax(110px, .8fr) minmax(160px, 1fr) minmax(160px, 1fr); gap: 10px; align-items: center; cursor: pointer; padding: 10px 12px; }
    .palette-row input { width: 16px; height: 16px; }
    .palette-row strong { font-size: 15px; line-height: 1.25; }
    .palette-row span, .palette-row em { color: var(--muted); font-size: 12px; line-height: 1.35; font-style: normal; }
    .swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; height: 28px; }
    .swatches i { border-radius: 7px; border: 1px solid rgba(20,25,24,.08); }
    .source-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .source-strip a { color: var(--accent); text-decoration: none; border: 1px solid rgba(49,95,125,.18); background: rgba(255,255,255,.55); border-radius: 7px; padding: 7px 9px; font-size: 12px; }
    .caption-automation-grid { display: grid; grid-template-columns: minmax(180px, .72fr) minmax(220px, .9fr) minmax(320px, 1.4fr); gap: 10px; margin-bottom: 14px; }
    .caption-auto-card { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 9px; align-items: center; padding: 12px; border-radius: 8px; background: var(--surface-strong); border: 1px solid var(--line); cursor: pointer; }
    .caption-auto-card input { width: 18px; height: 18px; }
    .caption-auto-card b, .caption-auto-card em { display: block; }
    .caption-auto-card b { font-size: 15px; }
    .caption-auto-card em { color: var(--muted); font-style: normal; line-height: 1.4; font-size: 12px; }
    .caption-planner-preview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,.58); border: 1px dashed rgba(49,95,125,.28); }
    .caption-planner-preview > b { grid-column: 1 / -1; font-size: 13px; }
    .caption-planner-preview span { display: grid; gap: 2px; padding: 7px 8px; border-radius: 7px; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.08); min-width: 0; }
    .caption-planner-preview strong { font-size: 12px; line-height: 1.2; color: var(--ink); }
    .caption-planner-preview em { color: var(--muted); font-size: 11px; line-height: 1.2; font-style: normal; overflow-wrap: anywhere; }
    .caption-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .caption-toolbar button, .compose-bar button { border: 1px solid var(--line); border-radius: 7px; padding: 9px 12px; background: #fff; color: var(--ink); cursor: pointer; }
    .caption-toolbar button.active, .compose-bar .primary { color: #fff; background: var(--ink); border-color: var(--ink); }
    .caption-table { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .caption-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) minmax(210px, .9fr); gap: 12px; align-items: stretch; cursor: pointer; }
    .caption-row[hidden] { display: none; }
    .caption-check { display: flex; align-items: center; justify-content: center; }
    .caption-check input { width: 18px; height: 18px; }
    .caption-copy { min-width: 0; }
    .caption-row small { color: var(--accent); font-size: 12px; font-weight: 800; }
    .caption-preview { position: relative; min-height: 78px; border-radius: 8px; display: grid; place-items: var(--cap-place, end center); padding: 10px; overflow: hidden; background: linear-gradient(145deg, #f5f1e8, #dde8e3); border: 1px solid rgba(20,25,24,.08); }
    .caption-preview span { position: relative; z-index: 1; display: block; width: var(--cap-width, auto); max-width: 100%; color: var(--cap-color, #fff); background: var(--cap-bg, rgba(20,25,24,.76)); border: 1px solid var(--cap-border, rgba(255,255,255,.32)); border-radius: var(--cap-radius, 7px); padding: var(--cap-pad-y, 7px) var(--cap-pad-x, 10px); font-size: var(--cap-font-size, 13px); font-weight: 850; line-height: 1.25; text-align: var(--cap-align, center); overflow-wrap: anywhere; box-shadow: var(--cap-shadow, none); transform: var(--cap-transform, none); }
    .caption-preview em { position: absolute; left: 10px; top: 9px; color: rgba(20,24,23,.62); font-size: 10px; font-style: normal; font-weight: 900; text-transform: uppercase; }
    .caption-preview[data-caption-look="marker-swipe"] span::after { content: ""; position: absolute; left: 16%; right: 14%; bottom: 19px; height: 10px; background: var(--cap-accent); opacity: .55; z-index: -1; border-radius: 8px; }
    .caption-preview[data-caption-look="hud-strip"] span { border-left: 5px solid var(--cap-accent); }
    .caption-preview[data-caption-look="bilingual-stack"] span::after { content: "EN proof follows"; display: block; margin-top: 3px; color: var(--cap-accent); font-size: 10px; font-weight: 800; }
    .caption-preview[data-caption-look="audio-wave"] span { padding-left: 42px; }
    .caption-preview[data-caption-look="audio-wave"]::after { content: ""; position: absolute; left: calc(50% - 78px); bottom: 18px; width: 34px; height: 20px; border-radius: 50%; border-left: 5px solid var(--cap-accent); border-right: 5px solid var(--cap-accent); }
    .caption-preview[data-caption-decor="rail"] span { border-left: 5px solid var(--cap-accent); }
    .caption-preview[data-caption-decor="corner"]::before { content: ""; position: absolute; right: 10px; top: 10px; width: 24px; height: 24px; border-top: 4px solid var(--cap-accent); border-right: 4px solid var(--cap-accent); border-radius: 2px; }
    .caption-preview[data-caption-decor="marker"] span::before { content: ""; position: absolute; left: 10%; right: 10%; bottom: 6px; height: 7px; border-radius: 7px; background: var(--cap-accent); opacity: .28; z-index: -1; }
    .caption-preview[data-caption-decor="meter"]::before { content: ""; position: absolute; left: 12px; bottom: 14px; width: 44px; height: 5px; border-radius: 9px; background: var(--cap-accent); box-shadow: 52px 0 0 rgba(20,24,23,.16), 104px 0 0 rgba(20,24,23,.11); }
    .caption-preview[data-caption-decor="split"] span { box-shadow: inset 0 -3px 0 var(--cap-accent), var(--cap-shadow, none); }
    .local-material-picker { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr); gap: 12px; margin-top: 14px; padding: 14px; border: 1px dashed rgba(49,95,125,.35); border-radius: 8px; background: rgba(255,255,255,.5); }
    .local-material-picker[hidden] { display: none; }
	    .local-material-picker label { display: grid; gap: 8px; color: var(--ink); font-weight: 800; }
	    .local-material-picker input { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 10px; background: #fff; color: var(--ink); }
	    .local-material-picker small { grid-column: 1 / -1; color: var(--muted); line-height: 1.55; }
	    .cover-config-grid { display: grid; grid-template-columns: minmax(280px, .52fr) minmax(520px, 1.48fr); gap: 12px; align-items: stretch; }
	    .cover-engine-status { display: grid; gap: 6px; padding: 12px 14px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--line); background: rgba(255,253,247,.82); }
	    .cover-engine-status.ready { border-color: rgba(43,110,78,.28); background: rgba(231,241,234,.76); }
	    .cover-engine-status.warning { border-color: rgba(154,103,63,.32); background: rgba(249,239,224,.76); }
	    .cover-engine-status strong { font-size: 15px; line-height: 1.25; }
	    .cover-engine-status span, .cover-engine-status em, .cover-engine-status small { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
	    .cover-engine-status small { color: var(--accent); font-weight: 900; }
	    .cover-example-brief { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
	    .cover-example-brief span { display: grid; gap: 4px; min-width: 0; padding: 10px 11px; border: 1px solid rgba(49,95,125,.18); border-radius: 8px; background: rgba(255,253,247,.78); }
	    .cover-example-brief b { color: var(--accent); font-size: 11px; line-height: 1.2; }
	    .cover-example-brief em { color: var(--ink); font-style: normal; font-size: 12px; line-height: 1.35; font-weight: 850; overflow-wrap: anywhere; }
	    .cover-decision-grid { display: grid; grid-template-columns: minmax(560px, 1.1fr) minmax(360px, .72fr); gap: 14px; margin-bottom: 14px; align-items: stretch; }
	    .cover-decision-preview { position: relative; min-height: 330px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(20,24,23,.14); background: radial-gradient(circle at 82% 28%, rgba(196,91,58,.26), transparent 32%), linear-gradient(135deg, #f6ead8, #e6eee7 58%, #fffdf7); box-shadow: inset 0 0 0 1px rgba(255,255,255,.48), 0 18px 42px rgba(20,24,23,.12); }
	    .cover-decision-preview::before { content: ""; position: absolute; inset: 18px; border: 1px solid rgba(20,24,23,.12); border-radius: 8px; pointer-events: none; }
	    .cover-left-hook { position: absolute; left: 34px; top: 42px; width: 30%; display: grid; gap: 12px; z-index: 2; }
	    .cover-left-hook strong { font-size: 38px; line-height: 1.02; letter-spacing: 0; color: #131817; text-shadow: 0 2px 0 rgba(255,253,247,.72); }
	    .cover-left-hook span { max-width: 220px; color: rgba(19,25,24,.68); font-size: 13px; line-height: 1.4; font-weight: 900; }
	    .cover-failed-draft { position: absolute; left: 33%; top: 78px; width: 19%; min-height: 150px; display: grid; align-content: center; justify-items: center; gap: 8px; padding: 14px; border-radius: 12px; background: rgba(255,253,247,.6); border: 1px dashed rgba(20,24,23,.24); transform: rotate(-3deg); box-shadow: 0 16px 30px rgba(20,24,23,.1); }
	    .cover-failed-draft i { width: 58px; height: 40px; border-radius: 9px; background: rgba(20,24,23,.14); position: relative; }
	    .cover-failed-draft i::before, .cover-failed-draft i::after { content: ""; position: absolute; left: 8px; right: 8px; height: 5px; border-radius: 6px; background: rgba(20,24,23,.28); }
	    .cover-failed-draft i::before { top: 10px; }.cover-failed-draft i::after { top: 24px; width: 30px; right: auto; }
	    .cover-failed-draft b { font-size: 15px; color: #6a4d3d; }
	    .cover-failed-draft span { text-align: center; color: rgba(19,25,24,.62); font-size: 11px; line-height: 1.35; font-weight: 850; }
	    .cover-transform-arrow { position: absolute; left: 53%; top: 132px; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: #141817; color: #fffdf7; font-size: 30px; font-weight: 950; box-shadow: 0 16px 28px rgba(20,24,23,.2); z-index: 3; }
	    .cover-proof-board { position: absolute; right: 34px; top: 52px; bottom: 70px; width: 33%; display: grid; align-content: center; gap: 10px; padding: 20px; border-radius: 14px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.14); box-shadow: 0 22px 44px rgba(20,24,23,.14); }
	    .cover-proof-board b { font-size: 24px; line-height: 1.08; color: #141817; }
	    .cover-proof-board span { color: #315f7d; font-size: 13px; line-height: 1.35; font-weight: 950; }
	    .cover-proof-board em { color: rgba(19,25,24,.68); font-style: normal; font-size: 12px; line-height: 1.4; font-weight: 800; }
	    .cover-method-beads { position: absolute; left: 34px; right: 34px; bottom: 26px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 7px; z-index: 2; }
	    .cover-method-beads span { min-width: 0; border-radius: 999px; padding: 8px 6px; text-align: center; background: rgba(255,253,247,.82); border: 1px solid rgba(20,24,23,.12); color: #26302d; font-size: 11px; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .cover-strategy-panel { display: grid; gap: 10px; min-width: 0; }
	    .cover-strategy-card, .cover-strategy-list span, .cover-platform-strategy span, .cover-hierarchy-list span, .cover-qa-list span { border: 1px solid var(--line); border-radius: 8px; background: rgba(255,253,247,.82); }
	    .cover-strategy-card { display: grid; gap: 7px; padding: 13px; }
	    .cover-strategy-card small { color: var(--accent); font-weight: 950; }
	    .cover-strategy-card strong { font-size: 18px; line-height: 1.2; color: var(--ink); }
	    .cover-strategy-card span { color: var(--muted); font-size: 12px; line-height: 1.45; font-weight: 780; }
	    .cover-strategy-list, .cover-platform-strategy { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
	    .cover-platform-strategy { grid-template-columns: 1fr; }
	    .cover-strategy-list span, .cover-platform-strategy span { display: grid; gap: 4px; padding: 10px; min-width: 0; }
	    .cover-strategy-list b, .cover-platform-strategy b { font-size: 12px; line-height: 1.2; color: var(--ink); }
	    .cover-strategy-list em, .cover-platform-strategy em { color: var(--muted); font-style: normal; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
	    .cover-hierarchy-list, .cover-qa-list { display: flex; flex-wrap: wrap; gap: 6px; }
	    .cover-hierarchy-list span, .cover-qa-list span { padding: 7px 9px; color: rgba(19,25,24,.72); font-size: 11px; line-height: 1.25; font-weight: 850; }
	    .cover-qa-list span::before { content: "✓"; color: #4f735f; margin-right: 4px; }
	    .cover-resolution-carousel { display: grid; gap: 10px; margin-bottom: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: rgba(255,253,247,.72); }
	    .cover-resolution-summary { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline; padding: 10px 12px; border: 1px solid rgba(49,95,125,.16); border-radius: 8px; background: rgba(255,255,255,.58); min-width: 0; }
	    .cover-resolution-summary span { flex: 0 0 auto; color: #fffdf7; background: var(--accent); border-radius: 999px; padding: 5px 9px; font-size: 11px; font-weight: 950; white-space: nowrap; }
	    .cover-resolution-summary strong { flex: 1 1 180px; min-width: 120px; color: var(--ink); font-size: 15px; line-height: 1.2; overflow-wrap: anywhere; }
	    .cover-resolution-summary em { flex: 1 1 180px; min-width: 120px; color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; text-align: right; overflow-wrap: anywhere; }
	    .cover-carousel-stage { position: relative; min-height: 410px; display: grid; place-items: center; border-radius: 9px; overflow: hidden; background: linear-gradient(135deg, #ebe6db, #f8f4ea); border: 1px solid rgba(20,24,23,.1); }
	    .cover-carousel-stage::before { content: ""; position: absolute; inset: 18px; border: 1px solid rgba(255,255,255,.54); border-radius: 8px; pointer-events: none; z-index: 1; }
	    .cover-carousel-image-button { width: 100%; min-height: 410px; display: grid; place-items: center; border: 0; padding: 0; background: transparent; cursor: zoom-in; }
	    .cover-carousel-image-button img { display: block; max-width: 100%; max-height: 460px; width: auto; height: auto; object-fit: contain; background: #e6e0d3; }
	    .cover-carousel-placeholder { display: grid; place-items: center; width: min(760px, 86%); aspect-ratio: 16 / 9; border-radius: 9px; border: 1px dashed rgba(49,95,125,.3); background: rgba(255,255,255,.52); color: var(--muted); font-weight: 900; }
	    .cover-carousel-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(20,24,23,.12); background: rgba(255,253,247,.92); color: var(--ink); font-size: 30px; font-weight: 800; line-height: 1; cursor: pointer; box-shadow: 0 12px 24px rgba(20,24,23,.12); }
	    .cover-carousel-nav.prev { left: 14px; }
	    .cover-carousel-nav.next { right: 14px; }
	    .cover-carousel-meta { display: grid; grid-template-columns: auto minmax(0, .7fr) minmax(0, 1.3fr); gap: 10px; align-items: center; }
	    .cover-carousel-meta small { color: var(--accent); font-weight: 950; }
	    .cover-carousel-meta strong { font-size: 15px; line-height: 1.2; color: var(--ink); overflow-wrap: anywhere; }
	    .cover-carousel-meta span { color: var(--muted); font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
	    .cover-carousel-stage.final-cover-stage { min-height: 520px; }
	    .cover-sample-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
	    .cover-sample-card { display: grid; grid-template-rows: minmax(116px, auto) auto; gap: 0; padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); overflow: hidden; cursor: zoom-in; color: var(--ink); text-align: left; min-width: 0; }
	    .cover-sample-card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #e4e0d6; border-bottom: 1px solid rgba(20,24,23,.1); }
	    .cover-sample-card span { display: grid; gap: 3px; padding: 10px; min-width: 0; }
	    .cover-sample-card strong { font-size: 13px; line-height: 1.2; overflow-wrap: anywhere; }
	    .cover-sample-card em { color: var(--muted); font-size: 11px; font-style: normal; line-height: 1.3; overflow-wrap: anywhere; }
	    .cover-sample-empty { margin-bottom: 12px; padding: 14px; border-radius: 8px; border: 1px dashed rgba(49,95,125,.3); background: rgba(255,255,255,.52); color: var(--muted); line-height: 1.5; }
	    .cover-preview-dialog { width: min(1080px, calc(100vw - 40px)); border: 1px solid rgba(20,24,23,.18); border-radius: 8px; padding: 0; background: var(--surface-strong); box-shadow: 0 26px 90px rgba(20,24,23,.28); }
	    .cover-preview-dialog::backdrop { background: rgba(20,24,23,.52); backdrop-filter: blur(4px); }
	    .cover-preview-dialog form { position: absolute; right: 12px; top: 12px; z-index: 4; margin: 0; }
	    .cover-preview-dialog form button { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--line); background: rgba(255,255,255,.88); color: var(--ink); font-size: 22px; line-height: 1; cursor: pointer; }
	    .cover-preview-dialog-body { display: grid; grid-template-columns: minmax(560px, 1fr) minmax(240px, .42fr); gap: 18px; padding: 22px; align-items: center; }
	    .cover-preview-dialog figure { margin: 0; display: grid; place-items: center; min-height: 420px; border-radius: 8px; border: 1px solid var(--line); background: #ece7dc; overflow: hidden; }
	    .cover-preview-dialog img { display: block; max-width: 100%; max-height: 72vh; object-fit: contain; }
	    .cover-preview-dialog small { color: var(--accent); font-weight: 900; overflow-wrap: anywhere; }
	    .cover-preview-dialog h3 { margin: 8px 0 0; font-size: 26px; line-height: 1.15; }
	    .cover-auto-card { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; align-items: center; padding: 14px; border-radius: 8px; background: var(--surface-strong); border: 1px solid var(--line); cursor: pointer; min-width: 0; }
	    .cover-auto-card input { width: 18px; height: 18px; }
	    .cover-auto-card b, .cover-auto-card em { display: block; }
	    .cover-auto-card em { color: var(--muted); font-style: normal; line-height: 1.45; margin-top: 5px; }
	    .cover-style-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	    .cover-style-card { display: grid; grid-template-columns: 18px 172px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); cursor: pointer; min-width: 0; }
	    .cover-style-card input { width: 16px; height: 16px; }
	    .cover-style-card span { min-width: 0; display: grid; gap: 4px; }
	    .cover-style-card strong { font-size: 14px; line-height: 1.2; }
	    .cover-style-card em { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; }
	    .cover-style-card small { color: rgba(19,25,24,.68); font-size: 11px; line-height: 1.32; font-weight: 760; overflow-wrap: anywhere; }
	    .cover-style-card i { color: var(--accent); font-style: normal; font-size: 10px; line-height: 1.25; font-weight: 950; overflow-wrap: anywhere; }
	    .cover-mini-preview { position: relative; width: 92px; height: 58px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, #fbf7ed, #dfe8e2); border: 1px solid rgba(20,24,23,.1); }
	    .cover-review-aside .cover-style-list { grid-template-columns: 1fr; }
	    .cover-review-aside .cover-style-card { grid-template-columns: 18px 88px minmax(0, 1fr); }
	    .cover-review-aside .cover-mini-preview { width: 88px; height: 56px; }
	    .cover-mini-preview i, .cover-mini-preview b, .cover-mini-preview span, .cover-mini-preview em { position: absolute; display: block; }
	    .cover-mini-preview .cover-bg { inset: 0; background: radial-gradient(circle at 76% 32%, var(--cover-accent), transparent 28%), linear-gradient(135deg, rgba(255,255,255,.72), rgba(255,255,255,0)); opacity: .72; }
	    .cover-mini-preview b { left: 8px; top: 9px; width: 50px; height: 8px; border-radius: 8px; background: var(--ink); }
	    .cover-mini-preview span { left: 8px; top: 24px; width: 38px; height: 6px; border-radius: 8px; background: var(--cover-accent); }
	    .cover-mini-preview em { right: 8px; bottom: 8px; width: 28px; height: 22px; border-radius: 7px; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.1); }
	    .cover-template-preview { position: relative; width: 172px; height: 108px; border-radius: 8px; overflow: hidden; background: radial-gradient(circle at 78% 28%, color-mix(in srgb, var(--cover-accent) 38%, transparent), transparent 28%), linear-gradient(135deg, #fff7e8, #e5eee8); border: 1px solid rgba(20,24,23,.11); box-shadow: inset 0 0 0 1px rgba(255,255,255,.52); }
	    .cover-template-hook { position: absolute; left: 10px; top: 9px; width: 70px; color: #141817; font-weight: 950; font-size: 15px; line-height: 1.05; }
	    .cover-template-sub { position: absolute; left: 10px; top: 48px; width: 72px; color: rgba(20,24,23,.68); font-weight: 900; font-size: 9px; line-height: 1.25; }
	    .cover-template-board { position: absolute; right: 9px; top: 14px; width: 70px; height: 66px; display: grid; align-content: center; gap: 3px; padding: 7px; border-radius: 8px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.1); box-shadow: 0 10px 20px rgba(20,24,23,.1); }
	    .cover-template-board i { width: 22px; height: 16px; border-radius: 4px; background: var(--cover-accent); opacity: .9; }
	    .cover-template-board b { font-size: 9px; line-height: 1.1; color: #141817; }
	    .cover-template-board span { font-size: 7px; line-height: 1.15; color: rgba(20,24,23,.62); }
	    .cover-template-proof { position: absolute; left: 80px; bottom: 23px; width: 40px; height: 24px; border-radius: 6px; background: rgba(20,24,23,.88); color: #fffdf7; display: grid; place-items: center; transform: rotate(-4deg); }
	    .cover-template-proof span { position: absolute; width: 18px; height: 3px; border-radius: 99px; background: var(--cover-accent); top: 7px; }
	    .cover-template-proof strong { font-size: 7px; margin-top: 8px; }
	    .cover-template-steps { position: absolute; left: 8px; right: 8px; bottom: 7px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; }
	    .cover-template-steps em { min-width: 0; border-radius: 999px; background: rgba(255,253,247,.8); border: 1px solid rgba(20,24,23,.08); color: rgba(20,24,23,.72); font-style: normal; font-size: 7px; line-height: 1; font-weight: 900; padding: 4px 2px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    #cover .cover-decision-preview *, #cover .cover-template-preview * { animation: none !important; transition: none !important; }
	    .cover-resolution-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
	    .cover-resolution-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: start; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255,253,247,.82); cursor: pointer; min-width: 0; }
	    .cover-resolution-row input { width: 16px; height: 16px; margin-top: 2px; }
	    .cover-resolution-row span { min-width: 0; display: grid; gap: 3px; }
	    .cover-resolution-row strong { font-size: 13px; line-height: 1.2; }
	    .cover-resolution-row em { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
	    .cover-artifact-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
	    .cover-artifact-list span { padding: 8px 9px; border-radius: 7px; background: rgba(255,255,255,.62); border: 1px solid rgba(20,24,23,.08); color: var(--muted); font-size: 12px; font-weight: 850; }
	    .cover-review-board { display: grid; grid-template-columns: minmax(620px, 1fr) minmax(320px, 380px); gap: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: linear-gradient(135deg, rgba(255,253,247,.86), rgba(236,241,237,.74)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.42); }
	    .cover-review-board-simple { align-items: stretch; }
	    .cover-review-main, .cover-review-aside { min-width: 0; }
	    .cover-review-main { display: grid; gap: 10px; }
	    .cover-review-titlebar { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 5px 10px; align-items: center; padding: 10px 12px; border: 1px solid rgba(20,24,23,.08); border-radius: 8px; background: rgba(255,253,247,.78); }
	    .cover-review-titlebar span { border-radius: 999px; padding: 5px 8px; color: #fffdf7; background: #9a673f; font-size: 11px; font-weight: 950; white-space: nowrap; }
	    .cover-review-titlebar span.ready { background: #2f6848; }
	    .cover-review-titlebar strong { font-size: 17px; line-height: 1.2; color: var(--ink); overflow-wrap: anywhere; }
	    .cover-review-titlebar em { grid-column: 1 / -1; color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.4; }
	    .cover-review-board .cover-resolution-carousel { margin: 0; padding: 0; border: 0; background: transparent; }
	    .cover-review-board-simple .cover-resolution-carousel { height: 100%; grid-template-rows: auto minmax(0, 1fr) auto; }
	    .cover-review-board-simple .cover-resolution-summary { grid-template-columns: auto minmax(180px, 1fr); }
	    .cover-review-board-simple .cover-resolution-summary em { grid-column: 1 / -1; text-align: left; }
	    .cover-review-board .cover-carousel-stage { min-height: 520px; background: #111512; border-color: rgba(20,24,23,.16); }
	    .cover-review-board .cover-carousel-stage::before { border-color: rgba(255,253,247,.2); }
	    .cover-review-board .cover-carousel-image-button { min-height: 520px; background: radial-gradient(circle at 70% 32%, rgba(255,202,58,.1), transparent 32%), linear-gradient(135deg, #111512, #24201a); }
	    .cover-review-board .cover-carousel-image-button img { max-height: 560px; max-width: 94%; border-radius: 8px; background: #111512; box-shadow: 0 18px 48px rgba(0,0,0,.28); }
	    .cover-review-board .cover-carousel-meta { grid-template-columns: auto minmax(0, .82fr) minmax(0, 1.18fr); padding: 0 2px; }
	    .cover-review-aside { display: grid; gap: 10px; align-content: start; }
	    .cover-options-panel { grid-template-rows: auto auto minmax(0, 1fr); height: 100%; }
	    .cover-options-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 38px; padding: 0 2px; }
	    .cover-options-head span { color: var(--accent); font-size: 13px; font-weight: 950; }
	    .cover-options-head strong { color: var(--ink); font-size: 14px; line-height: 1.2; }
	    .cover-default-option { border-color: rgba(49,95,125,.36); background: rgba(238,246,244,.82); }
	    .cover-options-panel .cover-ratio-compact { display: grid; grid-template-rows: auto minmax(0, 1fr); }
	    .cover-options-panel .cover-ratio-chip-grid { max-height: none; overflow: visible; padding-right: 0; align-content: start; }
	    .cover-template-switcher, .cover-ratio-compact, .cover-final-note { border: 1px solid var(--line); border-radius: 8px; background: rgba(255,253,247,.82); padding: 11px; }
	    .cover-aside-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
	    .cover-aside-head span { color: var(--accent); font-size: 12px; font-weight: 950; }
	    .cover-aside-head strong { color: var(--ink); font-size: 14px; line-height: 1.2; text-align: right; }
	    .cover-template-showcase { min-height: 140px; }
	    .cover-template-slide { display: grid; grid-template-columns: 172px minmax(0, 1fr); gap: 10px; align-items: center; }
	    .cover-template-slide[hidden] { display: none; }
	    .cover-template-slide > span { display: grid; gap: 5px; min-width: 0; }
	    .cover-template-slide b { font-size: 15px; line-height: 1.18; }
	    .cover-template-slide em, .cover-template-slide small { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
	    .cover-template-tabs { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
	    .cover-template-tabs button { border: 1px solid rgba(49,95,125,.18); border-radius: 999px; padding: 6px 9px; background: rgba(255,255,255,.62); color: var(--muted); font-size: 12px; font-weight: 900; cursor: pointer; }
	    .cover-template-tabs button.active { color: #fffdf7; background: var(--ink); border-color: var(--ink); }
	    .cover-ratio-chip-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; max-height: 208px; overflow: auto; padding-right: 3px; }
	    .cover-ratio-chip { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 7px; align-items: start; padding: 8px; border: 1px solid rgba(20,24,23,.1); border-radius: 8px; background: rgba(255,255,255,.58); cursor: pointer; min-width: 0; }
	    .cover-ratio-chip input { width: 15px; height: 15px; margin-top: 1px; }
	    .cover-ratio-chip span { display: grid; gap: 2px; min-width: 0; }
	    .cover-ratio-chip b { font-size: 12px; line-height: 1.15; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .cover-ratio-chip em { color: var(--muted); font-style: normal; font-size: 11px; line-height: 1.2; overflow-wrap: anywhere; }
	    .cover-ratio-chip.selected { border-color: rgba(49,95,125,.42); box-shadow: inset 0 0 0 1px rgba(49,95,125,.08); }
	    .cover-ratio-chip.active { background: rgba(231,242,241,.92); border-color: rgba(49,95,125,.66); box-shadow: inset 0 0 0 1px rgba(49,95,125,.14), 0 8px 18px rgba(20,24,23,.08); }
	    .cover-options-panel .cover-ratio-chip b { overflow: visible; text-overflow: clip; white-space: normal; }
	    .cover-final-note { display: grid; gap: 5px; }
	    .cover-final-note b { font-size: 14px; color: var(--ink); }
	    .cover-final-note span, .cover-final-note small { color: var(--muted); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
	    .cover-final-note.warning b { color: #9a673f; }
	    .cover-final-note.ready b { color: #2f6848; }
	    .ip-composite-preview { position: relative; min-height: 300px; border-radius: 8px; background: #f7f4eb; border: 1px solid var(--line); overflow: hidden; }
    .ip-source-head { position: relative; z-index: 2; padding: 14px 16px; display: flex; justify-content: space-between; gap: 12px; align-items: baseline; border-bottom: 1px solid rgba(20,24,23,.1); background: rgba(255,253,247,.78); }
    .ip-source-head strong { font-size: 15px; }
    .ip-source-head span { color: var(--muted); font-size: 12px; }
    .ip-asset-grid { position: relative; z-index: 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px; }
    .ip-asset-card { margin: 0; min-width: 0; border-radius: 8px; background: #fffdf7; border: 1px solid rgba(20,24,23,.1); overflow: hidden; box-shadow: 0 12px 24px rgba(20,24,23,.08); }
    .ip-asset-card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #ece7dd; }
    .ip-asset-card figcaption { padding: 8px 9px; font-size: 12px; font-weight: 900; color: var(--ink); }
	    .ip-source-card { display: grid; gap: 6px; padding: 14px; border-radius: 8px; background: var(--surface-strong); border: 1px solid var(--line); }
	    .ip-source-card a { color: var(--accent); text-decoration: none; font-weight: 900; }
	    .ip-source-card span { color: var(--muted); font-size: 13px; }
	    .motion-detail-grid .ip-mode-list { align-self: stretch; display: grid; align-content: start; gap: 10px; }
	    .motion-detail-grid .ip-gallery { min-height: 650px; height: 100%; }
	    .motion-detail-grid .ip-gallery-frame { min-height: 430px; }
	    .motion-detail-grid .ip-gallery-details { min-height: 150px; }
	    .ip-asset-registry-card { display: grid; gap: 8px; padding: 12px; border-radius: 8px; background: #fffdf7; border: 1px solid rgba(49,95,125,.22); box-shadow: inset 0 0 0 1px rgba(255,255,255,.44); }
	    .ip-asset-registry-card.selected, .ip-asset-registry-card.has-upload-selection { border-color: rgba(49,95,125,.52); box-shadow: inset 0 0 0 1px rgba(49,95,125,.22), 0 10px 24px rgba(49,95,125,.08); }
	    .ip-asset-registry-head { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
	    .ip-asset-registry-head span { display: grid; gap: 4px; }
	    .ip-asset-registry-head b { font-size: 15px; }
	    .ip-asset-registry-head em { color: var(--accent); font-style: normal; font-size: 12px; font-weight: 900; }
	    .ip-asset-registry-head strong { flex: 0 0 auto; padding: 6px 8px; border-radius: 7px; background: rgba(49,95,125,.1); color: var(--accent); font-size: 12px; }
	    .ip-asset-registry-card p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
	    .ip-asset-library { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 6px 8px; padding: 8px 10px; border-radius: 8px; background: rgba(237,242,239,.62); border: 1px dashed rgba(49,95,125,.24); }
	    .ip-asset-library summary { grid-column: 1 / -1; cursor: pointer; color: var(--accent); font-size: 12px; font-weight: 900; }
	    .ip-asset-library:not([open]) { display: block; }
	    .ip-asset-library span { color: var(--muted); font-size: 12px; font-weight: 900; }
	    .ip-asset-library code { min-width: 0; color: var(--ink); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	    .ip-onboarding-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
	    .ip-upload-drop, .ip-manifest-input { display: grid; gap: 6px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,.72); border: 1px solid rgba(20,24,23,.1); }
	    .ip-upload-drop { cursor: pointer; }
	    .ip-upload-drop input { width: 100%; }
	    .ip-upload-drop span, .ip-manifest-input span { color: var(--ink); font-size: 13px; font-weight: 900; }
	    .ip-upload-drop em { color: var(--muted); font-style: normal; font-size: 11px; line-height: 1.35; }
	    .ip-manifest-input input { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 9px; background: #fff; color: var(--ink); font-size: 12px; }
	    .ip-onboarding-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: center; }
	    .ip-onboarding-actions button { border: 1px solid rgba(49,95,125,.28); border-radius: 7px; padding: 9px 10px; background: rgba(49,95,125,.08); color: var(--accent); font-weight: 900; cursor: pointer; }
	    .ip-onboarding-actions small { grid-column: 1 / -1; color: var(--muted); font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; max-height: 34px; overflow: hidden; }
	    .ip-gallery { position: relative; min-height: 420px; border-radius: 8px; background: #f7f4eb; border: 1px solid var(--line); overflow: hidden; display: grid; grid-template-rows: auto minmax(260px, 1fr) auto; }
    .ip-gallery-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 15px; background: rgba(255,253,247,.84); border-bottom: 1px solid rgba(20,24,23,.1); }
    .ip-gallery-head strong { font-size: 16px; }
    .ip-gallery-head span { color: var(--muted); font-weight: 900; font-size: 12px; }
    .ip-gallery-frame { position: relative; min-height: 270px; background: #ede8dd; }
    .ip-gallery-slide { position: absolute; inset: 0; margin: 0; display: grid; place-items: center; }
    .ip-gallery-slide[hidden] { display: none; }
    .ip-gallery-slide img { display: block; width: 100%; height: 100%; object-fit: contain; padding: 12px; }
    .ip-gallery-slide figcaption { position: absolute; left: 14px; top: 14px; padding: 7px 9px; border-radius: 7px; background: rgba(255,253,247,.88); border: 1px solid rgba(20,24,23,.12); font-size: 12px; font-weight: 900; color: var(--ink); }
    .ip-gallery-controls { position: absolute; left: 14px; right: 14px; top: 48%; display: flex; justify-content: space-between; pointer-events: none; }
    .ip-gallery-controls button { pointer-events: auto; width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(20,24,23,.16); background: rgba(255,253,247,.9); color: var(--ink); font-size: 24px; line-height: 1; cursor: pointer; box-shadow: 0 8px 18px rgba(20,24,23,.12); }
    .ip-gallery-details { min-height: 124px; padding: 14px 16px; background: rgba(255,253,247,.9); border-top: 1px solid rgba(20,24,23,.1); }
    .ip-gallery-details article[hidden] { display: none; }
    .ip-gallery-details small { color: var(--accent); font-size: 12px; font-weight: 900; }
    .ip-gallery-details h3 { margin: 6px 0 7px; font-size: 19px; line-height: 1.2; }
    .ip-gallery-details p { margin: 0; color: var(--muted); line-height: 1.6; }
    .ip-identity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .ip-identity-card { display: grid; grid-template-columns: 18px 58px minmax(0, 1fr); gap: 9px; align-items: center; min-width: 0; padding: 10px; border-radius: 8px; background: var(--surface-strong); border: 1px solid var(--line); cursor: pointer; }
    .ip-identity-card input { width: 16px; height: 16px; }
    .ip-identity-card span:not(.ip-avatar) { display: grid; gap: 3px; min-width: 0; }
    .ip-identity-card strong { font-size: 14px; line-height: 1.2; }
    .ip-identity-card small, .ip-identity-card em { color: var(--muted); font-style: normal; font-size: 11px; line-height: 1.3; }
    .ip-avatar { position: relative; display: block; width: 58px; height: 64px; border-radius: 8px; background: linear-gradient(145deg, #fffdf7, #e9eee9); border: 1px solid rgba(20,24,23,.1); overflow: hidden; }
    .ip-avatar i, .ip-avatar em, .ip-avatar b { position: absolute; display: block; }
    .ip-avatar-head { left: 19px; top: 8px; width: 21px; height: 21px; border-radius: 50%; background: var(--ip-accent); }
    .ip-avatar-body { left: 14px; top: 34px; width: 30px; height: 28px; border-radius: 16px 16px 4px 4px; background: var(--ip-tone); }
    .ip-avatar-gesture { left: 36px; top: 35px; width: 18px; height: 5px; border-radius: 5px; background: var(--ip-accent); transform: rotate(-22deg); }
    .ip-avatar b { left: 8px; right: 8px; bottom: 5px; height: 3px; border-radius: 4px; background: rgba(20,24,23,.18); }
    .ip-count-policy { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px; border-radius: 8px; background: rgba(237,242,239,.76); border: 1px solid var(--line); }
    .ip-count-policy b, .ip-count-policy em { grid-column: 1 / -1; }
    .ip-count-policy span { padding: 8px; border-radius: 7px; background: rgba(255,253,247,.86); border: 1px solid rgba(20,24,23,.08); color: var(--ink); font-size: 12px; font-weight: 900; text-align: center; }
    .ip-count-policy em { color: var(--muted); font-style: normal; line-height: 1.45; font-size: 12px; }
	    .ip-script-match-list { grid-column: 1 / -1; display: grid; gap: 6px; }
	    .ip-script-match-list span { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 6px; align-items: center; padding: 6px 8px; text-align: left; }
	    .ip-script-match-list span b { grid-column: auto; color: var(--accent); font-size: 11px; }
	    .ip-script-match-list span em { grid-column: auto; margin: 0; color: var(--muted); font-size: 11px; font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .presenter-figure { position: absolute; left: 34px; bottom: 46px; width: 120px; height: 178px; }
    .presenter-figure .head { position: absolute; left: 35px; top: 0; width: 52px; height: 52px; border-radius: 50%; background: var(--accent-2); }
    .presenter-figure .body { position: absolute; left: 12px; top: 62px; width: 96px; height: 92px; border-radius: 50% 50% 8px 8px; background: #28353a; }
    .presenter-figure span { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-weight: 900; color: var(--ink); }
    .knowledge-card { position: absolute; right: 42px; top: 42px; width: 210px; min-height: 128px; padding: 18px; border-radius: 8px; background: #fffdf7; border: 1px solid var(--line); box-shadow: 0 18px 40px rgba(20,24,23,.12); }
    .knowledge-card b { display: block; margin-bottom: 14px; font-size: 20px; }
    .knowledge-card i { display: block; height: 9px; border-radius: 7px; background: #d8d0c3; margin: 9px 0; }
    .knowledge-card i:nth-child(3) { width: 72%; background: #bfcac5; }
    .knowledge-card i:nth-child(4) { width: 58%; background: #d9b98f; }
    .sketch-arrow, .sketch-circle, .sketch-underline { fill: none; stroke: var(--green); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 360; stroke-dashoffset: 360; animation: sketchDraw 3.4s infinite both; }
    .sketch-circle { stroke: var(--accent-2); animation-delay: .35s; }
    .sketch-underline { stroke: var(--accent); animation-delay: .7s; }
    .agent-strip { position: absolute; left: 184px; right: 42px; bottom: 48px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .agent-strip i { display: grid; place-items: center; min-height: 38px; border-radius: 8px; background: #263238; color: #fff; font-style: normal; font-weight: 900; animation: agentPulse 3.2s infinite both; }
    .agent-strip i:nth-child(2) { animation-delay: .2s; }.agent-strip i:nth-child(3) { animation-delay: .4s; }.agent-strip i:nth-child(4) { animation-delay: .6s; }
    .subtitle-sample { position: absolute; left: 180px; right: 42px; bottom: 12px; padding: 8px 10px; border-radius: 7px; background: rgba(20,24,23,.78); color: #fff; text-align: center; font-size: 13px; font-weight: 850; }
    @keyframes sketchDraw { 0%, 12% { stroke-dashoffset: 360; opacity: .2; } 56%, 86% { stroke-dashoffset: 0; opacity: 1; } 100% { opacity: .25; } }
    @keyframes agentPulse { 0%, 100% { transform: translateY(0); background: #263238; } 42%, 62% { transform: translateY(-6px); background: var(--accent); } }
    .ip-mode-list, .voice-list, .speech-style-list { display: grid; gap: 10px; }
    .ip-mode-row { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; cursor: pointer; align-items: start; }
    .ip-mode-row input { width: 18px; height: 18px; margin-top: 4px; }
    .voice-row, .voice-option-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; cursor: default; }
    .voice-row.selected, .voice-option-card.selected, .voice-tone-chip.selected, .dialect-card.selected, .speech-chip.selected { border-color: rgba(49,95,125,.42); background: #eef5f4; box-shadow: inset 0 0 0 1px rgba(49,95,125,.14); }
    .voice-row > label, .voice-option-card > label { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; align-items: start; cursor: pointer; min-width: 0; }
    .voice-row input, .voice-option-card input { width: 18px; height: 18px; margin-top: 3px; }
    .voice-row strong { display: block; font-size: 16px; margin-bottom: 4px; }
    .voice-row small, .voice-row em { display: block; color: var(--muted); line-height: 1.5; font-style: normal; }
    .voice-tone-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .voice-tone-chip { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); cursor: default; min-width: 0; }
    .voice-tone-chip > label { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: start; cursor: pointer; min-width: 0; }
    .voice-tone-chip input { width: 16px; height: 16px; margin-top: 2px; }
    .voice-tone-chip span { min-width: 0; display: grid; gap: 3px; }
    .voice-tone-chip strong { font-size: 13px; line-height: 1.2; }
    .voice-tone-chip em { color: var(--muted); font-size: 11px; line-height: 1.35; font-style: normal; }
    .voice-play-button { min-height: 34px; border: 1px solid rgba(49,95,125,.28); border-radius: 7px; padding: 0 11px; background: #eef5f4; color: var(--accent); font-size: 12px; font-weight: 900; white-space: nowrap; cursor: pointer; }
    .voice-play-button:hover:not(:disabled) { border-color: rgba(49,95,125,.54); background: #e4f0ee; }
    .voice-play-button.playing { background: var(--accent); color: #fff; border-color: var(--accent); }
    .voice-play-button:disabled, .voice-play-button.disabled { cursor: not-allowed; color: rgba(102,112,107,.72); background: rgba(237,242,239,.58); border-color: rgba(20,24,23,.12); }
    .voice-inline-status { margin: 2px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .voice-inline-player { display: none; }
    .speech-style-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .speech-chip { display: grid; gap: 5px; cursor: pointer; }
    .speech-chip input { width: 16px; height: 16px; }
    .speech-chip strong { font-size: 15px; }
    .speech-chip span { color: var(--muted); font-size: 13px; line-height: 1.45; }
    .module-note { margin: 14px 0 0; color: var(--muted); line-height: 1.65; }
    .whiteboard-layout { display: grid; grid-template-columns: minmax(420px, 1fr) minmax(320px, .8fr); gap: 14px; align-items: stretch; }
    .whiteboard-skill-preview { display: grid; grid-template-rows: auto auto 1fr; gap: 10px; min-height: 430px; padding: 14px; border-radius: 8px; background: #fbfaf4; border: 1px solid var(--line); overflow: hidden; }
    .whiteboard-video-frame { position: relative; border-radius: 8px; overflow: hidden; background: #e9e4d9; border: 1px solid rgba(20,24,23,.12); aspect-ratio: 16 / 9; }
    .whiteboard-video-frame video { display: block; width: 100%; height: 100%; object-fit: cover; background: #e9e4d9; }
    .whiteboard-video-missing { display: grid; place-items: center; width: 100%; height: 100%; min-height: 240px; color: var(--muted); font-weight: 900; }
    .whiteboard-proof-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .whiteboard-proof-strip span { padding: 8px 9px; border-radius: 7px; background: rgba(255,255,255,.66); border: 1px solid rgba(20,24,23,.1); color: var(--muted); font-size: 12px; font-weight: 900; text-align: center; }
    .whiteboard-layer-stack { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .whiteboard-layer-stack article, .whiteboard-source-card { display: grid; gap: 5px; padding: 10px; border-radius: 8px; background: var(--surface-strong); border: 1px solid var(--line); min-width: 0; }
    .whiteboard-layer-stack small { color: var(--accent); font-size: 10px; font-weight: 900; line-height: 1.25; overflow-wrap: anywhere; }
    .whiteboard-layer-stack strong { font-size: 13px; line-height: 1.2; }
    .whiteboard-layer-stack em, .whiteboard-source-card span, .whiteboard-source-card em { color: var(--muted); font-style: normal; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
    .whiteboard-source-card b { font-size: 15px; }
    .whiteboard-flow-preview { position: relative; min-height: 340px; border-radius: 8px; background: #fbfaf4; border: 1px solid var(--line); overflow: hidden; }
    .wb-script { position: absolute; left: 16px; top: 16px; width: 118px; padding: 12px; border-radius: 8px; background: #fffdf7; border: 1px solid rgba(20,24,23,.12); box-shadow: 0 12px 26px rgba(20,24,23,.08); animation: wbScript 5.2s infinite both; }
    .wb-script b { display: block; margin-bottom: 8px; }
    .wb-script i { display: block; height: 7px; border-radius: 8px; margin: 7px 0; background: #d8d0c3; }
    .wb-script i:nth-child(3) { width: 76%; background: #bfcac5; }
    .wb-script i:nth-child(4) { width: 58%; background: #d9b98f; }
    .wb-canvas { position: absolute; left: 150px; right: 18px; top: 18px; bottom: 54px; border-radius: 8px; background: #fffdf8; border: 1px solid rgba(20,24,23,.11); box-shadow: inset 0 0 0 1px rgba(255,255,255,.54); overflow: hidden; animation: wbCanvas 5.2s infinite both; }
    .wb-frame-title { position: absolute; left: 24px; top: 20px; font-size: 23px; font-weight: 950; color: var(--ink); opacity: 0; animation: wbReveal 5.2s .55s infinite both; }
    .wb-card { position: absolute; display: grid; place-items: center; min-width: 86px; min-height: 48px; border-radius: 8px; background: #fffdf7; border: 1px solid rgba(20,24,23,.12); box-shadow: 0 10px 24px rgba(20,24,23,.08); font-weight: 950; opacity: 0; animation: wbReveal 5.2s .9s infinite both; }
    .wb-card.wb-a { left: 42px; top: 118px; }
    .wb-card.wb-b { left: 214px; top: 86px; animation-delay: 1.12s; }
    .wb-card.wb-c { right: 46px; bottom: 76px; animation-delay: 1.34s; }
    .wb-canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .wb-line, .wb-circle { fill: none; stroke: var(--accent); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 520; stroke-dashoffset: 520; animation: wbDraw 5.2s infinite both; }
    .wb-line-1 { animation-delay: 1.45s; }
    .wb-line-2 { stroke: var(--green); animation-delay: 1.9s; }
    .wb-circle { stroke: var(--accent-2); animation-delay: 2.35s; }
    .wb-pen { position: absolute; width: 16px; height: 16px; border-radius: 50%; background: var(--accent-2); box-shadow: 0 0 0 6px rgba(154,103,63,.18); animation: wbPen 5.2s infinite both; }
    .wb-caption { position: absolute; left: 50px; right: 50px; bottom: 14px; padding: 8px 10px; border-radius: 7px; background: rgba(20,24,23,.78); color: #fff; text-align: center; font-size: 13px; font-weight: 850; opacity: 0; animation: wbCaption 5.2s infinite both; }
    .wb-flow-steps { position: absolute; left: 16px; right: 16px; bottom: 18px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .wb-flow-steps span { padding: 7px 6px; border-radius: 7px; background: rgba(255,255,255,.64); border: 1px solid rgba(20,24,23,.1); color: var(--muted); text-align: center; font-size: 12px; font-weight: 900; }
    .wb-progress { position: absolute; left: 16px; right: 16px; bottom: 6px; height: 4px; border-radius: 9px; background: rgba(20,24,23,.12); overflow: hidden; }
    .wb-progress i { display: block; width: 100%; height: 100%; background: var(--accent); transform-origin: left; animation: wbProgress 5.2s infinite both; }
    @keyframes wbScript { 0% { opacity: 0; transform: translateX(-12px); } 10%, 90% { opacity: 1; transform: none; } 100% { opacity: 0; } }
    @keyframes wbCanvas { 0%, 8% { opacity: .92; transform: scale(.995); } 18%, 94% { opacity: 1; transform: none; } 100% { opacity: .72; } }
    @keyframes wbReveal { 0%, 18% { opacity: .45; transform: translateY(4px); } 28%, 86% { opacity: 1; transform: none; } 100% { opacity: .6; } }
    @keyframes wbDraw { 0%, 35% { stroke-dashoffset: 520; opacity: .18; } 64%, 86% { stroke-dashoffset: 0; opacity: 1; } 100% { opacity: .25; } }
    @keyframes wbPen { 0%, 35% { left: 70px; top: 154px; opacity: 0; } 44% { left: 210px; top: 96px; opacity: 1; } 58% { left: 390px; top: 134px; opacity: 1; } 72% { left: 430px; top: 82px; opacity: 1; } 86%, 100% { left: 500px; top: 170px; opacity: 0; } }
    @keyframes wbCaption { 0%, 68% { opacity: 0; transform: translateY(10px); } 78%, 94% { opacity: 1; transform: none; } 100% { opacity: 0; } }
    @keyframes wbProgress { 0% { transform: scaleX(0); } 94%, 100% { transform: scaleX(1); } }
    .whiteboard-preview { position: relative; min-height: 300px; border-radius: 8px; background: #fbfaf4; border: 1px solid var(--line); overflow: hidden; }
    .whiteboard-preview svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .whiteboard-title { position: absolute; left: 24px; top: 20px; font-size: 24px; font-weight: 950; color: var(--ink); }
    .whiteboard-card { position: absolute; display: grid; place-items: center; min-width: 92px; min-height: 52px; border-radius: 8px; background: #fffdf7; border: 1px solid rgba(20,24,23,.12); box-shadow: 0 10px 24px rgba(20,24,23,.08); font-weight: 950; }
    .whiteboard-card.card-a { left: 58px; top: 110px; }
    .whiteboard-card.card-b { left: 260px; top: 84px; }
    .whiteboard-card.card-c { right: 70px; bottom: 82px; }
    .board-line, .board-circle { fill: none; stroke: var(--accent); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 520; stroke-dashoffset: 520; animation: sketchDraw 3.4s infinite both; }
    .board-line.line-2 { stroke: var(--green); animation-delay: .32s; }
    .board-circle { stroke: var(--accent-2); animation-delay: .62s; }
    .whiteboard-mode-list { display: grid; gap: 10px; }
    .whiteboard-mode-row { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; padding: 13px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-strong); cursor: pointer; }
    .motion-pane .whiteboard-mode-row { grid-template-columns: 1fr; cursor: default; }
    .whiteboard-mode-row input { width: 18px; height: 18px; margin-top: 2px; }
    .whiteboard-mode-row strong, .whiteboard-mode-row em { display: block; }
    .whiteboard-mode-row em, .whiteboard-mode-list p { color: var(--muted); font-style: normal; line-height: 1.55; }
    .voice-gender-bar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .voice-option-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: var(--surface-strong); font-weight: 900; }
    .dialect-picker { display: grid; gap: 8px; padding: 13px; border-radius: 8px; background: rgba(255,255,255,.58); border: 1px dashed rgba(49,95,125,.28); }
    .dialect-select-row { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; align-items: center; padding: 8px; border: 1px solid rgba(20,24,23,.08); border-radius: 8px; background: rgba(255,253,247,.72); }
    .dialect-select-row span { color: var(--muted); font-size: 12px; font-weight: 900; }
    .dialect-select-row select { width: 100%; border: 1px solid var(--line); border-radius: 7px; padding: 8px 9px; background: #fffdf7; color: var(--ink); font-weight: 850; }
    .dialect-card-list { display: grid; gap: 8px; }
    .dialect-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,253,247,.86); cursor: pointer; }
    .dialect-card.unavailable { opacity: .66; background: rgba(237,242,239,.58); }
    .dialect-card span { display: grid; gap: 3px; min-width: 0; }
    .dialect-card strong { font-size: 14px; line-height: 1.2; }
    .dialect-card small, .dialect-card em, .dialect-card i { color: var(--muted); font-style: normal; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
    .dialect-card.available small { color: var(--accent); font-weight: 900; }
    .speaker-match-table { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
    .speaker-match-table div { display: grid; gap: 5px; padding: 11px; border-radius: 8px; background: rgba(255,255,255,.58); border: 1px solid var(--line); }
    .speaker-match-table strong { font-size: 13px; }
    .speaker-match-table span { color: var(--muted); font-size: 12px; line-height: 1.35; }
    .tds-grid article b { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 22px; }
    .compose-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 16px; padding: 14px; border-radius: 8px; background: rgba(237,242,239,.76); border: 1px solid var(--line); }
    .compose-bar span { color: var(--muted); }
    @media (max-width: 1180px) {
      .cols-3, .motion-grid, .palette-list, .caption-table, .voice-layout, .ip-composite-grid, .whiteboard-layout, .tds-grid, .cover-config-grid, .cover-review-board, .motion-style-summary, .layered-motion-discovery { grid-template-columns: 1fr; }
      .motion-table-grid, .capability-motion-grid, .speaker-match-table, .cover-style-list, .cover-resolution-grid, .cover-sample-grid, .style-review-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	      .cover-example-brief { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .feature-combo-bar { grid-template-columns: repeat(3, minmax(140px, 1fr)); }
      .feature-combo-bar p { grid-column: 1 / -1; }
      .caption-automation-grid, .motion-preview-dialog-body, .cover-preview-dialog-body, .style-review-dialog-body { grid-template-columns: 1fr; }
      .motion-preview-zoom { min-height: 340px; }
      .motion-preview-zoom .motion-preview, .motion-preview-zoom .capability-motion-preview { min-height: 340px; }
      .style-review-zoom, .cover-preview-dialog figure { min-height: 340px; }
      .motion-card { grid-template-columns: 1fr; }
      .palette-row { grid-template-columns: 22px 116px minmax(0, 1fr); }
      .palette-row em { grid-column: 3; }
    }
    @media (max-width: 720px) {
      .shell { width: min(100vw - 24px, 560px); padding-top: 108px; }
      .topbar { height: auto; min-height: 78px; align-items: flex-start; flex-direction: column; padding: 12px; }
      .topbar div { flex-wrap: wrap; }
      .cols-3, .motion-grid, .motion-table-grid, .palette-list, .tds-grid, .caption-table, .speech-style-list, .voice-tone-list, .voice-option-card, .voice-row, .dialect-card, .dialect-select-row, .motion-style-family-grid, .motion-style-scene-strip, .cover-style-list, .cover-resolution-grid, .cover-sample-grid, .style-review-grid { grid-template-columns: 1fr; }
      .caption-planner-preview, .ip-identity-grid, .ip-count-policy { grid-template-columns: 1fr; }
      .caption-row { grid-template-columns: 28px minmax(0, 1fr); }
      .caption-preview { grid-column: 1 / -1; }
      .capability-motion-grid, .speaker-match-table, .ip-asset-grid, .local-material-picker { grid-template-columns: 1fr; }
      .feature-combo-bar { grid-template-columns: 1fr; }
      .motion-table-card { grid-template-columns: 18px 86px minmax(0, 1fr); }
      .motion-preview-open { grid-column: 2 / -1; width: max-content; }
      .motion-gif-cell .motion-preview, .motion-gif-cell .capability-motion-preview { width: 86px; }
      .palette-row { grid-template-columns: 22px minmax(0, 1fr); }
      .palette-row .swatches, .palette-row span, .palette-row em { grid-column: 2; }
      .ip-composite-preview, .ip-gallery { min-height: 360px; }
      .knowledge-card { left: 156px; right: 18px; width: auto; }
      .agent-strip, .subtitle-sample { left: 18px; right: 18px; }
      .wb-script { position: relative; left: auto; top: auto; width: auto; margin: 12px; }
      .wb-canvas { left: 12px; right: 12px; top: 112px; bottom: 64px; }
      .wb-flow-steps { grid-template-columns: repeat(2, 1fr); }
      .whiteboard-proof-strip, .whiteboard-layer-stack { grid-template-columns: 1fr; }
      .whiteboard-skill-preview { min-height: auto; }
      .cover-decision-grid, .style-page-main, .cover-config-grid, .cover-review-board, .cover-strategy-list, .cover-ratio-chip-grid, .cover-template-slide { grid-template-columns: 1fr; }
	      .cover-example-brief, .cover-carousel-meta, .cover-resolution-summary { grid-template-columns: 1fr; }
      .cover-resolution-summary em { text-align: left; }
      .cover-carousel-stage, .cover-carousel-image-button { min-height: 280px; }
      .cover-carousel-image-button img { max-height: 320px; }
      .cover-review-board .cover-carousel-stage, .cover-review-board .cover-carousel-image-button { min-height: 320px; }
      .cover-review-titlebar { grid-template-columns: 1fr; }
      .cover-style-card { grid-template-columns: 18px minmax(0, 1fr); align-items: start; }
      .cover-template-preview, .cover-style-card span { grid-column: 2; }
      .cover-template-preview { width: min(172px, 100%); }
      .cover-decision-preview { min-height: 420px; }
      .cover-left-hook { width: 42%; left: 24px; top: 32px; }
      .cover-left-hook strong { font-size: 30px; }
      .cover-failed-draft { left: 24px; top: 154px; width: 34%; }
      .cover-transform-arrow { left: 44%; top: 192px; }
      .cover-proof-board { left: 52%; right: 22px; top: 112px; bottom: 78px; width: auto; }
      .cover-method-beads { grid-template-columns: repeat(3, 1fr); left: 22px; right: 22px; }
      .style-template-preview { min-height: 420px; }
      .vertical-template-preview.style-template-preview { width: min(310px, 100%); min-height: 0; }
      .vertical-template-preview.large { width: min(360px, 92vw); min-height: 0; }
      .style-page-shell { padding-bottom: 54px; }
      .style-page-support { grid-template-columns: 1fr; }
      .style-frame-steps { grid-template-columns: repeat(2, 1fr); }
      .section-head h2 { font-size: 22px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
    }
  </style>`;
}

function renderScripts() {
  return `<script>
    const paletteButtons = Array.from(document.querySelectorAll('[data-palette-tab]'));
    const paletteRows = Array.from(document.querySelectorAll('.palette-row'));
    const colorAutoToggle = document.querySelector('[data-color-auto-toggle]');
    const selectPaletteRow = (row, userInitiated = false) => {
      if (!row) return;
      paletteRows.forEach((item) => item.classList.toggle('selected', item === row));
      const input = row.querySelector('input[name="color-system"]');
      if (input) input.checked = true;
      if (userInitiated && colorAutoToggle && row.dataset.plannerSelected !== 'true') colorAutoToggle.checked = false;
    };
    const syncPaletteMode = (mode) => {
      paletteButtons.forEach((button) => button.classList.toggle('active', button.dataset.paletteTab === mode));
      paletteRows.forEach((row) => {
        const matches = mode === 'all'
          || (mode === 'no-black' && row.dataset.hasBlack === 'false')
          || row.dataset.paletteMode === mode;
        row.hidden = !matches;
      });
    };
    paletteButtons.forEach((button) => {
      button.addEventListener('click', () => syncPaletteMode(button.dataset.paletteTab || 'multi'));
    });
    paletteRows.forEach((row) => {
      row.addEventListener('click', () => selectPaletteRow(row, true));
      row.querySelector('input[name="color-system"]')?.addEventListener('change', () => selectPaletteRow(row, true));
    });
    colorAutoToggle?.addEventListener('change', () => {
      const plannerRow = paletteRows.find((row) => row.dataset.plannerSelected === 'true');
      if (colorAutoToggle.checked && plannerRow) {
        syncPaletteMode(plannerRow.dataset.paletteMode || 'multi');
        selectPaletteRow(plannerRow, false);
      }
    });
    syncPaletteMode(document.querySelector('[data-palette-tab].active')?.dataset.paletteTab || 'multi');

    const videoTypeInputs = Array.from(document.querySelectorAll('input[name="video-type"]'));
    const syncVideoTypeCards = () => {
      videoTypeInputs.forEach((input) => {
        input.closest('[data-video-type-card]')?.classList.toggle('selected', input.checked);
      });
    };
    videoTypeInputs.forEach((input) => {
      input.addEventListener('change', syncVideoTypeCards);
    });
    syncVideoTypeCards();
    const orientationInputs = Array.from(document.querySelectorAll('input[name="orientation"]'));
    const syncOrientationCards = () => {
      orientationInputs.forEach((input) => {
        input.closest('[data-orientation-card]')?.classList.toggle('selected', input.checked);
      });
    };
    orientationInputs.forEach((input) => {
      input.addEventListener('change', syncOrientationCards);
    });
    syncOrientationCards();

    const buttons = Array.from(document.querySelectorAll('.caption-toolbar [data-group]'));
    const cards = Array.from(document.querySelectorAll('.caption-row'));
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const group = button.dataset.group || '';
        buttons.forEach((item) => item.classList.toggle('active', item === button));
        cards.forEach((card) => {
          card.hidden = Boolean(group) && card.dataset.group !== group;
        });
      });
    });
    const localToggle = document.querySelector('[data-local-material-toggle]');
    const localPanel = document.querySelector('[data-local-material-panel]');
	    if (localToggle && localPanel) {
	      const syncLocalPanel = () => {
	        localPanel.hidden = !localToggle.checked;
	        localToggle.closest('.toggle-card')?.classList.toggle('selected', localToggle.checked);
	      };
	      localToggle.addEventListener('change', syncLocalPanel);
	      syncLocalPanel();
	    }
	    const coverAutoToggle = document.querySelector('[data-cover-auto-toggle]');
	    if (coverAutoToggle) {
	      const syncCoverAuto = () => {
	        coverAutoToggle.closest('[data-cover-auto-card]')?.classList.toggle('selected', coverAutoToggle.checked);
	      };
	      coverAutoToggle.addEventListener('change', syncCoverAuto);
	      syncCoverAuto();
	    }
	    document.querySelectorAll('input[name="cover-style"]').forEach((input) => {
	      input.addEventListener('change', () => {
	        document.querySelectorAll('[data-cover-style-card]').forEach((card) => {
	          const radio = card.querySelector('input[name="cover-style"]');
	          card.classList.toggle('selected', radio?.checked === true);
	        });
	      });
	    });
	    const coverTemplateTabs = Array.from(document.querySelectorAll('[data-cover-template-tab]'));
	    const coverTemplateSlides = Array.from(document.querySelectorAll('[data-cover-template-slide]'));
	    coverTemplateTabs.forEach((button) => {
	      button.addEventListener('click', () => {
	        const target = button.dataset.coverTemplateTab || '0';
	        coverTemplateTabs.forEach((item) => item.classList.toggle('active', item === button));
	        coverTemplateSlides.forEach((slide) => {
	          slide.hidden = slide.dataset.coverTemplateSlide !== target;
	        });
	      });
	    });
	    document.querySelectorAll('input[name="cover-resolution"]').forEach((input) => {
	      const syncCoverResolution = () => {
	        input.closest('.cover-resolution-row, .cover-ratio-chip')?.classList.toggle('selected', input.checked);
	      };
	      input.addEventListener('change', syncCoverResolution);
	      syncCoverResolution();
	    });
	    const coverSlides = Array.from(document.querySelectorAll('[data-cover-slide]'));
	    const coverCarouselImage = document.querySelector('[data-cover-carousel-image]');
	    const coverCarouselOpen = document.querySelector('[data-cover-carousel-open]');
	    const coverCarouselIndex = document.querySelector('[data-cover-carousel-index]');
	    const coverCarouselTitle = document.querySelector('[data-cover-carousel-title]');
	    const coverCarouselMeta = document.querySelector('[data-cover-carousel-meta]');
	    const coverCarousel = document.querySelector('[data-cover-resolution-carousel]');
	    let activeCoverSlideIndex = coverCarousel?.dataset.coverDefaultActive === 'true' ? -1 : 0;
	    const syncCoverCarousel = (nextIndex) => {
	      if (!coverSlides.length) return;
	      activeCoverSlideIndex = (nextIndex + coverSlides.length) % coverSlides.length;
	      const slide = coverSlides[activeCoverSlideIndex];
	      const src = slide.dataset.coverSrc || '';
	      const title = slide.dataset.coverTitle || '封面预览';
	      const meta = slide.dataset.coverMeta || '';
	      coverSlides.forEach((item, index) => item.classList.toggle('active', index === activeCoverSlideIndex));
	      if (coverCarouselImage?.tagName === 'IMG') {
	        coverCarouselImage.setAttribute('src', src);
	        coverCarouselImage.setAttribute('alt', title);
	      }
	      if (coverCarouselOpen) {
	        coverCarouselOpen.dataset.coverSrc = src;
	        coverCarouselOpen.dataset.coverTitle = title;
	        coverCarouselOpen.dataset.coverMeta = meta;
	      }
	      if (coverCarouselIndex) coverCarouselIndex.textContent = (activeCoverSlideIndex + 1) + ' / ' + coverSlides.length;
	      if (coverCarouselTitle) coverCarouselTitle.textContent = title;
	      if (coverCarouselMeta) coverCarouselMeta.textContent = meta;
	    };
	    document.querySelector('[data-cover-carousel-prev]')?.addEventListener('click', () => syncCoverCarousel(activeCoverSlideIndex < 0 ? coverSlides.length - 1 : activeCoverSlideIndex - 1));
	    document.querySelector('[data-cover-carousel-next]')?.addEventListener('click', () => syncCoverCarousel(activeCoverSlideIndex < 0 ? 0 : activeCoverSlideIndex + 1));
	    coverSlides.forEach((slide, index) => slide.addEventListener('click', () => syncCoverCarousel(index)));
	    if (activeCoverSlideIndex >= 0) syncCoverCarousel(activeCoverSlideIndex);
	    const coverModal = document.querySelector('[data-cover-preview-modal]');
	    const coverModalImage = document.querySelector('[data-cover-preview-image]');
	    const coverModalTitle = document.querySelector('[data-cover-preview-title]');
	    const coverModalMeta = document.querySelector('[data-cover-preview-meta]');
	    document.querySelectorAll('[data-cover-open]').forEach((button) => {
	      button.addEventListener('click', () => {
	        if (!coverModal || !coverModalImage) return;
	        coverModalImage.src = button.dataset.coverSrc || '';
	        coverModalImage.alt = button.dataset.coverTitle || '封面预览';
	        if (coverModalTitle) coverModalTitle.textContent = button.dataset.coverTitle || '封面预览';
	        if (coverModalMeta) coverModalMeta.textContent = button.dataset.coverMeta || '';
	        if (typeof coverModal.showModal === 'function') coverModal.showModal();
	        else coverModal.setAttribute('open', '');
	      });
	    });
	    const featureToggles = Array.from(document.querySelectorAll('[data-feature-toggle]'));
    const motionOptionInputs = Array.from(document.querySelectorAll('input[name="motion-template"], input[name="motion-capability"]'));
    const compatibilityStatus = document.querySelector('[data-compatibility-status]');
    const motionPaneTabs = Array.from(document.querySelectorAll('[data-motion-pane-tab]'));
    const motionPanes = Array.from(document.querySelectorAll('[data-motion-pane]'));
    const showMotionPane = (pane) => {
      const target = pane || 'motion';
      motionPaneTabs.forEach((button) => button.classList.toggle('active', button.dataset.motionPaneTab === target));
      motionPanes.forEach((item) => {
        item.hidden = item.dataset.motionPane !== target;
        item.classList.toggle('active', item.dataset.motionPane === target);
      });
    };
    motionPaneTabs.forEach((button) => {
      button.addEventListener('click', () => showMotionPane(button.dataset.motionPaneTab || 'motion'));
    });
    const getFeature = (feature) => featureToggles.some((toggle) => toggle.dataset.featureToggle === feature && toggle.checked);
    const setFeature = (feature, checked) => {
      featureToggles
        .filter((toggle) => toggle.dataset.featureToggle === feature)
        .forEach((toggle) => { toggle.checked = checked; });
    };
    const setOrientation = (orientation) => {
      if (!orientation) return;
      orientationInputs.forEach((input) => {
        input.checked = input.value === orientation;
      });
      syncOrientationCards();
    };
    const syncFeatureVisuals = () => {
      featureToggles.forEach((toggle) => {
        const host = toggle.closest('.feature-toggle, .ip-enable-row, .whiteboard-enable-row');
        host?.classList.toggle('selected', toggle.checked);
      });
      const motionEnabled = getFeature('motion');
      motionOptionInputs.forEach((input) => {
        input.disabled = !motionEnabled;
        input.closest('.motion-table-card')?.classList.toggle('disabled', !motionEnabled);
      });
      if (compatibilityStatus) {
        const ip = getFeature('personal-ip');
        const whiteboard = getFeature('whiteboard');
        const motion = getFeature('motion');
        const dynamicPlanning = getFeature('dynamic-planning');
        const coverDesign = getFeature('cover-design');
        const parts = [];
        if (ip) parts.push('个人 IP');
        if (whiteboard) parts.push('白板绘制');
        if (motion) parts.push('动效');
        if (dynamicPlanning) parts.push('动态规划');
        if (coverDesign) parts.push('封面并行');
        const videoTypeLabel = document.querySelector('[data-video-type-card].selected b')?.textContent || '未选择';
        compatibilityStatus.textContent = parts.length
          ? '主类型：' + videoTypeLabel + '；当前组合：' + parts.join(' + ') + '。主类型互斥，能力可组合；封面可并行。'
          : '主类型：' + videoTypeLabel + '；当前未启用能力，可按视频类型重新组合动效、动态规划、个人 IP、白板和封面并行。';
      }
    };
    const syncFeatureCompatibility = (changedFeature) => {
      syncFeatureVisuals();
      if (changedFeature === 'personal-ip' && getFeature('personal-ip')) showMotionPane('personal-ip');
      if (changedFeature === 'motion' && getFeature('motion')) showMotionPane('motion');
      if (changedFeature === 'whiteboard' && getFeature('whiteboard')) showMotionPane('whiteboard');
    };
    const applyVideoTypePreset = (input) => {
      if (!input?.checked) return;
      const card = input.closest('[data-video-type-card]');
      const capabilities = new Set(String(card?.dataset.videoTypeCapabilities || '').split(/\\s+/).filter(Boolean));
      ['motion', 'dynamic-planning', 'personal-ip', 'whiteboard', 'cover-design'].forEach((feature) => {
        setFeature(feature, capabilities.has(feature));
      });
      setOrientation(card?.dataset.videoTypeOrientation || '');
      syncVideoTypeCards();
      syncFeatureCompatibility('video-type');
      if (capabilities.has('personal-ip')) showMotionPane('personal-ip');
      else if (capabilities.has('whiteboard')) showMotionPane('whiteboard');
      else showMotionPane('motion');
    };
    videoTypeInputs.forEach((input) => {
      input.addEventListener('change', () => applyVideoTypePreset(input));
    });
    applyVideoTypePreset(videoTypeInputs.find((input) => input.checked));
    featureToggles.forEach((toggle) => {
      toggle.addEventListener('change', () => {
        setFeature(toggle.dataset.featureToggle, toggle.checked);
        syncFeatureCompatibility(toggle.dataset.featureToggle);
      });
    });
    syncFeatureCompatibility('');
    if (getFeature('personal-ip')) showMotionPane('personal-ip');
    else showMotionPane('motion');

    motionOptionInputs.forEach((input) => {
      input.addEventListener('change', () => {
        input.closest('.motion-table-card')?.classList.toggle('selected', input.checked);
      });
    });

    const motionModal = document.querySelector('[data-motion-preview-modal]');
    const motionModalFrame = document.querySelector('[data-motion-preview-frame]');
    const motionModalTitle = document.querySelector('[data-motion-preview-title]');
    const motionModalMeta = document.querySelector('[data-motion-preview-meta]');
    const motionModalDescription = document.querySelector('[data-motion-preview-description]');
    document.querySelectorAll('[data-open-motion-preview]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-motion-preview-card]');
        const preview = card?.querySelector('[data-motion-preview-source]')?.firstElementChild;
        if (!motionModal || !motionModalFrame || !preview) return;
        motionModalFrame.replaceChildren(preview.cloneNode(true));
        if (motionModalTitle) motionModalTitle.textContent = button.dataset.previewTitle || '动效预览';
        if (motionModalMeta) motionModalMeta.textContent = button.dataset.previewMeta || '';
        if (motionModalDescription) motionModalDescription.textContent = button.dataset.previewDescription || '';
        if (typeof motionModal.showModal === 'function') motionModal.showModal();
        else motionModal.setAttribute('open', '');
      });
    });

    const styleReviewCards = Array.from(document.querySelectorAll('[data-style-review-card]'));
    const styleFamilyButtons = Array.from(document.querySelectorAll('[data-style-filter-family]'));
    const stylePreviewModal = document.querySelector('[data-style-preview-modal]');
    const stylePreviewFrame = document.querySelector('[data-style-preview-frame]');
    const stylePreviewTitle = document.querySelector('[data-style-preview-title]');
    const stylePreviewMeta = document.querySelector('[data-style-preview-meta]');
    const stylePreviewDescription = document.querySelector('[data-style-preview-description]');
    const stylePreviewSteps = document.querySelector('[data-style-preview-steps]');
    const stylePreviewGuardrails = document.querySelector('[data-style-preview-guardrails]');
    const stylePreviewVideoUse = document.querySelector('[data-style-preview-video-use]');
    const stylePreviewScenario = document.querySelector('[data-style-preview-scenario]');
    const stylePreviewDataSource = document.querySelector('[data-style-preview-data-source]');
    const stylePreviewEffectPlan = document.querySelector('[data-style-preview-effect-plan]');
    const stylePreviewInteraction = document.querySelector('[data-style-preview-interaction]');
    const stylePreviewAnimation = document.querySelector('[data-style-preview-animation]');
    const stylePreviewBenchmark = document.querySelector('[data-style-preview-benchmark]');
    const stylePreviewCapabilities = document.querySelector('[data-style-preview-capabilities]');
    let activeStyleFamily = '';
    const activeStylePanelForCard = (card) => card?.querySelector('[data-style-variant-panel]:not([hidden])') || card?.querySelector('[data-style-variant-panel]');
    const syncStyleCardText = (card) => {
      const panel = activeStylePanelForCard(card);
      const activeButton = card?.querySelector('[data-style-variant-button].active');
      if (!card || !panel) return;
      const variantText = card.querySelector('[data-style-active-variant]');
      const layoutText = card.querySelector('[data-style-active-layout]');
      const roleText = card.querySelector('[data-style-active-role]');
      const methodText = card.querySelector('[data-style-active-method]');
      if (variantText) variantText.textContent = activeButton?.textContent || '';
      if (layoutText) layoutText.textContent = panel.dataset.styleLayout || '';
      if (roleText) roleText.textContent = panel.dataset.styleRole || '';
      if (methodText) methodText.textContent = panel.dataset.styleMethod || '';
    };
    const syncStyleReviewFilters = () => {
      styleFamilyButtons.forEach((button) => button.classList.toggle('active', (button.dataset.styleFilterFamily || '') === activeStyleFamily));
      styleReviewCards.forEach((card) => {
        const familyMatches = !activeStyleFamily || card.dataset.family === activeStyleFamily;
        card.hidden = !familyMatches;
      });
    };
    styleFamilyButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeStyleFamily = button.dataset.styleFilterFamily || '';
        syncStyleReviewFilters();
      });
    });
    document.querySelectorAll('[data-style-variant-button]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-style-review-card]');
        const templateId = button.dataset.templateId || '';
        if (!card || !templateId) return;
        card.querySelectorAll('[data-style-variant-button]').forEach((item) => item.classList.toggle('active', item === button));
        card.querySelectorAll('[data-style-variant-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.templateId !== templateId;
        });
        syncStyleCardText(card);
      });
    });
    styleReviewCards.forEach(syncStyleCardText);
    syncStyleReviewFilters();
    document.querySelectorAll('[data-open-style-preview]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-style-review-card]');
        const panel = activeStylePanelForCard(card);
        const preview = panel?.querySelector('.style-template-preview');
        if (!stylePreviewModal || !stylePreviewFrame || !preview) return;
        const clone = preview.cloneNode(true);
        clone.classList.add('large');
        stylePreviewFrame.replaceChildren(clone);
        if (stylePreviewTitle) stylePreviewTitle.textContent = panel.dataset.styleTitle || '风格模板预览';
        if (stylePreviewMeta) stylePreviewMeta.textContent = panel.dataset.styleMeta || '';
        if (stylePreviewDescription) stylePreviewDescription.textContent = panel.dataset.styleDescription || '';
        if (stylePreviewScenario) stylePreviewScenario.textContent = panel.dataset.styleScenario || '';
        if (stylePreviewDataSource) stylePreviewDataSource.textContent = panel.dataset.styleDataSource || '';
        if (stylePreviewEffectPlan) stylePreviewEffectPlan.textContent = panel.dataset.styleEffectPlan || '';
        if (stylePreviewVideoUse) stylePreviewVideoUse.textContent = panel.dataset.styleVideoUse || '';
        if (stylePreviewInteraction) stylePreviewInteraction.textContent = panel.dataset.styleInteraction || '';
        if (stylePreviewSteps) stylePreviewSteps.textContent = panel.dataset.styleSteps || '';
        if (stylePreviewAnimation) stylePreviewAnimation.textContent = panel.dataset.styleAnimation || '';
        if (stylePreviewBenchmark) stylePreviewBenchmark.textContent = panel.dataset.styleBenchmark || '';
        if (stylePreviewCapabilities) stylePreviewCapabilities.textContent = panel.dataset.styleCapabilities || '';
        if (stylePreviewGuardrails) stylePreviewGuardrails.textContent = panel.dataset.styleGuardrails || '';
        if (typeof stylePreviewModal.showModal === 'function') stylePreviewModal.showModal();
        else stylePreviewModal.setAttribute('open', '');
      });
    });

    document.querySelectorAll('.caption-auto-card input').forEach((input) => {
      input.addEventListener('change', () => {
        input.closest('.caption-auto-card')?.classList.toggle('selected', input.checked);
      });
    });

	    document.querySelectorAll('input[name="ip-identity"]').forEach((input) => {
	      input.addEventListener('change', () => {
	        document.querySelectorAll('.ip-identity-card').forEach((card) => card.classList.toggle('selected', card.contains(input) && input.checked));
	      });
	    });

	    document.querySelectorAll('[data-ip-reference-upload]').forEach((input) => {
	      input.addEventListener('change', () => {
	        const card = input.closest('[data-ip-asset-registry]');
	        const count = input.files ? input.files.length : 0;
	        const label = card?.querySelector('[data-ip-upload-count]');
	        if (label) label.textContent = count ? '已选择 ' + String(count) + ' 个授权素材，提交后写入固定人设物料库' : label.textContent;
	        card?.classList.toggle('has-upload-selection', count > 0);
	      });
	    });
	    document.querySelectorAll('[data-ip-create-persona], [data-ip-reuse-persona]').forEach((button) => {
	      button.addEventListener('click', () => {
	        const card = button.closest('[data-ip-asset-registry]');
	        card?.classList.add('selected');
	      });
	    });

	    document.querySelectorAll('[data-ip-gallery]').forEach((gallery) => {
      const slides = Array.from(gallery.querySelectorAll('[data-ip-slide]'));
      const details = Array.from(gallery.querySelectorAll('[data-ip-detail]'));
      const counter = gallery.querySelector('[data-ip-counter]');
      if (!slides.length) return;
      let active = 0;
      const render = () => {
        slides.forEach((slide, index) => {
          slide.hidden = index !== active;
          slide.classList.toggle('active', index === active);
        });
        details.forEach((detail, index) => {
          detail.hidden = index !== active;
          detail.classList.toggle('active', index === active);
        });
        if (counter) counter.textContent = String(active + 1) + ' / ' + String(slides.length || 1);
      };
      gallery.querySelector('[data-ip-prev]')?.addEventListener('click', () => {
        active = (active - 1 + slides.length) % slides.length;
        render();
      });
      gallery.querySelector('[data-ip-next]')?.addEventListener('click', () => {
        active = (active + 1) % slides.length;
        render();
      });
      render();
    });
    const voiceDataNode = document.getElementById('voice-preview-data');
    let voicePreviewData = {};
    try { voicePreviewData = JSON.parse(voiceDataNode?.textContent || '{}'); } catch (error) { voicePreviewData = {}; }
    const voicePlayer = document.querySelector('[data-voice-preview-player]');
    const voiceStatus = document.querySelector('[data-voice-preview-status]');
    const voicePreviewButtons = Array.from(document.querySelectorAll('[data-voice-preview-button]'));
    const voicePreviewSamples = Array.isArray(voicePreviewData.previewCatalog?.samples)
      ? voicePreviewData.previewCatalog.samples.filter((sample) => sample && sample.available && sample.src)
      : [];
    const voiceLanguageInputs = Array.from(document.querySelectorAll('input[name="voice-language"]'));
    const voiceGenderInputs = Array.from(document.querySelectorAll('input[name="voice-gender"]'));
    const voiceToneInputs = Array.from(document.querySelectorAll('input[name="voice-tone-type"]'));
    const voiceDialectInputs = Array.from(document.querySelectorAll('input[name="voice-dialect"]'));
    const voiceDialectSelect = document.querySelector('[data-dialect-select]');
    const speechStyleInputs = Array.from(document.querySelectorAll('input[name="speech-style"]'));
    let activeVoiceButton = null;
    const selectedRadioValue = (inputs, fallback) => inputs.find((input) => input.checked)?.value || fallback || '';
    const checkedVoiceState = () => ({
      languageMode: selectedRadioValue(voiceLanguageInputs, voicePreviewData.selectedLanguageMode || 'zh-mandarin'),
      gender: selectedRadioValue(voiceGenderInputs, voicePreviewData.selectedGender || 'female'),
      toneType: selectedRadioValue(voiceToneInputs, voicePreviewData.selectedToneType || 'all'),
      dialect: selectedRadioValue(voiceDialectInputs, voiceDialectSelect?.value || 'yue'),
    });
    const syncSelectableCards = () => {
      document.querySelectorAll('.voice-option-card').forEach((card) => {
        card.classList.toggle('selected', card.querySelector('input[name="voice-gender"]')?.checked === true);
      });
      document.querySelectorAll('.voice-tone-chip').forEach((chip) => {
        chip.classList.toggle('selected', chip.querySelector('input')?.checked === true);
      });
      document.querySelectorAll('.voice-row').forEach((row) => {
        row.classList.toggle('selected', row.querySelector('input[name="voice-language"]')?.checked === true);
      });
      document.querySelectorAll('.dialect-card').forEach((card) => {
        card.classList.toggle('selected', card.querySelector('input[name="voice-dialect"]')?.checked === true);
      });
      if (voiceDialectSelect) voiceDialectSelect.value = selectedRadioValue(voiceDialectInputs, voiceDialectSelect.value || 'yue');
      document.querySelectorAll('.speech-chip').forEach((chip) => {
        chip.classList.toggle('selected', chip.querySelector('input[name="speech-style"]')?.checked === true);
      });
    };
    const voiceLanguageMatches = (sampleLanguage, requestedLanguage) => requestedLanguage === 'bilingual'
      ? sampleLanguage === 'zh-mandarin' || sampleLanguage === 'en-narration'
      : sampleLanguage === requestedLanguage;
    const previewConstraintsForButton = (button) => {
      const kind = button.dataset.previewKind || '';
      const value = button.dataset.previewValue || '';
      if (kind === 'gender') return { gender: value };
      if (kind === 'tone') return value === 'all' ? {} : { toneType: value };
      if (kind === 'language') return { languageMode: value };
      if (kind === 'dialect') return { languageMode: 'dialect-accent', toneType: 'dialect', dialectId: value };
      return {};
    };
    const sampleMatchesConstraints = (sample, constraints) => {
      if (constraints.gender && sample.gender !== constraints.gender) return false;
      if (constraints.toneType && sample.toneType !== constraints.toneType) return false;
      if (constraints.languageMode && !voiceLanguageMatches(sample.languageMode, constraints.languageMode)) return false;
      if (constraints.dialectId && sample.dialectId !== constraints.dialectId) return false;
      return true;
    };
    const scoreVoiceSample = (sample, state) => {
      let score = 0;
      if (voiceLanguageMatches(sample.languageMode, state.languageMode)) score += 10;
      if (sample.gender === state.gender) score += 5;
      if (state.toneType === 'all' || sample.toneType === state.toneType) score += 3;
      if (sample.dialectId === state.dialect) score += 2;
      if (sample.languageMode === 'zh-mandarin' && sample.toneType === 'creator') score += 1;
      return score;
    };
    const voiceSampleForButton = (button, state) => {
      const constraints = previewConstraintsForButton(button);
      return voicePreviewSamples
        .filter((sample) => sampleMatchesConstraints(sample, constraints))
        .sort((a, b) => scoreVoiceSample(b, state) - scoreVoiceSample(a, state) || a.label.localeCompare(b.label))[0] || null;
    };
    const syncVoicePreviewButtons = () => {
      const state = checkedVoiceState();
      voicePreviewButtons.forEach((button) => {
        const sample = voiceSampleForButton(button, state);
        const available = Boolean(sample?.src);
        button.dataset.previewSrc = available ? sample.src : '';
        button.dataset.previewLabel = available ? sample.label : '';
        button.disabled = !available;
        button.classList.toggle('disabled', !available);
        button.textContent = available ? '试听' : '暂无';
        button.title = available ? sample.label : '当前选项暂无内置口播试听样本';
      });
    };
    const syncVoiceControls = () => {
      syncSelectableCards();
      syncVoicePreviewButtons();
    };
    const setRadioValue = (inputs, value) => {
      inputs.forEach((input) => { input.checked = input.value === value; });
    };
    [...voiceLanguageInputs, ...voiceGenderInputs, ...voiceToneInputs, ...voiceDialectInputs, ...speechStyleInputs].forEach((input) => {
      input.addEventListener('change', syncVoiceControls);
    });
    voiceDialectSelect?.addEventListener('change', () => {
      setRadioValue(voiceDialectInputs, voiceDialectSelect.value);
      setRadioValue(voiceLanguageInputs, 'dialect-accent');
      setRadioValue(voiceToneInputs, 'dialect');
      syncVoiceControls();
    });
    document.querySelectorAll('[data-dialect-option]').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-voice-preview-button]')) return;
        const dialectId = card.dataset.dialectOption || '';
        setRadioValue(voiceDialectInputs, dialectId);
        if (voiceDialectSelect) voiceDialectSelect.value = dialectId;
        setRadioValue(voiceLanguageInputs, 'dialect-accent');
        setRadioValue(voiceToneInputs, 'dialect');
        syncVoiceControls();
      });
    });
    const clearActiveVoiceButton = () => {
      if (activeVoiceButton) activeVoiceButton.classList.remove('playing');
      activeVoiceButton = null;
    };
    voicePlayer?.addEventListener('ended', clearActiveVoiceButton);
    voicePlayer?.addEventListener('pause', () => {
      if (voicePlayer.currentTime === 0 || voicePlayer.ended) clearActiveVoiceButton();
    });
    voicePreviewButtons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!voicePlayer || button.disabled) return;
        const src = button.dataset.previewSrc || '';
        const label = button.dataset.previewLabel || '语音试听';
        if (!src) {
          if (voiceStatus) voiceStatus.textContent = '当前选项暂无本地试听样本。';
          return;
        }
        clearActiveVoiceButton();
        activeVoiceButton = button;
        button.classList.add('playing');
        voicePlayer.src = src;
        if (voiceStatus) voiceStatus.textContent = '正在试听口播：' + label;
        try {
          await voicePlayer.play();
        } catch (error) {
          clearActiveVoiceButton();
          if (voiceStatus) voiceStatus.textContent = '播放失败：' + (error?.message || '浏览器阻止了自动播放，请再次点击。');
        }
      });
    });
    syncVoiceControls();
  </script>`;
}

function renderHtml(model) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>视频生成配置台</title>
  ${renderStyles()}
</head>
<body>
  ${renderHeader(model)}
  <main class="shell">
    ${renderBaseSection(model)}
    ${renderMotionSection(model)}
    ${renderColorSection(model)}
	    ${renderCaptionSection(model)}
	    ${renderMaterialSection(model)}
	    ${renderCoverSection(model)}
	    ${renderVoiceSection(model)}
    ${renderPageEditSection(model)}
  </main>
  ${renderScripts()}
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.packageDir) {
    console.log(usage());
    if (!args.help) process.exit(1);
    return;
  }
  const packageDir = resolve(args.packageDir);
  if (!existsSync(packageDir)) throw new Error(`Package directory not found: ${packageDir}`);
  const outPath = args.out ? resolve(args.out) : join(packageDir, "semi-auto-config.html");
  const context = buildContext(packageDir);
  const model = buildConfigModel(context, outPath);
  const motionStyleReviewPath = join(dirname(outPath), model.motionStyleCatalog.reviewPage || "motion-style-template-review.html");
  const verticalMotionStyleReviewPath = join(dirname(outPath), model.motionStyleCatalog.verticalReviewPage || "vertical-motion-style-template-review.html");
  writeJson(join(packageDir, "workflow", "semi-auto-config.json"), model);
  writeJson(join(packageDir, "workflow", "motion-style-template-review.json"), {
    schemaVersion: 1,
    status: "motion-style-template-ready",
    surfaceName: "风格模板",
    previewMode: "video-frame-simulation",
    html: relative(packageDir, motionStyleReviewPath).split("\\").join("/"),
    templateCount: model.motionStyleCatalog.count,
    skeletonCount: model.motionStyleCatalog.familyCount,
    variantsPerSkeleton: model.motionStyleCatalog.variantCount,
    groupingMode: "content-skeleton-with-style-buttons",
    familyCount: model.motionStyleCatalog.familyCount,
    variantCount: model.motionStyleCatalog.variantCount,
    source: model.motionStyleCatalog.source,
    generatedAt: model.generatedAt,
  });
  writeJson(join(packageDir, "workflow", "vertical-motion-style-template-review.json"), {
    schemaVersion: 1,
    status: "vertical-motion-style-template-ready",
    surfaceName: "竖屏风格模板",
    previewMode: "vertical-short-form-video-frame-simulation",
    html: relative(packageDir, verticalMotionStyleReviewPath).split("\\").join("/"),
    templateCount: model.motionStyleCatalog.count,
    skeletonCount: model.motionStyleCatalog.familyCount,
    variantsPerSkeleton: model.motionStyleCatalog.variantCount,
    aspectRatio: "9:16",
    resolution: "1080x1920",
    defaultFps: 60,
    platformProfile: "douyin-tiktok-shorts-reels",
    shortFormRules: ["first-frame promise", "0-3s hook", "one-line subtitle safe band", "right action rail clear", "effect layer avoids captions"],
    groupingMode: "content-skeleton-with-style-buttons",
    source: model.motionStyleCatalog.source,
    generatedAt: model.generatedAt,
  });
  write(outPath, renderHtml(model));
  write(motionStyleReviewPath, renderMotionStyleReviewHtml(model));
  write(verticalMotionStyleReviewPath, renderVerticalMotionStyleReviewHtml(model));
  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    motionStyleReview: motionStyleReviewPath,
    verticalMotionStyleReview: verticalMotionStyleReviewPath,
    config: join(packageDir, "workflow", "semi-auto-config.json"),
    captionStyleCount: model.captionStyles.count,
    motionTemplateCount: model.motionTemplates.count,
    motionStyleTemplateCount: model.motionStyleCatalog.count,
  }, null, 2));
}

main();
