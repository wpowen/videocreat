#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildPersonalIpPageCapacityPlan, partitionContentText } from "./lib/adaptive-content-scene-planner.mjs";

const VERTICAL_WIDTH = 1080;
const VERTICAL_HEIGHT = 1920;
const HORIZONTAL_WIDTH = 1920;
const HORIZONTAL_HEIGHT = 1080;
const DEFAULT_PERSONAL_IP_MIN_IMAGE_COUNT = 4;
const DEFAULT_PERSONAL_IP_CLARITY_CHARS_PER_IMAGE = 420;
const DEFAULT_PERSONAL_IP_SUBTITLE_CUES_PER_IMAGE = 4;
const DEFAULT_PERSONAL_IP_SPEECH_CHARS_PER_SECOND = 4.5;
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
    agentJobs: "",
    outputName: "",
    aspect: "9:16",
    personaGender: "auto",
    audioGender: "",
    voiceGender: "",
    audioSpeaker: "",
    voiceSpeaker: "",
    personaManifest: "",
    content: "",
    contentFile: "",
    script: "",
    narration: "",
    minImageCount: String(DEFAULT_PERSONAL_IP_MIN_IMAGE_COUNT),
    maxImageCount: "",
    targetImageCount: "",
    imageGrowthStepChars: "160",
    durationSeconds: "",
    audioDurationSeconds: "",
    videoDurationSeconds: "",
    subtitleCueCount: "",
    cueCount: "",
    imageSecondsPerPage: "",
    subtitleCuesPerImage: String(DEFAULT_PERSONAL_IP_SUBTITLE_CUES_PER_IMAGE),
    speechCharsPerSecond: String(DEFAULT_PERSONAL_IP_SPEECH_CHARS_PER_SECOND),
    allowSingleImage: "false",
    allowUnderCount: "false",
    allowDraftOutput: "false",
    sourceImages: "",
    personaReferenceBound: "false",
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
    "    [--aspect 9:16|16:9] [--persona-manifest <manifest.json>] [--persona-gender auto|male|female] \\",
    "    [--audio-gender male|female] [--voice-gender male|female] [--audio-speaker <speaker>] \\",
    "    [--content-file <script.txt>] [--content <text>] [--required-text <a;b;c>] \\",
    "    [--min-image-count 4] [--max-image-count <optional>] [--target-image-count n] \\",
    "    [--duration-seconds n] [--subtitle-cue-count n] [--image-seconds-per-page <optional override>] \\",
    "    [--allow-under-count true] [--allow-draft-output true] \\",
    "    [--agent-jobs <a;b;c>]",
    "",
    "Writes a vertical 9:16 or horizontal 16:9 personal-IP diagram multi-page contract and page prompts.",
    "Final generated pages are ingested only through scripts/ingest-native-imagegen-page-set.mjs after dispatch receipts and vision inspection records are written.",
    "Personal-IP output always resolves a fixed persona manifest. Without --persona-manifest, it chooses",
    "~/.codex/video-workflow/user-assets/personal-ip/generic-hosts/<male|female>/manifest.json from audio/voice gender.",
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

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
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

function normalizePersonaGenderCandidate(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "auto" || raw === "default") return null;
  if (["female", "woman", "women", "女", "女士", "女声", "女生", "girl"].includes(raw) || /female|woman|girl|女/.test(raw)) return "female";
  if (["male", "man", "men", "男", "男士", "男声", "男生", "boy"].includes(raw) || /male|man|boy|男/.test(raw)) return "male";
  return null;
}

function normalizePersonaGender(value = "male") {
  return normalizePersonaGenderCandidate(value) || "male";
}

function resolveAudioPersonaGender(args = {}) {
  const explicitPersonaGender = normalizePersonaGenderCandidate(args.personaGender);
  if (explicitPersonaGender) {
    return {
      gender: explicitPersonaGender,
      source: "persona-gender",
      matchedValue: args.personaGender,
      audioGender: normalizePersonaGenderCandidate(args.audioGender || args.voiceGender || args.audioSpeaker || args.voiceSpeaker),
      explicitPersonaGender: true,
    };
  }
  const audioCandidates = [
    ["audio-gender", args.audioGender],
    ["voice-gender", args.voiceGender],
    ["audio-speaker", args.audioSpeaker],
    ["voice-speaker", args.voiceSpeaker],
  ];
  for (const [source, value] of audioCandidates) {
    const gender = normalizePersonaGenderCandidate(value);
    if (gender) {
      return {
        gender,
        source,
        matchedValue: value,
        audioGender: gender,
        explicitPersonaGender: false,
      };
    }
  }
  return {
    gender: "female",
    source: "default-local-tts-speaker",
    matchedValue: "中文女",
    audioGender: "female",
    explicitPersonaGender: false,
  };
}

function defaultPersonaManifestPath(gender = "male") {
  return join(DEFAULT_PERSONAL_IP_ASSET_ROOT, "generic-hosts", normalizePersonaGender(gender), "manifest.json");
}

function resolvePersonaManifestPath(args = {}) {
  const resolvedGender = resolveAudioPersonaGender(args);
  return args.personaManifest
    ? resolve(args.personaManifest)
    : defaultPersonaManifestPath(resolvedGender.gender);
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
  const genderResolution = resolveAudioPersonaGender(args);
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
  const specSheetPath = resolveMaybeRelative(activeVersion?.specSheet || manifest.assets?.specSheet, dirname(manifestPath));
  const actionExpressionSmallScenePath = resolveMaybeRelative(
    activeVersion?.actionExpressionSmallScene || manifest.assets?.actionExpressionSmallScene,
    dirname(manifestPath),
  );
  const sourceGeneratedImage = activeVersion?.sourceGeneratedImage || manifest.sourceGeneratedImage || null;
  const completionNeeded = Array.isArray(manifest.completionNeeded) ? manifest.completionNeeded : [];
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
    sourceGeneratedImage
      ? `Legacy source role sheet (provenance only, do not use as page composition or required context): ${sourceGeneratedImage}`
      : "Legacy source role sheet: not recorded",
    `Visual anchors: ${visualAnchors.join(" / ") || "not recorded"}`,
    styleNote ? `Style note: ${styleNote}` : "",
    "Do not redesign a new presenter. Preserve the manifest-backed adult creator identity: layered dark hair, round glasses, dark cropped jacket, white inner shirt, orange scarf/marker accent, calm teaching posture. For final personal-IP native pages, the main anchor image must be passed as actual image/context input to the generation tool; text-only file paths or visual-anchor prose are not enough to prove character consistency. If the image runtime cannot bind the local image reference, stop at prompt-only or draft review instead of claiming final persona consistency.",
  ].filter(Boolean).join("\n");

  return {
    schemaVersion: 1,
    status,
    resolvedPersonaGender: genderResolution.gender,
    personaGenderSource: args.personaManifest ? "explicit-persona-manifest" : genderResolution.source,
    audioGenderBinding: {
      rule: "personal-IP default host gender follows the selected/provided audio gender unless an explicit persona manifest or persona-gender override is supplied",
      audioGender: genderResolution.audioGender,
      personaGender: genderResolution.gender,
      source: args.personaManifest ? "explicit-persona-manifest" : genderResolution.source,
      matchedValue: args.personaManifest ? args.personaManifest : genderResolution.matchedValue,
      explicitPersonaGender: genderResolution.explicitPersonaGender,
    },
    personaId: manifest.personaId || null,
    personaName: manifest.displayName || manifest.name || manifest.personaId || "fixed-personal-ip-persona",
    type: manifest.type || null,
    manifestPath,
    manifestSha256: sha256File(manifestPath),
    mainAnchorPath,
    mainAnchorSha256: mainAnchorPath ? sha256File(mainAnchorPath) : null,
    specSheetPath: specSheetPath && existsSync(specSheetPath) ? specSheetPath : null,
    actionExpressionSmallScenePath: actionExpressionSmallScenePath && existsSync(actionExpressionSmallScenePath) ? actionExpressionSmallScenePath : null,
    completionNeeded,
    templateSetComplete: completionNeeded.length === 0
      && Boolean(mainAnchorPath)
      && Boolean(specSheetPath && existsSync(specSheetPath))
      && Boolean(actionExpressionSmallScenePath && existsSync(actionExpressionSmallScenePath)),
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

function personaReferenceImagesForGeneration(fixedPersona = {}) {
  const candidates = [
    ["main-anchor", fixedPersona.mainAnchorPath, true],
    ["spec-sheet", fixedPersona.specSheetPath, false],
    ["action-expression-small-scene", fixedPersona.actionExpressionSmallScenePath, false],
  ];
  const seen = new Set();
  return candidates
    .map(([role, path, required]) => ({ role, path, required }))
    .filter((item) => {
      if (!item.path || !existsSync(item.path)) return false;
      const absolutePath = resolve(item.path);
      if (seen.has(absolutePath)) return false;
      seen.add(absolutePath);
      return true;
    })
    .map((item) => ({
      role: item.role,
      path: resolve(item.path),
      required: item.required,
      sha256: sha256File(item.path),
    }));
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

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value || ""));
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
  const primaryNarration = normalizePlanningText([
    fileText,
    args.content,
  ].filter(Boolean).join("\n"));
  if (primaryNarration) return primaryNarration;
  return normalizePlanningText(
    args.coreIdea || splitList(args.requiredText).join("。"),
  );
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
  const requestedMaxImageCount = args.maxImageCount ? Math.max(minImageCount, toPositiveInt(args.maxImageCount, minImageCount)) : null;
  const allowUnderCount = isEnabled(args.allowUnderCount);
  const growthStepChars = Math.max(80, toPositiveInt(args.imageGrowthStepChars, 160));
  const secondsPerImageOverride = toPositiveNumber(args.imageSecondsPerPage || args.secondsPerImage, 0);
  const subtitleCuesPerImage = Math.max(1, toPositiveInt(args.subtitleCuesPerImage || args.cuesPerImage, DEFAULT_PERSONAL_IP_SUBTITLE_CUES_PER_IMAGE));
  const speechCharsPerSecond = Math.max(2.5, toPositiveNumber(args.speechCharsPerSecond, DEFAULT_PERSONAL_IP_SPEECH_CHARS_PER_SECOND));
  const content = collectPlanningContent(args);
  const contentUnits = splitContentUnits(content);
  const charCount = Array.from(content.replace(/\s/g, "")).length;
  const unitCount = contentUnits.length;
  const explicitDurationSeconds = Math.max(
    toPositiveNumber(args.durationSeconds, 0),
    toPositiveNumber(args.audioDurationSeconds, 0),
    toPositiveNumber(args.videoDurationSeconds, 0),
  );
  const estimatedSpeechDurationSeconds = charCount > 0
    ? Number((charCount / speechCharsPerSecond).toFixed(3))
    : 0;
  const effectiveDurationSeconds = explicitDurationSeconds || estimatedSpeechDurationSeconds;
  const subtitleCueCount = Math.max(
    0,
    toPositiveInt(args.subtitleCueCount, 0),
    toPositiveInt(args.cueCount, 0),
    toPositiveInt(args.narrationCueCount, 0),
  );
  const adaptiveCount = buildPersonalIpPageCapacityPlan({
    aspect: canvas.aspectRatio,
    sourceCount: minImageCount,
    durationSeconds: effectiveDurationSeconds,
    subtitleCueCount,
    charCount,
    contentUnitCount: unitCount,
    minCount: minImageCount,
    requestedTarget: args.targetImageCount,
    requestedMaximum: requestedMaxImageCount || 0,
    secondsPerPage: secondsPerImageOverride,
  });
  const charGrowthBucket = null;
  const unitGrowthBucket = null;
  const boundedCharGrowthBucket = null;
  const boundedUnitGrowthBucket = null;
  const exponentialByChars = null;
  const exponentialByUnits = null;
  const semanticFloor = adaptiveCount.semanticUnitTarget;
  const clarityByChars = adaptiveCount.contentBasedTarget;
  const durationBasedTarget = adaptiveCount.durationBasedTarget;
  const subtitleCueBasedTarget = adaptiveCount.subtitleCueBasedTarget;
  const contentClarityTarget = adaptiveCount.contentBasedTarget;
  const contentMatchTarget = adaptiveCount.semanticUnitTarget;
  const contentGrowthTarget = Math.max(contentClarityTarget, contentMatchTarget);
  const automaticTarget = adaptiveCount.automaticTarget;
  const automaticMaxPolicyFloor = automaticTarget;
  const maxImageCountUnderAutomaticPolicy = adaptiveCount.requestedMaximumUnderAutomatic;
  const maxImageCount = adaptiveCount.maxUniquePages;
  const automaticResolvedTarget = adaptiveCount.automaticTarget;
  const explicitRequestedTarget = adaptiveCount.requestedTarget;
  const explicitTarget = adaptiveCount.requestedTarget;
  const explicitTargetUnderAutomatic = Boolean(explicitRequestedTarget && explicitRequestedTarget < automaticResolvedTarget);
  const resolvedImageCount = adaptiveCount.uniqueGeneratedPageCount;
  const targetDrivers = [
    ["explicitTarget", explicitTarget || 0],
    ["durationBasedTarget", durationBasedTarget],
    ["subtitleCueBasedTarget", subtitleCueBasedTarget],
    ["contentClarityTarget", contentClarityTarget],
    ["contentMatchTarget", contentMatchTarget],
    ["contentGrowthTarget", contentGrowthTarget],
  ].filter(([, value]) => Number(value || 0) > 0);
  const strongestAutomaticDriver = targetDrivers
    .filter(([name]) => name !== "explicitTarget")
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0] || ["minImageCount", minImageCount];
  const requiredText = splitList(args.requiredText);
  const agentJobs = splitList(args.agentJobs);
  const contentBeats = partitionContentText(content, resolvedImageCount, { label: "personal-IP source content" });
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
    return {
      id: `page-${String(index + 1).padStart(2, "0")}`,
      order: index + 1,
      role: roles[index % roles.length],
      contentBeat: contentBeats[index],
      sourceUnitIndexes: [],
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
    requestedMaxImageCount,
    maxImageCountUnderAutomaticPolicy,
    maxImageCountRaisedToAutomaticPolicy: false,
    requestedMaximumApplied: adaptiveCount.requestedMaximumApplied,
    maximumPolicy: adaptiveCount.maximumPolicy,
    maxUniquePages: adaptiveCount.maxUniquePages,
    coverageStrategy: adaptiveCount.coverageStrategy,
    repairVariantPolicy: adaptiveCount.repairVariantPolicy,
    maxRepairGenerations: adaptiveCount.maxRepairGenerations,
    resolvedImageCount,
    automaticResolvedTarget,
    explicitRequestedTarget,
    explicitTarget,
    explicitTargetUnderAutomatic,
    explicitTargetRaisedToAutomatic: false,
    allowUnderCount,
    underCountRejectedByDefault: false,
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
      durationSeconds: explicitDurationSeconds || null,
      durationSecondsSource: explicitDurationSeconds ? "explicit-duration/audio/video" : "estimated-from-content-chars",
      estimatedSpeechDurationSeconds,
      effectiveDurationSeconds,
      secondsPerImage: adaptiveCount.pageCapacity.secondsPerPage,
      subtitleCueCount,
      subtitleCuesPerImage,
      durationBasedTarget,
      subtitleCueBasedTarget,
      contentClarityTarget,
      contentMatchTarget,
      contentMatchCeiling: maxImageCount,
      requestedMaxImageCount,
      automaticMaxPolicyFloor,
      contentGrowthTarget,
      exponentialByChars,
      exponentialByUnits,
      automaticTarget,
      automaticResolvedTarget,
      strongestAutomaticDriver: strongestAutomaticDriver[0],
    },
    durationDensityRule: {
      targetSecondsPerImage: adaptiveCount.pageCapacity.secondsPerPage,
      subtitleCuesPerImage,
      speechCharsPerSecond,
      durationBasedTarget,
      subtitleCueBasedTarget,
      reason: "Personal-IP source pages are packed by spoken-content capacity; subtitle and semantic cadence remains inside each page instead of creating extra Image2 requests.",
    },
    growthRule: {
      formula: "unique pages = semantic page-capacity target clamped to the duration safety band and any explicit user maximum; subtitle/semantic units become in-page micro beats",
      charGrowthBucket: `ceil(nonSpaceChineseOrLatinChars/${growthStepChars}) - 1`,
      unitGrowthBucket: "ceil(contentUnits/4) - 1",
      boundedGrowthBucketMax: DEFAULT_PERSONAL_IP_MAX_GROWTH_BUCKET,
      clarityCharsPerImage: adaptiveCount.pageCapacity.charsPerPage,
      durationSafetyBand: adaptiveCount.durationBand,
      reason: "Short content keeps a useful page set while long scripts remain bounded by page capacity and duration bands; explicit user maxima are hard caps.",
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

function safeSha256File(path) {
  try {
    return path && existsSync(path) ? sha256File(path) : null;
  } catch {
    return null;
  }
}

function collectForbiddenSourceImageAssets(fixedPersona = {}, personaReferenceImages = []) {
  const manifestDir = fixedPersona.manifestPath ? dirname(fixedPersona.manifestPath) : process.cwd();
  const assets = [];
  const pushAsset = (role, path, required = false) => {
    const resolvedPath = resolveMaybeRelative(path, manifestDir);
    if (!resolvedPath || !existsSync(resolvedPath)) return;
    assets.push({
      role,
      path: resolve(resolvedPath),
      required,
      sha256: safeSha256File(resolvedPath),
    });
  };

  pushAsset("fixed-persona-main-anchor", fixedPersona.mainAnchorPath, true);
  pushAsset("legacy-source-generated-role-sheet", fixedPersona.sourceGeneratedImage, false);
  pushAsset("fixed-persona-spec-sheet", fixedPersona.specSheetPath, false);
  pushAsset("fixed-persona-action-expression-small-scene", fixedPersona.actionExpressionSmallScenePath, false);
  personaReferenceImages.forEach((image) => pushAsset(`context-image-${image.role}`, image.path, image.required));

  const seen = new Set();
  return assets.filter((asset) => {
    const key = `${asset.path}:${asset.sha256 || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findForbiddenSourceImageConflict(source, forbiddenAssets = []) {
  const resolvedSource = resolve(source);
  const sourceSha256 = safeSha256File(resolvedSource);
  return forbiddenAssets.find((asset) => {
    if (asset.path && resolve(asset.path) === resolvedSource) return true;
    return Boolean(asset.sha256 && sourceSha256 && asset.sha256 === sourceSha256);
  }) || null;
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
      ? `Mobile top safe area is mandatory: keep the top ${canvas.mobileSafeAreas.topBlankPx}px as clean white space with no title, text, character, card, arrow, marker, icon, or decorative stroke, because phone status/navigation bars can cover this region. Begin the concise title "${title}" below that blank top band. Center: large hand-drawn knowledge card or diagram board. The fixed personal-IP presenter from the manifest must participate in the core action by pointing, annotating, assigning, reviewing, or resolving the diagram. Arrange 2-6 small execution Agents around the card only as concrete helpers, never as decoration. Preserve a clean bottom subtitle-safe band: the lower 18% of the canvas, at least ${canvas.mobileSafeAreas.bottomCaptionPx}px, must remain empty white space with no text, characters, cards, arrows, labels, frame lines, or decorative marks.`
      : `Left or right side: fixed adult personal-IP presenter from the manifest. Center: wide whiteboard-style hand-drawn knowledge card or diagram board with clear left-to-right reading order. The presenter must point, annotate, assign, review, or resolve the diagram. Arrange 2-6 small execution Agents around the board only as concrete helpers. Reserve the entire bottom 22% of the 16:9 canvas as physically blank pure white space across the full width. No presenter body, hair, hands, Agents, cards, borders, arrows, labels, icons, shadows, lines, signatures, or decorative marks may enter this bottom band. Keep every visible element inside the upper 78% and end all artwork clearly above the boundary.`,
    "",
    "Visual DNA:",
    "White or near-white background. Minimalist black hand-drawn line art with slight pen wobble. Sparse red-orange and blue marker accents. Adult professional creator proportions. Large whitespace. Clear reading order. No cheap PPT template, no dense corporate infographic, no glossy commercial poster, no 3D, no photorealism, no watermark, no logos, no internal workflow labels.",
    "",
    "Hard layout rules:",
    vertical
      ? `Portrait page generated natively for 9:16. Do not crop or squeeze a horizontal composition. Keep the top ${canvas.mobileSafeAreas.topBlankPx}px blank for mobile chrome, and keep all content above the subtitle-safe band. No overlap between fixed presenter, cards, arrows, Agents, labels, top safe area, and bottom subtitle-safe area. Text must be short and legible.`
      : "Horizontal page generated natively for 16:9. Do not crop or stretch a portrait composition. The bottom 22% must remain uninterrupted pure white pixels across the full width so opaque video subtitles can be placed there. This measurable blank-band rule overrides decorative balance. No overlap between fixed presenter, cards, arrows, Agents, labels, and bottom subtitle-safe area. Text must be short and legible.",
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
  const sourceImages = parseSourceImageList(args);
  if (sourceImages.length > 0) {
    throw new Error("--source-images is no longer a final ingest path. Record every generated result with scripts/record-native-imagegen-page-result.mjs, then run scripts/ingest-native-imagegen-page-set.mjs against workflow/context-image2-persona-page-requests.json.");
  }
  const personaReferenceBound = isEnabled(args.personaReferenceBound);
  const personaReferenceImages = personaReferenceImagesForGeneration(fixedPersona);
  const forbiddenSourceImageAssets = collectForbiddenSourceImageAssets(fixedPersona, personaReferenceImages);
  const existingRequestsPath = join(workflow, "context-image2-persona-page-requests.json");
  const existingRequestsDocument = existsSync(existingRequestsPath) ? readJson(existingRequestsPath) : {};
  const existingRequestsById = new Map((existingRequestsDocument.requests || []).map((request) => [String(request.id), request]));
  const promptsById = new Map(pagePrompts.map(({ slot, prompt }) => [String(slot.id), prompt]));
  const contextImage2PersonaPageRequests = {
    schemaVersion: 1,
    stage: "context-image2-persona-page-requests",
    status: sourceImages.length > 0 && personaReferenceBound
      ? "satisfied-by-ingested-source-images"
      : "required-pending",
    provider: "codex-context-image2",
    tool: "image_gen",
    requiredForFinalNativePages: true,
    route: `ip-diagram-creator-${canvas.orientation}-source-pages`,
    promptDirectory: `prompts/${filePrefix}-pages`,
    generationRule: "Generate each page with the same fixed persona reference images attached as context input. Text-only paths or visual-anchor prose do not prove character consistency.",
    generationAcceptance: {
      visualInspectionRequired: true,
      rule: "Prompt lint and image provenance are necessary but insufficient. Inspect semantic match, identity, hierarchy, cross-page repetition, whitelist text, safe zones, material, lighting, line weight, and depth before the page may become a final native source.",
      minimumSetReview: ["opening", "one mechanism or method page", "one dense evidence page", "closing"],
    },
    referenceBindingRule: "Every final page must later be ingested with --persona-reference-bound true so source_generated_images[].personaReferenceBoundToGeneration is true.",
    parallelGenerationPolicy: {
      allowed: true,
      defaultMaxConcurrency: 2,
      maxConcurrency: 3,
      concurrencyEnv: "CODEX_VIDEO_IMAGE2_CONCURRENCY",
      consistencyGroup: "fixed-persona-main-anchor-page-set",
      rule: "Page requests may be generated concurrently only when every request attaches the same required main-anchor context image set from this manifest. Preserve request order and expectedOutput names, then ingest the complete set together with --persona-reference-bound true.",
      notAllowedWhen: [
        "any page uses a different persona context image set",
        "a page tries to use another newly generated page as its identity reference",
        "the tool cannot bind the required main-anchor image as context input for every request",
      ],
    },
    fixedPersonaManifest: fixedPersona.manifestPath,
    resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
    audioGenderBinding: fixedPersona.audioGenderBinding,
    contextImages: personaReferenceImages,
    requests: imagePlan.slots.map((slot) => {
      const existing = existingRequestsById.get(String(slot.id));
      const prompt = promptsById.get(String(slot.id)) || "";
      const receipt = existing?.generationReceipt;
      const receiptOutputPath = String(receipt?.outputPath || existing?.sourceImage || "");
      const receiptMatchesCurrentRequest = Boolean(receipt
        && receipt.promptSha256 === sha256Text(prompt)
        && receipt.outputSha256
        && receiptOutputPath
        && existsSync(receiptOutputPath)
        && sha256File(receiptOutputPath) === receipt.outputSha256
        && receipt.personaReferenceBound === true
        && receipt.provider === "codex-context-image2"
        && receipt.tool === "image_gen");
      return {
        id: slot.id,
        order: slot.order,
        provider: "codex-context-image2",
        tool: "image_gen",
        parallelSafe: true,
        consistencyGroup: "fixed-persona-main-anchor-page-set",
        requiredForFinalNativePages: true,
        width: canvas.width,
        height: canvas.height,
        aspectRatio: canvas.aspectRatio,
        promptPath: slot.promptFile,
        visualInspectionRequired: true,
        inspectionRecordPath: `workflow/context-image2-persona-page-evidence/${slot.id}-inspection-record.json`,
        expectedOutput: `images/${slot.expectedImageName}`,
        fixedPersonaManifest: fixedPersona.manifestPath,
        contextImages: personaReferenceImages,
        requiredContextImageRoles: personaReferenceImages
          .filter((image) => image.required)
          .map((image) => image.role),
        recordCommand: `node scripts/record-native-imagegen-page-result.mjs --jobs ${existingRequestsPath} --job-id ${slot.id} --request-id ${slot.id} --source <generated-page.png> --persona-reference-bound true --inspection-status passed-vision-review --inspector-type vision`,
        ...(receiptMatchesCurrentRequest ? {
          requestId: existing.requestId || receipt.requestId,
          generationReceipt: receipt,
          sourceImage: receiptOutputPath,
          sourceImageSha256: receipt.outputSha256,
          promptSha256: receipt.promptSha256,
        } : {}),
      };
    }),
  };
  const promptIndexPath = join(promptsDir, `${filePrefix}-prompt-index.md`);
  writeFileSync(promptIndexPath, [
    `# ${args.title}`,
    "",
    `This personal-IP source set requires ${imagePlan.resolvedImageCount} generated images.`,
    `Do not generate a single combined image. Use \`workflow/context-image2-persona-page-requests.json\` so every page is generated with the same fixed persona context images, record every result plus vision inspection, then use the canonical \`scripts/ingest-native-imagegen-page-set.mjs\` entrypoint.`,
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
      resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
      personaGenderSource: fixedPersona.personaGenderSource,
      audioGenderBinding: fixedPersona.audioGenderBinding,
      defaultHostGenderMustFollowAudioGender: true,
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
      "workflow/context-image2-persona-page-requests.json",
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

  const ingestedImages = [];
  const sourceImagePersonaReferenceConflicts = [];
  if (sourceImages.length > 0) {
    if (sourceImages.length !== imagePlan.resolvedImageCount) {
      throw new Error(`Personal-IP source image count mismatch: planned ${imagePlan.resolvedImageCount}, received ${sourceImages.length}. Generate every page prompt before ingesting.`);
    }
    for (let index = 0; index < sourceImages.length; index += 1) {
      const source = sourceImages[index];
      const slot = imagePlan.slots[index];
      if (!existsSync(source)) throw new Error(`--source-image not found: ${source}`);
      const conflict = findForbiddenSourceImageConflict(source, forbiddenSourceImageAssets);
      if (conflict) {
        sourceImagePersonaReferenceConflicts.push({
          slotId: slot.id,
          source,
          role: conflict.role,
          path: conflict.path,
          sha256: conflict.sha256,
        });
        throw new Error(`Personal-IP source image cannot be a fixed persona reference asset: ${source} matches ${conflict.role} (${conflict.path}). Generate final page images from workflow/context-image2-persona-page-requests.json and pass those page outputs via --source-images; do not ingest main-anchor, sourceGeneratedImage, role/spec sheet, or style-board assets.`);
      }
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
        personaReferenceAssetConflict: null,
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
    contextImage2PersonaPageRequestsPresent: contextImage2PersonaPageRequests.requests.length === imagePlan.resolvedImageCount,
    contextImage2RequestsUseFixedPersonaImages: personaReferenceImages.some((image) => image.required === true)
      && contextImage2PersonaPageRequests.requests.every((request) => Array.isArray(request.contextImages)
        && request.contextImages.some((image) => image.required === true)),
    contextImage2RequiredImagesAreMainAnchorOnly: personaReferenceImages.filter((image) => image.required).every((image) => image.role === "main-anchor")
      && contextImage2PersonaPageRequests.requests.every((request) => Array.isArray(request.requiredContextImageRoles)
        && request.requiredContextImageRoles.length === 1
        && request.requiredContextImageRoles[0] === "main-anchor"),
    contextImage2NoSourceGeneratedPersonaContext: personaReferenceImages.every((image) => image.role !== "source-generated-persona")
      && contextImage2PersonaPageRequests.requests.every((request) => Array.isArray(request.contextImages)
        && request.contextImages.every((image) => image.role !== "source-generated-persona")),
    defaultPersonaGenderMatchesAudioGender: fixedPersona.audioGenderBinding.source === "explicit-persona-manifest"
      || fixedPersona.audioGenderBinding.explicitPersonaGender === true
      || fixedPersona.audioGenderBinding.audioGender === fixedPersona.audioGenderBinding.personaGender,
    fixedPersonaReferenceBindingConfirmed: sourceImages.length > 0 ? personaReferenceBound : false,
    fixedPersonaTextOnlyReferenceRejectedForFinal: sourceImages.length > 0 ? personaReferenceBound : false,
    promptsIncludeFixedPersonaManifest: pagePrompts.every(({ prompt }) => prompt.includes(fixedPersona.manifestPath)),
    promptsIncludeFixedPersonaAnchors: fixedPersona.visualAnchors.length === 0 || pagePrompts.some(({ prompt }) => fixedPersona.visualAnchors.some((anchor) => prompt.includes(anchor))),
    personalIpWhiteCanvasPreserved: pagePrompts.every(({ prompt }) => prompt.includes("White or near-white background")
      && !prompt.includes("warm off-white")
      && !prompt.includes("warm uncoated paper")),
    verticalTopSafeAreaPrompted: canvas.orientation !== "vertical" || pagePrompts.every(({ prompt }) => prompt.includes(`top ${DEFAULT_VERTICAL_TOP_SAFE_PX}px`) && prompt.includes("phone status/navigation bars")),
    verticalBottomSubtitleSafeAreaPrompted: canvas.orientation !== "vertical" || pagePrompts.every(({ prompt }) => prompt.includes(`at least ${DEFAULT_VERTICAL_BOTTOM_SUBTITLE_SAFE_PX}px`) && prompt.includes("bottom subtitle-safe band")),
    promptsMatchPlannedImageCount: pagePrompts.length === imagePlan.resolvedImageCount,
    retiredTemplateFallbackRejected: true,
    sourceImageCountMatchesPlanWhenProvided: sourceImages.length > 0 ? ingestedImages.length === imagePlan.resolvedImageCount : true,
    sourceImagesMatchRequestedAspectWhenProvided: sourceImages.length > 0 ? ingestedImages.every((image) => image.aspectRatioOk === true) : true,
    sourceImagesDoNotReusePersonaReferenceAssets: sourceImages.length > 0
      ? sourceImagePersonaReferenceConflicts.length === 0 && ingestedImages.every((image) => !image.personaReferenceAssetConflict)
      : true,
    imageCountSatisfiesAutomaticPolicy: imagePlan.resolvedImageCount === imagePlan.automaticResolvedTarget
      || Boolean(imagePlan.explicitRequestedTarget)
      || imagePlan.requestedMaximumApplied === true,
    maxImageCountDoesNotUndercutAutomaticPolicy: !imagePlan.maxImageCountUnderAutomaticPolicy
      || imagePlan.requestedMaximumApplied === true,
    explicitMaximumNeverRaised: imagePlan.maxImageCountRaisedToAutomaticPolicy === false,
  };
  const qc = {
    schemaVersion: 1,
    stage: `${filePrefix}-qc`,
    status: sourceImages.length > 0
      ? Object.values(checks).every(Boolean) ? "pass" : "fail"
      : "pending-context-image2-generation",
    pass: sourceImages.length > 0 && Object.values(checks).every(Boolean),
    route: `ip-diagram-creator-${canvas.orientation}-image`,
    checks,
    contextImage2PersonaPageRequests: "workflow/context-image2-persona-page-requests.json",
    forbiddenSourceImageAssets: forbiddenSourceImageAssets.map((asset) => ({
      role: asset.role,
      path: asset.path,
      required: asset.required,
      sha256: asset.sha256,
    })),
    sourceImagePersonaReferenceConflicts,
    outputCanvas: contract.outputCanvas,
    mobileSafeAreas: contract.mobileSafeAreas,
    fixedPersona: {
      status: fixedPersona.status,
      resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
      personaGenderSource: fixedPersona.personaGenderSource,
      audioGenderBinding: fixedPersona.audioGenderBinding,
      personaId: fixedPersona.personaId,
      personaName: fixedPersona.personaName,
      manifestPath: fixedPersona.manifestPath,
      mainAnchorPath: fixedPersona.mainAnchorPath,
      sourceGeneratedImage: fixedPersona.sourceGeneratedImage,
      specSheetPath: fixedPersona.specSheetPath,
      actionExpressionSmallScenePath: fixedPersona.actionExpressionSmallScenePath,
      templateSetComplete: fixedPersona.templateSetComplete,
      completionNeeded: fixedPersona.completionNeeded,
      contextImagesPlannedForGeneration: personaReferenceImages,
      personaReferenceBoundToGeneration: personaReferenceBound,
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
    provider: "codex-context-image2",
    tool: "image_gen",
    generator: "Codex built-in image_gen",
    id: args.sourceGeneratedId ? `${args.sourceGeneratedId}-${String(index + 1).padStart(2, "0")}` : null,
    originalPath: image.source,
    canonicalWorkflowGeneratedBitmap: true,
    requestManifest: "workflow/context-image2-persona-page-requests.json",
    fixedPersonaManifest: fixedPersona.manifestPath,
    fixedPersonaMainAnchor: fixedPersona.mainAnchorPath,
    fixedPersonaStatus: fixedPersona.status,
    resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
    audioGenderBinding: fixedPersona.audioGenderBinding,
    personaReferenceBoundToGeneration: personaReferenceBound,
    referenceImagesUsed: personaReferenceBound ? personaReferenceImages : [],
    textOnlyReferenceRejectedForFinal: true,
    plannedPageId: image.id,
    prompt: image.prompt,
    contentBeat: image.contentBeat,
  }));
  const manifest = {
    schemaVersion: 1,
    route: `ip-diagram-creator-${canvas.orientation}-source-pages`,
    generationRoute: sourceImages.length > 0 ? "Codex Context Image2 / built-in image_gen page set ingested by contract" : "prompt-only-multi-page",
    canonicalImageProvider: "codex-context-image2",
    canonicalImageTool: "image_gen",
    source_generated_images: sourceGeneratedImages,
    fixedPersona,
    audioGenderBinding: fixedPersona.audioGenderBinding,
    contract: `workflow/${filePrefix}-contract.json`,
    promptIndex: `prompts/${filePrefix}-prompt-index.md`,
    promptDirectory: `prompts/${filePrefix}-pages/`,
    contextImage2PersonaPageRequests: "workflow/context-image2-persona-page-requests.json",
    imageCountPlan: "workflow/personal-ip-image-count-plan.json",
    imageJobs: `workflow/${filePrefix}-image-jobs.json`,
    images: ingestedImages.map((image) => image.path),
    qc: `workflow/${filePrefix}-qc.json`,
    content_pages: ingestedImages.map((image, index) => ({
      id: image.id,
      file: `../${image.path}`,
      source_generated_image: sourceGeneratedImages[index],
      fixed_persona_manifest: fixedPersona.manifestPath,
      resolved_persona_gender: fixedPersona.resolvedPersonaGender,
      prompt: image.prompt,
      contentBeat: image.contentBeat,
    })),
    items: ingestedImages.map((image, index) => ({
      id: image.id,
      file: `../${image.path}`,
      source_generated_image: sourceGeneratedImages[index],
      fixed_persona_manifest: fixedPersona.manifestPath,
      resolved_persona_gender: fixedPersona.resolvedPersonaGender,
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
    fixedPersonaReferenceImages: personaReferenceImages,
    contextImage2PersonaPageRequests: "workflow/context-image2-persona-page-requests.json",
    resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
    audioGenderBinding: fixedPersona.audioGenderBinding,
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
      fixedPersonaMainAnchor: fixedPersona.mainAnchorPath,
      fixedPersonaSourceGeneratedImage: fixedPersona.sourceGeneratedImage,
      personaReferenceBoundRequired: true,
      contextImages: personaReferenceImages,
      requiredContextImageRoles: personaReferenceImages
        .filter((image) => image.required)
        .map((image) => image.role),
      resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
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
    resolvedPersonaGender: fixedPersona.resolvedPersonaGender,
    personaGenderSource: fixedPersona.personaGenderSource,
    activeVersion: fixedPersona.activeVersion,
    audioGenderBinding: fixedPersona.audioGenderBinding,
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
  writeJson(join(workflow, "context-image2-persona-page-requests.json"), contextImage2PersonaPageRequests);
  writeJson(join(workflow, "personal-ip-asset-registry.json"), assetRegistry);
  writeJson(join(workflow, `${filePrefix}-qc.json`), qc);
  writeJson(join(workflow, `${filePrefix}-manifest.json`), manifest);
  writeJson(join(workflow, "manifest.json"), manifest);
  console.log(JSON.stringify({
    pass: qc.pass,
    out,
    promptIndex: promptIndexPath,
    promptDirectory: pagePromptsDir,
    contextImage2PersonaPageRequests: join(workflow, "context-image2-persona-page-requests.json"),
    imageCount: imagePlan.resolvedImageCount,
    images: ingestedImages.map((image) => image.path),
    qc: join(workflow, `${filePrefix}-qc.json`),
  }, null, 2));
  if (sourceImages.length > 0 && !qc.pass && !isEnabled(args.allowDraftOutput)) {
    process.exitCode = 2;
  }
}

main();
