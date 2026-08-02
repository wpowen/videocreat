#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { REQUIRED_COVER_INSPECTION_CHECKS } from "./lib/cover-evidence-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(__dirname, "..");
const root = join(workspace, "research", "codex-video-workflow-poc", "cover-image2-batch-ingest-self-test");
const topic = join(root, "topic");
const briefPath = join(root, "brief.json");
const targetIds = [
  "master-16x9-4k",
  "youtube-1280x720",
  "horizontal-4x3-1600x1200",
  "bilibili-common-1146x717",
  "bilibili-1920x1080",
  "vertical-1080x1920",
  "vertical-profile-1080x1440",
  "instagram-reels-cover",
  "square-1200x1200",
];

function fail(message) {
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeInspectionAttestation({ targetId, source }) {
  const promptPlan = readJson(join(topic, "workflow", "cover-image2-prompts.json"));
  const promptItem = (promptPlan.prompts || []).find((item) => String(item.targetId || "").replace(/-image2-integrated-cover$/, "") === targetId);
  if (!promptItem) fail(`missing prompt plan item for attestation: ${targetId}`);
  const artDirection = promptItem.coverArtDirectionSystem || promptPlan.coverArtDirectionSystem || {};
  const semanticColor = promptItem.platformStrategy?.colorSystem || {};
  const path = join(root, `inspection-attestation-${targetId}.json`);
  writeFileSync(path, `${JSON.stringify({
    schemaVersion: 1,
    targetId,
    sourceSha256: sha256File(source),
    status: "passed-vision-review",
    inspectorType: "vision",
    reviewer: "cover-batch-self-test-vision",
    inspectedAt: "2026-07-15T00:00:00.000Z",
    artDirection: {
      methodologyVersion: artDirection.methodologyVersion,
      styleId: artDirection.selectedStyle?.id,
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
    checks: REQUIRED_COVER_INSPECTION_CHECKS.map((id) => ({ id, passed: true, assessedBy: "vision" })),
  }, null, 2)}\n`);
  return path;
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) fail(`command failed (${result.status}): node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function runNodeExpectFailure(args, expectedPattern) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: "utf8" });
  if (result.status === 0) fail(`command unexpectedly passed: node ${args.join(" ")}`);
  const output = `${result.stdout}\n${result.stderr}`;
  if (expectedPattern && !expectedPattern.test(output)) {
    fail(`command failed for the wrong reason: node ${args.join(" ")}\n${output}`);
  }
  return result;
}

function generatePng(path, width, height, color) {
  const result = spawnSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi",
    "-i", `color=c=${color}:s=${width}x${height}:d=0.04`,
    "-frames:v", "1",
    path,
  ], { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) fail(`failed to generate fixture image: ${result.stderr || result.stdout}`);
}

function main() {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  process.env.CODEX_VIDEO_COVER_GENERATED_ROOT = root;
  writeFileSync(briefPath, `${JSON.stringify({
    title: "教你如何开篇黄金三章",
    language: "zh",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 20,
    videoType: "tutorial-explainer",
    imageSource: "image2-dryrun",
    scenes: [
      { id: "opening", headline: ["黄金开篇"], subtitle: "测试批量封面入库。" },
      { id: "middle", headline: ["压力升级"], subtitle: "确认每个目标独立绑定。" },
      { id: "ending", headline: ["回报承诺"], subtitle: "完成后统一验证状态。" },
    ],
    narration: "测试批量封面入库。确认每个目标独立绑定。完成后统一验证状态。",
  }, null, 2)}\n`);

  runNode([
    join(workspace, "scripts", "poc-video-workflow.mjs"),
    "--brief", briefPath,
    "--out", topic,
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-output",
  ]);
  runNode([
    join(workspace, "skills", "codex-video-cover-generation", "scripts", "prepare-cover-image2-dispatch.mjs"),
    "--out", topic,
  ]);
  const plan = readJson(join(topic, "workflow", "cover-image2-dispatch-plan.json"));
  if (plan.jobs.length !== targetIds.length || plan.concurrency !== targetIds.length || !plan.singleWave) {
    fail(`nine-target dispatch fixture was not planned as one wave: ${JSON.stringify(plan, null, 2)}`);
  }

  const sourceColors = ["0x294755", "0x4a203f", "0x102118", "0x302865", "0x12382e", "0x243447", "0x472637", "0x26394a", "0x16384a"];
  const sources = Object.fromEntries(plan.jobs.map((job, index) => {
    const path = join(root, `generated-${job.targetId}.png`);
    generatePng(path, job.width, job.height, sourceColors[index % sourceColors.length]);
    return [job.targetId, path];
  }));

  for (const targetId of targetIds) {
    const attestationPath = writeInspectionAttestation({ targetId, source: sources[targetId] });
    runNode([
      join(workspace, "scripts", "record-cover-generation-evidence.mjs"),
      "--topic", topic,
      "--target", targetId,
      "--source", sources[targetId],
      "--inspection-attestation", attestationPath,
      "--inspection-status", "passed-vision-review",
      "--inspector-type", "vision",
    ]);
    runNode([
      join(workspace, "skills", "codex-video-cover-generation", "scripts", "record-cover-image2-dispatch-result.mjs"),
      "--out", topic,
      "--target", targetId,
      "--source", sources[targetId],
      "--submitted-at", "2026-07-15T00:00:00.000Z",
      "--completed-at", "2026-07-15T00:00:01.000Z",
    ]);
  }

  const inspectionPath = join(topic, "workflow", "context-image2-cover-evidence", "youtube-1280x720-inspection-record.json");
  const inspection = readJson(inspectionPath);
  for (const requiredCheck of [
    "art-direction-style-match",
    "semantic-background-policy-match",
    "first-glance-topic-promise-clear",
    "second-glance-proof-or-metaphor-clear",
    "no-unapproved-full-canvas-warm-paper",
  ]) {
    const result = inspection.checks?.find((check) => check?.id === requiredCheck);
    if (result?.passed !== true || result?.assessedBy !== "vision") fail(`inspection evidence is missing a passed ${requiredCheck}`);
  }
  if (!inspection.artDirection?.styleId
    || !inspection.semanticColor?.familyId
    || !inspection.semanticColor?.surfaceMode
    || inspection.glance?.first !== "topic-and-promise-clear"
    || inspection.glance?.second !== "proof-or-metaphor-clear") {
    fail(`inspection evidence is not bound to art direction, semantic color, and glance decisions: ${JSON.stringify(inspection, null, 2)}`);
  }
  writeFileSync(inspectionPath, `${JSON.stringify({
    ...inspection,
    checks: inspection.checks.filter((check) => check?.id !== "art-direction-style-match"),
  }, null, 2)}\n`);
  runNodeExpectFailure([
    join(workspace, "scripts", "ingest-codex-image2-cover-target.mjs"),
    "--topic", topic,
    "--target", "youtube-1280x720",
    "--source", sources["youtube-1280x720"],
    "--generation-receipt", join(topic, "workflow", "context-image2-cover-evidence", "youtube-1280x720-generation-receipt.json"),
    "--inspection-record", inspectionPath,
    "--validate-only",
  ], /inspection.*art-direction-style-match/i);
  writeFileSync(inspectionPath, `${JSON.stringify(inspection, null, 2)}\n`);

  const generatedRun = readJson(join(topic, "workflow", "cover-generation-run.json"));
  if (generatedRun.coversGenerated !== true || generatedRun.coversVerified !== false || generatedRun.status !== "covers_generated") {
    fail(`generated/verified states were conflated before ingest: ${JSON.stringify(generatedRun, null, 2)}`);
  }

  const batch = runNode([
    join(workspace, "skills", "codex-video-cover-generation", "scripts", "ingest-codex-image2-cover-batch.mjs"),
    "--out", topic,
    "--workflow-root", workspace,
  ]);
  const batchReport = JSON.parse(batch.stdout);
  if (batchReport.ingestedTargetCount !== targetIds.length || batchReport.fullVideoQcTriggered !== false) {
    fail(`batch ingest report is incorrect: ${batch.stdout}`);
  }
  if (existsSync(join(topic, "workflow", ".cover-ingest.lock"))) fail("batch ingest lock was not released");

  const manifest = readJson(join(topic, "workflow", "context-image2-cover-requests.json"));
  if (manifest.completedRequestCount !== targetIds.length || manifest.pendingRequestCount !== 0 || manifest.allRequestedPlatformUploadCoversReady !== true) {
    fail(`batch ingest did not complete the full requested scope: ${JSON.stringify(manifest, null, 2)}`);
  }
  const verifiedRun = readJson(join(topic, "workflow", "cover-generation-run.json"));
  if (verifiedRun.coversGenerated !== true || verifiedRun.coversVerified !== true || verifiedRun.status !== "covers_verified") {
    fail(`batch verification state is incorrect: ${JSON.stringify(verifiedRun, null, 2)}`);
  }
  const workflow = readJson(join(topic, "workflow", "cover-generation-workflow.json"));
  if (workflow.coversGenerated !== true || workflow.coversVerified !== true || workflow.status !== "covers_verified") {
    fail(`standalone workflow contract did not converge: ${JSON.stringify(workflow, null, 2)}`);
  }

  runNode([join(workspace, "scripts", "validate-cover-generation-workflow.mjs"), "--out", topic]);
  runNode([join(workspace, "scripts", "validate-platform-submission-cover.mjs"), "--out", topic]);

  const legacyWorkflowPath = join(topic, "workflow", "cover-generation-workflow.json");
  writeFileSync(legacyWorkflowPath, `${JSON.stringify({
    schemaVersion: 1,
    stage: "standalone-platform-cover-generation",
    status: "satisfied",
  }, null, 2)}\n`);
  runNode([
    join(workspace, "skills", "codex-video-cover-generation", "scripts", "prepare-cover-image2-dispatch.mjs"),
    "--out", topic,
  ]);
  const resumedVerifiedRun = readJson(join(topic, "workflow", "cover-generation-run.json"));
  const resumedVerifiedWorkflow = readJson(join(topic, "workflow", "cover-generation-workflow.json"));
  if (resumedVerifiedRun.status !== "verified" || resumedVerifiedRun.coversGenerated !== true || resumedVerifiedRun.coversVerified !== true) {
    fail(`preparing an already completed package regressed its generation state: ${JSON.stringify(resumedVerifiedRun, null, 2)}`);
  }
  if (resumedVerifiedWorkflow.status !== "covers_verified"
    || resumedVerifiedWorkflow.coversGenerated !== true
    || resumedVerifiedWorkflow.coversVerified !== true
    || resumedVerifiedWorkflow.generationRun !== "workflow/cover-generation-run.json") {
    fail(`preparing an already completed package did not synchronize the standalone workflow: ${JSON.stringify(resumedVerifiedWorkflow, null, 2)}`);
  }
  runNode([join(workspace, "scripts", "validate-cover-generation-workflow.mjs"), "--out", topic]);

  console.log(JSON.stringify({
    ok: true,
    topic,
    dispatchedTargetCount: plan.jobs.length,
    ingestedTargetCount: manifest.completedRequestCount,
    coversGenerated: verifiedRun.coversGenerated,
    coversVerified: verifiedRun.coversVerified,
    fullVideoQcTriggered: batchReport.fullVideoQcTriggered,
  }, null, 2));
}

main();
