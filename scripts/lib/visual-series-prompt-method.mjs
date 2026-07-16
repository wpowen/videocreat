import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const VISUAL_SERIES_PROMPT_METHOD = Object.freeze({
  id: "independent-visual-series-structured-contract-v2",
  policy: "shared-compiler-independent-leaf-contracts",
  rightsBoundary: "Borrow abstract prompt structure only. Do not copy community prompts, protected characters, brands, layouts, or named-creator styles.",
});

function clean(value = "", fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").replace(/[{}<>]/g, "").trim();
  return normalized || fallback;
}

function list(value = [], fallback = []) {
  const source = Array.isArray(value) ? value : [value];
  const normalized = source.map((item) => clean(item)).filter(Boolean);
  return [...new Set(normalized.length ? normalized : fallback)];
}

export function loadVisualSeriesLeafContract({ skillRoot, series } = {}) {
  const relativePath = clean(series?.skillContractPath);
  if (!relativePath) throw new Error(`Series ${series?.seriesId || "unknown"} has no skillContractPath.`);
  const path = resolve(skillRoot, relativePath);
  if (!existsSync(path)) throw new Error(`Leaf visual contract not found: ${path}`);
  const contract = JSON.parse(readFileSync(path, "utf8"));
  if (contract.seriesId !== series.seriesId) {
    throw new Error(`Leaf visual contract series mismatch: expected ${series.seriesId}, got ${contract.seriesId || "missing"}.`);
  }
  if (!contract.skillId || !Array.isArray(contract.layoutFamilies) || contract.layoutFamilies.length < 2) {
    throw new Error(`Leaf visual contract is incomplete: ${path}`);
  }
  return { contract, path };
}

function chooseLayout(contract, slot, pageCount) {
  const families = contract.layoutFamilies || [];
  const roleMatch = families.find((family) => (family.roles || []).includes(slot.role));
  if (roleMatch) return roleMatch;
  if (slot.order === pageCount && families.find((family) => family.closing === true)) {
    return families.find((family) => family.closing === true);
  }
  return families[(slot.order - 1) % families.length];
}

export function buildVisualSeriesBlueprint({ args, series, leafContract, canvas, styleLock, textPolicy, imagePlan, slot } = {}) {
  const layout = chooseLayout(leafContract, slot, imagePlan.resolvedImageCount);
  const exactTextWhitelist = textPolicy === "integrated-chinese" ? list(slot.requiredText).slice(0, 8) : [];
  const physical = leafContract.physicalVisualSystem || {};
  const safeZone = canvas.orientation === "vertical"
    ? "Keep the lower 18% as genuinely calm background with no subject, panel, connector, border, label, or high-contrast ornament."
    : "Keep the lower 18% visually quiet for subtitles and preserve one calm overlay zone.";
  return {
    schemaVersion: 2,
    promptMethod: VISUAL_SERIES_PROMPT_METHOD,
    skillId: leafContract.skillId,
    contractId: leafContract.contractId,
    seriesId: series.seriesId,
    visualGoal: clean(leafContract.outputIntent, series.plannerGuidance),
    positioning: clean(leafContract.positioning, "Create an authored editorial visual, not a generic slide."),
    topic: clean(args.topic || args.title, series.name),
    contentBeat: clean(slot.contentBeat, args.topic || args.title || series.name),
    pageRole: slot.role,
    layoutFamily: layout.id,
    layoutTopology: clean(layout.topology),
    readingPath: clean(layout.readingPath),
    cameraAndScale: clean(layout.cameraAndScale),
    moduleCount: clean(layout.moduleCount),
    contentSchema: list(leafContract.contentSchema),
    materialSystem: clean(physical.material),
    lightingSystem: clean(physical.lighting),
    colorSystem: clean(physical.color),
    typographySystem: clean(physical.typography),
    styleLockId: styleLock.lockId,
    styleDna: styleLock.styleDna,
    styleSpec: styleLock.styleSpec || {},
    textPolicy,
    exactTextWhitelist,
    textRule: textPolicy === "integrated-chinese"
      ? "Render every whitelisted string exactly once and no other readable text. Wrong, distorted, duplicated, or extra text fails QC."
      : "No readable text of any language may appear. Render no pseudo-readable text either. Use intentional blank label zones only; deterministic HTML/SVG/CSS owns exact copy.",
    safeZone,
    allowedVariations: list(leafContract.allowedVariations, ["scene-specific subject detail", "semantic accent placement"]),
    forbiddenElements: list(leafContract.forbiddenElements),
    qcAssertions: list(leafContract.qcAssertions),
  };
}

function styleLines(styleSpec = {}) {
  const order = ["renderingMedium", "background", "accent", "iconAndDetailStyle", "paletteRule"];
  return order.filter((key) => styleSpec[key]).map((key) => `- ${key}: ${styleSpec[key]}`);
}

export function formatVisualSeriesProductionPrompt({ blueprint, canvas, pageOrder, pageCount } = {}) {
  if (!blueprint) throw new Error("formatVisualSeriesProductionPrompt requires a blueprint");
  const whitelist = blueprint.exactTextWhitelist.length ? blueprint.exactTextWhitelist.map((item) => `- ${item}`) : ["- no generated text"];
  return [
    `Create page ${pageOrder}/${pageCount} of a native ${canvas.aspectRatio} full-screen Chinese video visual series at ${canvas.width}x${canvas.height}.`,
    "",
    "OUTPUT INTENT",
    blueprint.visualGoal,
    blueprint.positioning,
    `Topic: ${blueprint.topic}`,
    `Matched content beat: ${blueprint.contentBeat}`,
    `Page role: ${blueprint.pageRole}`,
    "",
    "CONTENT CONTRACT",
    ...blueprint.contentSchema.map((item) => `- ${item}`),
    "Do not invent facts, edges, steps, UI states, chronology, ratings, or specimen features not supplied by the content contract.",
    "",
    "SPATIAL MAP AND READING ORDER",
    `Layout family: ${blueprint.layoutFamily}`,
    `Topology: ${blueprint.layoutTopology}`,
    `Reading path: ${blueprint.readingPath}`,
    `Camera and scale: ${blueprint.cameraAndScale}`,
    `Module count: ${blueprint.moduleCount}`,
    `Safe zone: ${blueprint.safeZone}`,
    "",
    `SERIES STYLE LOCK — ${blueprint.styleLockId}`,
    blueprint.styleDna,
    ...styleLines(blueprint.styleSpec),
    "Keep this rendering medium, background treatment, accent semantics, geometry, and finish stable across the series.",
    "",
    "PHYSICAL VISUAL SYSTEM",
    `Material: ${blueprint.materialSystem}`,
    `Lighting: ${blueprint.lightingSystem}`,
    `Color: ${blueprint.colorSystem}`,
    `Typography: ${blueprint.typographySystem}`,
    "",
    "EXACT TEXT WHITELIST",
    ...whitelist,
    blueprint.textRule,
    "",
    "ALLOWED CHANGES",
    ...blueprint.allowedVariations.map((item) => `- ${item}`),
    "",
    "REJECT",
    ...blueprint.forbiddenElements.map((item) => `- ${item}`),
    "- watermark, logo, real-product imitation, celebrity likeness, protected character, brand mimicry, or named-creator imitation",
    "- unresolved template placeholders, random letters or numbers, pseudo-Chinese, and decorative filler without a narrative job",
    "",
    "FINAL QC — DO NOT DECLARE COMPLETE UNLESS ALL ARE TRUE",
    ...blueprint.qcAssertions.map((item) => `- ${item}`),
    "- the focal argument reads at thumbnail size and the lower subtitle-safe band is genuinely empty",
    "- material, light, line/edge behavior, depth, and palette feel deliberately art-directed rather than generically polished",
    "",
    `Leaf Skill: ${blueprint.skillId}; contract: ${blueprint.contractId}.`,
    `Prompt method: ${VISUAL_SERIES_PROMPT_METHOD.id}; ${VISUAL_SERIES_PROMPT_METHOD.policy}.`,
  ].join("\n");
}

export function lintVisualSeriesProductionPrompt(prompt = "") {
  const text = String(prompt || "");
  const required = ["OUTPUT INTENT", "CONTENT CONTRACT", "SPATIAL MAP AND READING ORDER", "SERIES STYLE LOCK", "PHYSICAL VISUAL SYSTEM", "EXACT TEXT WHITELIST", "REJECT", "FINAL QC"];
  const missingSections = required.filter((section) => !text.includes(section));
  const unresolvedPlaceholders = [...text.matchAll(/\{[^}\n]+\}/g)].map((match) => match[0]);
  const checks = {
    structuredSectionsPresent: missingSections.length === 0,
    noUnresolvedPlaceholders: unresolvedPlaceholders.length === 0,
    methodRecorded: text.includes(VISUAL_SERIES_PROMPT_METHOD.id),
    leafSkillRecorded: text.includes("Leaf Skill:"),
    physicalSystemRecorded: /Material:.+\nLighting:.+\nColor:.+\nTypography:/s.test(text),
  };
  return { status: Object.values(checks).every(Boolean) ? "pass" : "fail", checks, missingSections, unresolvedPlaceholders };
}
