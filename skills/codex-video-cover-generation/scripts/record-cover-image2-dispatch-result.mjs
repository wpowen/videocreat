#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { buildCoverGenerationWorkflowContract } from "./lib/cover-generation-workflow-contract.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function generatedSourcePath(path) {
  const rootArgument = resolve(process.env.CODEX_VIDEO_COVER_GENERATED_ROOT
    || join(process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"), "generated_images"));
  if (!existsSync(rootArgument)) throw new Error(`Generated image root not found: ${rootArgument}`);
  const canonicalRoot = realpathSync(rootArgument);
  const canonicalSource = realpathSync(path);
  const relation = relative(canonicalRoot, canonicalSource);
  if (relation === ".." || relation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(relation)) {
    throw new Error(`Generated source must stay under ${canonicalRoot}: ${canonicalSource}`);
  }
  return canonicalSource;
}

function earliest(values) {
  return values.filter(Boolean).sort()[0] || null;
}

function latest(values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireRunLock(runPath, timeoutMs = 30_000) {
  const lockPath = `${runPath}.lock`;
  const startedAt = Date.now();
  while (true) {
    try {
      mkdirSync(lockPath);
      return lockPath;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() - startedAt >= timeoutMs) throw new Error(`Timed out waiting for cover result lock: ${lockPath}`);
      sleep(25);
    }
  }
}

const outArg = argValue("--out");
const targetId = argValue("--target");
const status = argValue("--status", "generated");
if (!outArg || !targetId || !["generated", "failed"].includes(status)) {
  throw new Error("Usage: record-cover-image2-dispatch-result.mjs --out <topic> --target <id> --status <generated|failed> [--source <path>] [--error <message>]");
}
const topicDir = resolve(outArg);
const planPath = join(topicDir, "workflow", "cover-image2-dispatch-plan.json");
const runPath = join(topicDir, "workflow", "cover-generation-run.json");
const requestPath = join(topicDir, "workflow", "context-image2-cover-requests.json");
const workflowPath = join(topicDir, "workflow", "cover-generation-workflow.json");
if (!existsSync(planPath) || !existsSync(runPath) || !existsSync(requestPath)) throw new Error("Prepare the cover Image2 dispatch before recording results");
const lockPath = acquireRunLock(runPath);
try {
  const plan = readJson(planPath);
  const run = readJson(runPath);
  const job = (plan.jobs || []).find((item) => item.targetId === targetId);
  if (!job) throw new Error(`Target ${targetId} is not part of the prepared pending dispatch set`);
  const sourceArg = argValue("--source");
  let sourcePath = sourceArg ? resolve(sourceArg) : "";
  if (status === "generated" && (!sourcePath || !existsSync(sourcePath))) {
    throw new Error(`Generated source is missing for ${targetId}: ${sourcePath || "not provided"}`);
  }
  if (status === "generated") sourcePath = generatedSourcePath(sourcePath);
  const submittedAt = argValue("--submitted-at", new Date().toISOString());
  const completedAt = argValue("--completed-at", new Date().toISOString());
  const result = {
    targetId,
    status,
    sourcePath: status === "generated" ? sourcePath : null,
    sourceSha256: status === "generated" ? sha256File(sourcePath) : null,
    submittedAt,
    completedAt,
    error: status === "failed" ? argValue("--error", "unknown Image2 failure") : null,
    approvedVisibleText: job.approvedVisibleText || [],
  };
  run.targetResults = [
    ...(run.targetResults || []).filter((item) => item.targetId !== targetId),
    result,
  ];
  const manifest = readJson(requestPath);
  const generationTargetIds = (manifest.requests || [])
    .map((request) => String(request.targetId || request.id || "").replace(/-image2-integrated-cover$/, ""));
  run.targetResults.sort((left, right) => generationTargetIds.indexOf(left.targetId) - generationTargetIds.indexOf(right.targetId));
  const byTarget = new Map(run.targetResults.map((item) => [item.targetId, item]));
  const completedTargetIds = (manifest.requests || [])
    .filter((request) => request.status === "completed")
    .map((request) => String(request.targetId || request.id || "").replace(/-image2-integrated-cover$/, ""));
  const completedTargetSet = new Set(completedTargetIds);
  const generatedTargetIds = generationTargetIds.filter((id) => completedTargetSet.has(id) || byTarget.get(id)?.status === "generated");
  const failedTargetIds = generationTargetIds.filter((id) => !completedTargetSet.has(id) && byTarget.get(id)?.status === "failed");
  const pendingTargetIds = generationTargetIds.filter((id) => !generatedTargetIds.includes(id));
  run.generationTargetIds = generationTargetIds;
  run.generatedTargetIds = generatedTargetIds;
  run.failedTargetIds = failedTargetIds;
  run.retryTargetIds = failedTargetIds;
  run.completedTargetIds = completedTargetIds;
  run.pendingTargetIds = pendingTargetIds;
  run.pendingTargetCount = pendingTargetIds.length;
  run.coversGenerated = generatedTargetIds.length === generationTargetIds.length && failedTargetIds.length === 0;
  run.coversVerified = false;
  run.status = run.coversGenerated ? "covers_generated" : failedTargetIds.length ? "generation_failed" : "dispatching";
  run.timing = {
    ...(run.timing || {}),
    dispatchStartedAt: earliest(run.targetResults.map((item) => item.submittedAt)),
    allGeneratedAt: run.coversGenerated ? latest(run.targetResults.map((item) => item.completedAt)) : null,
    verifiedAt: null,
  };
  writeJsonAtomic(runPath, run);
  writeJsonAtomic(workflowPath, buildCoverGenerationWorkflowContract({
    requestManifest: manifest,
    generationRun: run,
  }));
  console.log(JSON.stringify({
    ok: true,
    targetId,
    status,
    coversGenerated: run.coversGenerated,
    coversVerified: run.coversVerified,
    generatedTargetIds,
    failedTargetIds,
  }, null, 2));
} finally {
  rmSync(lockPath, { recursive: true, force: true });
}
