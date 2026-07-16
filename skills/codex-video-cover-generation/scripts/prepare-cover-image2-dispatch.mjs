#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildCoverImage2DispatchPlan } from "./lib/cover-image2-dispatch.mjs";
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

const outArg = argValue("--out");
if (!outArg) throw new Error("Usage: prepare-cover-image2-dispatch.mjs --out <topic> [--concurrency <1-9>]");
const topicDir = resolve(outArg);
const requestPath = join(topicDir, "workflow", "context-image2-cover-requests.json");
if (!existsSync(requestPath)) throw new Error(`Cover request manifest is missing: ${requestPath}`);
const manifest = readJson(requestPath);
const requestedConcurrency = Number(argValue("--concurrency", process.env.CODEX_VIDEO_IMAGE2_CONCURRENCY || ""));
const plan = buildCoverImage2DispatchPlan({ manifest, topicDir, requestedConcurrency });
const planPath = join(topicDir, "workflow", "cover-image2-dispatch-plan.json");
const runPath = join(topicDir, "workflow", "cover-generation-run.json");
const workflowPath = join(topicDir, "workflow", "cover-generation-workflow.json");
const coversVerified = manifest.allRequestedPlatformUploadCoversReady === true
  && Number(manifest.pendingRequestCount || 0) === 0;
const coversGenerated = plan.jobs.length === 0;
const run = {
  schemaVersion: 1,
  stage: "cover-generation-run",
  status: coversVerified ? "verified" : plan.jobs.length ? "dispatch-ready" : "generated",
  coversGenerated,
  coversVerified,
  plannedTargetCount: plan.plannedTargetCount,
  requestedTargetCount: plan.requestedTargetCount,
  pendingTargetCount: plan.pendingTargetCount,
  completedTargetIds: plan.completedTargetIds,
  pendingTargetIds: plan.pendingTargetIds,
  concurrency: plan.concurrency,
  dispatchStrategy: plan.strategy,
  timing: {
    plannedAt: plan.createdAt,
    dispatchStartedAt: null,
    allGeneratedAt: plan.jobs.length ? null : plan.createdAt,
    verifiedAt: coversVerified ? plan.createdAt : null,
  },
  targetResults: [],
  dispatchPlanPath: "workflow/cover-image2-dispatch-plan.json",
};
const workflow = buildCoverGenerationWorkflowContract({ requestManifest: manifest, generationRun: run });
writeJsonAtomic(planPath, plan);
writeJsonAtomic(runPath, run);
writeJsonAtomic(workflowPath, workflow);
console.log(JSON.stringify({
  ok: true,
  topicDir,
  planPath,
  runPath,
  plannedTargetCount: plan.plannedTargetCount,
  pendingTargetCount: plan.pendingTargetCount,
  concurrency: plan.concurrency,
  singleWave: plan.singleWave,
  pendingTargetIds: plan.pendingTargetIds,
}, null, 2));
