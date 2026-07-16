#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(__dirname, "..");
const root = join(workspace, "research", "codex-video-workflow-poc", "cover-image2-batch-ingest-self-test");
const topic = join(root, "topic");
const briefPath = join(root, "brief.json");
const targetIds = ["youtube-1280x720", "square-1200x1200"];

function fail(message) {
  throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) fail(`command failed (${result.status}): node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
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
    coverTargetIds: targetIds,
    coverScopeAuthorization: {
      authorizedByUser: true,
      mode: "explicit-target-list",
      requestedTargetIds: targetIds,
      source: "batch-ingest-self-test",
    },
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
  if (plan.jobs.length !== 2 || plan.concurrency !== 2 || !plan.singleWave) {
    fail(`two-target dispatch fixture was not planned as one wave: ${JSON.stringify(plan, null, 2)}`);
  }

  const sources = {
    "youtube-1280x720": join(root, "generated-youtube.png"),
    "square-1200x1200": join(root, "generated-square.png"),
  };
  generatePng(sources["youtube-1280x720"], 1280, 720, "0x243447");
  generatePng(sources["square-1200x1200"], 1200, 1200, "0x6f4b3e");

  for (const targetId of targetIds) {
    runNode([
      join(workspace, "scripts", "record-cover-generation-evidence.mjs"),
      "--topic", topic,
      "--target", targetId,
      "--source", sources[targetId],
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
  if (batchReport.ingestedTargetCount !== 2 || batchReport.fullVideoQcTriggered !== false) {
    fail(`batch ingest report is incorrect: ${batch.stdout}`);
  }
  if (existsSync(join(topic, "workflow", ".cover-ingest.lock"))) fail("batch ingest lock was not released");

  const manifest = readJson(join(topic, "workflow", "context-image2-cover-requests.json"));
  if (manifest.completedRequestCount !== 2 || manifest.pendingRequestCount !== 0 || manifest.allRequestedPlatformUploadCoversReady !== true) {
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
