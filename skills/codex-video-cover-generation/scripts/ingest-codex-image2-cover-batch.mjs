#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

function runNode(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`command failed (${result.status}): node ${script} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

const outArg = argValue("--out");
if (!outArg) throw new Error("Usage: ingest-codex-image2-cover-batch.mjs --out <topic> [--workflow-root <videocreat-root>]");
const topicDir = resolve(outArg);
const workflowRoot = resolve(argValue("--workflow-root", process.env.CODEX_VIDEO_WORKFLOW_ROOT || process.cwd()));
const ingestScript = join(workflowRoot, "scripts", "ingest-codex-image2-cover-target.mjs");
const coverValidator = join(workflowRoot, "scripts", "validate-cover-generation-workflow.mjs");
const platformValidator = join(workflowRoot, "scripts", "validate-platform-submission-cover.mjs");
for (const path of [ingestScript, coverValidator, platformValidator]) {
  if (!existsSync(path)) throw new Error(`Cover workflow dependency is missing: ${path}`);
}

const planPath = join(topicDir, "workflow", "cover-image2-dispatch-plan.json");
const runPath = join(topicDir, "workflow", "cover-generation-run.json");
const requestPath = join(topicDir, "workflow", "context-image2-cover-requests.json");
const workflowPath = join(topicDir, "workflow", "cover-generation-workflow.json");
for (const path of [planPath, runPath, requestPath, workflowPath]) {
  if (!existsSync(path)) throw new Error(`Required cover batch artifact is missing: ${path}`);
}
const plan = readJson(planPath);
const run = readJson(runPath);
const manifest = readJson(requestPath);
if (run.coversGenerated !== true) throw new Error("Cannot batch-ingest before every pending Image2 target has generated successfully");
const resultByTarget = new Map((run.targetResults || []).map((item) => [item.targetId, item]));
const requestByTarget = new Map((manifest.requests || []).map((item) => [item.targetId, item]));
const targetIds = plan.pendingTargetIds || [];
const entries = targetIds.map((targetId) => {
  const result = resultByTarget.get(targetId);
  const request = requestByTarget.get(targetId);
  if (!result || result.status !== "generated" || !result.sourcePath) throw new Error(`Missing generated dispatch result for ${targetId}`);
  if (!request) throw new Error(`Missing canonical request for ${targetId}`);
  const receiptPath = join(topicDir, request.generationReceiptPath || "");
  const inspectionPath = join(topicDir, request.inspectionRecordPath || "");
  if (!existsSync(receiptPath) || !existsSync(inspectionPath)) throw new Error(`Missing receipt or inspection evidence for ${targetId}`);
  return { targetId, sourcePath: result.sourcePath, receiptPath, inspectionPath };
});

const lockPath = join(topicDir, "workflow", ".cover-ingest.lock");
try {
  mkdirSync(lockPath);
} catch (error) {
  if (error?.code === "EEXIST") throw new Error(`Another cover batch ingest is active: ${lockPath}`);
  throw error;
}

let completed = 0;
try {
  for (const entry of entries) {
    runNode(ingestScript, [
      "--topic", topicDir,
      "--target", entry.targetId,
      "--source", entry.sourcePath,
      "--generation-receipt", entry.receiptPath,
      "--inspection-record", entry.inspectionPath,
      "--validate-only",
    ], workflowRoot);
  }
  for (const entry of entries) {
    runNode(ingestScript, [
      "--topic", topicDir,
      "--target", entry.targetId,
      "--source", entry.sourcePath,
      "--generation-receipt", entry.receiptPath,
      "--inspection-record", entry.inspectionPath,
      "--defer-package-finalization",
    ], workflowRoot);
    completed += 1;
  }
  runNode(coverValidator, ["--out", topicDir], workflowRoot);
  runNode(platformValidator, ["--out", topicDir], workflowRoot);
  const completedAt = new Date().toISOString();
  const finalManifest = readJson(requestPath);
  if (finalManifest.allRequestedPlatformUploadCoversReady !== true || Number(finalManifest.pendingRequestCount || 0) !== 0) {
    throw new Error("Batch ingest finished without satisfying the complete requested cover scope");
  }
  const finalRun = readJson(runPath);
  finalRun.status = "covers_verified";
  finalRun.coversGenerated = true;
  finalRun.coversVerified = true;
  finalRun.timing = { ...(finalRun.timing || {}), verifiedAt: completedAt };
  finalRun.ingest = {
    mode: "locked-preflight-then-sequential-commit",
    ingestedTargetCount: completed,
    fullVideoQcTriggered: false,
    completedAt,
  };
  writeJsonAtomic(runPath, finalRun);
  writeJsonAtomic(workflowPath, buildCoverGenerationWorkflowContract({
    requestManifest: finalManifest,
    generationRun: finalRun,
  }));
  console.log(JSON.stringify({
    ok: true,
    topicDir,
    ingestMode: "locked-preflight-then-sequential-commit",
    ingestedTargetCount: completed,
    coversGenerated: true,
    coversVerified: true,
    fullVideoQcTriggered: false,
  }, null, 2));
} catch (error) {
  const failedRun = existsSync(runPath) ? readJson(runPath) : run;
  failedRun.status = "ingest_failed";
  failedRun.coversVerified = false;
  failedRun.ingest = {
    mode: "locked-preflight-then-sequential-commit",
    ingestedTargetCount: completed,
    failedAt: new Date().toISOString(),
    error: String(error?.message || error),
  };
  writeJsonAtomic(runPath, failedRun);
  throw error;
} finally {
  rmSync(lockPath, { recursive: true, force: true });
}
