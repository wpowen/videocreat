#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function standardCoverFileForTarget(targetId) {
  const files = {
    "horizontal-4x3-1600x1200": "cover/cover-horizontal-4x3-1600x1200.png",
    "bilibili-common-1146x717": "cover/cover-bilibili-1146x717.png",
    "vertical-1080x1920": "cover/cover-vertical-1080x1920.png",
    "vertical-profile-1080x1440": "cover/cover-vertical-profile-1080x1440.png",
    "instagram-reels-cover": "cover/cover-instagram-reels-420x654.png",
    "square-1200x1200": "cover/cover-square-1200x1200.png",
  };
  return files[targetId] || "";
}

function targetKey(id = "") {
  if (id === "bilibili-1146x717") return "bilibili-common-1146x717";
  return id;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function ratioLabel(width, height) {
  const divisor = gcd(Number(width), Number(height));
  return `${Number(width) / divisor}:${Number(height) / divisor}`;
}

function inferGroup(targetId, width, height) {
  if (/bilibili/i.test(targetId)) return "B站封面";
  if (/reels/i.test(targetId)) return "Reels封面";
  if (/vertical-profile|3x4|3-4/i.test(targetId)) return "竖版3比4";
  if (/vertical/i.test(targetId)) return "竖版9比16";
  if (/square/i.test(targetId) || Number(width) === Number(height)) return "方形1比1";
  if (/4x3|4-3/i.test(targetId)) return "横版4比3";
  return "横版16比9";
}

function jpgForPng(file) {
  return file.replace(/\.png$/i, ".jpg");
}

function validImage2Size(width, height) {
  const area = width * height;
  const ratio = Math.max(width, height) / Math.min(width, height);
  return width % 16 === 0
    && height % 16 === 0
    && width <= 3840
    && height <= 3840
    && ratio <= 3
    && area >= 655360
    && area <= 8294400;
}

function chooseImage2Size(width, height) {
  if (validImage2Size(width, height)) return { width, height, exact: true };
  const targetRatio = width / height;
  const targetArea = Math.max(655360, width * height);
  let best = null;
  for (let candidateWidth = 256; candidateWidth <= 3840; candidateWidth += 16) {
    const idealHeight = candidateWidth / targetRatio;
    const startHeight = Math.max(256, Math.floor(idealHeight / 16) * 16 - 32);
    for (let candidateHeight = startHeight; candidateHeight <= startHeight + 64; candidateHeight += 16) {
      if (!validImage2Size(candidateWidth, candidateHeight)) continue;
      const ratioDistance = Math.abs(candidateWidth / candidateHeight - targetRatio);
      const areaDistance = Math.abs(candidateWidth * candidateHeight - targetArea) / targetArea;
      const edgeDistance = (Math.abs(candidateWidth - width) + Math.abs(candidateHeight - height)) / Math.max(width, height);
      const score = ratioDistance * 1000 + areaDistance * 2 + edgeDistance * 0.2;
      if (!best || score < best.score) best = { width: candidateWidth, height: candidateHeight, exact: false, score };
    }
  }
  if (!best) throw new Error(`No valid gpt-image-2 size found for ${width}x${height}`);
  return best;
}

async function generateImage2Png({ prompt, outputPath, size, quality }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for Image2 cover generation");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size,
      quality,
      output_format: "png",
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Image2 cover generation failed: HTTP ${response.status} ${JSON.stringify(json).slice(0, 1200)}`);
  }
  const image = json.data?.[0];
  if (!image?.b64_json) {
    throw new Error(`Image2 response did not include b64_json: ${JSON.stringify(json).slice(0, 1200)}`);
  }
  writeFileSync(outputPath, Buffer.from(image.b64_json, "base64"));
}

function resizeToFinal({ source, png, jpg, finalWidth, finalHeight }) {
  if (source !== png) {
    execFileSync("sips", ["-z", String(finalHeight), String(finalWidth), source, "--out", png], { stdio: "ignore" });
  }
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "high", "-z", String(finalHeight), String(finalWidth), png, "--out", jpg], { stdio: "ignore" });
}

function matchingPrompt(prompts, targetId) {
  const exact = (prompts.prompts || []).find((item) => item.targetId === `${targetId}-image2-integrated-cover`)
    || (prompts.prompts || []).find((item) => String(item.targetId || "").includes(targetId));
  if (exact) return exact;
  const base = (prompts.prompts || []).find((item) => item.prompt && item.promptMethodology === "high-click-knowledge-cover-v1")
    || (prompts.prompts || []).find((item) => item.prompt);
  if (!base) return null;
  return {
    ...base,
    targetId: `${targetId}-fallback-from-master-prompt`,
    promptFallbackFromMaster: true,
  };
}

function entryFromSource(source, fallbackTitle) {
  const targetId = targetKey(source.targetId || source.id || "");
  if (!standardCoverFileForTarget(targetId)) return null;
  const width = Number(source.width || 0);
  const height = Number(source.height || 0);
  if (!width || !height) return null;
  return {
    targetId,
    label: source.label || `${fallbackTitle || "封面"}-${width}x${height}`,
    group: source.group || inferGroup(targetId, width, height),
    width,
    height,
    ratio: source.ratio || ratioLabel(width, height),
    targetRatio: source.targetRatio || width / height,
    qualityStatus: source.qualityStatus || source.status || "needs-native-target-ratio-image2",
    uploadReady: source.uploadReady === true,
    needsRegeneration: source.uploadReady !== true,
    requiresNativeImage2TargetRatio: true,
    image2NativeTargetRatioReady: source.image2NativeTargetRatioReady === true,
    localTargetRatioRecomposition: source.localTargetRatioRecomposition === true,
    selectedAsset: source.selectedAsset || null,
  };
}

function pendingEntries({ selection, design, prompts, fallbackTitle }) {
  const byTarget = new Map();
  for (const source of selection.entries || []) {
    const entry = entryFromSource(source, fallbackTitle);
    if (entry) byTarget.set(entry.targetId, { ...entry, ...source, targetId: entry.targetId });
  }
  for (const source of selection.needsRegeneration || []) {
    const entry = entryFromSource(source, fallbackTitle);
    if (entry && !byTarget.has(entry.targetId)) byTarget.set(entry.targetId, entry);
  }
  for (const source of design.resolutionPresets || []) {
    const entry = entryFromSource(source, fallbackTitle);
    if (entry && !byTarget.has(entry.targetId)) byTarget.set(entry.targetId, entry);
  }
  for (const source of prompts.pendingNativeTargetRatioPrompts || []) {
    const entry = entryFromSource(source, fallbackTitle);
    if (entry && !byTarget.has(entry.targetId)) byTarget.set(entry.targetId, entry);
  }
  return [...byTarget.values()]
    .filter((entry) => standardCoverFileForTarget(entry.targetId))
    .filter((entry) => entry.uploadReady !== true || entry.image2NativeTargetRatioReady !== true);
}

function targetPromptSuffix(entry) {
  const base = `Target-ratio completion guard: generate a fresh native ${entry.width}x${entry.height} (${entry.ratio}) composition for ${entry.group}. This is not a crop, resize, side-panel extension, letterbox, matte frame, or rearranged 16:9 cover.`;
  const rules = {
    "horizontal-4x3-1600x1200": "Use a taller horizontal 4:3 thumbnail composition with all main title, subject, and proof object inside the central 1420x1030 safe area. Do not embed a 16:9 rectangle.",
    "bilibili-common-1146x717": "Use a Bilibili list/search thumbnail composition with all main title and proof object inside the central 1020x620 safe area. Avoid stacked duplicate covers.",
    "vertical-1080x1920": "Use a vertical short-video composition with the main title in the middle safe area and no critical text at the extreme top or bottom.",
    "vertical-profile-1080x1440": "Use a 3:4 profile-grid composition with the main title and subject inside the center 900x1120 safe area.",
    "instagram-reels-cover": "Use a compact Reels profile-grid composition with fewer elements, central title, and one proof metaphor.",
    "square-1200x1200": "Use a native square feed composition with the main title and proof object inside the center 1020x1020 safe area. Do not make a horizontal crop.",
  };
  return `${base}\n${rules[entry.targetId] || ""}\nKeep the same title/script truth, high-click-knowledge-cover-v1 method, strict text whitelist, and platform-specific safe-area layout.\nPresenter expression guard: when a presenter/persona appears, use a focused, confident, clear, approachable, or lightly surprised expression. Avoid repeated frowning, angry, anxious, scolding, exaggerated grimace, or furrowed-brow faces unless the topic explicitly requires that emotion.`;
}

function updateArtifacts({ topicDir, entry, promptItem, pngFile, jpgFile, apiSize, quality }) {
  const selectionPath = join(topicDir, "workflow", "cover-size-selection.json");
  const designPath = join(topicDir, "workflow", "cover-design.json");
  const promptsPath = join(topicDir, "workflow", "cover-image2-prompts.json");
  const selection = readJson(selectionPath);
  for (const item of selection.entries || []) {
    if (item.targetId !== entry.targetId) continue;
    item.qualityStatus = "upload-ready-native-target-ratio";
    item.uploadReady = true;
    item.needsRegeneration = false;
    item.requiresNativeImage2TargetRatio = true;
    item.image2NativeTargetRatioReady = true;
    item.codexNativeTargetRatioReady = false;
    item.localTargetRatioRecomposition = false;
    item.targetRatioNativeMatch = true;
    item.sourceAssetRatio = item.ratio;
    item.selectedAsset = {
      status: "available",
      provider: "gpt-image-2-api-explicit-opt-in",
      mode: "image2-integrated-typography-cover",
      source: pngFile,
      promptTargetId: promptItem.targetId,
      requestedImage2Size: `${apiSize.width}x${apiSize.height}`,
      finalPlatformSize: `${item.width}x${item.height}`,
      exactPlatformSize: `${item.width}x${item.height}`,
      quality,
      note: apiSize.exact
        ? "Generated directly at the exact target size through Image2."
        : "Generated through the nearest valid Image2 native-ratio canvas, then resized without crop or letterbox to the exact platform size.",
    };
    item.internalReviewFiles = [pngFile, jpgFile];
    item.files = [
      { format: "png", file: pngFile },
      { format: "jpg", file: jpgFile },
    ];
    item.previewFiles = [];
  }
  selection.needsRegeneration = (selection.needsRegeneration || []).filter((item) => item.targetId !== entry.targetId);
  selection.pendingNativeTargetCount = selection.needsRegeneration.length;
  selection.allTargetsUploadReady = selection.pendingNativeTargetCount === 0;
  writeJson(selectionPath, selection);

  if (existsSync(designPath)) {
    const design = readJson(designPath);
    for (const preset of design.resolutionPresets || []) {
      const id = preset.id === "bilibili-1146x717" ? "bilibili-common-1146x717" : preset.id;
      if (id !== entry.targetId) continue;
      preset.file = pngFile;
      preset.jpg = jpgFile;
      preset.exactTargetPreview = pngFile;
      preset.uploadReady = true;
      preset.status = "upload-ready-native-target-ratio";
      preset.qualityStatus = "upload-ready-native-target-ratio";
      preset.image2NativeTargetRatioReady = true;
      preset.localTargetRatioRecomposition = false;
      preset.fulfilledBy = "gpt-image-2-api-explicit-opt-in";
      preset.requestedImage2Size = `${apiSize.width}x${apiSize.height}`;
    }
    design.coverTargetCompletion = {
      ...(design.coverTargetCompletion || {}),
      updatedAt: new Date().toISOString(),
      generator: "scripts/generate-cover-targets-image2.mjs",
      provider: "gpt-image-2-api-explicit-opt-in",
    };
    writeJson(designPath, design);
  }

  if (existsSync(promptsPath)) {
    const prompts = readJson(promptsPath);
    prompts.pendingNativeTargetRatioPrompts = (prompts.pendingNativeTargetRatioPrompts || []).filter((item) => item.id !== entry.targetId);
    prompts.fulfilledNativeTargetRatioExports = [
      ...(prompts.fulfilledNativeTargetRatioExports || []).filter((item) => item.id !== entry.targetId),
      {
        id: entry.targetId,
        width: entry.width,
        height: entry.height,
        ratio: entry.ratio,
        file: pngFile,
        jpg: jpgFile,
        status: "upload-ready-native-target-ratio",
        provider: "gpt-image-2-api-explicit-opt-in",
        requestedImage2Size: `${apiSize.width}x${apiSize.height}`,
        finalPlatformSize: `${entry.width}x${entry.height}`,
        exactPlatformSize: `${entry.width}x${entry.height}`,
        promptTargetId: promptItem.targetId,
        promptMethodology: "high-click-knowledge-cover-v1",
      },
    ];
    writeJson(promptsPath, prompts);
  }
}

async function main() {
  const root = resolve(argValue("--root", process.cwd()));
  const quality = argValue("--quality", "high");
  const limit = Number(argValue("--limit", "0"));
  loadEnvFile(resolve(".env.local"));
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing. Refusing to fake Image2 cover generation.");
  const topicDirs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
    .map((entry) => join(root, entry.name))
    .sort();
  const generated = [];
  for (const topicDir of topicDirs) {
    const selectionPath = join(topicDir, "workflow", "cover-size-selection.json");
    const promptsPath = join(topicDir, "workflow", "cover-image2-prompts.json");
    if (!existsSync(selectionPath) || !existsSync(promptsPath)) continue;
    const selection = readJson(selectionPath);
    const prompts = readJson(promptsPath);
    const designPath = join(topicDir, "workflow", "cover-design.json");
    const design = existsSync(designPath) ? readJson(designPath) : {};
    const pending = pendingEntries({
      selection,
      design,
      prompts,
      fallbackTitle: design.coverTitle || selection.title || topicDir.split(/[\\/]/).pop(),
    });
    for (const entry of pending) {
      if (limit && generated.length >= limit) break;
      const promptItem = matchingPrompt(prompts, entry.targetId);
      if (!promptItem?.prompt) throw new Error(`Missing Image2 prompt for ${topicDir} ${entry.targetId}`);
      const apiSize = chooseImage2Size(Number(entry.width), Number(entry.height));
      const output = standardCoverFileForTarget(entry.targetId);
      const pngPath = join(topicDir, output);
      const jpgPath = join(topicDir, jpgForPng(output));
      const rawPath = join(topicDir, "cover", `image2-native-${entry.targetId}-${apiSize.width}x${apiSize.height}.png`);
      mkdirSync(dirname(rawPath), { recursive: true });
      const prompt = `${promptItem.prompt}\n\n${targetPromptSuffix(entry)}\n\nAPI canvas: generate natively for ${apiSize.width}x${apiSize.height}. Final platform export: ${entry.width}x${entry.height}. Preserve the target composition and safe areas; do not create letterbox, matte, crop marks, or side extensions.`;
      await generateImage2Png({ prompt, outputPath: rawPath, size: `${apiSize.width}x${apiSize.height}`, quality });
      resizeToFinal({
        source: apiSize.exact ? rawPath : rawPath,
        png: pngPath,
        jpg: jpgPath,
        finalWidth: Number(entry.width),
        finalHeight: Number(entry.height),
      });
      updateArtifacts({ topicDir, entry, promptItem, pngFile: output, jpgFile: jpgForPng(output), apiSize, quality });
      generated.push({ topic: topicDir, targetId: entry.targetId, apiSize, exactPlatformSize: `${entry.width}x${entry.height}`, file: output });
    }
    if (limit && generated.length >= limit) break;
  }
  writeJson(join(root, "_封面总索引", "image2-target-generation-log.json"), {
    generatedAt: new Date().toISOString(),
    generator: "scripts/generate-cover-targets-image2.mjs",
    provider: "gpt-image-2-api-explicit-opt-in",
    quality,
    generatedCount: generated.length,
    generated,
  });
  console.log(JSON.stringify({ ok: true, root, generatedCount: generated.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
