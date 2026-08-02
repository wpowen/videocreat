#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyCoverQcRerun } from "./lib/cover-qc-rerun.mjs";
import { REQUIRED_COVER_INSPECTION_CHECKS } from "./lib/cover-evidence-contract.mjs";

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

function runNodeExpectFailure(args) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: "utf8" });
  if (result.status === 0) fail(`command unexpectedly passed: node ${args.join(" ")}\n${result.stdout}`);
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function generateDeterministicTargetPng(path, width, height) {
  const result = spawnSync("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi",
    "-i", `color=c=0x4a203f:s=${width}x${height}:d=0.04`,
    "-frames:v", "1",
    path,
  ], { cwd: workspace, encoding: "utf8" });
  if (result.status !== 0) fail(`failed to generate self-contained target PNG: ${result.stderr || result.stdout}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeInspectionAttestation({ targetId, source }) {
  const promptPlan = readJson(join(out, "workflow", "cover-image2-prompts.json"));
  const promptItem = (promptPlan.prompts || []).find((item) => String(item.targetId || "").replace(/-image2-integrated-cover$/, "") === targetId);
  if (!promptItem) fail(`missing prompt plan item for attestation: ${targetId}`);
  const artDirection = promptItem.coverArtDirectionSystem || promptPlan.coverArtDirectionSystem || {};
  const semanticColor = promptItem.platformStrategy?.colorSystem || {};
  const path = join(root, `inspection-attestation-${targetId}.json`);
  writeFileSync(path, `${JSON.stringify({
    schemaVersion: 1,
    targetId,
    sourceSha256: sha256(source),
    status: "passed-vision-review",
    inspectorType: "vision",
    reviewer: "cover-lifecycle-self-test-vision",
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

function runCoverOnly() {
  runNode([
    join(workspace, "scripts", "poc-video-workflow.mjs"),
    "--brief", briefPath,
    "--out", out,
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-output",
  ]);
}

function main() {
  if (classifyCoverQcRerun({ exitCode: 0, result: { ok: true } }) !== "qc-rerun-complete"
    || classifyCoverQcRerun({ exitCode: 0, result: { ok: false } }) !== "qc-rerun-review-only"
    || classifyCoverQcRerun({ exitCode: 2, result: { ok: true } }) !== "qc-rerun-review-only") {
    fail("cover QC rerun classification no longer requires both zero exit and ok=true");
  }
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  process.env.CODEX_VIDEO_COVER_GENERATED_ROOT = root;
  const brief = {
    title: "写小说实践：如何从灵感转化为小说主题",
    language: "zh",
    platform: "local-review-horizontal",
    aspectRatio: "16:9",
    durationSeconds: 20,
    videoType: "tutorial-explainer",
    imageSource: "image2-dryrun",
    coverPrimaryOnly: true,
    scenes: [
      { id: "idea-pool", headline: ["十个灵感"], subtitle: "先建立十条原始灵感。" },
      { id: "filters", headline: ["四层筛选"], subtitle: "依次检查热爱、市场、独特性和资源。" },
      { id: "decision", headline: ["主项目", "备用项目"], subtitle: "四层筛选后留下一个主项目和一个备用项目。" },
    ],
    narration: "先建立十条原始灵感。通过四层筛选，最后留下一个能写完的主项目和一个备用项目。",
  };
  writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
  const unauthorizedScopeError = runNodeExpectFailure([
    join(workspace, "scripts", "poc-video-workflow.mjs"),
    "--brief", briefPath,
    "--out", out,
    "--cover-only",
    "--image-source", "image2-dryrun",
    "--no-open-output",
  ]);
  if (!unauthorizedScopeError.includes("Cover scope narrowing requires explicit user authorization")) {
    fail(`unauthorized primary-only cover scope was not rejected at planning: ${unauthorizedScopeError}`);
  }
  writeFileSync(briefPath, `${JSON.stringify({
    ...brief,
    coverScopeAuthorization: {
      authorizedByUser: true,
      mode: "explicit-primary-only",
      requestedTargetIds: ["youtube-1280x720"],
      source: "self-test-user-request",
    },
  }, null, 2)}\n`);

  runCoverOnly();
  runNode([
    join(workspace, "skills", "codex-video-cover-generation", "scripts", "prepare-cover-image2-dispatch.mjs"),
    "--out", out,
  ]);
  runNode([
    join(workspace, "scripts", "validate-cover-generation-workflow.mjs"),
    "--out", out,
    "--allow-pending",
  ]);
  const requestPath = join(out, "workflow", "context-image2-cover-requests.json");
  let requests = readJson(requestPath);
  if (requests.requests.length !== 1) fail(`expected one platform-scoped request, got ${requests.requests.length}`);
  const primaryTarget = requests.primaryPlatformUploadCoverTargetId;
  const primary = requests.requests[0];
  const initialSelection = readJson(join(out, "workflow", "cover-size-selection.json"));
  const initialEntry = initialSelection.entries.find((item) => item.targetId === primaryTarget);
  generateDeterministicTargetPng(sourcePath, 1672, 941);
  const inspectionAttestationPath = writeInspectionAttestation({ targetId: primaryTarget, source: sourcePath });

  const unverifiedError = runNodeExpectFailure([
    join(workspace, "scripts", "ingest-codex-image2-cover-target.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--inspection-attestation", inspectionAttestationPath,
    "--inspection-status", "passed-vision-review",
  ]);
  if (!unverifiedError.includes("generation-receipt") || !unverifiedError.includes("inspection-record")) {
    fail(`arbitrary local PNG was not rejected for missing generation evidence: ${unverifiedError}`);
  }
  const selfAttestationError = runNodeExpectFailure([
    join(workspace, "scripts", "record-cover-generation-evidence.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--inspection-status", "passed-vision-review",
    "--inspector-type", "vision",
  ]);
  if (!selfAttestationError.includes("--inspection-attestation")) {
    fail(`evidence recorder accepted a self-asserted review without independent attestation: ${selfAttestationError}`);
  }
  const originalReceiptPath = primary.generationReceiptPath;
  primary.generationReceiptPath = "../escaped-generation-receipt.json";
  writeFileSync(requestPath, `${JSON.stringify(requests, null, 2)}\n`);
  const recorderTraversalError = runNodeExpectFailure([
    join(workspace, "scripts", "record-cover-generation-evidence.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--inspection-attestation", inspectionAttestationPath,
    "--inspection-status", "passed-vision-review",
    "--inspector-type", "vision",
  ]);
  if (!recorderTraversalError.includes("generationReceiptPath must stay inside the topic package")
    || existsSync(join(out, "..", "escaped-generation-receipt.json"))) {
    fail(`evidence recorder did not reject a manifest path escape: ${recorderTraversalError}`);
  }
  primary.generationReceiptPath = originalReceiptPath;
  writeFileSync(requestPath, `${JSON.stringify(requests, null, 2)}\n`);
  runNode([
    join(workspace, "scripts", "record-cover-generation-evidence.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--inspection-attestation", inspectionAttestationPath,
    "--inspection-status", "passed-vision-review",
    "--inspector-type", "vision",
  ]);
  runNode([
    join(workspace, "skills", "codex-video-cover-generation", "scripts", "record-cover-image2-dispatch-result.mjs"),
    "--out", out,
    "--target", primaryTarget,
    "--source", sourcePath,
  ]);
  const receiptPath = join(out, primary.generationReceiptPath);
  const inspectionPath = join(out, primary.inspectionRecordPath);
  requests = readJson(requestPath);
  requests.requests[0].generationReceiptPath = "../escaped-ingest-receipt.json";
  writeFileSync(requestPath, `${JSON.stringify(requests, null, 2)}\n`);
  const ingestTraversalError = runNodeExpectFailure([
    join(workspace, "scripts", "ingest-codex-image2-cover-target.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--generation-receipt", receiptPath,
    "--inspection-record", inspectionPath,
  ]);
  if (!ingestTraversalError.includes("generationReceiptPath must stay inside the topic package")
    || existsSync(join(out, "..", "escaped-ingest-receipt.json"))) {
    fail(`cover ingest did not reject a manifest path escape: ${ingestTraversalError}`);
  }
  requests.requests[0].generationReceiptPath = originalReceiptPath;
  writeFileSync(requestPath, `${JSON.stringify(requests, null, 2)}\n`);
  runNode([
    join(workspace, "scripts", "ingest-codex-image2-cover-target.mjs"),
    "--topic", out,
    "--target", primaryTarget,
    "--source", sourcePath,
    "--generation-receipt", receiptPath,
    "--inspection-record", inspectionPath,
  ]);
  runNode([
    join(workspace, "scripts", "validate-cover-generation-workflow.mjs"),
    "--out", out,
  ]);
  requests = readJson(requestPath);
  if (requests.status !== "satisfied" || requests.primaryPlatformUploadCoverReady !== true || requests.allRequestedPlatformUploadCoversReady !== true) {
    fail(`primary ingest did not satisfy the platform-scoped request: ${JSON.stringify(requests, null, 2)}`);
  }
  const completed = requests.requests[0];
  const completedOutput = join(out, completed.actualOutput);
  const completedHash = sha256(completedOutput);

  runCoverOnly();
  runNode([
    join(workspace, "scripts", "validate-cover-generation-workflow.mjs"),
    "--out", out,
  ]);
  const rerunRequests = readJson(requestPath);
  const rerunPrimary = rerunRequests.requests.find((request) => request.targetId === primaryTarget);
  if (rerunPrimary?.status !== "completed" || rerunPrimary?.inspectionPassed !== true) {
    fail(`completed request regressed after rerun: ${JSON.stringify(rerunPrimary, null, 2)}`);
  }
  if (!existsSync(completedOutput)) fail(`completed cover disappeared after rerun: ${completedOutput}`);
  if (sha256(completedOutput) !== completedHash) fail("completed Image2 cover pixels were overwritten during rerun");
  const selection = readJson(join(out, "workflow", "cover-size-selection.json"));
  const entry = selection.entries.find((item) => item.targetId === primaryTarget || item.sourceTargetId === primaryTarget);
  if (entry?.uploadReady !== true || !entry.files?.every((file) => existsSync(join(out, file.file)))) {
    fail(`completed cover is missing from 最终成品 after rerun: ${JSON.stringify(entry, null, 2)}`);
  }
  if (selection.pendingNativeTargetCount !== 0 || selection.needsRegeneration?.length !== 0) {
    fail(`completed requested cover scope still exposes stale regeneration work: ${JSON.stringify(selection.needsRegeneration, null, 2)}`);
  }
  if (existsSync(join(out, "最终成品", "评审级封面-非上传终版"))
    || existsSync(join(out, "最终成品", "需原生重生成清单.md"))) {
    fail("completed requested cover scope left stale review-grade or regeneration files in 最终成品");
  }

  const workflowSource = readFileSync(join(workspace, "scripts", "poc-video-workflow.mjs"), "utf8");
  const ingestSource = readFileSync(join(workspace, "scripts", "ingest-codex-image2-cover-target.mjs"), "utf8");
  if (!/const pass = videoPass && coverPublishingReady/.test(workflowSource)) {
    fail("final workflow pass still ignores platform-cover publishing readiness");
  }
  if (!/coverRequestCompletionComplete:\s*\(\(\) =>/.test(workflowSource)
    || !/checks\.coverRequestCompletionComplete[\s\S]{0,180}checks\.coverImage2FinalQualityEligible/.test(workflowSource)) {
    fail("publishing readiness does not require every requested cover target to complete");
  }
  if (!/coverImage2Qc\.finalCoverQualityEligible === true[\s\S]{0,180}coverImage2Qc\.allRequestedPlatformUploadCoversReady === true/.test(workflowSource)) {
    fail("primary-cover readiness can still override all-target final cover eligibility");
  }
  const platformValidatorSource = readFileSync(join(workspace, "scripts", "validate-platform-submission-cover.mjs"), "utf8");
  if (!/manifest\.requestCountContract\?\.mode !== "explicit-primary-only"/.test(platformValidatorSource)
    || !/Number\(manifest\.completedRequestCount\) !== \(manifest\.requests \|\| \[\]\)\.length/.test(platformValidatorSource)) {
    fail("platform cover validator does not infer all-target completion from the requested scope");
  }
  if (!/const deliveryClass = qc\.pass[\s\S]{0,180}"video-review-ready"/.test(workflowSource)
    || !/if \(qc\.pass\) \{[\s\S]{0,420}copyFileSync\(finalMp4, join\(out, "final\.mp4"\)\)/.test(workflowSource)) fail("final video promotion is no longer gated by QC plus publishing-cover readiness");
  if (!/writeJson\(join\(out, "review-manifest\.json"\)/.test(workflowSource)
    || !/rmSync\(join\(out, "delivery-manifest\.json"\)/.test(workflowSource)) fail("pending-cover runs can still masquerade as final delivery");
  if (!/const runFullPackageQc = process\.argv\.includes\("--run-full-package-qc"\)/.test(ingestSource)
    || !/requestState\.allRequestedPlatformUploadCoversReady && runFullPackageQc && !deferPackageFinalization/.test(ingestSource)
    || !/cover-verified-full-video-qc-not-run/.test(ingestSource)
    || !/fullVideoQcTriggeredByCoverWorkflow:\s*false/.test(ingestSource)) {
    fail("cover ingest can still trigger full-video QC without an explicit parent-workflow request");
  }
  if (!/final\.audio-normalized\.mp4[\s\S]{0,180}final\.mp4/.test(ingestSource)) {
    fail("cover completion QC does not prefer the final audio-normalized video artifact");
  }
  console.log(JSON.stringify({ ok: true, out, primaryTarget, completedOutput, completedHash }, null, 2));
}

main();
