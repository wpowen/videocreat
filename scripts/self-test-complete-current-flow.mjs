#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, "..");
const workspace = resolve(skillRoot, "../../..");
const scriptsDir = join(skillRoot, "scripts");
const workflowScript = join(scriptsDir, "poc-video-workflow.mjs");
const motionStyleCatalogPath = join(skillRoot, "assets", "motion-style-catalog.json");
const motionStyleTemplateLibraryPath = join(skillRoot, "assets", "motion-style-template-library.json");
const motionStyleTemplateLibraryBuilderScript = join(scriptsDir, "build-motion-style-template-library.mjs");
const motionStyleTemplateLibraryValidatorScript = join(scriptsDir, "validate-motion-style-template-library.mjs");
const routeSelfTestScript = join(scriptsDir, "self-test-capability-routing.mjs");
const fullFrameworkSelfTestScript = join(scriptsDir, "self-test-full-framework.mjs");
const captionRoutingScript = join(scriptsDir, "validate-caption-strategy-routing.mjs");
const semiAutoBuilderScript = join(scriptsDir, "build-semi-auto-config-html.mjs");
const pluginValidatorScript = join(scriptsDir, "validate-plugin-routing-contract.mjs");
const subtitleCoverValidatorScript = join(scriptsDir, "validate-subtitle-cover-contract.mjs");
const frameLayoutValidatorScript = join(scriptsDir, "validate-frame-layout-overlap.mjs");
const personalIpAssetRegistryScript = join(scriptsDir, "register-personal-ip-asset.mjs");
const motionStyleReviewPageValidatorScript = join(scriptsDir, "validate-motion-style-review-page.mjs");
const MOTION_STYLE_MIN_FAMILY_COUNT = 32;
const MOTION_STYLE_MIN_TEMPLATE_COUNT = 160;
const MOTION_STYLE_MIN_CONTENT_KIND_COUNT = 32;
const MOTION_STYLE_REQUIRED_CONTENT_KINDS = [
  "code-walkthrough",
  "formula-derivation",
  "data-chart",
  "table-ranking",
  "geo-map",
  "network-relationship",
  "funnel-conversion",
  "agent-simulation",
  "voice-sync",
  "ip-knowledge-card",
  "whiteboard-method",
  "cover-bridge",
  "material-collage",
  "choice-matrix",
];

function parseArgs(argv) {
  const args = {
    outRoot: join(workspace, "research", "codex-video-workflow-poc", "complete-current-flow-self-test"),
    imageSource: "image2-dryrun",
    voiceBackend: "melotts_local",
    keepExisting: false,
    skipFullRender: false,
    skipRouteCoverage: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--out-root") args.outRoot = resolve(argv[++i]);
    else if (item === "--image-source") args.imageSource = argv[++i];
    else if (item === "--voice-backend") args.voiceBackend = argv[++i];
    else if (item === "--keep-existing") args.keepExisting = true;
    else if (item === "--skip-full-render") args.skipFullRender = true;
    else if (item === "--skip-route-coverage") args.skipRouteCoverage = true;
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/self-test-complete-current-flow.mjs [--out-root <dir>] [--voice-backend melotts_local|cosyvoice_local|auto]",
    "",
    "Runs a complete current-flow self-test:",
    "- syntax checks",
    "- caption planner routing",
    "- capability route coverage",
    "- semi-auto prepare/config stop point",
	    "- config page browser interaction checks",
	    "- full-auto MP4 render and QC validators",
	    "- 160-template video-level motion style catalog",
	    "- reusable content-aware motion style template library",
	    "- automatic cover design styles and resolution presets",
  ].join("\n");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function rel(path) {
  return relative(workspace, path).split("\\").join("/");
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function arrayify(value) {
  return Array.isArray(value) ? value : [];
}

function runStep(report, id, command, args, options = {}) {
  const required = options.required !== false;
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: options.cwd || workspace,
    encoding: "utf8",
    maxBuffer: options.maxBuffer || 128 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });
  const entry = {
    id,
    command: [command, ...args].join(" "),
    cwd: options.cwd || workspace,
    status: result.status,
    ok: result.status === 0,
    required,
    startedAt,
    finishedAt: new Date().toISOString(),
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
  report.commands.push(entry);
  if (required && result.status !== 0) report.failures.push(`${id} failed with status ${result.status}`);
  return entry;
}

function recordCachedStep(report, id, command, args, evidencePath) {
  const entry = {
    id,
    command: [command, ...args].join(" "),
    cwd: workspace,
    status: 0,
    ok: true,
    required: true,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    stdout: `reused existing self-test evidence: ${rel(evidencePath)}`,
    stderr: "",
    cached: true,
  };
  report.commands.push(entry);
  return entry;
}

function baseRights() {
  return {
    text: "original local self-test brief",
    visuals: "local deterministic HTML/SVG and image2-dryrun prompts",
    voice: "local TTS only",
    music: "none",
    externalMedia: "none",
  };
}

function buildSemiAutoBrief(imageSource, voiceBackend = "melotts_local") {
  return {
    title: "AI 产品上线前的三道检查",
    language: "zh",
    audience: "产品团队和创业者",
    objective: "用半自动配置流程检查基础参数、字幕、动效、个人 IP、白板、素材和语音配置是否能被正确准备。",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 14,
    videoType: "professional-explainer",
    generationMode: "semi-auto",
    imageSource,
    voiceBackend,
    speechStyle: "explainer",
    rights: baseRights(),
    ipDiagramCreator: true,
    personalIp: "产品方法课主讲人",
    whiteboardLayeredReveal: true,
    scenes: [
      {
        id: "opening-risk",
        label: "开场风险",
        headline: ["上线前", "先看三件事"],
        body: "不要先讨论工具，先确认用户承诺、失败边界和复盘证据。",
        subtitle: "上线前先确认用户承诺、失败边界和复盘证据。",
        visualMode: "ip-diagram",
        diagramMode: "character-led-small-scene",
        palette: "blue",
      },
      {
        id: "workflow-check",
        label: "流程检查",
        headline: ["每一步", "都要有证据"],
        body: "流程页需要展示输入、处理、审核和输出，不把责任藏在口播里。",
        subtitle: "流程页要展示输入、处理、审核和输出。",
        motionTemplate: "semantic-timeline-reveal",
        palette: "teal",
      },
      {
        id: "whiteboard-proof",
        label: "白板补充",
        headline: ["白板只画", "语义前景"],
        body: "白板绘制应只补充箭头、圈画和手写轨迹，字幕最终保持在最上层。",
        subtitle: "白板只补充语义前景，字幕最终保持在最上层。",
        whiteboard: true,
        palette: "green",
      },
    ],
    narration: "上线前先确认用户承诺、失败边界和复盘证据。流程页要展示输入、处理、审核和输出。白板只补充语义前景，字幕最终保持在最上层。",
  };
}

function buildFullAutoBrief(imageSource, voiceBackend = "melotts_local") {
  return {
    title: "AI 产品上线前的三道检查",
    language: "zh",
    audience: "产品团队和创业者",
    objective: "生成一条短横屏本地评审视频，用真实 MP4 验证全自动流程、字幕、声音、动效和 QC 是否正常触发。",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 9,
    videoType: "professional-explainer",
    generationMode: "full-auto",
    imageSource,
    voiceBackend,
    speechStyle: "explainer",
    rights: baseRights(),
    ipDiagramCreator: true,
    personalIp: "产品方法课主讲人",
    whiteboardLayeredReveal: true,
    scenes: [
      {
        id: "promise",
        label: "承诺",
        headline: ["上线前", "先看承诺"],
        body: "第一步确认产品承诺是否能被一句话讲清楚。",
        subtitle: "第一步确认产品承诺是否能被一句话讲清楚。",
        visualMode: "ip-diagram",
        diagramMode: "character-led-small-scene",
        palette: "blue",
      },
      {
        id: "boundary",
        label: "边界",
        headline: ["失败边界", "必须可见"],
        body: "第二步把失败场景写出来，避免只展示理想流程。",
        subtitle: "第二步把失败场景写出来，避免只展示理想流程。",
        visualMode: "ip-diagram",
        diagramMode: "knowledge-card",
        palette: "teal",
      },
      {
        id: "evidence",
        label: "证据",
        headline: ["复盘证据", "决定能否迭代"],
        body: "第三步保留日志、反馈和指标，让上线后的判断有依据。",
        subtitle: "第三步保留日志、反馈和指标，让上线后的判断有依据。",
        visualMode: "ip-diagram",
        diagramMode: "agent-collaboration-diagram",
        palette: "green",
      },
    ],
    narration: "第一步确认产品承诺是否能被一句话讲清楚。第二步把失败场景写出来，避免只展示理想流程。第三步保留日志、反馈和指标，让上线后的判断有依据。",
  };
}

function prepareReusableFullAutoSmokeAudio(report, out, voiceBackend = "melotts_local") {
  const assetsDir = join(out, "assets");
  const workflowDir = join(out, "workflow");
  ensureDir(assetsDir);
  ensureDir(workflowDir);
  const duration = 9.0;
  const narrationM4a = join(assetsDir, "narration.m4a");
  const bgmM4a = join(assetsDir, "generated-pad.m4a");
  const mixM4a = join(assetsDir, "mix.m4a");
  runStep(report, "full-auto-reusable-audio-narration-fixture", "ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `anoisesrc=color=pink:amplitude=0.28:duration=${duration}:seed=42`,
    "-af", "highpass=f=120,lowpass=f=3600,volume=2dB",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    rel(narrationM4a),
  ]);
  runStep(report, "full-auto-reusable-audio-bgm-fixture", "ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `sine=frequency=98:duration=${duration}`,
    "-af", "volume=-34dB",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "48000",
    "-ac", "2",
    rel(bgmM4a),
  ]);
  runStep(report, "full-auto-reusable-audio-mix-fixture", "ffmpeg", [
    "-y",
    "-i", rel(narrationM4a),
    "-i", rel(bgmM4a),
    "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first,alimiter=limit=0.92[a]",
    "-map", "[a]",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    rel(mixM4a),
  ]);
  writeJson(join(workflowDir, "voice-subtitle-manifest.json"), {
    voiceBackend,
    requestedVoiceBackend: voiceBackend,
    narration: "assets/narration.m4a",
    reviewWav: "",
    reviewMp3: "",
    music: "assets/generated-pad.m4a",
    mix: "assets/mix.m4a",
    sourceNarration: "script/narration.txt",
    spokenNarration: "script/narration-spoken.txt",
    subtitleFile: "script/subtitles.srt",
    segmentTimingSource: "actual_subtitle_cue_tts_segments",
    segmentTimings: [
      {
        index: 1,
        frameId: "promise",
        label: "承诺",
        text: "第一步确认产品承诺是否能被一句话讲清楚。",
        captionText: "第一步确认产品承诺是否能被一句话讲清楚。",
        frameText: "第一步确认产品承诺是否能被一句话讲清楚。",
        start: 0,
        end: 2.8,
        durationSeconds: 2.8,
      },
      {
        index: 2,
        frameId: "boundary",
        label: "边界",
        text: "第二步把失败场景写出来，避免只展示理想流程。",
        captionText: "第二步把失败场景写出来，避免只展示理想流程。",
        frameText: "第二步把失败场景写出来，避免只展示理想流程。",
        start: 2.8,
        end: 5.8,
        durationSeconds: 3.0,
      },
      {
        index: 3,
        frameId: "evidence",
        label: "证据",
        text: "第三步保留日志、反馈和指标，让上线后的判断有依据。",
        captionText: "第三步保留日志、反馈和指标，让上线后的判断有依据。",
        frameText: "第三步保留日志、反馈和指标，让上线后的判断有依据。",
        start: 5.8,
        end: duration,
        durationSeconds: Number((duration - 5.8).toFixed(3)),
      },
    ],
    timing: {
      estimatedDurationSeconds: duration,
      rawNarrationDurationSeconds: duration,
      finalDurationSeconds: duration,
      audioStartsAtSeconds: 0,
      audioDelaySeconds: 0,
      policy: "Self-test fixture for validating full-auto composition, subtitles, render, and QC without blocking on TTS model inference.",
    },
    deliveryAudioFormat: {
      sampleRateHz: 48000,
      channels: 2,
      channelLayout: "stereo",
    },
  });
  report.artifacts.fullAutoReusableAudio = assetsDir;
}

function walkFiles(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, predicate, acc);
    else if (!predicate || predicate(full)) acc.push(full);
  }
  return acc;
}

function frameHtmlFiles(out) {
  return walkFiles(join(out, ".html-video", "projects"), (file) => file.endsWith(".html")).sort();
}

function visibleTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function expandMotionStyleCatalogForTest(catalog = {}) {
  const variants = arrayify(catalog.variants);
  return arrayify(catalog.families).flatMap((family) => variants.map((variant) => ({
    id: `${family.id}--${variant.id}`,
    familyId: family.id,
    variantId: variant.id,
    baseTemplate: family.baseTemplate,
    familyLabelZh: family.familyLabelZh,
    variantLabelZh: variant.labelZh,
  })));
}

function validateMotionStyleCatalogFile(failures) {
  assert(existsSync(motionStyleCatalogPath), "motion style catalog file must exist", failures);
  if (!existsSync(motionStyleCatalogPath)) return {};
  const catalog = readJson(motionStyleCatalogPath);
  const templates = expandMotionStyleCatalogForTest(catalog);
  assert(catalog.status === "active-motion-style-catalog", "motion style catalog must be active", failures);
  assert(arrayify(catalog.families).length >= MOTION_STYLE_MIN_FAMILY_COUNT, `motion style catalog must include at least ${MOTION_STYLE_MIN_FAMILY_COUNT} families`, failures);
  assert(arrayify(catalog.variants).length >= 5, "motion style catalog must include at least 5 variants", failures);
  assert(templates.length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `motion style catalog must expand to at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} templates`, failures);
  assert(new Set(templates.map((template) => template.id)).size === templates.length, "motion style catalog template ids must be unique", failures);
  assert(arrayify(catalog.families).every((family) => family.id && family.labelZh && family.baseTemplate && arrayify(family.motionVerbs).length), "motion style families must carry labels, base templates, and verbs", failures);
  assert(arrayify(catalog.variants).every((variant) => variant.id && variant.labelZh && variant.paletteBehavior), "motion style variants must carry labels and palette behavior tokens", failures);
  return {
    path: motionStyleCatalogPath,
    familyCount: arrayify(catalog.families).length,
    variantCount: arrayify(catalog.variants).length,
    templateCount: templates.length,
  };
}

function validateMotionStyleTemplateLibraryFile(failures) {
  assert(existsSync(motionStyleTemplateLibraryPath), "motion style template library file must exist", failures);
  if (!existsSync(motionStyleTemplateLibraryPath)) return {};
  const library = readJson(motionStyleTemplateLibraryPath);
  const templates = arrayify(library.templates);
  const contentKinds = new Set(templates.map((template) => template.contentKind).filter(Boolean));
  assert(library.status === "active-motion-style-template-library", "motion style template library must be active", failures);
  assert(library.sourceCatalog === "assets/motion-style-catalog.json", "motion style template library must reference the source catalog", failures);
  assert(library.designSpec === "references/motion-style-template-design-spec.md", "motion style template library must reference the design spec", failures);
  assert(library.selectionArtifact === "workflow/motion-style-template-selection.json", "motion style template library must name the selection artifact", failures);
  assert(templates.length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `motion style template library must expose at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} reusable templates`, failures);
  assert(contentKinds.size >= MOTION_STYLE_MIN_CONTENT_KIND_COUNT, `motion style template library must cover at least ${MOTION_STYLE_MIN_CONTENT_KIND_COUNT} content kinds`, failures);
  for (const kind of MOTION_STYLE_REQUIRED_CONTENT_KINDS) {
    assert(contentKinds.has(kind), `motion style template library must include ${kind}`, failures);
  }
  assert(Boolean(library.agentContract?.plannerAgent), "motion style template library must include Planner Agent contract", failures);
  assert(Boolean(library.agentContract?.ttsTimingAgent), "motion style template library must include TTS Timing Agent contract", failures);
  assert(Boolean(library.agentContract?.templateDirectorAgent), "motion style template library must include Template Director Agent contract", failures);
  assert(Boolean(library.agentContract?.rendererQcAgent), "motion style template library must include Renderer/QC Agent contract", failures);
  assert(library.selectionPolicy?.mode === "planner-auto-first-with-user-override", "motion style template library must default to planner auto selection", failures);
  assert(templates.every((template) => template.layoutContract?.blueprint && template.typographyContract?.exactTextOwner === "deterministic HTML/SVG/CSS layers" && template.motionContract?.animationSteps?.length >= 3), "every reusable template must include layout, deterministic typography, and animation contracts", failures);
  assert(templates.every((template) => template.benchmarkContract?.horizontalComparisonRule && arrayify(template.benchmarkContract?.externalReferences).length >= 5), "every reusable template must include horizontal benchmark references", failures);
  return {
    path: motionStyleTemplateLibraryPath,
    templateCount: templates.length,
    contentKindCount: contentKinds.size,
    familyCount: Number(library.coverage?.familyCount || 0),
    variantCount: Number(library.coverage?.variantCount || 0),
  };
}

function validateSemiAutoPackage(out, failures) {
  const manifest = readJson(join(out, "delivery-manifest.json"));
  const config = readJson(join(out, "workflow", "semi-auto-config.json"));
  const interaction = readJson(join(out, "workflow", "semi-auto-interaction-contract.json"));
  const generation = readJson(join(out, "workflow", "generation-mode-contract.json"));
  const caption = readJson(join(out, "workflow", "caption-style-plan.json"));
  const motionStylePlan = readJson(join(out, "workflow", "motion-style-plan.json"));
  const motionStyleTemplateSelection = readJson(join(out, "workflow", "motion-style-template-selection.json"));
  const colorSystemPlan = readJson(join(out, "workflow", "color-system-plan.json"));
  const ipPlan = readJson(join(out, "workflow", "ip-diagram-creator-plan.json"));
  const personalIpRegistry = readJson(join(out, "workflow", "personal-ip-asset-registry.json"));
  const html = readFileSync(join(out, "semi-auto-config.html"), "utf8");
  assert(manifest.mode === "semi-auto-config", "semi-auto delivery manifest must stop at config mode", failures);
  assert(manifest.renderer === "none-semi-auto-config", "semi-auto mode must not claim a renderer before composition", failures);
  assert(manifest.files?.deliveryService === "delivery-service.mjs", "semi-auto manifest must expose the local config service", failures);
  assert(manifest.files?.semiAutoInteractionContract === "workflow/semi-auto-interaction-contract.json", "semi-auto manifest must expose the interaction contract", failures);
  assert(manifest.files?.motionStyleTemplateReview === "motion-style-template-review.html", "semi-auto manifest must expose the motion style review page", failures);
  assert(manifest.files?.motionStyleTemplateReviewJson === "workflow/motion-style-template-review.json", "semi-auto manifest must expose the motion style review json", failures);
  assert(manifest.files?.colorSystemPlan === "workflow/color-system-plan.json", "semi-auto manifest must expose the planner color-system plan", failures);
  assert(existsSync(join(out, "delivery-service.mjs")), "semi-auto package must write delivery-service.mjs even when browser auto-open is disabled", failures);
  assert(existsSync(join(out, "motion-style-template-review.html")), "semi-auto package must write the standalone motion style review page", failures);
  assert(existsSync(join(out, "workflow", "motion-style-template-review.json")), "semi-auto package must write the standalone motion style review metadata", failures);
  assert(!existsSync(join(out, "renders", "final.mp4")), "semi-auto without compose must not render final MP4", failures);
  assert(interaction.status === "semi-auto-interaction-ready", "semi-auto interaction contract must be ready", failures);
  assert(interaction.defaultEntry === "semi-auto-config.html", "semi-auto interaction contract must point to config page", failures);
  assert(interaction.currentArtifacts?.motionStyleTemplateReviewPage === "motion-style-template-review.html", "semi-auto interaction contract must point to the motion style review page", failures);
  assert((interaction.userFlow || []).map((stage) => stage.stage).join(">") === "intake>configure>page-review>compose", "semi-auto interaction flow must include intake, configure, page-review, compose", failures);
  assert(interaction.triggerPolicy?.fullAuto && interaction.triggerPolicy?.semiAuto, "semi-auto interaction contract must define full-auto and semi-auto trigger policy", failures);
  assert(generation.selectedMode === "semi-auto", "generation contract must select semi-auto for semi-auto package", failures);
  assert(generation.defaultMode === "semi-auto", "generation contract must keep ordinary topic/script intake on semi-auto config by default", failures);
  for (const stageId of ["prepare", "configure", "page-edit", "compose"]) {
    assert((generation.semiAutoPipeline?.stages || []).some((stage) => stage.id === stageId), `semi-auto stage missing: ${stageId}`, failures);
  }
  assert(config.baseParameters?.selected?.orientation === "横屏", "semi-auto default orientation must be horizontal", failures);
  assert(config.baseParameters?.selected?.fps === 60, "semi-auto config must default to 60fps", failures);
  assert(config.captionStyles?.autoSubtitle?.enabledByDefault === true, "auto subtitles must default to enabled", failures);
  assert(config.captionStyles?.keywordHighlight?.enabledByDefault === true, "keyword highlight must default to enabled", failures);
  assert((config.captionStyles?.styles || []).length >= 68, "semi-auto config must expose all caption styles", failures);
  assert((config.captionStyles?.selected || []).length === 1, "semi-auto config must default exactly one selected caption style", failures);
  assert((config.motionTemplates?.templates || []).every((template) => template.selected === true), "all motion templates must default selected", failures);
  assert((config.motionCapabilities?.selected || []).length === config.motionCapabilities?.count, "all scene-level motion capabilities must default selected", failures);
  assert(Number(config.motionStyleCatalog?.count || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `semi-auto config must expose at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} motion style templates`, failures);
  assert((config.motionStyleCatalog?.families || []).length >= MOTION_STYLE_MIN_FAMILY_COUNT, `semi-auto config must expose at least ${MOTION_STYLE_MIN_FAMILY_COUNT} motion style families`, failures);
  assert((config.motionStyleCatalog?.selectedSceneStyles || []).length >= Number(config.pageEditing?.pageCount || 0), "semi-auto config must bind motion styles to every page", failures);
  assert(config.motionStyleCatalog?.plan?.path === "workflow/motion-style-plan.json", "semi-auto config must reference motion-style-plan", failures);
  assert(config.motionStyleCatalog?.reviewPage === "motion-style-template-review.html", "semi-auto config must link the motion style review page", failures);
  assert(config.motionStyleCatalog?.templateLibrary?.status === "active-motion-style-template-library", "semi-auto config must expose the active reusable template library", failures);
  assert(config.motionStyleCatalog?.templateLibrary?.selectionArtifact === "workflow/motion-style-template-selection.json", "semi-auto config must expose the motion style template selection artifact", failures);
  assert(Number(config.motionStyleCatalog?.templateLibrary?.templateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `semi-auto config template library summary must expose at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} templates`, failures);
  for (const kind of MOTION_STYLE_REQUIRED_CONTENT_KINDS) {
    assert((config.motionStyleCatalog?.templateLibrary?.contentKinds || []).includes(kind), `semi-auto config template library summary must include ${kind}`, failures);
  }
  const styleTemplates = config.motionStyleCatalog?.templates || [];
  const styleExampleKinds = styleTemplates.map((template) => template.example?.kind).filter(Boolean);
  assert(new Set(styleExampleKinds).size >= MOTION_STYLE_MIN_CONTENT_KIND_COUNT, `semi-auto config must expose at least ${MOTION_STYLE_MIN_CONTENT_KIND_COUNT} content-specific examples`, failures);
  for (const requiredKind of MOTION_STYLE_REQUIRED_CONTENT_KINDS) {
    assert(styleExampleKinds.includes(requiredKind), `semi-auto config motion style examples must include ${requiredKind}`, failures);
  }
  assert(styleTemplates.every((template) => template.pageCardType && template.layoutBlueprint && template.visualWeight && template.methodologySource === "ip-diagram-creator-inspired-page-director"), "every motion style template must expose IP-diagram-inspired page director methodology", failures);
  assert(new Set(styleTemplates.map((template) => template.layoutBlueprint).filter(Boolean)).size >= 16, "motion style templates must expose diverse layout blueprints, not only color swaps", failures);
  assert(Number(generation.capabilityInventory?.motionStyleTemplateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `generation contract must advertise the ${MOTION_STYLE_MIN_TEMPLATE_COUNT}-template motion style catalog`, failures);
  assert(Number(generation.semiAutoPipeline?.configurationSurface?.sections?.videoMotionStyles?.count || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "semi-auto configuration surface must include video motion styles", failures);
  assert(generation.semiAutoPipeline?.configurationSurface?.sections?.colorSystem?.mode === "auto-by-default", "semi-auto configuration surface must mark color system as auto-by-default", failures);
  assert(generation.semiAutoPipeline?.configurationSurface?.sections?.colorSystem?.plannerArtifact === "workflow/color-system-plan.json", "semi-auto configuration surface must reference the planner color-system artifact", failures);
  assert(motionStylePlan.status === "active-motion-style-plan", "motion style plan must be active", failures);
  assert(Number(motionStylePlan.totalTemplateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `motion style plan must include at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} available templates`, failures);
  assert((motionStylePlan.sceneStyles || []).length >= Number(config.pageEditing?.pageCount || 0), "motion style plan must bind every semi-auto page", failures);
  assert((motionStylePlan.sceneStyles || []).every((scene) => scene.styleTemplateId && scene.captionSafeArea && scene.animationSteps?.length >= 3), "every semi-auto page must have a selected motion style with safe-area and animation steps", failures);
  assert(motionStylePlan.contentDrivenGenerationMethodology?.source === "haloshin/ip-diagram-creator", "motion style plan must borrow the ip-diagram content-to-image methodology", failures);
  assert((motionStylePlan.sceneStyles || []).every((scene) => scene.contentDrivenLayoutPlan?.generationLogicSource === "haloshin/ip-diagram-creator-content-to-image-methodology" && scene.contentDrivenLayoutPlan?.pageCard?.layoutBlueprint && (scene.contentDrivenLayoutPlan?.imageResourcePlan || []).length >= 4 && (scene.contentDrivenLayoutPlan?.animationLayerPlan || []).length >= 4), "every motion style scene must expose content-driven layout, image resource, and animation layer plans", failures);
  assert(motionStyleTemplateSelection.status === "active-motion-style-template-selection", "semi-auto package must write an active motion style template selection", failures);
  assert(motionStyleTemplateSelection.templateLibrary === "assets/motion-style-template-library.json", "motion style template selection must reference the reusable template library", failures);
  assert(Number(motionStyleTemplateSelection.libraryCoverage?.templateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style template selection must report the full template library coverage", failures);
  assert(motionStyleTemplateSelection.agentHandoff?.plannerAgent && motionStyleTemplateSelection.agentHandoff?.ttsTimingAgent && motionStyleTemplateSelection.agentHandoff?.templateDirectorAgent && motionStyleTemplateSelection.agentHandoff?.rendererQcAgent, "motion style template selection must expose the planner/TTS/template/QC agent handoff", failures);
  assert((motionStyleTemplateSelection.sceneSelections || []).length >= Number(config.pageEditing?.pageCount || 0), "motion style template selection must bind every semi-auto page", failures);
  assert((motionStyleTemplateSelection.sceneSelections || []).every((selection) => selection.selectedTemplateId && selection.libraryTemplateFound === true && selection.contentKind && selection.layoutContract?.blueprint && selection.typographyContract?.exactTextOwner === "deterministic HTML/SVG/CSS layers" && (selection.motionContract?.animationSteps || []).length >= 3 && selection.dataAccuracyContract?.rule && selection.assetTaskContract?.imageGenerationPolicy), "every semi-auto scene template selection must include template id, content kind, layout, type, motion, data, and asset contracts", failures);
  assert((config.colorSystems?.modes || []).some((mode) => mode.id === "mono"), "color system must include mono tab", failures);
  assert((config.colorSystems?.systems || []).filter((system) => system.paletteMode === "mono").length >= 16, "color system must include the expanded mono palette set", failures);
  assert((config.colorSystems?.systems || []).some((system) => system.hasBlack === false), "color system must include palettes without black", failures);
  assert(colorSystemPlan.status === "auto-color-system-plan", "color system plan must be generated by the planner", failures);
  assert(colorSystemPlan.mode === "auto-by-default", "color system plan must default to auto mode", failures);
  assert(colorSystemPlan.selectedSystem?.id, "color system plan must select a color system", failures);
  assert((colorSystemPlan.selectedSystem?.reasons || []).length >= 1, "color system plan must include selection reasons", failures);
  assert((colorSystemPlan.sceneBindings || []).length >= Number(config.pageEditing?.pageCount || 0), "color system plan must bind every page to a color system", failures);
  assert(config.colorSystems?.autoSelection?.enabledByDefault === true, "semi-auto color system auto-selection must default to enabled", failures);
  assert(config.colorSystems?.autoSelection?.planPath === "workflow/color-system-plan.json", "semi-auto config must reference the color-system plan path", failures);
  assert(config.colorSystems?.autoSelection?.selectedSystemId === colorSystemPlan.selectedSystem?.id, "semi-auto config must expose the planner-selected color system", failures);
  assert((config.colorSystems?.systems || []).some((system) => system.selectedByPlanner === true), "semi-auto config must mark the planner-selected color system", failures);
  assert((config.personalIp?.presetIdentities || []).length >= 4, "personal IP preset identities must be available", failures);
  const ipImagePolicy = config.personalIp?.imageCountPolicy || {};
  const ipScriptUnitCount = Number(ipImagePolicy.scriptUnitCount || 0);
  const ipMainSceneJobs = Number(ipImagePolicy.mainSceneJobs || ipImagePolicy.mainSceneImageJobs || 0);
  const ipVariantsPerUnit = Number(ipImagePolicy.sceneVariantsPerScriptUnit || ipImagePolicy.sceneVariantsPerPage || 0);
  const ipTargetTotal = Number(ipImagePolicy.totalPlannedImageJobs || ipImagePolicy.targetTotal || 0);
  assert(ipScriptUnitCount >= Number(config.pageEditing?.pageCount || 0), "personal IP policy must count script/voiceover units at least at page granularity", failures);
  assert(ipMainSceneJobs >= ipScriptUnitCount, "personal IP policy must plan one main image job per script/voiceover unit", failures);
  assert(ipVariantsPerUnit >= 5, "personal IP policy must plan multiple supplemental variants per script/voiceover unit", failures);
  assert(ipTargetTotal >= Number(ipImagePolicy.roleAssetMinimum || 0) + ipScriptUnitCount * (ipVariantsPerUnit + 1), "personal IP image policy must include role assets plus script-matched main and supplemental jobs", failures);
  assert(personalIpRegistry.status === "ready-existing-persona", "personal IP registry must reuse the saved persona manifest when available", failures);
  assert(personalIpRegistry.existingPersona?.available === true, "personal IP registry must mark saved persona as available", failures);
  assert(Number(personalIpRegistry.existingPersona?.assetCount || 0) >= 1, "personal IP registry must count saved persona assets", failures);
  assert(personalIpRegistry.library?.publicSkillStorageAllowed === false, "personal IP registry must forbid public Skill storage", failures);
  assert(!String(personalIpRegistry.library?.root || "").includes(".agents/skills/codex-video-workflow"), "personal IP library root must not be inside the public Skill package", failures);
	  assert(personalIpRegistry.userGuidance?.createOnceThenReuse === true, "personal IP registry must guide create-once reuse", failures);
	  assert(personalIpRegistry.reusePolicy?.useSavedPersonaWhenAvailable === true, "personal IP registry must prefer saved persona reuse", failures);
	  const nativeDirectMode = (ipPlan.executionModes || []).find((mode) => mode.id === "native-skill-direct-generation") || {};
	  const promptOnlyMode = (ipPlan.executionModes || []).find((mode) => mode.id === "prompt-only-native-handoff") || {};
	  assert(ipPlan.nativeDirectUsePlan?.selectedNow === true, "personal IP must select the native-skill-direct-generation route", failures);
	  assert(ipPlan.nativeDirectUsePlan?.requestedByPersonalIpRoute === true, "native direct route must record personal-IP trigger", failures);
	  assert(nativeDirectMode.selected === true, "execution mode native-skill-direct-generation must be selected for personal IP", failures);
	  assert(promptOnlyMode.selected !== true, "prompt-only native handoff must not be selected when personal IP native direct route is selected", failures);
	  assert(config.personalIp?.nativeDirectGeneration?.selectedNow === true, "semi-auto config must expose selected native direct generation route", failures);
	  assert((config.personalIp?.selectedExecutionModes || []).includes("native-skill-direct-generation"), "semi-auto config must list native-skill-direct-generation as selected", failures);
	  assert(config.personalIp?.userChoices?.makePersonalIp === "auto", "semi-auto config must expose makePersonalIp auto choice", failures);
	  assert(config.personalIp?.userChoices?.addHandDrawnImageAnimation === "subtle", "semi-auto config must expose subtle hand-drawn animation choice", failures);
	  assert(config.personalIp?.assetRegistry?.status === "ready-existing-persona", "semi-auto config must expose the personal IP registry status", failures);
  assert(config.personalIp?.assetRegistry?.reusePolicy?.useSavedPersonaWhenAvailable === true, "semi-auto config must expose saved-persona reuse policy", failures);
  assert((config.personalIp?.assetRegistry?.userGuidance?.acceptedInputs || []).some((input) => /photo|avatar|照片|头像/i.test(input)), "semi-auto config must guide users to provide photos or avatars", failures);
  const ipPreviewAssets = config.personalIp?.previewAssets || {};
  const officialCharacterPreview = String(ipPreviewAssets.characterSample || "");
  const officialKnowledgePreview = String(ipPreviewAssets.knowledgeCard || "");
  assert(/^assets\/ip-diagram-creator\/character-assets-sample\.(png|webp)$/.test(officialCharacterPreview), "personal IP preview must use the official ip-diagram-creator SHIN character asset sample", failures);
  assert(/^assets\/ip-diagram-creator\/knowledge-card-high-density\.(png|webp)$/.test(officialKnowledgePreview), "personal IP preview must use the official ip-diagram-creator knowledge-card sample", failures);
  assert(!officialCharacterPreview.startsWith("data:image/svg"), "personal IP character preview must not fall back to generated SVG when official assets are present", failures);
  assert(existsSync(join(out, officialCharacterPreview)), "personal IP official character preview asset must be copied into the review package", failures);
  assert(existsSync(join(out, officialKnowledgePreview)), "personal IP official knowledge preview asset must be copied into the review package", failures);
  assert(config.whiteboard?.sourceSkill === "gnipbao/codex-whiteboard-video-skill", "whiteboard adapter source must be the expected skill", failures);
  assert(config.whiteboard?.sourceEngine === "gnipbao/whiteboard-video-engine", "whiteboard engine source must be expected", failures);
  assert(config.coverModule?.autoCover?.enabledByDefault === true, "cover auto-generation must default to enabled", failures);
  assert(config.coverModule?.image2Status?.defaultCoverEngine === "image2-integrated-typography-cover", "cover config must expose the Image2 integrated typography engine", failures);
  assert(Number(config.coverModule?.image2Status?.promptCount || 0) >= 5, "cover config must expose Image2 cover prompt count", failures);
  assert((config.coverModule?.samples || []).length >= 4, "cover config must expose generated cover sample images for preview", failures);
  assert((config.coverModule?.resolutionSlides || []).length >= 4, "cover config must expose cover resolution carousel slides", failures);
  assert(config.coverModule?.showcase?.title && config.coverModule?.showcase?.hookText && config.coverModule?.showcase?.resultPromise, "cover showcase must expose a brief-derived title, hook, and result promise", failures);
  if (config.coverModule?.image2Status?.imageSource === "image2-dryrun") {
    assert(config.coverModule?.image2Status?.reviewFallbackOnly === true, "dry-run cover config must be marked review-fallback-only", failures);
    assert(config.coverModule?.image2Status?.realBitmapProviderActive === false, "dry-run cover config must not claim a real bitmap provider", failures);
  }
  assert((config.coverModule?.stylePresets || []).length >= 10, "cover config must expose professional cover design template presets", failures);
  assert((config.coverModule?.stylePresets || []).every((style) => style.logic && style.composition && (style.bestFor || []).length), "cover style presets must explain logic, composition, and content fit", failures);
  assert((config.coverModule?.stylePresets || []).filter((style) => style.selected).length === 1, "cover config must default exactly one cover style", failures);
  assert((config.coverModule?.resolutionOptions || []).length >= 8, "cover config must expose all cover resolution presets", failures);
  assert((config.coverModule?.resolutionOptions || []).every((option) => option.selected === true), "cover resolution options must default selected", failures);
  assert(config.coverModule?.creativeStrategy?.contentAssets?.coreViewpoint, "cover config must expose the click-decision content strategy", failures);
  assert(config.coverModule?.creativeStrategy?.copywriting?.hookText, "cover config must expose hook copy derived from the cover methodology", failures);
  assert(config.coverModule?.creativeStrategy?.selectedTemplate, "cover config must expose the selected cover composition template", failures);
  assert(config.coverModule?.creativeStrategy?.image2Route?.defaultCoverEngine === "image2-integrated-typography-cover", "cover strategy must keep the Image2 integrated typography route", failures);
  assert(caption.autoSubtitle?.enabledByDefault === true, "caption plan must default auto subtitle to enabled", failures);
  assert(caption.keywordHighlight?.enabledByDefault === true, "caption plan must default keyword highlight to enabled", failures);
  assert((caption.scenes || []).every((scene) => scene.emphasisPlan?.mode === "keyword-visual-emphasis"), "every caption scene must carry keyword visual emphasis plan", failures);
  assert(/data-motion-preview-modal/.test(html), "config page must contain motion preview modal", failures);
  const renderedMotionStyleCount = Number((html.match(/data-motion-style-count="(\d+)"/) || [])[1] || 0);
  assert(renderedMotionStyleCount >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `config page must render the ${MOTION_STYLE_MIN_TEMPLATE_COUNT}-template motion style catalog summary`, failures);
  assert(/motion-style-template-review\.html/.test(html), "config page must link the standalone motion style review page", failures);
  assert(/data-motion-pane="personal-ip"/.test(html) && /data-motion-pane="whiteboard"/.test(html), "personal IP and whiteboard must live inside visual motion panes", failures);
  assert(/data-ip-asset-registry/.test(html) && /data-ip-reference-upload/.test(html) && /data-ip-create-persona/.test(html) && /data-ip-reuse-persona/.test(html), "personal IP pane must expose fixed-persona upload/create/reuse controls", failures);
  assert(/<section class="panel" id="cover">/.test(html), "config page must include cover design section", failures);
  assert(/data-cover-auto-toggle/.test(html) && /data-cover-resolution-list/.test(html), "cover section must expose default auto cover and compact resolution selector", failures);
  assert(/data-cover-resolution-carousel/.test(html) && /data-cover-carousel-prev/.test(html) && /data-cover-carousel-next/.test(html) && /data-cover-slide/.test(html), "cover section must present resolution samples as a one-image carousel", failures);
  assert(/data-cover-open/.test(html) && /data-cover-preview-modal/.test(html), "cover section must expose clickable sample preview modal", failures);
  assert(!/data-cover-decision-surface/.test(html) && !/data-cover-methodology/.test(html), "cover section must keep methodology evidence out of the simplified configuration UI", failures);
  const reviewHtml = existsSync(join(out, "motion-style-template-review.html")) ? readFileSync(join(out, "motion-style-template-review.html"), "utf8") : "";
  const reviewCardCount = (reviewHtml.match(/data-style-skeleton-card/g) || []).length;
  const reviewVariantButtonCount = (reviewHtml.match(/data-style-variant-button/g) || []).length;
  const reviewVariantPanelCount = (reviewHtml.match(/data-style-variant-panel/g) || []).length;
  const reviewVideoFrameCount = (reviewHtml.match(/data-style-video-frame/g) || []).length;
  assert(reviewCardCount >= MOTION_STYLE_MIN_FAMILY_COUNT, `motion style review page must render at least ${MOTION_STYLE_MIN_FAMILY_COUNT} content skeleton cards`, failures);
  assert(reviewVariantButtonCount >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `motion style review page must expose at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} card-level style switch buttons`, failures);
  assert(reviewVariantPanelCount >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `motion style review page must keep at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} switchable variant preview panels`, failures);
  assert(/data-style-preview-modal/.test(reviewHtml) && /data-open-style-preview/.test(reviewHtml), "motion style review page must expose large preview modal controls", failures);
  assert(/style-example-code-walkthrough/.test(reviewHtml) && /style-example-formula-derivation/.test(reviewHtml) && /style-example-data-chart/.test(reviewHtml), "motion style review page must render code, formula, and data-chart previews as distinct templates", failures);
  for (const requiredKind of MOTION_STYLE_REQUIRED_CONTENT_KINDS) {
    assert(reviewHtml.includes(`style-example-${requiredKind}`) || reviewHtml.includes(`data-content-kind="${requiredKind}"`), `motion style review page must render ${requiredKind}`, failures);
  }
  assert(/<title>风格模板<\/title>/.test(reviewHtml) && !/风格模板审核/.test(reviewHtml), "motion style page must be named 风格模板 instead of 风格模板审核", failures);
  assert(reviewVideoFrameCount >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must render every variant as a simulated video frame", failures);
  assert((reviewHtml.match(/style-frame-subtitle/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style simulated frames must include real subtitle safe-area previews", failures);
  assert((reviewHtml.match(/data-style-page-shell/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must render full video-page shells for every variant", failures);
  assert((reviewHtml.match(/data-style-layout-mode=/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must expose a layout mode for every simulated video frame", failures);
  assert((reviewHtml.match(/data-style-typography-mode=/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must expose a typography mode for every simulated video frame", failures);
  assert((reviewHtml.match(/class="designed-title/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must render designed typography titles instead of plain headings", failures);
  assert((reviewHtml.match(/data-style-page-support/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must render content, interaction, and animation support layers", failures);
  assert((reviewHtml.match(/data-style-animation-track/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion style page must render animation tracks for every variant", failures);
  assert((reviewHtml.match(/data-style-quality-check/g) || []).length >= MOTION_STYLE_MIN_TEMPLATE_COUNT * 3, "motion style page must render page-quality checks instead of simple color-only cards", failures);
  assert(/layout-data-stage/.test(reviewHtml) && /layout-coordinate-stage/.test(reviewHtml) && /layout-full-poster/.test(reviewHtml) && /layout-math-canvas/.test(reviewHtml), "motion style page must include full-screen data, coordinate, poster, and math layout modes", failures);
  assert(/mode-data-mono/.test(reviewHtml) && /mode-math-coordinate/.test(reviewHtml) && /mode-kinetic-poster/.test(reviewHtml) && /mode-editorial-display/.test(reviewHtml), "motion style page must include diverse typography modes", failures);
  assert(/World Bank GDP/.test(reviewHtml) && /美国/.test(reviewHtml) && /中国/.test(reviewHtml) && /印度/.test(reviewHtml), "data-chart template must use a real multi-country GDP curve example", failures);
  assert(/X 轴/.test(reviewHtml) && /Y 轴/.test(reviewHtml) && /目标象限/.test(reviewHtml), "coordinate template must render a real XY-axis decision scene", failures);
  assert(/y = ax\^2 \+ bx \+ c/.test(reviewHtml) && /y' = 2ax \+ b/.test(reviewHtml), "formula template must render a real derivation scene", failures);
  assert(/data-style-capability-set=/.test(reviewHtml) && /视频素材/.test(reviewHtml) && /个人 IP/.test(reviewHtml) && /白板描线/.test(reviewHtml), "motion style simulated frames must show supported material, personal-IP, and whiteboard capabilities", failures);
  assert(/data-style-preview-video-use/.test(reviewHtml) && /data-style-preview-interaction/.test(reviewHtml) && /data-style-preview-animation/.test(reviewHtml) && /data-style-preview-benchmark/.test(reviewHtml) && /data-style-preview-capabilities/.test(reviewHtml), "motion style preview modal must expose video-use, interaction, benchmark, animation, and capability detail fields", failures);
  assert(!/<section class="panel" id="ip"/.test(html) && !/<section class="panel" id="whiteboard"/.test(html), "config page must not keep separate IP/whiteboard sections", failures);
  assert((html.match(/data-caption-signature=/g) || []).length >= 68, "caption style previews must expose unique signatures", failures);
  assert(/data-color-auto-toggle/.test(html) && /workflow\/color-system-plan\.json/.test(html), "config page must expose automatic color-system planning controls", failures);
  assert(!/\b(Vue(?:\.js)?|React(?:\.js)?|Next(?:\.js)?|Tailwind|GSAP|Three(?:\.js)?)\b/.test(html), "config page must not show implementation technology labels", failures);
  return { manifest, config, generation };
}

function validateFullAutoPackage(out, briefPath, failures) {
  const required = [
    "final.mp4",
    "renders/final.mp4",
    "delivery.html",
    "delivery-manifest.json",
    "logs/qc.json",
    "logs/ffprobe.json",
    "logs/blackdetect.log",
    "logs/volumedetect.log",
    "logs/silencedetect.log",
    "script/subtitles.srt",
    "script/subtitle-cue-narration-segments.json",
    "workflow/generation-mode-contract.json",
    "workflow/caption-style-plan.json",
    "workflow/motion-template-selection.json",
    "workflow/motion-style-template-selection.json",
    "workflow/motion-style-plan.json",
    "workflow/color-system-plan.json",
    "workflow/ip-diagram-creator-plan.json",
    "workflow/personal-ip-asset-registry.json",
    "workflow/ip-diagram-creator-native-jobs.json",
    "workflow/ip-diagram-layout-audit.json",
    "workflow/skill-usage-accuracy-audit.json",
    "workflow/quality-consistency-contract.json",
    "workflow/page-decision-contract.json",
    "workflow/voice-subtitle-manifest.json",
    "workflow/html-video-render.json",
    "workflow/cover-design.json",
    "workflow/cover-image2-prompts.json",
    "workflow/cover-size-selection.json",
    "最终成品",
  ];
  for (const file of required) assert(existsSync(join(out, file)), `missing full-auto artifact: ${file}`, failures);
  if (!existsSync(join(out, "logs", "qc.json"))) return {};
  const qc = readJson(join(out, "logs", "qc.json"));
  const generation = readJson(join(out, "workflow", "generation-mode-contract.json"));
  const caption = readJson(join(out, "workflow", "caption-style-plan.json"));
  const motionSelection = readJson(join(out, "workflow", "motion-template-selection.json"));
  const motionStyleTemplateSelection = readJson(join(out, "workflow", "motion-style-template-selection.json"));
  const motionStylePlan = readJson(join(out, "workflow", "motion-style-plan.json"));
  const colorSystemPlan = readJson(join(out, "workflow", "color-system-plan.json"));
  const ipPlan = readJson(join(out, "workflow", "ip-diagram-creator-plan.json"));
  const personalIpRegistry = readJson(join(out, "workflow", "personal-ip-asset-registry.json"));
  const skillUsageAudit = readJson(join(out, "workflow", "skill-usage-accuracy-audit.json"));
  const quality = readJson(join(out, "workflow", "quality-consistency-contract.json"));
  const pageDecision = readJson(join(out, "workflow", "page-decision-contract.json"));
  const coverDesign = readJson(join(out, "workflow", "cover-design.json"));
  const coverSizeSelection = readJson(join(out, "workflow", "cover-size-selection.json"));
  const ffprobe = readJson(join(out, "logs", "ffprobe.json"));
  assert(qc.pass === true, "full-auto qc must pass", failures);
  assert(qc.renderer === "html-video", "full-auto renderer must be html-video", failures);
  assert(qc.checks?.hasVideo === true && qc.checks?.hasAudio === true, "full-auto MP4 must have video and audio", failures);
  assert(qc.checks?.audibleAudio === true, "full-auto MP4 must have audible audio", failures);
  assert(qc.checks?.voiceBackendCompliant === true, "full-auto voice backend must be local-policy compliant", failures);
  assert(qc.checks?.visualSubtitleSingleLine === true, "full-auto subtitles must remain one-line sequential", failures);
  assert(qc.checks?.motionStyleTemplateSelectionPresent === true, "motion style template selection presence check must pass", failures);
  assert(qc.checks?.motionStylePlanPresent === true, "motion style plan presence check must pass", failures);
  assert(qc.checks?.motionStylePlanEnforced === true, "motion style plan enforcement check must pass", failures);
  assert(qc.checks?.premiumPaletteApplied === true, "full-auto QC must pass planner auto color-system gate", failures);
  assert(qc.checks?.qualityConsistencyContractEnforced === true, "quality consistency contract must be enforced", failures);
  assert(qc.checks?.skillUsageAccuracyAuditPass === true, "full-auto skill usage audit must pass", failures);
  assert(qc.checks?.personalIpNativeSourceRouteSatisfied === true, "full-auto personal-IP native source route must be satisfied", failures);
  assert(qc.checks?.frameAudioTimingBound === true, "frame/audio timing must be bound", failures);
  assert(ipPlan.active === true, "full-auto smoke must activate ip-diagram-creator for personal IP", failures);
  assert(ipPlan.nativeDirectUsePlan?.selectedNow === true, "full-auto personal IP must select native-skill-direct-generation", failures);
  assert(ipPlan.nativeDirectUsePlan?.requestedByPersonalIpRoute === true, "full-auto native direct route must be triggered by personal IP", failures);
  assert(ipPlan.nativeDirectUsePlan?.personaOnboardingRequired !== true, "full-auto personal IP must not proceed without a ready persona", failures);
  assert(personalIpRegistry.status === "ready-existing-persona", "full-auto personal IP must reuse a saved persona manifest", failures);
  assert((ipPlan.executionModes || []).some((mode) => mode.id === "native-skill-direct-generation" && mode.selected === true), "full-auto selected execution modes must include native-skill-direct-generation", failures);
  assert(generation.selectedMode === "full-auto", "full-auto package must select full-auto mode", failures);
  assert(generation.defaultMode === "semi-auto", "full-auto run must keep ordinary topic/script intake defaulting to semi-auto config", failures);
  assert(Number(generation.capabilityInventory?.motionStyleTemplateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `full-auto generation contract must advertise the ${MOTION_STYLE_MIN_TEMPLATE_COUNT}-template motion style catalog`, failures);
  assert(generation.semiAutoPipeline?.configurationSurface?.sections?.colorSystem?.mode === "auto-by-default", "full-auto generation contract must advertise auto color-system planning", failures);
  assert(colorSystemPlan.status === "auto-color-system-plan" && colorSystemPlan.mode === "auto-by-default", "full-auto package must include the auto color-system plan", failures);
  assert(colorSystemPlan.selectedSystem?.id && (colorSystemPlan.selectedSystem?.colors || []).length >= 4, "full-auto color-system plan must select a usable palette", failures);
  assert(quality.consistencyAnchors?.colorSystem?.id === colorSystemPlan.selectedSystem?.id, "quality contract must anchor the planner-selected color system", failures);
  assert(Number(motionSelection.motionStyleCatalog?.totalTemplateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion template selection must include the full style catalog", failures);
  assert(motionSelection.motionStyleTemplateSelectionFile === "workflow/motion-style-template-selection.json", "motion template selection must link the reusable template selection artifact", failures);
  assert(motionSelection.motionStyleTemplateLibrary?.selectionStatus === "active-motion-style-template-selection", "motion template selection must expose an active reusable template selection status", failures);
  assert(Number(motionSelection.motionStyleTemplateLibrary?.templateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "motion template selection must expose the reusable style library", failures);
  assert((motionSelection.sceneMotionStyles || []).length >= (generation.capabilityInventory?.selectedSceneMotionStyles || []).length, "motion template selection must list selected scene motion styles", failures);
  assert(motionStyleTemplateSelection.status === "active-motion-style-template-selection", "full-auto package must write an active motion style template selection", failures);
  assert(motionStyleTemplateSelection.templateLibrary === "assets/motion-style-template-library.json", "full-auto motion style template selection must reference the reusable template library", failures);
  assert(motionStyleTemplateSelection.designSpec === "references/motion-style-template-design-spec.md", "full-auto motion style template selection must reference the design spec", failures);
  assert(Number(motionStyleTemplateSelection.libraryCoverage?.templateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "full-auto motion style template selection must report full library coverage", failures);
  assert((motionStyleTemplateSelection.sceneSelections || []).length >= (generation.capabilityInventory?.selectedSceneMotionStyles || []).length, "full-auto template selection must bind every scene", failures);
  assert((motionStyleTemplateSelection.sceneSelections || []).every((selection) => selection.selectedTemplateId && selection.libraryTemplateFound === true && selection.contentKind && selection.layoutContract?.blueprint && selection.typographyContract?.exactTextOwner === "deterministic HTML/SVG/CSS layers" && (selection.motionContract?.animationSteps || []).length >= 3 && selection.dataAccuracyContract?.rule && selection.assetTaskContract?.imageGenerationPolicy), "full-auto template selection must include reusable layout/type/motion/data/asset contracts per scene", failures);
  assert(motionStylePlan.status === "active-motion-style-plan", "full-auto motion style plan must be active", failures);
  assert(Number(motionStylePlan.totalTemplateCount || 0) >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `full-auto motion style plan must include at least ${MOTION_STYLE_MIN_TEMPLATE_COUNT} available templates`, failures);
  assert((motionStylePlan.sceneStyles || []).every((scene) => scene.styleTemplateId && scene.selectedTemplate && scene.captionSafeArea && scene.animationSteps?.length >= 3), "full-auto motion style plan must bind every scene with safe-area and steps", failures);
  assert(motionStylePlan.contentDrivenGenerationMethodology?.source === "haloshin/ip-diagram-creator", "full-auto motion style plan must keep the ip-diagram content-to-image methodology", failures);
  assert((motionStylePlan.sceneStyles || []).every((scene) => scene.contentDrivenLayoutPlan?.pageCard?.layoutBlueprint && (scene.contentDrivenLayoutPlan?.imageResourcePlan || []).length >= 4 && (scene.contentDrivenLayoutPlan?.animationLayerPlan || []).length >= 4), "full-auto motion style scenes must expose content-driven layout and animation layers", failures);
  assert((quality.hardGates || []).includes("motionStyleTemplateSelectionPresent") && (quality.hardGates || []).includes("motionStylePlanPresent") && (quality.hardGates || []).includes("motionStylePlanEnforced"), "quality contract must hard-gate motion style template selection and plan enforcement", failures);
  assert((quality.requiredArtifacts || []).includes("workflow/motion-style-template-selection.json"), "quality contract must require motion style template selection", failures);
  assert((pageDecision.pages || []).every((page) => page.animationAnswer?.motionStyleTemplateId && page.animationAnswer?.videoLevelMotionPlan === "workflow/motion-style-plan.json"), "page decision contract must expose per-page motion style decisions", failures);
  assert(caption.autoSubtitle?.enabledByDefault === true, "full-auto caption plan must keep auto subtitle enabled", failures);
  assert(caption.keywordHighlight?.enabledByDefault === true, "full-auto caption plan must keep keyword highlight enabled", failures);
  assert((caption.scenes || []).every((scene) => scene.selectedStyleId && scene.emphasisPlan?.mode === "keyword-visual-emphasis"), "full-auto caption scenes must include selected style and keyword emphasis plan", failures);
  const streams = ffprobe.streams || [];
  const videoStream = streams.find((stream) => stream.codec_type === "video") || {};
  const audioStream = streams.find((stream) => stream.codec_type === "audio") || {};
  assert(Number(videoStream.width) === 1920 && Number(videoStream.height) === 1080, "full-auto MP4 must render 1920x1080 horizontal video", failures);
  assert(Boolean(audioStream.codec_name), "full-auto MP4 must include an audio codec", failures);
  assert(coverDesign.defaultCoverEngine === "image2-integrated-typography-cover", "cover design must use the current automatic cover engine", failures);
  assert((coverDesign.resolutionPresets || []).length >= 8, "cover design must expose at least 8 resolution presets", failures);
  assert(coverDesign.resolutionPresets.some((target) => target.width === 3840 && target.height === 2160), "cover design must include 2K/4K-style horizontal preset", failures);
  assert(coverDesign.coverSizeSelectionFile === "workflow/cover-size-selection.json", "cover design must link cover-size-selection artifact", failures);
  assert(coverSizeSelection.finalDeliveryDirectory === "最终成品", "cover size selection must deliver covers into the final user-facing directory", failures);
  assert((coverSizeSelection.entries || []).length >= 9, "cover size selection must list upload-ready selection entries", failures);
  assert(coverSizeSelection.humanSelectionContainsOnlyUploadReady === true, "cover size selection must protect the upload-ready human selection policy", failures);
  assert(coverSizeSelection.nonUploadReadyVisualFilesCopied === false, "non-upload-ready cover previews must not be mixed into the final upload-choice directory", failures);
  assert(readdirSync(join(out, "cover")).some((name) => /\.(png|jpg|jpeg|webp|svg)$/i.test(name)), "cover artifact directory must contain viewable cover images", failures);
  assert(existsSync(join(out, "最终成品", "封面尺寸说明.md")), "final delivery directory must contain cover size guidance", failures);
  const frameFiles = frameHtmlFiles(out);
  assert(frameFiles.length >= 3, "full-auto render must produce frame HTML files", failures);
  const ipFrameHtml = frameFiles.map((file) => readFileSync(file, "utf8"));
  const ipBoardFrameCount = ipFrameHtml.filter((html) => /class="[^"]*\bip-diagram-board\b/.test(html)).length;
  const personaFrameCount = ipFrameHtml.filter((html) => /class="[^"]*\bip-persona-scene\b/.test(html)).length;
  const agentFrameCount = ipFrameHtml.filter((html) => /class="[^"]*\bip-agent-row\b/.test(html)).length;
  assert(ipBoardFrameCount === frameFiles.length, "full-auto personal-IP video must render an IP diagram board in every frame", failures);
  assert(personaFrameCount === frameFiles.length, "full-auto personal-IP video must render a persona scene in every frame", failures);
  assert(agentFrameCount === frameFiles.length, "full-auto personal-IP video must render execution Agent rows in every frame", failures);
  assert(Number(skillUsageAudit.renderedEvidence?.ipDiagramBoardCount || 0) >= frameFiles.length, "skill usage audit must count rendered IP diagram boards", failures);
  assert(Number(skillUsageAudit.renderedEvidence?.ipTemplateAdaptationCount || 0) >= frameFiles.length, "skill usage audit must count rendered IP template adaptations", failures);
  const visibleFrameText = frameFiles.map((file) => visibleTextFromHtml(readFileSync(file, "utf8"))).join("\n");
  assert(!/\b(Vue(?:\.js)?|React(?:\.js)?|Next(?:\.js)?|Tailwind|GSAP|Three(?:\.js)?|renderer|local render|QC)\b/i.test(visibleFrameText), "viewer frames must not expose implementation/debug labels", failures);
  return { qc, generation, caption, briefPath };
}

async function loadPlaywright() {
  const candidates = [
    join(workspace, "node_modules", "playwright", "index.mjs"),
    "/Users/example/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Playwright is not available in workspace or bundled Codex runtime");
  return import(pathToFileURL(found).href);
}

async function validateSemiAutoBrowser(out, screenshotDir, failures) {
  const { chromium } = await loadPlaywright();
  ensureDir(screenshotDir);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1516, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(join(out, "semi-auto-config.html")).href, { waitUntil: "load" });
	    const initial = await page.evaluate(() => ({
	      autoCaption: document.querySelector("[data-auto-caption-toggle]")?.checked === true,
	      keywordHighlight: document.querySelector("[data-keyword-highlight-toggle]")?.checked === true,
	      motionStyleCount: Number(document.querySelector("[data-motion-style-count]")?.getAttribute("data-motion-style-count") || 0),
	      motionCards: document.querySelectorAll("[data-motion-preview-card]").length,
	      captionRows: document.querySelectorAll(".caption-row").length,
	      coverAuto: document.querySelector("[data-cover-auto-toggle]")?.checked === true,
	      coverSamples: document.querySelectorAll("[data-cover-slide]").length,
	      coverCarousel: Boolean(document.querySelector("[data-cover-resolution-carousel]")),
	      coverResolutions: document.querySelectorAll("input[name=\"cover-resolution\"]").length,
	      selectedCoverResolutions: document.querySelectorAll("input[name=\"cover-resolution\"]:checked").length,
	      colorAuto: document.querySelector("[data-color-auto-toggle]")?.checked === true,
	      plannerPaletteRows: document.querySelectorAll(".palette-row[data-planner-selected=\"true\"]").length,
	      selectedPlannerPaletteRows: document.querySelectorAll(".palette-row[data-planner-selected=\"true\"].selected").length,
	      monoPaletteRows: document.querySelectorAll(".palette-row[data-palette-mode=\"mono\"]").length,
	      motionStyleReviewLink: document.querySelector(".motion-style-review-link")?.getAttribute("href") || "",
	      ipPreviewImageSrc: document.querySelector(".ip-gallery-slide img")?.getAttribute("src") || "",
	      ipPreviewNaturalWidth: document.querySelector(".ip-gallery-slide img")?.naturalWidth || 0,
	      ipPreviewNaturalHeight: document.querySelector(".ip-gallery-slide img")?.naturalHeight || 0,
	      overflowCount: [...document.querySelectorAll("body *")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible").length,
	    }));
	    assert(initial.autoCaption, "browser: auto subtitle toggle must be checked", failures);
	    assert(initial.keywordHighlight, "browser: keyword highlight toggle must be checked", failures);
	    assert(initial.motionStyleCount >= MOTION_STYLE_MIN_TEMPLATE_COUNT, `browser: ${MOTION_STYLE_MIN_TEMPLATE_COUNT}-template motion style catalog count must be rendered`, failures);
	    assert(initial.motionCards >= 20, "browser: motion preview cards must be visible", failures);
	    assert(initial.captionRows >= 68, "browser: caption rows must be visible", failures);
	    assert(initial.coverAuto, "browser: automatic cover switch must be checked", failures);
	    assert(initial.coverCarousel && initial.coverSamples >= 4, "browser: cover resolution carousel slides must be visible", failures);
	    assert(initial.coverResolutions >= 8 && initial.coverResolutions === initial.selectedCoverResolutions, "browser: cover resolution presets must default all selected", failures);
	    assert(initial.colorAuto, "browser: color-system auto-selection toggle must be checked", failures);
	    assert(initial.plannerPaletteRows === 1 && initial.selectedPlannerPaletteRows === 1, "browser: planner-selected color system must be selected", failures);
	    assert(initial.monoPaletteRows >= 16, "browser: mono palette tab must include expanded mono color systems", failures);
	    assert(initial.motionStyleReviewLink === "motion-style-template-review.html", "browser: config page must link the motion style review page", failures);
	    assert(/^assets\/ip-diagram-creator\/character-assets-sample\.(png|webp)$/.test(initial.ipPreviewImageSrc), "browser: personal IP default preview must render the official ip-diagram-creator SHIN character asset", failures);
	    assert(initial.ipPreviewNaturalWidth > 0 && initial.ipPreviewNaturalHeight > 0, "browser: personal IP default preview image must decode to visible pixels", failures);
	    assert(initial.overflowCount === 0, "browser: config page must not have visible horizontal overflow", failures);
    await page.screenshot({ path: join(screenshotDir, "01-initial-motion.png"), fullPage: false });
    if (!(await page.locator("[data-feature-toggle=\"motion\"]").isChecked())) {
      await page.click("[data-feature-toggle=\"motion\"]");
    }
    await page.click("[data-motion-pane-tab=\"motion\"]");
    const firstPreviewButton = page.locator("[data-open-motion-preview]").first();
    await firstPreviewButton.scrollIntoViewIfNeeded();
    await firstPreviewButton.click();
    await page.waitForTimeout(250);
    const modal = await page.evaluate(() => ({
      open: document.querySelector("[data-motion-preview-modal]")?.open === true,
      title: document.querySelector("[data-motion-preview-title]")?.textContent || "",
      hasPreview: Boolean(document.querySelector("[data-motion-preview-frame] .motion-preview, [data-motion-preview-frame] .capability-motion-preview")),
    }));
    assert(modal.open && modal.hasPreview, "browser: large motion preview modal must open with preview content", failures);
    await page.screenshot({ path: join(screenshotDir, "02-motion-modal.png"), fullPage: false });
    await page.keyboard.press("Escape");
	    const personalIpToggle = page.locator("[data-feature-toggle=\"personal-ip\"]").first();
	    if (!(await personalIpToggle.isChecked())) await personalIpToggle.click();
	    await page.click("[data-motion-pane-tab=\"personal-ip\"]");
	    const afterPersonalIp = await page.evaluate(() => ({
      motion: document.querySelector("[data-feature-toggle=\"motion\"]")?.checked === true,
      personalIp: document.querySelector("[data-feature-toggle=\"personal-ip\"]")?.checked === true,
      whiteboard: document.querySelector("[data-feature-toggle=\"whiteboard\"]")?.checked === true,
	      visiblePane: [...document.querySelectorAll("[data-motion-pane]")].filter((el) => !el.hidden).map((el) => el.getAttribute("data-motion-pane")),
	      ipCountText: document.querySelector("[data-ip-image-count-policy]")?.innerText || "",
	      visibleIpSourceCards: [...document.querySelectorAll("[data-motion-pane=\"personal-ip\"] .ip-source-card")].filter((el) => el.offsetParent !== null).length,
	      ipGalleryHeight: Math.round(document.querySelector("[data-motion-pane=\"personal-ip\"] .ip-gallery")?.getBoundingClientRect().height || 0),
	      ipModeListHeight: Math.round(document.querySelector("[data-motion-pane=\"personal-ip\"] .ip-mode-list")?.getBoundingClientRect().height || 0),
	      selectedIdentityCount: document.querySelectorAll(".ip-identity-card.selected").length,
	      assetRegistryStatus: document.querySelector("[data-ip-asset-registry]")?.getAttribute("data-ip-registry-status") || "",
	      assetRegistryText: document.querySelector("[data-ip-asset-registry]")?.innerText || "",
	      hasAssetUpload: Boolean(document.querySelector("[data-ip-reference-upload]")),
	      hasCreatePersona: Boolean(document.querySelector("[data-ip-create-persona]")),
	      hasReusePersona: Boolean(document.querySelector("[data-ip-reuse-persona]")),
	    }));
    assert(afterPersonalIp.motion === true && afterPersonalIp.personalIp === true, "browser: personal IP must remain compatible with motion", failures);
    assert(afterPersonalIp.whiteboard === true, "browser: whiteboard must remain compatible with personal IP", failures);
    assert(afterPersonalIp.visiblePane.includes("personal-ip"), "browser: selecting personal IP must switch to personal IP pane", failures);
	    assert(/口播匹配单元：\s*[1-9]\d*/.test(afterPersonalIp.ipCountText) && /每单元补充：\s*[5-9]\d*/.test(afterPersonalIp.ipCountText), "browser: personal IP pane must show script-matched image planning", failures);
	    assert(afterPersonalIp.visibleIpSourceCards === 0, "browser: personal IP pane must not show redundant source/preset explanation cards", failures);
	    assert(afterPersonalIp.ipGalleryHeight > 0 && afterPersonalIp.ipModeListHeight > 0 && Math.abs(afterPersonalIp.ipGalleryHeight - afterPersonalIp.ipModeListHeight) <= 180, "browser: personal IP preview and config columns should be visually height-aligned", failures);
	    assert(afterPersonalIp.selectedIdentityCount === 1, "browser: exactly one personal IP identity must be selected", failures);
	    assert(afterPersonalIp.assetRegistryStatus === "ready-existing-persona", "browser: personal IP pane must show saved persona registry status", failures);
	    assert(afterPersonalIp.hasAssetUpload && afterPersonalIp.hasCreatePersona && afterPersonalIp.hasReusePersona, "browser: personal IP pane must expose upload/create/reuse controls", failures);
	    assert(/固定人设物料库/.test(afterPersonalIp.assetRegistryText) && /已读取固定人设/.test(afterPersonalIp.assetRegistryText), "browser: personal IP registry copy must guide fixed persona reuse", failures);
    await page.locator(".ip-composite-grid").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(screenshotDir, "03-personal-ip-pane.png"), fullPage: false });
	    await page.click("[data-motion-pane-tab=\"motion\"]");
    const afterMotion = await page.evaluate(() => ({
      motion: document.querySelector("[data-feature-toggle=\"motion\"]")?.checked === true,
      personalIp: document.querySelector("[data-feature-toggle=\"personal-ip\"]")?.checked === true,
      whiteboard: document.querySelector("[data-feature-toggle=\"whiteboard\"]")?.checked === true,
      visiblePane: [...document.querySelectorAll("[data-motion-pane]")].filter((el) => !el.hidden).map((el) => el.getAttribute("data-motion-pane")),
    }));
    assert(afterMotion.motion === true && afterMotion.personalIp === true, "browser: motion and personal IP must remain combinable", failures);
    assert(afterMotion.whiteboard === true && afterMotion.visiblePane.includes("motion"), "browser: motion plus whiteboard combination must be valid", failures);
    await page.click("[data-motion-pane-tab=\"whiteboard\"]");
    await page.locator(".whiteboard-layout").scrollIntoViewIfNeeded();
    const whiteboard = await page.evaluate(() => ({
      hasVideo: Boolean(document.querySelector("[data-whiteboard-skill-preview] video")),
      sourceText: document.querySelector(".whiteboard-layout")?.innerText || "",
    }));
    assert(whiteboard.hasVideo, "browser: whiteboard pane must render a video preview", failures);
	    assert(/codex-whiteboard-video-skill/.test(whiteboard.sourceText) && /whiteboard-video-engine/.test(whiteboard.sourceText), "browser: whiteboard pane must show correct adapter and engine", failures);
	    await page.screenshot({ path: join(screenshotDir, "04-whiteboard-pane.png"), fullPage: false });
	    await page.locator("#cover").scrollIntoViewIfNeeded();
	    const cover = await page.evaluate(() => {
	      return {
	        autoCover: document.querySelector("[data-cover-auto-toggle]")?.checked === true,
	        resolutionCount: document.querySelectorAll("input[name=\"cover-resolution\"]").length,
	        selectedResolutionCount: document.querySelectorAll("input[name=\"cover-resolution\"]:checked").length,
	        carouselSlideCount: document.querySelectorAll("[data-cover-slide]").length,
	        carouselTitle: document.querySelector("[data-cover-carousel-title]")?.textContent || "",
	        carouselImageSrc: document.querySelector("[data-cover-carousel-image]")?.getAttribute("src") || "",
	        hasOldMethodology: Boolean(document.querySelector("[data-cover-methodology], [data-cover-decision-surface]")),
	        hasCompactOptions: Boolean(document.querySelector(".cover-options-panel [data-cover-auto-toggle]") && document.querySelector(".cover-ratio-compact")),
	      };
	    });
	    assert(cover.autoCover, "browser: cover pane must keep automatic cover enabled", failures);
	    assert(cover.hasCompactOptions && !cover.hasOldMethodology, "browser: cover pane must use the simplified final-preview plus compact options layout", failures);
	    assert(cover.resolutionCount >= 8 && cover.resolutionCount === cover.selectedResolutionCount, "browser: cover pane must keep all resolutions selected by default", failures);
	    assert(cover.carouselSlideCount >= 4 && /\.(png|jpe?g|webp|svg)$/i.test(cover.carouselImageSrc), "browser: cover pane must expose a real one-image resolution carousel", failures);
	    await page.locator("[data-cover-carousel-next]").click();
	    await page.waitForTimeout(80);
	    const coverCarouselAfterNext = await page.evaluate(() => ({
	      title: document.querySelector("[data-cover-carousel-title]")?.textContent || "",
	      imageSrc: document.querySelector("[data-cover-carousel-image]")?.getAttribute("src") || "",
	      activeSlides: document.querySelectorAll("[data-cover-slide].active").length,
	    }));
	    assert(coverCarouselAfterNext.activeSlides === 1 && (coverCarouselAfterNext.title !== cover.carouselTitle || coverCarouselAfterNext.imageSrc !== cover.carouselImageSrc), "browser: cover resolution carousel next button must switch the visible cover", failures);
	    await page.locator("[data-cover-carousel-open]").click();
	    await page.waitForTimeout(150);
	    const coverModal = await page.evaluate(() => ({
	      open: document.querySelector("[data-cover-preview-modal]")?.open === true,
	      imageSrc: document.querySelector("[data-cover-preview-image]")?.getAttribute("src") || "",
	      title: document.querySelector("[data-cover-preview-title]")?.textContent || "",
	    }));
	    assert(coverModal.open && /\.(png|jpe?g|webp|svg)$/i.test(coverModal.imageSrc), "browser: cover sample modal must open with a real cover image", failures);
	    await page.screenshot({ path: join(screenshotDir, "05-cover-modal.png"), fullPage: false });
	    await page.keyboard.press("Escape");
	    await page.screenshot({ path: join(screenshotDir, "05-cover-pane.png"), fullPage: false });
	    await page.goto(pathToFileURL(join(out, "motion-style-template-review.html")).href, { waitUntil: "load" });
	    const reviewInitial = await page.evaluate(() => ({
	      cards: document.querySelectorAll("[data-style-skeleton-card]").length,
	      visibleCards: [...document.querySelectorAll("[data-style-review-card]")].filter((card) => !card.hidden).length,
	      familyButtons: document.querySelectorAll("[data-style-filter-family]").length,
	      variantButtons: document.querySelectorAll("[data-style-variant-button]").length,
	      variantPanels: document.querySelectorAll("[data-style-variant-panel]").length,
	      contentKinds: new Set([...document.querySelectorAll("[data-style-review-card]")].map((card) => card.getAttribute("data-content-kind")).filter(Boolean)).size,
	      hasCodePreview: Boolean(document.querySelector(".style-example-code-walkthrough")),
	      hasFormulaPreview: Boolean(document.querySelector(".style-example-formula-derivation")),
	      hasDataPreview: Boolean(document.querySelector(".style-example-data-chart")),
	      requiredContentKinds: [...new Set([...document.querySelectorAll("[data-style-review-card]")].map((card) => card.getAttribute("data-content-kind")).filter(Boolean))],
	      title: document.title,
	      oldAuditCopy: document.body.textContent.includes("风格模板审核"),
	      videoFrames: document.querySelectorAll("[data-style-video-frame]").length,
	      subtitleFrames: document.querySelectorAll(".style-frame-subtitle").length,
	      pageShells: document.querySelectorAll("[data-style-page-shell]").length,
	      layoutModes: [...new Set([...document.querySelectorAll("[data-style-page-shell]")].map((shell) => shell.getAttribute("data-style-layout-mode")).filter(Boolean))],
	      typographyModes: [...new Set([...document.querySelectorAll("[data-style-page-shell]")].map((shell) => shell.getAttribute("data-style-typography-mode")).filter(Boolean))],
	      designedTitles: document.querySelectorAll(".designed-title[data-designed-title]").length,
	      realDataLabels: document.body.textContent.includes("World Bank GDP") && document.body.textContent.includes("美国") && document.body.textContent.includes("中国") && document.body.textContent.includes("印度"),
	      realCoordinateLabels: document.body.textContent.includes("X 轴") && document.body.textContent.includes("Y 轴") && document.body.textContent.includes("目标象限"),
	      realFormulaLabels: document.body.textContent.includes("y = ax^2 + bx + c") && document.body.textContent.includes("y' = 2ax + b"),
	      supportLayers: document.querySelectorAll("[data-style-page-support]").length,
	      animationTracks: document.querySelectorAll("[data-style-animation-track]").length,
	      qualityChecks: document.querySelectorAll("[data-style-quality-check]").length,
	      capabilityFrames: document.querySelectorAll("[data-style-capability-set]").length,
	      benchmarkFrames: document.querySelectorAll("[data-style-benchmark]").length,
	      capabilityText: [...document.querySelectorAll("[data-style-capability-set]")].map((el) => el.getAttribute("data-style-capability-set") || "").join("\n"),
	      subtitleCollisions: (() => {
	        const overlaps = (a, b) => a && b && a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
	        const shells = [...document.querySelectorAll("[data-style-review-card]:not([hidden]) [data-style-variant-panel]:not([hidden]) [data-style-page-shell]")].filter((shell) => shell.getClientRects().length);
	        return shells.flatMap((shell, index) => {
	          const subtitle = shell.querySelector(".style-frame-subtitle")?.getBoundingClientRect();
	          return [".style-page-support", ".style-frame-steps", ".style-quality-strip"].flatMap((selector) => {
	            const target = shell.querySelector(selector)?.getBoundingClientRect();
	            return overlaps(subtitle, target) ? [`${index}:${selector}`] : [];
	          });
	        });
	      })(),
	      overflowCount: [...document.querySelectorAll("body *")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible").length,
	    }));
	    assert(reviewInitial.cards >= MOTION_STYLE_MIN_FAMILY_COUNT && reviewInitial.visibleCards >= MOTION_STYLE_MIN_FAMILY_COUNT, `browser: motion style review page must show ${MOTION_STYLE_MIN_FAMILY_COUNT} content skeleton cards by default`, failures);
	    assert(reviewInitial.familyButtons >= MOTION_STYLE_MIN_FAMILY_COUNT + 1 && reviewInitial.variantButtons >= MOTION_STYLE_MIN_TEMPLATE_COUNT && reviewInitial.variantPanels >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "browser: motion style review page must expose family filters plus card-level variant buttons", failures);
	    assert(reviewInitial.contentKinds >= MOTION_STYLE_MIN_CONTENT_KIND_COUNT, `browser: motion style review page must expose ${MOTION_STYLE_MIN_CONTENT_KIND_COUNT} content-specific preview kinds`, failures);
	    for (const requiredKind of MOTION_STYLE_REQUIRED_CONTENT_KINDS) {
	      assert(reviewInitial.requiredContentKinds.includes(requiredKind), `browser: motion style review page must include ${requiredKind}`, failures);
	    }
	    assert(reviewInitial.hasCodePreview && reviewInitial.hasFormulaPreview && reviewInitial.hasDataPreview, "browser: motion style review page must include code, formula, and data-chart preview layouts", failures);
	    assert(reviewInitial.title === "风格模板" && reviewInitial.oldAuditCopy === false, "browser: motion style page must be named 风格模板", failures);
	    assert(reviewInitial.videoFrames >= MOTION_STYLE_MIN_TEMPLATE_COUNT && reviewInitial.subtitleFrames >= MOTION_STYLE_MIN_TEMPLATE_COUNT && reviewInitial.capabilityFrames >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "browser: motion style page must render every variant as a simulated video frame with subtitle and capability data", failures);
	    assert(reviewInitial.benchmarkFrames >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "browser: motion style page must keep horizontal benchmark metadata on every variant", failures);
	    assert(reviewInitial.layoutModes.length >= 8 && reviewInitial.typographyModes.length >= 8 && reviewInitial.designedTitles >= MOTION_STYLE_MIN_TEMPLATE_COUNT, "browser: motion style page must render diverse layout and designed typography modes", failures);
	    assert(reviewInitial.layoutModes.includes("data-stage") && reviewInitial.layoutModes.includes("coordinate-stage") && reviewInitial.layoutModes.includes("full-poster") && reviewInitial.layoutModes.includes("math-canvas"), "browser: motion style page must expose data, coordinate, full-poster, and math-canvas layouts", failures);
	    assert(reviewInitial.realDataLabels && reviewInitial.realCoordinateLabels && reviewInitial.realFormulaLabels, "browser: motion style examples must contain real GDP, XY-axis, and formula derivation scenes", failures);
	    assert(reviewInitial.pageShells >= MOTION_STYLE_MIN_TEMPLATE_COUNT && reviewInitial.supportLayers >= MOTION_STYLE_MIN_TEMPLATE_COUNT && reviewInitial.animationTracks >= MOTION_STYLE_MIN_TEMPLATE_COUNT && reviewInitial.qualityChecks >= MOTION_STYLE_MIN_TEMPLATE_COUNT * 3, "browser: motion style page must render complete video-page shells with support layers, animation tracks, and quality checks", failures);
	    assert(/视频素材/.test(reviewInitial.capabilityText) && /个人 IP/.test(reviewInitial.capabilityText) && /白板描线/.test(reviewInitial.capabilityText), "browser: motion style page must expose material, personal-IP, and whiteboard capability bindings", failures);
	    assert(reviewInitial.subtitleCollisions.length === 0, `browser: style template subtitles must not collide with support/animation/quality layers: ${reviewInitial.subtitleCollisions.join(", ")}`, failures);
	    assert(reviewInitial.overflowCount === 0, "browser: motion style review page must not have visible horizontal overflow", failures);
	    const beforeVariant = await page.locator("[data-style-review-card]").first().evaluate((card) => ({
	      activeTemplate: card.querySelector("[data-style-variant-panel]:not([hidden])")?.getAttribute("data-template-id") || "",
	      activeLabel: card.querySelector("[data-style-active-variant]")?.textContent || "",
	    }));
	    await page.locator("[data-style-review-card]").first().locator("[data-style-variant-button]").nth(1).click();
	    await page.waitForTimeout(100);
	    const afterVariant = await page.locator("[data-style-review-card]").first().evaluate((card) => ({
	      activeTemplate: card.querySelector("[data-style-variant-panel]:not([hidden])")?.getAttribute("data-template-id") || "",
	      activeLabel: card.querySelector("[data-style-active-variant]")?.textContent || "",
	    }));
	    assert(afterVariant.activeTemplate && afterVariant.activeTemplate !== beforeVariant.activeTemplate && afterVariant.activeLabel !== beforeVariant.activeLabel, "browser: card-level style buttons must switch the skeleton preview variant", failures);
	    await page.locator("[data-open-style-preview]").first().click();
	    await page.waitForTimeout(150);
	    const reviewModal = await page.evaluate(() => ({
	      open: document.querySelector("[data-style-preview-modal]")?.open === true,
	      hasLargePreview: Boolean(document.querySelector("[data-style-preview-frame] .style-template-preview.large")),
	      layoutMode: document.querySelector("[data-style-preview-frame] [data-style-page-shell]")?.getAttribute("data-style-layout-mode") || "",
	      typographyMode: document.querySelector("[data-style-preview-frame] [data-style-page-shell]")?.getAttribute("data-style-typography-mode") || "",
	      designedTitle: Boolean(document.querySelector("[data-style-preview-frame] .designed-title[data-designed-title]")),
	      title: document.querySelector("[data-style-preview-title]")?.textContent || "",
	      videoUse: document.querySelector("[data-style-preview-video-use]")?.textContent || "",
	      interaction: document.querySelector("[data-style-preview-interaction]")?.textContent || "",
	      capabilities: document.querySelector("[data-style-preview-capabilities]")?.textContent || "",
	    }));
	    assert(reviewModal.open && reviewModal.hasLargePreview, "browser: motion style review modal must open with a large animated preview", failures);
	    assert(reviewModal.layoutMode && reviewModal.typographyMode && reviewModal.designedTitle, "browser: style modal must keep the same layout and typography data as the thumbnail preview", failures);
	    assert(reviewModal.videoUse && reviewModal.interaction && reviewModal.capabilities, "browser: style modal must show video-use, interaction, and capability detail", failures);
	    await page.screenshot({ path: join(screenshotDir, "06-style-review-modal.png"), fullPage: false });
	    await page.keyboard.press("Escape");
	    await page.locator("[data-style-filter-family]").nth(1).click();
	    await page.waitForTimeout(100);
	    const reviewFiltered = await page.evaluate(() => ({
	      visibleCards: [...document.querySelectorAll("[data-style-review-card]")].filter((card) => !card.hidden).length,
	      activeFamily: document.querySelector("[data-style-filter-family].active")?.textContent || "",
	    }));
	    assert(reviewFiltered.visibleCards > 0 && reviewFiltered.visibleCards < reviewInitial.cards, "browser: motion style family filter must narrow visible cards", failures);
	    await page.screenshot({ path: join(screenshotDir, "07-style-review-filtered.png"), fullPage: false });
	    return { initial, modal, afterPersonalIp, afterMotion, whiteboard, cover, coverModal, reviewInitial, reviewModal, reviewFiltered, screenshots: screenshotDir };
	  } finally {
    await browser.close();
  }
}

function writeMarkdownReport(report) {
  const lines = [
    "# Complete Current Flow Self-Test",
    "",
    `Status: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    `Output root: ${report.outRoot}`,
    "",
    "## Coverage",
    "",
    "- syntax checks",
    "- caption planner routing",
    "- capability route coverage",
    "- semi-auto prepare/config stop point",
    "- browser interaction for config page",
    "- cover sample preview modal",
    "- standalone 160-template style review page",
    "- full-auto MP4 render and QC validators",
    "",
    "## Commands",
    "",
    "| Step | Status | Command |",
    "| --- | --- | --- |",
    ...report.commands.map((entry) => `| ${entry.id} | ${entry.ok ? "PASS" : entry.required ? "FAIL" : "WARN"} | \`${entry.command.replaceAll("|", "\\|")}\` |`),
    "",
    "## Artifacts",
    "",
    `- semi-auto package: \`${report.artifacts?.semiAutoPackage || ""}\``,
    `- full-auto package: \`${report.artifacts?.fullAutoPackage || ""}\``,
    `- personal IP asset root: \`${report.artifacts?.personalIpAssetRoot || ""}\``,
    `- browser screenshots: \`${report.artifacts?.browserScreenshots || ""}\``,
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((failure) => `- ${failure}`) : ["- none"]),
    "",
  ];
  writeFileSync(join(report.outRoot, "complete-current-flow-self-test-report.md"), lines.join("\n"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const outRoot = resolve(args.outRoot);
  if (!args.keepExisting && existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });
  ensureDir(outRoot);
  const report = {
    ok: false,
    generatedAt: new Date().toISOString(),
    outRoot,
    commands: [],
    failures: [],
    artifacts: {},
    browser: null,
  };

	  const briefsDir = join(outRoot, "briefs");
	  ensureDir(briefsDir);
  const semiAutoBriefPath = join(briefsDir, "semi-auto-current-flow-brief.json");
  const fullAutoBriefPath = join(briefsDir, "full-auto-video-smoke-brief.json");
	  writeJson(semiAutoBriefPath, buildSemiAutoBrief(args.imageSource, args.voiceBackend));
	  writeJson(fullAutoBriefPath, buildFullAutoBrief(args.imageSource, args.voiceBackend));
  const personalIpAssetRoot = join(outRoot, "user-material-library", "personal-ip");
  const personalIpFixtureDir = join(outRoot, "fixtures", "personal-ip");
  ensureDir(personalIpFixtureDir);
  const personalIpFixture = join(personalIpFixtureDir, "persona-reference.svg");
  writeFileSync(personalIpFixture, [
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">',
    '<rect width="240" height="180" fill="#fffdf7"/>',
    '<circle cx="120" cy="62" r="30" fill="#315d86"/>',
    '<rect x="78" y="98" width="84" height="54" rx="18" fill="#1d232b"/>',
    '<path d="M150 112 L198 88" stroke="#a06f32" stroke-width="10" stroke-linecap="round"/>',
    '<text x="120" y="168" font-size="16" text-anchor="middle" fill="#1d232b">产品方法课主讲人</text>',
    '</svg>',
  ].join(""));
  const personalIpEnv = { CODEX_VIDEO_PERSONAL_IP_ASSET_ROOT: personalIpAssetRoot };
  report.artifacts.personalIpAssetRoot = personalIpAssetRoot;
	  report.artifacts.motionStyleCatalog = validateMotionStyleCatalogFile(report.failures);

	  for (const script of [
    workflowScript,
    motionStyleTemplateLibraryBuilderScript,
    motionStyleTemplateLibraryValidatorScript,
    routeSelfTestScript,
    fullFrameworkSelfTestScript,
    captionRoutingScript,
    semiAutoBuilderScript,
    pluginValidatorScript,
    subtitleCoverValidatorScript,
    frameLayoutValidatorScript,
    personalIpAssetRegistryScript,
    motionStyleReviewPageValidatorScript,
    fileURLToPath(import.meta.url),
	  ]) {
    runStep(report, `node-check-${relative(scriptsDir, script).replaceAll("/", "-")}`, "node", ["--check", rel(script)]);
  }

  runStep(report, "motion-style-template-library-build", "node", [rel(motionStyleTemplateLibraryBuilderScript)]);
  runStep(report, "motion-style-template-library-validator", "node", [rel(motionStyleTemplateLibraryValidatorScript)]);
  report.artifacts.motionStyleTemplateLibrary = validateMotionStyleTemplateLibraryFile(report.failures);

  runStep(report, "personal-ip-asset-registry-register", "node", [
    rel(personalIpAssetRegistryScript),
    "--root", rel(personalIpAssetRoot),
    "--name", "产品方法课主讲人",
    "--source", rel(personalIpFixture),
    "--notes", "complete-current-flow self-test persona",
  ]);

  runStep(report, "caption-planner-routing", "node", [rel(captionRoutingScript)]);
  if (!args.skipRouteCoverage) {
    const routeCoverageReport = join(outRoot, "route-coverage", "capability-routing-self-test-report.json");
    if (args.keepExisting && existsSync(routeCoverageReport)) {
      recordCachedStep(report, "capability-route-coverage", "node", [rel(routeSelfTestScript), "--out-root", rel(join(outRoot, "route-coverage"))], routeCoverageReport);
    } else {
      runStep(report, "capability-route-coverage", "node", [rel(routeSelfTestScript), "--out-root", rel(join(outRoot, "route-coverage"))]);
    }
  }
  const fullFrameworkReport = join(outRoot, "framework-contract", "full-framework-self-test-report.json");
  const fullFrameworkArgs = [
    rel(fullFrameworkSelfTestScript),
    "--out-root", rel(join(outRoot, "framework-contract")),
    "--skip-html-template-validation",
  ];
  if (args.keepExisting && existsSync(fullFrameworkReport)) {
    recordCachedStep(report, "full-framework-cover-capability-contract", "node", fullFrameworkArgs, fullFrameworkReport);
  } else {
    runStep(report, "full-framework-cover-capability-contract", "node", fullFrameworkArgs);
  }

  const semiAutoOut = join(outRoot, "semi-auto-config-package");
  report.artifacts.semiAutoPackage = semiAutoOut;
  runStep(report, "semi-auto-prepare-config-stop", "node", [
    rel(workflowScript),
    "--brief", rel(semiAutoBriefPath),
    "--out", rel(semiAutoOut),
    "--generation-mode", "semi-auto",
    "--image-source", args.imageSource,
    "--no-open-delivery-page",
  ], { env: personalIpEnv });
  if (existsSync(semiAutoOut)) {
    validateSemiAutoPackage(semiAutoOut, report.failures);
    runStep(report, "motion-style-review-page-validator", "node", [
      rel(motionStyleReviewPageValidatorScript),
      "--package", rel(semiAutoOut),
      "--screenshots", rel(join(outRoot, "motion-style-review-screenshots")),
    ]);
    try {
      report.browser = await validateSemiAutoBrowser(semiAutoOut, join(outRoot, "browser-screenshots"), report.failures);
      report.artifacts.browserScreenshots = join(outRoot, "browser-screenshots");
    } catch (error) {
      report.failures.push(`browser config interaction validation failed: ${error.stack || error.message}`);
    }
  }

  const fullAutoOut = join(outRoot, "full-auto-video-package");
  report.artifacts.fullAutoPackage = fullAutoOut;
  if (!args.skipFullRender) {
    prepareReusableFullAutoSmokeAudio(report, fullAutoOut, args.voiceBackend);
    runStep(report, "full-auto-video-render", "node", [
      rel(workflowScript),
      "--brief", rel(fullAutoBriefPath),
      "--out", rel(fullAutoOut),
      "--mode", "recommended",
      "--voice-backend", args.voiceBackend,
      "--speech-style", "explainer",
      "--image-source", args.imageSource,
      "--generation-mode", "full-auto",
      "--max-visual-frames", "12",
      "--no-open-delivery-page",
    ], { maxBuffer: 256 * 1024 * 1024, env: { ...personalIpEnv, CODEX_VIDEO_REUSE_AUDIO: "1" } });
    if (existsSync(fullAutoOut)) {
      validateFullAutoPackage(fullAutoOut, fullAutoBriefPath, report.failures);
      runStep(report, "plugin-routing-validator", "node", [rel(pluginValidatorScript), "--out", rel(fullAutoOut), "--brief", rel(fullAutoBriefPath)]);
      runStep(report, "subtitle-cover-validator", "node", [rel(subtitleCoverValidatorScript), "--out", rel(fullAutoOut), "--brief", rel(fullAutoBriefPath)]);
      runStep(report, "frame-layout-overlap-validator", "node", [rel(frameLayoutValidatorScript), "--out", rel(fullAutoOut), "--json"]);
    }
  }

  report.ok = report.failures.length === 0 && report.commands.filter((entry) => entry.required).every((entry) => entry.ok);
  writeJson(join(outRoot, "complete-current-flow-self-test-report.json"), report);
  writeMarkdownReport(report);
  console.log(JSON.stringify({
    ok: report.ok,
    outRoot,
    report: join(outRoot, "complete-current-flow-self-test-report.json"),
    markdown: join(outRoot, "complete-current-flow-self-test-report.md"),
    artifacts: report.artifacts,
    failures: report.failures,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
