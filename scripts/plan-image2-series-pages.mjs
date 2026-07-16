#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildAdaptiveCountPlan, partitionContentText } from "./lib/adaptive-content-scene-planner.mjs";
import {
  VISUAL_SERIES_PROMPT_METHOD,
  buildVisualSeriesBlueprint,
  formatVisualSeriesProductionPrompt,
  lintVisualSeriesProductionPrompt,
  loadVisualSeriesLeafContract,
} from "./lib/visual-series-prompt-method.mjs";

const VERTICAL_WIDTH = 1080;
const VERTICAL_HEIGHT = 1920;
const HORIZONTAL_WIDTH = 1920;
const HORIZONTAL_HEIGHT = 1080;
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CATALOG_PATH = join(SKILL_ROOT, "assets", "gpt-image-2-visual-series-catalog.json");

function parseArgs(argv) {
  const args = {
    series: "",
    title: "",
    topic: "",
    aspect: "9:16",
    tone: "",
    textPolicy: "",
    styleNotes: "",
    catalog: DEFAULT_CATALOG_PATH,
    content: "",
    contentFile: "",
    requiredText: "",
    minImageCount: "4",
    maxImageCount: "",
    targetImageCount: "",
    durationSeconds: "",
    subtitleCueCount: "",
    imageGrowthStepChars: "160",
    allowSingleImage: "false",
    sourceImages: "",
    outputName: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--help" || item === "-h") args.help = true;
    else if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}`);
      args[key] = value;
      i += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${item}`);
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/plan-image2-series-pages.mjs \\",
    "    --series <seriesId> --out <dir> --topic <text> [--title <text>] \\",
    "    [--aspect 9:16|16:9] [--text-policy integrated-chinese|text-safe] [--tone <variant>] \\",
    "    [--style-notes <text>] [--content-file <script.txt>] [--content <text>] \\",
    "    [--required-text <a;b;c>] [--min-image-count 4] [--max-image-count <optional>] \\",
    "    [--duration-seconds n] [--subtitle-cue-count n] \\",
    "    [--target-image-count n] [--source-images <page1.png;page2.png;...>]",
    "",
    "Plans a native full-screen GPT Image 2 page set for one visual series from",
    "assets/gpt-image-2-visual-series-catalog.json, writing per-page prompts, a contract,",
    "image jobs, a series style lock, QC, and a provenance manifest.",
    "If --source-images is provided, ingests generated bitmaps and verifies orientation/count.",
    "The personal-IP route is separate; this script never touches persona manifests.",
  ].join("\n");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

function safeStem(value, fallback = "image2-series-page") {
  return String(value || fallback)
    .normalize("NFKC")
    .replace(/[\/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || fallback;
}

function splitList(value = "") {
  return String(value || "")
    .split(/[;；,，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readTextFileIfExists(path) {
  if (!path) return "";
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`Content file not found: ${resolved}`);
  return readFileSync(resolved, "utf8");
}

function normalizePlanningText(text = "") {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectPlanningContent(args = {}) {
  const fileText = readTextFileIfExists(args.contentFile);
  return normalizePlanningText([
    fileText,
    args.content,
    args.topic,
    splitList(args.requiredText).join("。"),
  ].filter(Boolean).join("\n"));
}

function splitContentUnits(text = "") {
  const normalized = normalizePlanningText(text);
  const units = normalized
    .split(/(?<=[。！？；!?;])|\n+/u)
    .map((item) => item.replace(/^[\s、，。！？；;,.]+|[\s、，。！？；;,.]+$/g, "").trim())
    .filter(Boolean);
  if (units.length > 0) return units;
  return splitList(normalized).length ? splitList(normalized) : [normalized || "核心观点"];
}

function distributeList(items, index, count) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const start = Math.floor(index * items.length / count);
  const end = Math.floor((index + 1) * items.length / count);
  const slice = items.slice(start, Math.max(start + 1, end));
  return slice.length ? slice : [items[Math.min(items.length - 1, index % items.length)]];
}

function canvasForAspect(aspect = "9:16") {
  const normalized = String(aspect || "9:16").trim();
  if (normalized === "16:9") {
    return {
      width: HORIZONTAL_WIDTH,
      height: HORIZONTAL_HEIGHT,
      aspectRatio: "16:9",
      orientation: "horizontal",
    };
  }
  if (normalized !== "9:16") throw new Error(`Unsupported aspect: ${aspect} (expected 9:16 or 16:9)`);
  return {
    width: VERTICAL_WIDTH,
    height: VERTICAL_HEIGHT,
    aspectRatio: "9:16",
    orientation: "vertical",
  };
}

function imageRatioOk(width, height, aspectRatio = "9:16") {
  const ratio = Number(width || 0) / Math.max(1, Number(height || 0));
  if (!(Number(width) > 0 && Number(height) > 0)) return false;
  if (aspectRatio === "16:9") return ratio > 1.65 && ratio < 1.9;
  return ratio > 0.45 && ratio < 0.7;
}

function readImageDimensions(path) {
  const result = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) return { width: null, height: null };
  const widthMatch = String(result.stdout || "").match(/pixelWidth:\s*(\d+)/);
  const heightMatch = String(result.stdout || "").match(/pixelHeight:\s*(\d+)/);
  return {
    width: widthMatch ? Number(widthMatch[1]) : null,
    height: heightMatch ? Number(heightMatch[1]) : null,
  };
}

function loadCatalog(catalogPath) {
  const resolved = resolve(catalogPath);
  if (!existsSync(resolved)) throw new Error(`Visual series catalog not found: ${resolved}`);
  const catalog = readJson(resolved);
  if (!Array.isArray(catalog.series)) throw new Error(`Catalog has no series array: ${resolved}`);
  return { catalog, catalogPath: resolved };
}

function resolveSeries(catalog, seriesId) {
  if (!seriesId) {
    throw new Error(`--series is required. Available: ${catalog.series.map((item) => item.seriesId).join(", ")}`);
  }
  const series = catalog.series.find((item) => item.seriesId === seriesId);
  if (!series) {
    throw new Error(`Unknown series "${seriesId}". Available: ${catalog.series.map((item) => item.seriesId).join(", ")}`);
  }
  return series;
}

function resolveTextPolicy(series, requested) {
  const supported = Array.isArray(series.supportedTextPolicies) ? series.supportedTextPolicies : ["text-safe"];
  const policy = requested || series.defaultTextPolicy || "text-safe";
  if (!supported.includes(policy)) {
    throw new Error(`Series ${series.seriesId} does not support text policy "${policy}". Supported: ${supported.join(", ")}`);
  }
  return policy;
}

function resolveToneVariant(series, requestedTone) {
  if (!series.toneVariants) {
    if (requestedTone) throw new Error(`Series ${series.seriesId} has no tone variants; drop --tone.`);
    return null;
  }
  const tones = Object.keys(series.toneVariants);
  const tone = requestedTone || tones[0];
  if (!series.toneVariants[tone]) {
    throw new Error(`Unknown tone "${tone}" for ${series.seriesId}. Available: ${tones.join(", ")}`);
  }
  return { tone, description: series.toneVariants[tone] };
}

function resolveStyleLock({ workflowDir, series, args, toneVariant }) {
  const lockPath = join(workflowDir, "image2-series-style-lock.json");
  if (existsSync(lockPath)) {
    const existing = readJson(lockPath);
    if (existing.seriesId !== series.seriesId) {
      throw new Error(`Existing style lock in ${lockPath} belongs to series "${existing.seriesId}"; use a fresh --out directory for ${series.seriesId}.`);
    }
    return { styleLock: existing, reused: true, lockPath };
  }
  const styleNotes = normalizePlanningText(args.styleNotes);
  const styleSpec = series.styleSpec || null;
  const styleLock = {
    schemaVersion: 1,
    stage: "image2-series-style-lock",
    seriesId: series.seriesId,
    seriesName: series.name,
    lockId: `style-${sha256Text([series.seriesId, series.styleDna, JSON.stringify(styleSpec || {}), toneVariant?.tone || "", styleNotes].join("\n")).slice(0, 12)}`,
    styleDna: series.styleDna,
    styleSpec,
    tone: toneVariant?.tone || null,
    toneDescription: toneVariant?.description || null,
    styleNotes,
    reusePolicy: "One run shares one style lock; every page prompt must embed this lock verbatim. Re-runs in the same output directory reuse this lock instead of regenerating it.",
  };
  return { styleLock, reused: false, lockPath };
}

function buildImageQuantityPlan(args = {}, series, promptDirRelative) {
  const allowSingleImage = isEnabled(args.allowSingleImage);
  const requestedMin = toPositiveInt(args.minImageCount, 4);
  const minImageCount = Math.max(allowSingleImage ? 1 : 4, requestedMin);
  const requestedMaxImageCount = args.maxImageCount ? Math.max(minImageCount, toPositiveInt(args.maxImageCount, minImageCount)) : null;
  const growthStepChars = Math.max(80, toPositiveInt(args.imageGrowthStepChars, 160));
  const content = collectPlanningContent(args);
  const contentUnits = splitContentUnits(content);
  const charCount = Array.from(content.replace(/\s/g, "")).length;
  const unitCount = contentUnits.length;
  const adaptiveCount = buildAdaptiveCountPlan({
    sourceCount: minImageCount,
    durationSeconds: Number(args.durationSeconds || 0),
    subtitleCueCount: Number(args.subtitleCueCount || 0),
    charCount,
    contentUnitCount: unitCount,
    minCount: minImageCount,
    requestedTarget: args.targetImageCount,
    requestedMaximum: requestedMaxImageCount || 0,
    secondsPerPage: 30,
    subtitleCuesPerPage: 4,
    charsPerPage: 220,
    contentUnitsPerPage: 4,
  });
  const charGrowthBucket = null;
  const unitGrowthBucket = null;
  const exponentialByChars = null;
  const exponentialByUnits = null;
  const semanticFloor = adaptiveCount.semanticUnitTarget;
  const explicitTarget = adaptiveCount.requestedTarget;
  const maxImageCount = adaptiveCount.effectiveMaximum || adaptiveCount.resolvedCount;
  const resolvedImageCount = adaptiveCount.resolvedCount;
  const requiredText = splitList(args.requiredText);
  const roles = Array.isArray(series.pageRoles) && series.pageRoles.length > 0
    ? series.pageRoles
    : ["overview", "detail", "evidence", "summary"];
  const outputStem = safeStem(args.outputName || `${series.seriesId}-page`).replace(/\.[^.]+$/, "");
  const contentBeats = partitionContentText(content, resolvedImageCount, { label: "Image2 series source content" });
  const slots = Array.from({ length: resolvedImageCount }, (_, index) => {
    return {
      id: `page-${String(index + 1).padStart(2, "0")}`,
      order: index + 1,
      role: roles[index % roles.length],
      contentBeat: contentBeats[index],
      requiredText: distributeList(requiredText, index, resolvedImageCount),
      promptFile: `${promptDirRelative}/page-${String(index + 1).padStart(2, "0")}-prompt.txt`,
      expectedImageName: `${outputStem}-${String(index + 1).padStart(2, "0")}.png`,
      matchingRule: "One generated page covers this content beat only; do not compress the whole script into one all-purpose page.",
    };
  });
  return {
    schemaVersion: 1,
    stage: "image2-series-image-count-plan",
    status: "planned",
    seriesId: series.seriesId,
    minImageCount,
    maxImageCount,
    requestedMaxImageCount,
    maximumPolicy: "adaptive-no-default-cap",
    maxImageCountUnderAutomaticPolicy: adaptiveCount.requestedMaximumUnderAutomatic,
    maxImageCountRaisedToAutomaticPolicy: adaptiveCount.requestedMaximumRaisedToAutomatic,
    resolvedImageCount,
    explicitTarget,
    allowSingleImage,
    singleImageRejectedByDefault: !allowSingleImage,
    contentMetrics: {
      charCount,
      unitCount,
      growthStepChars,
      charGrowthBucket,
      unitGrowthBucket,
      semanticFloor,
      exponentialByChars,
      exponentialByUnits,
      durationSeconds: Number(args.durationSeconds || 0) || null,
      subtitleCueCount: Number(args.subtitleCueCount || 0),
      durationBasedTarget: adaptiveCount.durationBasedTarget,
      subtitleCueBasedTarget: adaptiveCount.subtitleCueBasedTarget,
      contentBasedTarget: adaptiveCount.contentBasedTarget,
      automaticTarget: adaptiveCount.automaticTarget,
    },
    growthRule: {
      formula: "max(minImageCount, durationBasedTarget, subtitleCueBasedTarget, contentBasedTarget, semanticUnitTarget); no default maximum",
      reason: "Short content keeps the minimum useful series; longer content grows from duration, subtitle cues, semantic units, and text length without a fixed default cap.",
    },
    slots,
  };
}

function textPolicyBlock({ textPolicy, slot, catalog }) {
  if (textPolicy === "integrated-chinese") {
    const whitelist = slot.requiredText.length
      ? slot.requiredText.map((item) => `- ${item}`).join("\n")
      : "- (no whitelist provided; treat this page as text-safe)";
    return [
      "Text policy: integrated-chinese.",
      "Required readable Chinese text on this page (exact whitelist, render each string exactly once, correct and legible):",
      whitelist,
      "No other readable text of any language anywhere on the page. No pseudo glyphs, no random letters or numbers.",
      "Every whitelisted string will be proofread; wrong, distorted, or extra text fails QC.",
    ].join("\n");
  }
  return [
    "Text policy: text-safe.",
    "No readable text of any language anywhere on the page. Where labels or captions would sit, render blank label plaques or abstract placeholder strokes only.",
    `Deterministic HTML/SVG/CSS overlays own all exact Chinese text later. ${catalog.textPolicies?.["text-safe"]?.summary || ""}`.trim(),
  ].join("\n");
}

function renderStyleSpec(styleSpec) {
  if (!styleSpec || typeof styleSpec !== "object") return [];
  const order = ["renderingMedium", "background", "accent", "iconAndDetailStyle", "paletteRule"];
  const keys = [...order.filter((key) => styleSpec[key]), ...Object.keys(styleSpec).filter((key) => !order.includes(key) && styleSpec[key])];
  return keys.map((key) => `- ${key}: ${styleSpec[key]}`);
}

function buildPagePrompt({ args, series, leafContract, canvas, styleLock, textPolicy, imagePlan, slot }) {
  const blueprint = buildVisualSeriesBlueprint({ args, series, leafContract, canvas, styleLock, textPolicy, imagePlan, slot });
  const prompt = formatVisualSeriesProductionPrompt({
    blueprint,
    canvas,
    pageOrder: slot.order,
    pageCount: imagePlan.resolvedImageCount,
  });
  const lint = lintVisualSeriesProductionPrompt(prompt);
  if (lint.status !== "pass") {
    throw new Error(`Structured prompt lint failed for ${series.seriesId}/${slot.id}: ${JSON.stringify(lint)}`);
  }
  return { prompt, blueprint, lint };
}

function ingestSourceImages({ args, out, imagesDir, imagePlan, canvas }) {
  const sourceImages = splitList(String(args.sourceImages || "").replace(/;/g, "\n")).map((item) => resolve(item));
  if (sourceImages.length === 0) return [];
  if (sourceImages.length !== imagePlan.resolvedImageCount) {
    throw new Error(`Source image count mismatch: planned ${imagePlan.resolvedImageCount}, received ${sourceImages.length}. Generate every page prompt before ingesting.`);
  }
  return sourceImages.map((source, index) => {
    const slot = imagePlan.slots[index];
    if (!existsSync(source)) throw new Error(`--source-images entry not found: ${source}`);
    const ext = extname(source).toLowerCase() || ".png";
    const outputName = slot.expectedImageName.replace(/\.[^.]+$/, ext);
    const target = join(imagesDir, outputName);
    copyFileSync(source, target);
    const dimensions = readImageDimensions(target);
    return {
      id: slot.id,
      source,
      path: `images/${outputName}`,
      sha256: sha256File(target),
      width: dimensions.width,
      height: dimensions.height,
      aspectRatioOk: imageRatioOk(dimensions.width, dimensions.height, canvas.aspectRatio),
      contentBeat: slot.contentBeat,
      prompt: slot.promptFile,
    };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }
  const { catalog, catalogPath } = loadCatalog(args.catalog);
  const series = resolveSeries(catalog, args.series);
  const leafContractInfo = loadVisualSeriesLeafContract({ skillRoot: SKILL_ROOT, series });
  const leafContract = leafContractInfo.contract;
  const textPolicy = resolveTextPolicy(series, args.textPolicy);
  const toneVariant = resolveToneVariant(series, args.tone);
  const canvas = canvasForAspect(args.aspect);
  if (Array.isArray(series.aspects) && !series.aspects.includes(canvas.aspectRatio)) {
    throw new Error(`Series ${series.seriesId} does not declare aspect ${canvas.aspectRatio}. Declared: ${series.aspects.join(", ")}`);
  }
  if (textPolicy === "integrated-chinese" && splitList(args.requiredText).length === 0) {
    throw new Error("Text policy integrated-chinese requires --required-text with the exact Chinese whitelist.");
  }

  const out = resolve(args.out);
  const workflowDir = join(out, "workflow");
  const imagesDir = join(out, "images");
  const promptDirRelative = `prompts/${series.seriesId}-pages`;
  const pagePromptsDir = join(out, promptDirRelative);
  ensureDir(workflowDir);
  ensureDir(imagesDir);
  ensureDir(pagePromptsDir);

  const { styleLock, reused: styleLockReused, lockPath } = resolveStyleLock({ workflowDir, series, args, toneVariant });
  const imagePlan = buildImageQuantityPlan(args, series, promptDirRelative);
  const pagePrompts = imagePlan.slots.map((slot) => {
    const { prompt, blueprint, lint } = buildPagePrompt({ args, series, leafContract, canvas, styleLock, textPolicy, imagePlan, slot });
    const promptPath = join(out, slot.promptFile);
    writeFileSync(promptPath, `${prompt}\n`, "utf8");
    return { slot, prompt, promptPath, blueprint, lint };
  });
  const promptIndexPath = join(out, "prompts", `${series.seriesId}-prompt-index.md`);
  writeFileSync(promptIndexPath, [
    `# ${args.title || args.topic || series.name}`,
    "",
    `Series: ${series.seriesId} (${series.name}), text policy: ${textPolicy}, aspect: ${canvas.aspectRatio}.`,
    `This series source set requires ${imagePlan.resolvedImageCount} generated images.`,
    `Do not generate a single combined image. Generate every page prompt under \`${promptDirRelative}/\`, then ingest all images with \`--source-images\`.`,
    "",
    ...pagePrompts.map(({ slot }) => `- ${slot.id}: ${slot.promptFile} -> ${slot.expectedImageName} (${slot.role})`),
    "",
  ].join("\n"), "utf8");

  const ingestedImages = ingestSourceImages({ args, out, imagesDir, imagePlan, canvas });
  const route = `image2-visual-series-${series.seriesId}`;
  const contract = {
    schemaVersion: 1,
    stage: "image2-series-contract",
    status: "planned",
    route,
    seriesId: series.seriesId,
    seriesName: series.name,
    seriesStatus: series.status,
    catalog: catalogPath,
    promptMethod: VISUAL_SERIES_PROMPT_METHOD,
    leafSkill: {
      skillId: leafContract.skillId,
      contractId: leafContract.contractId,
      contractPath: leafContractInfo.path,
      isolationPolicy: "The shared compiler owns structure and lint only; this leaf contract solely owns scene semantics, layout families, physical visual system, reject rules, and QC assertions.",
    },
    designPhilosophy: catalog.designPhilosophy?.principles || [],
    personalIpBoundary: catalog.designPhilosophy?.personalIpBoundary || "",
    outputCanvas: { width: canvas.width, height: canvas.height, aspectRatio: canvas.aspectRatio, orientation: canvas.orientation },
    title: args.title || args.topic || series.name,
    topic: args.topic || "",
    textPolicy,
    tone: toneVariant?.tone || null,
    styleLock: "workflow/image2-series-style-lock.json",
    imageQuantityPolicy: {
      minImageCount: imagePlan.minImageCount,
      maxImageCount: imagePlan.maxImageCount,
      resolvedImageCount: imagePlan.resolvedImageCount,
      singleImageRejectedByDefault: imagePlan.singleImageRejectedByDefault,
      growthRule: imagePlan.growthRule,
    },
    deterministicTextPlan: textPolicy === "text-safe"
      ? { owner: "HTML/SVG/CSS overlays", requiredText: splitList(args.requiredText) }
      : { owner: "generated bitmap via whitelist + proofread gate", requiredText: splitList(args.requiredText) },
    promptIndex: `prompts/${series.seriesId}-prompt-index.md`,
    promptDirectory: `${promptDirRelative}/`,
    prompts: imagePlan.slots.map((slot) => slot.promptFile),
    promptBlueprints: pagePrompts.map(({ slot, blueprint }) => ({ pageId: slot.id, blueprint })),
    requiredEvidence: [
      "workflow/image2-series-contract.json",
      "workflow/image2-series-image-count-plan.json",
      "workflow/image2-series-image-jobs.json",
      "workflow/image2-series-style-lock.json",
      `prompts/${series.seriesId}-prompt-index.md`,
      "workflow/image2-series-qc.json",
    ],
    rejectList: [
      "page cropped or squeezed from the wrong orientation",
      "style drift between pages of one set",
      "one image covering the whole script when minImageCount is greater than 1",
      "readable text outside the whitelist (integrated-chinese) or any readable text (text-safe)",
      "subtitle-safe band occupied by content",
      "generic decoration without a narrative job",
    ],
  };

  const checks = {
    seriesRegisteredInCatalog: true,
    seriesAspectSupported: !Array.isArray(series.aspects) || series.aspects.includes(canvas.aspectRatio),
    textPolicySupported: true,
    promptIndexPresent: existsSync(promptIndexPath),
    allPagePromptsPresent: pagePrompts.every(({ promptPath }) => existsSync(promptPath)),
    imageCountWithinRange: imagePlan.resolvedImageCount >= imagePlan.minImageCount && imagePlan.resolvedImageCount <= imagePlan.maxImageCount,
    maxImageCountDoesNotUndercutAutomaticPolicy: imagePlan.maxImageCount >= imagePlan.contentMetrics.automaticTarget,
    singleImageRejectedByDefault: imagePlan.allowSingleImage || imagePlan.resolvedImageCount > 1,
    canvasPlanned1080x1920: canvas.orientation !== "vertical" || (canvas.width === VERTICAL_WIDTH && canvas.height === VERTICAL_HEIGHT),
    canvasPlanned1920x1080: canvas.orientation !== "horizontal" || (canvas.width === HORIZONTAL_WIDTH && canvas.height === HORIZONTAL_HEIGHT),
    styleLockPresent: true,
    styleSpecPresent: Boolean(styleLock.styleSpec && styleLock.styleSpec.renderingMedium),
    promptsIncludeStyleLockId: pagePrompts.every(({ prompt }) => prompt.includes(styleLock.lockId)),
    promptsIncludeStyleDna: pagePrompts.every(({ prompt }) => prompt.includes(styleLock.styleDna)),
    promptsIncludeRenderingMediumLock: !styleLock.styleSpec?.renderingMedium
      || pagePrompts.every(({ prompt }) => prompt.includes(styleLock.styleSpec.renderingMedium)),
    promptsMatchPlannedImageCount: pagePrompts.length === imagePlan.resolvedImageCount,
    leafSkillContractLoaded: Boolean(leafContract.skillId && leafContract.contractId),
    promptsUseStructuredVisualSeriesMethod: pagePrompts.every(({ prompt }) => prompt.includes(VISUAL_SERIES_PROMPT_METHOD.id)),
    allStructuredPromptLintsPass: pagePrompts.every(({ lint }) => lint.status === "pass"),
    promptsIncludeLeafSkill: pagePrompts.every(({ prompt }) => prompt.includes(`Leaf Skill: ${leafContract.skillId}`)),
    promptsIncludePhysicalVisualSystem: pagePrompts.every(({ prompt }) => prompt.includes("PHYSICAL VISUAL SYSTEM")),
    promptsIncludeSpatialMap: pagePrompts.every(({ prompt }) => prompt.includes("SPATIAL MAP AND READING ORDER")),
    promptsIncludeFailureSpecificRejects: pagePrompts.every(({ prompt }) => prompt.includes("REJECT")),
    promptsIncludeExecutableQc: pagePrompts.every(({ prompt }) => prompt.includes("FINAL QC")),
    integratedTextWhitelistPresent: textPolicy !== "integrated-chinese" || splitList(args.requiredText).length > 0,
    textSafePromptsForbidReadableText: textPolicy !== "text-safe" || pagePrompts.every(({ prompt }) => prompt.includes("No readable text of any language")),
    subtitleSafeBandDeclared: pagePrompts.every(({ prompt }) => prompt.includes("lower 18%")),
    sourceImageCountMatchesPlanWhenProvided: ingestedImages.length === 0 || ingestedImages.length === imagePlan.resolvedImageCount,
    sourceImagesMatchRequestedAspectWhenProvided: ingestedImages.length === 0 || ingestedImages.every((image) => image.aspectRatioOk === true),
  };
  const qc = {
    schemaVersion: 1,
    stage: "image2-series-qc",
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    pass: Object.values(checks).every(Boolean),
    route,
    seriesId: series.seriesId,
    textPolicy,
    leafSkill: { skillId: leafContract.skillId, contractId: leafContract.contractId, contractPath: leafContractInfo.path },
    promptMethod: VISUAL_SERIES_PROMPT_METHOD.id,
    promptLints: pagePrompts.map(({ slot, lint }) => ({ pageId: slot.id, ...lint })),
    integratedTextProofread: textPolicy === "integrated-chinese"
      ? { required: true, status: ingestedImages.length > 0 ? "pending-review" : "not-applicable-no-images", rule: "Every whitelisted string must be verified legible and correct before final use; failures regenerate the page or downgrade it to text-safe." }
      : { required: false },
    checks,
    outputCanvas: contract.outputCanvas,
    styleLock: { lockId: styleLock.lockId, reused: styleLockReused, renderingMedium: styleLock.styleSpec?.renderingMedium || null },
    imageQuantityPlan: {
      minImageCount: imagePlan.minImageCount,
      maxImageCount: imagePlan.maxImageCount,
      resolvedImageCount: imagePlan.resolvedImageCount,
      contentMetrics: imagePlan.contentMetrics,
    },
    images: ingestedImages,
  };
  const sourceGeneratedImages = ingestedImages.map((image, index) => ({
    tool: args.sourceGeneratedTool || "Codex built-in image_gen",
    id: args.sourceGeneratedId ? `${args.sourceGeneratedId}-${String(index + 1).padStart(2, "0")}` : null,
    originalPath: image.source,
    seriesId: series.seriesId,
    styleLockId: styleLock.lockId,
    plannedPageId: image.id,
    prompt: image.prompt,
    contentBeat: image.contentBeat,
  }));
  const pageEntries = ingestedImages.map((image, index) => ({
    id: image.id,
    file: `../${image.path}`,
    source_generated_image: sourceGeneratedImages[index],
    series_style_lock: styleLock.lockId,
    prompt: image.prompt,
    contentBeat: image.contentBeat,
  }));
  const manifest = {
    schemaVersion: 1,
    route,
    generationRoute: ingestedImages.length > 0
      ? "Codex built-in image_gen or user-provided generated image page set ingested by contract"
      : "prompt-only-multi-page",
    seriesId: series.seriesId,
    seriesName: series.name,
    textPolicy,
    promptMethod: VISUAL_SERIES_PROMPT_METHOD.id,
    leafSkill: { skillId: leafContract.skillId, contractId: leafContract.contractId, contractPath: leafContractInfo.path },
    source_generated_images: sourceGeneratedImages,
    styleLock: "workflow/image2-series-style-lock.json",
    contract: "workflow/image2-series-contract.json",
    promptIndex: `prompts/${series.seriesId}-prompt-index.md`,
    promptDirectory: `${promptDirRelative}/`,
    imageCountPlan: "workflow/image2-series-image-count-plan.json",
    imageJobs: "workflow/image2-series-image-jobs.json",
    images: ingestedImages.map((image) => image.path),
    qc: "workflow/image2-series-qc.json",
    content_pages: pageEntries,
    items: pageEntries,
  };
  const imageJobs = {
    schemaVersion: 1,
    stage: "image2-series-image-jobs",
    status: "planned",
    route,
    seriesId: series.seriesId,
    title: contract.title,
    canvas: contract.outputCanvas,
    textPolicy,
    promptMethod: VISUAL_SERIES_PROMPT_METHOD.id,
    leafSkill: { skillId: leafContract.skillId, contractId: leafContract.contractId, contractPath: leafContractInfo.path },
    styleLockId: styleLock.lockId,
    parallelGenerationPolicy: {
      allowed: true,
      defaultMaxConcurrency: 2,
      maxConcurrency: 4,
      concurrencyEnv: "CODEX_VIDEO_IMAGE2_CONCURRENCY",
      consistencyGroup: styleLock.lockId,
      rule: "Series page jobs may be generated concurrently because each job owns a distinct prompt and expected image name. Every request must include the same style lock context from workflow/image2-series-style-lock.json, and ingestion/validation must preserve slot order.",
      notAllowedWhen: [
        "a page depends on a previous generated bitmap as its visual reference",
        "the style lock or prompt package is missing",
        "generated outputs cannot be matched back to their job ids",
      ],
    },
    jobs: imagePlan.slots.map((slot) => ({
      id: slot.id,
      order: slot.order,
      role: slot.role,
      parallelSafe: true,
      consistencyGroup: styleLock.lockId,
      prompt: slot.promptFile,
      expectedImageName: slot.expectedImageName,
      contentBeat: slot.contentBeat,
      requiredText: slot.requiredText,
      matchingRule: slot.matchingRule,
    })),
  };

  writeJson(lockPath, styleLock);
  writeJson(join(workflowDir, "image2-series-contract.json"), contract);
  writeJson(join(workflowDir, "image2-series-image-count-plan.json"), imagePlan);
  writeJson(join(workflowDir, "image2-series-image-jobs.json"), imageJobs);
  writeJson(join(workflowDir, "image2-series-qc.json"), qc);
  writeJson(join(workflowDir, "image2-series-manifest.json"), manifest);
  writeJson(join(workflowDir, "manifest.json"), manifest);
  console.log(JSON.stringify({
    pass: qc.pass,
    out,
    seriesId: series.seriesId,
    textPolicy,
    styleLockId: styleLock.lockId,
    promptIndex: promptIndexPath,
    promptDirectory: pagePromptsDir,
    imageCount: imagePlan.resolvedImageCount,
    images: ingestedImages.map((image) => image.path),
    qc: join(workflowDir, "image2-series-qc.json"),
  }, null, 2));
}

main();
