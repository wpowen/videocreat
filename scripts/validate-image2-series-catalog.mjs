#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CATALOG_PATH = join(SKILL_ROOT, "assets", "gpt-image-2-visual-series-catalog.json");
const VALID_ASPECTS = new Set(["9:16", "16:9"]);
const VALID_SERIES_STATUS = new Set(["candidate", "approved"]);
const REQUIRED_SERIES_FIELDS = [
  "seriesId",
  "name",
  "status",
  "axes",
  "appliesTo",
  "plannerGuidance",
  "routing",
  "aspects",
  "defaultTextPolicy",
  "supportedTextPolicies",
  "styleDna",
  "styleSpec",
  "promptSkeleton",
  "dynamicSlots",
  "pageRoles",
  "qcChecklist",
];
const REQUIRED_SKELETON_FIELDS = ["positioning", "moduleChecklist", "visualRequirements", "negativeConstraints"];
const REQUIRED_STYLESPEC_FIELDS = ["renderingMedium", "background", "accent", "iconAndDetailStyle", "paletteRule"];
// Rights-unsafe tokens that must never appear in distilled series definitions.
const RIGHTS_UNSAFE_TOKENS = [
  "ghibli", "吉卜力", "disney", "迪士尼", "pixar", "皮克斯", "netflix", "pokemon", "宝可梦",
  "nintendo", "任天堂", "gta", "tiktok", "抖音", "小红书", "xiaohongshu", "instagram",
  "youtube", "wechat", "微信", "altman", "奥特曼", "musk", "马斯克", "irasutoya", "いらすとや",
  "starbucks", "星巴克", "apple inc", "iphone", "coca-cola", "可口可乐",
];

function parseArgs(argv) {
  const args = { catalog: DEFAULT_CATALOG_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--help" || item === "-h") args.help = true;
    else if (item === "--catalog") {
      args.catalog = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Unexpected argument: ${item}`);
    }
  }
  return args;
}

function collectSeriesText(series) {
  const skeleton = series.promptSkeleton || {};
  return [
    series.styleDna,
    series.plannerGuidance,
    skeleton.positioning,
    skeleton.visualRequirements,
    ...(Array.isArray(skeleton.moduleChecklist) ? skeleton.moduleChecklist : []),
    ...(Array.isArray(skeleton.negativeConstraints) ? skeleton.negativeConstraints : []),
    ...Object.values(series.toneVariants || {}),
    ...Object.values(series.styleSpec || {}),
  ].filter(Boolean).join("\n").toLowerCase();
}

function validateSeries(series, index, catalog, issues) {
  const label = series.seriesId || `series[${index}]`;
  for (const field of REQUIRED_SERIES_FIELDS) {
    const value = series[field];
    const missing = value === undefined || value === null || value === ""
      || (Array.isArray(value) && value.length === 0);
    if (missing) issues.push(`${label}: missing or empty required field "${field}"`);
  }
  if (series.status && !VALID_SERIES_STATUS.has(series.status)) {
    issues.push(`${label}: invalid status "${series.status}" (expected candidate|approved)`);
  }
  for (const aspect of series.aspects || []) {
    if (!VALID_ASPECTS.has(aspect)) issues.push(`${label}: invalid aspect "${aspect}"`);
  }
  const catalogPolicies = Object.keys(catalog.textPolicies || {});
  for (const policy of series.supportedTextPolicies || []) {
    if (!catalogPolicies.includes(policy)) {
      issues.push(`${label}: supported text policy "${policy}" is not defined in catalog.textPolicies`);
    }
  }
  if (series.defaultTextPolicy && !(series.supportedTextPolicies || []).includes(series.defaultTextPolicy)) {
    issues.push(`${label}: defaultTextPolicy "${series.defaultTextPolicy}" is not in supportedTextPolicies`);
  }
  if (series.defaultTextPolicy !== "text-safe") {
    issues.push(`${label}: defaultTextPolicy must be text-safe; integrated-chinese is opt-in only`);
  }
  const routing = series.routing;
  if (!routing || typeof routing !== "object" || Array.isArray(routing)) {
    issues.push(`${label}: routing must be an object`);
  } else {
    if (!Array.isArray(routing.scope) || routing.scope.length === 0) issues.push(`${label}: routing.scope is required`);
    if (!Array.isArray(routing.intents) || routing.intents.length === 0) issues.push(`${label}: routing.intents is required`);
    if (!Array.isArray(routing.requiredAny) || routing.requiredAny.length === 0) issues.push(`${label}: routing.requiredAny is required`);
    if (!Array.isArray(routing.negativeSignals)) issues.push(`${label}: routing.negativeSignals must be an array`);
    if (!Number.isFinite(Number(routing.priority))) issues.push(`${label}: routing.priority must be numeric`);
    if (!["primary-content-series", "accent-series"].includes(routing.kind)) issues.push(`${label}: routing.kind is invalid`);
  }
  const skeleton = series.promptSkeleton || {};
  for (const field of REQUIRED_SKELETON_FIELDS) {
    const value = skeleton[field];
    const missing = value === undefined || value === null || value === ""
      || (Array.isArray(value) && value.length === 0);
    if (missing) issues.push(`${label}: promptSkeleton missing or empty "${field}"`);
  }
  const styleSpec = series.styleSpec;
  if (!styleSpec || typeof styleSpec !== "object" || Array.isArray(styleSpec)) {
    issues.push(`${label}: styleSpec must be an object with the executable style lock fields`);
  } else {
    for (const field of REQUIRED_STYLESPEC_FIELDS) {
      if (!styleSpec[field] || String(styleSpec[field]).trim() === "") {
        issues.push(`${label}: styleSpec missing or empty "${field}"`);
      }
    }
    if (styleSpec.renderingMedium && !/never/i.test(styleSpec.renderingMedium)) {
      issues.push(`${label}: styleSpec.renderingMedium should name the excluded mediums (use "never ...") so the lock is enforceable`);
    }
  }
  if (Array.isArray(skeleton.negativeConstraints) && skeleton.negativeConstraints.length < 2) {
    issues.push(`${label}: promptSkeleton.negativeConstraints needs at least 2 entries`);
  }
  if (Array.isArray(series.pageRoles) && series.pageRoles.length < 4) {
    issues.push(`${label}: pageRoles needs at least 4 entries to support multi-page sets`);
  }
  const text = collectSeriesText(series);
  for (const token of RIGHTS_UNSAFE_TOKENS) {
    if (text.includes(token)) issues.push(`${label}: rights-unsafe token "${token}" found in series definition`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/validate-image2-series-catalog.mjs [--catalog <path>]");
    process.exit(0);
  }
  const catalogPath = resolve(args.catalog);
  const issues = [];
  if (!existsSync(catalogPath)) {
    issues.push(`Catalog not found: ${catalogPath}`);
  }
  let catalog = null;
  if (issues.length === 0) {
    try {
      catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    } catch (error) {
      issues.push(`Catalog is not valid JSON: ${error.message}`);
    }
  }
  if (catalog) {
    if (catalog.schemaVersion !== 1) issues.push(`Unexpected schemaVersion: ${catalog.schemaVersion}`);
    if (!catalog.designPhilosophy?.personalIpBoundary) {
      issues.push("designPhilosophy.personalIpBoundary is required: the catalog must state that the personal-IP route is untouched");
    }
    if (!Array.isArray(catalog.methodSources) || catalog.methodSources.length === 0) {
      issues.push("methodSources must list the distillation sources with usage boundaries");
    }
    if (!catalog.textPolicies?.["text-safe"] || !catalog.textPolicies?.["integrated-chinese"]) {
      issues.push("textPolicies must define both text-safe and integrated-chinese");
    }
    if (!catalog.sharedContract?.subtitleSafeBand) issues.push("sharedContract.subtitleSafeBand is required");
    if (catalog.routingContract?.defaultTextPolicy !== "text-safe") issues.push("routingContract.defaultTextPolicy must be text-safe");
    if (!catalog.routingContract?.thresholds?.recommend) issues.push("routingContract.thresholds.recommend is required");
    if (catalog.routingContract?.statusPolicy?.candidate?.autoSelect !== false) issues.push("candidate series must not auto-select");
    if (!Array.isArray(catalog.series) || catalog.series.length === 0) {
      issues.push("Catalog has no series");
    } else {
      const ids = catalog.series.map((series) => series.seriesId).filter(Boolean);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      for (const id of new Set(duplicates)) issues.push(`Duplicate seriesId: ${id}`);
      catalog.series.forEach((series, index) => validateSeries(series, index, catalog, issues));
    }
  }
  const pass = issues.length === 0;
  console.log(JSON.stringify({
    pass,
    catalog: catalogPath,
    seriesCount: catalog?.series?.length || 0,
    seriesIds: catalog?.series?.map((series) => series.seriesId) || [],
    issues,
  }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
