#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  validateContextImage2PromptParity,
  validateCoverRequestScopeContract,
} from "./lib/cover-generation-workflow.mjs";
import { REQUIRED_COVER_INSPECTION_CHECKS } from "./lib/cover-evidence-contract.mjs";

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

function matchingPrompt(prompts, targetId) {
  const key = targetKey(targetId);
  return (prompts.prompts || []).find((item) => targetKey(String(item.targetId || "").replace(/-image2-integrated-cover$/, "")) === key)
    || (prompts.pendingNativeTargetRatioPrompts || []).find((item) => targetKey(item.id || item.targetId || "") === key)
    || null;
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

function packageOutputPath(root, manifestPath, label) {
  const value = String(manifestPath || "").trim();
  if (!value || isAbsolute(value)) throw new Error(`${label} must be a relative package path.`);
  const canonicalRoot = realpathSync(root);
  const candidate = resolve(canonicalRoot, value);
  const lexicalRelation = relative(canonicalRoot, candidate);
  if (!lexicalRelation || lexicalRelation === ".." || lexicalRelation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(lexicalRelation)) {
    throw new Error(`${label} must stay inside the topic package: ${value}`);
  }
  let existingAncestor = candidate;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  ensureInside(realpathSync(existingAncestor), canonicalRoot, label);
  return candidate;
}

function main() {
  const topicDir = resolve(argValue("--topic"));
  const targetId = argValue("--target");
  const sourceArgument = resolve(argValue("--source"));
  const inspectionStatus = argValue("--inspection-status");
  const inspectorType = argValue("--inspector-type");
  const inspectionAttestationArgument = argValue("--inspection-attestation");
  if (!argValue("--topic") || !targetId || !argValue("--source") || !inspectionAttestationArgument) {
    throw new Error("Usage: record-cover-generation-evidence.mjs --topic <topic-dir> --target <target-id> --source <imagegen-png> --inspection-attestation <independent-review.json> --inspection-status <passed-status> --inspector-type <human|vision>");
  }
  if (!existsSync(sourceArgument)) throw new Error(`Generated source not found: ${sourceArgument}`);
  const source = realpathSync(sourceArgument);
  if (!existsSync(topicDir)) throw new Error(`Topic package not found: ${topicDir}`);
  const canonicalTopicDir = realpathSync(topicDir);
  const passedStatuses = new Set(["passed-human-review", "passed-vision-review", "passed-human-or-vision-review"]);
  if (!passedStatuses.has(inspectionStatus) || !["human", "vision"].includes(inspectorType)) {
    throw new Error("Evidence recording requires an explicit passed inspection status and inspectorType human or vision.");
  }

  const topicPrefix = `${canonicalTopicDir}/`;
  if (source.startsWith(topicPrefix)) {
    throw new Error("Generated source must remain outside the topic package until canonical ingest.");
  }
  const generatedRootArgument = resolve(process.env.CODEX_VIDEO_COVER_GENERATED_ROOT
    || join(process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"), "generated_images"));
  if (!existsSync(generatedRootArgument)) throw new Error(`Generated image root not found: ${generatedRootArgument}`);
  const generatedRoot = realpathSync(generatedRootArgument);
  ensureInside(source, generatedRoot, "Generated source");
  const inspectionAttestationPath = resolve(inspectionAttestationArgument);
  if (!existsSync(inspectionAttestationPath)) throw new Error(`Independent inspection attestation not found: ${inspectionAttestationPath}`);
  const canonicalAttestationPath = realpathSync(inspectionAttestationPath);
  ensureInside(canonicalAttestationPath, generatedRoot, "Inspection attestation");
  if (canonicalAttestationPath.startsWith(`${canonicalTopicDir}/`)) {
    throw new Error("Independent inspection attestation must remain outside the topic package until evidence recording.");
  }

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
  const promptPlan = readJson(promptPlanPath);
  const scopeContract = validateCoverRequestScopeContract({ manifest, coverImage2Prompts: promptPlan });
  if (!scopeContract.pass) throw new Error(`Cover request scope contract failed: ${scopeContract.failures.join("; ")}`);
  const promptItem = matchingPrompt(promptPlan, targetId);
  if (!promptItem) throw new Error(`Cover prompt plan item not found for ${targetId}`);
  const artDirection = promptItem.coverArtDirectionSystem || promptPlan.coverArtDirectionSystem || {};
  const styleId = request.coverArtDirectionStyleId
    || promptItem.coverArtDirectionStyle?.id
    || artDirection.selectedStyle?.id
    || "";
  if (artDirection.methodologyVersion !== "cover-art-direction-system-v1"
    || artDirection.selectedStyleCount !== 1
    || !styleId
    || artDirection.selectedStyle?.id !== styleId
    || !artDirection.selectionReason) {
    throw new Error(`Cover art-direction contract is incomplete for ${targetId}`);
  }
  const semanticColor = promptItem.platformStrategy?.colorSystem || {};
  if (semanticColor.methodologyVersion !== "cover-semantic-color-system-v1"
    || !semanticColor.semanticFamilyId
    || !semanticColor.surfaceMode
    || !semanticColor.selectionReason
    || !semanticColor.backgroundPolicy) {
    throw new Error(`Cover semantic-color contract is incomplete for ${targetId}`);
  }
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
  const attestation = readJson(canonicalAttestationPath);
  const attestationChecks = new Map((Array.isArray(attestation.checks) ? attestation.checks : [])
    .filter((check) => check && typeof check === "object")
    .map((check) => [check.id, check]));
  const invalidAttestationChecks = REQUIRED_COVER_INSPECTION_CHECKS.filter((id) => {
    const check = attestationChecks.get(id);
    return check?.passed !== true || check?.assessedBy !== inspectorType;
  });
  if (targetKey(attestation.targetId || "") !== targetKey(request.targetId || targetId)
    || attestation.sourceSha256 !== outputSha256
    || attestation.status !== inspectionStatus
    || attestation.inspectorType !== inspectorType
    || !attestation.reviewer
    || !Number.isFinite(Date.parse(attestation.inspectedAt || ""))
    || invalidAttestationChecks.length
    || attestation.artDirection?.methodologyVersion !== artDirection.methodologyVersion
    || attestation.artDirection?.styleId !== styleId
    || attestation.artDirection?.selectionReason !== artDirection.selectionReason
    || attestation.semanticColor?.methodologyVersion !== semanticColor.methodologyVersion
    || attestation.semanticColor?.familyId !== semanticColor.semanticFamilyId
    || attestation.semanticColor?.surfaceMode !== semanticColor.surfaceMode
    || attestation.semanticColor?.backgroundPolicy !== semanticColor.backgroundPolicy
    || attestation.glance?.first !== "topic-and-promise-clear"
    || attestation.glance?.second !== "proof-or-metaphor-clear"
    || attestation.glance?.previewWidth !== "120-180px") {
    throw new Error(`Independent inspection attestation does not match the current source, target, reviewer, or cover design contract${invalidAttestationChecks.length ? `; invalid checks: ${invalidAttestationChecks.join(", ")}` : ""}.`);
  }
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
    inspectedAt: attestation.inspectedAt,
    reviewer: attestation.reviewer,
    independentAttestationPath: canonicalAttestationPath,
    artDirection: {
      methodologyVersion: artDirection.methodologyVersion,
      styleId,
      selectionReason: artDirection.selectionReason,
    },
    semanticColor: {
      methodologyVersion: semanticColor.methodologyVersion,
      familyId: semanticColor.semanticFamilyId,
      surfaceMode: semanticColor.surfaceMode,
      backgroundPolicy: semanticColor.backgroundPolicy,
    },
    glance: {
      first: "topic-and-promise-clear",
      second: "proof-or-metaphor-clear",
      previewWidth: "120-180px",
    },
    checks: REQUIRED_COVER_INSPECTION_CHECKS.map((id) => ({ ...attestationChecks.get(id) })),
  };
  const receiptPath = packageOutputPath(canonicalTopicDir, request.generationReceiptPath || `workflow/context-image2-cover-evidence/${targetId}-generation-receipt.json`, "generationReceiptPath");
  const inspectionPath = packageOutputPath(canonicalTopicDir, request.inspectionRecordPath || `workflow/context-image2-cover-evidence/${targetId}-inspection-record.json`, "inspectionRecordPath");
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
