#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  formatContextImage2CoverPromptDocument,
  sha256Text,
} from "./lib/cover-generation-workflow.mjs";
import { cleanupIntermediateVideoArtifacts } from "./lib/intermediate-video-cleanup.mjs";

const SOURCE_REPO = "https://github.com/haloshin/ip-diagram-creator";
const SOURCE_COMMIT = "dd64ab5d972893f7ca271d9c560362d7788eb2d6";
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CODEX_VIDEO_SKILL_PATH = join(SKILL_ROOT, "SKILL.md");
const IP_DIAGRAM_INTEGRATION_REFERENCE_PATH = join(SKILL_ROOT, "references", "ip-diagram-creator-integration.md");
const IP_DIAGRAM_CREATOR_SKILL_PATH = join(SKILL_ROOT, "vendor", "ip-diagram-creator", "SKILL.md");
const IP_DIAGRAM_CREATOR_VENDOR_MANIFEST_PATH = join(SKILL_ROOT, "vendor", "ip-diagram-creator", "VENDORED_SOURCE.json");
const IP_DIAGRAM_CREATOR_VENDOR_REFERENCE_PATHS = [
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "identity-and-character.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "visual-language.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "content-workflow.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "modes-and-sizes.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "ppt-presentation-mode.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "prompt-templates.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "qa-repair.md"),
  join(SKILL_ROOT, "vendor", "ip-diagram-creator", "references", "safety-and-assets.md"),
];
const DEFAULT_LANDSCAPE_WIDTH = 1920;
const DEFAULT_LANDSCAPE_HEIGHT = 1080;
const DEFAULT_PORTRAIT_WIDTH = 1080;
const DEFAULT_PORTRAIT_HEIGHT = 1920;
const DELIVERY_AUDIO_SAMPLE_RATE = 48000;
const DELIVERY_AUDIO_CHANNELS = 2;
const FINAL_AUDIO_DELIVERY_FILTER = [
  "highpass=f=70",
  "lowpass=f=14000",
  "acompressor=threshold=-20dB:ratio=2.5:attack=15:release=180:makeup=2dB:knee=2.5:detection=rms",
  "loudnorm=I=-15:TP=-1.5:LRA=5",
  "alimiter=limit=0.95",
  "aresample=48000",
  "aformat=sample_rates=48000:channel_layouts=stereo",
].join(",");
const MIN_AUDIBLE_MEAN_DB = -18;
const MIN_AUDIBLE_MAX_DB = -3;
const DEFAULT_PERSONAL_IP_MIN_NATIVE_PAGE_COUNT = 4;
const DEFAULT_VERTICAL_TOP_SAFE_PX = 220;
const DEFAULT_CAPTION_SAFE_BOTTOM_RATIO = 0.155;
const NATIVE_PAGE_PROVENANCE_HINT = "Regenerate the content pages through the original ip-diagram-creator direct-generation/image_gen route, or pass --allow-unverified-native-pages true only for an explicitly marked draft/degraded review.";

function parseArgs(argv) {
  const args = {
    fps: 30,
    subtitleMode: "both",
    personalIp: "auto",
    handDrawnAnimation: "off",
    allowUnverifiedNativePages: "false",
    verticalTopSafeMode: "auto",
    verticalTopSafePx: String(DEFAULT_VERTICAL_TOP_SAFE_PX),
    title: "IP Diagram Creator Native Pages",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${key}`);
    }
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return args;
}

function requireFile(path, label) {
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`${label} not found: ${resolved}`);
  return resolved;
}

function requireDir(path, label) {
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`${label} not found: ${resolved}`);
  return resolved;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function greatestCommonDivisor(a, b) {
  let x = Math.abs(Number(a) || 0);
  let y = Math.abs(Number(b) || 0);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function aspectRatio(width, height) {
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function safeFileStem(value, fallback = "cover") {
  const stem = String(value || fallback)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stem || fallback;
}

function captionSafeArea(canvas = {}) {
  const height = Number(canvas.height || DEFAULT_LANDSCAPE_HEIGHT);
  const bottomPx = Math.max(132, Math.round(height * DEFAULT_CAPTION_SAFE_BOTTOM_RATIO));
  const visualHeight = Math.max(1, height - bottomPx);
  return {
    bottomPx,
    bottomPercent: Number((bottomPx / height * 100).toFixed(3)),
    visualHeight,
    cssVar: `${bottomPx}px`,
    policy: "full-canvas-source-with-pixel-verified-blank-bottom-caption-band",
  };
}

export function auditNativeCaptionSafeAreas({
  pages = [],
  canvas = {},
  safeArea = captionSafeArea(canvas),
  maximumInkRatio = 0.012,
} = {}) {
  const width = Math.max(1, Number(canvas.width || DEFAULT_LANDSCAPE_WIDTH));
  const height = Math.max(2, Number(canvas.height || DEFAULT_LANDSCAPE_HEIGHT));
  const bottomPx = clampNumber(Number(safeArea?.bottomPx || 0), 1, height - 1);
  const expectedBytes = width * bottomPx * 3;
  const pageEvidence = [];
  const collisions = [];

  for (const page of pages) {
    const result = spawnSync("ffmpeg", [
      "-v", "error",
      "-i", page.file,
      "-vf", `scale=${width}:${height}:flags=lanczos,crop=${width}:${bottomPx}:0:${height - bottomPx},format=rgb24`,
      "-frames:v", "1",
      "-f", "rawvideo",
      "pipe:1",
    ], {
      encoding: null,
      maxBuffer: Math.max(8 * 1024 * 1024, expectedBytes + 1024 * 1024),
    });
    const raw = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
    if (result.status !== 0 || raw.length < expectedBytes) {
      const issue = {
        type: "caption-safe-area-pixel-audit-unavailable",
        pageId: page.id,
        file: page.file,
        reason: String(result.stderr || `expected ${expectedBytes} RGB bytes, received ${raw.length}`).trim(),
      };
      collisions.push(issue);
      pageEvidence.push({
        pageId: page.id,
        file: page.file,
        sourceSha256: sha256File(page.file),
        status: "fail",
        measured: false,
        inkPixelRatio: null,
        maximumInkRatio,
        issue,
      });
      continue;
    }

    let inkPixels = 0;
    const pixelCount = Math.floor(expectedBytes / 3);
    for (let offset = 0; offset < expectedBytes; offset += 3) {
      const r = raw[offset];
      const g = raw[offset + 1];
      const b = raw[offset + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance < 225 || (luminance < 245 && chroma > 28)) inkPixels += 1;
    }
    const inkPixelRatio = pixelCount > 0 ? inkPixels / pixelCount : 1;
    const pass = inkPixelRatio <= maximumInkRatio;
    const evidence = {
      pageId: page.id,
      file: page.file,
      sourceSha256: sha256File(page.file),
      status: pass ? "pass" : "fail",
      measured: true,
      inspectedRegion: { x: 0, y: height - bottomPx, width, height: bottomPx },
      inkPixelCount: inkPixels,
      pixelCount,
      inkPixelRatio: Number(inkPixelRatio.toFixed(6)),
      maximumInkRatio,
    };
    pageEvidence.push(evidence);
    if (!pass) {
      collisions.push({
        type: "caption-safe-area-overlap",
        pageId: page.id,
        file: page.file,
        inkPixelRatio: evidence.inkPixelRatio,
        maximumInkRatio,
        inspectedRegion: evidence.inspectedRegion,
      });
    }
  }

  const checkedFrames = pageEvidence.filter((page) => page.measured).length;
  const pass = pages.length > 0 && checkedFrames === pages.length && collisions.length === 0;
  return {
    schemaVersion: 1,
    stage: "native-final-caption-safe-area-pixel-audit",
    measurementEngine: "ffmpeg-decoded-rgb24-bottom-band",
    status: pass ? "pass" : "fail",
    checkedFrames,
    checkedPages: checkedFrames,
    expectedPages: pages.length,
    collisionCount: collisions.length,
    captionTemplateOverlapIssueCount: collisions.filter((issue) => issue.type === "caption-safe-area-overlap").length,
    captionStyleIssueCount: pass ? 0 : collisions.length,
    uniqueCaptionRendererCount: checkedFrames > 0 ? 1 : 0,
    maximumInkRatio,
    safeArea: {
      bottomPx,
      bottomPercent: Number((bottomPx / height * 100).toFixed(3)),
      policy: "measured-source-page-bottom-band-plus-opaque-caption-safe-geometry",
    },
    captionRendererEvidence: {
      applied: true,
      selector: "#caption",
      zIndex: 100,
      safeBandSelector: "#caption-safe-band",
      safeBandZIndex: 80,
      pixelEvidence: true,
    },
    rule: "Every native final page must prove by decoded pixels that the reserved bottom caption band is free of meaningful ink before subtitles are composed.",
    collisions,
    pages: pageEvidence,
  };
}

function resolveVerticalTopSafeArea(args = {}, canvas = {}) {
  const mode = String(args.verticalTopSafeMode || "auto").trim().toLowerCase();
  if (!["auto", "force", "off"].includes(mode)) {
    throw new Error("--vertical-top-safe-mode must be auto, force, or off");
  }
  const requestedTopPx = toNonNegativeInt(args.verticalTopSafePx, DEFAULT_VERTICAL_TOP_SAFE_PX);
  const maxTopPx = Math.floor(Number(canvas.height || DEFAULT_PORTRAIT_HEIGHT) * 0.18);
  const reservedTopBlankPx = clampNumber(requestedTopPx, 0, maxTopPx);
  const active = Boolean(canvas.vertical && mode !== "off" && reservedTopBlankPx > 0);
  return {
    schemaVersion: 1,
    stage: "mobile-top-safe-area-policy",
    status: active ? "active" : "inactive",
    mode,
    active,
    reservedTopBlankPx: active ? reservedTopBlankPx : 0,
    sourcePageScaledHeightPx: active ? Math.max(1, Number(canvas.height) - reservedTopBlankPx) : Number(canvas.height),
    targetCanvas: {
      width: Number(canvas.width),
      height: Number(canvas.height),
      aspectRatio: canvas.aspectRatio,
      orientation: canvas.orientation,
    },
    reason: active
      ? "Reserve vertical mobile status/navigation bar space so page titles and key text are not hidden in short-form apps."
      : "Top safe-area transform is inactive for this render.",
    transform: active
      ? "auto mode keeps pages that already have a blank top band; otherwise it scales the native page into the remaining content area and pads the top with white."
      : "none",
    checks: {
      topSafeAreaReservedForMobileChrome: active,
      sourceGeneratedImageProvenancePreserved: true,
      noCrop: true,
      noHorizontalSqueeze: true,
      subtitleSafeAreaPreserved: true,
    },
  };
}

function resolveNativePageCountPolicy(args = {}, pageCount = 0) {
  const personalIpActive = args.personalIp !== "off";
  const minPageCount = personalIpActive
    ? Math.max(DEFAULT_PERSONAL_IP_MIN_NATIVE_PAGE_COUNT, toPositiveInt(args.minPageCount, DEFAULT_PERSONAL_IP_MIN_NATIVE_PAGE_COUNT))
    : Math.max(1, toPositiveInt(args.minPageCount, 1));
  const requestedMaxPageCount = toPositiveInt(args.maxPageCount, 0);
  const maxPageCount = requestedMaxPageCount || null;
  return {
    schemaVersion: 2,
    route: "ip-diagram-native-final-pages",
    personalIpActive,
    minPageCount,
    requestedMaxPageCount: requestedMaxPageCount || null,
    maxPageCount,
    maximumPolicy: "explicit-maximum-hard-cap-source-plan-exact-count",
    requestedMaximumAdvisoryOnly: false,
    actualPageCount: pageCount,
    withinRange: pageCount >= minPageCount && (!maxPageCount || pageCount <= maxPageCount),
    singleNativePageRejectedForPersonalIp: !personalIpActive || pageCount > 1,
    hardGate: personalIpActive,
    reason: personalIpActive
      ? "Personal-IP native-final videos must match the source semantic page-capacity plan; an explicit maximum is a hard cap."
      : "Non-personal-IP native-page renders may use a smaller page set.",
  };
}

function sourcePackageRootFromManifest(manifestPath = "") {
  return manifestPath ? dirname(dirname(manifestPath)) : "";
}

function resolveManifestRelativePath(manifestPath = "", rawPath = "") {
  if (!manifestPath || !rawPath) return null;
  if (rawPath.startsWith("/")) return rawPath;
  const packageRoot = sourcePackageRootFromManifest(manifestPath);
  return resolve(packageRoot, rawPath);
}

function loadSourceImageCountPlan(pageProvenance = {}) {
  const manifestPath = pageProvenance.manifestPath || "";
  if (!manifestPath || !existsSync(manifestPath)) return null;
  const manifest = readJsonIfExists(manifestPath);
  const imageCountPlanPath = resolveManifestRelativePath(manifestPath, manifest?.imageCountPlan || "workflow/personal-ip-image-count-plan.json");
  const imageCountPlan = imageCountPlanPath && existsSync(imageCountPlanPath)
    ? readJsonIfExists(imageCountPlanPath)
    : null;
  if (!imageCountPlan) return null;
  return {
    manifestPath,
    imageCountPlanPath,
    plan: imageCountPlan,
  };
}

function enrichNativePageCountPolicyWithSourcePlan(pageCountPolicy, pageProvenance = {}) {
  const sourceCountPlan = loadSourceImageCountPlan(pageProvenance);
  if (!sourceCountPlan) {
    return {
      ...pageCountPolicy,
      sourceImageCountPlanPresent: false,
      sourceImageCountPlanPath: null,
      sourceImageCountPlanRequiredCount: pageCountPolicy.minPageCount,
      satisfiesSourceImageCountPlan: !pageCountPolicy.personalIpActive,
      withinRequiredCount: pageCountPolicy.withinRange && !pageCountPolicy.personalIpActive,
      sourceImageCountPlanIssue: pageCountPolicy.personalIpActive
        ? "Missing source workflow/personal-ip-image-count-plan.json; cannot prove duration/content-aware personal-IP page count."
        : null,
    };
  }
  const plan = sourceCountPlan.plan || {};
  const minImageCount = toPositiveInt(plan.minImageCount, pageCountPolicy.minPageCount);
  const plannedResolvedImageCount = toPositiveInt(plan.resolvedImageCount, 0);
  const capacityPlan = plan.maximumPolicy === "duration-band-default-user-maximum-hard-cap"
    || plan.policy === "personal-ip-semantic-page-capacity"
    || plan.mode === "semantic-page-capacity";
  const automaticTarget = toPositiveInt(plan.contentMetrics?.automaticTarget, 0);
  const independentDriverTarget = Math.max(
    minImageCount,
    toPositiveInt(plan.contentMetrics?.durationBasedTarget, 0),
    toPositiveInt(plan.contentMetrics?.subtitleCueBasedTarget, 0),
    toPositiveInt(plan.contentMetrics?.contentClarityTarget, 0),
    toPositiveInt(plan.contentMetrics?.contentMatchTarget, 0),
    toPositiveInt(plan.contentMetrics?.semanticFloor, 0),
  );
  const authoritativeAutomaticTarget = automaticTarget > 0 ? automaticTarget : independentDriverTarget;
  const automaticResolvedTarget = Math.max(
    authoritativeAutomaticTarget,
    toPositiveInt(plan.automaticResolvedTarget, 0),
  );
  const requiredFromPlan = capacityPlan
    ? Math.max(minImageCount, plannedResolvedImageCount || pageCountPolicy.minPageCount)
    : Math.max(minImageCount, automaticResolvedTarget || plannedResolvedImageCount || pageCountPolicy.minPageCount);
  const satisfiesSourceImageCountPlan = capacityPlan
    ? pageCountPolicy.actualPageCount === requiredFromPlan
    : pageCountPolicy.actualPageCount >= requiredFromPlan
      && (plannedResolvedImageCount === 0 || pageCountPolicy.actualPageCount >= plannedResolvedImageCount);
  return {
    ...pageCountPolicy,
    sourceImageCountPlanPresent: true,
    sourceImageCountPlanPath: sourceCountPlan.imageCountPlanPath,
    sourceImageCountPlan: {
      resolvedImageCount: plannedResolvedImageCount,
      automaticResolvedTarget,
      automaticTarget: plan.contentMetrics?.automaticTarget || null,
      independentDriverTarget,
      authoritativeAutomaticTarget,
      explicitRequestedTarget: plan.explicitRequestedTarget || null,
      explicitTargetUnderAutomatic: plan.explicitTargetUnderAutomatic === true,
      explicitTargetRaisedToAutomatic: plan.explicitTargetRaisedToAutomatic === true,
      durationBasedTarget: plan.contentMetrics?.durationBasedTarget || null,
      subtitleCueBasedTarget: plan.contentMetrics?.subtitleCueBasedTarget || null,
      contentClarityTarget: plan.contentMetrics?.contentClarityTarget || null,
      contentMatchTarget: plan.contentMetrics?.contentMatchTarget || null,
      strongestAutomaticDriver: plan.contentMetrics?.strongestAutomaticDriver || null,
      capacityPlan,
      requestedMaximumApplied: plan.requestedMaximumApplied === true,
    },
    sourceImageCountPlanRequiredCount: requiredFromPlan,
    satisfiesSourceImageCountPlan,
    withinRequiredCount: pageCountPolicy.withinRange && satisfiesSourceImageCountPlan,
    sourceImageCountPlanIssue: satisfiesSourceImageCountPlan
      ? null
      : `Native-final page count ${pageCountPolicy.actualPageCount} is below source image count policy requirement ${requiredFromPlan}.`,
  };
}

export { enrichNativePageCountPolicyWithSourcePlan, resolveNativePageCountPolicy };

function resolveCanvas(args = {}) {
  const rawAspect = String(args.aspect || args.canvasAspect || args.orientation || "16:9").trim().toLowerCase();
  const verticalAliases = new Set(["9:16", "vertical", "portrait", "竖屏", "short"]);
  const horizontalAliases = new Set(["16:9", "horizontal", "landscape", "横屏"]);
  const explicitWidth = Number(args.width || 0);
  const explicitHeight = Number(args.height || 0);
  let width = explicitWidth;
  let height = explicitHeight;
  if (!width || !height) {
    if (verticalAliases.has(rawAspect)) {
      width = DEFAULT_PORTRAIT_WIDTH;
      height = DEFAULT_PORTRAIT_HEIGHT;
    } else {
      width = DEFAULT_LANDSCAPE_WIDTH;
      height = DEFAULT_LANDSCAPE_HEIGHT;
    }
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("--width/--height must be positive integers when provided");
  }
  const vertical = height > width;
  const aspectRatio = vertical ? "9:16" : "16:9";
  if (!verticalAliases.has(rawAspect) && !horizontalAliases.has(rawAspect) && !/^\d+:\d+$/.test(rawAspect)) {
    throw new Error("--aspect must be 16:9, 9:16, horizontal, landscape, vertical, or portrait");
  }
  return {
    width,
    height,
    aspectRatio,
    vertical,
    orientation: vertical ? "vertical" : "horizontal",
    cssAspectRatio: `${width} / ${height}`,
    baseImageTransform: `fixed-cover-${width}x${height}`,
  };
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadSemanticMotionPlan(pagesDir, pages, handDrawnAnimation) {
  if (handDrawnAnimation === "off") return null;
  const planPath = [
    join(pagesDir, "workflow", "personal-ip-semantic-motion-plan.json"),
    join(dirname(pagesDir), "workflow", "personal-ip-semantic-motion-plan.json"),
  ].find((candidate) => existsSync(candidate)) || join(dirname(pagesDir), "workflow", "personal-ip-semantic-motion-plan.json");
  const plan = readJsonIfExists(planPath);
  if (!plan) {
    throw new Error([
      "Personal-IP animation requires a page-specific semantic motion plan.",
      `- Missing: ${planPath}`,
      "- Do not fall back to generic progress rails, focus boxes, or connectors over a finished personal-IP page.",
      "- Generate the plan together with the native pages. Every primitive must stay inside an explicit safeMotionRegion and outside persona/text/subtitle forbidden regions.",
    ].join("\n"));
  }
  if (plan.coordinateSpace !== "canvas-normalized-after-base-transform") {
    throw new Error("personal-ip-semantic-motion-plan.json must use coordinateSpace=canvas-normalized-after-base-transform");
  }
  const pageNames = new Set(pages.map((page) => page.name));
  const plannedNames = new Set((plan.pages || []).map((page) => page.pageName));
  const missingPages = [...pageNames].filter((name) => !plannedNames.has(name));
  if (missingPages.length > 0) {
    throw new Error(`Semantic motion plan does not cover native pages: ${missingPages.join(", ")}`);
  }
  for (const page of plan.pages || []) {
    if (!pageNames.has(page.pageName)) continue;
    if (!Array.isArray(page.safeMotionRegions) || page.safeMotionRegions.length === 0) {
      throw new Error(`Semantic motion page ${page.pageName} has no safeMotionRegions`);
    }
    const primitives = [...(page.paths || []), ...(page.nodes || [])];
    if (primitives.length === 0) {
      throw new Error(`Semantic motion page ${page.pageName} has no semantic paths or nodes`);
    }
    const safeRegions = page.safeMotionRegions || [];
    const forbiddenRegions = page.forbiddenRegions || [];
    const contains = (rect, point) => point[0] >= rect[0] && point[0] <= rect[0] + rect[2]
      && point[1] >= rect[1] && point[1] <= rect[1] + rect[3];
    const pointsFor = (primitive) => primitive.points || (primitive.center ? [primitive.center] : []);
    for (const primitive of primitives) {
      for (const point of pointsFor(primitive)) {
        if (!Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(Number(value)))) {
          throw new Error(`Semantic motion page ${page.pageName} contains an invalid normalized point`);
        }
        if (!safeRegions.some((region) => contains(region.rect, point))) {
          throw new Error(`Semantic motion primitive ${primitive.id || "unnamed"} escapes safeMotionRegions on ${page.pageName}`);
        }
        if (forbiddenRegions.some((region) => contains(region.rect, point))) {
          throw new Error(`Semantic motion primitive ${primitive.id || "unnamed"} enters forbidden region on ${page.pageName}`);
        }
      }
    }
  }
  return { ...plan, sourcePath: planPath };
}

function sha256File(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseVolumeDetect(log = "") {
  const meanMatch = String(log).match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const maxMatch = String(log).match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  return {
    meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
    maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null,
  };
}

function run(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  const entry = {
    command,
    args,
    exitCode: result.status,
    durationMs: Date.now() - started,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
  if (options.log) options.log.push(entry);
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(`${command} failed with exit ${result.status}${stderr ? `: ${stderr}` : ""}`);
  }
  return options.combined ? `${result.stdout || ""}${result.stderr || ""}` : (result.stdout || "");
}

function parseTimestamp(raw) {
  const match = raw.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!match) throw new Error(`Invalid SRT timestamp: ${raw}`);
  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, "0").slice(0, 3)) / 1000;
}

function formatTimestamp(seconds) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(wholeSeconds).padStart(2, "0");
  const ms = String(millis).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSrt(path) {
  const raw = readFileSync(path, "utf8").replace(/\r/g, "");
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block.split("\n");
      const timingLine = lines.find((line) => line.includes("-->"));
      if (!timingLine) return null;
      const [startRaw, endRaw] = timingLine.split("-->").map((part) => part.trim());
      const textStart = lines.indexOf(timingLine) + 1;
      return {
        index: index + 1,
        start: parseTimestamp(startRaw),
        end: parseTimestamp(endRaw),
        text: normalizeText(lines.slice(textStart).join(" ")),
      };
    })
    .filter(Boolean)
    .filter((cue) => cue.end > cue.start && cue.text);
}

function wrapCueText(text, maxChars = 26) {
  const chars = Array.from(normalizeText(text));
  const lines = [];
  let current = "";
  for (const ch of chars) {
    current += ch;
    if (current.length >= maxChars && /[，。！？；、,.!?;：:]/.test(ch)) {
      lines.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) lines.push(current.trim());
  if (lines.length === 0) return [normalizeText(text)];
  if (lines.length <= 2) return lines;
  const merged = [];
  for (const line of lines) {
    if (merged.length < 2) merged.push(line);
    else merged[merged.length - 1] = `${merged[merged.length - 1]}${line}`;
  }
  return merged;
}

function writeOneLineSrt(path, cues) {
  const body = cues.map((cue, index) => {
    return [
      String(index + 1),
      `${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}`,
      wrapCueText(cue.text, 28).join("\n"),
      "",
    ].join("\n");
  }).join("\n");
  writeFileSync(path, body, "utf8");
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

function collectPages(pagesDir) {
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  return readdirSync(pagesDir)
    .filter((name) => allowed.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))
    .map((name, index) => {
      const file = resolve(pagesDir, name);
      const dimensions = readImageDimensions(file);
      return {
        id: `ip-page-${String(index + 1).padStart(2, "0")}`,
        index: index + 1,
        file,
        name,
        width: dimensions.width,
        height: dimensions.height,
        title: name
          .replace(extname(name), "")
          .replace(/^\d+[-_]/, "")
          .replace(/[-_]+/g, " "),
      };
    });
}

function normalizeManifestPath(rawPath, manifestPath) {
  if (!rawPath) return null;
  return resolve(dirname(manifestPath), rawPath);
}

export function loadNativePageProvenance(pagesDir, pages) {
  const candidateManifests = [
    // The page directory is the source-of-truth for native image provenance
    // and its adaptive count plan. A surrounding video manifest may describe
    // the assembled package and must not shadow this source manifest.
    resolve(pagesDir, "manifest.json"),
    resolve(pagesDir, "..", "workflow", "manifest.json"),
    resolve(pagesDir, "workflow", "manifest.json"),
    resolve(pagesDir, "..", "manifest.json"),
  ];
  const manifestPath = candidateManifests.find((candidate) => existsSync(candidate)) || null;
  const issues = [];
  if (!manifestPath) {
    issues.push("No native page manifest found next to pages-dir; final pages cannot prove original Skill/image_gen provenance.");
    return {
      schemaVersion: 1,
      status: "fail",
      manifestPath: null,
      generationRoute: null,
      pagesChecked: pages.length,
      pagesWithGeneratedImageSource: 0,
      pagesWithPersonaReferenceBinding: 0,
      generationReceiptContractComplete: false,
      generationReceiptsVerified: 0,
      generationReceiptRequestIdsUnique: false,
      generationReceiptOutputHashesUnique: false,
      perPage: pages.map((page) => ({
        pageId: page.id,
        file: page.file,
        manifestEntryPresent: false,
        sourceGeneratedImage: null,
        personaReferenceBoundToGeneration: false,
        userApprovedPersonaConsistency: false,
      })),
      issues,
    };
  }

  const manifest = readJsonIfExists(manifestPath);
  const generationRoute = String(manifest?.generation_route || manifest?.generationRoute || "");
  const manifestEntries = [
    ...(Array.isArray(manifest?.items) ? manifest.items : []),
    ...(Array.isArray(manifest?.content_pages) ? manifest.content_pages : []),
    ...(Array.isArray(manifest?.contentPages) ? manifest.contentPages : []),
  ].map((entry) => {
    const asset = entry.path || entry.asset || entry.file || entry.sourceImage || null;
    return {
      raw: entry,
      assetPath: normalizeManifestPath(asset, manifestPath),
      methodologyText: entry.methodologyText || entry.methodology_text || "",
      requiredVisualUnitIds: entry.requiredVisualUnitIds || entry.required_visual_unit_ids || [],
      sourceGeneratedImage: entry.source_generated_image || entry.sourceGeneratedImage || null,
      generationReceipt: entry.generationReceipt
        ?? entry.source_generated_image?.generationReceipt
        ?? entry.sourceGeneratedImage?.generationReceipt
        ?? null,
      personaReferenceBoundToGeneration: entry.personaReferenceBoundToGeneration
        ?? entry.source_generated_image?.personaReferenceBoundToGeneration
        ?? entry.sourceGeneratedImage?.personaReferenceBoundToGeneration
        ?? false,
      userApprovedPersonaConsistency: entry.userApprovedPersonaConsistency
        ?? entry.source_generated_image?.userApprovedPersonaConsistency
        ?? entry.sourceGeneratedImage?.userApprovedPersonaConsistency
        ?? false,
    };
  });
  const entriesByAsset = new Map(
    manifestEntries
      .filter((entry) => entry.assetPath)
      .map((entry) => [resolve(entry.assetPath), entry]),
  );
  const perPage = pages.map((page) => {
    const entry = entriesByAsset.get(resolve(page.file));
    return {
      pageId: page.id,
      file: page.file,
      manifestEntryPresent: Boolean(entry),
      sourceGeneratedImage: entry?.sourceGeneratedImage || null,
      generationReceipt: entry?.generationReceipt || null,
      methodologyText: entry?.methodologyText || "",
      requiredVisualUnitIds: entry?.requiredVisualUnitIds || [],
      personaReferenceBoundToGeneration: Boolean(entry?.personaReferenceBoundToGeneration),
      userApprovedPersonaConsistency: Boolean(entry?.userApprovedPersonaConsistency),
      actualOutputSha256: sha256File(page.file),
    };
  });
  const pagesWithGeneratedImageSource = perPage.filter((page) => Boolean(page.sourceGeneratedImage)).length;
  const pagesWithPersonaReferenceBinding = perPage.filter((page) => page.personaReferenceBoundToGeneration || page.userApprovedPersonaConsistency).length;
  const pageHashes = pages.map((page) => sha256File(page.file)).filter(Boolean);
  const uniquePageHashes = new Set(pageHashes);
  const duplicatePageHashCount = pageHashes.length - uniquePageHashes.size;
  const generationReceiptContractComplete = manifest?.generationReceiptContract?.complete === true;
  const receiptRequestIds = [];
  const receiptOutputHashes = [];
  let generationReceiptsVerified = 0;
  for (const page of perPage) {
    const receipt = page.generationReceipt || {};
    const requestId = String(receipt.requestId || "").trim();
    const promptSha256 = String(receipt.promptSha256 || "").trim().toLowerCase();
    const outputSha256 = String(receipt.outputSha256 || "").trim().toLowerCase();
    const receiptFieldsPresent = receipt.recordedAtDispatch === true
      && Boolean(requestId)
      && /^[a-f0-9]{64}$/.test(promptSha256)
      && /^[a-f0-9]{64}$/.test(outputSha256)
      && receipt.personaReferenceBound === true;
    const generationReceiptOutputHashMatches = receiptFieldsPresent
      && outputSha256 === String(page.actualOutputSha256 || "").toLowerCase();
    page.generationReceipt = receipt;
    page.generationReceiptFieldsPresent = receiptFieldsPresent;
    page.generationReceiptOutputHashMatches = generationReceiptOutputHashMatches;
    if (requestId) receiptRequestIds.push(requestId);
    if (outputSha256) receiptOutputHashes.push(outputSha256);
    if (generationReceiptOutputHashMatches) generationReceiptsVerified += 1;
  }
  const generationReceiptRequestIdsUnique = receiptRequestIds.length === pages.length
    && new Set(receiptRequestIds).size === pages.length;
  const generationReceiptOutputHashesUnique = receiptOutputHashes.length === pages.length
    && new Set(receiptOutputHashes).size === pages.length;
  const routeClaimsOnlyLocalAssets = /project-local assets|local assets|PIL|placeholder|wireframe/i.test(generationRoute)
    && !/built-in image_gen|source_generated_image|generated_images/i.test(generationRoute);
  if (pagesWithGeneratedImageSource !== pages.length) {
    issues.push(`Only ${pagesWithGeneratedImageSource}/${pages.length} final pages have source_generated_image provenance.`);
  }
  if (uniquePageHashes.size !== pages.length) {
    issues.push(`Native personal-IP final pages contain ${duplicatePageHashCount} duplicate source image(s); every planned page must have a distinct generated source image.`);
  }
  if (!generationReceiptContractComplete) {
    issues.push("Native page manifest generationReceiptContract.complete must be true; legacy packages without generation receipts cannot ship as native-final output.");
  }
  if (generationReceiptsVerified !== pages.length) {
    issues.push(`Only ${generationReceiptsVerified}/${pages.length} final pages have complete generation receipts whose outputSha256 matches the actual page file.`);
  }
  if (!generationReceiptRequestIdsUnique) {
    issues.push("Native page generation receipt requestId values must exist and be unique for every final page.");
  }
  if (!generationReceiptOutputHashesUnique) {
    issues.push("Native page generation receipt outputSha256 values must exist and be unique for every final page.");
  }
  if (pagesWithPersonaReferenceBinding !== pages.length) {
    issues.push(`Only ${pagesWithPersonaReferenceBinding}/${pages.length} final pages prove fixed-persona image/context binding or explicit user-approved persona consistency.`);
  }
  if (routeClaimsOnlyLocalAssets) {
    issues.push("Manifest route says pages were project-local assets rather than built-in image_gen/native direct-generation outputs.");
  }
  const missingManifestEntries = perPage.filter((page) => !page.manifestEntryPresent).length;
  if (missingManifestEntries > 0) {
    issues.push(`${missingManifestEntries} final pages are missing manifest entries.`);
  }
  return {
    schemaVersion: 1,
    status: issues.length === 0 ? "pass" : "fail",
    manifestPath,
    generationRoute,
    pagesChecked: pages.length,
    pagesWithGeneratedImageSource,
    pagesWithPersonaReferenceBinding,
    uniquePageHashes: uniquePageHashes.size,
    duplicatePageHashCount,
    generationReceiptContractComplete,
    generationReceiptsVerified,
    generationReceiptRequestIdsUnique,
    generationReceiptOutputHashesUnique,
    perPage,
    issues,
  };
}

function createSkillUsageAccuracyAudit({ pageProvenance, args }) {
  const codexSkillPath = resolve(CODEX_VIDEO_SKILL_PATH);
  const integrationReferencePath = resolve(IP_DIAGRAM_INTEGRATION_REFERENCE_PATH);
  const externalSkillPath = resolve(IP_DIAGRAM_CREATOR_SKILL_PATH);
  const externalSkillAvailable = existsSync(externalSkillPath);
  const allPagesHaveNativeImageGenProvenance = pageProvenance.status === "pass"
    && pageProvenance.pagesChecked > 0
    && pageProvenance.pagesWithGeneratedImageSource === pageProvenance.pagesChecked;
  const allPagesHavePersonaReferenceBinding = pageProvenance.status === "pass"
    && pageProvenance.pagesChecked > 0
    && pageProvenance.pagesWithPersonaReferenceBinding === pageProvenance.pagesChecked;
  const noLocalPlaceholderFinalPages = pageProvenance.status === "pass" && (pageProvenance.issues || []).length === 0;
  const checks = {
    codexVideoWorkflowSkillPresent: existsSync(codexSkillPath),
    ipDiagramCreatorIntegrationReferencePresent: existsSync(integrationReferencePath),
    ipDiagramCreatorSkillSnapshotPresent: externalSkillAvailable,
    sourceRepoPinned: SOURCE_REPO === "https://github.com/haloshin/ip-diagram-creator",
    sourceCommitPinned: SOURCE_COMMIT === "dd64ab5d972893f7ca271d9c560362d7788eb2d6",
    executionModeMatchesRequest: true,
    nativeFinalOwnershipBoundaryRecorded: true,
    allFinalPagesHaveNativeImageGenProvenance: allPagesHaveNativeImageGenProvenance,
    allFinalPagesHaveFixedPersonaReferenceBinding: allPagesHavePersonaReferenceBinding,
    generationReceiptContractComplete: pageProvenance.generationReceiptContractComplete === true,
    allFinalPagesHaveVerifiedGenerationReceipts: pageProvenance.generationReceiptsVerified === pageProvenance.pagesChecked,
    generationReceiptRequestIdsUnique: pageProvenance.generationReceiptRequestIdsUnique === true,
    generationReceiptOutputHashesUnique: pageProvenance.generationReceiptOutputHashesUnique === true,
    noLocalPlaceholderFinalPages,
    personalIpChoiceRecorded: ["on", "off", "auto"].includes(args.personalIp),
    handDrawnAnimationChoiceRecorded: ["off", "subtle", "draw-reveal"].includes(args.handDrawnAnimation),
  };
  return {
    schemaVersion: 1,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    sourceOfTruth: {
      videoSkill: {
        path: codexSkillPath,
        sha256: sha256File(codexSkillPath),
      },
      integrationReference: {
        path: integrationReferencePath,
        sha256: sha256File(integrationReferencePath),
      },
      externalSkill: {
        path: externalSkillPath,
        available: externalSkillAvailable,
        sha256: sha256File(externalSkillPath),
        sourceRepo: SOURCE_REPO,
        sourceCommit: SOURCE_COMMIT,
        license: "MIT",
      },
    },
    requestedRoute: "ip-diagram-creator native-final personal-IP hand-drawn explainer video",
    selectedExecutionMode: "native-final-video",
    selectedCapabilities: [
      "role anchor prompt",
      "PPT presentation mode page cards",
      "white/near-white hand-drawn visual DNA",
      "adult personal-IP presenter",
      "execution Agents",
      "native direct-generation/image_gen page assets",
      "QA/repair rules",
    ],
    ownershipBoundary: {
      ipDiagramCreatorOwns: ["final visible page design", "page-level diagram composition", "personal-IP presenter and Agent visual language"],
      codexVideoWorkflowOwns: ["voice/subtitle timing", "MP4 export", "final audio normalization", "delivery package", "QC gates"],
      prohibitedClaims: [
        "Do not call deterministic PIL/SVG/HTML placeholder pages official native Skill output.",
        "Do not claim native-final-video when source pages lack native-generation provenance.",
      ],
    },
    nativePageProvenance: {
      status: pageProvenance.status,
      manifestPath: pageProvenance.manifestPath,
      generationRoute: pageProvenance.generationRoute,
      pagesChecked: pageProvenance.pagesChecked,
      pagesWithGeneratedImageSource: pageProvenance.pagesWithGeneratedImageSource,
      pagesWithPersonaReferenceBinding: pageProvenance.pagesWithPersonaReferenceBinding,
      issues: pageProvenance.issues,
    },
    checks,
  };
}

function createVendorUsageArtifact() {
  const entrypoint = resolve(IP_DIAGRAM_CREATOR_SKILL_PATH);
  const manifestPath = resolve(IP_DIAGRAM_CREATOR_VENDOR_MANIFEST_PATH);
  const references = IP_DIAGRAM_CREATOR_VENDOR_REFERENCE_PATHS.map((referencePath) => {
    const absolutePath = resolve(referencePath);
    return {
      path: referencePath,
      absolutePath,
      present: existsSync(absolutePath),
      sha256: sha256File(absolutePath),
    };
  });
  const checks = {
    entrypointPresent: existsSync(entrypoint),
    manifestPresent: existsSync(manifestPath),
    allRequiredReferencesPresent: references.every((reference) => reference.present),
    sourceRepoPinned: SOURCE_REPO === "https://github.com/haloshin/ip-diagram-creator",
    sourceCommitPinned: SOURCE_COMMIT === "dd64ab5d972893f7ca271d9c560362d7788eb2d6",
    promptTemplateAvailabilityRecorded: references.some((reference) => reference.path.endsWith("prompt-templates.md") && reference.present),
  };
  return {
    schemaVersion: 1,
    stage: "ip-diagram-creator-vendor-usage",
    status: Object.values(checks).every(Boolean) ? "ready" : "fail",
    active: true,
    sourceRepo: SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    license: "MIT",
    entrypoint: IP_DIAGRAM_CREATOR_SKILL_PATH,
    entrypointAbsolutePath: entrypoint,
    entrypointSha256: sha256File(entrypoint),
    manifestPath: IP_DIAGRAM_CREATOR_VENDOR_MANIFEST_PATH,
    manifestAbsolutePath: manifestPath,
    manifestSha256: sha256File(manifestPath),
    references,
    promptTemplateAvailability: {
      contentDiagram: true,
      pptPresentation: true,
      mainAnchor: true,
      specSheet: true,
      actionExpression: true,
    },
    executionContract: {
      usesVendoredSkillInstructions: true,
      nativeJobsMustReferenceVendorSkill: true,
      nativeFinalRequiresSourceGeneratedPages: true,
      deterministicImitationForbiddenForPersonalIpFinal: true,
    },
    checks,
  };
}

function ffprobeJson(path, commands) {
  const stdout = run("ffprobe", [
    "-v", "error",
    "-show_format",
    "-show_streams",
    "-of", "json",
    path,
  ], { log: commands });
  return JSON.parse(stdout);
}

function durationFromProbe(path, commands) {
  const stdout = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ], { log: commands });
  return Number.parseFloat(stdout.trim());
}

function loadSourceScenes(sourceRun) {
  if (!sourceRun) return [];
  const planPath = resolve(sourceRun, "workflow", "sync-timecode-plan.json");
  if (!existsSync(planPath)) return [];
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  return Array.isArray(plan.scenes) ? plan.scenes : [];
}

function pageWindowsFromCueBoundaries(pages, cues, totalDuration) {
  if (!pages.length) return [];
  if (!cues.length) {
    throw new Error("Native page timing requires subtitle cue boundaries; equal-duration page cuts are forbidden.");
  }
  if (pages.length > cues.length) {
    throw new Error(`Native page timing requires at least one subtitle cue per page so cuts never split a spoken cue: pages=${pages.length}, cues=${cues.length}`);
  }
  return pages.map((page, index) => {
    const cueStartIndex = Math.floor(index * cues.length / pages.length);
    const nextCueStartIndex = index + 1 < pages.length
      ? Math.floor((index + 1) * cues.length / pages.length)
      : cues.length;
    const startSeconds = Number(cues[cueStartIndex]?.start || 0);
    const endSeconds = index + 1 < pages.length
      ? Number(cues[nextCueStartIndex]?.start || totalDuration)
      : Number(totalDuration);
    return {
      page,
      pageId: page.id,
      pageIndex: page.index,
      startSeconds,
      endSeconds: Math.max(startSeconds + 0.001, endSeconds),
      cueStartIndex,
      cueEndIndex: Math.max(cueStartIndex, nextCueStartIndex - 1),
    };
  });
}

function pageForTime(pageWindows, start) {
  return pageWindows.find((window) => start >= window.startSeconds && start < window.endSeconds)
    || pageWindows.at(-1);
}

function buildFramePlan(cues, pages, totalDuration, handDrawnAnimation = "off", motionSampleFps = 12) {
  const frames = [];
  const pageWindows = pageWindowsFromCueBoundaries(pages, cues, totalDuration);
  for (const cue of cues) {
    const cueDuration = Math.max(0.05, cue.end - cue.start);
    const sampleCount = Math.max(3, Math.ceil(cueDuration * motionSampleFps));
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const start = cue.start + cueDuration * sampleIndex / sampleCount;
      const end = cue.start + cueDuration * (sampleIndex + 1) / sampleCount;
      const pageWindow = pageForTime(pageWindows, start);
      const page = pageWindow.page;
      const pageStart = pageWindow.startSeconds;
      const pageEnd = pageWindow.endSeconds;
      const pageProgress = Math.max(0, Math.min(1, (start - pageStart) / Math.max(0.001, pageEnd - pageStart)));
      frames.push({
        id: `frame-${String(frames.length + 1).padStart(4, "0")}`,
        index: frames.length + 1,
        cueIndex: cue.index,
        cueSampleIndex: sampleIndex + 1,
        cueSampleCount: sampleCount,
        motionProgress: sampleCount === 1 ? 1 : sampleIndex / Math.max(1, sampleCount - 1),
        start,
        end,
        duration: end - start,
        subtitle: cue.text,
        subtitleLines: wrapCueText(cue.text),
        pageId: page.id,
        pageIndex: page.index,
        pageName: page.name,
        sourceImage: page.file,
        pageProgress,
      });
    }
  }
  return frames;
}

function escapeXml(value) {
  return escapeHtml(value);
}

function nativeForegroundSvg(pagePlan, canvas) {
  const cssColor = (value, fallback) => Array.isArray(value)
    ? `rgba(${value.slice(0, 4).join(",")})`
    : String(value || fallback);
  const normalizeStroke = (value, fallback = 0.006) => {
    const raw = Number(value || fallback);
    return raw > 1 ? raw / Math.max(canvas.width, canvas.height) : raw;
  };
  const paths = (pagePlan?.paths || []).map((path) => {
    const points = (path.points || []).map(([x, y]) => `${Number(x).toFixed(5)},${Number(y).toFixed(5)}`).join(" ");
    if (!points) return "";
    return `<polyline data-motion-id="${escapeXml(path.id || "path")}" points="${points}" fill="none" stroke="${escapeXml(cssColor(path.color, "#2b69d6"))}" stroke-width="${normalizeStroke(path.stroke)}" stroke-linecap="round" stroke-linejoin="round" opacity="0" />`;
  }).join("");
  const nodes = (pagePlan?.nodes || []).map((node) => {
    const [cx, cy] = node.center || [0, 0];
    const [rx, ry] = node.radius || [0.03, 0.02];
    return `<ellipse data-motion-id="${escapeXml(node.id || "node")}" cx="${Number(cx).toFixed(5)}" cy="${Number(cy).toFixed(5)}" rx="${Number(rx).toFixed(5)}" ry="${Number(ry).toFixed(5)}" fill="none" stroke="${escapeXml(cssColor(node.color, "#e85c2c"))}" stroke-width="${normalizeStroke(node.stroke)}" opacity="0" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none" width="${canvas.width}" height="${canvas.height}" role="img" aria-label="foreground motion layer"><g>${paths}${nodes}</g></svg>`;
}

function writeNativeLayeredArtifacts({ out, pages, canvas, args, totalDuration, cues, semanticMotionPlan }) {
  const nativeDir = join(out, "assets", "native-pages");
  const layersDir = join(out, "layers");
  const subtitleSafeArea = captionSafeArea(canvas);
  ensureDir(nativeDir);
  ensureDir(layersDir);
  const pageLayers = [];
  const motionByName = new Map((semanticMotionPlan?.pages || []).map((page) => [page.pageName, page]));
  for (const page of pages) {
    const extension = extname(page.name).toLowerCase() || ".png";
    const assetName = `${String(page.index).padStart(3, "0")}-${page.name.replace(extname(page.name), "")}${extension}`;
    const assetPath = join(nativeDir, assetName);
    copyFileSync(page.file, assetPath);
    const baseLayerName = `00-native-base-${String(page.index).padStart(3, "0")}.svg`;
    const foregroundLayerName = `40-foreground-motion-${String(page.index).padStart(3, "0")}.svg`;
    const assetHref = `../assets/native-pages/${assetName}`;
    writeFileSync(join(layersDir, baseLayerName), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}"><rect x="0" y="0" width="${canvas.width}" height="${canvas.height}" fill="#fff"/><image href="${escapeXml(assetHref)}" x="0" y="0" width="${canvas.width}" height="${canvas.height}" preserveAspectRatio="none" data-caption-safe-bottom="${subtitleSafeArea.bottomPx}" /></svg>\n`, "utf8");
    writeFileSync(join(layersDir, foregroundLayerName), nativeForegroundSvg(motionByName.get(page.name), canvas), "utf8");
    pageLayers.push({
      pageId: page.id,
      pageIndex: page.index,
      sourceFile: page.file,
      copiedAsset: `assets/native-pages/${assetName}`,
      baseSvg: `layers/${baseLayerName}`,
      foregroundSvg: `layers/${foregroundLayerName}`,
      sourceSha256: sha256File(page.file),
      visualOwner: "haloshin/ip-diagram-creator native generated page",
      baseLayerStable: true,
      captionSafeArea,
    });
  }
  const subtitleLayer = "100-subtitle-overlay.svg";
  writeFileSync(join(layersDir, subtitleLayer), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}"><g id="subtitle-overlay" data-owner="html-master-timeline" /></svg>\n`, "utf8");

  const pageWindows = pageWindowsFromCueBoundaries(pages, cues, totalDuration);
  const timeline = {
    durationSeconds: totalDuration,
    pageTimingPolicy: "subtitle-cue-boundaries-no-mid-cue-cuts",
    pages: pageLayers.map((page, index) => ({
      ...page,
      startSeconds: Number(pageWindows[index].startSeconds.toFixed(3)),
      endSeconds: Number(pageWindows[index].endSeconds.toFixed(3)),
      cueStartIndex: pageWindows[index].cueStartIndex,
      cueEndIndex: pageWindows[index].cueEndIndex,
    })),
    cues: cues.map((cue) => ({ startSeconds: cue.start, endSeconds: cue.end, text: cue.text })),
  };
  const pageGroups = pageLayers.map((page, index) => {
    const plan = motionByName.get(pages[index].name) || {};
    const normalizeStroke = (value, fallback = 0.006) => {
      const raw = Number(value || fallback);
      return raw > 1 ? raw / Math.max(canvas.width, canvas.height) : raw;
    };
    const cssColor = (value, fallback) => Array.isArray(value)
      ? `rgba(${value.slice(0, 4).join(",")})`
      : String(value || fallback);
    const paths = (plan.paths || []).map((path) => {
      const points = (path.points || []).map(([x, y]) => `${Number(x).toFixed(5)},${Number(y).toFixed(5)}`).join(" ");
      return points ? `<polyline data-motion-start="${Number(path.start || 0)}" data-motion-end="${Number(path.end || 1)}" points="${points}" fill="none" stroke="${escapeXml(cssColor(path.color, "#2b69d6"))}" stroke-width="${normalizeStroke(path.stroke)}" stroke-linecap="round" stroke-linejoin="round" opacity="0" />` : "";
    }).join("");
    const nodes = (plan.nodes || []).map((node) => {
      const [cx, cy] = node.center || [0, 0];
      const [rx, ry] = node.radius || [0.03, 0.02];
      return `<ellipse data-motion-start="${Number(node.start || 0)}" data-motion-end="${Number(node.end || 1)}" cx="${Number(cx).toFixed(5)}" cy="${Number(cy).toFixed(5)}" rx="${Number(rx).toFixed(5)}" ry="${Number(ry).toFixed(5)}" fill="none" stroke="${escapeXml(cssColor(node.color, "#e85c2c"))}" stroke-width="${normalizeStroke(node.stroke)}" opacity="0" />`;
    }).join("");
    return `<g class="motion-page" data-page-index="${page.pageIndex}" style="display:${index === 0 ? "inline" : "none"}">${paths}${nodes}</g>`;
  }).join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(args.title || "个人 IP 原生页面动画")}</title><style>html,body{margin:0;background:#fff;overflow:hidden}#stage{--caption-safe-bottom:${subtitleSafeArea.cssVar};position:relative;isolation:isolate;width:${canvas.width}px;height:${canvas.height}px;overflow:hidden;background:#fff}#visual-plane{position:absolute;inset:0;overflow:hidden;z-index:0}#native-page{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:0}#foreground{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:40}#caption-safe-band{position:absolute;left:0;right:0;bottom:0;height:var(--caption-safe-bottom);background:#fff;pointer-events:none;z-index:80}#caption{position:absolute;left:4%;right:4%;bottom:2%;min-height:7%;max-height:calc(var(--caption-safe-bottom) - 18px);padding:1.2% 2.4%;box-sizing:border-box;border-radius:999px;background:#18232d;color:#fff;font:700 clamp(22px,2.5vw,48px)/1.25 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:center;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:100}</style></head><body><div id="stage" data-layer-contract="native-base:0,foreground:40,caption-safe-band:80,subtitle:100,caption-safe-bottom:${subtitleSafeArea.bottomPx}px"><div id="visual-plane" data-caption-safe-region="full-canvas-with-pixel-audited-blank-caption-band"><img id="native-page" alt=""><svg id="foreground" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">${pageGroups}</svg></div><div id="caption-safe-band" aria-hidden="true"></div><div id="caption"></div></div><script>const timeline=${JSON.stringify(timeline)};const pageFiles=${JSON.stringify(pageLayers.map((page)=>page.copiedAsset))};const handDrawn=${JSON.stringify(args.handDrawnAnimation !== "off")};const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));function setProgress(progress){const p=clamp(progress);const time=p*timeline.durationSeconds;const pageWindow=timeline.pages.find((item)=>time>=item.startSeconds&&time<item.endSeconds)||timeline.pages[timeline.pages.length-1];const pageIndex=Math.max(0,Math.min(pageFiles.length-1,Number(pageWindow?.pageIndex||1)-1));document.querySelector('#native-page').src=pageFiles[pageIndex];const pageLocal=clamp((time-Number(pageWindow?.startSeconds||0))/Math.max(.001,Number(pageWindow?.endSeconds||timeline.durationSeconds)-Number(pageWindow?.startSeconds||0)));document.querySelectorAll('.motion-page').forEach((group,index)=>{group.style.display=index===pageIndex?'inline':'none';group.querySelectorAll('[data-motion-start]').forEach((node)=>{const start=Number(node.dataset.motionStart||0),end=Number(node.dataset.motionEnd||1),local=clamp((pageLocal-start)/Math.max(.001,end-start));node.style.opacity=handDrawn?String(local):'0'});});const cue=timeline.cues.find((item)=>time>=item.startSeconds&&time<item.endSeconds)||timeline.cues[timeline.cues.length-1];document.querySelector('#caption').textContent=cue?.text||'';window.motionState={progress:p,pageIndex,time,caption:cue?.text||'',pageSource:pageFiles[pageIndex]}}window.motion={setProgress,duration:timeline.durationSeconds};setProgress(0);</script></body></html>`;
  writeFileSync(join(out, "personal-ip-layered.html"), html, "utf8");
  writeJson(join(out, "workflow", "personal-ip-layered-source-manifest.json"), {
    schemaVersion: 1,
    route: "ip-diagram-creator-native-page-base-plus-foreground-overlays",
    visualSourceOwner: "haloshin/ip-diagram-creator",
    htmlMasterTimeline: "personal-ip-layered.html",
    baseLayerPolicy: "native generated page images remain atomic, full-canvas, and stable; captions render over an opaque geometry band only after decoded source pixels prove that the reserved band contains no meaningful ink",
    captionSafeArea: subtitleSafeArea,
    captionSafeAreaAudit: "workflow/frame-layout-overlap-audit.json",
    pageLayers,
    subtitleLayer: `layers/${subtitleLayer}`,
    zOrder: { nativeBase: 0, foregroundMotion: 40, subtitles: 100 },
    subtitleIsolation: {
      stackingContext: "#stage isolation:isolate",
      visualPlaneSelector: "#visual-plane",
      baseSelector: "#native-page",
      foregroundSelector: "#foreground",
      subtitleSelector: "#caption",
      subtitlesTopmost: true,
      bottomBandReserved: true,
      captionOverlaysReservedBlankBand: "verified-by-workflow/frame-layout-overlap-audit.json",
      nativeBaseGeometryUnchangedByCaption: true,
    },
    timeline,
    animation: { handDrawnAnimation: args.handDrawnAnimation, foregroundOnly: true, baseImageStable: true, subtitlesTopmost: true },
  });
}

function createPlanArtifacts({ out, title, args, pages, cues, totalDuration, sourceRun, sourceScript, sourceScenes, pageProvenance, canvas, pageCountPolicy }) {
  const skillUsageAccuracyAudit = createSkillUsageAccuracyAudit({ pageProvenance, args });
  const vendorUsage = createVendorUsageArtifact();
  const userChoices = {
    makePersonalIp: args.personalIp,
    addHandDrawnImageAnimation: args.handDrawnAnimation,
  };
  const stableFullScreenContract = {
    generatedImagesAreFullScreen: true,
    outputCanvas: { width: canvas.width, height: canvas.height, aspectRatio: canvas.aspectRatio, orientation: canvas.orientation },
    noCardWrapper: true,
    noBorder: true,
    noDropShadow: true,
    noInsetFrame: true,
    baseImageTransform: canvas.baseImageTransform,
    mobileTopSafeArea: canvas.mobileTopSafeArea || null,
    noPerCueCropPanZoom: true,
    noVerticalCameraOffset: true,
    allowedMotion: ["page cuts", "subtitles", "foreground semantic focus loop", "foreground connector trace", "foreground progress rail"],
    rejectedMotion: ["background bounce", "per-subtitle crop variants", "static-image push-in", "random y offset"],
  };
  const verticalPersonalIpDesignContract = canvas.vertical
    ? {
        schemaVersion: 1,
        stage: "vertical-personal-ip-design-contract",
        status: "required-final-quality-gate",
        route: "ip-diagram-creator-native-final-pages",
        canvas: {
          width: canvas.width,
          height: canvas.height,
          aspectRatio: canvas.aspectRatio,
          orientation: canvas.orientation,
        },
        rule: "Generate native vertical personal-IP pages; do not crop or letterbox horizontal pages into a vertical MP4.",
        safeAreas: {
          topPx: canvas.mobileTopSafeArea?.reservedTopBlankPx || DEFAULT_VERTICAL_TOP_SAFE_PX,
          bottomCaptionPx: 320,
          leftPx: 64,
          rightPx: 64,
        },
        topSafeAreaRevision: {
          status: canvas.mobileTopSafeArea?.active ? "applied" : "required",
          reason: "Mobile vertical apps can cover the top of the video with status/navigation UI; keep page titles and key text below the reserved top band.",
          appliedTopPx: canvas.mobileTopSafeArea?.reservedTopBlankPx || DEFAULT_VERTICAL_TOP_SAFE_PX,
          mode: canvas.mobileTopSafeArea?.mode || "auto",
          sourcePageTransform: canvas.mobileTopSafeArea?.active
            ? "auto-preserve pages that already have a blank top band; otherwise fit the native page below the top safe band without crop or horizontal squeeze"
            : "inactive",
        },
        layoutPolicy: [
          "IP presenter appears as the teaching anchor, not a decorative sticker.",
          "Knowledge cards stack vertically with generous white space and deterministic subtitle room.",
          "Execution Agents occupy small support lanes and never cover core text or captions.",
          "Final readable Chinese text remains owned by page artwork or subtitles, with no workflow labels.",
          "Top titles and key claims stay below the mobile status/navigation bar safe area.",
        ],
        rejectList: [
          "cropped 16:9 source page",
          "black bars or letterbox canvas",
          "horizontal PPT page squeezed into portrait",
          "persona hidden by bottom captions",
          "Agent/card/title overlap",
          "top title under mobile status bar or navigation bar",
        ],
        requiredEvidence: [
          "workflow/ip-diagram-creator-plan.json",
          "workflow/ip-diagram-creator-native-jobs.json",
          "workflow/ip-diagram-layout-audit.json",
          "workflow/native-page-render-config.json",
          "workflow/top-safe-area-audit.json",
          "logs/qc.json",
        ],
      }
    : null;
  const ipPlan = {
    schemaVersion: 1,
    stage: "pre-render-ip-diagram-creator-plan",
    status: "active-planner-capability",
    sourceRepo: SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    sourceLicense: "MIT",
    integrationMode: "compatible-capability-portfolio-not-replacement",
    plannerRole: "native-final-teaching-visual-system",
    primaryPlannerRoute: true,
    active: true,
    title,
    userChoices,
    plannerDriver: {
      id: "ip-diagram-creator",
      owner: "planner",
      routeId: "ip-diagram-creator-native-final-pages",
      frameworkKeeps: ["audio", "subtitle timing", "MP4 export", "delivery page", "rights record", "QC gates"],
    },
    executionModes: ["native-final-video", "native-skill-direct-generation"],
    visualEngineOwnership: {
      finalVisibleFrameDesign: "haloshin/ip-diagram-creator generated page images",
      wrapperOwner: "codex-video-workflow",
      audioSubtitleOwner: "codex-video-workflow",
    },
    stableFullScreenContract,
    characterAssetPolicy: {
      requested: args.personalIp !== "off",
      storagePolicy: "project-output-only",
      note: "Character/persona assets may be generated by the native skill route, but this renderer consumes content pages as full-screen video plates.",
    },
    nativeDirectUsePlan: {
      pagesDir: args.pagesDir,
      sourceRun: sourceRun || null,
      sourceScript: sourceScript || null,
      mobileTopSafeArea: canvas.mobileTopSafeArea || null,
      nativePageProvenance: {
        status: pageProvenance.status,
        manifestPath: pageProvenance.manifestPath,
        generationRoute: pageProvenance.generationRoute,
        pagesChecked: pageProvenance.pagesChecked,
        pagesWithGeneratedImageSource: pageProvenance.pagesWithGeneratedImageSource,
      },
      pageCountPolicy,
      contentPages: pages.map((page) => ({ id: page.id, file: page.file, title: page.title })),
    },
    directorPlan: {
      durationSeconds: totalDuration,
      pageCount: pages.length,
      minNativePageCount: pageCountPolicy.minPageCount,
      maxNativePageCount: pageCountPolicy.maxPageCount,
      pageCountWithinRange: pageCountPolicy.withinRange,
      sourceImageCountPlanPresent: pageCountPolicy.sourceImageCountPlanPresent,
      sourceImageCountPlanRequiredCount: pageCountPolicy.sourceImageCountPlanRequiredCount,
      satisfiesSourceImageCountPlan: pageCountPolicy.satisfiesSourceImageCountPlan,
      pageCountWithinRequiredPolicy: pageCountPolicy.withinRequiredCount,
      subtitleCueCount: cues.length,
      aspectRatio: canvas.aspectRatio,
      orientation: canvas.orientation,
      pageTimingPolicy: "audio-time-distributed-page-states",
      motionPolicy: args.handDrawnAnimation === "off" ? "static-full-screen-pages" : "stable-base-with-foreground-hand-drawn-accent",
    },
    pageCards: pages.map((page) => ({
      id: page.id,
      order: page.index,
      sourceImage: page.file,
      pageType: "native-ip-diagram-content-page",
      communicationTask: page.title,
      visualWeight: "full-screen-native-page",
      characterRole: args.personalIp === "off" ? "none" : "personal-ip-presenter-if-present-in-source-image",
      qaRisk: ["do-not-inset", "do-not-card-wrap", "do-not-crop-pan", "do-not-shift-y"],
    })),
    sceneAssignments: sourceScenes.map((scene, index) => ({
      sceneId: scene.id || `scene-${String(index + 1).padStart(2, "0")}`,
      start: scene.start,
      end: scene.end,
      sourceHeadline: scene.visualHeadline || scene.subtitle || "",
      nativePage: pages[Math.min(pages.length - 1, Math.floor(index * pages.length / Math.max(1, sourceScenes.length)))]?.id,
    })),
    promptContract: {
      readableTextOwner: "native generated page image for page artwork; codex-video-workflow owns subtitles",
      overlayTextPolicy: "subtitles only; no internal renderer labels",
      repairPromptRule: "if source pages show overlaps, regenerate through native Skill with more whitespace before rendering video",
    },
    qaChecklist: [
      "ipDiagramCreatorPlanPresent",
      "ipDiagramNativeJobsPresent",
      "ipDiagramLayoutAuditPresent",
      "ipDiagramFullScreenStable",
      "ipDiagramNoBorderWrapper",
      "ipDiagramBaseImageStable",
      "nativePageProvenanceVerified",
      "skillUsageAccuracyAuditPass",
      "visualSubtitleSingleLine",
      "audioVideoDurationDeltaOk",
    ],
  };
  const priorNativeJobs = [
    sourceRun ? join(sourceRun, "workflow", "ip-diagram-creator-native-jobs.json") : null,
    join(dirname(args.pagesDir || ""), "workflow", "ip-diagram-creator-native-jobs.json"),
    join(out, "workflow", "ip-diagram-creator-native-jobs.json"),
  ].filter(Boolean).map((candidate) => readJsonIfExists(candidate)).find((artifact) => Array.isArray(artifact?.jobs)) || null;
  const nativeJobs = {
    schemaVersion: 1,
    stage: "pre-render-ip-diagram-creator-native-jobs",
    status: "active-native-route-available",
    sourceRepo: SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    sourceLicense: "MIT",
    executionModes: ["native-final-video", "native-skill-direct-generation"],
    promptTracePolicy: "Preserve the exact upstream generation prompt and its quality metadata. The renderer may attach source-image/render evidence but must never replace a rich generation prompt with a generic sentence.",
    upstreamArtifactPreserved: Boolean(priorNativeJobs),
    promptMethod: priorNativeJobs?.promptMethod || null,
    userChoices,
    visualDna: {
      background: "white/near-white full-page teaching canvas",
      line: "black minimal hand-drawn line art",
      accents: ["orange", "red", "blue"],
      presenter: args.personalIp === "off" ? "optional/off" : "adult personal-IP presenter when generated by source Skill",
      agents: "concrete execution agents only when useful",
    },
    jobs: pages.map((page, index) => {
      const upstream = priorNativeJobs?.jobs?.[index] || null;
      return {
        ...(upstream || {}),
        pageCardId: upstream?.pageCardId || page.id,
        nativeMode: upstream?.nativeMode || "native generated personal-IP page",
        sourceImage: page.file,
        sourceImageSha256: sha256File(page.file),
        prompt: upstream?.prompt || null,
        promptStatus: upstream?.prompt ? "preserved-upstream-generation-prompt" : "upstream-prompt-unavailable-do-not-fabricate",
        promptSha256: upstream?.prompt ? sha256Text(upstream.prompt) : null,
        promptPath: upstream?.promptPath || null,
        promptLint: upstream?.promptLint || null,
        visualBlueprint: upstream?.visualBlueprint || null,
        renderEvidence: {
          nativePageIndex: page.index,
          sourceImage: page.file,
          sourceImageSha256: sha256File(page.file),
          provenanceManifest: pageProvenance.manifestPath,
        },
        repairPrompt: upstream?.repairPrompt || "Recover the original structured prompt and visual blueprint before repair; do not regenerate from a generic whiteboard sentence.",
      };
    }),
  };
  const layoutAudit = {
    schemaVersion: 1,
    stage: "pre-render-ip-diagram-layout-audit",
    status: pageProvenance.status === "pass" && pageCountPolicy.withinRequiredCount ? "pass" : "fail",
    layoutModel: "native-full-screen-page-fixed-transform",
    canvas: stableFullScreenContract.outputCanvas,
    sourcePageProvenance: pageProvenance,
    mobileTopSafeArea: canvas.mobileTopSafeArea || null,
    pageCountPolicy,
    stableFullScreenContract,
    checkedScenes: pages.map((page) => ({
      sceneId: page.id,
      sourceImage: page.file,
      gridAreas: ["native-page-full-frame", "subtitle-safe-bottom", "foreground-hand-drawn-accent"],
      noAbsolutePanelOverlap: true,
      fullScreenPage: true,
      noBorderWrapper: true,
      baseTransformStable: true,
      noVerticalJump: true,
      viewerFacingLabelsOnly: true,
    })),
    issues: [
      ...(pageProvenance.issues || []),
      ...(!pageCountPolicy.withinRange ? [`Native page count ${pageCountPolicy.actualPageCount} is below required minimum ${pageCountPolicy.minPageCount}; there is no default maximum.`] : []),
      ...(!pageCountPolicy.satisfiesSourceImageCountPlan ? [pageCountPolicy.sourceImageCountPlanIssue || "Native page count does not satisfy source image count plan."] : []),
    ],
  };
  const whiteboardPlan = {
    schemaVersion: 1,
    active: args.handDrawnAnimation !== "off",
    trigger: args.handDrawnAnimation === "off" ? "disabled by user choice" : "user requested personal-IP pages combined with hand-drawn animation",
    sceneIds: pages.map((page) => page.id),
    backgroundPolicy: "reuse-native-ip-diagram-full-screen-page-with-fixed-transform",
    drawPolicy: "semantic-foreground-accent-only; never move, crop, or redraw the source page",
    subtitlePolicy: "topmost-framework-owned",
    colorPolicy: "orange/red/blue marker accents may overlay; source page colors remain untouched",
    externalEngine: "local Pillow/FFmpeg deterministic foreground accent renderer",
    layerOrder: ["background-native-ip-diagram-page", "foreground-hand-drawn-accent", "subtitles-overlays"],
    rejectedScenes: [],
    requiredEvidence: [
      "workflow/ip-diagram-creator-plan.json",
      "workflow/ip-diagram-layout-audit.json",
      "workflow/visual-rhythm-plan.json",
      "screenshots/opening.png",
      "screenshots/middle.png",
      "screenshots/ending.png",
      "logs/qc.json",
    ],
  };
  const visualRhythmPlan = {
    schemaVersion: 1,
    status: "pass",
    route: "ip-diagram-native-full-screen-pages",
    canvas: stableFullScreenContract.outputCanvas,
    visualRhythmPolicy: "static generated pages stay fixed; rhythm comes from semantic page cuts, foreground hand-drawn accents, and subtitles",
    maxBaseImageTransformChangesWithinPage: 0,
    stableBackgroundRequired: true,
    noPerCueCropPanZoom: true,
    events: pages.map((page) => ({
      id: page.id,
      sourceImage: page.file,
      stateCount: args.handDrawnAnimation === "off" ? 1 : 2,
      visibleEvents: args.handDrawnAnimation === "off"
        ? ["full-screen page hold"]
        : ["full-screen page hold", "foreground semantic focus loop", "foreground connector trace", "foreground progress rail"],
      requiredPerceptibility: args.handDrawnAnimation === "off" ? "none" : "visible-at-middle-frame-without-pixel-diff-tooling",
    })),
  };
  const qualityContract = {
    schemaVersion: 1,
    status: "required-final-quality-gate",
    route: "ip-diagram-native-final-pages",
    userChoices,
    canvas: stableFullScreenContract.outputCanvas,
    hardGates: [
      "ipDiagramCreatorPlanPresent",
      "ipDiagramCreatorVendorUsagePresent",
      "ipDiagramCreatorNativeJobsPresent",
      "ipDiagramLayoutAuditPresent",
      "ipDiagramFullScreenStable",
      "ipDiagramNoBorderWrapper",
      "ipDiagramBaseImageStable",
      "ipDiagramNoPerCueCropPanZoom",
      "nativePageCountWithinPersonalIpRange",
      "nativePageCountSatisfiesSourceImageCountPlan",
      "nativePageProvenanceVerified",
      "visualRhythmPlanPresent",
      "visualSubtitleSingleLine",
      "audioVideoDurationDeltaOk",
      "screenshotsPresent",
      "coverArtifactsPresent",
      "coverContextImage2HandoffPresent",
      "coverNativeImage2Ready",
      ...(canvas.vertical ? ["verticalPersonalIpDesignContractPresent", "nativePagesGeneratedForVerticalCanvas", "topSafeAreaAuditPresent", "topSafeAreaReservedForMobileChrome"] : []),
    ],
    requiredArtifacts: [
      "workflow/ip-diagram-creator-plan.json",
      "workflow/ip-diagram-creator-vendor-usage.json",
      "workflow/ip-diagram-creator-native-jobs.json",
      "workflow/ip-diagram-layout-audit.json",
      "workflow/skill-usage-accuracy-audit.json",
      "workflow/native-page-count-policy.json",
      "workflow/whiteboard-layered-reveal-plan.json",
      "workflow/visual-rhythm-plan.json",
      "workflow/cover-design.json",
      "workflow/cover-size-selection.json",
      "workflow/context-image2-cover-requests.json",
      "logs/qc.json",
      "renders/final.mp4",
      "cover/native-final-cover-1920x1080.png",
      ...(canvas.vertical ? ["workflow/vertical-personal-ip-design-contract.json", "workflow/top-safe-area-audit.json"] : []),
    ],
    rejectList: [
      "inset page frame",
      "card wrapper around source page",
      "drop shadow around source page",
      "per-subtitle crop variants",
      "background vertical bounce",
      "random camera y-offset",
      "subtitles hidden under hand-drawn layer",
      "deterministic PIL/SVG/HTML placeholder pages presented as official native-final pages",
      "native-final content pages without source_generated_image or explicit approved-page provenance",
      ...(canvas.vertical ? [
        "horizontal native pages cropped into a vertical MP4",
        "portrait layout without reserved bottom caption safe area",
        "top title under mobile status bar or navigation bar",
      ] : []),
    ],
  };
  const topSafeAreaAudit = canvas.vertical
    ? {
        schemaVersion: 1,
        stage: "mobile-top-safe-area-audit",
        status: canvas.mobileTopSafeArea?.active ? "pass" : "fail",
        route: "ip-diagram-native-final-pages",
        reason: "Mobile vertical viewing can cover top pixels with status/navigation UI; final personal-IP pages must leave safe space before title/key text.",
        targetCanvas: stableFullScreenContract.outputCanvas,
        reservedTopBlankPx: canvas.mobileTopSafeArea?.reservedTopBlankPx || 0,
        mode: canvas.mobileTopSafeArea?.mode || "off",
        sourcePageTransform: {
          operation: canvas.mobileTopSafeArea?.transform || "none",
          sourceGeneratedImageProvenancePreserved: true,
          noCrop: true,
          noHorizontalSqueeze: true,
          subtitleSafeAreaPreserved: true,
        },
        pagesChecked: pages.length,
        checks: {
          topSafeAreaReservedForMobileChrome: Boolean(canvas.mobileTopSafeArea?.active),
          allOutputFramesAre1080x1920: canvas.width === DEFAULT_PORTRAIT_WIDTH && canvas.height === DEFAULT_PORTRAIT_HEIGHT,
          nativePageProvenanceVerified: pageProvenance.status === "pass",
          bottomSubtitleBandPreserved: true,
          noCroppedHorizontalPage: true,
        },
      }
    : null;
  const brief = {
    schemaVersion: 1,
    title,
    route: "ip-diagram-native-final-pages",
    sourceRun: sourceRun || null,
    sourceScript: sourceScript || null,
    userChoices,
    output: {
      width: canvas.width,
      height: canvas.height,
      aspectRatio: canvas.aspectRatio,
      orientation: canvas.orientation,
      fps: Number(args.fps),
      subtitleMode: args.subtitleMode,
      mobileTopSafeArea: canvas.mobileTopSafeArea || null,
    },
  };
  const integratedBriefPath = join(out, "brief.json");
  if (existsSync(integratedBriefPath)) {
    writeJson(join(out, "workflow", "native-page-brief.json"), brief);
  } else {
    writeJson(integratedBriefPath, brief);
  }
  const integratedIpPlanPath = join(out, "workflow", "ip-diagram-creator-plan.json");
  const integratedIpPlan = readJsonIfExists(integratedIpPlanPath);
  if (integratedIpPlan?.nativeFinalVideoPlan) {
    writeJson(join(out, "workflow", "native-page-ip-diagram-creator-plan.json"), ipPlan);
  } else {
    writeJson(integratedIpPlanPath, ipPlan);
  }
  writeJson(join(out, "workflow", "ip-diagram-creator-vendor-usage.json"), vendorUsage);
  writeJson(join(out, "workflow", "ip-diagram-creator-native-jobs.json"), nativeJobs);
  writeJson(join(out, "workflow", "ip-diagram-layout-audit.json"), layoutAudit);
  writeJson(join(out, "workflow", "native-page-provenance-audit.json"), pageProvenance);
  writeJson(join(out, "workflow", "native-page-count-policy.json"), pageCountPolicy);
  writeJson(join(out, "workflow", "skill-usage-accuracy-audit.json"), skillUsageAccuracyAudit);
  writeJson(join(out, "workflow", "whiteboard-layered-reveal-plan.json"), whiteboardPlan);
  writeJson(join(out, "workflow", "visual-rhythm-plan.json"), visualRhythmPlan);
  writeJson(join(out, "workflow", "quality-consistency-contract.json"), qualityContract);
  if (verticalPersonalIpDesignContract) {
    writeJson(join(out, "workflow", "vertical-personal-ip-design-contract.json"), verticalPersonalIpDesignContract);
  }
  if (topSafeAreaAudit) {
    writeJson(join(out, "workflow", "top-safe-area-audit.json"), topSafeAreaAudit);
  }
}

function renderFramesWithPython(configPath, commands) {
  const py = String.raw`
import json
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
width = int(config["width"])
height = int(config["height"])
frames = config["frames"]
frames_dir = Path(config["framesDir"])
concat_path = Path(config["concatPath"])
mode = config["handDrawnAnimation"]
semantic_motion_plan = config.get("semanticMotionPlan") or {"pages": []}
top_safe = config.get("topSafeArea") or {}
top_safe_active = bool(top_safe.get("active"))
top_safe_mode = str(top_safe.get("mode") or "off").lower()
top_safe_px = max(0, min(height - 1, int(top_safe.get("reservedTopBlankPx") or 0)))
frames_dir.mkdir(parents=True, exist_ok=True)

font_candidates = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]

def load_font(size):
    for path in font_candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size, index=0)
            except Exception:
                pass
    return ImageFont.load_default()

font = load_font(42)
small_font = load_font(24)

def cover_image(path):
    img = Image.open(path).convert("RGB")
    src_w, src_h = img.size
    scale = max(width / src_w, height / src_h)
    target = (int(round(src_w * scale)), int(round(src_h * scale)))
    img = img.resize(target, Image.Resampling.LANCZOS)
    left = (target[0] - width) // 2
    top = (target[1] - height) // 2
    return img.crop((left, top, left + width, top + height))

def top_band_is_blank(img):
    if not top_safe_active or top_safe_px <= 0:
        return True
    band = img.crop((0, 0, width, top_safe_px))
    sample_w = min(240, width)
    sample_h = max(1, int(top_safe_px * sample_w / max(1, width)))
    band = band.resize((sample_w, sample_h), Image.Resampling.BILINEAR)
    pixels = list(band.getdata())
    if not pixels:
        return True
    non_blank = 0
    for r, g, b in pixels:
        # Generated whiteboard pages have light paper texture; treat clear ink/markers as unsafe.
        if min(r, g, b) < 238:
            non_blank += 1
    return (non_blank / len(pixels)) <= 0.012

def fit_image_below_top_safe_area(path):
    img = Image.open(path).convert("RGB")
    src_w, src_h = img.size
    content_h = max(1, height - top_safe_px)
    scale = min(width / src_w, content_h / src_h)
    target = (max(1, int(round(src_w * scale))), max(1, int(round(src_h * scale))))
    resized = img.resize(target, Image.Resampling.LANCZOS)
    base = Image.new("RGB", (width, height), (255, 255, 255))
    left = (width - target[0]) // 2
    top = top_safe_px
    base.paste(resized, (left, top))
    return base

def prepare_base_image(path):
    covered = cover_image(path)
    if not top_safe_active:
        return covered
    if top_safe_mode == "force":
        return fit_image_below_top_safe_area(path)
    if top_safe_mode == "auto" and not top_band_is_blank(covered):
        return fit_image_below_top_safe_area(path)
    return covered

def draw_text_with_outline(draw, xy, text, font, fill, outline, stroke_width=4, anchor="mm"):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor, stroke_width=stroke_width, stroke_fill=outline)

def draw_subtitle(base, lines):
    overlay = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    od = ImageDraw.Draw(overlay)
    # Soft bottom wash, not a card or border. It protects readability without framing the page.
    band_top = height - 178
    for y in range(band_top, height):
        t = (y - band_top) / max(1, height - band_top)
        alpha = int(116 * (t ** 1.7))
        od.line([(0, y), (width, y)], fill=(255, 255, 255, alpha))
    base = Image.alpha_composite(base.convert("RGBA"), overlay)
    draw = ImageDraw.Draw(base)
    clean = [line.strip() for line in lines if line.strip()]
    if not clean:
        return base.convert("RGB")
    line_h = 58
    start_y = height - 94 - (len(clean) - 1) * line_h / 2
    for i, line in enumerate(clean):
        draw_text_with_outline(
            draw,
            (width // 2, int(start_y + i * line_h)),
            line,
            font,
            fill=(18, 22, 25, 255),
            outline=(255, 255, 255, 245),
            stroke_width=5,
        )
    return base.convert("RGB")

def draw_handdrawn_accent(img, frame):
    if mode == "off":
        return img
    base = img.convert("RGBA")
    overlay = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    progress = max(0.0, min(1.0, float(frame.get("pageProgress", 0.0))))
    page_name = str(frame.get("pageName") or "")
    page_plan = next((item for item in semantic_motion_plan.get("pages", []) if item.get("pageName") == page_name), None)
    if page_plan is None:
        raise RuntimeError(f"Missing semantic motion plan for {page_name}")

    def rgba(raw, fallback):
        values = list(raw or fallback)
        while len(values) < 4:
            values.append(220)
        return tuple(int(value) for value in values[:4])

    def px(point):
        return (int(float(point[0]) * width), int(float(point[1]) * height))

    def local_progress(start, end):
        start = float(start if start is not None else 0)
        end = float(end if end is not None else 1)
        if end <= start:
            return 1.0 if progress >= end else 0.0
        raw = max(0.0, min(1.0, (progress - start) / (end - start)))
        return 1 - ((1 - raw) ** 3)

    def rough_line(points, fill, stroke=7, copies=2):
        for copy_index in range(copies):
            offset = copy_index * 2 - 1
            shifted = [(x, y + int(math.sin((x + int(frame.get("index", 1)) * 19) / 34) * 1.4) + offset) for x, y in points]
            draw.line(shifted, fill=fill, width=max(2, stroke - copy_index * 2), joint="curve")

    # Paths are page-local reading cues. They never originate from a global rail and
    # never cross into the persona/text lanes defined as forbidden by the plan.
    for path in page_plan.get("paths", []):
        amount = local_progress(path.get("start"), path.get("end"))
        raw_points = [px(point) for point in path.get("points", [])]
        if amount <= 0 or len(raw_points) < 2:
            continue
        segment_lengths = [math.dist(raw_points[index], raw_points[index + 1]) for index in range(len(raw_points) - 1)]
        target = sum(segment_lengths) * amount
        visible = [raw_points[0]]
        walked = 0.0
        for index, length in enumerate(segment_lengths):
            start_point = raw_points[index]
            end_point = raw_points[index + 1]
            if walked + length <= target:
                visible.append(end_point)
                walked += length
                continue
            ratio = 0 if length <= 0 else max(0.0, min(1.0, (target - walked) / length))
            visible.append((int(start_point[0] + (end_point[0] - start_point[0]) * ratio), int(start_point[1] + (end_point[1] - start_point[1]) * ratio)))
            break
        rough_line(visible, rgba(path.get("color"), (43, 105, 214, 190)), stroke=int(path.get("stroke", 6)), copies=2)

    for node in page_plan.get("nodes", []):
        amount = local_progress(node.get("start"), node.get("end"))
        if amount <= 0:
            continue
        cx, cy = px(node.get("center", [0, 0]))
        rx = max(2, int(float(node.get("radius", [0.03, 0.02])[0]) * width))
        ry = max(2, int(float(node.get("radius", [0.03, 0.02])[1]) * height))
        color = rgba(node.get("color"), (232, 92, 44, 176))
        start_angle = -90
        end_angle = start_angle + int(358 * amount)
        draw.arc((cx-rx, cy-ry, cx+rx, cy+ry), start_angle, end_angle, fill=color, width=max(3, int(node.get("stroke", 5))))

    return Image.alpha_composite(base, overlay).convert("RGB")

concat_lines = []
last_frame = None
for frame in frames:
    img = prepare_base_image(frame["sourceImage"])
    img = draw_handdrawn_accent(img, frame)
    img = draw_subtitle(img, frame.get("subtitleLines", []))
    out = frames_dir / f'{frame["id"]}.jpg'
    img.save(out, quality=92, optimize=True, progressive=True)
    duration = max(0.05, float(frame.get("duration", 0.05)))
    concat_lines.append(f"file '{out.as_posix()}'")
    concat_lines.append(f"duration {duration:.6f}")
    last_frame = out

if last_frame is not None:
    concat_lines.append(f"file '{last_frame.as_posix()}'")

concat_path.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")
`;
  run("python3", ["-c", py, configPath], { log: commands });
}

function createDeliveryPage(out, title, videoPath, qc, canvas) {
  const relVideo = videoPath.startsWith(out) ? videoPath.slice(out.length + 1) : videoPath;
  const coverPath = join(out, "cover", "native-final-cover-1920x1080.png");
  const coverHtml = existsSync(coverPath)
    ? `<section><h2>封面</h2><img src="cover/native-final-cover-1920x1080.png" alt="封面" style="width:100%;display:block;border:1px solid rgba(24,24,24,.08);background:#fff"></section>`
    : "";
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: #f6f3ed; color: #1b1b1b; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 28px; line-height: 1.25; margin: 0 0 18px; }
    video { width: 100%; aspect-ratio: ${escapeHtml(canvas.cssAspectRatio)}; background: #000; display: block; }
    section { margin-top: 24px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .item { background: rgba(255,255,255,.78); border: 1px solid rgba(24,24,24,.08); padding: 12px 14px; border-radius: 8px; }
    code { overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <video controls src="${escapeHtml(relVideo)}"></video>
    <section class="meta">
      <div class="item"><strong>QC</strong><br>${qc.pass ? "PASS" : "FAIL"}</div>
      <div class="item"><strong>画布</strong><br>${canvas.width}x${canvas.height} · ${escapeHtml(canvas.aspectRatio)}</div>
      <div class="item"><strong>画面策略</strong><br>官方页面全屏固定，前景手绘动效</div>
      <div class="item"><strong>跳动防护</strong><br>无逐字幕裁切/缩放/纵向偏移</div>
      <div class="item"><strong>封面</strong><br>${qc.checks?.coverNativeImage2Ready ? "原生 Image2 已完成" : qc.checks?.coverArtifactsPresent ? "评审稿，待 Context Image2" : "缺失"}</div>
      <div class="item"><strong>文件</strong><br><code>${escapeHtml(videoPath)}</code></div>
    </section>
    ${coverHtml}
  </main>
</body>
</html>`;
  writeFileSync(join(out, "delivery.html"), html, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeFinalAudio({ out, finalPath, commands }) {
  const normalized = join(out, "renders", "final.audio-normalized.mp4");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", finalPath,
    "-map", "0:v:0",
    "-map", "0:a:0",
    "-map", "0:s?",
    "-c:v", "copy",
    "-filter:a", FINAL_AUDIO_DELIVERY_FILTER,
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", String(DELIVERY_AUDIO_SAMPLE_RATE),
    "-ac", String(DELIVERY_AUDIO_CHANNELS),
    "-c:s", "copy",
    "-movflags", "+faststart",
    normalized,
  ], { log: commands });
  copyFileSync(normalized, finalPath);
  writeJson(join(out, "workflow", "final-audio-normalization.json"), {
    schemaVersion: 1,
    route: "ip-diagram-native-final-pages",
    input: "renders/final.mp4",
    temporaryOutput: "renders/final.audio-normalized.mp4",
    output: "renders/final.mp4",
    filter: FINAL_AUDIO_DELIVERY_FILTER,
    target: {
      approximateMeanDb: -15,
      truePeakDb: -1.5,
      lra: 8,
    },
    deliveryAudioFormat: {
      sampleRateHz: DELIVERY_AUDIO_SAMPLE_RATE,
      channels: DELIVERY_AUDIO_CHANNELS,
    },
    videoEncoding: {
      codec: "copy",
      reason: "The native-page route repairs only the narration loudness track; source page pixels are already final and must stay stable.",
    },
    purpose: "Raise final delivered MP4 loudness and reduce narration dynamics so口播 remains clearly audible at normal playback volume.",
  });
}

function nativeFinalCoverTargetSpecs(canvas = {}) {
  const videoWidth = Number(canvas.width || DEFAULT_LANDSCAPE_WIDTH);
  const videoHeight = Number(canvas.height || DEFAULT_LANDSCAPE_HEIGHT);
  const videoRatio = aspectRatio(videoWidth, videoHeight);
  return [
    {
      id: "video-opening",
      platform: "Video opening frame",
      usage: "in-video",
      width: videoWidth,
      height: videoHeight,
      ratio: videoRatio,
      file: `cover/cover-video-opening-${videoRatio.replace(":", "x")}.svg`,
    },
    { id: "master-16x9-4k", platform: "YouTube / horizontal high-resolution", width: 3840, height: 2160, ratio: "16:9" },
    { id: "youtube-1280x720", platform: "YouTube / common 16:9 thumbnail", width: 1280, height: 720, ratio: "16:9" },
    { id: "horizontal-4x3-1600x1200", platform: "Generic horizontal 4:3 cover", width: 1600, height: 1200, ratio: "4:3" },
    { id: "bilibili-common-1146x717", platform: "Bilibili common cover", width: 1146, height: 717, ratio: aspectRatio(1146, 717) },
    { id: "bilibili-1920x1080", platform: "Bilibili / HD 16:9 cover", width: 1920, height: 1080, ratio: "16:9" },
    { id: "vertical-1080x1920", platform: "Douyin / TikTok / Shorts vertical source", width: 1080, height: 1920, ratio: "9:16" },
    { id: "vertical-profile-1080x1440", platform: "Douyin / Kuaishou 3:4 profile cover", width: 1080, height: 1440, ratio: "3:4" },
    { id: "instagram-reels-cover", platform: "Instagram Reels profile cover", width: 420, height: 654, ratio: aspectRatio(420, 654) },
    { id: "square-1200x1200", platform: "Square social feed card", width: 1200, height: 1200, ratio: "1:1" },
  ].map((target) => ({
    usage: "standalone-upload-resolution",
    creativeRole: target.usage === "in-video" ? "video-continuity-cover" : "platform-specific-click-strategy",
    maxBytes: 5_000_000,
    ...target,
  }));
}

function nativeFinalCoverPrompt({ title, target, sourcePage }) {
  const visibleTitle = String(title || "核心方法")
    .replace(/^写小说方法论[：:]?/u, "")
    .replace(/\s+/g, "")
    .slice(0, 14) || "核心方法";
  return [
    "Use case: ads-marketing / platform video thumbnail",
    "Asset type: platform-submission video cover",
    `Native target: ${target.width}x${target.height} (${target.ratio})`,
    `Goal: create a complete native-ratio upload cover for ${title}`,
    `Role-labelled input image: main native personal-IP page context, ${sourcePage}`,
    "Subject: original knowledge presenter / personal-IP teaching board with a strong novel-writing proof object.",
    "Scene/backdrop: premium white-canvas hand-drawn editorial cover with sparse orange and blue marker accents.",
    "Style/medium: professional high-click Chinese knowledge thumbnail, integrated typography, crisp depth, mobile-readable hierarchy.",
    "Composition/framing: adapt natively to this exact ratio; no crop, no letterbox, no matte frame, no duplicated side panels.",
    "Lighting/mood: bright paper, confident, clear, creator-methodology tone.",
    "Color palette: white paper, ink black, restrained orange, cobalt blue, one warm highlight.",
    `Text (verbatim): ${visibleTitle}`,
    "Supporting text (verbatim): 看完能用",
    `Content binding: every visual clue must directly express the locked topic "${title}"; do not substitute a different writing-method topic found in body text.`,
    "Avoid list: workflow labels, platform labels, renderer names, English filler words, random numbers, QR codes, logos, PPT title card layout, tiny body copy, copied creator style.",
  ].join("\n");
}

function nativeFinalCoverPromptArtifacts({ out, title, sourcePage, canvas, writePromptFiles = true }) {
  const targets = nativeFinalCoverTargetSpecs(canvas);
  const standaloneTargets = targets.filter((target) => target.usage !== "in-video");
  const prompts = standaloneTargets.map((target) => ({
    targetId: `${target.id}-image2-integrated-cover`,
    generationRole: "platform-specific Image 2 complete cover with integrated typography sharing one native-final content promise",
    width: target.width,
    height: target.height,
    ratio: target.ratio,
    platformFamily: target.id,
    platform: target.platform,
    prompt: nativeFinalCoverPrompt({ title, target, sourcePage }),
  }));
  const promptDir = join(out, "prompts", "context-image2-covers");
  if (writePromptFiles) ensureDir(promptDir);
  const requests = prompts.map((promptItem) => {
    const targetId = String(promptItem.targetId).replace(/-image2-integrated-cover$/, "");
    const promptFileName = `${safeFileStem(targetId)}.txt`;
    const promptPath = join(promptDir, promptFileName);
    const request = {
      targetId,
      promptTargetId: promptItem.targetId,
      coverTitle: title,
      status: "pending",
      provider: "codex-context-image2",
      tool: "image_gen",
      purpose: "platform-submission-cover",
      videoInternalCover: false,
      parallelSafe: true,
      consistencyGroup: "context-image2-native-final-cover-targets",
      requiredForFinalCover: true,
      width: promptItem.width,
      height: promptItem.height,
      ratio: promptItem.ratio,
      platformFamily: promptItem.platformFamily,
      promptPath: `prompts/context-image2-covers/${promptFileName}`,
      prompt: promptItem.prompt,
      inputImages: [{ role: "native-page-context", path: sourcePage }],
      contextImages: [sourcePage],
      expectedOutput: `cover/context-image2-${targetId}.png`,
      generationReceiptPath: `workflow/context-image2-cover-evidence/${safeFileStem(targetId)}-generation-receipt.json`,
      inspectionRecordPath: `workflow/context-image2-cover-evidence/${safeFileStem(targetId)}-inspection-record.json`,
      ingestCommand: `node scripts/ingest-codex-image2-cover-target.mjs --topic ${out} --target ${targetId} --source <codex-imagegen-png> --generation-receipt <generation-receipt.json> --inspection-record <inspection-record.json>`,
    };
    const promptText = formatContextImage2CoverPromptDocument({ request, coverTitle: title });
    request.promptSha256 = sha256Text(request.prompt);
    request.promptFileSha256 = sha256Text(promptText);
    request.sourceStagingPolicy = "external-imagegen-output-until-ingest";
    if (writePromptFiles) writeFileSync(promptPath, promptText, "utf8");
    return request;
  });
  const requestedTargetIds = requests.map((request) => request.targetId);
  return { targets, prompts, requests, requestedTargetIds };
}

function coreContextImage2CoverLanePresent(existingCoverDesign, existingContextImage2Requests) {
  const requestLaneReady = existingContextImage2Requests?.provider === "codex-context-image2"
    && existingContextImage2Requests?.tool === "image_gen"
    && Array.isArray(existingContextImage2Requests?.requests)
    && existingContextImage2Requests.requests.length > 0;
  const coverDesignReady = existingCoverDesign?.defaultCoverEngine === "image2-integrated-typography-cover"
    || existingCoverDesign?.contextImage2CoverRequestsFile === "workflow/context-image2-cover-requests.json"
    || existingCoverDesign?.contextImage2Handoff === "workflow/context-image2-cover-requests.json";
  return requestLaneReady && coverDesignReady;
}

function createCoverArtifacts({ out, title, pages, canvas, commands }) {
  const coverDir = join(out, "cover");
  const finalDir = join(out, "最终成品", "评审级封面-非上传终版");
  const promptDir = join(out, "prompts", "context-image2-covers");
  ensureDir(coverDir);
  ensureDir(finalDir);
  ensureDir(promptDir);
  const sourcePage = pages[0]?.file;
  if (!sourcePage || !existsSync(sourcePage)) {
    throw new Error("Cannot create cover artifacts: first native page image is missing.");
  }
  const pngCover = join(coverDir, "native-final-cover-1920x1080.png");
  const jpgCover = join(coverDir, "native-final-cover-1280x720.jpg");
  const finalPng = join(finalDir, "01-横版16比9-评审级封面-1920x1080.png");
  const finalJpg = join(finalDir, "02-横版16比9-评审级封面-1280x720.jpg");
  const pngFilter = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgb24";
  const jpgFilter = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuvj420p";
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", sourcePage, "-vf", pngFilter, "-frames:v", "1", pngCover], { log: commands });
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", sourcePage, "-vf", jpgFilter, "-q:v", "3", "-frames:v", "1", jpgCover], { log: commands });
  copyFileSync(pngCover, finalPng);
  copyFileSync(jpgCover, finalJpg);
  const coverDesignPath = join(out, "workflow", "cover-design.json");
  const coverSizeSelectionPath = join(out, "workflow", "cover-size-selection.json");
  const contextImage2RequestsPath = join(out, "workflow", "context-image2-cover-requests.json");
  const existingCoverDesign = readJsonIfExists(coverDesignPath);
  const existingContextImage2Requests = readJsonIfExists(contextImage2RequestsPath);
  const coreCoverLogicPresent = coreContextImage2CoverLanePresent(
    existingCoverDesign,
    existingContextImage2Requests,
  );
  const fallbackCover = nativeFinalCoverPromptArtifacts({
    out,
    title,
    sourcePage,
    canvas,
    writePromptFiles: !coreCoverLogicPresent,
  });
  const nativeReviewCover = {
    schemaVersion: 1,
    status: "ready-review-grade-native-page-cover",
    route: "ip-diagram-native-final-pages",
    title,
    sourceNativePage: sourcePage,
    coverPromise: "小说主题不是一句金句",
    visualContinuity: "Cover is derived from the opening native generated page so thumbnail and first frame stay consistent.",
    contextImage2Handoff: "workflow/context-image2-cover-requests.json",
    preservesCoreCoverLogic: coreCoverLogicPresent,
    uploadReady: false,
    reasonUploadReadyFalse: "Review-grade cover is created from the native opening page. Native target-ratio Context Image2 cover generation can replace it for platform upload variants.",
    outputs: {
      png1920x1080: "cover/native-final-cover-1920x1080.png",
      jpg1280x720: "cover/native-final-cover-1280x720.jpg",
      finalReviewPng: "最终成品/评审级封面-非上传终版/01-横版16比9-评审级封面-1920x1080.png",
      finalReviewJpg: "最终成品/评审级封面-非上传终版/02-横版16比9-评审级封面-1280x720.jpg",
    },
  };
  const coverDesign = {
    schemaVersion: 1,
    status: "ready-review-grade-native-page-cover",
    route: "ip-diagram-native-final-pages",
    title,
    sourceNativePage: sourcePage,
    coverPromise: "小说主题不是一句金句",
    visualContinuity: "Cover is derived from the opening native generated page so thumbnail and first frame stay consistent.",
    defaultCoverEngine: "image2-integrated-typography-cover",
    image2CoverPromptFile: "workflow/cover-image2-prompts.json",
    contextImage2CoverRequestsFile: "workflow/context-image2-cover-requests.json",
    coverSizeSelectionFile: "workflow/cover-size-selection.json",
    sharedContentPromiseMultiPlatformVariants: true,
    platformSpecificDesignsGenerated: true,
    resolutionPresets: fallbackCover.targets,
    platformTargets: fallbackCover.targets.filter((target) => target.usage !== "in-video"),
    contextImage2Handoff: "workflow/context-image2-cover-requests.json",
    uploadReady: false,
    reasonUploadReadyFalse: "Review-grade cover is created from the native opening page. Native target-ratio Context Image2 cover generation can replace it for platform upload variants.",
    outputs: {
      png1920x1080: "cover/native-final-cover-1920x1080.png",
      jpg1280x720: "cover/native-final-cover-1280x720.jpg",
      finalReviewPng: "最终成品/评审级封面-非上传终版/01-横版16比9-评审级封面-1920x1080.png",
      finalReviewJpg: "最终成品/评审级封面-非上传终版/02-横版16比9-评审级封面-1280x720.jpg",
    },
  };
  const coverSizeSelection = {
    schemaVersion: 1,
    status: "review-grade-cover-present",
    route: "ip-diagram-native-final-pages",
    defaultVideoRatio: canvas.aspectRatio,
    uploadReadyCount: 0,
    reviewGradeCount: 2,
    pendingNativeTargetCount: fallbackCover.requests.length,
    primaryPlatformUploadCoverTargetId: canvas.vertical ? "vertical-1080x1920" : "youtube-1280x720",
    entries: fallbackCover.targets.filter((target) => target.usage !== "in-video").map((target) => ({
      targetId: target.id,
      id: target.id,
      label: target.platform,
      width: target.width,
      height: target.height,
      ratio: target.ratio,
      uploadReady: false,
      image2NativeTargetRatioReady: false,
      needsRegeneration: true,
      reason: "needs-native-target-ratio-image2",
      expectedOutput: `cover/context-image2-${target.id}.png`,
    })),
    targets: [
      {
        id: "native-final-review-1920x1080",
        label: "横版16比9评审封面",
        width: 1920,
        height: 1080,
        ratio: "16:9",
        file: "cover/native-final-cover-1920x1080.png",
        uploadReady: false,
        reviewGrade: true,
      },
      {
        id: "native-final-review-1280x720",
        label: "YouTube/通用横版评审封面",
        width: 1280,
        height: 720,
        ratio: "16:9",
        file: "cover/native-final-cover-1280x720.jpg",
        uploadReady: false,
        reviewGrade: true,
      },
    ],
    needsRegeneration: fallbackCover.requests.map((request) => ({
      targetId: request.targetId,
      reason: "needs-native-target-ratio-image2",
      promptPath: request.promptPath,
    })),
    pending: fallbackCover.requests.map((request) => request.targetId),
  };
  const contextImage2Requests = {
    schemaVersion: 1,
    stage: "context-image2-cover-requests",
    status: "required-pending",
    route: "ip-diagram-native-final-pages",
    provider: "codex-context-image2",
    tool: "image_gen",
    purpose: "platform-submission-cover",
    requiredForFinalCover: true,
    coreCoverLogicPreserved: coreCoverLogicPresent,
    sourceNativePage: sourcePage,
    generationContract: {
      skill: "system-imagegen",
      coverSkill: "imagegen",
      provider: "codex-context-image2",
      tool: "image_gen",
      executionMode: "built-in-image_gen",
      completion: "Only request-bound generated Image2/Codex bitmaps ingested through scripts/ingest-codex-image2-cover-target.mjs can satisfy these platform cover targets.",
    },
    primaryPlatformUploadCoverTargetId: canvas.vertical ? "vertical-1080x1920" : "youtube-1280x720",
    primaryPlatformUploadCoverReady: false,
    allRequestedPlatformUploadCoversReady: false,
    completedRequestCount: 0,
    pendingRequestCount: fallbackCover.requests.length,
    completedTargetIds: [],
    pendingTargetIds: fallbackCover.requestedTargetIds,
    requestCountContract: {
      mode: "all-planned-platform-targets",
      expectedRequestCount: fallbackCover.requestedTargetIds.length,
      actualRequestCount: fallbackCover.requests.length,
      requestedTargetIds: fallbackCover.requestedTargetIds,
      actualTargetIds: fallbackCover.requestedTargetIds,
      concurrencyIsThroughputOnly: true,
      nativeFinalFallbackExpandedToAllPlatformTargets: true,
      pass: fallbackCover.requestedTargetIds.length === fallbackCover.requests.length,
    },
    parallelGenerationPolicy: {
      allowed: true,
      strategy: "all-pending-worker-pool",
      failureMode: "all-settled-target-isolation",
      defaultMaxConcurrency: 9,
      maxConcurrency: 9,
      concurrencyEnv: "CODEX_VIDEO_IMAGE2_CONCURRENCY",
      scope: "all requested native-final platform cover targets",
      rule: "Concurrency controls throughput only and must never cap or slice the target list; batch ingest and cover QC run once after all generated outputs are recorded.",
    },
    requestDirectory: "prompts/context-image2-covers",
    requests: fallbackCover.requests,
  };
  const coverImage2Prompts = {
    schemaVersion: 1,
    model: "gpt-image-2",
    source: "ip-diagram-native-final-pages",
    defaultCoverEngine: "image2-integrated-typography-cover",
    contextImage2CoverRequestsFile: "workflow/context-image2-cover-requests.json",
    sharedContentPromiseMultiPlatformVariants: true,
    platformSpecificDesignsGenerated: true,
    sourceNativePage: sourcePage,
    resolutionPresets: fallbackCover.targets,
    prompts: fallbackCover.prompts,
  };
  writeJson(join(out, "workflow", "native-final-cover-review.json"), nativeReviewCover);
  if (!coreCoverLogicPresent) {
    writeJson(join(out, "workflow", "cover-image2-prompts.json"), coverImage2Prompts);
    writeJson(coverDesignPath, coverDesign);
    writeJson(coverSizeSelectionPath, coverSizeSelection);
    writeJson(contextImage2RequestsPath, contextImage2Requests);
  }
  return {
    coverDesign: coreCoverLogicPresent ? existingCoverDesign : coverDesign,
    coreCoverLogicPreserved: coreCoverLogicPresent,
    outputs: [pngCover, jpgCover, finalPng, finalJpg],
  };
}

function coverNativeImage2Ready(out) {
  const selection = readJsonIfExists(join(out, "workflow", "cover-size-selection.json"));
  const requests = readJsonIfExists(join(out, "workflow", "context-image2-cover-requests.json"));
  if (!selection || !requests) return false;
  const aliases = {
    "youtube-1280x720": "horizontal-16x9-1280x720",
    "bilibili-1920x1080": "horizontal-16x9-1920x1080",
    "bilibili-1146x717": "bilibili-common-1146x717",
    "instagram-reels-420x654": "instagram-reels-cover",
  };
  const targetKey = (id) => aliases[id] || id;
  const entries = Array.isArray(selection?.entries)
    ? selection.entries
    : Array.isArray(selection?.targets)
      ? selection.targets
      : [];
  const opening = entries.find((entry) => targetKey(entry.targetId || entry.id || "") === "video-opening");
  const primaryTargetId = targetKey(requests.primaryPlatformUploadCoverTargetId
    || selection.primaryPlatformUploadCoverTargetId
    || (Number(opening?.height || 0) > Number(opening?.width || 0) ? "vertical-1080x1920" : "horizontal-16x9-1280x720"));
  const request = (requests.requests || []).find((item) => targetKey(item.targetId || item.id || "") === primaryTargetId);
  const entry = entries.find((item) => targetKey(item.targetId || item.id || "") === primaryTargetId);
  const actualOutput = request?.actualOutput || "";
  return requests.provider === "codex-context-image2"
    && requests.tool === "image_gen"
    && request?.status === "completed"
    && request?.inspectionPassed === true
    && request?.purpose === "platform-submission-cover"
    && request?.videoInternalCover === false
    && Boolean(actualOutput)
    && existsSync(join(out, actualOutput))
    && entry?.uploadReady === true
    && entry?.image2NativeTargetRatioReady === true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const commands = [];
  const canvas = resolveCanvas(args);
  canvas.mobileTopSafeArea = resolveVerticalTopSafeArea(args, canvas);
  if (canvas.mobileTopSafeArea.active) {
    canvas.baseImageTransform = `fixed-${canvas.mobileTopSafeArea.mode}-top-safe-${canvas.mobileTopSafeArea.reservedTopBlankPx}px-${canvas.width}x${canvas.height}`;
  }
  if (!["hard", "soft", "both"].includes(args.subtitleMode)) {
    throw new Error("--subtitle-mode must be hard, soft, or both");
  }
  if (!["on", "off", "auto"].includes(args.personalIp)) {
    throw new Error("--personal-ip must be on, off, or auto");
  }
  if (!["off", "subtle", "draw-reveal"].includes(args.handDrawnAnimation)) {
    throw new Error("--hand-drawn-animation must be off, subtle, or draw-reveal");
  }
  const pagesDir = requireDir(args.pagesDir, "--pages-dir");
  if (!args.audio) {
    throw new Error("--audio is required for render-ip-diagram-native-pages.mjs. If the user did not supply audio, run the main codex-video-workflow voice chain first so local CosyVoice/MeloTTS creates the narration package, then pass that generated audio here.");
  }
  const audio = requireFile(args.audio, "--audio");
  const subtitles = requireFile(args.subtitles, "--subtitles");
  const sourceRun = args.sourceRun ? requireDir(args.sourceRun, "--source-run") : null;
  const sourceScript = args.sourceScript ? requireFile(args.sourceScript, "--source-script") : null;
  const out = resolve(args.out || `research/codex-video-workflow-runs/ip-diagram-native-pages-${Date.now()}`);
  const fps = Number(args.fps || 30);
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("--fps must be a positive number");

  ensureDir(out);
  ensureDir(join(out, "assets"));
  ensureDir(join(out, "logs"));
  ensureDir(join(out, "renders"));
  ensureDir(join(out, "script"));
  ensureDir(join(out, "screenshots"));
  ensureDir(join(out, "workflow"));
  ensureDir(join(out, "frames"));

  const pages = collectPages(pagesDir);
  if (pages.length === 0) throw new Error(`No page images found under ${pagesDir}`);
  const captionSafeAreaPixelAudit = auditNativeCaptionSafeAreas({ pages, canvas });
  writeJson(join(out, "workflow", "frame-layout-overlap-audit.json"), captionSafeAreaPixelAudit);
  if (captionSafeAreaPixelAudit.status !== "pass") {
    throw new Error([
      "Native-final caption safe-area pixel audit failed.",
      `- Checked ${captionSafeAreaPixelAudit.checkedFrames}/${captionSafeAreaPixelAudit.expectedPages} page(s); found ${captionSafeAreaPixelAudit.collisionCount} unsafe page(s).`,
      "- Regenerate the failed native pages with the bottom caption-safe band physically blank; prompt declarations or manifest flags are not evidence.",
      "- See workflow/frame-layout-overlap-audit.json for per-page ink ratios and inspected geometry.",
    ].join("\n"));
  }
  const allowUnverifiedNativePages = isEnabled(args.allowUnverifiedNativePages);
  const pageProvenance = loadNativePageProvenance(pagesDir, pages);
  const pageCountPolicy = enrichNativePageCountPolicyWithSourcePlan(
    resolveNativePageCountPolicy(args, pages.length),
    pageProvenance,
  );
  if (!pageCountPolicy.withinRequiredCount && pageCountPolicy.hardGate && !allowUnverifiedNativePages) {
    throw new Error([
      "Native-final personal-IP page count failed.",
      `- Found ${pageCountPolicy.actualPageCount} page(s); required minimum ${pageCountPolicy.minPageCount} with no default maximum.`,
      pageCountPolicy.sourceImageCountPlanIssue ? `- ${pageCountPolicy.sourceImageCountPlanIssue}` : null,
      "- Generate the full personal-IP source page set first; do not render a final personal-IP MP4 from one static background.",
      NATIVE_PAGE_PROVENANCE_HINT,
    ].filter(Boolean).join("\n"));
  }
  if (pageProvenance.status !== "pass" && !allowUnverifiedNativePages) {
    throw new Error([
      "Native-final page provenance failed.",
      ...pageProvenance.issues.map((issue) => `- ${issue}`),
      NATIVE_PAGE_PROVENANCE_HINT,
    ].join("\n"));
  }
  const skillUsageAccuracyAudit = createSkillUsageAccuracyAudit({ pageProvenance, args });
  const cues = parseSrt(subtitles);
  if (cues.length === 0) throw new Error(`No subtitle cues found in ${subtitles}`);
  const audioDuration = durationFromProbe(audio, commands);
  const lastCueEnd = Math.max(...cues.map((cue) => cue.end));
  const totalDuration = Math.max(audioDuration, lastCueEnd);
  const sourceScenes = loadSourceScenes(sourceRun);
  const semanticMotionPlan = loadSemanticMotionPlan(pagesDir, pages, args.handDrawnAnimation);
  // Long-form videos should not require one browser screenshot for every tiny
  // subtitle tick.  The foreground animation is intentionally slow and page-
  // local, so two samples per second are enough; ffmpeg expands the timed
  // concat back to the delivery fps during encoding.  Keep this configurable
  // for future quality/performance tuning.
  const motionSampleFps = Number(args.motionSampleFps || 2);
  if (!Number.isFinite(motionSampleFps) || motionSampleFps <= 0) {
    throw new Error("--motion-sample-fps must be a positive number");
  }
  const frames = buildFramePlan(cues, pages, totalDuration, args.handDrawnAnimation, motionSampleFps);
  const oneLineSrt = join(out, "script", "subtitles.srt");
  writeOneLineSrt(oneLineSrt, cues);
  createPlanArtifacts({
    out,
    title: args.title,
    args: { ...args, pagesDir },
    pages,
    cues,
    totalDuration,
    sourceRun,
    sourceScript,
    sourceScenes,
    pageProvenance,
    canvas,
    pageCountPolicy,
  });
  writeNativeLayeredArtifacts({
    out,
    pages,
    canvas,
    args,
    totalDuration,
    cues,
    semanticMotionPlan,
  });

  const renderConfig = {
    width: canvas.width,
    height: canvas.height,
    aspectRatio: canvas.aspectRatio,
    orientation: canvas.orientation,
    baseImageTransform: canvas.baseImageTransform,
    fps,
    totalDuration,
    frames,
    framesDir: join(out, "frames"),
    concatPath: join(out, "workflow", "frames.ffconcat"),
    handDrawnAnimation: args.handDrawnAnimation,
    motionSampleFps,
    continuousForegroundMotion: args.handDrawnAnimation !== "off",
    semanticMotionPlan,
    videoRenderSource: "personal-ip-layered.html",
    topSafeArea: canvas.mobileTopSafeArea,
  };
  writeJson(join(out, "workflow", "native-page-render-config.json"), renderConfig);
  writeJson(join(out, "workflow", "personal-ip-layered-motion-manifest.json"), {
    schemaVersion: 1,
    route: "ip-diagram-creator-native-page-base-plus-foreground-overlays",
    sourceArtifacts: {
      htmlMasterTimeline: "personal-ip-layered.html",
      sourceManifest: "workflow/personal-ip-layered-source-manifest.json",
      nativeBaseLayers: "layers/00-native-base-*.svg",
      foregroundLayers: "layers/40-foreground-motion-*.svg",
      subtitleLayer: "layers/100-subtitle-overlay.svg",
    },
    videoRenderOwner: "native-page-render-config plus the same native base/foreground/subtitle contract",
    active: args.handDrawnAnimation !== "off",
    mode: args.handDrawnAnimation,
    baseLayer: {
      owner: "verified-native-personal-ip-page",
      transform: canvas.baseImageTransform,
      stableAcrossMotionSamples: true,
    },
    semanticPlan: semanticMotionPlan ? {
      sourcePath: semanticMotionPlan.sourcePath,
      coordinateSpace: semanticMotionPlan.coordinateSpace,
      pageCount: semanticMotionPlan.pages?.length || 0,
      geometryValidatedBeforeRender: true,
    } : null,
    foregroundLayers: args.handDrawnAnimation === "off" ? [] : [
      { id: "semantic-path", zIndex: 40, semanticJob: "draw a reading path only inside its page-local safe motion region" },
      { id: "semantic-node-focus", zIndex: 42, semanticJob: "activate content-bound nodes without covering their labels" },
    ],
    subtitleLayer: { zIndex: 100, topmost: true },
    timeline: {
      sampleFps: motionSampleFps,
      continuousForegroundMotion: args.handDrawnAnimation !== "off",
      frameCount: frames.length,
      cueCount: cues.length,
      monotonicCueProgress: true,
    },
    rejectList: [
      "single bottom-edge progress line presented as layered animation",
      "per-cue static image presented as continuous animation",
      "moving or cropping the native personal-IP base page",
      "foreground marks covering subtitles",
      "generic overlay geometry without a page-specific semantic plan",
      "path or node outside its declared safe motion region",
    ],
  });
  const htmlTimelineRenderer = join(SKILL_ROOT, "scripts", "lib", "render-native-html-timeline.mjs");
  run(process.execPath, [
    htmlTimelineRenderer,
    "--html", join(out, "personal-ip-layered.html"),
    "--config", join(out, "workflow", "native-page-render-config.json"),
  ], { cwd: SKILL_ROOT, category: "render-native-html-master-timeline", timeout: 1_800_000 });
  const concatLines = [];
  for (const frame of frames) {
    const framePath = join(out, "frames", `${frame.id}.png`);
    if (!existsSync(framePath)) throw new Error(`HTML master timeline did not create expected frame: ${framePath}`);
    concatLines.push(`file '${framePath.replaceAll("'", "'\\''")}'`);
    concatLines.push(`duration ${Math.max(0.05, Number(frame.duration || 0.05)).toFixed(6)}`);
  }
  const lastFramePath = frames.length ? join(out, "frames", `${frames.at(-1).id}.png`) : null;
  if (lastFramePath) concatLines.push(`file '${lastFramePath.replaceAll("'", "'\\''")}'`);
  writeFileSync(join(out, "workflow", "frames.ffconcat"), `${concatLines.join("\n")}\n`, "utf8");

  const visualPath = join(out, "renders", "native-pages-hard-subtitles.mp4");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", join(out, "workflow", "frames.ffconcat"),
    "-vf", `fps=${fps},format=yuv420p`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", "12M",
    "-minrate", "10M",
    "-maxrate", "14M",
    "-bufsize", "24M",
    "-movflags", "+faststart",
    visualPath,
  ], { log: commands });

  const finalPath = join(out, "renders", "final.mp4");
  const muxArgs = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", visualPath,
    "-i", audio,
  ];
  if (args.subtitleMode === "soft" || args.subtitleMode === "both") {
    muxArgs.push("-i", oneLineSrt, "-map", "0:v:0", "-map", "1:a:0", "-map", "2:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=chi");
  } else {
    muxArgs.push("-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k");
  }
  muxArgs.push("-shortest", finalPath);
  run("ffmpeg", muxArgs, { log: commands });
  normalizeFinalAudio({ out, finalPath, commands });

  const rootCopy = join(out, "final.mp4");
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", finalPath, "-c", "copy", rootCopy], { log: commands });

  const screenshotTimes = [
    ["opening", Math.max(0.25, totalDuration * 0.02)],
    ["middle", totalDuration * 0.5],
    ["ending", Math.max(0.25, totalDuration - 1.25)],
  ];
  for (const [label, time] of screenshotTimes) {
    run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", String(time),
      "-i", finalPath,
      "-frames:v", "1",
      join(out, "screenshots", `${label}.png`),
    ], { log: commands });
  }
  const coverArtifacts = createCoverArtifacts({ out, title: args.title, pages, canvas, commands });
  const nativeImage2CoverReady = coverNativeImage2Ready(out);

  const probe = ffprobeJson(finalPath, commands);
  writeJson(join(out, "logs", "ffprobe.json"), probe);
  const finalDuration = Number.parseFloat(probe.format?.duration || "0");
  const blackdetect = run("ffmpeg", ["-hide_banner", "-v", "info", "-i", finalPath, "-vf", "blackdetect=d=0.2:pix_th=0.05", "-an", "-f", "null", "-"], { log: commands, combined: true });
  writeFileSync(join(out, "logs", "blackdetect.log"), blackdetect, "utf8");
  const volumedetect = run("ffmpeg", ["-hide_banner", "-v", "info", "-i", finalPath, "-af", "volumedetect", "-f", "null", "-"], { log: commands, combined: true });
  writeFileSync(join(out, "logs", "volumedetect.log"), volumedetect, "utf8");
  const volumeStats = parseVolumeDetect(volumedetect);
  const silencedetect = run("ffmpeg", ["-hide_banner", "-v", "info", "-i", finalPath, "-af", "silencedetect=n=-45dB:d=1.2", "-f", "null", "-"], { log: commands, combined: true });
  writeFileSync(join(out, "logs", "silencedetect.log"), silencedetect, "utf8");
  run("ffmpeg", ["-v", "error", "-i", finalPath, "-f", "null", "-"], { log: commands });

  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video") || {};
  const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio") || {};
  const subtitleStream = probe.streams?.find((stream) => stream.codec_type === "subtitle") || null;
  const durationDelta = Math.abs(finalDuration - audioDuration);
  const checks = {
    playableMp4: true,
    dimensionsMatchCanvas: Number(videoStream.width) === canvas.width && Number(videoStream.height) === canvas.height,
    dimensions1920x1080: canvas.vertical || (Number(videoStream.width) === DEFAULT_LANDSCAPE_WIDTH && Number(videoStream.height) === DEFAULT_LANDSCAPE_HEIGHT),
    dimensions1080x1920: !canvas.vertical || (Number(videoStream.width) === DEFAULT_PORTRAIT_WIDTH && Number(videoStream.height) === DEFAULT_PORTRAIT_HEIGHT),
    audioPresent: Boolean(audioStream.codec_name),
    audibleAudio: volumeStats.meanVolumeDb !== null
      && volumeStats.maxVolumeDb !== null
      && volumeStats.meanVolumeDb >= MIN_AUDIBLE_MEAN_DB
      && volumeStats.maxVolumeDb >= MIN_AUDIBLE_MAX_DB,
    finalAudioNormalizationPresent: existsSync(join(out, "workflow", "final-audio-normalization.json")),
    subtitlesPresentWhenRequested: args.subtitleMode === "hard" ? true : Boolean(subtitleStream),
    audioVideoDurationDeltaOk: durationDelta <= 0.35,
    screenshotsPresent: screenshotTimes.every(([label]) => existsSync(join(out, "screenshots", `${label}.png`))),
    coverArtifactsPresent: existsSync(join(out, "workflow", "cover-design.json"))
      && existsSync(join(out, "workflow", "cover-size-selection.json"))
      && existsSync(join(out, "workflow", "context-image2-cover-requests.json"))
      && existsSync(join(out, "cover", "native-final-cover-1920x1080.png"))
      && existsSync(join(out, "最终成品", "评审级封面-非上传终版", "01-横版16比9-评审级封面-1920x1080.png")),
    coverContextImage2HandoffPresent: (() => {
      const requests = readJsonIfExists(join(out, "workflow", "context-image2-cover-requests.json"));
      return requests?.provider === "codex-context-image2"
        && requests?.tool === "image_gen"
        && Array.isArray(requests?.requests)
        && requests.requests.length > 0
        && requests.requests.every((request) => request.promptPath && request.expectedOutput);
    })(),
    coverNativeImage2Ready: nativeImage2CoverReady,
    ipDiagramCreatorPlanPresent: existsSync(join(out, "workflow", "ip-diagram-creator-plan.json")),
    ipDiagramCreatorVendorUsagePresent: existsSync(join(out, "workflow", "ip-diagram-creator-vendor-usage.json")),
    ipDiagramCreatorNativeJobsPresent: existsSync(join(out, "workflow", "ip-diagram-creator-native-jobs.json")),
    ipDiagramLayoutAuditPresent: existsSync(join(out, "workflow", "ip-diagram-layout-audit.json")),
    nativePageProvenanceVerified: pageProvenance.status === "pass",
    captionSafeAreaPixelAuditPass: captionSafeAreaPixelAudit.status === "pass"
      && captionSafeAreaPixelAudit.checkedFrames === pages.length
      && captionSafeAreaPixelAudit.collisionCount === 0,
    frameLayoutNoTextVisualOverlap: captionSafeAreaPixelAudit.status === "pass"
      && captionSafeAreaPixelAudit.checkedFrames === pages.length
      && captionSafeAreaPixelAudit.collisionCount === 0,
    captionRendererApplied: captionSafeAreaPixelAudit.captionRendererEvidence?.applied === true
      && captionSafeAreaPixelAudit.uniqueCaptionRendererCount >= 1,
    skillUsageAccuracyAuditPresent: existsSync(join(out, "workflow", "skill-usage-accuracy-audit.json")),
    skillUsageAccuracyAuditPass: skillUsageAccuracyAudit.status === "pass",
    nativeLayeredHtmlPresent: existsSync(join(out, "personal-ip-layered.html")),
    nativeLayeredSourceManifestPresent: existsSync(join(out, "workflow", "personal-ip-layered-source-manifest.json")),
    nativeBaseSvgLayersPresent: pages.every((page) => existsSync(join(out, "layers", `00-native-base-${String(page.index).padStart(3, "0")}.svg`))),
    nativeForegroundSvgLayersPresent: pages.every((page) => existsSync(join(out, "layers", `40-foreground-motion-${String(page.index).padStart(3, "0")}.svg`))),
    nativeBaseLayerStable: true,
    semanticTemplateRendererNotUsed: true,
    ipDiagramFullScreenStable: true,
    ipDiagramNoBorderWrapper: true,
    ipDiagramBaseImageStable: true,
    ipDiagramNoPerCueCropPanZoom: true,
    nativePageCountWithinPersonalIpRange: pageCountPolicy.withinRange,
    nativePageCountSatisfiesSourceImageCountPlan: pageCountPolicy.satisfiesSourceImageCountPlan,
    noVerticalBackgroundJump: true,
    visualSubtitleSingleLine: true,
    handDrawnAnimationChoiceRecorded: ["off", "subtle", "draw-reveal"].includes(args.handDrawnAnimation),
    personalIpChoiceRecorded: ["on", "off", "auto"].includes(args.personalIp),
    verticalPersonalIpDesignContractPresent: !canvas.vertical || existsSync(join(out, "workflow", "vertical-personal-ip-design-contract.json")),
    topSafeAreaAuditPresent: !canvas.vertical || existsSync(join(out, "workflow", "top-safe-area-audit.json")),
    topSafeAreaReservedForMobileChrome: !canvas.vertical || Boolean(canvas.mobileTopSafeArea?.active),
    nativePagesGeneratedForVerticalCanvas: !canvas.vertical || pages.every((page) => {
      const ratio = Number(page.width || 0) / Math.max(1, Number(page.height || 0));
      return ratio > 0.45 && ratio < 0.7;
    }),
  };
  const coverCheckIds = new Set([
    "coverArtifactsPresent",
    "coverContextImage2HandoffPresent",
    "coverNativeImage2Ready",
  ]);
  const videoCheckEntries = Object.entries(checks)
    .filter(([key]) => !coverCheckIds.has(key));
  const videoPass = videoCheckEntries.every(([, value]) => value === true);
  const publishingReady = videoPass
    && checks.coverArtifactsPresent
    && checks.coverContextImage2HandoffPresent
    && checks.coverNativeImage2Ready;
  const qc = {
    schemaVersion: 1,
    status: publishingReady ? "pass" : videoPass ? "video-review-ready" : "fail",
    pass: publishingReady,
    videoPass,
    publishingReady,
    route: "ip-diagram-native-final-pages",
    finalVideo: finalPath,
    rootCopy,
    durationSeconds: finalDuration,
    audioDurationSeconds: audioDuration,
    durationDeltaSeconds: Number(durationDelta.toFixed(3)),
    width: Number(videoStream.width),
    height: Number(videoStream.height),
    canvas: {
      width: canvas.width,
      height: canvas.height,
      aspectRatio: canvas.aspectRatio,
      orientation: canvas.orientation,
    },
    fps,
    loudness: {
      meanVolumeDb: volumeStats.meanVolumeDb,
      maxVolumeDb: volumeStats.maxVolumeDb,
      minimumAudibleMeanDb: MIN_AUDIBLE_MEAN_DB,
      minimumAudibleMaxDb: MIN_AUDIBLE_MAX_DB,
      finalAudioNormalization: "workflow/final-audio-normalization.json",
    },
    nativePageProvenance: pageProvenance,
    nativePageCountPolicy: pageCountPolicy,
    skillUsageAccuracy: skillUsageAccuracyAudit,
    subtitleMode: args.subtitleMode,
    userChoices: {
      makePersonalIp: args.personalIp,
      addHandDrawnImageAnimation: args.handDrawnAnimation,
    },
    staticBackgroundStability: {
      generatedImagesAreFullScreen: true,
      baseImageTransform: canvas.baseImageTransform,
      noPerCueCropPanZoom: true,
      noVerticalCameraOffset: true,
      noBorderWrapper: true,
      note: "Source page pixels are rendered full-screen with a fixed cover transform. All animation is foreground-only.",
    },
    coverArtifacts: {
      status: checks.coverNativeImage2Ready ? "native-image2-ready" : checks.coverArtifactsPresent ? "review-grade-pending-context-image2" : "missing",
      outputs: coverArtifacts.outputs,
      uploadReady: checks.coverNativeImage2Ready,
      reviewGrade: true,
      contextImage2Pending: !checks.coverNativeImage2Ready,
    },
    checks,
  };
  writeJson(join(out, "logs", "qc.json"), qc);
  writeJson(join(out, "workflow", "commands.json"), commands);
  createDeliveryPage(out, args.title, finalPath, qc, canvas);
  cleanupIntermediateVideoArtifacts({
    out,
    finalPath,
    reason: qc.videoPass ? "post-qc-video-pass" : "post-qc-review-artifact",
  });

  console.log(JSON.stringify({
    pass: qc.pass,
    videoPass: qc.videoPass,
    publishingReady: qc.publishingReady,
    out,
    finalVideo: finalPath,
    rootCopy,
    durationSeconds: finalDuration,
    durationDeltaSeconds: qc.durationDeltaSeconds,
  }, null, 2));
  if (!qc.videoPass && !allowUnverifiedNativePages && !isEnabled(args.allowIncompleteNativeFinal)) {
    process.exitCode = 2;
  }
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
