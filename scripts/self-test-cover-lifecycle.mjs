#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(process.env.CODEX_VIDEO_WORKFLOW_TEST_ROOT || resolve(__dirname, ".."));
const root = join(workspace, "research", "codex-video-workflow-poc", "cover-lifecycle-self-test");
const out = join(root, "topic");
const briefPath = join(root, "brief.json");
const sourcePath = join(root, "generated-primary-cover.png");

function fail(message) {
  throw new Error(message);
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) fail(`command failed (${result.status}): node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runCoverOnly() {
  runNode([
    join(workspace, "scripts", "poc-video-workflow.mjs"),
    "--brief", briefPath,
    "--out", out,
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-delivery-page",
  ]);
}

function main() {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeFileSync(briefPath, `${JSON.stringify({
    title: "写小说实践：如何从灵感转化为小说主题",
    language: "zh",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 20,
    videoType: "tutorial-explainer",
    imageSource: "image2-dryrun",
    scenes: [
      { id: "idea-pool", headline: ["十个灵感"], subtitle: "先建立十条原始灵感。" },
      { id: "filters", headline: ["四层筛选"], subtitle: "依次检查热爱、市场、独特性和资源。" },
      { id: "decision", headline: ["主项目", "备用项目"], subtitle: "四层筛选后留下一个主项目和一个备用项目。" },
    ],
    narration: "先建立十条原始灵感。通过四层筛选，最后留下一个能写完的主项目和一个备用项目。",
  }, null, 2)}\n`);

  runCoverOnly();
  const requestPath = join(out, "workflow", "context-image2-cover-requests.json");
  let requests = readJson(requestPath);
  if (requests.requests.length !== 1) fail(`expected one platform-scoped request, got ${requests.requests.length}`);
  const primaryTarget = requests.primaryPlatformUploadCoverTargetId;
  const primary = requests.requests[0];
  const initialSelection = readJson(join(out, "workflow", "cover-size-selection.json"));
  const initialEntry = initialSelection.entries.find((item) => item.targetId === primaryTarget);
  const reviewRelative = initialEntry?.internalReviewFiles?.find((file) => /\.png$/i.test(file))
    || initialEntry?.reviewGradeFiles?.find((file) => /\.png$/i.test(file));
  const reviewSource = reviewRelative ? join(out, reviewRelative) : "";
  if (!existsSync(reviewSource)) fail(`review source missing: ${reviewSource}`);
  copyFileSync(reviewSource, sourcePath);

  runNode([
    join(workspace, "scripts", "ingest-codex-image2-cover-target.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--inspection-status", "passed-vision-review",
  ]);
  requests = readJson(requestPath);
  if (requests.status !== "satisfied" || requests.primaryPlatformUploadCoverReady !== true || requests.allRequestedPlatformUploadCoversReady !== true) {
    fail(`primary ingest did not satisfy the platform-scoped request: ${JSON.stringify(requests, null, 2)}`);
  }
  const completed = requests.requests[0];
  const completedOutput = join(out, completed.actualOutput);
  const completedHash = sha256(completedOutput);

  runCoverOnly();
  const rerunRequests = readJson(requestPath);
  const rerunPrimary = rerunRequests.requests.find((request) => request.targetId === primaryTarget);
  if (rerunPrimary?.status !== "completed" || rerunPrimary?.inspectionPassed !== true) {
    fail(`completed request regressed after rerun: ${JSON.stringify(rerunPrimary, null, 2)}`);
  }
  if (!existsSync(completedOutput)) fail(`completed cover disappeared after rerun: ${completedOutput}`);
  if (sha256(completedOutput) !== completedHash) fail("completed Image2 cover pixels were overwritten during rerun");
  const selection = readJson(join(out, "workflow", "cover-size-selection.json"));
  const entry = selection.entries.find((item) => item.targetId === primaryTarget);
  if (entry?.uploadReady !== true || !entry.files?.every((file) => existsSync(join(out, file.file)))) {
    fail(`completed cover is missing from 最终成品 after rerun: ${JSON.stringify(entry, null, 2)}`);
  }

  const workflowSource = readFileSync(join(workspace, "scripts", "poc-video-workflow.mjs"), "utf8");
  if (!/const pass = videoPass && coverPublishingReady/.test(workflowSource)) {
    fail("final workflow pass still ignores platform-cover publishing readiness");
  }
  console.log(JSON.stringify({ ok: true, out, primaryTarget, completedOutput, completedHash }, null, 2));
}

main();
