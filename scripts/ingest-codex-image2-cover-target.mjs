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
    "video-opening": "video-opening",
    "master-16x9-3840x2160": "master-16x9-4k",
    "youtube-1280x720": "horizontal-16x9-1280x720",
    "bilibili-1920x1080": "horizontal-16x9-1920x1080",
    "bilibili-1146x717": "bilibili-common-1146x717",
    "instagram-reels-420x654": "instagram-reels-cover",
  };
  return aliases[id] || id;
}

function standardCoverFileForTarget(targetId) {
  const files = {
    "master-16x9-4k": "cover/cover-master-16x9-3840x2160.png",
    "video-opening": "cover/cover-video-opening-16x9.png",
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

function safePathPart(value, fallback) {
  const text = String(value || fallback || "cover").trim();
  return text.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ");
}

function inspectionPassed(status) {
  return ["passed-human-review", "passed-vision-review", "passed-human-or-vision-review"].includes(String(status || ""));
}

function inferPrimaryPlatformTarget(selection = {}) {
  if (selection.primaryPlatformUploadCoverTargetId) return targetKey(selection.primaryPlatformUploadCoverTargetId);
  const entries = Array.isArray(selection.entries) ? selection.entries : [];
  const opening = entries.find((item) => targetKey(item.targetId) === "video-opening");
  if (Number(opening?.height || 0) > Number(opening?.width || 0)) return "vertical-1080x1920";
  return "horizontal-16x9-1280x720";
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
    canonicalProvider: "codex-context-image2",
    tool: "image_gen",
    mode: "image2-integrated-typography-cover",
    source: sourceCopy,
    codexGeneratedImageSource: source,
    requestedCodexImageSize: `${imageSize.width}x${imageSize.height}`,
    finalPlatformSize: `${width}x${height}`,
    exactPlatformSize: `${width}x${height}`,
  };
  const finalDeliveryDirectory = selection.finalDeliveryDirectory || "最终成品";
  const finalGroup = safePathPart(entry.group, "平台投稿封面");
  const finalLabel = safePathPart(entry.label, targetId);
  const finalPngFile = join(finalDeliveryDirectory, finalGroup, `${finalLabel}.png`);
  const finalJpgFile = join(finalDeliveryDirectory, finalGroup, `${finalLabel}.jpg`);
  mkdirSync(dirname(join(topicDir, finalPngFile)), { recursive: true });
  copyFileSync(join(topicDir, pngFile), join(topicDir, finalPngFile));
  copyFileSync(join(topicDir, jpgFile), join(topicDir, finalJpgFile));
  entry.internalReviewFiles = [pngFile, jpgFile];
  entry.files = [
    { format: "png", file: finalPngFile },
    { format: "jpg", file: finalJpgFile },
  ];
  entry.previewFiles = [];
  selection.needsRegeneration = (selection.needsRegeneration || []).filter((item) => targetKey(item.targetId) !== key);
  selection.pendingNativeTargetCount = selection.needsRegeneration.length;
  selection.allTargetsUploadReady = selection.pendingNativeTargetCount === 0;
  selection.primaryPlatformUploadCoverTargetId = inferPrimaryPlatformTarget(selection);
  selection.platformUploadReadyTargetIds = (selection.entries || [])
    .filter((item) => targetKey(item.targetId) !== "video-opening" && item.uploadReady === true && item.image2NativeTargetRatioReady === true)
    .map((item) => targetKey(item.targetId));
  selection.primaryPlatformUploadCoverReady = selection.platformUploadReadyTargetIds.includes(selection.primaryPlatformUploadCoverTargetId);
  selection.rootOutputCopies = (selection.entries || [])
    .filter((item) => item.uploadReady === true)
    .flatMap((item) => item.files || [])
    .map((item) => item.file)
    .filter(Boolean);
  writeJson(selectionPath, selection);
  return entry;
}

function updateCoverDesign({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize, entry, requestState }) {
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
    preset.canonicalProvider = "codex-context-image2";
    preset.tool = "image_gen";
    preset.codexGeneratedImageSource = source;
    preset.codexSourceCopy = sourceCopy;
    preset.requestedCodexImageSize = `${imageSize.width}x${imageSize.height}`;
  }
  const selectedAsset = {
    status: "available",
    provider: "codex-built-in-imagegen",
    canonicalProvider: "codex-context-image2",
    tool: "image_gen",
    mode: "image2-integrated-typography-cover",
    targetId: key,
    source: pngFile,
    codexGeneratedImageSource: source,
    codexSourceCopy: sourceCopy,
    requestedCodexImageSize: `${imageSize.width}x${imageSize.height}`,
    finalPlatformSize: `${entry.width}x${entry.height}`,
  };
  design.platformSubmissionCoverAssets = [
    ...(design.platformSubmissionCoverAssets || []).filter((item) => targetKey(item.targetId) !== key),
    selectedAsset,
  ];
  if (requestState.primaryPlatformUploadCoverTargetId === key) design.selectedCoverAsset = selectedAsset;
  design.primaryPlatformUploadCoverTargetId = requestState.primaryPlatformUploadCoverTargetId;
  design.primaryPlatformUploadCoverReady = requestState.primaryPlatformUploadCoverReady;
  design.allRequestedPlatformUploadCoversReady = requestState.allRequestedPlatformUploadCoversReady;
  design.rootOutputCopies = requestState.rootOutputCopies;
  design.thumbnailReadiness = {
    ...(design.thumbnailReadiness || {}),
    primaryPlatformUploadCoverReady: requestState.primaryPlatformUploadCoverReady,
    allRequestedPlatformUploadCoversReady: requestState.allRequestedPlatformUploadCoversReady,
    platformSubmissionCoverIsIndependentArtifact: true,
    videoInternalCoverDoesNotSatisfySubmissionCover: true,
  };
  design.coverTargetCompletion = {
    ...(design.coverTargetCompletion || {}),
    updatedAt: new Date().toISOString(),
    generator: "scripts/ingest-codex-image2-cover-target.mjs",
    provider: "codex-built-in-imagegen",
    note: "Pending target-ratio covers are completed only by real Codex/Image2 native-ratio bitmaps. Local recomposition previews remain non-upload-ready.",
  };
  writeJson(designPath, design);
}

function updateContextRequests({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize, entry, inspectionStatus }) {
  const requestPath = join(topicDir, "workflow", "context-image2-cover-requests.json");
  if (!existsSync(requestPath)) throw new Error(`Missing canonical platform cover request manifest: ${requestPath}`);
  const manifest = readJson(requestPath);
  const key = targetKey(targetId);
  const requests = Array.isArray(manifest.requests) ? manifest.requests : [];
  const request = requests.find((item) => targetKey(item.targetId || item.id || "") === key);
  if (!request) throw new Error(`Target ${targetId} not found in ${requestPath}`);
  request.status = "completed";
  request.completedAt = new Date().toISOString();
  request.provider = "codex-context-image2";
  request.renderProvider = "codex-built-in-imagegen";
  request.tool = "image_gen";
  request.purpose = "platform-submission-cover";
  request.videoInternalCover = false;
  request.actualOutput = pngFile;
  request.actualJpgOutput = jpgFile;
  request.codexGeneratedImageSource = source;
  request.codexSourceCopy = sourceCopy;
  request.sourceDimensions = imageSize;
  request.finalPlatformSize = `${entry.width}x${entry.height}`;
  request.inspectionStatus = inspectionStatus;
  request.inspectionPassed = inspectionPassed(inspectionStatus);

  const selection = readJson(join(topicDir, "workflow", "cover-size-selection.json"));
  const primaryTargetId = targetKey(manifest.primaryPlatformUploadCoverTargetId || inferPrimaryPlatformTarget(selection));
  const requiredRequests = requests.filter((item) => item.requiredForFinalCover !== false);
  const completedRequests = requiredRequests.filter((item) => item.status === "completed" && item.inspectionPassed === true);
  const completedTargetIds = completedRequests.map((item) => targetKey(item.targetId || item.id || ""));
  const pendingTargetIds = requiredRequests
    .map((item) => targetKey(item.targetId || item.id || ""))
    .filter((id) => !completedTargetIds.includes(id));
  const primaryEntry = (selection.entries || []).find((item) => targetKey(item.targetId) === primaryTargetId);
  const primaryRequest = requiredRequests.find((item) => targetKey(item.targetId || item.id || "") === primaryTargetId);
  const primaryReady = Boolean(primaryRequest?.status === "completed"
    && primaryRequest?.inspectionPassed === true
    && primaryEntry?.uploadReady === true
    && primaryEntry?.image2NativeTargetRatioReady === true
    && existsSync(join(topicDir, primaryRequest.actualOutput || "")));
  const allReady = requiredRequests.length > 0 && pendingTargetIds.length === 0;
  manifest.status = allReady ? "satisfied" : completedRequests.length ? "partially-satisfied" : "required-pending";
  manifest.purpose = "platform-submission-cover";
  manifest.videoInternalCoverDoesNotSatisfyRequest = true;
  manifest.primaryPlatformUploadCoverTargetId = primaryTargetId;
  manifest.primaryPlatformUploadCoverReady = primaryReady;
  manifest.allRequestedPlatformUploadCoversReady = allReady;
  manifest.completedRequestCount = completedRequests.length;
  manifest.pendingRequestCount = pendingTargetIds.length;
  manifest.completedTargetIds = completedTargetIds;
  manifest.pendingTargetIds = pendingTargetIds;
  writeJson(requestPath, manifest);
  return {
    manifest,
    primaryPlatformUploadCoverTargetId: primaryTargetId,
    primaryPlatformUploadCoverReady: primaryReady,
    allRequestedPlatformUploadCoversReady: allReady,
    completedTargetIds,
    pendingTargetIds,
    rootOutputCopies: selection.rootOutputCopies || [],
  };
}

function updateCoverQc({ topicDir, requestState }) {
  const qcPath = join(topicDir, "workflow", "cover-image2-qc.json");
  const qc = existsSync(qcPath) ? readJson(qcPath) : {};
  const primaryReady = requestState.primaryPlatformUploadCoverReady;
  const allReady = requestState.allRequestedPlatformUploadCoversReady;
  const completedCount = requestState.completedTargetIds.length;
  qc.bitmapSubjectPresent = completedCount > 0;
  qc.integratedTypographyAssetPresent = completedCount > 0;
  qc.platformSpecificIntegratedAssetsPresent = allReady;
  qc.targetSpecificIntegratedAssetsPresent = allReady;
  qc.allIntegratedAssetsNativeTargetRatio = allReady;
  qc.generatedBitmapInspectionRequired = true;
  qc.generatedBitmapInspectionStatus = allReady
    ? "passed-all-platform-submission-cover-targets"
    : primaryReady
      ? "passed-primary-platform-submission-cover-target"
      : "pending-human-or-vision-review";
  qc.generatedBitmapInspectionPassed = primaryReady;
  qc.primaryPlatformUploadCoverTargetId = requestState.primaryPlatformUploadCoverTargetId;
  qc.primaryPlatformUploadCoverReady = primaryReady;
  qc.allRequestedPlatformUploadCoversReady = allReady;
  qc.platformSubmissionCoverReady = primaryReady;
  qc.contextImage2GenerationRequired = !allReady;
  qc.contextImage2HandoffRequired = !allReady;
  qc.finalCoverQualityEligible = allReady;
  qc.reviewPendingOnly = primaryReady && !allReady;
  qc.reviewFallbackOnly = !primaryReady;
  qc.completedPlatformCoverTargetIds = requestState.completedTargetIds;
  qc.pendingPlatformCoverTargetIds = requestState.pendingTargetIds;
  qc.blockers = [
    ...(!primaryReady ? ["primary platform submission cover has not been generated by Context Image2/image_gen and inspected"] : []),
    ...(!allReady ? ["one or more requested platform submission cover targets remain pending Context Image2/image_gen generation"] : []),
  ];
  writeJson(qcPath, qc);
  return qc;
}

function updatePackageDeliveryState({ topicDir, requestState }) {
  const selection = readJson(join(topicDir, "workflow", "cover-size-selection.json"));
  const primaryEntry = (selection.entries || []).find((item) => targetKey(item.targetId) === requestState.primaryPlatformUploadCoverTargetId);
  const primaryPng = (primaryEntry?.files || []).find((item) => item.format === "png")?.file
    || primaryEntry?.internalReviewFiles?.find((file) => /\.png$/i.test(file))
    || "";
  const logQcPath = join(topicDir, "logs", "qc.json");
  if (existsSync(logQcPath)) {
    const logQc = readJson(logQcPath);
    logQc.checks = {
      ...(logQc.checks || {}),
      coverNativeImage2Ready: requestState.primaryPlatformUploadCoverReady,
      platformSubmissionCoverReady: requestState.primaryPlatformUploadCoverReady,
    };
    logQc.coverArtifacts = {
      ...(logQc.coverArtifacts || {}),
      status: requestState.primaryPlatformUploadCoverReady ? "platform-submission-cover-ready" : "review-grade-pending-context-image2",
      uploadReady: requestState.primaryPlatformUploadCoverReady,
      primaryPlatformUploadCoverTargetId: requestState.primaryPlatformUploadCoverTargetId,
      primaryPlatformUploadCover: primaryPng,
      allRequestedPlatformUploadCoversReady: requestState.allRequestedPlatformUploadCoversReady,
      contextImage2Pending: !requestState.allRequestedPlatformUploadCoversReady,
    };
    logQc.pass = Object.values(logQc.checks).every(Boolean);
    logQc.status = logQc.pass ? "pass" : "fail";
    writeJson(logQcPath, logQc);
  }
  const deliveryPath = join(topicDir, "delivery-manifest.json");
  if (existsSync(deliveryPath)) {
    const delivery = readJson(deliveryPath);
    delivery.cover = {
      ...(delivery.cover || {}),
      purpose: "platform-submission-cover",
      primaryPlatformUploadCoverTargetId: requestState.primaryPlatformUploadCoverTargetId,
      primaryPlatformUploadCover: primaryPng,
      primaryPlatformUploadCoverReady: requestState.primaryPlatformUploadCoverReady,
      allRequestedPlatformUploadCoversReady: requestState.allRequestedPlatformUploadCoversReady,
      status: requestState.primaryPlatformUploadCoverReady ? "primary-platform-submission-cover-ready" : "pending-context-image2",
    };
    writeJson(deliveryPath, delivery);
  }
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
  const inspectionStatus = argValue("--inspection-status", "pending-human-or-vision-review");
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
  const promptsPath = join(topicDir, "workflow", "cover-image2-prompts.json");
  const promptItem = existsSync(promptsPath) ? matchingPrompt(readJson(promptsPath), targetId) : null;
  updatePrompts({ topicDir, targetId, entry: updatedEntry, promptItem, source, sourceCopy, pngFile, jpgFile, imageSize });
  const requestState = updateContextRequests({
    topicDir,
    targetId,
    source,
    sourceCopy,
    pngFile,
    jpgFile,
    imageSize,
    entry: updatedEntry,
    inspectionStatus,
  });
  const coverQc = updateCoverQc({ topicDir, requestState });
  updateCoverDesign({ topicDir, targetId, source, sourceCopy, pngFile, jpgFile, imageSize, entry: updatedEntry, requestState });
  updatePackageDeliveryState({ topicDir, requestState });
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
    inspectionStatus,
    primaryPlatformUploadCoverTargetId: requestState.primaryPlatformUploadCoverTargetId,
    primaryPlatformUploadCoverReady: requestState.primaryPlatformUploadCoverReady,
    allRequestedPlatformUploadCoversReady: requestState.allRequestedPlatformUploadCoversReady,
    finalCoverQualityEligible: coverQc.finalCoverQualityEligible,
  }, null, 2));
}

main();
