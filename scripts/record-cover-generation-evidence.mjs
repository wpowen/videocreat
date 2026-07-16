#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  validateContextImage2PromptParity,
  validateCoverRequestScopeContract,
} from "./lib/cover-generation-workflow.mjs";

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

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function targetKey(id = "") {
  const aliases = {
    "master-16x9-3840x2160": "master-16x9-4k",
    "youtube-1280x720": "horizontal-16x9-1280x720",
    "bilibili-1920x1080": "horizontal-16x9-1920x1080",
    "bilibili-1146x717": "bilibili-common-1146x717",
    "instagram-reels-420x654": "instagram-reels-cover",
  };
  return aliases[id] || id;
}

function dimensions(path) {
  const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], { encoding: "utf8" });
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
  if (!width || !height) throw new Error(`Unable to read image dimensions: ${path}`);
  return { width, height };
}

function ensureInside(path, root, label) {
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(root);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`${label} must stay under ${resolvedRoot}: ${resolvedPath}`);
  }
}

function main() {
  const topicDir = resolve(argValue("--topic"));
  const targetId = argValue("--target");
  const source = resolve(argValue("--source"));
  const inspectionStatus = argValue("--inspection-status");
  const inspectorType = argValue("--inspector-type");
  if (!argValue("--topic") || !targetId || !argValue("--source")) {
    throw new Error("Usage: record-cover-generation-evidence.mjs --topic <topic-dir> --target <target-id> --source <imagegen-png> --inspection-status <passed-status> --inspector-type <human|vision>");
  }
  if (!existsSync(source)) throw new Error(`Generated source not found: ${source}`);
  const passedStatuses = new Set(["passed-human-review", "passed-vision-review", "passed-human-or-vision-review"]);
  if (!passedStatuses.has(inspectionStatus) || !["human", "vision"].includes(inspectorType)) {
    throw new Error("Evidence recording requires an explicit passed inspection status and inspectorType human or vision.");
  }

  const topicPrefix = `${topicDir}/`;
  if (source.startsWith(topicPrefix)) {
    throw new Error("Generated source must remain outside the topic package until canonical ingest.");
  }
  const generatedRoot = resolve(process.env.CODEX_VIDEO_COVER_GENERATED_ROOT
    || join(process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"), "generated_images"));
  ensureInside(source, generatedRoot, "Generated source");

  const manifestPath = join(topicDir, "workflow", "context-image2-cover-requests.json");
  if (!existsSync(manifestPath)) throw new Error(`Canonical request manifest not found: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  const requestIndex = (manifest.requests || []).findIndex((item) => targetKey(item.targetId || item.id || "") === targetKey(targetId));
  if (requestIndex < 0) throw new Error(`No canonical Context Image2 request found for ${targetId}`);
  const request = manifest.requests[requestIndex];
  const parity = validateContextImage2PromptParity({ topicDir, manifest });
  if (!parity.pass) throw new Error(`Canonical prompt parity failed: ${parity.failures.join("; ")}`);
  const promptPlanPath = join(topicDir, "workflow", "cover-image2-prompts.json");
  if (!existsSync(promptPlanPath)) throw new Error(`Cover prompt plan not found: ${promptPlanPath}`);
  const scopeContract = validateCoverRequestScopeContract({ manifest, coverImage2Prompts: readJson(promptPlanPath) });
  if (!scopeContract.pass) throw new Error(`Cover request scope contract failed: ${scopeContract.failures.join("; ")}`);
  for (const input of request.inputImages || []) {
    if (input.required === true && (!input.path || !existsSync(input.path))) {
      throw new Error(`Required role-labelled input image is missing: ${input.role || "unknown-role"}=${input.path || ""}`);
    }
  }

  const imageSize = dimensions(source);
  const expectedWidth = Number(request.width || 0);
  const expectedHeight = Number(request.height || 0);
  if (!expectedWidth || !expectedHeight) throw new Error(`Request ${targetId} is missing native target dimensions.`);
  if (Math.abs((imageSize.width / imageSize.height) - (expectedWidth / expectedHeight)) > 0.01) {
    throw new Error(`Generated source ratio ${imageSize.width}x${imageSize.height} does not match request ${expectedWidth}x${expectedHeight}.`);
  }

  const outputSha256 = sha256File(source);
  const promptSha256 = sha256Text(request.prompt || "");
  const now = new Date().toISOString();
  const requestId = request.promptTargetId || request.targetId || request.id;
  const receipt = {
    schemaVersion: 1,
    targetId: request.targetId || targetId,
    requestId,
    provider: "codex-context-image2",
    tool: "image_gen",
    generatedAt: argValue("--generated-at", now),
    sourcePath: source,
    outputSha256,
    promptSha256,
    nativeSourceDimensions: `${imageSize.width}x${imageSize.height}`,
    width: imageSize.width,
    height: imageSize.height,
    promptSource: `workflow/context-image2-cover-requests.json:requests[${requestIndex}].prompt`,
  };
  const inspection = {
    schemaVersion: 1,
    targetId: request.targetId || targetId,
    sourceSha256: outputSha256,
    status: inspectionStatus,
    inspectorType,
    inspectedAt: now,
    checks: [
      "topic-and-promise-match",
      "presenter-identity-preserved",
      "approved-text-readable-no-extra-text",
      "no-edge-clipping-letterbox-or-matte",
      "native-target-ratio-match",
      "not-ui-ppt-or-duplicate-review-artwork",
    ],
  };
  const receiptPath = join(topicDir, request.generationReceiptPath || `workflow/context-image2-cover-evidence/${targetId}-generation-receipt.json`);
  const inspectionPath = join(topicDir, request.inspectionRecordPath || `workflow/context-image2-cover-evidence/${targetId}-inspection-record.json`);
  writeJson(receiptPath, receipt);
  writeJson(inspectionPath, inspection);
  console.log(JSON.stringify({
    ok: true,
    topic: topicDir,
    targetId: request.targetId || targetId,
    requestId,
    source,
    sourceDimensions: imageSize,
    outputSha256,
    promptSha256,
    generationReceiptPath: receiptPath,
    inspectionRecordPath: inspectionPath,
  }, null, 2));
}

main();
