#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function targetKey(id = "") {
  const aliases = {
    "youtube-1280x720": "horizontal-16x9-1280x720",
    "bilibili-1920x1080": "horizontal-16x9-1920x1080",
    "bilibili-1146x717": "bilibili-common-1146x717",
    "instagram-reels-420x654": "instagram-reels-cover",
  };
  return aliases[id] || id;
}

function main() {
  const out = resolve(argValue("--out", process.cwd()));
  const requireAll = process.argv.includes("--require-all-platform-covers");
  const failures = [];
  const requestPath = join(out, "workflow", "context-image2-cover-requests.json");
  const selectionPath = join(out, "workflow", "cover-size-selection.json");
  const qcPath = join(out, "workflow", "cover-image2-qc.json");
  for (const [path, label] of [[requestPath, "request manifest"], [selectionPath, "cover selection"], [qcPath, "cover QC"]]) {
    if (!existsSync(path)) failures.push(`missing ${label}: ${path}`);
  }
  if (failures.length) {
    console.log(JSON.stringify({ ok: false, out, failures }, null, 2));
    process.exit(1);
  }

  const manifest = readJson(requestPath);
  const selection = readJson(selectionPath);
  const qc = readJson(qcPath);
  const primaryTargetId = targetKey(manifest.primaryPlatformUploadCoverTargetId || selection.primaryPlatformUploadCoverTargetId || "");
  const request = (manifest.requests || []).find((item) => targetKey(item.targetId || item.id || "") === primaryTargetId);
  const entry = (selection.entries || []).find((item) => targetKey(item.targetId || item.id || "") === primaryTargetId);
  const actualOutput = request?.actualOutput || "";
  const finalPng = (entry?.files || []).find((item) => item?.format === "png")?.file || "";

  if (manifest.provider !== "codex-context-image2" || manifest.tool !== "image_gen") failures.push("platform cover manifest must use Context Image2/image_gen");
  if (manifest.purpose !== "platform-submission-cover") failures.push("cover request manifest must explicitly identify platform-submission-cover purpose");
  if (manifest.videoInternalCoverDoesNotSatisfyRequest !== true) failures.push("manifest must reject the in-video cover as submission-cover evidence");
  if (!primaryTargetId) failures.push("missing primaryPlatformUploadCoverTargetId");
  if (request?.status !== "completed") failures.push(`primary platform cover request is not completed: ${primaryTargetId || "missing"}`);
  if (request?.provider !== "codex-context-image2" || request?.tool !== "image_gen") failures.push("primary platform cover request lacks canonical Image2 provenance");
  if (request?.purpose !== "platform-submission-cover" || request?.videoInternalCover !== false) failures.push("primary request is not an independent platform submission cover");
  if (request?.inspectionPassed !== true) failures.push("primary platform cover has not passed human/vision inspection");
  if (!actualOutput || !existsSync(join(out, actualOutput))) failures.push(`primary platform cover output is missing: ${actualOutput || "not recorded"}`);
  if (!finalPng.startsWith("最终成品/") || !existsSync(join(out, finalPng))) failures.push(`primary platform cover is missing from 最终成品/: ${finalPng || "not recorded"}`);
  if (entry?.uploadReady !== true || entry?.image2NativeTargetRatioReady !== true) failures.push("primary platform cover selection is not native-ratio upload-ready");
  if (manifest.primaryPlatformUploadCoverReady !== true || qc.primaryPlatformUploadCoverReady !== true || qc.platformSubmissionCoverReady !== true) failures.push("canonical primary platform cover readiness flags are not true");
  if (requireAll && (manifest.allRequestedPlatformUploadCoversReady !== true || qc.finalCoverQualityEligible !== true)) failures.push("not all requested platform cover targets are complete");

  const report = {
    ok: failures.length === 0,
    out,
    requireAllPlatformCovers: requireAll,
    primaryPlatformUploadCoverTargetId: primaryTargetId,
    primaryPlatformUploadCoverReady: manifest.primaryPlatformUploadCoverReady === true,
    allRequestedPlatformUploadCoversReady: manifest.allRequestedPlatformUploadCoversReady === true,
    actualOutput,
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
