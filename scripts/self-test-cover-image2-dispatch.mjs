#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildCoverImage2DispatchPlan,
  executeCoverImage2DispatchPlan,
  extractApprovedVisibleText,
} from "../skills/codex-video-cover-generation/scripts/lib/cover-image2-dispatch.mjs";
import { COVER_SKILL_PARITY_FILES, resolveStandaloneCoverSkillRoot } from "./lib/cover-skill-runtime.mjs";
import { buildPlatformCoverContinuationLane } from "./lib/cover-continuation.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(__dirname, "..");

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

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function makeManifest({ completedTargetIds = [] } = {}) {
  const completed = new Set(completedTargetIds);
  const requests = Array.from({ length: 9 }, (_, index) => {
    const number = index + 1;
    const targetId = `cover-target-${number}`;
    return {
      targetId,
      promptTargetId: `${targetId}-image2-integrated-cover`,
      status: completed.has(targetId) ? "completed" : "pending",
      provider: "codex-context-image2",
      tool: "image_gen",
      width: 1000 + number,
      height: 600 + number,
      ratio: "16:9",
      prompt: [
        `Target ${number}`,
        "Text (verbatim):",
        `- \"主标题${number}\"`,
        `- \"副标题${number}\"`,
        `Approved text whitelist: 「主标题${number}」、「副标题${number}」.`,
      ].join("\n"),
      inputImages: [{ role: "main-anchor", path: `/tmp/anchor-${number}.png` }],
      expectedOutput: `cover/context-image2-${targetId}.png`,
      promptSha256: `prompt-${number}`,
      parallelSafe: true,
    };
  });
  return {
    schemaVersion: 1,
    requestCountContract: {
      mode: "all-planned-platform-targets",
      plannedTargetCount: 9,
      expectedRequestCount: 9,
      actualRequestCount: 9,
      requestedTargetIds: requests.map((request) => request.targetId),
      actualTargetIds: requests.map((request) => request.targetId),
      pass: true,
    },
    requests,
  };
}

async function main() {
  const runtimeRoot = mkdtempSync(join(tmpdir(), "cover-skill-runtime-"));
  try {
    const localMirror = join(runtimeRoot, "main-skill", "skills", "codex-video-cover-generation");
    const globalMirror = join(runtimeRoot, "codex-home", "skills", "codex-video-cover-generation");
    cpSync(join(workspace, "skills", "codex-video-cover-generation"), localMirror, { recursive: true });
    cpSync(localMirror, globalMirror, { recursive: true });
    const resolvedGlobal = resolveStandaloneCoverSkillRoot({
      mainSkillRoot: join(runtimeRoot, "main-skill"),
      env: { HOME: runtimeRoot, CODEX_HOME: join(runtimeRoot, "codex-home") },
    });
    if (resolvedGlobal !== globalMirror) fail(`global standalone cover Skill must own runtime execution: ${resolvedGlobal}`);
    writeFileSync(join(localMirror, COVER_SKILL_PARITY_FILES[0]), "drift\n");
    try {
      resolveStandaloneCoverSkillRoot({
        mainSkillRoot: join(runtimeRoot, "main-skill"),
        env: { HOME: runtimeRoot, CODEX_HOME: join(runtimeRoot, "codex-home") },
      });
      fail("cover Skill mirror drift was not rejected");
    } catch (error) {
      if (!/runtime drift detected/i.test(error.message)) throw error;
    }
  } finally {
    rmSync(runtimeRoot, { recursive: true, force: true });
  }

  const allPendingPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest(),
    topicDir: "/tmp/cover-topic",
    createdAt: "2026-07-15T00:00:00.000Z",
  });
  if (allPendingPlan.jobs.length !== 9) fail(`expected all 9 pending targets, got ${allPendingPlan.jobs.length}`);
  if (allPendingPlan.concurrency !== 9) fail(`expected one-wave concurrency 9, got ${allPendingPlan.concurrency}`);
  if (allPendingPlan.pendingTargetCount !== 9 || allPendingPlan.plannedTargetCount !== 9) {
    fail(`dispatch count contract is incomplete: ${JSON.stringify(allPendingPlan, null, 2)}`);
  }
  if (new Set(allPendingPlan.jobs.map((job) => job.targetId)).size !== 9) fail("dispatch plan contains duplicate targets");
  if (allPendingPlan.jobs.some((job) => job.approvedVisibleText.length !== 2)) {
    fail(`target-bound text whitelist was not extracted: ${JSON.stringify(allPendingPlan.jobs, null, 2)}`);
  }

  const resumedPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest({ completedTargetIds: ["cover-target-1"] }),
    topicDir: "/tmp/cover-topic",
    requestedConcurrency: 4,
  });
  if (resumedPlan.jobs.length !== 8) fail(`resume must include every pending target, got ${resumedPlan.jobs.length}`);
  if (resumedPlan.concurrency !== 4) fail(`explicit throughput concurrency should be 4, got ${resumedPlan.concurrency}`);
  if (resumedPlan.jobs.some((job) => job.targetId === "cover-target-1")) fail("completed target was regenerated");
  if (!resumedPlan.targetCountPreserved) fail("throughput concurrency incorrectly changed total request scope");

  const resolvers = [];
  const started = [];
  const executionPromise = executeCoverImage2DispatchPlan({
    plan: allPendingPlan,
    generate: (job) => new Promise((resolveJob) => {
      started.push(job.targetId);
      resolvers.push(() => resolveJob({ imagePath: `/tmp/${job.targetId}.png` }));
    }),
  });
  await new Promise((resolveTick) => setImmediate(resolveTick));
  if (started.length !== 9) fail(`all 9 jobs were not submitted before waiting; started ${started.length}`);
  resolvers.forEach((resolveJob) => resolveJob());
  const execution = await executionPromise;
  if (!execution.coversGenerated || execution.succeededCount !== 9 || execution.failedCount !== 0) {
    fail(`one-wave execution did not complete successfully: ${JSON.stringify(execution, null, 2)}`);
  }

  const isolatedFailure = await executeCoverImage2DispatchPlan({
    plan: allPendingPlan,
    generate: async (job) => {
      if (job.targetId === "cover-target-5") throw new Error("synthetic image2 failure");
      return { imagePath: `/tmp/${job.targetId}.png` };
    },
  });
  if (isolatedFailure.succeededCount !== 8 || isolatedFailure.failedCount !== 1) {
    fail(`one target failure was not isolated: ${JSON.stringify(isolatedFailure, null, 2)}`);
  }
  if (isolatedFailure.failedTargetIds.join(",") !== "cover-target-5") {
    fail(`wrong failed target set: ${isolatedFailure.failedTargetIds.join(",")}`);
  }
  if (isolatedFailure.coversGenerated) fail("partial Image2 generation was reported as complete");

  const synchronousFailure = await executeCoverImage2DispatchPlan({
    plan: allPendingPlan,
    generate: (job) => {
      if (job.targetId === "cover-target-5") throw new Error("synthetic synchronous image2 failure");
      return { imagePath: `/tmp/${job.targetId}.png` };
    },
  });
  if (synchronousFailure.succeededCount !== 8 || synchronousFailure.failedCount !== 1) {
    fail(`synchronous target failure was not isolated: ${JSON.stringify(synchronousFailure, null, 2)}`);
  }
  if (synchronousFailure.retryTargetIds.join(",") !== "cover-target-5") {
    fail(`synchronous failure retry scope drifted: ${synchronousFailure.retryTargetIds.join(",")}`);
  }

  const priorRun = {
    targetResults: allPendingPlan.jobs.map((job) => job.targetId === "cover-target-5"
      ? { targetId: job.targetId, status: "failed", error: "synthetic image2 failure" }
      : {
          targetId: job.targetId,
          status: "generated",
          sourcePath: `/tmp/${job.targetId}.png`,
          sourceSha256: `source-hash:${job.targetId}`,
        }),
    retryTargetIds: ["cover-target-5"],
  };
  const retryPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest(),
    topicDir: "/tmp/cover-topic",
    previousPlan: allPendingPlan,
    previousRun: priorRun,
    sourceExists: () => true,
    sourceFingerprint: (path) => `source-hash:${path.match(/cover-target-\d+/)?.[0] || ""}`,
  });
  if (retryPlan.jobs.length !== 1 || retryPlan.jobs[0]?.targetId !== "cover-target-5") {
    fail(`partial retry must dispatch only the failed target: ${JSON.stringify(retryPlan, null, 2)}`);
  }
  if (retryPlan.preservedGeneratedTargetIds.length !== 8 || retryPlan.concurrency !== 1) {
    fail(`partial retry did not preserve the eight successful targets: ${JSON.stringify(retryPlan, null, 2)}`);
  }
  const repeatedRetryPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest(),
    topicDir: "/tmp/cover-topic",
    previousPlan: retryPlan,
    previousRun: priorRun,
    sourceExists: () => true,
    sourceFingerprint: (path) => `source-hash:${path.match(/cover-target-\d+/)?.[0] || ""}`,
  });
  if (repeatedRetryPlan.jobs.length !== 1 || repeatedRetryPlan.jobs[0]?.targetId !== "cover-target-5") {
    fail(`repeated prepare must keep the retry scope isolated: ${JSON.stringify(repeatedRetryPlan, null, 2)}`);
  }

  const fingerprintedPlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest(),
    topicDir: "/tmp/cover-topic",
    inputImageFingerprint: (path) => `first:${path}`,
  });
  const changedReferencePlan = buildCoverImage2DispatchPlan({
    manifest: makeManifest(),
    topicDir: "/tmp/cover-topic",
    previousPlan: fingerprintedPlan,
    previousRun: priorRun,
    sourceExists: () => true,
    inputImageFingerprint: (path) => `changed:${path}`,
    sourceFingerprint: (path) => `source-hash:${path.match(/cover-target-\d+/)?.[0] || ""}`,
  });
  if (changedReferencePlan.preservedGeneratedTargetIds.length !== 0 || changedReferencePlan.jobs.length !== 9) {
    fail("replacing an input image at the same path must invalidate every stale generated cover");
  }
  const staleDeclaredHashManifest = makeManifest();
  for (const request of staleDeclaredHashManifest.requests) request.inputImages[0].contentSha256 = "stale-declared-hash";
  const recomputedReferencePlan = buildCoverImage2DispatchPlan({
    manifest: staleDeclaredHashManifest,
    topicDir: "/tmp/cover-topic",
    previousPlan: fingerprintedPlan,
    previousRun: priorRun,
    sourceExists: () => true,
    inputImageFingerprint: (path) => `changed:${path}`,
    sourceFingerprint: (path) => `source-hash:${path.match(/cover-target-\d+/)?.[0] || ""}`,
  });
  if (recomputedReferencePlan.preservedGeneratedTargetIds.length !== 0) {
    fail("a stale manifest-declared input hash must not override recomputed input bytes");
  }

  const pendingCoverRequests = makeManifest();
  const generatedTargetIds = pendingCoverRequests.requests.map((request) => request.targetId);
  const batchIngestLane = buildPlatformCoverContinuationLane({
    coverRequests: pendingCoverRequests,
    coverDispatch: { jobs: [] },
    coverRun: { coversGenerated: true, coversVerified: false, generatedTargetIds },
  });
  if (batchIngestLane?.status !== "batch-ingest-required" || batchIngestLane.pendingRequestCount !== 9) {
    fail(`generated-but-unverified covers must keep full-auto continuation alive: ${JSON.stringify(batchIngestLane, null, 2)}`);
  }
  const verifiedCoverRequests = makeManifest({ completedTargetIds: generatedTargetIds });
  verifiedCoverRequests.allRequestedPlatformUploadCoversReady = true;
  const noCoverLane = buildPlatformCoverContinuationLane({
    coverRequests: verifiedCoverRequests,
    coverDispatch: { jobs: [] },
    coverRun: { coversGenerated: true, coversVerified: true, generatedTargetIds },
  });
  if (noCoverLane !== null) fail(`verified covers must not leave a continuation lane: ${JSON.stringify(noCoverLane)}`);

  const prepareRoot = mkdtempSync(join(tmpdir(), "cover-retry-prepare-"));
  const outsideRoot = mkdtempSync(join(tmpdir(), "cover-retry-outside-"));
  const previousGeneratedRoot = process.env.CODEX_VIDEO_COVER_GENERATED_ROOT;
  try {
    process.env.CODEX_VIDEO_COVER_GENERATED_ROOT = prepareRoot;
    const topicDir = join(prepareRoot, "topic");
    const workflowDir = join(topicDir, "workflow");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "context-image2-cover-requests.json"), `${JSON.stringify(makeManifest(), null, 2)}\n`);
    const prepareScript = join(workspace, "skills", "codex-video-cover-generation", "scripts", "prepare-cover-image2-dispatch.mjs");
    const recorderScript = join(workspace, "skills", "codex-video-cover-generation", "scripts", "record-cover-image2-dispatch-result.mjs");
    runNode([prepareScript, "--out", topicDir]);
    const sourceByTarget = new Map(allPendingPlan.jobs.map((job) => {
      const path = join(prepareRoot, `${job.targetId}.png`);
      writeFileSync(path, job.targetId);
      return [job.targetId, path];
    }));
    const runPath = join(workflowDir, "cover-generation-run.json");
    const preparedRun = JSON.parse(readFileSync(runPath, "utf8"));
    preparedRun.targetResults = allPendingPlan.jobs.map((job) => job.targetId === "cover-target-5"
      ? { targetId: job.targetId, status: "failed", error: "synthetic image2 failure" }
      : {
          targetId: job.targetId,
          status: "generated",
          sourcePath: sourceByTarget.get(job.targetId),
          sourceSha256: sha256File(sourceByTarget.get(job.targetId)),
        });
    preparedRun.retryTargetIds = ["cover-target-5"];
    writeFileSync(runPath, `${JSON.stringify(preparedRun, null, 2)}\n`);
    runNode([prepareScript, "--out", topicDir]);
    runNode([prepareScript, "--out", topicDir]);
    const preparedRetryPlan = JSON.parse(readFileSync(join(workflowDir, "cover-image2-dispatch-plan.json"), "utf8"));
    if (preparedRetryPlan.pendingTargetIds.join(",") !== "cover-target-5"
      || preparedRetryPlan.preservedGeneratedTargetIds.length !== 8) {
      fail(`prepare command widened a failed-target-only retry: ${JSON.stringify(preparedRetryPlan, null, 2)}`);
    }
    const outsideSource = join(outsideRoot, "unapproved-cover.png");
    writeFileSync(outsideSource, "not an approved generated-image source");
    const outsideSourceError = runNodeExpectFailure([
      recorderScript,
      "--out", topicDir,
      "--target", "cover-target-5",
      "--status", "generated",
      "--source", outsideSource,
    ]);
    if (!outsideSourceError.includes("Generated source must stay under")) {
      fail(`dispatch result recorder accepted an out-of-root source: ${outsideSourceError}`);
    }
    runNode([
      recorderScript,
      "--out", topicDir,
      "--target", "cover-target-5",
      "--status", "generated",
      "--source", sourceByTarget.get("cover-target-5"),
    ]);
    const completedRetryRun = JSON.parse(readFileSync(runPath, "utf8"));
    if (completedRetryRun.coversGenerated !== true
      || completedRetryRun.generatedTargetIds.length !== 9
      || completedRetryRun.targetResults.length !== 9) {
      fail(`retry completion forgot preserved successful targets: ${JSON.stringify(completedRetryRun, null, 2)}`);
    }
  } finally {
    if (previousGeneratedRoot === undefined) delete process.env.CODEX_VIDEO_COVER_GENERATED_ROOT;
    else process.env.CODEX_VIDEO_COVER_GENERATED_ROOT = previousGeneratedRoot;
    rmSync(prepareRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  }

  const extracted = extractApprovedVisibleText([
    "Text (verbatim):",
    "- \"黄金开篇\"",
    "- \"第一章留人公式\"",
    "Constraints: no extra text.",
  ].join("\n"));
  if (JSON.stringify(extracted) !== JSON.stringify(["黄金开篇", "第一章留人公式"])) {
    fail(`visible text extraction drifted: ${JSON.stringify(extracted)}`);
  }

  const runtimeContractPath = join(workspace, "skills", "codex-video-cover-generation", "references", "image2-dispatch-runtime.md");
  const runtimeContract = readFileSync(runtimeContractPath, "utf8");
  if (!runtimeContract.includes("Promise.allSettled")) fail("runtime contract does not require failure-isolated concurrent dispatch");
  if (/\[0:4\]|slice\s*\(\s*0\s*,\s*4\s*\)/.test(runtimeContract)) fail("runtime contract still permits four-item slicing");
  if (!runtimeContract.includes("all pending jobs")) fail("runtime contract does not explicitly submit the full pending set");

  const skillSource = readFileSync(join(workspace, "skills", "codex-video-cover-generation", "SKILL.md"), "utf8");
  for (const required of [
    "prepare-cover-image2-dispatch.mjs",
    "image2-dispatch-runtime.md",
    "ingest-codex-image2-cover-batch.mjs",
    "coversGenerated",
    "coversVerified",
  ]) {
    if (!skillSource.includes(required)) fail(`standalone cover Skill is missing ${required}`);
  }

  console.log(JSON.stringify({
    ok: true,
    plannedTargetCount: allPendingPlan.plannedTargetCount,
    pendingTargetCount: allPendingPlan.pendingTargetCount,
    defaultConcurrency: allPendingPlan.concurrency,
    allSubmittedBeforeWait: started.length,
    isolatedFailureTargetIds: isolatedFailure.failedTargetIds,
    synchronousFailureTargetIds: synchronousFailure.failedTargetIds,
    retryTargetIds: retryPlan.pendingTargetIds,
    staleReferenceInvalidatedTargetCount: changedReferencePlan.jobs.length,
    generatedUnverifiedContinuationStatus: batchIngestLane.status,
  }, null, 2));
}

await main();
