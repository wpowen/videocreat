#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
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

function inputImageSha256(path) {
  if (!path) return "";
  const resolvedPath = resolve(topicDir, path);
  if (!existsSync(resolvedPath)) return "missing";
  return createHash("sha256").update(readFileSync(resolvedPath)).digest("hex");
}

function sourceSha256(path) {
  if (!path || !existsSync(path)) return "";
  const rootArgument = resolve(process.env.CODEX_VIDEO_COVER_GENERATED_ROOT
    || join(process.env.CODEX_HOME || join(process.env.HOME || "", ".codex"), "generated_images"));
  if (!existsSync(rootArgument)) return "";
  const canonicalRoot = realpathSync(rootArgument);
  const canonicalSource = realpathSync(path);
  const relation = relative(canonicalRoot, canonicalSource);
  if (relation === ".." || relation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(relation)) return "";
  return createHash("sha256").update(readFileSync(canonicalSource)).digest("hex");
}

const outArg = argValue("--out");
if (!outArg) throw new Error("Usage: prepare-cover-image2-dispatch.mjs --out <topic> [--concurrency <1-9>]");
const topicDir = resolve(outArg);
const requestPath = join(topicDir, "workflow", "context-image2-cover-requests.json");
if (!existsSync(requestPath)) throw new Error(`Cover request manifest is missing: ${requestPath}`);
const manifest = readJson(requestPath);
const requestedConcurrency = Number(argValue("--concurrency", process.env.CODEX_VIDEO_IMAGE2_CONCURRENCY || ""));
const planPath = join(topicDir, "workflow", "cover-image2-dispatch-plan.json");
const runPath = join(topicDir, "workflow", "cover-generation-run.json");
const workflowPath = join(topicDir, "workflow", "cover-generation-workflow.json");
const previousPlan = existsSync(planPath) ? readJson(planPath) : {};
const previousRun = existsSync(runPath) ? readJson(runPath) : {};
const plan = buildCoverImage2DispatchPlan({
  manifest,
  topicDir,
  requestedConcurrency,
  previousPlan,
  previousRun,
  sourceExists: existsSync,
  inputImageFingerprint: inputImageSha256,
  sourceFingerprint: sourceSha256,
});
const coversVerified = manifest.allRequestedPlatformUploadCoversReady === true
  && Number(manifest.pendingRequestCount || 0) === 0;
const coversGenerated = plan.jobs.length === 0;
const preservedGeneratedSet = new Set(plan.preservedGeneratedTargetIds || []);
const preservedTargetResults = (previousRun.targetResults || [])
  .filter((result) => result.status === "generated" && preservedGeneratedSet.has(result.targetId));
const generationTargetIds = (manifest.requests || []).map((request) => String(request.targetId || request.id || "").replace(/-image2-integrated-cover$/, ""));
const generatedTargetIds = [...new Set([...plan.completedTargetIds, ...plan.preservedGeneratedTargetIds])];
const run = {
  schemaVersion: 1,
  stage: "cover-generation-run",
  status: coversVerified ? "verified" : plan.jobs.length ? "dispatch-ready" : "covers_generated",
  coversGenerated,
  coversVerified,
  plannedTargetCount: plan.plannedTargetCount,
  requestedTargetCount: plan.requestedTargetCount,
  pendingTargetCount: plan.pendingTargetCount,
  generationTargetIds,
  generatedTargetIds,
  failedTargetIds: [],
  retryTargetIds: (previousRun.retryTargetIds || []).filter((targetId) => plan.pendingTargetIds.includes(targetId)),
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
  targetResults: preservedTargetResults,
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
  preservedGeneratedTargetIds: plan.preservedGeneratedTargetIds,
}, null, 2));
