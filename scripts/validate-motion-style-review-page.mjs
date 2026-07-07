#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = resolve(SKILL_ROOT, "../../..");
const DEFAULT_PLAYWRIGHT = join(WORKSPACE_ROOT, "node_modules", "playwright", "index.mjs");
const BUNDLED_PLAYWRIGHT = "/Users/example/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const MIN_FAMILY_COUNT = 32;
const MIN_TEMPLATE_COUNT = 160;
const REQUIRED_CONTENT_KINDS = [
  "claim-split",
  "process-timeline",
  "evidence-board",
  "typed-thesis",
  "dashboard-inspection",
  "data-chart",
  "material-collage",
  "formula-derivation",
  "whiteboard-method",
  "concept-orbit",
  "cover-bridge",
  "before-after",
  "choice-matrix",
  "code-walkthrough",
  "ip-knowledge-card",
  "storyboard-pressure",
  "journey-map",
  "quote-lockup",
  "checklist-gate",
  "recap-loop",
  "table-ranking",
  "geo-map",
  "hierarchy-tree",
  "network-relationship",
  "funnel-conversion",
  "agent-simulation",
  "screenflow-demo",
  "risk-alert",
  "source-citation",
  "voice-sync",
  "comparison-gallery",
  "timeline-calendar",
];
const MODAL_SMOKE_KINDS = [
  "data-chart",
  "table-ranking",
  "geo-map",
  "network-relationship",
  "agent-simulation",
  "voice-sync",
];

function parseArgs(argv) {
  const args = {
    packageDir: "",
    html: "",
    screenshots: "",
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--package" || item === "--package-dir") args.packageDir = resolve(argv[++i] || "");
    else if (item === "--html") args.html = resolve(argv[++i] || "");
    else if (item === "--screenshots") args.screenshots = resolve(argv[++i] || "");
    else if (item === "--json") args.json = true;
    else if (item === "--help" || item === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node .agents/skills/codex-video-workflow/scripts/validate-motion-style-review-page.mjs --package <semi-auto-package-dir>",
    "  node .agents/skills/codex-video-workflow/scripts/validate-motion-style-review-page.mjs --html <motion-style-template-review.html>",
  ].join("\n");
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function rel(path) {
  return relative(WORKSPACE_ROOT, path).split("\\").join("/");
}

async function loadPlaywright() {
  const found = [DEFAULT_PLAYWRIGHT, BUNDLED_PLAYWRIGHT].find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Playwright is not available in workspace or bundled Codex runtime");
  return import(pathToFileURL(found).href);
}

function htmlPathFor(args) {
  if (args.html) return args.html;
  if (!args.packageDir) throw new Error("--package or --html is required");
  return join(args.packageDir, "motion-style-template-review.html");
}

function reportPathFor(args, htmlPath) {
  const packageDir = args.packageDir || dirname(htmlPath);
  return join(packageDir, "workflow", "motion-style-review-validation.json");
}

async function pauseAnimations(page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = Math.min(1800, Math.max(1200, animation.effect?.getTiming?.().duration || 1800));
    }
  });
}

async function readStaticHtmlFacts(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  return {
    title: (html.match(/<title>([^<]+)<\/title>/) || [])[1] || "",
    skeletonCards: (html.match(/data-style-skeleton-card/g) || []).length,
    variantButtons: (html.match(/data-style-variant-button/g) || []).length,
    variantPanels: (html.match(/data-style-variant-panel/g) || []).length,
    videoFrames: (html.match(/data-style-video-frame/g) || []).length,
    businessScenarios: (html.match(/data-business-scenario="/g) || []).length,
    dataSources: (html.match(/data-data-source="/g) || []).length,
    galaceanEffects: (html.match(/data-galacean-effect="/g) || []).length,
    effectLayers: (html.match(/data-galacean-effect-layer="/g) || []).length,
    benchmarks: (html.match(/data-style-benchmark/g) || []).length,
    oldAuditCopy: /风格模板审核/.test(html),
    hasBenchmarkModalField: /data-style-preview-benchmark/.test(html),
    hasScenarioModalField: /data-style-preview-scenario/.test(html),
    hasEffectPlanModalField: /data-style-preview-effect-plan/.test(html),
    missingContentKinds: REQUIRED_CONTENT_KINDS.filter((kind) => !html.includes(`data-content-kind="${kind}"`) && !html.includes(`style-example-${kind}`)),
  };
}

async function validateBrowserPage(page, screenshotDir) {
  const failures = [];
  await pauseAnimations(page);
  const initial = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0.02
        && rect.width > 1
        && rect.height > 1;
    };
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      };
    };
    const intersects = (a, b) => a && b && a.width > 0 && b.width > 0
      && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const intersectionRatio = (a, b) => {
      if (!intersects(a, b)) return 0;
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const area = width * height;
      const base = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
      return area / base;
    };
    const outside = (child, parent, tolerance = 3) => child.left < parent.left - tolerance
      || child.top < parent.top - tolerance
      || child.right > parent.right + tolerance
      || child.bottom > parent.bottom + tolerance;
    const shellIssues = [];
    const activeShells = [...document.querySelectorAll("[data-style-review-card]:not([hidden]) [data-style-variant-panel]:not([hidden]) [data-style-page-shell]")].filter(visible);
    activeShells.forEach((shell, index) => {
      const shellRect = rectFor(shell);
      const selectors = [
        ".style-page-topline",
        ".style-page-main",
        ".style-frame-copy",
        ".style-frame-board",
        ".style-page-support",
        ".style-frame-steps",
        ".style-quality-strip",
        ".style-frame-subtitle",
      ];
      const rects = Object.fromEntries(selectors.map((selector) => {
        const element = shell.querySelector(selector);
        return [selector, element && visible(element) ? rectFor(element) : null];
      }));
      for (const [selector, rect] of Object.entries(rects)) {
        if (rect && outside(rect, shellRect)) shellIssues.push(`${index}:${selector}:outside-shell`);
      }
      for (const selector of [".style-page-support", ".style-frame-steps", ".style-quality-strip"]) {
        if (intersects(rects[".style-frame-subtitle"], rects[selector])) shellIssues.push(`${index}:subtitle-overlap-${selector}`);
      }
      const copyRect = rects[".style-frame-copy"];
      const boardContent = [...shell.querySelectorAll(".style-frame-board div, .style-frame-board span, .style-frame-board b, .style-frame-board em, .style-frame-board small")].filter((element) => {
        if (!visible(element)) return false;
        if (element.classList.contains("style-frame-board")) return false;
        const className = String(element.className || "");
        if (/\bstyle-[a-z0-9-]+-board\b/.test(className) && !/\bstyle-frame-card\b/.test(className)) return false;
        const text = String(element.textContent || "").trim();
        const rect = element.getBoundingClientRect();
        return text.length > 0 && rect.width > 8 && rect.height > 8;
      });
      for (const element of boardContent) {
        const ratio = intersectionRatio(copyRect, rectFor(element));
        if (ratio > 0.08) {
          const label = element.className || element.tagName.toLowerCase();
          shellIssues.push(`${index}:copy-overlaps-board-content:${label}`);
          break;
        }
      }
    });
    const textIssues = [...document.querySelectorAll("[data-style-page-shell] .designed-title, [data-style-page-shell] .style-frame-copy p, [data-style-page-shell] .style-frame-subtitle span")].filter(visible).flatMap((element, index) => {
      const style = getComputedStyle(element);
      const clipX = !["visible", ""].includes(style.overflowX);
      const clipY = !["visible", ""].includes(style.overflowY);
      const clipped = (clipX && element.scrollWidth > element.clientWidth + 4) || (clipY && element.scrollHeight > element.clientHeight + 4);
      return clipped ? [`${index}:${element.className || element.tagName}`] : [];
    });
    return {
      title: document.title,
      oldAuditCopy: document.body.textContent.includes("风格模板审核"),
      cards: document.querySelectorAll("[data-style-skeleton-card]").length,
      visibleCards: [...document.querySelectorAll("[data-style-review-card]")].filter((card) => !card.hidden).length,
      familyButtons: document.querySelectorAll("[data-style-filter-family]").length,
      variantButtons: document.querySelectorAll("[data-style-variant-button]").length,
      variantPanels: document.querySelectorAll("[data-style-variant-panel]").length,
      videoFrames: document.querySelectorAll("[data-style-video-frame]").length,
      scenarioFrames: [...document.querySelectorAll("[data-style-video-frame]")].filter((frame) => (frame.getAttribute("data-business-scenario") || "").length > 10).length,
      dataSourceFrames: [...document.querySelectorAll("[data-style-video-frame]")].filter((frame) => (frame.getAttribute("data-data-source") || "").length > 2).length,
      effectFrames: [...document.querySelectorAll("[data-style-video-frame]")].filter((frame) => (frame.getAttribute("data-galacean-effect") || "").length > 2).length,
      effectLayers: document.querySelectorAll("[data-galacean-effect-layer]").length,
      pageShells: document.querySelectorAll("[data-style-page-shell]").length,
      designedTitles: document.querySelectorAll(".designed-title[data-designed-title]").length,
      benchmarkFrames: document.querySelectorAll("[data-style-benchmark]").length,
      contentKinds: [...new Set([...document.querySelectorAll("[data-style-review-card]")].map((card) => card.getAttribute("data-content-kind")).filter(Boolean))].sort(),
      layoutModes: [...new Set([...document.querySelectorAll("[data-style-page-shell]")].map((shell) => shell.getAttribute("data-style-layout-mode")).filter(Boolean))].sort(),
      typographyModes: [...new Set([...document.querySelectorAll("[data-style-page-shell]")].map((shell) => shell.getAttribute("data-style-typography-mode")).filter(Boolean))].sort(),
      realDataLabels: document.body.textContent.includes("美国 30.77T") && document.body.textContent.includes("中国 19.50T") && document.body.textContent.includes("印度 3.96T"),
      realPopulationLabels: document.body.textContent.includes("印度 14.64 亿") && document.body.textContent.includes("World Bank 2025 人口总量"),
      realCoordinateLabels: document.body.textContent.includes("X 轴") && document.body.textContent.includes("Y 轴") && document.body.textContent.includes("目标象限"),
      realFormulaLabels: document.body.textContent.includes("y = ax^2 + bx + c") && document.body.textContent.includes("y' = 2ax + b"),
      horizontalOverflowCount: [...document.querySelectorAll("body *")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible").length,
      shellIssues,
      textIssues,
    };
  });

  assert(initial.title === "风格模板", "review page title must be 风格模板", failures);
  assert(initial.oldAuditCopy === false, "review page must not use 风格模板审核 copy", failures);
  assert(initial.cards >= MIN_FAMILY_COUNT && initial.visibleCards >= MIN_FAMILY_COUNT, `review page must render at least ${MIN_FAMILY_COUNT} visible skeleton cards`, failures);
  assert(initial.familyButtons >= MIN_FAMILY_COUNT + 1, "review page must expose all family filters plus the all filter", failures);
  assert(initial.variantButtons >= MIN_TEMPLATE_COUNT && initial.variantPanels >= MIN_TEMPLATE_COUNT, `review page must expose at least ${MIN_TEMPLATE_COUNT} switchable variants`, failures);
  assert(initial.videoFrames >= MIN_TEMPLATE_COUNT && initial.pageShells >= MIN_TEMPLATE_COUNT, "review page must render each variant as a simulated video page", failures);
  assert(initial.scenarioFrames >= MIN_TEMPLATE_COUNT, "each simulated video frame must carry a business scenario contract", failures);
  assert(initial.dataSourceFrames >= MIN_TEMPLATE_COUNT, "each simulated video frame must carry a source/data mode contract", failures);
  assert(initial.effectFrames >= MIN_TEMPLATE_COUNT, "each simulated video frame must carry a Galacean effect contract", failures);
  assert(initial.effectLayers >= MIN_TEMPLATE_COUNT * 2, "each simulated video frame must render background and foreground effect fallback layers", failures);
  assert(initial.designedTitles >= MIN_TEMPLATE_COUNT, "review page must use designed typography for each variant", failures);
  assert(initial.benchmarkFrames >= MIN_TEMPLATE_COUNT, "review page must keep horizontal benchmark metadata on each variant", failures);
  assert(initial.contentKinds.length >= REQUIRED_CONTENT_KINDS.length, "review page must cover all required content kinds", failures);
  for (const kind of REQUIRED_CONTENT_KINDS) {
    assert(initial.contentKinds.includes(kind), `review page missing content kind: ${kind}`, failures);
  }
  assert(initial.layoutModes.length >= 16, "review page must expose diverse layout modes", failures);
  assert(initial.typographyModes.length >= 8, "review page must expose diverse typography modes", failures);
  assert(initial.realDataLabels && initial.realPopulationLabels && initial.realCoordinateLabels && initial.realFormulaLabels, "review page must use real data, population, coordinate, and formula scenarios", failures);
  assert(initial.horizontalOverflowCount === 0, "review page must not have visible horizontal overflow", failures);
  assert(initial.shellIssues.length === 0, `review page shells must not overlap or escape bounds: ${initial.shellIssues.join(", ")}`, failures);
  assert(initial.textIssues.length === 0, `review page title/subtitle/body text must not be clipped: ${initial.textIssues.join(", ")}`, failures);

  await page.screenshot({ path: join(screenshotDir, "motion-style-review-page.png"), fullPage: false });

  const modalChecks = [];
  for (const kind of MODAL_SMOKE_KINDS) {
    const card = page.locator(`[data-style-review-card][data-content-kind="${kind}"]`);
    if ((await card.count()) === 0) {
      failures.push(`modal smoke card missing: ${kind}`);
      continue;
    }
    const before = await card.first().evaluate((element) => ({
      activeTemplate: element.querySelector("[data-style-variant-panel]:not([hidden])")?.getAttribute("data-template-id") || "",
      layout: element.querySelector("[data-style-variant-panel]:not([hidden]) [data-style-page-shell]")?.getAttribute("data-style-layout-mode") || "",
      typography: element.querySelector("[data-style-variant-panel]:not([hidden]) [data-style-page-shell]")?.getAttribute("data-style-typography-mode") || "",
    }));
    await card.first().locator("[data-open-style-preview]").click();
    await page.waitForTimeout(120);
    const modal = await page.evaluate(() => ({
      open: document.querySelector("[data-style-preview-modal]")?.open === true,
      templateKind: document.querySelector("[data-style-preview-frame] .style-template-preview")?.getAttribute("data-content-kind") || "",
      hasLargePreview: Boolean(document.querySelector("[data-style-preview-frame] .style-template-preview.large")),
      layout: document.querySelector("[data-style-preview-frame] [data-style-page-shell]")?.getAttribute("data-style-layout-mode") || "",
      typography: document.querySelector("[data-style-preview-frame] [data-style-page-shell]")?.getAttribute("data-style-typography-mode") || "",
      benchmarkText: document.querySelector("[data-style-preview-benchmark]")?.textContent || "",
      videoUse: document.querySelector("[data-style-preview-video-use]")?.textContent || "",
      scenario: document.querySelector("[data-style-preview-scenario]")?.textContent || "",
      dataSource: document.querySelector("[data-style-preview-data-source]")?.textContent || "",
      effectPlan: document.querySelector("[data-style-preview-effect-plan]")?.textContent || "",
    }));
    assert(modal.open && modal.hasLargePreview, `modal for ${kind} must open with a large preview`, failures);
    assert(modal.templateKind === kind, `modal for ${kind} must keep the same content kind`, failures);
    assert(modal.layout === before.layout && modal.typography === before.typography, `modal for ${kind} must match thumbnail layout and typography`, failures);
    assert(/Apple|Material|FT|Observable|Manim|GSAP/.test(modal.benchmarkText), `modal for ${kind} must show horizontal benchmark references`, failures);
    assert(modal.videoUse.length > 10, `modal for ${kind} must explain real video use`, failures);
    assert(modal.scenario.length > 10, `modal for ${kind} must show business scenario`, failures);
    assert(modal.dataSource.length > 2, `modal for ${kind} must show data/source mode`, failures);
    assert(modal.effectPlan.trim().length >= 6, `modal for ${kind} must show effect layer plan`, failures);
    assert(!/Galacean runtime|@galacean\/effects|Vue\.js|React\.js/.test(modal.effectPlan), `modal for ${kind} must not expose runtime/framework labels in effect plan`, failures);
    modalChecks.push({ kind, before, modal });
    if (kind === MODAL_SMOKE_KINDS[0]) {
      await page.screenshot({ path: join(screenshotDir, "motion-style-review-modal.png"), fullPage: false });
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }

  return { ok: failures.length === 0, failures, initial, modalChecks, screenshots: screenshotDir };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const htmlPath = htmlPathFor(args);
  const packageDir = args.packageDir || dirname(htmlPath);
  const screenshotDir = args.screenshots || join(packageDir, "validation-screenshots");
  ensureDir(screenshotDir);
  const failures = [];
  assert(existsSync(htmlPath), `motion style review html missing: ${htmlPath}`, failures);
  const staticFacts = existsSync(htmlPath) ? await readStaticHtmlFacts(htmlPath) : {};
  assert(staticFacts.title === "风格模板", "static html title must be 风格模板", failures);
  assert(staticFacts.skeletonCards >= MIN_FAMILY_COUNT, `static html must include at least ${MIN_FAMILY_COUNT} skeleton cards`, failures);
  assert(staticFacts.videoFrames >= MIN_TEMPLATE_COUNT, `static html must include at least ${MIN_TEMPLATE_COUNT} simulated video frames`, failures);
  assert(staticFacts.businessScenarios >= MIN_TEMPLATE_COUNT, "static html must include business scenario contracts on every frame", failures);
  assert(staticFacts.dataSources >= MIN_TEMPLATE_COUNT, "static html must include data/source contracts on every frame", failures);
  assert(staticFacts.galaceanEffects >= MIN_TEMPLATE_COUNT, "static html must include Galacean effect contracts on every frame", failures);
  assert(staticFacts.effectLayers >= MIN_TEMPLATE_COUNT * 2, "static html must include two effect fallback layers for every frame", failures);
  assert(staticFacts.benchmarks >= MIN_TEMPLATE_COUNT, "static html must include benchmark metadata on every variant", failures);
  assert(staticFacts.hasBenchmarkModalField, "static html must include a benchmark field in the modal", failures);
  assert(staticFacts.hasScenarioModalField, "static html must include a scenario field in the modal", failures);
  assert(staticFacts.hasEffectPlanModalField, "static html must include an effect plan field in the modal", failures);
  assert(staticFacts.missingContentKinds?.length === 0, `static html missing content kinds: ${staticFacts.missingContentKinds?.join(", ")}`, failures);

  let browserReport = null;
  if (existsSync(htmlPath)) {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1516, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      browserReport = await validateBrowserPage(page, screenshotDir);
      failures.push(...browserReport.failures);
    } finally {
      await browser.close();
    }
  }

  const report = {
    ok: failures.length === 0,
    html: rel(htmlPath),
    generatedAt: new Date().toISOString(),
    staticFacts,
    browser: browserReport,
    screenshots: rel(screenshotDir),
    failures,
  };
  ensureDir(dirname(reportPathFor(args, htmlPath)));
  writeFileSync(reportPathFor(args, htmlPath), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
