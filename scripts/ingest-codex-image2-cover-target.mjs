#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

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

function targetKey(id = "") {
  const aliases = {
    "master-16x9-3840x2160": "master-16x9-4k",
    "bilibili-1146x717": "bilibili-common-1146x717",
    "instagram-reels-420x654": "instagram-reels-cover",
  };
  return aliases[id] || id;
}

function standardCoverFileForTarget(targetId) {
  const files = {
    "master-16x9-4k": "cover/cover-master-16x9-3840x2160.png",
    "horizontal-16x9-1920x1080": "cover/cover-16x9-1920x1080.png",
    "horizontal-16x9-1280x720": "cover/cover-16x9-1280x720.png",
    "horizontal-4x3-1600x1200": "cover/cover-horizontal-4x3-1600x1200.png",
    "bilibili-common-1146x717": "cover/cover-bilibili-1146x717.png",
    "vertical-1080x1920": "cover/cover-vertical-1080x1920.png",
    "vertical-profile-1080x1440": "cover/cover-vertical-profile-1080x1440.png",
    "instagram-reels-cover": "cover/cover-instagram-reels-420x654.png",
    "square-1200x1200": "cover/cover-square-1200x1200.png",
  };
  return files[targetKey(targetId)] || "";
}

function jpgForPng(file) {
  return file.replace(/\.png$/i, ".jpg");
}

function dimensions(path) {
  const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], { encoding: "utf8" });
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
  if (!width || !height) throw new Error(`Unable to read image dimensions: ${path}`);
  return { width, height };
}

function ratioLabel(width, height) {
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
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function resizeToFinal({ source, png, jpg, width, height }) {
  mkdirSync(dirname(png), { recursive: true });
  execFileSync("sips", ["-z", String(height), String(width), source, "--out", png], { stdio: "ignore" });
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "high", "-z", String(height), String(width), png, "--out", jpg], { stdio: "ignore" });
}

function matchingPrompt(prompts, targetId) {
  const key = targetKey(targetId);
  return (prompts.prompts || []).find((item) => targetKey(String(item.targetId || "").replace(/-image2-integrated-cover$/, "")) === key)
    || (prompts.pendingNativeTargetRatioPrompts || []).find((item) => targetKey(item.id || item.targetId || "") === key)
    || null;
}

function promptIdOf(promptItem, targetId) {
  return promptItem?.targetId || `${targetKey(targetId)}-image2-integrated-cover`;
}

function updateSelection({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize }) {
  const selectionPath = join(topicDir, "workflow", "cover-size-selection.json");
  const selection = readJson(selectionPath);
  const key = targetKey(targetId);
  const entry = (selection.entries || []).find((item) => targetKey(item.targetId) === key);
  if (!entry) throw new Error(`Target ${targetId} not found in ${selectionPath}`);
  const width = Number(entry.width || 0);
  const height = Number(entry.height || 0);
  if (!width || !height) throw new Error(`Target ${targetId} is missing width/height in ${selectionPath}`);
  const expectedRatio = width / height;
  const imageRatio = imageSize.width / imageSize.height;
  if (Math.abs(expectedRatio - imageRatio) > 0.01) {
    throw new Error(`Codex Image2 source ratio ${imageSize.width}x${imageSize.height} does not match target ${width}x${height}; refusing to distort/crop.`);
  }
  entry.qualityStatus = "upload-ready-native-target-ratio";
  entry.uploadReady = true;
  entry.needsRegeneration = false;
  entry.requiresNativeImage2TargetRatio = true;
  entry.image2NativeTargetRatioReady = true;
  entry.codexNativeTargetRatioReady = true;
  entry.localTargetRatioRecomposition = false;
  entry.targetRatioNativeMatch = true;
  entry.sourceAssetRatio = ratioLabel(imageSize.width, imageSize.height);
  entry.selectedAsset = {
    status: "available",
    provider: "codex-built-in-imagegen",
    mode: "image2-integrated-typography-cover",
    source: sourceCopy,
    codexGeneratedImageSource: source,
    requestedCodexImageSize: `${imageSize.width}x${imageSize.height}`,
    finalPlatformSize: `${width}x${height}`,
    exactPlatformSize: `${width}x${height}`,
  };
  entry.internalReviewFiles = [pngFile, jpgFile];
  entry.files = [
    { format: "png", file: pngFile },
    { format: "jpg", file: jpgFile },
  ];
  entry.previewFiles = [];
  selection.needsRegeneration = (selection.needsRegeneration || []).filter((item) => targetKey(item.targetId) !== key);
  selection.pendingNativeTargetCount = selection.needsRegeneration.length;
  selection.allTargetsUploadReady = selection.pendingNativeTargetCount === 0;
  writeJson(selectionPath, selection);
  return entry;
}

function updateCoverDesign({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize }) {
  const designPath = join(topicDir, "workflow", "cover-design.json");
  if (!existsSync(designPath)) return;
  const design = readJson(designPath);
  const key = targetKey(targetId);
  for (const preset of design.resolutionPresets || []) {
    if (targetKey(preset.id) !== key) continue;
    preset.file = pngFile;
    preset.jpg = jpgFile;
    preset.exactTargetPreview = pngFile;
    preset.uploadReady = true;
    preset.status = "upload-ready-native-target-ratio";
    preset.qualityStatus = "upload-ready-native-target-ratio";
    preset.image2NativeTargetRatioReady = true;
    preset.codexNativeTargetRatioReady = true;
    preset.localTargetRatioRecomposition = false;
    preset.fulfilledBy = "codex-built-in-imagegen";
    preset.codexGeneratedImageSource = source;
    preset.codexSourceCopy = sourceCopy;
    preset.requestedCodexImageSize = `${imageSize.width}x${imageSize.height}`;
  }
  design.coverTargetCompletion = {
    ...(design.coverTargetCompletion || {}),
    updatedAt: new Date().toISOString(),
    generator: "scripts/ingest-codex-image2-cover-target.mjs",
    provider: "codex-built-in-imagegen",
    note: "Pending target-ratio covers are completed only by real Codex/Image2 native-ratio bitmaps. Local recomposition previews remain non-upload-ready.",
  };
  writeJson(designPath, design);
}

function updatePrompts({ topicDir, targetId, entry, promptItem, source, sourceCopy, pngFile, jpgFile, imageSize }) {
  const promptsPath = join(topicDir, "workflow", "cover-image2-prompts.json");
  if (!existsSync(promptsPath)) return;
  const prompts = readJson(promptsPath);
  const key = targetKey(targetId);
  prompts.pendingNativeTargetRatioPrompts = (prompts.pendingNativeTargetRatioPrompts || []).filter((item) => targetKey(item.id || item.targetId || "") !== key);
  prompts.fulfilledNativeTargetRatioExports = [
    ...(prompts.fulfilledNativeTargetRatioExports || []).filter((item) => targetKey(item.id || item.targetId || "") !== key),
    {
      id: key,
      targetId: key,
      width: entry.width,
      height: entry.height,
      ratio: entry.ratio,
      file: pngFile,
      jpg: jpgFile,
      status: "upload-ready-native-target-ratio",
      provider: "codex-built-in-imagegen",
      mode: "image2-integrated-typography-cover",
      codexGeneratedImageSource: source,
      codexSourceCopy: sourceCopy,
      requestedCodexImageSize: `${imageSize.width}x${imageSize.height}`,
      finalPlatformSize: `${entry.width}x${entry.height}`,
      exactPlatformSize: `${entry.width}x${entry.height}`,
      promptTargetId: promptIdOf(promptItem, key),
      promptMethodology: "high-click-knowledge-cover-v1",
    },
  ];
  writeJson(promptsPath, prompts);
}

function main() {
  const topicDir = resolve(argValue("--topic"));
  const targetId = targetKey(argValue("--target"));
  const source = resolve(argValue("--source"));
  if (!topicDir || !targetId || !source) {
    throw new Error("Usage: ingest-codex-image2-cover-target.mjs --topic <topic-dir> --target <target-id> --source <codex-imagegen-png>");
  }
  if (!existsSync(source)) throw new Error(`Source image not found: ${source}`);
  const pngFile = standardCoverFileForTarget(targetId);
  if (!pngFile) throw new Error(`Unsupported cover target: ${targetId}`);
  const jpgFile = jpgForPng(pngFile);
  const imageSize = dimensions(source);
  const sourceCopy = `cover/source-codex-imagegen-native-${targetId}.png`;
  mkdirSync(dirname(join(topicDir, sourceCopy)), { recursive: true });
  copyFileSync(source, join(topicDir, sourceCopy));
  const selection = readJson(join(topicDir, "workflow", "cover-size-selection.json"));
  const entry = (selection.entries || []).find((item) => targetKey(item.targetId) === targetId);
  if (!entry) throw new Error(`Target ${targetId} not found before resize`);
  resizeToFinal({
    source: join(topicDir, sourceCopy),
    png: join(topicDir, pngFile),
    jpg: join(topicDir, jpgFile),
    width: Number(entry.width),
    height: Number(entry.height),
  });
  const updatedEntry = updateSelection({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize });
  updateCoverDesign({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize });
  const promptsPath = join(topicDir, "workflow", "cover-image2-prompts.json");
  const promptItem = existsSync(promptsPath) ? matchingPrompt(readJson(promptsPath), targetId) : null;
  updatePrompts({ topicDir, targetId, entry: updatedEntry, promptItem, source, sourceCopy, pngFile, jpgFile, imageSize });
  console.log(JSON.stringify({
    ok: true,
    topic: relative(process.cwd(), topicDir),
    targetId,
    provider: "codex-built-in-imagegen",
    source,
    sourceCopy,
    pngFile,
    jpgFile,
    sourceDimensions: imageSize,
    finalPlatformSize: `${updatedEntry.width}x${updatedEntry.height}`,
  }, null, 2));
}

main();
