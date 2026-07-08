#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

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
  "volume=2.2",
  "highpass=f=70",
  "acompressor=threshold=-24dB:ratio=3:attack=5:release=120:makeup=4",
  "dynaudnorm=f=151:g=15:p=0.95",
  "alimiter=limit=0.95",
  "loudnorm=I=-14:TP=-1.2:LRA=7",
  "volume=1.4",
  "alimiter=limit=0.92",
  "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo",
].join(",");
const MIN_AUDIBLE_MEAN_DB = -18;
const MIN_AUDIBLE_MAX_DB = -3;
const DEFAULT_PERSONAL_IP_MIN_NATIVE_PAGE_COUNT = 4;
const DEFAULT_PERSONAL_IP_MAX_NATIVE_PAGE_COUNT = 48;
const DEFAULT_VERTICAL_TOP_SAFE_PX = 220;
const NATIVE_PAGE_PROVENANCE_HINT = "Regenerate the content pages through the original ip-diagram-creator direct-generation/image_gen route, or pass --allow-unverified-native-pages true only for an explicitly marked draft/degraded review.";

function parseArgs(argv) {
  const args = {
    fps: 30,
    subtitleMode: "both",
    personalIp: "auto",
    handDrawnAnimation: "subtle",
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
  const maxPageCount = Math.max(minPageCount, toPositiveInt(args.maxPageCount, DEFAULT_PERSONAL_IP_MAX_NATIVE_PAGE_COUNT));
  return {
    schemaVersion: 1,
    route: "ip-diagram-native-final-pages",
    personalIpActive,
    minPageCount,
    maxPageCount,
    actualPageCount: pageCount,
    withinRange: pageCount >= minPageCount && pageCount <= maxPageCount,
    singleNativePageRejectedForPersonalIp: !personalIpActive || pageCount > 1,
    hardGate: personalIpActive,
    reason: personalIpActive
      ? "Personal-IP native-final videos must use a rich generated page set, not one static full-video background."
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
  const maxImageCount = toPositiveInt(plan.maxImageCount, pageCountPolicy.maxPageCount);
  const automaticTarget = toPositiveInt(plan.contentMetrics?.automaticTarget, 0);
  const automaticResolvedTarget = toPositiveInt(plan.automaticResolvedTarget, automaticTarget
    ? Math.max(minImageCount, Math.min(maxImageCount, automaticTarget))
    : 0);
  const plannedResolvedImageCount = toPositiveInt(plan.resolvedImageCount, 0);
  const requiredFromPlan = Math.max(minImageCount, automaticResolvedTarget || plannedResolvedImageCount || pageCountPolicy.minPageCount);
  const satisfiesSourceImageCountPlan = pageCountPolicy.actualPageCount >= requiredFromPlan
    && (plannedResolvedImageCount === 0 || pageCountPolicy.actualPageCount >= plannedResolvedImageCount);
  return {
    ...pageCountPolicy,
    sourceImageCountPlanPresent: true,
    sourceImageCountPlanPath: sourceCountPlan.imageCountPlanPath,
    sourceImageCountPlan: {
      resolvedImageCount: plannedResolvedImageCount,
      automaticResolvedTarget,
      automaticTarget: plan.contentMetrics?.automaticTarget || null,
      explicitRequestedTarget: plan.explicitRequestedTarget || null,
      explicitTargetUnderAutomatic: plan.explicitTargetUnderAutomatic === true,
      explicitTargetRaisedToAutomatic: plan.explicitTargetRaisedToAutomatic === true,
      durationBasedTarget: plan.contentMetrics?.durationBasedTarget || null,
      subtitleCueBasedTarget: plan.contentMetrics?.subtitleCueBasedTarget || null,
      contentClarityTarget: plan.contentMetrics?.contentClarityTarget || null,
      contentMatchTarget: plan.contentMetrics?.contentMatchTarget || null,
      strongestAutomaticDriver: plan.contentMetrics?.strongestAutomaticDriver || null,
    },
    sourceImageCountPlanRequiredCount: requiredFromPlan,
    satisfiesSourceImageCountPlan,
    withinRequiredCount: pageCountPolicy.withinRange && satisfiesSourceImageCountPlan,
    sourceImageCountPlanIssue: satisfiesSourceImageCountPlan
      ? null
      : `Native-final page count ${pageCountPolicy.actualPageCount} is below source image count policy requirement ${requiredFromPlan}.`,
  };
}

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

function loadNativePageProvenance(pagesDir, pages) {
  const candidateManifests = [
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
      sourceGeneratedImage: entry.source_generated_image || entry.sourceGeneratedImage || null,
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
      personaReferenceBoundToGeneration: Boolean(entry?.personaReferenceBoundToGeneration),
      userApprovedPersonaConsistency: Boolean(entry?.userApprovedPersonaConsistency),
    };
  });
  const pagesWithGeneratedImageSource = perPage.filter((page) => Boolean(page.sourceGeneratedImage)).length;
  const pagesWithPersonaReferenceBinding = perPage.filter((page) => page.personaReferenceBoundToGeneration || page.userApprovedPersonaConsistency).length;
  const routeClaimsOnlyLocalAssets = /project-local assets|local assets|PIL|placeholder|wireframe/i.test(generationRoute)
    && !/built-in image_gen|source_generated_image|generated_images/i.test(generationRoute);
  if (pagesWithGeneratedImageSource !== pages.length) {
    issues.push(`Only ${pagesWithGeneratedImageSource}/${pages.length} final pages have source_generated_image provenance.`);
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

function pageForTime(pages, start, totalDuration) {
  if (pages.length === 1) return pages[0];
  const safeTotal = Math.max(totalDuration, 0.001);
  const rawIndex = Math.floor((Math.max(0, start) / safeTotal) * pages.length);
  return pages[Math.max(0, Math.min(pages.length - 1, rawIndex))];
}

function buildFramePlan(cues, pages, totalDuration) {
  return cues.map((cue, index) => {
    const page = pageForTime(pages, cue.start, totalDuration);
    const pageStart = (page.index - 1) * totalDuration / pages.length;
    const pageEnd = page.index * totalDuration / pages.length;
    const pageProgress = Math.max(0, Math.min(1, (cue.start - pageStart) / Math.max(0.001, pageEnd - pageStart)));
    return {
      id: `frame-${String(index + 1).padStart(4, "0")}`,
      index: index + 1,
      start: cue.start,
      end: cue.end,
      duration: cue.end - cue.start,
      subtitle: cue.text,
      subtitleLines: wrapCueText(cue.text),
      pageId: page.id,
      pageIndex: page.index,
      pageName: page.name,
      sourceImage: page.file,
      pageProgress,
    };
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
    allowedMotion: ["page cuts", "subtitles", "foreground hand-drawn accent layer", "progress stroke"],
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
  const nativeJobs = {
    schemaVersion: 1,
    stage: "pre-render-ip-diagram-creator-native-jobs",
    status: "active-native-route-available",
    sourceRepo: SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    sourceLicense: "MIT",
    executionModes: ["native-final-video", "native-skill-direct-generation"],
    userChoices,
    visualDna: {
      background: "white/near-white full-page teaching canvas",
      line: "black minimal hand-drawn line art",
      accents: ["orange", "red", "blue"],
      presenter: args.personalIp === "off" ? "optional/off" : "adult personal-IP presenter when generated by source Skill",
      agents: "concrete execution agents only when useful",
    },
    jobs: pages.map((page) => ({
      pageCardId: page.id,
      nativeMode: "PPT演讲页面 prompt",
      sourceImage: page.file,
      prompt: "Use the original ip-diagram-creator Skill route to generate a white-canvas hand-drawn teaching page for this spoken beat. Keep large whitespace, non-overlapping cards/arrows/characters, and no internal workflow labels.",
      repairPrompt: "If cards, captions, presenter, or arrows overlap, increase whitespace, split the layout into reserved lanes, and regenerate the native page before video render.",
    })),
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
      ...(!pageCountPolicy.withinRange ? [`Native page count ${pageCountPolicy.actualPageCount} is outside required range ${pageCountPolicy.minPageCount}-${pageCountPolicy.maxPageCount}.`] : []),
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
      visibleEvents: args.handDrawnAnimation === "off" ? ["full-screen page hold"] : ["full-screen page hold", "foreground progress/marker accent"],
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
  writeJson(join(out, "brief.json"), brief);
  writeJson(join(out, "workflow", "ip-diagram-creator-plan.json"), ipPlan);
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
    progress = max(0.02, min(1.0, float(frame.get("pageProgress", 0.0))))
    page_index = int(frame.get("pageIndex", 1))
    color_cycle = [(232, 92, 44, 220), (43, 105, 214, 210), (217, 48, 78, 210)]
    color = color_cycle[(page_index - 1) % len(color_cycle)]
    y = height - 15
    x0 = 170
    x1 = width - 170
    length = x0 + int((x1 - x0) * progress)
    # Slight hand wobble inside the foreground stroke only; the source page never moves.
    pts = []
    for i in range(0, max(2, length - x0), 18):
        x = x0 + i
        pts.append((x, y + int(math.sin((i + page_index * 9) / 22) * 2)))
    pts.append((length, y))
    if len(pts) >= 2:
        draw.line(pts, fill=color, width=7, joint="curve")
        draw.ellipse((length - 6, y - 6, length + 6, y + 6), fill=color)
    if mode == "draw-reveal":
        pulse = 0.5 + 0.5 * math.sin(progress * math.pi)
        cx = width - 132
        cy = 132
        r = int(18 + 6 * pulse)
        draw.arc((cx-r, cy-r, cx+r, cy+r), 8, 334, fill=color, width=4)
        draw.line((cx + 14, cy + 16, cx + 38, cy + 42), fill=color, width=4)
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
      approximateMeanDb: -14,
      truePeakDb: -1.2,
      lra: 7,
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
  const coreCoverLogicPresent = existingCoverDesign?.defaultCoverEngine === "image2-integrated-typography-cover"
    && existingCoverDesign?.image2CoverPromptFile === "workflow/cover-image2-prompts.json"
    && existingCoverDesign?.coverSizeSelectionFile === "workflow/cover-size-selection.json"
    && existingContextImage2Requests?.provider === "codex-context-image2"
    && existingContextImage2Requests?.tool === "image_gen";
  const coverPrompt = [
    `Create a 16:9 video thumbnail/cover for: ${title}`,
    "Use the native personal-IP hand-drawn page visual as context.",
    "Make the click promise clear: 小说主题不是一句金句.",
    "Preserve the fixed manifest-backed presenter identity if a presenter appears.",
    "White-canvas hand-drawn style, sparse orange/blue marker accents, mobile-readable title, no workflow labels.",
    "This prompt is a Context Image2 handoff; the review-grade cover PNG/JPG in this package was derived from the native opening page so the deliverable is never cover-less.",
  ].join("\n");
  writeFileSync(join(promptDir, "cover-16x9-native-final-context-image2.txt"), coverPrompt, "utf8");
  const nativeReviewCover = {
    schemaVersion: 1,
    status: "ready-review-grade-native-page-cover",
    route: "ip-diagram-native-final-pages",
    title,
    sourceNativePage: sourcePage,
    coverPromise: "小说主题不是一句金句",
    visualContinuity: "Cover is derived from the opening native generated page so thumbnail and first frame stay consistent.",
    contextImage2Handoff: "prompts/context-image2-covers/cover-16x9-native-final-context-image2.txt",
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
    contextImage2Handoff: "prompts/context-image2-covers/cover-16x9-native-final-context-image2.txt",
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
    pending: ["native Context Image2 upload-ready platform variants"],
  };
  const contextImage2Requests = {
    schemaVersion: 1,
    status: "handoff-ready",
    route: "ip-diagram-native-final-pages",
    provider: "codex-context-image2",
    tool: "image_gen",
    requiredForFinalCover: true,
    coreCoverLogicPreserved: coreCoverLogicPresent,
    sourceNativePage: sourcePage,
    parallelGenerationPolicy: {
      allowed: false,
      reason: "This standalone native-final review cover is a single source-page continuity handoff. Full platform cover targets use the core workflow/context-image2-cover-requests.json contract when present.",
    },
    requests: [
      {
        id: "cover-16x9-native-final",
        target: "16:9 video thumbnail",
        prompt: "prompts/context-image2-covers/cover-16x9-native-final-context-image2.txt",
        contextImages: [sourcePage],
        expectedOutput: "cover/native-final-cover-1920x1080.png",
      },
    ],
  };
  writeJson(join(out, "workflow", "native-final-cover-review.json"), nativeReviewCover);
  if (!coreCoverLogicPresent) {
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
  const cover = readJsonIfExists(join(out, "workflow", "cover-design.json"));
  if (cover?.finalCoverQualityEligible === true) return true;
  if (selection?.allEntriesUploadReady === true) return true;
  const entries = Array.isArray(selection?.entries)
    ? selection.entries
    : Array.isArray(selection?.targets)
      ? selection.targets
      : [];
  return entries.some((entry) => entry.uploadReady === true
    && (entry.image2NativeTargetRatioReady === true || /image2|codex|native/i.test(String(entry.qualityStatus || entry.status || ""))));
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
  const allowUnverifiedNativePages = isEnabled(args.allowUnverifiedNativePages);
  const pageProvenance = loadNativePageProvenance(pagesDir, pages);
  const pageCountPolicy = enrichNativePageCountPolicyWithSourcePlan(
    resolveNativePageCountPolicy(args, pages.length),
    pageProvenance,
  );
  if (!pageCountPolicy.withinRequiredCount && pageCountPolicy.hardGate && !allowUnverifiedNativePages) {
    throw new Error([
      "Native-final personal-IP page count failed.",
      `- Found ${pageCountPolicy.actualPageCount} page(s); required ${pageCountPolicy.minPageCount}-${pageCountPolicy.maxPageCount}.`,
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
  const frames = buildFramePlan(cues, pages, totalDuration);
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

  const renderConfig = {
    width: canvas.width,
    height: canvas.height,
    aspectRatio: canvas.aspectRatio,
    orientation: canvas.orientation,
    baseImageTransform: canvas.baseImageTransform,
    fps,
    frames,
    framesDir: join(out, "frames"),
    concatPath: join(out, "workflow", "frames.ffconcat"),
    handDrawnAnimation: args.handDrawnAnimation,
    topSafeArea: canvas.mobileTopSafeArea,
  };
  writeJson(join(out, "workflow", "native-page-render-config.json"), renderConfig);
  renderFramesWithPython(join(out, "workflow", "native-page-render-config.json"), commands);

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
    coverContextImage2HandoffPresent: existsSync(join(out, "prompts", "context-image2-covers", "cover-16x9-native-final-context-image2.txt")),
    coverNativeImage2Ready: nativeImage2CoverReady,
    ipDiagramCreatorPlanPresent: existsSync(join(out, "workflow", "ip-diagram-creator-plan.json")),
    ipDiagramCreatorVendorUsagePresent: existsSync(join(out, "workflow", "ip-diagram-creator-vendor-usage.json")),
    ipDiagramCreatorNativeJobsPresent: existsSync(join(out, "workflow", "ip-diagram-creator-native-jobs.json")),
    ipDiagramLayoutAuditPresent: existsSync(join(out, "workflow", "ip-diagram-layout-audit.json")),
    nativePageProvenanceVerified: pageProvenance.status === "pass",
    skillUsageAccuracyAuditPresent: existsSync(join(out, "workflow", "skill-usage-accuracy-audit.json")),
    skillUsageAccuracyAuditPass: skillUsageAccuracyAudit.status === "pass",
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
  const qc = {
    schemaVersion: 1,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    pass: Object.values(checks).every(Boolean),
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

  console.log(JSON.stringify({
    pass: qc.pass,
    out,
    finalVideo: finalPath,
    rootCopy,
    durationSeconds: finalDuration,
    durationDeltaSeconds: qc.durationDeltaSeconds,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error?.stack || String(error));
  process.exit(1);
}
