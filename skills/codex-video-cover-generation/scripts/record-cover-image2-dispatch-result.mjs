#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  const sourcePath = sourceArg ? resolve(sourceArg) : "";
  if (status === "generated" && (!sourcePath || !existsSync(sourcePath))) {
    throw new Error(`Generated source is missing for ${targetId}: ${sourcePath || "not provided"}`);
  }
  const submittedAt = argValue("--submitted-at", new Date().toISOString());
  const completedAt = argValue("--completed-at", new Date().toISOString());
  const result = {
    targetId,
    status,
    sourcePath: status === "generated" ? sourcePath : null,
    submittedAt,
    completedAt,
    error: status === "failed" ? argValue("--error", "unknown Image2 failure") : null,
    approvedVisibleText: job.approvedVisibleText || [],
  };
  run.targetResults = [
    ...(run.targetResults || []).filter((item) => item.targetId !== targetId),
    result,
  ].sort((left, right) => (plan.pendingTargetIds || []).indexOf(left.targetId) - (plan.pendingTargetIds || []).indexOf(right.targetId));
  const byTarget = new Map(run.targetResults.map((item) => [item.targetId, item]));
  const pendingTargetIds = plan.pendingTargetIds || [];
  const generatedTargetIds = pendingTargetIds.filter((id) => byTarget.get(id)?.status === "generated");
  const failedTargetIds = pendingTargetIds.filter((id) => byTarget.get(id)?.status === "failed");
  run.generatedTargetIds = generatedTargetIds;
  run.failedTargetIds = failedTargetIds;
  run.retryTargetIds = failedTargetIds;
  run.coversGenerated = generatedTargetIds.length === pendingTargetIds.length && failedTargetIds.length === 0;
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
    requestManifest: readJson(requestPath),
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
