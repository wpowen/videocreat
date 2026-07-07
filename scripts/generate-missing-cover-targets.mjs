#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function targetSpec(targetId) {
  const specs = {
    "horizontal-4x3-1600x1200": {
      fileStem: "cover-horizontal-4x3-1600x1200",
      group: "横版4比3",
      platform: "Generic horizontal 4:3",
      layout: "horizontalTall",
    },
    "bilibili-common-1146x717": {
      fileStem: "cover-bilibili-1146x717",
      group: "B站封面",
      platform: "Bilibili common 1146x717",
      layout: "bilibili",
    },
    "vertical-1080x1920": {
      fileStem: "cover-vertical-1080x1920",
      group: "竖版9比16",
      platform: "Short-video vertical 9:16",
      layout: "vertical",
    },
    "vertical-profile-1080x1440": {
      fileStem: "cover-vertical-profile-1080x1440",
      group: "竖版3比4",
      platform: "Profile 3:4 cover",
      layout: "profile",
    },
    "instagram-reels-cover": {
      fileStem: "cover-instagram-reels-420x654",
      group: "Reels封面",
      platform: "Instagram Reels profile cover",
      layout: "reels",
    },
    "square-1200x1200": {
      fileStem: "cover-square-1200x1200",
      group: "方形1比1",
      platform: "Square social feed card",
      layout: "square",
    },
  };
  return specs[targetId] || null;
}

function hashText(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

const palettes = [
  { bg1: "#10151c", bg2: "#263244", card: "#f8f3e8", ink: "#10151c", cream: "#fff6df", accent: "#ffc533", hot: "#e54632", cool: "#4aa3d8" },
  { bg1: "#151711", bg2: "#34422e", card: "#fff7e7", ink: "#171712", cream: "#fff1c9", accent: "#f4c64e", hot: "#d65b3b", cool: "#75b997" },
  { bg1: "#18131b", bg2: "#3f3146", card: "#fff1df", ink: "#1a141c", cream: "#fff5e6", accent: "#f5b94b", hot: "#d84c53", cool: "#8aa7ff" },
  { bg1: "#121819", bg2: "#293a39", card: "#f7efe1", ink: "#131817", cream: "#fff3d7", accent: "#f2b13b", hot: "#c9472c", cool: "#5eb6a8" },
];

function titleFromTopic({ coverDesign = {}, prompts = {}, dirName = "" }) {
  const prompt = prompts.prompts?.[0] || {};
  const title = prompt.parsedTitle?.coreTitle || coverDesign.coverTitle || prompt.title || dirName;
  const core = String(title).replace(/^写小说方法论[:：]\s*/, "").trim();
  return {
    series: "写小说方法论",
    core: core || "方法论",
  };
}

function splitChinese(text, maxChars, maxLines = 2) {
  const clean = String(text || "").replace(/\s+/g, "");
  if (clean.length <= maxChars) return [clean];
  const lines = [];
  let remaining = clean;
  while (remaining && lines.length < maxLines) {
    const take = lines.length === maxLines - 1 ? remaining : remaining.slice(0, maxChars);
    lines.push(take);
    remaining = remaining.slice(take.length);
  }
  return lines;
}

function textLines(lines, { x, y, size, weight = 950, fill = "#fff", anchor = "start", stroke = "", lineGap = 1.08 }) {
  return lines.map((line, index) => {
    const strokeAttrs = stroke ? ` stroke="${stroke}" stroke-width="${Math.max(2, Math.round(size * 0.06))}" paint-order="stroke fill"` : "";
    return `<text x="${x}" y="${y + index * size * lineGap}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}"${strokeAttrs} font-family="PingFang SC,Hiragino Sans GB,Microsoft YaHei,Arial,sans-serif">${esc(line)}</text>`;
  }).join("\n");
}

function presenter({ x, y, scale, palette, facing = "right" }) {
  const flip = facing === "left" ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${scale * flip} ${scale})">
    <ellipse cx="0" cy="292" rx="126" ry="28" fill="#000" opacity=".22"/>
    <path d="M-88 88 C-132 154,-132 252,-86 300 L94 300 C126 226,114 142,76 88 C36 120,-44 120,-88 88Z" fill="${palette.cool}" stroke="#111" stroke-width="8"/>
    <path d="M-94 156 C-158 198,-196 246,-218 300" fill="none" stroke="${palette.card}" stroke-width="24" stroke-linecap="round"/>
    <path d="M84 160 C152 194,192 232,236 286" fill="none" stroke="${palette.hot}" stroke-width="24" stroke-linecap="round"/>
    <circle cx="-8" cy="35" r="66" fill="#f2c69b" stroke="#111" stroke-width="7"/>
    <path d="M-72 18 C-44 -52,46 -54,78 10 C40 -18,-16 18,-70 46Z" fill="#171717"/>
    <path d="M-35 42 H-4 M25 42 H55" stroke="#111" stroke-width="8" stroke-linecap="round"/>
    <path d="M-16 70 C8 86,35 78,52 62" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round"/>
    <rect x="-88" y="122" width="180" height="186" rx="26" fill="#223445" opacity=".32"/>
  </g>`;
}

function proofCards({ x, y, w, h, palette, compact = false }) {
  const r = Math.max(10, Math.round(w * 0.035));
  const titleSize = Math.max(18, Math.round(h * 0.12));
  const bodySize = Math.max(14, Math.round(h * 0.075));
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${palette.card}" opacity=".96" stroke="rgba(255,255,255,.58)" stroke-width="3"/>
    <rect x="${x + w * .06}" y="${y + h * .13}" width="${w * .38}" height="${h * .56}" rx="${r}" fill="#e4ddd1"/>
    <rect x="${x + w * .56}" y="${y + h * .13}" width="${w * .38}" height="${h * .56}" rx="${r}" fill="#fffaf0"/>
    <text x="${x + w * .25}" y="${y + h * .32}" text-anchor="middle" font-size="${titleSize}" font-weight="950" fill="${palette.hot}" font-family="PingFang SC,sans-serif">卡住</text>
    <text x="${x + w * .75}" y="${y + h * .32}" text-anchor="middle" font-size="${titleSize}" font-weight="950" fill="${palette.ink}" font-family="PingFang SC,sans-serif">成稿</text>
    <path d="M${x + w * .47} ${y + h * .41} H${x + w * .53}" stroke="${palette.accent}" stroke-width="${Math.max(5, Math.round(h * .06))}" stroke-linecap="round"/>
    <path d="M${x + w * .515} ${y + h * .35} L${x + w * .56} ${y + h * .41} L${x + w * .515} ${y + h * .47}" fill="none" stroke="${palette.accent}" stroke-width="${Math.max(5, Math.round(h * .06))}" stroke-linecap="round" stroke-linejoin="round"/>
    ${compact ? "" : `<text x="${x + w * .5}" y="${y + h * .84}" text-anchor="middle" font-size="${bodySize}" font-weight="850" fill="${palette.ink}" font-family="PingFang SC,sans-serif">把灵感变成可执行结构</text>`}
  </g>`;
}

function methodBadge({ x, y, text, palette, size }) {
  const width = Math.round(size * (String(text).length * 0.92 + 2.2));
  return `<g transform="rotate(-2 ${x} ${y})">
    <rect x="${x}" y="${y - size * .9}" width="${width}" height="${size * 1.26}" rx="${size * .22}" fill="${palette.accent}" stroke="#111" stroke-width="${Math.max(3, size * .08)}"/>
    <text x="${x + size * .65}" y="${y}" font-size="${size}" font-weight="950" fill="#111" font-family="PingFang SC,sans-serif">${esc(text)}</text>
  </g>`;
}

function background({ w, h, palette }) {
  const grid = Math.max(42, Math.round(Math.min(w, h) / 10));
  const lines = [];
  for (let x = 0; x <= w; x += grid) lines.push(`<path d="M${x} 0 V${h}" stroke="#fff" opacity=".035"/>`);
  for (let y = 0; y <= h; y += grid) lines.push(`<path d="M0 ${y} H${w}" stroke="#fff" opacity=".035"/>`);
  return `<defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${palette.bg1}"/><stop offset="1" stop-color="${palette.bg2}"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="16" flood-opacity=".35"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g>${lines.join("")}</g>
  <circle cx="${w * .88}" cy="${h * .12}" r="${Math.min(w, h) * .28}" fill="${palette.accent}" opacity=".1"/>
  <circle cx="${w * .12}" cy="${h * .86}" r="${Math.min(w, h) * .22}" fill="${palette.cool}" opacity=".13"/>`;
}

function svgForTarget({ title, targetId, width, height }) {
  const spec = targetSpec(targetId);
  const palette = palettes[hashText(`${title.core}-${targetId}`) % palettes.length];
  const w = Number(width);
  const h = Number(height);
  const min = Math.min(w, h);
  const mainLines = splitChinese(title.core, spec.layout === "reels" ? 5 : spec.layout === "vertical" ? 6 : 7, spec.layout === "horizontalTall" || spec.layout === "bilibili" ? 2 : 3);
  const seriesSize = Math.round(min * (spec.layout === "reels" ? .055 : .045));
  if (["vertical", "profile", "reels"].includes(spec.layout)) {
    const titleSize = Math.round(min * (spec.layout === "reels" ? .14 : .13));
    const top = h * .1;
    const proofW = w * .78;
    const proofH = h * (spec.layout === "reels" ? .16 : .15);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${background({ w, h, palette })}
      <rect x="${w * .08}" y="${h * .045}" width="${w * .84}" height="${h * .91}" rx="${min * .045}" fill="#000" opacity=".12" stroke="#fff" stroke-opacity=".18"/>
      ${methodBadge({ x: w * .14, y: top + seriesSize, text: title.series, palette, size: seriesSize })}
      ${textLines(mainLines, { x: w * .5, y: top + min * .24, size: titleSize, fill: palette.cream, anchor: "middle", stroke: "#111", lineGap: 1.04 })}
      ${presenter({ x: w * .5, y: h * .49, scale: min / 560, palette })}
      ${proofCards({ x: (w - proofW) / 2, y: h - proofH - h * .105, w: proofW, h: proofH, palette, compact: spec.layout === "reels" })}
      <path d="M${w * .7} ${h * .26} C${w * .86} ${h * .28},${w * .82} ${h * .16},${w * .9} ${h * .16}" fill="none" stroke="${palette.accent}" stroke-width="${Math.max(8, min * .018)}" stroke-linecap="round"/>
      <text x="${w * .5}" y="${h * .93}" text-anchor="middle" font-size="${Math.round(min * .04)}" font-weight="900" fill="${palette.accent}" font-family="PingFang SC,sans-serif">方法拆解 · 结构成稿</text>
    </svg>`;
  }
  if (spec.layout === "square") {
    const titleSize = Math.round(min * .108);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${background({ w, h, palette })}
      ${methodBadge({ x: w * .08, y: h * .14, text: title.series, palette, size: seriesSize })}
      ${presenter({ x: w * .24, y: h * .47, scale: min / 700, palette })}
      <g filter="url(#shadow)">${proofCards({ x: w * .45, y: h * .55, w: w * .45, h: h * .21, palette })}</g>
      ${textLines(mainLines, { x: w * .52, y: h * .28, size: titleSize, fill: palette.cream, anchor: "middle", stroke: "#111", lineGap: 1.04 })}
      <rect x="${w * .18}" y="${h * .82}" width="${w * .64}" height="${h * .075}" rx="${h * .025}" fill="${palette.hot}"/>
      <text x="${w * .5}" y="${h * .872}" text-anchor="middle" font-size="${Math.round(min * .042)}" font-weight="950" fill="#fff" font-family="PingFang SC,sans-serif">别等灵感，先搭系统</text>
    </svg>`;
  }
  const titleSize = Math.round(min * (spec.layout === "bilibili" ? .108 : .105));
  const leftX = w * .07;
  const proofW = w * (spec.layout === "bilibili" ? .33 : .34);
  const proofH = h * .24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${background({ w, h, palette })}
    ${methodBadge({ x: leftX, y: h * .17, text: title.series, palette, size: seriesSize })}
    ${textLines(mainLines, { x: leftX, y: h * .36, size: titleSize, fill: palette.cream, anchor: "start", stroke: "#111", lineGap: 1.02 })}
    ${presenter({ x: w * .74, y: h * .47, scale: min / 650, palette, facing: "left" })}
    <g filter="url(#shadow)">${proofCards({ x: w * .47, y: h * .68, w: proofW, h: proofH, palette, compact: spec.layout === "bilibili" })}</g>
    <path d="M${w * .5} ${h * .2} C${w * .7} ${h * .12},${w * .78} ${h * .18},${w * .86} ${h * .09}" fill="none" stroke="${palette.accent}" stroke-width="${Math.max(10, min * .022)}" stroke-linecap="round"/>
    <rect x="${leftX}" y="${h * .78}" width="${w * .32}" height="${h * .09}" rx="${h * .026}" fill="${palette.hot}"/>
    <text x="${leftX + w * .16}" y="${h * .84}" text-anchor="middle" font-size="${Math.round(min * .046)}" font-weight="950" fill="#fff" font-family="PingFang SC,sans-serif">从想法到连载</text>
  </svg>`;
}

async function loadPlaywright() {
  const candidates = [
    "node_modules/playwright/index.mjs",
    "/Users/example/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
    "research/html-video-research/html-video/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.mjs",
  ];
  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (!existsSync(resolved)) continue;
    try {
      return await import(pathToFileURL(resolved).href);
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("Playwright is required to rasterize target-ratio covers");
}

function convertJpg(png, jpg, width, height) {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "high", "-z", String(height), String(width), png, "--out", jpg], { stdio: "ignore" });
}

function updateArtifacts({ topicDir, target, title, pngFile, jpgFile }) {
  const selectionPath = join(topicDir, "workflow", "cover-size-selection.json");
  const designPath = join(topicDir, "workflow", "cover-design.json");
  const promptsPath = join(topicDir, "workflow", "cover-image2-prompts.json");
  const selection = readJson(selectionPath);
  for (const entry of selection.entries || []) {
    if (entry.targetId !== target.targetId) continue;
    entry.group = target.group || entry.group;
    entry.qualityStatus = "review-only-local-target-ratio-recomposition";
    entry.uploadReady = false;
    entry.needsRegeneration = true;
    entry.requiresNativeImage2TargetRatio = true;
    entry.image2NativeTargetRatioReady = false;
    entry.codexNativeTargetRatioReady = false;
    entry.localTargetRatioRecomposition = true;
    entry.targetRatioNativeMatch = false;
    entry.sourceAssetRatio = entry.ratio;
    entry.selectedAsset = {
      status: "available",
      provider: "codex-local-target-ratio-preview",
      mode: "review-only-local-target-ratio-recomposition",
      source: pngFile,
      note: "Preview only. This is not a true Image 2 native target-ratio bitmap and must not enter final upload-ready delivery.",
    };
    entry.internalReviewFiles = [pngFile, jpgFile];
    entry.files = [];
    entry.previewFiles = [
      { format: "png", file: pngFile },
      { format: "jpg", file: jpgFile },
    ];
  }
  const currentEntry = (selection.entries || []).find((entry) => entry.targetId === target.targetId);
  selection.needsRegeneration = [
    ...(selection.needsRegeneration || []).filter((entry) => entry.targetId !== target.targetId),
    {
      targetId: target.targetId,
      label: currentEntry?.label || target.label,
      group: target.group || currentEntry?.group,
      width: target.width,
      height: target.height,
      ratio: target.ratio,
      sourceAssetRatio: currentEntry?.sourceAssetRatio || target.ratio,
      targetRatio: currentEntry?.targetRatio,
      qualityStatus: "review-only-local-target-ratio-recomposition",
      selectedAsset: currentEntry?.selectedAsset || null,
      internalReviewFiles: [pngFile, jpgFile],
      previewFiles: [
        { format: "png", file: pngFile },
        { format: "jpg", file: jpgFile },
      ],
    },
  ];
  selection.pendingNativeTargetCount = selection.needsRegeneration.length;
  selection.allTargetsUploadReady = selection.pendingNativeTargetCount === 0;
  writeJson(selectionPath, selection);

  if (existsSync(designPath)) {
    const design = readJson(designPath);
    for (const preset of design.resolutionPresets || []) {
      const id = preset.id === "bilibili-1146x717" ? "bilibili-common-1146x717" : preset.id;
      if (id !== target.targetId) continue;
      preset.file = pngFile;
      preset.jpg = jpgFile;
      preset.exactTargetPreview = pngFile;
      preset.uploadReady = false;
      preset.status = "review-only-local-target-ratio-recomposition";
      preset.qualityStatus = "review-only-local-target-ratio-recomposition";
      preset.image2NativeTargetRatioReady = false;
      preset.codexNativeTargetRatioReady = false;
      preset.localTargetRatioRecomposition = true;
      preset.fulfilledBy = "codex-local-target-ratio-preview";
    }
    design.platformSpecificDesignsGenerated = true;
    design.coverTargetCompletion = {
      ...(design.coverTargetCompletion || {}),
      updatedAt: new Date().toISOString(),
      generator: "scripts/generate-missing-cover-targets.mjs",
      note: "Missing target-ratio covers were generated as review-only local previews. They remain pending until true target-ratio Image 2/Codex integrated-typography bitmaps replace them.",
    };
    writeJson(designPath, design);
  }

  if (existsSync(promptsPath)) {
    const prompts = readJson(promptsPath);
    prompts.pendingNativeTargetRatioPrompts = [
      ...(prompts.pendingNativeTargetRatioPrompts || []).filter((entry) => entry.id !== target.targetId),
      {
        id: target.targetId,
        width: target.width,
        height: target.height,
        ratio: target.ratio,
        previewFile: pngFile,
        previewJpg: jpgFile,
        status: "needs-native-target-ratio-image2",
        provider: "image2-required",
        promptMethodology: "high-click-knowledge-cover-v1",
        title: `${title.series}：${title.core}`,
      },
    ];
    prompts.fulfilledNativeTargetRatioExports = (prompts.fulfilledNativeTargetRatioExports || []).filter((entry) => entry.id !== target.targetId);
    writeJson(promptsPath, prompts);
  }
}

async function main() {
  if (process.env.COVER_LOCAL_RECOMPOSITION_PREVIEW !== "1") {
    throw new Error("This script is preview-only. Set COVER_LOCAL_RECOMPOSITION_PREVIEW=1 to generate non-upload local previews; use Image 2/Codex target-ratio bitmaps for final delivery.");
  }
  const batchRoot = resolve(argValue("--root", process.cwd()));
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  const topicDirs = readdirSync(batchRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
    .map((entry) => join(batchRoot, entry.name))
    .sort();
  const generated = [];
  try {
    const page = await browser.newPage();
    for (const topicDir of topicDirs) {
      const selectionPath = join(topicDir, "workflow", "cover-size-selection.json");
      if (!existsSync(selectionPath)) continue;
      const coverDesign = existsSync(join(topicDir, "workflow", "cover-design.json")) ? readJson(join(topicDir, "workflow", "cover-design.json")) : {};
      const prompts = existsSync(join(topicDir, "workflow", "cover-image2-prompts.json")) ? readJson(join(topicDir, "workflow", "cover-image2-prompts.json")) : {};
      const selection = readJson(selectionPath);
      const title = titleFromTopic({ coverDesign, prompts, dirName: topicDir.split("/").pop() });
      const entries = (selection.entries || []).filter((entry) => {
        if (!targetSpec(entry.targetId)) return false;
        if (entry.image2NativeTargetRatioReady === true && entry.selectedAsset?.provider !== "codex-local-native-target-ratio-renderer") return false;
        return entry.uploadReady !== true || entry.selectedAsset?.provider === "codex-local-native-target-ratio-renderer";
      });
      for (const entry of entries) {
        const spec = targetSpec(entry.targetId);
        const width = Number(entry.width);
        const height = Number(entry.height);
        const coverDir = join(topicDir, "cover");
        mkdirSync(coverDir, { recursive: true });
        const svg = svgForTarget({ title, targetId: entry.targetId, width, height });
        const svgFile = join("cover", `${spec.fileStem}.svg`);
        const pngFile = join("cover", `${spec.fileStem}.png`);
        const jpgFile = join("cover", `${spec.fileStem}.jpg`);
        writeFileSync(join(topicDir, svgFile), svg, "utf8");
        await page.setViewportSize({ width, height });
        await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#111}svg{display:block}</style></head><body>${svg}</body></html>`);
        await page.screenshot({ path: join(topicDir, pngFile), type: "png", fullPage: false });
        convertJpg(join(topicDir, pngFile), join(topicDir, jpgFile), width, height);
        updateArtifacts({
          topicDir,
          target: { ...entry, group: spec.group },
          title,
          pngFile,
          jpgFile,
        });
        generated.push({
          topic: title.core,
          targetId: entry.targetId,
          width,
          height,
          files: [pngFile, jpgFile, svgFile],
          platform: spec.platform,
        });
      }
    }
  } finally {
    await browser.close();
  }
  writeJson(join(batchRoot, "_封面总索引", "native-target-generation-log.json"), {
    generatedAt: new Date().toISOString(),
    generator: "scripts/generate-missing-cover-targets.mjs",
    provider: "codex-local-target-ratio-preview",
    policy: "Review-only target canvas preview. It is not a substitute for true target-ratio Image 2/Codex integrated-typography generation.",
    finalDeliveryEligible: false,
    status: "review-only-local-target-ratio-recomposition",
    generatedCount: generated.length,
    generated,
  });
  console.log(JSON.stringify({ ok: true, batchRoot, generatedCount: generated.length, finalDeliveryEligible: false }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
