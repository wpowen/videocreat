#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromiumLaunchOptions, loadPlaywright } from "./lib/load-playwright.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = SKILL_ROOT;
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
  "ip-knowledge-card",
  "whiteboard-method",
  "storyboard-pressure",
  "comparison-gallery",
  "risk-alert",
  "voice-sync",
  "screenflow-demo",
  "timeline-calendar",
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
    "  node .agents/skills/codex-video-workflow/scripts/validate-vertical-motion-style-review-page.mjs --package <semi-auto-package-dir>",
    "  node .agents/skills/codex-video-workflow/scripts/validate-vertical-motion-style-review-page.mjs --html <vertical-motion-style-template-review.html>",
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

function htmlPathFor(args) {
  if (args.html) return args.html;
  if (!args.packageDir) throw new Error("--package or --html is required");
  return join(args.packageDir, "vertical-motion-style-template-review.html");
}

function reportPathFor(args, htmlPath) {
  const packageDir = args.packageDir || dirname(htmlPath);
  return join(packageDir, "workflow", "vertical-motion-style-review-validation.json");
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
    verticalCards: (html.match(/data-vertical-style-card/g) || []).length,
    variantButtons: (html.match(/data-style-variant-button/g) || []).length,
    variantPanels: (html.match(/data-style-variant-panel/g) || []).length,
    verticalFrames: (html.match(/data-vertical-video-frame/g) || []).length,
    businessScenarios: (html.match(/data-business-scenario="/g) || []).length,
    dataSources: (html.match(/data-data-source="/g) || []).length,
    firstThreeHooks: (html.match(/data-first-three-second-hook="/g) || []).length,
    hookContracts: (html.match(/data-vertical-hook-contract="/g) || []).length,
    captionPolicies: (html.match(/data-vertical-caption-policy="/g) || []).length,
    safeAreas: (html.match(/data-platform-safe-area="/g) || []).length,
    captionBands: (html.match(/data-vertical-caption-band/g) || []).length,
    effectLayers: (html.match(/data-vertical-effect-layer="/g) || []).length,
    layoutClusters: [...new Set([...html.matchAll(/data-vertical-layout="([^"]+)"/g)].map((match) => match[1]))].filter(Boolean).sort(),
    ipVerticalFrames: (html.match(/data-ip-vertical-series="true"/g) || []).length,
    formulaProofs: (html.match(/data-formula-vertical-proof="true"/g) || []).length,
    chartProofs: (html.match(/data-chart-vertical-proof="true"/g) || []).length,
    oldAuditCopy: /风格模板审核/.test(html),
    visibleInternalLabels: /Vue\.js|React\.js|@galacean\/effects|Galacean runtime/.test(html),
    missingContentKinds: REQUIRED_CONTENT_KINDS.filter((kind) => !html.includes(`data-content-kind="${kind}"`) && !html.includes(`scene-${kind}`)),
  };
}

async function validateBrowserPage(page, screenshotDir) {
  const failures = [];
  await pauseAnimations(page);
  const initial = await page.evaluate(async () => {
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
    const outside = (child, parent, tolerance = 3) => child.left < parent.left - tolerance
      || child.top < parent.top - tolerance
      || child.right > parent.right + tolerance
      || child.bottom > parent.bottom + tolerance;
    const frameIssues = [];
    const activeFrames = [...document.querySelectorAll("[data-vertical-style-card]:not([hidden]) [data-style-variant-panel]:not([hidden]) [data-vertical-video-frame]")].filter(visible);
    const layoutClusters = [...new Set([...document.querySelectorAll("[data-vertical-video-frame]")].map((frame) => frame.getAttribute("data-vertical-layout")).filter(Boolean))].sort();
    const thumbnailCompletenessIssues = [];
    activeFrames.forEach((frame, index) => {
      const frameRect = rectFor(frame);
      const preview = frame.closest(".vertical-template-preview");
      const previewRect = preview && visible(preview) ? rectFor(preview) : null;
      const ratio = frameRect.height / Math.max(1, frameRect.width);
      if (ratio < 1.72 || ratio > 1.82) frameIssues.push(`${index}:not-9x16:${ratio.toFixed(3)}`);
      if (previewRect) {
        const previewRatio = previewRect.height / Math.max(1, previewRect.width);
        if (previewRatio < 1.72 || previewRatio > 1.82) thumbnailCompletenessIssues.push(`${index}:preview-not-9x16:${previewRatio.toFixed(3)}`);
        if (outside(frameRect, previewRect, 2)) thumbnailCompletenessIssues.push(`${index}:frame-outside-thumbnail`);
      } else {
        thumbnailCompletenessIssues.push(`${index}:missing-preview`);
      }
      const selectors = [
        ".vertical-hook-zone",
        ".vertical-proof-stage",
        ".vertical-beat-rail",
        ".vertical-payoff-loop",
        ".vertical-caption-band",
      ];
      const rects = Object.fromEntries(selectors.map((selector) => {
        const element = frame.querySelector(selector);
        return [selector, element && visible(element) ? rectFor(element) : null];
      }));
      for (const [selector, rect] of Object.entries(rects)) {
        if (!rect) frameIssues.push(`${index}:${selector}:missing`);
        else if (outside(rect, frameRect)) frameIssues.push(`${index}:${selector}:outside-frame`);
      }
      for (const selector of [".vertical-hook-zone", ".vertical-proof-stage", ".vertical-beat-rail", ".vertical-payoff-loop"]) {
        if (intersects(rects[".vertical-caption-band"], rects[selector])) frameIssues.push(`${index}:caption-overlap-${selector}`);
      }
      for (const selector of [".vertical-hook-zone", ".vertical-proof-stage", ".vertical-beat-rail", ".vertical-caption-band"]) {
        const rect = rects[selector];
        if (rect && rect.right > frameRect.right - frameRect.width * 0.08) frameIssues.push(`${index}:${selector}:right-action-rail-risk`);
      }
      if (rects[".vertical-proof-stage"] && rects[".vertical-proof-stage"].height < frameRect.height * 0.28) {
        thumbnailCompletenessIssues.push(`${index}:proof-stage-too-short`);
      }
    });
    const textIssues = [...document.querySelectorAll("[data-vertical-video-frame] .vertical-hook-zone h4, [data-vertical-video-frame] .vertical-hook-zone p, [data-vertical-video-frame] .vertical-caption-band span, [data-vertical-video-frame] .vertical-card b, [data-vertical-video-frame] .vertical-card span")].filter(visible).flatMap((element, index) => {
      const style = getComputedStyle(element);
      const clipX = !["visible", ""].includes(style.overflowX);
      const clipY = !["visible", ""].includes(style.overflowY);
      const clipped = (clipX && element.scrollWidth > element.clientWidth + 4) || (clipY && element.scrollHeight > element.clientHeight + 4);
      return clipped ? [`${index}:${element.className || element.tagName}`] : [];
    });
    const luminance = (cssColor) => {
      const parts = String(cssColor || "").match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
      const [r, g, b] = parts.map((value) => {
        const normalized = Math.max(0, Math.min(255, value)) / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const readabilityIssues = [...document.querySelectorAll('[data-vertical-layout="vertical-layout-sketch"] .vertical-hook-zone h4, [data-vertical-layout="vertical-layout-sketch"] .vertical-hook-zone p')].filter(visible).flatMap((element, index) => {
      const color = getComputedStyle(element).color;
      return luminance(color) > 0.78 ? [`sketch-hook-light-text-${index}:${color}`] : [];
    });
    const scopedLayoutIssues = [];
    for (const [name, selector] of [
      ["rank-head", ".vertical-ranking-board .rank-head"],
      ["rank-row", ".vertical-ranking-board .rank-row"],
      ["risk-level", ".vertical-risk-board .risk-level"],
      ["risk-impact", ".vertical-risk-board .risk-impact"],
      ["selected-frame", ".vertical-gallery-board .selected-frame"],
      ["calendar-grid", ".vertical-calendar-board .calendar-grid"],
      ["event-rail", ".vertical-calendar-board .event-rail"],
      ["cue-row", ".vertical-voice-board .cue-row"],
      ["agent-lane", ".vertical-agent-board .agent-lane"],
      ["tree-node", ".vertical-tree-board .tree-node"],
    ]) {
      for (const element of [...document.querySelectorAll(selector)].filter(visible)) {
        if (getComputedStyle(element).position === "absolute") scopedLayoutIssues.push(`${name}:inherited-absolute`);
      }
    }
    const calendarIssues = [];
    for (const [index, calendar] of [...document.querySelectorAll("[data-calendar-vertical-proof]")].filter(visible).entries()) {
      const header = calendar.querySelector(".calendar-header");
      const weekdays = calendar.querySelector(".weekday-row");
      const grid = calendar.querySelector(".calendar-grid");
      const rail = calendar.querySelector(".event-rail");
      const cells = [...calendar.querySelectorAll(".calendar-grid span")].filter(visible);
      const text = calendar.textContent || "";
      if (!header || !weekdays || !grid || !rail) calendarIssues.push(`${index}:calendar-section-missing`);
      if (cells.length < 35) calendarIssues.push(`${index}:calendar-month-incomplete:${cells.length}`);
      for (const required of ["2026 年 7 月", "2026-07-04", "2026-07-06"]) {
        if (!text.includes(required)) calendarIssues.push(`${index}:calendar-date-missing:${required}`);
      }
      const headerRect = header && visible(header) ? rectFor(header) : null;
      const weekRect = weekdays && visible(weekdays) ? rectFor(weekdays) : null;
      const gridRect = grid && visible(grid) ? rectFor(grid) : null;
      const railRect = rail && visible(rail) ? rectFor(rail) : null;
      if (headerRect && weekRect && intersects(headerRect, weekRect)) calendarIssues.push(`${index}:header-overlaps-weekdays`);
      if (weekRect && gridRect && intersects(weekRect, gridRect)) calendarIssues.push(`${index}:weekdays-overlaps-grid`);
      if (gridRect && railRect && intersects(gridRect, railRect)) calendarIssues.push(`${index}:grid-overlaps-event-rail`);
    }
    const allVariantIssues = [];
    const labelFor = (card, panel) => `${card.getAttribute("data-content-kind") || "unknown"}:${panel?.getAttribute("data-template-id") || "unknown"}`;
    const isAncestorPair = (a, b) => a.contains(b) || b.contains(a);
    const numberZ = (element) => {
      const value = getComputedStyle(element).zIndex;
      return Number.isFinite(Number(value)) ? Number(value) : 0;
    };
    const cards = [...document.querySelectorAll("[data-vertical-style-card]")];
    for (const card of cards) {
      const buttons = [...card.querySelectorAll("[data-style-variant-button]")];
      for (const button of buttons) {
        button.click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const panel = card.querySelector("[data-style-variant-panel]:not([hidden])");
        const frame = panel?.querySelector("[data-vertical-video-frame]");
        if (!frame) continue;
        const id = labelFor(card, panel);
        const title = frame.querySelector(".vertical-hook-zone h4");
        const support = frame.querySelector(".vertical-hook-zone p");
        const hook = frame.querySelector(".vertical-hook-zone");
        const proof = frame.querySelector(".vertical-proof-stage");
        const beat = frame.querySelector(".vertical-beat-rail");
        const payoff = frame.querySelector(".vertical-payoff-loop");
        const caption = frame.querySelector(".vertical-caption-band");
        const chip = frame.closest(".vertical-template-preview")?.querySelector(".style-chip");
        const safeOverlays = [...frame.querySelectorAll(".vertical-platform-safe")].filter(visible);
        const foregroundEffect = frame.querySelector(".vertical-galacean-effect.layer-foreground");
        if (chip && visible(chip)) allVariantIssues.push(`${id}:style-chip-visible-inside-video`);
        if (safeOverlays.length) allVariantIssues.push(`${id}:debug-safe-area-visible`);
        if (foregroundEffect && proof && numberZ(foregroundEffect) >= numberZ(proof)) allVariantIssues.push(`${id}:foreground-effect-above-proof-text`);
        const proofRect = proof && visible(proof) ? rectFor(proof) : null;
        const titleRect = title && visible(title) ? rectFor(title) : null;
        const supportRect = support && visible(support) ? rectFor(support) : null;
        const hookRect = hook && visible(hook) ? rectFor(hook) : null;
        if (titleRect && hookRect && outside(titleRect, hookRect, 2)) allVariantIssues.push(`${id}:title-overflows-hook-zone`);
        if (supportRect && hookRect && outside(supportRect, hookRect, 2)) allVariantIssues.push(`${id}:support-overflows-hook-zone`);
        if (titleRect && proofRect && intersects(titleRect, proofRect)) allVariantIssues.push(`${id}:title-overlaps-proof-stage`);
        if (supportRect && proofRect && intersects(supportRect, proofRect)) allVariantIssues.push(`${id}:support-overlaps-proof-stage`);
        for (const [name, element] of [["proof", proof], ["beat", beat], ["payoff", payoff]]) {
          const elementRect = element && visible(element) ? rectFor(element) : null;
          const captionRect = caption && visible(caption) ? rectFor(caption) : null;
          if (elementRect && captionRect && intersects(elementRect, captionRect)) allVariantIssues.push(`${id}:caption-overlaps-${name}`);
        }
        const preview = frame.closest(".vertical-template-preview");
        const previewRect = preview && visible(preview) ? rectFor(preview) : null;
        const frameRect = rectFor(frame);
        if (!frame.getAttribute("data-vertical-layout")) allVariantIssues.push(`${id}:missing-layout-cluster`);
        if (previewRect) {
          const ratio = previewRect.height / Math.max(1, previewRect.width);
          if (ratio < 1.72 || ratio > 1.82) thumbnailCompletenessIssues.push(`${id}:thumbnail-not-9x16:${ratio.toFixed(3)}`);
          if (outside(frameRect, previewRect, 2)) thumbnailCompletenessIssues.push(`${id}:frame-outside-thumbnail`);
        }
        if (proofRect && proofRect.height < frameRect.height * 0.28) thumbnailCompletenessIssues.push(`${id}:proof-stage-too-short`);
        const chartBoard = frame.querySelector("[data-chart-vertical-proof]");
        if (chartBoard && visible(chartBoard)) {
          const source = chartBoard.querySelector(".vertical-source-pill");
          const plot = chartBoard.querySelector(".vertical-chart-plot");
          const sourceRect = source && visible(source) ? rectFor(source) : null;
          const plotRect = plot && visible(plot) ? rectFor(plot) : null;
          if (!sourceRect || !plotRect) allVariantIssues.push(`${id}:chart-source-or-plot-missing`);
          if (sourceRect && plotRect && intersects(sourceRect, plotRect)) allVariantIssues.push(`${id}:chart-source-overlaps-plot`);
          if (plotRect && plotRect.height < frameRect.height * 0.18) allVariantIssues.push(`${id}:chart-plot-too-short`);
          const chartText = chartBoard.textContent || "";
          for (const required of ["美国 30.77T", "中国 19.50T", "印度 3.96T"]) {
            if (!chartText.includes(required)) allVariantIssues.push(`${id}:chart-label-missing:${required}`);
          }
        }
        const formulaBoard = frame.querySelector("[data-formula-vertical-proof]");
        if (formulaBoard && visible(formulaBoard)) {
          const boardRect = rectFor(formulaBoard);
          const chain = formulaBoard.querySelector(".formula-chain");
          const graph = formulaBoard.querySelector(".formula-graph-window");
          const note = formulaBoard.querySelector(".formula-note");
          const chainRect = chain && visible(chain) ? rectFor(chain) : null;
          const graphRect = graph && visible(graph) ? rectFor(graph) : null;
          const noteRect = note && visible(note) ? rectFor(note) : null;
          if (!chainRect || !graphRect || !noteRect) allVariantIssues.push(`${id}:formula-section-missing`);
          for (const [name, rect] of [["chain", chainRect], ["graph", graphRect], ["note", noteRect]]) {
            if (rect && outside(rect, boardRect, 2)) allVariantIssues.push(`${id}:formula-${name}-outside-board`);
          }
          if (chainRect && graphRect && intersects(chainRect, graphRect)) allVariantIssues.push(`${id}:formula-chain-overlaps-graph`);
          if (graphRect && noteRect && intersects(graphRect, noteRect)) allVariantIssues.push(`${id}:formula-graph-overlaps-note`);
          const steps = [...formulaBoard.querySelectorAll(".formula-step")].filter(visible);
          for (let i = 0; i < steps.length; i += 1) {
            for (let j = i + 1; j < steps.length; j += 1) {
              if (intersects(rectFor(steps[i]), rectFor(steps[j]))) allVariantIssues.push(`${id}:formula-step-overlap`);
            }
          }
        }
        const ipImage = frame.querySelector("[data-ip-vertical-image]");
        if (ipImage && visible(ipImage)) {
          const ipRect = rectFor(ipImage);
          const presenter = ipImage.querySelector(".vertical-presenter");
          const sheet = ipImage.querySelector(".ip-knowledge-sheet");
          const bubble = ipImage.querySelector(".ip-speech-bubble");
          const presenterRect = presenter && visible(presenter) ? rectFor(presenter) : null;
          const sheetRect = sheet && visible(sheet) ? rectFor(sheet) : null;
          const bubbleRect = bubble && visible(bubble) ? rectFor(bubble) : null;
          for (const [name, rect] of [["presenter", presenterRect], ["sheet", sheetRect], ["bubble", bubbleRect]]) {
            if (!rect) allVariantIssues.push(`${id}:ip-${name}-missing`);
            else if (outside(rect, ipRect, 3)) allVariantIssues.push(`${id}:ip-${name}-outside-image`);
          }
          if (presenterRect && sheetRect && intersects(presenterRect, sheetRect)) allVariantIssues.push(`${id}:ip-presenter-overlaps-sheet`);
          if (presenterRect && bubbleRect && intersects(presenterRect, bubbleRect)) allVariantIssues.push(`${id}:ip-presenter-overlaps-bubble`);
        }
        const cardsInProof = [...frame.querySelectorAll(".vertical-proof-stage [data-critical-layer='vertical-card']")].filter(visible);
        for (let i = 0; i < cardsInProof.length; i += 1) {
          for (let j = i + 1; j < cardsInProof.length; j += 1) {
            if (!isAncestorPair(cardsInProof[i], cardsInProof[j]) && intersects(rectFor(cardsInProof[i]), rectFor(cardsInProof[j]))) {
              allVariantIssues.push(`${id}:critical-card-overlap:${cardsInProof[i].textContent.trim().slice(0, 12)}|${cardsInProof[j].textContent.trim().slice(0, 12)}`);
            }
          }
        }
        const floating = frame.querySelector(".vertical-timeline-board .vertical-card.floating");
        if (floating && visible(floating)) {
          const floatingRect = rectFor(floating);
          for (const step of [...frame.querySelectorAll(".vertical-timeline-board .vertical-mini-step")].filter(visible)) {
            if (intersects(floatingRect, rectFor(step))) allVariantIssues.push(`${id}:timeline-floating-overlaps-step:${step.textContent.trim()}`);
          }
        }
      }
    }
    return {
      title: document.title,
      bodyCopy: document.body.textContent,
      oldAuditCopy: document.body.textContent.includes("风格模板审核"),
      cards: document.querySelectorAll("[data-vertical-style-card]").length,
      visibleCards: [...document.querySelectorAll("[data-vertical-style-card]")].filter((card) => !card.hidden).length,
      familyButtons: document.querySelectorAll("[data-style-filter-family]").length,
      variantButtons: document.querySelectorAll("[data-style-variant-button]").length,
      variantPanels: document.querySelectorAll("[data-style-variant-panel]").length,
      verticalFrames: document.querySelectorAll("[data-vertical-video-frame]").length,
      scenarioFrames: [...document.querySelectorAll("[data-vertical-video-frame]")].filter((frame) => (frame.getAttribute("data-business-scenario") || "").length > 10).length,
      dataSourceFrames: [...document.querySelectorAll("[data-vertical-video-frame]")].filter((frame) => (frame.getAttribute("data-data-source") || "").length > 2).length,
      hookFrames: [...document.querySelectorAll("[data-vertical-video-frame]")].filter((frame) => (frame.getAttribute("data-first-three-second-hook") || "").length > 10).length,
      safeAreaFrames: [...document.querySelectorAll("[data-vertical-video-frame]")].filter((frame) => (frame.getAttribute("data-platform-safe-area") || "").length > 10).length,
      captionPolicies: [...document.querySelectorAll("[data-vertical-video-frame]")].filter((frame) => (frame.getAttribute("data-vertical-caption-policy") || "").length > 5).length,
      captionBands: document.querySelectorAll("[data-vertical-caption-band]").length,
      effectLayers: document.querySelectorAll("[data-vertical-effect-layer]").length,
      layoutClusters,
      ipVerticalFrames: document.querySelectorAll('[data-vertical-video-frame][data-ip-vertical-series="true"]').length,
      ipVerticalImages: document.querySelectorAll("[data-ip-vertical-image]").length,
      formulaProofs: document.querySelectorAll("[data-formula-vertical-proof]").length,
      chartProofs: document.querySelectorAll("[data-chart-vertical-proof]").length,
      contentKinds: [...new Set([...document.querySelectorAll("[data-vertical-style-card]")].map((card) => card.getAttribute("data-content-kind")).filter(Boolean))].sort(),
      realDataLabels: document.body.textContent.includes("美国 30.77T") && document.body.textContent.includes("中国 19.50T") && document.body.textContent.includes("印度 3.96T"),
      realPopulationLabels: document.body.textContent.includes("印度 14.64 亿") && document.body.textContent.includes("World Bank 2025 人口总量"),
      realFormulaLabels: document.body.textContent.includes("y=ax²+bx+c") && document.body.textContent.includes("x=-b/2a"),
      shortFormLanguage: document.body.textContent.includes("3 秒") && document.body.textContent.includes("9:16") && document.body.textContent.includes("一行字幕"),
      horizontalOverflowCount: [...document.querySelectorAll("body *")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible").length,
      frameIssues,
      thumbnailCompletenessIssues,
      textIssues,
      readabilityIssues,
      scopedLayoutIssues,
      calendarIssues,
      allVariantIssues,
    };
  });

  assert(initial.title === "竖屏风格模板", "vertical review page title must be 竖屏风格模板", failures);
  assert(initial.oldAuditCopy === false, "vertical review page must not use 风格模板审核 copy", failures);
  assert(initial.cards >= MIN_FAMILY_COUNT && initial.visibleCards >= MIN_FAMILY_COUNT, `vertical review page must render at least ${MIN_FAMILY_COUNT} visible skeleton cards`, failures);
  assert(initial.familyButtons >= MIN_FAMILY_COUNT + 1, "vertical review page must expose all family filters plus the all filter", failures);
  assert(initial.variantButtons >= MIN_TEMPLATE_COUNT && initial.variantPanels >= MIN_TEMPLATE_COUNT, `vertical review page must expose at least ${MIN_TEMPLATE_COUNT} switchable variants`, failures);
  assert(initial.verticalFrames >= MIN_TEMPLATE_COUNT, "vertical review page must render every variant as a 9:16 simulated video frame", failures);
  assert(initial.scenarioFrames >= MIN_TEMPLATE_COUNT, "each vertical frame must carry a business scenario contract", failures);
  assert(initial.dataSourceFrames >= MIN_TEMPLATE_COUNT, "each vertical frame must carry a source/data mode contract", failures);
  assert(initial.hookFrames >= MIN_TEMPLATE_COUNT, "each vertical frame must carry a 0-3s hook contract", failures);
  assert(initial.safeAreaFrames >= MIN_TEMPLATE_COUNT, "each vertical frame must carry platform safe-area data", failures);
  assert(initial.captionPolicies >= MIN_TEMPLATE_COUNT && initial.captionBands >= MIN_TEMPLATE_COUNT, "each vertical frame must render a subtitle safe band and policy", failures);
  assert(initial.effectLayers >= MIN_TEMPLATE_COUNT * 2, "each vertical frame must render background and foreground effect fallback layers", failures);
  assert(initial.layoutClusters.length >= 7, `vertical frames must use diverse layout clusters, got ${initial.layoutClusters.join(", ")}`, failures);
  assert(initial.ipVerticalFrames >= 5 && initial.ipVerticalImages >= 5, "vertical page must include a personal-IP vertical image series across variants", failures);
  assert(initial.formulaProofs >= 5 && initial.chartProofs >= 5, "vertical page must include dedicated formula and data-chart proof layouts", failures);
  assert(initial.contentKinds.length >= REQUIRED_CONTENT_KINDS.length, "vertical page must cover all required content kinds", failures);
  for (const kind of REQUIRED_CONTENT_KINDS) {
    assert(initial.contentKinds.includes(kind), `vertical page missing content kind: ${kind}`, failures);
  }
  assert(initial.realDataLabels && initial.realPopulationLabels && initial.realFormulaLabels, "vertical page must keep real data, population, and formula scenarios", failures);
  assert(initial.shortFormLanguage, "vertical page must explicitly surface short-form hook, 9:16, and one-line subtitle constraints", failures);
  assert(initial.horizontalOverflowCount === 0, "vertical review page must not have visible horizontal overflow", failures);
  assert(initial.frameIssues.length === 0, `vertical frames must preserve aspect ratio, safe areas, and non-overlap: ${initial.frameIssues.join(", ")}`, failures);
  assert(initial.thumbnailCompletenessIssues.length === 0, `vertical thumbnails must show complete 9:16 pages without clipped stage content: ${initial.thumbnailCompletenessIssues.slice(0, 40).join(", ")}`, failures);
  assert(initial.textIssues.length === 0, `vertical frame text must not be clipped: ${initial.textIssues.join(", ")}`, failures);
  assert(initial.readabilityIssues.length === 0, `vertical frame text color must remain readable on its layout background: ${initial.readabilityIssues.join(", ")}`, failures);
  assert(initial.scopedLayoutIssues.length === 0, `vertical components must not inherit horizontal absolute-position layout rules: ${initial.scopedLayoutIssues.join(", ")}`, failures);
  assert(initial.calendarIssues.length === 0, `vertical calendar pages must show complete, non-overlapping absolute dates: ${initial.calendarIssues.join(", ")}`, failures);
  assert(initial.allVariantIssues.length === 0, `all vertical variants must avoid visible debug overlays, text/content overlap, and foreground-effect coverage: ${initial.allVariantIssues.slice(0, 40).join(", ")}`, failures);

  await page.screenshot({ path: join(screenshotDir, "vertical-motion-style-review-page.png"), fullPage: true });

  const modalChecks = [];
  for (const kind of MODAL_SMOKE_KINDS) {
    const card = page.locator(`[data-vertical-style-card][data-content-kind="${kind}"]`);
    if ((await card.count()) === 0) {
      failures.push(`vertical modal smoke card missing: ${kind}`);
      continue;
    }
    const before = await card.first().evaluate((element) => ({
      activeTemplate: element.querySelector("[data-style-variant-panel]:not([hidden])")?.getAttribute("data-template-id") || "",
      hook: element.querySelector("[data-style-variant-panel]:not([hidden])")?.getAttribute("data-vertical-hook-contract") || "",
      caption: element.querySelector("[data-style-variant-panel]:not([hidden])")?.getAttribute("data-vertical-caption-policy") || "",
    }));
    await card.first().locator("[data-open-style-preview]").click();
    await page.waitForTimeout(120);
    const modal = await page.evaluate(() => ({
      open: document.querySelector("[data-style-preview-modal]")?.open === true,
      templateKind: document.querySelector("[data-style-preview-frame] .style-template-preview")?.getAttribute("data-content-kind") || "",
      hasLargePreview: Boolean(document.querySelector("[data-style-preview-frame] .vertical-template-preview.large")),
      hasVerticalFrame: Boolean(document.querySelector("[data-style-preview-frame] [data-vertical-video-frame]")),
      hook: document.querySelector("[data-style-preview-frame] [data-vertical-video-frame]")?.getAttribute("data-vertical-hook-contract") || "",
      caption: document.querySelector("[data-style-preview-frame] [data-vertical-video-frame]")?.getAttribute("data-vertical-caption-policy") || "",
      safeArea: document.querySelector("[data-style-preview-frame] [data-vertical-video-frame]")?.getAttribute("data-platform-safe-area") || "",
      videoUse: document.querySelector("[data-style-preview-video-use]")?.textContent || "",
      scenario: document.querySelector("[data-style-preview-scenario]")?.textContent || "",
      effectPlan: document.querySelector("[data-style-preview-effect-plan]")?.textContent || "",
    }));
    assert(modal.open && modal.hasLargePreview && modal.hasVerticalFrame, `vertical modal for ${kind} must open with a large 9:16 preview`, failures);
    assert(modal.templateKind === kind, `vertical modal for ${kind} must keep the same content kind`, failures);
    assert(modal.hook === before.hook && modal.caption === before.caption, `vertical modal for ${kind} must match thumbnail hook and caption policy`, failures);
    assert(modal.safeArea.length > 10, `vertical modal for ${kind} must keep safe-area metadata`, failures);
    assert(modal.videoUse.includes("竖屏短视频页"), `vertical modal for ${kind} must explain vertical video use`, failures);
    assert(modal.scenario.length > 10, `vertical modal for ${kind} must show business scenario`, failures);
    assert(modal.effectPlan.trim().length >= 6, `vertical modal for ${kind} must show effect layer plan`, failures);
    assert(!/Galacean runtime|@galacean\/effects|Vue\.js|React\.js/.test(modal.effectPlan), `vertical modal for ${kind} must not expose runtime/framework labels in effect plan`, failures);
    modalChecks.push({ kind, before, modal });
    await page.screenshot({ path: join(screenshotDir, `vertical-motion-style-review-modal-${kind}.png`), fullPage: false });
    if (kind === MODAL_SMOKE_KINDS[0]) {
      await page.screenshot({ path: join(screenshotDir, "vertical-motion-style-review-modal.png"), fullPage: false });
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }

  return { ok: failures.length === 0, failures, initial, modalChecks, screenshots: rel(screenshotDir) };
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
  assert(existsSync(htmlPath), `vertical motion style review html missing: ${htmlPath}`, failures);
  const staticFacts = existsSync(htmlPath) ? await readStaticHtmlFacts(htmlPath) : {};
  assert(staticFacts.title === "竖屏风格模板", "static html title must be 竖屏风格模板", failures);
  assert(staticFacts.verticalCards >= MIN_FAMILY_COUNT, `static html must include at least ${MIN_FAMILY_COUNT} vertical cards`, failures);
  assert(staticFacts.variantPanels >= MIN_TEMPLATE_COUNT, `static html must include at least ${MIN_TEMPLATE_COUNT} vertical variant panels`, failures);
  assert(staticFacts.verticalFrames >= MIN_TEMPLATE_COUNT, `static html must include at least ${MIN_TEMPLATE_COUNT} vertical frames`, failures);
  assert(staticFacts.businessScenarios >= MIN_TEMPLATE_COUNT, "static html must include business scenario contracts on every vertical frame", failures);
  assert(staticFacts.dataSources >= MIN_TEMPLATE_COUNT, "static html must include data/source contracts on every vertical frame", failures);
  assert(staticFacts.firstThreeHooks >= MIN_TEMPLATE_COUNT, "static html must include first-three-second hook contracts", failures);
  assert(staticFacts.hookContracts >= MIN_TEMPLATE_COUNT, "static html must include first-frame promise contracts", failures);
  assert(staticFacts.captionPolicies >= MIN_TEMPLATE_COUNT && staticFacts.captionBands >= MIN_TEMPLATE_COUNT, "static html must include vertical caption policies and bands", failures);
  assert(staticFacts.safeAreas >= MIN_TEMPLATE_COUNT, "static html must include platform safe-area metadata", failures);
  assert(staticFacts.effectLayers >= MIN_TEMPLATE_COUNT * 2, "static html must include two vertical effect layers for every frame", failures);
  assert(staticFacts.layoutClusters?.length >= 7, `static html must include diverse vertical layout clusters, got ${staticFacts.layoutClusters?.join(", ")}`, failures);
  assert(staticFacts.ipVerticalFrames >= 5, "static html must include personal-IP vertical image series frames", failures);
  assert(staticFacts.formulaProofs >= 5 && staticFacts.chartProofs >= 5, "static html must include formula and chart vertical proof layouts", failures);
  assert(staticFacts.oldAuditCopy === false, "static html must not use 风格模板审核 copy", failures);
  assert(staticFacts.visibleInternalLabels === false, "static html must not expose runtime/framework labels", failures);
  assert(staticFacts.missingContentKinds?.length === 0, `static html missing content kinds: ${staticFacts.missingContentKinds?.join(", ")}`, failures);

  let browserReport = null;
  if (existsSync(htmlPath)) {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch(chromiumLaunchOptions(chromium));
    try {
      const page = await browser.newPage({ viewport: { width: 1516, height: 960 }, deviceScaleFactor: 1 });
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
