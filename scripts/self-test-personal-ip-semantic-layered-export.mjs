#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(process.argv[2] || join(ROOT, "research", "personal-ip-semantic-layered-self-test"));
const ASPECT = String(process.argv[3] || "9:16");
const CANVAS = ASPECT === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
const PLAYWRIGHT_MODULES = "/Users/example/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const requireFromRuntime = createRequire(resolve(PLAYWRIGHT_MODULES, "playwright/package.json"));
const { chromium } = requireFromRuntime("playwright");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}

function intersects(a, b, tolerance = 0) {
  return a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}

rmSync(OUT, { recursive: true, force: true });
const specPath = `${OUT}-spec.json`;
writeFileSync(specPath, `${JSON.stringify({
  title: "个人 IP 语义分层回归测试",
  subtitle: "真实 brief 的长文案也必须留在标题安全区，不能侵入人物或被裁切。",
  hookItems: [
    { icon: "?", label: "信息差", body: "先让观众看见未知信息" },
    { icon: "!", label: "压力升级", body: "沿清晰路径逐层升级压力" },
    { icon: "△", label: "行动规则", body: "最终态必须保留全部信息" },
  ],
  routeItems: [
    { icon: "◴", label: "建立问题", body: "给出明确且可读的起始状态" },
    { icon: "⌁", label: "逐层展开", body: "内容卡依次出现并保持层级" },
    { icon: "▣", label: "验证收束", body: "检查越界遮挡缺失与视频解码" },
  ],
  takeaway: "分层不是切片，而是语义所有权。",
}, null, 2)}\n`, "utf8");
run("node", [
  "scripts/export-personal-ip-semantic-layered-video.mjs",
  "--out", OUT,
  "--duration", "4",
  "--fps", "10",
  "--title", "个人 IP 语义分层回归测试",
  "--spec", specPath,
  "--aspect", ASPECT,
]);

const manifestPath = join(OUT, "workflow", "personal-ip-semantic-layer-manifest.json");
const qcPath = join(OUT, "logs", "qc.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const qc = JSON.parse(readFileSync(qcPath, "utf8"));

assert(manifest.route === "personal-ip-semantic-layers-svg-html-video", "wrong semantic-layer route");
assert(manifest.canonicalSource === "semantic-layer-scene", "semantic scene is not canonical");
assert(manifest.flatCompositeBaseForbidden === true, "flat composite base must be forbidden");
assert(manifest.canvas.aspectRatio === ASPECT, `expected ${ASPECT}, got ${manifest.canvas.aspectRatio}`);
assert(manifest.layers.length === 7, `expected 7 SVG layers, got ${manifest.layers.length}`);
assert(manifest.layers.every((layer) => existsSync(join(OUT, layer.svg))), "one or more independent SVG layers are missing");
assert(existsSync(join(OUT, manifest.html)), "interactive HTML is missing");
assert(existsSync(join(OUT, manifest.combinedSvg)), "combined SVG is missing");
assert(existsSync(join(OUT, "final.mp4")), "final video is missing");
assert(qc.pass === true && qc.checks.videoDecodes === true, "exported video did not pass decode QC");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(join(OUT, "index.html")).href}?render=1`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

const checkpoints = [0, 0.12, 0.28, 0.46, 0.64, 0.82, 1];
const checkpointResults = [];
for (const progress of checkpoints) {
  await page.evaluate((value) => window.motion.setProgress(value), progress);
  const result = await page.evaluate(() => {
    const box = (selector) => {
      const node = document.querySelector(selector);
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, opacity: Number(style.opacity), visibility: style.visibility };
    };
    const svg = document.querySelector("svg").getBoundingClientRect();
    const visibleRequired = [...document.querySelectorAll("[data-required-final]")].filter((node) => {
      const style = getComputedStyle(node);
      return Number(style.opacity) > 0.95 && style.visibility !== "hidden";
    }).map((node) => node.id);
    return {
      progress: document.querySelector("#stage").dataset.progress,
      svg: { left: svg.left, top: svg.top, right: svg.right, bottom: svg.bottom },
      headline: box("#layer-headline"),
      persona: box("#layer-persona"),
      board: box("#content-board-bg"),
      caption: box("#layer-caption"),
      requiredCount: document.querySelectorAll("[data-required-final]").length,
      visibleRequired,
      containedTextFailures: [...document.querySelectorAll("[data-item]")].flatMap((group) => {
        const card = group.querySelector("[data-card-box]");
        if (!card) return [];
        const cardBox = card.getBBox();
        return [...group.querySelectorAll("[data-contained-text]")].filter((text) => {
          const box = text.getBBox();
          return box.x < cardBox.x + 8 || box.y < cardBox.y + 8 || box.x + box.width > cardBox.x + cardBox.width - 8 || box.y + box.height > cardBox.y + cardBox.height - 8;
        }).map((text) => `${group.id}:${text.textContent}`);
      }),
      routeBeforeCards: [...document.querySelector("#layer-upgrade-route").children].findIndex((node) => node.id === "route-stroke") < [...document.querySelector("#layer-upgrade-route").children].findIndex((node) => node.id === "route-1"),
      captionIsLastLayer: document.querySelector("svg").lastElementChild?.id === "layer-caption",
    };
  });
  assert(result.progress === progress.toFixed(3), `timeline did not reach ${progress}`);
  for (const [name, box] of Object.entries({ headline: result.headline, persona: result.persona, board: result.board, caption: result.caption })) {
    assert(box.left >= result.svg.left - 1 && box.top >= result.svg.top - 1 && box.right <= result.svg.right + 1 && box.bottom <= result.svg.bottom + 1, `${name} escapes canvas at ${progress}`);
  }
  assert(!intersects(result.headline, result.persona, 4), `headline overlaps persona at ${progress}`);
  assert(!intersects(result.persona, result.board, 4), `persona overlaps content board at ${progress}`);
  assert(!intersects(result.board, result.caption, 4), `content board overlaps caption at ${progress}`);
  assert(result.containedTextFailures.length === 0, `text escapes its card at ${progress}: ${result.containedTextFailures.join(", ")}`);
  assert(result.routeBeforeCards, "upgrade path must render behind route cards");
  assert(result.captionIsLastLayer, "caption must be the topmost SVG layer");
  if (progress === 1) assert(result.visibleRequired.length === result.requiredCount, "one or more required final layers are missing");
  checkpointResults.push({ progress, visibleRequired: result.visibleRequired });
}

const reducedPage = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
await reducedPage.emulateMedia({ reducedMotion: "reduce" });
await reducedPage.goto(`${pathToFileURL(join(OUT, "index.html")).href}?render=1`, { waitUntil: "load" });
const reduced = await reducedPage.evaluate(() => ({ progress: document.querySelector("#stage").dataset.progress, reduced: window.motion.reducedMotion }));
assert(reduced.reduced === true && reduced.progress === "1.000", "reduced-motion mode must render the complete final state");
await browser.close();

const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", join(OUT, "final.mp4")]));
const video = probe.streams.find((stream) => stream.codec_type === "video");
assert(video?.width === CANVAS.width && video?.height === CANVAS.height, `final video must be ${CANVAS.width}x${CANVAS.height}`);

process.stdout.write(`${JSON.stringify({
  pass: true,
  route: manifest.route,
  aspectRatio: ASPECT,
  independentSvgLayers: manifest.layers.length,
  checkpoints: checkpointResults,
  reducedMotionFinalState: true,
  video: { width: video.width, height: video.height, decodes: true },
  out: OUT,
}, null, 2)}\n`);
