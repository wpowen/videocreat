#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const VERTICAL_WIDTH = 1080;
const VERTICAL_HEIGHT = 1920;
const HORIZONTAL_WIDTH = 1920;
const HORIZONTAL_HEIGHT = 1080;
const DEFAULT_PERSONAL_IP_MIN_IMAGE_COUNT = 4;
const DEFAULT_PERSONAL_IP_MAX_IMAGE_COUNT = 48;
const DEFAULT_PERSONAL_IP_CLARITY_CHARS_PER_IMAGE = 140;
const DEFAULT_PERSONAL_IP_MAX_GROWTH_BUCKET = 4;
const DEFAULT_VERTICAL_TOP_SAFE_PX = 220;
const DEFAULT_VERTICAL_BOTTOM_SUBTITLE_SAFE_PX = 320;
const SOURCE_REPO = "https://github.com/haloshin/ip-diagram-creator";
const SOURCE_COMMIT = "dd64ab5d972893f7ca271d9c560362d7788eb2d6";
const DEFAULT_PERSONAL_IP_ASSET_ROOT = process.env.CODEX_VIDEO_PERSONAL_IP_ASSET_ROOT
  ? resolve(process.env.CODEX_VIDEO_PERSONAL_IP_ASSET_ROOT)
  : join(process.env.CODEX_HOME || join(homedir(), ".codex"), "video-workflow", "user-assets", "personal-ip");
// Resolve the public skill package root from this script's own location, not
// from the process CWD, so the "is this asset stored inside the public skill
// package" rights/storage-safety check below stays correct regardless of where
// the script is invoked from. (scripts/ -> skill root is one level up.)
const PUBLIC_SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {
    title: "个人IP图解",
    mode: "knowledge-card",
    persona: "成人中文知识主讲人，现代短黑发，简洁眼镜，深色外套，白色内搭，专业但亲和；不承诺真人相似度",
    coreIdea: "用个人 IP 主讲，把一个观点拆成观点、拆解、行动三段。",
    requiredText: "个人IP图解;观点;拆解;行动",
    agentJobs: "搬运卡片;标记风险;递交结果",
    outputName: "",
    aspect: "9:16",
    personaGender: "male",
    personaManifest: "",
    content: "",
    contentFile: "",
    script: "",
    narration: "",
    minImageCount: String(DEFAULT_PERSONAL_IP_MIN_IMAGE_COUNT),
    maxImageCount: String(DEFAULT_PERSONAL_IP_MAX_IMAGE_COUNT),
    targetImageCount: "",
    imageGrowthStepChars: "160",
    allowSingleImage: "false",
    sourceImages: "",
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
    "  node .agents/skills/codex-video-workflow/scripts/plan-vertical-personal-ip-image.mjs \\",
    "    --out <dir> [--title <text>] [--persona <description>] [--core-idea <text>] \\",
    "    [--aspect 9:16|16:9] [--persona-manifest <manifest.json>] [--persona-gender male|female] \\",
    "    [--content-file <script.txt>] [--content <text>] [--required-text <a;b;c>] \\",
    "    [--min-image-count 4] [--max-image-count 48] [--target-image-count n] \\",
    "    [--agent-jobs <a;b;c>] [--source-images <page1.png;page2.png;...>]",
    "",
    "Writes a vertical 9:16 or horizontal 16:9 personal-IP diagram multi-page contract and page prompts.",
    "If --source-images or --source-image is provided, ingests generated bitmaps and verifies orientation/count.",
    "Personal-IP output always resolves a fixed persona manifest. Without --persona-manifest, it uses",
    "~/.codex/video-workflow/user-assets/personal-ip/generic-hosts/<male|female>/manifest.json.",
  ].join("\n");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveMaybeRelative(value, baseDir) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(baseDir, value);
}

function isInside(childPath, parentPath) {
  if (!childPath || !parentPath) return false;
  const rel = relative(resolve(parentPath), resolve(childPath));
  return Boolean(rel) && !rel.startsWith("..") && !isAbsolute(rel);
}

function normalizePersonaGender(value = "male") {
  const raw = String(value || "male").trim().toLowerCase();
  if (["female", "woman", "women", "女", "女士", "girl"].includes(raw)) return "female";
  return "male";
}

function defaultPersonaManifestPath(gender = "male") {
  return join(DEFAULT_PERSONAL_IP_ASSET_ROOT, "generic-hosts", normalizePersonaGender(gender), "manifest.json");
}

function resolvePersonaManifestPath(args = {}) {
  return args.personaManifest
    ? resolve(args.personaManifest)
    : defaultPersonaManifestPath(args.personaGender);
}

function collectPersonaAssetCandidates(manifest = {}, manifestPath = "") {
  const baseDir = dirname(manifestPath);
  const activeVersion = manifest.activeVersion && manifest.versions?.[manifest.activeVersion]
    ? manifest.versions[manifest.activeVersion]
    : null;
  const candidates = [
    activeVersion?.mainAnchor,
    manifest.assets?.mainAnchor,
    activeVersion?.sourceGeneratedImage,
    manifest.sourceGeneratedImage,
  ];
  if (Array.isArray(manifest.assets)) {
    for (const asset of manifest.assets) {
      candidates.push(asset.path || asset.file || asset.source || asset.href);
    }
  }
  return candidates
    .map((candidate) => resolveMaybeRelative(candidate, baseDir))
    .filter(Boolean);
}

function firstExisting(candidates = []) {
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function resolveFixedPersona(args = {}) {
  const manifestPath = resolvePersonaManifestPath(args);
  if (!existsSync(manifestPath)) {
    throw new Error(`Fixed personal-IP persona manifest not found: ${manifestPath}`);
  }
  const manifest = readJson(manifestPath);
  const activeVersion = manifest.activeVersion && manifest.versions?.[manifest.activeVersion]
    ? manifest.versions[manifest.activeVersion]
    : null;
  const mainAnchorCandidates = [
    activeVersion?.mainAnchor,
    manifest.assets?.mainAnchor,
    ...(Array.isArray(manifest.assets)
      ? manifest.assets.map((asset) => asset.path || asset.file || asset.source || asset.href)
      : []),
  ].map((candidate) => resolveMaybeRelative(candidate, dirname(manifestPath))).filter(Boolean);
  const mainAnchorPath = firstExisting(mainAnchorCandidates) || firstExisting(collectPersonaAssetCandidates(manifest, manifestPath));
  const sourceGeneratedImage = activeVersion?.sourceGeneratedImage || manifest.sourceGeneratedImage || null;
  const visualAnchors = Array.isArray(activeVersion?.visualAnchors)
    ? activeVersion.visualAnchors
    : Array.isArray(manifest.visualAnchors)
      ? manifest.visualAnchors
      : [];
  const status = manifest.type === "generic-personal-ip-fallback"
    ? "ready-default-persona"
    : "ready-existing-persona";
  const mainAnchorInsidePublicSkillPackage = mainAnchorPath ? isInside(mainAnchorPath, PUBLIC_SKILL_ROOT) : false;
  const manifestInsidePublicSkillPackage = isInside(manifestPath, PUBLIC_SKILL_ROOT);
  const styleNote = activeVersion?.styleNote || manifest.styleNote || "";
  const promptReference = [
    `Fixed persona manifest: ${manifestPath}`,
    mainAnchorPath ? `Main anchor image: ${mainAnchorPath}` : "Main anchor image: missing",
    sourceGeneratedImage ? `Source generated image: ${sourceGeneratedImage}` : "Source generated image: not recorded",
    `Visual anchors: ${visualAnchors.join(" / ") || "not recorded"}`,
    styleNote ? `Style note: ${styleNote}` : "",
    "Do not redesign a new presenter. Preserve the manifest-backed adult creator identity: layered dark hair, round glasses, dark cropped jacket, white inner shirt, orange scarf/marker accent, calm teaching posture. If the image runtime cannot load the local image path directly, reconstruct this exact fixed character from the manifest visual anchors and record that limitation; do not claim exact user likeness.",
  ].filter(Boolean).join("\n");

  return {
    schemaVersion: 1,
    status,
    personaId: manifest.personaId || null,
    personaName: manifest.displayName || manifest.name || manifest.personaId || "fixed-personal-ip-persona",
    type: manifest.type || null,
    manifestPath,
    manifestSha256: sha256File(manifestPath),
    mainAnchorPath,
    mainAnchorSha256: mainAnchorPath ? sha256File(mainAnchorPath) : null,
    sourceGeneratedImage,
    sourceSkill: manifest.sourceSkill || {
      name: "ip-diagram-creator",
      sourceRepo: SOURCE_REPO,
      sourceCommit: SOURCE_COMMIT,
      license: "MIT",
    },
    activeVersion: manifest.activeVersion || null,
    visualAnchors,
    styleNote,
    doNotClaimUserLikeness: Boolean(manifest.doNotClaimUserLikeness),
    usagePolicy: manifest.usagePolicy || {},
    storagePolicy: {
      userMaterialLibraryRoot: DEFAULT_PERSONAL_IP_ASSET_ROOT,
      publicSkillStorageForbidden: true,
      manifestInsidePublicSkillPackage,
      mainAnchorInsidePublicSkillPackage,
    },
    promptReference,
  };
}

function safeStem(value = "vertical-personal-ip-page") {
  return String(value || "vertical-personal-ip-page")
    .normalize("NFKC")
    .replace(/[\/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "vertical-personal-ip-page";
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
  const fileText = readTextFileIfExists(args.contentFile || args.script || args.narration);
  return normalizePlanningText([
    fileText,
    args.content,
    args.coreIdea,
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
  return splitList(normalized).length ? splitList(normalized) : [normalized || "个人 IP 核心观点"];
}

function distributeList(items, index, count) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const start = Math.floor(index * items.length / count);
  const end = Math.floor((index + 1) * items.length / count);
  const slice = items.slice(start, Math.max(start + 1, end));
  return slice.length ? slice : [items[Math.min(items.length - 1, index % items.length)]];
}

function buildImageQuantityPlan(args = {}, canvas) {
  const allowSingleImage = isEnabled(args.allowSingleImage);
  const requestedMin = toPositiveInt(args.minImageCount, DEFAULT_PERSONAL_IP_MIN_IMAGE_COUNT);
  const minImageCount = Math.max(allowSingleImage ? 1 : DEFAULT_PERSONAL_IP_MIN_IMAGE_COUNT, requestedMin);
  const maxImageCount = Math.max(minImageCount, toPositiveInt(args.maxImageCount, DEFAULT_PERSONAL_IP_MAX_IMAGE_COUNT));
  const growthStepChars = Math.max(80, toPositiveInt(args.imageGrowthStepChars, 160));
  const content = collectPlanningContent(args);
  const contentUnits = splitContentUnits(content);
  const charCount = Array.from(content.replace(/\s/g, "")).length;
  const unitCount = contentUnits.length;
  const charGrowthBucket = Math.max(0, Math.ceil(charCount / growthStepChars) - 1);
  const unitGrowthBucket = Math.max(0, Math.ceil(unitCount / 4) - 1);
  const boundedCharGrowthBucket = Math.min(DEFAULT_PERSONAL_IP_MAX_GROWTH_BUCKET, charGrowthBucket);
  const boundedUnitGrowthBucket = Math.min(DEFAULT_PERSONAL_IP_MAX_GROWTH_BUCKET, unitGrowthBucket);
  const exponentialByChars = minImageCount * (2 ** boundedCharGrowthBucket);
  const exponentialByUnits = minImageCount * (2 ** boundedUnitGrowthBucket);
  const semanticFloor = Math.ceil(unitCount / 1.5);
  const clarityByChars = Math.ceil(charCount / DEFAULT_PERSONAL_IP_CLARITY_CHARS_PER_IMAGE);
  const contentClarityTarget = Math.max(minImageCount, semanticFloor, clarityByChars);
  const contentMatchCeiling = Math.max(minImageCount, unitCount, clarityByChars);
  const automaticTarget = Math.min(
    Math.max(contentClarityTarget, exponentialByChars, exponentialByUnits),
    contentMatchCeiling,
  );
  const explicitTarget = args.targetImageCount
    ? clamp(toPositiveInt(args.targetImageCount, minImageCount), minImageCount, maxImageCount)
    : null;
  const resolvedImageCount = explicitTarget || clamp(automaticTarget, minImageCount, maxImageCount);
  const requiredText = splitList(args.requiredText);
  const agentJobs = splitList(args.agentJobs);
  const roles = [
    "hook-contrast",
    "definition-board",
    "value-proposition",
    "character-burden",
    "conflict-question",
    "logic-flow",
    "judgement-page",
    "spine-summary",
    "action-review",
    "payoff-close",
  ];
  const slots = Array.from({ length: resolvedImageCount }, (_, index) => {
    const unitStart = Math.floor(index * contentUnits.length / resolvedImageCount);
    const unitEnd = Math.floor((index + 1) * contentUnits.length / resolvedImageCount);
    const matchedUnits = contentUnits.slice(unitStart, Math.max(unitStart + 1, unitEnd));
    const selectedUnits = matchedUnits.length
      ? matchedUnits
      : [contentUnits[Math.min(contentUnits.length - 1, index % contentUnits.length)]];
    return {
      id: `page-${String(index + 1).padStart(2, "0")}`,
      order: index + 1,
      role: roles[index % roles.length],
      contentBeat: selectedUnits.join(" "),
      sourceUnitIndexes: selectedUnits.map((unit) => contentUnits.indexOf(unit) + 1).filter((item) => item > 0),
      requiredText: distributeList(requiredText, index, resolvedImageCount),
      agentJobs: distributeList(agentJobs, index, resolvedImageCount),
      promptFile: `prompts/${canvas.filePrefix}-pages/page-${String(index + 1).padStart(2, "0")}-prompt.txt`,
      expectedImageName: `${safeStem(args.outputName || canvas.defaultOutputName).replace(/\.[^.]+$/, "")}-${String(index + 1).padStart(2, "0")}.png`,
      matchingRule: "One generated image covers this content beat only; do not compress the whole script into one all-purpose card.",
    };
  });
  return {
    schemaVersion: 1,
    stage: "personal-ip-image-count-plan",
    status: "planned",
    route: `ip-diagram-creator-${canvas.orientation}-source-pages`,
    minImageCount,
    maxImageCount,
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
      boundedCharGrowthBucket,
      boundedUnitGrowthBucket,
      semanticFloor,
      clarityByChars,
      contentClarityTarget,
      contentMatchCeiling,
      exponentialByChars,
      exponentialByUnits,
      automaticTarget,
    },
    growthRule: {
      formula: "clamp(min(max(contentClarityTarget, minImageCount*2^boundedCharGrowthBucket, minImageCount*2^boundedUnitGrowthBucket), contentMatchCeiling), minImageCount, maxImageCount)",
      charGrowthBucket: `ceil(nonSpaceChineseOrLatinChars/${growthStepChars}) - 1`,
      unitGrowthBucket: "ceil(contentUnits/4) - 1",
      boundedGrowthBucketMax: DEFAULT_PERSONAL_IP_MAX_GROWTH_BUCKET,
      clarityCharsPerImage: DEFAULT_PERSONAL_IP_CLARITY_CHARS_PER_IMAGE,
      reason: "Short content still gets a multi-page visual set; longer scripts grow by content clarity, but page count is capped by matchable voiceover beats so the package does not create decorative extra pages.",
    },
    matchingRule: {
      sourcePriority: ["content-file/script/narration", "content", "coreIdea", "requiredText"],
      splitPolicy: "Split by Chinese/English sentence punctuation and newlines, then distribute contiguous units across image slots.",
      imageToContent: "Each image slot owns a contiguous beat plus its own required text and Agent jobs.",
      personaPolicy: "The fixed manifest-backed personal-IP presenter is bound to every page prompt.",
      videoPolicy: "Native-final personal-IP video must use the generated page set full-screen; one page may not cover the whole narration unless explicitly allowed as a draft.",
    },
    slots,
  };
}

function parseSourceImageList(args = {}) {
  const raw = [
    args.sourceImage,
    args.sourceImages,
  ].filter(Boolean).join("\n");
  return raw
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(item));
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

function canvasForAspect(aspect = "9:16") {
  const normalized = String(aspect || "9:16").trim();
  if (normalized === "16:9") {
    return {
      width: HORIZONTAL_WIDTH,
      height: HORIZONTAL_HEIGHT,
      aspectRatio: "16:9",
      orientation: "horizontal",
      filePrefix: "horizontal-personal-ip-image",
      defaultOutputName: "horizontal-personal-ip-page.png",
    };
  }
  return {
    width: VERTICAL_WIDTH,
    height: VERTICAL_HEIGHT,
    aspectRatio: "9:16",
    orientation: "vertical",
    mobileSafeAreas: {
      topBlankPx: DEFAULT_VERTICAL_TOP_SAFE_PX,
      bottomCaptionPx: DEFAULT_VERTICAL_BOTTOM_SUBTITLE_SAFE_PX,
      leftPx: 64,
      rightPx: 64,
      reason: "Reserve mobile app status/navigation UI space at the top and one-line subtitle space at the bottom.",
    },
    filePrefix: "vertical-personal-ip-image",
    defaultOutputName: "vertical-personal-ip-page.png",
  };
}

function imageRatioOk(width, height, aspectRatio = "9:16") {
  const ratio = Number(width || 0) / Math.max(1, Number(height || 0));
  if (!(Number(width) > 0 && Number(height) > 0)) return false;
  if (aspectRatio === "16:9") return ratio > 1.65 && ratio < 1.9;
  return ratio > 0.45 && ratio < 0.7;
}

function buildPagePrompt({ title, persona, coreIdea, mode, canvas, fixedPersona, imagePlan, slot }) {
  const required = slot.requiredText && slot.requiredText.length ? slot.requiredText : splitList(coreIdea);
  const jobs = slot.agentJobs || [];
  const vertical = canvas.orientation === "vertical";
  return [
    `Create page ${slot.order}/${imagePlan.resolvedImageCount} of a ${canvas.orientation} ${canvas.aspectRatio} Chinese personal-IP hand-drawn diagram source-page set, ${canvas.width}x${canvas.height}.`,
    "This is not a single all-purpose poster. It must cover only the matched spoken beat below so the final video has rich page changes.",
    "",
    "Visual mode:",
    mode === "illustration" ? "Hand-drawn illustration mode: one core visual metaphor, sparse labels, large whitespace." : "Knowledge-card mode: a complete readable content card matched to the requested aspect ratio, with a clear title, 2-4 sections, action metaphor, and subtitle-safe whitespace.",
    "",
    "Fixed personal-IP persona reference (mandatory):",
    fixedPersona.promptReference,
    "",
    "Creator role / content persona summary:",
    persona,
    "",
    "Core idea:",
    coreIdea,
    "",
    "Matched spoken beat for this page:",
    slot.contentBeat,
    "",
    "Page role:",
    slot.role,
    "",
    "Required readable Chinese text on image:",
    required.length ? required.map((item) => `- ${item}`).join("\n") : "- 个人IP图解\n- 观点\n- 拆解\n- 行动",
    "",
    "Execution Agent jobs:",
    jobs.length ? jobs.map((item) => `- ${item}`).join("\n") : "- 搬运卡片\n- 标记风险\n- 递交结果",
    "",
    "Composition:",
    vertical
      ? `Mobile top safe area is mandatory: keep the top ${canvas.mobileSafeAreas.topBlankPx}px as clean white space with no title, text, character, card, arrow, marker, icon, or decorative stroke, because phone status/navigation bars can cover this region. Begin the concise title \"${title}\" below that blank top band. Center: large hand-drawn knowledge card or diagram board. The fixed personal-IP presenter from the manifest must participate in the core action by pointing, annotating, assigning, reviewing, or resolving the diagram. Arrange 2-6 small execution Agents around the card only as concrete helpers, never as decoration. Preserve a clean bottom subtitle-safe band: the lower 18% of the canvas, at least ${canvas.mobileSafeAreas.bottomCaptionPx}px, must remain empty white space with no text, characters, cards, arrows, labels, frame lines, or decorative marks.`
      : `Left or right side: fixed adult personal-IP presenter from the manifest. Center: wide whiteboard-style hand-drawn knowledge card or diagram board with clear left-to-right reading order. The presenter must point, annotate, assign, review, or resolve the diagram. Arrange 2-6 small execution Agents around the board only as concrete helpers. Preserve a clean subtitle-safe band along the bottom: the lower 18% of the canvas must remain empty white space with no text, characters, cards, arrows, labels, frame lines, or decorative marks.`,
    "",
    "Visual DNA:",
    "White or near-white background. Minimalist black hand-drawn line art with slight pen wobble. Sparse red-orange and blue marker accents. Adult professional creator proportions. Large whitespace. Clear reading order. No cheap PPT template, no dense corporate infographic, no glossy commercial poster, no 3D, no photorealism, no watermark, no logos, no internal workflow labels.",
    "",
    "Hard layout rules:",
    vertical
      ? `Portrait page generated natively for 9:16. Do not crop or squeeze a horizontal composition. Keep the top ${canvas.mobileSafeAreas.topBlankPx}px blank for mobile chrome, and keep all content above the subtitle-safe band. No overlap between fixed presenter, cards, arrows, Agents, labels, top safe area, and bottom subtitle-safe area. Text must be short and legible.`
      : "Horizontal page generated natively for 16:9. Do not crop or stretch a portrait composition. Keep all content above the subtitle-safe band. No overlap between fixed presenter, cards, arrows, Agents, labels, and bottom subtitle-safe area. Text must be short and legible.",
    "",
    "Series continuity:",
    `This page belongs to a ${imagePlan.resolvedImageCount}-image set. Keep the same fixed persona and white-canvas hand-drawn visual DNA, but vary the content card, gesture, diagram structure, and Agent action so adjacent video pages are visually distinct.`,
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }
  const out = resolve(args.out);
  const workflow = join(out, "workflow");
  const promptsDir = join(out, "prompts");
  const imagesDir = join(out, "images");
  ensureDir(workflow);
  ensureDir(promptsDir);
  ensureDir(imagesDir);

  const canvas = canvasForAspect(args.aspect);
  const filePrefix = canvas.filePrefix;
  const fixedPersona = resolveFixedPersona(args);
  const imagePlan = buildImageQuantityPlan(args, canvas);
  const pagePromptsDir = join(promptsDir, `${filePrefix}-pages`);
  ensureDir(pagePromptsDir);
  const pagePrompts = imagePlan.slots.map((slot) => {
    const prompt = buildPagePrompt({ ...args, canvas, fixedPersona, imagePlan, slot });
    const promptPath = join(out, slot.promptFile);
    writeFileSync(promptPath, `${prompt}\n`, "utf8");
    return { slot, prompt, promptPath };
  });
  const promptIndexPath = join(promptsDir, `${filePrefix}-prompt-index.md`);
  writeFileSync(promptIndexPath, [
    `# ${args.title}`,
    "",
    `This personal-IP source set requires ${imagePlan.resolvedImageCount} generated images.`,
    `Do not generate a single combined image. Generate every page prompt under \`prompts/${filePrefix}-pages/\`, then ingest all images with \`--source-images\`.`,
    "",
    ...pagePrompts.map(({ slot }) => `- ${slot.id}: ${slot.promptFile} -> ${slot.expectedImageName} (${slot.role})`),
    "",
  ].join("\n"), "utf8");

  const contract = {
    schemaVersion: 1,
    stage: `${filePrefix}-contract`,
    status: "planned",
    route: `ip-diagram-creator-${canvas.orientation}-image`,
    sourceRepo: SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    outputCanvas: {
      width: canvas.width,
      height: canvas.height,
      aspectRatio: canvas.aspectRatio,
      orientation: canvas.orientation,
    },
    imageMode: args.mode,
    mobileSafeAreas: canvas.mobileSafeAreas || null,
    title: args.title,
    imageQuantityPolicy: {
      minImageCount: imagePlan.minImageCount,
      maxImageCount: imagePlan.maxImageCount,
      resolvedImageCount: imagePlan.resolvedImageCount,
      singleImageRejectedByDefault: imagePlan.singleImageRejectedByDefault,
      growthRule: imagePlan.growthRule,
      matchingRule: imagePlan.matchingRule,
    },
    personaPolicy: {
      persona: args.persona,
      fixedPersonaManifestRequiredForPersonalIpFinal: true,
      fixedPersonaManifestPath: fixedPersona.manifestPath,
      fixedPersonaStatus: fixedPersona.status,
      fixedPersonaAssetRequiredForFinalPersonalIp: true,
      reuseSavedManifestBeforeRegenerate: true,
      genericPersonaAllowedOnlyFromFixedDefaultManifest: fixedPersona.status === "ready-default-persona",
      noExactLikenessPromise: true,
      doNotClaimUserLikeness: fixedPersona.doNotClaimUserLikeness,
      retiredLocalTemplateFallbackForbidden: true,
      publicSkillStorageForbidden: true,
    },
    fixedPersona,
    requiredText: splitList(args.requiredText),
    agentJobs: splitList(args.agentJobs),
    promptIndex: `prompts/${filePrefix}-prompt-index.md`,
    promptDirectory: `prompts/${filePrefix}-pages/`,
    prompts: imagePlan.slots.map((slot) => slot.promptFile),
    requiredEvidence: [
      `workflow/${filePrefix}-contract.json`,
      "workflow/personal-ip-image-count-plan.json",
      `workflow/${filePrefix}-image-jobs.json`,
      "workflow/personal-ip-asset-registry.json",
      `prompts/${filePrefix}-prompt-index.md`,
      `workflow/${filePrefix}-qc.json`,
    ],
    rejectList: [
      "horizontal page cropped into portrait",
      "persona decorative only",
      "missing execution Agent action in method/workflow content",
      "overlapping cards, arrows, labels, persona, or bottom subtitle-safe area",
      ...(canvas.orientation === "vertical" ? ["title or key text inside the top mobile status/navigation safe area"] : []),
      "private persona asset copied into public Skill files",
      "ip-persona-svg",
      "template-fallback",
      "new unrelated presenter instead of fixed manifest-backed persona",
      "one image covering the whole script when minImageCount is greater than 1",
      "unreadable Chinese text",
    ],
  };

  const sourceImages = parseSourceImageList(args);
  const ingestedImages = [];
  if (sourceImages.length > 0) {
    if (sourceImages.length !== imagePlan.resolvedImageCount) {
      throw new Error(`Personal-IP source image count mismatch: planned ${imagePlan.resolvedImageCount}, received ${sourceImages.length}. Generate every page prompt before ingesting.`);
    }
    for (let index = 0; index < sourceImages.length; index += 1) {
      const source = sourceImages[index];
      const slot = imagePlan.slots[index];
      if (!existsSync(source)) throw new Error(`--source-image not found: ${source}`);
      const ext = extname(source).toLowerCase() || ".png";
      const outputName = slot.expectedImageName.replace(/\.[^.]+$/, ext);
      const target = join(imagesDir, outputName);
      copyFileSync(source, target);
      const dimensions = readImageDimensions(target);
      ingestedImages.push({
        id: slot.id,
        source,
        path: `images/${outputName}`,
        sha256: sha256File(target),
        width: dimensions.width,
        height: dimensions.height,
        aspectRatioOk: imageRatioOk(dimensions.width, dimensions.height, canvas.aspectRatio),
        contentBeat: slot.contentBeat,
        prompt: slot.promptFile,
      });
    }
  }

  const checks = {
    promptIndexPresent: existsSync(promptIndexPath),
    allPagePromptsPresent: pagePrompts.every(({ promptPath }) => existsSync(promptPath)),
    imageCountWithinRange: imagePlan.resolvedImageCount >= imagePlan.minImageCount && imagePlan.resolvedImageCount <= imagePlan.maxImageCount,
    personalIpSingleImageRejectedByDefault: imagePlan.allowSingleImage || imagePlan.resolvedImageCount > 1,
    canvasPlanned1080x1920: canvas.orientation !== "vertical" || (contract.outputCanvas.width === VERTICAL_WIDTH && contract.outputCanvas.height === VERTICAL_HEIGHT),
    canvasPlanned1920x1080: canvas.orientation !== "horizontal" || (contract.outputCanvas.width === HORIZONTAL_WIDTH && contract.outputCanvas.height === HORIZONTAL_HEIGHT),
    fixedPersonaManifestPresent: Boolean(fixedPersona.manifestPath && existsSync(fixedPersona.manifestPath)),
    fixedPersonaManifestReady: ["ready-existing-persona", "ready-default-persona"].includes(fixedPersona.status),
    fixedPersonaMainAnchorPresent: Boolean(fixedPersona.mainAnchorPath && existsSync(fixedPersona.mainAnchorPath)),
    fixedPersonaSourceGeneratedOrAnchorPresent: Boolean(fixedPersona.sourceGeneratedImage || fixedPersona.mainAnchorPath),
    fixedPersonaStorageOutsidePublicSkill: !fixedPersona.storagePolicy.manifestInsidePublicSkillPackage && !fixedPersona.storagePolicy.mainAnchorInsidePublicSkillPackage,
    promptsIncludeFixedPersonaManifest: pagePrompts.every(({ prompt }) => prompt.includes(fixedPersona.manifestPath)),
    promptsIncludeFixedPersonaAnchors: fixedPersona.visualAnchors.length === 0 || pagePrompts.some(({ prompt }) => fixedPersona.visualAnchors.some((anchor) => prompt.includes(anchor))),
    verticalTopSafeAreaPrompted: canvas.orientation !== "vertical" || pagePrompts.every(({ prompt }) => prompt.includes(`top ${DEFAULT_VERTICAL_TOP_SAFE_PX}px`) && prompt.includes("phone status/navigation bars")),
    verticalBottomSubtitleSafeAreaPrompted: canvas.orientation !== "vertical" || pagePrompts.every(({ prompt }) => prompt.includes(`at least ${DEFAULT_VERTICAL_BOTTOM_SUBTITLE_SAFE_PX}px`) && prompt.includes("bottom subtitle-safe band")),
    promptsMatchPlannedImageCount: pagePrompts.length === imagePlan.resolvedImageCount,
    retiredTemplateFallbackRejected: true,
    sourceImageCountMatchesPlanWhenProvided: sourceImages.length > 0 ? ingestedImages.length === imagePlan.resolvedImageCount : true,
    sourceImagesMatchRequestedAspectWhenProvided: sourceImages.length > 0 ? ingestedImages.every((image) => image.aspectRatioOk === true) : true,
  };
  const qc = {
    schemaVersion: 1,
    stage: `${filePrefix}-qc`,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    pass: Object.values(checks).every(Boolean),
    route: `ip-diagram-creator-${canvas.orientation}-image`,
    checks,
    outputCanvas: contract.outputCanvas,
    mobileSafeAreas: contract.mobileSafeAreas,
    fixedPersona: {
      status: fixedPersona.status,
      personaId: fixedPersona.personaId,
      personaName: fixedPersona.personaName,
      manifestPath: fixedPersona.manifestPath,
      mainAnchorPath: fixedPersona.mainAnchorPath,
      doNotClaimUserLikeness: fixedPersona.doNotClaimUserLikeness,
    },
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
    fixedPersonaManifest: fixedPersona.manifestPath,
    fixedPersonaMainAnchor: fixedPersona.mainAnchorPath,
    fixedPersonaStatus: fixedPersona.status,
    plannedPageId: image.id,
    prompt: image.prompt,
    contentBeat: image.contentBeat,
  }));
  const manifest = {
    schemaVersion: 1,
    route: `ip-diagram-creator-${canvas.orientation}-source-pages`,
    generationRoute: sourceImages.length > 0 ? "Codex built-in image_gen or user-provided generated image page set ingested by contract" : "prompt-only-multi-page",
    source_generated_images: sourceGeneratedImages,
    fixedPersona,
    contract: `workflow/${filePrefix}-contract.json`,
    promptIndex: `prompts/${filePrefix}-prompt-index.md`,
    promptDirectory: `prompts/${filePrefix}-pages/`,
    imageCountPlan: "workflow/personal-ip-image-count-plan.json",
    imageJobs: `workflow/${filePrefix}-image-jobs.json`,
    images: ingestedImages.map((image) => image.path),
    qc: `workflow/${filePrefix}-qc.json`,
    content_pages: ingestedImages.map((image, index) => ({
      id: image.id,
      file: `../${image.path}`,
      source_generated_image: sourceGeneratedImages[index],
      fixed_persona_manifest: fixedPersona.manifestPath,
      prompt: image.prompt,
      contentBeat: image.contentBeat,
    })),
    items: ingestedImages.map((image, index) => ({
      id: image.id,
      file: `../${image.path}`,
      source_generated_image: sourceGeneratedImages[index],
      fixed_persona_manifest: fixedPersona.manifestPath,
      prompt: image.prompt,
      contentBeat: image.contentBeat,
    })),
  };
  const imageJobs = {
    schemaVersion: 1,
    stage: `${filePrefix}-image-jobs`,
    status: "planned",
    route: `ip-diagram-creator-${canvas.orientation}-source-pages`,
    sourceRepo: SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    title: args.title,
    canvas: contract.outputCanvas,
    mobileSafeAreas: contract.mobileSafeAreas,
    fixedPersonaManifest: fixedPersona.manifestPath,
    fixedPersonaStatus: fixedPersona.status,
    imageQuantityPlan: {
      artifact: "workflow/personal-ip-image-count-plan.json",
      minImageCount: imagePlan.minImageCount,
      maxImageCount: imagePlan.maxImageCount,
      resolvedImageCount: imagePlan.resolvedImageCount,
    },
    jobs: imagePlan.slots.map((slot) => ({
      id: slot.id,
      order: slot.order,
      role: slot.role,
      prompt: slot.promptFile,
      expectedImageName: slot.expectedImageName,
      contentBeat: slot.contentBeat,
      requiredText: slot.requiredText,
      agentJobs: slot.agentJobs,
      matchingRule: slot.matchingRule,
      fixedPersonaManifest: fixedPersona.manifestPath,
    })),
  };
  const assetRegistry = {
    schemaVersion: 1,
    stage: "personal-ip-asset-registry",
    status: fixedPersona.status,
    route: `ip-diagram-creator-${canvas.orientation}-image`,
    makePersonalIp: "auto",
    addHandDrawnImageAnimation: "subtle",
    registrySource: fixedPersona.status === "ready-default-persona" ? "fixed-default-non-likeness-host" : "saved-user-material-library-manifest",
    manifestPath: fixedPersona.manifestPath,
    personaId: fixedPersona.personaId,
    personaName: fixedPersona.personaName,
    type: fixedPersona.type,
    doNotClaimUserLikeness: fixedPersona.doNotClaimUserLikeness,
    mainAnchorPath: fixedPersona.mainAnchorPath,
    sourceGeneratedImage: fixedPersona.sourceGeneratedImage,
    visualAnchors: fixedPersona.visualAnchors,
    sourceSkill: fixedPersona.sourceSkill,
    storagePolicy: fixedPersona.storagePolicy,
    fixedPersona,
    createOnceReuseGuidance: {
      reuseSavedManifestBeforeRegenerate: true,
      privateAssetsMustStayOutsidePublicSkillPackage: true,
      defaultFallbackAllowedOnlyWhenNoUserSpecificManifestProvided: true,
    },
  };

  writeJson(join(workflow, `${filePrefix}-contract.json`), contract);
  writeJson(join(workflow, "personal-ip-image-count-plan.json"), imagePlan);
  writeJson(join(workflow, `${filePrefix}-image-jobs.json`), imageJobs);
  writeJson(join(workflow, "personal-ip-asset-registry.json"), assetRegistry);
  writeJson(join(workflow, `${filePrefix}-qc.json`), qc);
  writeJson(join(workflow, `${filePrefix}-manifest.json`), manifest);
  writeJson(join(workflow, "manifest.json"), manifest);
  console.log(JSON.stringify({
    pass: qc.pass,
    out,
    promptIndex: promptIndexPath,
    promptDirectory: pagePromptsDir,
    imageCount: imagePlan.resolvedImageCount,
    images: ingestedImages.map((image) => image.path),
    qc: join(workflow, `${filePrefix}-qc.json`),
  }, null, 2));
}

main();
