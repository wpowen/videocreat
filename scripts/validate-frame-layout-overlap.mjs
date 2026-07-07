#!/usr/bin/env node
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_HTML_VIDEO_ROOT = resolve(ROOT, "research/html-video-research/html-video");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "json" || key === "help") {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function usage() {
  console.log(`Usage: node validate-frame-layout-overlap.mjs --out <video-output-dir> [--json]

Audits generated html-video frame HTML at 1920x1080/1080x1920 and fails when headline/body/subtitle boxes intersect visual proof, chart, image, or panel boxes, when foreground/template elements enter the caption safe area, when visible copy is clipped/truncated/off-canvas, when internal debug labels leak into viewer-facing text, when captions are not rendered through a planned style class, when empty placeholder cards are visible, or when multi-scene renders collapse into one fixed layout.`);
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function collectHtmlFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}

function frameFilesForOut(out) {
  const manifest = readJsonIfExists(join(out, "workflow", "html-video-render.json")) || {};
  if (manifest.projectStore) {
    const currentProjectFrames = join(resolve(ROOT, manifest.projectStore), "frames");
    const currentFiles = collectHtmlFiles(currentProjectFrames);
    if (currentFiles.length) return currentFiles.sort((a, b) => a.localeCompare(b));
  }
  const files = collectHtmlFiles(join(out, ".html-video", "projects"));
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

function loadPlaywright() {
  const roots = [
    process.env.HTML_VIDEO_ROOT,
    DEFAULT_HTML_VIDEO_ROOT,
  ].filter(Boolean);
  for (const root of roots) {
    const packageJson = join(root, "packages", "adapter-hyperframes", "package.json");
    if (!existsSync(packageJson)) continue;
    const require = createRequire(packageJson);
    return require("playwright");
  }
  const require = createRequire(import.meta.url);
  return require("playwright");
}

async function auditFrame(page, framePath, out) {
  await page.goto(pathToFileURL(framePath).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = Math.min(1800, Math.max(1200, animation.effect?.getTiming?.().duration || 1800));
    }
  });

  return page.evaluate((relativeFramePath) => {
    const textSelectors = [".headline", ".body", ".content-brief", ".subtitle", ".caption-cue-text"];
    const readableTextSelectors = [
      ".headline",
      ".body",
      ".content-brief",
      ".content-brief p",
      ".content-points span",
      ".subtitle",
      ".caption-cue-text",
      ".scene-motion-board",
      ".scene-motion-board header",
      ".scene-motion-board footer",
      ".scene-motion-board article",
      ".scene-motion-board strong",
      ".scene-motion-board span",
      ".ip-diagram-board",
      ".ip-diagram-panel",
      ".ip-diagram-panel span",
      ".ip-persona-scene span",
      ".ip-agent-row span",
      ".ip-template-nodes span",
      ".capability-proof article",
      ".capability-proof header",
      ".capability-proof strong",
      ".capability-proof span",
      ".data-showcase article",
      ".formula-showcase article",
      ".mg-panel",
      ".mg-panel header",
      ".motion-note",
      ".platform-overlay",
    ];
    const visualSelectors = [
      ".capability-proof",
      ".data-showcase",
      ".formula-showcase",
      ".visual-plate",
      ".scene-motion-board",
      ".ip-diagram-board",
      ".ip-template-motion-layer",
      ".ip-whiteboard-sketch-layer",
      ".galacean-effect-layer .galacean-beam",
      ".galacean-effect-layer .galacean-focus",
      ".galacean-effect-layer .galacean-burst",
      ".galacean-effect-layer .galacean-particles span",
      ".platform-overlay",
      ".mg-panel",
      ".motion-note",
      ".style-signature",
    ];
    const captionSafeAreaSelectors = [
      ".subtitle",
    ];
    const captionAvoidanceSelectors = [
      ".headline",
      ".body.content-brief",
      ".content-brief .content-eyebrow",
      ".content-brief p",
      ".content-points span",
      ".scene-motion-board",
      ".scene-motion-board header",
      ".scene-motion-board footer",
      ".scene-motion-board article",
      ".ip-diagram-board",
      ".ip-diagram-panel",
      ".ip-diagram-panel span",
      ".ip-persona-scene",
      ".ip-persona-scene span",
      ".ip-agent-row",
      ".ip-agent-row span",
      ".ip-template-motion-layer",
      ".ip-template-nodes span",
      ".ip-whiteboard-sketch-layer",
      ".template-contrast-grid",
      ".template-contrast-grid article",
      ".template-proof-stack",
      ".template-proof-stack article",
      ".template-timeline-track",
      ".template-timeline-track article",
      ".template-resolution-mark",
      ".galacean-effect-layer .galacean-beam",
      ".galacean-effect-layer .galacean-focus",
      ".galacean-effect-layer .galacean-burst",
      ".galacean-effect-layer .galacean-particles span",
      ".capability-proof",
      ".capability-proof header",
      ".capability-proof article",
      ".data-showcase",
      ".formula-showcase",
      ".mg-panel",
      ".motion-note",
      ".platform-overlay",
      ".style-signature",
      ".progress",
    ];
    const forbiddenTextPatterns = [
      { id: "threejs-depth-route", pattern: /Three\.js\s+depth\s+route/i },
      { id: "trace-js", pattern: /Trace\s*JS/i },
      { id: "spatial-fallback", pattern: /2\.5D\s+spatial\s+fallback/i },
      { id: "orbit-camera", pattern: /orbit\s+camera/i },
      { id: "frame-driven", pattern: /frame-driven/i },
      { id: "gsap-exception-gate", pattern: /GSAP\s+exception\s+gate/i },
      { id: "lottie-loop", pattern: /Authored\s+Lottie\s+loop/i },
      { id: "website-source-structure", pattern: /Website\s+source\s+structure/i },
      { id: "authorized-footage", pattern: /Authorized\s+footage/i },
      { id: "product-design-route", pattern: /product-design\s+route/i },
      { id: "inventory-edl", pattern: /inventory\s*->\s*EDL/i },
      { id: "loop-local-authored", pattern: /loop\s*\/\s*local\s*\/\s*authored/i },
      { id: "sync-timecode", pattern: /sync-timecode/i },
      { id: "workflow-path", pattern: /workflow\//i },
      { id: "script-filename", pattern: /\.mjs\b/i },
      { id: "json-filename", pattern: /\.json\b/i },
      { id: "process-no-voiceover", pattern: /无口播|no\s*voiceover/i },
      { id: "process-strong-motion", pattern: /强动效|heavy\s*motion|motion[-\s]*rich/i },
      { id: "process-vertical-short", pattern: /竖屏短视频|vertical\s*short|9\s*:\s*16/i },
      { id: "process-local-render", pattern: /本地渲染|local\s*render|original\s+local\s+render/i },
      { id: "process-no-logos", pattern: /无\s*logo|无\s*商标|no\s*logos?/i },
      { id: "process-renderer-label", pattern: /\b(?:renderer|rendered\s+by|playwright|ffmpeg|html-video|hyperframes)\b/i },
      { id: "process-qc-label", pattern: /\b(?:QC|quality\s*check|logs?\/|delivery\s+page)\b/i },
      { id: "process-practical-ranking", pattern: /practical\s+ranking/i },
      { id: "raw-motion-component-ranked-bars", pattern: /\branked-bars\b/i },
      { id: "raw-motion-component-causal-chain", pattern: /\bcausal-chain\b/i },
      { id: "raw-motion-component-contrast-swap", pattern: /\bcontrast-swap\b/i },
      { id: "raw-motion-component-trend-line", pattern: /\btrend-line\b/i },
      { id: "raw-scene-job-product-demo", pattern: /\bproductDemo\b/i },
      { id: "raw-scene-job-data-proof", pattern: /\bdataProof\b/i },
      { id: "raw-semantic-info-method", pattern: /\bmethod\s*·\s*(?:productDemo|dataProof)\b/i },
      { id: "raw-semantic-info-summary", pattern: /\bsummary\s*·\s*(?:productDemo|dataProof)\b/i },
    ];
    const technologyStackLeakPatterns = [
      { id: "vue-js", pattern: /\bVue(?:\.js)?\b/ },
      { id: "react-js", pattern: /\bReact(?:\.js)?\b/ },
      { id: "next-js", pattern: /\bNext(?:\.js)?\b/ },
      { id: "nuxt-js", pattern: /\bNuxt(?:\.js)?\b/ },
      { id: "angular", pattern: /\bAngular\b/ },
      { id: "svelte", pattern: /\bSvelte\b/ },
      { id: "tailwind", pattern: /\bTailwind(?:\s+CSS)?\b/i },
      { id: "framer-motion", pattern: /\bFramer\s+Motion\b/i },
      { id: "gsap", pattern: /\bGSAP\b/ },
      { id: "three-js", pattern: /\bThree(?:\.js)?\b/ },
      { id: "d3-js", pattern: /\bD3(?:\.js)?\b/ },
      { id: "manim", pattern: /\bManim\b/i },
      { id: "lottie", pattern: /\bLottie\b/i },
      { id: "vite", pattern: /\bVite\b/ },
    ];

    function visibleElements(selector) {
      return [...document.querySelectorAll(selector)].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0.03
          && rect.width > 2
          && rect.height > 2;
      });
    }

    function rectFor(element) {
      const rect = element.getBoundingClientRect();
      return {
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      };
    }

    function area(rect) {
      return Math.max(0, rect.width) * Math.max(0, rect.height);
    }

    function intersection(a, b) {
      const left = Math.max(a.left, b.left);
      const top = Math.max(a.top, b.top);
      const right = Math.min(a.right, b.right);
      const bottom = Math.min(a.bottom, b.bottom);
      const width = Math.max(0, right - left);
      const height = Math.max(0, bottom - top);
      return { left, top, right, bottom, width, height, area: width * height };
    }

    function labelFor(element) {
      const cls = String(element.className || "").replace(/\s+/g, ".").replace(/^\./, "");
      const id = element.id ? `#${element.id}` : "";
      return `${element.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""}`;
    }

    function textContentFor(element) {
      return String(element.textContent || "").replace(/\s+/g, " ").trim();
    }

    function classListFor(element) {
      return [...(element?.classList || [])];
    }

    function firstClassWithPrefix(element, prefix) {
      return classListFor(element).find((className) => className.startsWith(prefix)) || "";
    }

    function clippedReason(element, rect) {
      const style = getComputedStyle(element);
      const tolerance = 8;
      const horizontalOverflow = element.scrollWidth - element.clientWidth;
      const verticalOverflow = element.scrollHeight - element.clientHeight;
      const clipsX = !["visible", ""].includes(style.overflowX);
      const clipsY = !["visible", ""].includes(style.overflowY);
      const reasons = [];
      if (((horizontalOverflow > tolerance && clipsX) || (verticalOverflow > tolerance && clipsY)) && element.dataset.layoutOverflow) reasons.push(element.dataset.layoutOverflow);
      if (horizontalOverflow > tolerance && clipsX) reasons.push("horizontal-scroll-overflow");
      if (verticalOverflow > tolerance && clipsY) reasons.push("vertical-scroll-overflow");
      if (style.textOverflow === "ellipsis") reasons.push("css-ellipsis");
      if (rect.left < -tolerance || rect.top < -tolerance || rect.right > window.innerWidth + tolerance || rect.bottom > window.innerHeight + tolerance) {
        reasons.push("text-outside-canvas");
      }
      return reasons;
    }

    const collisions = [];
    const textIntegrityIssues = [];
    const forbiddenTextIssues = [];
    const technologyStackLeakIssues = [];
    const viewerChromeIssues = [];
    const captionStyleIssues = [];
    const captionTemplateOverlapIssues = [];
    const emptyPlaceholderIssues = [];
    const stage = document.querySelector(".stage");
    const stageClasses = classListFor(stage);
    const layoutVariant = stage?.dataset?.layoutVariant
      || firstClassWithPrefix(stage, "variant-").replace(/^variant-/, "")
      || "";
    const motionTemplate = stage?.dataset?.motionTemplate
      || firstClassWithPrefix(stage, "motion-template-").replace(/^motion-template-/, "")
      || "";
    const templateVisual = stage?.dataset?.templateVisual
      || document.querySelector(".scene-motion-board")?.dataset?.motionBoard
      || document.querySelector(".ip-template-motion-layer")?.dataset?.motionBoard
      || "";
    const captionRenderer = stage?.dataset?.captionRenderer
      || stageClasses.filter((className) =>
        className.startsWith("caption-style-")
        || className.startsWith("caption-group-")
        || className.startsWith("caption-motion-")
      ).join(" ")
      || "";
    const textElements = textSelectors.flatMap((selector) => visibleElements(selector).map((element) => ({ selector, element })));
    const visualElements = visualSelectors.flatMap((selector) => visibleElements(selector).map((element) => ({ selector, element })));
    const captionSafeAreas = captionSafeAreaSelectors.flatMap((selector) => visibleElements(selector).map((element) => ({ selector, element })));
    const captionAvoidanceElements = captionAvoidanceSelectors.flatMap((selector) => visibleElements(selector).map((element) => ({ selector, element })));

    if (stageClasses.includes("has-template-scene-visual")) {
      const requiredGapPx = 40;
      const headlineElements = visibleElements(".headline");
      const bodyElements = visibleElements(".body.content-brief, .body");
      for (const headline of headlineElements) {
        const headlineRect = rectFor(headline);
        for (const body of bodyElements) {
          if (headline === body) continue;
          if (headline.contains(body) || body.contains(headline)) continue;
          const bodyRect = rectFor(body);
          const overlap = intersection(headlineRect, bodyRect);
          const horizontalOverlap = Math.max(0, Math.min(headlineRect.right, bodyRect.right) - Math.max(headlineRect.left, bodyRect.left));
          const horizontalOverlapRatio = horizontalOverlap / Math.max(1, Math.min(headlineRect.width, bodyRect.width));
          if (horizontalOverlapRatio < 0.25) continue;
          const verticalGap = Number((bodyRect.top - headlineRect.bottom).toFixed(2));
          if (overlap.area > 8 || verticalGap < requiredGapPx) {
            collisions.push({
              type: "template-left-copy-stack-overlap",
              frame: relativeFramePath,
              headlineElement: labelFor(headline),
              bodyElement: labelFor(body),
              motionTemplate,
              layoutVariant,
              templateVisual,
              verticalGapPx: verticalGap,
              requiredGapPx,
              horizontalOverlapRatio: Number(horizontalOverlapRatio.toFixed(4)),
              intersectionArea: Number(overlap.area.toFixed(2)),
              headlineRect,
              bodyRect,
            });
          }
        }
      }
    }

    const readableItems = readableTextSelectors.flatMap((selector) => visibleElements(selector).map((element) => ({ selector, element })));
    for (const item of readableItems) {
      const text = textContentFor(item.element);
      if (!text) continue;
      const rect = rectFor(item.element);
      for (const forbidden of forbiddenTextPatterns) {
        if (forbidden.pattern.test(text)) {
          forbiddenTextIssues.push({
            type: "internal-debug-label-visible",
            frame: relativeFramePath,
            selector: item.selector,
            element: labelFor(item.element),
            patternId: forbidden.id,
            text,
            rect,
          });
        }
      }
      for (const technology of technologyStackLeakPatterns) {
        if (technology.pattern.test(text)) {
          technologyStackLeakIssues.push({
            type: "technology-stack-label-visible",
            frame: relativeFramePath,
            selector: item.selector,
            element: labelFor(item.element),
            patternId: technology.id,
            text,
            rect,
          });
        }
      }
      const reasons = clippedReason(item.element, rect);
      if (reasons.length) {
        textIntegrityIssues.push({
          type: "text-not-fully-visible",
          frame: relativeFramePath,
          selector: item.selector,
          element: labelFor(item.element),
          reasons: [...new Set(reasons)],
          text,
          rect,
          clientWidth: item.element.clientWidth,
          clientHeight: item.element.clientHeight,
          scrollWidth: item.element.scrollWidth,
          scrollHeight: item.element.scrollHeight,
        });
      }
    }

    for (const top of visibleElements(".top")) {
      const text = textContentFor(top);
      if (!text) continue;
      const rect = rectFor(top);
      viewerChromeIssues.push({
        type: "unauthorized-viewer-chrome",
        frame: relativeFramePath,
        element: labelFor(top),
        text,
        rect,
      });
      for (const forbidden of forbiddenTextPatterns) {
        if (forbidden.pattern.test(text)) {
          forbiddenTextIssues.push({
            type: "internal-debug-label-visible",
            frame: relativeFramePath,
            selector: ".top",
            element: labelFor(top),
            patternId: forbidden.id,
            text,
            rect,
          });
        }
      }
      for (const technology of technologyStackLeakPatterns) {
        if (technology.pattern.test(text)) {
          technologyStackLeakIssues.push({
            type: "technology-stack-label-visible",
            frame: relativeFramePath,
            selector: ".top",
            element: labelFor(top),
            patternId: technology.id,
            text,
            rect,
          });
        }
      }
    }

    const fullVisibleText = textContentFor(document.body);
    for (const forbidden of forbiddenTextPatterns) {
      if (forbidden.pattern.test(fullVisibleText)
        && !forbiddenTextIssues.some((issue) => issue.patternId === forbidden.id)) {
        forbiddenTextIssues.push({
          type: "internal-debug-label-visible",
          frame: relativeFramePath,
          selector: "body",
          element: "body",
          patternId: forbidden.id,
          text: fullVisibleText.slice(0, 320),
          rect: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight },
        });
      }
    }
    for (const technology of technologyStackLeakPatterns) {
      if (technology.pattern.test(fullVisibleText)
        && !technologyStackLeakIssues.some((issue) => issue.patternId === technology.id)) {
        technologyStackLeakIssues.push({
          type: "technology-stack-label-visible",
          frame: relativeFramePath,
          selector: "body",
          element: "body",
          patternId: technology.id,
          text: fullVisibleText.slice(0, 320),
          rect: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight },
        });
      }
    }

    for (const subtitle of visibleElements(".subtitle")) {
      const text = textContentFor(subtitle);
      if (!text) continue;
      if (!captionRenderer || !stageClasses.some((className) => className.startsWith("caption-style-"))) {
        captionStyleIssues.push({
          type: "caption-style-class-missing",
          frame: relativeFramePath,
          element: labelFor(subtitle),
          text,
          captionRenderer,
          stageClasses,
        });
      }
    }

    for (const placeholder of visibleElements(".browser-shell main b, .browser-shell main article, .product-console article, .visual-placeholder, [data-placeholder='empty']")) {
      const text = textContentFor(placeholder);
      const hasRealMedia = Boolean(placeholder.querySelector("img,svg,video,canvas"));
      const rect = rectFor(placeholder);
      if (!text && !hasRealMedia && rect.width * rect.height > 1800) {
        emptyPlaceholderIssues.push({
          type: "empty-placeholder-card-visible",
          frame: relativeFramePath,
          element: labelFor(placeholder),
          rect,
        });
      }
    }

    for (const text of textElements) {
      const textRect = rectFor(text.element);
      for (const visual of visualElements) {
        if (text.element === visual.element) continue;
        if (text.element.contains(visual.element) || visual.element.contains(text.element)) continue;
        const visualRect = rectFor(visual.element);
        const overlap = intersection(textRect, visualRect);
        const minArea = Math.max(1, Math.min(area(textRect), area(visualRect)));
        const ratio = overlap.area / minArea;
        if (overlap.area > 12 && ratio > 0.012) {
          collisions.push({
            type: "text-visual-overlap",
            frame: relativeFramePath,
            textSelector: text.selector,
            textElement: labelFor(text.element),
            visualSelector: visual.selector,
            visualElement: labelFor(visual.element),
            intersectionArea: Number(overlap.area.toFixed(2)),
            intersectionRatioOfSmallerBox: Number(ratio.toFixed(4)),
            textRect,
            visualRect,
          });
        }
      }
    }

    for (const captionArea of captionSafeAreas) {
      const captionRect = rectFor(captionArea.element);
      for (const foreground of captionAvoidanceElements) {
        if (captionArea.element === foreground.element) continue;
        if (captionArea.element.contains(foreground.element) || foreground.element.contains(captionArea.element)) continue;
        const foregroundRect = rectFor(foreground.element);
        const overlap = intersection(captionRect, foregroundRect);
        const minArea = Math.max(1, Math.min(area(captionRect), area(foregroundRect)));
        const ratio = overlap.area / minArea;
        if (overlap.area > 24 && ratio > 0.01) {
          captionTemplateOverlapIssues.push({
            type: "caption-safe-area-overlap",
            frame: relativeFramePath,
            captionSelector: captionArea.selector,
            captionElement: labelFor(captionArea.element),
            foregroundSelector: foreground.selector,
            foregroundElement: labelFor(foreground.element),
            foregroundText: textContentFor(foreground.element).slice(0, 160),
            intersectionArea: Number(overlap.area.toFixed(2)),
            intersectionRatioOfSmallerBox: Number(ratio.toFixed(4)),
            captionRect,
            foregroundRect,
          });
        }
      }
    }

    const exceptionArticles = visibleElements(".exception-gate article");
    for (let i = 0; i < exceptionArticles.length; i += 1) {
      for (let j = i + 1; j < exceptionArticles.length; j += 1) {
        const firstRect = rectFor(exceptionArticles[i]);
        const secondRect = rectFor(exceptionArticles[j]);
        const overlap = intersection(firstRect, secondRect);
        const minArea = Math.max(1, Math.min(area(firstRect), area(secondRect)));
        const ratio = overlap.area / minArea;
        if (overlap.area > 12 && ratio > 0.012) {
          collisions.push({
            type: "exception-gate-card-overlap",
            frame: relativeFramePath,
            firstElement: labelFor(exceptionArticles[i]),
            secondElement: labelFor(exceptionArticles[j]),
            intersectionArea: Number(overlap.area.toFixed(2)),
            intersectionRatioOfSmallerBox: Number(ratio.toFixed(4)),
            firstRect,
            secondRect,
          });
        }
      }
    }

    return {
      frame: relativeFramePath,
      layoutVariant,
      motionTemplate,
      templateVisual,
      captionRenderer,
      stageClasses,
      textBoxes: textElements.length,
      visualBoxes: visualElements.length,
      textIntegrityIssueCount: textIntegrityIssues.length,
      forbiddenTextIssueCount: forbiddenTextIssues.length,
      technologyStackLeakIssueCount: technologyStackLeakIssues.length,
      viewerChromeIssueCount: viewerChromeIssues.length,
      captionStyleIssueCount: captionStyleIssues.length,
      captionTemplateOverlapIssueCount: captionTemplateOverlapIssues.length,
      emptyPlaceholderIssueCount: emptyPlaceholderIssues.length,
      collisions,
      textIntegrityIssues,
      forbiddenTextIssues,
      technologyStackLeakIssues,
      viewerChromeIssues,
      captionStyleIssues,
      captionTemplateOverlapIssues,
      emptyPlaceholderIssues,
    };
  }, relative(out, framePath));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const out = resolve(ROOT, args.out);
  const artifactPath = join(out, "workflow", "frame-layout-overlap-audit.json");
  const frames = frameFilesForOut(out);
  if (!frames.length) {
    const artifact = {
      schemaVersion: 1,
      status: "unavailable",
      reason: "No generated html-video frame HTML files were found.",
      checkedFrames: 0,
      collisions: [],
    };
    writeJson(artifactPath, artifact);
    if (args.json) console.log(JSON.stringify(artifact));
    process.exit(2);
  }

  let playwright;
  try {
    playwright = loadPlaywright();
  } catch (error) {
    const artifact = {
      schemaVersion: 1,
      status: "unavailable",
      reason: `Playwright is not available: ${error.message}`,
      checkedFrames: 0,
      collisions: [],
    };
    writeJson(artifactPath, artifact);
    if (args.json) console.log(JSON.stringify(artifact));
    process.exit(2);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const canvas = readJsonIfExists(join(out, "brief.json"))?.canvas || {};
  const page = await browser.newPage({
    viewport: {
      width: Number(canvas.width || 1920),
      height: Number(canvas.height || 1080),
    },
    deviceScaleFactor: 1,
  });

  const frameResults = [];
  try {
    for (const frame of frames) {
      frameResults.push(await auditFrame(page, frame, out));
    }
  } finally {
    await browser.close();
  }

  const collisions = frameResults.flatMap((result) => result.collisions);
  const textIntegrityIssues = frameResults.flatMap((result) => result.textIntegrityIssues);
  const forbiddenTextIssues = frameResults.flatMap((result) => result.forbiddenTextIssues);
  const technologyStackLeakIssues = frameResults.flatMap((result) => result.technologyStackLeakIssues);
  const viewerChromeIssues = frameResults.flatMap((result) => result.viewerChromeIssues);
  const captionStyleIssues = frameResults.flatMap((result) => result.captionStyleIssues);
  const captionTemplateOverlapIssues = frameResults.flatMap((result) => result.captionTemplateOverlapIssues);
  const emptyPlaceholderIssues = frameResults.flatMap((result) => result.emptyPlaceholderIssues);
  const layoutVariants = [...new Set(frameResults.map((result) => result.layoutVariant).filter(Boolean))];
  const motionTemplates = [...new Set(frameResults.map((result) => result.motionTemplate).filter(Boolean))];
  const templateVisuals = [...new Set(frameResults.map((result) => result.templateVisual).filter(Boolean))];
  const captionRenderers = [...new Set(frameResults.map((result) => result.captionRenderer).filter(Boolean))];
  const repeatedLayoutIssues = [];
  if (frameResults.length >= 4 && layoutVariants.length < 2) {
    repeatedLayoutIssues.push({
      type: "fixed-layout-variant",
      checkedFrames: frameResults.length,
      uniqueLayoutVariantCount: layoutVariants.length,
      layoutVariants,
      reason: "Multi-scene renders must not collapse into one fixed left-text/right-visual layout.",
    });
  }
  const templateVisualIssues = [];
  const templateVisualEligibleFrames = frameResults.filter((result) => {
    const classes = new Set(result.stageClasses || []);
    return !classes.has("has-generated-visual")
      && !classes.has("has-stock-visual")
      && !classes.has("capability-visual-stage")
      && !classes.has("data-viz-stage")
      && !classes.has("formula-viz-stage")
      && !classes.has("ip-diagram-creator-stage")
      && !classes.has("explainer-board-stage");
  });
  const templateVisualEligibleCount = templateVisualEligibleFrames.length;
  const templateVisualMissingCount = templateVisualEligibleFrames.filter((result) => !result.templateVisual).length;
  const eligibleTemplateVisuals = [...new Set(templateVisualEligibleFrames.map((result) => result.templateVisual).filter(Boolean))];
  if (templateVisualEligibleCount >= 4 && templateVisualMissingCount > Math.floor(templateVisualEligibleCount * 0.2)) {
    templateVisualIssues.push({
      type: "template-visual-not-rendered",
      checkedFrames: frameResults.length,
      eligibleFrames: templateVisualEligibleCount,
      missingTemplateVisualFrames: templateVisualMissingCount,
      reason: "Plain full-auto frames must render the selected motion/template decision into an actual scene-motion-board, not only record it in JSON.",
    });
  }
  if (templateVisualEligibleCount >= 4 && eligibleTemplateVisuals.length < Math.min(2, templateVisualEligibleCount)) {
    templateVisualIssues.push({
      type: "template-visual-collapsed",
      checkedFrames: frameResults.length,
      eligibleFrames: templateVisualEligibleCount,
      uniqueTemplateVisualCount: eligibleTemplateVisuals.length,
      templateVisuals: eligibleTemplateVisuals,
      reason: "Multi-scene renders must vary the visible template-driven visual structure across content roles.",
    });
  }
  const artifact = {
    schemaVersion: 1,
    status: collisions.length
      || textIntegrityIssues.length
      || forbiddenTextIssues.length
      || technologyStackLeakIssues.length
      || viewerChromeIssues.length
      || captionStyleIssues.length
      || captionTemplateOverlapIssues.length
      || emptyPlaceholderIssues.length
      || repeatedLayoutIssues.length
      || templateVisualIssues.length
      ? "fail"
      : "pass",
    audit: "frame-layout-copy-integrity-debug-leak-tech-stack-caption-style-template-visual-and-layout-diversity",
    checkedFrames: frameResults.length,
    collisionCount: collisions.length,
    textIntegrityIssueCount: textIntegrityIssues.length,
    forbiddenTextIssueCount: forbiddenTextIssues.length,
    technologyStackLeakIssueCount: technologyStackLeakIssues.length,
    viewerChromeIssueCount: viewerChromeIssues.length,
    captionStyleIssueCount: captionStyleIssues.length,
    captionTemplateOverlapIssueCount: captionTemplateOverlapIssues.length,
    emptyPlaceholderIssueCount: emptyPlaceholderIssues.length,
    repeatedLayoutIssueCount: repeatedLayoutIssues.length,
    templateVisualIssueCount: templateVisualIssues.length,
    uniqueLayoutVariantCount: layoutVariants.length,
    uniqueMotionTemplateCount: motionTemplates.length,
    uniqueTemplateVisualCount: templateVisuals.length,
    templateVisualEligibleCount,
    templateVisualMissingCount,
    uniqueCaptionRendererCount: captionRenderers.length,
    layoutVariants,
    motionTemplates,
    templateVisuals,
    captionRenderers,
    collisions,
    textIntegrityIssues,
    forbiddenTextIssues,
    technologyStackLeakIssues,
    viewerChromeIssues,
    captionStyleIssues,
    captionTemplateOverlapIssues,
    emptyPlaceholderIssues,
    repeatedLayoutIssues,
    templateVisualIssues,
    frameResults: frameResults.map((result) => ({
      frame: result.frame,
      layoutVariant: result.layoutVariant,
      motionTemplate: result.motionTemplate,
      templateVisual: result.templateVisual,
      captionRenderer: result.captionRenderer,
      textBoxes: result.textBoxes,
      visualBoxes: result.visualBoxes,
      collisionCount: result.collisions.length,
      textIntegrityIssueCount: result.textIntegrityIssues.length,
      forbiddenTextIssueCount: result.forbiddenTextIssues.length,
      technologyStackLeakIssueCount: result.technologyStackLeakIssues.length,
      viewerChromeIssueCount: result.viewerChromeIssues.length,
      captionStyleIssueCount: result.captionStyleIssues.length,
      captionTemplateOverlapIssueCount: result.captionTemplateOverlapIssues.length,
      emptyPlaceholderIssueCount: result.emptyPlaceholderIssues.length,
    })),
  };
  writeJson(artifactPath, artifact);
  if (args.json) console.log(JSON.stringify({
    status: artifact.status,
    checkedFrames: artifact.checkedFrames,
    collisionCount: artifact.collisionCount,
    textIntegrityIssueCount: artifact.textIntegrityIssueCount,
    forbiddenTextIssueCount: artifact.forbiddenTextIssueCount,
    technologyStackLeakIssueCount: artifact.technologyStackLeakIssueCount,
    viewerChromeIssueCount: artifact.viewerChromeIssueCount,
    captionStyleIssueCount: artifact.captionStyleIssueCount,
    captionTemplateOverlapIssueCount: artifact.captionTemplateOverlapIssueCount,
    emptyPlaceholderIssueCount: artifact.emptyPlaceholderIssueCount,
    repeatedLayoutIssueCount: artifact.repeatedLayoutIssueCount,
    templateVisualIssueCount: artifact.templateVisualIssueCount,
    uniqueLayoutVariantCount: artifact.uniqueLayoutVariantCount,
    uniqueMotionTemplateCount: artifact.uniqueMotionTemplateCount,
    uniqueTemplateVisualCount: artifact.uniqueTemplateVisualCount,
    uniqueCaptionRendererCount: artifact.uniqueCaptionRendererCount,
  }));
  process.exit(artifact.status === "pass" ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
